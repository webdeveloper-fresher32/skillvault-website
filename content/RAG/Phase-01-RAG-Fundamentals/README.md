# Phase 1: RAG Fundamentals

## Overview

This phase builds the conceptual foundation for everything else in this course. Before touching a single vector database or embedding model, you need a rock-solid mental model of what RAG actually is, why it exists, and how its pieces fit together. Every later phase — chunking, vector stores, retrieval strategies, orchestration, evaluation — is really just "go deeper on one box in the diagram from Phase 1." If this phase clicks, the rest of the course will feel like filling in detail rather than learning something new.

## Learning Objectives

By the end of Phase 1, you will be able to:

- Explain what RAG is and why it exists, using the open-book vs. closed-book exam analogy
- Walk through the four-stage RAG flow (index → retrieve → augment → generate) from memory
- Clearly distinguish RAG from fine-tuning and from simply using a long context window, including when to reach for each
- Correct the most common misconceptions about RAG (it's not a database, it's not fine-tuning)
- Describe every stage of a full RAG architecture and map each stage to the phase of this course that covers it
- Confidently answer foundational RAG interview questions with concrete, memorable explanations

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-What-is-RAG.md | The core idea, the four-stage flow, common misconceptions | 2-3 hours |
| 02-RAG-vs-Fine-Tuning-vs-Long-Context.md | Comparing the three approaches to giving an LLM new knowledge | 2-3 hours |
| 03-RAG-Architecture-Overview.md | Full pipeline walkthrough, preview code, phase-by-phase roadmap | 3-4 hours |

**Total: 7-10 hours of focused study**

---

## File Index

### 01 - What is RAG
`/Phase-01-RAG-Fundamentals/01-What-is-RAG.md`

Starts from the problem: LLMs hallucinate, have a knowledge cutoff, and don't know your private data. Introduces RAG as "retrieve relevant context, then generate," using an open-book vs. closed-book exam analogy. Walks through the four-stage flow (index → retrieve → augment → generate) with a diagram and a worked example, then clears up the most common misconceptions before they cause confusion later in the course.

Key topics:
- Why LLMs alone aren't enough (hallucination, staleness, no private data)
- The open-book exam analogy
- Index → Retrieve → Augment → Generate
- "RAG isn't a database" and "RAG isn't fine-tuning"

---

### 02 - RAG vs Fine-Tuning vs Long Context
`/Phase-01-RAG-Fundamentals/02-RAG-vs-Fine-Tuning-vs-Long-Context.md`

Three different ways to get new or private knowledge into an LLM's answers, each with sharply different cost, freshness, latency, and complexity trade-offs. This lesson builds a decision framework so you can justify choosing RAG (or not) in a design discussion or interview.

Key topics:
- Hiring a researcher with a library card vs. sending someone through years of training vs. handing them a stack of papers every time
- Comparison table: cost, freshness, latency, explainability, implementation complexity
- "Use RAG when..." decision guidance
- Why RAG and fine-tuning are complementary, not exclusive

---

### 03 - RAG Architecture Overview
`/Phase-01-RAG-Fundamentals/03-RAG-Architecture-Overview.md`

Zooms out to the full pipeline: ingestion, chunking, embedding, vector storage, query embedding, similarity search, context assembly, prompt construction, generation, and response. Includes a bare-bones pseudocode RAG loop (no real API calls yet) and a table mapping each stage to the exact phase later in this course where you'll implement it for real.

Key topics:
- The librarian + card catalog + reference desk analogy
- Full ASCII pipeline diagram
- ~20-line pseudocode RAG loop
- Stage-to-phase roadmap for the rest of the course
- Why RAG fails at the seams between stages, not usually inside one stage

---

## How to Study This Phase

1. Read each file once for understanding without memorizing.
2. After each section, close the file and explain the concept out loud in your own words (Feynman technique).
3. Do the hands-on exercises at the end of each file — they only require Python.
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Come back after a day or two and re-explain the four-stage flow and the RAG-vs-fine-tuning-vs-long-context table from memory.

## Prerequisites

Comfort with Python and a general sense of what an LLM is (you don't need prior RAG or vector database experience — that's what this course builds).

## What Comes Next

After completing Phase 1, proceed to:
- **Phase 2: LLM & Embedding Basics** — how embeddings turn text into vectors, and what actually happens inside the LLM call in a RAG pipeline

---

> "You don't need a bigger brain. You need a better library card." — Phase 1 in one sentence.
