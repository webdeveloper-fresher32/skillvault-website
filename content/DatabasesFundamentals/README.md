# Database Fundamentals — Complete Learning Course

Learn what every database is doing underneath, before learning any particular one. This course covers storage engines, indexing, query optimization, transactions and isolation, crash recovery, replication and sharding, and the tradeoffs behind choosing a database at all — taught engine-agnostically, so the knowledge transfers to MySQL, PostgreSQL, MongoDB, Cassandra, Redis, and whatever comes next.

---

## Overview

Most people learn databases the other way round: they learn MySQL, and years later discover that half of what they know is MySQL trivia and the other half is database theory they were never told the name of. That gap shows up the first time a query plan is inexplicably slow, or a "REPEATABLE READ" setting silently permits a bug, or a team argues about sharding without agreeing what consistency they are giving up.

This course teaches the theory directly. It starts from why a database exists at all rather than storing data in files, and builds through data models, relational design and normalization, and SQL as a way of thinking. The middle of the course goes under the hood: pages and B+ trees and LSM trees, what an index physically is and what it costs, how a cost-based optimizer picks a plan, and how ACID is actually implemented through locking, MVCC and the write-ahead log. The back half is distributed systems as they apply to data: replication topologies, partitioning, quorums, consensus, the CAP tradeoff stated precisely rather than as a slogan, and distributed transactions. It closes on the practical decisions — caching, scaling, migrations, security, and a framework for choosing an engine and defending the choice in an interview.

No vendor syntax is required. SQL examples use standard SQL and are labelled as illustrative; the point is always the concept the engine is implementing.

---

## Course Structure

```
Fundamentals/
├── Phase-01-What-Is-a-Database/                  → files vs a DBMS, OLTP vs OLAP, the database landscape
├── Phase-02-Data-Models/                         → relational, document, key-value, wide-column, graph, time-series, vector
├── Phase-03-Relational-Theory-and-Schema-Design/ → keys & relationships, ER modelling, normalization 1NF–BCNF, when to denormalize
├── Phase-04-SQL-Foundations/                     → declarative thinking, relational algebra behind joins, logical processing order, NULL logic
├── Phase-05-Storage-Engines/                     → pages & row vs column, B+ trees, LSM trees & SSTables, WAL & buffer pool
├── Phase-06-Indexing-Theory/                     → what an index costs, clustered/secondary/covering, composite order, index types
├── Phase-07-Query-Processing-and-Optimization/   → parse-plan-execute, cost & statistics, join algorithms, reading a plan
├── Phase-08-Transactions-and-Concurrency/        → ACID precisely, the anomalies, isolation levels, locking & MVCC
├── Phase-09-Reliability-and-Recovery/            → crash recovery, backups & PITR, RPO/RTO & restore testing
├── Phase-10-Distributed-Databases/               → replication, partitioning, CAP & PACELC, quorums & consensus, 2PC & sagas
├── Phase-11-Performance-Scaling-and-Caching/     → measuring first, pooling & replicas, caching patterns, N+1 & capacity
├── Phase-12-Choosing-and-Operating/              → selection framework, zero-downtime migrations, security, interview capstone
├── Projects/                                     → design exercises combining multiple phases
└── Quick-Reference/                              → Cheatsheet + Interview Q&A
```

Every phase directory has its own `README.md` summarising that phase's lessons, plus numbered lesson files (`01-...md`, `02-...md`).

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | What Is a Database | Easy | 3 days |
| 02 | Data Models | Easy | 3 days |
| 03 | Relational Theory and Schema Design | Easy-Medium | 4 days |
| 04 | SQL Foundations | Easy-Medium | 4 days |
| 05 | Storage Engines | Medium | 4 days |
| 06 | Indexing Theory | Medium | 4 days |
| 07 | Query Processing and Optimization | Medium-Hard | 4 days |
| 08 | Transactions and Concurrency | Medium-Hard | 4 days |
| 09 | Reliability and Recovery | Medium | 3 days |
| 10 | Distributed Databases | Hard | 5 days |
| 11 | Performance, Scaling and Caching | Medium-Hard | 4 days |
| 12 | Choosing and Operating a Database | Medium-Hard | 4 days |
| Projects | Design exercises (combines phases 3–12) | Medium-Hard | 5-7 days |

**Total estimated time: 8 weeks** (46 phase-days + 5-7 project-days ≈ 51-53 days)

Phases 01–04 are the foundation and should be read in order. Phases 05–08 are the core of the course and where most of the difficulty lives. Phases 09–12 are self-contained enough to read out of order if a specific problem is pressing.

---

## Prerequisites

- No prior database experience. Phase 1 starts from why a database exists at all.
- Programming experience in any language helps for reading examples, but no particular language is assumed.
- Comfort at a terminal is useful for the exercises, though many are design and analysis tasks rather than commands to run.

---

## Where to Start

Begin with [Phase-01-What-Is-a-Database/README.md](Phase-01-What-Is-a-Database/README.md).

When you finish, pick an engine: [MySQL](../MySQL/README.md) for the relational baseline, [MongoDB](../MongoDB/README.md) for documents, or see the [family hub](../README.md) for the full selection matrix.
