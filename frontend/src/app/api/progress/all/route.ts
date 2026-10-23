import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getUserIdentifierFromRequest } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    const userIdentifier = getUserIdentifierFromRequest(request);
    const sql = getDb();

    const progress = await sql`
      SELECT id, course_slug AS "courseSlug", lesson_id AS "lessonId", completed, completed_at AS "completedAt"
      FROM user_progress
      WHERE user_identifier = ${userIdentifier} AND completed = true
    `;

    return NextResponse.json(progress);
  } catch (err: any) {
    console.error('Error in GET /api/progress/all:', err);
    return NextResponse.json({ error: 'Failed to fetch progress', details: err.message }, { status: 500 });
  }
}
