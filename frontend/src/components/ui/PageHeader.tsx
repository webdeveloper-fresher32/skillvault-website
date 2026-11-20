import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  badge?: React.ReactNode;
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  badge,
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className = '',
}: PageHeaderProps) {
  return (
    <section className={`border-b border-white/[0.08] bg-[#0c1017] py-8 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="mx-auto max-w-7xl">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 font-mono">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="hover:text-slate-300 transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'text-slate-300 font-medium' : ''}>{crumb.label}</span>
                  )}
                  {!isLast && <ChevronRight className="h-3 w-3 text-slate-600" />}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="max-w-3xl">
            {badge && <div className="mb-2.5">{badge}</div>}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-3 shrink-0">
              {actions}
            </div>
          )}
        </div>

        {children && <div className="mt-6 pt-6 border-t border-white/[0.06]">{children}</div>}
      </div>
    </section>
  );
}
