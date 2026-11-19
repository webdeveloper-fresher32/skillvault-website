import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL or POSTGRES_URL environment variable is required.');
    }
    sqlClient = neon(connStr);
  }
  return sqlClient;
}
