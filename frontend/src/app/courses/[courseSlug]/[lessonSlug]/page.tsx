'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  FileText, 
  Check, 
  PlaySquare, 
  Bookmark, 
  Share2, 
  Menu, 
  X,
  ListTree
} from 'lucide-react';
import { 
  fetchLessonDetail, 
  fetchCourseBySlug, 
  toggleLessonComplete, 
  toggleBookmark, 
  LessonDetail, 
  Course 
} from '@/lib/api';
import MarkdownViewer from '@/components/MarkdownViewer';

interface PageProps {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}

export default function LessonPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { courseSlug, lessonSlug } = resolvedParams;

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Accordion state for sidebar course sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Accordion state for subtopics inside the markdown lesson content
  const [openSubtopics, setOpenSubtopics] = useState<Record<string, boolean>>({});

  // Individual completion checklist state
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [lData, cData] = await Promise.all([
          fetchLessonDetail(courseSlug, lessonSlug),
          fetchCourseBySlug(courseSlug),
        ]);
        setLesson(lData);
        setCourse(cData);
        setCompleted(lData.completed);
        setBookmarked(lData.bookmarked);

        // Auto-open current section in sidebar
        const map: Record<string, boolean> = {};
        cData.modules?.forEach((m) => {
          const isCurrent = m.lessons?.some((l) => l.slug === lessonSlug);
          map[m.slug] = isCurrent;
        });
        setOpenSections(map);

        // Auto-expand all subtopics by default in the reading area
        if (lData.subtopics && lData.subtopics.length > 0) {
          const subMap: Record<string, boolean> = {};
          lData.subtopics.forEach((s) => {
            subMap[s.id] = true;
          });
          setOpenSubtopics(subMap);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseSlug, lessonSlug]);

  const toggleSection = (slug: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [slug]: !prev[slug],
    }));
  };

  const toggleSubtopic = (id: string) => {
    setOpenSubtopics((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleItemComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleComplete = async () => {
    try {
      const res = await toggleLessonComplete(courseSlug, lessonSlug);
      setCompleted(res.completed);
    } catch (err) {
      setCompleted(!completed);
    }
  };

  const handleToggleBookmark = async () => {
    if (!lesson) return;
    try {
      const res = await toggleBookmark(courseSlug, lessonSlug, lesson.title);
      setBookmarked(res.bookmarked);
    } catch (err) {
      setBookmarked(!bookmarked);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!lesson || !course) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-white">Lesson not found</h2>
        <Link href={`/courses/${courseSlug}`} className="mt-4 inline-block text-blue-400">
          Return to Course
        </Link>
      </div>
    );
  }

  const subtopicsList = lesson.subtopics || [];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[#0d1117]">
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl lg:hidden"
      >
        {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* LEFT SIDEBAR: Udemy / EdTech Course Curriculum Accordion */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-80 sm:w-96 transform border-r border-[#30363d] bg-[#161b22] transition-transform duration-200 lg:static lg:block lg:translate-x-0 overflow-y-auto ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Course Title Header */}
        <div className="p-4 border-b border-[#30363d] bg-[#0d1117]/90 sticky top-0 z-10">
          <Link
            href={`/courses/${course.slug}`}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors mb-2"
          >
            ‹ Back to Course
          </Link>
          <h2 className="text-sm font-bold text-slate-100 line-clamp-1">{course.title}</h2>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-2">
            <span>Course Content</span>
            <span>•</span>
            <span>{course.modules?.length || 0} Sections</span>
          </div>
        </div>

        {/* Collapsible Sections */}
        <div className="divide-y divide-[#30363d]/80">
          {course.modules?.map((mod, modIdx) => {
            const isOpen = !!openSections[mod.slug];
            const isCurrentSection = mod.lessons?.some((l) => l.slug === lesson.slug);
            const totalItems = mod.lessons?.length || 0;
            const completedCount = mod.lessons?.filter((l) => (l.slug === lesson.slug ? completed : !!completedItems[l.slug])).length || 0;

            return (
              <div key={mod.id} className="bg-transparent">
                {/* Accordion Header (Matching exact screenshot) */}
                <button
                  onClick={() => toggleSection(mod.slug)}
                  className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                    isCurrentSection ? 'bg-[#1f242c]' : 'hover:bg-[#1f242c]/60'
                  }`}
                >
                  <div className="pr-2">
                    <h3 className="text-sm font-bold text-slate-100">
                      Section {modIdx + 1}: {mod.title}
                    </h3>
                    <div className="mt-1 text-xs text-slate-400 font-sans">
                      {completedCount} / {totalItems} | {totalItems * 10}min
                    </div>
                  </div>

                  <div className="text-slate-400 shrink-0">
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 text-slate-300" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Accordion Body: Lessons with purple checkboxes */}
                {isOpen && (
                  <div className="bg-[#0d1117] py-2 border-t border-[#30363d]/60">
                    {mod.lessons?.map((l, lIdx) => {
                      const isCurrent = l.slug === lesson.slug;
                      const isDone = isCurrent ? completed : !!completedItems[l.slug];

                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            if (!isCurrent) {
                              router.push(`/courses/${course.slug}/${l.slug}`);
                            }
                          }}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            isCurrent
                              ? 'bg-[#1f2937]/90 text-white'
                              : 'text-slate-300 hover:bg-[#161b22] hover:text-white'
                          }`}
                        >
                          {/* Purple checkbox */}
                          <button
                            onClick={(e) => {
                              if (isCurrent) {
                                e.stopPropagation();
                                handleToggleComplete();
                              } else {
                                toggleItemComplete(l.slug, e);
                              }
                            }}
                            className="mt-0.5 shrink-0"
                          >
                            {isDone ? (
                              <div className="h-4 w-4 rounded bg-[#7c3aed] flex items-center justify-center text-white shadow-sm">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="h-4 w-4 rounded border border-slate-500 bg-slate-800 hover:border-slate-400" />
                            )}
                          </button>

                          <div className="flex-1">
                            <div className="text-sm font-medium leading-snug">
                              {lIdx + 1}. {l.title}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                              <PlaySquare className="h-3.5 w-3.5 text-slate-400" />
                              <span>{l.estimatedMinutes || 15}min</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA: Complete Markdown Document with Subtopic Accordions */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-8 max-w-5xl mx-auto w-full">
        {/* Breadcrumb Path (Matching GitHub style) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#30363d] text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <Link href={`/courses/${course.slug}`} className="text-blue-400 hover:underline">
              {course.title}
            </Link>
            <span>/</span>
            <span className="text-blue-400">{lesson.moduleTitle}</span>
            <span>/</span>
            <span className="text-slate-200 font-semibold">{lesson.slug}.md</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleBookmark}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium border transition-all ${
                bookmarked
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-[#21262d] text-slate-300 border-[#30363d] hover:bg-[#30363d]'
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-amber-400' : ''}`} />
              <span>{bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>

            <button
              onClick={handleToggleComplete}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1 text-xs font-semibold border transition-all ${
                completed
                  ? 'bg-[#7c3aed] text-white border-[#7c3aed]'
                  : 'bg-[#21262d] text-slate-200 border-[#30363d] hover:bg-[#30363d]'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>{completed ? 'Completed' : 'Mark as Complete'}</span>
            </button>

            <button
              onClick={handleShare}
              className="rounded-md border border-[#30363d] bg-[#21262d] p-1.5 text-slate-300 hover:text-white hover:bg-[#30363d]"
              title="Share Link"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Lesson Main Title Header */}
        <div className="py-6 border-b border-[#30363d]">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {lesson.title}
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            {lesson.moduleTitle} • {subtopicsList.length} Subtopics
          </p>
        </div>

        {/* SUBTOPICS ACCORDION IN MAIN CONTENT AREA */}
        {subtopicsList.length > 0 ? (
          <div className="mt-8 space-y-4">
            {subtopicsList.map((sub, sIdx) => {
              const isOpen = !!openSubtopics[sub.id];

              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden transition-all shadow-md"
                >
                  {/* Subtopic Accordion Header */}
                  <button
                    onClick={() => toggleSubtopic(sub.id)}
                    className="w-full flex items-center justify-between p-4 bg-[#1c2128] hover:bg-[#22272e] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-[#7c3aed]/20 font-mono text-xs font-bold text-[#a78bfa] border border-[#7c3aed]/40">
                        {sIdx + 1}
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-white">
                        {sub.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-xs font-mono hidden sm:inline text-slate-400">
                        {isOpen ? 'Collapse' : 'Expand'}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5 text-slate-300" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Subtopic Accordion Body: Markdown Info */}
                  {isOpen && (
                    <div className="p-6 bg-[#0d1117] border-t border-[#30363d]/80">
                      <MarkdownViewer content={sub.content} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Fallback if no subtopics parsed */
          <div className="py-6">
            <MarkdownViewer content={lesson.markdownContent} />
          </div>
        )}

        {/* Prev / Next Footer */}
        <div className="mt-12 flex items-center justify-between border-t border-[#30363d] pt-6 pb-12">
          {lesson.prevLessonSlug ? (
            <Link
              href={`/courses/${course.slug}/${lesson.prevLessonSlug}`}
              className="flex items-center gap-2 rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-[#30363d] hover:text-white"
            >
              <span>‹ Previous Topic</span>
            </Link>
          ) : <div />}

          {lesson.nextLessonSlug && (
            <Link
              href={`/courses/${course.slug}/${lesson.nextLessonSlug}`}
              className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-[#6d28d9]"
            >
              <span>Next Topic ›</span>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
