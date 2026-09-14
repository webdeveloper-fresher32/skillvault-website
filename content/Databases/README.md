# Databases — Course Family

Six courses covering database theory and the five storage engines a backend engineer is most likely to meet in production and in interviews. Start with `Fundamentals/` — it teaches the concepts every engine below implements differently, so learning it once beats re-learning it five times in five vendors' vocabularies.

---

## Overview

Every database course in this repo used to sit at the top level as an unrelated folder, which hid the fact that they mostly teach the same ideas. Indexing, ACID, isolation levels, replication, sharding and the CAP tradeoff are not MySQL topics or MongoDB topics — they are database topics, and each engine is one set of answers to them. `Fundamentals/` teaches those questions on their own terms, engine-agnostic, so that when MongoDB says "replica set" and Cassandra says "replication factor" you already know what problem both are solving and can spend your attention on how their answers differ.

After Fundamentals, each remaining course covers one data model end to end: relational (MySQL, then PostgreSQL), document (MongoDB), wide-column (Cassandra), and key-value (Redis). They are independent — take them in whatever order your work demands — but the ordering below is the one that builds fastest, because each course reuses vocabulary the previous one established.

---

## Family Structure

```
Databases/
├── Fundamentals/     → engine-agnostic theory: storage engines, indexing, ACID, distribution, CAP
├── MySQL/            → relational — the SQL baseline most teams and interviews assume
├── PostgreSQL/       → relational — types, extensions, MVCC, and what a database can do beyond CRUD
├── MongoDB/          → document — flexible schemas, aggregation pipelines, embedding vs referencing
├── Cassandra/        → wide-column — query-first modelling, tunable consistency, LSM storage
└── Redis/            → key-value — in-memory structures, caching patterns, pub/sub
```

Each subfolder is a complete course with numbered phases, per-phase READMEs, `Projects/` and `Quick-Reference/`. See the individual course README for its learning path.

---

## Learning Path

| Order | Course | Model | Difficulty | Time |
|-------|--------|-------|-----------|------|
| 1 | Fundamentals | — | Easy-Medium | 6 weeks |
| 2 | MySQL | Relational | Easy-Medium | 6 weeks |
| 3 | PostgreSQL | Relational | Medium | 6 weeks |
| 4 | MongoDB | Document | Medium | 6 weeks |
| 5 | Cassandra | Wide-column | Medium-Hard | 6 weeks |
| 6 | Redis | Key-value | Medium | 6 weeks |

Fundamentals first is a real recommendation, not a formality. Skipping it is why engineers can write a working `JOIN` for years and still not know why one query plan is a thousand times slower than another.

Short on time: Fundamentals → MySQL → MongoDB covers the ground most interviews actually test.

---

## Which Data Model, and Why

Data models are not interchangeable, and picking the wrong one is expensive to undo. Each fits a particular shape of data and access pattern:

```
Relational    → data with real relationships, queried in ways you cannot fully
                predict yet; you want the database to enforce correctness
Document      → self-contained records read and written whole, whose shape
                varies between records or changes often
Wide-column   → enormous write volume, known query patterns, and a hard
                requirement to stay available across datacenters
Key-value     → you already know the exact key, and you want the answer in
                microseconds
```

---

## Selection Matrix

"Which database would you choose, and why" is the most commonly asked database interview question, and the answer that scores is the one with a reason attached.

