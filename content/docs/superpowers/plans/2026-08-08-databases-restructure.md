# Databases Restructure + Three New Courses — Implementation Plan

Date: 2026-08-08
Spec: `docs/superpowers/specs/2026-08-08-databases-restructure-design.md`

Repository root: `/Users/balamsanjay/Desktop/Up-skilling/SkillVault`

Every lesson file follows the lean format defined in the spec — 8 or 9 numbered sections, exactly 5 exercises, exactly 5 Interview Q&A pairs, 200–248 lines. Structural reference: `NextJS/Phase-07-Middleware-and-Authentication/01-Middleware-Basics.md`.

---

## Stage 1 — Restructure (no content written)

### 1.1 Move the three courses

```bash
mkdir -p Databases
git mv MySQL Databases/MySQL
git mv MongoDB Databases/MongoDB
git mv Redis Databases/Redis
```

Commit as moves only — no content edits in this commit, so `git log --follow` stays clean.

### 1.2 Fix links broken by the move

Separate commit. 12 path tokens across 10 lines:

| File | Line | From → To |
|---|---|---|
| `NodeJS/README.md` | 61 | `../MongoDB/` → `../Databases/MongoDB/`; `../MySQL/` → `../Databases/MySQL/` |
| `NodeJS/Phase-06-Databases/README.md` | 5 | `../../MongoDB/` → `../../Databases/MongoDB/`; `../../MySQL/` → `../../Databases/MySQL/` |
| `NodeJS/Phase-06-Databases/01-MongoDB-with-Mongoose.md` | 3, 339 | `../../MongoDB/` → `../../Databases/MongoDB/` |
| `NodeJS/Phase-06-Databases/02-SQL-with-an-ORM-Prisma.md` | 3, 364 | `../../MySQL/` → `../../Databases/MySQL/`; `../../MongoDB/` → `../../Databases/MongoDB/` |
| `NodeJS/Phase-06-Databases/04-Transactions-in-Node.md` | 3 | `../../MySQL/` → `../../Databases/MySQL/`; `../../MongoDB/` → `../../Databases/MongoDB/` |
| `OperatingSystems/Phase-05-Deadlocks/04-Avoiding-Deadlocks-in-Practice.md` | 280, 281, 317 | `../MySQL/…` → `../../Databases/MySQL/…`; `../MongoDB/…` → `../../Databases/MongoDB/…` |

The three `OperatingSystems` lines are already broken today (single `../` resolves to `OperatingSystems/MySQL/…`). Depth is corrected as well as path.

Also in this commit: `Databases/MySQL/Phase-01-SQL-Fundamentals/README.md` L71 — `../Phase-02-SELECT-Queries/README.md` → `../Phase-02-DDL/README.md`. Pre-existing dead link, unrelated to the move, fixed while in the file.

Verification: `grep -rn '\.\./MongoDB/\|\.\./MySQL/\|\.\./Redis/' --include='*.md' .` returns only paths inside `Databases/`.

### 1.3 Update `CLAUDE.md`

- L7 — "four complete learning courses" is wrong (lists five, omits Redis and ~28 other folders). Replace with an accurate statement plus the `Databases/` grouping.
- L11–12 — MongoDB and MySQL entries get their new paths; add Redis, PostgreSQL, Cassandra, Fundamentals.
- L20–26 — structure diagram must show that database courses nest one level deeper.
- L37 — README anchor-link convention paths updated; note that the convention applies to the older MongoDB/MySQL READMEs only, and that new courses use the `PaymentGateways` README shape with no TOC.
- New section documenting `Databases/` as a convention, so future database courses land inside it.

`docs/superpowers/` plans and specs are deliberately **not** edited — they record completed work as it stood.

### 1.4 `Databases/README.md` — family hub

Not a course README. Sections: what the family covers → recommended order (Fundamentals always first) → data-model map (which course teaches which model) → **selection matrix** (workload shape → engine → reasoning) → cross-engine comparison tables (consistency model, scaling model, transaction support, query language, typical use cases) → links into each course.

Redis is linked to `Redis/Phase-01-Redis-Fundamentals/01-What-is-Redis.md`, not a README, because Redis has none by earlier explicit decision. Every other course links to its README. The hub states plainly that Redis is most often a cache rather than a system of record.

---

