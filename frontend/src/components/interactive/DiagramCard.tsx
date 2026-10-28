'use client';

import React, { useMemo, useState } from 'react';
import { Network, Copy, Check, Sparkles, Terminal, ZoomIn, ZoomOut } from 'lucide-react';
import PipelineFlow, { PipelineStep } from './PipelineFlow';
import MermaidViewer, { isMermaidCode } from './MermaidViewer';

export interface DiagramCardProps {
  diagramText: string;
  caption?: string;
  title?: string;
}

export function parsePipelineSteps(text: string): PipelineStep[] | null {
  if (!text) return null;
  // Never hijack Mermaid diagrams as flat pipeline steps
  if (isMermaidCode(text)) return null;

  // Check if text has box patterns like [Stage Name]
  const stepRegex = /\[([^\]]+)\](?:\s*\n\s*\(([^)]+)\))?/g;
  const steps: PipelineStep[] = [];
  let match;

  while ((match = stepRegex.exec(text)) !== null) {
    const title = match[1].trim();
    const subtitle = match[2]?.trim() || '';
    if (title && !title.includes('──') && !title.includes('│')) {
      steps.push({ title, subtitle });
    }
  }

  // Detect downward arrows or pipeline connectors
  const hasFlowArrows = text.includes('▼') || text.includes('──►') || text.includes('-->') || text.includes('──>') || text.includes('│');
  
  // Require at least 2 clean steps and arrows
  if (steps.length >= 2 && hasFlowArrows) {
    return steps;
  }

  return null;
}

export default function DiagramCard({
  diagramText,
  caption,
  title = 'System Architecture & Flow Diagram',
}: DiagramCardProps) {
  const isMermaid = useMemo(() => isMermaidCode(diagramText), [diagramText]);
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState<number>(13);

  const pipelineSteps = useMemo(() => {
    return parsePipelineSteps(diagramText);
  }, [diagramText]);

  const [activeTab, setActiveTab] = useState<'visual' | 'blueprint'>(
    pipelineSteps ? 'visual' : 'blueprint'
  );

  // If diagram is Mermaid syntax, render rich interactive Mermaid diagram
  if (isMermaid) {
    return <MermaidViewer chart={diagramText} title={title} caption={caption} />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(diagramText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If parsed as pipeline steps and visual tab is active, render interactive PipelineFlow
  if (pipelineSteps && activeTab === 'visual') {
    return (
      <div className="my-6">
        {/* Toggle bar between Visual and Blueprint */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0c1220] p-1">
            <button
              onClick={() => setActiveTab('visual')}
              className="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>Visual Flow</span>
            </button>
            <button
              onClick={() => setActiveTab('blueprint')}
              className="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Blueprint</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#111928] px-2.5 py-1 text-xs text-slate-300 hover:text-white transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-sans">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-400 font-sans">Copy</span>
              </>
            )}
          </button>
        </div>

        <PipelineFlow title={title} steps={pipelineSteps} />

        {caption && (
          <div className="mt-2 text-center text-xs font-mono text-slate-400">
            ▲ {caption}
          </div>
        )}
      </div>
    );
  }

  // Blueprint / ASCII View
  return (
    <div className="my-6 rounded-2xl border border-sky-500/25 bg-[#0a0f1d] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111928] border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          {pipelineSteps ? (
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0a0e1a] p-0.5">
              <button
                onClick={() => setActiveTab('visual')}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                <span>Visual Flow</span>
              </button>
              <button
                onClick={() => setActiveTab('blueprint')}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30"
              >
                <Terminal className="h-3 w-3 text-sky-400" />
                <span>Blueprint</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-bold text-slate-100">{title}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 rounded border border-slate-800 bg-[#090d17] px-1 py-0.5">
            <button
              onClick={() => setFontSize(prev => Math.max(11, prev - 1))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom out"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-400 px-1">{fontSize}px</span>
            <button
              onClick={() => setFontSize(prev => Math.min(16, prev + 1))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom in"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded border border-slate-700 bg-[#162033] px-2.5 py-1 text-[11px] text-slate-300 hover:text-white transition-colors"
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
      </div>

      {/* Surface */}
      <div className="bg-[#050811] p-4 sm:p-6 overflow-x-auto font-mono leading-tight text-sky-400 select-all border-y border-slate-900 shadow-inner">
        <pre 
          style={{ fontSize: `${fontSize}px` }}
          className="!bg-transparent !p-0 !m-0 !border-0 whitespace-pre"
        >
          <code>{diagramText.trim()}</code>
        </pre>
      </div>

      {/* Optional Caption */}
      {caption && (
        <div className="px-4 py-2 bg-[#0e1626] border-t border-slate-800 text-center text-xs text-slate-400 font-medium">
          {caption}
        </div>
      )}
    </div>
  );
}
