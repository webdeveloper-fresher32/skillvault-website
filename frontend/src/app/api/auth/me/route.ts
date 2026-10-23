import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { verifyAccessToken } from '@/lib/server/auth';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const sql = getDb();
    const users = await sql`
      SELECT id, username, email, full_name AS "fullName", role
      FROM users
      WHERE id = ${payload.userId}
      LIMIT 1
    `;

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(users[0]);
  } catch (err: any) {
    console.error('Error in GET /api/auth/me:', err);
    return NextResponse.json({ error: 'Failed to fetch user', details: err.message }, { status: 500 });
  }
}
