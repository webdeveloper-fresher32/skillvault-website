import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`rounded-xl border border-dashed border-white/[0.12] bg-[#0c1018] p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#141a26] text-slate-400 mb-3.5">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
