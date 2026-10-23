# Project 7: Production RAG Capstone

## Goal

Combine everything from the course — chunking, hybrid retrieval, reranking, orchestration, evaluation, caching, and per-user metadata security — into one end-to-end, production-shaped RAG system. This is the capstone: it should feel like a small but genuine production service, not a notebook demo.

## What You'll Build

A multi-user RAG service where each user can only ever retrieve their own (and shared) documents, retrieval combines hybrid search and reranking, responses are cached to cut cost and latency, the whole pipeline is evaluated and traced, and the system is deployed (or deployed-style: containerized and run as a long-lived service, even if only locally) rather than run as a one-off script.

## Phases Required

All 14 phases (1-14), integrating specifically:

- Phases 1-2 — RAG fundamentals and embeddings underpin every design decision below
- Phase 3-4 — Document loading and chunking for real, mixed-format ingestion
- Phases 5-7 — A production-appropriate vector store choice (justify Chroma vs. Pinecone vs. pgvector for this use case)
- Phases 8-9 — Hybrid retrieval, MMR/metadata filtering, and reranking
- Phase 10 — LangChain (or equivalent) orchestration tying ingestion through generation together
- Phase 11 — RAGAS-style evaluation and structured tracing
- Phase 12 — At least one agentic capability (tool use, self-querying, or multi-step retrieval)
- Phase 13 — At least one GraphRAG or multimodal element (optional but encouraged given time)
- Phase 14 — Caching, per-user security/metadata isolation, and monitoring/failure-mode handling

## Requirements

- Support at least two distinct "users" (or tenants), each owning a subset of documents, plus optionally some documents shared across all users.
- Enforce document access **server-side**: a user's query must never be able to retrieve another user's private documents, regardless of what the client sends — filtering must not be trusted from client input.
- Ingest at least two different document formats (reuse loaders from earlier projects) with proper chunking and metadata.
- Implement hybrid retrieval (keyword + vector) with reranking before generation.
- Add at least one caching layer (embedding cache, semantic cache, or response cache) and demonstrate a measurable latency or cost reduction on a repeated/near-duplicate query.
- Evaluate the system on a test set using the four RAGAS-style metrics, with full request tracing (question → retrieved chunks → reranked order → final prompt → answer) captured for every query.
- Implement at least one agentic capability: either tool-using retrieval, self-querying (structured filter extraction from natural language), or multi-step retrieval.
- Redact or flag at least one category of sensitive content (e.g. a fake PII field in your test documents) before it's indexed, and log what was retrieved for each query (a minimal audit trail).
- Package the system so it runs as a persistent service (e.g. a simple API server) rather than a one-shot script, and document how you'd deploy and monitor it, including at least one production failure mode you've deliberately considered (index drift, silent retrieval degradation, upstream API outage) and how your design detects or mitigates it.

## Suggested Approach

1. Design the data model first: users/tenants, documents, and which documents belong to which tenant (plus any shared documents) — get the access-control shape right before writing retrieval code.
2. Pick your vector store (Chroma, Pinecone, or pgvector) based on a real justification — e.g. pgvector if you want tenant filtering to live in the same relational query as the vector search; Pinecone if you want namespace-per-tenant isolation.
3. Build ingestion: load two+ document formats, chunk them (recursive or semantic), tag every chunk with `tenant_id` and any other metadata (source, page, sensitivity), and store them.
4. Implement server-side tenant filtering as a non-optional part of every retrieval call — the query function should not compile or run without a `tenant_id` argument threaded through to the underlying filter.
5. Layer hybrid retrieval (BM25 + vector, fused with RRF) and cross-encoder reranking on top of the tenant-filtered candidate set.
6. Orchestrate ingestion-to-generation as a single composed pipeline (LangChain or your own composition), and add one agentic capability on top (e.g. a self-querying layer that extracts a tenant-safe structured filter from the user's natural-language question, or a tool-using agent that decides whether to retrieve).
7. Add a semantic response cache: before running full retrieval + generation, check whether a near-duplicate query (per tenant!) was recently answered, and reuse the cached response with an explicit staleness/TTL policy.
8. Build the evaluation harness from Project 5's pattern: a test set per tenant, RAGAS-style scoring, and a structured trace per query stored somewhere inspectable.
9. Wrap the whole pipeline behind a minimal API server (even a simple local HTTP server is fine) so it behaves like a long-running service rather than a script, and write a short "production readiness" note listing the failure modes you considered and how your design handles each.

## Stretch Goals

- Add a GraphRAG layer for one relationship-heavy question type in your dataset, or a multimodal element (image captioning stored as retrievable text) for one document.
- Add basic rate limiting or per-tenant usage tracking to the API layer.
- Simulate one of your considered failure modes on purpose (e.g. force a stale cache entry or an unavailable embedding API) and demonstrate your system degrades gracefully instead of crashing or leaking data across tenants.

## Evaluation Checklist

- [ ] A query from Tenant A can never retrieve Tenant B's private documents, verified by an explicit test that tries to break isolation.
- [ ] Hybrid retrieval + reranking is active on every query, not just plain top-k similarity.
- [ ] At least one caching layer is measurably reducing latency or redundant work on repeated/similar queries.
- [ ] The RAGAS-style evaluation harness runs against a real test set and produces scores with accompanying traces.
- [ ] At least one agentic capability is demonstrably working (not just defined but unused).
- [ ] Sensitive/PII test content is redacted or flagged before indexing, and retrieval activity is logged per query.
- [ ] The system runs as a persistent service, and you can articulate at least one production failure mode plus how your design detects or mitigates it.
- [ ] You can walk through the full request lifecycle — from incoming question to final answer — naming which phase's technique is responsible for each stage.
