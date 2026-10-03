import asyncio
import os
import re
import json
import urllib.parse
from typing import List, Set, Dict, Tuple, Optional, Any
import httpx
from bs4 import BeautifulSoup
from jobs import DiscoveredPDF, job_manager

try:
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

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

async def launch_browser_instance(p):
    """
    Launches headless Chromium using installed system Google Chrome or Microsoft Edge,
    falling back to Playwright's bundled browser if available.
    """
    channels = ["chrome", "msedge", None]
    for ch in channels:
        try:
            if ch:
                return await p.chromium.launch(channel=ch, headless=True)
            else:
                return await p.chromium.launch(headless=True)
        except Exception:
            continue
    return None

class CrawlerEngine:
    def __init__(self, max_pages_entire_site: int = 25, timeout_seconds: float = 20.0):
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
        # Academic & biomedical patterns (arxiv.org/pdf/..., S3/document stores)
        if "/pdf/" in path or path.endswith("/pdf") or "downloadreport" in path or "documents" in path:
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
                for k in ["file", "pdf", "filename", "name", "doc", "id", "report", "testName"]:
                    if k in query_dict:
                        val = query_dict[k][0]
                        if val.lower().endswith(".pdf"):
                            filename = val
                            break
                        elif not filename.endswith(".pdf"):
                            filename = f"{val}.pdf"

            if not filename.lower().endswith(".pdf"):
                clean_seg = re.sub(r"[^a-zA-Z0-9_\-]", "_", path[-30:].strip("/"))
                filename = (clean_seg if clean_seg else "document") + ".pdf"

            filename = urllib.parse.unquote(filename)
            filename = re.sub(r'[\\/*?:"<>|]', "", filename)
            if not filename.endswith(".pdf"):
                filename += ".pdf"

            if fallback_title and len(fallback_title.strip()) > 3:
                title = fallback_title.strip()
            else:
                title = filename.replace(".pdf", "").replace("_", " ").replace("-", " ").title()

            return filename, title
        except Exception:
            return "document.pdf", "Document"

    def parse_js_action(self, script_str: str) -> Optional[str]:
        """Extract URLs from onclick='window.open(...)' or location.href='...'"""
        if not script_str:
            return None
        m = re.search(r"""(?:window\.open|location\.href|window\.location|downloadFile)\s*\(\s*["']([^"']+)["']""", script_str)
        if m:
            return m.group(1).strip()
        m2 = re.search(r"""["'](https?://[^"']+\.pdf(?:\?[^"']*)?)["']""", script_str, re.IGNORECASE)
        if m2:
            return m2.group(1).strip()
        m3 = re.search(r"""["'](/[^"']+\.pdf(?:\?[^"']*)?)["']""", script_str, re.IGNORECASE)
        if m3:
            return m3.group(1).strip()
        return None

    def is_spa_candidate(self, url: str, html_preview: Optional[str] = None) -> bool:
        """Detects if a target URL or HTML shell indicates a Single Page Application (Angular, React, Vue)."""
        if "#" in url:
            return True
        lowered = url.lower()
        if any(marker in lowered for marker in [
            "/portal", "/app/", "/main/", "spa", "portalapi", "reportsportal",
            "dashboard", "visitgriddetails", "visitgrid", "pdfviewer"
        ]):
            return True
        if html_preview:
            hp_low = html_preview.lower()
            if any(marker in hp_low for marker in [
                "<app-root", "<div id=\"root\"", "<div id=\"app\"", "<div id=\"__next\"",
                "ng-version", "react-root", "_app_pdfviewer", "webpackchunk", "ag-grid-angular"
            ]):
                return True
        return False

    async def probe_pdf_content_type(self, client: httpx.AsyncClient, candidate_url: str) -> bool:
        """Verifies candidate dynamic endpoints to check if they serve application/pdf."""
        try:
            headers = dict(COMMON_HEADERS)
            headers["User-Agent"] = USER_AGENTS[0]
            resp = await client.head(candidate_url, headers=headers, follow_redirects=True, timeout=6.0)
            ct = resp.headers.get("content-type", "").lower()
            cd = resp.headers.get("content-disposition", "").lower()
            if "application/pdf" in ct or ".pdf" in cd:
                return True
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
        """Parses complete webpage across anchors, buttons, embedded viewers, data attributes, and regex sweeps."""
        discovered_pdfs: Dict[str, str] = {}
        candidates_to_probe: Set[str] = set()
        internal_links: Set[str] = set()

        try:
            soup = BeautifulSoup(html, "html.parser")

            # 1. ACADEMIC & METADATA TAGS
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

            # 2. ANCHOR LINKS (<a> tags)
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
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

                if self.is_obvious_pdf_url(full_url):
                    discovered_pdfs[full_url] = text_content or self.extract_filename_and_title(full_url)[1]
                elif a_tag.has_attr("download"):
                    download_attr = a_tag.get("download", "")
                    if ".pdf" in download_attr.lower() or "pdf" in text_lower:
                        discovered_pdfs[full_url] = text_content or download_attr or "Downloaded Document"
                    else:
                        candidates_to_probe.add(full_url)
                elif any(word in text_lower for word in PDF_TRIGGER_WORDS):
                    if not full_url.endswith((".html", ".htm", ".php", ".aspx")):
                        candidates_to_probe.add(full_url)
                    elif "pdf" in full_url.lower():
                        discovered_pdfs[full_url] = text_content
                elif self.is_same_domain(target_domain, full_url):
                    if not full_url.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".zip", ".mp4", ".mp3", ".css", ".js")):
                        internal_links.add(full_url)

            # 3. BUTTONS (<button>, <input>, role="button")
            for btn in soup.find_all(["button", "input"]):
                btn_text = (btn.get_text(strip=True) or btn.get("value") or btn.get("title") or btn.get("aria-label") or "").strip()
                btn_text_lower = btn_text.lower()

                onclick = btn.get("onclick") or ""
                js_url = self.parse_js_action(onclick)
                if js_url:
                    full_url = urllib.parse.urljoin(base_url, js_url)
                    if self.is_obvious_pdf_url(full_url):
                        discovered_pdfs[full_url] = btn_text or "Button Download PDF"
                    else:
                        candidates_to_probe.add(full_url)

                formaction = btn.get("formaction")
                if formaction:
                    full_action = urllib.parse.urljoin(base_url, formaction.strip())
                    if self.is_obvious_pdf_url(full_action) or any(w in btn_text_lower for w in PDF_TRIGGER_WORDS):
                        candidates_to_probe.add(full_action)

                for attr_key, attr_val in btn.attrs.items():
                    if isinstance(attr_val, str) and (attr_key.startswith("data-") or attr_key in ["data-url", "data-href", "data-pdf", "data-src", "data-file"]):
                        full_attr_url = urllib.parse.urljoin(base_url, attr_val.strip())
                        if self.is_obvious_pdf_url(full_attr_url):
                            discovered_pdfs[full_attr_url] = btn_text or "Interactive Button PDF"
                        elif any(w in btn_text_lower for w in PDF_TRIGGER_WORDS):
                            candidates_to_probe.add(full_attr_url)

            # 4. EMBEDDED VIEWERS (<iframe>, <embed>, <object>, ng2-pdfjs-viewer, PDF.js, Google Docs)
            for tag in soup.find_all(["iframe", "embed", "object", "ng2-pdfjs-viewer"]):
                src = tag.get("src") or tag.get("data") or tag.get("pdfsrc")
                if src:
                    full_src = urllib.parse.urljoin(base_url, src.strip())
                    if "viewer.html?file=" in full_src:
                        file_param = full_src.split("viewer.html?file=")[-1]
                        real_pdf = urllib.parse.unquote(file_param.split("&")[0])
                        resolved_url = urllib.parse.urljoin(base_url, real_pdf)
                        discovered_pdfs[resolved_url] = "PDF.js Document Stream"
                    elif "docs.google.com/viewer" in full_src and "url=" in full_src:
                        parsed = urllib.parse.urlparse(full_src)
                        qs = urllib.parse.parse_qs(parsed.query)
                        if "url" in qs:
                            resolved_url = qs["url"][0]
                            discovered_pdfs[resolved_url] = "Google Docs Viewer PDF"
                    elif self.is_obvious_pdf_url(full_src) and not full_src.endswith((".html", ".htm")):
                        discovered_pdfs[full_src] = tag.get("title") or "Embedded PDF Viewer"

            # 5. GENERAL DATA-ATTRIBUTES ON ANY ELEMENT
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

            # 6. REGEX DEEP SWEEP ON RAW HTML & INLINE JAVASCRIPT
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

    async def crawl_dynamic_spa(
        self,
        job_id: str,
        target_url: str,
        depth_level: str = "single",
        auth_cookies: Optional[str] = None,
        auth_headers: Optional[Dict[str, str]] = None,
        session_storage: Optional[Dict[str, str]] = None,
        wait_selector: Optional[str] = None,
        wait_seconds: Optional[float] = None
    ) -> List[DiscoveredPDF]:
        """
        Headless Browser Crawler Engine for Single Page Applications (Angular, React, Vue, Next.js).
        Executes JavaScript, respects hash routing (#/path), sniffs network responses for PDFs,
        triggers dynamic report buttons, and extracts client-rendered DOM.
        """
        if not PLAYWRIGHT_AVAILABLE:
            job_manager.add_log(job_id, "WARNING", "Playwright is not available. Falling back to HTTP static crawler.")
            return await self.crawl_static(job_id, target_url, depth_level)

        clean_target = self.clean_url(target_url)
        target_domain = urllib.parse.urlparse(clean_target).netloc.lower()

        job_manager.add_log(job_id, "INFO", f"Phase 1: Dynamic SPA Browser Engine launched for '{clean_target}'...")
        job_manager.update_progress(job_id, 1, f"Launching Headless Browser to render SPA ({target_domain})...", 12)

        discovered_pdfs_map: Dict[str, str] = {}  # url -> label/title
        downloaded_files_map: Dict[str, str] = {}  # url -> local_path

        from processor import document_processor
        job_dir = document_processor.get_job_dir(job_id)

        try:
            async with async_playwright() as p:
                browser = await launch_browser_instance(p)
                if not browser:
                    job_manager.add_log(job_id, "WARNING", "Could not initialize system browser. Falling back to static crawler.")
                    return await self.crawl_static(job_id, target_url, depth_level)

                context = await browser.new_context(
                    user_agent=USER_AGENTS[0],
                    viewport={"width": 1280, "height": 900},
                    accept_downloads=True,
                    ignore_https_errors=True
                )

                # Set custom headers if provided
                if auth_headers:
                    await context.set_extra_http_headers(auth_headers)

                # Inject cookies if provided
                if auth_cookies:
                    try:
                        cookies_list = []
                        if isinstance(auth_cookies, str):
                            for cookie_item in auth_cookies.split(";"):
                                if "=" in cookie_item:
                                    k, v = cookie_item.strip().split("=", 1)
                                    cookies_list.append({
                                        "name": k.strip(),
                                        "value": v.strip(),
                                        "domain": target_domain,
                                        "path": "/"
                                    })
                        elif isinstance(auth_cookies, list):
                            cookies_list = auth_cookies
                        if cookies_list:
                            await context.add_cookies(cookies_list)
                            job_manager.add_log(job_id, "INFO", f"Injected {len(cookies_list)} session cookie(s) into browser context.")
                    except Exception as ce:
                        job_manager.add_log(job_id, "DEBUG", f"Cookie parse error: {ce}")

                page = await context.new_page()

                # 1. Listen for background network PDF responses (binary streams / S3 / API downloads)
                async def handle_response(response):
                    try:
                        ct = response.headers.get("content-type", "").lower()
                        cd = response.headers.get("content-disposition", "").lower()
                        r_url = response.url

                        if ("application/pdf" in ct or ".pdf" in cd or r_url.lower().endswith(".pdf") or "downloadreport" in r_url.lower()):
                            if response.status == 200:
                                body = await response.body()
                                if len(body) > 500:
                                    fn = "Report_" + str(len(downloaded_files_map) + 1) + ".pdf"
                                    if "filename=" in cd:
                                        m = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';]+)["\']?', cd, re.I)
                                        if m:
                                            fn = re.sub(r'[\\/*?:"<>|]', "", urllib.parse.unquote(m.group(1).strip()))
                                    elif r_url.lower().endswith(".pdf"):
                                        fn = r_url.split("/")[-1].split("?")[0]

                                    save_path = os.path.join(job_dir, fn)
                                    with open(save_path, "wb") as bf:
                                        bf.write(body)

                                    discovered_pdfs_map[r_url] = fn.replace(".pdf", "").replace("_", " ").title()
                                    downloaded_files_map[r_url] = save_path
                                    job_manager.add_log(job_id, "SUCCESS", f"Intercepted and captured PDF network stream: {fn} ({len(body):,} bytes)")
                    except Exception:
                        pass

                page.on("response", handle_response)

                # 2. Listen for direct browser file downloads
                async def handle_download(download):
                    try:
                        fn = download.suggested_filename or f"Document_{len(downloaded_files_map)+1}.pdf"
                        save_path = os.path.join(job_dir, fn)
                        await download.save_as(save_path)
                        d_url = download.url or f"download://{fn}"
                        discovered_pdfs_map[d_url] = fn.replace(".pdf", "").replace("_", " ").title()
                        downloaded_files_map[d_url] = save_path
                        job_manager.add_log(job_id, "SUCCESS", f"Browser download captured: {fn}")
                    except Exception:
                        pass

                page.on("download", handle_download)

                # 3. Navigate to target URL
                job_manager.add_log(job_id, "INFO", f"Navigating to SPA route: {clean_target}")
                try:
                    await page.goto(clean_target, wait_until="domcontentloaded", timeout=35000)
                    try:
                        await page.wait_for_load_state("networkidle", timeout=12000)
                    except Exception:
                        pass
                except Exception as ne:
                    job_manager.add_log(job_id, "WARNING", f"Navigation timeout or partial load: {ne}")

                # 4. Inject sessionStorage / localStorage if provided
                if session_storage and isinstance(session_storage, dict):
                    try:
                        await page.evaluate("""(data) => {
                            for (const [k, v] of Object.entries(data)) {
                                const val = typeof v === 'string' ? v : JSON.stringify(v);
                                sessionStorage.setItem(k, val);
                                localStorage.setItem(k, val);
                            }
                        }""", session_storage)
                        job_manager.add_log(job_id, "INFO", f"Injected session storage tokens ({len(session_storage)} keys).")
                        # Re-navigate to trigger Angular / React router with new auth state
                        await page.goto(clean_target, wait_until="domcontentloaded", timeout=20000)
                    except Exception:
                        pass

                # 5. Optional wait selector or custom delay for dynamic hydration
                if wait_selector:
                    try:
                        job_manager.add_log(job_id, "DEBUG", f"Waiting for selector: {wait_selector}")
                        await page.wait_for_selector(wait_selector, timeout=12000)
                    except Exception:
                        pass
                elif wait_seconds:
                    await asyncio.sleep(wait_seconds)
                else:
                    # Give Angular/React components 2-3 seconds to hydrate dynamic tables & grid cells
                    await asyncio.sleep(2.5)

                # 6. Check for Authentication Guard / Redirect (e.g. redirected to /login?type=patient)
                current_url = page.url
                page_title = await page.title()
                if "/login" in current_url.lower() or "login" in page_title.lower():
                    job_manager.add_log(
                        job_id,
                        "WARNING",
                        f"Target portal redirected to Login ('{current_url}'). "
                        "Protected commercial portals (like Aarthi Scans USHA PUROHIT timeline) require active authentication. "
                        "Use the 1-Click 'Active Browser Session Harvester' or provide session credentials in SPA settings."
                    )

                # 7. Check sessionStorage for active report URLs (used by Aarthi Scans and healthcare portals)
                try:
                    active_session_pdf = await page.evaluate("() => sessionStorage.getItem('pdfURL') || sessionStorage.getItem('pdfSrc')")
                    if active_session_pdf and len(active_session_pdf) > 5:
                        discovered_pdfs_map[active_session_pdf] = "Session Storage Active PDF Report"
                        job_manager.add_log(job_id, "SUCCESS", f"Identified report from browser session storage: {active_session_pdf}")
                except Exception:
                    pass

                # 8. Parse rendered HTML DOM
                rendered_html = await page.content()
                dom_pdfs, dom_candidates, _ = self.find_all_pdf_sources_and_internal_links(clean_target, rendered_html, target_domain)

                for u, title in dom_pdfs.items():
                    if u not in discovered_pdfs_map:
                        discovered_pdfs_map[u] = title
                        job_manager.add_log(job_id, "SUCCESS", f"Discovered PDF element in hydrated DOM ({title}): {u}")

                # 9. Scan for interactive report / download buttons in AG Grid, Angular, and React tables
                try:
                    # Specific targeting for medical / commercial portals (like Aarthi Scans desktopreportstable)
                    report_elements = await page.query_selector_all(
                        "#desktopreportstable i.fa-download, #desktopreportstable i.fa-eye, "
                        "button, [role='button'], a[download], i.fa-download, i.fa-file-pdf, mat-icon, "
                        "[title*='Download' i], [title*='Report' i], [title*='PDF' i], [aria-label*='report' i], "
                        ".ag-row button, .ag-cell i"
                    )
                    if report_elements and len(report_elements) > 0:
                        job_manager.add_log(job_id, "INFO", f"Inspecting {min(len(report_elements), 15)} interactive report trigger(s)...")
                        for i, btn in enumerate(report_elements[:15]):
                            try:
                                is_visible = await btn.is_visible()
                                if is_visible:
                                    await btn.click(timeout=1500)
                                    await asyncio.sleep(0.8)

                                    # Check if click updated sessionStorage pdfURL (Aarthi Scans pattern)
                                    dyn_pdf = await page.evaluate("() => sessionStorage.getItem('pdfURL')")
                                    if dyn_pdf and dyn_pdf.startswith("http") and dyn_pdf not in discovered_pdfs_map:
                                        t_name = await page.evaluate("() => sessionStorage.getItem('TestName')") or f"Diagnostic_Report_{len(discovered_pdfs_map)+1}"
                                        discovered_pdfs_map[dyn_pdf] = t_name
                                        job_manager.add_log(job_id, "SUCCESS", f"Triggered and captured report endpoint: {t_name} ({dyn_pdf})")
                            except Exception:
                                continue
                except Exception:
                    pass

                # Close browser session
                await browser.close()

        except Exception as e:
            job_manager.add_log(job_id, "WARNING", f"Playwright browser execution encountered an issue: {str(e)}")

        # Build DiscoveredPDF objects
        pdf_models: List[DiscoveredPDF] = []
        for i, (pdf_url, label) in enumerate(discovered_pdfs_map.items()):
            filename, derived_title = self.extract_filename_and_title(pdf_url, fallback_title=label)
            local_file = downloaded_files_map.get(pdf_url)
            file_size = os.path.getsize(local_file) if local_file and os.path.exists(local_file) else 0

            pdf_models.append(DiscoveredPDF(
                id=f"pdf_{i+1}",
                url=pdf_url,
                filename=filename,
                title=derived_title,
                local_path=local_file,
                file_size_bytes=file_size,
                status="discovered",
                selected=True
            ))

        job_manager.update_pdfs(job_id, pdf_models)
        job_manager.add_log(job_id, "INFO", f"Phase 1 scan finished. Total PDF documents identified: {len(pdf_models)}")
        return pdf_models

    async def crawl_static(self, job_id: str, target_url: str, depth_level: str = "single") -> List[DiscoveredPDF]:
        """Fast HTTP Static Crawler (for standard static HTML websites)."""
        clean_target = self.clean_url(target_url)
        target_domain = urllib.parse.urlparse(clean_target).netloc.lower()

        job_manager.add_log(job_id, "INFO", f"Phase 1: Deep website scan initiated on '{clean_target}' (Mode: {depth_level})...")
        job_manager.update_progress(job_id, 1, f"Scanning {target_domain} for PDF links, buttons & viewer embeds...", 10)

        discovered_pdfs_map: Dict[str, str] = {}
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

    async def crawl(
        self,
        job_id: str,
        target_url: str,
        depth_level: str = "single",
        crawler_mode: str = "auto",
        auth_cookies: Optional[str] = None,
        auth_headers: Optional[Dict[str, str]] = None,
        session_storage: Optional[Dict[str, str]] = None,
        wait_selector: Optional[str] = None,
        wait_seconds: Optional[float] = None
    ) -> List[DiscoveredPDF]:
        """
        Unified Entry Point: Automatically routes between Dynamic Playwright Engine and Fast Static Crawler.
        """
        clean_target = self.clean_url(target_url)

        # 1. Force Browser mode or detected SPA route
        if crawler_mode == "browser" or (crawler_mode == "auto" and self.is_spa_candidate(clean_target)):
            job_manager.add_log(job_id, "INFO", f"Single Page Application / dynamic web structure detected for '{clean_target}'. Engaging Browser Engine.")
            browser_results = await self.crawl_dynamic_spa(
                job_id=job_id,
                target_url=clean_target,
                depth_level=depth_level,
                auth_cookies=auth_cookies,
                auth_headers=auth_headers,
                session_storage=session_storage,
                wait_selector=wait_selector,
                wait_seconds=wait_seconds
            )
            if browser_results or "#" in clean_target:
                return browser_results

        # 2. Static Crawl
        static_results = await self.crawl_static(job_id, clean_target, depth_level)
        if static_results:
            return static_results

        # 3. If static crawler found 0 PDFs and target looks like SPA, escalate to browser crawl
        if crawler_mode == "auto" and not static_results:
            job_manager.add_log(job_id, "INFO", "Static scan found 0 direct files. Auto-escalating to Dynamic Headless Browser Engine...")
            return await self.crawl_dynamic_spa(
                job_id=job_id,
                target_url=clean_target,
                depth_level=depth_level,
                auth_cookies=auth_cookies,
                auth_headers=auth_headers,
                session_storage=session_storage,
                wait_selector=wait_selector,
                wait_seconds=wait_seconds
            )

        return static_results

crawler_engine = CrawlerEngine()
