'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Network,
  Copy,
  Check,
  Sparkles,
  Terminal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  AlertTriangle,
} from 'lucide-react';

export interface MermaidViewerProps {
  chart: string;
  title?: string;
  caption?: string;
}

/**
 * Checks if a string contains Mermaid diagram syntax.
 */
export function isMermaidCode(text: string, className?: string): boolean {
  if (className && (className.includes('language-mermaid') || className.includes('mermaid'))) {
    return true;
  }
  if (!text) return false;

  const trimmed = text.trim();
  const clean = trimmed
    .replace(/^<div\s+class=["']mermaid["']>([\s\S]*?)<\/div>$/i, '$1')
    .trim();

  const mermaidKeywords = [
    'flowchart',
    'graph TD',
    'graph LR',
    'graph TB',
    'graph BT',
    'graph RL',
    'sequenceDiagram',
    'stateDiagram',
    'classDiagram',
    'erDiagram',
    'gantt',
    'pie',
    'gitGraph',
    'C4Context',
    'mindmap',
    'timeline',
    'architecture',
  ];

  for (const kw of mermaidKeywords) {
    if (clean.startsWith(kw) || clean.startsWith(kw.toLowerCase())) {
      return true;
    }
  }

  // Also check if it defines flowchart or classDef and has connections
  if (
    (clean.includes('flowchart TD') || clean.includes('flowchart LR') || clean.includes('flowchart TB')) &&
    clean.includes('-->')
  ) {
    return true;
  }

  if (clean.includes('classDef') && (clean.includes('-->') || clean.includes('subgraph'))) {
    return true;
  }

  if (clean.includes('subgraph') && clean.includes('end') && clean.includes('-->')) {
    return true;
  }

  return false;
}

/**
 * Extracts and cleans Mermaid code from potential markdown / HTML wrappers.
 */
export function extractMermaidCode(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // If wrapped in display(HTML("""...<div class="mermaid">...</div>..."""))
  const divMatch = text.match(/<div\s+class=["']mermaid["']>([\s\S]*?)<\/div>/i);
  if (divMatch) {
    text = divMatch[1].trim();
  }

  // Strip markdown code fences if wrapped
  text = text.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();

  return text;
}

export default function MermaidViewer({
  chart,
  title = 'System Architecture & Flow Diagram',
  caption,
}: MermaidViewerProps) {
  const reactId = useId();
  // Safe ID without colons for Mermaid and DOM
  const containerId = useMemo(() => `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [reactId]);
  
  const cleanChart = useMemo(() => extractMermaidCode(chart), [chart]);

  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'blueprint'>('visual');
  const [zoom, setZoom] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Render diagram via Mermaid dynamically on client
  useEffect(() => {
    let isCancelled = false;

    async function renderChart() {
      if (!cleanChart) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          flowchart: {
            curve: 'basis',
            htmlLabels: true,
            useMaxWidth: false,
            padding: 20,
            defaultRenderer: 'dagre-wrapper',
          },
          themeVariables: {
            darkMode: true,
            background: 'transparent',
            mainBkg: '#1e293b',
            nodeBorder: '#38bdf8',
            primaryColor: '#1e293b',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#38bdf8',
            lineColor: '#94a3b8',
            secondaryColor: '#0f172a',
            tertiaryColor: '#1e293b',
            clusterBkg: 'rgba(30, 41, 59, 0.45)',
            clusterBorder: '#475569',
            titleColor: '#f8fafc',
            edgeLabelBackground: '#0a0f1d',
            nodeTextColor: '#ffffff',
          },
        });

        // Generate unique render ID
        const renderId = `${containerId}-${Date.now().toString(36)}`;
        const { svg } = await mermaid.render(renderId, cleanChart);

        if (!isCancelled) {
          setSvgHtml(svg);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        console.error('Mermaid render error:', err);
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg || 'Failed to render Mermaid diagram');
          setIsLoading(false);
        }
      }
    }

    renderChart();

    return () => {
      isCancelled = true;
    };
  }, [cleanChart, containerId]);

  // Handle ESC key for fullscreen
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanChart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const zoomIn = () => setZoom(prev => Math.min(Number((prev + 0.15).toFixed(2)), 2.5));
  const zoomOut = () => setZoom(prev => Math.max(Number((prev - 0.15).toFixed(2)), 0.5));
  const resetZoom = () => setZoom(1);

  // Content body
  const renderContent = () => {
    if (activeTab === 'blueprint') {
      return (
        <div className="relative bg-[#070b14] p-4 sm:p-6 overflow-x-auto font-mono text-xs sm:text-sm text-sky-300 leading-relaxed">
          <pre className="!bg-transparent !p-0 !m-0 !border-0 whitespace-pre">
            <code>{cleanChart}</code>
          </pre>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6 bg-[#0a0f1d] border-t border-rose-500/20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-3">
            <AlertTriangle className="h-4 w-4" />
            <span>Mermaid Render Error</span>
          </div>
          <p className="text-xs text-slate-400 max-w-lg mx-auto font-mono mb-4 break-words">
            {error}
          </p>
          <div className="text-left max-w-xl mx-auto rounded-lg bg-[#050811] p-3 text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800">
            <pre>{cleanChart}</pre>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-[#0a0f1d]/50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <span className="text-xs font-mono text-slate-400">Rendering high-res Mermaid diagram...</span>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={`relative min-h-[380px] ${
          isFullscreen ? 'flex-1 max-h-none' : 'max-h-[800px]'
        } overflow-auto p-4 sm:p-8 flex flex-col items-center justify-start bg-[#070b14] transition-all scrollbar-thin scrollbar-thumb-slate-800`}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="w-full flex justify-center py-2 min-w-fit max-w-none [&_svg]:max-w-none [&_svg]:h-auto [&_svg]:drop-shadow-xl [&_.cluster_rect]:!rx-2 [&_.cluster_rect]:!fill-[rgba(30,41,59,0.45)] [&_.cluster_rect]:!stroke-[#475569] [&_.cluster_rect]:!stroke-[1.5px] [&_.node_rect]:!rx-1 [&_.edgePath_path]:!stroke-[#94a3b8] [&_.edgePath_path]:!stroke-[1.75px] [&_.edgeLabel]:!bg-[#0a0f1d] [&_.edgeLabel]:!text-[#cbd5e1] [&_.edgeLabel]:!px-1.5 [&_.edgeLabel]:!py-0.5 [&_.edgeLabel]:!rounded"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>
    );
  };

  const cardMarkup = (
    <div
      className={`rounded-2xl border border-sky-500/30 bg-[#0a0f1d] shadow-2xl overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-[#070b14]/98 backdrop-blur-xl border-sky-400/50 shadow-[0_0_50px_rgba(56,189,248,0.25)]' : 'my-6'
      }`}
    >
      {/* Top Header / Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-3 bg-gradient-to-r from-[#0d1527] to-[#0a0f1d] border-b border-slate-800 gap-2">
        {/* Left: Title & Badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 shadow-sm">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-100 tracking-wide uppercase flex items-center gap-2">
              <span>{title}</span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Mermaid Flowchart
              </span>
            </h4>
          </div>
        </div>

        {/* Center: Visual vs Blueprint Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#050811] p-1">
          <button
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              activeTab === 'visual'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3 w-3 text-sky-400" />
            <span>Visual Flow</span>
          </button>
          <button
            onClick={() => setActiveTab('blueprint')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              activeTab === 'blueprint'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="h-3 w-3" />
            <span>Blueprint</span>
          </button>
        </div>

        {/* Right: Zoom controls, Fullscreen, Copy, SVG Download */}
        <div className="flex items-center gap-1.5">
          {activeTab === 'visual' && !error && !isLoading && (
            <>
              {/* Zoom controls */}
              <div className="flex items-center rounded-lg border border-slate-800 bg-[#050811] p-0.5">
                <button
                  onClick={zoomOut}
                  disabled={zoom <= 0.5}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Zoom Out (-)"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={resetZoom}
                  className="px-1.5 py-0.5 text-[11px] font-mono text-slate-300 hover:text-sky-400 transition-colors"
                  title="Reset Zoom to 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={zoomIn}
                  disabled={zoom >= 2.5}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Zoom In (+)"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={resetZoom}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/60"
                  title="Reset Zoom"
                  aria-label="Reset Zoom"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>

              {/* Download SVG */}
              <button
                onClick={handleDownloadSvg}
                className="p-1.5 rounded-lg border border-slate-800 bg-[#050811] text-slate-400 hover:text-sky-300 hover:border-slate-700 transition-colors"
                title="Download SVG Diagram"
                aria-label="Download SVG Diagram"
              >
                <Download className="h-3.5 w-3.5" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={() => setIsFullscreen(prev => !prev)}
                className="p-1.5 rounded-lg border border-slate-800 bg-[#050811] text-slate-400 hover:text-sky-300 hover:border-slate-700 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Expand to Fullscreen'}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Expand to Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </>
          )}

          {/* Copy Mermaid Code */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#111928] px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-all shadow-sm"
            aria-label="Copy Mermaid Code"
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
      </div>

      {/* Surface Canvas */}
      <div className={isFullscreen ? 'flex-1 overflow-hidden' : ''}>
        {renderContent()}
      </div>

      {/* Optional Caption */}
      {caption && (
        <div className="px-4 py-2 bg-[#0d1424] border-t border-slate-800/80 text-center text-xs font-mono text-sky-400/80">
          ▲ {caption}
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        {/* Backdrop overlay */}
        <div 
          onClick={() => setIsFullscreen(false)} 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" 
        />
        {cardMarkup}
      </>
    );
  }

  return cardMarkup;
}
