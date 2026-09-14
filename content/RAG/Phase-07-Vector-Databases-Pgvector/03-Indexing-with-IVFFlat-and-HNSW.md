# 03 — Indexing with IVFFlat and HNSW

> How pgvector keeps similarity search fast on large tables using approximate nearest-neighbor indexes, and how to choose between IVFFlat and HNSW.

---

## Table of Contents

1. [The Problem: Exact Search Doesn't Scale](#1-the-problem-exact-search-doesnt-scale)
2. [The Analogy: A Book's Index Page vs Flipping Through Every Page](#2-the-analogy-a-books-index-page-vs-flipping-through-every-page)
3. [How IVFFlat and HNSW Work Internally](#3-how-ivfflat-and-hnsw-work-internally)
4. [Code Example: Creating an HNSW or IVFFlat Index](#4-code-example-creating-an-hnsw-or-ivfflat-index)
5. [IVFFlat vs HNSW](#5-ivfflat-vs-hnsw)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Exact Search Doesn't Scale

Lesson 1 mentioned this in passing: without an index, `SELECT ... ORDER BY embedding <-> query LIMIT 5` is an *exact* nearest-neighbor search — Postgres computes the distance between the query vector and literally every row in the table, then sorts all of them and keeps the top 5. On a table with a few thousand rows, this is fast enough that you'd never notice. On a table with a million rows, computing a million distance calculations for every single query becomes far too slow for anything resembling an interactive application — a search feature that takes several seconds per query is not a usable search feature.

The fix, as with any large dataset, is an index. But a vector index can't work the way a normal B-tree index does (which is built for exact matches and range comparisons on ordinary scalar values like numbers or dates) — "nearest neighbor in high-dimensional space" is a fundamentally different kind of query. pgvector provides two index types built specifically for this: **IVFFlat** and **HNSW**. Both trade a small amount of *accuracy* (they're approximate, not exact, nearest-neighbor search) for a very large amount of *speed* — and understanding that trade-off, at a conceptual level, is the goal of this lesson.

---

## 2. The Analogy: A Book's Index Page vs Flipping Through Every Page

**Real-world analogy:** if you want to find every mention of "photosynthesis" in a 900-page textbook, you have two options. You could flip through all 900 pages one at a time, reading each one to check if it's relevant — that's guaranteed to find every mention, but it's painfully slow. Or you could flip to the index at the back of the book, look up "photosynthesis," and jump directly to the handful of pages it lists — much faster, at the cost of trusting that the index itself was built correctly and completely.

An unindexed vector search is "flip through every page." An IVFFlat or HNSW index is "use the book's index page" — both let you skip straight to the small number of *likely* relevant pages (rows) instead of reading (computing distance against) every single one. The trade-off mirrors real book indexes too: a book's index isn't guaranteed to be 100% exhaustive (an obscure passing mention might not get indexed), just as IVFFlat and HNSW don't guarantee finding the mathematically exact nearest neighbors every time — they find an excellent approximation, almost always the same answer as exact search, in a fraction of the time.

---

## 3. How IVFFlat and HNSW Work Internally

Both index types solve the same problem — avoid comparing the query against every row — but structure the shortcut differently. This is a conceptual description, not a full algorithmic derivation.

**IVFFlat (Inverted File with Flat compression):** During index build, IVFFlat groups all the existing vectors into a fixed number of clusters (specified as the `lists` parameter), each with a representative center point. At query time, instead of comparing the query vector against every row, Postgres first figures out which cluster centers are closest to the query vector, then only computes exact distances against the rows *inside* those nearby clusters — skipping every row that falls in a cluster the query clearly isn't near. Because the clustering step is learned from the data present when the index is built, IVFFlat generally needs a meaningful amount of data already inserted *before* building the index — build it on an empty or near-empty table and the clusters it forms won't meaningfully reflect the actual distribution of your data once it's fully loaded.

**HNSW (Hierarchical Navigable Small World):** HNSW builds a multi-layered graph structure where each vector is a node, connected to a handful of its nearby neighbors, with sparser, longer-range connections at higher layers. A query starts at the top (sparse) layer, quickly navigates toward the region of the graph closest to the query vector, then drops down through progressively denser layers, refining the search each time — roughly like taking a highway to get near your destination, then local streets to get to the exact address. Unlike IVFFlat, HNSW builds and refines this graph structure incrementally as data is inserted, rather than needing a batch of representative data upfront to form meaningful clusters.

---

## 4. Code Example: Creating an HNSW or IVFFlat Index

Creating an HNSW index for L2 (Euclidean) distance search — note that the operator class (`vector_l2_ops`) must match the distance operator you actually use in your queries' `ORDER BY` clause (`<->` for L2):

```sql
CREATE INDEX ON documents USING hnsw (embedding vector_l2_ops);
```

If your queries instead rank by cosine distance (`<=>`), the index must be built with the matching operator class, `vector_cosine_ops`, instead — an index built with the wrong operator class won't be used for a query using a different distance operator:

```sql
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
```

IVFFlat is the alternative, and requires specifying the `lists` parameter — the number of clusters to partition the data into. As a rough starting point, a commonly cited guideline is to set `lists` to roughly the square root of the number of rows, then tune from there based on measured recall and speed:

```sql
CREATE INDEX ON documents USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
```

As with HNSW, the operator class inside the parentheses (`vector_l2_ops`, `vector_cosine_ops`, or `vector_ip_ops` for inner product) must match whichever distance operator (`<->`, `<=>`, or `<#>`) your queries actually use.

---

## 5. IVFFlat vs HNSW

| Dimension | IVFFlat | HNSW |
|---|---|---|
| Build time | Generally faster to build | Generally slower to build, especially on large datasets |
| Query speed | Fast, but typically slower than HNSW at comparable accuracy | Generally faster query times, especially at high accuracy targets |
| Memory use | Lower memory footprint | Higher memory footprint (graph structure with multiple layers of connections) |
| Data required before building | Needs a meaningful amount of representative data already present for clustering to be effective | Builds and refines incrementally; doesn't have the same "needs data first" requirement |
| When to pick it | Faster to build, lower memory, acceptable if you can tolerate a bit less query speed or accuracy, or need to rebuild often | The common default recommendation for read-heavy workloads where query speed matters most and the build-time/memory cost is acceptable |

Neither is universally "better" — IVFFlat trades some query speed for a cheaper, lower-memory index; HNSW trades build time and memory for faster queries. Many teams default to HNSW for typical RAG-style read-heavy workloads and reach for IVFFlat when index build cost or memory footprint becomes the binding constraint.

---

## 6. Common Mistakes

**Mistake 1: Building an IVFFlat index before you have enough data for its clustering to be meaningful.** Because IVFFlat's clusters are learned from whatever data exists at build time, building the index on an empty table (or one with only a handful of rows) produces clusters that don't represent the eventual full dataset — and unlike some other database structures, IVFFlat doesn't automatically re-cluster itself as more data streams in afterward. The practical fix is to load a representative amount of data first, then build the index, and be prepared to rebuild it later if the data distribution changes substantially.

**Mistake 2: Not rebuilding indexes after major data changes.** Both index types are built against a snapshot of the data's distribution (IVFFlat especially so, since its clusters are literally derived from the data present at build time). If a table's content changes substantially over time — a huge influx of a new category of documents, for instance — the existing index may no longer reflect the data well, and search quality (recall) can degrade quietly, without throwing any error. Periodically rebuilding indexes (`REINDEX` or dropping and recreating) after major data shifts keeps the approximate search actually accurate.

**Interview angle:** "When would you pick IVFFlat over HNSW, or vice versa?" is a common way interviewers check whether a candidate understands these as an engineering trade-off rather than a memorized "HNSW is always better" rule. The strongest answers name the actual axes — build time, memory, query speed, and whether representative data exists before index build — rather than picking one index type as a blanket default without justification.

---

## 7. Hands-On Exercises

### Exercise 1 — Match the operator class to the query

You have a table with an `embedding` column, and all your application's queries rank results using `ORDER BY embedding <=> query_embedding`. Write the `CREATE INDEX` statement for an HNSW index that will actually be used by these queries, and explain why a `vector_l2_ops` index would not be used by them.

### Exercise 2 — Choose an index type

For each scenario, state whether you'd lean toward IVFFlat or HNSW, and why:
1. A table that's freshly created and will be loaded gradually, a few rows at a time, over the coming weeks, with search quality needed from day one.
2. A read-heavy production search feature over a large, fairly stable dataset, where query latency is the top priority and the team has memory headroom.
3. A memory-constrained environment where index build time needs to stay low and slightly slower queries are acceptable.

### Exercise 3 — Diagnose degraded search quality

A team built an IVFFlat index on their `documents` table when it had 10,000 rows. Eighteen months later, the table has 5 million rows, and users are complaining that search results feel noticeably less relevant than before, even though the query code hasn't changed. Explain what's likely happening and what action would fix it.

---

## 8. Interview Q&A

### Q1. Why can't you just use a normal B-tree index for vector similarity search?

**Answer:** A B-tree index is built for exact-match and range queries on ordinary scalar values, like finding rows where a number falls within a range or a date equals a value. Nearest-neighbor search in high-dimensional vector space is a fundamentally different problem — there's no natural ordering to build a B-tree on. pgvector instead provides IVFFlat and HNSW, index types purpose-built for approximate nearest-neighbor search over vectors.

---

### Q2. At a conceptual level, how does IVFFlat speed up vector search?

**Answer:** IVFFlat clusters the existing vectors into a fixed number of groups (the `lists` parameter) during index build, each with a representative center. At query time, it first identifies which cluster centers are closest to the query vector, then only computes exact distances against rows inside those nearby clusters, instead of every row in the table — trading a small amount of accuracy for a large reduction in the number of distance calculations performed.

---

### Q3. At a conceptual level, how does HNSW speed up vector search?

**Answer:** HNSW builds a multi-layered graph where vectors are connected to their nearby neighbors, with sparser long-range connections at higher layers. A query starts navigating from the sparse top layer toward the region closest to the query vector, then descends through progressively denser layers to refine the result — similar to taking a highway toward a destination before switching to local streets — avoiding the need to compare against every vector in the table.

---

### Q4. Why does the operator class in `CREATE INDEX ... USING hnsw (embedding vector_l2_ops)` matter?

**Answer:** The operator class tells the index which distance metric it's built to accelerate — `vector_l2_ops` for `<->` (Euclidean/L2), `vector_cosine_ops` for `<=>` (cosine), and `vector_ip_ops` for `<#>` (negative inner product). If a query orders by a distance operator that doesn't match the index's operator class, that index won't be used to accelerate the query, even though the vector column is indexed.

---

### Q5. Why might building an IVFFlat index too early hurt search quality?

**Answer:** IVFFlat's clusters are derived directly from whatever data exists in the table at the moment the index is built. If that's built on an empty or very small table, the resulting clusters won't represent the eventual full dataset's actual distribution, and the index won't group rows in a way that makes approximate search accurate once real data volume arrives — the fix is to load a representative amount of data first, and to rebuild the index later if the data changes substantially.

---

> 🧠 **Memory hook:** "Don't flip through every page of the book — but make sure the index page was written after the book was actually full of chapters."
