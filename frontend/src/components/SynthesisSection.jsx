import React, { useState } from 'react';
import { Brain, FileCheck, Layers, BookOpen, Check, ListChecks, Sparkles, ChevronRight } from 'lucide-react';

export default function SynthesisSection({ synthesizedAnalysis }) {
  const [activeTab, setActiveTab] = useState('summary');

  if (!synthesizedAnalysis) {
    return null;
  }

  const {
    executive_summary,
    word_count,
    table_of_contents = [],
    redundancies_pruned = [],
    model_used
  } = synthesizedAnalysis;

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 mb-12">
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-md relative overflow-hidden">
        
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-green-500/10 blur-[90px] rounded-full pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-green-600" />
              <span>Synthesized Intelligence</span>
            </div>
            <h2 className="text-2xl font-black text-black tracking-tight">
              AI Multi-Document Executive Synthesis
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Synthesized by <span className="text-green-700 font-bold">{model_used || 'AI Engine'}</span> • {word_count} words consolidated
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'summary'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Executive Summary</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('toc')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'toc'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Table of Contents ({table_of_contents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dedup')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'dedup'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Pruned Redundancies</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          
          {/* 1. Executive Summary */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 leading-relaxed text-sm sm:text-base text-slate-800">
                {executive_summary.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-4 last:mb-0 leading-relaxed text-slate-700">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 font-mono">
                <span>Executive Scope: High-level Multi-Document Synthesis</span>
                <span className="text-green-700 font-bold">Target Range: 250–400 words ({word_count} words generated)</span>
              </div>
            </div>
          )}

          {/* 2. Structured Table of Contents */}
          {activeTab === 'toc' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Thematic chapters clustered across underlying PDF documents with source mappings:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {table_of_contents.map((chapter, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-green-400 transition-all flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-lg bg-green-100 text-green-800 text-xs font-bold flex items-center justify-center border border-green-300">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-black">
                          {chapter.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed mb-3">
                        {chapter.summary}
                      </p>
                      {chapter.key_points && chapter.key_points.length > 0 && (
                        <div className="space-y-1 mb-3">
                          {chapter.key_points.map((kp, kIdx) => (
                            <div key={kIdx} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                              <span className="text-green-600 shrink-0 mt-0.5 font-bold">•</span>
                              <span>{kp}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="text-slate-500">Sources:</span>
                      <span className="font-mono text-green-800 font-bold truncate max-w-[200px]" title={chapter.source_documents.join(', ')}>
                        {chapter.source_documents.join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Deduplication Audit */}
          {activeTab === 'dedup' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Repetitive boilerplates, headers/footers, and duplicate corporate notices identified and pruned by the AI engine:
              </p>
              <div className="space-y-2">
                {redundancies_pruned.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-500 italic border border-slate-200">
                    No significant duplicate boilerplate sections detected.
                  </div>
                ) : (
                  redundancies_pruned.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs"
                    >
                      <div className="p-1 rounded-md bg-green-100 text-green-700 border border-green-200 shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-700 leading-normal font-medium">{item}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </section>
  );
}
