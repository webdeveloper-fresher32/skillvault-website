# Phase 8: Performance Optimization

## Overview

Performance is where theoretical knowledge meets production reality. A query that works fine on 1,000 documents can grind your application to a halt at 10 million. This phase teaches you to identify slow queries before your users do, read MongoDB's diagnostic output, and apply targeted fixes.

---

## Table of Contents

1. [Objectives](#objectives)
2. [Topics Covered](#topics-covered)
3. [File Index](#file-index)
4. [Estimated Timeline](#estimated-timeline)
5. [Prerequisites](#prerequisites)
6. [Phase Overview Diagram](#phase-overview-diagram)
7. [Key Concepts at a Glance](#key-concepts-at-a-glance)
8. [How the Files Connect](#how-the-files-connect)

---

## Objectives

By the end of Phase 8, you will be able to:

- **Identify slow queries** using the MongoDB profiler and system.profile collection
- **Read and interpret explain plans** to understand how MongoDB executes a query
- **Distinguish** between COLLSCAN (full collection scan) and IXSCAN (index scan) execution stages
- **Design indexes** that match your query patterns: single-field, compound, multikey, text, and partial
- **Use hint()** to force a specific index and validate your assumptions
- **Analyze the profiler output** to catch queries exceeding your SLA thresholds
- **Apply the ESR rule** (Equality, Sort, Range) to order compound index fields correctly
- **Understand index overhead** on write operations and make trade-off decisions
- **Use db.currentOp()** to inspect in-flight operations and kill runaway queries
- **Profile aggregation pipelines** with explain() and reorganize stages for efficiency

---

## Topics Covered

### Module 1 — Query Optimization ([01-Query-Optimization.md](./01-Query-Optimization.md))

```
┌─────────────────────────────────────────────────────────┐
│               QUERY OPTIMIZATION TOPICS                  │
├─────────────────────────────────────────────────────────┤
│  Index Types         │  Single, Compound, Multikey       │
│  ESR Rule            │  Equality → Sort → Range          │
│  Index Selectivity   │  High vs Low cardinality          │
│  Covered Queries     │  No doc fetch, index-only         │
│  Index Intersection  │  When MongoDB merges indexes      │
│  Write Overhead      │  Cost of too many indexes         │
│  Profiler Setup      │  Level 0, 1, 2 + slowms           │
│  system.profile      │  Querying the profiler output     │
│  db.currentOp()      │  Live operation inspection        │
│  killOp()            │  Terminating runaway queries      │
└─────────────────────────────────────────────────────────┘
```

### Module 2 — Explain Plans ([02-Explain-Plans.md](./02-Explain-Plans.md))

```
┌─────────────────────────────────────────────────────────┐
│                  EXPLAIN PLAN TOPICS                     │
├─────────────────────────────────────────────────────────┤
│  explain() Modes     │  queryPlanner, executionStats,    │
│                      │  allPlansExecution               │
│  Winning Plan        │  How the query planner chooses   │
│  Rejected Plans      │  Understanding alternatives      │
│  Stage Types         │  COLLSCAN, IXSCAN, FETCH,        │
│                      │  SORT, PROJECTION, LIMIT         │
│  Key Metrics         │  nReturned, totalKeysExamined,   │
│                      │  totalDocsExamined, millis       │
│  Pipeline Explain    │  Aggregation stage analysis      │
│  Index Usage         │  isMultiKey, isSparse, direction │
└─────────────────────────────────────────────────────────┘
```

---

## File Index

| File | Description | Approx Lines |
|------|-------------|--------------|
| [01-Query-Optimization.md](./01-Query-Optimization.md) | Index strategies, profiler, ESR rule, write overhead | 500+ |
| [02-Explain-Plans.md](./02-Explain-Plans.md) | Reading explain output, stage types, key metrics | 500+ |

---

## Estimated Timeline

```
┌────────────────────────────────────────────────────────────┐
│                    PHASE 8 SCHEDULE                        │
│                      1.5 WEEKS                             │
├──────────────┬─────────────────────────────────────────────┤
│  Days 1-3    │  01-Query-Optimization.md                   │
│              │  - Read theory + real examples              │
│              │  - Set up profiler on local MongoDB         │
│              │  - Run the 5 hands-on exercises             │
├──────────────┼─────────────────────────────────────────────┤
│  Days 4-6    │  02-Explain-Plans.md                        │
│              │  - Study all explain() modes                │
│              │  - Practice reading executionStats output   │
│              │  - Identify COLLSCAN → optimize to IXSCAN   │
├──────────────┼─────────────────────────────────────────────┤
│  Days 7-10   │  Consolidation + Interview Prep             │
│              │  - Review Q&A sections in both files        │
│              │  - Build a sample app and profile it        │
│              │  - Practice explaining your findings aloud  │
└──────────────┴─────────────────────────────────────────────┘
```

---

## Prerequisites

Before starting Phase 8, you should be comfortable with:

- **Phase 6** — Indexes: creating single-field and compound indexes, understanding index direction
- **Phase 7** — Aggregation: writing $match, $group, $lookup, $project pipelines
- Basic MongoDB shell operations: find(), insertMany(), createIndex()
- Connecting to a running mongod instance (local or Atlas free tier)

---

## Phase Overview Diagram

```
                     PERFORMANCE OPTIMIZATION FLOW
                     ==============================

   Application                MongoDB Server               Disk
   ──────────                 ──────────────               ────
       │                            │                        │
       │  db.orders.find({          │                        │
       │    status: "pending"       │                        │
       │  })                        │                        │
       │ ─────────────────────────► │                        │
       │                            │  1. Parse query        │
       │                            │  2. Check query cache  │
       │                            │  3. Generate plans     │
       │                            │     ┌──────────────┐   │
       │                            │     │ Plan A:      │   │
       │                            │     │ IXSCAN on    │   │
       │                            │     │ status_idx   │   │
       │                            │     ├──────────────┤   │
       │                            │     │ Plan B:      │   │
       │                            │     │ COLLSCAN     │   │
       │                            │     └──────────────┘   │
       │                            │  4. Race plans         │
       │                            │  5. Pick winner        │
       │                            │  6. Cache winner       │
       │                            │ ──────────────────────►│
       │                            │  7. Fetch matching docs│
       │  ◄─────────────────────── │ ◄──────────────────────│
       │  Results returned          │                        │
       │                            │                        │
                                    │
                        ┌───────────▼───────────┐
                        │  system.profile        │
                        │  (if slow query)       │
                        │  millis: 230           │
                        │  nReturned: 847        │
                        │  docsExamined: 50000   │
                        └───────────────────────┘
```

---

## Key Concepts at a Glance

### The Golden Ratio: Examined vs Returned

```
┌─────────────────────────────────────────────────────────┐
│              EFFICIENCY INDICATOR                        │
│                                                         │
│  docsExamined : nReturned                               │
│                                                         │
│  1:1   ──── Perfect (covered index or exact match)      │
│  10:1  ──── Acceptable for most workloads               │
│  100:1 ──── Warning — consider a better index           │
│  1000:1 ─── Critical — likely doing a COLLSCAN          │
│                                                         │
│  Rule of thumb: if examined >> returned, add an index   │
└─────────────────────────────────────────────────────────┘
```

### Profiler Levels

| Level | Behavior | Use Case |
|-------|----------|----------|
| 0 | Off — no profiling | Production default |
| 1 | Log queries slower than slowms (default 100ms) | Normal monitoring |
| 2 | Log ALL operations | Development debugging only |

### ESR Rule Summary

```
Compound Index Field Order:

  E → Equality fields first   (status = "active")
  S → Sort fields second      (createdAt: -1)
  R → Range fields last       (amount > 1000)

Example:
  db.orders.createIndex({ status: 1, createdAt: -1, amount: 1 })
  
  Query: { status: "active", amount: { $gt: 1000 } }.sort({ createdAt: -1 })
  This index covers all three operations efficiently.
```

---

## How the Files Connect

```
  Phase 8 Learning Path
  ─────────────────────

  01-Query-Optimization.md
  ├── You learn WHAT to optimize (indexes, profiler)
  ├── You learn HOW to find slow queries (profiler, currentOp)
  └── You learn index design principles (ESR, selectivity)
           │
           ▼ feeds into
  02-Explain-Plans.md
  ├── You learn to VERIFY your optimization worked
  ├── You read the proof (executionStats output)
  └── You compare before/after explain plans

  Together: Find slow query → Design fix → Verify with explain
```

---

## Quick Reference Commands

```js
// Enable profiler for queries > 50ms
db.setProfilingLevel(1, { slowms: 50 })

// View recent slow queries
db.system.profile.find().sort({ ts: -1 }).limit(5).pretty()

// Explain a query (execution stats mode)
db.orders.find({ status: "pending" }).explain("executionStats")

// Check what indexes exist on a collection
db.orders.getIndexes()

// See in-flight operations
db.currentOp({ active: true, secs_running: { $gt: 5 } })

// Kill a runaway operation
db.killOp(<opid>)

// Force a specific index
db.orders.find({ status: "pending" }).hint({ status: 1 })
```

---

*Phase 8 of the MongoDB & SQL Mastery Series — Performance Optimization*
