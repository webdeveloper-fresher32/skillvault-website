import os
import hashlib
import json
import asyncio
from pathlib import Path
from typing import List, Optional
import asyncpg
from pgvector.asyncpg import register_vector
from dotenv import load_dotenv

from langchain_core.documents import Document
from app.rag_langchain.ast_chunker import ASTMarkdownChunker
from app.core.llm import get_embeddings_model

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:0000@localhost:5432/skillvault_local")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
DEFAULT_TENANT_ID = os.getenv("DEFAULT_TENANT_ID", "00000000-0000-0000-0000-000000000001")

embeddings_model = get_embeddings_model()
chunker = ASTMarkdownChunker(target_chunk_tokens=600, overlap_tokens=80)


def compute_hash(text: str) -> str:
    """Compute SHA-256 hash for document idempotency checking."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def embed_documents_langchain(texts: List[str]) -> List[List[float]]:
    """
    Generate dense embeddings using LangChain Embeddings component.
    Adds contrastive 'passage: ' prefix for asymmetric retrieval models (nomic-embed-text).
    """
    formatted_texts = [f"passage: {t}" for t in texts]
    return await embeddings_model.aembed_documents(formatted_texts)


async def ingest_markdown_file(
    conn: asyncpg.Connection,
    file_path: Path,
    organization_id: str = DEFAULT_TENANT_ID
) -> int:
    """
    Ingest a markdown file into PostgreSQL via LangChain pipeline:
    1. Read and compute SHA-256 content hash (idempotency).
    2. Split into semantic LangChain Document chunks.
    3. Generate dense vector embeddings via LangChain Embeddings.
    4. Store chunks and vector embeddings with transactional integrity.
    """
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

    print(f"📄 [LangChain Ingest] Processing: {file_path.name}...")

    # 2. Chunk into LangChain Documents
    base_doc = Document(
        page_content=content,
        metadata={
            "source": str(file_path),
            "file_name": file_path.name,
            "title": doc_title,
            "organization_id": organization_id
        }
    )
    chunks: List[Document] = chunker.split_documents([base_doc])
    if not chunks:
        return 0

    # 3. Batch Embeddings via LangChain Embeddings
    texts_to_embed = [c.page_content for c in chunks]
    embeddings = await embed_documents_langchain(texts_to_embed)

    # 4. Atomic PostgreSQL Transaction
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
                c.metadata.get("chunk_index", i),
                c.page_content,
                json.dumps(c.metadata),
                embeddings[i]
            )
            for i, c in enumerate(chunks)
        ]

        await conn.executemany(insert_chunk_sql, records)

    print(f"   ✅ [LangChain] Indexed {len(chunks)} chunks for '{doc_title}'")
    return len(chunks)


async def ingest_directory(dir_path: str = "content/React", organization_id: str = DEFAULT_TENANT_ID):
    """Recursively discover and ingest all markdown files in directory using LangChain."""
    print(f"🚀 Starting LangChain RAG Ingestion from: {dir_path}")
    print(f"   Embeddings: {type(embeddings_model).__name__} ({EMBEDDING_MODEL})")
    print(f"   Target DB: {DATABASE_URL}\n")

    conn = await asyncpg.connect(DATABASE_URL)
    await register_vector(conn)

    target_dir = Path(dir_path).resolve()
    markdown_files = sorted(list(target_dir.rglob("*.md")))

    if not markdown_files:
        print(f"⚠️ No markdown files found in {target_dir}")
        await conn.close()
        return

    print(f"Found {len(markdown_files)} Markdown files. Starting batch ingestion...\n")
    total_chunks = 0

    for file_path in markdown_files:
        count = await ingest_markdown_file(conn, file_path, organization_id=organization_id)
        total_chunks += count

    await conn.close()
    print(f"\n🎉 LangChain ingestion complete! Total new chunks indexed: {total_chunks}")


if __name__ == "__main__":
    import sys
    path_arg = sys.argv[1] if len(sys.argv) > 1 else "content/React"
    asyncio.run(ingest_directory(path_arg))
