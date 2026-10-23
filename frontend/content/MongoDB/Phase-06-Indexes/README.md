# Phase 6: Indexes

## Overview

Indexes are the single most impactful lever for MongoDB query performance. A collection without the right indexes forces MongoDB to scan every document (COLLSCAN) for every query. With the right indexes, MongoDB jumps directly to relevant data (IXSCAN) — the difference can be millions of times faster at scale.

This phase covers how indexes are structured internally, every index type available in MongoDB, and the strategies that separate average developers from performance engineers.

**Estimated Time:** 1.5 weeks

---

## Files in This Phase

| File | Topic | Lines |
|------|-------|-------|
| [01-Index-Fundamentals.md](./01-Index-Fundamentals.md) | B-tree internals, COLLSCAN vs IXSCAN, create/drop, write overhead, hint() | 400+ |
| [02-Index-Types.md](./02-Index-Types.md) | Single, Compound, Multikey, Text, Geospatial, Hashed, Wildcard, Partial, Sparse, TTL, Unique | 500+ |
| [03-Index-Strategies.md](./03-Index-Strategies.md) | ESR rule, selectivity, covered queries, explain(), index maintenance | 400+ |

---

## Learning Objectives

By the end of Phase 6 you will be able to:

- Explain how MongoDB B-tree indexes store and traverse data
- Read `explain()` output and diagnose slow queries
- Choose the correct index type for any access pattern
- Apply the ESR rule to design compound indexes
- Write covered queries that never touch documents
- Manage index lifecycle: create, monitor, and drop safely

---

## Recommended Study Order

1. Read `01-Index-Fundamentals.md` — understand the engine before the types
2. Read `02-Index-Types.md` — know every tool in the toolbox
3. Read `03-Index-Strategies.md` — learn to combine tools expertly
4. Complete all exercises in each file using MongoDB Atlas free tier or local `mongod`
5. Review all Q&A sections before interviews

---

## Prerequisites

- Phase 01-05 completed (CRUD, schema design, aggregation)
- MongoDB Shell (`mongosh`) or Compass installed
- A test database with at least one collection containing 10,000+ documents for realistic explain() output

---

## Key Concepts at a Glance

```
Without Index            With Index
─────────────────        ─────────────────
Query arrives            Query arrives
      │                        │
      ▼                        ▼
Scan ALL documents        Traverse B-tree
(COLLSCAN)                (IXSCAN)
      │                        │
      ▼                        ▼
Return matches            Jump to matching
                          documents directly
Cost: O(n)               Cost: O(log n)
```

---

## Phase Checklist

- [ ] Understand B-tree index structure
- [ ] Run COLLSCAN vs IXSCAN comparison with explain()
- [ ] Create single-field, compound, text, and TTL indexes
- [ ] Apply ESR rule to a real compound index
- [ ] Write and verify a covered query
- [ ] Read executionStats and identify bottlenecks
- [ ] Complete all 15 exercises across the three files
