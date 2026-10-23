# Phase 02 — Data Definition Language (DDL)

## Overview

This phase covers the SQL statements used to **define, modify, and destroy database structures** — the schema layer that sits beneath all your queries. Before you can INSERT a row, SELECT a column, or JOIN two tables, those structures must exist and be correctly typed. DDL is how you build the architecture.

**Duration:** 1 week  
**Prerequisite:** Phase 01 (MySQL Setup & Fundamentals)  
**Next phase:** Phase 03 — DML (INSERT, UPDATE, DELETE)

---

## What DDL Covers

```
DDL Statements
├── CREATE   — define new objects (tables, indexes, views, databases)
├── ALTER    — modify existing objects
├── DROP     — permanently delete objects
├── TRUNCATE — remove all rows but keep structure
└── RENAME   — rename objects
```

DDL statements are **auto-committed** in MySQL — there is no ROLLBACK after a DROP TABLE. Work carefully.

---

## Files in This Phase

| File | Topic | Lines |
|------|-------|-------|
| `01-CREATE-Tables.md` | CREATE TABLE syntax, constraints, LIKE, AS SELECT, TEMPORARY | ~450 |
| `02-ALTER-DROP.md` | ALTER TABLE, DROP TABLE, TRUNCATE, RENAME, algorithms | ~450 |
| `03-Data-Types.md` | Integer, decimal, string, date/time, JSON, ENUM, SET | ~550 |
| `04-Constraints.md` | PK, FK, UNIQUE, NOT NULL, DEFAULT, CHECK, AUTO_INCREMENT | ~450 |

---

## Week Plan

| Day | Focus |
|-----|-------|
| Monday | Read `01-CREATE-Tables.md`, do 3 of 5 exercises |
| Tuesday | Finish CREATE exercises, read `03-Data-Types.md` |
| Wednesday | Data type exercises, type selection practice |
| Thursday | Read `02-ALTER-DROP.md`, practice schema migrations |
| Friday | Read `04-Constraints.md`, FK + CHECK exercises |
| Weekend | Review all Q&A sections, build the capstone schema |

---

## Capstone Exercise

By end of week, build a normalized **e-commerce schema** from scratch:

```sql
-- Tables to create:
-- customers, addresses, categories, products,
-- orders, order_items, payments, reviews

-- Requirements:
-- All PKs use AUTO_INCREMENT
-- All FKs have appropriate ON DELETE actions
-- Use CHECK constraints for price > 0, rating BETWEEN 1 AND 5
-- Use appropriate types (DECIMAL for money, TIMESTAMP for audit cols)
-- At least 2 UNIQUE constraints beyond PKs
```

---

## Key Takeaways for This Phase

1. **DDL is permanent** — always script it, version-control it, test on dev first
2. **Types matter for storage and performance** — don't use VARCHAR(255) for everything
3. **Constraints enforce data integrity at the database level** — not just in application code
4. **ALTER TABLE can lock tables** — understand ALGORITHM and LOCK options before running on prod
5. **Schema design decisions made here are expensive to undo** — think before you CREATE
