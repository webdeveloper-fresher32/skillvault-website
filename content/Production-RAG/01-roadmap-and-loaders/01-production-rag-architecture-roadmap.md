> 📚 **[Production RAG Curriculum](../README.md)** | ➡️ [Module 1.2: Document Loaders and Document Processing](02-document-loaders-and-processing.md)

---

# Production RAG — Complete Learning Roadmap with Code

Let's learn this one by one, man. We'll approach it as a **production-level backend engineering project**, not just theory. We'll understand why each component exists, how it works internally, and how to implement it using Python.

Since your goal is to build real AI applications, we'll use a practical project throughout: **an AI-powered document assistant that answers questions from PDFs and internal company documents, with citations.**

![Retrieval-Augmented Generation (RAG) Architecture Overview](/images/production-rag/rag-architecture-overview.png)

### Our project: Production RAG Assistant

Example: Upload a company's refund policy and ask, “How long do customers have to request a refund?”
The assistant should retrieve the relevant policy section, give an accurate answer, cite the source, and say when the documents don't contain enough information.

## 1. What exactly is RAG?

RAG stands for **Retrieval-Augmented Generation**.

A normal LLM answers using the information available to it from training and its current context. It might not know your private documents or the latest company policies.

RAG solves this by retrieving relevant information from your own data and giving it to the LLM before it generates an answer.

```
[Your Documents]
(PDFs, websites, DOCX, database records)
       │
       ▼
[Ingestion Pipeline]
(Load ──► Clean ──► Chunk ──► Embed ──► Store)
       │
       ▼
[Retrieval Pipeline]
(Question ──► Search ──► Filter ──► Rerank)
       │
       ▼
[LLM + Retrieved Context]
(Generate a grounded answer with citations)
```

### A simple example

Suppose your document contains:

> Customers may request a refund within 30 days of purchase. Approved refunds are processed within 5–7 business days.

The user asks: “What is the refund period?”

1. The system converts the question into a searchable representation.
2. It retrieves the relevant document chunk.
3. It sends the question and chunk to the LLM.
4. The LLM answers: “Customers can request a refund within 30 days of purchase.”
5. The application returns the source citation.

**Important:** RAG is not model training. You're providing relevant external information to the model at query time.

## 2. The complete production RAG syllabus

We'll cover the core production topics in this systematic sequence:

### 📄 Module 1 — Document Loading and Cleaning
PDFs, text extraction, metadata preservation, OCR, document loaders, parsing failure isolation.

---

### ✂️ Module 2 — Chunking Strategies
Fixed-size, overlapping, recursive character splitting, semantic boundaries, and parent-child chunking.

---

### 📐 Module 3 — Embeddings and Similarity Search
Dense vectors, high-dimensional spaces, cosine similarity, distance metrics, semantic retrieval intuition.

---

### 🗄️ Module 4 — Vector Databases & pgvector
PostgreSQL + pgvector, Pinecone, Qdrant, Weaviate, HNSW and IVFFlat indexing strategies.

---

### 🔍 Module 5 — Retrieval and Metadata Filtering
Top-k retrieval, tenant isolation, permissions filtering, date and document constraints.

---

### ⚡ Module 6 — Hybrid Search and Reranking
Combining BM25 keyword search with vector embeddings, Reciprocal Rank Fusion (RRF), Cross-Encoder rerankers.

---

### 🔄 Module 7 — Query Rewriting and Compression
Handling conversational ambiguity, query expansion, multi-query retrieval, and contextual compression.

---

### 🧠 Module 8 — Grounding, Citations and Evaluation
Hallucination controls, verifiable source citations, RAG evaluation metrics (faithfulness, answer relevance).

---

### 🚀 Module 9 — Production Deployment & FastAPI
FastAPI async endpoints, streaming SSE responses, background task ingestion, caching, and Docker.

We'll use two weeks as a target, but focus on building and understanding the working system rather than rushing through topics.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ➡️ [Next: Module 1.2: Document Loaders and Document Processing](02-document-loaders-and-processing.md)
