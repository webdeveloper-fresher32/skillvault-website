# Composite Indexes and the Leftmost Prefix — Complete Guide

> "A wardrobe arranged first by season, then by colour, then by size finds you winter-blue-medium in one reach, but 'everything blue' still means opening every single drawer."

---

## Table of Contents

1. [The Problem: Three Single-Column Indexes and Still a Full Scan](#1-the-problem-three-single-column-indexes-and-still-a-full-scan)
2. [The Sorted Wardrobe Analogy](#2-the-sorted-wardrobe-analogy)
3. [The Mechanism: One Sort Order Not Three](#3-the-mechanism-one-sort-order-not-three)
4. [Diagram: Leaf Order Under a Three-Column Key](#4-diagram-leaf-order-under-a-three-column-key)
5. [Code Walkthrough: Which Queries Use the Index and How Far](#5-code-walkthrough-which-queries-use-the-index-and-how-far)
6. [Comparing Equality-First Order to Range-First Order](#6-comparing-equality-first-order-to-range-first-order)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Three Single-Column Indexes and Still a Full Scan

A query filters on three columns. Each of those columns has its own index. The plan uses one of them, discards most of what it returns, and the query is still slow — which looks like the database ignoring two perfectly good indexes.

### One Index Chosen Two Wasted

```text
events — 80,000,000 rows, 5,000 tenants
  idx_events_tenant ON (tenant_id)   idx_events_type ON (event_type)
  idx_events_time   ON (occurred_at)
SELECT * FROM events
WHERE tenant_id = 7 AND event_type = 'login'
  AND occurred_at >= DATE '2026-03-01';

  plan: idx_events_tenant → 16,000 rows for tenant 7, all fetched,
        15,880 of them then discarded                        940 ms
  ↳ The other two indexes are sorted by a different column, so
    nothing in them lines up with the entries just found.
```

### What's Missing

Three separate indexes are three separate sort orders, and a query cannot descend two trees at once and land in the same place. What's missing is a single structure sorted by all three columns together — and, with it, a rule for which queries such a structure can actually serve.

---

## 2. The Sorted Wardrobe Analogy

A wardrobe organised first by season, then by colour, then by size is trivially fast for "winter, blue, medium" — one drawer, one reach. It is equally fast for "everything winter" and for "winter blue". It is useless for "everything blue", because blue items sit in a small run inside each season rather than one run overall.

### Season Then Colour Then Size

```text
Ask for winter        → one contiguous block, walk it
Ask for winter + blue → a smaller block inside that block
Ask for blue          → a blue run inside winter, another inside
                        spring, summer, autumn — four scattered
                        runs, no place to start, open everything
```

### Mapping the Analogy to Composite Indexes

The arrangement is the index's column order, fixed at creation. Any question that names the outermost attribute narrows immediately; any question that skips it has nothing to narrow with. Reordering the wardrobe by colour first would fix "everything blue" and break "everything winter" — you cannot have both from one arrangement.

---

## 3. The Mechanism: One Sort Order Not Three

A composite index has exactly one sort order: its entries are tuples compared left to right, the same way words are alphabetised letter by letter.

### One Index One Sort Order

```sql
-- Illustrative standard SQL.
CREATE TABLE events (
  event_id BIGINT PRIMARY KEY, tenant_id INTEGER NOT NULL,
  event_type VARCHAR(32) NOT NULL, occurred_at TIMESTAMP NOT NULL);
CREATE INDEX idx_events_tenant_type_time
  ON events (tenant_id, event_type, occurred_at);
```

### The Leftmost Prefix Rule

```text
An index on (a, b, c) can be seeked on a leftmost prefix of its
columns and nothing else:
  (a)      usable        (b)      NOT usable
  (a,b)    usable        (c)      NOT usable
  (a,b,c)  usable        (b,c)    NOT usable
  (a,c)    partially — a seeks, c only filters what a returned
  ↳ "Leftmost" is about the column order in the INDEX, not the
    order predicates are written in the SQL. Rewriting the WHERE
    clause changes nothing; the planner reorders predicates freely.
```

---

## 4. Diagram: Leaf Order Under a Three-Column Key

### Where Each Entry Sits

```text
idx_events_tenant_type_time leaves, in index order:
  (7, 'login',    2026-03-01 08:00) ─┐ one contiguous run for
  (7, 'login',    2026-03-01 09:14)  │ tenant 7 + 'login'
  (7, 'login',    2026-03-02 11:02) ─┘
  (7, 'logout',   2026-03-01 08:05)
  (8, 'login',    2026-01-02 07:00) ─┐ a *different* 'login' run,
  (8, 'login',    2026-01-02 07:31) ─┘ far away in the leaf order
  sorted by tenant_id, then within one tenant_id by event_type,
    ↳ then within one (tenant_id, event_type) by occurred_at
```

### Reading the Diagram

`WHERE tenant_id = 7 AND event_type = 'login'` names a single contiguous run, so one descent finds its first entry and a sequential walk finds the rest. `WHERE event_type = 'login'` alone names 5,000 runs, one per tenant, with no single entry point to descend to — which is exactly why the leading column is not optional.

---

## 5. Code Walkthrough: Which Queries Use the Index and How Far

The same index serves some queries completely, some partially, and some not at all. The difference is mechanical, not a matter of planner mood.

### The Same Index Against Eight Queries

```text
Index: (tenant_id, event_type, occurred_at)       columns seeked
----------------------------------------------------------------
WHERE tenant_id=7                                 a
WHERE tenant_id=7 AND event_type='login'          a, b
WHERE tenant_id=7 AND event_type='login'
      AND occurred_at >= DATE '2026-03-01'        a, b, c   ideal
WHERE tenant_id=7 AND occurred_at >= '2026-03-01' a only — c is a
                                                  filter not a seek
WHERE event_type='login'                          none
WHERE event_type='login' AND occurred_at > '...'  none
WHERE tenant_id=7 AND event_type IN ('login','x')
      AND occurred_at >= DATE '2026-03-01'        a, b, c — an IN
                                                  list is one seek
                                                  per listed value
WHERE tenant_id >= 7 AND event_type='login'       a only — a range
                                                  on a stops b being
                                                  seekable
```

### Equality First Range Last

```sql
-- Index: (tenant_id, event_type, occurred_at)
SELECT * FROM events
WHERE tenant_id = 7 AND event_type = 'login'
  AND occurred_at >= TIMESTAMP '2026-03-01 00:00:00';
-- ↳ two equalities pin one contiguous run; the range then walks
--   the tail of it. All three columns do real work.
SELECT * FROM events
WHERE occurred_at >= TIMESTAMP '2026-03-01 00:00:00'
  AND tenant_id = 7 AND event_type = 'login';
-- ↳ identical plan; predicate order in the SQL text is irrelevant
```
```text
Why a range ends the useful part of the index —
index (tenant_id, occurred_at, event_type):
  tenant_id = 7             → pins one contiguous run
  occurred_at >= 2026-03-01 → selects the tail of that run
  event_type = 'login'      → inside that tail event_type appears in
                              occurred_at order, effectively
                              unsorted for event_type
  ↳ event_type can only be checked row by row. Every column after
    the first range predicate degrades from seek to filter — so
    equality columns go first, the single range column last.
```

### Satisfying ORDER BY Without a Sort

```sql
-- Index order inside tenant_id = 7 already IS (event_type,
-- occurred_at), so the engine reads 50 entries and stops: no sort
-- step, and the LIMIT genuinely limits the work done
SELECT occurred_at, event_type FROM events
WHERE tenant_id = 7 ORDER BY event_type, occurred_at LIMIT 50;

-- Mixed directions against an all-ascending index
ORDER BY event_type ASC, occurred_at DESC
-- ↳ not satisfied above; either declare a matching multi-direction
--   index where supported, or accept a sort over the whole
--   matching set before the LIMIT applies
```

---

## 6. Comparing Equality-First Order to Range-First Order

Two indexes on the same three columns, differing only in order, serve almost disjoint sets of queries.

### Equality-First vs Range-First

| | (tenant_id, event_type, occurred_at) | (tenant_id, occurred_at, event_type) |
|---|---|---|
| Two equalities plus a time range | Seek on both equalities, then walk the range; ~120 rows examined | Seek on one, walk the range, filter the rest row by row; ~4,000 examined |
| `ORDER BY event_type, occurred_at` | Satisfied by index order | Requires a sort |
| Time range within one tenant, all types | Must scan every event_type run | Single contiguous run |
| Best for | Filtering on a known event type | Time-window scans across all types |

### Takeaway

Neither order is universally better, and neither follows from cardinality. The common advice to "put the most selective column first" is a tiebreaker at best; what actually decides the order is the query mix. List the real queries, note which columns each one uses with equality, which uses a range, and what each orders by — then pick the order that puts equality columns in front, the range column last, and leaves an `ORDER BY` already satisfied. If two query shapes genuinely conflict, that is a signal for two indexes, not a compromise order that serves neither.

---

## 7. Common Mistakes

- **Creating one single-column index per column in the `WHERE` clause.** Three separate indexes are three separate sort orders, and the planner can only start from one of them; the other two contribute nothing. One composite index in the right order replaces all three and is cheaper to maintain than three.
- **Believing the order of predicates in the SQL text matters.** `WHERE b = 1 AND a = 2` and `WHERE a = 2 AND b = 1` produce identical plans, because the planner reorders predicates freely. The only order that matters is the column order in the index definition.
- **Putting the range column in the middle.** In `(tenant_id, occurred_at, event_type)`, an `occurred_at` range makes `event_type` a row-by-row filter rather than a seek. Every column positioned after a range predicate loses its ability to narrow the search.
- **Choosing column order from cardinality alone.** Highest-cardinality-first is a heuristic that quietly breaks whenever a lower-cardinality column is the one every query filters on with equality, or when an `ORDER BY` could have been satisfied for free by a different arrangement.

---

## 8. Hands-On Exercises

**Exercise 1:** Build the `events` table from Section 3 with ten million rows across 200 tenants and four event types. Create the three single-column indexes from Section 1, run the three-predicate query, and record from the plan which index was chosen and how many rows it returned before filtering.

**Exercise 2:** Drop those three indexes, create `idx_events_tenant_type_time ON events (tenant_id, event_type, occurred_at)`, and rerun the same query. Compare rows examined and elapsed time against Exercise 1.

**Exercise 3:** Run each of the eight query shapes from Section 5 against that one index and record, from each plan, how many leading columns were actually used as a seek. Confirm that `WHERE event_type = 'login'` alone does not use the index at all.

**Exercise 4:** Reproduce the range-in-the-middle mistake deliberately. Create `(tenant_id, occurred_at, event_type)`, run the three-predicate query against it, and compare rows examined against the equality-first index from Exercise 2.

**Exercise 5:** Run `SELECT occurred_at, event_type FROM events WHERE tenant_id = 7 ORDER BY event_type, occurred_at LIMIT 50` and confirm the plan contains no sort step. Then change it to `ORDER BY event_type ASC, occurred_at DESC` and confirm a sort appears.

---

## 9. Interview Q&A

**Q: What is the leftmost prefix rule?**
An index on `(a, b, c)` can be seeked on any leftmost prefix of its columns — `(a)`, `(a, b)`, or `(a, b, c)` — and nothing else. A query filtering only on `b`, or only on `b` and `c`, cannot use it, because the entries are sorted by `a` first, so the matching `b` values sit in many scattered runs with no single starting point. A query on `a` and `c` uses `a` to seek and then applies `c` as a row-by-row filter.

**Q: Does the order of predicates in the WHERE clause matter?**
No. The planner reorders predicates freely, so `WHERE b = 1 AND a = 2` and `WHERE a = 2 AND b = 1` produce identical plans. The only ordering that matters is the column order declared in the index, which is fixed when the index is created.

**Q: Why should equality columns come before the range column?**
Equality predicates pin a single contiguous run of entries, so the next column is still sorted within that run and can be seeked in turn. A range predicate selects a span rather than a point, and inside that span the following column is ordered by the range column rather than by itself — effectively unsorted. So every column after the first range predicate degrades from a seek to a filter, which is why the single range column belongs last.

**Q: How can an index remove a sort step?**
If the columns and directions in `ORDER BY` match the index's own order — accounting for any leading columns already pinned by equality predicates — the engine can read entries in index order and the result is already sorted. That also makes `LIMIT` genuinely cheap, because it can stop after N entries instead of sorting the whole matching set first. Mixed `ASC`/`DESC` directions break this unless the index was declared with matching directions.

**Q: How do you choose the column order for a composite index?**
From the actual query mix rather than from cardinality. Collect the real queries, note for each which columns are used with equality, which with a range, and what the `ORDER BY` is; then put the equality columns first, the range column last, and prefer an arrangement that also satisfies a common `ORDER BY`. "Most selective column first" is only a tiebreaker between orders that are otherwise equally usable, and if two important query shapes genuinely demand different orders, that argues for two indexes rather than one compromise.
