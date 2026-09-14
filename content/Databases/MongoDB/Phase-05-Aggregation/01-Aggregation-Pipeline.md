# 01 — The Aggregation Pipeline

## Table of Contents

1. [What is the Aggregation Pipeline?](#1-what-is-the-aggregation-pipeline)
2. [Real-World Analogy](#2-real-world-analogy)
3. [Core Syntax](#3-core-syntax)
4. [ASCII Pipeline Flow Diagram](#4-ascii-pipeline-flow-diagram)
5. [How Documents Stream Through Stages](#5-how-documents-stream-through-stages)
6. [Under the Hood: Execution Model](#6-under-the-hood-execution-model)
7. [Aggregation vs MapReduce](#7-aggregation-vs-mapreduce)
8. [The 100 MB Memory Limit](#8-the-100-mb-memory-limit)
9. [allowDiskUse: true](#9-allowdiskuse-true)
10. [Pipeline Optimization Rules](#10-pipeline-optimization-rules)
11. [Explain Plan for Aggregation](#11-explain-plan-for-aggregation)
12. [Cursor vs In-Memory Results](#12-cursor-vs-in-memory-results)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What is the Aggregation Pipeline?

Here's the problem `find()` can't solve for you.

`find()` is great at answering "give me the documents that match this filter." But the moment someone asks a *business* question — "what's our total revenue by region this month?", "who are our top 5 customers?", "what's the average order value?" — `find()` just shrugs. It can filter, sort, and limit, but it cannot combine many documents into one summarized answer.

That's the gap the aggregation pipeline fills. It's MongoDB's data-processing engine, built specifically for turning raw documents into answers.

---

### The basic idea

You take a stream of documents and push them through a series of **stages**. Each stage does one specific job, and hands its output to the next stage in line. Nothing fancy — the output of stage 1 is simply the input to stage 2, and so on.

If you've ever used Unix pipes, you already understand this:

```
Unix:     cat file | grep "error" | sort | uniq -c
MongoDB:  collection | $match | $group | $sort | $limit
```

Same idea, just replacing shell commands with MongoDB stage operators.

---

### What a stage can actually do to your documents

- **Filter** them (fewer documents come out than went in)
- **Reshape** them (add, remove, or rename fields)
- **Group** them (combine many documents into one summary document)
- **Sort** them (reorder the stream)
- **Join** them with documents from another collection
- **Write** the final result to a new collection

Stages are composable — you can mix and match them in whatever order the problem needs — and a whole pipeline is nothing more exotic than a JSON array of stage objects.

---

### Basic definition

The aggregation pipeline is a framework where documents from a collection pass through an ordered sequence of stages, each transforming the document stream, ultimately producing a cursor over the final, processed result.

---

## 2. Real-World Analogy

Picture an oil refinery. Crude oil goes in one end; usable fuel comes out the other. In between, a series of processing units each do exactly one job — distill, crack, blend — and the output of one unit feeds directly into the next.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Crude Oil  │──►│  Distiller  │──►│  Cracker    │──►│  Blender    │──► Fuel
│ (raw docs)  │    │  ($match)   │    │  ($group)   │    │  ($project) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

Raw crude (every document in your collection) enters the refinery. Each processing unit (each pipeline stage) has one job and one job only. Nobody tries to distill *and* crack *and* blend all in one giant machine — that would be unmaintainable and impossible to debug. Instead you get a clean assembly line, and at the end, a refined product: your result set.

This is exactly why aggregation pipelines are easy to reason about once you've internalized the analogy — you're never looking at one giant blob of logic, just a sequence of small, single-purpose steps.

---

## 3. Core Syntax

### Basic form

```js
db.collection.aggregate(pipeline, options)
```

Where `pipeline` is an **array of stage objects** and `options` is an optional configuration object.

```js
db.orders.aggregate([
  { $match:  { status: "shipped" } },
  { $group:  { _id: "$customerId", total: { $sum: "$amount" } } },
  { $sort:   { total: -1 } },
  { $limit:  5 }
])
```

### Options object

```js
db.orders.aggregate(
  [
    { $match: { status: "shipped" } },
    { $group: { _id: "$customerId", total: { $sum: "$amount" } } }
  ],
  {
    allowDiskUse: true,      // allow spilling to disk for large datasets
    maxTimeMS: 60000,        // timeout after 60 seconds
    comment: "top customers report",  // appears in profiler output
    hint: { customerId: 1 } // force index usage on first $match
  }
)
```

### Stage object format

Each stage is an object with **exactly one key** — the stage name — whose value is the stage specification:

```js
{ $match:   <query filter document> }
{ $project: <projection document> }
{ $group:   { _id: <expression>, <field>: <accumulator> } }
{ $sort:    { <field>: 1 | -1 } }
{ $limit:   <number> }
{ $skip:    <number> }
```

### Using variables

```js
// Reference a field with $fieldName prefix
{ $group: { _id: "$category" } }          // groups by the "category" field
{ $project: { fullName: "$name" } }       // renames "name" to "fullName"

// Nested fields use dot notation
{ $group: { _id: "$address.city" } }
{ $match: { "items.price": { $gt: 50 } } }
```

---

## 4. ASCII Pipeline Flow Diagram

Reading a pipeline top-to-bottom is the whole trick. Watch the document shape actually change as it drops through each stage:

```
Collection on disk
        │
        │  (all documents)
        ▼
┌───────────────────┐
│     $match        │  ← filters documents (early filter = fewer docs downstream)
│  { status:"ok" }  │
└────────┬──────────┘
         │  (matching documents only)
         ▼
┌───────────────────┐
│    $project       │  ← reshapes each document (add/remove/rename fields)
│  { name:1,amt:1 } │
└────────┬──────────┘
         │  (reshaped documents)
         ▼
┌───────────────────┐
│     $group        │  ← collapses many documents into grouped summaries
│  { _id:"$city",   │
│    total:{$sum:1}}│
└────────┬──────────┘
         │  (one doc per group)
         ▼
┌───────────────────┐
│     $sort         │  ← reorders the result set
│  { total: -1 }    │
└────────┬──────────┘
         │  (sorted docs)
         ▼
┌───────────────────┐
│     $limit        │  ← takes first N documents
│       10          │
└────────┬──────────┘
         │
         ▼
     Results returned
     to the client
     as a cursor
```

Notice the shape narrows as you go down: many raw documents at the top, fewer (and reshaped) documents after `$match`, and finally a handful of grouped, sorted, limited summary documents at the bottom. That narrowing is the entire point of a well-written pipeline.

---

## 5. How Documents Stream Through Stages

MongoDB processes documents as a **stream**, not as one big batch. Each stage receives documents one at a time from the previous stage. But not every stage behaves the same way while it does this — some can hand off output the instant they receive input, and some have to wait and see everything before they can produce anything at all.

That distinction — **streaming** vs **blocking** — matters a lot for memory, so let's lay it out:

```
Stage type     │ Blocking?  │ Reason
───────────────┼────────────┼──────────────────────────────────────────────
$match         │ No         │ Filters each doc independently
$project       │ No         │ Transforms each doc independently
$addFields     │ No         │ Adds fields to each doc independently
$unwind        │ No         │ Expands each doc independently
$sort          │ Yes*       │ Must see all docs to order them (*index-backed sort is streaming)
$group         │ Yes        │ Must see all docs to finalize accumulators
$lookup        │ No         │ Joins each doc independently
$limit         │ No         │ Passes first N, then stops
$skip          │ No         │ Drops first N, passes the rest
$out / $merge  │ Yes        │ Must finish before writing to a collection
```

Why would `$group` need to wait for everything? Because it can't know the final average, sum, or count for a group until it has seen the last document that might belong to that group. It's the same reason you can't announce the winner of an election until every vote is counted.

Blocking stages accumulate all documents in memory while they wait — which is exactly why they're the ones that run into the 100 MB limit covered in Section 8.

---

## 6. Under the Hood: Execution Model

When you call `aggregate()`, MongoDB doesn't just run your stages in a dumb, literal order — it actually studies the pipeline first and rewrites parts of it for speed. Here's the full sequence:

```
1. Parse the pipeline array
        │
        ▼
2. Validate each stage operator and expression
        │
        ▼
3. Optimize the pipeline
   ├── Merge adjacent $match stages
   ├── Push $match before $lookup (if possible)
   ├── Push $match before $unwind (if possible)
   ├── Swap $sort + $limit → top-K sort (more efficient)
   └── Use index for $match / $sort at the front
        │
        ▼
4. Choose execution engine
   ├── Classic engine (older)
   └── Slot-based execution engine (MongoDB 5.1+ default)
        │
        ▼
5. Execute stages left to right
        │
        ▼
6. Return results as a cursor
```

### The query planner and aggregation

The first `$match` stage (and sometimes `$sort`) can be **pushed down to the query layer** and satisfied by an index — exactly like a `find()` query. This is critical for performance on large collections.

```js
// If you have an index on { status: 1, createdAt: -1 }
db.orders.aggregate([
  { $match: { status: "shipped" } },   // ← uses the index
  { $sort:  { createdAt: -1 } },       // ← also uses the index (compound)
  { $limit: 20 }
])
```

---

## 7. Aggregation vs MapReduce

MongoDB supported MapReduce for many years before the aggregation pipeline existed. So why did nearly everyone abandon it? Put the two side by side and the answer is obvious.

```
┌──────────────────┬────────────────────────────┬────────────────────────────┐
│ Feature          │ Aggregation Pipeline        │ MapReduce                  │
├──────────────────┼────────────────────────────┼────────────────────────────┤
│ Introduced       │ MongoDB 2.2 (2012)          │ MongoDB 1.8 (2011)         │
│ Performance      │ Faster (native C++)         │ Slower (JavaScript engine) │
│ Syntax           │ Declarative JSON stages     │ JavaScript map/reduce fns  │
│ Flexibility      │ Many built-in operators     │ Arbitrary JavaScript       │
│ Debugging        │ Easy (step through stages)  │ Hard (opaque JS)           │
│ Index use        │ Yes ($match, $sort front)   │ Limited                    │
│ Memory limit     │ 100 MB per stage            │ 100 MB                     │
│ Output           │ cursor, $out, $merge        │ collection only            │
│ Status           │ Recommended                 │ Deprecated (MongoDB 5.0)   │
└──────────────────┴────────────────────────────┴────────────────────────────┘
```

**Why pipeline is faster:** MapReduce spawns a JavaScript interpreter for every document. The aggregation pipeline runs native C++ code with optimized data structures. On large datasets this difference is orders of magnitude.

**When would you still use MapReduce?** Almost never in new code. It remains available for legacy compatibility. If you need logic that truly cannot be expressed as a pipeline (extremely rare), JavaScript stored functions are a better alternative.

---

## 8. The 100 MB Memory Limit

Why does this limit even exist? Because without it, one badly-written aggregation could hog all of the server's RAM and starve every other query running alongside it. So MongoDB draws a line: by default, each pipeline **stage** gets a budget of **100 MB of RAM** for its working set.

```
┌──────────────────────────────────────────────────────────────────┐
│  Stage memory budget: 100 MB                                     │
│                                                                  │
│  $group accumulates documents here ──────────► [doc][doc][doc]  │
│                                                                  │
│  If the accumulated data exceeds 100 MB ──────► ERROR           │
│  "Exceeded memory limit for $group, but did not opt in to       │
│   external sorting."                                             │
└──────────────────────────────────────────────────────────────────┘
```

Which stages are most likely to hit this ceiling? The blocking ones from Section 5 — the ones that must hold documents in memory while they wait to see everything:

- `$group` — accumulates one entry per group key
- `$sort` — must hold the entire result set if no index
- `$bucket` / `$bucketAuto` — accumulates per bucket
- `$facet` — runs sub-pipelines, each with their own budgets

**Important:** The 100 MB limit is per **stage**, not per **pipeline**. A pipeline with five `$group` stages each gets its own 100 MB budget.

---

## 9. allowDiskUse: true

So what happens when your dataset genuinely needs more than 100 MB to group or sort? You opt in to letting MongoDB spill to disk, by passing `allowDiskUse: true` as an option. MongoDB will write intermediate data to temporary files instead of erroring out.

```js
db.bigCollection.aggregate(
  [
    { $group: { _id: "$category", total: { $sum: "$revenue" } } },
    { $sort:  { total: -1 } }
  ],
  { allowDiskUse: true }   // ← opt in to disk spill
)
```

### Trade-offs

This isn't a free lunch — you're trading speed for the ability to finish at all:

```
┌─────────────────┬──────────────────────────────────┐
│                 │ Impact                           │
├─────────────────┼──────────────────────────────────┤
│ Speed           │ Slower (disk I/O vs RAM)         │
│ Scalability     │ Can process datasets > RAM       │
│ Server stress   │ Disk I/O competes with other ops │
│ Temp files      │ Written to dbPath/tmp/           │
└─────────────────┴──────────────────────────────────┘
```

**Best practice:** Profile first. If a query routinely needs `allowDiskUse`, consider:
1. Adding an index to reduce the input document count (`$match` before `$group`)
2. Filtering more aggressively before the blocking stage
3. Breaking the pipeline into smaller pre-aggregated steps using scheduled jobs

> **Memory hook:** "`allowDiskUse` is a pressure valve, not a design choice — if you're reaching for it every time, the pipeline needs a diet, not a bigger stomach."

---

## 10. Pipeline Optimization Rules

MongoDB's query optimizer applies several automatic rewrites behind the scenes. But why memorize what the optimizer already does for you? Because knowing these rules means you write pipelines that are fast even *before* the optimizer gets a chance to touch them — and because the optimizer can't rescue every bad ordering.

### Rule 1: Put $match as early as possible

```js
// BAD — groups all documents, then filters the groups
db.orders.aggregate([
  { $group: { _id: "$region", total: { $sum: "$amount" } } },
  { $match: { region: "APAC" } }   // ← filters AFTER grouping everything
])

// GOOD — filters first, groups only matching documents
db.orders.aggregate([
  { $match: { region: "APAC" } },  // ← uses index, reduces input to $group
  { $group: { _id: "$region", total: { $sum: "$amount" } } }
])
```

### Rule 2: Put $project / $addFields after $match

Projecting first does not reduce document count — it only reduces field count. The document still passes through the pipeline. Filter rows before you reshape them.

```js
// Better order
db.orders.aggregate([
  { $match:   { status: "completed", createdAt: { $gte: ISODate("2025-01-01") } } },
  { $project: { customerId: 1, total: 1, _id: 0 } },
  { $group:   { _id: "$customerId", spend: { $sum: "$total" } } }
])
```

### Rule 3: $sort + $limit coalesces into a top-K sort

MongoDB automatically merges an adjacent `$sort` followed by `$limit` into a single **top-K sort** that only tracks the K smallest/largest items, rather than sorting the full set.

```js
// MongoDB internally rewrites this as a single top-5 sort
db.orders.aggregate([
  { $sort:  { total: -1 } },
  { $limit: 5 }
])
```

### Rule 4: Push $match before $lookup

If a `$match` can filter documents before a `$lookup` (join), move it there. `$lookup` is expensive — reduce the left-side document count before joining.

```js
// GOOD
db.orders.aggregate([
  { $match:  { status: "pending" } },   // ← filter first
  { $lookup: { from: "customers", localField: "customerId",
               foreignField: "_id", as: "customer" } }
])
```

### Rule 5: $unwind followed by $match can push the $match before $unwind

```js
// MongoDB may rewrite this automatically
db.posts.aggregate([
  { $unwind: "$tags" },
  { $match:  { tags: "mongodb" } }
  // → optimizer may push { $match: { tags: "mongodb" } } before $unwind
])
```

### Rule 6: Index coverage for the first stage

If the first stage is `$match` or `$sort`, MongoDB checks for a supporting index exactly like it does for `find()`. Use `explain()` to verify.

```js
// Always check with explain
db.orders.aggregate(
  [ { $match: { status: "shipped" } }, { $group: { _id: "$customerId" } } ],
  { explain: true }
)
```

---

## 11. Explain Plan for Aggregation

Don't guess whether your pipeline is using an index — check.

```js
// Method 1: explain option
db.orders.aggregate(
  [ { $match: { status: "shipped" } } ],
  { explain: true }
)

// Method 2: cursor explain
db.orders.aggregate([ { $match: { status: "shipped" } } ])
         .explain("executionStats")

// What to look for in the output
// stages[0].IXSCAN  → first stage uses an index (good)
// stages[0].COLLSCAN → full collection scan (investigate)
// totalDocsExamined vs totalDocsReturned → low ratio means selective index
```

---

## 12. Cursor vs In-Memory Results

Here's something that trips people up: `aggregate()` doesn't hand you an array. It hands you a **cursor**. Results stream to the client in batches (default 101 documents or 16 MB, whichever is smaller) — which is exactly why aggregation can handle enormous result sets without blowing up your application's memory.

```js
// Cursor usage — memory efficient
const cursor = db.orders.aggregate([ { $group: { _id: "$status" } } ])
cursor.forEach(doc => printjson(doc))

// Convert to array — loads ALL results into memory
const results = db.orders.aggregate([ { $group: { _id: "$status" } } ]).toArray()

// Use toArray() only when the result set is known to be small
```

---

## 13. Hands-On Exercises

Use this sample dataset. Insert it before attempting the exercises:

```js
db.sales.drop()
db.sales.insertMany([
  { _id: 1, product: "Widget A", region: "APAC", rep: "Alice", amount: 1200, month: 1, year: 2025 },
  { _id: 2, product: "Widget B", region: "EMEA", rep: "Bob",   amount:  800, month: 1, year: 2025 },
  { _id: 3, product: "Widget A", region: "APAC", rep: "Carol", amount: 1500, month: 2, year: 2025 },
  { _id: 4, product: "Widget C", region: "AMER", rep: "Alice", amount:  600, month: 2, year: 2025 },
  { _id: 5, product: "Widget B", region: "APAC", rep: "Bob",   amount:  950, month: 3, year: 2025 },
  { _id: 6, product: "Widget A", region: "EMEA", rep: "Carol", amount: 1800, month: 3, year: 2025 },
  { _id: 7, product: "Widget C", region: "AMER", rep: "Alice", amount:  700, month: 4, year: 2025 },
  { _id: 8, product: "Widget B", region: "EMEA", rep: "Bob",   amount: 1100, month: 4, year: 2025 },
  { _id: 9, product: "Widget A", region: "APAC", rep: "Carol", amount: 2000, month: 5, year: 2025 },
  { _id: 10, product: "Widget C", region: "AMER", rep: "Alice", amount: 550, month: 5, year: 2025 }
])
```

### Exercise 1 — Total revenue per region

Write a pipeline that outputs the total `amount` grouped by `region`, sorted descending.

Expected output shape:
```json
{ "_id": "APAC", "totalRevenue": 5650 }
{ "_id": "EMEA", "totalRevenue": 3700 }
{ "_id": "AMER", "totalRevenue": 1850 }
```

<details>
<summary>Solution</summary>

```js
db.sales.aggregate([
  { $group: { _id: "$region", totalRevenue: { $sum: "$amount" } } },
  { $sort:  { totalRevenue: -1 } }
])
```
</details>

---

### Exercise 2 — Revenue per rep in APAC only

Filter to `region: "APAC"` first, then group by `rep`, showing total and average amount.

<details>
<summary>Solution</summary>

```js
db.sales.aggregate([
  { $match: { region: "APAC" } },
  { $group: {
      _id: "$rep",
      totalAmount:   { $sum: "$amount" },
      averageAmount: { $avg: "$amount" },
      dealCount:     { $sum: 1 }
  }},
  { $sort: { totalAmount: -1 } }
])
```
</details>

---

### Exercise 3 — Top product by revenue

Find the single product with the highest total revenue across all regions. Return only one document.

<details>
<summary>Solution</summary>

```js
db.sales.aggregate([
  { $group: { _id: "$product", total: { $sum: "$amount" } } },
  { $sort:  { total: -1 } },
  { $limit: 1 }
])
```
</details>

---

### Exercise 4 — Monthly revenue trend

Group by `month` and show total revenue per month, sorted by month ascending.

<details>
<summary>Solution</summary>

```js
db.sales.aggregate([
  { $group: { _id: "$month", monthlyRevenue: { $sum: "$amount" } } },
  { $sort:  { _id: 1 } }
])
```
</details>

---

### Exercise 5 — Count deals above average

First compute the overall average deal amount, then count how many individual deals exceed that average. (Hint: use two separate aggregations or a `$facet`.)

<details>
<summary>Solution — two separate queries</summary>

```js
// Step 1: get the average
const avgResult = db.sales.aggregate([
  { $group: { _id: null, avgAmount: { $avg: "$amount" } } }
]).toArray()
const avg = avgResult[0].avgAmount  // 1020

// Step 2: count deals above the average
db.sales.aggregate([
  { $match: { amount: { $gt: avg } } },
  { $count: "dealsAboveAverage" }
])
```
</details>

---

## 14. Interview Q&A

**Q1. What is the aggregation pipeline in MongoDB?**

A: The aggregation pipeline is a data-processing framework where documents from a collection are passed through an ordered series of stages. Each stage transforms the document stream (filter, group, reshape, join, etc.) and passes its output to the next stage. The result is a cursor over the final transformed documents.

---

**Q2. How does the aggregation pipeline differ from the `find()` method?**

A: `find()` can only filter, project, sort, skip, and limit documents — it cannot group, join, or compute derived values across multiple documents. The aggregation pipeline can perform all of these operations and more, including reshaping documents, computing aggregates (sum/avg/max), joining collections with `$lookup`, and writing results to new collections with `$out`.

---

**Q3. What is the 100 MB memory limit and why does it exist?**

A: Each stage in the pipeline is limited to 100 MB of RAM for its working data. This prevents a single query from exhausting server memory and starving other operations. Blocking stages (`$group`, `$sort`, `$bucket`) are most likely to hit this limit because they must accumulate data from many documents before producing output. You can bypass it with `allowDiskUse: true`.

---

**Q4. When would you NOT use `allowDiskUse: true`?**

A: You should avoid it on production systems with high concurrency because disk spill creates I/O pressure that affects other queries. Instead, optimize the pipeline: add indexes, filter earlier, reduce the dataset before the blocking stage, or pre-aggregate data in a scheduled job. `allowDiskUse` should be a last resort, not a first instinct.

---

**Q5. How does MongoDB optimize the aggregation pipeline?**

A: The query optimizer applies several automatic rewrites: moving `$match` and `$sort` before `$project`/`$addFields`; pushing `$match` before `$lookup` and `$unwind`; coalescing adjacent `$sort` + `$limit` into a single top-K sort; and merging consecutive `$match` stages. The first `$match` and `$sort` can also be pushed down to the index layer for O(log n) access instead of a full scan.

---

**Q6. What is the difference between a streaming stage and a blocking stage?**

A: A streaming stage (e.g., `$match`, `$project`, `$addFields`, `$lookup`) can output documents as it receives them — it does not need to see the entire input first. A blocking stage (e.g., `$group`, `$sort`, `$bucket`) must accumulate all input documents before it can produce any output. Blocking stages are memory-intensive and hit the 100 MB cap.

---

**Q7. Why was MapReduce deprecated in favour of the aggregation pipeline?**

A: The aggregation pipeline is faster (native C++ vs JavaScript engine), more expressive (dozens of built-in operators vs manual JS functions), easier to debug (you can test each stage independently), and better supported by the query planner (index use, explain plans). MapReduce was deprecated in MongoDB 5.0 and marked for eventual removal.

---

**Q8. How does `aggregate()` return results — as an array or a cursor?**

A: `aggregate()` returns a **cursor**. Results are streamed to the client in batches, which is memory-efficient for large result sets. You can call `.toArray()` on the cursor to load everything into memory, or `.forEach()` to process documents one at a time. Using a cursor avoids loading the entire result set into the client's memory.

---

**Q9. Can you use an index in an aggregation pipeline?**

A: Yes. If the first stage is `$match` or `$sort`, MongoDB's query planner can use an index to satisfy it — exactly like a `find()` query. Subsequent stages do not directly use indexes, but reducing the document count early via an indexed `$match` dramatically reduces work for downstream stages.

---

**Q10. What is the `explain` option for aggregation, and what should you look for?**

A: Passing `{ explain: true }` as an option (or calling `.explain("executionStats")` on the cursor) shows the execution plan. Look for `IXSCAN` in the first stage (good — using an index) vs `COLLSCAN` (bad — full collection scan). Also compare `totalDocsExamined` vs `totalDocsReturned` — a low ratio means the index is selective. If the optimizer is not using an index you expect, check that the field names and types match the index definition.

---

*Next: [02-Pipeline-Stages.md](./02-Pipeline-Stages.md) — detailed coverage of every aggregation stage.*
