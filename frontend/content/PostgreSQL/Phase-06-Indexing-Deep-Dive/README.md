# Phase 06 — PostgreSQL Indexing In-Depth

## Overview

Indexes are the single most critical factor in achieving sub-millisecond query performance at scale. In this phase, you will explore the full breadth of PostgreSQL's world-class indexing engines—from standard B-Trees and covering indexes (`INCLUDE`) to specialized GIN, GiST, BRIN, and native Full-Text Search indexing.

---

## Objectives

By completing Phase 06, you will be able to:
1. Deconstruct internal B-Tree storage mechanics, the leftmost prefix rule, and deduplication.
2. Build covering indexes using the `INCLUDE` clause to enable zero-heap **Index-Only Scans**.
3. Apply **Partial Indexes** and **Expression Indexes** to dramatically shrink index size on disk.
4. Select the correct specialized index access method (GIN, GiST, BRIN, Hash, SP-GiST) for any given data structure.
5. Ingest and query high-volume time-series data using **BRIN** indexes at 1% the storage footprint of a B-Tree.
6. Build a native PostgreSQL Full-Text Search engine using `tsvector`, `tsquery`, stemming dictionaries, and weighted ranking.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-B-Tree-Indexes-and-Covering-Indexes.md](./01-B-Tree-Indexes-and-Covering-Indexes.md) | B-Tree mechanics, composite keys, covering indexes with INCLUDE, and index deduplication. |
| 2 | [02-Specialized-Indexes-GIN-GiST-BRIN-Hash.md](./02-Specialized-Indexes-GIN-GiST-BRIN-Hash.md) | GIN for documents/arrays, GiST for geometry/ranges, BRIN for time-series, and partial indexes. |
| 3 | [03-Full-Text-Search.md](./03-Full-Text-Search.md) | tsvector, tsquery, stemming dictionaries, GIN full-text indexes, and relevance ranking. |

---

## Time Estimate

- **Estimated study time:** 7–9 hours.
- **Hands-on practice:** 3 hours testing Index-Only Scans and benchmarking BRIN vs B-Tree disk sizes.
