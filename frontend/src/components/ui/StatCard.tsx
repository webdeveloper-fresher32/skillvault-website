import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  trendPositive = true,
  className = '',
}: StatCardProps) {
  return (
    <div className={`rounded-xl border border-white/[0.08] bg-[#0f131c] p-5 flex flex-col justify-between transition-all hover:border-white/[0.14] ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 tracking-tight">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[#141a26] text-sky-400">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
        {(subtext || trend) && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
            {trend && (
              <span className={`font-semibold ${trendPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {trend}
              </span>
            )}
            {subtext && <span>{subtext}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
