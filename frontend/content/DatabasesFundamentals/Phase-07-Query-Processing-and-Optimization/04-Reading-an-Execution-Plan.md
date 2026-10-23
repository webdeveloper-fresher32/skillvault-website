# Reading an Execution Plan — Complete Guide

> "An itemised repair bill does not require you to be a mechanic — it only requires you to notice that the line you expected to be small is the one eating the total."

---

## Table of Contents

1. [The Problem: The Query Is Slow and the SQL Looks Fine](#1-the-problem-the-query-is-slow-and-the-sql-looks-fine)
2. [The Itemised Repair Bill Analogy](#2-the-itemised-repair-bill-analogy)
3. [The Mechanism: Operators Estimates Actuals and Loop Counts](#3-the-mechanism-operators-estimates-actuals-and-loop-counts)
4. [Diagram: Reading a Plan Tree From the Inside Out](#4-diagram-reading-a-plan-tree-from-the-inside-out)
5. [Code Walkthrough: Six Plan Pathologies and Their Fixes](#5-code-walkthrough-six-plan-pathologies-and-their-fixes)
6. [Comparing a Healthy Plan to a Pathological One](#6-comparing-a-healthy-plan-to-a-pathological-one)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Query Is Slow and the SQL Looks Fine

Staring harder at a slow statement almost never reveals why it is slow, because the statement is not what runs. The plan is, and the plan is the only artifact that says where the eleven seconds actually went.

### Reading the Query Instead of the Plan

```text
"It's a three-table join with two filters — nothing looks expensive."
  ↳ Also true of the version that runs in 4 ms. The text is identical
    in both cases. Guesses people make from the text alone:
      "add an index on placed_at"       (one exists, and is unused)
      "the JOIN order is wrong"         (the planner reorders anyway)
      "the table is just too big"       (40M rows, 4 ms when healthy)
```

### What's Missing

Every one of those guesses is a hypothesis about a decision the engine already made and already recorded. What's missing is the habit of asking the engine what it did instead of inferring what it might have done — and a vocabulary for the answer that survives moving between engines, since the operator names differ but the fields to read do not.

---

## 2. The Itemised Repair Bill Analogy

A garage hands back a bill for 940 units of currency. The total says nothing useful. The itemisation says four hours went to the gearbox, and that is a fact worth arguing with, whether or not you know how a gearbox works.

### Total Versus Itemisation

```text
Total only       → "940" — you can be angry but not specific
Itemisation      → parts 180, gearbox 4 h, oil change 0.3 h
Quoted vs actual → quoted 1 h for the gearbox, billed 4 h
Reading order    → find the largest line, ask why it grew, and never
                   mind why the oil change took 0.3 h
```

### Mapping the Analogy to Execution Plans

The total is the query runtime, the line items are operators, and quoted-versus-billed is estimated-versus-actual rows. The discipline is identical: find the operator that dominates, check whether it was quoted anywhere near its actual size, and ignore the cheap lines no matter how odd they look.

---

## 3. The Mechanism: Operators Estimates Actuals and Loop Counts

Engines differ in operator names and output formatting, but the fields that carry the diagnosis are the same everywhere, and there are only about six of them.

### What Every Plan Shows

```text
operator name  → the physical step: a scan, a join, a sort, an aggregate
estimated rows → what the planner predicted BEFORE running anything
actual rows    → what really came out (only present if the plan was run)
loops          → how many times this operator was executed
cost           → unit-free planner currency, NOT milliseconds
actual time    → usually PER LOOP, and cumulative for the subtree below
rows removed   → how many rows a filter examined and discarded
```

### Estimated Versus Actual and the Ratio That Matters

```text
Seq Scan on orders  (est_rows=12  actual_rows=1,430,000  loops=1)
  ↳ ratio 119,000x. This single number explains every bad choice
    made above this node: the planner sized the whole plan for 12
    rows. A ratio past roughly 10x on a node whose parent depends
    on its size is the first thing to explain, and usually the last.
```

### Loops and Per-Loop Numbers

```text
Index Scan on customers (actual_time=0.008 rows=1 loops=1,430,000)
  ↳ 0.008 ms per loop looks harmless and is the most misread field
    in any plan. Total = 0.008 x 1,430,000 = 11,440 ms. Always
    multiply per-loop time by loops before deciding a node is cheap.
```

---

## 4. Diagram: Reading a Plan Tree From the Inside Out

### Indentation Is the Tree

```text
Illustrative plan text. Indentation depth = depth in the tree.
  Sort  (est=12 actual=1,430,000 loops=1)          ← 5th, runs last
    └─ Hash Join  (est=12 actual=1,430,000)        ← 4th
         ├─ Seq Scan on orders  (est=12 actual=1,430,000)   ← 1st
         │     Filter: country='DE' AND city='Munich'
         └─ Hash  (est=5,000 actual=5,000)         ← 3rd
              └─ Seq Scan on customers             ← 2nd
```

### Reading the Diagram

Read deepest and innermost first: the two scans run before the hash can be built, the hash before the join can probe, the join before the sort has anything to sort. The root is printed at the top but finishes last, which is the opposite of how the text reads top-to-bottom — and the reason a beginner's first instinct, to look at the first line, points at the operator that is usually a symptom rather than a cause.

---

## 5. Code Walkthrough: Six Plan Pathologies and Their Fixes

Six shapes account for the large majority of slow queries. Each is recognisable from the plan alone, and each has a different fix, so naming the shape correctly is most of the work.

### Scans Estimates and Unused Indexes

```text
1. UNEXPECTED SEQUENTIAL SCAN
   Seq Scan on orders  (actual_rows=48  loops=1)
     Filter: order_ref = 'A-99182'   Rows Removed by Filter: 39,999,952
   ↳ 40M rows examined to return 48. Fix: index order_ref. A seq scan
     is only a problem when the filter discards nearly everything.

2. ESTIMATE OFF BY ORDERS OF MAGNITUDE
   Index Scan on orders  (est_rows=12  actual_rows=1,430,000)
   ↳ Fix the estimate, not the plan: refresh statistics, add
     multi-column statistics for correlated predicates (Lesson 2).
     Forcing a join hint here treats the symptom and leaves the
     wrong number feeding every other plan over this table.

3. AN INDEX EXISTS BUT IS NOT USED
   Seq Scan on orders   Filter: LOWER(email) = 'ada@example.com'
   ↳ idx_orders_email exists on email, not on LOWER(email). Wrapping
     an indexed column in a function makes the predicate non-sargable
     and unusable by the index. Fix: index the expression, or store
     a normalised column. Same trap: implicit type casts and
     leading-wildcard LIKE patterns (Phase 6).
```

### Joins Sorts and Row Explosions

```text
4. NESTED LOOP OVER A LARGE OUTER
   Nested Loop  (actual_rows=1,430,000)
     └─ Index Scan on customers (actual_time=0.008 loops=1,430,000)
   ↳ 1.43M index probes. The loop is not the bug — the outer side was
     estimated at 12 rows. Fix the estimate; the planner will pick a
     hash join by itself once it knows the true size.

5. SORT SPILLING TO DISK
   Sort  (actual_rows=1,430,000)
     Sort Method: external merge  Disk: 412,000 kB
   ↳ "external merge" or "Disk:" means the sort exceeded working
     memory. Fix: reduce rows before the sort, raise working memory
     for that session, or supply an index providing the order.

6. ROW COUNT EXPLODING AFTER A JOIN
   Hash Join  (actual_rows=94,000,000)
     ├─ Seq Scan on orders     (actual_rows=1,200,000)
     └─ Seq Scan on shipments  (actual_rows=3,400,000)
   ↳ Output is far larger than either input: the join key is not
     unique on either side, so rows multiply. Fix: check the join
     condition for a missing column, or deduplicate before joining.
```

---

## 6. Comparing a Healthy Plan to a Pathological One

The same query, the same data, and two plans — the difference is visible in three fields before any operator name is even considered.

### Healthy vs Pathological

| | Healthy plan | Pathological plan |
|---|---|---|
| est vs actual rows | Within roughly 10x at every node | Off by 100x or more at some node |
| Loops on inner nodes | 1, or a small number | Hundreds of thousands |
| Sort method | In memory | External merge, with a Disk figure |
| Rows removed by filter | Small relative to rows examined | Nearly everything examined is discarded |
| Rows after a join | Comparable to the larger input | Multiplied far beyond both inputs |

### A Checklist for Any Slow Query

```text
1. Get the plan WITH actual row counts — an estimate-only plan
   cannot show you an estimation error.
2. Find the node with the largest total time (per-loop time x loops).
3. At that node, compare estimated rows against actual rows.
4. If the ratio is large, stop — fix the estimate first (Lesson 2).
5. If estimates are sound, read the operator: scan discarding almost
   everything, sort spilling, join multiplying rows?
6. Check loops on every inner node before calling anything cheap.
7. Change ONE thing, re-obtain the plan, and compare the same fields.
```

### Takeaway

Nothing in this checklist is engine-specific: every mainstream engine reports operators, estimates, actuals, and loops, and the reasoning is identical once you know which four fields to read. The skill transfers; only the operator vocabulary has to be relearned.

---

## 7. Common Mistakes

- **Reading an estimate-only plan and treating it as evidence.** A plan obtained without actually running the query shows what the optimizer predicted and nothing about what happened, so the single most valuable comparison — estimated against actual rows — is unavailable. Almost every diagnosis in this lesson requires the executed form.
- **Comparing cost numbers to milliseconds.** Cost is unit-free planner currency used only to rank candidate plans against each other; it is not a time prediction and is not comparable across servers or configurations. A plan with a lower cost that runs slower is not a contradiction, it is a signal that the cost model was fed bad row estimates.
- **Treating any sequential scan as a defect.** Reading a whole table is the correct choice when a large fraction of it matches, and forcing an index there makes things slower by adding a random page fetch per row. The diagnostic is the ratio of rows removed by the filter to rows examined, not the operator name.
- **Fixing the operator instead of the estimate.** Forcing a hash join to escape a bad nested loop hides one instance of a wrong row count that is still poisoning every other plan over the same table. Correct the statistics first and re-check whether the plan fixes itself.

---

## 8. Hands-On Exercises

**Exercise 1:** Take a query in your own system that takes over a second, obtain its plan with actual row counts, and write down three numbers before changing anything: the operator with the largest total time, its estimated rows, and its actual rows. Nothing else — this is the whole first pass.

**Exercise 2:** Find a plan in which per-loop time is small and the loop count is large. Compute per-loop time multiplied by loops by hand and confirm that this product, not the printed per-loop figure, accounts for the query's runtime.

**Exercise 3:** Create a table of 2,000,000 rows with an index on `email`, then query it with `WHERE LOWER(email) = '...'`. Confirm from the plan that the index is not used, then either index the expression or normalise the column and confirm the plan changes.

**Exercise 4:** Force a sort to spill by lowering your session's working-memory setting and ordering a large result set. Find the field in the plan that reports the external merge and its disk footprint, then raise the setting and confirm both the field and the runtime change.

**Exercise 5:** Reproduce the last mistake from Section 7 deliberately. Build the correlated-column case from Lesson 2 so the planner under-estimates and chooses a nested loop, then fix it twice: first by forcing a hash join, then by adding multi-column statistics instead. Compare the two plans and note which one leaves the wrong estimate in place.

---

## 9. Interview Q&A

**Q: How do you approach a query that suddenly got slow?**
Get the executed plan with actual row counts, find the operator consuming the most total time — remembering to multiply per-loop time by the loop count — and compare its estimated rows against its actual rows at that node. If the ratio is large, the problem is cardinality estimation and I look at statistics freshness and column correlation before touching the query. If the estimates are sound, then I read the operator itself: a scan discarding almost everything, a sort spilling to disk, or a join multiplying rows.

**Q: What is the difference between estimated and actual rows, and why does the comparison matter so much?**
Estimated rows is the planner's prediction made before execution from statistics; actual rows is what the operator really emitted. The comparison matters because every plan choice above a node was made on the basis of that prediction, so a node estimated at twelve rows that produces 1.4 million invalidates the reasoning behind the entire plan above it. It is the fastest way to distinguish "the optimizer chose badly" from "the optimizer was told badly."

**Q: Is a sequential scan always a problem?**
No. When a query genuinely matches a large fraction of a table, reading it sequentially is cheaper than an index scan that adds a random page fetch per matched row. A sequential scan is a problem when the filter discards nearly everything it examines — forty million rows examined to return forty-eight — and that ratio, not the operator name, is what the plan should be checked for.

**Q: What does the loop count on an inner operator tell you?**
That the operator was executed that many times, typically as the inner side of a nested loop, and that its reported time is usually per loop rather than total. An index scan showing 0.008 ms with 1.43 million loops is contributing over eleven seconds, which is invisible if the per-loop number is read as a total. It is also the clearest signal that the outer side of the loop is far larger than the planner expected.

**Q: What does the cost number in a plan actually mean?**
It is a unit-free score the optimizer uses to rank candidate plans against each other, built from weighted page reads and per-row CPU work. It is not milliseconds, it is not comparable between servers with different configuration, and a lower-cost plan can easily run slower. Its only reliable use is understanding why the planner preferred one plan over another, given the row estimates it believed at the time.
