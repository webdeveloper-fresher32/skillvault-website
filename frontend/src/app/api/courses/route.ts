import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const sql = getDb();

    let courses;
    if (category && category !== 'All' && category !== 'all') {
      courses = await sql`
        SELECT id, slug, title, description, category, level, icon, 
               total_lessons AS "totalLessons", estimated_hours AS "estimatedHours"
        FROM courses
        WHERE LOWER(category) = LOWER(${category})
        ORDER BY title ASC
      `;
    } else {
      courses = await sql`
        SELECT id, slug, title, description, category, level, icon, 
               total_lessons AS "totalLessons", estimated_hours AS "estimatedHours"
        FROM courses
        ORDER BY title ASC
      `;
    }

    return NextResponse.json(courses);
  } catch (err: any) {
    console.error('Error in GET /api/courses:', err);
    return NextResponse.json({ error: 'Failed to fetch courses', details: err.message }, { status: 500 });
  }
}
