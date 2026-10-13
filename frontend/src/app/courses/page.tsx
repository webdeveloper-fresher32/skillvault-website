'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Search, ArrowRight, Layers, Terminal, Sparkles, Filter, Clock, FileText } from 'lucide-react';
import { fetchCourses, Course } from '@/lib/api';
import { stripMarkdown } from '@/lib/utils';

const CATEGORIES = [
  'All',
  'Backend',
  'Cloud & DevOps',
  'DevOps',
  'System Design',
  'AI & LLMs',
  'Frontend',
  'Databases',
  'Interview Prep',
  'Computer Science',
];

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchCourses(activeCategory);
        setCourses(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCategory]);

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 pb-20">
      {/* 1. CATALOG HEADER */}
      <section className="border-b border-white/[0.06] bg-[#080c14] py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-mono text-sky-400 mb-3">
                <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                <span>Engineered Knowledge Tracks</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Curriculum & Engineering Tracks
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                30+ structured technical courses covering backend systems, AWS cloud architecture, distributed HLD, and modern AI engineering.
              </p>
            </div>

            {/* Fast Search input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracks, topics, tech..."
                className="w-full rounded-lg border border-white/[0.08] bg-[#0c1019] pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 border-t border-white/[0.06] mt-6 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`relative whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors focus:outline-none cursor-pointer ${
                    isActive
                      ? 'text-sky-300 font-semibold'
                      : 'bg-[#0c1019] text-slate-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="courses-category-pill"
                      className="absolute inset-0 rounded-md bg-sky-500/15 border border-sky-500/30"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. COURSES GRID */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-6 text-xs text-slate-400 font-mono">
          <span>{filteredCourses.length} Tracks Available</span>
          <span>PostgreSQL Live Synchronized</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-56 rounded-xl border border-white/[0.06] bg-[#0a0e17] animate-pulse" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-20 text-center rounded-xl border border-dashed border-white/[0.08]">
            <Layers className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No tracks match your query</h3>
            <p className="text-xs text-slate-500 mt-1">Try switching category filter or clearing search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map((course, idx) => (
              <motion.div
                key={course.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                whileHover={{ y: -4, borderColor: 'rgba(56, 189, 248, 0.35)' }}
                className="rounded-xl border border-white/[0.08] bg-[#0a0e17] transition-colors"
              >
                <Link
                  href={`/courses/${course.slug}`}
                  prefetch={true}
                  className="group p-5 flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-mono text-[11px] font-semibold text-sky-400 uppercase tracking-wide bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                        {course.category}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {course.totalLessons} Lessons
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors">
                      {course.title}
                    </h3>

                    <p className="mt-2 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {course.description ? stripMarkdown(course.description) : `Comprehensive production guide and curriculum for ${course.title}.`}
                    </p>
                  </div>

                  <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono text-[11px]">
                      ~{course.estimatedHours} Hours
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-sky-400 group-hover:translate-x-0.5 transition-transform">
                      Enter Track <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
