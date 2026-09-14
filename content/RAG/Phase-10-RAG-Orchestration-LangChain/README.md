# Phase 10: RAG Orchestration with LangChain

## Overview

Phases 2-9 built every piece of a RAG system by hand: you called the embedding API directly, wrote your own chunking logic, talked to Chroma/Pinecone/pgvector with their native SDKs, and hand-assembled prompts before calling the LLM. That was deliberate — building each piece manually is how you actually understand what a vector store, a retriever, or a reranker does. But manually wiring embeddings to storage to retrieval to prompting to generation, for every new project, is repetitive and error-prone. This phase introduces LangChain, a framework that standardizes those connections behind common interfaces so components snap together instead of requiring custom glue code every time. You'll learn LangChain's core abstractions, how to wrap the vector stores from Phases 5-9 as LangChain retrievers, and how to assemble a full RAG pipeline — ingestion through generation — as a single composed chain.

## Learning Objectives

By the end of Phase 10, you will be able to:

- Explain what LangChain is for and why it exists, without treating it as magic — you understand what it's doing under the hood because you built the manual version first
- Use LangChain's core abstractions (`Document`, `Embeddings`, `VectorStore`, `Retriever`, `PromptTemplate`, `Runnable`) and compose them with the LCEL `|` operator
- Wrap a Chroma vector store as a LangChain retriever with a configured search type and `k`, and compose it into a chain alongside a prompt and an LLM
- Build a complete, production-shaped RAG pipeline in LangChain that reuses the chunking, storage, retrieval, and reranking techniques from Phases 4, 5, 8, and 9
- Recognize and avoid the most common mistake with orchestration frameworks: treating them as black boxes instead of understanding the manual mechanics they're standardizing

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-LangChain-Core-Concepts.md | LangChain's core abstractions and LCEL chaining | 2-3 hours |
| 02-Building-Retrievers-and-Chains.md | Wrapping vector stores as retrievers, composing retrieval chains | 2-3 hours |
| 03-End-to-End-RAG-Pipeline-with-LangChain.md | Full pipeline integrating ingestion through generation | 3-4 hours |

**Total: 7-10 hours of focused study**

---

## File Index

### 01 - LangChain Core Concepts
`/Phase-10-RAG-Orchestration-LangChain/01-LangChain-Core-Concepts.md`

Starts from the problem: wiring RAG components by hand works but doesn't scale across projects. Introduces LangChain via the "standardized electrical plugs and sockets" analogy, then walks through the core abstractions — `Document`, `Embeddings`, `VectorStore`, `Retriever`, `PromptTemplate`, and the `Runnable`/LCEL `|` operator — with a minimal working chain example.

Key topics:
- Why manual wiring doesn't scale, and why Phases 2-9 still taught it first
- The standardized-plugs analogy
- LangChain's core abstractions and the LCEL pipe operator
- Doing it by hand vs. LangChain: control, debugging, lock-in trade-offs

---

### 02 - Building Retrievers and Chains
`/Phase-10-RAG-Orchestration-LangChain/02-Building-Retrievers-and-Chains.md`

Shows how to wrap a Chroma vector store as a LangChain `Retriever` using `langchain_chroma`, configure search type and `k`, and compose that retriever into an LCEL chain alongside a prompt template and an LLM call.

Key topics:
- The "universal adapter" analogy for the retriever interface
- `.as_retriever(search_kwargs={"k": ...})`
- Composing `retriever | format_docs | prompt | llm`
- Why default retriever settings quietly undo the tuning from Phase 8

---

### 03 - End-to-End RAG Pipeline with LangChain
`/Phase-10-RAG-Orchestration-LangChain/03-End-to-End-RAG-Pipeline-with-LangChain.md`

The capstone integration lesson: a full pipeline — load, chunk, embed, store, retrieve with MMR, rerank with a cross-encoder, construct a prompt with cited sources, and generate with Claude — built entirely with LangChain components, referencing back to the exact phase that taught each stage manually.

Key topics:
- The assembly-line analogy for a fully wired pipeline
- A complete, runnable pipeline script
- Where LangChain doesn't have a built-in step (reranking) and how to bridge it with a small custom function
- Common failure modes: silent empty retrievals, and not knowing which stage produced a bad answer

---

## How to Study This Phase

1. Read each file once for understanding without memorizing.
2. After each section, close the file and explain the concept out loud in your own words (Feynman technique).
3. Do the hands-on exercises at the end of each file — most require a Chroma instance and an Anthropic API key from earlier phases.
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Come back after a day or two and re-explain the full pipeline in `03` from memory, stage by stage.

## Prerequisites

Phases 2-9 completed — specifically Phase 4 (Chunking), Phase 5 (Chroma), Phase 8 (Retrieval Strategies), and Phase 9 (Reranking). This phase assumes you already understand *what* each stage does manually; it focuses on *how LangChain standardizes wiring them together*.

## What Comes Next

After completing Phase 10, proceed to:
- **Phase 11: Evaluation & Observability** — now that you have a working pipeline, learn how to measure whether it's actually any good, and trace exactly which stage produced a wrong answer

---

> "LangChain doesn't do anything you couldn't do by hand — it just means you stop rewriting the same wiring for every project." — Phase 10 in one sentence.
