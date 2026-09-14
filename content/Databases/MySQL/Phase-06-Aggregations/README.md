# Phase 6: Aggregations

## Overview

Aggregations are the engine of analytics in MySQL. This phase covers two major pillars:

1. **Aggregate Functions** — collapse many rows into a single summary value (COUNT, SUM, AVG, MIN, MAX, GROUP_CONCAT, and more)
2. **Window Functions** — compute values across a set of rows *without* collapsing the result set, enabling rankings, running totals, moving averages, and inter-row comparisons

---

## Files in This Phase

```
Phase-06-Aggregations/
├── README.md                    <- You are here
├── 01-Aggregate-Functions.md    <- GROUP BY, COUNT, SUM, AVG, conditional aggregation
└── 02-Window-Functions.md       <- OVER(), PARTITION BY, ranking, LAG/LEAD, frames
```

---

## Why Aggregations Matter

Raw transactional data answers "what happened." Aggregations answer "what does it mean."

- Total revenue per quarter
- Top 10 customers by lifetime value
- 30-day moving average of daily signups
- Percentage of total each product category contributes
- Ranking salespeople within each region

Every analytics query you will ever write leans on at least one concept from this phase.

---

## Learning Path

```
01-Aggregate-Functions.md
        |
        v
   Understand GROUP BY, HAVING,
   NULL handling, conditional agg
        |
        v
02-Window-Functions.md
        |
        v
   OVER(), PARTITION BY, frames,
   ranking, LAG/LEAD, running totals
```

Complete the exercises at the end of each file before moving on. The Interview Q&A sections are designed to prepare you for technical interviews.

---

## Prerequisites

- Phase 04 (Filtering & Sorting) — WHERE, ORDER BY
- Phase 05 (Joins) — multi-table context for aggregation

---

## Key Mental Models

| Concept | Mental Model |
|---|---|
| Aggregate Function | Blender — many rows in, one value out |
| GROUP BY | Sorting a deck of cards into piles by suit, then counting each pile |
| HAVING | WHERE that runs *after* the blender |
| Window Function | Sticky note on each row — row stays, note adds context |
| PARTITION BY | Separate leaderboard per category |
| Frame Clause | Sliding window of rows for running calculations |
