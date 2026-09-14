# Phase 03 — DML: CRUD Operations

## Overview

This phase covers the four core **Data Manipulation Language (DML)** statements in MySQL:
INSERT, SELECT, UPDATE, and DELETE. These are the verbs of SQL — everything a running
application does to read and write data flows through these four commands.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CRUD Map                                 │
├──────────┬──────────────┬──────────────────────────────────────┤
│  Letter  │  Operation   │  SQL Statement                       │
├──────────┼──────────────┼──────────────────────────────────────┤
│    C     │   Create     │  INSERT INTO                         │
│    R     │   Read       │  SELECT ... FROM                     │
│    U     │   Update     │  UPDATE ... SET                      │
│    D     │   Delete     │  DELETE FROM                         │
└──────────┴──────────────┴──────────────────────────────────────┘
```

---

## Files in This Phase

```
Phase-03-DML-CRUD/
├── README.md          ← you are here
├── 01-INSERT.md       ← writing rows into tables
├── 02-SELECT.md       ← reading and shaping data
├── 03-UPDATE.md       ← modifying existing rows
└── 04-DELETE.md       ← removing rows safely
```

---

## Learning Goals

By the end of this phase you will be able to:

- Insert single rows, batches, and copied subsets without touching the application layer
- Write SELECT queries that filter, sort, page, and compute derived columns
- Update rows safely using WHERE guards, expressions, and multi-table JOINs
- Delete rows individually, in bulk, or softly without touching the schema
- Explain the performance implications of each statement and tune them

---

## Prerequisites

- Phase 01: Database design & DDL (CREATE TABLE, data types, constraints)
- Phase 02: Filtering basics (WHERE, comparison operators, NULL handling)

---

## Recommended Order

Work through 01 → 02 → 03 → 04. SELECT is referenced in INSERT examples; DELETE builds
on UPDATE's soft-delete pattern.
