# Phase 03 — Data Manipulation & Powerful Querying

## Overview

Writing high-throughput, atomic, and pipeline-friendly DML statements is essential for production systems. In this phase, you will master PostgreSQL's bulk ingestion mechanics using `COPY`, atomic upserts via `ON CONFLICT DO UPDATE/NOTHING`, and the game-changing `RETURNING` clause that enables zero-roundtrip mutation pipelines.

---

## Objectives

By completing Phase 03, you will be able to:
1. Ingest millions of rows per second using the binary and CSV `COPY` protocol compared to multi-row `INSERT`.
2. Master atomic upserts with `ON CONFLICT (target) DO UPDATE SET ...` and handle partial index conflict targets.
3. Use `ON CONFLICT DO NOTHING` for idempotent event consumers and deduplication pipelines.
4. Execute `INSERT ... RETURNING`, `UPDATE ... RETURNING`, and `DELETE ... RETURNING` to eliminate redundant secondary `SELECT` lookups.
5. Build writeable Common Table Expressions (CTEs) that chain data mutations in a single atomic SQL transaction.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-High-Performance-INSERT-and-COPY.md](./01-High-Performance-INSERT-and-COPY.md) | Bulk loading with `COPY`, multi-row batching, unlogged tables, and write performance tuning. |
| 2 | [02-UPSERT-ON-CONFLICT.md](./02-UPSERT-ON-CONFLICT.md) | Atomic upserts, handling concurrency conflicts, partial unique targets, and exclusion clause targets. |
| 3 | [03-UPDATE-DELETE-and-RETURNING.md](./03-UPDATE-DELETE-and-RETURNING.md) | The `RETURNING` clause, writeable CTE pipelines, soft deletes, and archive patterns. |

---

## Time Estimate

- **Estimated study time:** 6–8 hours.
- **Hands-on practice:** 2.5 hours executing bulk ingestion benchmarks and building upsert pipelines.
