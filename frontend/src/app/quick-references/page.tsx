'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Search,
  CheckCircle2,
  Zap,
  Clock,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  RotateCcw,
  Star,
  AlertTriangle,
  Sparkles,
  Layers,
  Code2,
  Menu,
  X,
  TrendingUp
} from 'lucide-react';
import {
  allQuickReferenceTopics,
  categorySummaries,
  getTopicById,
  getAdjacentTopics,
  QuickReferenceTopic
} from '@/data/quick-references';
import {
  loadRevisionState,
  saveRevisionState,
  needsRevision,
  formatLastRevised,
  RevisionState,
  DEFAULT_REVISION_STATE
} from '@/lib/revisionTracker';

type FilterType = 'all' | 'needs-revision' | 'bookmarked' | 'revised';
type ModuleFilter = 'all' | 'javascript' | 'nodejs' | 'async' | 'express';

function QuickReferencesContent() {
  const searchParams = useSearchParams();
  const urlTopic = searchParams.get('topic');
  const validUrlTopic = urlTopic && getTopicById(urlTopic) ? urlTopic : null;

  // Selected topic state (pure derived state, avoiding cascading effect renders)
  const [internalTopicId, setInternalTopicId] = useState<string | null>(null);
  const selectedTopicId = internalTopicId ?? validUrlTopic ?? allQuickReferenceTopics[0].id;
  const setSelectedTopicId = (id: string) => setInternalTopicId(id);
  
  // Module Filter: 'all' | 'javascript' | 'nodejs'
  const [selectedModule, setSelectedModule] = useState<ModuleFilter>('all');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // Revision & Bookmark state: lazy initialize from localStorage
  const [revisionState, setRevisionState] = useState<RevisionState>(() => {
    if (typeof window !== 'undefined') {
      return loadRevisionState();
    }
    return DEFAULT_REVISION_STATE;
  });
  
  // UI preferences
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  
  // Expanded category accordions in sidebar
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'fundamentals': true,
    'functions-oop': true,
    'objects-data': true,
    'functional': true,
    'error-modules': true,
    'nodejs-fundamentals': true,
    'event-loop-async': true,
    'concurrency-parallelism': true,
    'data-handling-core': true,
    'memory-performance': true,
    'async-fundamentals': true,
    'promises-async': true,
    'promise-combinators': true,
    'async-error-handling-cat': true,
    'concurrency-control': true,
    'advanced-async-problems': true,
    'cancellation-resilience': true,
    'express-fundamentals': true,
    'express-middleware-lifecycle': true,
    'express-architecture-patterns': true,
    'express-validation-files': true,
    'express-security-state': true,
    'express-rest-api': true,
    'express-production-lifecycle': true
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync state changes to localStorage
  const updateRevisionState = useCallback((updater: (prev: RevisionState) => RevisionState) => {
    setRevisionState((prev) => {
      const next = updater(prev);
      saveRevisionState(next);
      return next;
    });
  }, []);

  // Toggle mark as revised today
  const toggleMarkRevised = useCallback((topicId: string) => {
    updateRevisionState((prev: RevisionState) => {
      const isAlreadyRevised = prev.revisedTopicIds.includes(topicId);
      const newRevisedIds = isAlreadyRevised
        ? prev.revisedTopicIds.filter((id: string) => id !== topicId)
        : [...prev.revisedTopicIds, topicId];

      const newTimestamps = { ...prev.lastRevisedTimestamps };
      if (!isAlreadyRevised) {
        newTimestamps[topicId] = Date.now();
      } else {
        delete newTimestamps[topicId];
      }

      return {
        ...prev,
        revisedTopicIds: newRevisedIds,
        lastRevisedTimestamps: newTimestamps
      };
    });
  }, [updateRevisionState]);

  // Toggle bookmark / difficult topic
  const toggleBookmark = useCallback((topicId: string) => {
    updateRevisionState((prev: RevisionState) => {
      const isBookmarked = prev.bookmarkedTopicIds.includes(topicId);
      return {
        ...prev,
        bookmarkedTopicIds: isBookmarked
          ? prev.bookmarkedTopicIds.filter((id: string) => id !== topicId)
          : [...prev.bookmarkedTopicIds, topicId]
      };
    });
  }, [updateRevisionState]);

  // Reset all revision progress
  const handleResetProgress = () => {
    if (window.confirm('Are you sure you want to reset all revision marks? Your bookmarks will be kept.')) {
      updateRevisionState((prev: RevisionState) => ({
        ...prev,
        revisedTopicIds: [],
        lastRevisedTimestamps: {}
      }));
    }
  };

  // Mark all topics in current module as revised today
  const handleMarkAllRevised = () => {
    const targetTopics = selectedModule === 'all'
      ? allQuickReferenceTopics
      : allQuickReferenceTopics.filter(t => t.sectionSlug === selectedModule);

    if (window.confirm(`Mark all ${targetTopics.length} topics in this section as revised today?`)) {
      const now = Date.now();
      const newIds = new Set([...revisionState.revisedTopicIds, ...targetTopics.map(t => t.id)]);
      const newTimestamps = { ...revisionState.lastRevisedTimestamps };
      targetTopics.forEach((t) => {
        newTimestamps[t.id] = now;
      });
      updateRevisionState((prev: RevisionState) => ({
        ...prev,
        revisedTopicIds: Array.from(newIds),
        lastRevisedTimestamps: newTimestamps
      }));
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in search
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsQuickMode((prev: boolean) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleMarkRevised(selectedTopicId);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toggleBookmark(selectedTopicId);
      } else if (e.key === 'j' || e.key === 'ArrowRight' || e.key === ']') {
        const { next } = getAdjacentTopics(selectedTopicId, selectedModule);
        if (next) setSelectedTopicId(next.id);
      } else if (e.key === 'k' || e.key === 'ArrowLeft' || e.key === '[') {
        const { prev } = getAdjacentTopics(selectedTopicId, selectedModule);
        if (prev) setSelectedTopicId(prev.id);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTopicId, selectedModule, toggleMarkRevised, toggleBookmark]);

  // Current active topic
  const currentTopic: QuickReferenceTopic = useMemo(() => {
    return getTopicById(selectedTopicId) || allQuickReferenceTopics[0];
  }, [selectedTopicId]);

  // Adjacent navigation topics
  const { prev: prevTopic, next: nextTopic } = useMemo(() => {
    return getAdjacentTopics(currentTopic.id, selectedModule);
  }, [currentTopic.id, selectedModule]);

  // Active module scope
  const scopedTopics = useMemo(() => {
    if (selectedModule === 'all') return allQuickReferenceTopics;
    return allQuickReferenceTopics.filter(t => t.sectionSlug === selectedModule);
  }, [selectedModule]);

  // Revision Stats (scoped to current module selection)
  const stats = useMemo(() => {
    const total = scopedTopics.length;
    const revisedIds = new Set(revisionState.revisedTopicIds);
    const bookmarkedIds = new Set(revisionState.bookmarkedTopicIds);
    
    let needsRevCount = 0;
    let revisedCount = 0;
    let bookmarkedCount = 0;

    scopedTopics.forEach((t) => {
      const ts = revisionState.lastRevisedTimestamps[t.id];
      if (needsRevision(ts)) {
        needsRevCount++;
      }
      if (revisedIds.has(t.id)) {
        revisedCount++;
      }
      if (bookmarkedIds.has(t.id)) {
        bookmarkedCount++;
      }
    });

    const percentage = total > 0 ? Math.round((revisedCount / total) * 100) : 0;

    return {
      total,
      revisedCount,
      needsRevCount,
      bookmarkedCount,
      percentage
    };
  }, [scopedTopics, revisionState]);

  // Filtered topics based on module, search & active filter
  const filteredTopics = useMemo(() => {
    return scopedTopics.filter((topic) => {
      // 1. Filter condition
      const ts = revisionState.lastRevisedTimestamps[topic.id];
      const isRev = revisionState.revisedTopicIds.includes(topic.id);
      const isBookmarked = revisionState.bookmarkedTopicIds.includes(topic.id);
      const isNeedRev = needsRevision(ts);

      if (activeFilter === 'needs-revision' && !isNeedRev) return false;
      if (activeFilter === 'bookmarked' && !isBookmarked) return false;
      if (activeFilter === 'revised' && !isRev) return false;

      // 2. Search query condition
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        topic.title.toLowerCase().includes(q) ||
        topic.category.toLowerCase().includes(q) ||
        topic.concept30Sec.toLowerCase().includes(q) ||
        topic.quickRevision.oneLineDefinition.toLowerCase().includes(q) ||
        topic.interviewPrep.questions.some(
          (item) => item.question.toLowerCase().includes(q) || item.spokenAnswer.toLowerCase().includes(q)
        )
      );
    });
  }, [scopedTopics, searchQuery, activeFilter, revisionState]);

  // Filtered category summaries based on selected module
  const activeCategorySummaries = useMemo(() => {
    if (selectedModule === 'all') return categorySummaries;
    return categorySummaries.filter(c => c.sectionSlug === selectedModule);
  }, [selectedModule]);

  // Copy code helper
  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const isCurrentRevised = revisionState.revisedTopicIds.includes(currentTopic.id);
  const isCurrentBookmarked = revisionState.bookmarkedTopicIds.includes(currentTopic.id);
  const currentTimestamp = revisionState.lastRevisedTimestamps[currentTopic.id];
  const currentRevisedStatus = formatLastRevised(currentTimestamp);

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex flex-col selection:bg-sky-500/25 selection:text-sky-200">
      {/* Top Header / Cadence Banner */}
      <section className="border-b border-white/[0.08] bg-[#0c1019]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-600/30 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  JavaScript & Node.js Quick References
                </h1>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                  Senior Engineering Revision
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                91 Topics across 4 Modules • JS Core (25), Node.js Internals (24), Async (19) & Express.js (23) • ~5 mins/topic
              </p>
            </div>
          </div>

          {/* Quick Revision Tracker Progress Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-[#080b12] border border-white/[0.08] px-3.5 py-2 rounded-xl">
            <div className="flex flex-col gap-1 min-w-[140px]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Cadence Progress</span>
                <span className="text-sky-400 font-semibold">{stats.percentage}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <strong className="text-white">{stats.revisedCount}</strong>/{stats.total} Done
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <strong>{stats.needsRevCount}</strong> Need Rev.
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <strong>{stats.bookmarkedCount}</strong> Hard
              </span>
            </div>

            {/* Quick Revision Mode Toggle Button */}
            <button
              onClick={() => setIsQuickMode(!isQuickMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                isQuickMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                  : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:text-slate-200 hover:bg-white/[0.08]'
              }`}
              title="Toggle Quick Mode: displays only 30-sec definition, code, output & interview answers"
            >
              <Zap className={`h-3.5 w-3.5 ${isQuickMode ? 'text-amber-400 fill-amber-400' : ''}`} />
              <span className="font-semibold">{isQuickMode ? 'Quick Mode ON' : 'Quick Mode'}</span>
              <kbd className="hidden md:inline rounded bg-white/[0.1] px-1 py-0.2 text-[9px] font-mono text-slate-300">
                Q
              </kbd>
            </button>
          </div>
        </div>
      </section>

      {/* Main App Layout: 2 Columns (Sidebar + Content) */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex relative">
        {/* Mobile Sidebar Toggle Button */}
        <div className="md:hidden fixed bottom-5 right-5 z-40">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center gap-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white px-4 py-3 shadow-2xl border border-sky-400/40 transition-transform active:scale-95 cursor-pointer font-medium text-xs"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span>{isMobileMenuOpen ? 'Close Menu' : `Topics (${stats.total})`}</span>
          </button>
        </div>

        {/* Sidebar: Navigation & Filters */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-80 sm:w-88 bg-[#080b12] border-r border-white/[0.08] p-4 flex flex-col transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ top: 'auto' }}
        >
          {/* Module Switcher: All | JavaScript | Node.js | Async | Express */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-1 bg-[#0c1019] border border-white/[0.08] rounded-lg mb-3">
            <button
              onClick={() => setSelectedModule('all')}
              className={`py-1 text-[11px] font-semibold rounded-md transition-all text-center cursor-pointer ${
                selectedModule === 'all'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All (91)
            </button>
            <button
              onClick={() => setSelectedModule('javascript')}
              className={`py-1 text-[11px] font-semibold rounded-md transition-all text-center cursor-pointer ${
                selectedModule === 'javascript'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              JS Core (25)
            </button>
            <button
              onClick={() => setSelectedModule('nodejs')}
              className={`py-1 text-[11px] font-semibold rounded-md transition-all text-center cursor-pointer ${
                selectedModule === 'nodejs'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Node.js (24)
            </button>
            <button
              onClick={() => setSelectedModule('async')}
              className={`py-1 text-[11px] font-semibold rounded-md transition-all text-center cursor-pointer ${
                selectedModule === 'async'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Async (19)
            </button>
            <button
              onClick={() => setSelectedModule('express')}
              className={`py-1 text-[11px] font-semibold rounded-md transition-all text-center cursor-pointer ${
                selectedModule === 'express'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Express (23)
            </button>
          </div>

          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${scopedTopics.length} topics... (/)`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-[#0c1019] pl-9 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="grid grid-cols-2 gap-1 mb-3">
            <button
              onClick={() => setActiveFilter('all')}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-left truncate cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              All in Scope ({scopedTopics.length})
            </button>
            <button
              onClick={() => setActiveFilter('needs-revision')}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-left truncate flex items-center gap-1 cursor-pointer ${
                activeFilter === 'needs-revision'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
              <span>Needs Rev ({stats.needsRevCount})</span>
            </button>
            <button
              onClick={() => setActiveFilter('bookmarked')}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-left truncate flex items-center gap-1 cursor-pointer ${
                activeFilter === 'bookmarked'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
              <span>Hard ({stats.bookmarkedCount})</span>
            </button>
            <button
              onClick={() => setActiveFilter('revised')}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-left truncate flex items-center gap-1 cursor-pointer ${
                activeFilter === 'revised'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
              <span>Revised ({stats.revisedCount})</span>
            </button>
          </div>

          {/* Topics List Grouped by Category */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {activeCategorySummaries.map((cat) => {
              const categoryTopics = filteredTopics.filter((t) => t.categorySlug === cat.slug);
              if (categoryTopics.length === 0) return null;

              const isExpanded = expandedCategories[cat.slug] ?? true;

              return (
                <div key={cat.slug} className="rounded-lg border border-white/[0.04] bg-[#0c1019]/50 overflow-hidden">
                  <button
                    onClick={() =>
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [cat.slug]: !isExpanded
                      }))
                    }
                    className="w-full flex items-center justify-between px-2.5 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        cat.sectionSlug === 'nodejs'
                          ? 'bg-emerald-400'
                          : cat.sectionSlug === 'async'
                          ? 'bg-purple-400'
                          : cat.sectionSlug === 'express'
                          ? 'bg-cyan-400'
                          : 'bg-amber-400'
                      }`} />
                      <span className="text-[11px] font-semibold text-slate-300 truncate tracking-wide">
                        {cat.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 shrink-0">
                      <span>{categoryTopics.length}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-1 space-y-0.5">
                      {categoryTopics.map((topic) => {
                        const isSelected = topic.id === selectedTopicId;
                        const isRev = revisionState.revisedTopicIds.includes(topic.id);
                        const isHard = revisionState.bookmarkedTopicIds.includes(topic.id);
                        const ts = revisionState.lastRevisedTimestamps[topic.id];
                        const overdue = needsRevision(ts);

                        return (
                          <div
                            key={topic.id}
                            onClick={() => {
                              setSelectedTopicId(topic.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`group relative flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-sky-500/20 text-white font-semibold border border-sky-500/40 shadow-xs'
                                : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span
                                className={`text-[10px] font-mono rounded px-1 py-0.2 ${
                                  isSelected
                                    ? 'bg-sky-500 text-white font-bold'
                                    : 'bg-white/[0.06] text-slate-400 group-hover:text-slate-200'
                                }`}
                              >
                                {topic.number}
                              </span>
                              <span className="truncate">{topic.title}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Star bookmark toggle */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBookmark(topic.id);
                                }}
                                className="p-0.5 hover:scale-110 transition-transform"
                                title={isHard ? 'Bookmarked as difficult' : 'Mark as difficult'}
                              >
                                <Star
                                  className={`h-3 w-3 ${
                                    isHard
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-slate-600 hover:text-slate-400'
                                  }`}
                                />
                              </button>

                              {/* Revision status icon */}
                              {isRev ? (
                                <span title="Revised this week">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                </span>
                              ) : overdue ? (
                                <span title="Needs revision (> 3 days or never)">
                                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block animate-pulse" />
                                </span>
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-600 inline-block" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTopics.length === 0 && (
              <div className="text-center py-8 px-4 text-xs text-slate-500">
                <Search className="h-5 w-5 mx-auto mb-2 text-slate-600" />
                No topics matching current search or filter.
              </div>
            )}
          </div>

          {/* Sidebar Footer Controls */}
          <div className="mt-auto pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
            <button
              onClick={handleMarkAllRevised}
              className="hover:text-sky-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Check className="h-3 w-3 text-sky-400" />
              <span>Mark Section Done</span>
            </button>
            <button
              onClick={handleResetProgress}
              className="hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3 text-slate-500" />
              <span>Reset Marks</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area: Topic Revision Reader */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Topic Hero Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c1019] p-5 sm:p-7 shadow-xl mb-6 relative overflow-hidden">
            <div className={`absolute top-0 right-0 h-40 w-40 rounded-full blur-3xl pointer-events-none ${
              currentTopic.sectionSlug === 'nodejs'
                ? 'bg-emerald-500/5'
                : currentTopic.sectionSlug === 'async'
                ? 'bg-purple-500/5'
                : currentTopic.sectionSlug === 'express'
                ? 'bg-cyan-500/5'
                : 'bg-sky-500/5'
            }`} />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Module Pill */}
                <span className={`rounded border px-2 py-0.5 font-semibold ${
                  currentTopic.sectionSlug === 'nodejs'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : currentTopic.sectionSlug === 'async'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                    : currentTopic.sectionSlug === 'express'
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  {currentTopic.section || (
                    currentTopic.sectionSlug === 'nodejs'
                      ? 'Node.js Internals'
                      : currentTopic.sectionSlug === 'async'
                      ? 'Async Programming'
                      : currentTopic.sectionSlug === 'express'
                      ? 'Express.js'
                      : 'JavaScript Core'
                  )}
                </span>

                <span className="rounded bg-sky-500/10 border border-sky-500/25 px-2 py-0.5 font-semibold text-sky-400">
                  Topic #{currentTopic.number}
                </span>

                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-medium">{currentTopic.category}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-500" />
                  ~{currentTopic.estimatedMinutes} min read
                </span>
              </div>

              {/* Action Buttons: Mark Revised & Bookmark */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleBookmark(currentTopic.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    isCurrentBookmarked
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:text-slate-200'
                  }`}
                  title="Bookmark difficult topic for extra revision"
                >
                  <Star className={`h-3.5 w-3.5 ${isCurrentBookmarked ? 'text-amber-400 fill-amber-400' : ''}`} />
                  <span>{isCurrentBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                  <kbd className="hidden lg:inline text-[9px] text-slate-500 font-mono">B</kbd>
                </button>

                <button
                  onClick={() => toggleMarkRevised(currentTopic.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-xs cursor-pointer ${
                    isCurrentRevised
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-sky-600 hover:bg-sky-500 text-white border-transparent'
                  }`}
                  title="Toggle revision status"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isCurrentRevised ? 'Revised Today' : 'Mark as Revised'}</span>
                  <kbd className="hidden lg:inline text-[9px] text-white/70 font-mono">R</kbd>
                </button>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              {currentTopic.title}
            </h2>

            {/* Revision status tag */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                  currentRevisedStatus.status === 'today'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : currentRevisedStatus.status === 'recent'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    currentRevisedStatus.status === 'today'
                      ? 'bg-emerald-400'
                      : currentRevisedStatus.status === 'recent'
                      ? 'bg-sky-400'
                      : 'bg-amber-400'
                  }`}
                />
                {currentRevisedStatus.text}
              </span>

              <span className="text-slate-500">|</span>
              <span className="text-slate-400 text-[11px] font-mono">
                {currentTopic.quickRevision.oneLineDefinition}
              </span>
            </div>
          </div>

          {/* Quick Revision Mode Indicator Banner */}
          {isQuickMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-6 flex items-center justify-between text-xs text-amber-200"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
                <span>
                  <strong>Quick Revision Mode Active:</strong> Streamlined view showing only 30-sec definition, code, output & spoken interview answers for rapid 5-minute review.
                </span>
              </div>
              <button
                onClick={() => setIsQuickMode(false)}
                className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 ml-3 shrink-0 cursor-pointer"
              >
                Exit Quick Mode
              </button>
            </motion.div>
          )}

          {/* SECTION A: Concept in 30 Seconds */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1019] p-5 mb-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/20 text-sky-400 text-xs font-bold">
                A
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400">
                Concept in 30 Seconds
              </h3>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-normal">
              {currentTopic.concept30Sec}
            </p>
          </section>

          {/* Comparison Table (if topic includes one) */}
          {currentTopic.comparisonTable && (
            <section className="rounded-xl border border-white/[0.08] bg-[#0c1019] p-5 mb-5 overflow-x-auto shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Side-by-Side Comparison
                </h3>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.1] bg-white/[0.02]">
                    {currentTopic.comparisonTable.headers.map((h, i) => (
                      <th key={i} className="py-2 px-3 font-semibold text-slate-300">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {currentTopic.comparisonTable.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`py-2 px-3 text-slate-300 ${
                            cIdx === 0 ? 'font-semibold text-sky-300' : ''
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* SECTION B: How It Works Internally (Hidden in Quick Mode for Speed) */}
          {!isQuickMode && (
            <section className="rounded-xl border border-white/[0.08] bg-[#0c1019] p-5 mb-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/20 text-sky-400 text-xs font-bold">
                  B
                </span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400">
                  Internal Working & Architecture
                </h3>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                {currentTopic.internals.overview}
              </p>

              {/* Execution Flow Steps */}
              {currentTopic.internals.flowSteps && currentTopic.internals.flowSteps.length > 0 && (
                <div className="mb-4 bg-[#080b12] rounded-lg border border-white/[0.06] p-3.5">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
                    Internal Execution Sequence
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentTopic.internals.flowSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="h-4 w-4 rounded-full bg-sky-500/20 text-sky-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Memory / Execution Diagram */}
              {currentTopic.internals.diagram && (
                <div className="rounded-lg bg-[#06080e] border border-white/[0.08] p-3.5 overflow-x-auto">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    Component Architecture & Execution Flow
                  </div>
                  <pre className="font-mono text-xs text-sky-300/90 whitespace-pre leading-snug">
                    {currentTopic.internals.diagram}
                  </pre>
                </div>
              )}
            </section>
          )}

          {/* SECTION C: Practical Code Example */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1019] p-5 mb-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/20 text-sky-400 text-xs font-bold">
                  C
                </span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400">
                  Practical Code Example
                </h3>
              </div>
              <button
                onClick={() => handleCopyCode(currentTopic.codeExample.code, 'main-code')}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors bg-white/[0.04] px-2.5 py-1 rounded-md border border-white/[0.06] cursor-pointer"
              >
                {copiedCodeId === 'main-code' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Block */}
            <div className="rounded-lg bg-[#06080e] border border-white/[0.08] overflow-hidden mb-3">
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-mono text-slate-400">
                <span>node-example.js</span>
                <span>Node.js / JavaScript</span>
              </div>
              <pre className="p-4 font-mono text-xs text-emerald-300/90 overflow-x-auto leading-relaxed">
                <code>{currentTopic.codeExample.code}</code>
              </pre>
            </div>

            {/* Code Annotations */}
            {currentTopic.codeExample.annotations && currentTopic.codeExample.annotations.length > 0 && (
              <div className="mb-3 space-y-1">
                {currentTopic.codeExample.annotations.map((ann, i) => (
                  <p key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                    <span className="text-sky-400 font-mono font-bold">•</span>
                    <span>{ann}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Expected Output Box */}
            <div className="rounded-lg bg-[#080b12] border border-white/[0.06] p-3 mb-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                Expected Console Output
              </div>
              <pre className="font-mono text-xs text-slate-200 whitespace-pre">
                {currentTopic.codeExample.output}
              </pre>
            </div>

            {/* Why Output Occurs */}
            <div className="text-xs text-slate-300 leading-relaxed bg-sky-500/5 border border-sky-500/20 rounded-lg p-3">
              <strong className="text-sky-300">Why this output occurs: </strong>
              {currentTopic.codeExample.whyOutput}
            </div>
          </section>

          {/* SECTION D: Real-World Node.js Application (Hidden in Quick Mode) */}
          {!isQuickMode && (
            <section className="rounded-xl border border-white/[0.08] bg-[#0c1019] p-5 mb-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                  D
                </span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                  Real-World Backend Scenario
                </h3>
              </div>

              <h4 className="text-xs font-bold text-slate-200 mb-1.5">
                {currentTopic.nodeJsApplication.scenario}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {currentTopic.nodeJsApplication.description}
              </p>

              {currentTopic.nodeJsApplication.codeSnippet && (
                <div className="rounded-lg bg-[#06080e] border border-white/[0.08] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1 bg-white/[0.02] border-b border-white/[0.04] text-[10px] font-mono text-slate-500">
                    <span>backend-production-pattern.js</span>
                    <button
                      onClick={() =>
                        handleCopyCode(currentTopic.nodeJsApplication.codeSnippet!, 'node-code')
                      }
                      className="hover:text-slate-300 cursor-pointer"
                    >
                      {copiedCodeId === 'node-code' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-3 font-mono text-xs text-sky-200/90 overflow-x-auto leading-relaxed">
                    <code>{currentTopic.nodeJsApplication.codeSnippet}</code>
                  </pre>
                </div>
              )}
            </section>
          )}

          {/* SECTION E: Interview Preparation */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1019] p-5 mb-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-amber-400 text-xs font-bold">
                E
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                Senior Interview Preparation & What to Say
              </h3>
            </div>

            {/* Spoken Q&As */}
            <div className="space-y-4 mb-4">
              {currentTopic.interviewPrep.questions.map((q, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-[#080b12] border border-white/[0.06] p-3.5 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      Q{idx + 1}
                    </span>
                    <h4 className="text-xs font-semibold text-white leading-snug">{q.question}</h4>
                  </div>

                  <div className="pl-7 border-l-2 border-emerald-500/40 ml-2 py-0.5">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-0.5">
                      What to Speak in Interview:
                    </div>
                    <p className="text-xs text-slate-200 italic leading-relaxed">
                      &quot;{q.spokenAnswer}&quot;
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tricky Follow-up Question */}
            <div className="rounded-lg bg-rose-500/5 border border-rose-500/25 p-3.5 mb-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wide mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Tricky Follow-up Question</span>
              </div>
              <p className="text-xs font-semibold text-slate-200 mb-1">
                {currentTopic.interviewPrep.trickyFollowUp.question}
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong>Answer: </strong>
                {currentTopic.interviewPrep.trickyFollowUp.answer}
              </p>
            </div>

            {/* Common Mistakes (Shown in full mode) */}
            {!isQuickMode && currentTopic.interviewPrep.commonMistakes.length > 0 && (
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Common Traps & Misconceptions to Avoid
                </h5>
                <ul className="space-y-1 text-xs text-slate-300">
                  {currentTopic.interviewPrep.commonMistakes.map((mistake, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* SECTION F: Quick Revision Summary */}
          <section className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-[#0c1019] p-5 mb-6 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500 text-white text-xs font-bold">
                F
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">
                Quick Revision & Retain
              </h3>
            </div>

            {/* Takeaways */}
            <ul className="space-y-1.5 text-xs text-slate-200 mb-4">
              {currentTopic.quickRevision.takeaways.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {/* 1-Line Definition */}
            <div className="rounded-lg bg-[#06080e]/80 border border-white/[0.08] p-3 mb-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-0.5">
                One-Line Definition
              </span>
              <p className="text-xs font-medium text-sky-200">
                {currentTopic.quickRevision.oneLineDefinition}
              </p>
            </div>

            {/* Key Distinction (if present) */}
            {currentTopic.quickRevision.keyDistinction && (
              <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-3 mb-3">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block mb-0.5">
                  Key Distinction to Remember
                </span>
                <p className="text-xs text-indigo-200 font-medium">
                  {currentTopic.quickRevision.keyDistinction}
                </p>
              </div>
            )}

            {/* Critical Interview Tip */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-0.5">
                  Must Remember in Interviews
                </span>
                <p className="text-xs text-amber-100 font-medium">
                  {currentTopic.quickRevision.interviewTip}
                </p>
              </div>
            </div>
          </section>

          {/* Bottom Topic Navigation (Previous / Next) */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] gap-4">
            {prevTopic ? (
              <button
                onClick={() => setSelectedTopicId(prevTopic.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-[#0c1019] hover:bg-white/[0.06] text-xs font-medium text-slate-300 transition-colors text-left cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="text-[10px] text-slate-500">Previous Topic (#{prevTopic.number})</div>
                  <div className="text-white font-semibold">{prevTopic.title}</div>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextTopic ? (
              <button
                onClick={() => setSelectedTopicId(nextTopic.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-[#0c1019] hover:bg-white/[0.06] text-xs font-medium text-slate-300 transition-colors text-right cursor-pointer"
              >
                <div>
                  <div className="text-[10px] text-slate-500">Next Topic (#{nextTopic.number})</div>
                  <div className="text-white font-semibold">{nextTopic.title}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            ) : (
              <div />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function QuickReferencesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#06080e] flex items-center justify-center text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Loading Quick References...</span>
          </div>
        </div>
      }
    >
      <QuickReferencesContent />
    </React.Suspense>
  );
}
