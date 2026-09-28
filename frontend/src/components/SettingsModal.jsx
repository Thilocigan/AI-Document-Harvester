import React, { useState } from 'react';
import { X, Key, Cpu, ShieldCheck, Check, Sparkles } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  openaiKey,
  setOpenaiKey,
  geminiKey,
  setGeminiKey
}) {
  const [localOpenai, setLocalOpenai] = useState(openaiKey || '');
  const [localGemini, setLocalGemini] = useState(geminiKey || '');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setOpenaiKey(localOpenai.trim());
    setGeminiKey(localGemini.trim());
    localStorage.setItem('openai_key', localOpenai.trim());
    localStorage.setItem('gemini_key', localGemini.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-white border border-slate-300 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-green-100 text-green-700 border border-green-200">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-black">AI Engine Settings</h3>
              <p className="text-xs text-slate-500">Configure LLM providers or local synthesis</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          
          {/* Local Zero-dependency Callout */}
          <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-950 flex items-start gap-3 shadow-xs">
            <Cpu className="w-5 h-5 text-green-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-green-900 block mb-0.5">Zero-Configuration Ready:</span>
              If no API keys are provided, the platform automatically utilizes its built-in Intelligent Semantic &amp; TF-IDF NLP Synthesizer to de-duplicate content, generate executive summaries, and cluster thematic chapters.
            </div>
          </div>

          {/* OpenAI Key */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-800 flex items-center justify-between">
              <span>OpenAI API Key (Optional)</span>
              <span className="text-[10px] text-slate-500 font-mono">GPT-4o-mini</span>
            </label>
            <input
              type="password"
              value={localOpenai}
              onChange={(e) => setLocalOpenai(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-slate-300 text-black placeholder-slate-400 focus:outline-none focus:border-green-500 font-mono text-xs shadow-xs"
            />
          </div>

          {/* Gemini Key */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-800 flex items-center justify-between">
              <span>Google Gemini API Key (Optional)</span>
              <span className="text-[10px] text-slate-500 font-mono">Gemini 2.5 Flash</span>
            </label>
            <input
              type="password"
              value={localGemini}
              onChange={(e) => setLocalGemini(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-slate-300 text-black placeholder-slate-400 focus:outline-none focus:border-green-500 font-mono text-xs shadow-xs"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Keys are preserved locally in browser storage.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all shadow-md shadow-green-600/20 flex items-center gap-1.5"
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Preferences</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
