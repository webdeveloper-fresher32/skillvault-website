# PostgreSQL — Complete Learning Course

Master PostgreSQL from installation through production operation: its unusually rich type system, six index types and what each is actually for, `jsonb` and full-text search, MVCC and why `VACUUM` exists, reading `EXPLAIN (ANALYZE, BUFFERS)` line by line, server-side programming, replication and partitioning, and the security and backup work that makes it safe to run. Targets PostgreSQL 18.

---

## Overview

If MySQL taught you SQL, PostgreSQL teaches you what a database can do. The gap is not syntax — most queries are portable — it is capability. Postgres gives you exact numeric types and a `timestamptz` that handles time zones correctly, arrays and ranges and composite types as first-class values, six index types where most engines have one or two, `jsonb` that is both queryable and indexable so document data does not require a second database, full-text search good enough to defer running a dedicated search engine, and an extension mechanism that has produced PostGIS for geospatial and pgvector for embeddings.

That capability comes with things you must understand to run it well. MVCC keeps readers from blocking writers, but it leaves dead tuples behind, which is why `VACUUM` and autovacuum exist and why ignoring them eventually causes bloat and, at the extreme, transaction ID wraparound. Every connection is a process, which is why connection pooling is not optional at scale. The planner is excellent but only as good as its statistics.

This course covers both halves: the features that make Postgres worth choosing, and the operational knowledge that makes it stay fast. It assumes no prior Postgres experience but moves quickly through the SQL that the MySQL course already covers, spending its time on what is genuinely different.

---

## Course Structure

```
PostgreSQL/
├── Phase-01-Fundamentals-and-Setup/            → what Postgres is, install & psql, process architecture and memory
├── Phase-02-Data-Types-and-DDL/                → the type system as a feature, arrays/JSON/ranges, constraints incl. EXCLUDE
├── Phase-03-DML-and-Core-Querying/             → RETURNING, upsert with ON CONFLICT, COPY for bulk load
├── Phase-04-Joins-Aggregation-and-Windows/     → joins & DISTINCT ON, GROUPING SETS, window functions and frames
├── Phase-05-Subqueries-CTEs-and-Recursion/     → correlated subqueries, CTE materialization, recursive CTEs, LATERAL
├── Phase-06-Indexing/                          → B-tree & Hash, GIN/GiST/SP-GiST/BRIN, partial & covering, CONCURRENTLY
├── Phase-07-JSON-Search-and-Extensions/        → jsonb operators & indexing, full-text search, the extension ecosystem
├── Phase-08-Transactions-and-MVCC/             → isolation levels & SSI, MVCC internals, locks, SKIP LOCKED, advisory locks
├── Phase-09-Query-Planning-and-Performance/    → EXPLAIN (ANALYZE, BUFFERS), planner statistics, VACUUM & bloat, tuning
├── Phase-10-Server-Programming/                → PL/pgSQL, triggers, materialized views, LISTEN/NOTIFY, FDWs
├── Phase-11-Replication-HA-and-Partitioning/   → WAL & streaming replication, slots, logical replication & CDC, partitioning
├── Phase-12-Security-Backup-and-Production/    → roles & RLS, pg_hba.conf & SSL, pg_dump & PITR, PgBouncer, upgrades
├── Projects/                                   → hands-on builds combining multiple phases
└── Quick-Reference/                            → Cheatsheet + Interview Q&A
```

Every phase directory has its own `README.md` summarising that phase's lessons, plus numbered lesson files (`01-...md`, `02-...md`).

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Fundamentals and Setup | Easy | 3 days |
| 02 | Data Types and DDL | Easy | 4 days |
| 03 | DML and Core Querying | Easy | 3 days |
| 04 | Joins, Aggregation and Window Functions | Easy-Medium | 3 days |
| 05 | Subqueries, CTEs and Recursion | Medium | 4 days |
| 06 | Indexing | Medium | 4 days |
| 07 | JSON, Full-Text Search and Extensions | Medium | 4 days |
| 08 | Transactions and MVCC | Medium-Hard | 4 days |
| 09 | Query Planning and Performance | Hard | 4 days |
| 10 | Server Programming | Medium | 4 days |
| 11 | Replication, HA and Partitioning | Hard | 4 days |
| 12 | Security, Backup and Production | Medium-Hard | 4 days |
| Projects | Hands-on builds (combines phases 2–11) | Medium-Hard | 5-7 days |

**Total estimated time: 8 weeks** (45 phase-days + 5-7 project-days ≈ 50-52 days)

Phases 06, 08 and 09 are the ones that separate someone who uses Postgres from someone who can operate it. Do not skip them.

---

## Prerequisites

- Basic SQL — `SELECT`, `WHERE`, `JOIN`, `GROUP BY`. The [MySQL course](../MySQL/README.md) or [Fundamentals Phase 4](../Fundamentals/Phase-04-SQL-Foundations/README.md) covers this.
- [Fundamentals](../Fundamentals/README.md) is strongly recommended first — Phases 08 and 09 here assume you know what MVCC, isolation levels and a query plan are in the abstract.
- Comfort at a terminal. The whole course works in `psql`.

---

## Where to Start

Begin with [Phase-01-Fundamentals-and-Setup/README.md](Phase-01-Fundamentals-and-Setup/README.md).

Coming from MySQL: Phase 1 Lesson 1 is written specifically for you and states the differences that matter up front.