## Stage 2 — `Databases/Fundamentals/` (58 files)

Engine-agnostic. Standard SQL or pseudocode only, labelled as illustrative.

| Phase | Directory | Lessons |
|---|---|---|
| 01 | `Phase-01-What-Is-a-Database/` | `01-Files-vs-a-Database.md`, `02-OLTP-OLAP-and-Workload-Shapes.md`, `03-The-Database-Landscape.md` |
| 02 | `Phase-02-Data-Models/` | `01-Relational-and-Document.md`, `02-Key-Value-Wide-Column-and-Graph.md`, `03-Time-Series-and-Vector.md` |
| 03 | `Phase-03-Relational-Theory-and-Schema-Design/` | `01-Keys-and-Relationships.md`, `02-ER-Modelling-and-Cardinality.md`, `03-Normalization-1NF-to-BCNF.md`, `04-When-to-Denormalize.md` |
| 04 | `Phase-04-SQL-Foundations/` | `01-Declarative-Thinking-and-SQL-Sublanguages.md`, `02-Relational-Algebra-Behind-Joins.md`, `03-Logical-Query-Processing-Order.md`, `04-NULL-and-Three-Valued-Logic.md` |
| 05 | `Phase-05-Storage-Engines/` | `01-Pages-Heap-Files-and-Row-vs-Column.md`, `02-B-Plus-Trees.md`, `03-LSM-Trees-and-SSTables.md`, `04-Write-Ahead-Log-and-Buffer-Pool.md` |
| 06 | `Phase-06-Indexing-Theory/` | `01-What-an-Index-Costs.md`, `02-Clustered-Secondary-and-Covering.md`, `03-Composite-Indexes-and-Leftmost-Prefix.md`, `04-Index-Types-and-When-Each-Wins.md` |
| 07 | `Phase-07-Query-Processing-and-Optimization/` | `01-Parse-Plan-Execute.md`, `02-Cost-Based-Optimization-and-Statistics.md`, `03-Join-Algorithms.md`, `04-Reading-an-Execution-Plan.md` |
| 08 | `Phase-08-Transactions-and-Concurrency/` | `01-ACID-Precisely.md`, `02-The-Anomalies.md`, `03-Isolation-Levels.md`, `04-Locking-MVCC-and-Deadlocks.md` |
| 09 | `Phase-09-Reliability-and-Recovery/` | `01-Crash-Recovery-and-WAL.md`, `02-Backups-and-Point-in-Time-Recovery.md`, `03-RPO-RTO-and-Restore-Testing.md` |
| 10 | `Phase-10-Distributed-Databases/` | `01-Replication-Topologies.md`, `02-Partitioning-and-Consistent-Hashing.md`, `03-CAP-and-PACELC.md`, `04-Quorums-and-Consensus.md`, `05-Distributed-Transactions-2PC-and-Sagas.md` |
| 11 | `Phase-11-Performance-Scaling-and-Caching/` | `01-Measure-Before-Tuning.md`, `02-Connection-Pooling-and-Read-Replicas.md`, `03-Caching-Patterns-and-Invalidation.md`, `04-N-Plus-1-Batching-and-Capacity-Planning.md` |
| 12 | `Phase-12-Choosing-and-Operating/` | `01-A-Database-Selection-Framework.md`, `02-Schema-Migrations-and-Zero-Downtime-Change.md`, `03-Database-Security-Fundamentals.md`, `04-Interview-Capstone.md` |

Plus: 12 phase `README.md`, course `README.md`, `Projects/README.md` + 6 project files, `Quick-Reference/Cheatsheet.md` + `Quick-Reference/Interview-QA.md` (50 questions).

Theory-lesson allowance applies most in Phases 08 and 10 — anomalies are shown as worked interleaved-transaction timelines, CAP/PACELC and consensus as ASCII diagrams. No prose padding.

Projects are design exercises, not code: model a domain three ways and defend the choice; design a sharding scheme for a stated growth curve; write a migration plan for a breaking schema change; produce a selection matrix for three real workloads.

---

## Stage 3 — `Databases/PostgreSQL/` (58 files)

Targets PostgreSQL 18. Version-specific claims verified against Context7 `/websites/postgresql_18` while writing Phases 06, 07, 09, 11.

