import os
import json
import shutil
from typing import List, Dict, Any, Optional
import pymupdf  # PyMuPDF
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
from reportlab.pdfgen import canvas
from jobs import DiscoveredPDF, SynthesizedAnalysis, job_manager

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and draw total page count
    and professional running header/footer.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Do not print header on page 1 (cover)
        if self._pageNumber > 1:
            self.drawString(54, 755, "AI PDF Crawler & Synthesizer | Consolidated Master Report")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 748, 558, 748)

        # Running Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_str)
        self.drawString(54, 36, "Confidential & Synthesized | Automated Document Intelligence")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 46, 558, 46)

        self.restoreState()

class MasterPDFMerger:
    def __init__(self):
        pass

    def generate_cover_report_pdf(
        self,
        output_path: str,
        target_url: str,
        analysis: SynthesizedAnalysis,
        selected_pdfs: List[DiscoveredPDF]
    ):
        """
        Creates a beautifully styled cover report containing the executive summary,
        table of contents, redundancies pruned, and document manifest.
        """
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            leftMargin=54,
            rightMargin=54,
            topMargin=54,
            bottomMargin=54
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'MasterTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=26,
            leading=30,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=6
        )

        subtitle_style = ParagraphStyle(
            'MasterSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#15803d"),
            spaceAfter=15
        )

        h1_style = ParagraphStyle(
            'SectionH1',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=19,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=14,
            spaceAfter=8
        )

        h2_style = ParagraphStyle(
            'SectionH2',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=8,
            spaceAfter=4
        )

        body_style = ParagraphStyle(
            'BodyRegular',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#334155"),
            spaceAfter=8
        )

        meta_badge_style = ParagraphStyle(
            'MetaBadge',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#0f172a"),
        )

        bullet_style = ParagraphStyle(
            'BulletStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#475569"),
            leftIndent=14,
            spaceAfter=3
        )

        story = []

        # --- HEADER BRANDING BANNER ---
        banner_data = [[
            Paragraph("<b>AI PDF CRAWLER & SYNTHESIZER</b>", ParagraphStyle('B1', fontName='Helvetica-Bold', fontSize=10, textColor=colors.white)),
            Paragraph("<b>CONSOLIDATED MASTER DOCUMENT</b>", ParagraphStyle('B2', fontName='Helvetica-Bold', fontSize=9, alignment=2, textColor=colors.HexColor("#bbf7d0")))
        ]]
        banner_table = Table(banner_data, colWidths=[280, 224])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#14532d")),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(banner_table)
        story.append(Spacer(1, 18))

        # --- DOCUMENT TITLE & TARGET ---
        story.append(Paragraph("Executive Synthesis & Consolidated Report", title_style))
        story.append(Paragraph(f"Autonomous Multi-Document Intelligence for <u>{target_url}</u>", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#16a34a"), spaceAfter=14))

        # --- METADATA METRICS BOX ---
        total_pages = sum(p.page_count for p in selected_pdfs)
        total_words = sum(p.word_count for p in selected_pdfs)
        meta_data = [
            [
                Paragraph(f"<b>Source Domain:</b><br/>{target_url}", meta_badge_style),
                Paragraph(f"<b>Consolidated Files:</b><br/>{len(selected_pdfs)} PDFs", meta_badge_style),
                Paragraph(f"<b>Total Volume:</b><br/>{total_pages} Pages / {total_words:,} Words", meta_badge_style),
                Paragraph(f"<b>Synthesis Engine:</b><br/>{analysis.model_used}", meta_badge_style)
            ]
        ]
        meta_table = Table(meta_data, colWidths=[160, 110, 120, 114])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('PADDING', (0, 0), (-1, -1), 7),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 16))

        # --- 1. EXECUTIVE SUMMARY ---
        story.append(Paragraph("1. Executive Summary", h1_style))
        for para in analysis.executive_summary.split("\n\n"):
            clean_p = para.strip()
            if clean_p:
                story.append(Paragraph(clean_p, body_style))
        story.append(Spacer(1, 10))

        # --- 2. SEMANTIC DEDUPLICATION AUDIT ---
        if analysis.redundancies_pruned:
            story.append(Paragraph("2. Semantic Redundancy & Boilerplate Elimination", h1_style))
            story.append(Paragraph(
                "The AI synthesizer identified and pruned the following repetitive content to optimize reading clarity:",
                body_style
            ))
            for item in analysis.redundancies_pruned:
                story.append(Paragraph(f"• {item}", bullet_style))
            story.append(Spacer(1, 10))

        # --- 3. STRUCTURED TABLE OF CONTENTS ---
        story.append(PageBreak())
        story.append(Paragraph("3. Consolidated Table of Contents", h1_style))
        story.append(Paragraph(
            "Synthesized thematic chapters mapped to underlying source documents:",
            body_style
        ))
        story.append(Spacer(1, 6))

        for idx, toc in enumerate(analysis.table_of_contents):
            story.append(Paragraph(f"<b>{toc.title}</b>", h2_style))
            story.append(Paragraph(toc.summary, body_style))
            if toc.key_points:
                for kp in toc.key_points:
                    story.append(Paragraph(f"▪ {kp}", bullet_style))
            story.append(Paragraph(
                f"<font color='#15803d'><b>Source Asset:</b></font> {', '.join(toc.source_documents)}",
                bullet_style
            ))
            story.append(Spacer(1, 6))

        # --- 4. DOCUMENT MANIFEST ---
        story.append(Spacer(1, 10))
        story.append(Paragraph("4. Ingested Document Manifest", h1_style))
        manifest_rows = [
            [
                Paragraph("<b>#</b>", meta_badge_style),
                Paragraph("<b>Filename</b>", meta_badge_style),
                Paragraph("<b>Pages</b>", meta_badge_style),
                Paragraph("<b>Words</b>", meta_badge_style),
                Paragraph("<b>Size</b>", meta_badge_style)
            ]
        ]
        for idx, p in enumerate(selected_pdfs):
            size_kb = f"{round(p.file_size_bytes / 1024, 1)} KB" if p.file_size_bytes else "N/A"
            manifest_rows.append([
                Paragraph(str(idx + 1), body_style),
                Paragraph(p.filename, body_style),
                Paragraph(str(p.page_count), body_style),
                Paragraph(f"{p.word_count:,}", body_style),
                Paragraph(size_kb, body_style),
            ])

        manifest_table = Table(manifest_rows, colWidths=[25, 235, 60, 84, 100])
        manifest_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(manifest_table)
        story.append(Spacer(1, 20))
        story.append(Paragraph(
            "<i>Attached below are the complete source PDF files merged sequentially with original layouts preserved.</i>",
            body_style
        ))

        doc.build(story, canvasmaker=NumberedCanvas)

    def merge_master_pdf(
        self,
        job_id: str,
        target_url: str,
        analysis: SynthesizedAnalysis,
        pdf_list: List[DiscoveredPDF],
        include_cover_summary: bool = False
    ) -> Optional[str]:
        """
        Merges all collected PDFs into a single consolidated file consisting of the total PDFs.
        Optionally prepends an AI executive cover report if requested.
        """
        job_manager.update_progress(job_id, 4, "Phase 4: Compiling and merging total discovered PDFs into a single master file...", 80)
        job_manager.add_log(job_id, "INFO", f"Phase 4: Merging total collected PDFs into a unified single file (Cover summary prepended: {include_cover_summary})...")

        selected_pdfs = [p for p in pdf_list if p.selected and p.local_path and os.path.exists(p.local_path)]
        if not selected_pdfs:
            job_manager.fail_job(job_id, "No valid parsed PDFs selected for compilation.")
            return None

        job_dir = os.path.dirname(selected_pdfs[0].local_path)
        cover_pdf_path = os.path.join(job_dir, "Executive_Summary_Report.pdf")
        master_output_path = os.path.join(job_dir, f"Merged_Complete_PDFs_{job_id}.pdf")

        # 1. Generate standalone Executive Summary Report PDF
        try:
            self.generate_cover_report_pdf(cover_pdf_path, target_url, analysis, selected_pdfs)
            job_manager.add_log(job_id, "SUCCESS", "Generated standalone Executive Summary & Table of Contents report.")
        except Exception as e:
            job_manager.add_log(job_id, "WARNING", f"Standalone cover generation note: {str(e)}")
            cover_pdf_path = None

        # 2. Merge with PyMuPDF - stitching all selected PDFs into one master document
        try:
            master_doc = pymupdf.open()

            page_manifest = {}
            current_master_page = 0

            # Prepend cover ONLY if explicitly requested
            if include_cover_summary and cover_pdf_path and os.path.exists(cover_pdf_path):
                cover_doc = pymupdf.open(cover_pdf_path)
                cover_pages = len(cover_doc)
                for cp in range(cover_pages):
                    page_manifest[str(current_master_page)] = {
                        "source_filename": "Executive Summary & Table of Contents",
                        "source_page": cp + 1
                    }
                    current_master_page += 1
                master_doc.insert_pdf(cover_doc)
                cover_doc.close()
                job_manager.add_log(job_id, "INFO", "Prepended executive summary cover.")

            pdf_toc = []
            if include_cover_summary and cover_pdf_path and os.path.exists(cover_pdf_path):
                pdf_toc.append([1, "Executive Summary & Table of Contents", 1])

            # Append each selected document sequentially and record bookmarks
            current_start_page = len(master_doc) + 1 if len(master_doc) > 0 else 1
            total_source_pages = 0

            for idx, p in enumerate(selected_pdfs):
                try:
                    src_doc = pymupdf.open(p.local_path)
                    doc_pages = len(src_doc)

                    # Create top-level bookmark for this document
                    title = p.title or p.filename.replace(".pdf", "").replace("_", " ")
                    pdf_toc.append([1, f"{idx+1}. {title}", current_start_page])

                    # Import any internal bookmarks from source PDF
                    try:
                        src_toc = src_doc.get_toc()
                        for item in src_toc:
                            lvl, t, pno = item
                            if 1 <= pno <= doc_pages:
                                pdf_toc.append([min(lvl + 1, 4), t, current_start_page + pno - 1])
                    except Exception:
                        pass

                    for sp in range(doc_pages):
                        page_manifest[str(current_master_page)] = {
                            "source_filename": p.filename,
                            "source_page": sp + 1
                        }
                        current_master_page += 1

                    total_source_pages += doc_pages
                    master_doc.insert_pdf(src_doc)
                    current_start_page += doc_pages
                    src_doc.close()
                    job_manager.add_log(job_id, "DEBUG", f"Merged [{idx+1}/{len(selected_pdfs)}]: '{p.filename}' ({doc_pages} pages)")
                except Exception as ex:
                    job_manager.add_log(job_id, "WARNING", f"Could not stitch '{p.filename}': {str(ex)}")

            # Inject Clickable Native Bookmarks / Outline into PDF
            try:
                if pdf_toc:
                    master_doc.set_toc(pdf_toc)
                    job_manager.add_log(job_id, "INFO", f"Injected native PDF bookmarks outline ({len(pdf_toc)} navigation points).")
            except Exception as e:
                job_manager.add_log(job_id, "WARNING", f"Bookmark insertion note: {str(e)}")

            # Optimize & compress
            total_pages = len(master_doc)
            master_doc.save(
                master_output_path,
                garbage=4,
                deflate=True,
                clean=True
            )
            master_doc.close()

            # Save page manifest
            manifest_file = os.path.join(job_dir, "page_manifest.json")
            with open(manifest_file, "w") as f:
                json.dump(page_manifest, f, indent=2)

            file_size = os.path.getsize(master_output_path)
            master_filename = f"Merged_Complete_PDFs_{job_id}.pdf"

            job_manager.set_master_pdf(
                job_id=job_id,
                file_path=master_output_path,
                filename=master_filename,
                file_size=file_size,
                page_count=total_pages
            )

            job_manager.add_log(
                job_id, "SUCCESS",
                f"Successfully merged {len(selected_pdfs)} total PDFs into single master file! Total pages: {total_pages}, Size: {round(file_size/1024, 1)} KB"
            )
            return master_output_path

        except Exception as e:
            job_manager.fail_job(job_id, f"Failed to merge total PDFs: {str(e)}")
            return None

    def get_master_pages(self, job_id: str) -> List[Dict[str, Any]]:
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return []

        job_dir = os.path.dirname(job.master_pdf_path)
        manifest_file = os.path.join(job_dir, "page_manifest.json")
        manifest_map = {}
        if os.path.exists(manifest_file):
            try:
                with open(manifest_file, "r") as f:
                    manifest_map = json.load(f)
            except Exception:
                pass

        try:
            doc = pymupdf.open(job.master_pdf_path)
            pages_info = []
            for i in range(len(doc)):
                page = doc[i]
                rect = page.rect
                meta = manifest_map.get(str(i), {})
                text_len = len(page.get_text("text").strip())
                pages_info.append({
                    "page_index": i,
                    "page_number": i + 1,
                    "source_filename": meta.get("source_filename", "Merged Document"),
                    "source_page": meta.get("source_page", i + 1),
                    "width": int(rect.width),
                    "height": int(rect.height),
                    "rotation": page.rotation,
                    "is_blank": text_len == 0,
                    "text_char_count": text_len
                })
            doc.close()
            return pages_info
        except Exception:
            return []

    def render_page_thumbnail(self, job_id: str, page_index: int) -> Optional[bytes]:
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return None

        job_dir = os.path.dirname(job.master_pdf_path)
        thumb_dir = os.path.join(job_dir, "thumbnails")
        os.makedirs(thumb_dir, exist_ok=True)
        thumb_path = os.path.join(thumb_dir, f"thumb_{page_index}.png")

        if os.path.exists(thumb_path):
            with open(thumb_path, "rb") as f:
                return f.read()

        try:
            doc = pymupdf.open(job.master_pdf_path)
            if page_index < 0 or page_index >= len(doc):
                doc.close()
                return None
            page = doc[page_index]
            pix = page.get_pixmap(matrix=pymupdf.Matrix(0.35, 0.35))
            png_bytes = pix.tobytes("png")
            doc.close()

            with open(thumb_path, "wb") as f:
                f.write(png_bytes)
            return png_bytes
        except Exception:
            return None

    def apply_page_edits(self, job_id: str, page_operations: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return None

        job_dir = os.path.dirname(job.master_pdf_path)
        manifest_file = os.path.join(job_dir, "page_manifest.json")
        manifest_map = {}
        if os.path.exists(manifest_file):
            try:
                with open(manifest_file, "r") as f:
                    manifest_map = json.load(f)
            except Exception:
                pass

        try:
            src_doc = pymupdf.open(job.master_pdf_path)
            new_doc = pymupdf.open()
            new_manifest = {}

            for new_idx, op in enumerate(page_operations):
                orig_idx = op.get("original_index")
                rotation = op.get("rotation", 0)

                if orig_idx is not None and 0 <= orig_idx < len(src_doc):
                    new_doc.insert_pdf(src_doc, from_page=orig_idx, to_page=orig_idx)
                    if rotation:
                        new_page = new_doc[new_idx]
                        new_page.set_rotation((new_page.rotation + rotation) % 360)

                    orig_meta = manifest_map.get(str(orig_idx), {})
                    new_manifest[str(new_idx)] = {
                        "source_filename": orig_meta.get("source_filename", "Merged Document"),
                        "source_page": orig_meta.get("source_page", orig_idx + 1)
                    }

            src_doc.close()

            temp_path = os.path.join(job_dir, f"temp_modified_{job_id}.pdf")
            new_doc.save(temp_path, garbage=4, deflate=True, clean=True)
            new_pages_count = len(new_doc)
            new_doc.close()

            if os.path.exists(job.master_pdf_path):
                os.remove(job.master_pdf_path)
            os.rename(temp_path, job.master_pdf_path)

            thumb_dir = os.path.join(job_dir, "thumbnails")
            if os.path.exists(thumb_dir):
                shutil.rmtree(thumb_dir, ignore_errors=True)

            with open(manifest_file, "w") as f:
                json.dump(new_manifest, f, indent=2)

            new_size = os.path.getsize(job.master_pdf_path)
            job.master_page_count = new_pages_count
            job.master_pdf_size = new_size

            job_manager.add_log(
                job_id, "SUCCESS",
                f"Page edits applied successfully! Total pages: {new_pages_count}, Size: {round(new_size/1024, 1)} KB"
            )

            return {
                "status": "success",
                "total_pages": new_pages_count,
                "file_size": new_size
            }
        except Exception as e:
            job_manager.add_log(job_id, "ERROR", f"Failed to apply page edits: {str(e)}")
            return None

    def extract_page_range(self, job_id: str, range_expression: str) -> Optional[str]:
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return None

        pages_to_extract = set()
        parts = range_expression.split(",")
        for part in parts:
            part = part.strip()
            if "-" in part:
                subparts = part.split("-")
                try:
                    start_p = int(subparts[0].strip())
                    end_p = int(subparts[1].strip())
                    for p_num in range(start_p, end_p + 1):
                        pages_to_extract.add(p_num - 1)
                except ValueError:
                    pass
            else:
                try:
                    p_num = int(part)
                    pages_to_extract.add(p_num - 1)
                except ValueError:
                    pass

        if not pages_to_extract:
            return None

        try:
            src_doc = pymupdf.open(job.master_pdf_path)
            valid_pages = sorted([p for p in pages_to_extract if 0 <= p < len(src_doc)])
            if not valid_pages:
                src_doc.close()
                return None

            out_doc = pymupdf.open()
            for p_idx in valid_pages:
                out_doc.insert_pdf(src_doc, from_page=p_idx, to_page=p_idx)
            src_doc.close()

            job_dir = os.path.dirname(job.master_pdf_path)
            extracted_path = os.path.join(job_dir, f"Extracted_Pages_{job_id}.pdf")
            out_doc.save(extracted_path, garbage=4, deflate=True)
            out_doc.close()
            return extracted_path
        except Exception:
            return None

    def render_page_preview(self, job_id: str, page_index: int) -> Optional[bytes]:
        """
        Renders a high-resolution page rendering (1.5x scale) for modal inspection and zooming.
        """
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return None

        job_dir = os.path.dirname(job.master_pdf_path)
        preview_dir = os.path.join(job_dir, "previews")
        os.makedirs(preview_dir, exist_ok=True)
        preview_path = os.path.join(preview_dir, f"preview_{page_index}.png")

        if os.path.exists(preview_path):
            with open(preview_path, "rb") as f:
                return f.read()

        try:
            doc = pymupdf.open(job.master_pdf_path)
            if page_index < 0 or page_index >= len(doc):
                doc.close()
                return None
            page = doc[page_index]
            pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
            png_bytes = pix.tobytes("png")
            doc.close()

            with open(preview_path, "wb") as f:
                f.write(png_bytes)
            return png_bytes
        except Exception:
            return None

    def apply_page_numbering(
        self,
        job_id: str,
        position: str = "bottom-center",
        format_pattern: str = "Page {page} of {total}",
        font_size: float = 9.0,
        color_hex: str = "#64748b",
        skip_first_page: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Stamps running header/footer page numbers across all pages of the master PDF.
        """
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return None

        job_dir = os.path.dirname(job.master_pdf_path)
        temp_path = os.path.join(job_dir, f"temp_numbered_{job_id}.pdf")
        rgb = _hex_to_rgb(color_hex)

        try:
            doc = pymupdf.open(job.master_pdf_path)
            total_pages = len(doc)

            for i in range(total_pages):
                if i == 0 and skip_first_page:
                    continue

                page = doc[i]
                rect = page.rect
                page_str = format_pattern.replace("{page}", str(i + 1)).replace("{total}", str(total_pages))

                if position == "bottom-right":
                    box = pymupdf.Rect(40, rect.height - 35, rect.width - 40, rect.height - 15)
                    align = pymupdf.TEXT_ALIGN_RIGHT
                elif position == "bottom-left":
                    box = pymupdf.Rect(40, rect.height - 35, rect.width - 40, rect.height - 15)
                    align = pymupdf.TEXT_ALIGN_LEFT
                elif position == "top-center":
                    box = pymupdf.Rect(40, 15, rect.width - 40, 35)
                    align = pymupdf.TEXT_ALIGN_CENTER
                elif position == "top-right":
                    box = pymupdf.Rect(40, 15, rect.width - 40, 35)
                    align = pymupdf.TEXT_ALIGN_RIGHT
                else:  # bottom-center
                    box = pymupdf.Rect(40, rect.height - 35, rect.width - 40, rect.height - 15)
                    align = pymupdf.TEXT_ALIGN_CENTER

                page.insert_textbox(box, page_str, fontsize=font_size, color=rgb, align=align)

            doc.save(temp_path, garbage=4, deflate=True)
            doc.close()

            if os.path.exists(job.master_pdf_path):
                os.remove(job.master_pdf_path)
            os.rename(temp_path, job.master_pdf_path)

            # Invalidate cached previews/thumbnails
            for d in ["thumbnails", "previews"]:
                td = os.path.join(job_dir, d)
                if os.path.exists(td):
                    shutil.rmtree(td, ignore_errors=True)

            new_size = os.path.getsize(job.master_pdf_path)
            job.master_pdf_size = new_size
            job_manager.add_log(job_id, "SUCCESS", f"Stamped page numbers ({position}) across {total_pages} pages.")

            return {
                "status": "success",
                "message": f"Page numbering applied across {total_pages} pages",
                "file_size": new_size,
                "total_pages": total_pages
            }
        except Exception as e:
            job_manager.add_log(job_id, "ERROR", f"Failed to apply page numbering: {str(e)}")
            return None

    def apply_watermark(
        self,
        job_id: str,
        text: str,
        opacity: float = 0.2,
        angle: int = 45,
        font_size: float = 46.0,
        color_hex: str = "#94a3b8"
    ) -> Optional[Dict[str, Any]]:
        """
        Applies watermark text diagonally or horizontally across all pages.
        """
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return None

        job_dir = os.path.dirname(job.master_pdf_path)
        temp_path = os.path.join(job_dir, f"temp_watermark_{job_id}.pdf")
        rgb = _hex_to_rgb(color_hex)
        safe_opacity = max(0.05, min(0.9, opacity))

        try:
            doc = pymupdf.open(job.master_pdf_path)
            total_pages = len(doc)

            for i in range(total_pages):
                page = doc[i]
                rect = page.rect
                center_x = rect.width / 2.0
                center_y = rect.height / 2.0

                offset_x = (len(text) * font_size * 0.25)
                pt = pymupdf.Point(max(20.0, center_x - offset_x), center_y)

                if angle != 0:
                    page.insert_text(
                        pt,
                        text,
                        fontsize=font_size,
                        morph=(pt, pymupdf.Matrix(angle)),
                        color=rgb,
                        fill_opacity=safe_opacity
                    )
                else:
                    page.insert_text(
                        pt,
                        text,
                        fontsize=font_size,
                        color=rgb,
                        fill_opacity=safe_opacity
                    )

            doc.save(temp_path, garbage=4, deflate=True)
            doc.close()

            if os.path.exists(job.master_pdf_path):
                os.remove(job.master_pdf_path)
            os.rename(temp_path, job.master_pdf_path)

            for d in ["thumbnails", "previews"]:
                td = os.path.join(job_dir, d)
                if os.path.exists(td):
                    shutil.rmtree(td, ignore_errors=True)

            new_size = os.path.getsize(job.master_pdf_path)
            job.master_pdf_size = new_size
            job_manager.add_log(job_id, "SUCCESS", f"Stamped watermark '{text}' across {total_pages} pages.")

            return {
                "status": "success",
                "message": f"Watermark '{text}' applied to {total_pages} pages",
                "file_size": new_size
            }
        except Exception as e:
            job_manager.add_log(job_id, "ERROR", f"Failed to apply watermark: {str(e)}")
            return None

    def optimize_master_pdf(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Compresses and optimizes master PDF using garbage collection, stream deflating, and cleaning.
        """
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return None

        job_dir = os.path.dirname(job.master_pdf_path)
        temp_path = os.path.join(job_dir, f"temp_opt_{job_id}.pdf")
        orig_size = os.path.getsize(job.master_pdf_path)

        try:
            doc = pymupdf.open(job.master_pdf_path)
            doc.save(
                temp_path,
                garbage=4,
                deflate=True,
                clean=True,
                deflate_images=True,
                deflate_fonts=True
            )
            doc.close()

            new_size = os.path.getsize(temp_path)
            if new_size < orig_size:
                if os.path.exists(job.master_pdf_path):
                    os.remove(job.master_pdf_path)
                os.rename(temp_path, job.master_pdf_path)
                final_size = new_size
            else:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                final_size = orig_size

            job.master_pdf_size = final_size
            saved_bytes = max(0, orig_size - final_size)
            saved_pct = round((saved_bytes / orig_size) * 100, 1) if orig_size > 0 else 0.0

            job_manager.add_log(job_id, "SUCCESS", f"Optimized master PDF. Size: {round(final_size/1024, 1)} KB (Saved {saved_pct}%).")

            return {
                "status": "success",
                "original_size": orig_size,
                "optimized_size": final_size,
                "saved_bytes": saved_bytes,
                "saved_percentage": saved_pct
            }
        except Exception as e:
            job_manager.add_log(job_id, "ERROR", f"Optimization failed: {str(e)}")
            return None

    def update_pdf_metadata(
        self,
        job_id: str,
        title: Optional[str] = None,
        author: Optional[str] = None,
        subject: Optional[str] = None,
        keywords: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Updates document metadata inside the master PDF.
        """
        job = job_manager.get_job(job_id)
        if not job or not job.master_pdf_path or not os.path.exists(job.master_pdf_path):
            return None

        job_dir = os.path.dirname(job.master_pdf_path)
        temp_path = os.path.join(job_dir, f"temp_meta_{job_id}.pdf")

        try:
            doc = pymupdf.open(job.master_pdf_path)
            meta = doc.metadata or {}
            if title:
                meta["title"] = title
            if author:
                meta["author"] = author
            if subject:
                meta["subject"] = subject
            if keywords:
                meta["keywords"] = keywords

            doc.set_metadata(meta)
            doc.save(temp_path, garbage=4, deflate=True)
            doc.close()

            if os.path.exists(job.master_pdf_path):
                os.remove(job.master_pdf_path)
            os.rename(temp_path, job.master_pdf_path)

            new_size = os.path.getsize(job.master_pdf_path)
            job.master_pdf_size = new_size
            job_manager.add_log(job_id, "SUCCESS", f"Updated PDF metadata: {title or 'Preserved'}")

            return {
                "status": "success",
                "metadata": meta,
                "file_size": new_size
            }
        except Exception as e:
            job_manager.add_log(job_id, "ERROR", f"Metadata update failed: {str(e)}")
            return None

def _hex_to_rgb(hex_str: str) -> tuple:
    try:
        h = hex_str.lstrip("#")
        if len(h) == 3:
            h = "".join([c*2 for c in h])
        return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    except Exception:
        return (0.4, 0.4, 0.4)

master_merger = MasterPDFMerger()

