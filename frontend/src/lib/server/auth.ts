import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 
  process.env.JWT_SECRET || 
  process.env.SKILLVAULT_JWT_SECRET || 
  'skillvault-super-secure-jwt-secret-key-for-sha256-production-min-256-bits-long!!';

export interface UserTokenPayload {
  userId: number;
  username: string;
  email: string;
  fullName?: string;
  role: string;
  sub: string;
}

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function generateAccessToken(user: { id: number; username: string; email: string; fullName?: string; role?: string }): string {
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName || user.username,
    role: user.role || 'USER',
  };

  return jwt.sign(payload, JWT_SECRET, {
    subject: user.email,
    expiresIn: '60m',
  });
}

export function verifyAccessToken(token: string): UserTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: Number(decoded.userId),
      username: decoded.username,
      email: decoded.email,
      fullName: decoded.fullName,
      role: decoded.role,
      sub: decoded.sub,
    };
  } catch (err) {
    return null;
  }
}

export function getUserIdentifierFromRequest(req: Request): string {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = verifyAccessToken(token);
    if (user) {
      return user.email;
    }
  }

  // Fallback to anonymous user identifier from headers or cookie
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous';
  return `guest_${ip}`;
}
