'use client';

import React, { useState } from 'react';
import { Network, Copy, Check } from 'lucide-react';

export interface DiagramCardProps {
  diagramText: string;
  caption?: string;
  title?: string;
}

export default function DiagramCard({
  diagramText,
  caption,
  title = 'System Architecture & Flow Diagram',
}: DiagramCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diagramText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl border border-[#38bdf8]/25 bg-[#0f172a] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#182238] border-b border-[#30363d] gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-[#38bdf8]" />
          <span className="text-xs font-bold text-slate-100">{title}</span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded border border-[#30363d] bg-[#101726] px-2 py-0.5 text-[11px] text-slate-300 hover:text-white transition-colors"
          aria-label="Copy Diagram Text"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-slate-400" />
              <span className="text-slate-400 font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Surface */}
      <div className="bg-[#070a12] p-4 sm:p-6 overflow-x-auto text-[12px] sm:text-[13px] font-mono leading-tight text-[#38bdf8] select-all">
        <pre className="!bg-transparent !p-0 !m-0 !border-0 whitespace-pre">
          <code>{diagramText.trim()}</code>
        </pre>
      </div>

      {/* Optional Caption */}
      {caption && (
        <div className="px-4 py-2 bg-[#101726] border-t border-[#30363d] text-center text-xs text-slate-400 font-medium">
          {caption}
        </div>
      )}
    </div>
  );
}
