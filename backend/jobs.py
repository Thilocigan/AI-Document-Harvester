import asyncio
import os
import json
import time
import uuid
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

class DiscoveredPDF(BaseModel):
    id: str
    url: str
    filename: str
    title: Optional[str] = None
    file_size_bytes: int = 0
    page_count: int = 0
    local_path: Optional[str] = None
    selected: bool = True
    status: str = "discovered"  # discovered, downloading, parsed, failed, skipped
    error_message: Optional[str] = None
    summary_snippet: Optional[str] = None
    extracted_text_preview: Optional[str] = None
    word_count: int = 0

class ChapterTOC(BaseModel):
    title: str
    summary: str
    source_documents: List[str] = Field(default_factory=list)
    key_points: List[str] = Field(default_factory=list)

class SynthesizedAnalysis(BaseModel):
    executive_summary: str = ""
    word_count: int = 0
    table_of_contents: List[ChapterTOC] = Field(default_factory=list)
    redundancies_pruned: List[str] = Field(default_factory=list)
    thematic_chapters: List[Dict[str, Any]] = Field(default_factory=list)
    markdown_report: str = ""
    model_used: str = "local-nlp"

class JobState(BaseModel):
    job_id: str
    target_url: str
    depth_level: str = "single"  # single or entire
    status: str = "idle"  # idle, crawling, ingesting, analyzing, merging, completed, failed
    current_phase: int = 0  # 1 to 4
    phase_description: str = "Ready"
    progress_percentage: int = 0
    discovered_pdfs: List[DiscoveredPDF] = Field(default_factory=list)
    synthesized_analysis: Optional[SynthesizedAnalysis] = None
    master_pdf_path: Optional[str] = None
    master_pdf_filename: Optional[str] = None
    master_pdf_size: int = 0
    master_page_count: int = 0
    error_message: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
    logs: List[Dict[str, Any]] = Field(default_factory=list)

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, JobState] = {}
        self.subscribers: Dict[str, List[asyncio.Queue]] = {}
        self.lock = asyncio.Lock()
        self.storage_dir = os.path.join(os.path.dirname(__file__), "storage")
        os.makedirs(self.storage_dir, exist_ok=True)

    def _save_job_state(self, job_id: str):
        job = self.jobs.get(job_id)
        if not job:
            return
        try:
            job_dir = os.path.join(self.storage_dir, job_id)
            os.makedirs(job_dir, exist_ok=True)
            state_file = os.path.join(job_dir, "job_state.json")
            with open(state_file, "w", encoding="utf-8") as f:
                json.dump(job.dict(), f, indent=2)
        except Exception:
            pass

    def create_job(self, target_url: str, depth_level: str = "single") -> JobState:
        job_id = str(uuid.uuid4())[:8]
        job = JobState(
            job_id=job_id,
            target_url=target_url,
            depth_level=depth_level,
            status="queued",
            current_phase=1,
            phase_description="Initializing crawler engine...",
            progress_percentage=5,
        )
        self.jobs[job_id] = job
        self.subscribers[job_id] = []
        self._save_job_state(job_id)
        self.add_log(job_id, "INFO", f"Job created for {target_url} (depth: {depth_level})")
        return job

    def get_job(self, job_id: str) -> Optional[JobState]:
        if job_id in self.jobs:
            return self.jobs[job_id]

        # Attempt to reload from disk
        state_file = os.path.join(self.storage_dir, job_id, "job_state.json")
        if os.path.exists(state_file):
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    job = JobState(**data)
                    self.jobs[job_id] = job
                    if job_id not in self.subscribers:
                        self.subscribers[job_id] = []
                    return job
            except Exception:
                pass

        # Attempt to auto-recover if master PDF exists in storage folder
        job_dir = os.path.join(self.storage_dir, job_id)
        if os.path.isdir(job_dir):
            master_name = f"Merged_Complete_PDFs_{job_id}.pdf"
            master_path = os.path.join(job_dir, master_name)
            if os.path.exists(master_path):
                try:
                    import pymupdf
                    doc = pymupdf.open(master_path)
                    p_count = len(doc)
                    doc.close()

                    # Recover discovered PDFs from files in directory
                    disc_pdfs = []
                    for f in os.listdir(job_dir):
                        if f.endswith(".pdf") and not f.startswith("Merged_") and not f.startswith("Executive_"):
                            fp = os.path.join(job_dir, f)
                            disc_pdfs.append(DiscoveredPDF(
                                id=str(uuid.uuid4())[:6],
                                url=f,
                                filename=f,
                                title=f.replace(".pdf", ""),
                                file_size_bytes=os.path.getsize(fp),
                                page_count=0,
                                local_path=fp,
                                status="parsed"
                            ))

                    job = JobState(
                        job_id=job_id,
                        target_url="Recovered Session",
                        status="completed",
                        current_phase=4,
                        phase_description="Master PDF successfully compiled & ready for download",
                        progress_percentage=100,
                        master_pdf_path=master_path,
                        master_pdf_filename=master_name,
                        master_pdf_size=os.path.getsize(master_path),
                        master_page_count=p_count,
                        discovered_pdfs=disc_pdfs
                    )
                    self.jobs[job_id] = job
                    self._save_job_state(job_id)
                    return job
                except Exception:
                    pass

        return None

    def add_log(self, job_id: str, level: str, message: str):
        job = self.jobs.get(job_id)
        if not job:
            return
        log_entry = {
            "timestamp": time.strftime("%H:%M:%S"),
            "level": level,
            "message": message
        }
        job.logs.append(log_entry)
        job.updated_at = time.time()
        self._notify_subscribers(job_id, {"type": "log", "data": log_entry})

    def update_progress(self, job_id: str, phase: int, description: str, percentage: int, status: str = None):
        job = self.jobs.get(job_id)
        if not job:
            return
        job.current_phase = phase
        job.phase_description = description
        job.progress_percentage = percentage
        if status:
            job.status = status
        job.updated_at = time.time()
        self._save_job_state(job_id)
        self._notify_subscribers(job_id, {
            "type": "progress",
            "data": {
                "phase": phase,
                "description": description,
                "percentage": percentage,
                "status": job.status
            }
        })

    def update_pdfs(self, job_id: str, pdfs: List[DiscoveredPDF]):
        job = self.jobs.get(job_id)
        if not job:
            return
        job.discovered_pdfs = pdfs
        job.updated_at = time.time()
        self._save_job_state(job_id)
        self._notify_subscribers(job_id, {
            "type": "pdfs_updated",
            "data": [p.dict() for p in pdfs]
        })

    def set_synthesis(self, job_id: str, analysis: SynthesizedAnalysis):
        job = self.jobs.get(job_id)
        if not job:
            return
        job.synthesized_analysis = analysis
        job.updated_at = time.time()
        self._save_job_state(job_id)
        self._notify_subscribers(job_id, {
            "type": "synthesis_ready",
            "data": analysis.dict()
        })

    def set_master_pdf(self, job_id: str, file_path: str, filename: str, file_size: int, page_count: int):
        job = self.jobs.get(job_id)
        if not job:
            return
        job.master_pdf_path = file_path
        job.master_pdf_filename = filename
        job.master_pdf_size = file_size
        job.master_page_count = page_count
        job.status = "completed"
        job.current_phase = 4
        job.phase_description = "Master PDF successfully compiled & ready for download"
        job.progress_percentage = 100
        job.updated_at = time.time()
        self._save_job_state(job_id)
        self._notify_subscribers(job_id, {
            "type": "completed",
            "data": {
                "filename": filename,
                "file_size": file_size,
                "page_count": page_count,
                "download_url": f"/api/download/{job_id}"
            }
        })

    def fail_job(self, job_id: str, error_msg: str):
        job = self.jobs.get(job_id)
        if not job:
            return
        job.status = "failed"
        job.error_message = error_msg
        job.updated_at = time.time()
        self._save_job_state(job_id)
        self.add_log(job_id, "ERROR", error_msg)
        self._notify_subscribers(job_id, {
            "type": "error",
            "data": {"message": error_msg}
        })

    def subscribe(self, job_id: str) -> asyncio.Queue:
        if job_id not in self.subscribers:
            self.subscribers[job_id] = []
        q = asyncio.Queue()
        self.subscribers[job_id].append(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue):
        if job_id in self.subscribers and q in self.subscribers[job_id]:
            self.subscribers[job_id].remove(q)

    def _notify_subscribers(self, job_id: str, message: dict):
        if job_id not in self.subscribers:
            return
        for q in self.subscribers[job_id]:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                pass

job_manager = JobManager()
