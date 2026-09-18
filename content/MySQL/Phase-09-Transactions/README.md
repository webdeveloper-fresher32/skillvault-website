# Phase 9: Transactions — Overview

## What You'll Learn

Transactions are the foundation of data reliability in MySQL. This phase covers how MySQL ensures your data stays consistent even when multiple users write simultaneously or the server crashes mid-operation.

## Learning Objectives

- Understand ACID properties and what each guarantees
- Write transactions with START TRANSACTION, COMMIT, and ROLLBACK
- Use SAVEPOINTs for partial rollbacks
- Understand the 4 isolation levels and their tradeoffs
- Understand how InnoDB locking prevents data corruption
- Diagnose and prevent deadlocks

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-ACID.md](01-ACID.md) | ACID properties deep dive | 2 days |
| [02-Transactions-Isolation.md](02-Transactions-Isolation.md) | Transaction syntax + isolation levels | 2 days |
| [03-Locking.md](03-Locking.md) | Row locks, gap locks, deadlocks | 2 days |

## Prerequisites

- Phase 8 (Indexes) — understanding InnoDB storage helps
- Basic DML (INSERT/UPDATE/DELETE) from Phase 3

## Estimated Time

1 week

## Next Phase

→ [Phase 10: Stored Programs](../Phase-10-Stored-Programs/README.md)
