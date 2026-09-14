# Databases Restructure + Three New Courses — Design Spec

Date: 2026-08-08

## Purpose

Consolidate every database course in SkillVault under one top-level `Databases/` folder, lead with a database-agnostic `Fundamentals` course that teaches database theory from basics to advanced, and add two new engine courses (PostgreSQL, Cassandra) so the family covers the four major storage models a backend engineer meets in practice and in interviews.

Today `MongoDB/`, `MySQL/`, and `Redis/` sit as three unrelated top-level folders next to `Docker/`, `React/`, `AWS/`, etc. Nothing tells a learner these three belong together, nothing teaches the concepts they share (ACID, indexing, replication, sharding, CAP), and each course re-explains those shared concepts from its own engine's point of view. A learner who finishes MySQL and starts MongoDB reads normalization theory twice and consistency theory zero times.

## Scope

**In scope**
- New `Databases/` parent folder.
- Move `MongoDB/`, `MySQL/`, `Redis/` into it, unchanged in content, via `git mv` (preserves history).
- New `Databases/Fundamentals/` — 12-phase database-agnostic course, basics through advanced.
- New `Databases/PostgreSQL/` — 12-phase course.
- New `Databases/Cassandra/` — 12-phase course.
- New `Databases/README.md` — family hub: which database to learn, in what order, and a selection matrix.
- Update `CLAUDE.md` (course list + structure docs) and fix every internal link broken by the move.

**Out of scope**
- Rewriting existing MongoDB/MySQL/Redis lesson content into the newer lean format. They keep their current format; this is a move, not a rewrite. (Backfilling them was offered and deliberately not chosen.)
- Any other top-level course folder.

## Target Structure

```
Databases/
├── README.md                    → family hub, selection matrix, learning order
├── Fundamentals/                → NEW — engine-agnostic theory, basics → advanced
│   ├── Phase-01..12-<Topic>/
│   ├── Projects/
│   ├── Quick-Reference/
│   └── README.md
├── MySQL/                       → MOVED (unchanged)
├── PostgreSQL/                  → NEW
├── MongoDB/                     → MOVED (unchanged)
├── Cassandra/                   → NEW
└── Redis/                       → MOVED (unchanged)
```

Ordering rationale: theory first, then relational (MySQL → PostgreSQL), then document (MongoDB), then wide-column (Cassandra), then key-value (Redis). That is also the recommended learning order, and it maps one course to each major data model.

## Course 1 — Fundamentals (engine-agnostic)

The course a learner should finish before touching any engine. No vendor syntax except where a short example makes a concept concrete; examples use standard SQL or pseudocode and are labelled as illustrative.

