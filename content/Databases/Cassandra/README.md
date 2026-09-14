# Apache Cassandra — Complete Learning Course

Master Cassandra from its architecture through production operation: the token ring and why there is no master, query-first data modelling, tunable consistency and the `R + W > RF` rule, LSM storage and compaction, tombstones and why deletes are expensive, repair, multi-datacenter deployment, and the anti-patterns that cause most real-world failures. Targets Apache Cassandra 5.0.

---

## Overview

Cassandra is the database you choose when you need to absorb enormous write volume across multiple datacenters and stay available even when parts of the cluster cannot talk to each other. It gets there by giving things up: there are no joins, no foreign keys, no meaningful ad-hoc querying, and by default no strong consistency. Those are not gaps waiting to be filled in a future release — they are the price of the architecture, paid deliberately.

The trap is that CQL looks like SQL. Tables, rows, `SELECT`, `INSERT`, `WHERE`. That familiarity leads people to model data the way they would in a relational database — normalized entities, queried however the application happens to need — and then discover the cluster falls over under load. Almost every Cassandra horror story traces back to that one mistake. So this course fights it directly: an entire phase is devoted to query-first modelling, and the relational habits that break here are called out by name.

The course starts from the architecture rather than the syntax, because in Cassandra the data model is downstream of how data is physically distributed — you cannot design a table sensibly without knowing what a partition key does to placement. From there it covers CQL properly, tunable consistency, the LSM storage engine and compaction, the read and write paths and why writes are fast and deletes are not, indexing (including Storage-Attached Indexing in 5.0), operations, tuning, and production concerns.

---

## Course Structure

```
Cassandra/
├── Phase-01-Fundamentals/                     → what Cassandra is, Dynamo & Bigtable heritage, when NOT to use it, cqlsh
├── Phase-02-Architecture/                     → the token ring & no master, vnodes & partitioners, gossip & snitches
├── Phase-03-Data-Model-and-CQL-Basics/        → keyspaces & tables, why CQL is not SQL, partition & clustering keys
├── Phase-04-Query-First-Data-Modelling/       → model from access patterns, one table per query, Chebotko diagrams
├── Phase-05-CQL-in-Depth/                     → collections & their costs, UDTs/counters/TTL, LWTs, batches and their misuse
├── Phase-06-Replication-and-Tunable-Consistency/ → replication strategies, consistency levels, R+W>RF, hinted handoff
├── Phase-07-Storage-Engine-Internals/         → commitlog/memtable/SSTables, compaction strategies, bloom filters
├── Phase-08-Write-and-Read-Paths/             → the write path, the read path & caches, tombstones and the delete problem
├── Phase-09-Indexing/                         → why secondary indexes scale badly, materialized views, SAI, index tables
├── Phase-10-Multi-DC-Scaling-and-Operations/  → adding & removing nodes, nodetool, repair, multi-datacenter deployment
├── Phase-11-Performance-and-Troubleshooting/  → tracing & metrics, JVM/GC tuning, wide & hot partitions, anti-patterns
├── Phase-12-Security-Drivers-and-Production/  → auth & encryption, driver best practice, vector search, readiness checklist
├── Projects/                                  → hands-on builds combining multiple phases
└── Quick-Reference/                           → Cheatsheet + Interview Q&A
```

Every phase directory has its own `README.md` summarising that phase's lessons, plus numbered lesson files (`01-...md`, `02-...md`).

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Fundamentals | Easy | 4 days |
| 02 | Architecture | Medium | 4 days |
| 03 | Data Model and CQL Basics | Easy-Medium | 3 days |
| 04 | Query-First Data Modelling | Medium-Hard | 4 days |
| 05 | CQL in Depth | Medium | 4 days |
| 06 | Replication and Tunable Consistency | Medium-Hard | 4 days |
| 07 | Storage Engine Internals | Hard | 3 days |
| 08 | Write and Read Paths | Medium-Hard | 3 days |
| 09 | Indexing | Medium-Hard | 4 days |
| 10 | Multi-DC, Scaling and Operations | Hard | 4 days |
| 11 | Performance and Troubleshooting | Hard | 4 days |
| 12 | Security, Drivers and Production | Medium | 4 days |
| Projects | Hands-on builds (combines phases 3–11) | Medium-Hard | 5-7 days |

**Total estimated time: 9 weeks** (45 phase-days + 5-7 project-days ≈ 50-52 days)

Phase 04 is the centre of gravity. Everything before it exists to make it make sense, and everything after it assumes it. If you take one thing from this course, take that one.

---

## Prerequisites

- [Fundamentals](../Fundamentals/README.md) is strongly recommended, particularly Phase 10 (replication, partitioning, CAP, quorums) — Cassandra is a direct application of those ideas and the course assumes the vocabulary.
- Familiarity with SQL is useful mainly as a contrast. Expect to unlearn as much as you apply.
- Comfort at a terminal, and enough Java awareness to read JVM heap and GC settings in Phase 11. No Java programming required.

---

## Where to Start

Begin with [Phase-01-Fundamentals/README.md](Phase-01-Fundamentals/README.md).

Evaluating whether Cassandra is the right choice at all: read Phase 1 Lesson 3, "When Not to Use Cassandra", first. It is the most useful lesson in the course for that decision, and the [family selection matrix](../README.md) puts it in context.
