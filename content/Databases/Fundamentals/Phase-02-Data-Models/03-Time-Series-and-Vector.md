# Time-Series and Vector Models — Complete Guide

> "Nobody ever goes back to edit yesterday's hourly reading on a hospital chart, and nobody asks a librarian for 'a book like this one' by its title — she walks to the shelf where it would sit."

---

## Table of Contents

1. [The Problem: Two Workloads That Break Ordinary Indexes](#1-the-problem-two-workloads-that-break-ordinary-indexes)
2. [The Hospital Chart and the Library Shelf Analogy](#2-the-hospital-chart-and-the-library-shelf-analogy)
3. [The Mechanism: Append-Only Chunks, Embeddings, and Distance](#3-the-mechanism-append-only-chunks-embeddings-and-distance)
4. [Diagram: How an HNSW Graph Skips Most of the Data](#4-diagram-how-an-hnsw-graph-skips-most-of-the-data)
5. [Code Walkthrough: Rollups, Retention, and a Similarity Query](#5-code-walkthrough-rollups-retention-and-a-similarity-query)
6. [Comparing Exact Search to Approximate Nearest Neighbour](#6-comparing-exact-search-to-approximate-nearest-neighbour)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Two Workloads That Break Ordinary Indexes

The same online shop now runs infrastructure monitoring and a "products like this one" feature. Both store rows in a table and both query them, but neither is served well by a B-tree over ordinary columns.

### Two Workloads, One B-Tree

```text
METRICS   2,000 servers × 40 metrics × 1 sample/sec = 80,000 rows/sec,
          retained 13 months ≈ 2.7 trillion points.
          ↳ Every insert also writes the (server_id, ts) index. Purging
            March means DELETE over billions of rows. A 16-byte point
            costs far more than 16 bytes once row headers are counted.

SIMILARITY  5,000,000 product descriptions, each a 768-dimension float
          vector. Query: "the 10 nearest to this vector."
          ↳ There is no sort order over 768 dimensions for a B-tree to
            index, so "nearest" means computing 5,000,000 distances —
            about 3.8 billion multiply-adds — for one search box.
```

### What's Missing

Both workloads have a shape the general engine cannot exploit. Metrics arrive in time order, are never updated, and are read as ranges, so time itself could be the organising principle instead of just another indexed column. Similarity has no total order at all, so the only way to make it fast is to accept an answer that is *probably* right.

---

## 2. The Hospital Chart and the Library Shelf Analogy

A hospital observation chart is filled in forwards, one reading at a time, and yesterday's entries are never rewritten — so the chart can be a stack of pages, filed by day, and last year's pages can be boxed up whole. A librarian asked for "something like this novel" does not consult the catalogue by title; she walks toward the shelf where such a book would live and picks from the nearest few, without comparing your book to every book in the building.

### Chart and Shelf

```text
Chart page  → written forwards only, filed by date; the whole page is
              the unit you keep, summarise, or throw away
Nearby shelf → "like this one" is answered by position, not by name;
              she checks a handful of neighbours, not the whole stock,
              and might miss a good match two aisles over
```

### Mapping the Analogy to the Two Models

The stack of dated pages is the time-series model: append-only writes, chunks organised by time, retention as "discard the old box". The librarian's walk is approximate nearest neighbour search: get close cheaply, examine a small neighbourhood, and accept that the answer is very good rather than provably best.

---

## 3. The Mechanism: Append-Only Chunks, Embeddings, and Distance

Each model builds on one property of its data: for time-series, that new rows always arrive at the end; for vectors, that closeness in a coordinate space stands in for closeness in meaning.

### Time-Series: Append-Only, Time-Partitioned, Compressed

```text
chunk 2025-03-12  [ closed, compressed ]
chunk 2025-03-13  [ closed, compressed ]
chunk 2025-03-14  [ open — all writes land here ]
      ↳ Writes hit only the newest chunk, so index insertions stay at
        the right edge and the older ones are never touched again.
        A range query for "last 6 hours" opens one chunk instead of
        searching an index spanning 13 months.
        Retention = drop the oldest chunk: a metadata operation, not
        a DELETE of a billion rows followed by space reclamation.
        Because values in a column change slowly and timestamps are
        near-regular, delta and delta-of-delta encoding shrink a
        16-byte point to a small number of bits.
```

### Vector: Embeddings and Distance

```text
"mechanical keyboard, blue switches"  → [0.021, -0.184, 0.077, … ]  768 floats
"clicky keyboard for typing"          → [0.019, -0.191, 0.081, … ]  768 floats
      ↳ An embedding model maps content to a fixed-length array of
        floats such that related meaning lands in nearby positions.
        "Nearby" needs a metric: cosine distance (angle), Euclidean/L2
        (straight-line), or inner product. The metric is a modelling
        choice and must match the one the embedding model was trained
        for, or the ranking is quietly wrong.
```

### Approximate Nearest Neighbour: HNSW and IVF

```text
HNSW  Build a layered graph. Each vector is a node linked to its M
      nearest neighbours; upper layers hold few nodes with long links.
      Search enters at the top, greedily hops toward the query, then
      drops a layer and refines. ef_search widens the candidate list:
      higher recall, more work.
IVF   Cluster all vectors with k-means into lists, one centroid each.
      A query compares against the centroids only, then scans the
      nprobe closest lists. nprobe is the same recall/latency dial.
```

---

## 4. Diagram: How an HNSW Graph Skips Most of the Data

A query entering the top layer and descending toward its nearest neighbours.

### Layers of an HNSW Graph

```text
Layer 2   (A)─────────────────────(F)          few nodes, long hops
           │                       │
Layer 1   (A)──────(C)────────────(F)──────(H) more nodes, shorter hops
           │        │              │        │
Layer 0   (A)-(B)-(C)-(D)-(E)-(F)-(G)-(H)-(I) every vector, dense links

query q  ──► enter at A (layer 2) ──► hop to F ──► descend
         ──► layer 1: F is still closest ──► descend
         ──► layer 0: examine F, G, H ──► return the best k
```

### Reading the Diagram

The upper layers exist only to cross the space quickly: a handful of long hops replace millions of comparisons. Only at layer 0 does the search look at real neighbourhoods, and it looks at a few dozen candidates rather than all five million. The vector two aisles over that would have won a brute-force scan can be missed — that gap is what "approximate" means, and it is measured as recall.

---

## 5. Code Walkthrough: Rollups, Retention, and a Similarity Query

Standard-SQL-shaped and illustrative; every engine spells time buckets and distance operators differently.

### Downsampling a Range

```sql
-- 5-minute buckets of CPU for the last day: 288 rows per server
-- instead of 86,400 raw points per server.
SELECT server_id,
       FLOOR(EXTRACT(EPOCH FROM ts) / 300) * 300 AS bucket_start,
       AVG(cpu_pct) AS avg_cpu,
       MAX(cpu_pct) AS max_cpu
FROM metrics
WHERE metric = 'cpu_pct' AND ts >= NOW() - INTERVAL '24 hours'
GROUP BY server_id, bucket_start
ORDER BY bucket_start;
```

### Retention and Precomputed Rollups

```text
Generic table:      DELETE FROM metrics WHERE ts < NOW() - '13 months'
                    ↳ Rewrites index pages, leaves dead space to reclaim,
                      competes with 80,000 inserts/sec while it runs.
Time-partitioned:   DROP the chunks whose range ends before the cutoff.
                    ↳ Constant-time metadata change; no row is touched.
Rollup policy:      keep raw for 7 days, 1-minute averages for 90 days,
                    1-hour averages for 13 months.
                    ↳ Each older tier is smaller and is written once by
                      a background job, not recomputed on every dashboard
                      refresh.
```

### A Similarity Query with a Filter

```sql
-- Vector column stored alongside ordinary columns in the same table.
SELECT product_id, name,
       DISTANCE(embedding, :query_vec) AS d      -- cosine or L2
FROM products
WHERE category = 'keyboards' AND price < 150.00  -- ordinary predicates
ORDER BY d
LIMIT 10;
```

---

## 6. Comparing Exact Search to Approximate Nearest Neighbour

Exact k-nearest-neighbour search is trivially correct and does not scale; ANN gives up a provable guarantee to buy a change in complexity class.

### Exact k-NN vs ANN Index

| | Exact k-NN (brute force) | ANN (HNSW or IVF) |
|---|---|---|
| Work per query | A distance to every stored vector | Distances to a small candidate set |
| Correctness | Provably the true top-k | Top-k with recall typically 0.90–0.99 |
| At 5M × 768 dims | ~3.8 billion multiply-adds | Thousands of comparisons |
| Index build | None | Minutes to hours; graph or lists held in memory |
| Updates | Trivially correct | Inserts and deletes degrade quality; rebuilds needed |
| Tuning | Nothing to tune | ef_search or nprobe trades recall against latency |

### Takeaway

Below roughly a few tens of thousands of vectors, brute force is often fast enough and always correct, so an index is not automatically the right call. Above that, the question stops being "exact or approximate" and becomes "what recall does this feature need" — a product-recommendation carousel and a legal-document search have very different answers, and the dial is the same one either way.

---

## 7. Common Mistakes

- **Using `DELETE` as a retention policy on a high-ingest time-series table.** Removing a month of rows from a single large table rewrites index pages, leaves space that must be reclaimed later, and competes with live ingest the whole time. Time-partitioned storage exists so retention becomes dropping a chunk — a metadata operation — and adopting the partitioning after the table is huge is far more painful than before.
- **Putting a high-cardinality value in the series identifier.** Tagging metrics with `request_id` or a raw user ID turns a handful of series into millions, each with its own index entries and its own metadata. Tags should be low-cardinality dimensions you actually group by; identifiers belong in logs or events, not in the series key.
- **Treating ANN results as exact and never measuring recall.** An HNSW or IVF index returns *probably* the top-k. If nobody has measured recall against a brute-force baseline on a sample of real queries, nobody knows whether tuning `ef_search` or `nprobe` down to hit a latency target quietly halved result quality.
- **Filtering after the similarity search instead of alongside it.** Fetching the top 10 nearest vectors and then discarding those outside `category = 'keyboards'` can easily return nothing. The filter has to participate in the search — which is a large part of why vector capability is more useful as an extension to a general database, where the predicate and the ranking live in one query, than as a separate service holding only vectors and IDs.

---

## 8. Hands-On Exercises

**Exercise 1:** Model a smart-meter reading feed — meter ID, timestamp, kWh — as an ordinary relational table with a B-tree index, then as a time-partitioned time-series table. For 100,000 meters sampling every 30 seconds, compute rows per day for both, and write down what "delete everything older than two years" costs in each.

**Exercise 2:** Design the retention and rollup tiers for that same meter data given the requirements: per-reading detail for billing disputes within 30 days, hourly totals for a year, monthly totals for seven years. State the storage ratio between tiers and which query each tier serves.

**Exercise 3:** Model a support-ticket search two ways: full-text keyword search over a `tickets` table, and vector similarity over embeddings of the ticket bodies. Write one query each. Then write down a search phrase the keyword version answers better and one the vector version answers better, and say why.

**Exercise 4:** Deliberately reproduce the post-filter mistake from Section 7. Take 10,000 product embeddings where only 2% are in the `keyboards` category, retrieve the 10 nearest vectors to a query, then filter by category and record how many survive. Rewrite the query so the predicate is applied as part of the search and compare the result counts.

**Exercise 5:** Take a set of at least 20,000 vectors, run exact brute-force search for 50 query vectors, and treat those as ground truth. Build an ANN index, run the same 50 queries at two different `ef_search` or `nprobe` settings, and report recall@10 and latency for each. State which setting you would ship and for what feature.

---

## 9. Interview Q&A

**Q: Why do general-purpose databases struggle with high-volume time-series data?**
Three reasons that compound. Every insert maintains secondary indexes that keep growing, and at tens of thousands of points per second that index churn dominates the write path. Retention becomes a mass `DELETE` over billions of rows, which rewrites pages and leaves space to reclaim while ingest is still running. And a general row store spends far more than the 16 bytes a timestamp-plus-float actually needs, because it stores each point as an independent row with its own header.

**Q: What do specialised time-series databases do differently?**
They organise storage by time rather than treating time as an ordinary indexed column. Data is partitioned into chunks covering time ranges, so writes only ever touch the newest chunk, range queries open a few chunks instead of searching one enormous index, and retention is dropping a chunk — a metadata operation. They also exploit the data's regularity: delta and delta-of-delta encoding on near-regular timestamps and slowly-changing values compress dramatically, and precomputed rollups serve dashboards without rescanning raw points.

**Q: What is an embedding, and why can't a B-tree index one?**
An embedding is a fixed-length array of floats produced by a model, positioned so that semantically related content lands nearby under some distance metric. A B-tree needs a total order — a single dimension along which values sort — and 768 dimensions have no such order. "Nearest" is defined by a distance function over all dimensions at once, which is why the naive answer is computing the distance to every stored vector.

**Q: How does HNSW make similarity search fast, and what does it cost?**
HNSW builds a layered proximity graph: every vector links to its nearest neighbours, and sparse upper layers carry long-range links. A search enters at the top, greedily hops toward the query across the coarse layers, then descends and refines in a dense local neighbourhood, so it examines a few dozen candidates instead of millions. The cost is that the answer is approximate — a genuinely nearest vector on the far side of the graph can be missed — plus a build step, memory to hold the graph, and degradation as vectors are inserted and deleted. `ef_search` is the dial between recall and latency.

**Q: Do you need a dedicated vector database?**
Usually not as a first step. Vector types and ANN indexes are now common as extensions to general-purpose databases, and keeping embeddings in the same table as the product's ordinary columns matters practically: real queries rank by similarity *and* filter by category, price, tenant, or permissions, and doing both in one query avoids the post-filter problem where you retrieve ten neighbours and none of them pass the filter. A dedicated system earns its place at very large vector counts or when the workload is nothing but similarity search.