1. **What Is a Database** — files vs. a DBMS, what a DBMS actually buys you (concurrency, durability, query planning, integrity), OLTP vs. OLAP vs. HTAP, the database landscape map, client/server architecture
2. **Data Models** — relational, document, key-value, wide-column, graph, time-series, vector/embedding; the shape of data each fits; how the same domain looks modelled six ways; how to pick
3. **Relational Theory and Schema Design** — relations/tuples/keys, primary vs. foreign vs. candidate vs. composite keys, ER modelling and cardinality, functional dependencies, normalization 1NF→2NF→3NF→BCNF worked on one running example, when denormalization is correct
4. **SQL Foundations** — declarative vs. imperative thinking, DDL/DML/DQL/DCL/TCL, the relational-algebra basis of joins and set operations, logical query processing order (FROM→WHERE→GROUP BY→HAVING→SELECT→ORDER BY→LIMIT) and why it explains most SQL surprises, NULL and three-valued logic
5. **Storage Engines and Physical Layout** — pages/blocks, heap files, row-store vs. column-store and what each is fast at, B+ trees, LSM trees and SSTables, the write-amplification vs. read-amplification tradeoff between the two, write-ahead log, buffer pool/page cache
6. **Indexing Theory** — what an index costs on write and in space, clustered vs. secondary, composite index column order and the leftmost-prefix rule, covering indexes, selectivity and cardinality, index types (B-tree, hash, bitmap, inverted, spatial) and when each wins, why the optimizer sometimes ignores your index
7. **Query Processing and Optimization** — parse → rewrite → plan → execute, cost-based optimization, table statistics and histograms, join algorithms (nested loop, hash, merge) and the conditions each needs, how to read any engine's execution plan, common plan pathologies
8. **Transactions and Concurrency** — ACID precisely, the anomalies (dirty read, non-repeatable read, phantom, write skew, lost update), the four isolation levels defined by which anomalies they permit, pessimistic locking and two-phase locking, MVCC and snapshot isolation, deadlocks and how engines break them
9. **Reliability, Durability and Recovery** — crash recovery, WAL/redo/undo, checkpoints, fsync and the durability/latency tradeoff, backup types (full, incremental, differential, logical vs. physical), point-in-time recovery, RPO and RTO, restore testing
10. **Distributed Databases** — why distribute, replication topologies (single-leader, multi-leader, leaderless), synchronous vs. asynchronous replication and replication lag, read-your-writes and other consistency guarantees, partitioning/sharding strategies, consistent hashing, rebalancing, CAP and its widely-misread claim, PACELC, quorums (R+W>N), consensus (Raft at a working level), distributed transactions (2PC and its blocking problem, sagas)
11. **Performance, Scaling and Caching** — measuring before tuning, connection pooling, read replicas and their staleness cost, cache-aside/read-through/write-through/write-behind, cache invalidation and stampedes, the N+1 query problem, batching and bulk loading, vertical vs. horizontal scaling, capacity planning, what to monitor
12. **Choosing and Operating a Database** — a decision framework and selection matrix, polyglot persistence and its real cost, schema migrations and zero-downtime change (expand/contract), security fundamentals (authentication, authorization/RBAC, encryption in transit and at rest, SQL injection and how parameterization actually prevents it, auditing, PII), cost modelling, managed vs. self-hosted, interview strategy capstone

## Course 2 — PostgreSQL

Targets **PostgreSQL 18** (current release). Positioned as "MySQL taught you SQL; Postgres teaches you what a database can do."

1. **Fundamentals and Setup** — what Postgres is and where it differs from MySQL, install paths, `psql` essentials, process architecture (postmaster, backend per connection, background writer, WAL writer), shared buffers, cluster/database/schema hierarchy
2. **Data Types and DDL** — the type system as a feature (numeric exactness, `text`, `timestamptz` vs. `timestamp`, `interval`, `uuid`, arrays, `hstore`, ranges, enums, domains, composite types), `CREATE TABLE`, identity vs. serial, constraints including `EXCLUDE`, generated columns
3. **DML and Core Querying** — `INSERT`/`SELECT`/`UPDATE`/`DELETE`, `RETURNING`, upsert via `ON CONFLICT`, `COPY` for bulk load, `DISTINCT ON`
4. **Joins, Aggregation and Window Functions** — join types, `GROUP BY`/`HAVING`, `GROUPING SETS`/`ROLLUP`/`CUBE`, `FILTER`, ordered-set and aggregate functions, window functions and frame clauses
5. **Subqueries, CTEs and Recursion** — correlated subqueries, CTEs and their materialization behaviour, recursive CTEs for trees and graphs, `LATERAL` joins
6. **Indexing in PostgreSQL** — B-tree, Hash, GiST, SP-GiST, GIN, BRIN — what each is *for*, partial indexes, expression indexes, covering indexes with `INCLUDE`, multicolumn ordering, index-only scans, `CREATE INDEX CONCURRENTLY`
7. **JSON, Full-Text Search and Extensions** — `json` vs. `jsonb`, operators and path queries, indexing `jsonb` with GIN, `tsvector`/`tsquery` and ranking, `pg_trgm` fuzzy search, the extension ecosystem (PostGIS, pgvector, pg_stat_statements, TimescaleDB)
8. **Transactions, MVCC and Concurrency** — isolation levels as implemented (including true serializable via SSI), MVCC internals (`xmin`/`xmax`, tuple visibility), row and table locks, `SELECT ... FOR UPDATE`/`SKIP LOCKED` queue patterns, advisory locks, deadlock detection
9. **Query Planning and Performance** — `EXPLAIN (ANALYZE, BUFFERS)` read line by line, plan nodes, planner statistics and `ANALYZE`, why `VACUUM` exists (dead tuples, bloat, transaction ID wraparound), autovacuum tuning, key `postgresql.conf` memory settings, `pg_stat_statements`
10. **Server Programming** — PL/pgSQL functions and procedures, triggers (row vs. statement, `BEFORE`/`AFTER`/`INSTEAD OF`), views vs. materialized views and refresh, `LISTEN`/`NOTIFY`, foreign data wrappers
11. **Replication, High Availability and Partitioning** — WAL mechanics, streaming replication, replication slots, synchronous commit levels, logical replication and its uses (upgrades, CDC), failover and Patroni, declarative partitioning with partition pruning
12. **Security, Backup and Production** — roles and `GRANT`, row-level security, `pg_hba.conf` and authentication methods, SSL, `pg_dump`/`pg_restore`/`pg_basebackup`, PITR with WAL archiving, connection pooling with PgBouncer and why Postgres needs it, major-version upgrades, monitoring, production checklist

