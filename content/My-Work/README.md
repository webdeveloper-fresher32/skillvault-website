# My Work: Production Systems & Architecture Blueprints

> **Author**: Ganesh Pirikirala | Senior Full Stack & AI Systems Engineer  
> **Portfolio**: [ganesh-full-stack-developer-portfolio.vercel.app](https://ganesh-full-stack-developer-portfolio.vercel.app/)  
> **Scope**: Production Architectures, Deep-Dive System Implementations & Senior Interview Battle Cards

---

## 🎯 Purpose & Quick Reference Guide

This course represents my real-world engineering work, design decisions, and production architectures implemented across enterprise SaaS platforms. It is designed as a **high-density technical reference** for system design interviews, architectural discussions, and technical reviews.

```
My Work / Production Engineering Blueprints
├── Phase 01: Stripe Billing & Subscription Management System
│   ├── 01. Production Billing Architecture & Webhook Event Machine
│   ├── 02. Duplicate Payment Prevention, Idempotency & ACID Locking
│   └── 03. Subscription State Machine, Upgrades, Downgrades & Proration
│
├── Phase 02: Multi-Tenant AI Support & RAG Knowledge Platform
│   ├── 01. Multi-Tenant RAG & LangGraph Agentic Architecture
│   ├── 02. Two-Stage Hybrid Retrieval, RRF & Cross-Encoder Reranking
│   └── 03. Real-Time Token Streaming (SSE) & Durable HITL Checkpoints
│
└── Phase 03: Senior Interview Battle Cards (High-Speed Quick Reference)
    ├── 01. Stripe Billing & Payments Senior Interview Battle Cards
    └── 02. Multi-Tenant RAG & LangGraph Senior Interview Battle Cards
```

---

## 🏗️ Systems Overview

### 1. SaaS Billing & Subscription Management Platform
- **Stack**: Node.js, Express.js, TypeScript, PostgreSQL (Prisma), Redis, BullMQ, Stripe SDK.
- **Key Challenges Solved**:
  - The Distributed Two-Phase Commit (2PC) problem across Stripe and internal databases.
  - Zero duplicate payments guaranteed via a 4-tier defense model (Stripe Idempotency Keys, Redis Distributed Locks, PostgreSQL Row-Level Locking `SELECT ... FOR UPDATE`, and Database Unique Constraints).
  - Out-of-order webhook delivery handling using monotonically increasing Stripe event timestamps (`created`).
  - Proration mathematics and mid-cycle tier transitions.

### 2. Multi-Tenant AI Customer Support & RAG Platform
- **Stack**: Python 3.11+, FastAPI, LangChain, LangGraph, PostgreSQL 16 (`pgvector`), Redis, Celery, React/SSE.
- **Key Challenges Solved**:
  - 3-Layer multi-tenant data isolation guaranteeing zero cross-tenant vector leakage (JWT cryptographic extraction + PostgreSQL Row-Level Security + Partition-filtered HNSW indexing).
  - Two-stage hybrid search combining dense semantic vectors and sparse lexical BM25 via Reciprocal Rank Fusion ($k=60$) followed by Cross-Encoder reranking (`ms-marco-MiniLM-L-6-v2`) to eliminate "Lost in the Middle" attention degradation.
  - LangGraph cyclic state machine with intent classification routing, tool execution, and durable Human-in-the-Loop (`interrupt()`) breakpoints persisted via `PostgresSaver`.
  - Token-by-token streaming via FastAPI Server-Sent Events (SSE) with intermediate status events and zero JSON tool-call schema leakage.

---

## ⚡ Quick Navigation

| Module | Core Topics | Deep-Dive Links |
|--------|-------------|-----------------|
| **Stripe Billing** | 2PC Dilemma, Webhooks, Idempotency, Proration | [01. Architecture](Phase-01-Stripe-Billing-System/01-Production-Billing-Architecture.md) • [02. Idempotency](Phase-01-Stripe-Billing-System/02-Duplicate-Payment-Prevention-and-ACID.md) • [03. Proration](Phase-01-Stripe-Billing-System/03-Subscription-Lifecycle-and-Proration.md) |
| **AI Support & RAG** | Multi-Tenancy, LangGraph, Hybrid Search, SSE | [01. Architecture](Phase-02-AI-Chat-Assistant-and-RAG/01-Multi-Tenant-RAG-and-LangGraph-Architecture.md) • [02. Hybrid Search](Phase-02-AI-Chat-Assistant-and-RAG/02-Hybrid-Search-RRF-and-Cross-Encoder.md) • [03. Streaming & HITL](Phase-02-AI-Chat-Assistant-and-RAG/03-Realtime-SSE-Streaming-and-HITL.md) |
| **Battle Cards** | Top 10 Senior Interview Deep-Dive Scenarios | [01. Payments Cards](Phase-03-Interview-Battle-Cards/01-Stripe-Billing-Senior-Battle-Cards.md) • [02. AI & RAG Cards](Phase-03-Interview-Battle-Cards/02-AI-RAG-LangGraph-Senior-Battle-Cards.md) |
