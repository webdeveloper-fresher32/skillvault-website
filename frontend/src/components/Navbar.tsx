'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Terminal, BookOpen, CheckCircle2, Bookmark, Flame, Zap, Layers, HelpCircle } from 'lucide-react';
import SearchModal from './SearchModal';

export default function Navbar() {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Sync back whenever the real router transition commits
  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const currentPath = optimisticPath ?? pathname;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { label: 'Dashboard', href: '/', icon: Terminal },
    { label: 'Courses', href: '/courses', icon: BookOpen },
    { label: 'Practice & Quizzes', href: '/practice', icon: Zap },
    { label: 'Revision & Cards', href: '/revision', icon: Bookmark },
    { label: 'Roadmaps', href: '/roadmaps', icon: Layers },
  ];

  const isNavActive = (href: string) => {
    if (href === '/') {
      return currentPath === '/';
    }
    return currentPath === href || currentPath.startsWith(href + '/') || currentPath.startsWith(href + '?');
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090d16]/90 backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              prefetch={true}
              onClick={() => setOptimisticPath('/')}
              onMouseDown={() => setOptimisticPath('/')}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Terminal className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  SkillVault
                </span>
                <span className="ml-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                  DEV OS
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => setOptimisticPath(item.href)}
                    onMouseDown={() => setOptimisticPath(item.href)}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium border focus:outline-none transition-colors duration-75 select-none ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border-blue-500/20 shadow-sm'
                        : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`h-4 w-4 transition-colors duration-75 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Search Bar */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-300 transition-colors shadow-inner focus:outline-none"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search courses, lessons, code...</span>
              <kbd className="hidden sm:inline rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
                /
              </kbd>
            </button>

            {/* Daily Streak Indicator */}
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
              <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>7 Day Streak</span>
            </div>

            {/* Profile Avatar */}
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 text-sm font-bold text-white shadow-sm">
              GP
            </div>
          </div>
        </div>
      </header>

      {isSearchOpen && <SearchModal onClose={() => setIsSearchOpen(false)} />}
    </>
  );
}
