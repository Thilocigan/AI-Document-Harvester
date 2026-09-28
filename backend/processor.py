import os
import asyncio
import hashlib
from typing import List, Dict, Any, Optional
import httpx
import pymupdf  # PyMuPDF
from jobs import DiscoveredPDF, job_manager

STORAGE_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "storage"))

class DocumentProcessor:
    def __init__(self):
        os.makedirs(STORAGE_BASE, exist_ok=True)

    def get_job_dir(self, job_id: str) -> str:
        job_dir = os.path.join(STORAGE_BASE, job_id)
        os.makedirs(job_dir, exist_ok=True)
        return job_dir

    async def download_file(self, client: httpx.AsyncClient, pdf: DiscoveredPDF, job_dir: str) -> Optional[str]:
        if pdf.local_path and os.path.exists(pdf.local_path):
            pdf.file_size_bytes = os.path.getsize(pdf.local_path)
            return pdf.local_path

        target_path = os.path.join(job_dir, pdf.filename)
        # Handle filename collisions
        base_name, ext = os.path.splitext(pdf.filename)
        counter = 1
        while os.path.exists(target_path):
            target_path = os.path.join(job_dir, f"{base_name}_{counter}{ext}")
            counter += 1

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "application/pdf,*/*"
            }
            async with client.stream("GET", pdf.url, headers=headers, follow_redirects=True, timeout=30.0) as resp:
                if resp.status_code != 200:
                    pdf.status = "failed"
                    pdf.error_message = f"HTTP {resp.status_code} error during download"
                    return None

                # Extract accurate filename if server sends Content-Disposition
                cd = resp.headers.get("content-disposition", "")
                if "filename=" in cd.lower():
                    m = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';]+)["\']?', cd, re.IGNORECASE)
                    if m:
                        server_fn = urllib.parse.unquote(m.group(1).strip())
                        server_fn = re.sub(r'[\\/*?:"<>|]', "", server_fn)
                        if server_fn.lower().endswith(".pdf"):
                            pdf.filename = server_fn
                            target_path = os.path.join(job_dir, server_fn)

                total_bytes = 0
                max_bytes = 60 * 1024 * 1024  # 60MB limit per file

                with open(target_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=65536):
                        total_bytes += len(chunk)
                        if total_bytes > max_bytes:
                            pdf.status = "skipped"
                            pdf.error_message = "File exceeds maximum size limit (60MB)"
                            f.close()
                            if os.path.exists(target_path):
                                os.remove(target_path)
                            return None
                        f.write(chunk)

                pdf.file_size_bytes = total_bytes
                pdf.local_path = target_path
                return target_path

        except Exception as e:
            pdf.status = "failed"
            pdf.error_message = f"Download failed: {str(e)}"
            return None

    def parse_pdf(self, pdf: DiscoveredPDF) -> Dict[str, Any]:
        """
        Parses PDF using PyMuPDF (fitz) with graceful password/corruption checks.
        Extracts structural text, headings, word counts, and page layout.
        """
        if not pdf.local_path or not os.path.exists(pdf.local_path):
            pdf.status = "failed"
            return {"error": "Missing downloaded file"}

        try:
            doc = pymupdf.open(pdf.local_path)

            # Check if encrypted/password-protected
            if doc.is_encrypted:
                pdf.status = "skipped"
                pdf.error_message = "Encrypted / Password-protected PDF"
                doc.close()
                return {"error": "Password protected"}

            total_pages = len(doc)
            pdf.page_count = total_pages

            pages_data = []
            full_text_list = []
            headings_found = []

            for page_idx in range(total_pages):
                page = doc[page_idx]
                page_text = page.get_text("text")
                clean_text = page_text.strip()
                full_text_list.append(clean_text)

                # Structural parsing: extract blocks with font sizes to identify headings
                try:
                    blocks = page.get_text("blocks")
                    for b in blocks:
                        # b: (x0, y0, x1, y1, text, block_no, block_type)
                        block_text = b[4].strip()
                        # Short single line with potential heading traits
                        if block_text and len(block_text.splitlines()) == 1 and 4 < len(block_text) < 90:
                            if block_text.isupper() or block_text.istitle() or any(block_text.startswith(prefix) for prefix in ["Chapter", "Section", "Part", "1.", "2.", "3.", "I.", "II."]):
                                headings_found.append(block_text)
                except Exception:
                    pass

                pages_data.append({
                    "page_number": page_idx + 1,
                    "text": clean_text,
                    "char_count": len(clean_text),
                })

            combined_text = "\n\n".join(full_text_list)
            words = combined_text.split()
            pdf.word_count = len(words)
            pdf.status = "parsed"
            pdf.extracted_text_preview = combined_text[:1200]
            # Formulate snippet
            summary_snippet = " ".join(words[:45]) + "..." if words else "Empty text extracted"
            pdf.summary_snippet = summary_snippet

            doc_meta = doc.metadata or {}
            if doc_meta.get("title") and len(doc_meta.get("title").strip()) > 2:
                pdf.title = doc_meta["title"].strip()

            doc.close()

            return {
                "pdf_id": pdf.id,
                "filename": pdf.filename,
                "title": pdf.title,
                "page_count": total_pages,
                "word_count": pdf.word_count,
                "headings": headings_found[:15],
                "pages": pages_data,
                "full_text": combined_text
            }

        except pymupdf.FileDataError as e:
            pdf.status = "failed"
            pdf.error_message = f"Corrupted PDF file format: {str(e)}"
            return {"error": "Corrupted file"}
        except Exception as e:
            pdf.status = "failed"
            pdf.error_message = f"Parsing error: {str(e)}"
            return {"error": str(e)}

    async def process_all(self, job_id: str, pdf_list: List[DiscoveredPDF]) -> List[Dict[str, Any]]:
        job_dir = self.get_job_dir(job_id)
        job_manager.update_progress(job_id, 2, f"Phase 2: Ingesting & OCR parsing {len(pdf_list)} documents found...", 30)
        job_manager.add_log(job_id, "INFO", f"Beginning asynchronous download and structural extraction of {len(pdf_list)} files...")

        parsed_documents: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            for idx, pdf in enumerate(pdf_list):
                if not pdf.selected:
                    pdf.status = "skipped"
                    job_manager.add_log(job_id, "DEBUG", f"Skipping unselected file: {pdf.filename}")
                    continue

                pdf.status = "downloading"
                job_manager.add_log(job_id, "DEBUG", f"Downloading [{idx+1}/{len(pdf_list)}]: {pdf.filename}")
                local_path = await self.download_file(client, pdf, job_dir)

                if local_path:
                    job_manager.add_log(job_id, "DEBUG", f"Parsing layout and extracting text for: {pdf.filename}")
                    result = self.parse_pdf(pdf)
                    if "error" not in result:
                        parsed_documents.append(result)
                        job_manager.add_log(
                            job_id, "SUCCESS",
                            f"Parsed '{pdf.filename}' ({pdf.page_count} pages, {pdf.word_count} words)"
                        )
                    else:
                        job_manager.add_log(job_id, "WARNING", f"Could not parse '{pdf.filename}': {pdf.error_message}")
                else:
                    job_manager.add_log(job_id, "WARNING", f"Failed to download '{pdf.filename}': {pdf.error_message}")

                progress = 30 + int(((idx + 1) / len(pdf_list)) * 25)
                job_manager.update_progress(
                    job_id, 2,
                    f"Ingested & parsed {idx+1}/{len(pdf_list)} documents...",
                    min(progress, 55)
                )
                job_manager.update_pdfs(job_id, pdf_list)
                await asyncio.sleep(0.05)

        job_manager.add_log(job_id, "INFO", f"Phase 2 completed: {len(parsed_documents)} valid documents ready for synthesis.")
        return parsed_documents

document_processor = DocumentProcessor()
