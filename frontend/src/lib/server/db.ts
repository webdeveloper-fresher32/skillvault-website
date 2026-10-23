import { neon, NeonQueryFunction } from '@neondatabase/serverless';

const DEFAULT_DATABASE_URL = 
  'postgresql://neondb_owner:npg_9NKSpLyAP6gw@ep-cold-bread-b4mv005l-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL || DEFAULT_DATABASE_URL;
    sqlClient = neon(connStr);
  }
  return sqlClient;
}
