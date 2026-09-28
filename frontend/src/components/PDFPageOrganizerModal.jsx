import React, { useState, useEffect } from 'react';
import { 
  X, Trash2, RotateCw, ArrowLeft, ArrowRight, RotateCcw, 
  Check, Undo2, Filter, Layers, AlertTriangle, FileText, Sparkles, RefreshCw,
  ZoomIn, GripVertical, CheckSquare, Square, Hash, Stamp, SlidersHorizontal,
  Maximize2, ChevronLeft, ChevronRight, Minimize2, Palette, ShieldCheck, Download
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PDFPageOrganizerModal({
  isOpen,
  onClose,
  jobId,
  initialTab = 'layout',
  onSaveEdits
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'layout' or 'features'
  const [pages, setPages] = useState([]);
  const [initialPages, setInitialPages] = useState([]);
  const [sourceFiles, setSourceFiles] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletedPagesHistory, setDeletedPagesHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Multi-select & Batch operations state
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');

  // Page Inspector / Zoom modal state
  const [inspectingIndex, setInspectingIndex] = useState(null);

  // PDF Features: Page Numbering State
  const [numPosition, setNumPosition] = useState('bottom-center');
  const [numPattern, setNumPattern] = useState('Page {page} of {total}');
  const [numFontSize, setNumFontSize] = useState(9);
  const [numColor, setNumColor] = useState('#1e293b');
  const [skipCoverPage, setSkipCoverPage] = useState(false);
  const [isApplyingNumbers, setIsApplyingNumbers] = useState(false);

  // PDF Features: Watermark State
  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmAngle, setWmAngle] = useState(45);
  const [wmOpacity, setWmOpacity] = useState(0.2);
  const [wmFontSize, setWmFontSize] = useState(46);
  const [wmColor, setWmColor] = useState('#16a34a');
  const [isApplyingWatermark, setIsApplyingWatermark] = useState(false);

  // PDF Features: Optimizer State
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optStats, setOptStats] = useState(null);

  // PDF Features: Metadata State
  const [metaTitle, setMetaTitle] = useState('');
  const [metaAuthor, setMetaAuthor] = useState('');
  const [metaSubject, setMetaSubject] = useState('');
  const [isUpdatingMeta, setIsUpdatingMeta] = useState(false);

  // Feedback Notification Banner
  const [featureNotification, setFeatureNotification] = useState(null);

  const fetchPages = () => {
    if (!jobId) return;
    setIsLoading(true);
    setErrorMsg(null);

    fetch(`/api/jobs/${jobId}/pages`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not fetch pages for this merged PDF');
        return res.json();
      })
      .then((data) => {
        const rawPages = (data.pages || []).map((p, idx) => ({
          ...p,
          current_index: idx,
          rotation: p.rotation || 0,
          original_index: p.page_index
        }));
        setPages(rawPages);
        setInitialPages(JSON.parse(JSON.stringify(rawPages)));

        const uniqueSources = Array.from(new Set(rawPages.map((p) => p.source_filename).filter(Boolean)));
        setSourceFiles(uniqueSources);
        setIsLoading(false);
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !jobId) return;
    setActiveTab(initialTab);
    fetchPages();
  }, [isOpen, jobId, initialTab]);

  if (!isOpen) return null;

  // Single Move Left / Right
  const handleMovePage = (currentIndex, direction) => {
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const newPages = [...pages];
    const item = newPages[currentIndex];
    newPages[currentIndex] = newPages[targetIndex];
    newPages[targetIndex] = item;

    newPages.forEach((p, i) => (p.current_index = i));
    setPages(newPages);
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', index.toString());
    } catch (err) {}
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e, index) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newPages = [...pages];
    const [movedPage] = newPages.splice(draggedIndex, 1);
    newPages.splice(targetIndex, 0, movedPage);

    newPages.forEach((p, i) => (p.current_index = i));
    setPages(newPages);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Single Page Rotate 90° CW
  const handleRotatePage = (index) => {
    const newPages = [...pages];
    newPages[index].rotation = (newPages[index].rotation + 90) % 360;
    setPages(newPages);
  };

  // Single Page Delete
  const handleDeletePage = (index) => {
    const pageToDelete = pages[index];
    setDeletedPagesHistory((prev) => [...prev, { page: pageToDelete, index }]);
    const newPages = pages.filter((_, i) => i !== index);
    newPages.forEach((p, i) => (p.current_index = i));
    setPages(newPages);

    setSelectedIndices((prev) => {
      const next = new Set();
      prev.forEach((sel) => {
        if (sel < index) next.add(sel);
        else if (sel > index) next.add(sel - 1);
      });
      return next;
    });

    if (inspectingIndex !== null) {
      if (newPages.length === 0) {
        setInspectingIndex(null);
      } else if (inspectingIndex >= newPages.length) {
        setInspectingIndex(newPages.length - 1);
      }
    }
  };

  // Undo Last Deletion
  const handleUndoDelete = () => {
    if (deletedPagesHistory.length === 0) return;
    const lastDeleted = deletedPagesHistory[deletedPagesHistory.length - 1];
    const newPages = [...pages];
    const insertIdx = Math.min(lastDeleted.index, newPages.length);
    newPages.splice(insertIdx, 0, lastDeleted.page);
    newPages.forEach((p, i) => (p.current_index = i));
    setPages(newPages);
    setDeletedPagesHistory((prev) => prev.slice(0, -1));
  };

  // Remove Blank Pages
  const handleDeleteBlankPages = () => {
    const blankPages = pages.filter((p) => p.is_blank || p.text_char_count === 0);
    if (blankPages.length === 0) {
      alert('No blank pages detected in the merged document.');
      return;
    }

    if (!window.confirm(`Found ${blankPages.length} blank page(s). Remove them from the merged document?`)) {
      return;
    }

    const nonBlank = pages.filter((p) => !p.is_blank && p.text_char_count > 0);
    nonBlank.forEach((p, i) => (p.current_index = i));
    setPages(nonBlank);
    setSelectedIndices(new Set());
    setFeatureNotification({
      type: 'success',
      text: `Removed ${blankPages.length} blank page(s).`
    });
  };

  // Rotate All Pages 90°
  const handleRotateAll = () => {
    const newPages = pages.map((p) => ({
      ...p,
      rotation: (p.rotation + 90) % 360
    }));
    setPages(newPages);
  };

  // Multi-Select Toggles
  const handleToggleSelectPage = (index, e) => {
    if (e) e.stopPropagation();
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === pages.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(pages.map((_, i) => i)));
    }
  };

  // Batch Select from Range String
  const handleApplyRangeSelection = () => {
    if (!rangeInput.trim()) return;
    const newSelected = new Set(selectedIndices);
    const parts = rangeInput.split(',');

    parts.forEach((part) => {
      const clean = part.trim();
      if (clean.includes('-')) {
        const [start, end] = clean.split('-').map((s) => parseInt(s.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(pages.length, Math.max(start, end));
          for (let p = from; p <= to; p++) {
            newSelected.add(p - 1);
          }
        }
      } else {
        const pNum = parseInt(clean, 10);
        if (!isNaN(pNum) && pNum >= 1 && pNum <= pages.length) {
          newSelected.add(pNum - 1);
        }
      }
    });

    setSelectedIndices(newSelected);
    setRangeInput('');
  };

  // Batch Delete Selected Pages
  const handleBatchDeleteSelected = () => {
    if (selectedIndices.size === 0) return;
    if (selectedIndices.size === pages.length) {
      alert('You cannot delete all pages. At least one page must remain.');
      return;
    }

    if (!window.confirm(`Delete ${selectedIndices.size} selected page(s)?`)) return;

    const remainingPages = pages.filter((_, i) => !selectedIndices.has(i));
    remainingPages.forEach((p, i) => (p.current_index = i));
    setPages(remainingPages);
    setSelectedIndices(new Set());
    setFeatureNotification({
      type: 'success',
      text: `Deleted ${selectedIndices.size} page(s). You can Undo if needed.`
    });
  };

  // Batch Rotate Selected Pages
  const handleBatchRotateSelected = (angleDelta = 90) => {
    if (selectedIndices.size === 0) return;
    const newPages = pages.map((p, i) => {
      if (selectedIndices.has(i)) {
        return { ...p, rotation: (p.rotation + angleDelta + 360) % 360 };
      }
      return p;
    });
    setPages(newPages);
  };

  // Reset to initial sequence
  const handleReset = () => {
    if (window.confirm('Reset all pages to their original sequence and rotation?')) {
      setPages(JSON.parse(JSON.stringify(initialPages)));
      setDeletedPagesHistory([]);
      setSelectedIndices(new Set());
    }
  };

  // Save Page Edits to Backend
  const handleSave = async () => {
    if (pages.length === 0) {
      alert('You cannot save an empty document. At least one page must remain.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        page_operations: pages.map((p) => ({
          original_index: p.original_index,
          rotation: p.rotation
        }))
      };

      const res = await fetch(`/api/jobs/${jobId}/edit-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save page modifications on server');

      const data = await res.json();

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      if (onSaveEdits) {
        onSaveEdits(data);
      }
      onClose();
    } catch (err) {
      alert(`Error saving edits: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // PDF Features: Apply Page Numbering
  const handleApplyPageNumbers = async () => {
    setIsApplyingNumbers(true);
    setFeatureNotification(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply-page-numbers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: numPosition,
          format_pattern: numPattern,
          font_size: Number(numFontSize),
          color_hex: numColor,
          skip_first_page: skipCoverPage
        })
      });

      if (!res.ok) throw new Error('Failed to apply page numbering');
      const data = await res.json();
      setFeatureNotification({
        type: 'success',
        text: `✓ Successfully stamped page numbers (${numPosition}) across all pages!`
      });
      fetchPages();
      if (onSaveEdits) onSaveEdits(data);
    } catch (err) {
      setFeatureNotification({
        type: 'error',
        text: `Error applying page numbers: ${err.message}`
      });
    } finally {
      setIsApplyingNumbers(false);
    }
  };

  // PDF Features: Apply Watermark
  const handleApplyWatermark = async () => {
    if (!wmText.trim()) return;
    setIsApplyingWatermark(true);
    setFeatureNotification(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply-watermark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: wmText.trim(),
          opacity: Number(wmOpacity),
          angle: Number(wmAngle),
          font_size: Number(wmFontSize),
          color_hex: wmColor
        })
      });

      if (!res.ok) throw new Error('Failed to apply watermark');
      const data = await res.json();
      setFeatureNotification({
        type: 'success',
        text: `✓ Watermark "${wmText}" successfully stamped across all pages!`
      });
      fetchPages();
      if (onSaveEdits) onSaveEdits(data);
    } catch (err) {
      setFeatureNotification({
        type: 'error',
        text: `Error applying watermark: ${err.message}`
      });
    } finally {
      setIsApplyingWatermark(false);
    }
  };

  // PDF Features: Optimize Master PDF
  const handleOptimizePDF = async () => {
    setIsOptimizing(true);
    setFeatureNotification(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/optimize-pdf`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to optimize master PDF');
      const data = await res.json();
      setOptStats(data);
      setFeatureNotification({
        type: 'success',
        text: `✓ Master PDF optimized! Reduced from ${(data.original_size/1024).toFixed(1)} KB to ${(data.optimized_size/1024).toFixed(1)} KB (Saved ${data.saved_percentage}%).`
      });
      fetchPages();
      if (onSaveEdits) onSaveEdits(data);
    } catch (err) {
      setFeatureNotification({
        type: 'error',
        text: `Optimization error: ${err.message}`
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // PDF Features: Update Metadata
  const handleUpdateMetadata = async () => {
    setIsUpdatingMeta(true);
    setFeatureNotification(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/update-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: metaTitle || undefined,
          author: metaAuthor || undefined,
          subject: metaSubject || undefined
        })
      });
      if (!res.ok) throw new Error('Failed to update PDF metadata');
      const data = await res.json();
      setFeatureNotification({
        type: 'success',
        text: '✓ PDF document metadata updated successfully.'
      });
      if (onSaveEdits) onSaveEdits(data);
    } catch (err) {
      setFeatureNotification({
        type: 'error',
        text: `Metadata error: ${err.message}`
      });
    } finally {
      setIsUpdatingMeta(false);
    }
  };

  const displayedPages = selectedFilter === 'ALL'
    ? pages
    : pages.filter((p) => p.source_filename === selectedFilter);

  const inspectedPage = inspectingIndex !== null && pages[inspectingIndex] ? pages[inspectingIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-md">
      <div className="relative w-full max-w-6xl h-[92vh] bg-white border border-slate-300 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/95 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 text-green-700 border border-green-200">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-black">
                  Merged PDF Page Studio &amp; Feature Modifier
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-green-100 text-green-800 border border-green-300">
                  {pages.length} Pages Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Drag-and-drop to reorder, delete or rotate pages, or apply running headers, watermarks, and compression.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('layout')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'layout'
                    ? 'bg-green-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Page Layout &amp; Reorder</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('features')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'features'
                    ? 'bg-green-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Modify PDF Features</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-black hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {featureNotification && (
          <div className={`px-6 py-2 text-xs font-medium flex items-center justify-between border-b ${
            featureNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            <span>{featureNotification.text}</span>
            <button
              type="button"
              onClick={() => setFeatureNotification(null)}
              className="text-slate-400 hover:text-black p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: PAGE LAYOUT & DRAG-AND-DROP REORDER               */}
        {/* ======================================================== */}
        {activeTab === 'layout' && (
          <>
            {/* Studio Action Toolbar */}
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              
              {/* Left: Filter & Selection Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-xs">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="bg-transparent text-xs text-black focus:outline-none font-medium cursor-pointer"
                  >
                    <option value="ALL">All Sources ({pages.length} pgs)</option>
                    {sourceFiles.map((sf, i) => {
                      const count = pages.filter((p) => p.source_filename === sf).length;
                      return (
                        <option key={i} value={sf}>
                          {sf} ({count} pgs)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Select All Toggle */}
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-slate-700 hover:text-black hover:bg-slate-100 transition-colors border border-slate-300 shadow-xs"
                  title="Toggle Select All Pages"
                >
                  {selectedIndices.size === pages.length && pages.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>Select All ({selectedIndices.size})</span>
                </button>

                {/* Range Selection Input */}
                <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-xs">
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyRangeSelection()}
                    placeholder="Range: 1-10, 15"
                    className="bg-transparent px-2.5 py-1 text-xs text-black placeholder-slate-400 focus:outline-none w-28 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleApplyRangeSelection}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 text-[11px] font-bold border-l border-slate-200 transition-colors"
                  >
                    Select
                  </button>
                </div>
              </div>

              {/* Right: Batch Actions & Global Tools */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedIndices.size > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleBatchDeleteSelected}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 font-semibold transition-colors"
                      title="Delete all checked pages"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Delete Selected ({selectedIndices.size})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBatchRotateSelected(90)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-black hover:bg-slate-50 transition-colors shadow-xs"
                      title="Rotate selected pages 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-green-600" />
                      <span>Rotate Selected</span>
                    </button>
                  </>
                )}

                {/* Undo Delete Button */}
                {deletedPagesHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoDelete}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 font-medium transition-colors"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Undo Delete ({deletedPagesHistory.length})</span>
                  </button>
                )}

                {/* Blank Page Detector */}
                <button
                  type="button"
                  onClick={handleDeleteBlankPages}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-slate-700 hover:text-black hover:bg-slate-50 transition-colors border border-slate-300 shadow-xs"
                  title="Detect and remove empty/blank pages"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Purge Blank Pages</span>
                </button>

                {/* Rotate All */}
                <button
                  type="button"
                  onClick={handleRotateAll}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-slate-700 hover:text-black hover:bg-slate-50 transition-colors border border-slate-300 shadow-xs"
                  title="Rotate all pages 90° clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5 text-green-600" />
                  <span>Rotate All 90°</span>
                </button>

                {/* Reset to Original */}
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:text-black hover:bg-slate-200 transition-colors"
                  title="Reset to original order"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

            </div>

            {/* Drag & Drop Visual Help Callout */}
            <div className="px-6 py-1.5 bg-green-50/80 border-b border-green-200 flex items-center justify-between text-[11px] text-green-900 font-mono">
              <span className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-green-600" />
                <span>Tip: <b>Click &amp; drag</b> any card to reorder pages seamlessly. Click 🔍 to zoom and inspect.</span>
              </span>
              <span>Total Active: <b>{pages.length} Pages</b></span>
            </div>

            {/* Grid Container */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/40">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                  <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-mono">Loading page structure &amp; thumbnails...</p>
                </div>
              ) : errorMsg ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs">
                  <p className="font-bold">Error Loading Pages</p>
                  <p>{errorMsg}</p>
                </div>
              ) : displayedPages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
                  No pages match the selected filter.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {displayedPages.map((page) => {
                    const actualIndex = page.current_index;
                    const isFirst = actualIndex === 0;
                    const isLast = actualIndex === pages.length - 1;
                    const isSelected = selectedIndices.has(actualIndex);
                    const isDragging = draggedIndex === actualIndex;
                    const isDragOver = dragOverIndex === actualIndex;

                    return (
                      <div
                        key={`${page.original_index}-${actualIndex}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, actualIndex)}
                        onDragOver={(e) => handleDragOver(e, actualIndex)}
                        onDragLeave={(e) => handleDragLeave(e, actualIndex)}
                        onDrop={(e) => handleDrop(e, actualIndex)}
                        className={`group relative p-3 rounded-2xl bg-white border transition-all flex flex-col justify-between cursor-grab active:cursor-grabbing select-none shadow-xs ${
                          isDragging
                            ? 'opacity-40 scale-95 border-green-500 border-dashed bg-green-50'
                            : isDragOver
                            ? 'border-2 border-green-500 shadow-lg shadow-green-500/20 scale-102 bg-green-50'
                            : isSelected
                            ? 'border-green-500 bg-green-50/60 shadow-md ring-1 ring-green-500/50'
                            : 'border-slate-200 hover:border-green-500 hover:shadow-md'
                        }`}
                      >
                        {/* Page Header: Checkbox + Number + Filename */}
                        <div className="flex items-center justify-between text-[11px] mb-2 font-mono gap-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleToggleSelectPage(actualIndex, e)}
                              className="text-slate-400 hover:text-green-600 transition-colors p-0.5"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className="font-bold text-green-800 bg-green-100 px-1.5 py-0.5 rounded border border-green-200 text-[10px]">
                              #{actualIndex + 1}
                            </span>
                          </div>

                          <span className="text-slate-500 text-[10px] truncate max-w-[75px]" title={page.source_filename}>
                            {page.source_filename.replace('.pdf', '')}
                          </span>
                        </div>

                        {/* Thumbnail Container with Zoom Overlay */}
                        <div className="relative aspect-[3/4] w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center mb-2 group-hover:border-slate-300 transition-colors">
                          <img
                            src={`/api/jobs/${jobId}/page-thumbnail/${page.original_index}`}
                            alt={`Page ${actualIndex + 1}`}
                            className="w-full h-full object-contain transition-transform duration-200 pointer-events-none"
                            style={{ transform: `rotate(${page.rotation}deg)` }}
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />

                          {page.is_blank && (
                            <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                              Blank
                            </div>
                          )}

                          {/* Quick Inspect Button on Hover */}
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectingIndex(actualIndex);
                              }}
                              className="p-2 rounded-xl bg-green-600 text-white hover:bg-green-500 font-bold shadow-lg transition-transform hover:scale-105"
                              title="Zoom & Inspect Page"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Card Controls Bar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          {/* Move Left */}
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMovePage(actualIndex, 'left')}
                            className="p-1 rounded-lg text-slate-500 hover:text-black hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                            title="Move Earlier in Merged PDF"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Rotate Single Page */}
                          <button
                            type="button"
                            onClick={() => handleRotatePage(actualIndex)}
                            className="p-1 rounded-lg text-slate-500 hover:text-green-600 hover:bg-slate-100 transition-colors"
                            title={`Rotate 90° (Current: ${page.rotation}°)`}
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Right */}
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMovePage(actualIndex, 'right')}
                            className="p-1 rounded-lg text-slate-500 hover:text-black hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                            title="Move Later in Merged PDF"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Single Page */}
                          <button
                            type="button"
                            onClick={() => handleDeletePage(actualIndex)}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete this page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-600 font-mono">
                <span>Resulting Document: <b className="text-black">{pages.length} Pages</b></span>
                {deletedPagesHistory.length > 0 && (
                  <span className="text-amber-700 ml-2 font-bold">
                    ({deletedPagesHistory.length} pages removed)
                  </span>
                )}
                {selectedIndices.size > 0 && (
                  <span className="text-green-700 ml-2 font-bold">
                    ({selectedIndices.size} selected)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || pages.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-500 hover:to-emerald-600 text-white font-bold text-xs shadow-lg shadow-green-600/25 flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Rebuilding Merged Document...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Save &amp; Update Merged PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MODIFY PDF FEATURES (WATERMARK, NUMBERS, OPTIMIZE) */}
        {/* ======================================================== */}
        {activeTab === 'features' && (
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
            <div className="max-w-4xl mx-auto space-y-6">

              {/* 1. Running Header / Footer Page Numbers */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-green-100 text-green-700 border border-green-200">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-black">Running Page Numbers (Header / Footer)</h4>
                    <p className="text-xs text-slate-500">Stamp dynamic page numbers across all pages of the master document.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Position</label>
                    <select
                      value={numPosition}
                      onChange={(e) => setNumPosition(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 font-medium"
                    >
                      <option value="bottom-center">Bottom Center (Footer)</option>
                      <option value="bottom-right">Bottom Right (Footer)</option>
                      <option value="bottom-left">Bottom Left (Footer)</option>
                      <option value="top-right">Top Right (Header)</option>
                      <option value="top-center">Top Center (Header)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Format Pattern</label>
                    <input
                      type="text"
                      value={numPattern}
                      onChange={(e) => setNumPattern(e.target.value)}
                      placeholder="Page {page} of {total}"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Font Color</label>
                    <select
                      value={numColor}
                      onChange={(e) => setNumColor(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 font-medium"
                    >
                      <option value="#1e293b">Dark Slate (#1e293b)</option>
                      <option value="#15803d">Leaf Green (#15803d)</option>
                      <option value="#64748b">Slate Gray (#64748b)</option>
                      <option value="#0f172a">Deep Black (#0f172a)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Font Size</label>
                    <select
                      value={numFontSize}
                      onChange={(e) => setNumFontSize(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 font-medium"
                    >
                      <option value={8}>8 pt (Subtle)</option>
                      <option value={9}>9 pt (Standard)</option>
                      <option value={10}>10 pt (Medium)</option>
                      <option value={12}>12 pt (Large)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipCoverPage}
                      onChange={(e) => setSkipCoverPage(e.target.checked)}
                      className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <span>Skip page 1 (Preserve clean cover/title page)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleApplyPageNumbers}
                    disabled={isApplyingNumbers}
                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-green-600/20 disabled:opacity-50 transition-colors"
                  >
                    {isApplyingNumbers ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Stamping Numbers...</span>
                      </>
                    ) : (
                      <>
                        <Hash className="w-3.5 h-3.5" />
                        <span>Apply Page Numbers</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 2. Watermark Stamp */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <Stamp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-black">Document Watermark Stamp</h4>
                    <p className="text-xs text-slate-500">Stamp custom security or review text across the master document.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Watermark Text</label>
                    <input
                      type="text"
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      placeholder="e.g. CONFIDENTIAL"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 font-bold uppercase text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Angle</label>
                    <select
                      value={wmAngle}
                      onChange={(e) => setWmAngle(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 font-medium"
                    >
                      <option value={45}>Diagonal (45° Upward)</option>
                      <option value={0}>Horizontal (0° Center)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Opacity</label>
                    <select
                      value={wmOpacity}
                      onChange={(e) => setWmOpacity(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 font-medium"
                    >
                      <option value={0.12}>12% (Very Light)</option>
                      <option value={0.20}>20% (Recommended)</option>
                      <option value={0.35}>35% (Medium)</option>
                      <option value={0.50}>50% (Prominent)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Color</label>
                    <select
                      value={wmColor}
                      onChange={(e) => setWmColor(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 font-medium"
                    >
                      <option value="#16a34a">Leaf Green (#16a34a)</option>
                      <option value="#94a3b8">Muted Gray (#94a3b8)</option>
                      <option value="#ef4444">Alert Red (#ef4444)</option>
                      <option value="#f59e0b">Amber Gold (#f59e0b)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-xs">Presets:</span>
                    {['CONFIDENTIAL', 'DRAFT', 'INTERNAL USE', 'COPY'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWmText(preset)}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyWatermark}
                    disabled={isApplyingWatermark || !wmText.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-colors"
                  >
                    {isApplyingWatermark ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Applying Watermark...</span>
                      </>
                    ) : (
                      <>
                        <Stamp className="w-3.5 h-3.5" />
                        <span>Stamp Watermark</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 3. Master PDF Optimizer & Compression */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-green-100 text-green-700 border border-green-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-black">Lossless PDF Optimizer &amp; Stream Deflater</h4>
                    <p className="text-xs text-slate-500">
                      Garbage-collects unused objects, compresses PDF stream data, and optimizes fonts for lightweight distribution.
                    </p>
                    {optStats && (
                      <div className="mt-2 text-[11px] font-mono text-green-800 flex items-center gap-2">
                        <span>Original: {(optStats.original_size/1024).toFixed(1)} KB</span>
                        <span>➔</span>
                        <span>Optimized: {(optStats.optimized_size/1024).toFixed(1)} KB</span>
                        <span className="bg-green-100 px-1.5 py-0.5 rounded font-bold border border-green-200">
                          Saved {optStats.saved_percentage}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOptimizePDF}
                  disabled={isOptimizing}
                  className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-green-600/20 disabled:opacity-50 transition-colors shrink-0"
                >
                  {isOptimizing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Optimize Master PDF</span>
                    </>
                  )}
                </button>
              </div>

              {/* 4. Document Metadata Modifier */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-black">PDF Document Metadata</h4>
                    <p className="text-xs text-slate-500">Configure embedded PDF author, title, and topic descriptors.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Title</label>
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder="e.g. Master Consolidated Syllabus"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Author / Organization</label>
                    <input
                      type="text"
                      value={metaAuthor}
                      onChange={(e) => setMetaAuthor(e.target.value)}
                      placeholder="e.g. AI PDF Crawler & Synthesizer"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5 font-semibold">Subject / Topic</label>
                    <input
                      type="text"
                      value={metaSubject}
                      onChange={(e) => setMetaSubject(e.target.value)}
                      placeholder="e.g. Full-Stack Syllabus & Materials"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-green-500 text-xs"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleUpdateMetadata}
                    disabled={isUpdatingMeta || (!metaTitle && !metaAuthor && !metaSubject)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-black text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {isUpdatingMeta ? 'Updating...' : 'Save Metadata'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* HIGH-RESOLUTION PAGE INSPECTOR / ZOOM MODAL              */}
        {/* ======================================================== */}
        {inspectedPage && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl h-[90vh] bg-white border border-slate-300 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              
              {/* Inspector Topbar */}
              <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold font-mono text-green-800 bg-green-100 px-2.5 py-1 rounded-lg border border-green-200 text-xs">
                    Page #{inspectedPage.current_index + 1} of {pages.length}
                  </span>
                  <div className="text-xs">
                    <p className="font-bold text-black truncate max-w-xs">{inspectedPage.source_filename}</p>
                    <p className="text-slate-500 text-[11px] font-mono">
                      Dimensions: {inspectedPage.width} × {inspectedPage.height} pt • {inspectedPage.text_char_count} chars
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Prev Page Button */}
                  <button
                    type="button"
                    disabled={inspectedPage.current_index === 0}
                    onClick={() => setInspectingIndex(inspectedPage.current_index - 1)}
                    className="p-1.5 rounded-xl text-slate-600 hover:text-black hover:bg-slate-200 disabled:opacity-20 transition-colors"
                    title="Previous Page (←)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Next Page Button */}
                  <button
                    type="button"
                    disabled={inspectedPage.current_index === pages.length - 1}
                    onClick={() => setInspectingIndex(inspectedPage.current_index + 1)}
                    className="p-1.5 rounded-xl text-slate-600 hover:text-black hover:bg-slate-200 disabled:opacity-20 transition-colors"
                    title="Next Page (→)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Rotate Inside Inspector */}
                  <button
                    type="button"
                    onClick={() => handleRotatePage(inspectedPage.current_index)}
                    className="p-1.5 rounded-xl text-slate-600 hover:text-green-600 hover:bg-slate-200 transition-colors ml-2"
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* Delete Inside Inspector */}
                  <button
                    type="button"
                    onClick={() => handleDeletePage(inspectedPage.current_index)}
                    className="p-1.5 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete this page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="h-4 w-[1px] bg-slate-200 mx-1" />

                  {/* Close Inspector */}
                  <button
                    type="button"
                    onClick={() => setInspectingIndex(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-black hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Inspector High-Res Image Display */}
              <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-100">
                <img
                  src={`/api/jobs/${jobId}/page-preview/${inspectedPage.original_index}`}
                  alt={`High-Res Preview Page ${inspectedPage.current_index + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xl transition-transform duration-200 bg-white"
                  style={{ transform: `rotate(${inspectedPage.rotation}deg)` }}
                />
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
