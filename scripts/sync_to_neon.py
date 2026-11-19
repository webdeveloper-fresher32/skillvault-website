import asyncio
import asyncpg
from pgvector.asyncpg import register_vector

import os
from dotenv import load_dotenv

load_dotenv()

LOCAL_DB = os.getenv("LOCAL_DATABASE_URL", "postgresql://postgres:0000@localhost:5432/skillvault_local")
NEON_DB = os.getenv("NEON_DATABASE_URL", os.getenv("DATABASE_URL"))
BATCH_SIZE = 500

async def sync():
    print("=" * 80)
    print("🚀 Syncing SkillVault RAG Knowledge Base to Neon Cloud PostgreSQL")
    print("   Source (Local): localhost:5432/skillvault_local")
    print("   Target (Neon):  ep-cold-bread-b4mv005l-pooler.c-6.us-east-2.aws.neon.tech/neondb")
    print("=" * 80)

    local_conn = await asyncpg.connect(LOCAL_DB)
    await register_vector(local_conn)

    neon_conn = await asyncpg.connect(NEON_DB)
    await register_vector(neon_conn)

    # 1. Ensure Organization exists on Neon
    print("\n🏢 Step 1: Syncing Organizations...")
    orgs = await local_conn.fetch("SELECT id, name, slug, plan_tier FROM organizations;")
    for org in orgs:
        await neon_conn.execute(
            """
            INSERT INTO organizations (id, name, slug, plan_tier)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
            """,
            org["id"], org["name"], org["slug"], org["plan_tier"]
        )
    print(f"   ✅ Synced {len(orgs)} organization(s).")

    # 2. Sync Documents
    print("\n📄 Step 2: Syncing Documents...")
    docs = await local_conn.fetch("SELECT id, organization_id, title, file_path, file_type, content_hash FROM documents;")
    for doc in docs:
        await neon_conn.execute(
            """
            INSERT INTO documents (id, organization_id, title, file_path, file_type, content_hash)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING;
            """,
            doc["id"], doc["organization_id"], doc["title"], doc["file_path"], doc["file_type"], doc["content_hash"]
        )
    print(f"   ✅ Synced {len(docs)} document record(s).")

    # 3. Sync Document Chunks
    print("\n🧩 Step 3: Syncing Document Chunks in batches...")
    total_chunks = await local_conn.fetchval("SELECT count(*) FROM document_chunks;")
    print(f"   Total local chunks to transfer: {total_chunks}")

    # Clear existing chunks on Neon to ensure clean state
    await neon_conn.execute("DELETE FROM document_chunks;")

    insert_chunk_sql = """
        INSERT INTO document_chunks (
            id,
            organization_id,
            document_id,
            chunk_index,
            content,
            metadata,
            embedding
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (id) DO NOTHING;
    """

    async with local_conn.transaction():
        cursor = await local_conn.cursor("SELECT id, organization_id, document_id, chunk_index, content, metadata::text, embedding FROM document_chunks;")
        transferred = 0

        while True:
            rows = await cursor.fetch(BATCH_SIZE)
            if not rows:
                break

            records = [
                (
                    r["id"],
                    r["organization_id"],
                    r["document_id"],
                    r["chunk_index"],
                    r["content"],
                    r["metadata"],
                    r["embedding"]
                )
                for r in rows
            ]

            await neon_conn.executemany(insert_chunk_sql, records)
            transferred += len(rows)
            print(f"   Transferred {transferred}/{total_chunks} chunks ({transferred*100//total_chunks}%)...", end="\r", flush=True)

    print()
    neon_total = await neon_conn.fetchval("SELECT count(*) FROM document_chunks;")
    print(f"\n🎉 Sync complete! Total chunks verified on Neon: {neon_total}")

    await local_conn.close()
    await neon_conn.close()

if __name__ == "__main__":
    asyncio.run(sync())
