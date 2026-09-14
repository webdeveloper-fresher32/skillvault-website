'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Search, ArrowRight, Layers, Terminal, Sparkles, Filter } from 'lucide-react';
import { fetchCourses, Course } from '@/lib/api';

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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-3">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Mastery Catalog</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Course Tracks & Knowledge Vault</h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse 30+ structured technical courses covering backend, cloud architecture, system design, and AI engineering.
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter courses..."
            className="w-full rounded-xl border border-slate-800 bg-[#0f172a] pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-6 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeCategory === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Course Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl border border-slate-800 bg-slate-900/50 animate-pulse" />
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="py-20 text-center">
          <Layers className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300">No courses match your criteria</h3>
          <p className="text-sm text-slate-500 mt-1">Try switching categories or clearing your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}`}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0f172a]/80 p-6 hover:border-slate-700 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-blue-500/5 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="rounded-md bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
                    {course.category}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {course.totalLessons} Lessons
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                  {course.title}
                </h3>

                <p className="mt-2 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {course.description || `Comprehensive guide and production-grade knowledge on ${course.title}.`}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  Est. ~{course.estimatedHours} hours
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
                  Enter Course <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
