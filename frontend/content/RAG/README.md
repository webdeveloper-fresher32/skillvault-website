# Complete RAG Learning Course

> **From Zero RAG Experience to Production-Ready Practitioner — A Structured, Hands-On Journey Through Retrieval-Augmented Generation**

---

## Why RAG?

Large language models are powerful, but they have two hard limits: a fixed training cutoff and no knowledge of your private, proprietary, or fast-changing data. Retrieval-Augmented Generation (RAG) solves both problems by giving an LLM a searchable knowledge base to consult before it answers — turning a closed-book exam into an open-book one. RAG is the backbone of nearly every production LLM application today: internal knowledge assistants, customer support bots, coding copilots, and research tools all lean on it. This course takes you from "what is RAG" all the way to production-grade patterns — chunking, vector databases, hybrid retrieval, reranking, evaluation, agentic RAG, and deployment — with both the theory and the hands-on practice to build real systems with confidence.

---

## Prerequisites

- **Python fluency** — comfortable reading and writing everyday Python (functions, classes, list/dict basics). Every non-trivial or unusual Python idiom used in a lesson is explained inline the first time it appears, so you don't need to be an expert.
- **A little ML familiarity** — you don't need a machine learning background, just a general sense of what an LLM is. No prior RAG or vector database experience is assumed anywhere in this course.

---

## How to Use This Course

This repository is organised into **phases**, each representing a logical learning milestone. Inside each phase folder you will find:

- `README.md` — Phase overview, learning objectives, and estimated study time
- Numbered lesson files (`01-Topic.md`, `02-Topic.md`, ...) — the actual teaching content, each following the same structure: the problem it solves, a plain-language analogy, how it works internally, a worked code example, a comparison table where relevant, common mistakes, an interview angle, hands-on exercises, interview Q&A, and a one-line memory hook

**Recommended approach:**
1. Read the phase `README.md` first to understand the scope and objectives.
2. Work through the lesson files in order — later phases build directly on earlier ones (Phase 8's retrieval strategies assume Phase 5-7's vector stores, for example).
3. Do every Hands-On Exercise — reading alone won't build the intuition for tuning chunk sizes, choosing k, or diagnosing a bad retrieval.
4. Attempt a `Projects/` build once you've cleared the phases it draws on, to cement the material in a real system rather than isolated snippets.
5. Use `Quick-Reference/` to review before interviews or when you need a fast lookup instead of re-reading a full lesson.

---

## Course Structure

```
RAG/
├── Phase-01-RAG-Fundamentals/
├── Phase-02-LLM-and-Embedding-Basics/
├── Phase-03-Document-Loading-and-Preprocessing/
├── Phase-04-Chunking-Strategies/
├── Phase-05-Vector-Databases-Chroma/
├── Phase-06-Vector-Databases-Pinecone/
├── Phase-07-Vector-Databases-Pgvector/
├── Phase-08-Retrieval-Strategies/
├── Phase-09-Reranking-and-Query-Transformation/
├── Phase-10-RAG-Orchestration-LangChain/
├── Phase-11-Evaluation-and-Observability/
├── Phase-12-Agentic-RAG/
├── Phase-13-GraphRAG-and-Multimodal-RAG/
├── Phase-14-Production-Patterns-and-Scaling/
├── Projects/
├── Quick-Reference/
└── README.md
```

---

## Learning Path

Work through these phases in order. Each phase builds on the previous one.