| Phase | Directory | Lessons |
|---|---|---|
| 01 | `Phase-01-Fundamentals-and-Setup/` | `01-What-Is-PostgreSQL.md`, `02-Installation-and-psql.md`, `03-Process-Architecture-and-Memory.md` |
| 02 | `Phase-02-Data-Types-and-DDL/` | `01-The-Type-System-as-a-Feature.md`, `02-Arrays-JSON-Ranges-and-Composites.md`, `03-Tables-Identity-and-Generated-Columns.md`, `04-Constraints-Including-EXCLUDE.md` |
| 03 | `Phase-03-DML-and-Core-Querying/` | `01-INSERT-UPDATE-DELETE-and-RETURNING.md`, `02-Upsert-with-ON-CONFLICT.md`, `03-COPY-and-Bulk-Loading.md` |
| 04 | `Phase-04-Joins-Aggregation-and-Windows/` | `01-Joins-and-DISTINCT-ON.md`, `02-GROUPING-SETS-ROLLUP-and-CUBE.md`, `03-Window-Functions-and-Frames.md` |
| 05 | `Phase-05-Subqueries-CTEs-and-Recursion/` | `01-Subqueries-and-Correlation.md`, `02-CTEs-and-Materialization.md`, `03-Recursive-CTEs.md`, `04-LATERAL-Joins.md` |
| 06 | `Phase-06-Indexing/` | `01-B-tree-and-Hash.md`, `02-GIN-GiST-SP-GiST-and-BRIN.md`, `03-Partial-Expression-and-Covering-Indexes.md`, `04-Index-Only-Scans-and-CONCURRENTLY.md` |
| 07 | `Phase-07-JSON-Search-and-Extensions/` | `01-jsonb-Operators-and-Path-Queries.md`, `02-Indexing-jsonb.md`, `03-Full-Text-Search.md`, `04-The-Extension-Ecosystem.md` |
| 08 | `Phase-08-Transactions-and-MVCC/` | `01-Isolation-Levels-in-PostgreSQL.md`, `02-MVCC-Internals-and-Tuple-Visibility.md`, `03-Locks-FOR-UPDATE-and-SKIP-LOCKED.md`, `04-Advisory-Locks-and-Deadlocks.md` |
| 09 | `Phase-09-Query-Planning-and-Performance/` | `01-Reading-EXPLAIN-ANALYZE-BUFFERS.md`, `02-Planner-Statistics.md`, `03-VACUUM-Bloat-and-Wraparound.md`, `04-Memory-Settings-and-pg-stat-statements.md` |
| 10 | `Phase-10-Server-Programming/` | `01-PL-pgSQL-Functions-and-Procedures.md`, `02-Triggers.md`, `03-Views-and-Materialized-Views.md`, `04-LISTEN-NOTIFY-and-Foreign-Data-Wrappers.md` |
| 11 | `Phase-11-Replication-HA-and-Partitioning/` | `01-WAL-and-Streaming-Replication.md`, `02-Replication-Slots-and-Synchronous-Commit.md`, `03-Logical-Replication-and-CDC.md`, `04-Declarative-Partitioning.md` |
| 12 | `Phase-12-Security-Backup-and-Production/` | `01-Roles-GRANT-and-Row-Level-Security.md`, `02-pg-hba-conf-and-SSL.md`, `03-Backup-pg-dump-and-PITR.md`, `04-PgBouncer-Upgrades-and-Production-Checklist.md` |

Plus 12 phase READMEs, course README, Projects (README + 6), Quick-Reference (2).

Phase 01 Lesson 1 explicitly positions Postgres against MySQL, since most learners arrive from the MySQL course.

---

## Stage 4 — `Databases/Cassandra/` (58 files)

Targets Apache Cassandra 5.0. Version-specific claims verified against Context7 `/websites/cassandra_apache_doc_5_0_8_cassandra` while writing Phases 05, 07, 09, 12.

