# Join Algorithms — Complete Guide

> "Matching a box of invoices to a box of receipts can be done by flipping through the whole second box once for every invoice, by sorting both and walking them side by side, or by pinning the smaller box to a corkboard by number first."

---

## Table of Contents

1. [The Problem: Two Tables and No Obvious Way to Match Them](#1-the-problem-two-tables-and-no-obvious-way-to-match-them)
2. [The Invoice and Receipt Boxes Analogy](#2-the-invoice-and-receipt-boxes-analogy)
3. [The Mechanism: Nested Loop Hash and Sort-Merge](#3-the-mechanism-nested-loop-hash-and-sort-merge)
4. [Diagram: Hash Join Build and Probe Step by Step](#4-diagram-hash-join-build-and-probe-step-by-step)
5. [Code Walkthrough: Join Order and Left-Deep Trees](#5-code-walkthrough-join-order-and-left-deep-trees)
6. [Comparing the Three Join Algorithms](#6-comparing-the-three-join-algorithms)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Two Tables and No Obvious Way to Match Them

`JOIN` is one word in SQL and three completely different physical procedures underneath, with runtimes that differ by four orders of magnitude on the same two tables. The engine picks; the word in the query says nothing about which.

### The Same Join Three Runtimes

```text
SELECT o.id, c.name FROM orders o JOIN customers c ON c.id =
o.customer_id WHERE o.placed_at >= DATE '2026-08-01';  -- 1.2M match
  Nested loop, no index on customers.id  ~8 h   with index  1.9 s
  Hash join, build on customers  0.6 s   sort-merge, sorted  0.7 s
  ↳ Identical SQL, identical result set, identical hardware.
```

### What's Missing

The `ON` clause states which rows correspond. It says nothing about how to find the corresponding row, and the three available procedures have different prerequisites: one needs an index, one needs memory, one needs sorted input. What's missing is knowing which prerequisites your data actually satisfies, because that is what the planner is checking when it chooses.

---

## 2. The Invoice and Receipt Boxes Analogy

Two cardboard boxes sit on a desk: 500 invoices and 2,000,000 receipts, to be matched by reference number. There are exactly three sane ways to do it by hand, and each becomes the obvious choice under different conditions.

### Three Ways to Match Two Boxes

```text
Flip through → for each invoice, riffle the receipt box until the
               number turns up; hopeless for 500 unless the receipts
               sit in a cabinet ordered by number

Corkboard    → pin all 500 invoices to a board by number, then read
               receipts once, glancing at the board for each — needs
               a board big enough for all 500
Sort both    → put both boxes in number order, then walk the piles
               forward together, never going backwards
```

### Mapping the Analogy to Join Algorithms

Flipping through is a nested loop, and the filing cabinet is an index on the inner table. The corkboard is a hash join: the small side gets loaded into a lookup structure and the big side streams past it once. Sorting both piles is a sort-merge join, and a board too small for 500 invoices is a hash join spilling to disk.

---

## 3. The Mechanism: Nested Loop Hash and Sort-Merge

Every mainstream engine implements these three. They are not interchangeable — each has a condition under which it is the correct answer and a condition under which it is a disaster.

### Nested Loop

```text
for each row R in OUTER:               -- the driving table
    for each matching row S in INNER:  -- looked up once per R
        if join condition holds: emit (R, S)
  no index on inner → cost ≈ |OUTER| × |INNER|      the O(n*m) trap
  index on inner    → cost ≈ |OUTER| × log(|INNER|) + a random
                      page fetch per matched row
  ↳ Right when OUTER is small AND the inner is indexed; catastrophic
    when OUTER turns out far larger than estimated.
```

### Hash Join

```text
BUILD: read the SMALLER input once into an in-memory hash table
       keyed by the join column
PROBE: read the LARGER input once, hash each row's join key, look it
       up in that table, emit every match found
  cost ≈ |BUILD| + |PROBE| — both read once; needs memory for the
  build side and an equality predicate
  ↳ Right for large unsorted inputs with no useful index; cannot
    serve a range join (a.x < b.y) — hashing only answers equality.
```

### Sort-Merge Join

```text
1. Sort both inputs on the join column (skipped if already sorted)
2. Walk two cursors forward together, advancing whichever side is
   behind, emitting matches; neither cursor ever moves backwards
  cost ≈ |A|log|A| + |B|log|B| + |A| + |B|, or just |A| + |B| when
  both inputs already arrive sorted — the sorts dominate
  ↳ Right when inputs already arrive ordered — from an index scan
    on the join column — and the best fit for range predicates.
```

---

## 4. Diagram: Hash Join Build and Probe Step by Step

### Build Then Probe

```text
BUILD: customers (the smaller side) → hash table on id
   ┌────────────────────────────────────────────────────┐
   │ h(17)→Nadia  h(42)→Owen  h(88)→Priya  h(91)→Rafael │
   └────────────────────────────────────────────────────┘
PROBE: orders streams past once, never stored
   order 5001 cust=42 → h(42) → hit  → emit (5001, 'Owen')
   order 5003 cust=13 → h(13) → miss → drop (inner join)
```

### Reading the Diagram

The build side is fully consumed and held in memory before a single probe row is read, which makes hash join a blocking operator: it cannot emit its first row until the smaller input is entirely read. The probe side is never stored, so memory is governed by the build side alone — which is exactly why the planner tries to build on whichever input it estimates smaller, and why a cardinality error (Lesson 2) can put the wrong table on the build side.

### When the Build Side Does Not Fit

```text
Build side 40 MB, working memory 32 MB → grace/partitioned fallback:
  1. Hash BOTH inputs into N partitions by the join key, writing
     those partitions to temporary files on disk
  2. Join partition i of A against partition i of B, one pair at a
     time — each pair now fits in memory
  ↳ Results are correct either way, but both inputs are now written
    to disk and read back — commonly several times slower.
```

---

## 5. Code Walkthrough: Join Order and Left-Deep Trees

Choosing an algorithm per join is the small half of the problem. The large half is choosing the sequence in which tables are joined, because a join of N tables has a plan space that grows faster than exponentially.

### Counting the Plan Space

```sql
SELECT o.id, c.name, p.title, s.carrier, w.region  -- five-table join
FROM   orders o
JOIN   customers  c ON c.id = o.customer_id
JOIN   products   p ON p.id = o.product_id
JOIN   shipments  s ON s.order_id = o.id
JOIN   warehouses w ON w.id = s.warehouse_id;

-- Distinct join ORDERS alone (left-deep, N tables → N! orderings):
--    3 tables → 6    5 tables → 120    10 tables → 3,628,800
--   12 tables → 479,001,600   20 tables → 2,432,902,008,176,640,000
-- Multiply each by 3 algorithm choices per join and again by the
-- access-path choice per table. Exhaustive search dies well before
-- 20 tables, so planners switch to heuristics or randomised search.
```

### Left-Deep Trees and the Search Cutoff

```text
LEFT-DEEP              BUSHY
      ⋈                    ⋈
     / \                  /  \
    ⋈   D                ⋈    ⋈
   / \                  / \  / \
  ⋈   C                A   B C  D
 / \
A   B
Left-deep: every right input is a base table, so the inner side can
use an index and only one intermediate result exists at a time.
Bushy: subtrees build in parallel, but the space is far larger and
both children may need materialising.
  ↳ Classic optimizers search only left-deep trees to keep it
    tractable; modern ones consider some bushy shapes too.
```

---

## 6. Comparing the Three Join Algorithms

The choice is not about which algorithm is fastest in the abstract — each one is fastest under conditions the other two cannot meet.

### Nested Loop vs Hash vs Sort-Merge

| | Nested Loop | Hash Join | Sort-Merge |
|---|---|---|---|
| Needs an index | On the inner join column, effectively yes | No | No |
| Needs memory | Almost none | Enough for the build side | Enough to sort, or spills |
| Predicate types | Any, including range and inequality | Equality only | Equality and range |
| First row emitted | Immediately — fully pipelined | After the whole build side | After both sorts finish |

```text
DECISION GUIDE
  Outer side small AND inner join column indexed → nested loop
  Both sides large, equality predicate, memory    → hash join
  Inputs already sorted, or output must be sorted → sort-merge
  Range or inequality join predicate    → sort-merge or nested loop
```

### Takeaway

Read a join choice as a statement about the planner's beliefs: nested loop means it expects a small outer, hash join means it expects no useful index and enough memory, sort-merge means it expects ordering it can exploit or must produce anyway. When the choice looks wrong, the belief is usually what is wrong, not the algorithm.

---

## 7. Common Mistakes

- **Reading a nested loop as automatically bad.** With a small outer and an indexed inner it is the cheapest of the three and starts returning rows immediately. What is bad is a nested loop whose outer turned out to be a million rows — a cardinality estimation failure wearing a join algorithm's clothes.
- **Expecting a hash join to serve a range predicate.** A hash table answers "is this exact key present" and nothing else, so `ON a.start_date < b.end_date` cannot be hashed. If a join condition is an inequality the realistic candidates are sort-merge or nested loop, and no amount of added memory changes that.
- **Sizing memory from the average query instead of the concurrent peak.** The build side must fit for each concurrent hash join separately, so a limit that comfortably holds one build side can spill every one of them at forty concurrent sessions. Spills often appear under load and vanish when someone reruns the query alone to investigate, and above roughly a dozen relations the planner is not searching exhaustively either, so a very wide join is good rather than optimal.

---

## 8. Hands-On Exercises

**Exercise 1:** Build `customers` with 5,000 rows and `orders` with 2,000,000 rows, with no index on `customers.id`. Join them and record the plan and runtime, then add a unique index on `customers.id` and repeat — note both which algorithm the planner switched to and by how much the runtime moved.

**Exercise 2:** Force the same join to run as a hash join and then as a sort-merge join using your engine's plan-shaping controls. Record the runtime of all three algorithms on identical data and reconcile the ranking against the decision guide in Section 6.

**Exercise 3:** Implement the build and probe phases from Section 4 in any language: read the smaller list into a dictionary keyed by the join column, then stream the larger list, emitting matches. Count the number of dictionary lookups and confirm it equals the probe input size exactly, not the product of the two sizes.

**Exercise 4:** Write a join whose condition is a range rather than an equality — for example, matching each order to the price band whose lower and upper bounds contain its total. Obtain the plan and confirm no hash join appears, then explain from Section 3 why hashing cannot serve it.

**Exercise 5:** Reproduce the spill from Section 4 deliberately. Lower your session's working-memory setting to a small value, run a hash join whose build side clearly exceeds it, and confirm from the plan that the join used disk-backed partitions — then raise the setting and compare the runtime of the same query.

---

## 9. Interview Q&A

**Q: Explain the three main join algorithms and when each is the right choice.**
Nested loop iterates the outer input and looks up matches in the inner for each row, so it is right when the outer is small and the inner's join column is indexed, and it starts returning rows immediately. Hash join builds an in-memory hash table from the smaller input and streams the larger one past it, which suits two large unsorted inputs joined on equality when there is memory for the build side. Sort-merge sorts both inputs and walks them forward together, which is right when the inputs already arrive sorted, when the output needs to be sorted anyway, or when the join predicate is a range that hashing cannot serve.

**Q: What actually goes wrong when a nested loop join is slow?**
Almost always the outer side is far larger than the planner estimated. A nested loop costs roughly the outer row count times the cost of one inner lookup, so it is excellent at twenty outer rows and ruinous at two million. The fix is usually to correct the cardinality estimate — refresh statistics, add multi-column statistics, or restructure the predicate — rather than to force a different join algorithm and leave the bad estimate in place.

**Q: What happens when a hash join's build side does not fit in memory?**
The engine falls back to a partitioned or grace hash join: it hashes both inputs into partitions, writes those partitions to temporary files, and then joins matching partition pairs one at a time so each pair fits in memory. The results are still correct, but both inputs are now written to disk and read back, which commonly makes the join several times slower. It is a frequent cause of a query that performs well in isolation and badly under concurrency, since each concurrent session needs its own build-side memory.

**Q: Why do optimizers restrict the join search space to left-deep trees?**
Because the number of join orders grows factorially and the number of full plans faster still — twenty tables have over two quintillion orderings before algorithm and access-path choices are multiplied in. Left-deep trees keep every right-hand input a base table, which means the inner side can exploit an index and only one intermediate result exists at any moment, and it prunes the space enormously. Modern optimizers consider some bushy shapes as well, but above roughly a dozen relations nearly all of them switch to heuristics or randomised search rather than exhaustive enumeration.

**Q: Which join algorithms can handle a non-equality join condition?**
Sort-merge and nested loop. A hash table can only answer exact-key lookups, so an inequality or range condition such as a date-overlap test cannot be served by hashing at all. That is a hard structural property of the algorithm rather than a tuning matter, so seeing a range join predicate immediately narrows the plan space to two candidates.