| # | Phase | Folder | Difficulty | Estimated Time |
|---|-------|--------|------------|-----------------|
| 1 | 📖 **RAG Fundamentals** | [Phase-01-RAG-Fundamentals/](Phase-01-RAG-Fundamentals/) | Beginner | 7-10 hours |
| 2 | 🔢 **LLM & Embedding Basics** | [Phase-02-LLM-and-Embedding-Basics/](Phase-02-LLM-and-Embedding-Basics/) | Beginner | 6-9 hours |
| 3 | 📄 **Document Loading & Preprocessing** | [Phase-03-Document-Loading-and-Preprocessing/](Phase-03-Document-Loading-and-Preprocessing/) | Beginner | 6-9 hours |
| 4 | ✂️ **Chunking Strategies** | [Phase-04-Chunking-Strategies/](Phase-04-Chunking-Strategies/) | Beginner-Intermediate | 6-9 hours |
| 5 | 🗄️ **Vector Databases — Chroma** | [Phase-05-Vector-Databases-Chroma/](Phase-05-Vector-Databases-Chroma/) | Intermediate | 6-9 hours |
| 6 | ☁️ **Vector Databases — Pinecone** | [Phase-06-Vector-Databases-Pinecone/](Phase-06-Vector-Databases-Pinecone/) | Intermediate | 6-9 hours |
| 7 | 🐘 **Vector Databases — pgvector** | [Phase-07-Vector-Databases-Pgvector/](Phase-07-Vector-Databases-Pgvector/) | Intermediate | 6-9 hours |
| 8 | 🔍 **Retrieval Strategies** | [Phase-08-Retrieval-Strategies/](Phase-08-Retrieval-Strategies/) | Intermediate | 8-11 hours |
| 9 | 🎯 **Reranking & Query Transformation** | [Phase-09-Reranking-and-Query-Transformation/](Phase-09-Reranking-and-Query-Transformation/) | Intermediate | 6-8 hours |
| 10 | 🔗 **RAG Orchestration with LangChain** | [Phase-10-RAG-Orchestration-LangChain/](Phase-10-RAG-Orchestration-LangChain/) | Intermediate-Advanced | 7-10 hours |
| 11 | 📊 **Evaluation & Observability** | [Phase-11-Evaluation-and-Observability/](Phase-11-Evaluation-and-Observability/) | Intermediate-Advanced | 6-9 hours |
| 12 | 🤖 **Agentic RAG** | [Phase-12-Agentic-RAG/](Phase-12-Agentic-RAG/) | Advanced | 6-9 hours |
| 13 | 🕸️ **GraphRAG & Multimodal RAG** | [Phase-13-GraphRAG-and-Multimodal-RAG/](Phase-13-GraphRAG-and-Multimodal-RAG/) | Advanced | 6-9 hours |
| 14 | 🚀 **Production Patterns & Scaling** | [Phase-14-Production-Patterns-and-Scaling/](Phase-14-Production-Patterns-and-Scaling/) | Advanced | 7-10 hours |

**Total estimated time: ~90-130 hours of lesson study**, plus additional time for the 7 hands-on projects in `Projects/` (roughly 15-25 more hours depending on how many you build).

---

## Projects

Seven hands-on projects that integrate multiple phases, ordered beginner → advanced. Each is a project brief (goal, requirements, suggested approach, stretch goals, evaluation checklist) rather than a walkthrough — you build it yourself using what the phases taught.

📁 [Projects/](Projects/)

| # | Project | Phases Used | Difficulty |
|---|---------|-------------|------------|
| 1 | Simple Doc-QA Bot | 1-5 | Beginner |
| 2 | PDF Knowledge Base Assistant | 3, 4, 6 | Beginner-Intermediate |
| 3 | Hybrid Search App | 7, 8, 9 | Intermediate |
| 4 | Multi-Source RAG with LangChain | 3, 8, 10 | Intermediate |
| 5 | Evaluated RAG Pipeline | 10, 11 | Intermediate-Advanced |
| 6 | Agentic Research Assistant | 12 | Advanced |
| 7 | Production RAG Capstone | 1-14 | Advanced (Capstone) |

---

## Quick Reference

📁 [Quick-Reference/](Quick-Reference/)

- **[RAG-Cheatsheet.md](Quick-Reference/RAG-Cheatsheet.md)** — dense lookup tables covering chunking strategies, similarity metrics, vector DB comparisons, retrieval and reranking techniques, common LangChain snippets, evaluation metrics, and a production checklist.
- **[Interview-QA.md](Quick-Reference/Interview-QA.md)** — 50 interview questions and answers spanning the full course, from RAG fundamentals through production deployment.

---

## Getting Started

1. **Set up a Python environment** — a virtual environment with `pip` is enough to get started; specific package installs (`chromadb`, `pinecone`, `psycopg2`/`pgvector`, `langchain`, `sentence-transformers`, `anthropic`, etc.) are introduced phase by phase, exactly when each lesson needs them.
2. **Get an Anthropic API key** — code examples throughout this course call the Claude API for generation; you'll need a key from [console.anthropic.com](https://console.anthropic.com) once you reach Phase 1's code examples.
3. **Start at Phase 1** — even with some ML background, the RAG-specific framing in Phase 1-2 is worth reading in full before jumping to vector databases.
4. **Track your progress** — check off phases and exercises as you complete them.

> "A model that can only answer from memory is guessing. A model that can look things up is reasoning with evidence."

---

*Maintained as part of the SkillVault learning library.*
