# 03 — Index Strategies

## Table of Contents

1. [The ESR Rule](#1-the-esr-rule)
2. [Selectivity — Cardinality and Index Efficiency](#2-selectivity--cardinality-and-index-efficiency)
3. [Covered Queries](#3-covered-queries)
4. [Index Intersection](#4-index-intersection)
5. [explain() — Modes and Output](#5-explain--modes-and-output)
6. [Reading executionStats](#6-reading-executionstats)
7. [Index Hints in Production](#7-index-hints-in-production)
8. [Index Bloat and Maintenance](#8-index-bloat-and-maintenance)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

In the last file we walked through eleven index *types* — the different shapes MongoDB's book-index can take. But knowing the shapes doesn't tell you how to actually build the right index for a real query, or how to tell whether the index you built is helping at all. That's what this file is about: the rules for ordering fields, the diagnostics for proving an index works, and the maintenance habits that keep indexes from quietly rotting.

---

## 1. The ESR Rule

**The problem:** you've got a compound index with three or four fields in it. It works — it's not a COLLSCAN — but it's still slow, and you can't figure out why. Chances are, the fields are in the wrong order.

**The analogy:** think back to the phone-book compound index from the last file — sorted by last name, then first name. Now imagine the phone book also had a "join date" column, and you wanted "all the Smiths who joined this year, in alphabetical order." You'd want the book organized last-name-first (narrows fast), then by join-year (so it's already grouped the way you want to browse it), and only then worry about anything else. Get that order wrong, and you're flipping through the whole book.

**The rule, in one line:** Equality fields first, Sort fields second, Range fields last — **E-S-R**.

```
┌─────────────────────────────────────────────────────────────────┐
│  E  →  S  →  R                                                  │
│                                                                 │
│  E = Equality fields first   (exact match: field: value)        │
│  S = Sort fields second      (used in .sort())                  │
│  R = Range fields last       ($gt, $lt, $gte, $lte, $in, etc.)  │
└─────────────────────────────────────────────────────────────────┘
```

### Why this ordering, specifically? Let's trace it step by step

Take this query on an `orders` collection:

```js
db.orders.find({
  status: "active",                    // E: equality
  amount: { $gte: 100, $lte: 500 }     // R: range
}).sort({ createdAt: -1 })             // S: sort
```

Put the fields in the wrong order — say **R-S-E**, `{ amount: 1, createdAt: -1, status: 1 }` — and here's what the B-tree traversal actually looks like:

```
B-tree traversal:
  Step 1: Scan all amounts between 100 and 500
          → Could be millions of documents
  Step 2: For each amount range, check status = "active"
          → Still many docs
  Step 3: Sort by createdAt in-memory
          → SORT stage required (expensive)

Result: Many docs examined, in-memory sort needed
```

Now put the fields in **E-S-R** order — `{ status: 1, createdAt: -1, amount: 1 }` — and watch what changes:

```
B-tree traversal:
  Step 1: Jump to status = "active" (equality → narrow immediately)
          → Eliminates all non-active orders
  Step 2: Within "active", entries are pre-sorted by createdAt DESC
          → Sort is free (already in index order)
  Step 3: Within each createdAt bucket, filter amount range
          → Small range applied last

Result: Few docs examined, no in-memory sort
```

Same query, same data, same three fields — the *only* thing that changed is field order, and it's the difference between scanning millions of documents and scanning almost none.

### Seeing it as a B-tree

```
Query: find({ type: "premium", score: { $gte: 80 } }).sort({ date: -1 })

ESR Index: { type: 1, date: -1, score: 1 }

B-tree layout:
                     ┌───────────────────────────┐
                     │   type = "basic"           │  ← skipped entirely
                     ├───────────────────────────┤
                     │   type = "premium"         │  ← jump here (E)
                     │  ┌──────────────────────┐  │
                     │  │ date = 2024-12-31    │  │  ← already sorted (S)
                     │  │   score: [60,80,95]  │  │  ← range filter applied (R)
                     │  ├──────────────────────┤  │
                     │  │ date = 2024-12-30    │  │
                     │  │   score: [70,85,90]  │  │
                     │  └──────────────────────┘  │
                     └───────────────────────────┘

Documents examined: Only premium + score >= 80
Sort: FREE (index is sorted by date already)
```

### Example

```js
// Scenario: e-commerce order analytics
// Query: find active orders by a specific seller, sorted by date, with amount > 50

// BAD index (R-E-S order):
db.orders.createIndex({ amount: 1, sellerId: 1, createdAt: -1 })
// Scans all orders with amount > 50 first, then filters sellerId, then sorts

// GOOD index (E-S-R order):
db.orders.createIndex({ sellerId: 1, createdAt: -1, amount: 1 })
// Jumps to sellerId, traverses in date order, applies amount filter at end

// Query:
db.orders.find({
  sellerId: "seller_123",
  amount: { $gt: 50 }
}).sort({ createdAt: -1 })

// With E-S-R index:
// totalDocsExamined ≈ nReturned
// No SORT stage in executionStats
```

### Two edge cases worth knowing

```js
// Multiple equality fields — all go first, in any order relative to each other:
// Query: find({ region: "US", tier: "gold", revenue: { $gte: 1000 } }).sort({ date: 1 })
// Index: { region: 1, tier: 1, date: 1, revenue: 1 }
//         E────────────────────S───────R───────────

// Range field that's ALSO the sort field — it just serves double duty:
// Query: find({ category: "A" }).sort({ price: 1 })  where price is ranged
// Index: { category: 1, price: 1 }  ← E then S(=R here, price serves as sort)
```

**Interview answer:** "ESR stands for Equality, Sort, Range. Place equality-filter fields first, sort fields second, and range-filter fields last. This ordering lets the B-tree narrow down to a small set of documents via equality, traverse those documents in pre-sorted order (eliminating in-memory SORT stages), and apply range filters at the end where the scan is already narrow. Reversing the order forces the planner to scan wide ranges first and then sort large result sets in memory, both of which are expensive."

> **Memory hook:** "Narrow first (Equality), browse in order second (Sort), filter the leftovers last (Range) — E-S-R, always in that order."

---

## 2. Selectivity — Cardinality and Index Efficiency

**The problem:** you dutifully add an index on a field, but the query is still slow — or worse, `explain()` shows MongoDB isn't even using your index. Turns out not every field is worth indexing equally. A field with only two or three possible values just doesn't *narrow anything down*.

**The analogy:** imagine a library card catalog indexed by "book language." If 95% of the library is in English, looking someone up by "English" barely narrows your search at all — you've still got thousands of cards to sift through. Now imagine it's indexed by ISBN instead — one card per book, unique, instant. That difference — how much one lookup narrows the field — is **selectivity**.

**Basic definition:** selectivity measures how well an index narrows down the result set. A highly selective index returns a small fraction of the collection per query.

### Cardinality: the raw material of selectivity

```
High Cardinality (many unique values) = Highly Selective
  email:      10,000,000 users → 10,000,000 unique emails
  userId:     10,000,000 users → 10,000,000 unique IDs
  phone:      nearly unique per user

Low Cardinality (few unique values) = Low Selectivity
  status:     "active" | "inactive" | "pending"  → 3 values
  gender:     "M" | "F" | "Other"                → 3 values
  country:    ~200 values
  boolean:    true | false                        → 2 values
```

### Turning it into a number

```
Selectivity = nReturned / totalDocuments

Perfect selectivity:  1 / 10,000,000 = 0.0000001  (unique ID lookup)
Good selectivity:     100 / 10,000,000 = 0.00001   (indexed name)
Poor selectivity:     5,000,000 / 10,000,000 = 0.5  (boolean field)

Rule of thumb:
  Selectivity < 0.01 (1%) → Index highly beneficial
  Selectivity > 0.1  (10%) → Index may not help; COLLSCAN may win
  Selectivity > 0.3  (30%) → Index usually hurts (more overhead than it saves)
```

### Why MongoDB sometimes ignores your index entirely

```js
// Example: only 2 unique values → ~50% selectivity
db.users.createIndex({ isAdmin: 1 })

db.users.find({ isAdmin: true })
// If 40% of users are admins:
//   Index scan → 4,000,000 IXSCAN entries + 4,000,000 FETCH
//   COLLSCAN  → 10,000,000 reads but sequential (faster I/O pattern)
//
// MongoDB optimizer MAY choose COLLSCAN here (with explain, check winningPlan)
```

This is the counterintuitive part: having an index doesn't guarantee MongoDB uses it. Random-access reads (jump to key, fetch document, jump to next key) can actually lose to a plain sequential scan once you're touching a large enough fraction of the collection.

### The fix: compound your way to selectivity

A low-cardinality field alone is a weak index. Pair it with a high-cardinality field, and the *combination* becomes excellent:

```js
// Low selectivity alone:
{ status: 1 }           // 3 values → poor selectivity

// High selectivity compound:
{ status: 1, userId: 1 }  // status filters to 1/3, userId to ~1/10M → excellent

// The compound index has selectivity of the COMBINATION
```

### Field ordering still matters, even between two decent fields

```js
// Collection: 10,000 products
// category: 5 values (2,000 docs each)
// brand: 100 values (100 docs each)

// Index A: { category: 1, brand: 1 }
// Query: find({ category: "electronics", brand: "Sony" })
//   Step 1: filter to 2,000 electronics
//   Step 2: filter to 100 Sony in electronics → examine ~100

// Index B: { brand: 1, category: 1 }
// Query: find({ category: "electronics", brand: "Sony" })
//   Step 1: filter to 100 Sony
//   Step 2: filter to ~20 Sony electronics → examine ~100

// Both are similar here, but Index B is often better because
// brand is more selective (higher cardinality field first)
// General tip: put higher-cardinality fields first (within the E group)
```

**Interview answer:** "Selectivity measures what fraction of the collection a query returns. High-cardinality fields (email, userId) have high selectivity — a query on them returns very few documents. Low-cardinality fields (status, boolean) have low selectivity. MongoDB's query planner may skip a low-selectivity index entirely and choose a COLLSCAN because sequential document reads can outperform random I/O for 30%+ of a collection. Design indexes on high-selectivity fields and use compound indexes to increase selectivity of low-cardinality individual fields."

> **Memory hook:** "Indexing by 'book language' barely narrows a library — indexing by ISBN goes straight to one card. Selectivity is how close your index gets to that ISBN feeling."

---

## 3. Covered Queries

**The problem:** even with a good index, MongoDB still has to jump from the index to the actual document on disk to grab the fields you asked for — that's an extra disk seek per matched document. What if the answer you need is small enough that it's *already sitting in the index itself*?

**The analogy:** it's the difference between a card catalog that just tells you "this book is on shelf 12" (you still have to walk over and pull it) versus a catalog card that already has the summary printed right on it — no trip to the shelf required.

**Basic definition:** a covered query is one where all the data needed for the query result comes entirely from the index — MongoDB never touches the actual documents (no FETCH stage).

### The requirements — all of them, every time

```
┌─────────────────────────────────────────────────────────┐
│  ALL of these must be true:                             │
│                                                         │
│  1. All fields in the query filter are in the index     │
│  2. All fields in the projection are in the index       │
│  3. No fields in the projection are NOT in the index    │
│  4. _id must be excluded (unless _id is in the index)   │
│  5. Query field values are not arrays (no multikey)     │
└─────────────────────────────────────────────────────────┘
```

### What a covered query looks like

```js
// Index: { age: 1, city: 1, name: 1 }
db.users.createIndex({ age: 1, city: 1, name: 1 })

// Covered query:
db.users.find(
  { age: { $gte: 25, $lte: 35 }, city: "NYC" },  // filter uses age, city ✓
  { _id: 0, name: 1, age: 1, city: 1 }            // projection uses only index fields ✓
)

// Explain output for covered query:
{
  "executionStages": {
    "stage": "PROJECTION_COVERED",          // ← covered!
    "inputStage": {
      "stage": "IXSCAN",
      "keyPattern": { "age": 1, "city": 1, "name": 1 }
    }
  },
  "totalDocsExamined": 0                    // ← zero document fetches!
}
```

### And here's how easily it breaks

Ask for just *one* field that isn't in the index, and the whole thing falls back to a document fetch:

```js
// Index: { age: 1, city: 1 }

// Not covered — requesting "name" which is NOT in the index:
db.users.find(
  { age: 30, city: "NYC" },
  { _id: 0, name: 1, age: 1 }              // name is not indexed → FETCH required
)

// Explain shows:
{
  "executionStages": {
    "stage": "PROJECTION_DEFAULT",
    "inputStage": {
      "stage": "FETCH",                    // ← document fetch stage
      "inputStage": {
        "stage": "IXSCAN"
      }
    }
  },
  "totalDocsExamined": 847                 // ← documents were fetched
}
```

### Covered vs. not covered, side by side

```
COVERED QUERY:
  Query → B-tree traversal (IXSCAN)
        → Return index keys directly
        → No disk seek for documents
        → PROJECTION_COVERED stage

  Memory: Only index nodes (often cached in RAM)
  Disk:   Zero document reads
  Speed:  Maximum — data never leaves index

NOT COVERED QUERY:
  Query → B-tree traversal (IXSCAN)
        → Collect record IDs
        → FETCH: seek to each document on disk
        → PROJECTION_DEFAULT stage

  Memory: Index nodes + document pages
  Disk:   One read per matched document
  Speed:  Fast but requires document storage access
```

### Deliberately designing for it

Covered queries rarely happen by accident on a hot path — you design for them:

```js
// Step 1: Identify your hot read path
// "Get the latest 10 orders for a customer, show orderId, status, amount"

// Step 2: Identify all fields used:
//   filter: customerId
//   sort:   createdAt (descending)
//   return: orderId, status, amount
//   exclude: _id

// Step 3: Create index covering all of them (ESR order):
db.orders.createIndex({
  customerId: 1,   // E: equality filter
  createdAt: -1,   // S: sort
  orderId: 1,      // R: projected field (not filtered, but in index)
  status: 1,       // projected field
  amount: 1        // projected field
})

// Step 4: Write the covered query:
db.orders.find(
  { customerId: "cust_123" },
  { _id: 0, orderId: 1, status: 1, amount: 1, createdAt: 1 }
).sort({ createdAt: -1 })

// Verify with explain: totalDocsExamined should be 0
```

**Common mistake:** adding one "just in case" field to a projection — say a debug field, or something the frontend team asked for "temporarily" — without checking whether it's in the index. That one field silently turns a fast covered query back into a document-fetching one, and nobody notices until a performance review months later.

**Interview answer:** "A covered query is one where all the data needed for the result comes from the index alone — no document fetches are required. Requirements: every field in the filter must be in the index, every field in the projection must be in the index, `_id` must be excluded (unless `_id` is in the index), and no indexed field contains array values (which would make it multikey, preventing coverage). The explain output shows `stage: \"PROJECTION_COVERED\"` and `totalDocsExamined: 0`."

> **Memory hook:** "A covered query is a catalog card with the summary already printed on it — no trip to the shelf needed."

---

## 4. Index Intersection

**The problem:** you've got two separate single-field indexes, no compound index, and a query that filters on both fields at once. Does MongoDB just give up and COLLSCAN? Not necessarily — it has a fallback trick.

**The analogy:** imagine you have two separate card catalogs — one sorted by author, one sorted by publication year — and no combined catalog. You could pull every card matching the author from one catalog, every card matching the year from the other, and then physically compare the two piles for the books that show up in *both*. That's more work than having one catalog sorted both ways, but it beats reading every book in the library.

**Basic definition:** index intersection is when MongoDB combines two separate indexes to satisfy a single query, handled automatically by the query planner.

### How it actually works, step by step

```js
// Two indexes:
db.users.createIndex({ age: 1 })
db.users.createIndex({ city: 1 })

// Query:
db.users.find({ age: 30, city: "NYC" })

// Index intersection plan:
//   IXSCAN on age_1 → set of record IDs
//   IXSCAN on city_1 → set of record IDs
//   AND_HASH or AND_SORTED: intersect the two ID sets
//   FETCH: load documents for matching IDs
```

Two independent B-tree traversals, each producing a set of record IDs, and then a set-intersection step (`AND_HASH` or `AND_SORTED` in explain output) finds the IDs common to both — only *those* documents get fetched.

### When the planner reaches for this

The planner considers index intersection when:
- No single index covers all the query predicates well
- Two single-field indexes exist on the queried fields
- The optimizer's trial run shows intersection is faster

### Index intersection vs. a proper compound index

In practice, **a well-designed compound index almost always outperforms index intersection**:

| Aspect | Index Intersection | Compound Index |
|---|---|---|
| Performance | Two B-tree traversals + set intersection | One B-tree traversal |
| Sort support | Limited | Full (avoids SORT stage) |
| Memory usage | Higher (stores 2 sets) | Lower |
| Write overhead | 2 indexes to maintain | 1 index to maintain |
| Covered query possible | Rarely | Yes |
| Predictability | Planner-dependent | Consistent |

### Spotting it in explain()

```js
// Identifying index intersection in explain():
{
  "stage": "AND_SORTED",   // or "AND_HASH"
  "inputStages": [
    { "stage": "IXSCAN", "indexName": "age_1" },
    { "stage": "IXSCAN", "indexName": "city_1" }
  ]
}
// If you see this, consider replacing the two indexes with one compound index
```

**Common mistake:** treating index intersection as "good enough" and never building the compound index it's compensating for. It works, but it's the more expensive fallback path, not the destination — if you see `AND_SORTED`/`AND_HASH` showing up on a query you run often, that's a signal, not a solution.

**Interview answer:** "Index intersection is when the query planner uses two separate indexes and intersects (ANDs) the resulting record ID sets to answer a query. You see `AND_SORTED` or `AND_HASH` stages in the explain output. While occasionally optimal, a well-designed compound index is almost always faster because it requires one B-tree traversal instead of two plus a set intersection operation. When you see index intersection, consider whether a compound index would serve the same query pattern more efficiently."

> **Memory hook:** "Index intersection is two separate card catalogs and a pile-comparing afternoon — a compound index is one catalog that already answers both questions at once."

---

## 5. explain() — Modes and Output

**The problem:** you can *guess* whether an index is helping, or you can actually ask MongoDB to show its work. `explain()` is how you stop guessing.

**Basic definition:** `explain()` is the primary tool for understanding and diagnosing query performance — it shows you exactly which plan the query planner chose and, optionally, exactly what happened when it ran.

### Three modes, three levels of commitment

```js
// Mode 1: queryPlanner (default, fastest)
// Shows the winning plan without executing it
db.users.find({ age: 30 }).explain()
db.users.find({ age: 30 }).explain("queryPlanner")

// Mode 2: executionStats
// Actually executes the query and reports runtime statistics
db.users.find({ age: 30 }).explain("executionStats")

// Mode 3: allPlansExecution
// Executes all candidate plans and reports stats for each
db.users.find({ age: 30 }).explain("allPlansExecution")
```

### Compare: when to reach for which

| Mode | What It Does | When to Use |
|---|---|---|
| queryPlanner | Shows plan without running (free — no execution cost) | Quick index check; verify index is chosen |
| executionStats | Runs query, reports stats (costs time — use on test data) | Performance diagnosis; finding bottlenecks |
| allPlansExecution | Runs all candidate plans, shows winner and rejected plans | Understanding why planner chose a plan |

### What the full output actually looks like

```json
{
  "queryPlanner": {
    "plannerVersion": 1,
    "namespace": "mydb.users",
    "indexFilterSet": false,
    "parsedQuery": { "age": { "$eq": 30 } },
    "winningPlan": {
      "stage": "FETCH",
      "inputStage": {
        "stage": "IXSCAN",
        "keyPattern": { "age": 1 },
        "indexName": "age_1",
        "isMultiKey": false,
        "isUnique": false,
        "isSparse": false,
        "isPartial": false,
        "indexVersion": 2,
        "direction": "forward",
        "indexBounds": {
          "age": [ "[30.0, 30.0]" ]
        }
      }
    },
    "rejectedPlans": []
  },
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 1247,
    "executionTimeMillis": 4,
    "totalKeysExamined": 1247,
    "totalDocsExamined": 1247,
    "executionStages": {
      "stage": "FETCH",
      "nReturned": 1247,
      "executionTimeMillis": 4,
      "works": 1249,
      "advanced": 1247,
      "needTime": 1,
      "needYield": 0,
      "docsExamined": 1247,
      "inputStage": {
        "stage": "IXSCAN",
        "nReturned": 1247,
        "executionTimeMillis": 1,
        "keysExamined": 1247
      }
    }
  },
  "serverInfo": { ... }
}
```

That's a lot to take in at once — here's the glossary of the fields you'll actually reference:

| Field | Meaning |
|---|---|
| stage | Query executor node type (COLLSCAN, IXSCAN, FETCH, SORT, COUNT_SCAN, PROJECTION_COVERED, etc.) |
| nReturned | Documents returned to the client |
| totalDocsExamined | Documents read from collection storage |
| totalKeysExamined | B-tree index keys scanned |
| executionTimeMillis | Total wall clock time for query execution |
| indexBounds | Range of index values scanned |
| direction | "forward" or "backward" B-tree traversal |
| isMultiKey | True if index covers an array field |
| needYield | How many times query yielded to other operations (high value = contention with writes) |

### It works on aggregation too

```js
db.orders.aggregate(
  [
    { $match: { status: "active" } },
    { $group: { _id: "$region", total: { $sum: "$amount" } } }
  ],
  { explain: true }
)
```

**Interview answer:** "`queryPlanner` mode is free — it shows the winning plan the optimizer chose without actually executing the query. Use it to quickly verify an index is being selected. `executionStats` actually runs the query and reports real numbers: `nReturned`, `totalDocsExamined`, `totalKeysExamined`, `executionTimeMillis`. Use it for performance diagnosis. `allPlansExecution` runs all candidate plans and reports stats for each — use it to understand why the planner chose one plan over another."

> **Memory hook:** "queryPlanner shows the map, executionStats shows the odometer reading after the drive, allPlansExecution runs every possible route to compare them."

---

## 6. Reading executionStats

This is where the actual diagnosis happens. Every number in `executionStats` is telling you a small piece of a story — the trick is reading them in the right order.

### The one ratio that matters most: nReturned / totalDocsExamined

```
Perfect:   nReturned = totalDocsExamined = nReturned  (ratio 1:1)
Good:      nReturned / totalDocsExamined > 0.5
Mediocre:  nReturned / totalDocsExamined > 0.1
Bad:       nReturned / totalDocsExamined < 0.01

Example diagnosis:
  nReturned: 50
  totalDocsExamined: 50000
  Ratio: 50/50000 = 0.001

  → Index exists but is low-selectivity, or wrong field order
  → Consider a more selective compound index
```

If MongoDB is examining 50,000 documents to hand you back 50, an index technically exists — it's just not doing its job.

### Reading the plan tree from the inside out

```
Diagnose each stage from innermost to outermost:

Plan tree (innermost first):
  IXSCAN → FETCH → SORT → LIMIT

Healthy IXSCAN:
  keysExamined ≈ nReturned (tight index bounds)

Unhealthy IXSCAN:
  keysExamined >> nReturned → index bounds too wide
  Example: range query on low-cardinality field

FETCH stage present:
  docsExamined > 0 → documents are loaded from disk
  If docsExamined = 0 → covered query (best case)

SORT stage:
  Always means in-memory sort — potentially expensive
  sortSpills > 0 → sort exceeded allowedMemoryUsage → spilled to disk
  → Add index field that pre-sorts (S in ESR)

LIMIT stage:
  Should come early in the plan (after SORT) for .limit() to be efficient
```

### Common patterns and what they mean

| Pattern | Diagnosis + Fix |
|---|---|
| COLLSCAN | No usable index. Add index on filter field(s). |
| IXSCAN + FETCH, high ratio (totalDocsExamined >> nReturned) | Low selectivity or wrong compound field order. Redesign compound index with ESR rule. |
| SORT stage present | No index for sort. Add sort field to compound index in S position. |
| totalKeysExamined >> nReturned | Index scan covers too wide a range. Check index bounds in indexBounds field. |
| AND_SORTED or AND_HASH stage | Index intersection is happening. Replace two single-field indexes with one compound index. |
| High executionTimeMillis but low per-query time | Query is fast per execution but called too frequently. Optimize at application level. |

### A script that puts it all together

```js
function diagnoseQuery(collection, query, projection, sortSpec) {
  const stats = db[collection].find(query, projection)
    .sort(sortSpec || {})
    .explain("executionStats").executionStats;

  const ratio = stats.nReturned / Math.max(stats.totalDocsExamined, 1);
  const plan  = stats.executionStages.stage;

  print("=== Query Diagnosis ===");
  print("Stage:          ", plan);
  print("Returned:       ", stats.nReturned);
  print("Docs examined:  ", stats.totalDocsExamined);
  print("Keys examined:  ", stats.totalKeysExamined);
  print("Time (ms):      ", stats.executionTimeMillis);
  print("Efficiency:     ", (ratio * 100).toFixed(2) + "%");

  if (plan === "COLLSCAN")    print("⚠ COLLSCAN: Add an index.");
  if (ratio < 0.01)           print("⚠ Low selectivity: Redesign index.");
  if (stats.totalDocsExamined === 0) print("✓ Covered query!");
}

diagnoseQuery("users", { age: 30, city: "NYC" }, { _id: 0, name: 1 }, { age: 1 });
```

**Interview answer:** "The key ratio to check first is `nReturned` vs `totalDocsExamined` — a ratio close to 1 means the index is precise; a ratio far below 1 means the index (or its field order) is too broad. Then walk the stage tree from the innermost stage outward: an IXSCAN examining far more keys than it returns points at wide index bounds, a FETCH stage with a nonzero `docsExamined` means it's not a covered query, and a SORT stage means an in-memory sort that a properly ordered compound index (following ESR) could eliminate."

> **Memory hook:** "nReturned vs totalDocsExamined is the vital sign — check it first, then read the stage tree inside-out like peeling an onion."

---

## 7. Index Hints in Production

**The problem:** occasionally the query planner picks a plan you *know* is worse than another available index — its cost-based cache picked wrong, or you're deliberately A/B testing two index designs. `hint()` lets you override the planner's choice.

### When it's actually legitimate to reach for a hint

```
Legitimate reasons to use hint() in production:
  1. Query planner consistently picks a suboptimal plan
     (verify with allPlansExecution explain)
  2. Plan cache is stale and causing regressions
  3. A/B testing two index designs without deploying twice
  4. Analytics queries that you know benefit from a specific access pattern
  5. Temporary workaround while a permanent fix is deployed

Do NOT use hints to patch over missing indexes:
  Wrong: Add hint() to force a barely-suitable index
  Right: Create the correct index, remove hint()
```

That last line is worth repeating: a hint is a scalpel for a planner mistake, not a patch for an index you never actually built.

### Hinting inside an aggregation pipeline

```js
// Aggregation hint
db.orders.aggregate(
  [
    { $match: { customerId: "cust_001", status: "active" } },
    { $sort: { createdAt: -1 } },
    { $limit: 10 }
  ],
  {
    hint: { customerId: 1, createdAt: -1, status: 1 },
    comment: "Force ESR compound index"
  }
)
```

### Index filters — a hint that survives restarts

`hint()` on a single call is temporary. Index filters are persisted hints that tell the query planner to always use a specific index for a given query shape, even after plan cache resets.

```js
// Set an index filter
db.runCommand({
  planCacheSetFilter: "orders",
  query: { customerId: { $eq: "..." }, status: { $eq: "..." } },
  sort: { createdAt: -1 },
  projection: {},
  indexes: [{ customerId: 1, createdAt: -1, status: 1 }]
})

// List active index filters
db.runCommand({ planCacheListFilters: "orders" })

// Clear an index filter
db.runCommand({
  planCacheClearFilters: "orders",
  query: { customerId: { $eq: "..." }, status: { $eq: "..." } }
})
```

**Caution:** index filters survive until manually cleared — they are easy to forget and can cause confusion during debugging. Prefer fixing the query or index instead.

> **Memory hook:** "hint() is a sticky note on today's query — an index filter is that sticky note laminated onto the plan cache until someone peels it off."

---

## 8. Index Bloat and Maintenance

**The problem:** an index isn't a "set it and forget it" artifact. Every write, delete, and schema change leaves a mark on it, and over time an unmaintained index can become slower, larger, and even actively harmful.

**Basic definition:** index bloat is when an index accumulates stale, fragmented, or unnecessary data, degrading its usefulness over time.

### Where bloat actually comes from

```
1. Update churn on indexed fields
   Every update to an indexed field = remove old key + add new key
   High-frequency updates cause fragmentation in B-tree pages

2. Delete-heavy workloads
   Deletes leave "holes" in B-tree pages
   Pages don't automatically merge (WiredTiger handles some)

3. Orphaned indexes
   Indexes for old query patterns that no longer run
   Each write still updates them
   Use $indexStats to identify → accesses.ops = 0

4. Unused wildcard indexes
   May index thousands of fields nobody queries

5. Index size larger than RAM
   When index doesn't fit in WiredTiger cache,
   B-tree traversals require disk reads → slow
```

### Checking the health of your indexes

```js
// 1. Check index sizes
db.orders.stats({ indexDetails: true }).indexSizes

// 2. Find unused indexes
db.orders.aggregate([
  { $indexStats: {} },
  { $project: {
    name: 1,
    "accesses.ops": 1,
    "accesses.since": 1
  }},
  { $sort: { "accesses.ops": 1 } }
])

// 3. Check if indexes fit in cache
// Compare total index size to wiredTiger cache size
db.serverStatus().wiredTiger.cache["bytes currently in the cache"]
db.orders.stats().totalIndexSize

// 4. Find duplicate or redundant indexes
// An index { a: 1, b: 1 } makes { a: 1 } redundant
// (prefix rule: { a: 1 } queries use { a: 1, b: 1 })
db.orders.getIndexes()
// Review manually or use Atlas Performance Advisor
```

### Rebuilding when things get bad

```js
// Rebuild a specific index (MongoDB 4.4+)
// Drop and recreate:
db.users.dropIndex("age_1")
db.users.createIndex({ age: 1 }, { name: "age_1" })

// Rebuild all indexes on a collection (legacy method — use with caution)
db.users.reIndex()
// WARNING: reIndex() blocks all reads/writes on the collection
// Only use in maintenance windows on non-production or small collections

// In MongoDB Atlas: use "Rolling Index Build" via Atlas UI or API
// for zero-downtime index creation on large collections
```

### A recurring maintenance checklist

```
┌─────────────────────────────────────────────────────────────────────┐
│ Weekly:                                                             │
│   □ Review $indexStats for indexes with 0 accesses                 │
│   □ Check totalIndexSize vs WiredTiger cache size                   │
│                                                                     │
│ Monthly:                                                            │
│   □ Audit index list for redundant/duplicate indexes                │
│   □ Review slow query log for COLLSCAN or high-examine-ratio        │
│   □ Check for SORT stages in explain of frequently-run queries      │
│                                                                     │
│ When adding features:                                               │
│   □ Design index BEFORE writing the query (index-first development) │
│   □ Test with explain("executionStats") on production-scale data    │
│   □ Measure write throughput before and after adding index          │
│                                                                     │
│ When removing features:                                             │
│   □ Hide the index first (MongoDB 4.4+) and monitor for 1-2 weeks  │
│   □ Only drop if no queries use it                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### A rough sense of how big an index will be

```js
// Rule of thumb: index entry size ≈ indexed field size + 12 bytes (record ID)

// Estimate index size before creating:
// String field "email" avg 25 chars: (25 + 12) bytes × 10,000,000 docs = ~370 MB
// ObjectId field (12 bytes): (12 + 12) bytes × 10,000,000 docs = ~240 MB
// Number field (8 bytes): (8 + 12) bytes × 10,000,000 docs = ~200 MB

// Actual WiredTiger index size includes B-tree node overhead,
// compression, and cache alignment — typically 30-50% smaller
// than naive estimates due to prefix compression and snappy compression.
```

**Common mistake:** forgetting that removing an index is just as risky as adding the wrong one. Dropping an index that's secretly load-bearing for a rarely-run-but-critical query (month-end reporting, an admin dashboard) causes a nasty surprise weeks later. That's exactly why `hideIndex()` exists — it lets you simulate the removal safely before committing to it.

**Interview answer:** "Index bloat comes from update/delete churn fragmenting B-tree pages, orphaned indexes nobody queries anymore, and indexes that no longer fit in the WiredTiger cache. You monitor it with `$indexStats` (to find zero-access indexes), by comparing `totalIndexSize` to the cache size, and by auditing for redundant prefix indexes. The safe way to remove a suspect index in production is to hide it first with `hideIndex()`, monitor for a couple of weeks, and only drop it once you've confirmed nothing was relying on it."

> **Memory hook:** "An index is a garden, not a monument — weekly weeding (`$indexStats`), monthly pruning (redundant indexes), and never rip something out without hiding it first to see if anyone screams."

---

## 9. Hands-On Exercises

### Exercise 1: Apply the ESR Rule

1. Create an `events` collection with 200,000 documents containing: `eventType` (5 values), `userId`, `timestamp`, `duration` (range 1-3600 seconds), `region` (10 values).
2. Write a query: find all `eventType: "purchase"` events in `region: "US"`, with `duration > 300`, sorted by `timestamp` descending, limited to 20.
3. Run the query without any custom index and record COLLSCAN metrics.
4. Create an ESR-correct compound index for this query.
5. Verify with `explain("executionStats")` that: (a) no SORT stage exists, (b) `totalDocsExamined ≈ nReturned`, (c) `executionTimeMillis` dropped significantly.

### Exercise 2: Build a Covered Query

1. Using the `events` collection from Exercise 1, identify the fields needed for: filter `eventType`, return `userId` and `timestamp`, exclude `_id`.
2. Create an index that covers this query completely.
3. Run the query with the correct projection and verify `totalDocsExamined: 0` in explain.
4. Intentionally break the covered query by including one non-indexed field in the projection. Show that `totalDocsExamined` becomes non-zero.
5. Re-add the field to the index to restore coverage.

### Exercise 3: Diagnose a Slow Query

1. Create collection `inventory` with 500,000 documents: `sku`, `warehouseId` (20 values), `quantity` (0-10000), `category` (8 values), `lastUpdated`.
2. Run these queries and use `explain("executionStats")` to diagnose each:
   - `find({ warehouseId: "WH001" }).sort({ lastUpdated: -1 }).limit(10)`
   - `find({ category: "electronics", quantity: { $lt: 10 } })`
   - `find({ sku: "SKU-12345" })`
3. For each: what stage runs, what's the examine ratio, and what index would fix it?
4. Create the indexes you identified and re-run. Show before/after metrics.

### Exercise 4: Index Intersection vs Compound

1. Create two single-field indexes on `warehouseId` and `category` (from Exercise 3 collection).
2. Run `find({ warehouseId: "WH001", category: "electronics" }).explain("allPlansExecution")`.
3. Does index intersection appear in any of the candidate plans? What stage name indicates it?
4. Drop the two single-field indexes and create one compound: `{ warehouseId: 1, category: 1 }`.
5. Re-run explain. Compare `totalDocsExamined` and `executionTimeMillis` between index intersection and compound index.

### Exercise 5: Index Maintenance Audit

1. Use the `events` collection. Create 6 indexes — some useful, some redundant, one wildcard.
2. Run a variety of queries for 5 minutes.
3. Run `db.events.aggregate([{ $indexStats: {} }])` and identify:
   - Which indexes were used the most?
   - Which indexes were never used?
4. Identify any redundant indexes (where a compound index makes a prefix index unnecessary).
5. Hide the unused indexes with `hideIndex()`, run queries again, and verify nothing breaks before permanently dropping them.

---

## 10. Interview Q&A

**Q1: Explain the ESR rule and why field order matters in a compound index.**

A: ESR stands for Equality, Sort, Range. Place equality-filter fields first, sort fields second, and range-filter fields last. This ordering lets the B-tree narrow down to a small set of documents via equality, traverse those documents in pre-sorted order (eliminating in-memory SORT stages), and apply range filters at the end where the scan is already narrow. Reversing the order forces the planner to scan wide ranges first and then sort large result sets in memory, both of which are expensive.

---

**Q2: What is a covered query and what are its requirements?**

A: A covered query is one where all the data needed for the result comes from the index alone — no document fetches are required. Requirements: every field in the filter must be in the index, every field in the projection must be in the index, `_id` must be excluded (unless `_id` is in the index), and no indexed field contains array values (which would make it multikey, preventing coverage). The explain output shows `stage: "PROJECTION_COVERED"` and `totalDocsExamined: 0`.

---

**Q3: How does selectivity affect index choice?**

A: Selectivity measures what fraction of the collection a query returns. High-cardinality fields (email, userId) have high selectivity — a query on them returns very few documents. Low-cardinality fields (status, boolean) have low selectivity. MongoDB's query planner may skip a low-selectivity index entirely and choose a COLLSCAN because sequential document reads can outperform random I/O for 30%+ of a collection. Design indexes on high-selectivity fields and use compound indexes to increase selectivity of low-cardinality individual fields.

---

**Q4: What does it mean when explain() shows a SORT stage? Is it always bad?**

A: A SORT stage means MongoDB performed an in-memory sort on query results. It's not always catastrophic: if the result set is small, in-memory sort is fast. It becomes a problem when: the sort set exceeds 100MB (MongoDB 6.0+, previously 32MB) and spills to disk; the query runs frequently and each invocation sorts millions of documents; or latency requirements are strict. Fix: add the sort field to the compound index in the S (Sort) position using the ESR rule.

---

**Q5: What is index intersection and when would you see it in explain()?**

A: Index intersection is when the query planner uses two separate indexes and intersects (ANDs) the resulting record ID sets to answer a query. You see `AND_SORTED` or `AND_HASH` stages in the explain output. While occasionally optimal, a well-designed compound index is almost always faster because it requires one B-tree traversal instead of two plus a set intersection operation. When you see index intersection, consider whether a compound index would serve the same query pattern more efficiently.

---

**Q6: How would you safely remove an index on a production collection without causing an outage?**

A: Use the hidden index feature (MongoDB 4.4+): (1) Run `db.collection.hideIndex("index_name")` to make the index invisible to the query planner. (2) Monitor application metrics and slow query logs for 1-2 weeks to confirm no queries were relying on the index. (3) Check `$indexStats` to verify zero accesses since hiding. (4) Drop the index during a low-traffic window with `db.collection.dropIndex("index_name")`. This approach is risk-free — if something breaks after hiding, simply `unhideIndex()`.

---

**Q7: What is the difference between queryPlanner and executionStats explain modes?**

A: `queryPlanner` mode is free — it shows the winning plan the optimizer chose without actually executing the query. Use it to quickly verify an index is being selected. `executionStats` actually runs the query and reports real numbers: `nReturned`, `totalDocsExamined`, `totalKeysExamined`, `executionTimeMillis`. Use it for performance diagnosis. `allPlansExecution` runs all candidate plans and reports stats for each — use it to understand why the planner chose one plan over another.

---

**Q8: How do you find slow queries in MongoDB that indicate missing indexes?**

A: Multiple methods: (1) Enable the database profiler: `db.setProfilingLevel(1, { slowms: 100 })` then query `db.system.profile.find({ millis: { $gt: 100 } }).sort({ millis: -1 })`. (2) Check the MongoDB log for COLLSCAN and high `keysExamined` entries. (3) Use Atlas Performance Advisor (Atlas tier) which automatically suggests indexes based on observed traffic. (4) Use `db.currentOp({ "secs_running": { $gt: 5 } })` to find long-running queries in real time.

---

**Q9: Can you index the same field twice? What are the consequences?**

A: Yes, accidentally creating duplicate indexes is possible. For example: `{ email: 1 }` and also `{ email: 1, name: 1 }` — the first is a prefix of the second, so any query using `{ email: 1 }` alone will have two candidate indexes. The redundant index `{ email: 1 }` wastes storage space, adds write overhead, and clutters the plan cache without providing any additional query coverage. Use `$indexStats` to detect redundancy and drop the subset index.

---

**Q10: What is the impact of having too many indexes on a write-heavy collection?**

A: Every insert, update (of indexed fields), and delete must update all relevant indexes. With N indexes, each write requires N+1 operations (1 document + N index writes). For compound indexes on multiple fields, this multiplies. Additionally: (1) WiredTiger's cache fills with index pages, potentially evicting working document data. (2) Checkpoint and journaling operations take longer. (3) Background index builds during initial sync slow down replica set member recovery. Rule of thumb: keep indexes under 5-6 on write-heavy collections, and regularly audit with `$indexStats` to prune unused ones.
