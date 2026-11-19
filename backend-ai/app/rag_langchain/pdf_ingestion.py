import os
import hashlib
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
import asyncpg
from pgvector.asyncpg import register_vector
from pypdf import PdfReader
import tiktoken
from dotenv import load_dotenv

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.core.llm import get_embeddings_model

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:0000@localhost:5432/skillvault_local")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
DEFAULT_TENANT_ID = os.getenv("DEFAULT_TENANT_ID", "00000000-0000-0000-0000-000000000001")
BATCH_SIZE = 32

embeddings_model = get_embeddings_model()
tokenizer = tiktoken.get_encoding("cl100k_base")

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=600,
    chunk_overlap=80,
    length_function=lambda t: len(tokenizer.encode(t)),
    separators=["\n\n", "\n", ". ", " ", ""]
)


def compute_file_hash(file_path: Path) -> str:
    """Compute SHA-256 hash of the entire PDF file for idempotency."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


def format_doc_title(file_path: Path) -> str:
    """Derive clean human-readable title from PDF file name."""
    stem = file_path.stem
    return stem.replace("_", " ").replace("-", " ").title()


def extract_and_chunk_pdf(file_path: Path) -> List[Document]:
    """
    Extract text page-by-page from PDF and split into semantic LangChain Documents.
    Injects contextual header: 'Document: <Title> | Page: <PageNum>'.
    """
    reader = PdfReader(str(file_path))
    doc_title = format_doc_title(file_path)
    total_pages = len(reader.pages)
    documents: List[Document] = []
    chunk_index = 0

    for page_idx, page in enumerate(reader.pages, 1):
        try:
            page_text = page.extract_text() or ""
        except Exception as e:
            print(f"   ⚠️ Warning extracting page {page_idx} of {file_path.name}: {e}")
            continue

        page_text = page_text.strip()
        if not page_text or len(page_text) < 30:
            continue

        raw_splits = text_splitter.split_text(page_text)

        for split_text in raw_splits:
            token_count = len(tokenizer.encode(split_text))
            if token_count < 10:
                continue

            context_header = f"Document: {doc_title} | Page: {page_idx}\n\n"
            full_content = context_header + split_text

            doc = Document(
                page_content=full_content,
                metadata={
                    "source": str(file_path),
                    "file_name": file_path.name,
                    "document_title": doc_title,
                    "section_header": f"Page {page_idx}",
                    "page": page_idx,
                    "total_pages": total_pages,
                    "chunk_index": chunk_index,
                    "token_count": len(tokenizer.encode(full_content)),
                    "file_type": "pdf"
                }
            )
            documents.append(doc)
            chunk_index += 1

    return documents


async def embed_batch_langchain(texts: List[str]) -> List[List[float]]:
    """Embed a batch of text chunks using LangChain embeddings."""
    formatted = [f"passage: {t}" for t in texts]
    return await embeddings_model.aembed_documents(formatted)


async def ingest_single_pdf(
    conn: asyncpg.Connection,
    file_path: Path,
    organization_id: str = DEFAULT_TENANT_ID
) -> int:
    """Ingest a single PDF file with idempotency and transaction management."""
    file_hash = compute_file_hash(file_path)
    doc_title = format_doc_title(file_path)

    # 1. Idempotency Check
    existing = await conn.fetchrow(
        """
        SELECT id FROM documents 
        WHERE organization_id = $1::uuid AND content_hash = $2
        """,
        organization_id,
        file_hash
    )
    if existing:
        print(f"⏩ [SKIP] {file_path.name} (Already ingested and up-to-date)")
        return 0

    print(f"\n📚 [PDF Ingestion] Processing: {file_path.name}")
    print(f"   Title: '{doc_title}'")

    # 2. Extract & Chunk
    chunks = extract_and_chunk_pdf(file_path)
    total_chunks = len(chunks)
    if total_chunks == 0:
        print(f"   ⚠️ No text content found in {file_path.name}")
        return 0

    print(f"   📄 Extracted {total_chunks} chunks. Generating embeddings ({EMBEDDING_MODEL})...")

    # 3. Batch Embeddings in sub-batches
    all_embeddings: List[List[float]] = []
    for i in range(0, total_chunks, BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        texts = [c.page_content for c in batch]
        vecs = await embed_batch_langchain(texts)
        all_embeddings.extend(vecs)
        progress = min(i + BATCH_SIZE, total_chunks)
        print(f"      Embeddings progress: {progress}/{total_chunks} chunks ({progress*100//total_chunks}%)", end="\r", flush=True)

    print()

    # 4. Atomic PostgreSQL Transaction
    async with conn.transaction():
        # Remove any prior version of this file
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
            VALUES ($1::uuid, $2, $3, 'pdf', $4)
            RETURNING id
            """,
            organization_id,
            doc_title,
            str(file_path),
            file_hash
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
                c.metadata["chunk_index"],
                c.page_content,
                json.dumps(c.metadata),
                all_embeddings[idx]
            )
            for idx, c in enumerate(chunks)
        ]

        await conn.executemany(insert_chunk_sql, records)

    print(f"   ✅ Successfully indexed {total_chunks} chunks for '{doc_title}'")
    return total_chunks


async def ingest_pdf_directory(
    dir_path: str = "resources/pdfs",
    organization_id: str = DEFAULT_TENANT_ID,
    target_file: Optional[str] = None
):
    """
    Ingest all PDFs in dir_path or a specific single target PDF.
    """
    print("=" * 80)
    print("🚀 Starting SkillVault PDF Ingestion Pipeline (LangChain + pgvector)")
    print(f"   Source Directory: {dir_path}")
    print(f"   Embeddings: {type(embeddings_model).__name__} ({EMBEDDING_MODEL})")
    print(f"   Database: {DATABASE_URL}")
    print("=" * 80)

    conn = await asyncpg.connect(DATABASE_URL)
    await register_vector(conn)

    target_path = Path(dir_path).resolve()

    if target_file:
        pdf_files = [target_path / target_file] if (target_path / target_file).exists() else [Path(target_file).resolve()]
    elif target_path.is_file():
        pdf_files = [target_path]
    else:
        pdf_files = sorted(list(target_path.glob("*.pdf")))

    if not pdf_files:
        print(f"⚠️ No PDF files found in {target_path}")
        await conn.close()
        return

    print(f"\nDiscovered {len(pdf_files)} PDF file(s). Starting processing...\n")
    total_indexed = 0

    for pdf in pdf_files:
        if not pdf.exists():
            print(f"⚠️ File not found: {pdf}")
            continue
        count = await ingest_single_pdf(conn, pdf, organization_id=organization_id)
        total_indexed += count

    await conn.close()
    print("\n" + "=" * 80)
    print(f"🎉 PDF Ingestion Complete! Total new chunks indexed: {total_indexed}")
    print("=" * 80)


if __name__ == "__main__":
    import sys
    path_arg = sys.argv[1] if len(sys.argv) > 1 else "resources/pdfs"
    target_arg = sys.argv[2] if len(sys.argv) > 2 else None
    asyncio.run(ingest_pdf_directory(dir_path=path_arg, target_file=target_arg))