## Course 3 — Cassandra

Targets **Apache Cassandra 5.0**. The course must fight the learner's relational instincts explicitly — most Cassandra failures are relational habits applied to a wide-column store.

1. **Fundamentals** — the problem Cassandra was built for, its Dynamo (distribution) + Bigtable (data model) heritage, AP positioning, when Cassandra is the right answer and the more important when-it-is-not, install and `cqlsh`
2. **Architecture** — the token ring, no master and what that removes, virtual nodes, partitioners, gossip, snitches and topology awareness, the coordinator node's job, request flow end to end
3. **Data Model and CQL Basics** — keyspaces and tables, why CQL looks like SQL but is not, the primary key decomposed (partition key + clustering columns), how the partition key decides physical placement, clustering order
4. **Query-First Data Modelling** — the core discipline: model from access patterns, not entities; one table per query; deliberate denormalization and duplicate writes; Chebotko diagrams; a worked multi-table design; the relational habits that break here
5. **CQL in Depth** — types, collections (set/list/map) and their hidden costs, UDTs, counters, TTL, lightweight transactions and their price, batches and the common misuse of them
6. **Replication and Tunable Consistency** — replication factor, `SimpleStrategy` vs. `NetworkTopologyStrategy`, per-query consistency levels, the `R + W > RF` rule worked through concretely, hinted handoff, read repair, anti-entropy
7. **Storage Engine Internals** — the LSM tree in Cassandra's terms, commitlog, memtable, SSTable structure, compaction strategies (STCS, LCS, TWCS) and choosing one from the workload, bloom filters, partition index and summary
8. **Write and Read Paths** — the write path step by step and why writes are fast, the read path and what it must merge, key and row caches, tombstones, and the tombstone problem as its own treatment (why deletes hurt, `gc_grace_seconds`, queue anti-pattern)
9. **Indexing: Secondary Indexes, Materialized Views and SAI** — why classic secondary indexes scale badly, materialized views and their caveats, Storage-Attached Indexing in 5.0, the denormalized index-table pattern that is usually the right answer
10. **Multi-Datacenter, Scaling and Operations** — bootstrapping and decommissioning nodes, `nodetool` as the daily tool, repair (full, incremental, subrange) and why it is mandatory, multi-DC deployment and local-quorum reads, backup and restore
11. **Performance Tuning and Troubleshooting** — tracing a query, the metrics that matter, JVM heap and GC tuning, partition size limits and how to detect hot or wide partitions, the anti-pattern catalogue
12. **Security, Drivers and Production** — authentication and authorization, encryption in transit and at rest, driver usage and best practice (prepared statements, paging, retry and load-balancing policies) in Java/Python/Node, Cassandra 5.0 vector search, managed options (Astra), production readiness checklist

## Databases/README.md — Family Hub

