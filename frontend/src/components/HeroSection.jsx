import React, { useState } from 'react';
import { Globe, ArrowRight, Compass, ShieldAlert, Sparkles, X, Check } from 'lucide-react';

export default function HeroSection({
  targetUrl,
  setTargetUrl,
  depthLevel,
  setDepthLevel,
  onStartPipeline,
  isLoading,
  currentStatus
}) {
  const [urlError, setUrlError] = useState('');

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
    <section className="relative pt-10 pb-14 overflow-hidden bg-[#f4f6f8]">
      {/* Background Leaf Green Accent Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[320px] bg-green-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        
        {/* Top Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-bold mb-6 tracking-wide shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-green-600 animate-pulse" />
          <span>Autonomous AI Document Discovery &amp; Master Synthesis</span>
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
          Input any website domain. Our AI crawler identifies all hosted PDF documents, prunes redundant disclaimers, clusters thematic chapters, and compiles a single publication-ready master report.
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
                  placeholder="https://example.com or select preset below..."
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

        </form>

      </div>
    </section>
  );
}
