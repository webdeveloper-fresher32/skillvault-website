'use client';

import React, { useState } from 'react';
import { Copy, Check, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface CodeToggleProps {
  badTitle?: string;
  badCode: string;
  badExplanation?: string;
  badLang?: string;
  goodTitle?: string;
  goodCode: string;
  goodExplanation?: string;
  goodLang?: string;
}

export default function CodeToggle({
  badTitle = 'Bad: The Smell / Fragile Approach',
  badCode,
  badExplanation,
  badLang = 'python',
  goodTitle = 'Good: The Architectural Fix',
  goodCode,
  goodExplanation,
  goodLang = 'python',
}: CodeToggleProps) {
  const [activeTab, setActiveTab] = useState<'bad' | 'good'>('bad');
  const [copied, setCopied] = useState(false);

  const activeCode = activeTab === 'bad' ? badCode : goodCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl border border-[#30363d] bg-[#101726] shadow-xl overflow-hidden">
      {/* Tab Switcher Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#182238]/90 border-b border-[#30363d] gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab('bad')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'bad'
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-rose-300 hover:bg-rose-500/10'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{badTitle}</span>
          </button>

          <button
            onClick={() => setActiveTab('good')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'good'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{goodTitle}</span>
          </button>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-[#30363d] bg-[#161b22] px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-[#21262d] transition-colors"
          aria-label="Copy Code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400 font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Surface */}
      <div className="relative bg-[#070a12] p-4 overflow-x-auto text-[13px] sm:text-sm font-mono leading-relaxed text-[#e2e8f0] max-h-[460px]">
        <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono">
          <code>{activeCode.trim()}</code>
        </pre>
      </div>

      {/* Why This Matters Callout Footer */}
      {(badExplanation || goodExplanation) && (
        <div
          className={`px-4 py-3 text-xs leading-relaxed border-t ${
            activeTab === 'bad'
              ? 'bg-rose-950/20 text-rose-200/90 border-rose-900/30'
              : 'bg-emerald-950/20 text-emerald-200/90 border-emerald-900/30'
          }`}
        >
          <strong className="font-semibold text-white mr-1.5">
            {activeTab === 'bad' ? 'Why this is fragile in production:' : 'Architectural benefits:'}
          </strong>
          <span>{activeTab === 'bad' ? badExplanation : goodExplanation}</span>
        </div>
      )}
    </div>
  );
}
