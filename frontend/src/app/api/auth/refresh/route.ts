import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/server/db';
import { generateAccessToken } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tokenStr = body.refreshToken;

    if (!tokenStr) {
      return NextResponse.json({ error: 'Refresh token is required' }, { status: 400 });
    }

    const sql = getDb();
    const tokens = await sql`
      SELECT id, token, user_id, expiry_date, revoked
      FROM refresh_tokens
      WHERE token = ${tokenStr} AND revoked = false
      LIMIT 1
    `;

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'Invalid or revoked refresh token' }, { status: 401 });
    }

    const tokenRow = tokens[0];
    if (new Date(tokenRow.expiry_date) < new Date()) {
      return NextResponse.json({ error: 'Refresh token expired' }, { status: 401 });
    }

    const users = await sql`
      SELECT id, username, email, full_name AS "fullName", role
      FROM users
      WHERE id = ${tokenRow.user_id}
      LIMIT 1
    `;

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    const newAccessToken = generateAccessToken(user as any);

    return NextResponse.json({
      accessToken: newAccessToken,
      refreshToken: tokenStr,
      expiresIn: 3600,
      user,
    });
  } catch (err: any) {
    console.error('Error in POST /api/auth/refresh:', err);
    return NextResponse.json({ error: 'Failed to refresh token', details: err.message }, { status: 500 });
  }
}
