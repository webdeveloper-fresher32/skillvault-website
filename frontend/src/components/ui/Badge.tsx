import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
  ...props
}: BadgeProps) {
  const baseClasses = 'inline-flex items-center font-medium rounded-md tracking-tight transition-colors select-none';
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-2',
  }[size];

  const variantClasses = {
    default: 'bg-white/[0.05] text-slate-300 border border-white/[0.08]',
    neutral: 'bg-slate-800/60 text-slate-300 border border-slate-700/60',
    primary: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    destructive: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    outline: 'bg-transparent text-slate-400 border border-white/[0.12]',
  }[variant];

  const dotColor = {
    default: 'bg-slate-400',
    neutral: 'bg-slate-400',
    primary: 'bg-sky-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    destructive: 'bg-rose-400',
    outline: 'bg-slate-400',
  }[variant];

  return (
    <span className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`} {...props}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
      {children}
    </span>
  );
}
