import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/server/db';
import { comparePassword, generateAccessToken } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = (body.emailOrUsername || body.email || body.username || '').trim().toLowerCase();
    const password = body.password;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Username/email and password are required' }, { status: 400 });
    }

    const sql = getDb();
    const users = await sql`
      SELECT id, username, email, password, full_name AS "fullName", role
      FROM users
      WHERE LOWER(email) = ${identifier} OR LOWER(username) = ${identifier}
      LIMIT 1
    `;

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'Invalid email/username or password' }, { status: 401 });
    }

    const user = users[0];
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email/username or password' }, { status: 401 });
    }

    const accessToken = generateAccessToken(user as any);
    const refreshToken = crypto.randomUUID();

    const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await sql`
      INSERT INTO refresh_tokens (token, user_id, expiry_date, revoked, created_at)
      VALUES (${refreshToken}, ${user.id}, ${expiryDate.toISOString()}, false, NOW())
    `;

    return NextResponse.json({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName || user.username,
        role: user.role || 'USER',
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/auth/login:', err);
    return NextResponse.json({ error: 'Login failed', details: err.message }, { status: 500 });
  }
}
