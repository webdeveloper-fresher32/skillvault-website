# Phase 4: Chunking Strategies

## Overview

Phase 3 got your raw documents cleaned up and loaded into memory as plain text. But you can't hand an LLM (or an embedding model) an entire 200-page manual as one unit — it's too big to embed meaningfully, and even if it fit, retrieving "the whole manual" for every query defeats the point of retrieval. Chunking is the step where you decide how to break documents into the pieces that actually get embedded, stored, and retrieved. Get chunking wrong and every later phase inherits the damage: bad chunks mean bad retrieval (Phase 8) no matter how good your vector database (Phases 5-7) or reranker (Phase 9) is. This phase walks through the full spectrum of chunking strategies, from naive fixed-size splitting to semantic and parent-document approaches, and builds the judgment to pick the right one for a given document type.

## Learning Objectives

By the end of Phase 4, you will be able to:

- Implement fixed-size chunking with overlap by hand, and explain why overlap matters
- Use `RecursiveCharacterTextSplitter` and explain how its boundary-priority order (paragraph → sentence → word) improves on naive fixed-size splitting
- Explain semantic chunking (splitting on meaning shifts detected via embedding similarity) and sentence-window retrieval, and know when each is worth its extra cost
- Implement parent-document retrieval, where small chunks are embedded for precision but a larger parent chunk is returned for context
- Choose an appropriate chunk size, overlap, and strategy based on document type (FAQ, technical manual, code) and downstream use case
- Diagnose chunking-related retrieval failures (split mid-sentence, lost context, duplicated content) and explain the fix in an interview setting

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-Fixed-Size-and-Recursive-Chunking.md | Naive fixed-size chunking with overlap, then recursive character splitting | 2-3 hours |
| 02-Semantic-and-Sentence-Window-Chunking.md | Meaning-aware chunking and sentence-window retrieval | 2-3 hours |
| 03-Parent-Document-Retrieval-and-Choosing-Chunk-Size.md | Parent-document retrieval and a practical decision guide for chunk size | 2-3 hours |

**Total: 6-9 hours of focused study**

---

## File Index

### 01 - Fixed-Size and Recursive Chunking
`/Phase-04-Chunking-Strategies/01-Fixed-Size-and-Recursive-Chunking.md`

Starts from the core tension: documents are too big to embed whole, but chunk carelessly and you slice a sentence in half. Covers hand-rolled fixed-size chunking with overlap, then `RecursiveCharacterTextSplitter`, which tries to split along paragraph, then sentence, then word boundaries before falling back to a hard character cut.

Key topics:
- Fixed-size character/token chunking with overlap
- Recursive character splitting and its boundary-priority list
- Comparing raw output of both approaches on the same text
- Overlap sizing mistakes and token-vs-character mismatches

---

### 02 - Semantic and Sentence-Window Chunking
`/Phase-04-Chunking-Strategies/02-Semantic-and-Sentence-Window-Chunking.md`

Goes beyond structural splitting to meaning-aware splitting. Covers semantic chunking (embed sentences, detect a similarity drop, split there) and sentence-window retrieval (index small precise chunks but retrieve a window of surrounding sentences at query time).

Key topics:
- Why structural splitting still misses topic shifts mid-paragraph
- Semantic chunking with sentence embeddings and a similarity threshold
- Sentence-window indexing and retrieval
- When the extra compute cost of semantic chunking is (and isn't) worth it

---

### 03 - Parent-Document Retrieval and Choosing Chunk Size
`/Phase-04-Chunking-Strategies/03-Parent-Document-Retrieval-and-Choosing-Chunk-Size.md`

Resolves the small-chunk-vs-large-chunk tradeoff directly: embed small child chunks for precise matching, but return the larger parent document or section they came from so the LLM has full context. Closes with a practical decision guide for chunk size and overlap across document types.

Key topics:
- Parent-document retrieval: child-to-parent chunk mapping
- A toy retrieval function that looks up the parent from a matched child
- Decision guide: chunk size/overlap by document type and use case
- Why "one chunk size fits all" breaks down across a real document collection

---

## How to Study This Phase

1. Read each file once for understanding without memorizing.
2. Run every code example yourself, even the toy ones — the intuition for chunk boundaries only sticks once you've seen the actual output split in front of you.
3. Do the hands-on exercises at the end of each file.
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. After finishing all three files, pick one real document type you actually work with and decide, from memory, what chunking strategy and size you'd use for it.

## Prerequisites

Phase 1 (RAG Fundamentals), Phase 2 (LLM & Embedding Basics), and Phase 3 (Document Loading & Preprocessing) — you should already be comfortable with what embeddings are and have clean, loaded document text ready to chunk.

## What Comes Next

After completing Phase 4, proceed to:
- **Phase 5: Vector Databases - Chroma** — taking the chunks produced in this phase and actually embedding and storing them for retrieval

---

> "A document isn't retrieved — a chunk is. Everything downstream is only as good as the cut you made here." — Phase 4 in one sentence.
