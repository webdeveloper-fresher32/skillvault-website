const API_BASE = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api');

export interface SubtopicSection {
  id: string;
  title: string;
  content: string;
}

export interface Course {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  level: string;
  icon: string;
  totalLessons: number;
  estimatedHours: number;
  modules?: CourseModule[];
}

export interface CourseModule {
  id: number;
  title: string;
  slug: string;
  sortOrder: number;
  lessons: LessonSummary[];
}

export interface LessonSummary {
  id: number;
  title: string;
  slug: string;
  sortOrder: number;
  estimatedMinutes: number;
}

export interface LessonDetail {
  id: number;
  title: string;
  slug: string;
  courseSlug: string;
  courseTitle: string;
  moduleTitle: string;
  sortOrder: number;
  estimatedMinutes: number;
  markdownContent: string;
  overviewContent?: string;
  subtopics?: SubtopicSection[];
  completed: boolean;
  bookmarked: boolean;
  prevLessonSlug?: string;
  nextLessonSlug?: string;
}

export interface DashboardStats {
  totalCourses: number;
  totalLessons: number;
  completedLessons: number;
  streakDays: number;
  studyHours: number;
  inProgressCourses: {
    courseSlug: string;
    title: string;
    category: string;
    icon: string;
    percentage: number;
    totalLessons: number;
  }[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/courses/stats/dashboard`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load stats');
  return res.json();
}

export async function fetchCourses(category?: string): Promise<Course[]> {
  const url = category && category !== 'All' ? `${API_BASE}/courses?category=${encodeURIComponent(category)}` : `${API_BASE}/courses`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load courses');
  return res.json();
}

export async function fetchCourseBySlug(slug: string): Promise<Course> {
  const res = await fetch(`${API_BASE}/courses/${slug}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Course not found');
  return res.json();
}

export async function fetchLessonDetail(courseSlug: string, lessonSlug: string): Promise<LessonDetail> {
  const res = await fetch(`${API_BASE}/courses/${courseSlug}/lessons/${lessonSlug}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Lesson not found');
  return res.json();
}

export async function toggleLessonComplete(courseSlug: string, lessonSlug: string): Promise<{ completed: boolean }> {
  const res = await fetch(`${API_BASE}/progress/toggle/${courseSlug}/${lessonSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to toggle completion');
  return res.json();
}

export async function toggleBookmark(courseSlug: string, lessonSlug: string, title: string): Promise<{ bookmarked: boolean }> {
  const res = await fetch(`${API_BASE}/progress/bookmark/${courseSlug}/${lessonSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to toggle bookmark');
  return res.json();
}

export async function fetchBookmarks(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/progress/bookmarks`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export async function globalSearch(q: string): Promise<{ courses: Course[]; lessons: any[] }> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
  if (!res.ok) return { courses: [], lessons: [] };
  return res.json();
}

export async function fetchQuizzes(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/practice/quizzes`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchFlashcards(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/practice/flashcards`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}
