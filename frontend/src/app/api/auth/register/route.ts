import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/server/db';
import { hashPassword, generateAccessToken } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, email, password, fullName } = body;

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();
    const sql = getDb();

    // Check if user already exists
    const existing = await sql`
      SELECT id FROM users 
      WHERE LOWER(email) = ${trimmedEmail} OR LOWER(username) = ${trimmedUsername}
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Username or email already registered' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const displayName = fullName ? fullName.trim() : trimmedUsername;

    const insertedUsers = await sql`
      INSERT INTO users (username, email, password, full_name, role, created_at, updated_at)
      VALUES (${trimmedUsername}, ${trimmedEmail}, ${hashedPassword}, ${displayName}, 'USER', NOW(), NOW())
      RETURNING id, username, email, full_name AS "fullName", role
    `;

    const user = insertedUsers[0];
    const accessToken = generateAccessToken(user as any);
    const refreshToken = crypto.randomUUID();

    // Save refresh token
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
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/auth/register:', err);
    return NextResponse.json({ error: 'Registration failed', details: err.message }, { status: 500 });
  }
}
