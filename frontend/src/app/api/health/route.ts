import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';

export async function GET() {
  try {
    const sql = getDb();
    const result = await sql`SELECT NOW() as now`;
    return NextResponse.json({
      status: 'UP',
      runtime: 'nodejs-serverless',
      database: 'connected',
      timestamp: result[0]?.now || new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'DEGRADED',
      runtime: 'nodejs-serverless',
      database: 'error',
      message: err.message,
    }, { status: 500 });
  }
}