Not a course README. Its job is orientation:
- What the family covers and the recommended order (Fundamentals first, always).
- A data-model map: which course teaches which model.
- A **selection matrix** — workload shape vs. recommended engine, with the reasoning, because "which database would you choose and why" is the single most common database interview question.
- Cross-engine comparison tables (consistency model, scaling model, transaction support, query language, typical use cases).
- Links into each course README.

## Lesson Format

New content uses the repo's newest lean, code-dense lesson format, as shipped in NextJS Phases 7–9 (the current end state of the format evolution recorded in `docs/superpowers/specs/2026-07-31-nextjs-course-design.md` lines 51–92). NextJS Phase 6 is a transitional variant and is **not** the reference. Redis and MongoDB/MySQL use the older prose-heavy template and are also not the reference.

**Reference files to copy structure from:**

| Artifact | Copy from |
|---|---|
| Lesson, with diagram section | `NextJS/Phase-07-Middleware-and-Authentication/01-Middleware-Basics.md` (239 lines, 9 sections) |
| Lesson, without diagram section | `NextJS/Phase-08-Styling-and-UI/02-Tailwind-Integration.md` (200 lines, 8 sections) |
| Phase README | `NextJS/Phase-09-Caching-and-Performance/README.md` (27 lines) |
| Course README | `PaymentGateways/README.md` |
| `Projects/README.md` | `PaymentGateways/Projects/README.md` |
| Project entry | `Redis/Projects/01-Simple-Key-Value-Cache.md` |
| Cheatsheet | `PaymentGateways/Quick-Reference/Cheatsheet.md` |
| Interview Q&A | `Redis/Quick-Reference/Interview-QA.md` |

### Lesson skeleton (hard invariants, verified across the 9 newest lesson files)

```markdown
# <Lesson Title> — Complete Guide

> "<one-sentence real-world analogy, in double quotes, inside a blockquote>"

---

## Table of Contents

1. [The Problem: <specific pain>](#1-the-problem-specific-pain)
2. [The <Analogy Noun> Analogy](#2-the-analogy-noun-analogy)
3. [The Mechanism: <bare identifiers, no backticks>](#3-the-mechanism-)
4. [Diagram: <what it shows>](#4-diagram-)            ← optional; omit → 8 sections
5. [Code Walkthrough: <what is built>](#5-code-walkthrough-)
6. [Comparing <A> to <B>](#6-comparing-a-to-b)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)
```

- Line 1 title uses an em dash and ends `— Complete Guide`. Line 3 is the analogy blockquote. Line 5 is `---`.
- 8 or 9 numbered sections (9 only when a `Diagram:` section is present). Sections separated by blank line, `---`, blank line.
- Sections 1–6 carry 2–3 `###` sub-headings each; sections 7, 8, 9 have none. 11–14 `###` per file.
- **Exactly 5** Hands-On Exercises, **exactly 5** Interview Q&A pairs. Always.
- Total 200–248 lines, mean ≈ 231.
- File ends on the last Q&A answer. No "Next Lesson" link, no memory hook, no summary.
- Anchors follow GitHub slugify: `## 9. Interview Q&A` → `#9-interview-qa` (the `&` is dropped); dots, colons and apostrophes are deleted.

Section-level conventions:
- **§1 The Problem** — one short paragraph, then sub-headings whose payload is a ```` ```text ```` block, closing on a `### What's Missing` sub-heading.
- **§2 Analogy** — one paragraph restating the pull-quote, then a ```` ```text ```` two-column mapping using `→`, then `### Mapping the Analogy to <Tech>`.
- **§3–5** — 1–2 sentences, then a language-tagged fenced block. Repeat. `↳` (U+21B3) annotates specific lines inside `text` blocks. ASCII diagrams use `│ ▼ ┌ ┴ ┐ ─` and are followed by `### Reading the Diagram`.
- **§6 Comparison** — lead sentence → `### <A> vs <B>` → markdown table (headerless first column, `|---|` separators) → `### Takeaway`.
- **§7 Common Mistakes** — 3–4 `-` bullets, each opening with a **bold sentence ending in a period**, then prose in the same bullet.
- **§8 Exercises** — five paragraphs opening `**Exercise N:**`. Not a numbered list, not sub-headings. Later exercises deliberately reproduce a mistake from §6/§7.
- **§9 Interview Q&A** — `**Q: …?**` bold line, answer paragraph on the *immediately following line* with no blank line between them, blank line before the next Q. No numbering, no `A:` prefix, no `---` separators. Answers are 2–5 sentence paragraphs that read as something spoken aloud.

