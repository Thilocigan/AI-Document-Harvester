import React, { useState } from 'react';
import { 
  Download, FileDown, CheckCircle, ShieldCheck, Sparkles, 
  BookCheck, FileText, Layers, SlidersHorizontal, Settings2,
  Archive, Scissors, Check, X
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function MasterDownloadHub({
  jobId,
  masterFilename,
  masterFileSize = 0,
  masterPageCount = 0,
  isReady = false,
  onOpenOrganizer
}) {
  const [showRangeInput, setShowRangeInput] = useState(false);
  const [pageRange, setPageRange] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  if (!isReady || !jobId) {
    return null;
  }

  const handleDownloadPDF = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    window.open(`/api/download/${jobId}`, '_blank');
  };

  const handleDownloadZIP = () => {
    window.open(`/api/download/${jobId}/zip`, '_blank');
  };

  const handleDownloadSummaryPDF = () => {
    window.open(`/api/download/${jobId}/summary-pdf`, '_blank');
  };

  const handleDownloadSummaryMD = () => {
    window.open(`/api/download/${jobId}/summary`, '_blank');
  };

  const handleExtractRange = async (e) => {
    e.preventDefault();
    if (!pageRange.trim()) return;

    setIsExtracting(true);
    try {
      const resp = await fetch(`/api/jobs/${jobId}/extract-range`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: pageRange.trim() })
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Failed to extract range');
      }

      const blob = await resp.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Extracted_Pages_${jobId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setShowRangeInput(false);
      setPageRange('');
    } catch (err) {
      alert(`Range extraction error: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const sizeKb = masterFileSize ? `${(masterFileSize / 1024).toFixed(1)} KB` : 'Ready';

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 mb-16">
      <div className="relative p-8 rounded-3xl bg-white border-2 border-green-500/40 shadow-2xl shadow-green-500/10 backdrop-blur-xl overflow-hidden text-center">
        
        {/* Glow ambient circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 border border-green-300 text-green-800 text-xs font-bold mb-4 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-green-700" />
            <span>Total PDFs Merged &amp; Verified</span>
          </div>

          <h3 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
            Complete Merged Document Ready
          </h3>

          <p className="mt-2 text-sm text-slate-600">
            All discovered and selected PDF documents have been collected and sequentially merged into a single downloadable master file with interactive outline bookmarks.
          </p>

          {/* Metrics Pill */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-4 bg-slate-50 px-6 py-2.5 rounded-2xl border border-slate-200 font-mono text-xs text-slate-700 shadow-xs">
            <span className="flex items-center gap-1.5 text-green-700">
              <Layers className="w-4 h-4" />
              <b>{masterPageCount} Total Merged Pages</b>
            </span>
            <span className="text-slate-300">•</span>
            <span>Consolidated Size: <b className="text-black">{sizeKb}</b></span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 flex items-center gap-1 font-bold">
              <CheckCircle className="w-3.5 h-3.5" /> Bookmarks Indexed
            </span>
          </div>

          {/* Page Organizer & Editor Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenOrganizer && onOpenOrganizer('layout')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-green-50 border border-green-500/50 hover:border-green-600 text-green-800 font-bold text-xs tracking-wide transition-all shadow-sm hover:shadow-green-500/20 group"
            >
              <SlidersHorizontal className="w-4 h-4 text-green-600 group-hover:rotate-90 transition-transform duration-300" />
              <span>🛠️ Reorder &amp; Organize Pages</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenOrganizer && onOpenOrganizer('features')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-500/50 hover:border-emerald-600 text-emerald-800 font-bold text-xs tracking-wide transition-all shadow-sm hover:shadow-emerald-500/20"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>✨ Modify PDF Features (Watermark &amp; Numbering)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRangeInput(!showRangeInput)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-semibold text-xs transition-colors"
              title="Extract specific page range"
            >
              <Scissors className="w-3.5 h-3.5 text-green-600" />
              <span>Extract Range</span>
            </button>
          </div>

          {/* Inline Page Range Extraction Form */}
          {showRangeInput && (
            <form onSubmit={handleExtractRange} className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-300 flex items-center gap-2 max-w-md mx-auto animate-in fade-in duration-200 shadow-sm">
              <input
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="e.g. 1-10, 15, 20-30"
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-black placeholder-slate-400 focus:outline-none font-mono"
              />
              <button
                type="submit"
                disabled={!pageRange.trim() || isExtracting}
                className="px-3.5 py-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
              >
                {isExtracting ? 'Extracting...' : 'Export'}
              </button>
              <button
                type="button"
                onClick={() => setShowRangeInput(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-black"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* Action Download Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Primary Download CTA: Complete Merged PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-500 hover:to-emerald-600 text-white font-black text-base tracking-wide shadow-xl shadow-green-600/30 flex items-center justify-center gap-3 transition-all transform active:scale-95"
            >
              <Download className="w-5 h-5 text-white" />
              <span>Download Complete Merged PDF</span>
            </button>

            {/* ZIP of All Original Files */}
            <button
              type="button"
              onClick={handleDownloadZIP}
              className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              title="Download all collected original files in a single ZIP"
            >
              <Archive className="w-4 h-4 text-amber-600" />
              <span>Download ZIP Bundle</span>
            </button>

            {/* Standalone Executive Summary PDF */}
            <button
              type="button"
              onClick={handleDownloadSummaryPDF}
              className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              title="Download Standalone AI Executive Report"
            >
              <BookCheck className="w-4 h-4 text-green-600" />
              <span>AI Summary (PDF)</span>
            </button>

            {/* Markdown Summary Download */}
            <button
              type="button"
              onClick={handleDownloadSummaryMD}
              className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              title="Export Markdown Document"
            >
              <FileDown className="w-4 h-4 text-slate-600" />
              <span>Report (.md)</span>
            </button>
          </div>

          <p className="mt-4 text-[11px] text-slate-500 font-mono">
            {masterFilename || 'Merged_Complete_PDFs.pdf'}
          </p>
        </div>

      </div>
    </section>
  );
}
