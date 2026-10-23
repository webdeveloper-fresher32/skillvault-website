# Phase 8: Indexes

## Overview

Indexes are one of the most powerful tools in a database engineer's toolkit. This phase covers everything from the fundamentals of how indexes work internally to advanced optimization techniques using EXPLAIN and query profiling.

---

## Why Indexes Matter

Without indexes, every query that searches for data must scan every row in a table — a full table scan. For a table with 10 million rows, that means examining 10 million rows even if only 1 matches. With a proper index, MySQL can jump directly to the relevant rows in O(log n) time.

The difference between a 10-second query and a 10-millisecond query is often a single well-placed index.

---

## Files in This Phase

| File | Topic | Key Concepts |
|------|-------|--------------|
| `01-Index-Fundamentals.md` | How indexes work | B-tree internals, cardinality, write overhead |
| `02-Index-Types.md` | Types of indexes | B-Tree, FULLTEXT, SPATIAL, composite, covering, prefix |
| `03-EXPLAIN-Query-Optimization.md` | Query analysis | EXPLAIN output, access types, optimization workflow |

---

## Learning Path

```
01-Index-Fundamentals.md
        |
        v
02-Index-Types.md
        |
        v
03-EXPLAIN-Query-Optimization.md
```

Work through the files in order. Each builds on the previous.

---

## Prerequisites

- Phase 01-07 completed (SQL fundamentals through subqueries/CTEs)
- Comfortable writing SELECT, JOIN, GROUP BY, WHERE queries
- MySQL 8.0+ recommended (for EXPLAIN ANALYZE and invisible indexes)

---

## Key Takeaways

1. Indexes trade write speed and disk space for read speed
2. Not every column needs an index — choose based on query patterns
3. EXPLAIN is your best friend for diagnosing slow queries
4. Composite index column order matters (leftmost prefix rule)
5. A covering index is the gold standard — no row lookup needed
