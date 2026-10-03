import React, { useState } from 'react';
import { X, Sparkles, Copy, Check, ExternalLink, ShieldCheck, Globe, Activity, FileText, Bookmark } from 'lucide-react';

export default function CommercialHarvesterModal({ isOpen, onClose }) {
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!isOpen) return null;

  const bookmarkletCode = `javascript:(async function(){
  const API="http://127.0.0.1:8000";
  const UI="http://localhost:5173";
  const toast=document.createElement("div");
  toast.id="ai-harvester-toast";
  toast.style.cssText="position:fixed;bottom:24px;right:24px;z-index:9999999;background:#0f172a;color:#f8fafc;padding:16px 20px;border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,0.4);font-family:system-ui,-apple-system,sans-serif;font-size:13px;max-width:380px;border:1px solid #16a34a;line-height:1.4;";
  toast.innerHTML="<div style='display:flex;align-items:center;gap:8px;font-weight:700;color:#22c55e;margin-bottom:6px;'><span>⚡ AI Document Harvester</span></div><div id='ai-harvester-msg'>Scanning active session for reports...</div>";
  document.body.appendChild(toast);
  const setMsg=(t)=>{const el=document.getElementById("ai-harvester-msg");if(el)el.innerHTML=t;};

  try{
    const title=document.title||"Commercial Portal";
    const files=[];
    setMsg("Inspecting active patient session & documents...");

    // 1. Check sessionStorage for active report
    const sPdf=sessionStorage.getItem("pdfURL")||sessionStorage.getItem("pdfSrc");
    if(sPdf && sPdf.length>5){
      try{
        setMsg("Fetching active report from session storage...");
        const r=await fetch(sPdf);
        const b=await r.blob();
        const tName=(sessionStorage.getItem("TestName")||"Active_Report").replace(/[^a-zA-Z0-9_\\-]/g,"_");
        files.push(new File([b], tName+".pdf", {type:"application/pdf"}));
      }catch(e){}
    }

    // 2. Scan all anchor links for PDFs or report downloads
    const links=Array.from(document.querySelectorAll("a[href]"));
    for(const a of links){
      const h=a.href;
      if(h.toLowerCase().includes(".pdf")||h.toLowerCase().includes("downloadreport")||a.hasAttribute("download")){
        try{
          setMsg("Capturing report link: "+(a.innerText.trim()||"Document"));
          const r=await fetch(h,{credentials:"include"});
          if(r.ok){
            const b=await r.blob();
            if(b.size>500){
              const fn=(a.innerText.trim()||a.getAttribute("download")||"Report_"+(files.length+1)).replace(/[^a-zA-Z0-9_\\-]/g,"_")+".pdf";
              if(!files.some(f=>f.name===fn)) files.push(new File([b],fn,{type:"application/pdf"}));
            }
          }
        }catch(e){}
      }
    }

    // 3. Scan for embedded viewers (ng2-pdfjs-viewer, iframe, embed)
    const embeds=Array.from(document.querySelectorAll("iframe, embed, object, ng2-pdfjs-viewer"));
    for(const em of embeds){
      const s=em.src||em.data||em.getAttribute("pdfsrc");
      if(s && (s.includes(".pdf")||s.includes("blob:")||s.includes("viewer"))){
        try{
          const r=await fetch(s,{credentials:"include"});
          if(r.ok){
            const b=await r.blob();
            const fn="Embedded_Report_"+(files.length+1)+".pdf";
            if(!files.some(f=>f.name===fn)) files.push(new File([b],fn,{type:"application/pdf"}));
          }
        }catch(e){}
      }
    }

    // 4. Specifically target the Reports section download and view icons (ignoring Films)
    const downloadIcons = Array.from(document.querySelectorAll("i.fa-download, i[title='Download'], [title*='Download' i]"));
    const eyeIcons = Array.from(document.querySelectorAll("i.fa-eye, i[title='view' i], i[title='View' i]"));

    // In Aarthi Scans visit table: 1st icon set = Films, 2nd icon set = Reports (the PDF)
    const targetReportDownload = downloadIcons.length >= 2 ? downloadIcons[downloadIcons.length - 1] : downloadIcons[0];
    const targetReportView = eyeIcons.length >= 2 ? eyeIcons[eyeIcons.length - 1] : eyeIcons[0];

    if(files.length === 0 && (targetReportDownload || targetReportView)){
      setMsg("Triggering Report PDF generation from Reports column...");
      // Trigger the Reports eye icon or download icon to fetch the S3 PDF URL
      if(targetReportView) {
        targetReportView.click();
        await new Promise(res => setTimeout(res, 900));
      }
      if(!sessionStorage.getItem("pdfURL") && targetReportDownload) {
        targetReportDownload.click();
        await new Promise(res => setTimeout(res, 1200));
      }

      const reportPdfUrl = sessionStorage.getItem("pdfURL");
      if(reportPdfUrl && reportPdfUrl.startsWith("http")){
        try{
          const r = await fetch(reportPdfUrl);
          const b = await r.blob();
          const testName = (sessionStorage.getItem("TestName") || "DIGITAL_OPG_FULL_MOUTH_Report").replace(/[^a-zA-Z0-9_\\-]/g,"_");
          files.push(new File([b], testName + ".pdf", {type:"application/pdf"}));
          // Directly open/redirect to the PDF file in a new tab!
          window.open(reportPdfUrl, "_blank");
        }catch(e){}
      }
    }

    if(files.length===0){
      setMsg("⚠️ No direct report files could be automatically downloaded. Click a report to open it on screen and re-run, or download it to your PC and use 'Add Local PDFs' in Page Studio.");
      setTimeout(()=>toast.remove(), 8000);
      return;
    }

    setMsg("🚀 Uploading "+files.length+" report(s) to AI Document Harvester...");
    const fd=new FormData();
    fd.append("portal_name", title);
    fd.append("target_url", window.location.href);
    files.forEach(f=>fd.append("files", f));

    const res=await fetch(API+"/api/jobs/harvest-session", {method:"POST", body:fd});
    if(!res.ok) throw new Error("Server responded with HTTP "+res.status);
    const data=await res.json();

    setMsg("✅ Harvested "+files.length+" reports! Launching AI Document Harvester...");
    setTimeout(()=>{
      window.open(UI+"/?jobId="+data.job_id, "_blank");
      toast.remove();
    }, 1500);

  }catch(err){
    setMsg("❌ Error: "+err.message+". Ensure AI Document Harvester is running at "+API);
    setTimeout(()=>toast.remove(), 8000);
  }
})();`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Active Browser Session Harvester</h2>
              <p className="text-xs text-slate-300">Instant report extraction for protected commercial SPAs (e.g. Aarthi Scans)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          
          {/* Explanation Box */}
          <div className="p-4 rounded-xl bg-green-50/70 border border-green-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-slate-700">
              <span className="font-bold text-green-900">Why use Active Session Harvester?</span>
              <p className="mt-1">
                Commercial web applications like <strong className="text-slate-900">Aarthi Scans (Timeline :: USHA PUROHIT)</strong>, hospital systems, and banking portals protect patient documents behind mobile OTPs and login tokens. Because you are already logged in on your browser, this tool captures your reports directly from your authenticated tab—completely bypassing OTPs, logins, and Captchas!
              </p>
            </div>
          </div>

          {/* Method 1: Drag & Drop Bookmarklet */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-green-600" />
                Method 1: 1-Click Bookmarklet (Easiest &amp; Recommended)
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Drag the button below directly into your Chrome or Edge Bookmarks bar:
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href={bookmarkletCode}
                onClick={(e) => {
                  e.preventDefault();
                  alert("Drag this button to your Bookmarks Bar (Ctrl+Shift+B in Chrome/Edge to show bookmarks bar). Then click it whenever you are viewing reports on Aarthi Scans!");
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-xs shadow-md shadow-green-600/25 cursor-grab active:cursor-grabbing hover:from-green-500 hover:to-emerald-500 transition-all border border-green-500"
                title="Drag to bookmarks bar"
              >
                <Sparkles className="w-3.5 h-3.5 text-green-200" />
                <span>📑 Harvest to AI Harvester</span>
              </a>
              <span className="text-[11px] text-slate-400 italic">
                ← Drag to your browser bookmarks bar
              </span>
            </div>
          </div>

          {/* Method 2: Copy Console Snippet */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-slate-600" />
                Method 2: Paste in Browser DevTools Console
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all shadow-xs"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-green-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-600">
              When viewing <strong className="text-slate-900">reports.aarthiscan.com/#/main/visitgriddetails</strong>, press <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-200 rounded border border-slate-300 font-mono">F12</kbd> (or right-click → Inspect), click the <strong>Console</strong> tab, paste the code below and press <strong>Enter</strong>:
            </p>
            <div className="relative">
              <pre className="p-3 bg-slate-900 text-green-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-24 select-all border border-slate-800">
                {bookmarkletCode}
              </pre>
            </div>
          </div>

          {/* 3 Simple Steps Walkthrough */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">How It Works in 3 Steps:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
                <div className="w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-[10px]">1</div>
                <div className="font-semibold text-slate-800">Open Protected Portal</div>
                <div className="text-[11px] text-slate-500">Log in to Aarthi Scans and open the patient timeline (<em className="text-slate-700">USHA PUROHIT</em>).</div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
                <div className="w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-[10px]">2</div>
                <div className="font-semibold text-slate-800">Click Bookmarklet</div>
                <div className="text-[11px] text-slate-500">Click the bookmark or paste into console. It scans all visit rows &amp; report download buttons.</div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
                <div className="w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-[10px]">3</div>
                <div className="font-semibold text-slate-800">Unified Synthesis</div>
                <div className="text-[11px] text-slate-500">All PDF reports stream into AI Document Harvester, ready for Page Studio &amp; Master merging!</div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold tracking-wide transition-all shadow-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
