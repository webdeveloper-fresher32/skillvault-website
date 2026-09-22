# Phase 01 — PostgreSQL Fundamentals & Process Architecture

## Overview

Welcome to Phase 01. In this foundational phase, you will explore the design philosophy, client-server model, process topology, and memory management structures of PostgreSQL. Understanding how Postgres handles connections, manages shared memory, and writes to disk separates novice developers from senior database engineers.

---

## Objectives

By completing Phase 01, you will be able to:
1. Explain the historical evolution of PostgreSQL and how its object-relational model differs from MySQL and Oracle.
2. Diagram the PostgreSQL process hierarchy: the Postmaster, backend worker processes, and auxiliary background workers (Checkpointer, BgWriter, Autovacuum Launcher, WAL Writer).
3. Contrast shared memory allocations (`shared_buffers`, `wal_buffers`) with private backend memory (`work_mem`, `maintenance_work_mem`).
4. Install and run PostgreSQL 16+ via Docker, native package managers, and verify connectivity.
5. Master the `psql` interactive command line tool and its essential meta-commands (`\dt`, `\d+`, `\timing`, `\x`).
6. Configure client authentication in `pg_hba.conf` and server runtime parameters in `postgresql.conf`.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-What-is-PostgreSQL.md](./01-What-is-PostgreSQL.md) | Object-relational model, SQL compliance, extensibility philosophy, and feature breakdown. |
| 2 | [02-Process-and-Memory-Architecture.md](./02-Process-and-Memory-Architecture.md) | The Postmaster daemon, process-per-connection model, shared buffer pool, and background workers. |
| 3 | [03-Installation-psql-and-Configuration.md](./03-Installation-psql-and-Configuration.md) | Local installation, Docker environment, `psql` mastery, `postgresql.conf`, and `pg_hba.conf`. |

---

## Time Estimate

- **Estimated study time:** 6–8 hours across 3–4 days.
- **Hands-on practice:** 2 hours configuring `postgresql.conf` and inspecting `pg_stat_activity`.
