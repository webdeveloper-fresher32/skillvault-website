# Project 02 — Production RAG Document Assistant with pgvector

## Goal

Build an end-to-end, production-grade Retrieval-Augmented Generation (RAG) assistant that ingests PDF documents, chunks content, stores dense vectors in PostgreSQL using `pgvector`, executes hybrid similarity retrieval, and streams grounded answers with citations.

## What You'll Build

A full-stack RAG service consisting of:
1. An ingestion worker that extracts text from PDFs, applies recursive chunking with token overlap, generates embeddings, and inserts them into PostgreSQL `pgvector`.
2. A FastAPI backend that coordinates hybrid search (dense embeddings + PostgreSQL full-text search) with cross-encoder reranking, builds prompt contexts, and streams answers using Server-Sent Events (SSE).
3. Exact citation tracking indicating which page, paragraph, and chunk contributed to each claim in the response.

## Phases Required

- Phase 04 — Transformers (Tokenization, Embeddings, Attention)
- Phase 05 — LLM Fundamentals (Token Economics, Context Windows, Sampling)
- Phase 06 — LLM Application Engineering & RAG (Chunking, Vector DBs, Hybrid Search)
- Phase 08 — AI Backend & Serving (SSE Token Streaming, Async FastAPI)

## Requirements

- **Document Ingestion**:
  - Parse multi-page PDFs extracting text and metadata (source filename, page number).
  - Split text using a recursive character splitter with configurable chunk size (e.g. 500 tokens) and overlap (50 tokens).
  - Embed chunks using an embedding model API (`text-embedding-3-small` or local sentence-transformers).
- **PostgreSQL pgvector Store**:
  - Database schema with `document_chunks` table storing `content`, `metadata` (JSONB), and `embedding` (`vector(1536)`).
  - An HNSW index (`vector_cosine_ops`) for sub-10ms nearest neighbor queries.
  - A TSVector column and GIN index for lexical full-text search.
- **Hybrid Retrieval & Reranking**:
  - Execute dense cosine similarity query and sparse full-text search query in parallel.
  - Combine scores using Reciprocal Rank Fusion (RRF).
  - Optional cross-encoder reranker selecting top-k most relevant chunks.
- **FastAPI Streaming Backend**:
  - `POST /ingest` accepting file uploads.
  - `POST /chat` accepting query and session ID, returning a `text/event-stream` SSE response streaming tokens to the client.
  - Formatted citations payload returned at the end of the stream citing document names and page numbers.

## Suggested Approach

1. Spin up a local PostgreSQL container with the `pgvector/pgvector:pg16` image via Docker Compose.
2. Initialize the database schema with extensions, tables, and HNSW indexes.
3. Write `ingest.py` using `pypdf` or `pdfplumber` to extract text page-by-page. Implement chunking with sentence boundary preservation.
4. Implement hybrid search in SQL: combine `embedding <=> query_vector` with `to_tsquery('english', query)` using RRF in a single query or two-stage CTE.
5. Create the FastAPI application with `StreamingResponse`. Ingest prompt chunks into a system prompt that mandates strict adherence to retrieved facts.
6. Connect an OpenAI, Anthropic, or local vLLM client to stream tokens via SSE.

## Stretch Goals

- Add contextual compression to strip out irrelevant sentences from retrieved chunks before feeding them to the LLM context.
- Implement multi-tenant isolation with Row-Level Security (RLS) in PostgreSQL so users only retrieve documents belonging to their organization.
- Build a lightweight React/Next.js frontend demonstrating real-time token streaming and clickable citations opening the PDF viewer at the exact cited page.

## Evaluation Checklist

- [ ] Ingestion script processes a 20-page PDF, generates embeddings, and populates `document_chunks` table within < 30 seconds.
- [ ] PostgreSQL HNSW index is verified with `EXPLAIN ANALYZE` confirming index scan rather than sequential scan.
- [ ] Asking questions answered in the document produces accurate, factual answers citing specific document pages.
- [ ] Asking out-of-domain questions not contained in the documents triggers a graceful "I cannot find this information in the provided documents" response without hallucinations.
- [ ] Token streaming via SSE begins within < 800ms Time-to-First-Token (TTFT).
