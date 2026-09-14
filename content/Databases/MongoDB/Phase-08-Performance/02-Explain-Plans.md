# MongoDB Explain Plans Deep Dive

> Phase 08 — Performance | File 02 of 02

---

## Table of Contents

1. [Introduction — The Query Execution Pipeline](#1-introduction--the-query-execution-pipeline)
2. [Full explain() Output Anatomy](#2-full-explain-output-anatomy)
   - 2.1 [Top-Level Structure](#21-top-level-structure)
   - 2.2 [Annotated JSON Walkthrough](#22-annotated-json-walkthrough)
3. [Stage Types — Complete Reference](#3-stage-types--complete-reference)
   - 3.1 [COLLSCAN](#31-collscan)
   - 3.2 [IXSCAN](#32-ixscan)
   - 3.3 [FETCH](#33-fetch)
   - 3.4 [SORT](#34-sort)
   - 3.5 [SORT_MERGE](#35-sort_merge)
   - 3.6 [PROJECTION_COVERED / PROJECTION_SIMPLE](#36-projection_covered--projection_simple)
   - 3.7 [OR / AND_HASH / AND_SORTED](#37-or--and_hash--and_sorted)
   - 3.8 [LIMIT / SKIP](#38-limit--skip)
   - 3.9 [COUNT / COUNT_SCAN](#39-count--count_scan)
   - 3.10 [UPDATE / DELETE](#310-update--delete)
4. [Winning Plan vs Rejected Plans](#4-winning-plan-vs-rejected-plans)
   - 4.1 [The Query Plan Cache](#41-the-query-plan-cache)
   - 4.2 [Cache Invalidation](#42-cache-invalidation)
5. [In-Memory Sort and the 32MB Limit](#5-in-memory-sort-and-the-32mb-limit)
6. [Covered Query Detection](#6-covered-query-detection)
7. [MongoDB Profiler](#7-mongodb-profiler)
   - 7.1 [setProfilingLevel 0, 1, 2](#71-setprofilinglevel-0-1-2)
   - 7.2 [Querying system.profile](#72-querying-systemprofile)
   - 7.3 [slowms Threshold](#73-slowms-threshold)
8. [Atlas Performance Advisor](#8-atlas-performance-advisor)
9. [Aggregation Pipeline explain()](#9-aggregation-pipeline-explain)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Introduction — The Query Execution Pipeline

File 01 taught you to read `nReturned`, `nDocsExamined`, and `nKeysExamined` as a health check. That's the vital-signs monitor. This file is the full body scan — the moment you stop asking "is this query sick?" and start asking "exactly which organ is failing, and why?"

To answer that, you need to understand what MongoDB actually does between the moment your query arrives and the moment results come back. It isn't a single step. It's a small pipeline, and `explain()` is the instrument that lets you watch every stage of it.

```
┌─────────────────────────────────────────────────────────────────────┐
│                   QUERY EXECUTION PIPELINE                          │
│                                                                     │
│  Client Query                                                       │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────┐                                                    │
│  │   Parser    │  Parse the query BSON into an internal AST        │
│  └──────┬──────┘                                                    │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │ Query       │  Check the plan cache for a cached winning plan   │
│  │ Planner     │  If none: generate candidate plans for each       │
│  │             │  applicable index + COLLSCAN fallback             │
│  └──────┬──────┘                                                    │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │ Plan        │  Run candidate plans in parallel for up to 101    │
│  │ Selection   │  results (trial period). Rank by productivity.    │
│  │ (Race)      │  Winning plan is cached.                          │
│  └──────┬──────┘                                                    │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │  Execution  │  Run the winning plan to completion               │
│  └──────┬──────┘                                                    │
│         │                                                           │
│         ▼                                                           │
│    Results to Client                                                │
└─────────────────────────────────────────────────────────────────────┘
```

`explain()` gives you a window into every step of this pipeline. Understanding the output is the most important skill for MongoDB performance work — everything from here on is really just learning to read this one diagram at increasing levels of detail.

---

## 2. Full explain() Output Anatomy

### 2.1 Top-Level Structure

Here's the problem this section solves: the first time you run `explain("executionStats")` on a real query, you get back a wall of nested JSON, and it's genuinely hard to know where to even start reading. Which part is "the plan"? Which part is "what actually happened"? Where do you look first?

Think of the output the way a doctor thinks of a diagnostic report — it isn't one flat list of numbers, it's organized into sections: history (what was asked), diagnosis (what plan was chosen), and vitals (what actually happened when it ran). Once you know the sections, the report stops being scary.

```
┌─────────────────────────────────────────────────────────────────┐
│              explain() TOP-LEVEL STRUCTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  {                                                              │
│    "queryPlanner": { ... }     ← Always present                 │
│    "executionStats": { ... }   ← Present in executionStats mode │
│    "serverInfo": { ... }       ← MongoDB version, host          │
│    "ok": 1                     ← Command success indicator      │
│  }                                                              │
│                                                                 │
│  Inside queryPlanner:                                           │
│    parsedQuery     ── Normalized form of your filter            │
│    winningPlan     ── The chosen execution plan tree            │
│    rejectedPlans   ── Other plans that lost the race            │
│                                                                 │
│  Inside executionStats:                                         │
│    nReturned           ── Documents sent to client              │
│    executionTimeMillis ── Total wall time                       │
│    totalKeysExamined   ── Index entries scanned                 │
│    totalDocsExamined   ── Documents loaded from storage         │
│    executionStages     ── Stage tree with per-stage stats       │
└─────────────────────────────────────────────────────────────────┘
```

Four top-level keys, two of which matter most: `queryPlanner` (the diagnosis — what MongoDB decided to do) and `executionStats` (the vitals — what happened when it actually did it).

### 2.2 Annotated JSON Walkthrough

Let's put that structure to work on a real example — a query on a `transactions` collection with a compound index on `{ accountId: 1, txDate: 1 }`:

```js
db.transactions.find(
  { accountId: "ACC-001", txDate: { $gte: ISODate("2024-01-01") } },
  { txDate: 1, amount: 1, _id: 0 }
).sort({ txDate: 1 }).explain("executionStats")
```

```json
{
  "queryPlanner": {
    "plannerVersion": 1,                         // Internal planner version
    "namespace": "mydb.transactions",            // db.collection
    "indexFilterSet": false,                     // No index hint applied
    "parsedQuery": {                             // Normalized filter
      "$and": [
        { "accountId": { "$eq": "ACC-001" } },
        { "txDate": { "$gte": ISODate("2024-01-01") } }
      ]
    },
    "winningPlan": {                             // Root of the plan tree
      "stage": "PROJECTION_COVERED",             // Top stage: covered projection
      "transformBy": {                           // Fields in output
        "txDate": 1,
        "amount": 1,
        "_id": 0
      },
      "inputStage": {
        "stage": "IXSCAN",                       // Index scan — no FETCH needed
        "keyPattern": { "accountId": 1, "txDate": 1 },
        "indexName": "accountId_1_txDate_1",
        "isMultiKey": false,                     // Not a multikey index
        "isUnique": false,
        "isSparse": false,
        "isPartial": false,
        "indexVersion": 2,
        "direction": "forward",                  // Scan direction
        "indexBounds": {                         // Tight bounds = efficient scan
          "accountId": [ "[\"ACC-001\", \"ACC-001\"]" ],
          "txDate": [ "[ISODate(\"2024-01-01\"), MaxKey]" ]
        }
      }
    },
    "rejectedPlans": []                          // No other plans considered
  },
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 47,                             // 47 docs matched and returned
    "executionTimeMillis": 1,                    // 1ms total wall time
    "totalKeysExamined": 47,                     // Exactly 47 keys scanned
    "totalDocsExamined": 0,                      // ZERO docs loaded — covered!
    "executionStages": {
      "stage": "PROJECTION_COVERED",
      "nReturned": 47,
      "executionTimeMillisEstimate": 0,
      "works": 48,                               // 47 results + 1 EOF
      "advanced": 47,
      "needTime": 0,
      "needYield": 0,
      "saveState": 0,
      "restoreState": 0,
      "isEOF": 1,                                // Reached end of results
      "inputStage": {
        "stage": "IXSCAN",
        "nReturned": 47,
        "keysExamined": 47,
        "seeks": 1,                              // 1 B-tree seek to find start
        "dupsTested": 0,
        "dupsDropped": 0
      }
    }
  },
  "serverInfo": {
    "host": "db01.internal",
    "port": 27017,
    "version": "7.0.4",
    "gitVersion": "abc123"
  },
  "ok": 1
}
```

Walk it top to bottom and it tells a clean story:
- `PROJECTION_COVERED` at the top with no FETCH stage confirms a covered query
- `totalDocsExamined: 0` — zero document reads from storage
- `nReturned: 47` equals `totalKeysExamined: 47` — perfect 1:1 ratio
- `seeks: 1` — one B-tree traversal to find the starting point, then 47 sequential reads

That's the diagnostic report read in full: healthy query, no wasted work.

> **Memory hook:** "queryPlanner is the diagnosis, executionStats is the vitals — read the diagnosis first, then check whether reality matched it."

---

## 3. Stage Types — Complete Reference

Now for the part that actually takes practice: recognizing stages by name and knowing what each one costs you. Think of MongoDB's execution engine as an assembly line. Each station (stage) takes what the station below it produced, does one job, and hands the result upward. Learn the stations, and any plan tree — no matter how deep — becomes readable at a glance.

```
┌─────────────────────────────────────────────────────────────────┐
│              STAGE PIPELINE FLOW (bottom to top)                │
│                                                                 │
│   PROJECTION_COVERED          ← top: final output             │
│        │                                                        │
│      SORT                     ← sort the results               │
│        │                                                        │
│      FETCH                    ← load full documents             │
│        │                                                        │
│      IXSCAN                   ← scan the index                  │
│                               ← bottom: reads index entries     │
│                                                                 │
│   OR                                                            │
│                                                                 │
│   PROJECTION_SIMPLE                                             │
│        │                                                        │
│      COLLSCAN                 ← reads every document            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 COLLSCAN

The one stage you never want to see on a large, frequently-run query. A collection scan reads every document in the collection sequentially — this is the "walk every aisle of the library" move from File 01. It's the default whenever no index can satisfy the query.

```json
{
  "stage": "COLLSCAN",
  "nReturned": 50,
  "docsExamined": 2500000,
  "direction": "forward"
}
```

Look at that ratio: 50 returned out of 2.5 million examined. That's not a query being slow — that's a query reading the entire library shelf by shelf to find 50 books.

When is COLLSCAN acceptable?
- Very small collections (under ~1000 documents)
- Full-collection exports or ETL operations
- Query with no filter (returning everything)

When is COLLSCAN a problem?
- Any large collection with a selective filter
- Queries executed more than once per second in production
- Any query appearing in application hot paths

**Interview answer:** "COLLSCAN means MongoDB found no usable index and read every document in the collection sequentially. It's the fallback plan, not a bug in itself — it's fine for tiny collections or full exports, but on a large collection under a selective filter it means every query pays for a full table read, which is the single most common cause of slow queries in production."

> **Memory hook:** "COLLSCAN is walking every aisle of the library because there's no card catalog for what you're looking for."

### 3.2 IXSCAN

This is the card-catalog move. An index scan traverses the B-tree index to find matching keys, then (usually) passes key-document pointer pairs to a FETCH stage.

```json
{
  "stage": "IXSCAN",
  "keyPattern": { "category": 1, "price": 1 },
  "indexName": "category_1_price_1",
  "isMultiKey": false,
  "direction": "forward",
  "indexBounds": {
    "category": [ "[\"electronics\", \"electronics\"]" ],
    "price": [ "[MinKey, 500]" ]
  },
  "keysExamined": 1250,
  "seeks": 1
}
```

The `indexBounds` field is where the real story lives — it tells you exactly how much of the index MongoDB had to walk:

```
indexBounds interpretation:
  "category": [ "[\"electronics\", \"electronics\"]" ]
   ── Equality: scans only the "electronics" partition of the index

  "price": [ "[MinKey, 500]" ]
   ── Range: from the beginning up to 500

  Tight bounds = efficient. Wide bounds or [[MinKey, MaxKey]] = index used
  but much of it is scanned.
```

One easy trap here: `isMultiKey: true` means the index is on an array field. MongoDB must store one entry per array element, so the index is larger and can have duplicate key → document pointer mappings.

> **Memory hook:** "IXSCAN is flipping through the card catalog — fast, because you're reading index cards, not walking to the shelf yet."

### 3.3 FETCH

If IXSCAN is "find the card in the catalog," FETCH is "walk to the shelf and physically pull the book." The FETCH stage loads full documents from the collection data files using the `_id` references returned by an IXSCAN.

```json
{
  "stage": "FETCH",
  "filter": { "inStock": { "$eq": true } },
  "nReturned": 320,
  "docsExamined": 1250,
  "inputStage": { "stage": "IXSCAN" }
}
```

The `filter` field inside FETCH is crucial: it shows a residual predicate — a filter condition that could not be resolved from the index alone and must be applied to the full document after loading it. Every document that passes the IXSCAN but fails this residual filter is a wasted document read.

```
FETCH with residual filter pattern:
  IXSCAN on { category: 1 } with filter category = "electronics"
  ── Returns 1250 key pointers
  FETCH loads 1250 documents
  ── Applies residual filter: inStock = true
  ── 930 documents fail → wasted
  nReturned = 320, docsExamined = 1250

  Fix: Add inStock to the index → { category: 1, inStock: 1 }
  ── IXSCAN filters to only inStock=true entries
  ── FETCH loads only 320 documents
```

That's a residual filter in a nutshell: 930 books pulled off the shelf and put right back, for nothing.

**Common mistake:** looking only at `nReturned` and declaring victory. A FETCH stage can look "fine" at a glance while quietly discarding the majority of the documents it loaded — always compare `nReturned` against `docsExamined` on the FETCH stage itself, not just the top-level totals.

> **Memory hook:** "FETCH is walking to the shelf and pulling the book — a residual filter is pulling books you then put straight back without reading."

### 3.4 SORT

The problem SORT solves — or rather, the problem it signals — is a sort order the index couldn't provide for free. The SORT stage performs an in-memory sort when the query's sort order cannot be served by the index traversal direction.

```json
{
  "stage": "SORT",
  "sortPattern": { "createdAt": -1 },
  "memUsage": 15728640,
  "memLimit": 33554432,
  "nReturned": 5000,
  "inputStage": { "stage": "FETCH" }
}
```

```
memUsage:  15728640 bytes = 15 MB   ── Under limit
memLimit:  33554432 bytes = 32 MB   ── The hard limit

If memUsage > memLimit, the query fails with:
  "Sort exceeded memory limit of 33554432 bytes"

Exception: allowDiskUse: true in aggregate() lets SORT spill to disk.
This is not available for find() cursor sorts.
```

How to eliminate SORT stage:
- Create an index whose key order matches the sort order
- For compound queries, follow the ESR rule (Equality → Sort → Range)
- For descending sorts, create an index with the matching `-1` direction

```js
// Query: find by status, sort by createdAt descending
// This causes in-memory SORT stage:
db.orders.find({ status: "active" }).sort({ createdAt: -1 })

// This eliminates the SORT stage:
db.orders.createIndex({ status: 1, createdAt: -1 })
```

> **Memory hook:** "A SORT stage is MongoDB re-shuffling a deck it already had in the wrong order — give it a pre-sorted deck (an index) and the shuffle disappears."

### 3.5 SORT_MERGE

SORT_MERGE appears when MongoDB uses multiple index scans (via an OR query or index intersection) and must merge and sort their results.

```json
{
  "stage": "SORT_MERGE",
  "sortPattern": { "score": -1 },
  "inputStages": [
    { "stage": "IXSCAN", "indexName": "category_1_score_1" },
    { "stage": "IXSCAN", "indexName": "featured_1_score_1" }
  ]
}
```

SORT_MERGE is typically seen with `$or` queries where each branch uses a different index. It is generally efficient, but if the sort pattern does not match the index direction, an additional in-memory sort may be added on top.

### 3.6 PROJECTION_COVERED / PROJECTION_SIMPLE

Same word, two very different outcomes depending on whether a FETCH sits underneath:

```
┌──────────────────────────────────────────────────────────────────┐
│           PROJECTION STAGE VARIANTS                              │
├──────────────────────────┬───────────────────────────────────────┤
│ PROJECTION_COVERED       │ All output fields come from the index │
│                          │ No FETCH stage below this             │
│                          │ nDocsExamined = 0 (ideal)             │
├──────────────────────────┼───────────────────────────────────────┤
│ PROJECTION_SIMPLE        │ Projection applied after FETCH        │
│                          │ Documents still loaded from storage   │
│                          │ Reduces network transfer but not I/O  │
└──────────────────────────┴───────────────────────────────────────┘
```

### 3.7 OR / AND_HASH / AND_SORTED

These stages handle multi-index operations:

```
OR          ── Executes each branch of a $or independently,
               merges results (deduplicating by _id)

AND_HASH    ── Index intersection using a hash join on document _ids
               Rare; appears when two indexes are intersected on equality

AND_SORTED  ── Index intersection on sorted index scans
               More efficient than AND_HASH for range queries
```

Note: MongoDB generally prefers a single compound index over index intersection. If you see AND_HASH or AND_SORTED frequently, consider creating a dedicated compound index.

### 3.8 LIMIT / SKIP

```json
{
  "stage": "LIMIT",
  "limitAmount": 10,
  "nReturned": 10,
  "inputStage": {
    "stage": "SORT",
    "nReturned": 50000
  }
}
```

Here's the detail that's easy to miss on a first read: where LIMIT sits in the tree changes everything. LIMIT placed ABOVE a SORT stage means the sort completed on all matching documents before truncation. LIMIT placed BELOW a SORT (as `inputStage`) means MongoDB can use an index-backed top-k optimization — only the top 10 documents are ever materialized.

```
SORT → LIMIT  (bad):  Sort 50,000 docs, then take top 10
LIMIT → SORT  (good): Only maintain top-10 heap during sort

MongoDB automatically pushes LIMIT down past SORT when the sort
is index-backed. The explain output will show this as a single
"SORT" stage with a limit field: { "limitAmount": 10 }.
```

### 3.9 COUNT / COUNT_SCAN

```js
db.orders.countDocuments({ status: "active" })
```

If an index on `status` exists, explain may show `COUNT_SCAN` — a fast index-only count that never loads documents. Without an index it degrades to COLLSCAN + COUNT.

```json
{
  "stage": "COUNT",
  "nCounted": 4521,
  "inputStage": {
    "stage": "COUNT_SCAN",
    "indexName": "status_1",
    "keysExamined": 4521
  }
}
```

> **Memory hook:** "COUNT_SCAN is counting index cards without ever opening a book — COLLSCAN + COUNT is counting every book on the shelf one by one."

### 3.10 UPDATE / DELETE

Update and delete operations also use the query plan for the filter portion:

```js
db.orders.updateMany({ status: "pending" }, { $set: { flagged: true } }).explain()
```

The explain output shows the query plan used to find matching documents plus an UPDATE or DELETE stage at the top. The same IXSCAN vs COLLSCAN analysis applies — the filter plan for a write is as important as for a read.

---

## 4. Winning Plan vs Rejected Plans

### 4.1 The Query Plan Cache

Here's a question worth asking: if MongoDB has to run a "race" between candidate plans every single time (as covered in File 01's `allPlansExecution` mode), doesn't that mean every query pays the cost of testing multiple plans? It would — except MongoDB doesn't re-plan every query from scratch. After the first execution, the winning plan is stored in the plan cache keyed by the query's "shape" — the combination of filter fields, sort fields, and projection fields (but NOT their values).

```
Query shape example:
  db.orders.find({ status: "x", userId: 42 }).sort({ date: -1 })

  Shape key: { filter: { status: 1, userId: 1 }, sort: { date: 1 } }

  Next time any query with the same shape runs (even with different
  values for status and userId), MongoDB reuses the cached plan.
```

Viewing the plan cache:

```js
// List all cached plans for a collection
db.orders.getPlanCache().list()

// Clear all cached plans for a collection
db.orders.getPlanCache().clear()

// Clear a specific plan (by plan cache key)
db.orders.getPlanCache().clearPlansByQuery(
  { status: "x", userId: 42 },
  { date: -1 }
)
```

Plan cache entry states:

```
┌─────────────────────────────────────────────────────────────────┐
│                PLAN CACHE ENTRY STATES                          │
├──────────────────┬──────────────────────────────────────────────┤
│ "Missing"        │ No cached plan; will be re-planned on next   │
│                  │ execution                                     │
├──────────────────┼──────────────────────────────────────────────┤
│ "Inactive"       │ Plan was generated but has not been pinned   │
│                  │ yet (needs more executions to confirm)        │
├──────────────────┼──────────────────────────────────────────────┤
│ "Active"         │ Plan is trusted and will be reused without   │
│                  │ re-planning                                   │
└──────────────────┴──────────────────────────────────────────────┘
```

### 4.2 Cache Invalidation

A cached plan is only useful if it stays correct — so it needs to be thrown away the moment the assumptions behind it change. The plan cache is automatically invalidated when:
- An index is added or dropped on the collection
- The collection is rebuilt
- mongod restarts
- The collection grows significantly (MongoDB re-plans when data distribution changes enough to make the cached plan suboptimal)

Sometimes you don't want to wait for automatic invalidation — you want to force a specific plan right now, either to test a hypothesis or to work around a bad cached choice. That's what `hint()` is for:

```js
// Hint by index name — bypasses plan cache and forces this index
db.orders.find({ status: "active", userId: 42 })
  .hint("status_1_userId_1")
  .explain("executionStats")

// Hint by key pattern
db.orders.find({ status: "active", userId: 42 })
  .hint({ status: 1, userId: 1 })

// Force COLLSCAN
db.orders.find({ status: "active" })
  .hint({ $natural: 1 })
```

> **Memory hook:** "The plan cache is a cheat sheet MongoDB writes for itself after winning the race once — `hint()` is you tearing up that cheat sheet and forcing a specific answer."

---

## 5. In-Memory Sort and the 32MB Limit

Here's a scenario every MongoDB team eventually lives through: a sort that worked perfectly fine in development suddenly throws an error in production, with no code change anywhere. The culprit is almost always the 32 MB in-memory sort limit — one of the most common production failures for queries that were working fine at small data volumes and break the moment real data volume shows up.

```
Why 32MB?
  MongoDB allocates an in-memory buffer for sorting.
  The buffer is bounded to prevent a single query from
  consuming all available memory on a shared server.
  32MB is the default; it cannot be changed for find() queries.
```

You don't have to wait for the error to hit production — you can watch the SORT stage's memory usage climb toward the ceiling ahead of time:

```js
const result = db.orders.find({ status: "active" })
  .sort({ createdAt: -1 })
  .explain("executionStats")

// Find the SORT stage in executionStages
function findSortStage(stage) {
  if (stage.stage === "SORT") {
    const pct = (stage.memUsage / stage.memLimit * 100).toFixed(1)
    console.log(`Sort memory: ${stage.memUsage} / ${stage.memLimit} bytes (${pct}%)`)
    if (stage.memUsage / stage.memLimit > 0.8) {
      console.log("WARNING: Approaching 32MB sort limit")
    }
  }
  if (stage.inputStage) findSortStage(stage.inputStage)
  if (stage.inputStages) stage.inputStages.forEach(findSortStage)
}

findSortStage(result.executionStats.executionStages)
```

Once you know a query is approaching (or blowing past) the limit, you have four real options:

```
┌─────────────────────────────────────────────────────────────────┐
│              SORT LIMIT SOLUTIONS                               │
├──────────────────────────┬──────────────────────────────────────┤
│ Add an index             │ Best solution. Index-backed sort      │
│                          │ never uses in-memory sort buffer.     │
├──────────────────────────┼──────────────────────────────────────┤
│ Add LIMIT before sort    │ If you only need top-N results,       │
│                          │ a LIMIT hint allows efficient top-k   │
├──────────────────────────┼──────────────────────────────────────┤
│ Use aggregate() with     │ allowDiskUse: true lets the SORT      │
│ allowDiskUse: true       │ stage spill to disk. Slower but       │
│                          │ does not fail.                        │
├──────────────────────────┼──────────────────────────────────────┤
│ Filter more aggressively │ Reduce the result set before sort     │
│                          │ so fewer bytes need to be sorted.     │
└──────────────────────────┴──────────────────────────────────────┘
```

```js
// allowDiskUse for large aggregation sorts (MongoDB 4.4+)
db.orders.aggregate(
  [
    { $match: { status: "active" } },
    { $sort: { createdAt: -1 } }
  ],
  { allowDiskUse: true }
)

// MongoDB 6.0+: configure sort memory limit per operation
db.orders.aggregate(
  [
    { $match: { status: "active" } },
    { $sort: { createdAt: -1 } }
  ],
  { allowDiskUse: true }
)
```

Of the four, the first is really the only one that fixes the root cause — the others are all ways of coping with an unavoidable in-memory sort.

**Interview answer:** "MongoDB caps an in-memory sort buffer at 32MB per query to stop one query from monopolizing server memory. If the documents being sorted exceed that, `find()` throws an error outright. The proper fix is an index that matches the sort order so the sort is index-backed and never touches the 32MB buffer at all; `allowDiskUse: true` on `aggregate()` is the fallback when that isn't possible."

> **Memory hook:** "32MB is the size of the desk MongoDB is willing to clear off to sort papers by hand — past that, it either needs a filing cabinet already in order (an index) or has to use the floor (disk spill)."

---

## 6. Covered Query Detection

File 01 introduced covered queries as "the ultimate projection optimization." This section is about confirming, from the explain output, that you've actually achieved one — rather than assuming you have because you added an index.

A covered query is the highest possible optimization in MongoDB — zero document reads, with all data served directly from the index. Here's the checklist for proving it:

```
Covered query signatures:
  1. totalDocsExamined = 0  in executionStats
  2. No FETCH stage in the plan tree
  3. Top stage is PROJECTION_COVERED (not PROJECTION_SIMPLE)
  4. All projected fields appear in the indexBounds
```

Step-by-step covered query setup:

```js
// Step 1: Identify the query
db.events.find(
  { userId: 123, eventType: "click" },
  { userId: 1, eventType: 1, timestamp: 1, _id: 0 }
)

// Step 2: Build an index containing ALL fields in both filter AND projection
// Filter fields: userId, eventType
// Projection fields: userId, eventType, timestamp
// Combined unique set: userId, eventType, timestamp
db.events.createIndex({ userId: 1, eventType: 1, timestamp: 1 })

// Step 3: Verify with explain
const result = db.events.find(
  { userId: 123, eventType: "click" },
  { userId: 1, eventType: 1, timestamp: 1, _id: 0 }
).explain("executionStats")

console.log("Docs examined:", result.executionStats.totalDocsExamined)  // Should be 0
```

And here are the four ways teams most often build a covered query by mistake and get a silent FETCH instead:

```
1. Forgetting _id: 0
   _id is always projected by default. Since _id is not in
   custom indexes, the query must FETCH the document to get _id.
   Always add _id: 0 when building covered queries.

2. Including a field not in the index
   Projecting a field not in the index forces a FETCH for that field.
   Every projected field MUST be in the index.

3. Querying array fields (multikey index)
   MongoDB cannot use a covered query when the index is multikey
   (i.e., the indexed field is an array). It always adds a FETCH
   to verify the document-level filter.

4. Using $elemMatch in projection
   $elemMatch in projection requires loading the document.
```

**Interview answer:** "A covered query is answered entirely from the index — MongoDB never touches the underlying document. You prove it from explain() by checking `totalDocsExamined === 0`, confirming there's no FETCH stage, and seeing `PROJECTION_COVERED` at the top instead of `PROJECTION_SIMPLE`. It requires every filter and projection field to live in the index, and `_id` must be explicitly excluded since it isn't part of custom indexes by default."

> **Memory hook:** "A covered query answers your question from the card catalog alone — it never walks to the shelf."

---

## 7. MongoDB Profiler

Everything so far has answered "how does this one query I already know about behave?" But the harder question in a real production system is: which queries, out of the thousands running every minute, are actually the slow ones I don't know about yet? That's the gap the MongoDB profiler fills — a built-in query logging system that stores operation data in the `system.profile` capped collection for analysis.

### 7.1 setProfilingLevel 0, 1, 2

```
┌─────────────────────────────────────────────────────────────────┐
│              PROFILING LEVELS                                   │
├───────┬─────────────────────────────────────────────────────────┤
│ Level │ Behavior                                                │
├───────┼─────────────────────────────────────────────────────────┤
│   0   │ Profiler OFF. No operations are logged.                 │
│       │ (Default; use in production unless actively profiling)  │
├───────┼─────────────────────────────────────────────────────────┤
│   1   │ Log only slow operations — those exceeding the          │
│       │ slowms threshold. Recommended for production profiling. │
├───────┼─────────────────────────────────────────────────────────┤
│   2   │ Log ALL operations. Creates heavy write overhead.       │
│       │ Use only briefly in development/staging.                │
└───────┴─────────────────────────────────────────────────────────┘
```

```js
// Check current profiling status
db.getProfilingStatus()
// { "was" : 0, "slowms" : 100, "sampleRate" : 1 }

// Enable level 1 — log operations slower than 50ms
db.setProfilingLevel(1, { slowms: 50 })

// Enable level 2 — log everything (use with care)
db.setProfilingLevel(2)

// Disable profiler
db.setProfilingLevel(0)

// Set profiling on a specific database
use mydb
db.setProfilingLevel(1, { slowms: 100, sampleRate: 0.5 })
```

The `system.profile` collection is a capped collection. By default it is 1MB. In busy systems, increase it:

```js
// Increase system.profile size (must disable profiler first, then drop and recreate)
db.setProfilingLevel(0)
db.system.profile.drop()
db.createCollection("system.profile", { capped: true, size: 10485760 })  // 10MB
db.setProfilingLevel(1, { slowms: 100 })
```

### 7.2 Querying system.profile

Once the profiler is on, it starts writing one document per operation into `system.profile` — a rich, queryable record of what actually happened. Instead of grepping a log file, you can just query it like any other collection:

```js
// View the most recent 5 operations
db.system.profile.find().sort({ ts: -1 }).limit(5).pretty()

// Find all collection scans
db.system.profile.find({ planSummary: "COLLSCAN" }).sort({ ts: -1 })

// Find operations slower than 500ms
db.system.profile.find({ millis: { $gt: 500 } }).sort({ millis: -1 })

// Find operations on a specific collection
db.system.profile.find({ ns: "mydb.orders" }).sort({ millis: -1 }).limit(10)

// Find insert operations
db.system.profile.find({ op: "insert" }).sort({ ts: -1 })

// Find queries that examined many documents
db.system.profile.find({ docsExamined: { $gt: 10000 } }).sort({ docsExamined: -1 })
```

Profile document structure (key fields):

```json
{
  "op": "query",
  "ns": "mydb.orders",
  "command": {
    "find": "orders",
    "filter": { "status": "pending", "userId": 42 },
    "sort": { "createdAt": -1 },
    "limit": 10
  },
  "keysExamined": 47,
  "docsExamined": 47,
  "cursorExhausted": true,
  "numYield": 0,
  "nreturned": 10,
  "queryHash": "ABC12345",
  "planCacheKey": "DEF67890",
  "planSummary": "IXSCAN { userId: 1, status: 1, createdAt: -1 }",
  "millis": 2,
  "ts": ISODate("2024-12-15T14:30:01.234Z"),
  "client": "192.168.1.10:51234",
  "appName": "MyApp",
  "user": "appuser"
}
```

Because it's a real collection, you can aggregate over it — which is how you go from "one slow query" to "our top 10 slowest query shapes this week":

```js
// Top 10 slowest query shapes
db.system.profile.aggregate([
  { $match: { op: "query" } },
  { $group: {
    _id: "$queryHash",
    avgMillis: { $avg: "$millis" },
    maxMillis: { $max: "$millis" },
    count: { $sum: 1 },
    ns: { $first: "$ns" }
  }},
  { $sort: { avgMillis: -1 } },
  { $limit: 10 }
])

// Collections with most COLLSCAN operations
db.system.profile.aggregate([
  { $match: { planSummary: "COLLSCAN" } },
  { $group: { _id: "$ns", count: { $sum: 1 }, avgMillis: { $avg: "$millis" } } },
  { $sort: { count: -1 } }
])
```

### 7.3 slowms Threshold

The `slowms` threshold filters which operations are written to `system.profile` when using level 1. Setting it too low generates excessive profiler I/O; too high misses important slow queries. It's the same threshold-tuning tradeoff File 01 covered for the slow query log — set it once per environment, and adjust as traffic grows.

```
┌──────────────────────────────────────────────────────────────┐
│             slowms THRESHOLD GUIDE                           │
├────────────────┬─────────────────────────────────────────────┤
│ Environment    │ Recommended slowms                          │
├────────────────┼─────────────────────────────────────────────┤
│ Development    │ 0 (log everything for analysis)             │
│ Staging        │ 20ms (aggressive — catch minor issues)      │
│ Production     │ 100ms (standard)                            │
│ High traffic   │ 250ms (reduce profiler overhead)            │
└────────────────┴─────────────────────────────────────────────┘
```

> **Memory hook:** "The profiler is a security camera pointed at your queries — `slowms` is just how motion-sensitive you set it, and level 2 means it's recording everyone, all the time, tape included."

---

## 8. Atlas Performance Advisor

Everything in Section 7 requires you to turn the profiler on, remember to turn it off, and manually query `system.profile`. MongoDB Atlas offers a shortcut: an automated Performance Advisor that watches query patterns continuously and hands you index recommendations — the cloud-native alternative to manually reading `system.profile`.

```
┌─────────────────────────────────────────────────────────────────┐
│              ATLAS PERFORMANCE ADVISOR FEATURES                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Automatic Detection                                            │
│    ── Monitors all queries continuously                         │
│    ── Identifies slow operations without manual profiling       │
│    ── Groups queries by shape for pattern analysis              │
│                                                                 │
│  Index Recommendations                                          │
│    ── Suggests specific createIndex() commands                  │
│    ── Shows estimated performance improvement                   │
│    ── Highlights indexes being used infrequently (drop these)   │
│                                                                 │
│  Query Profiler UI                                              │
│    ── Visual timeline of slow queries                           │
│    ── Filter by collection, operation type, duration            │
│    ── Drill down into individual operation explain plans        │
│                                                                 │
│  Schema Advisor                                                 │
│    ── Detects anti-patterns: large arrays, unbounded documents  │
│    ── Suggests schema improvements alongside index changes      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Accessing Performance Advisor in Atlas:

```
Atlas Dashboard
  └── Project
      └── Cluster
          └── Performance Advisor (left nav)
              ├── Suggested Indexes tab
              │     Shows top index recommendations with
              │     impact score and the createIndex command
              │
              ├── Query Profiler tab
              │     Visual query timeline; filter by namespace,
              │     op type, duration range
              │
              └── Schema Advisor tab
                    Anti-pattern detection with remediation advice
```

Key difference from manual profiling:
- Performance Advisor works at the cluster level without enabling profiling
- No write overhead to `system.profile`
- Provides a web UI with filtering, sorting, and direct index creation
- Available on M10+ clusters (not free tier M0)

> **Memory hook:** "Performance Advisor is a doctor doing rounds automatically instead of waiting for you to flip on the security camera and review the tape yourself."

---

## 9. Aggregation Pipeline explain()

Everything so far has been `find()`. Aggregation pipelines have their own explain output structure, which differs slightly — because a pipeline has multiple stages of its own, each of which can be inspected individually.

```js
db.orders.explain("executionStats").aggregate([
  { $match: { status: "shipped", createdAt: { $gte: ISODate("2024-01-01") } } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])
```

Aggregation explain output structure:

```json
{
  "stages": [
    {
      "$cursor": {
        "queryPlanner": {
          "winningPlan": {
            "stage": "FETCH",
            "inputStage": {
              "stage": "IXSCAN",
              "indexName": "status_1_createdAt_1"
            }
          }
        },
        "executionStats": {
          "nReturned": 15420,
          "totalDocsExamined": 15420,
          "totalKeysExamined": 15420
        }
      }
    },
    {
      "$group": {
        "nReturned": 2341
      }
    },
    {
      "$sort": {
        "nReturned": 10,
        "memUsage": 524288,
        "totalDataSizeSorted": 524288,
        "usedDisk": false
      }
    },
    {
      "$limit": {
        "nReturned": 10
      }
    }
  ]
}
```

Five patterns are worth checking every time you explain a pipeline:

```
1. The $match stage becomes a $cursor stage — this is the MongoDB
   query engine handling the initial filter. Always verify it
   shows IXSCAN, not COLLSCAN.

2. If $match is not the first stage, MongoDB cannot use an index
   for that filter — always put $match as early as possible.

3. $group after a large $match means all matched documents must
   be passed to the grouping engine — check for index coverage
   on the $match fields.

4. $sort with usedDisk: true means the sort exceeded 32MB and
   spilled to disk — this is slow. Add an index or filter more.

5. $lookup without an index on the foreign collection's join
   field performs a COLLSCAN for every document in the pipeline.
```

> **Memory hook:** "An aggregation pipeline is an assembly line with its own stations bolted on after the query engine's — check the `$cursor` station first, since a COLLSCAN there poisons everything downstream of it."

---

## 10. Hands-On Exercises

### Exercise 1 — Annotate a Real explain() Output

```js
// Setup
use explain_lab
db.sales.drop()
for (let i = 0; i < 200000; i++) {
  db.sales.insertOne({
    region: ["APAC","EMEA","AMER"][i % 3],
    product: `PROD-${i % 500}`,
    amount: Math.random() * 10000,
    saleDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    rep: `REP-${i % 50}`
  })
}

// Task 1: Run without an index
const r1 = db.sales.find({ region: "APAC" }).explain("executionStats")
// Note the stage, nDocsExamined, executionTimeMillis

// Task 2: Add index and run again
db.sales.createIndex({ region: 1 })
const r2 = db.sales.find({ region: "APAC" }).explain("executionStats")
// Compare: stage, nDocsExamined, keysExamined, executionTimeMillis

// Task 3: Add compound index and check residual filter
db.sales.createIndex({ region: 1, product: 1 })
const r3 = db.sales.find({ region: "APAC", product: "PROD-1" }).explain("executionStats")
// Is there a residual filter in the FETCH stage?

// Answer: with compound index, FETCH should have no residual filter
// and keysExamined should approximately equal nReturned
```

### Exercise 2 — Trigger and Escape the 32MB Sort Limit

```js
// Setup: create documents large enough to exceed 32MB when sorted
use sort_lab
db.bigdocs.drop()
for (let i = 0; i < 5000; i++) {
  db.bigdocs.insertOne({
    seq: i,
    payload: "x".repeat(8000),   // ~8KB per document
    score: Math.random() * 1000
  })
}
// 5000 × 8KB = ~40MB — will exceed sort limit

// Task 1: Attempt a sort (should fail or be close to limit)
try {
  db.bigdocs.find({}).sort({ score: -1 }).toArray()
  console.log("Sort succeeded")
} catch(e) {
  console.log("Sort failed:", e.message)
}

// Task 2: Add an index to enable index-backed sort (no memory buffer)
db.bigdocs.createIndex({ score: 1 })
const result = db.bigdocs.find({}).sort({ score: 1 }).explain("executionStats")
// Verify: no SORT stage in plan (index provides the order)

// Task 3: Use aggregate with allowDiskUse for descending sort
db.bigdocs.aggregate(
  [{ $sort: { score: -1 } }],
  { allowDiskUse: true }
).toArray()
```

### Exercise 3 — Build a Covered Query

```js
// Setup
use covered_lab
db.pageviews.drop()
for (let i = 0; i < 100000; i++) {
  db.pageviews.insertOne({
    userId: i % 1000,
    page: `/page/${i % 200}`,
    duration: Math.floor(Math.random() * 300),
    ts: new Date(),
    sessionId: `sess-${i}`,
    browser: ["chrome","firefox","safari"][i % 3]
  })
}

// Task 1: Run the target query WITHOUT a covered index
// and note totalDocsExamined
db.pageviews.find(
  { userId: 42 },
  { userId: 1, page: 1, duration: 1, _id: 0 }
).explain("executionStats")

// Task 2: Create a covering index
db.pageviews.createIndex({ userId: 1, page: 1, duration: 1 })

// Task 3: Run again and verify totalDocsExamined = 0
const r = db.pageviews.find(
  { userId: 42 },
  { userId: 1, page: 1, duration: 1, _id: 0 }
).explain("executionStats")

console.log("Stage:", r.queryPlanner.winningPlan.stage)  // PROJECTION_COVERED
console.log("DocsExamined:", r.executionStats.totalDocsExamined)  // 0
```

### Exercise 4 — Use the Profiler to Find Slow Queries

```js
// Setup
use profiler_lab
db.setProfilingLevel(1, { slowms: 5 })  // Low threshold to catch everything

// Task 1: Run some queries
db.orders.find({ status: "active" }).toArray()
db.orders.find({ amount: { $gt: 500 } }).toArray()
db.orders.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])

// Task 2: Query system.profile to find slow operations
db.system.profile.find({}, {
  op: 1,
  ns: 1,
  millis: 1,
  planSummary: 1,
  docsExamined: 1,
  nreturned: 1
}).sort({ millis: -1 }).limit(10).pretty()

// Task 3: Find all COLLSCAN entries and create appropriate indexes
const colls = db.system.profile.distinct("ns", { planSummary: "COLLSCAN" })
console.log("Collections with COLLSCAN:", colls)

// Task 4: Disable profiler when done
db.setProfilingLevel(0)
```

### Exercise 5 — Aggregation Pipeline Optimization

```js
// Setup
use agg_lab
db.transactions.drop()
for (let i = 0; i < 300000; i++) {
  db.transactions.insertOne({
    accountId: `ACC-${i % 1000}`,
    txType: ["credit","debit","transfer"][i % 3],
    amount: Math.random() * 10000,
    currency: ["AUD","USD","EUR"][i % 3],
    txDate: new Date(2024, Math.floor(Math.random() * 12), 1)
  })
}

// Task 1: Run a slow aggregation pipeline
const slow = db.transactions.explain("executionStats").aggregate([
  { $match: { txType: "credit", currency: "AUD" } },
  { $group: { _id: "$accountId", totalCredit: { $sum: "$amount" } } },
  { $sort: { totalCredit: -1 } },
  { $limit: 10 }
])
// Note: $cursor stage should show COLLSCAN — no index

// Task 2: Add an index for the $match filter
db.transactions.createIndex({ txType: 1, currency: 1 })

// Task 3: Re-run and compare
const fast = db.transactions.explain("executionStats").aggregate([
  { $match: { txType: "credit", currency: "AUD" } },
  { $group: { _id: "$accountId", totalCredit: { $sum: "$amount" } } },
  { $sort: { totalCredit: -1 } },
  { $limit: 10 }
])
// Verify $cursor now shows IXSCAN and reduced docsExamined
```

---

## 11. Interview Q&A

**Q1: What is the difference between a FETCH stage and a COLLSCAN stage?**

A: COLLSCAN reads every document in the collection sequentially without using any index. FETCH loads specific documents from storage using `_id` references returned by an IXSCAN stage. FETCH is normal and expected in most queries — the concern is when FETCH has a large residual filter causing many wasteful document loads. COLLSCAN on a large collection is almost always a problem.

---

**Q2: How do you detect a covered query in explain() output?**

A: Three indicators: (1) `totalDocsExamined` equals 0 in executionStats, (2) there is no FETCH stage in the execution plan tree, and (3) the top-level projection stage is `PROJECTION_COVERED` rather than `PROJECTION_SIMPLE`. All fields in both the filter and projection must be present in the index, and `_id` must be explicitly excluded with `_id: 0`.

---

**Q3: What causes the "Sort exceeded memory limit" error?**

A: When a query requires an in-memory sort (no index covers the sort order) and the sorted result set exceeds 32MB, MongoDB throws this error. Solutions: add an index matching the sort pattern to avoid in-memory sorting entirely; use `aggregate()` with `allowDiskUse: true` to allow disk spill; or add a `$limit` before the sort to reduce the number of documents being sorted.

---

**Q4: What is a residual filter in a FETCH stage and why is it a performance problem?**

A: A residual filter is a query condition shown inside the FETCH stage that could not be resolved using the index. MongoDB loads the full document from storage and then applies this filter. Every document that passes the IXSCAN but fails the residual filter is a wasted disk read. The fix is to extend the compound index to include the residual filter field, converting the post-fetch filter into an index-bound filter.

---

**Q5: What is the query plan cache and when is it invalidated?**

A: The plan cache stores the winning plan for each query shape (field patterns, not values). It avoids re-running the plan selection race on every query execution. It is invalidated when an index is added or dropped on the collection, when the collection data grows significantly enough that the cached plan becomes suboptimal, or when mongod restarts. You can manually clear it with `db.collection.getPlanCache().clear()`.

---

**Q6: Explain the difference between profiling levels 0, 1, and 2.**

A: Level 0 disables profiling entirely — no overhead, no data collection. Level 1 logs only operations that exceed the `slowms` threshold to `system.profile` — a good production setting for visibility with minimal overhead. Level 2 logs every single operation — appropriate only for brief diagnostic sessions in development or staging because it creates significant write overhead to the capped `system.profile` collection.

---

**Q7: What is SORT_MERGE and when does it appear?**

A: SORT_MERGE appears when MongoDB uses multiple index scans (typically from an `$or` query where each branch uses a different index) and merges their pre-sorted results. It is more efficient than sorting after merging because each input stream is already sorted. It appears most often with OR queries on indexed fields.

---

**Q8: Why does adding a multikey index prevent covered queries?**

A: A multikey index stores one entry per element of an array field. When MongoDB resolves an IXSCAN on a multikey index, one index key can correspond to multiple documents (or vice versa), and the index structure alone does not faithfully represent the document's array contents. MongoDB always adds a FETCH stage to validate the full document's array content against the filter, even if all projected fields are technically in the index.

---

**Q9: How does the query planner "race" work in MongoDB's plan selection?**

A: When there are multiple candidate plans (multiple applicable indexes plus possibly COLLSCAN), MongoDB runs all of them in parallel during a trial period. The first plan to either return 101 documents or exhaust its results wins. MongoDB then uses this winning plan for all future executions with the same query shape (cached in the plan cache). The race ensures that empirical performance, not theoretical estimates, determines the winning plan.

---

**Q10: What is the difference between system.profile and the slow query log?**

A: The slow query log writes entries to the mongod log file (e.g., `/var/log/mongodb/mongod.log`) whenever a query exceeds slowms. It always works regardless of profiling level — it is a server-level log. `system.profile` is the profiler collection inside MongoDB itself, only populated when profiling level is 1 or 2. The log file requires shell/log analysis tools; `system.profile` can be queried directly with MongoDB aggregations, making it easier to analyze programmatically.

