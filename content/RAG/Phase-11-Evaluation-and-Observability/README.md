# Phase 11: Evaluation & Observability

## Overview

Every phase up to this point taught you how to *build* a piece of a RAG pipeline — load, chunk, embed, store, retrieve, rerank, orchestrate. None of them told you how to know, objectively, whether the thing you built is actually good, or how to figure out which piece is at fault when it isn't. "It seems to work" is fine for a demo; it is not fine once real users are asking real questions against a system with eight moving stages, any one of which can quietly misbehave. This phase closes that gap: it gives you a vocabulary and a toolkit for measuring RAG quality objectively, tracing a query through every stage of the pipeline so you can see exactly where it went wrong, and a systematic checklist for fixing bad retrieval once you've found it — rather than guessing.

## Learning Objectives

By the end of Phase 11, you will be able to:

- Explain why "the answer looks right" isn't sufficient evaluation for a production RAG system, and name the specific failure modes that objective metrics catch
- Define and distinguish the four core RAG evaluation metrics — faithfulness, answer relevance, context precision, and context recall — and know what a low score in each one indicates is broken
- Implement a simplified LLM-as-judge faithfulness check that compares a generated answer against retrieved context
- Design a structured trace that captures every stage of a RAG pipeline (query, retrieved chunks, reranked order, final prompt, generated answer) as one inspectable record
- Work through a systematic debugging checklist for bad retrievals, tying each likely cause back to the specific earlier phase that addresses it
- Avoid the two most common evaluation/observability mistakes: judging only the final answer while ignoring retrieval quality, and changing multiple pipeline variables at once while debugging

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-RAG-Evaluation-Metrics.md | Faithfulness, answer relevance, context precision, context recall; LLM-as-judge | 2-3 hours |
| 02-Tracing-a-RAG-Pipeline.md | Structured tracing across every pipeline stage; intro to observability tools | 2-3 hours |
| 03-Debugging-Bad-Retrievals.md | A systematic checklist for diagnosing and fixing bad retrieval | 2-3 hours |

**Total: 6-9 hours of focused study**

---

## File Index

### 01 - RAG Evaluation Metrics
`/Phase-11-Evaluation-and-Observability/01-RAG-Evaluation-Metrics.md`

Starts from the problem: once a RAG system is in production, "it seems to work" isn't good enough — you need objective, repeatable measurements. Introduces the four RAGAS-style metrics (faithfulness, answer relevance, context precision, context recall) using a teacher-grading-an-essay analogy, and builds a simplified LLM-as-judge faithfulness check using the Claude API.

Key topics:
- The teacher-grading-an-essay analogy
- Faithfulness vs. answer relevance vs. context precision vs. context recall
- A Claude-API-based grounded/ungrounded verdict check
- Why checking only answer quality can mask a retrieval problem as a prompting problem

---

### 02 - Tracing a RAG Pipeline
`/Phase-11-Evaluation-and-Observability/02-Tracing-a-RAG-Pipeline.md`

Starts from the problem: when an answer is wrong, which of the six-plus stages actually broke? Introduces structured tracing — logging the query, retrieved chunk ids and scores, reranked order, final prompt, and generated answer as one traceable record — using a package-tracking-number analogy, and builds a `RAGTrace` dataclass on top of Phase 10's `run_pipeline` function.

Key topics:
- The package-tracking-number analogy
- A `RAGTrace` dataclass capturing every pipeline stage
- Pretty-printing a trace for inspection
- Dedicated observability tools (e.g. LangSmith) as the production-grade version of this pattern

---

### 03 - Debugging Bad Retrievals
`/Phase-11-Evaluation-and-Observability/03-Debugging-Bad-Retrievals.md`

Starts from the problem: given a trace showing retrieval returned the wrong chunks, how do you actually fix it? Introduces a differential-diagnosis-style debugging checklist — embedding model consistency, chunk size, metadata filtering, query rewriting, and `k` tuning — each tied back to the earlier phase that addresses it, plus a diagnostic script for sanity-checking the embedding model itself.

Key topics:
- The differential-diagnosis analogy
- A five-item debugging checklist mapped to Phases 2, 4, 6/7, 8, and 9
- A cosine-similarity sanity check for the embedding model
- Why changing multiple variables at once during debugging makes root-causing impossible

---

## How to Study This Phase

1. Read each file once for understanding without memorizing.
2. After each section, close the file and explain the concept out loud in your own words (Feynman technique).
3. Do the hands-on exercises at the end of each file — they build directly on Phase 10's pipeline code.
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Come back after a day or two and re-explain the four evaluation metrics and the debugging checklist from memory.

## Prerequisites

Phases 1-10, especially Phase 2 (embeddings and similarity), Phase 8 (retrieval strategies), Phase 9 (reranking and query transformation), and Phase 10 (the end-to-end LangChain pipeline and its `run_pipeline` function).

## What Comes Next

After completing Phase 11, proceed to:
- **Phase 12: Agentic RAG** — letting an LLM decide when and how to retrieve, rather than following a fixed pipeline

---

> "You can't fix what you can't measure, and you can't measure what you can't trace." — Phase 11 in one sentence.
