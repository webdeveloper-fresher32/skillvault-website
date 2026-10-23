# Phase 3: Document Loaders, Splitters, and Embeddings

## What You'll Learn

Ingest unstructured data from various sources (PDFs, Markdown, Web, Directories), split documents into semantically coherent chunks using modern text splitters, and generate vector embeddings to store in vector databases (Chroma, FAISS, pgvector).

## Learning Objectives

- Load heterogeneous data sources using `PyPDFLoader`, `WebBaseLoader`, `DirectoryLoader`, and lazy-loading generators.
- Apply chunking strategies (`RecursiveCharacterTextSplitter`, `MarkdownHeaderTextSplitter`, semantic chunking) with optimal token overlap.
- Instantiate embedding models (`OpenAIEmbeddings`, `HuggingFaceEmbeddings`) and index vectors into vector stores with metadata filtering.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Document-Loaders-and-Parsers.md](01-Document-Loaders-and-Parsers.md) | Document schema, PDF, Web, CSV, Directory loaders, lazy loading iterators | 1 day |
| [02-Text-Splitters-and-Chunking.md](02-Text-Splitters-and-Chunking.md) | Recursive character splitting, markdown header splitting, token length vs character length | 1 day |
| [03-Embeddings-and-Vector-Stores.md](03-Embeddings-and-Vector-Stores.md) | Embeddings interfaces, Chroma, FAISS, pgvector, metadata filtering and persistence | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 4: Retrieval Strategies and Advanced RAG](../Phase-04-Retrieval-Strategies-and-Advanced-RAG/README.md)
