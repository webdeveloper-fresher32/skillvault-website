# Phase 12 — Security, Auditing & Database Administration

## Overview

A production database holds your organization's most valuable asset: its data. In this capstone administration phase, you will master PostgreSQL security hardening, Role-Based Access Control (RBAC), Row-Level Security (RLS) for zero-leak multi-tenant architectures, comprehensive backup and disaster recovery tooling (`pg_dump`, `pgBackRest`), and cluster-wide health monitoring.

---

## Objectives

By completing Phase 12, you will be able to:
1. Implement the Principle of Least Privilege using PostgreSQL Roles, Groups, and `ALTER DEFAULT PRIVILEGES`.
2. Master **Row-Level Security (RLS)** to enforce tenant isolation cryptographically in SQL without relying on application code.
3. Secure PostgreSQL networks with TLS/SSL encryption, client certificates, and SCRAM-SHA-256 authentication.
4. Execute logical backups with `pg_dump` and `pg_restore` with parallel worker jobs (`-j`).
5. Architect physical enterprise backups and WAL archiving using `pgBackRest`.
6. Monitor cluster health, lock contention, slow queries, and table bloat using system catalog views and Prometheus telemetry exporters.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-Roles-Privileges-and-Row-Level-Security-RLS.md](./01-Roles-Privileges-and-Row-Level-Security-RLS.md) | RBAC, default privileges, enabling RLS, and creating multi-tenant security policies. |
| 2 | [02-Backup-Restore-and-Disaster-Recovery.md](./02-Backup-Restore-and-Disaster-Recovery.md) | Logical pg_dump/pg_restore with parallel jobs, physical backups with pgBackRest, and disaster drills. |
| 3 | [03-Performance-Benchmarking-and-Monitoring.md](./03-Performance-Benchmarking-and-Monitoring.md) | pg_stat_activity, diagnosing locks, pg_stat_statements, pgBadger, and health alerting. |

---

## Time Estimate

- **Estimated study time:** 7–9 hours.
- **Hands-on practice:** 3 hours configuring Row-Level Security policies and executing parallel dump restores.
