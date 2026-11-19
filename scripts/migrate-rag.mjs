import pg from 'pg';
const { Client } = pg;

// Local PostgreSQL connection configuration
const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '0000', // Change if your local postgres password is different
    database: process.env.PGDATABASE || 'skillvault_local',
});

async function runMigration() {
    console.log(`🚀 Connecting to Local PostgreSQL at localhost:5432/skillvault_local...`);
    await client.connect();
    console.log('   ✅ Connected successfully!\n');

    // 1. Extensions
    console.log('1. Enabling extensions (vector, uuid-ossp, pg_trgm)...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "vector";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
    console.log('   ✅ Extensions enabled.');

    // 2. Organizations Table
    console.log('2. Creating organizations table...');
    await client.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      plan_tier VARCHAR(50) DEFAULT 'FREE' CHECK (plan_tier IN ('FREE', 'PRO', 'ENTERPRISE')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
    console.log('   ✅ Organizations table created.');

    // 3. Documents Metadata Table
    console.log('3. Creating documents table...');
    await client.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      file_path VARCHAR(512),
      file_type VARCHAR(50) NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_org_hash ON documents(organization_id, content_hash);`);
    console.log('   ✅ Documents table & hash index created.');

    // 4. Document Chunks Table (Dense + Sparse)
    console.log('4. Creating document_chunks table with HNSW and GIN indexes...');
    await client.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding VECTOR(1536) NOT NULL,
      tsv_content TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

    // HNSW Cosine Index (m=16, ef_construction=64)
    await client.query(`
    CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
    ON document_chunks 
    USING hnsw (embedding vector_cosine_ops) 
    WITH (m = 16, ef_construction = 64);
  `);

    // GIN Lexical Index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON document_chunks USING gin(tsv_content);`);

    // B-tree Tenant Index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chunks_org ON document_chunks(organization_id);`);
    console.log('   ✅ Document chunks table & HNSW/GIN indexes created.');

    // 5. Row-Level Security
    console.log('5. Configuring Row-Level Security (RLS)...');
    await client.query(`ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;`);
    await client.query(`DROP POLICY IF EXISTS tenant_isolation_chunks ON document_chunks;`);
    await client.query(`
    CREATE POLICY tenant_isolation_chunks ON document_chunks
      FOR ALL
      USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  `);
    console.log('   ✅ Tenant isolation RLS policy active.');

    // 6. Seed Default Organization
    console.log('6. Seeding default organization...');
    await client.query(`
    INSERT INTO organizations (id, name, slug, plan_tier)
    VALUES ('00000000-0000-0000-0000-000000000001', 'SkillVault Local', 'skillvault-local', 'ENTERPRISE')
    ON CONFLICT (id) DO NOTHING;
  `);
    console.log('   ✅ Default local organization ready.');

    // 7. Verify
    console.log('\n7. Verifying indexes on document_chunks:');
    const res = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'document_chunks';
  `);
    console.table(res.rows);

    console.log('\n🎉 Local Production RAG Database Schema successfully migrated!');
}

runMigration()
    .catch((err) => {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    })
    .finally(async () => {
        await client.end();
    });