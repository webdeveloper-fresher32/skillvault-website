# Module 1: Production RAG Roadmap & Document Loaders

Welcome to **Module 1**. This module sets up the mental model and ingestion foundation for building a production-grade Retrieval-Augmented Generation (RAG) system.

---

## 📑 Module Lessons

1. **[01-production-rag-architecture-roadmap.md](01-production-rag-architecture-roadmap.md)**
   - What is RAG and why standard LLMs fail on private enterprise documents.
   - The end-to-end production architecture: Ingestion pipeline vs. Retrieval pipeline.
   - Key system requirements: speed, accuracy, source citations, and hallucination prevention.

2. **[02-document-loaders-and-processing.md](02-document-loaders-and-processing.md)**
   - Ingestion starts with raw text: loading Text, Markdown, and PDF documents.
   - Structured metadata tracking (`source`, `tenant_id`, `created_at`, `checksum`).
   - Building a robust, multi-format document parser in Python.

---

[⬅️ Return to Main Curriculum Index](../README.md) | [Next Module: Chunking Strategies ➡️](../02-chunking-strategies/README.md)
