'use client';

import React from 'react';
import { 
  FileText, 
  Settings, 
  Search, 
  Brain, 
  Database, 
  Zap, 
  MessageSquare, 
  Monitor, 
  ArrowDown, 
  Layers, 
  CheckCircle2
} from 'lucide-react';

export interface PipelineStep {
  title: string;
  subtitle?: string;
  arrowLabel?: string;
  icon?: string;
}

export interface PipelineFlowProps {
  title?: string;
  steps: PipelineStep[];
}

export function getStepIconComponent(title: string, subtitle: string = '') {
  const combined = (title + ' ' + subtitle).toLowerCase();
  if (combined.includes('document') || combined.includes('pdf') || combined.includes('file')) {
    return <FileText className="w-5 h-5 text-sky-400" />;
  }
  if (combined.includes('ingest') || combined.includes('chunk') || combined.includes('embed') || combined.includes('clean') || combined.includes('load')) {
    return <Settings className="w-5 h-5 text-amber-400" />;
  }
  if (combined.includes('retriev') || combined.includes('search') || combined.includes('rerank') || combined.includes('filter')) {
    return <Search className="w-5 h-5 text-emerald-400" />;
  }
  if (combined.includes('llm') || combined.includes('model') || combined.includes('generat') || combined.includes('context')) {
    return <Brain className="w-5 h-5 text-purple-400" />;
  }
  if (combined.includes('client') || combined.includes('user') || combined.includes('frontend') || combined.includes('browser')) {
    return <Monitor className="w-5 h-5 text-blue-400" />;
  }
  if (combined.includes('gateway') || combined.includes('auth') || combined.includes('api') || combined.includes('fastapi')) {
    return <Zap className="w-5 h-5 text-yellow-400" />;
  }
  if (combined.includes('database') || combined.includes('vector') || combined.includes('pgvector') || combined.includes('store')) {
    return <Database className="w-5 h-5 text-cyan-400" />;
  }
  if (combined.includes('response') || combined.includes('json') || combined.includes('stream') || combined.includes('answer')) {
    return <MessageSquare className="w-5 h-5 text-rose-400" />;
  }
  return <Layers className="w-5 h-5 text-sky-400" />;
}

export default function PipelineFlow({
  title = 'System Architecture Pipeline',
  steps,
}: PipelineFlowProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="my-6 rounded-2xl border border-sky-500/20 bg-gradient-to-b from-[#0e1626] to-[#070b14] p-4 sm:p-6 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400">
              Interactive end-to-end execution flow
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
          <CheckCircle2 className="h-3 w-3 text-sky-400" />
          {steps.length} Pipeline Stages
        </span>
      </div>

      {/* Steps List */}
      <div className="flex flex-col items-center">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const hasArrowPipeline = step.subtitle && (step.subtitle.includes('→') || step.subtitle.includes('──►') || step.subtitle.includes('->'));
          const subPills = hasArrowPipeline 
            ? step.subtitle!.split(/→|──►|->/).map(s => s.trim()).filter(Boolean)
            : null;

          return (
            <React.Fragment key={index}>
              {/* Step Card */}
              <div className="group relative w-full rounded-xl border border-slate-700/60 bg-[#111928] p-4 sm:p-5 shadow-lg transition-all duration-200 hover:border-sky-400/50 hover:bg-[#142033] hover:shadow-sky-500/10 hover:shadow-xl">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                  {/* Icon Badge */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#090e17] border border-slate-700/80 shadow-inner group-hover:border-sky-500/40 transition-colors">
                    {getStepIconComponent(step.title, step.subtitle)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-sky-400/80 bg-sky-950/60 border border-sky-800/40 rounded px-1.5 py-0.5">
                        Stage {index + 1}
                      </span>
                      <h5 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                        {step.title}
                      </h5>
                    </div>

                    {step.subtitle && (
                      <div className="mt-2 text-xs sm:text-sm text-slate-300">
                        {subPills && subPills.length > 1 ? (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {subPills.map((pill, pIdx) => (
                              <React.Fragment key={pIdx}>
                                <span className="inline-flex items-center rounded-md bg-[#0a0f1d] px-2 py-0.5 font-mono text-[11px] sm:text-xs text-sky-300 border border-slate-700/70">
                                  {pill}
                                </span>
                                {pIdx < subPills.length - 1 && (
                                  <span className="text-slate-500 text-xs font-bold">→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <p className="font-sans leading-relaxed text-slate-300">
                            {step.subtitle}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Connector Arrow */}
              {!isLast && (
                <div className="flex flex-col items-center my-1.5 sm:my-2">
                  <div className="h-2 w-0.5 bg-gradient-to-b from-sky-400/40 to-sky-400"></div>
                  <div className="flex items-center gap-1.5 my-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-950/80 border border-sky-500/40 text-sky-400 shadow-md">
                      <ArrowDown className="h-3.5 w-3.5 animate-pulse" />
                    </div>
                    {step.arrowLabel && (
                      <span className="text-[11px] font-mono text-amber-300/90 bg-amber-950/50 border border-amber-800/40 rounded px-2 py-0.5">
                        {step.arrowLabel}
                      </span>
                    )}
                  </div>
                  <div className="h-2 w-0.5 bg-gradient-to-b from-sky-400 to-sky-400/40"></div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
