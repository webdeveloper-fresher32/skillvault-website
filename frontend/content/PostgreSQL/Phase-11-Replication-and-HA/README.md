# Phase 11 — Replication, High Availability & Connection Pooling

## Overview

Designing a resilient database tier requires zero data loss, automated failover, read scalability, and protection against connection saturation. In this phase, you will master Write-Ahead Logging (WAL) internals, Point-In-Time Recovery (PITR), physical streaming replication vs logical publication/subscription replication, connection pooling architectures with **PgBouncer**, and high-availability orchestration with **Patroni** and Etcd.

---

## Objectives

By completing Phase 11, you will be able to:
1. Explain the physiological mechanics of Write-Ahead Logging (WAL), WAL segments (16MB), and checkpoint syncing.
2. Architect a continuous archiving and Point-In-Time Recovery (PITR) strategy to restore databases to any arbitrary second.
3. Configure **Physical Streaming Replication** (Primary -> Standby) with replication slots and synchronous vs asynchronous commit modes.
4. Set up **Logical Replication** using `CREATE PUBLICATION` and `CREATE SUBSCRIPTION` for selective cross-version migrations and event streaming.
5. Deploy **PgBouncer** in Session, Transaction, and Statement pooling modes to handle 10,000+ client connections safely.
6. Diagram an enterprise High-Availability (HA) cluster utilizing **Patroni**, Etcd, and HAProxy for automated split-brain-free failover.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-Write-Ahead-Logging-WAL-and-PITR.md](./01-Write-Ahead-Logging-WAL-and-PITR.md) | WAL generation, LSNs, checkpointing, base backups, and Point-In-Time Recovery. |
| 2 | [02-Physical-Streaming-and-Logical-Replication.md](./02-Physical-Streaming-and-Logical-Replication.md) | Asynchronous & synchronous streaming, replication slots, publications, and subscriptions. |
| 3 | [03-Connection-Pooling-with-PgBouncer.md](./03-Connection-Pooling-with-PgBouncer.md) | Process-per-connection tax, PgBouncer pooling models, and Patroni HA orchestration. |

---

## Time Estimate

- **Estimated study time:** 7–9 hours.
- **Hands-on practice:** 3 hours configuring streaming replication and benchmarking PgBouncer throughput.
