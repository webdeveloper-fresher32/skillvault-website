'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ChevronRight, 
  ChevronDown, 
  Check, 
  PlaySquare, 
  Bookmark, 
  Share2, 
  Menu, 
  X,
  ListOrdered
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
import TopScrollProgress from '@/components/interactive/TopScrollProgress';

interface PageProps {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}

export default function LessonPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { courseSlug, lessonSlug } = resolvedParams;

  const [activeLessonSlug, setActiveLessonSlug] = useState<string>(lessonSlug);
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isLessonSwitching, setIsLessonSwitching] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Accordion state for sidebar course sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Individual completion checklist state for topics
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  // Fetch or switch lesson
  const loadLessonData = async (targetLessonSlug: string, isInitial = false) => {
    if (isInitial) {
      setInitialLoading(true);
    } else {
      setIsLessonSwitching(true);
    }

    try {
      if (isInitial || !course) {
        const [lData, cData] = await Promise.all([
          fetchLessonDetail(courseSlug, targetLessonSlug),
          fetchCourseBySlug(courseSlug),
        ]);
        setLesson(lData);
        setCourse(cData);
        setCompleted(lData.completed);
        setBookmarked(lData.bookmarked);
        setActiveLessonSlug(targetLessonSlug);

        // Auto-open current section in sidebar
        const map: Record<string, boolean> = {};
        cData.modules?.forEach((m) => {
          const isCurrent = m.lessons?.some((l) => l.slug === targetLessonSlug);
          map[m.slug] = isCurrent;
        });
        setOpenSections(map);
      } else {
        const lData = await fetchLessonDetail(courseSlug, targetLessonSlug);
        setLesson(lData);
        setCompleted(lData.completed);
        setBookmarked(lData.bookmarked);
        setActiveLessonSlug(targetLessonSlug);

        // Auto-open section containing this lesson if closed
        course.modules?.forEach((m) => {
          if (m.lessons?.some((l) => l.slug === targetLessonSlug)) {
            setOpenSections((prev) => ({ ...prev, [m.slug]: true }));
          }
        });
      }

      // Scroll to top of content smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      }
      setIsLessonSwitching(false);
    }
  };

  useEffect(() => {
    loadLessonData(lessonSlug, true);
  }, [courseSlug, lessonSlug]);

  // Handler for seamless topic click
  const handleSwitchTopic = (targetSlug: string) => {
    if (targetSlug === activeLessonSlug) return;
    window.history.pushState({}, '', `/courses/${courseSlug}/${targetSlug}`);
    loadLessonData(targetSlug, false);
  };

  // Active subtopic index in timeline (0 to N-1)
  const [activeSubtopicIndex, setActiveSubtopicIndex] = useState<number>(0);

  const subtopicsList = lesson?.subtopics || [];

  // Observer to highlight active heading on scroll
  useEffect(() => {
    const handleScroll = () => {
      // Find all h2 and h3 in markdown
      const headings = Array.from(document.querySelectorAll('.markdown-body h2, .markdown-body h3')) as HTMLElement[];
      if (!headings.length || !subtopicsList.length) return;

      const scrollPos = window.scrollY + 160;

      // Match against subtopics list
      let bestIdx = 0;
      for (let s = 0; s < subtopicsList.length; s++) {
        const sub = subtopicsList[s];
        const cleanSub = sub.title.replace(/^\d+[\.\-\s]+/, '').trim().toLowerCase();

        // Find heading in document matching this subtopic
        const hMatch = headings.find((h) => {
          const hText = (h.textContent || '').replace(/^\d+[\.\-\s]+/, '').trim().toLowerCase();
          return hText === cleanSub || hText.includes(cleanSub) || cleanSub.includes(hText);
        });

        if (hMatch) {
          const top = hMatch.getBoundingClientRect().top + window.scrollY;
          if (top <= scrollPos) {
            bestIdx = s;
          }
        }
      }

      setActiveSubtopicIndex(bestIdx);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lesson, subtopicsList]);

  const toggleSection = (slug: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [slug]: !prev[slug],
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

  const scrollToSection = (title: string, index?: number) => {
    const headings = Array.from(document.querySelectorAll('.markdown-body h2, .markdown-body h3')) as HTMLElement[];
    const cleanTitle = title.replace(/^\d+[\.\-\s]+/, '').trim().toLowerCase();
    
    // 1. Try finding heading matching clean title
    let target = headings.find((h) => {
      const hText = (h.textContent || '').replace(/^\d+[\.\-\s]+/, '').trim().toLowerCase();
      return hText === cleanTitle || hText.startsWith(cleanTitle) || cleanTitle.startsWith(hText);
    });

    // 2. Fallback: match by index if provided
    if (!target && index !== undefined) {
      const h2s = Array.from(document.querySelectorAll('.markdown-body h2')) as HTMLElement[];
      if (h2s[index]) {
        target = h2s[index];
      }
    }

    if (target) {
      const navOffset = 90;
      const targetPos = target.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top: targetPos, behavior: 'smooth' });
    }
  };

  if (initialLoading) {
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

  return (
    <>
      <TopScrollProgress />
      <div className="flex min-h-[calc(100vh-4rem)] bg-[#0d1117]">
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl lg:hidden"
      >
        {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* 1. FIXED LEFT SIDEBAR: Udemy / EdTech Course Curriculum Accordion */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-30 w-80 sm:w-88 border-r border-[#30363d] bg-[#161b22] transition-transform duration-200 lg:translate-x-0 overflow-y-auto ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Course Title Header */}
        <div className="p-4 border-b border-[#30363d] bg-[#0d1117]/95 sticky top-0 z-10 backdrop-blur">
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

        {/* Sections Accordion */}
        <div className="divide-y divide-[#30363d]/80">
          {course.modules?.map((mod, modIdx) => {
            const isOpen = !!openSections[mod.slug];
            const isCurrentSection = mod.lessons?.some((l) => l.slug === lesson.slug);
            const totalItems = mod.lessons?.length || 0;
            const completedCount = mod.lessons?.filter((l) => (l.slug === lesson.slug ? completed : !!completedItems[l.slug])).length || 0;

            return (
              <div key={mod.id} className="bg-transparent">
                {/* Accordion Section Header */}
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
                      <ChevronDown className="h-5 w-5 text-slate-300" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Accordion Section Items */}
                {isOpen && (
                  <div className="bg-[#0d1117] py-2 border-t border-[#30363d]/60">
                    {mod.lessons?.map((l, lIdx) => {
                      const isCurrent = l.slug === activeLessonSlug;
                      const isDone = isCurrent ? completed : !!completedItems[l.slug];

                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            if (!isCurrent) {
                              handleSwitchTopic(l.slug);
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

      {/* 2. SCROLLABLE MIDDLE SECTION: Full Continuous Markdown Content (No middle accordions) */}
      <main className="flex-1 lg:ml-80 sm:lg:ml-88 xl:mr-72 min-w-0 px-4 sm:px-8 lg:px-10 py-8 max-w-5xl mx-auto w-full">
        {/* GitHub Breadcrumb Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#30363d] text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono truncate">
            <Link href={`/courses/${course.slug}`} className="text-blue-400 hover:underline truncate">
              {course.title}
            </Link>
            <span>/</span>
            <span className="text-blue-400 truncate">{lesson.moduleTitle}</span>
            <span>/</span>
            <span className="text-slate-200 font-semibold truncate">{lesson.slug}.md</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

        {/* Clean, Full-Stream Markdown Document (Normal Continuous Reading) */}
        <div className={`py-6 transition-opacity duration-150 ${isLessonSwitching ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <MarkdownViewer
            content={lesson.markdownContent}
            courseSlug={courseSlug}
            lessonSlug={activeLessonSlug}
          />
        </div>

        {/* Prev / Next Footer Navigation */}
        <div className="mt-12 flex items-center justify-between border-t border-[#30363d] pt-6 pb-12">
          {lesson.prevLessonSlug ? (
            <button
              onClick={() => handleSwitchTopic(lesson.prevLessonSlug!)}
              className="flex items-center gap-2 rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-[#30363d] hover:text-white transition-colors"
            >
              <span>‹ Previous Topic</span>
            </button>
          ) : <div />}

          {lesson.nextLessonSlug && (
            <button
              onClick={() => handleSwitchTopic(lesson.nextLessonSlug!)}
              className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-[#6d28d9] transition-colors"
            >
              <span>Next Topic ›</span>
            </button>
          )}
        </div>
      </main>

      {/* 3. FIXED RIGHT SIDEBAR: Interactive Timeline of Subtopics / Headings */}
      <aside className="hidden xl:block fixed top-16 bottom-0 right-0 w-72 border-l border-[#30363d] bg-[#161b22] p-5 overflow-y-auto">
        <div className="pb-3 border-b border-[#30363d] mb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
            <ListOrdered className="h-4 w-4 text-[#7c3aed]" />
            <span>On This Page (Timeline)</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {subtopicsList.length} Key Subtopics
          </div>
        </div>

        {/* Timeline Path */}
        <div className="relative pl-3 space-y-4">
          {/* Vertical Connecting Line */}
          <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-[#30363d]" />

          {subtopicsList.map((sub, sIdx) => {
            const isCurrent = sIdx === activeSubtopicIndex;
            const isPassed = sIdx < activeSubtopicIndex;

            return (
              <div
                key={sub.id}
                onClick={() => scrollToSection(sub.title, sIdx)}
                className="group relative flex items-start gap-3 cursor-pointer select-none"
              >
                {/* Timeline node bullet */}
                <div
                  className={`mt-1 h-3.5 w-3.5 rounded-full border-2 transition-all duration-200 shrink-0 z-10 ${
                    isCurrent
                      ? 'bg-[#7c3aed] border-white ring-4 ring-[#7c3aed]/40 scale-110 shadow-lg shadow-[#7c3aed]/50'
                      : isPassed
                      ? 'bg-[#7c3aed] border-[#7c3aed]'
                      : 'bg-[#161b22] border-slate-600 group-hover:border-[#7c3aed]'
                  }`}
                />

                <div className="flex-1">
                  <div
                    className={`text-xs leading-snug transition-all duration-200 line-clamp-2 ${
                      isCurrent
                        ? 'font-bold text-[#c4b5fd] translate-x-0.5'
                        : isPassed
                        ? 'text-slate-300 font-medium'
                        : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  >
                    {sub.title}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 transition-colors ${
                    isCurrent ? 'text-indigo-400 font-semibold' : 'text-slate-600'
                  }`}>
                    Step {sIdx + 1}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
    </>
  );
}
