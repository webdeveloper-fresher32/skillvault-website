'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, 
  Clock, 
  Layers, 
  ArrowRight, 
  FileText, 
  CheckCircle2,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { fetchCourseBySlug, Course } from '@/lib/api';
import { stripMarkdown } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

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
      <div className="min-h-screen bg-[#090b10] text-slate-100 pb-20">
        <div className="border-b border-white/[0.08] bg-[#0f131c] py-10 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-4 pt-4 border-t border-white/[0.06]">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-8 space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 pb-20">
      {/* 1. ENTERPRISE COURSE HEADER */}
      <PageHeader
        breadcrumbs={[
          { label: 'Platform', href: '/' },
          { label: 'Courses', href: '/courses' },
          { label: course.title }
        ]}
        badge={
          <Badge variant="primary" dot>
            {course.category}
          </Badge>
        }
        title={course.title}
        description={
          course.description 
            ? stripMarkdown(course.description) 
            : `Comprehensive curriculum designed for developers.`
        }
        actions={
          <Link href={firstLessonUrl} prefetch={true}>
            <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
              Start Learning
            </Button>
          </Link>
        }
      >
        {/* Quick Metrics Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-6 pt-5 border-t border-white/[0.06] text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-slate-200 font-semibold">{course.modules?.length || 0}</span>
            <span>Phases / Modules</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-200 font-semibold">{course.totalLessons}</span>
            <span>Total Lessons</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-slate-200 font-semibold">~{course.estimatedHours}h</span>
            <span>Total Time</span>
          </div>
        </div>
      </PageHeader>

      {/* 2. SYLLABUS SECTION */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-6">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">Curriculum Syllabus & Modules</h2>
            <p className="text-xs text-slate-400 mt-0.5">Explore each phase and jump directly into any lesson</p>
          </div>
          <span className="text-xs font-mono text-slate-500">Sequential Track</span>
        </div>

        <div className="space-y-4">
          {course.modules?.map((mod, idx) => (
            <div
              key={mod.id}
              className="rounded-xl border border-white/[0.08] bg-[#0f131c] overflow-hidden"
            >
              {/* Module Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#141a26] border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/10 text-[11px] font-mono font-bold text-sky-400 border border-sky-500/20">
                    {idx + 1}
                  </span>
                  <h3 className="text-xs sm:text-sm font-semibold text-white capitalize">
                    {mod.title}
                  </h3>
                </div>
                <Badge variant="neutral">
                  {mod.lessons?.length || 0} Lessons
                </Badge>
              </div>

              {/* Lessons List */}
              <div className="divide-y divide-white/[0.04]">
                {mod.lessons?.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/courses/${course.slug}/${lesson.slug}`}
                    prefetch={true}
                    className="flex items-center justify-between px-5 py-3 hover:bg-[#141a26]/70 text-slate-300 transition-colors group"
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
