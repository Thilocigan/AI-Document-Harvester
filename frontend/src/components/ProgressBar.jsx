import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Brain, BookOpen, CheckCircle, AlertCircle, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

const PHASES = [
  {
    phase: 1,
    title: 'Phase 1: PDF Asset Discovery',
    description: 'Crawling target domain for PDF assets...',
    icon: Search
  },
  {
    phase: 2,
    title: 'Phase 2: Document Ingestion & OCR',
    description: 'Ingesting & OCR parsing documents found...',
    icon: FileText
  },
  {
    phase: 3,
    title: 'Phase 3: AI Analysis & Deduplication',
    description: 'AI content analysis, chunking & semantic de-duplication...',
    icon: Brain
  },
  {
    phase: 4,
    title: 'Phase 4: Master PDF Compilation',
    description: 'Compiling Master PDF and generating Table of Contents...',
    icon: BookOpen
  }
];

export default function ProgressBar({
  currentPhase = 1,
  progressPercentage = 0,
  phaseDescription = '',
  status = 'idle',
  logs = [],
  errorMessage = null
}) {
  const [showLogs, setShowLogs] = useState(false);
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const isFailed = status === 'failed';
  const isCompleted = status === 'completed';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 mb-10">
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md">
        
        {/* Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Pipeline Lifecycle
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isFailed
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-green-100 text-green-800 border border-green-300 animate-pulse'
              }`}>
                {isCompleted ? '✓ Completed' : isFailed ? '✕ Pipeline Error' : '● Processing'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-black mt-1">
              {phaseDescription || 'Pipeline Active'}
            </h3>
          </div>

          <div className="text-right flex items-center sm:block gap-3">
            <span className="text-2xl font-black text-green-700 font-mono">
              {progressPercentage}%
            </span>
            <div className="text-[11px] text-slate-500 font-medium">Overall Progress</div>
          </div>
        </div>

        {/* Dynamic Progress Bar Track */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 mb-8">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFailed
                ? 'bg-red-500'
                : isCompleted
                ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                : 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600'
            }`}
            style={{ width: `${Math.max(5, Math.min(100, progressPercentage))}%` }}
          />
        </div>

        {/* 4 Dynamic Phase Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PHASES.map((p) => {
            const Icon = p.icon;
            const isPast = currentPhase > p.phase || isCompleted;
            const isCurrent = currentPhase === p.phase && !isCompleted && !isFailed;
            const isStepFailed = isFailed && currentPhase === p.phase;

            let cardBg = 'bg-slate-50 border-slate-200 text-slate-400';
            let iconBg = 'bg-slate-100 text-slate-400';

            if (isPast) {
              cardBg = 'bg-green-50/70 border-green-200 text-slate-700';
              iconBg = 'bg-green-100 text-green-700 border border-green-200';
            } else if (isCurrent) {
              cardBg = 'bg-green-50 border-green-500 text-black ring-1 ring-green-500/30 shadow-md';
              iconBg = 'bg-green-600 text-white';
            } else if (isStepFailed) {
              cardBg = 'bg-red-50 border-red-300 text-red-900';
              iconBg = 'bg-red-100 text-red-600 border border-red-200';
            }

            return (
              <div
                key={p.phase}
                className={`relative p-3.5 rounded-xl border transition-all ${cardBg}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>
                    {isPast ? (
                      <CheckCircle className="w-4 h-4 text-green-700" />
                    ) : isStepFailed ? (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isCurrent ? 'animate-bounce text-white' : ''}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${isCurrent ? 'text-green-900' : isPast ? 'text-slate-900' : 'text-slate-500'}`}>
                      {p.title}
                    </p>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                      {p.description}
                    </p>
                  </div>
                </div>

                {isCurrent && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-600 to-transparent animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="font-bold text-red-900">Execution Error</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Live Terminal SSE Log Drawer */}
        <div className="mt-5 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center justify-between w-full text-xs font-mono text-slate-600 hover:text-black transition-colors"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-green-600" />
              <span>Real-Time Event Stream ({logs.length} events)</span>
            </div>
            {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showLogs && (
            <div
              ref={logContainerRef}
              className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Awaiting pipeline telemetry...</div>
              ) : (
                logs.map((log, i) => {
                  let badgeColor = 'text-slate-400';
                  if (log.level === 'SUCCESS') badgeColor = 'text-emerald-400 font-bold';
                  if (log.level === 'WARNING') badgeColor = 'text-amber-400 font-bold';
                  if (log.level === 'ERROR') badgeColor = 'text-red-400 font-bold';
                  if (log.level === 'INFO') badgeColor = 'text-green-400';

                  return (
                    <div key={i} className="flex items-start gap-2 leading-tight">
                      <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                      <span className={`shrink-0 ${badgeColor}`}>[{log.level}]</span>
                      <span className="text-slate-200 break-all">{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
