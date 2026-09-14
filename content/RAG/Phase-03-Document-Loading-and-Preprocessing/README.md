# Phase 3: Document Loading and Preprocessing

## Overview

Every RAG system starts with the same unglamorous question: how do you actually get text *out* of the messy, real-world files your knowledge lives in? Phase 1 and Phase 2 assumed documents as clean strings — but production knowledge lives in PDFs, HTML pages, Word docs, scanned reports, and half-broken plain text files. This phase covers the "boring but essential" work that every RAG pipeline depends on: loading documents from different formats into a common representation, cleaning the extracted text so it's actually usable, and attaching metadata so you never lose track of where a piece of text came from. Skip this phase's lessons in a real system and you'll spend Phase 4 (chunking) and Phase 10 (RAG orchestration) debugging garbage that was baked in right here, at ingestion.

## Learning Objectives

By the end of Phase 3, you will be able to:

- Load documents from PDF, HTML, and plain text/Markdown sources into a common in-memory representation using `pypdf` and `BeautifulSoup`
- Explain why "loading a document" is really "parsing a format," and identify the gotchas specific to each format (layout loss, encoding, boilerplate)
- Design and implement a text-cleaning pipeline that removes boilerplate and normalizes whitespace without destroying meaningful structure
- Attach metadata (source, page number, section, timestamps) to every loaded document so it can be filtered and cited later in the course
- Recognize the common mistakes that silently corrupt a RAG pipeline at the ingestion stage, before retrieval or generation ever run

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-Loading-Documents.md | Loading PDFs, HTML, and plain text into a common representation | 2-3 hours |
| 02-Cleaning-and-Normalizing-Text.md | Building a cleaning pipeline: boilerplate removal, whitespace normalization | 2-3 hours |
| 03-Metadata-and-Structured-Content.md | Attaching metadata, handling tables and images | 2-3 hours |

**Total: 6-9 hours of focused study**

---

## File Index

### 01 - Loading Documents
`/Phase-03-Document-Loading-and-Preprocessing/01-Loading-Documents.md`

Starts from the problem that real-world knowledge doesn't arrive as neat strings — it's locked inside PDFs, HTML pages, Word docs, and plain text files, each with its own quirks. Introduces the "loader" abstraction (input file → parser library → plain text + basic structure) using a mailroom-sorting analogy, then walks through loading a PDF with `pypdf`, an HTML page with `BeautifulSoup`, and a plain `.txt`/`.md` file — each with runnable code and shown output.

Key topics:
- Why "loading a document" really means "parsing a format"
- The mailroom analogy: different envelope shapes, one common tray
- `pypdf`, `BeautifulSoup`, and plain-file loading, side by side
- Comparison table of loader types, libraries, and gotchas

---

### 02 - Cleaning and Normalizing Text
`/Phase-03-Document-Loading-and-Preprocessing/02-Cleaning-and-Normalizing-Text.md`

Raw extracted text is almost never ready to embed or chunk as-is — repeated headers/footers, broken line breaks, and encoding artifacts pollute it. This lesson frames cleaning as editing a rough transcript before publishing it, then builds a small, inspectable `clean_text()` pipeline with a before/after example.

Key topics:
- The editing-a-transcript analogy
- A cleaning pipeline: strip boilerplate → normalize whitespace → fix encoding → optional casing/dedup
- A regex-based `clean_text(raw: str) -> str` function
- Over-cleaning: when "cleaner" text destroys meaning (code blocks, tables)

---

### 03 - Metadata and Structured Content
`/Phase-03-Document-Loading-and-Preprocessing/03-Metadata-and-Structured-Content.md`

Plain text alone loses context: which document, which page, which section did this text come from? This lesson introduces attaching a metadata dictionary to every document/chunk, building a small `Document` dataclass, and previews how tables and images get handled (fully covered much later in the course).

Key topics:
- The library-card-catalog analogy
- A `Document` dataclass: `content: str`, `metadata: dict`
- Why metadata matters for later filtering (Phase 8) and citations
- Tables as markdown/JSON, images deferred to Phase 13

---

## How to Study This Phase

1. Read each file once for understanding without memorizing.
2. Run every code example locally against a real PDF, HTML page, and text file you have on hand — the gotchas only become real once you see them in your own output.
3. Do the hands-on exercises at the end of each file.
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Before moving to Phase 4, make sure you can explain, from memory, why cleaning must happen before chunking and why metadata must survive both steps.

## Prerequisites

Completion of Phase 1 (RAG Fundamentals) and Phase 2 (LLM and Embedding Basics). Comfort with Python, including reading library documentation for third-party packages (`pypdf`, `beautifulsoup4`) you may not have used before.

## What Comes Next

After completing Phase 3, proceed to:
- **Phase 4: Chunking Strategies** — how to split cleaned, metadata-tagged documents into the right-sized pieces for embedding and retrieval

---

> "Garbage in, garbage retrieved." — Phase 3 in one sentence.
