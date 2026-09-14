# Phase 5: Aggregation

## Overview

Aggregation is MongoDB's most powerful data-processing feature. Rather than fetching raw documents and crunching numbers in application code, you push the computation down to the database engine where it runs close to the data — faster, cheaper on network bandwidth, and far more expressive than a simple find query.

This phase covers the aggregation pipeline architecture, every major pipeline stage, and the real-world patterns that show up in production systems and technical interviews.

**Estimated time:** 2 weeks

---

## Table of Contents

1. [What is Aggregation?](#what-is-aggregation)
2. [Files in This Phase](#files-in-this-phase)
3. [Learning Path](#learning-path)
4. [Prerequisites](#prerequisites)
5. [Key Concepts at a Glance](#key-concepts-at-a-glance)
6. [Week-by-Week Plan](#week-by-week-plan)

---

## What is Aggregation?

Aggregation transforms a collection of documents through a **pipeline** — a sequence of stages where each stage receives the output of the previous one. Think of it as an assembly line: raw materials (documents) enter one end, pass through a series of operations, and a finished product (results) exits the other end.

```
Raw Documents  ──►  $match  ──►  $group  ──►  $sort  ──►  Results
```

This is conceptually similar to Unix pipes:

```bash
cat access.log | grep "404" | awk '{print $7}' | sort | uniq -c
```

MongoDB's aggregation pipeline does the same thing — but for JSON documents, entirely inside the database.

---

## Files in This Phase

| # | File | Topic | Lines | Exercises | Q&A |
|---|------|--------|-------|-----------|-----|
| 01 | [01-Aggregation-Pipeline.md](./01-Aggregation-Pipeline.md) | Pipeline concept, syntax, memory limits, optimization | 400+ | 5 | 10 |
| 02 | [02-Pipeline-Stages.md](./02-Pipeline-Stages.md) | All stages with syntax and code examples | 600+ | 8 | 15 |
| 03 | [03-Aggregation-Patterns.md](./03-Aggregation-Patterns.md) | Real-world patterns and production pipelines | 400+ | 5 | 10 |

---

## Learning Path

```
┌─────────────────────────────────────────┐
│  01-Aggregation-Pipeline.md             │
│  - Understand the stream model          │
│  - Learn aggregate() syntax             │
│  - Memory limits & allowDiskUse         │
│  - Optimization rules                   │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  02-Pipeline-Stages.md                  │
│  - Master every stage                   │
│  - $match $project $group $lookup       │
│  - $unwind $facet $bucket $out          │
│  - All accumulators and operators       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  03-Aggregation-Patterns.md             │
│  - Top-N per group                      │
│  - Running totals, pivots               │
│  - Graph traversal, time-series         │
│  - Full production pipeline examples    │
└─────────────────────────────────────────┘
```

---

## Prerequisites

Before starting this phase, ensure you are comfortable with:

- Phase 1: MongoDB basics, document model, shell commands
- Phase 2: CRUD operations (find, insert, update, delete)
- Phase 3: Query operators ($eq, $gt, $in, $and, $or, $elemMatch, etc.)
- Phase 4: Indexing (how indexes affect query plans)

---

## Key Concepts at a Glance

| Concept | One-Line Summary |
|---------|-----------------|
| Pipeline | Ordered array of stage objects passed to `aggregate()` |
| Stage | A single transformation: filter, reshape, group, join, etc. |
| Accumulator | Function that reduces many values to one (`$sum`, `$avg`, `$max`) |
| `allowDiskUse` | Bypasses the 100 MB per-stage memory cap by spilling to disk |
| `$lookup` | Left outer join between two collections |
| `$unwind` | Deconstructs an array field into one document per element |
| `$facet` | Runs multiple sub-pipelines on the same input in parallel |
| `$graphLookup` | Recursive graph/tree traversal within a collection |

---

## Week-by-Week Plan

### Week 1 — Foundation

| Day | Task |
|-----|------|
| Mon | Read 01-Aggregation-Pipeline.md, run all code examples |
| Tue | Complete the 5 exercises in file 01 |
| Wed | Read 02-Pipeline-Stages.md sections: $match, $project, $group, $sort, $limit, $skip |
| Thu | Read 02-Pipeline-Stages.md sections: $unwind, $lookup, $addFields, $replaceRoot |
| Fri | Read 02-Pipeline-Stages.md sections: $count, $facet, $bucket, $bucketAuto, $out, $merge |
| Sat | Complete exercises 1-4 in file 02 |
| Sun | Review Q&A sections in files 01 and 02 |

### Week 2 — Patterns and Practice

| Day | Task |
|-----|------|
| Mon | Read 03-Aggregation-Patterns.md |
| Tue | Complete all exercises in file 03 |
| Wed | Rebuild the sales report pipeline from scratch |
| Thu | Rebuild the user funnel pipeline from scratch |
| Fri | Complete exercises 5-8 in file 02 |
| Sat | Full Q&A review across all three files |
| Sun | Write one original pipeline against your own dataset |

---

## Quick Reference: Most-Used Stages

```js
db.orders.aggregate([
  { $match:   { status: "completed" } },          // filter
  { $project: { customerId: 1, total: 1 } },      // reshape
  { $group:   { _id: "$customerId",               // group + accumulate
                totalSpend: { $sum: "$total" } } },
  { $sort:    { totalSpend: -1 } },               // sort
  { $limit:   10 }                                // take top 10
])
```

---

*Phase 5 of the MongoDB learning track. Next: Phase 6 — Transactions and Data Modeling.*
