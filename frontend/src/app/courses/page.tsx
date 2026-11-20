'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Search, 
  ArrowRight, 
  Layers, 
  Clock, 
  FileText, 
  Sparkles,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { fetchCourses, Course } from '@/lib/api';
import { stripMarkdown } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

const CATEGORIES = [
  'All',
  'My Work',
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
        console.error('Failed to load courses:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCategory]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [courses, searchQuery]);

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 pb-20">
      {/* 1. ENTERPRISE CATALOG HEADER */}
      <PageHeader
        breadcrumbs={[
          { label: 'Platform', href: '/' },
          { label: 'Curriculum' }
        ]}
        badge={
          <Badge variant="primary" dot>
            Engineered Knowledge Tracks
          </Badge>
        }
        title="Curriculum & Technical Tracks"
        description="Structured, production-grade courses covering backend systems, cloud infrastructure, distributed systems, and generative AI engineering."
        actions={
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracks, topics, tech..."
              className="w-full rounded-lg border border-white/[0.08] bg-[#0f131c] pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500/50 focus:bg-[#141a26] focus:outline-none transition-colors"
            />
          </div>
        }
      >
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-6 border-t border-white/[0.06] mt-6 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none cursor-pointer ${
                  isActive
                    ? 'text-sky-300 font-semibold'
                    : 'bg-[#0f131c] text-slate-400 hover:text-white hover:bg-[#141a26] border border-white/[0.06]'
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
      </PageHeader>

      {/* 2. COURSES MAIN CONTENT */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-6 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">{filteredCourses.length}</span>
            <span>Tracks Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>PostgreSQL Synchronized</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-[#0f131c] p-5 space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-12 w-full" />
                <div className="pt-4 border-t border-white/[0.06] flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No engineering tracks found"
            description={
              searchQuery
                ? `No tracks matching "${searchQuery}". Try a different keyword or category.`
                : 'There are currently no tracks in this category.'
            }
            action={
              searchQuery ? (
                <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setActiveCategory('All')}>
                  View All Tracks
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map((course, idx) => (
              <motion.div
                key={course.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.25) }}
                className="h-full"
              >
                <Link
                  href={`/courses/${course.slug}`}
                  prefetch={true}
                  className="group flex flex-col justify-between h-full rounded-xl border border-white/[0.08] bg-[#0f131c] hover:bg-[#141a26] hover:border-sky-500/30 p-5 transition-all duration-200"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <Badge variant="primary">
                        {course.category}
                      </Badge>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <FileText className="h-3 w-3 text-slate-500" />
                        {course.totalLessons} Lessons
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white group-hover:text-sky-400 transition-colors">
                      {course.title}
                    </h3>

                    <p className="mt-2 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {course.description 
                        ? stripMarkdown(course.description) 
                        : `Comprehensive production guide and curriculum for ${course.title}.`}
                    </p>
                  </div>

                  <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-500" />
                      ~{course.estimatedHours}h
                    </span>
                    <span className="flex items-center gap-1 font-medium text-sky-400 group-hover:translate-x-1 transition-transform">
                      <span>Explore Track</span>
                      <ArrowRight className="h-3.5 w-3.5" />
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