| Phase | Directory | Lessons |
|---|---|---|
| 01 | `Phase-01-Fundamentals/` | `01-What-Is-Cassandra.md`, `02-Dynamo-and-Bigtable-Heritage.md`, `03-When-Not-to-Use-Cassandra.md`, `04-Installation-and-cqlsh.md` |
| 02 | `Phase-02-Architecture/` | `01-The-Token-Ring-and-No-Master.md`, `02-Virtual-Nodes-and-Partitioners.md`, `03-Gossip-and-Snitches.md`, `04-The-Coordinator-and-Request-Flow.md` |
| 03 | `Phase-03-Data-Model-and-CQL-Basics/` | `01-Keyspaces-and-Tables.md`, `02-Why-CQL-Is-Not-SQL.md`, `03-Partition-Key-and-Clustering-Columns.md` |
| 04 | `Phase-04-Query-First-Data-Modelling/` | `01-Model-From-Access-Patterns.md`, `02-One-Table-Per-Query-and-Denormalization.md`, `03-Chebotko-Diagrams-and-a-Worked-Design.md`, `04-Relational-Habits-That-Break-Here.md` |
| 05 | `Phase-05-CQL-in-Depth/` | `01-Types-Collections-and-Their-Costs.md`, `02-UDTs-Counters-and-TTL.md`, `03-Lightweight-Transactions.md`, `04-Batches-and-Their-Misuse.md` |
| 06 | `Phase-06-Replication-and-Tunable-Consistency/` | `01-Replication-Factor-and-Strategies.md`, `02-Consistency-Levels.md`, `03-The-R-Plus-W-Greater-Than-RF-Rule.md`, `04-Hinted-Handoff-and-Read-Repair.md` |
| 07 | `Phase-07-Storage-Engine-Internals/` | `01-Commitlog-Memtable-and-SSTables.md`, `02-Compaction-Strategies.md`, `03-Bloom-Filters-and-Partition-Index.md` |
| 08 | `Phase-08-Write-and-Read-Paths/` | `01-The-Write-Path.md`, `02-The-Read-Path-and-Caches.md`, `03-Tombstones-and-the-Delete-Problem.md` |
| 09 | `Phase-09-Indexing/` | `01-Why-Secondary-Indexes-Scale-Badly.md`, `02-Materialized-Views-and-Their-Caveats.md`, `03-Storage-Attached-Indexing.md`, `04-The-Denormalized-Index-Table-Pattern.md` |
| 10 | `Phase-10-Multi-DC-Scaling-and-Operations/` | `01-Adding-and-Removing-Nodes.md`, `02-nodetool-as-the-Daily-Tool.md`, `03-Repair-and-Why-It-Is-Mandatory.md`, `04-Multi-Datacenter-Deployment.md` |
| 11 | `Phase-11-Performance-and-Troubleshooting/` | `01-Tracing-and-Metrics.md`, `02-JVM-Heap-and-GC-Tuning.md`, `03-Wide-and-Hot-Partitions.md`, `04-The-Anti-Pattern-Catalogue.md` |
| 12 | `Phase-12-Security-Drivers-and-Production/` | `01-Authentication-Authorization-and-Encryption.md`, `02-Driver-Best-Practices.md`, `03-Vector-Search-in-5-0.md`, `04-Production-Readiness-Checklist.md` |

Plus 12 phase READMEs, course README, Projects (README + 6), Quick-Reference (2).

Phase 04 is the course's centre of gravity — most Cassandra failures are relational habits applied to a wide-column store, so the "model from queries, not entities" discipline gets a full phase and is referenced back to throughout.

---

## Totals

| Stage | New files | Moved files |
|---|---|---|
| 1 — Restructure | 1 (`Databases/README.md`) | 137 |
| 2 — Fundamentals | 58 | — |
| 3 — PostgreSQL | 58 | — |
| 4 — Cassandra | 58 | — |
| **Total** | **175** | **137** |

Each stage lands complete and reviewable on its own. Stage 1 is safe to ship immediately; the structure is then correct even if content stages land later.

## Verification per stage

- Every phase directory has a `README.md`; every course root has a `README.md` (except Redis, by prior decision).
- No lesson file below 200 or above 250 lines.
- Every lesson has exactly 5 exercises and exactly 5 Interview Q&A pairs.
- Every `Quick-Reference/Interview-QA.md` has exactly 50 questions, numbered contiguously.
- Every TOC anchor resolves — anchors generated by GitHub slugify rules, checked against the headings in the same file.
- Every forward `Next Phase` link resolves once the following phase exists.
- `grep` for stale `../MongoDB/`, `../MySQL/`, `../Redis/` returns nothing outside `Databases/`.
