# Phase 6: Indexing Theory

## What You'll Learn

How to price an index before creating it, how clustered, secondary, and covering indexes differ in what a query pays to use them, how column order in a composite index decides which queries it can serve, and how to pick an index type from the shape of the question being asked.

## Learning Objectives

- Quantify what an index costs on the write path, in storage, in buffer pool pressure, and in recovery time, and recognise the predicate shapes that leave an index unused.
- Explain the double lookup from a secondary index to the row, design a covering index that eliminates it, and justify a clustering key choice against page splits and locator width.
- Apply the leftmost-prefix and equality-then-range rules to choose composite column order from the real query mix, and select between B-tree, hash, bitmap, inverted, spatial, and block-range indexes.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-What-an-Index-Costs.md](01-What-an-Index-Costs.md) | write amplification on `INSERT`/`UPDATE`/`DELETE`; storage and buffer pool cost; predicates that skip the index; finding unused indexes | 1 day |
| [02-Clustered-Secondary-and-Covering.md](02-Clustered-Secondary-and-Covering.md) | the table as the index; secondary locators and the double lookup; covering indexes and index-only scans; `INCLUDE` columns; UUID clustering keys and page splits | 1 day |
| [03-Composite-Indexes-and-Leftmost-Prefix.md](03-Composite-Indexes-and-Leftmost-Prefix.md) | the leftmost-prefix rule; equality-then-range; satisfying `ORDER BY` without a sort; choosing column order from the query mix | 1 day |
| [04-Index-Types-and-When-Each-Wins.md](04-Index-Types-and-When-Each-Wins.md) | B-tree as the default; hash, bitmap, inverted, spatial, and block-range indexes; comparison table and a decision guide keyed off query shape | 1 day |

## Estimated Time

4 days

## Next Phase

→ [Phase 7: Query Processing and Optimization](../Phase-07-Query-Processing-and-Optimization/README.md)
