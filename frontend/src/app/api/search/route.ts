import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (!q) {
      return NextResponse.json({ query: '', courses: [], lessons: [] });
    }

    const sql = getDb();
    const pattern = `%${q}%`;

    const courses = await sql`
      SELECT id, slug, title, description, category, level, icon,
             total_lessons AS "totalLessons", estimated_hours AS "estimatedHours"
      FROM courses
      WHERE title ILIKE ${pattern} OR category ILIKE ${pattern}
      LIMIT 5
    `;

    const lessons = await sql`
      SELECT l.title, l.slug AS "lessonSlug", c.slug AS "courseSlug", c.title AS "courseTitle", m.title AS "moduleTitle"
      FROM lessons l
      JOIN course_modules m ON l.module_id = m.id
      JOIN courses c ON m.course_id = c.id
      WHERE l.title ILIKE ${pattern} OR l.slug ILIKE ${pattern}
      LIMIT 10
    `;

    return NextResponse.json({
      query: q,
      courses,
      lessons,
    });
  } catch (err: any) {
    console.error('Error in GET /api/search:', err);
    return NextResponse.json({ error: 'Search failed', details: err.message }, { status: 500 });
  }
}