| Workload | Choose | Why |
|---|---|---|
| Orders, payments, inventory — anything where a wrong number is a real-world problem | PostgreSQL or MySQL | Multi-row ACID transactions and foreign keys let the database refuse invalid states instead of trusting every code path to be careful |
| Reporting and ad-hoc analytics over the same data | PostgreSQL | Window functions, CTEs and a mature planner handle analytical SQL that would need application code elsewhere |
| Product catalogue, CMS content, user profiles — records whose fields differ per item | MongoDB | Documents absorb shape variation without a migration for every new field |
| Event logs, sensor readings, activity feeds — huge write volume, queried by a known key and time range | Cassandra | Writes go to an append-only structure and scale linearly with nodes; the fixed access pattern is exactly what its model wants |
| Sessions, rate limiters, leaderboards, hot lookups | Redis | In-memory access with data structures that do the work server-side |
| Caching in front of any of the above | Redis | Purpose-built for it, with TTLs and eviction policies as first-class features |
| Full-text search over your primary data | PostgreSQL | `tsvector` search avoids running a second system until scale genuinely demands one |
| Multi-datacenter with no tolerable downtime, and eventual consistency is acceptable | Cassandra | No master node means no failover gap; consistency is tunable per query |
| You genuinely do not know the access patterns yet | PostgreSQL or MySQL | Relational is the model that punishes wrong guesses least — you can query it in ways you did not plan for |

The honest default: start relational unless you have a specific reason not to. Most "we need NoSQL for scale" decisions are made at a scale where a single well-indexed Postgres instance would have been fine for years, and the migration cost of leaving relational later is far lower than the cost of discovering you needed joins after modelling everything as documents.

---

## Cross-Engine Comparison

| | MySQL | PostgreSQL | MongoDB | Cassandra | Redis |
|---|---|---|---|---|---|
| Data model | Relational | Relational | Document | Wide-column | Key-value + structures |
| Query language | SQL | SQL | MQL / aggregation pipeline | CQL | Commands |
| Schema | Fixed, enforced | Fixed, enforced | Flexible per document | Fixed per table, query-driven | None |
| Transactions | ACID, multi-row | ACID, multi-row, serializable | ACID, multi-document | Row-level; LWT for the rest | Single-command atomic; MULTI/Lua |
| Storage engine | B+tree (InnoDB) | B+tree (heap + index) | B+tree (WiredTiger) | LSM tree | In-memory |
| Scaling | Vertical first, read replicas | Vertical first, read replicas | Horizontal via sharding | Horizontal, linear | Vertical, then cluster |
| Consistency | Strong | Strong | Tunable, strong by default | Tunable per query | Strong on primary |
| High availability | Replication + failover | Replication + failover | Replica set, automatic | Peer-to-peer, no master | Sentinel or Cluster |
| Joins | Yes | Yes | Limited (`$lookup`) | No, by design | No |
| Durability default | Durable | Durable | Durable | Durable | Configurable, memory-first |

Read across a row rather than down a column. The differences are consequences of each engine's core bet — Cassandra has no joins because joins cannot be made fast across a ring of independent nodes, and Redis is memory-first because microsecond reads are the entire point.

---

## Prerequisites

- No prior database experience. `Fundamentals/` starts from why a database exists at all rather than assuming you have used one.
- Comfort at a terminal — every engine course installs software and works in its shell client.
- Programming experience in any language helps for the integration lessons, but concepts are taught from scratch.

---

## Where to Start

Begin with [Fundamentals/README.md](Fundamentals/README.md).

Already write SQL day to day and want to skip theory: start at [MySQL/README.md](MySQL/README.md), and come back to Fundamentals Phases 05–10 when a query plan or a replication decision stops making sense.

Course entry points: [Fundamentals](Fundamentals/README.md) · [MySQL](MySQL/README.md) · [PostgreSQL](PostgreSQL/README.md) · [MongoDB](MongoDB/README.md) · [Cassandra](Cassandra/README.md) · [Redis](Redis/Phase-01-Redis-Fundamentals/01-What-is-Redis.md)

Redis has no course README — that was a deliberate choice when it was written, so its link above goes to the first lesson instead.

---

## Build Status

`MySQL/`, `MongoDB/` and `Redis/` are complete. `Fundamentals/`, `PostgreSQL/` and `Cassandra/` are being written — their links above resolve as each lands. See `docs/superpowers/plans/2026-08-08-databases-restructure.md` for the file-level plan.
