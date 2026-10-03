import React, { useState } from 'react';
import { Globe, ArrowRight, ShieldAlert, Sparkles, X, SlidersHorizontal, Activity, Layers, KeyRound, ExternalLink } from 'lucide-react';

export default function HeroSection({
  targetUrl,
  setTargetUrl,
  depthLevel,
  setDepthLevel,
  crawlerMode,
  setCrawlerMode,
  authCookies,
  setAuthCookies,
  onStartPipeline,
  onOpenHarvesterModal,
  isLoading,
  currentStatus
}) {
  const [urlError, setUrlError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleStart = (e) => {
    e.preventDefault();
    if (!targetUrl.trim()) {
      setUrlError('Please enter a valid website URL to crawl.');
      return;
    }
    setUrlError('');
    onStartPipeline();
  };

  const handleUrlChange = (e) => {
    setTargetUrl(e.target.value);
    if (urlError) setUrlError('');
  };

  return (
    <section className="relative pt-10 pb-12 overflow-hidden bg-[#f4f6f8]">
      {/* Background Leaf Green Accent Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[320px] bg-green-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        
        {/* Top Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-bold mb-6 tracking-wide shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-green-600 animate-pulse" />
          <span>Dynamic SPA &amp; Multi-Document Master Harvester</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-black tracking-tight leading-tight">
          Crawl. Extract. Synthesize. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-emerald-600 to-green-700">
            One Unified Master PDF.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
          Autonomous document crawler for standard websites, client-side Single Page Applications (Angular, React, Vue), and commercial portals. Extracts PDFs, prunes redundancy, and compiles a single publication-ready report.
        </p>

        {/* Main Input Form */}
        <form onSubmit={handleStart} className="mt-8 max-w-3xl mx-auto">
          <div className="relative p-2 rounded-2xl bg-white border border-slate-300 shadow-xl focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20 transition-all">
            
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* URL Input */}
              <div className="relative flex-1 w-full flex items-center">
                <Globe className="w-5 h-5 text-green-600 ml-3 shrink-0" />
                <input
                  type="text"
                  value={targetUrl}
                  onChange={handleUrlChange}
                  placeholder="https://example.com or SPA route (e.g. reports.aarthiscan.com/#/main/visitgriddetails)..."
                  disabled={isLoading}
                  className="w-full bg-transparent px-3 py-3 text-sm sm:text-base text-black placeholder-slate-400 focus:outline-none font-medium"
                />
                {targetUrl && !isLoading && (
                  <button
                    type="button"
                    onClick={() => setTargetUrl('')}
                    className="p-1.5 text-slate-400 hover:text-black rounded-lg hover:bg-slate-100 mr-2 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Depth Selector Pills */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 w-full md:w-auto justify-center">
                <button
                  type="button"
                  onClick={() => setDepthLevel('single')}
                  disabled={isLoading}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    depthLevel === 'single'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Single Page
                </button>
                <button
                  type="button"
                  onClick={() => setDepthLevel('entire')}
                  disabled={isLoading}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    depthLevel === 'entire'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Entire Site
                </button>
              </div>

              {/* Start CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-500 hover:to-emerald-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-green-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform active:scale-95 shrink-0"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <span>Start Crawling &amp; Synthesizing</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Validation Error Message */}
          {urlError && (
            <div className="flex items-center justify-center gap-2 mt-3 text-red-600 text-xs font-medium">
              <ShieldAlert className="w-4 h-4" />
              <span>{urlError}</span>
            </div>
          )}

          {/* Action Row: SPA Harvester + Advanced Settings Toggle */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            
            {/* 1-Click Harvester Button (Highlight for Commercial Portals like Aarthi Scans) */}
            <button
              type="button"
              onClick={onOpenHarvesterModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold transition-all shadow-xs"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>1-Click Active Session Harvester (Aarthi Scans / Protected Portals)</span>
            </button>

            {/* Advanced SPA / Crawler Options Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all font-medium"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>{showAdvanced ? 'Hide SPA & Crawler Settings' : 'SPA & Crawler Settings'}</span>
            </button>

          </div>

          {/* Expandable Advanced SPA & Commercial Settings Box */}
          {showAdvanced && (
            <div className="mt-3 p-4 rounded-xl bg-white border border-slate-200 text-left shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-green-600" />
                    Crawler Engine Mode
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Controls how the crawler evaluates DOM and renders client-side JavaScript applications.
                  </p>
                </div>
                <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCrawlerMode('auto')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      crawlerMode === 'auto' ? 'bg-green-600 text-white shadow-xs' : 'text-slate-600 hover:text-black'
                    }`}
                  >
                    Auto-Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrawlerMode('browser')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      crawlerMode === 'browser' ? 'bg-green-600 text-white shadow-xs' : 'text-slate-600 hover:text-black'
                    }`}
                  >
                    Playwright SPA
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrawlerMode('static')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      crawlerMode === 'static' ? 'bg-green-600 text-white shadow-xs' : 'text-slate-600 hover:text-black'
                    }`}
                  >
                    Static HTTP
                  </button>
                </div>
              </div>

              {/* Session Cookies / Auth Header Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>Session Cookie / Auth Token (Optional for protected SPAs)</span>
                </label>
                <input
                  type="text"
                  value={authCookies}
                  onChange={(e) => setAuthCookies(e.target.value)}
                  placeholder="e.g. session_id=xyz; token=eyJhbGci... or Bearer token"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <p className="text-[11px] text-slate-400">
                  If the target SPA requires a login session to view reports, paste the cookie or authorization token here.
                </p>
              </div>

              {/* Sample Target Portal Quick-Fill */}
              <div className="pt-2 flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">Quick load SPA example:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetUrl('https://reports.aarthiscan.com/reportsPortal/#/main/visitgriddetails');
                    setCrawlerMode('browser');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                >
                  Aarthi Scans Portal (#/main/visitgriddetails)
                </button>
              </div>

            </div>
          )}

        </form>

      </div>
    </section>
  );
}
