import asyncio
import re
import urllib.parse
from typing import List, Set, Dict, Tuple, Optional
import httpx
from bs4 import BeautifulSoup
from jobs import DiscoveredPDF, job_manager

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
]

COMMON_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/pdf,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
}

PDF_TRIGGER_WORDS = [
    "pdf", "download pdf", "view pdf", "download report", "full report", "whitepaper",
    "download paper", "full text", "factsheet", "brochure", "datasheet", "documentation",
    "annual report", "financial report", "manual"
]

class CrawlerEngine:
    def __init__(self, max_pages_entire_site: int = 25, timeout_seconds: float = 18.0):
        self.max_pages = max_pages_entire_site
        self.timeout = timeout_seconds

    def clean_url(self, raw_url: str) -> str:
        raw_url = raw_url.strip()
        if not raw_url.startswith(("http://", "https://")):
            raw_url = "https://" + raw_url
        return raw_url

    def is_same_domain(self, target_domain: str, candidate_url: str) -> bool:
        try:
            cand_netloc = urllib.parse.urlparse(candidate_url).netloc.lower()
            return cand_netloc == target_domain or cand_netloc.endswith("." + target_domain)
        except Exception:
            return False

    def is_obvious_pdf_url(self, url: str) -> bool:
        url_lower = url.lower()
        path = urllib.parse.urlparse(url_lower).path
        if path.endswith(".pdf"):
            return True
        if ".pdf" in url_lower:
            return True
        # Academic and open access patterns (e.g. arxiv.org/pdf/...)
        if "/pdf/" in path or path.endswith("/pdf"):
            return True
        return False

    def extract_filename_and_title(self, url: str, fallback_title: Optional[str] = None) -> Tuple[str, str]:
        try:
            parsed = urllib.parse.urlparse(url)
            path = parsed.path
            filename = path.split("/")[-1]
            
            # Check queries for filename parameter
            if not filename.lower().endswith(".pdf") or len(filename) <= 4:
                query_dict = urllib.parse.parse_qs(parsed.query)
                for k in ["file", "pdf", "filename", "name", "doc", "id"]:
                    if k in query_dict:
                        val = query_dict[k][0]
                        if val.lower().endswith(".pdf"):
                            filename = val
                            break
                        elif not filename.endswith(".pdf"):
                            filename = f"{val}.pdf"

            if not filename.lower().endswith(".pdf"):
                # Clean up query or path
                clean_seg = re.sub(r"[^a-zA-Z0-9_\-]", "_", path[-30:].strip("/"))
                filename = (clean_seg if clean_seg else "document") + ".pdf"

            filename = urllib.parse.unquote(filename)
            # Remove invalid windows path chars
            filename = re.sub(r'[\\/*?:"<>|]', "", filename)
            if not filename.endswith(".pdf"):
                filename += ".pdf"

            # Derive title
            if fallback_title and len(fallback_title.strip()) > 3:
                title = fallback_title.strip()
            else:
                title = filename.replace(".pdf", "").replace("_", " ").replace("-", " ").title()

            return filename, title
        except Exception:
            return "document.pdf", "Document"

    def parse_js_action(self, script_str: str) -> Optional[str]:
        """Extract URLs from onclick="window.open('...')" or location.href='...'"""
        if not script_str:
            return None
        # Match window.open('...') or window.location='...' or location.href='...'
        m = re.search(r"""(?:window\.open|location\.href|window\.location|downloadFile)\s*\(\s*["']([^"']+)["']""", script_str)
        if m:
            return m.group(1).strip()
        # Direct URL in quotes
        m2 = re.search(r"""["'](https?://[^"']+\.pdf(?:\?[^"']*)?)["']""", script_str, re.IGNORECASE)
        if m2:
            return m2.group(1).strip()
        m3 = re.search(r"""["'](/[^"']+\.pdf(?:\?[^"']*)?)["']""", script_str, re.IGNORECASE)
        if m3:
            return m3.group(1).strip()
        return None

    async def probe_pdf_content_type(self, client: httpx.AsyncClient, candidate_url: str) -> bool:
        """
        For candidate links that do not have .pdf in the URL, verify via HEAD or stream GET
        if the server actually serves application/pdf.
        """
        try:
            headers = dict(COMMON_HEADERS)
            headers["User-Agent"] = USER_AGENTS[0]
            # Try HEAD first
            resp = await client.head(candidate_url, headers=headers, follow_redirects=True, timeout=6.0)
            ct = resp.headers.get("content-type", "").lower()
            cd = resp.headers.get("content-disposition", "").lower()
            if "application/pdf" in ct or ".pdf" in cd:
                return True
            # Some servers reject HEAD with 405 Method Not Allowed; fallback to GET stream
            if resp.status_code in [405, 403, 501]:
                async with client.stream("GET", candidate_url, headers=headers, follow_redirects=True, timeout=6.0) as stream_resp:
                    ct_stream = stream_resp.headers.get("content-type", "").lower()
                    cd_stream = stream_resp.headers.get("content-disposition", "").lower()
                    if "application/pdf" in ct_stream or ".pdf" in cd_stream:
                        return True
            return False
        except Exception:
            return False

    def find_all_pdf_sources_and_internal_links(
        self,
        base_url: str,
        html: str,
        target_domain: str
    ) -> Tuple[Dict[str, str], Set[str], Set[str]]:
        """
        Thoroughly parses the complete webpage across all sources:
        - Anchor tags (href, download, title, text)
        - Buttons & Inputs (onclick, formaction, data-url, text)
        - Viewer embeds (iframe, embed, object, PDF.js, Google Drive)
        - Data attributes on any element (data-href, data-pdf, data-download)
        - Meta and link tags (citation_pdf_url, link rel alternate)
        - Regex sweep across scripts and HTML for hidden PDF links

        Returns:
            discovered_pdfs: Dict[url, title_or_label]
            candidate_links_to_probe: Set of ambiguous URLs (like /download/1234)
            internal_links: Set of page URLs to crawl
        """
        discovered_pdfs: Dict[str, str] = {}
        candidates_to_probe: Set[str] = set()
        internal_links: Set[str] = set()

        try:
            soup = BeautifulSoup(html, "html.parser")

            # -----------------------------------------------------------------
            # 1. ACADEMIC & PUBLISHER METADATA TAGS (<meta>, <link>)
            # -----------------------------------------------------------------
            # citation_pdf_url (used by Google Scholar, ArXiv, ResearchGate, ACM, IEEE)
            for meta in soup.find_all("meta", attrs={"name": re.compile(r"citation_pdf_url", re.I)}):
                if meta.get("content"):
                    full_url = urllib.parse.urljoin(base_url, meta["content"].strip())
                    discovered_pdfs[full_url] = "Academic Research Publication (PDF)"

            for meta in soup.find_all("meta", attrs={"property": re.compile(r"og:file|og:document", re.I)}):
                if meta.get("content"):
                    full_url = urllib.parse.urljoin(base_url, meta["content"].strip())
                    if self.is_obvious_pdf_url(full_url):
                        discovered_pdfs[full_url] = "Document Publication (PDF)"

            for link_tag in soup.find_all("link", attrs={"type": "application/pdf"}):
                if link_tag.get("href"):
                    full_url = urllib.parse.urljoin(base_url, link_tag["href"].strip())
                    discovered_pdfs[full_url] = link_tag.get("title") or "Publication PDF"

            # -----------------------------------------------------------------
            # 2. ANCHOR LINKS (<a> tags)
            # -----------------------------------------------------------------
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                    # Check if javascript has a URL in onclick
                    if a_tag.get("onclick"):
                        js_url = self.parse_js_action(a_tag["onclick"])
                        if js_url:
                            full_js_url = urllib.parse.urljoin(base_url, js_url)
                            if self.is_obvious_pdf_url(full_js_url):
                                text_label = a_tag.get_text(strip=True) or a_tag.get("title") or "Action Link PDF"
                                discovered_pdfs[full_js_url] = text_label
                    continue

                full_url = urllib.parse.urljoin(base_url, href)
                full_url = urllib.parse.urldefrag(full_url)[0]
                text_content = (a_tag.get_text(separator=" ", strip=True) or a_tag.get("title") or a_tag.get("aria-label") or "").strip()
                text_lower = text_content.lower()

                # A. Direct PDF Link
                if self.is_obvious_pdf_url(full_url):
                    discovered_pdfs[full_url] = text_content or self.extract_filename_and_title(full_url)[1]

                # B. Link containing "download" attribute
                elif a_tag.has_attr("download"):
                    download_attr = a_tag.get("download", "")
                    if ".pdf" in download_attr.lower() or "pdf" in text_lower:
                        discovered_pdfs[full_url] = text_content or download_attr or "Downloaded Document"
                    else:
                        candidates_to_probe.add(full_url)

                # C. Anchor with PDF Trigger words in text or class
                elif any(word in text_lower for word in PDF_TRIGGER_WORDS):
                    if not full_url.endswith((".html", ".htm", ".php", ".aspx")):
                        candidates_to_probe.add(full_url)
                    elif "pdf" in full_url.lower():
                        discovered_pdfs[full_url] = text_content

                # D. Internal link for site crawling
                elif self.is_same_domain(target_domain, full_url):
                    # Avoid binary assets in crawling queue
                    if not full_url.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".zip", ".mp4", ".mp3", ".css", ".js")):
                        internal_links.add(full_url)

            # -----------------------------------------------------------------
            # 3. BUTTONS (<button>, <input type="button|submit">, role="button")
            # -----------------------------------------------------------------
            for btn in soup.find_all(["button", "input"]):
                btn_text = (btn.get_text(strip=True) or btn.get("value") or btn.get("title") or btn.get("aria-label") or "").strip()
                btn_text_lower = btn_text.lower()

                # Check onclick
                onclick = btn.get("onclick") or ""
                js_url = self.parse_js_action(onclick)
                if js_url:
                    full_url = urllib.parse.urljoin(base_url, js_url)
                    if self.is_obvious_pdf_url(full_url):
                        discovered_pdfs[full_url] = btn_text or "Button Download PDF"
                    else:
                        candidates_to_probe.add(full_url)

                # Check formaction
                formaction = btn.get("formaction")
                if formaction:
                    full_action = urllib.parse.urljoin(base_url, formaction.strip())
                    if self.is_obvious_pdf_url(full_action) or any(w in btn_text_lower for w in PDF_TRIGGER_WORDS):
                        candidates_to_probe.add(full_action)

                # Check data attributes on button
                for attr_key, attr_val in btn.attrs.items():
                    if isinstance(attr_val, str) and (attr_key.startswith("data-") or attr_key in ["data-url", "data-href", "data-pdf", "data-src", "data-file"]):
                        full_attr_url = urllib.parse.urljoin(base_url, attr_val.strip())
                        if self.is_obvious_pdf_url(full_attr_url):
                            discovered_pdfs[full_attr_url] = btn_text or "Interactive Button PDF"
                        elif any(w in btn_text_lower for w in PDF_TRIGGER_WORDS):
                            candidates_to_probe.add(full_attr_url)

            # -----------------------------------------------------------------
            # 4. EMBEDDED VIEWERS (<iframe>, <embed>, <object>, PDF.js, Google Docs)
            # -----------------------------------------------------------------
            for tag in soup.find_all(["iframe", "embed", "object"]):
                src = tag.get("src") or tag.get("data")
                if src:
                    full_src = urllib.parse.urljoin(base_url, src.strip())
                    
                    # PDF.js Viewer
                    if "viewer.html?file=" in full_src:
                        file_param = full_src.split("viewer.html?file=")[-1]
                        real_pdf = urllib.parse.unquote(file_param.split("&")[0])
                        resolved_url = urllib.parse.urljoin(base_url, real_pdf)
                        discovered_pdfs[resolved_url] = "PDF.js Document Stream"
                    # Google Docs Viewer embed
                    elif "docs.google.com/viewer" in full_src and "url=" in full_src:
                        parsed = urllib.parse.urlparse(full_src)
                        qs = urllib.parse.parse_qs(parsed.query)
                        if "url" in qs:
                            resolved_url = qs["url"][0]
                            discovered_pdfs[resolved_url] = "Google Docs Viewer PDF"
                    elif self.is_obvious_pdf_url(full_src) and not full_src.endswith((".html", ".htm")):
                        discovered_pdfs[full_src] = tag.get("title") or "Embedded PDF Viewer"

            # -----------------------------------------------------------------
            # 5. GENERAL DATA-ATTRIBUTES ON ANY ELEMENT (divs, cards, widgets)
            # -----------------------------------------------------------------
            for el in soup.find_all(attrs={"data-url": True}):
                d_url = urllib.parse.urljoin(base_url, el["data-url"].strip())
                if self.is_obvious_pdf_url(d_url):
                    discovered_pdfs[d_url] = el.get_text(strip=True) or "Data Asset PDF"

            for el in soup.find_all(attrs={"data-pdf": True}):
                d_url = urllib.parse.urljoin(base_url, el["data-pdf"].strip())
                if self.is_obvious_pdf_url(d_url):
                    discovered_pdfs[d_url] = el.get_text(strip=True) or "Data Asset PDF"

            for el in soup.find_all(attrs={"data-download": True}):
                d_url = urllib.parse.urljoin(base_url, el["data-download"].strip())
                if self.is_obvious_pdf_url(d_url):
                    discovered_pdfs[d_url] = el.get_text(strip=True) or "Download Asset PDF"

            # -----------------------------------------------------------------
            # 6. REGEX DEEP SWEEP ON RAW HTML & INLINE JAVASCRIPT
            # -----------------------------------------------------------------
            # Discovers PDFs embedded in JavaScript variables, JSON configs, or REST APIs
            raw_pdf_matches = re.findall(r"""["'](https?://[^"'\s<>]+\.pdf(?:\?[^"'\s<>]*)?)["']""", html, re.IGNORECASE)
            for m_url in raw_pdf_matches:
                clean_m = urllib.parse.urldefrag(m_url)[0]
                if clean_m not in discovered_pdfs:
                    discovered_pdfs[clean_m] = "Embedded Asset (Regex Discovery)"

            relative_pdf_matches = re.findall(r"""["'](/[a-zA-Z0-9_\-\.\/]+\.pdf(?:\?[^"'\s<>]*)?)["']""", html, re.IGNORECASE)
            for rel_m in relative_pdf_matches:
                full_rel = urllib.parse.urljoin(base_url, rel_m)
                if full_rel not in discovered_pdfs:
                    discovered_pdfs[full_rel] = "Relative Link (Regex Discovery)"

        except Exception:
            pass

        return discovered_pdfs, candidates_to_probe, internal_links

    async def fetch_page(self, client: httpx.AsyncClient, url: str) -> Optional[Tuple[str, str]]:
        try:
            headers = dict(COMMON_HEADERS)
            headers["User-Agent"] = USER_AGENTS[0]
            headers["Referer"] = urllib.parse.urljoin(url, "/")
            resp = await client.get(url, headers=headers, follow_redirects=True, timeout=self.timeout)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "").lower()
                if "application/pdf" in content_type:
                    return "pdf", str(resp.url)
                return "html", resp.text
            return None
        except Exception:
            return None

    async def crawl(self, job_id: str, target_url: str, depth_level: str = "single") -> List[DiscoveredPDF]:
        clean_target = self.clean_url(target_url)
        target_domain = urllib.parse.urlparse(clean_target).netloc.lower()

        job_manager.add_log(job_id, "INFO", f"Phase 1: Deep website scan initiated on '{clean_target}' (Mode: {depth_level})...")
        job_manager.update_progress(job_id, 1, f"Scanning {target_domain} for PDF links, buttons & viewer embeds...", 10)

        discovered_pdfs_map: Dict[str, str] = {}  # url -> label/title
        visited_urls: Set[str] = set()
        queue: List[str] = [clean_target]

        limits = 1 if depth_level == "single" else self.max_pages

        async with httpx.AsyncClient(verify=False, follow_redirects=True, timeout=self.timeout) as client:
            pages_crawled = 0
            all_candidates_to_probe: Set[str] = set()

            while queue and pages_crawled < limits:
                current_url = queue.pop(0)
                if current_url in visited_urls:
                    continue
                visited_urls.add(current_url)
                pages_crawled += 1

                job_manager.add_log(job_id, "DEBUG", f"Analyzing webpage ({pages_crawled}/{limits}): {current_url}")
                page_res = await self.fetch_page(client, current_url)

                if not page_res:
                    job_manager.add_log(job_id, "WARNING", f"Could not retrieve webpage or received non-200: {current_url}")
                    continue

                res_type, content = page_res
                if res_type == "pdf":
                    # Direct PDF target provided as main URL
                    discovered_pdfs_map[content] = "Direct Endpoint Document"
                    job_manager.add_log(job_id, "SUCCESS", f"Identified direct hosted PDF endpoint: {content}")
                    break
                else:
                    new_pdfs, new_candidates, new_internals = self.find_all_pdf_sources_and_internal_links(
                        current_url, content, target_domain
                    )

                    for pdf_url, label in new_pdfs.items():
                        if pdf_url not in discovered_pdfs_map:
                            discovered_pdfs_map[pdf_url] = label
                            job_manager.add_log(job_id, "SUCCESS", f"Found PDF source ({label}): {pdf_url}")

                    for cand in new_candidates:
                        if cand not in discovered_pdfs_map:
                            all_candidates_to_probe.add(cand)

                    if depth_level == "entire":
                        for link in new_internals:
                            if link not in visited_urls and link not in queue:
                                queue.append(link)

                progress = 10 + int((pages_crawled / limits) * 15)
                job_manager.update_progress(
                    job_id, 1,
                    f"Scanned {pages_crawled}/{limits} pages. Discovered {len(discovered_pdfs_map)} PDF(s)...",
                    min(progress, 25)
                )
                await asyncio.sleep(0.04)

            # Probe dynamic buttons / links that may serve PDF without .pdf in URL
            if all_candidates_to_probe:
                job_manager.add_log(job_id, "INFO", f"Inspecting {min(len(all_candidates_to_probe), 8)} dynamic button / download endpoints...")
                for cand_url in list(all_candidates_to_probe)[:8]:
                    if cand_url in discovered_pdfs_map:
                        continue
                    is_pdf = await self.probe_pdf_content_type(client, cand_url)
                    if is_pdf:
                        discovered_pdfs_map[cand_url] = "Dynamic Download Endpoint (PDF Verified)"
                        job_manager.add_log(job_id, "SUCCESS", f"Dynamic endpoint verified as PDF: {cand_url}")

        # Build DiscoveredPDF objects
        pdf_models: List[DiscoveredPDF] = []
        for i, (pdf_url, label) in enumerate(discovered_pdfs_map.items()):
            filename, derived_title = self.extract_filename_and_title(pdf_url, fallback_title=label)
            pdf_models.append(DiscoveredPDF(
                id=f"pdf_{i+1}",
                url=pdf_url,
                filename=filename,
                title=derived_title,
                status="discovered",
                selected=True
            ))

        job_manager.update_pdfs(job_id, pdf_models)
        job_manager.add_log(job_id, "INFO", f"Phase 1 scan finished. Total PDF documents identified: {len(pdf_models)}")
        return pdf_models

crawler_engine = CrawlerEngine()
