import React, { useState } from 'react';
import { 
  FileText, CheckSquare, Square, ExternalLink, Eye, ArrowUp, ArrowDown, 
  Download, Search, RefreshCw, Layers, CheckCircle2 
} from 'lucide-react';

export default function PDFPreviewGrid({
  jobId,
  discoveredPDFs = [],
  onTogglePDF,
  onSelectAll,
  onDeselectAll,
  onPreviewPDF,
  onReorderPDFs,
  onReMerge,
  isReMerging,
  isPipelineComplete,
  includeCover,
  setIncludeCover
}) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!discoveredPDFs || discoveredPDFs.length === 0) {
    return null;
  }

  const selectedPDFs = discoveredPDFs.filter((p) => p.selected);
  const selectedCount = selectedPDFs.length;
  const selectedTotalPages = selectedPDFs.reduce((acc, p) => acc + (p.page_count || 0), 0);

  // Filtered by search query
  const filteredPDFs = discoveredPDFs.filter((pdf) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      pdf.filename.toLowerCase().includes(q) ||
      (pdf.title && pdf.title.toLowerCase().includes(q))
    );
  });

  const handleMove = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= discoveredPDFs.length) return;

    const newOrder = [...discoveredPDFs];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    if (onReorderPDFs) {
      onReorderPDFs(newOrder.map((p) => p.id));
    }
  };

  const handleDownloadSingle = (pdf) => {
    if (!jobId || !pdf.filename) return;
    window.open(`/api/pdf/${jobId}/${encodeURIComponent(pdf.filename)}`, '_blank');
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 mb-12">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-black tracking-tight">
              Discovered PDF Assets
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
              {selectedCount} of {discoveredPDFs.length} Selected
            </span>
            {selectedTotalPages > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 font-mono">
                <Layers className="w-3 h-3" />
                {selectedTotalPages} Total Pages to Merge
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Reorder items with arrows to customize the sequence of the merged document.
          </p>
        </div>

        {/* Action Controls & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter documents..."
              className="bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-black placeholder-slate-400 focus:outline-none focus:border-green-500 w-36 sm:w-44"
            />
          </div>

          <button
            type="button"
            onClick={onSelectAll}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:text-black hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:text-black hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            Deselect All
          </button>

          {isPipelineComplete && (
            <button
              type="button"
              onClick={onReMerge}
              disabled={isReMerging || selectedCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 hover:bg-green-500 text-white transition-all shadow-md shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReMerging ? 'animate-spin' : ''}`} />
              <span>{isReMerging ? 'Re-merging...' : 'Re-merge Order'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of PDF Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPDFs.map((pdf, index) => {
          const isSelected = !!pdf.selected;
          const isParsed = pdf.status === 'parsed';
          const isFailed = pdf.status === 'failed' || pdf.status === 'skipped';
          const isDownloading = pdf.status === 'downloading';

          const sizeStr = pdf.file_size_bytes
            ? `${(pdf.file_size_bytes / 1024).toFixed(1)} KB`
            : 'Pending';

          return (
            <div
              key={pdf.id}
              className={`relative p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-white border-slate-300 hover:border-green-500 shadow-sm'
                  : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-90'
              }`}
            >
              <div>
                {/* Header: Checkbox & Status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <button
                    type="button"
                    onClick={() => onTogglePDF(pdf.id, !isSelected)}
                    className="flex items-center gap-2 group text-left min-w-0"
                  >
                    <div className="shrink-0 mt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-green-600 group-hover:text-green-700" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-black line-clamp-1 group-hover:text-green-700 transition-colors" title={pdf.filename}>
                        {index + 1}. {pdf.filename}
                      </span>
                    </div>
                  </button>

                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isParsed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : isDownloading
                        ? 'bg-green-100 text-green-800 border-green-300 animate-pulse'
                        : isFailed
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {pdf.status}
                  </span>
                </div>

                {/* Extracted Title / Button Label */}
                {pdf.title && (
                  <p className="text-xs font-bold text-green-700 line-clamp-1 mb-2">
                    {pdf.title}
                  </p>
                )}

                {/* Summary / Extracted Snippet */}
                {pdf.summary_snippet ? (
                  <p className="text-[11px] text-slate-600 line-clamp-3 mb-3 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    "{pdf.summary_snippet}"
                  </p>
                ) : pdf.error_message ? (
                  <p className="text-[11px] text-red-600 line-clamp-2 mb-3 bg-red-50 p-2 rounded-lg border border-red-200">
                    {pdf.error_message}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 italic mb-3">
                    Awaiting download &amp; page extraction...
                  </p>
                )}
              </div>

              {/* Card Footer: Metadata, Reordering & Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-slate-500 font-mono">
                  {pdf.page_count > 0 && (
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold border border-slate-200">
                      {pdf.page_count} {pdf.page_count === 1 ? 'pg' : 'pgs'}
                    </span>
                  )}
                  <span>{sizeStr}</span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Reorder Up */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className="p-1 rounded text-slate-500 hover:text-black hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                    title="Move earlier in merge sequence"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  {/* Reorder Down */}
                  <button
                    type="button"
                    disabled={index === filteredPDFs.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className="p-1 rounded text-slate-500 hover:text-black hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                    title="Move later in merge sequence"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Preview text */}
                  {pdf.extracted_text_preview && (
                    <button
                      type="button"
                      onClick={() => onPreviewPDF(pdf)}
                      className="p-1 rounded text-slate-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                      title="Inspect Extracted Text"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Download Individual PDF */}
                  {isParsed && (
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(pdf)}
                      className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Download this individual PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* External link */}
                  {pdf.url && (
                    <a
                      href={pdf.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-slate-500 hover:text-black hover:bg-slate-100 transition-colors"
                      title="Open Original Source URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );
}
