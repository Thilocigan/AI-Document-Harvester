import React from 'react';
import { X, FileText, ExternalLink, Hash, BookOpen, Layers } from 'lucide-react';

export default function PDFModal({ pdf, onClose }) {
  if (!pdf) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white border border-slate-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 text-green-700 border border-green-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-black line-clamp-1">
                {pdf.filename}
              </h3>
              <p className="text-xs text-green-700 font-mono font-semibold">
                {pdf.title || 'Extracted Document Structure'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pdf.url && (
              <a
                href={pdf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 hover:text-black transition-colors"
              >
                <span>Original Source</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-green-600" />
            <b>{pdf.page_count} Pages</b>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 text-green-600" />
            <b>{pdf.word_count?.toLocaleString()} Words</b>
          </span>
          <span>•</span>
          <span>
            Size: <b>{pdf.file_size_bytes ? `${(pdf.file_size_bytes / 1024).toFixed(1)} KB` : 'N/A'}</b>
          </span>
          <span>•</span>
          <span className="text-emerald-700 font-bold">Status: {pdf.status}</span>
        </div>

        {/* Modal Content: Extracted Text */}
        <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-slate-800 leading-relaxed space-y-4 bg-slate-50/30">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              PyMuPDF Extracted Content Preview
            </span>
            <div className="p-4 rounded-xl bg-white border border-slate-200 whitespace-pre-wrap select-text text-slate-800 shadow-xs">
              {pdf.extracted_text_preview || 'No text extracted for this document.'}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
