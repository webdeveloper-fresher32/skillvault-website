# RAG Projects Overview

This directory contains 7 hands-on projects that turn the 14 phases of the RAG course into working systems. The projects are ordered beginner → advanced: each one builds on skills and code from the projects before it, and each one names exactly which phases it draws on so you know what to review before you start.

Work through them in order. Project 1 is a same-day weekend build using the most basic pieces of the pipeline (Phases 1-5). By Project 7 you're combining chunking, hybrid retrieval, reranking, evaluation, caching, and security into one capstone system that uses ideas from every phase in the course (1-14).

## Project Index

| # | Project | Difficulty | Phases Used | Est. Time |
|---|---------|------------|-------------|-----------|
| 1 | [Simple Doc-QA Bot](01-Simple-Doc-QA-Bot.md) | Beginner | 1, 2, 3, 4, 5 | 3-5 hours |
| 2 | [PDF Knowledge Base Assistant](02-PDF-Knowledge-Base-Assistant.md) | Beginner+ | 3, 4, 6 | 4-6 hours |
| 3 | [Hybrid Search App](03-Hybrid-Search-App.md) | Intermediate | 7, 8, 9 | 5-7 hours |
| 4 | [Multi-Source RAG with LangChain](04-Multi-Source-RAG-with-LangChain.md) | Intermediate | 3, 8, 10 | 5-7 hours |
| 5 | [Evaluated RAG Pipeline](05-Evaluated-RAG-Pipeline.md) | Intermediate+ | 10, 11 | 4-6 hours |
| 6 | [Agentic Research Assistant](06-Agentic-Research-Assistant.md) | Advanced | 12 | 5-8 hours |
| 7 | [Production RAG Capstone](07-Production-RAG-Capstone.md) | Advanced (Capstone) | 1-14 | 10-15 hours |

## Recommended Learning Path

```
Beginner   (Projects 1-2)  → core pipeline: load, chunk, embed, store, retrieve, generate
    ↓
Intermediate (Projects 3-5) → better retrieval, real orchestration, real measurement
    ↓
Advanced   (Projects 6-7)  → agentic reasoning, then a full production-shaped system
```

## Prerequisites

- Working Python environment (3.9+) with `pip`
- An LLM API key (Anthropic Claude or equivalent) and an embedding API
- Free-tier accounts as needed: Pinecone (Project 2+), a local or hosted PostgreSQL with the `pgvector` extension (Project 3+)
- Comfort with the phase(s) each project lists — re-read the relevant phase README if a concept feels shaky before starting
- No project requires paid infrastructure beyond free tiers/local services if you tear resources down after use

## How to Use These Projects

Each project file follows the same brief format: **Goal**, **What You'll Build**, **Phases Required**, **Requirements**, **Suggested Approach**, **Stretch Goals**, and an **Evaluation Checklist**. These are project briefs, not step-by-step tutorials with solution code — the Suggested Approach gives you a high-level path, but writing the implementation is the point of the exercise. Use the Evaluation Checklist at the end of each project to confirm you actually met the requirements before moving to the next one.
