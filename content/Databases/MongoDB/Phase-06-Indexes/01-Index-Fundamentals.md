# 01 — Index Fundamentals

## Table of Contents

1. [What Is an Index?](#1-what-is-an-index)
2. [B-Tree Structure — Under the Hood](#2-b-tree-structure--under-the-hood)
3. [COLLSCAN vs IXSCAN](#3-collscan-vs-ixscan)
4. [The Default _id Index](#4-the-default-_id-index)
5. [createIndex() — Syntax and Options](#5-createindex--syntax-and-options)
6. [getIndexes(), dropIndex(), dropIndexes()](#6-getindexes-dropindex-dropindexes)
7. [Index Write Overhead](#7-index-write-overhead)
8. [hint() — Forcing an Index](#8-hint--forcing-an-index)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What Is an Index?

Picture a `users` collection with 5 million documents, and someone runs:

```
db.users.find({ age: 30 })
```

Without any help, MongoDB has exactly one option: open every single document and check whether `age` equals 30. All 5 million of them. It doesn't matter that only 200 documents actually match — it still has to look at everyone to be sure.

That's the problem an index solves.

---

### The book-index analogy

Think about a 1,000-page textbook. If you want to find every mention of "sharding," you have two choices:

- Read all 1,000 pages, one by one, until you've seen everything (that's a **collection scan** — MongoDB calls this `COLLSCAN`).
- Flip to the index at the back of the book, find "sharding," and jump straight to page 847 (that's an **index scan** — `IXSCAN`).

A MongoDB index works exactly like that book index: a small, ordered list of values with pointers back to where the full content actually lives. You don't reread the whole book — you just look up the term and jump.

---

### Basic definition

An index is a separate data structure that MongoDB maintains alongside a collection. It stores a small, ordered subset of field values, plus pointers (record IDs) back to the full documents on disk.

Here's the difference in practice, side by side.

**Without an index on `{ age: 1 }`:**

```
db.users.find({ age: 30 })
→ MongoDB reads ALL 5,000,000 documents
→ Discards 4,999,800 that don't match
→ Returns 200 results
→ Time: seconds to minutes
```

**With an index on `{ age: 1 }`:**

```
db.users.find({ age: 30 })
→ MongoDB traverses B-tree to node where age = 30
→ Follows record-ID pointers to fetch 200 documents
→ Returns 200 results
→ Time: milliseconds
```

Same query, same data, wildly different amount of work — because the index already knows exactly where to look.

> **Memory hook:** "Don't read the whole book to find one word — flip to the index at the back."

---

## 2. B-Tree Structure — Under the Hood

So how does MongoDB actually "jump straight to page 847"? It's not magic — it's a **B-tree** (Balanced Tree), and every non-text, non-geospatial index in MongoDB is built on one.

Two properties make this work:

- Every value in the index is **sorted**.
- The tree stays **balanced** automatically — every insert or delete may trigger a rebalance, so you never end up with one lopsided branch that's slower to search than the rest.

### B-Tree ASCII Diagram

```
                        ┌─────────────┐
                        │  Root Node  │
                        │  [30 | 60]  │
                        └──┬──────┬───┘
                           │      │
              ┌────────────┘      └─────────────┐
              ▼                                  ▼
     ┌─────────────────┐              ┌─────────────────┐
     │  Internal Node  │              │  Internal Node  │
     │  [10 | 20 | 25] │              │  [45 | 50 | 55] │
     └──┬──┬──┬──┬─────┘              └──┬──┬──┬──┬─────┘
        │  │  │  │                       │  │  │  │
   ┌────┘  │  │  └────┐             ┌────┘  │  │  └────┐
   ▼       ▼  ▼       ▼             ▼       ▼  ▼       ▼
┌──────┐ ┌──┐ ┌──┐ ┌──────┐    ┌──────┐ ┌──┐ ┌──┐ ┌──────┐
│Leaf  │ │  │ │  │ │Leaf  │    │Leaf  │ │  │ │  │ │Leaf  │
│[5,8] │ │..│ │..│ │[26..│    │[31..│ │..│ │..│ │[56..│
│→doc  │ │  │ │  │ │ 29] │    │  44]│ │  │ │  │ │ 59] │
│ptrs  │ │  │ │  │ │→docs│    │→docs│ │  │ │  │ │→docs│
└──────┘ └──┘ └──┘ └─────┘    └─────┘ └──┘ └──┘ └─────┘
                                    │
                               Leaf nodes are
                               doubly linked
                               for range scans
                               ←─────────────→
```

### Key B-Tree Properties

| Property | Detail |
|----------|--------|
| Sorted | All values stored in ascending/descending order |
| Balanced | All leaf nodes at the same depth — O(log n) traversal guaranteed |
| Leaf nodes linked | Range queries (`$gt`, `$lt`, `$gte`, `$lte`, `$in`) scan leaves in order without returning to root |
| Branching factor | High (many keys per node) → shallow tree → few disk reads |
| Self-balancing | Inserts/deletes trigger automatic node splits and merges |

That "leaf nodes linked" row is worth pausing on — it's why a range query like `$gte: 25, $lte: 35` doesn't need to restart the search from the root for every value in the range. Once it lands on the first matching leaf, it just walks sideways along the linked leaves.

### How a B-Tree Lookup Works Step-by-Step

Let's actually trace a query through the tree instead of just describing it:

```
Query: db.users.find({ age: 45 })

Step 1: Read Root Node [30 | 60]
        45 > 30 and 45 < 60 → go to middle child

Step 2: Read Internal Node [45 | 50 | 55]
        45 = first key → go to left-of-45 child

Step 3: Read Leaf Node [31..44] + [45..49]
        Find age=45 entries

Step 4: Follow record-ID pointers → fetch documents from collection

Total disk reads: 3-4 (regardless of collection size)
vs COLLSCAN: 5,000,000 reads for 5M document collection
```

Notice that last line: "regardless of collection size." That's the entire point of O(log n) — double the collection to 10 million documents, and the tree only grows by one extra level. Compare that to COLLSCAN, which scales linearly: double the data, double the work.

### WiredTiger and B-Trees

MongoDB's default storage engine (WiredTiger) stores B-tree index nodes in a cache. Frequently accessed nodes (especially root and upper internal nodes) stay hot in RAM, making traversal extremely fast. Only the leaf access may require a disk read.

---

## 3. COLLSCAN vs IXSCAN

Theory is nice, but let's actually watch the difference happen on real data.

### Setup: Sample Collection

```js
// Insert 100,000 user documents
for (let i = 0; i < 100000; i++) {
  db.users.insertOne({
    name: "User " + i,
    age: Math.floor(Math.random() * 80) + 18,
    email: "user" + i + "@example.com",
    city: ["New York","London","Tokyo","Sydney"][i % 4],
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
  });
}
```

### COLLSCAN — Collection Scan (No Index)

```js
// Drop all non-_id indexes first
db.users.dropIndexes()

// Run query with explain
db.users.find({ age: 30 }).explain("executionStats")
```

**COLLSCAN explain output:**

```json
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "COLLSCAN",
      "direction": "forward"
    }
  },
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 1237,
    "executionTimeMillis": 84,
    "totalKeysExamined": 0,
    "totalDocsExamined": 100000,
    "executionStages": {
      "stage": "COLLSCAN",
      "nReturned": 1237,
      "docsExamined": 100000
    }
  }
}
```

Key indicators of COLLSCAN inefficiency:
- `stage: "COLLSCAN"` — no index used
- `totalDocsExamined: 100000` — every document read
- `nReturned: 1237` — only 1.2% were relevant
- Ratio: 100000 examined / 1237 returned = 80.8x wasted reads

That ratio is the number to keep an eye on. 80x wasted work, just to find 1.2% of the collection — this is exactly the "read every page of the book" scenario from the analogy above.

### IXSCAN — Index Scan (With Index)

```js
// Create index on age
db.users.createIndex({ age: 1 })

// Run same query
db.users.find({ age: 30 }).explain("executionStats")
```

**IXSCAN explain output:**

```json
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "FETCH",
      "inputStage": {
        "stage": "IXSCAN",
        "keyPattern": { "age": 1 },
        "indexName": "age_1",
        "direction": "forward",
        "indexBounds": {
          "age": ["[30.0, 30.0]"]
        }
      }
    }
  },
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 1237,
    "executionTimeMillis": 3,
    "totalKeysExamined": 1237,
    "totalDocsExamined": 1237,
    "executionStages": {
      "stage": "FETCH",
      "nReturned": 1237,
      "docsExamined": 1237,
      "inputStage": {
        "stage": "IXSCAN",
        "nReturned": 1237,
        "keysExamined": 1237
      }
    }
  }
}
```

Key indicators of efficient IXSCAN:
- `stage: "IXSCAN"` — B-tree traversal used
- `totalDocsExamined: 1237` — only matching docs fetched
- `nReturned: 1237` — 1:1 ratio (perfect selectivity)
- Time: 3ms vs 84ms = **28x faster**

Same query. Same data. One index, and it's 28x faster with a perfect 1:1 examine-to-return ratio — no wasted work at all.

### Side-by-Side Comparison

```
┌─────────────────────────────┬──────────────┬────────────────┐
│ Metric                      │ COLLSCAN     │ IXSCAN         │
├─────────────────────────────┼──────────────┼────────────────┤
│ stage                       │ COLLSCAN     │ IXSCAN + FETCH │
│ totalDocsExamined           │ 100,000      │ 1,237          │
│ totalKeysExamined           │ 0            │ 1,237          │
│ nReturned                   │ 1,237        │ 1,237          │
│ executionTimeMillis         │ 84           │ 3              │
│ Examine/Return ratio        │ 80.8x        │ 1.0x (perfect) │
│ Scales with collection size │ YES (bad)    │ NO (good)      │
└─────────────────────────────┴──────────────┴────────────────┘
```

### The Query Execution Pipeline

Every query goes through the same decision process before it even starts scanning anything:

```
Query arrives at mongod
        │
        ▼
┌───────────────────┐
│  Query Planner    │  ← Considers all candidate indexes
│  (Optimizer)      │  ← Picks "winning plan" via trial runs
└────────┬──────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
COLLSCAN    IXSCAN
(no index)  ┌──────────────────────────────────┐
            │ 1. Traverse B-tree to key range  │
            │ 2. Collect matching record IDs   │
            │ 3. FETCH stage: load documents   │
            │    (skipped if covered query)    │
            └──────────────────────────────────┘
```

---

## 4. The Default _id Index

Here's a small detail worth knowing: you never have to remember to index `_id` — MongoDB does it automatically, on every collection, and it can't be removed.

```js
db.users.getIndexes()
// Always includes:
// { "v": 2, "key": { "_id": 1 }, "name": "_id_" }
```

Properties:
- Unique — no two documents can share an `_id` value
- Not sparse — every document has `_id`
- Used automatically for all `findById()` and `_id`-based queries
- `_id` values are stored in B-tree order (ObjectIds sort by creation time)

---

## 5. createIndex() — Syntax and Options

### Basic Syntax

```js
db.collection.createIndex(
  { fieldName: direction },  // key specification
  { option: value }          // options document (optional)
)
```

Direction values:
- `1` = ascending
- `-1` = descending
- `"text"` = text index
- `"2dsphere"` = geospatial
- `"hashed"` = hashed

### Core Options

#### name — Custom Index Name

```js
db.users.createIndex(
  { email: 1 },
  { name: "idx_users_email" }
)
```

- Default name is auto-generated: `email_1`, `age_1_city_1`, etc.
- Custom names are shorter and easier to reference in `hint()` and `dropIndex()`
- Max length: 127 characters (MongoDB 4.2+, previously 128 bytes including namespace)

#### background — Non-Blocking Build (Legacy)

```js
// MongoDB < 4.2 only — creates index without blocking reads/writes
db.users.createIndex(
  { age: 1 },
  { background: true }
)
```

**Important:** In MongoDB 4.2+, all index builds are non-blocking by default (they use an optimized build protocol). The `background` option is ignored in 4.2+.

#### unique — Enforce Uniqueness

```js
db.users.createIndex(
  { email: 1 },
  { unique: true }
)

// Now this will throw a duplicate key error:
db.users.insertOne({ email: "test@example.com" })  // if email already exists
// E11000 duplicate key error collection: mydb.users index: email_1
```

Behavior details:
- Unique indexes reject `insertOne`/`insertMany` that would create duplicates
- `updateOne` with upsert also respects uniqueness
- Multiple documents with `null` for the indexed field → duplicate key error
  (use `sparse: true` to allow multiple null values)

```js
// Unique + sparse: allows multiple documents missing the field
db.users.createIndex(
  { phoneNumber: 1 },
  { unique: true, sparse: true }
)
```

#### sparse — Only Index Documents That Have the Field

```js
db.users.createIndex(
  { nickname: 1 },
  { sparse: true }
)
```

- Documents where `nickname` is missing are not included in the index
- Smaller index size when field is optional
- Queries that filter `{ nickname: { $exists: false } }` cannot use a sparse index

```
Normal Index (sparse: false):
┌──────────────────────────────────┐
│ null | null | null | "alice" | "bob" │  ← nulls for missing fields
└──────────────────────────────────┘

Sparse Index (sparse: true):
┌──────────────────────────────────┐
│ "alice" | "bob"                  │  ← missing fields excluded
└──────────────────────────────────┘
```

#### expireAfterSeconds — TTL (Time To Live)

```js
// Documents expire 1 hour after their createdAt value
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }
)
```

- MongoDB's background TTL thread runs every 60 seconds
- Deletes documents where `fieldValue + expireAfterSeconds < now`
- Field must be a BSON Date type
- Only works on single-field indexes
- Covered in detail in `02-Index-Types.md`

#### collation — Language-Specific String Sorting

```js
db.products.createIndex(
  { name: 1 },
  { collation: { locale: "en", strength: 2 } }
)
// strength: 2 = case-insensitive comparison
```

#### hidden — Hide Index from Query Planner (MongoDB 4.4+)

```js
// Hide index without dropping it — test impact before removing
db.users.hideIndex("age_1")
db.users.unhideIndex("age_1")

// Or in createIndex:
db.users.createIndex({ age: 1 }, { hidden: true })
```

### Full createIndex() Example

```js
db.orders.createIndex(
  { customerId: 1, orderDate: -1, status: 1 },
  {
    name: "idx_orders_customer_date_status",
    unique: false,
    sparse: false,
    background: false,   // ignored in 4.2+
    collation: { locale: "en" }
  }
)
```

---

## 6. getIndexes(), dropIndex(), dropIndexes()

### getIndexes() — List All Indexes

```js
db.users.getIndexes()
```

**Output:**

```json
[
  {
    "v": 2,
    "key": { "_id": 1 },
    "name": "_id_"
  },
  {
    "v": 2,
    "key": { "email": 1 },
    "name": "email_1",
    "unique": true
  },
  {
    "v": 2,
    "key": { "age": 1, "city": 1 },
    "name": "age_1_city_1"
  }
]
```

### Inspect Index Stats

```js
// Index sizes in bytes
db.users.stats().indexSizes

// Index usage statistics (MongoDB 3.2+)
db.users.aggregate([{ $indexStats: {} }])
```

`$indexStats` output:

```json
[
  {
    "name": "age_1",
    "key": { "age": 1 },
    "host": "hostname:27017",
    "accesses": {
      "ops": 15234,        // how many times this index was used
      "since": "2024-01-01T00:00:00Z"
    }
  }
]
```

**Pro tip:** Use `$indexStats` to find unused indexes (ops: 0). Unused indexes waste space and slow writes — drop them.

### dropIndex() — Drop a Specific Index

```js
// By index name
db.users.dropIndex("age_1")

// By key specification
db.users.dropIndex({ age: 1 })

// You CANNOT drop the _id index
db.users.dropIndex("_id_")
// MongoServerError: cannot drop _id index
```

### dropIndexes() — Drop Multiple or All Indexes

```js
// Drop all indexes except _id
db.users.dropIndexes()

// Drop specific indexes by name array (MongoDB 4.4+)
db.users.dropIndexes(["age_1", "email_1", "age_1_city_1"])
```

**Warning:** Dropping indexes on large, production collections under load can cause temporary degradation. Always verify queries are not actively using the index first (check `$indexStats`).

---

## 7. Index Write Overhead

Here's the part that's easy to forget when you're excited about how fast IXSCAN made your reads: **indexes are not free.**

Every index you create is a second (or third, or fourth) data structure that has to stay in sync with the collection. So every write operation now has extra bookkeeping to do.

### Write Cost Breakdown

```
INSERT one document with 3 indexes:
┌──────────────────────────────────────┐
│  1. Write document to collection     │  1 write
│  2. Update _id index (B-tree insert) │  1 index write
│  3. Update age_1 (B-tree insert)     │  1 index write
│  4. Update email_1 (B-tree insert)   │  1 index write
│  5. Update city_text (text update)   │  varies
└──────────────────────────────────────┘
Total: 1 document write + N index writes
```

One document write turns into N+1 writes under the hood. That's the tradeoff, in plain numbers.

### Impact Table

```
┌────────────────┬──────────────────────────────────────────────────┐
│ Operation      │ Index Impact                                     │
├────────────────┼──────────────────────────────────────────────────┤
│ insertOne      │ Add entry to every index                         │
│ deleteOne      │ Remove entry from every index                    │
│ updateOne      │ If indexed field changes: remove old, add new    │
│ updateOne      │ If non-indexed field changes: no index update    │
│ replaceOne     │ Remove all old index entries, add all new        │
│ bulkWrite      │ Each operation has individual index overhead      │
└────────────────┴──────────────────────────────────────────────────┘
```

Notice the second `updateOne` row — updating a field that isn't indexed costs nothing extra. That's a useful thing to keep in mind when you're deciding which fields are worth indexing in a write-heavy collection.

### Benchmarking Index Overhead

Don't just take this on faith — you can measure it yourself:

```js
// Test: insert 10,000 docs, measure with 0 vs 5 indexes
// (run in mongosh)

function insertBatch(n) {
  const start = Date.now();
  const docs = [];
  for (let i = 0; i < n; i++) {
    docs.push({
      name: "User" + i,
      age: Math.floor(Math.random() * 80),
      email: "user" + i + "@test.com",
      city: "NYC",
      score: Math.random() * 100
    });
  }
  db.perftest.insertMany(docs);
  return Date.now() - start;
}

// Run without indexes
db.perftest.drop();
print("No indexes:", insertBatch(10000), "ms");

// Add 4 indexes
db.perftest.createIndex({ age: 1 });
db.perftest.createIndex({ email: 1 }, { unique: true });
db.perftest.createIndex({ city: 1 });
db.perftest.createIndex({ score: 1 });

// Clean and re-run
db.perftest.deleteMany({});
print("With 4 indexes:", insertBatch(10000), "ms");
// Typical result: ~2-4x slower inserts with 4 indexes
```

**Common mistake:** treating indexes as a free performance upgrade and adding one for every field you can think of "just in case." Every index you don't actually use in a query is pure cost — it slows down every write, and it competes for RAM in WiredTiger's cache, with zero benefit in return.

### Best Practices for Write-Heavy Collections

1. **Only create indexes that queries actually use** — audit with `$indexStats`
2. **Defer index creation for bulk loads** — build indexes after bulk insert, not before
3. **Use `background: false` for building** — modern MongoDB does this optimally
4. **Avoid over-indexing** — more than 5-6 indexes on a write-heavy collection causes measurable slowdown

**Interview answer:** "Indexes speed up reads but cost something on every write, because each indexed field is a separate B-tree structure that has to be kept in sync with the collection. An insert with three indexes isn't one write — it's up to four. The practical implication is that you shouldn't index everything defensively; you should index the fields your actual queries filter, sort, or project on, and periodically audit with `$indexStats` to prune indexes nothing is using."

> **Memory hook:** "Every index is a second book you have to keep up to date every time the story changes."

---

## 8. hint() — Forcing an Index

The query planner usually picks the best plan on its own. But "usually" isn't "always" — and when it gets it wrong, you need a way to override it.

### Why Force an Index?

- Query planner picked a suboptimal plan (happens with complex multi-field queries)
- You want to test performance of a specific index
- You know the data distribution better than the planner
- Stale query plan cache is being used

### hint() Syntax

```js
// Force by index name
db.users.find({ age: 30, city: "New York" })
        .hint("age_1_city_1")

// Force by key specification
db.users.find({ age: 30, city: "New York" })
        .hint({ age: 1, city: 1 })

// Force COLLSCAN (disable all indexes)
db.users.find({ age: 30 })
        .hint({ $natural: 1 })
```

### hint() with sort() and explain()

The most common reason to reach for `hint()` is to compare two candidate plans head to head:

```js
// Compare two plans
const plan1 = db.users.find({ age: { $gte: 25, $lte: 35 }, city: "London" })
  .hint("age_1")
  .explain("executionStats");

const plan2 = db.users.find({ age: { $gte: 25, $lte: 35 }, city: "London" })
  .hint("city_1")
  .explain("executionStats");

// Compare totalDocsExamined and executionTimeMillis
print("Plan 1 (age index) docs examined:", plan1.executionStats.totalDocsExamined);
print("Plan 2 (city index) docs examined:", plan2.executionStats.totalDocsExamined);
```

### Resetting the Query Plan Cache

MongoDB caches query plans per query shape. If data distribution changes, cached plans may become stale.

```js
// Clear plan cache for a specific collection
db.users.getPlanCache().clear()

// List cached plans
db.users.getPlanCache().list()
```

### hint() in Aggregation

```js
db.users.aggregate(
  [
    { $match: { age: { $gte: 30 } } },
    { $group: { _id: "$city", count: { $sum: 1 } } }
  ],
  { hint: "age_1" }  // hint passed as option, not .hint() method
)
```

**Common mistake:** reaching for `hint()` as a permanent fix instead of a diagnostic tool. If you find yourself hinting the same query in production forever, that's usually a sign you're missing the right compound index — not that you've found the correct long-term solution.

---

## 9. Hands-On Exercises

### Exercise 1: Observe COLLSCAN vs IXSCAN

1. Create a collection `products` with 50,000 documents:
   ```js
   for (let i = 0; i < 50000; i++) {
     db.products.insertOne({
       sku: "SKU-" + i,
       price: Math.random() * 500,
       category: ["electronics","clothing","food","sports"][i % 4],
       stock: Math.floor(Math.random() * 1000)
     });
   }
   ```
2. Run `db.products.find({ category: "electronics" }).explain("executionStats")` and record `totalDocsExamined` and `executionTimeMillis`.
3. Create an index: `db.products.createIndex({ category: 1 })`
4. Re-run the explain. Compare the metrics. Calculate the speedup ratio.
5. Write down: what changed in the winning plan stage?

### Exercise 2: Unique Index Enforcement

1. Drop the `products` collection and recreate with 1,000 documents where `sku` is unique.
2. Create a unique index on `sku`.
3. Try to insert a document with a duplicate `sku` and capture the exact error message.
4. Now try an `updateOne` that would create a duplicate `sku`. Does it fail too?
5. What happens if you try to create a unique index on a field that already has duplicates?

### Exercise 3: Sparse Index Behaviour

1. Insert 10 documents: 5 with a `discountCode` field, 5 without it.
2. Create a sparse index on `discountCode`.
3. Run `db.products.find({}).explain("executionStats")` — does MongoDB use the sparse index for a full collection scan? Why/why not?
4. Run `db.products.find({ discountCode: { $exists: true } }).explain()` — is the sparse index used?
5. What are the practical use cases for sparse indexes?

### Exercise 4: Index Overhead Measurement

1. Create collection `writetest` with no extra indexes.
2. Time an `insertMany` of 10,000 documents.
3. Drop the collection, recreate, add 5 indexes before inserting.
4. Time the same `insertMany`.
5. Add 5 more indexes (10 total) and repeat. Create a table of: index count vs insert time.

### Exercise 5: hint() Override and Plan Cache

1. Create a collection with indexes on both `price` and `category`.
2. Insert data where price is high cardinality and category has only 4 values.
3. Run a query filtering on both fields. Use `.explain("allPlansExecution")` to see which plan won.
4. Use `.hint()` to force the category index. Compare performance.
5. Clear the plan cache with `db.products.getPlanCache().clear()` and re-run. Did the winning plan change?

---

## 10. Interview Q&A

**Q1: What is the time complexity of a B-tree index lookup?**

A: O(log n) where n is the number of index entries. The tree height grows logarithmically with data volume. A B-tree with 1 million entries typically has height 3-4, meaning 3-4 node reads regardless of collection size.

---

**Q2: Why can't you drop the _id index?**

A: MongoDB uses the `_id` index to enforce uniqueness of document identifiers, which is required for sharding, replication (oplog), and change streams. It is a fundamental constraint of the data model. Without it, MongoDB could not guarantee document uniqueness.

---

**Q3: What is the difference between `totalKeysExamined` and `totalDocsExamined`?**

A: `totalKeysExamined` is the number of index B-tree keys scanned. `totalDocsExamined` is the number of actual documents fetched from the collection. In a covered query, `totalDocsExamined` is 0 because the answer comes entirely from the index. In a normal IXSCAN + FETCH, both numbers equal `nReturned` for a perfectly selective index.

---

**Q4: When does an index hurt performance?**

A: Indexes hurt performance when: (1) the collection is write-heavy and indexes require constant updates; (2) the index has low selectivity (e.g., a boolean field — indexes only ~50% of collection, planner may choose COLLSCAN anyway); (3) there are too many indexes causing index cache pressure; (4) an index is never used by any query but still pays the write overhead tax.

---

**Q5: What does `background: true` do in createIndex and when is it irrelevant?**

A: In MongoDB < 4.2, `background: true` allowed index builds to run without holding a global write lock, preventing blocking of reads/writes during the build. In MongoDB 4.2+, all index builds use a "simultaneous build" protocol that doesn't hold the lock for the entire build duration, making the `background` option a no-op — it's accepted but ignored.

---

**Q6: Can a unique index have null values?**

A: A standard unique index treats `null` as a value and only allows one document with a null (or missing) value for that field. If you need multiple documents to omit the field while still enforcing uniqueness on present values, combine `unique: true` with `sparse: true`.

---

**Q7: What is an explain() output stage and what stages indicate an index is being used?**

A: Stages are nodes in the query execution plan tree. `COLLSCAN` means no index. `IXSCAN` means a B-tree index was traversed. `FETCH` means documents were loaded from collection storage. `SORT` means an in-memory sort occurred (may indicate missing index). `COUNT_SCAN` means a count was served from index metadata.

---

**Q8: What is the query plan cache and how does MongoDB populate it?**

A: MongoDB caches the winning query plan per "query shape" (same filter structure, different values). When a new query shape arrives, the planner runs a "trial period" where it tests multiple candidate plans simultaneously. The first plan to return 101 results wins and is cached. The cache is invalidated if: an index is added/dropped, collection statistics change significantly, or manually cleared.

---

**Q9: How does hint() interact with the query plan cache?**

A: `hint()` bypasses the plan cache entirely. The hinted plan is used directly without consulting or updating the cache. This is useful for testing alternative plans without polluting the cache. After removing the hint, the planner uses its normal cached plan.

---

**Q10: What happens to indexes during a replica set failover?**

A: Indexes exist in the WiredTiger data files on each replica set member. During a failover, the new primary already has all the same indexes as the old primary because replication applies all index creation/drop operations. No index rebuild is needed after failover.
