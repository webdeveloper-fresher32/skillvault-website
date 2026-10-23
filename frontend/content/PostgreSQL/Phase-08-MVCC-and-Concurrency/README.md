# Phase 08 — MVCC, Concurrency & Transaction Isolation

## Overview

Multi-Version Concurrency Control (MVCC) is the heartbeat of PostgreSQL. It allows hundreds of concurrent transactions to read and write without blocking each other. However, MVCC also introduces unique challenges—dead tuples, table bloat, autovacuum tuning, and transaction ID wraparound. In this phase, you will explore tuple headers (`xmin`, `xmax`), master VACUUM tuning, examine the four transaction isolation levels (including Serializable Snapshot Isolation), and understand explicit table, row, and advisory locks.

---

## Objectives

By completing Phase 08, you will be able to:
1. Deconstruct physical tuple headers: `xmin`, `xmax`, `t_ctid`, and the visibility snapshot algorithm.
2. Explain why an `UPDATE` in PostgreSQL is physically an `INSERT` followed by a soft-delete mark.
3. Diagnose table and index bloat using system catalog views (`pg_stat_user_tables`).
4. Tune autovacuum workers and cost limits to prevent disk exhaustion and transaction ID (TXID) wraparound.
5. Contrast `Read Committed`, `Repeatable Read`, and `Serializable` isolation levels with concurrency anomalies (dirty reads, non-repeatable reads, phantom reads, serialization anomalies).
6. Implement lock-free concurrent queues using `SELECT ... FOR UPDATE SKIP LOCKED` and distributed mutexes with PostgreSQL **Advisory Locks**.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-MVCC-Internals-and-Tuple-Headers.md](./01-MVCC-Internals-and-Tuple-Headers.md) | How MVCC works, xmin, xmax, commit log (CLOG/pg_xact), and tuple visibility rules. |
| 2 | [02-VACUUM-Autovacuum-and-Bloat.md](./02-VACUUM-Autovacuum-and-Bloat.md) | Reclaiming space, standard VACUUM vs VACUUM FULL, tuning autovacuum, and freezing TXIDs. |
| 3 | [03-Isolation-Levels-and-Locking.md](./03-Isolation-Levels-and-Locking.md) | Isolation levels, Serializable Snapshot Isolation, row locks, FOR UPDATE SKIP LOCKED, and advisory locks. |

---

## Time Estimate

- **Estimated study time:** 7–9 hours.
- **Hands-on practice:** 3 hours testing concurrency anomalies and tuning autovacuum thresholds.
