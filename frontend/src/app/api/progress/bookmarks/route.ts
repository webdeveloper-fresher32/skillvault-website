import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getUserIdentifierFromRequest } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    const userIdentifier = getUserIdentifierFromRequest(request);
    const sql = getDb();

    const bookmarks = await sql`
      SELECT id, course_slug AS "courseSlug", lesson_slug AS "lessonSlug", title, created_at AS "createdAt"
      FROM user_bookmarks
      WHERE user_identifier = ${userIdentifier}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(bookmarks);
  } catch (err: any) {
    console.error('Error in GET /api/progress/bookmarks:', err);
    return NextResponse.json({ error: 'Failed to fetch bookmarks', details: err.message }, { status: 500 });
  }
}
