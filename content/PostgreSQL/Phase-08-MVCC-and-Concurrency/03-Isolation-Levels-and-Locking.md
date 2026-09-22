# 03 — Isolation Levels, Row Locking & Advisory Locks

## Table of Contents
1. [Transaction Isolation Levels Explained](#1-transaction-isolation-levels-explained)
2. [Concurrency Anomalies Matrix](#2-concurrency-anomalies-matrix)
3. [The Four Levels in PostgreSQL](#3-the-four-levels-in-postgresql)
4. [Serializable Snapshot Isolation (SSI)](#4-serializable-snapshot-isolation-ssi)
5. [Explicit Row Locking (`FOR UPDATE`, `FOR SHARE`)](#5-explicit-row-locking-for-update-for-share)
6. [High-Performance Work Queues with `SKIP LOCKED`](#6-high-performance-work-queues-with-skip-locked)
7. [Distributed Synchronization via Advisory Locks](#7-distributed-synchronization-via-advisory-locks)
8. [Hands-On Queue Exercise](#8-hands-on-queue-exercise)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. Transaction Isolation Levels Explained

When multiple transactions execute concurrently, the database must guarantee isolation without grinding throughput to a halt.

You can declare the isolation level per transaction:
```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- or
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

---

## 2. Concurrency Anomalies Matrix

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Serialization Anomaly (Write Skew) |
|---|---|---|---|---|
| **Read Uncommitted** | Prevented in PG | Prevented in PG | Prevented in PG | Possible |
| **Read Committed (Default)** | **Prevented** | Possible | Possible | Possible |
| **Repeatable Read** | **Prevented** | **Prevented** | **Prevented** | Possible (Write Skew) |
| **Serializable** | **Prevented** | **Prevented** | **Prevented** | **Prevented** |

*Note: In PostgreSQL, `Read Uncommitted` is mapped to `Read Committed` because dirty reads are impossible in MVCC!*

---

## 3. The Four Levels in PostgreSQL

### 1. Read Committed (Default)
Each statement inside the transaction sees a new snapshot taken at the **start of that specific statement**. If Transaction B commits an update while Transaction A is running, Transaction A's next query will see B's new data.

### 2. Repeatable Read
The transaction takes **one snapshot at the start of the first non-transactional statement** and reuses that snapshot for all subsequent queries.
- Guarantees reading the exact same data throughout the transaction.
- If an update conflicts with a concurrent committed write, PostgreSQL throws an error:
  `ERROR: could not serialize access due to concurrent update`
- The application must catch this error and **retry the transaction**.

---

## 4. Serializable Snapshot Isolation (SSI)

Standard Repeatable Read does not prevent **Write Skew**.

*Classic Example: Two on-call doctors try to go off-call simultaneously, checking `SELECT count(*) FROM doctors WHERE on_call = true`. Both see count = 2, and both set their status to false, leaving 0 doctors on-call!*

PostgreSQL's **Serializable** level implements true **SSI (Serializable Snapshot Isolation)**:
- Tracks read-write dependencies in shared memory using non-blocking **SIREAD locks**.
- Detects dangerous dependency cycles (rw-antidependencies) and terminates one transaction with a serialization failure (`40001`).
- Eliminates anomalies **without locking tables or degrading read performance**!

---

## 5. Explicit Row Locking (`FOR UPDATE`, `FOR SHARE`)

When you must enforce strict pessimistic locks on specific rows:

- **`FOR UPDATE`:** Acquires an exclusive row lock; blocks all other `UPDATE`, `DELETE`, and `FOR UPDATE` queries on those rows.
- **`FOR NO KEY UPDATE`:** Weaker than `FOR UPDATE`; allows concurrent foreign-key validations on the primary key.
- **`FOR SHARE`:** Shared read lock; allows other transactions to read, but blocks writes.

```sql
SELECT balance FROM accounts 
WHERE account_id = 101 
FOR UPDATE;
```

---

## 6. High-Performance Work Queues with `SKIP LOCKED`

In distributed architectures, multiple worker processes (e.g. Celery, Sidekiq, BullMQ) compete to pop tasks from a PostgreSQL table.

If 10 workers run `SELECT ... FOR UPDATE LIMIT 1`:
- Worker 1 locks row 1.
- Workers 2 through 10 **block and wait** for Worker 1 to finish!

### The Solution: `FOR UPDATE SKIP LOCKED`
`SKIP LOCKED` instructs PostgreSQL to bypass any row currently locked by another transaction, grabbing the next available un-locked row immediately:

```sql
-- Worker query: Non-blocking, instant concurrent task consumption!
WITH next_task AS (
    SELECT id 
    FROM job_queue 
    WHERE status = 'pending' 
    ORDER BY priority DESC, id ASC 
    LIMIT 1 
    FOR UPDATE SKIP LOCKED
)
UPDATE job_queue
SET status = 'processing',
    locked_by = 'worker-pod-4',
    started_at = now()
FROM next_task
WHERE job_queue.id = next_task.id
RETURNING job_queue.*;
```

This single query allows hundreds of concurrent pods to pop items from a database queue with **zero lock contention**.

---

## 7. Distributed Synchronization via Advisory Locks

Need a distributed mutex across your microservice cluster (e.g. to ensure only one pod runs a nightly cron job or migrates a schema)?

Don't deploy a separate Redis Redlock cluster! Use PostgreSQL's built-in **Application-Level Advisory Locks**:

```sql
-- 1. Try to acquire lock non-blockingly using a 64-bit integer ID
SELECT pg_try_advisory_lock(982341);
-- Returns TRUE if lock was acquired, FALSE if another service holds it!

-- 2. Transaction-scoped advisory lock (automatically releases on COMMIT or ROLLBACK)
SELECT pg_advisory_xact_lock(982341);

-- 3. Explicit release (for session-scoped locks)
SELECT pg_advisory_unlock(982341);
```

---

## 8. Hands-On Queue Exercise

1. Create a `task_queue` table with columns `id SERIAL PRIMARY KEY, payload TEXT, status TEXT`.
2. Insert 10 pending tasks.
3. Open two separate terminal windows with `psql`.
4. Run `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` inside an open transaction (`BEGIN;`) in terminal 1.
5. Immediately run the same query in terminal 2.
6. Verify that terminal 2 instantly grabs row 2 without waiting on terminal 1!

---

## 9. Summary & Key Takeaways

1. `Read Committed` takes a new snapshot per statement; `Repeatable Read` takes one snapshot per transaction.
2. `Serializable` uses non-blocking SSI locks to prevent all write skew anomalies.
3. Use `SELECT ... FOR UPDATE` for pessimistic inventory or balance reservations.
4. `SKIP LOCKED` is the foundational building block for zero-contention database queues.
5. **Advisory Locks** provide lightweight, application-defined distributed mutexes inside PostgreSQL.
