'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Terminal, BookOpen, CheckCircle2, Bookmark, Zap, Layers, HelpCircle, LogIn, LogOut, ChevronDown, UserCircle } from 'lucide-react';
import SearchModal from './SearchModal';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);


  const navItems = [
    { label: 'Dashboard', href: '/', icon: Terminal },
    { label: 'Courses', href: '/courses', icon: BookOpen },
    { label: 'Interview Q&A', href: '/interview', icon: HelpCircle },
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
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#06080e]/90 backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              prefetch={true}
              onClick={() => setOptimisticPath('/')}
              onMouseDown={() => setOptimisticPath('/')}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] bg-[#0c1019] overflow-hidden group-hover:border-sky-500/40 transition-colors"
              >
                <Image
                  src="/icon.png"
                  alt="SkillVault Logo"
                  width={36}
                  height={36}
                  className="h-full w-full object-contain"
                  priority
                />
              </motion.div>
              <div className="flex items-center">
                <span className="text-lg font-bold tracking-tight text-white">
                  SkillVault
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
                    className={`relative flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none transition-colors select-none ${
                      isActive
                        ? 'text-sky-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="navbar-active-pill"
                        className="absolute inset-0 rounded-md bg-sky-500/15 border border-sky-500/30 shadow-xs"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Icon className={`relative z-10 h-3.5 w-3.5 transition-colors ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Search Bar */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-[#0c1019] px-3 py-1.5 text-xs text-slate-400 hover:border-white/[0.16] hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline text-xs">Search knowledge base...</span>
              <kbd className="hidden sm:inline rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-white/[0.08]">
                /
              </kbd>
            </motion.button>

            {/* Authentication: Sign In or User Profile */}
            {!isAuthenticated ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all focus:outline-none cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </motion.button>
            ) : (
              <div className="relative" ref={profileMenuRef}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0c1019] px-2.5 py-1 hover:border-white/[0.16] transition-colors focus:outline-none cursor-pointer"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-sky-500/15 border border-sky-500/30 text-xs font-bold text-sky-400">
                    {(() => {
                      const name = user?.fullName || user?.username || 'U';
                      const parts = name.trim().split(/\s+/);
                      return parts.length >= 2
                        ? (parts[0][0] + parts[1][0]).toUpperCase()
                        : name.slice(0, 2).toUpperCase();
                    })()}
                  </div>
                  <span className="hidden sm:inline text-xs font-medium text-slate-200 max-w-[110px] truncate">
                    {user?.fullName || user?.username}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </motion.button>

                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -6 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2 w-56 rounded-xl border border-white/[0.12] bg-[#0c1019] p-1.5 shadow-2xl z-50 origin-top-right"
                    >
                      <div className="border-b border-white/[0.06] px-3 py-2.5 mb-1">
                        <p className="text-xs font-semibold text-white truncate">{user?.fullName || user?.username}</p>
                        <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400 border border-sky-500/20">
                            {user?.role}
                          </span>
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Session Active
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </header>


      {isSearchOpen && <SearchModal onClose={() => setIsSearchOpen(false)} />}
    </>
  );
}
