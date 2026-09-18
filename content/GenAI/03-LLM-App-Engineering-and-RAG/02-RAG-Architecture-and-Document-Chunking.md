# RAG Architecture and Document Chunking — Complete Guide

> "A doctor doesn't memorize every single clinical study published in the world this morning; they consult the patient's medical file and the latest journal papers during the appointment before making an informed diagnosis."

---

## Table of Contents

1. [The Problem: The Knowledge Cutoff and Hallucination Trap](#1-the-problem-the-knowledge-cutoff-and-hallucination-trap)
2. [The Open-Book Exam Analogy](#2-the-open-book-exam-analogy)
3. [The Mechanism: The RAG Pipeline and Chunking Strategies](#3-the-mechanism-the-rag-pipeline-and-chunking-strategies)
4. [Diagram: The Complete End-to-End RAG Architecture](#4-diagram-the-complete-end-to-end-rag-architecture)
5. [Code Walkthrough: Recursive Document Chunking from Scratch](#5-code-walkthrough-recursive-document-chunking-from-scratch)
6. [Comparing Chunking Strategies: Fixed vs Recursive vs Semantic](#6-comparing-chunking-strategies-fixed-vs-recursive-vs-semantic)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Knowledge Cutoff and Hallucination Trap

Large Language Models possess extraordinary linguistic reasoning capabilities, but they suffer from two fatal limitations when deployed in enterprise software:
1. **The Knowledge Cutoff Date**: A model trained in January 2024 knows nothing about news, regulatory updates, or stock movements that occurred in February 2024.
2. **Zero Access to Private Enterprise Data**: A frontier foundation model knows nothing about your company's proprietary Confluence wikis, customer support tickets, internal codebases, or confidential PDF contracts.
3. **Hallucination under Uncertainty**: When prompted about facts it does not know, the model cannot verify truth; it generates plausible-sounding, confident falsehoods.

### Why Fine-Tuning Is the Wrong Solution for Knowledge

A common rookie mistake is attempting to inject private enterprise documents by fine-tuning the model's weights:
- Fine-tuning is slow, computationally expensive, and requires GPU retraining on every document update.
- Weights are "fuzzy" associative storage: a fine-tuned model cannot reliably cite page numbers or paragraph sources.
- Fine-tuning cannot enforce user access control lists (ACLs) — if an HR salary document is baked into the model weights, any user can prompt the model to reveal it.

### What RAG Solves

**Retrieval-Augmented Generation (RAG)** decouples **reasoning** from **knowledge**:
- The LLM acts as the reasoning engine.
- An external database (e.g. PostgreSQL with `pgvector`) acts as the dynamic, non-parametric knowledge store.
- When a user asks a question, relevant document excerpts are retrieved in real-time and injected directly into the prompt context, forcing the model to answer strictly based on verified, cited facts.

---

## 2. The Open-Book Exam Analogy

Consider the difference between a closed-book memory test and an open-book research exam.

### Parametric Memory vs Grounded Retrieval

```text
Closed-Book Memory (Pure LLM without RAG):
  Student sits in an empty room with no notes.
  - Must rely strictly on what was memorized during pretraining.
  - If they forget a fact, they guess or hallucinate plausible details.
  - Cannot quote exact clause numbers or show citations.

Open-Book Research (RAG - Retrieval-Augmented Generation):
  Student sits in a library with an assistant search engine.
  - When asked: "What is Acme Corp's refund policy on software licenses?"
  - Assistant pulls the exact 3 relevant paragraphs from the 2026 Policy Manual.
  - Student reads the retrieved paragraphs and writes an accurate answer:
    "According to Section 4.2 (Page 18), software licenses are refundable within 14 days..."
  - Factual, up-to-date, and 100% auditable with page citations.
```

---

## 3. The Mechanism: The RAG Pipeline and Chunking Strategies

A production RAG pipeline consists of two distinct workflows: **Ingestion** (offline) and **Retrieval & Generation** (online).

### 1. The Ingestion Pipeline

1. **Document Loading**: Extracting raw text from diverse formats (PDFs, Markdown, Word, Notion, HTML) using specialized parsers (`pypdf`, `pdfplumber`, `unstructured`).
2. **Chunking**: Splitting massive documents into smaller passages (chunks). Why is chunking mandatory?
   - You cannot embed a 200-page PDF as a single vector: averaging the meaning of 200 pages produces a muddy, uninformative vector that matches nothing.
   - Chunks must be small enough to be semantically specific, yet large enough to preserve self-contained context.
3. **Embedding**: Converting each text chunk into a high-dimensional vector using an embedding model (e.g. `text-embedding-3-small`).
4. **Vector Storage**: Storing the embedding vector, raw text chunk, and metadata (source file, author, page number, tenant ID) in an indexed vector database.

### 2. Chunking Strategies in Depth

The choice of chunking strategy is often the single biggest determinant of RAG retrieval quality:

- **Fixed-Character Chunking**:
  - Splits text strictly every $N$ characters (e.g. 1000 characters).
  - Fast, but naive: words and sentences get sliced in half (`"super-"` and `"conductor"` separated into different chunks), destroying meaning.
- **Recursive Character Splitting (The Gold Standard)**:
  - Tries to split on the largest semantic boundary first (paragraph breaks `\n\n`).
  - If a paragraph is still larger than the chunk size, it splits on sentence boundaries (`\n`, `. `, `? `).
  - If a sentence is still too large, it falls back to word boundaries (` `).
  - Guarantees chunks preserve grammatical and conceptual coherence.
- **Token Overlap**:
  - Adding a rolling overlap (e.g. 500-token chunks with 50-token overlap) ensures that sentences spanning the split boundary are not cut off, preserving continuity between adjacent chunks.
- **Document-Structure Aware Chunking**:
  - Respects Markdown headers (`#`, `##`, `###`), HTML tags (`<article>`, `<table>`), or PDF page breaks. Every chunk inherits its section header as metadata context.
- **Semantic Chunking**:
  - Splits a document into individual sentences, embeds each sentence, and calculates cosine distance between adjacent sentences. When the distance between sentence $t$ and sentence $t+1$ exceeds a statistical threshold, a new chunk is created, ensuring chunks only split when topics shift.

---

## 4. Diagram: The Complete End-to-End RAG Architecture

```text
OFFLINE INGESTION PIPELINE:
  [ Raw PDFs / Docs ] ──► [ Document Parser ] ──► [ Recursive Chunker ]
                                                           │
                                                           ▼
  [ Vector DB (pgvector) ] ◄── [ Embeddings API ] ◄── Text Chunks + Metadata

ONLINE RETRIEVAL & GENERATION PIPELINE:
  User Query: "What is the warranty period on Model X?"
       │
       ▼
  [ Embed Query ] ──► [ Similarity Search in Vector DB ] ──► Top-3 Relevant Chunks
                                                                   │
                                                                   ▼
  Prompt Assembly:
  ┌────────────────────────────────────────────────────────────────┐
  │ SYSTEM: Answer strictly using the provided context chunks.     │
  │ CONTEXT CHUNKS:                                                │
  │ [Chunk 1]: "Model X comes with a 3-year limited warranty..."   │
  │ USER QUERY: "What is the warranty period on Model X?"          │
  └───────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
                     [ LLM Generation (FastAPI) ]
                                  │
                                  ▼
      "Model X includes a 3-year limited warranty (Source: Manual, P. 12)"
```

---

## 5. Code Walkthrough: Recursive Document Chunking from Scratch

Here is an end-to-end Python implementation of a production Recursive Character Splitter with token counting and sliding overlap:

```python
import re
from typing import List, Dict

class ProductionRecursiveChunker:
    def __init__(
        self, 
        chunk_size: int = 500, 
        chunk_overlap: int = 50,
        separators: List[str] = None
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        # Hierarchical separators: double-newline -> single-newline -> sentence -> space
        self.separators = separators or ["\n\n", "\n", ". ", "? ", "! ", " "]

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        if not text:
            return []
        
        # If no separators left, split on character level
        if not separators:
            return list(text)

        sep = separators[0]
        remaining_separators = separators[1:]

        # Split text on current separator
        if sep == " ":
            splits = text.split(" ")
        else:
            splits = text.split(sep)

        chunks = []
        current_chunk = []
        current_length = 0

        for s in splits:
            # Re-attach the separator if it wasn't whitespace
            piece = s if sep in ["\n\n", "\n"] else (s + (sep if sep != " " else ""))
            piece_len = len(piece)

            if piece_len > self.chunk_size:
                # Piece is individually too large! Recurse on remaining separators
                sub_splits = self._split_text(piece, remaining_separators)
                for sub in sub_splits:
                    if current_length + len(sub) > self.chunk_size:
                        if current_chunk:
                            chunks.append("".join(current_chunk).strip())
                            current_chunk = []
                            current_length = 0
                    current_chunk.append(sub)
                    current_length += len(sub)
            else:
                if current_length + piece_len > self.chunk_size:
                    if current_chunk:
                        chunks.append("".join(current_chunk).strip())
                        # Calculate overlap: retain trailing pieces from previous chunk
                        overlap_pieces = []
                        overlap_len = 0
                        for p in reversed(current_chunk):
                            if overlap_len + len(p) <= self.chunk_overlap:
                                overlap_pieces.insert(0, p)
                                overlap_len += len(p)
                            else:
                                break
                        current_chunk = overlap_pieces
                        current_length = overlap_len
                
                current_chunk.append(piece)
                current_length += piece_len

        if current_chunk:
            chunks.append("".join(current_chunk).strip())

        return [c for c in chunks if c]

    def chunk_document(self, document_text: str, metadata: Dict) -> List[Dict]:
        raw_chunks = self._split_text(document_text, self.separators)
        results = []
        for idx, chunk in enumerate(raw_chunks):
            chunk_metadata = metadata.copy()
            chunk_metadata["chunk_index"] = idx
            chunk_metadata["char_count"] = len(chunk)
            results.append({
                "content": chunk,
                "metadata": chunk_metadata
            })
        return results

# Test the Recursive Chunker on technical documentation
sample_doc = """# Microservice Resilience Architecture

In modern cloud systems, microservices must survive transient network partitions. 
Circuit breakers prevent catastrophic cascading failures when a downstream database becomes unresponsive.

## The Circuit Breaker Pattern

A circuit breaker wraps a protected function call in a monitor object. The breaker operates in three distinct states:

1. Closed: Requests flow normally. Failures are counted against a threshold.
2. Open: Requests fail immediately without attempting to call the failing downstream dependency.
3. Half-Open: After a sleep window, a trial batch of requests is permitted through to test recovery.

## Implementing Timeouts and Retries

Retries should always be paired with exponential backoff and randomized jitter to prevent the 'thundering herd' problem against recovering databases."""

chunker = ProductionRecursiveChunker(chunk_size=200, chunk_overlap=30)
chunks = chunker.chunk_document(sample_doc, metadata={"doc_id": "resilience-guide-v1", "source": "wiki"})

print(f"Generated {len(chunks)} chunks from document:\n")
for c in chunks:
    print(f"--- Chunk {c['metadata']['chunk_index']} ({c['metadata']['char_count']} chars) ---")
    print(c["content"])
    print()
```

---

## 6. Comparing Chunking Strategies: Fixed vs Recursive vs Semantic

### Chunking Trade-Off Matrix

| Strategy | Speed | Boundary Integrity | Semantic Coherence | Best Production Use Case |
|---|---|---|---|---|
| **Fixed-Character / Token** | Extremely Fast ($O(N)$) | Poor (slices sentences & words mid-stream) | Low | Quick prototypes, raw unformatted log data. |
| **Recursive Character** | Fast ($O(N)$ with hierarchical splits) | **High** (respects paragraphs and sentences) | **High** | **Universal standard for unstructured text & articles**. |
| **Markdown / Header Aware** | Fast ($O(N)$ regex parsing) | **Excellent** (respects `#` structure) | **Very High** | API documentation, technical wikis, GitHub codebases. |
| **Semantic Chunking** | Slow (requires $N$ embedding API calls) | Variable | Maximum (splits strictly at topic shifts) | Dense academic papers, transcripts with no punctuation. |

---

## 7. Common Mistakes

- **Chunking without token overlap.** Splitting text cleanly down the middle with zero overlap frequently severs critical context: the question is in Chunk 1, but the answering clause is in Chunk 2. Always maintain a $10\%–15\%$ token overlap.
- **Selecting chunk sizes that are too small (< 100 tokens).** Chunks containing only two sentences often lose referential context. The chunk might say `"It was approved on Tuesday"`, but because the preceding sentence mentioning the project name was sliced into the previous chunk, the embedding vector fails to match search queries.
- **Selecting chunk sizes that are too large (> 1500 tokens).** Oversized chunks average too many disparate ideas into one embedding vector, diluting cosine similarity scores and inflating context window consumption.
- **Throwing away document metadata.** Storing only raw text without attaching `document_id`, `page_number`, `created_at`, or `user_role` makes it impossible to implement access control filtering or display accurate user-facing citations.

---

## 8. Hands-On Exercises

**Exercise 1:** Parse a real-world multi-page PDF using `pypdf` in Python, extracting text page-by-page and attaching `page_number` to each page's metadata dictionary.

**Exercise 2:** Implement a Markdown Header Splitter: write a function that splits a document on `#`, `##`, and `###` headers, prepending the parent header path (e.g. `"Microservices > Circuit Breaker > Retries"`) to every chunk's text to preserve hierarchical context.

**Exercise 3:** Measure token counts accurately: use `tiktoken` (with the `cl100k_base` encoding) to count tokens instead of characters in your chunker, guaranteeing chunks never exceed model embedding limit sizes.

**Exercise 4:** Implement Semantic Chunking: split a paragraph into 10 sentences, embed each sentence with an embedding model, calculate cosine distances between consecutive pairs, and split into chunks wherever cosine distance $> 0.35$.

**Exercise 5:** Build a Citation Formatter: write a function that takes retrieved chunks with metadata and formats a citation footer: `[1] Architecture Guide, Page 14` with hyperlinks to source documents.

---

## 9. Interview Q&A

**Q: What is the difference between Parametric Memory and Non-Parametric Memory in RAG systems?**
- **Parametric Memory**: The static knowledge encoded directly into the neural network's weights and biases during pretraining and fine-tuning. It cannot be easily inspected, edited, or deleted, is frozen at the training cutoff date, and is prone to hallucination.
- **Non-Parametric Memory**: External, dynamic storage (such as a PostgreSQL vector database or document index) external to the neural network. It can be updated, inserted, or deleted in real-time in milliseconds, supports granular role-based access control (RBAC), and allows the model to produce exact citations without retraining. RAG combines the non-parametric memory of vector databases with the parametric reasoning of LLMs.

**Q: Why is chunk overlap essential in RAG ingestion pipelines?**
Text is written with continuous narrative and logical flow. If a document is split strictly into 500-token chunks with zero overlap, a critical sentence, definition, or table can be bisected across the boundary (e.g. the subject in Chunk 1 and the predicate in Chunk 2). An embedding model encoding Chunk 1 will fail to capture the complete concept, and an incoming search query will miss the chunk. A sliding overlap (e.g. 50–100 tokens) ensures that every boundary transition is duplicated across adjacent chunks, preserving semantic completeness.

**Q: How does chunk size affect retrieval precision versus generation context?**
This is the fundamental **RAG Chunk Size Tradeoff**:
- **Small Chunks (e.g. 128–256 tokens)**: Excel at retrieval precision. The embedding vector is dense and focused on a single specific concept, yielding high cosine similarity matches with targeted user queries. However, they may lack surrounding context, leaving the generator model without enough background to compose a complete answer.
- **Large Chunks (e.g. 1024–2048 tokens)**: Excel at generation context, providing the model with rich narrative context. However, retrieval precision degrades because the embedding vector averages multiple disparate concepts, lowering cosine similarity against specific queries and filling the LLM's context window with irrelevant filler.

**Q: What is the Parent-Document (or Small-to-Big) Retrieval strategy?**
To resolve the chunk size tradeoff, Parent-Document Retrieval splits documents into two linked layers:
1. Small child chunks (e.g. 128 tokens) are embedded and indexed in the vector database for high-precision retrieval matching.
2. Each child chunk stores a foreign-key pointer to its larger parent chunk (e.g. 1024 tokens or full section) stored in a key-value store (e.g. Redis or PostgreSQL).
During retrieval, similarity search matches against the granular child chunk, but the system pulls the larger **parent chunk** to feed into the LLM context window, delivering optimal retrieval precision and optimal generation context simultaneously.

**Q: What is Document Metadata Filtering, and why is it critical for enterprise security?**
In an enterprise, different employees have different security clearance levels (e.g. HR salary data vs public engineering documentation). Vector search based purely on semantic similarity does not understand access controls; without filtering, an unauthorized user asking `"What is the CEO's bonus?"` could retrieve confidential HR chunks. Metadata filtering attaches structured tags (e.g. `tenant_id`, `department: 'HR'`, `access_level: 'admin'`) to vector embeddings. In PostgreSQL `pgvector`, search queries apply SQL `WHERE` clauses (e.g. `WHERE metadata->>'department' = user_dept`) *before* or during nearest-neighbor ranking, guaranteeing mathematical isolation and compliance.
