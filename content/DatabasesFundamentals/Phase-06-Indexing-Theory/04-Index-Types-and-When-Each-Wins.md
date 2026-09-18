# Index Types and When Each Wins — Complete Guide

> "Looking up a word in a dictionary, finding a street on a city map, and tracing every mention of a name across a decade of newspapers are three different searches, and no single filing cabinet is good at all three."

---

## Table of Contents

1. [The Problem: One Index Shape for Every Question Shape](#1-the-problem-one-index-shape-for-every-question-shape)
2. [The Dictionary Map and Archive Analogy](#2-the-dictionary-map-and-archive-analogy)
3. [The Mechanism: What Each Structure Actually Stores](#3-the-mechanism-what-each-structure-actually-stores)
4. [Code Walkthrough: Declaring and Querying Each Type](#4-code-walkthrough-declaring-and-querying-each-type)
5. [Comparing B-Tree to the Specialised Types](#5-comparing-b-tree-to-the-specialised-types)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: One Index Shape for Every Question Shape

`CREATE INDEX` without qualification builds a B-tree, and for most queries that is the right answer. Some question shapes, though, are ones a sorted structure simply cannot answer efficiently no matter how the columns are ordered.

### Four Questions One Structure Cannot Serve

```text
articles — 12,000,000 rows, B-tree indexes on every column
"which articles mention 'refinancing' anywhere in the body?"
  ↳ a leading wildcard, so sorted order gives no starting point
"which shops are within 2 km of this point?" ↳ two dimensions;
  a B-tree can only sort by one of them at a time
"how many rows have status='open' AND priority='high' AND
   region='EMEA'?" — three low-cardinality columns
  ↳ each index alone returns millions of rows to intersect
"give me the 40 GB append-only log rows from last Tuesday"
  ↳ a B-tree over 40 GB of timestamps is itself gigabytes
```

### What's Missing

Each of these is a different *shape* of question — substring, proximity, set intersection, block range — and each has a data structure built for it. What's missing is a map from question shape to structure, and an honest account of what each specialised structure gives up in exchange.

---

## 2. The Dictionary Map and Archive Analogy

A dictionary is alphabetical, so it answers "what does 'refinance' mean" instantly and "which words end in -ing" not at all. A city map answers "what is near this corner" but has no alphabetical order. A newspaper archive's name index answers "everywhere this person appears", which neither of the others can. Three filing systems, three question shapes.

### Three Filing Systems

```text
Dictionary  → one fixed order; brilliant at prefix and range,
              useless for anything that skips the beginning
City map    → organised by two dimensions at once; answers
              nearness, has no first-to-last order
Name index  → one entry per name listing every page it appears on
```

### Mapping the Analogy to Index Types

The dictionary is a B-tree, the map is a spatial index, and the archive's name index is an inverted index. Choosing between them is not a matter of one being better built — it is a matter of which question shape you are actually asking most often.

---

## 3. The Mechanism: What Each Structure Actually Stores

Every index type is the same trade in a different currency: an arrangement of keys that makes one class of question cheap and the rest expensive.

### B-Tree and Hash

```text
B-tree (Phase 5, Lesson 2) — entries kept in sorted order
  equality seek to the key / range seek to one end and walk /
  prefix 'ana%' is a range over the sort order / ORDER BY is free
  ↳ The default for a reason: one structure, four capabilities.
Hash — key put through a hash function to pick a bucket
  equality  compute the bucket, read it            O(1)
  range     hashing destroys order entirely        no
  prefix    'ana%' hashes nowhere near 'ana'       no
  ORDER BY  no order to exploit                    no
  ↳ Wins only on a large index where the B-tree descent costs
    several page reads and every query is exact-match.
```
### Bitmap and Inverted

```text
Bitmap — one bit-vector per distinct value, one bit per row
  status='open'  1 0 0 1 1 0 1 0 ...
  region='EMEA'  1 1 0 1 0 0 0 0 ...
  AND            1 0 0 1 0 0 0 0 ← a bitwise AND, one CPU pass
  ↳ Five predicates is five vectors and four bitwise operations,
    not five index scans and a row-by-row merge. Cost scales with
    distinct values, so it suits tens of values, not millions.
    Updating one row touches a vector covering many rows — hence
    read-mostly analytics, not OLTP.
Inverted — one entry per term, each holding a list of row ids
  'refinancing' → [ 41, 907, 1288, 90211, ... ]
  'mortgage'    → [ 41, 55, 1288, ... ]
  ↳ Built by tokenising the text once at write time. "Both terms"
    is an intersection of two sorted lists; the same structure
    also indexes array elements and document keys.
```
### Spatial and Block-Range

```text
Spatial — two or more dimensions with no natural single order
  R-tree   nested bounding rectangles; descend only into boxes
           that overlap the query window
  geohash  interleave the bits of latitude and longitude into one
           value, so nearby points get keys an ordinary B-tree can
           index
  ↳ Both answer "within this box" and "nearest to this point",
    neither a meaningful ORDER BY on a coordinate.
Block-range (BRIN-style) — min and max per range of pages
  pages 0-127    occurred_at 2026-01-01 .. 2026-01-03
  pages 128-255  occurred_at 2026-01-03 .. 2026-01-05
  ↳ One entry per 128 pages, not per row, so an index over 40 GB
    can be a few hundred kilobytes; scanning means skipping every
    block range whose min/max cannot match. Requires physical
    order to correlate with the value: near-free on a time-ordered
    log, worthless on a randomly-ordered column.
```

---

## 4. Code Walkthrough: Declaring and Querying Each Type

Index type syntax is not part of the SQL standard, so every statement below is illustrative: engines differ on spelling and several do not offer some of these types at all.

### Declaring Each Type

```sql
-- Illustrative only. Standard SQL defines no index-type syntax.
CREATE INDEX idx_orders_placed ON orders (placed_at);
--   ↳ unqualified CREATE INDEX means B-tree in every major engine
CREATE INDEX idx_sessions_token ON sessions (token) USING HASH;
--   ↳ exact-match lookups on an opaque 64-char token only
CREATE BITMAP INDEX idx_tickets_status ON tickets (status);
--   ↳ warehouse-style syntax; low-cardinality, read-mostly
CREATE INDEX idx_articles_body ON articles USING GIN (body_tokens);
--   ↳ inverted index over pre-tokenised text
CREATE INDEX idx_shops_location ON shops USING GIST (location);
--   ↳ R-tree-style spatial index over a geometry column
CREATE INDEX idx_events_time ON events USING BRIN (occurred_at);
--   ↳ block-range summary, assuming rows land in time order
```

### What Each One Answers

```sql
-- B-tree: equality, range, prefix, and a free ORDER BY
SELECT * FROM orders WHERE placed_at >= DATE '2026-03-01'
ORDER BY placed_at LIMIT 20;
-- Hash: this works; change '=' to '>' and the index is unusable
SELECT user_id FROM sessions WHERE token = 'a3f9...';
-- Bitmap: three low-cardinality predicates combined bitwise
SELECT count(*) FROM tickets WHERE status = 'open'
  AND priority = 'high' AND region = 'EMEA';
-- Inverted: term lookup, not a substring scan
SELECT id FROM articles WHERE body_tokens @@ to_tsquery('refinancing');
-- Spatial: a window, then a true distance test on the survivors
SELECT id FROM shops WHERE ST_DWithin(location, :point, 2000);
-- Block-range: a wide slice of a naturally ordered table
SELECT count(*) FROM events
WHERE occurred_at >= TIMESTAMP '2026-03-03 00:00:00'
  AND occurred_at <  TIMESTAMP '2026-03-04 00:00:00';
```

---

## 5. Comparing B-Tree to the Specialised Types

The B-tree is the generalist; each specialised type buys one capability the B-tree lacks and sells something the B-tree has.

### B-Tree vs the Specialised Types

| | Equality | Range and sort | Size relative to data | Write cost | Best fit |
|---|---|---|---|---|---|
| B-tree | Yes, one descent | Yes | Roughly 10-25% per indexed column | Moderate, one descent per write | The default for almost everything |
| Hash | Yes, O(1) | No | Similar to B-tree | Similar to B-tree | Exact match on a long opaque key |
| Bitmap | Yes, per value | No | Very small on low cardinality | Poor under concurrent writes | Analytic filters combined with AND and OR |
| Inverted | Per term | No | Can exceed the source text | High — one posting per term per row | Full-text, arrays, document keys |
| Spatial | Not usefully | Not on a coordinate | Comparable to B-tree | Comparable to B-tree | Containment and nearest-neighbour |
| Block-range | No | Coarse only | Kilobytes for gigabytes | Nearly free | Huge tables already ordered by the column |
### Choosing From the Query Shape

```text
Start from the predicate, not the column:
  column = value, BETWEEN, ORDER BY, prefix LIKE 'ana%'
    → B-tree. Stop here; this covers most workloads.
  only ever column = value, wide opaque key, never sorted
    → hash, once measurement shows the descent is the bottleneck
  several low-cardinality equality predicates ANDed or ORed, on a
  table written in bulk and read constantly       → bitmap
  "contains this word" / "has this tag" / "has this JSON key"
                                                  → inverted
  "within this polygon" / "nearest to this point" → spatial:
    R-tree, or geohash keys on an ordinary B-tree
  a range over a huge append-only table whose physical order
  already tracks the column → block-range, keeping a B-tree only
    if pinpoint single-row lookups are also needed.
```

### Takeaway

Reach for a B-tree by default and justify anything else with a query shape it genuinely cannot serve. The specialised types are not upgrades; each one is a trade, and the thing being traded away — ordering for hash, write concurrency for bitmap, per-row precision for block-range — is usually something you were quietly relying on.

---

## 6. Common Mistakes

- **Building a hash index on a column that is also used in ranges or sorts.** Hashing destroys order completely, so `WHERE token > 'a'` and `ORDER BY token` get nothing from it. Unless every query on that column is exact-match, a B-tree serves the same equality lookups and the rest as well.
- **Putting a bitmap index on a high-traffic transactional table.** A single row's update touches a bit-vector that covers many rows, so concurrent writers serialise against each other. Bitmap indexes belong on tables loaded in bulk and read constantly, not on a live order queue.
- **Expecting an inverted index to answer arbitrary substring queries.** It indexes terms produced by a tokeniser, so it answers "contains the word 'refinancing'", not "contains the characters `finan` anywhere". Mid-word substring matching needs a different structure such as an n-gram index.
- **Creating a block-range index on a column with no physical correlation.** If rows arrive in random order, every block range's min and max span the whole domain and no block can ever be skipped — the index is read on every query and eliminates nothing. Verify the correlation before assuming the space saving is free.

---

## 7. Hands-On Exercises

**Exercise 1:** Create a `sessions` table with five million rows and a 64-character random `token`. Build a B-tree index on `token`, measure an exact-match lookup, then build a hash index on the same column and compare. Note whether the difference justifies losing range and sort support.

**Exercise 2:** Reproduce the hash mistake from Section 6 deliberately. With only the hash index present, run `SELECT * FROM sessions WHERE token > 'a' LIMIT 10` and confirm from the plan that the index is not used at all.

**Exercise 3:** Load a `tickets` table with ten million rows and three low-cardinality columns. Run the three-predicate `count(*)` from Section 4 with B-tree indexes on each column, then again with bitmap-style indexing if your engine supports it, and compare rows examined.

**Exercise 4:** Build an inverted full-text index over an `articles.body` column of at least 100,000 documents. Compare the timing of a term search against `WHERE body LIKE '%refinancing%'` on the same data, and record the index's size relative to the text itself.

**Exercise 5:** Create an `events` table of 20 million rows inserted in `occurred_at` order and build a block-range index on that column. Record its size and the timing of a one-day range query, then rebuild the table with rows in random order, recreate the same index, and confirm the query gets no benefit.

---

## 8. Interview Q&A

**Q: Why is a B-tree the default index type?**
Because it handles four different access patterns with one structure: equality lookups, range scans, prefix matches, and ordered retrieval that satisfies `ORDER BY` and makes `LIMIT` genuinely cheap. Every other index type is better at exactly one of those things and worse or useless at the rest, so the B-tree is the right default and anything else needs a specific justification.

**Q: When would a hash index actually beat a B-tree?**
Only when every query on the column is an exact-match equality, the key is wide and opaque so nothing about ordering is meaningful, and the index is large enough that a B-tree descent costs several page reads while a hash lookup costs about one. Even then the gain is modest, and the moment anyone adds a range predicate or an `ORDER BY` on that column the hash index contributes nothing.

**Q: What makes bitmap indexes fast, and why are they a poor fit for OLTP?**
Each distinct value gets a bit-vector with one bit per row, so combining several predicates is a handful of bitwise AND and OR operations over compact vectors rather than several index scans and a merge. The problem is writes: changing one row's value modifies a vector that represents many rows, so concurrent writers contend heavily. That is why bitmap indexes live in data warehouses with bulk loads, not on transactional tables.

**Q: How does an inverted index differ from a B-tree on a text column?**
A B-tree sorts whole column values, so it can answer a prefix match like `LIKE 'ana%'` but nothing that starts mid-value. An inverted index tokenises the text at write time and stores one entry per term pointing to the list of rows containing it, so "contains this word" becomes a single lookup and "contains both words" becomes an intersection of two sorted lists. The trade is a larger, more expensive-to-maintain structure, and it still answers terms rather than arbitrary substrings.

**Q: What is a block-range index and what does it assume?**
Instead of one entry per row it stores a summary — typically the minimum and maximum value — for each range of pages, so an index over gigabytes can be kilobytes. A query skips any block range whose min and max cannot contain the value it wants. It assumes the physical order of rows correlates with the indexed column, which holds for an append-only table indexed by insertion time and fails completely on a randomly-ordered column, where no block can ever be excluded.
