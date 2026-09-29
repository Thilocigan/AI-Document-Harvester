import os
import shutil
import asyncio
import json
import zipfile
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()
from typing import Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from jobs import job_manager, JobState, DiscoveredPDF
from crawler import crawler_engine
from processor import document_processor
from synthesizer import synthesizer_engine
from merger import master_merger
from rag import rag_system
from sample_data import ensure_sample_pdfs, SAMPLES_DIR

app = FastAPI(
    title="AI PDF Crawler & Synthesizer API",
    description="Intelligent end-to-end platform to crawl, extract, synthesize, and merge PDFs",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure sample PDFs exist at startup
ensure_sample_pdfs()

class PipelineRequest(BaseModel):
    target_url: str
    depth_level: str = "single"  # single or entire
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    is_demo: bool = False
    include_cover_summary: bool = False

class ChatRequest(BaseModel):
    job_id: str
    question: str
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None

class TogglePDFRequest(BaseModel):
    pdf_id: str
    selected: bool

async def run_autonomous_pipeline(
    job_id: str,
    target_url: str,
    depth_level: str,
    openai_key: Optional[str],
    gemini_key: Optional[str],
    is_demo: bool = False,
    include_cover_summary: bool = False
):
    try:
        # Check if demo or special mock domain
        if is_demo or "demo" in target_url.lower() or "sample" in target_url.lower():
            job_manager.add_log(job_id, "INFO", "Initializing Built-in Demo Dataset with pre-verified document assets...")
            job_dir = document_processor.get_job_dir(job_id)

            sample_files = [
                ("Q4_Enterprise_AI_Strategy_2026.pdf", "Enterprise AI Strategy & Infrastructure Blueprint 2026"),
                ("Global_Climate_Impact_Report_2026.pdf", "Global Climate & Sustainable Technology Assessment"),
                ("Healthcare_Autonomous_Systems_Whitepaper.pdf", "Autonomous Clinical AI & Biomedical Document Synthesis")
            ]

            pdf_models = []
            for i, (sf, title) in enumerate(sample_files):
                src_path = os.path.join(SAMPLES_DIR, sf)
                dst_path = os.path.join(job_dir, sf)
                if os.path.exists(src_path):
                    shutil.copy2(src_path, dst_path)

                size_b = os.path.getsize(dst_path) if os.path.exists(dst_path) else 150000
                pdf_models.append(DiscoveredPDF(
                    id=f"pdf_{i+1}",
                    url=f"http://demo.domain/assets/{sf}",
                    filename=sf,
                    title=title,
                    file_size_bytes=size_b,
                    page_count=3,
                    local_path=dst_path,
                    selected=True,
                    status="discovered"
                ))

            job_manager.update_pdfs(job_id, pdf_models)
            await asyncio.sleep(1.0)
            job_manager.update_progress(job_id, 1, "Discovered 3 enterprise PDF assets from demo repository", 25)
        else:
            # PHASE 1: Crawling
            discovered_pdfs = await crawler_engine.crawl(job_id, target_url, depth_level)
            if not discovered_pdfs:
                job_manager.fail_job(job_id, f"No PDF documents were discovered on '{target_url}'. Verify the URL or select 'Entire Site' mode.")
                return

        # PHASE 2: Ingesting & OCR / PyMuPDF parsing
        job = job_manager.get_job(job_id)
        current_pdfs = job.discovered_pdfs if job else []
        parsed_docs = await document_processor.process_all(job_id, current_pdfs)

        if not parsed_docs:
            job_manager.fail_job(job_id, "All discovered PDF files failed download or text extraction.")
            return

        # Index into RAG vector engine
        rag_system.index_job_documents(job_id, parsed_docs)
        job_manager.add_log(job_id, "INFO", f"Indexed {len(parsed_docs)} documents into in-memory RAG vector store.")

        # PHASE 3: AI Content Analysis & Semantic De-duplication
        analysis = await synthesizer_engine.analyze(
            job_id,
            parsed_docs,
            openai_key=openai_key,
            gemini_key=gemini_key
        )

        # PHASE 4: Master PDF Compilation & Stitching Total PDFs
        master_path = master_merger.merge_master_pdf(
            job_id=job_id,
            target_url=target_url,
            analysis=analysis,
            pdf_list=job_manager.get_job(job_id).discovered_pdfs,
            include_cover_summary=include_cover_summary
        )

        if not master_path:
            job_manager.fail_job(job_id, "Compilation of Master PDF could not be completed.")

    except Exception as e:
        job_manager.fail_job(job_id, f"Unexpected pipeline exception: {str(e)}")

@app.post("/api/start-pipeline")
async def start_pipeline(req: PipelineRequest, background_tasks: BackgroundTasks):
    job = job_manager.create_job(req.target_url, req.depth_level)
    background_tasks.add_task(
        run_autonomous_pipeline,
        job.job_id,
        req.target_url,
        req.depth_level,
        req.openai_api_key,
        req.gemini_api_key,
        req.is_demo,
        req.include_cover_summary
    )
    return {
        "job_id": job.job_id,
        "status": "queued",
        "stream_url": f"/api/stream/{job.job_id}"
    }

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.dict()

@app.post("/api/jobs/{job_id}/toggle-pdf")
async def toggle_pdf(job_id: str, req: TogglePDFRequest):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    for pdf in job.discovered_pdfs:
        if pdf.id == req.pdf_id:
            pdf.selected = req.selected
            break

    job_manager.update_pdfs(job_id, job.discovered_pdfs)
    return {"status": "ok", "pdf_id": req.pdf_id, "selected": req.selected}

class ReorderPDFsRequest(BaseModel):
    order: List[str]

class ReMergeRequest(BaseModel):
    include_cover_summary: bool = False

@app.post("/api/jobs/{job_id}/reorder-pdfs")
async def reorder_pdfs(job_id: str, req: ReorderPDFsRequest):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    pdf_dict = {p.id: p for p in job.discovered_pdfs}
    new_list = [pdf_dict[pid] for pid in req.order if pid in pdf_dict]
    for p in job.discovered_pdfs:
        if p.id not in req.order:
            new_list.append(p)

    job_manager.update_pdfs(job_id, new_list)
    return {"status": "ok", "order": [p.id for p in new_list]}

@app.post("/api/jobs/{job_id}/re-merge")
async def re_merge_job(job_id: str, background_tasks: BackgroundTasks, req: Optional[ReMergeRequest] = None):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.synthesized_analysis:
        raise HTTPException(status_code=400, detail="Synthesis not completed for this job yet")

    include_cover = req.include_cover_summary if req else False

    def _do_remerge():
        master_merger.merge_master_pdf(
            job_id=job_id,
            target_url=job.target_url,
            analysis=job.synthesized_analysis,
            pdf_list=job.discovered_pdfs,
            include_cover_summary=include_cover
        )

    background_tasks.add_task(_do_remerge)
    return {"status": "remerging", "message": "Recompiling Master PDF with updated selections and sequence"}

class PageOperation(BaseModel):
    original_index: int
    rotation: int = 0

class PageEditsRequest(BaseModel):
    page_operations: List[PageOperation]

@app.get("/api/jobs/{job_id}/pages")
async def get_master_pages(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    pages = master_merger.get_master_pages(job_id)
    return {
        "job_id": job_id,
        "total_pages": len(pages),
        "pages": pages
    }

@app.get("/api/jobs/{job_id}/page-thumbnail/{page_index}")
async def get_page_thumbnail(job_id: str, page_index: int):
    thumb = master_merger.render_page_thumbnail(job_id, page_index)
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return Response(content=thumb, media_type="image/png")

@app.get("/api/jobs/{job_id}/page-preview/{page_index}")
async def get_page_preview(job_id: str, page_index: int):
    preview = master_merger.render_page_preview(job_id, page_index)
    if not preview:
        raise HTTPException(status_code=404, detail="High-res preview not available")
    return Response(content=preview, media_type="image/png")

@app.post("/api/jobs/{job_id}/edit-pages")
async def edit_master_pages(job_id: str, req: PageEditsRequest):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ops = [op.dict() for op in req.page_operations]
    result = master_merger.apply_page_edits(job_id, ops)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to apply page edits")

    return {
        "status": "success",
        "total_pages": result["total_pages"],
        "file_size": result["file_size"],
        "download_url": f"/api/download/{job_id}"
    }

@app.post("/api/jobs/{job_id}/upload-local-pdf")
async def upload_local_pdf(job_id: str, files: List[UploadFile] = File(...)):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not files:
        raise HTTPException(status_code=400, detail="No files selected")

    uploaded_data = []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            continue
        content = await f.read()
        if len(content) > 0:
            uploaded_data.append((f.filename, content))

    if not uploaded_data:
        raise HTTPException(status_code=400, detail="No valid PDF files provided. Please upload valid .pdf files.")

    result = master_merger.append_local_pdfs(job_id, uploaded_data)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to append uploaded PDF files")

    return {
        "status": "success",
        "message": f"Successfully combined {len(result['added_files'])} local PDF(s) into Master Document",
        "total_pages": result["total_pages"],
        "file_size": result["file_size"],
        "added_files": result["added_files"],
        "pages": master_merger.get_master_pages(job_id)
    }

class PageNumberRequest(BaseModel):
    position: str = "bottom-center"
    format_pattern: str = "Page {page} of {total}"
    font_size: float = 9.0
    color_hex: str = "#64748b"
    skip_first_page: bool = False

@app.post("/api/jobs/{job_id}/apply-page-numbers")
async def apply_page_numbers(job_id: str, req: PageNumberRequest):
    res = master_merger.apply_page_numbering(
        job_id=job_id,
        position=req.position,
        format_pattern=req.format_pattern,
        font_size=req.font_size,
        color_hex=req.color_hex,
        skip_first_page=req.skip_first_page
    )
    if not res:
        raise HTTPException(status_code=500, detail="Failed to apply page numbering")
    return res

class WatermarkRequest(BaseModel):
    text: str = "CONFIDENTIAL"
    opacity: float = 0.2
    angle: int = 45
    font_size: float = 46.0
    color_hex: str = "#94a3b8"

@app.post("/api/jobs/{job_id}/apply-watermark")
async def apply_watermark(job_id: str, req: WatermarkRequest):
    res = master_merger.apply_watermark(
        job_id=job_id,
        text=req.text,
        opacity=req.opacity,
        angle=req.angle,
        font_size=req.font_size,
        color_hex=req.color_hex
    )
    if not res:
        raise HTTPException(status_code=500, detail="Failed to apply watermark")
    return res

@app.post("/api/jobs/{job_id}/optimize-pdf")
async def optimize_pdf(job_id: str):
    res = master_merger.optimize_master_pdf(job_id)
    if not res:
        raise HTTPException(status_code=500, detail="Optimization failed")
    return res

class MetadataRequest(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[str] = None

@app.post("/api/jobs/{job_id}/update-metadata")
async def update_metadata(job_id: str, req: MetadataRequest):
    res = master_merger.update_pdf_metadata(
        job_id=job_id,
        title=req.title,
        author=req.author,
        subject=req.subject,
        keywords=req.keywords
    )
    if not res:
        raise HTTPException(status_code=500, detail="Failed to update metadata")
    return res

@app.get("/api/stream/{job_id}")
async def stream_job_events(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    q = job_manager.subscribe(job_id)

    async def event_generator():
        # First send current initial snapshot
        yield {
            "event": "init",
            "data": json.dumps(job.dict())
        }
        try:
            while True:
                msg = await q.get()
                yield {
                    "event": msg.get("type", "update"),
                    "data": json.dumps(msg.get("data", {}))
                }
                if msg.get("type") in ["completed", "error"]:
                    break
        except asyncio.CancelledError:
            pass
        finally:
            job_manager.unsubscribe(job_id, q)

    return EventSourceResponse(event_generator())

@app.post("/api/chat")
async def rag_chat(req: ChatRequest):
    job = job_manager.get_job(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result = await rag_system.query(
        req.job_id,
        req.question,
        openai_key=req.openai_api_key,
        gemini_key=req.gemini_api_key
    )
    return result

@app.get("/api/download/{job_id}")
async def download_master_pdf(job_id: str):
    job = job_manager.get_job(job_id)
    if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
        raise HTTPException(status_code=404, detail="Master PDF not ready or not found")

    filename = job.master_pdf_filename or f"Consolidated_Master_{job_id}.pdf"
    return FileResponse(
        path=job.master_pdf_path,
        filename=filename,
        media_type="application/pdf"
    )

@app.get("/api/download/{job_id}/summary")
async def download_summary_markdown(job_id: str):
    job = job_manager.get_job(job_id)
    if not job or not job.synthesized_analysis:
        raise HTTPException(status_code=404, detail="Synthesized analysis not found")

    content = job.synthesized_analysis.markdown_report or job.synthesized_analysis.executive_summary
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f"attachment; filename=AI_Synthesis_Report_{job_id}.md"}
    )

@app.get("/api/pdf/{job_id}/{filename}")
async def view_original_pdf(job_id: str, filename: str):
    job_dir = document_processor.get_job_dir(job_id)
    file_path = os.path.join(job_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, media_type="application/pdf")

@app.get("/api/download/{job_id}/summary-pdf")
async def download_summary_pdf(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job_dir = document_processor.get_job_dir(job_id)
    summary_pdf_path = os.path.join(job_dir, "Executive_Summary_Report.pdf")
    if not os.path.exists(summary_pdf_path):
        raise HTTPException(status_code=404, detail="Executive summary PDF not generated yet")
    return FileResponse(
        path=summary_pdf_path,
        filename=f"Executive_Summary_Report_{job_id}.pdf",
        media_type="application/pdf"
    )

@app.get("/api/download/{job_id}/zip")
async def download_all_zip(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    selected = [p for p in job.discovered_pdfs if p.selected and p.local_path and os.path.exists(p.local_path)]
    if not selected:
        raise HTTPException(status_code=404, detail="No selected files found")

    job_dir = document_processor.get_job_dir(job_id)
    zip_path = os.path.join(job_dir, f"All_Collected_PDFs_{job_id}.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in selected:
            zf.write(p.local_path, arcname=p.filename)
        if job.master_pdf_path and os.path.exists(job.master_pdf_path):
            zf.write(job.master_pdf_path, arcname=f"00_COMPLETE_MERGED_DOCUMENT_{job_id}.pdf")

    return FileResponse(
        path=zip_path,
        filename=f"All_Collected_PDFs_{job_id}.zip",
        media_type="application/zip"
    )

class ExtractRangeRequest(BaseModel):
    range: str  # e.g. "1-5, 10, 15-20"

@app.post("/api/jobs/{job_id}/extract-range")
async def extract_custom_page_range(job_id: str, req: ExtractRangeRequest):
    extracted_path = master_merger.extract_page_range(job_id, req.range)
    if not extracted_path or not os.path.exists(extracted_path):
        raise HTTPException(status_code=400, detail="Invalid page range or range exceeds document length")

    return FileResponse(
        path=extracted_path,
        filename=f"Extracted_Pages_{job_id}.pdf",
        media_type="application/pdf"
    )

@app.get("/api/presets")
async def get_presets():
    return [
        {
            "id": "futurebright-courses",
            "name": "Future Bright Infotech (Button PDFs)",
            "url": "https://futurebrightinfotech.netlify.app/course",
            "depth": "single",
            "description": "Scrapes and merges 6 downloadable course syllabus PDFs embedded within interactive buttons",
            "is_demo": False
        },
        {
            "id": "enterprise-demo",
            "name": "Enterprise AI & Climate 2026 (Instant Demo)",
            "url": "https://demo.enterprise-intelligence.org",
            "depth": "single",
            "description": "3 pre-verified multi-page reports: AI Strategy, Climate Tech, Healthcare Autonomous Systems",
            "is_demo": True
        },
        {
            "id": "arxiv-sample",
            "name": "ArXiv AI Research Preprints",
            "url": "https://arxiv.org/list/cs.AI/recent",
            "depth": "single",
            "description": "Scrapes and synthesizes top recent computer science AI PDF preprints",
            "is_demo": False
        },
        {
            "id": "w3c-specs",
            "name": "W3C Technical Whitepapers",
            "url": "https://www.w3.org/TR/",
            "depth": "single",
            "description": "Extracts standard specifications, web architecture papers, and recommendations",
            "is_demo": False
        }
    ]

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "AI PDF Crawler & Synthesizer API"}
