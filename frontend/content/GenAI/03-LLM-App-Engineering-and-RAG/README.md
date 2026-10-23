# Phase 6: LLM Application Engineering & RAG

> **Pillar 5 of 7: LLM Engineering** — LangChain, RAG, Vector DBs (Pinecone, FAISS)

## What You'll Learn

How to ground Large Language Models on proprietary enterprise data without retraining: modern prompt engineering patterns, schema-enforced structured outputs, document ingestion and chunking strategies, vector database architecture (`pgvector`, Pinecone, Qdrant), and production hybrid retrieval pipelines.

## Learning Objectives

- Master system prompting, few-shot in-context learning, prompt versioning, and grammar-constrained structured JSON outputs.
- Design and implement end-to-end RAG ingestion pipelines: PDF/Markdown parsing, fixed vs recursive character chunking, token overlap, and metadata filtering.
- Master vector databases, HNSW and IVFFlat index mechanics, cosine similarity queries in SQL with `pgvector`, and multi-stage hybrid search with cross-encoder reranking.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Prompt-Engineering-and-Structured-Outputs.md](01-Prompt-Engineering-and-Structured-Outputs.md) | System prompts, few-shot prompting, JSON schemas, Pydantic validation, and prompt evaluation | 1.5 days |
| [02-RAG-Architecture-and-Document-Chunking.md](02-RAG-Architecture-and-Document-Chunking.md) | The RAG problem space, document ingestion, chunking strategies, and token overlap boundaries | 1.5 days |
| [03-Vector-Databases-and-Retrieval-Pipelines.md](03-Vector-Databases-and-Retrieval-Pipelines.md) | Vector databases, pgvector HNSW indexing, cosine similarity, hybrid search, and cross-encoders | 1 day |

## Estimated Time

4 days

## Next Module

→ [07: AI Agents](../04-AI-Agents/README.md)
