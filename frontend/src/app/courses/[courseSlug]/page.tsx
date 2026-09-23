'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, 
  Clock, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  Sparkles 
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
      <div className="min-h-screen pb-20">
        <div className="border-b border-slate-800 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="h-4 w-32 rounded bg-slate-800 animate-pulse mb-4" />
            <div className="h-10 w-3/4 rounded-lg bg-slate-800 animate-pulse mb-3" />
            <div className="h-5 w-1/2 rounded bg-slate-800/60 animate-pulse mb-8" />
            <div className="flex gap-6 pt-6 border-t border-slate-800/80">
              <div className="h-4 w-24 rounded bg-slate-800 animate-pulse" />
              <div className="h-4 w-24 rounded bg-slate-800 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-10 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-800 bg-slate-900/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Course Hero Header */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
            <Link href="/courses" prefetch={true} className="hover:text-blue-400">Courses</Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-slate-200">{course.category}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="rounded bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
                {course.category}
              </span>
              <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {course.title}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
                {course.description ? stripMarkdown(course.description) : `Comprehensive production curriculum designed for developers.`}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row md:flex-col shrink-0">
              <Link
                href={firstLessonUrl}
                prefetch={true}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all hover:scale-[1.02]"
              >
                Start Learning
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-8 flex flex-wrap items-center gap-6 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <span>{course.modules?.length || 0} Modules / Phases</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <span>{course.totalLessons} Lessons</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>~{course.estimatedHours} Hours Required</span>
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum Syllabus Tree */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Curriculum & Course Content</h2>
            <p className="text-xs text-slate-400 mt-0.5">Explore each phase and jump into any lesson</p>
          </div>
        </div>

        <div className="space-y-4">
          {course.modules?.map((mod, idx) => (
            <div
              key={mod.id}
              className="rounded-xl border border-slate-800 bg-[#0f172a]/70 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900/60 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/10 text-xs font-mono font-bold text-blue-400 border border-blue-500/20">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200 capitalize">
                    {mod.title}
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {mod.lessons?.length || 0} Lessons
                </span>
              </div>

              <div className="divide-y divide-slate-800/50">
                {mod.lessons?.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/courses/${course.slug}/${lesson.slug}`}
                    prefetch={true}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/40 text-slate-300 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                      <span className="text-sm font-medium group-hover:text-white capitalize">
                        {lesson.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-mono">
                        ~{lesson.estimatedMinutes}m
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
