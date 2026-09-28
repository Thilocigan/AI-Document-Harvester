import React from 'react';
import { Layers, Settings, MessageSquare, Terminal, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Navbar({ onOpenSettings, onToggleChat, isChatOpen, onSelectPreset, presets = [] }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-[#f4f6f8]/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-green-600 to-emerald-400 p-0.5 shadow-lg shadow-green-500/20">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-black tracking-tight">AI PDF Crawler</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-800 border border-green-200">
                &amp; Synthesizer
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono hidden sm:block">
              Multi-Document Discovery • Semantic Synthesis • Master PDF Stitcher
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Presets Dropdown */}
          {presets.length > 0 && (
            <div className="relative group hidden md:block">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:border-green-500 hover:text-green-700 hover:bg-green-50/50 transition-all">
                <Sparkles className="w-3.5 h-3.5 text-green-600" />
                <span>Presets</span>
              </button>
              <div className="absolute right-0 mt-2 w-72 p-2 rounded-xl bg-white border border-slate-200 shadow-xl opacity-0 translate-y-1 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-200 z-50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Sample Test Repositories
                </p>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onSelectPreset(preset)}
                    className="w-full text-left p-2 rounded-lg hover:bg-green-50 text-xs transition-colors group/item"
                  >
                    <div className="font-semibold text-slate-900 group-hover/item:text-green-700">
                      {preset.name}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 hover:text-black hover:bg-slate-100 transition-all"
            title="Configure AI API Keys or Models"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* RAG Assistant Toggle */}
          <button
            onClick={onToggleChat}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
              isChatOpen
                ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-600/20'
                : 'bg-green-50 text-green-700 border-green-300 hover:border-green-500 hover:bg-green-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>RAG Chat</span>
          </button>
        </div>

      </div>
    </header>
  );
}
