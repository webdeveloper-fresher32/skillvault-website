# Phase 10 — Partitioning, Foreign Data Wrappers & AI Extensions

## Overview

As databases scale from gigabytes to terabytes, monolithic single-table architectures become difficult to vacuum, query, and maintain. In this phase, you will master declarative table partitioning (Range, List, and Hash), partition pruning, Foreign Data Wrappers (`postgres_fdw`) for distributed federated querying, and modern PostgreSQL extensions—culminating in AI embedding similarity search with `pgvector`.

---

## Objectives

By completing Phase 10, you will be able to:
1. Design and deploy **Declarative Table Partitioning** by Range (time-series), List (country/tenant), and Hash (even distribution).
2. Configure **Partition Pruning** at both planning time and execution time (`enable_partition_pruning`).
3. Execute instant zero-downtime data lifecycle management by attaching and detaching partitions (`ALTER TABLE ATTACH/DETACH PARTITION`).
4. Query remote external PostgreSQL and MySQL servers transparently using **Foreign Data Wrappers (FDW)**.
5. Install and configure **`pgvector`** to store high-dimensional embeddings and execute vector similarity queries (`<->`, `<=>`, `<#>`) with HNSW and IVFFlat indexes.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-Declarative-Table-Partitioning.md](./01-Declarative-Table-Partitioning.md) | Range, List, and Hash partitioning, partition pruning, and fast dropping of historical data. |
| 2 | [02-Foreign-Data-Wrappers-FDW.md](./02-Foreign-Data-Wrappers-FDW.md) | postgres_fdw setup, foreign servers, user mapping, and cross-database joins. |
| 3 | [03-PostgreSQL-Extensions-and-pgvector.md](./03-PostgreSQL-Extensions-and-pgvector.md) | Extension architecture, pg_stat_statements, and AI vector similarity search with pgvector. |

---

## Time Estimate

- **Estimated study time:** 7–9 hours.
- **Hands-on practice:** 3 hours setting up partitioned time-series tables and indexing vector embeddings.
