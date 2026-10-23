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
    let title = `${lessonSlug}`;

    try {
      const body = await request.json();
      if (body && body.title) title = body.title;
    } catch (_) {}

    const sql = getDb();

    // Check existing bookmark
    const existing = await sql`
      SELECT id FROM user_bookmarks
      WHERE user_identifier = ${userIdentifier} 
        AND LOWER(course_slug) = LOWER(${courseSlug}) 
        AND LOWER(lesson_slug) = LOWER(${lessonSlug})
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      await sql`DELETE FROM user_bookmarks WHERE id = ${existing[0].id}`;
      return NextResponse.json({ bookmarked: false });
    } else {
      await sql`
        INSERT INTO user_bookmarks (user_identifier, course_slug, lesson_slug, title, created_at)
        VALUES (${userIdentifier}, ${courseSlug}, ${lessonSlug}, ${title}, NOW())
      `;
      return NextResponse.json({ bookmarked: true });
    }
  } catch (err: any) {
    console.error('Error in POST /api/progress/bookmark:', err);
    return NextResponse.json({ error: 'Failed to toggle bookmark', details: err.message }, { status: 500 });
  }
}
