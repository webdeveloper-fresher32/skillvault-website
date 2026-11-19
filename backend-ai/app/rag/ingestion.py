import os
import hashlib
import json
import asyncio
from pathlib import Path
from typing import List
import asyncpg
from pgvector.asyncpg import register_vector
from openai import AsyncOpenAI
from dotenv import load_dotenv

from app.rag.ast_chunker import ASTMarkdownChunker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/skillvault_local")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
DEFAULT_TENANT_ID = os.getenv("DEFAULT_TENANT_ID", "00000000-0000-0000-0000-000000000001")

ollama_client = AsyncOpenAI(
    base_url=OLLAMA_BASE_URL,
    api_key="ollama"
)

chunker = ASTMarkdownChunker(target_chunk_tokens=600, overlap_tokens=80)


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate dense embeddings via local Ollama."""
    formatted_texts = [f"passage: {t}" for t in texts]
    response = await ollama_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=formatted_texts
    )
    return [item.embedding for item in response.data]


async def ingest_markdown_file(
    conn: asyncpg.Connection,
    file_path: Path,
    organization_id: str = DEFAULT_TENANT_ID
) -> int:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    doc_title = file_path.stem.replace("-", " ").title()
    content_hash = compute_hash(content)

    # 1. Idempotency Check
    existing = await conn.fetchrow(
        """
        SELECT id FROM documents 
        WHERE organization_id = $1::uuid AND content_hash = $2
        """,
        organization_id,
        content_hash
    )
    if existing:
        print(f"⏩ [SKIP] {file_path.name} (Already up-to-date)")
        return 0

    print(f"📄 [PROCESSING] {file_path.name}...")

    # 2. Chunk
    chunks = chunker.chunk_document(content, doc_title=doc_title)
    if not chunks:
        return 0

    # 3. Batch Embeddings via Ollama
    texts_to_embed = [c["content"] for c in chunks]
    embeddings = await get_embeddings(texts_to_embed)

    async with conn.transaction():
        await conn.execute(
            """
            DELETE FROM documents 
            WHERE organization_id = $1::uuid AND file_path = $2
            """,
            organization_id,
            str(file_path)
        )

        doc_row = await conn.fetchrow(
            """
            INSERT INTO documents (organization_id, title, file_path, file_type, content_hash)
            VALUES ($1::uuid, $2, $3, 'markdown', $4)
            RETURNING id
            """,
            organization_id,
            doc_title,
            str(file_path),
            content_hash
        )
        doc_id = doc_row["id"]

        insert_chunk_sql = """
            INSERT INTO document_chunks (
                organization_id,
                document_id,
                chunk_index,
                content,
                metadata,
                embedding
            ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6)
        """
        records = [
            (
                organization_id,
                doc_id,
                c["chunk_index"],
                c["content"],
                json.dumps(c["metadata"]),
                embeddings[i]
            )
            for i, c in enumerate(chunks)
        ]

        await conn.executemany(insert_chunk_sql, records)

    print(f"   ✅ Indexed {len(chunks)} chunks for '{doc_title}'")
    return len(chunks)


async def ingest_directory(dir_path: str = "../content/My-Work"):
    print(f"🚀 Starting Local Ollama RAG Ingestion from: {dir_path}")
    print(f"   Model: {EMBEDDING_MODEL} (768 dim)")
    print(f"   Target DB: {DATABASE_URL}\n")

    conn = await asyncpg.connect(DATABASE_URL)
    await register_vector(conn)

    target_dir = Path(dir_path).resolve()
    markdown_files = list(target_dir.rglob("*.md"))

    if not markdown_files:
        print(f"⚠️ No markdown files found in {target_dir}")
        await conn.close()
        return

    print(f"Found {len(markdown_files)} Markdown files. Starting batch ingestion...\n")
    total_chunks = 0

    for file_path in markdown_files:
        count = await ingest_markdown_file(conn, file_path)
        total_chunks += count

    await conn.close()
    print(f"\n🎉 Ingestion complete! Total chunks indexed: {total_chunks}")


if __name__ == "__main__":
    import sys
    path_arg = sys.argv[1] if len(sys.argv) > 1 else "../content/My-Work"
    asyncio.run(ingest_directory(path_arg))