### Phase README (27 lines, fixed)

`# Phase N: <Title>` (not zero-padded, colon separator — unlike the directory name) → `## What You'll Learn` (one sentence) → `## Learning Objectives` (3 bullets) → `## Topics` (table `| File | Topic | Time |`, link text = bare filename) → `## Estimated Time` → `## Next Phase` (forward arrow link only; there is no "Previous Phase" link anywhere in the repo).

### Course README

Order: H1 `# <Course> — Complete Learning Course` → un-headed intro paragraph → `## Overview` → `## Course Structure` (bare ``` fence, box-drawing tree, each phase line trailing-slashed and padded to a `→` gloss) → `## Learning Path` (table `| Phase | Topic | Difficulty | Time |`, zero-padded phase numbers, difficulty vocabulary Easy / Easy-Medium / Medium / Medium-Hard / Hard, final `Projects` row) → bold total-time line → `## Prerequisites` → `## Where to Start`. Sections separated by `---`. **No table of contents, no anchor links, no emoji** — the TOC style belongs to the older MongoDB/MySQL READMEs only.

### Quick-Reference

Two files, no `README.md` — recent courses dropped it and only six older courses have one. Cheatsheet cites phases in headings (`### <Topic> (Phase N, Lesson M)`), the newer convention, rather than in code-block comment banners. Interview Q&A is **exactly 50 questions**, globally numbered, grouped into ~10 `## <Topic> (Q1–Q8)` sections with en-dash ranges, questions as `### Qn. <question?>` followed by a plain paragraph answer with no `**Answer:**` prefix.

### Projects

`Projects/README.md` (table `| File | Patterns Combined | Phases |`) plus numbered project files. Each project: `# Project NN — <Title>` → `## Goal` → `## What You'll Build` → `## Phases Required` → `## Requirements` → `## Suggested Approach` (numbered steps with the "why" attached) → `## Stretch Goals` (exactly 3) → `## Evaluation Checklist` (5–6 `- [ ]` boxes, each an observable outcome).

### Documented allowance for theory-heavy lessons

Fundamentals is engine-agnostic, so several lessons have no runnable code (CAP, PACELC, isolation anomalies, consensus). The format is preserved by substitution, never by padding: the code block becomes an ASCII diagram, a worked timeline of interleaved transactions showing the anomaly occurring, or a `text` comparison block. Prose paragraph count does not grow. Exercises for those lessons are design and analysis tasks ("model this domain three ways and state what each makes hard") rather than commands to run — still concrete, still verifiable.

## Content Sourcing

Accuracy is a stated requirement, so version-specific claims come from current primary documentation rather than recall: PostgreSQL 18 and Cassandra 5.0 documentation are available through Context7 and are consulted while writing Phases that make version-specific claims (Postgres 6, 7, 9, 11; Cassandra 5, 7, 9, 12).

## Migration Plan

A full repository link audit was run before writing this spec. Results:

**Genuinely broken by the move — 12 path tokens across 10 lines. Must be fixed in the same commit as the move.**

| File | Lines | Change |
|---|---|---|
| `NodeJS/README.md` | 61 | `../MongoDB/`, `../MySQL/` → `../Databases/…` |
| `NodeJS/Phase-06-Databases/README.md` | 5 | `../../MongoDB/`, `../../MySQL/` → `../../Databases/…` |
| `NodeJS/Phase-06-Databases/01-MongoDB-with-Mongoose.md` | 3, 339 | `../../MongoDB/` → `../../Databases/MongoDB/` |
| `NodeJS/Phase-06-Databases/02-SQL-with-an-ORM-Prisma.md` | 3, 364 | `../../MySQL/`, `../../MongoDB/` → `../../Databases/…` |
| `NodeJS/Phase-06-Databases/04-Transactions-in-Node.md` | 3 | `../../MySQL/`, `../../MongoDB/` → `../../Databases/…` |
| `OperatingSystems/Phase-05-Deadlocks/04-Avoiding-Deadlocks-in-Practice.md` | 280, 281, 317 | `../MySQL/…`, `../MongoDB/…` → `../../Databases/…` |

The three `OperatingSystems` lines are **already broken today** — they use a single `../` from inside `OperatingSystems/Phase-05-Deadlocks/`, resolving to the non-existent `OperatingSystems/MySQL/…`. The move is the right moment to correct the depth as well as the path.

**Not affected — verified, no action:**
- Zero `../`-escaping references inside `MongoDB/`, `MySQL/`, `Redis/`. Every relative link in those folders is single-level and stays within its own course, so the added directory level changes nothing internally.
- All other `MongoDB/` `MySQL/` `Redis/` hits across the repo (AWS, HLD, SpringBoot, Networking, `HR-Interview-QA.md`) are prose slashes — "MySQL/InnoDB", "ElastiCache (Redis/Memcached)" — not paths.

**Stale historical documentation — 110 lines in `docs/superpowers/`.** These are completed planning artifacts describing work already shipped, not live links. `plans/2026-07-25-redis-course.md` alone holds 100 `Redis/` paths (and an absolute path from a different machine at L5, already wrong). Decision: **leave them unedited.** They are a record of what was done at the time; rewriting them would falsify the history they exist to preserve. This spec's existence documents the relocation.

**Pre-existing dead link found in passing, fixed opportunistically:** `MySQL/Phase-01-SQL-Fundamentals/README.md` L71 points to `../Phase-02-SELECT-Queries/README.md`; the real folder is `Phase-02-DDL`.

**`CLAUDE.md` updates:** L11–12 (MongoDB/MySQL course entries → new paths), L37 (README anchor-link convention → new paths), the L20–26 structure diagram (must show that database courses nest one level deeper), and L7 (already stale — claims "four complete learning courses" while listing five and omitting Redis and ~28 other folders). Add a section documenting the `Databases/` grouping as a convention so future courses land in the right place.

### The Redis README problem

Redis has **no `README.md` at any level** — not at course root, not per phase. Its design spec records this as an explicit user request at the time. MongoDB and MySQL both have substantial course READMEs.

Consequence: `Databases/README.md` cannot link to a Redis course overview, because none exists. The deepest linkable entry point is `Databases/Redis/Phase-01-Redis-Fundamentals/01-What-is-Redis.md`.

Resolution taken: the hub links Redis to that first lesson and every other course to its README. No README is added to Redis — the earlier decision stands until it is explicitly reversed, and this spec is not the place to quietly overturn it. Flagged for the user as a known asymmetry.

### Execution order

1. `git mv` the three folders into `Databases/` — moves only, no content edits, so `git log --follow` stays clean.
2. Separate commit: fix the 12 broken path tokens + the pre-existing `Phase-02-SELECT-Queries` link.
3. Separate commit: `CLAUDE.md` conventions update.
4. `Databases/README.md` hub.
5. Fundamentals course, then PostgreSQL, then Cassandra — each one landing complete.

## Risks and Decisions

- **Move breaks links.** Mitigated by the link audit; every reference is rewritten in the same commit as the move.
- **`git mv` in one commit keeps history.** Content changes are kept in separate commits from the moves so `git log --follow` stays clean.
- **Volume.** Three 12-phase courses is roughly 165–170 new files. Delivery is phased (see plan) so each course lands complete and reviewable rather than all three half-built.
- **Redis moving in.** Redis is a key-value store and belongs in the family; it is used as a cache more often than as a system of record, and the family hub says so explicitly rather than pretending it is interchangeable with the others.
