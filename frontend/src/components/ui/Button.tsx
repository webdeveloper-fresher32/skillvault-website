import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'sm',
  isLoading = false,
  leftIcon,
  rightIcon,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const trailingIcon = rightIcon || icon;
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none';

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-xs gap-1.5',
    sm: 'px-3.5 py-1.5 text-xs gap-2',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  }[size];

  const variantClasses = {
    primary: 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs border border-sky-500/40',
    secondary: 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]',
    outline: 'bg-transparent hover:bg-white/[0.05] text-slate-300 border border-white/[0.12]',
    ghost: 'bg-transparent hover:bg-white/[0.06] text-slate-400 hover:text-slate-200',
    danger: 'bg-rose-600/90 hover:bg-rose-500 text-white border border-rose-500/40',
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        leftIcon
      )}
      {children && <span>{children}</span>}
      {!isLoading && trailingIcon}
    </button>
  );
}
