const API_BASE = 
  typeof window !== 'undefined' 
    ? '/api' 
    : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/api\/?$/, '')}/api` : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'));

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

export const DEFAULT_STATS: DashboardStats = {
  totalCourses: 31,
  totalLessons: 1249,
  completedLessons: 42,
  streakDays: 7,
  studyHours: 28,
  inProgressCourses: [
    { courseSlug: 'springboot', title: 'Spring Boot 3 & 4 Backend', category: 'Backend', icon: 'leaf', percentage: 64, totalLessons: 58 },
    { courseSlug: 'aws', title: 'Amazon Web Services (AWS)', category: 'Cloud & DevOps', icon: 'cloud', percentage: 48, totalLessons: 61 },
    { courseSlug: 'hld', title: 'High-Level Design (HLD)', category: 'System Design', icon: 'layers', percentage: 32, totalLessons: 45 },
  ]
};

// In-memory caches for instantaneous route switches (0ms)
let statsCache: { data: DashboardStats; time: number } | null = null;
const coursesCache = new Map<string, { data: Course[]; time: number }>();
const courseDetailCache = new Map<string, { data: Course; time: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds TTL

export function invalidateApiCache() {
  statsCache = null;
  coursesCache.clear();
  courseDetailCache.clear();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const now = Date.now();
  if (statsCache && now - statsCache.time < CACHE_TTL) {
    return statsCache.data;
  }
  try {
    const res = await fetch(`${API_BASE}/courses/stats/dashboard`);
    if (!res.ok) throw new Error('Failed to load stats');
    const data = await res.json();
    statsCache = { data, time: now };
    return data;
  } catch (err) {
    if (statsCache) return statsCache.data;
    return DEFAULT_STATS;
  }
}

export async function fetchCourses(category?: string): Promise<Course[]> {
  const key = category || 'All';
  const now = Date.now();
  const cached = coursesCache.get(key);
  if (cached && now - cached.time < CACHE_TTL) {
    return cached.data;
  }
  const url = category && category !== 'All' ? `${API_BASE}/courses?category=${encodeURIComponent(category)}` : `${API_BASE}/courses`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load courses');
  const data = await res.json();
  coursesCache.set(key, { data, time: now });
  return data;
}

export async function fetchCourseBySlug(slug: string): Promise<Course> {
  const now = Date.now();
  const cached = courseDetailCache.get(slug);
  if (cached && now - cached.time < CACHE_TTL) {
    return cached.data;
  }
  const res = await fetch(`${API_BASE}/courses/${slug}`);
  if (!res.ok) throw new Error('Course not found');
  const data = await res.json();
  courseDetailCache.set(slug, { data, time: now });
  return data;
}

export async function fetchLessonDetail(courseSlug: string, lessonSlug: string): Promise<LessonDetail> {
  const res = await fetch(`${API_BASE}/courses/${courseSlug}/lessons/${lessonSlug}`);
  if (!res.ok) throw new Error('Lesson not found');
  return res.json();
}

export async function toggleLessonComplete(courseSlug: string, lessonSlug: string): Promise<{ completed: boolean }> {
  invalidateApiCache();
  const res = await fetch(`${API_BASE}/progress/toggle/${courseSlug}/${lessonSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to toggle completion');
  return res.json();
}

export async function toggleBookmark(courseSlug: string, lessonSlug: string, title: string): Promise<{ bookmarked: boolean }> {
  invalidateApiCache();
  const res = await fetch(`${API_BASE}/progress/bookmark/${courseSlug}/${lessonSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to toggle bookmark');
  return res.json();
}

export async function fetchBookmarks(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/progress/bookmarks`);
  if (!res.ok) return [];
  return res.json();
}

export async function globalSearch(q: string): Promise<{ courses: Course[]; lessons: any[] }> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return { courses: [], lessons: [] };
  return res.json();
}

export async function fetchQuizzes(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/practice/quizzes`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchFlashcards(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/practice/flashcards`);
  if (!res.ok) return [];
  return res.json();
}
