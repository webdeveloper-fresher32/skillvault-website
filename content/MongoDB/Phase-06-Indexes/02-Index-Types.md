# 02 — Index Types

## Table of Contents

1. [Single Field Index](#1-single-field-index)
2. [Compound Index](#2-compound-index)
3. [Multikey Index (Arrays)](#3-multikey-index-arrays)
4. [Text Index](#4-text-index)
5. [Geospatial Index — 2dsphere](#5-geospatial-index--2dsphere)
6. [Hashed Index](#6-hashed-index)
7. [Wildcard Index](#7-wildcard-index)
8. [Partial Index](#8-partial-index)
9. [Sparse Index](#9-sparse-index)
10. [TTL Index](#10-ttl-index)
11. [Unique Index](#11-unique-index)
12. [Full Comparison Table](#12-full-comparison-table)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

In the last file we established the core idea: an index is the book-index at the back of your data, letting MongoDB flip straight to the right page instead of reading cover to cover. But a book only has one kind of index — alphabetical, by word. MongoDB's "book" needs to answer very different kinds of questions: "find people aged 30," yes, but also "find everyone near this GPS point," "find documents containing the word 'sharding'," "find the array that contains this tag," and "delete this document automatically in 30 minutes."

One index shape can't do all of that. So MongoDB ships several different index *types*, each built for a different kind of lookup. This file walks through all eleven of them.

---

## 1. Single Field Index

**The problem:** you're filtering or sorting on one field, over and over — `age`, `email`, `city` — and every one of those queries is currently a COLLSCAN.

**The analogy:** this is the plain, single-column index at the back of a book — like an alphabetical list of every character name. One key, one sorted list, one pointer back to the page.

It's the simplest index type, and everything else in this file is really a variation on it: index one field, in ascending or descending order.

```js
// Ascending
db.users.createIndex({ age: 1 })

// Descending (functionally identical for single-field queries)
db.users.createIndex({ age: -1 })
```

**When direction matters for single field:** Only when combining with sort. `{ age: 1 }` supports `sort({ age: 1 })` and `sort({ age: -1 })` equally well — MongoDB can traverse B-tree forward or backward.

### Embedded Document Field Index

Fields don't have to live at the top level. You can index straight into a nested field using dot notation:

```js
// Index a nested field
db.users.createIndex({ "address.city": 1 })

// Query that uses it:
db.users.find({ "address.city": "London" })
```

### Embedded Document Index (Whole Subdocument)

You can also index the *entire* subdocument as a single value, but this comes with a catch worth knowing before you rely on it:

```js
// Index the entire subdocument — requires exact match including field order
db.users.createIndex({ address: 1 })

// Only matches if the entire address subdocument matches exactly:
db.users.find({ address: { street: "123 Main St", city: "NYC", zip: "10001" } })
// Field order must match exactly — use dot notation index instead
```

That's a mistake worth flagging early: indexing the whole subdocument only helps if queries match it byte-for-byte, field order included. Almost nobody wants that — the dot-notation index above is what you actually want 95% of the time.

> **Memory hook:** "One field, one alphabetical list — the simplest index, and the building block for every other type below."

---

## 2. Compound Index

**The problem:** your query filters on two or more fields at once — `find({ age: 30, city: "NYC" })`. A single-field index on `age` alone still leaves MongoDB scanning every document with `age: 30` to check the city. You need one index that understands both fields together.

**The analogy:** think of a phone book sorted by last name, then first name. Looking up "Smith, John" is fast because the book is sorted by last name *first* — that narrows you down to all the Smiths — and then by first name *within* that group. But if you only knew someone's first name was "John," the phone book is useless; it's not organized that way.

That's the whole idea behind a compound index — and it's also exactly where the order of fields becomes critical, not just cosmetic.

```js
// Compound index on age (ascending) and city (ascending)
db.users.createIndex({ age: 1, city: 1 })
```

### The Prefix Rule

A compound index `{ a: 1, b: 1, c: 1 }` supports queries that use the **leftmost prefix** of the index fields — just like the phone book: you can search by last name alone, or last+first, but never first name alone.

```
Index: { age: 1, city: 1, score: 1 }

Supported queries (use prefix):
  { age: X }                         ✓  prefix: age
  { age: X, city: Y }                ✓  prefix: age, city
  { age: X, city: Y, score: Z }      ✓  full index
  { age: X, score: Z }               ✓  age is prefix; score uses COLLSCAN filter
  { city: Y }                        ✗  city is not a prefix
  { city: Y, score: Z }              ✗  neither starts with age
  { score: Z }                       ✗  score is not a prefix
```

### Internal working: the ASCII diagram

Here's what that phone-book sorting actually looks like as a B-tree. Notice the structure: department is sorted first, and *within* each department, salary is sorted — level is the third, innermost sort key.

```
Index: { department: 1, salary: 1, level: 1 }

                    ┌─────────────────────────┐
                    │       Root Node         │
                    │  [Engineering | Sales]  │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┴─────────────────┐
              ▼                                   ▼
   ┌─────────────────────┐            ┌──────────────────────┐
   │ department=Engineer │            │  department=Sales    │
   │  [50k | 80k | 120k] │            │  [40k | 60k | 90k]  │
   └──┬──────┬────────┬──┘            └──┬────────┬──────────┘
      │      │        │                  │        │
      ▼      ▼        ▼                  ▼        ▼
   50k    80k      120k               40k-60k  60k-90k
   ┌────┐ ┌────┐  ┌────┐             ┌──────┐ ┌──────┐
   │L1  │ │L2  │  │L3  │             │ L1   │ │ L2   │
   │L2  │ │L3  │  │L4  │             │ L2   │ │ L3   │
   └────┘ └────┘  └────┘             └──────┘ └──────┘
         │                                │
         └────── Leaf nodes doubly linked ─┘
                for range scan on salary
```

Because `department` sits first, MongoDB narrows to one branch of the tree immediately. Only *inside* that branch does `salary` come into play as the next sort key. Flip the field order and this whole structure — and which queries it can serve — changes.

### Field Order and Sort

The same "leftmost, in-order" logic applies to `sort()`, not just `find()` filters:

```js
// Index: { status: 1, date: -1 }

// Uses index for sort (no in-memory sort needed):
db.orders.find({ status: "active" }).sort({ date: -1 })     // ✓
db.orders.find({ status: "active" }).sort({ date: 1 })      // ✓ (reverse traversal)

// Compound sort that matches index direction:
db.orders.find().sort({ status: 1, date: -1 })              // ✓ matches exactly
db.orders.find().sort({ status: -1, date: 1 })              // ✓ all reversed

// In-memory sort required (SORT stage in explain):
db.orders.find().sort({ status: 1, date: 1 })               // ✗ direction mismatch
db.orders.find().sort({ date: -1 })                         // ✗ not a prefix sort
```

The trick to remember: reversing *every* direction in the sort still matches the index (MongoDB just walks the B-tree backward), but flipping only *some* of the directions breaks the match and forces an in-memory sort.

### When to Use Compound vs Multiple Single

```
Query: find({ age: 30, city: "NYC" })

Option A: Two single indexes { age: 1 } and { city: 1 }
→ Index intersection (rare, expensive)
→ Planner usually picks one index + COLLSCAN filter on other

Option B: One compound index { age: 1, city: 1 }
→ Both fields covered in single B-tree traversal
→ More efficient, predictable
→ Recommended
```

### Common mistakes

- Assuming field order in `createIndex()` doesn't matter — it does, and it's the single most common index bug: a compound index built in the wrong order silently fails to serve half your queries.
- Forgetting that direction matters for sort, not for equality. `{ status: 1, date: -1 }` serves equality-then-range queries in either sort direction combo, but only if *all* directions flip together, not some.
- Building two single-field indexes instead of one compound index "just in case," when the queries always filter on both fields together — that's strictly worse than one well-ordered compound index.

**Interview answer:** "Field order in a compound index defines the sort order of the underlying B-tree — first by the leading field, then by the next field within each value of the first, and so on. That's why only queries using a leftmost prefix of the index fields can use it, and why sort direction has to match the index (or be its exact reverse) to avoid an in-memory SORT stage. The common design rule of thumb is Equality fields first, then Sort fields, then Range fields — the ESR rule — because equality narrows the B-tree the most before you ever need to scan a range."

> **Memory hook:** "A compound index is a phone book sorted by last name, then first — useless if you only know the first name."

---

## 3. Multikey Index (Arrays)

**The problem:** your documents have array fields — `tags: ["mongodb", "nosql", "databases"]` — and you need to query "does this array contain X?" efficiently. A regular index expects one value per field, not a list.

**The analogy:** picture a book's index entry for a chapter that covers five different topics at once. The index doesn't just list the chapter once — it lists *each* topic separately, all pointing back to that same chapter. Look up any one of the five topics, and you land on the right page.

That's exactly what MongoDB does automatically when you index a field that turns out to contain an array — no special syntax needed, it just detects the array and switches to **multikey** mode: one index entry per array element, all pointing to the same document.

```js
// Document
{ _id: 1, name: "Alice", tags: ["mongodb", "nosql", "databases"] }

// Create index
db.posts.createIndex({ tags: 1 })
// MongoDB creates 3 B-tree entries:
//   "databases" → ObjectId(1)
//   "mongodb"   → ObjectId(1)
//   "nosql"     → ObjectId(1)
```

### Internal working: the multikey diagram

```
Document: { tags: ["mongodb", "nosql", "databases"] }

B-tree entries created:
┌────────────────────────────────────────────┐
│ Key          │ RecordID                    │
├──────────────┼─────────────────────────────┤
│ "databases"  │ → ObjectId("doc1")          │
│ "mongodb"    │ → ObjectId("doc1")          │
│ "nosql"      │ → ObjectId("doc1")          │
│ "mongodb"    │ → ObjectId("doc2")          │  ← another doc also has "mongodb"
│ "python"     │ → ObjectId("doc2")          │
└──────────────┴─────────────────────────────┘
```

One document, three array elements, three separate B-tree entries — all resolving back to the same `doc1`. That's the whole mechanism.

### Querying Multikey Indexes

```js
// All of these use the multikey index:
db.posts.find({ tags: "mongodb" })                          // element match
db.posts.find({ tags: { $in: ["mongodb", "nosql"] } })     // $in
db.posts.find({ tags: { $all: ["mongodb", "nosql"] } })    // $all
db.posts.find({ tags: { $elemMatch: { $gt: "m" } } })      // $elemMatch
```

### Multikey Index Restrictions

Here's the restriction that trips people up: what happens if *two* fields in a compound index are both arrays on the same document? MongoDB would have to generate every combination of elements from both arrays — a combinatorial explosion. So it simply refuses:

```js
// CANNOT create compound multikey index where BOTH fields are arrays
// This fails if any document has arrays in both fields:
db.posts.createIndex({ tags: 1, comments: 1 })
// MongoServerError: cannot index parallel arrays [tags] [comments]
// (only one field per compound index can be an array at a time)

// This is fine — only tags is an array:
db.posts.createIndex({ tags: 1, authorId: 1 })  // authorId is a scalar
```

### Embedded Documents in Arrays

The same multikey mechanism applies when the array holds objects, not scalars — you just index the nested field with dot notation:

```js
// Document with array of objects
{
  _id: 1,
  inventory: [
    { product: "widget", qty: 100 },
    { product: "gadget", qty: 50 }
  ]
}

// Index the nested field
db.warehouse.createIndex({ "inventory.product": 1 })

// Query
db.warehouse.find({ "inventory.product": "widget" })
```

### Common mistakes

- Trying to build a compound index on two array fields and being surprised by the "parallel arrays" error — remember, only one field per compound index can be an array on any given document.
- Assuming a multikey index only helps with `$in`/`$all` — plain equality and `$elemMatch` benefit just as much.

**Interview answer:** "A multikey index is what MongoDB automatically builds when the indexed field is an array — it creates one index entry per array element, all pointing back to the same document, similar to how a book index lists a chapter under every topic it covers. The key restriction is that a compound index can have at most one array field per document, because indexing two arrays together would require one entry per combination of elements from both — a combinatorial blow-up MongoDB refuses to create."

> **Memory hook:** "A chapter covering five topics gets five index entries — one array field, one entry per element, all pointing at the same page."

---

## 4. Text Index

**The problem:** you want to search *inside* string content — "find articles mentioning mongodb and indexes" — not match a field exactly. A regular index can tell you `title == "MongoDB Guide"`, but it can't tell you the word "mongodb" appears somewhere in a 2,000-word article body.

**The analogy:** this is the difference between a book's table of contents (exact chapter titles) and its back-of-book keyword index that lists every significant word and which pages it appears on, stripped of filler words like "the" and "and." Text indexes build exactly that kind of keyword index over your string fields.

```js
// Single field text index
db.articles.createIndex({ body: "text" })

// Multi-field text index (only ONE text index per collection)
db.articles.createIndex(
  { title: "text", body: "text", tags: "text" },
  { name: "article_text_idx" }
)
```

### Text Index with Weights

Not every field should count equally toward relevance — a match in the title probably matters more than a match buried in the body. Weights let you say that explicitly:

```js
db.articles.createIndex(
  { title: "text", body: "text", tags: "text" },
  {
    weights: {
      title: 10,    // title matches count 10x
      tags: 5,      // tags matches count 5x
      body: 1       // body matches count 1x (default)
    },
    name: "articles_text"
  }
)
```

### Language Support

```js
// Default language is "english" (stop words, stemming)
db.articles.createIndex({ body: "text" }, { default_language: "french" })

// Per-document language override
{
  title: "Bonjour",
  body: "...",
  language: "french"   // field named "language" used automatically
}

// Custom language field name
db.articles.createIndex(
  { body: "text" },
  { language_override: "lang" }
)
```

### $text Query Operator

```js
// Basic text search
db.articles.find({ $text: { $search: "mongodb indexes" } })

// Phrase search (double quotes inside string)
db.articles.find({ $text: { $search: "\"replica set\"" } })

// Negation (exclude term)
db.articles.find({ $text: { $search: "mongodb -cassandra" } })

// Include relevance score in results
db.articles.find(
  { $text: { $search: "mongodb performance" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })

// Language override per query
db.articles.find({
  $text: { $search: "base de données", $language: "french" }
})

// Case-sensitive search (MongoDB 3.2+)
db.articles.find({
  $text: { $search: "MongoDB", $caseSensitive: true }
})
```

### Internal working: how text gets indexed

The keyword-index analogy above is literally what happens under the hood — tokenize, drop the noise words, and reduce each word to its root form before storing it:

```
Input: "MongoDB Indexes Are Really Fast"

Tokenization:
  ["MongoDB", "Indexes", "Are", "Really", "Fast"]

Stop word removal (English):
  ["MongoDB", "Indexes", "Really", "Fast"]
  ("Are" is a stop word)

Stemming:
  ["mongodb", "index", "realli", "fast"]
  ("Indexes" → "index", "Really" → "realli")

B-tree entries:
  "fast"    → doc1 (weight: 1)
  "index"   → doc1 (weight: 1)
  "mongodb" → doc1 (weight: 1)
  "realli"  → doc1 (weight: 1)
```

### Text Index Limitations

- Only one text index per collection
- Cannot be used with `hint()` in older versions
- Does not support partial matches (no wildcard prefix search)
- $text cannot be combined with $or across collections

> **Memory hook:** "A text index is the keyword page at the back of the book — strip the filler words, reduce everything to its root, and list where each one shows up."

---

## 5. Geospatial Index — 2dsphere

**The problem:** "find restaurants within 1km of me" or "which neighborhood does this point fall inside?" A B-tree sorted on a single number can't answer "what's nearby" — proximity isn't a single sortable value, it's a two-dimensional relationship.

**The analogy:** think of a paper road atlas with a grid overlay — A1, A2, B1, B2 — so you can jump to the right general square instead of scanning the whole map. A 2dsphere index does the geographic equivalent, but on a real sphere (the Earth), not a flat grid, so distances come out accurate in real meters instead of a distorted flat approximation.

### GeoJSON Document Structure

```js
// Insert a location document using GeoJSON Point
db.places.insertOne({
  name: "Central Park",
  location: {
    type: "Point",
    coordinates: [-73.9654, 40.7829]  // [longitude, latitude]
  },
  category: "park"
})

// GeoJSON Polygon
db.neighborhoods.insertOne({
  name: "Manhattan",
  boundary: {
    type: "Polygon",
    coordinates: [[
      [-74.0479, 40.6829],
      [-73.9067, 40.6829],
      [-73.9067, 40.8820],
      [-74.0479, 40.8820],
      [-74.0479, 40.6829]   // first and last point must be equal
    ]]
  }
})
```

### Creating a 2dsphere Index

```js
db.places.createIndex({ location: "2dsphere" })

// Compound with regular fields
db.places.createIndex({ location: "2dsphere", category: 1 })
```

### $near — Find Closest Points

```js
// Find restaurants within 1km of a point, sorted by distance
db.places.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [-73.9654, 40.7829]
      },
      $maxDistance: 1000,   // meters
      $minDistance: 0
    }
  },
  category: "restaurant"
})
```

### $geoWithin — Points Inside a Shape

```js
// Find all places inside a polygon
db.places.find({
  location: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.0, 40.7],
          [-73.9, 40.7],
          [-73.9, 40.8],
          [-74.0, 40.8],
          [-74.0, 40.7]
        ]]
      }
    }
  }
})

// Shorthand circle (not GeoJSON — uses radians for legacy 2d index)
// For 2dsphere, use $centerSphere:
db.places.find({
  location: {
    $geoWithin: {
      $centerSphere: [[-73.9654, 40.7829], 1/6371]  // 1km radius
    }
  }
})
```

### $geoIntersects — Geometries That Intersect

```js
// Find which neighborhood a point falls in
db.neighborhoods.find({
  boundary: {
    $geoIntersects: {
      $geometry: {
        type: "Point",
        coordinates: [-73.9654, 40.7829]
      }
    }
  }
})
```

### $nearSphere with Distance Field

```js
// Using $nearSphere and include distance in results
db.places.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-73.9654, 40.7829] },
      distanceField: "dist.calculated",
      maxDistance: 2000,
      query: { category: "restaurant" },
      includeLocs: "dist.location",
      spherical: true
    }
  }
])
```

### Compare: 2d vs 2dsphere

```
┌────────────────┬────────────────────────┬───────────────────────────┐
│ Feature        │ 2d Index               │ 2dsphere Index            │
├────────────────┼────────────────────────┼───────────────────────────┤
│ Geometry       │ Flat plane             │ Earth sphere (WGS84)      │
│ Coordinates    │ x,y pairs              │ GeoJSON [lon,lat]         │
│ Distance units │ Units (arbitrary)      │ Meters                    │
│ Accuracy       │ Distorts near poles    │ Accurate globally         │
│ Use case       │ Gaming, 2D maps        │ Real-world location data  │
│ GeoJSON        │ Not supported          │ Fully supported           │
└────────────────┴────────────────────────┴───────────────────────────┘
```

> **Memory hook:** "2dsphere is the road atlas grid, but wrapped around a globe instead of flattened onto paper — so 'nearby' means what it actually means in the real world."

---

## 6. Hashed Index

**The problem:** you're sharding a collection, and your shard key is something sequential — an auto-incrementing counter, or an ObjectId (which is itself roughly time-ordered). Every new insert has a "newest" value, so every new insert lands on the same shard. One shard becomes a bottleneck while the others sit idle — a "hotspot."

**The analogy:** imagine dealing a deck of cards by suit order instead of shuffling first — all the hearts pile up in one place. Hashing is the shuffle: it scrambles the natural order so inserts spread evenly across piles (shards), even though the underlying values were sequential.

```js
db.users.createIndex({ userId: "hashed" })
```

### How Hashing Works

```
userId: "user_12345"
         │
         ▼
Hash function (MD5-like)
         │
         ▼
Hash: 7a3f9b2c1d8e4f6a
         │
         ▼
Stored in B-tree by hash value

Result: Even distribution across shard keys
        regardless of userId's natural sort order
```

### Hashed Index Use Case: Sharding

```js
// Shard a collection using hashed shard key
sh.shardCollection("mydb.users", { userId: "hashed" })

// Without hashed: sequential _id causes "hotspot" writes
// all new inserts go to the latest shard
//
// With hashed: inserts distributed evenly across shards
```

### Hashed Index Limitations

The trade-off for that even distribution: you lose the ability to reason about order, because the hash deliberately destroys it.

```
┌──────────────────────────────────────────────────────────────┐
│ SUPPORTED with hashed index:                                 │
│   Equality queries:  find({ userId: "user_123" })            │
│   Sharding:          sh.shardCollection("col", {x:"hashed"}) │
├──────────────────────────────────────────────────────────────┤
│ NOT SUPPORTED with hashed index:                             │
│   Range queries: find({ userId: { $gt: "user_100" } })       │
│   Sorting: sort({ userId: 1 })                               │
│   Multi-key: cannot hash array fields                        │
│   Floating point: stored as integer hash (loses precision)   │
└──────────────────────────────────────────────────────────────┘
```

> **Memory hook:** "Hashing is shuffling the deck before dealing — no more hotspots, but no more 'in order' either."

---

## 7. Wildcard Index

**The problem:** your documents don't share a fixed schema — one product has `processor` and `ram`, another has `size` and `color` — and you can't predict ahead of time which field a query will filter on. Creating a separate index per possible field isn't realistic when the fields are open-ended.

**The analogy:** it's like a library that, instead of indexing books only by title and author, indexes *every word* in every book so you can search on anything, without knowing in advance what people will look for.

```js
// Index ALL fields in every document
db.products.createIndex({ "$**": 1 })

// Index all fields under a specific path
db.products.createIndex({ "attributes.$**": 1 })

// Index all fields EXCEPT certain ones
db.products.createIndex(
  { "$**": 1 },
  { wildcardProjection: { _id: 0, createdAt: 0 } }
)
```

### When to Use Wildcard Indexes

```js
// Use case: dynamic product attributes (varies by category)
{
  _id: 1,
  name: "Laptop",
  attributes: {
    processor: "Intel i7",
    ram: "16GB",
    storage: "512GB SSD"
  }
}
{
  _id: 2,
  name: "T-Shirt",
  attributes: {
    size: "M",
    color: "Blue",
    material: "Cotton"
  }
}

// A wildcard index on attributes.$** covers all these queries:
db.products.find({ "attributes.processor": "Intel i7" })
db.products.find({ "attributes.color": "Blue" })
db.products.find({ "attributes.ram": "16GB" })
```

A laptop and a t-shirt share nothing in `attributes`, yet a single wildcard index on `attributes.$**` covers queries against either one — because it doesn't index a fixed set of field names, it indexes whatever field names actually show up, per document.

### Wildcard Index Limitations

- Cannot be a shard key
- Cannot create a unique wildcard index
- Cannot guarantee index coverage for all documents simultaneously
- One wildcard index entry per field per document (not one per array element for nested arrays)
- Use compound wildcard index for combining with regular fields (MongoDB 7.0+)

```js
// MongoDB 7.0+: Compound wildcard index
db.products.createIndex({ category: 1, "attributes.$**": 1 })
```

### Common mistakes

- Reaching for a wildcard index as a default "just index everything" solution — it's meant for genuinely dynamic/unknown schemas, not as a shortcut to avoid designing proper compound indexes for a known schema. It's typically slower and larger than a purpose-built index.
- Expecting uniqueness or shard-key support — neither is possible with wildcard indexes.

**Interview answer:** "A wildcard index indexes field names dynamically instead of a fixed key pattern, which makes it useful when the document schema varies unpredictably — like per-category product attributes. It works by creating index entries for whatever fields actually appear under the wildcard path in each document, rather than requiring every document to share the same fields. The cost is that it can't back a unique constraint or a shard key, and it's generally less efficient than a targeted index built for a known, stable schema."

> **Memory hook:** "A wildcard index is a library that indexes every word in every book — flexible for anything, but never as fast as an index built for one specific book."

---

## 8. Partial Index

**The problem:** you have a huge collection where only a small slice of documents actually matters for a given query — say, 50,000 "active" users out of 10 million total. Indexing all 10 million wastes space and slows down every write, just to serve queries that only ever care about the active 0.5%.

**The analogy:** think of sticky tabs in a reference book — instead of tabbing every single page, you only tab the pages you'll actually revisit. A partial index is that: an index that only covers documents matching a filter you specify, and ignores the rest entirely.

```js
// Only index active users (huge collection, most users are inactive)
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { status: "active" } }
)

// Only index orders over $100 (most orders are small)
db.orders.createIndex(
  { customerId: 1, amount: 1 },
  { partialFilterExpression: { amount: { $gt: 100 } } }
)
```

### Internal working: how it saves space

```
Collection: 10,000,000 users
  Active users:   50,000 (0.5%)
  Inactive users: 9,950,000 (99.5%)

Normal index on email: 10,000,000 entries
Partial index (status = "active"): 50,000 entries

Space saved: 99.5%
Write overhead: only 0.5% of inserts update the index
```

### Query Must Match the Filter Expression

Here's the part that trips people up: it's not enough for a matching document to *happen* to satisfy the filter — the query itself has to explicitly include a condition that implies the filter, or MongoDB won't risk using the (incomplete) index.

```js
// Index: { email: 1 }, partialFilterExpression: { status: "active" }

// USES the partial index (query implies status = "active"):
db.users.find({ email: "a@b.com", status: "active" })     // ✓

// Does NOT use the partial index (query doesn't constrain status):
db.users.find({ email: "a@b.com" })                        // ✗ COLLSCAN
db.users.find({ email: "a@b.com", status: "inactive" })   // ✗ COLLSCAN
```

That second example is the classic gotcha: forgetting to include `status: "active"` in the query means MongoDB can't trust the partial index (it doesn't know that document's status), so it falls back to a full collection scan.

### Partial Unique Index

```js
// Enforce uniqueness only for non-null emails
db.users.createIndex(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true } }
  }
)
// Now multiple documents can have no email field,
// but no two documents can share the same non-null email
```

### Supported Operators in partialFilterExpression

```
Supported:
  $eq, $gt, $gte, $lt, $lte
  $exists
  $and
  $type

NOT supported:
  $or
  $in, $nin
  $not
  $nor
  Schema validation keywords
```

### Common mistakes

- Building a partial index but then querying without the filter condition, expecting the index to be used anyway — it won't be, and the query silently falls back to COLLSCAN.
- Assuming any operator works in `partialFilterExpression` — `$or` and `$in`, notably, do not.

> **Memory hook:** "A partial index is sticky tabs on only the pages you'll revisit — but you still have to say which page you want, or the tabs don't help you."

---

## 9. Sparse Index

**The problem:** a field is optional — most documents don't have it at all, only a handful do (say, `nickname`). A regular index still creates an entry for every document, storing `null` over and over for the ones missing the field — wasted space for information that isn't there.

**The analogy:** it's the difference between an index that lists every page of the book, including the blank ones, versus one that only lists the pages that actually have something written on them. A sparse index simply skips documents that don't have the field.

```js
db.users.createIndex(
  { nickname: 1 },
  { sparse: true }
)
```

### Internal working: sparse vs non-sparse

```
Documents:
  { _id: 1, name: "Alice", nickname: "ali" }
  { _id: 2, name: "Bob"   }                     ← no nickname
  { _id: 3, name: "Carol", nickname: "caz" }
  { _id: 4, name: "Dave"  }                     ← no nickname

Non-sparse index on nickname:
┌──────────────────────────────────┐
│  null → doc2                     │
│  null → doc4                     │
│  "ali" → doc1                    │
│  "caz" → doc3                    │
└──────────────────────────────────┘

Sparse index on nickname:
┌──────────────────────────────────┐
│  "ali" → doc1                    │
│  "caz" → doc3                    │
└──────────────────────────────────┘
  (doc2 and doc4 NOT in the index)
```

### When Sparse Indexes Cause Surprising Behaviour

Here's the trap: if documents without the field aren't in the index at all, what happens when you go looking specifically for documents *without* the field?

```js
// Query: "find all users with no nickname"
db.users.find({ nickname: { $exists: false } })

// The sparse index CANNOT be used because documents without
// the field are not in the index at all!
// MongoDB must COLLSCAN to find them.
// (hint() will actually return wrong results — MongoDB skips sparse index)
```

That's the sparse-index gotcha in one line: the index is fundamentally incomplete by design, so any query relying on "which documents are missing this field" can't be answered from it.

### Sparse + Unique for Optional Unique Fields

```js
// Allow many documents with no phone number,
// but no two documents can share the same phone number
db.users.createIndex(
  { phoneNumber: 1 },
  { unique: true, sparse: true }
)
```

**Note:** In MongoDB 3.2+, you can achieve the same result with a partial index, which gives more explicit control:

```js
db.users.createIndex(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNumber: { $exists: true } }
  }
)
```

### Common mistakes

- Assuming a sparse index can answer `$exists: false` queries — it can't, by definition; the missing-field documents were never added to the index.
- Not realizing partial indexes have mostly superseded sparse indexes in modern MongoDB, precisely because the filter is explicit instead of an implicit "field must exist" rule.

**Interview answer:** "A sparse index skips documents where the indexed field is missing or null, which keeps the index small when a field is genuinely optional. The catch is that because those documents were never added to the index, a query looking for `{ field: { $exists: false } }` can't be served by it and falls back to a collection scan. Since MongoDB 3.2, a partial index with `partialFilterExpression: { field: { $exists: true } }` gives you the same space savings with an explicit, more flexible filter, which is why it's generally preferred today."

> **Memory hook:** "A sparse index only lists pages that have writing on them — so don't ask it to find the blank ones."

---

## 10. TTL Index

**The problem:** you have documents that should self-destruct after a while — session tokens, verification codes, temporary logs — and you don't want to run a nightly cron job to clean them up manually.

**The analogy:** think of a library book with a due date stamped in it — except this library doesn't wait for you to return it late; it automatically pulls it off the shelf the moment the due date passes. That's what a TTL index does: a background thread in mongod checks TTL indexes every 60 seconds and quietly deletes anything past its expiry.

```js
// Delete sessions 30 minutes after creation
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 1800 }
)

// Delete logs after 7 days
db.logs.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 604800 }  // 7 * 24 * 60 * 60
)
```

### TTL with Specific Expiry Time

```js
// Set expireAfterSeconds to 0 and use a future date in the field
db.jobs.createIndex(
  { expireAt: 1 },
  { expireAfterSeconds: 0 }
)

// Insert a document that expires at a specific time
db.jobs.insertOne({
  jobId: "batch_001",
  data: { ... },
  expireAt: new Date("2024-12-31T23:59:59Z")  // expires at this exact time
})
```

### Internal working: the deletion flow

```
Every ~60 seconds:
┌─────────────────────────────────────────────────────────┐
│ TTL Monitor Thread wakes up                             │
│                                                         │
│  For each TTL index:                                    │
│    Scan index for entries where:                        │
│    document[fieldName] + expireAfterSeconds < now       │
│                                                         │
│    Delete matched documents in batches                  │
│    (Respects replication — deletes via oplog)           │
└─────────────────────────────────────────────────────────┘

Timeline:
  T=0:00  Document inserted, createdAt = now
  T=0:30  expireAfterSeconds = 1800 → not expired yet
  T=0:31  Background thread runs, no deletion
  ...
  T=0:30  createdAt + 1800s = exactly now → eligible
  T=0:31  Background thread runs → document DELETED
  T=0:32  Document gone (up to 60s delay after expiry)
```

Notice the last few lines: expiry isn't instant. It's "eligible now, deleted on the next sweep" — worth remembering if your tests expect exact-second precision.

### TTL Constraints

```
┌──────────────────────────────────────────────────────────────────┐
│ TTL Requirements:                                                │
│   Field must be BSON Date (or array of Dates)                   │
│   Single field index only (not compound)                        │
│   Cannot be _id (which is already immutable with creation time) │
│   Field value must be in the document (not sparse)              │
├──────────────────────────────────────────────────────────────────┤
│ TTL Behaviour:                                                   │
│   Deletion is NOT instantaneous (up to 60s delay)               │
│   On replica sets: TTL thread runs only on primary              │
│     Deletions propagate to secondaries via oplog                │
│   In sharded clusters: mongos doesn't run TTL;                  │
│     each shard's primary runs its own TTL thread                │
│   Cannot modify expireAfterSeconds without collMod              │
└──────────────────────────────────────────────────────────────────┘
```

### Modifying TTL Index

```js
// Change expireAfterSeconds without dropping the index
db.runCommand({
  collMod: "sessions",
  index: {
    name: "createdAt_1",
    expireAfterSeconds: 3600  // change to 1 hour
  }
})
```

> **Memory hook:** "A TTL index is a library book with a due date — except this library pulls it off the shelf itself, no overdue notices required."

---

## 11. Unique Index

**The problem:** you need a hard guarantee — no two users share an email, no two enrollments duplicate the same student+course pair. An application-level check ("look up first, insert if not found") isn't safe under concurrent writes; two requests can race past the check at the same instant.

**The analogy:** it's like a coat-check counter that refuses to hand out the same ticket number twice — the constraint is enforced at the point of storage, not by trusting whoever's asking.

```js
// Single field unique
db.users.createIndex({ email: 1 }, { unique: true })

// Compound unique (combination must be unique)
db.enrollments.createIndex(
  { studentId: 1, courseId: 1 },
  { unique: true }
)
// → Two students can have the same courseId
// → One student can have multiple courseIds
// → But no student+course combination can repeat
```

### Unique Index and Null Values

Here's the part people don't expect: `unique` treats a missing field the same as an explicit `null` — which means only *one* document total can omit the field before you start hitting duplicate-key errors.

```js
// Standard behaviour: null counts as a value
// Only ONE document can have a null/missing email
db.users.createIndex({ email: 1 }, { unique: true })
db.users.insertOne({ name: "Alice" })  // email = null → OK
db.users.insertOne({ name: "Bob" })    // email = null → E11000 DUPLICATE!

// Solution: sparse unique index
db.users.createIndex({ email: 1 }, { unique: true, sparse: true })
db.users.insertOne({ name: "Alice" })  // not in index → OK
db.users.insertOne({ name: "Bob" })    // not in index → OK
db.users.insertOne({ name: "Carol", email: "c@c.com" })  // → OK
db.users.insertOne({ name: "Dave", email: "c@c.com" })   // → E11000!
```

### Creating Unique Index on Existing Data

```js
// This fails if duplicates already exist:
db.users.createIndex({ email: 1 }, { unique: true })
// MongoServerError: E11000 duplicate key error

// Find duplicates first:
db.users.aggregate([
  { $group: { _id: "$email", count: { $sum: 1 }, ids: { $push: "$_id" } } },
  { $match: { count: { $gt: 1 } } }
])

// Remove duplicates, then create the index
```

> **Memory hook:** "A unique index is a coat-check counter that refuses to hand out the same ticket twice — and it treats 'no ticket' as a ticket too, unless you pair it with sparse."

---

## 12. Full Comparison Table

Eleven index types, one cheat sheet:

```
┌────────────────┬──────────────┬────────────────────┬──────────────────────┬─────────────────────────┐
│ Index Type     │ Syntax       │ Use Case           │ Limitations          │ Key Feature             │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Single Field   │ {field:1}    │ Simple equality,   │ Only one field       │ Foundation for all      │
│                │              │ range, sort        │                      │ other types             │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Compound       │ {a:1, b:1}   │ Multi-field queries│ Prefix rule must be  │ ESR rule for field      │
│                │              │ and sorts          │ respected            │ ordering                │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Multikey       │ {arrayField: │ Array field        │ Only one array field │ Auto-created when       │
│                │ 1}           │ queries            │ per compound idx     │ indexing array values   │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Text           │ {field:      │ Full-text search   │ 1 per collection;    │ Stemming, weights,      │
│                │ "text"}      │                    │ no prefix match      │ stop words              │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Geospatial     │ {field:      │ Location-based     │ GeoJSON format;      │ $near, $geoWithin,      │
│ 2dsphere       │ "2dsphere"}  │ queries            │ spherical geometry   │ $geoIntersects          │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Hashed         │ {field:      │ Sharding even      │ No range queries;    │ Even distribution       │
│                │ "hashed"}    │ distribution       │ no sort support      │ across shards           │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Wildcard       │ {"$**": 1}   │ Dynamic schemas    │ Cannot be shard key; │ Indexes all fields      │
│                │              │                    │ no uniqueness        │ automatically           │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Partial        │ partialFilter│ Subset of docs     │ Query must match     │ Small index size;       │
│                │ Expression   │                    │ filter expression    │ partial uniqueness      │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Sparse         │ {sparse:true}│ Optional fields    │ Can't find docs      │ Skips null/missing      │
│                │              │                    │ missing the field    │ field docs              │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ TTL            │ expireAfter  │ Automatic document │ Single field; Date   │ ~60s background         │
│                │ Seconds      │ expiration         │ type only            │ deletion                │
├────────────────┼──────────────┼────────────────────┼──────────────────────┼─────────────────────────┤
│ Unique         │ {unique:true}│ Enforce data       │ Null = value (use    │ E11000 on duplicates    │
│                │              │ integrity          │ sparse for nullable) │                         │
└────────────────┴──────────────┴────────────────────┴──────────────────────┴─────────────────────────┘
```

---

## 13. Hands-On Exercises

### Exercise 1: Compound Index Prefix Rule Experiment

1. Insert 50,000 documents into `employees` with fields: `department`, `salary`, `level`, `name`.
2. Create compound index: `{ department: 1, salary: 1, level: 1 }`.
3. Test these queries with `.explain("queryPlanner")` and note which uses IXSCAN:
   - `find({ department: "Engineering" })`
   - `find({ department: "Engineering", salary: { $gte: 80000 } })`
   - `find({ salary: { $gte: 80000 } })`
   - `find({ level: 3 })`
4. Which queries used the index? Explain why based on the prefix rule.
5. Drop the index and create two separate single-field indexes on `department` and `salary`. Re-test. What changed?

### Exercise 2: Text Index Full-Text Search

1. Create a collection `articles` with 20 documents containing `title`, `body`, `author` fields.
2. Create a text index with weights: `title: 10, body: 1`.
3. Run `$text: { $search: "mongodb performance" }` and include the textScore.
4. Run a phrase search: `$text: { $search: "\"query planner\"" }`.
5. Run a negation: find documents about databases but not about MySQL.
6. Sort by `{ score: { $meta: "textScore" } }` — does the ordering make sense?

### Exercise 3: Geospatial — Find Nearest Locations

1. Create a `restaurants` collection with 100 documents, each with a `location` GeoJSON Point.
2. Create a 2dsphere index on `location`.
3. Use `$near` to find the 5 closest restaurants to coordinates `[-73.9654, 40.7829]`.
4. Use `$geoWithin` with a `$centerSphere` of 2km radius — how many restaurants are inside?
5. Use the `$geoNear` aggregation stage to get distances in the result documents.

### Exercise 4: TTL Index with Dynamic Expiry

1. Create a `notifications` collection.
2. Create a TTL index with `expireAfterSeconds: 0` on an `expireAt` field.
3. Insert 10 notifications: 5 with `expireAt` set to 1 minute ago, 5 with `expireAt` 1 hour from now.
4. Wait up to 2 minutes (TTL thread runs every ~60s) and check which documents remain.
5. Use `db.runCommand({ collMod: ... })` to change the expiry to 3600 seconds. Verify the change.

### Exercise 5: Partial Index for Active Records

1. Create a `listings` collection with 100,000 documents. Set 5% as `status: "active"`.
2. Create a partial index: `{ price: 1 }` with `partialFilterExpression: { status: "active" }`.
3. Compare `db.listings.stats().indexSizes` — how much smaller is the partial index vs a full index on price?
4. Query `find({ price: { $lt: 500 }, status: "active" })` and verify IXSCAN is used.
5. Query `find({ price: { $lt: 500 } })` — is the partial index used? Why not?

---

## 14. Interview Q&A

**Q1: Can you have more than one text index on a collection?**

A: No. MongoDB allows only one text index per collection. The text index can cover multiple fields (which is the recommended approach). If you need full-text search across many fields, create a single multi-field text index with appropriate weights.

---

**Q2: What is a multikey index and what is its main restriction?**

A: A multikey index is automatically created when you index a field containing an array value. MongoDB creates one index entry per array element. The main restriction is that in a compound index, only one of the indexed fields can be an array per document. This prevents the "parallel arrays" error which would cause a combinatorial explosion of index entries.

---

**Q3: How does a TTL index handle documents where the date field contains an array?**

A: If the TTL field contains an array of Date values, MongoDB uses the lowest (earliest) date in the array as the expiry time. The document expires when `min(array) + expireAfterSeconds < now`.

---

**Q4: What is the difference between a sparse index and a partial index?**

A: A sparse index skips documents where the indexed field is missing or null — it's a special case filter. A partial index is more general: it skips any documents that don't match an arbitrary filter expression (`partialFilterExpression`). Partial indexes subsume sparse indexes in capability. In modern MongoDB (3.2+), partial indexes with `{ field: { $exists: true } }` are preferred over sparse indexes because the filtering logic is explicit.

---

**Q5: Why is the order of fields in a compound index critical?**

A: The B-tree structure means that the compound index is sorted first by the first field, then by the second within each first-field value, etc. The "prefix rule" means only queries that filter on the leftmost fields can use the index. Additionally, for sort operations, the field order and sort direction in the index must match the query's sort specification (or its exact reverse) to avoid an in-memory SORT stage.

---

**Q6: When would you use a hashed index instead of a regular ascending index for sharding?**

A: Use a hashed shard key when the natural field values create "hotspots" — e.g., an auto-incrementing ID or ObjectId where all recent inserts go to the same chunk. Hashing randomises the distribution so writes spread evenly across shards. The trade-off: range queries on the shard key can no longer be routed to a single shard — they become scatter-gather queries hitting all shards.

---

**Q7: What happens to a TTL index on a secondary node in a replica set?**

A: The TTL background thread only runs on the primary. Secondaries replicate the DELETE operations from the primary's oplog. This ensures consistency — documents are not deleted at slightly different times on different members. If a secondary is promoted to primary, it will start running the TTL thread.

---

**Q8: Can a wildcard index enforce uniqueness?**

A: No. Unique wildcard indexes are not supported. A wildcard index indexes all fields, but uniqueness constraints require knowing exactly which field(s) to check — the wildcard approach would need to check every field for every document, which is semantically undefined.

---

**Q9: How does the 2dsphere index differ from the legacy 2d index?**

A: The 2dsphere index uses spherical geometry (treating Earth as a sphere), supports GeoJSON objects (Points, Polygons, LineStrings, MultiPolygons, etc.), and calculates accurate distances in meters. The legacy 2d index uses flat Euclidean geometry with coordinate pairs, which distorts distances near the poles. For real-world location data, always use 2dsphere.

---

**Q10: How would you find which indexes in a collection are never being used?**

A: Use the `$indexStats` aggregation stage. Query for indexes where `accesses.ops` is 0 (or very low) since the last reset. Be careful: (1) stats reset after mongod restart, so give it time to accumulate data; (2) an index might be used rarely but still essential for a critical path; (3) check against traffic patterns — some indexes only matter during batch jobs.

```js
db.collection.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": 0 } }
])
```
