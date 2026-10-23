# Phase 05 — Database Design and Scaling

Every system you've traced so far — the login click in Phase 01, the monolith and microservices in Phase 02, the fleet of stateless servers behind a load balancer in Phases 03-04 — eventually has to read and write data somewhere durable. That "somewhere" is almost always the first thing to fall over as traffic grows, and it's the component interviewers probe hardest once your high-level diagram is on the whiteboard. This phase covers the four database techniques that show up in nearly every system design interview: making reads fast (indexing), surviving read-heavy load (replication), surviving write-heavy load and data too big for one machine (sharding), and picking the right storage model in the first place (SQL vs NoSQL).

None of this is about SQL syntax or database administration. It's about the shape of the trade-off: every technique in this phase buys you scale at the cost of some simplicity, consistency, or operational complexity — and knowing exactly which cost you're paying is what separates a strong answer from a shaky one.

## What This Phase Covers

- Why an index turns a database lookup from "scan everything" into "jump straight there," and why that speed isn't free.
- Read replicas: how "reads go to replicas, writes go to master" lets a database absorb far more read traffic than a single instance could, and what replication lag means for consistency.
- Sharding: splitting data itself across multiple database instances when even a beefy single master can't hold or serve all of it, and the new problems (cross-shard joins, rebalancing) that sharding introduces.
- The SQL vs NoSQL decision: when strong consistency and relational integrity win, and when flexible schema and horizontal write throughput win.
- Beyond that binary: columnar stores for analytics, time-series databases for metrics, graph databases for relationship traversal, and search-index stores for full-text search.

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Indexing.md` | B-tree intuition, SQLAlchemy `index=True`, the write-cost trade-off |
| 02 | `02-Replication.md` | Master/replica topology, read/write split, replication lag |
| 03 | `03-Sharding.md` | Range sharding, hash sharding, cross-shard joins, rebalancing |
| 04 | `04-SQL-vs-NoSQL.md` | Consistency vs flexibility, when to reach for each |
| 05 | `05-Beyond-SQL-and-NoSQL.md` | Columnar, time-series, graph, and search-index stores — and when to reach for each |

## Estimated Time

**4 days** (a lesson a day, plus time to actually run the SQLAlchemy indexing example against a local database).

## Prerequisites

- Phases 01-04 — this phase assumes you're comfortable with the request lifecycle, service architecture, horizontal scaling, and load balancing that sit in front of the database layer covered here.
- Basic familiarity with SQL (a `SELECT`, a `WHERE` clause, a foreign key) is helpful but not required — every concept is explained from first principles.
