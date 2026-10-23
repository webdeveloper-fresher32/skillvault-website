import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getUserIdentifierFromRequest } from '@/lib/server/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseSlug: string; lessonSlug: string }> }
) {
  try {
    const { courseSlug, lessonSlug } = await params;
    const userIdentifier = getUserIdentifierFromRequest(request);
    const sql = getDb();

    // Find lesson ID
    const lessons = await sql`
      SELECT l.id, l.slug
      FROM lessons l
      JOIN course_modules m ON l.module_id = m.id
      JOIN courses c ON m.course_id = c.id
      WHERE LOWER(c.slug) = LOWER(${courseSlug}) AND LOWER(l.slug) = LOWER(${lessonSlug})
      LIMIT 1
    `;

    if (!lessons || lessons.length === 0) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const lessonId = lessons[0].id;

    // Check existing progress
    const existing = await sql`
      SELECT id, completed FROM user_progress
      WHERE user_identifier = ${userIdentifier} AND lesson_id = ${lessonId}
      LIMIT 1
    `;

    let newStatus = true;
    if (existing && existing.length > 0) {
      newStatus = !existing[0].completed;
      await sql`
        UPDATE user_progress
        SET completed = ${newStatus},
            completed_at = ${newStatus ? new Date().toISOString() : null},
            last_accessed_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      await sql`
        INSERT INTO user_progress (user_identifier, lesson_id, course_slug, completed, completed_at, last_accessed_at)
        VALUES (${userIdentifier}, ${lessonId}, ${courseSlug}, true, NOW(), NOW())
      `;
    }

    return NextResponse.json({ completed: newStatus });
  } catch (err: any) {
    console.error('Error in POST /api/progress/toggle:', err);
    return NextResponse.json({ error: 'Failed to toggle progress', details: err.message }, { status: 500 });
  }
}
