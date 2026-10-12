'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, 
  Clock, 
  Layers, 
  ArrowRight, 
  ChevronRight, 
  FileText, 
  CheckCircle2
} from 'lucide-react';
import { fetchCourseBySlug, Course } from '@/lib/api';
import { stripMarkdown } from '@/lib/utils';

interface PageProps {
  params: Promise<{ courseSlug: string }>;
}

export default function CourseDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { courseSlug } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const data = await fetchCourseBySlug(courseSlug);
        if (isMounted) {
          setCourse(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          router.push('/courses');
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [courseSlug, router]);

  // Find the first lesson to link "Start Learning"
  let firstLessonUrl = '#';
  if (course && course.modules && course.modules.length > 0) {
    for (const m of course.modules) {
      if (m.lessons && m.lessons.length > 0) {
        firstLessonUrl = `/courses/${course.slug}/${m.lessons[0].slug}`;
        break;
      }
    }
  }

  if (loading || !course) {
    return (
      <div className="min-h-screen bg-[#06080e] pb-20">
        <div className="border-b border-white/[0.06] bg-[#080c14] py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="h-4 w-32 rounded bg-slate-800 animate-pulse mb-4" />
            <div className="h-8 w-3/4 rounded bg-slate-800 animate-pulse mb-3" />
            <div className="h-4 w-1/2 rounded bg-slate-800/60 animate-pulse mb-8" />
            <div className="flex gap-6 pt-6 border-t border-white/[0.06]">
              <div className="h-4 w-24 rounded bg-slate-800 animate-pulse" />
              <div className="h-4 w-24 rounded bg-slate-800 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-10 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-white/[0.06] bg-[#0a0e17] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 pb-20">
      {/* 1. COURSE HERO HEADER */}
      <section className="border-b border-white/[0.06] bg-[#080c14] py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-4">
            <Link href="/courses" prefetch={true} className="hover:text-sky-400 transition-colors">Courses</Link>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-slate-300">{course.category}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="max-w-3xl">
              <span className="rounded bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-sky-400 border border-sky-500/20">
                {course.category}
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                {course.title}
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed">
                {course.description ? stripMarkdown(course.description) : `Comprehensive curriculum designed for developers.`}
              </p>
            </div>

            <div className="shrink-0">
              <Link
                href={firstLessonUrl}
                prefetch={true}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors"
              >
                <span>Start Learning</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-8 flex flex-wrap items-center gap-6 pt-6 border-t border-white/[0.06] text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-sky-400" />
              <span>{course.modules?.length || 0} Modules / Phases</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              <span>{course.totalLessons} Lessons</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>~{course.estimatedHours} Hours Required</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SYLLABUS SECTION */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-10">
        <div className="pb-3 border-b border-white/[0.06] mb-6">
          <h2 className="text-base font-bold text-white tracking-tight">Curriculum Syllabus & Modules</h2>
          <p className="text-xs text-slate-400 mt-0.5">Explore each phase and jump directly into any lesson</p>
        </div>

        <div className="space-y-4">
          {course.modules?.map((mod, idx) => (
            <div
              key={mod.id}
              className="rounded-xl border border-white/[0.08] bg-[#0a0e17] overflow-hidden"
            >
              {/* Module Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#0c101a] border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/10 text-[11px] font-mono font-bold text-sky-400 border border-sky-500/20">
                    {idx + 1}
                  </span>
                  <h3 className="text-xs sm:text-sm font-semibold text-white capitalize">
                    {mod.title}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {mod.lessons?.length || 0} Lessons
                </span>
              </div>

              {/* Lessons List */}
              <div className="divide-y divide-white/[0.04]">
                {mod.lessons?.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/courses/${course.slug}/${lesson.slug}`}
                    prefetch={true}
                    className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] text-slate-300 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-3.5 w-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
                      <span className="text-xs sm:text-sm font-medium group-hover:text-white capitalize">
                        {lesson.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 font-mono">
                        ~{lesson.estimatedMinutes}m
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
