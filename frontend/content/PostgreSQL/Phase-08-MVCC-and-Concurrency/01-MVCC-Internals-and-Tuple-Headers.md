# 01 — MVCC Internals & Tuple Headers

## Table of Contents
1. [The Philosophy of MVCC](#1-the-philosophy-of-mvcc)
2. [Anatomy of an 8KB Heap Tuple Header](#2-anatomy-of-an-8kb-heap-tuple-header)
3. [The `xmin`, `xmax` and `ctid` Fields](#3-the-xmin-xmax-and-ctid-fields)
4. [What Actually Happens During an `UPDATE`?](#4-what-actually-happens-during-an-update)
5. [Transaction Visibility & The Snapshot Mechanism](#5-transaction-visibility--the-snapshot-mechanism)
6. [The Commit Log (`pg_xact`)](#6-the-commit-log-pg_xact)
7. [Hands-On Inspection of Live vs Dead Tuples](#7-hands-on-inspection-of-live-vs-dead-tuples)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The Philosophy of MVCC

In early database architectures, reading data required locking the table or row with a Shared Read Lock. If another transaction attempted an `UPDATE`, it had to wait. This resulted in lock contention and severe queuing.

PostgreSQL solves this using **Multi-Version Concurrency Control (MVCC)**:
- **Readers never block writers.**
- **Writers never block readers.**

When an `UPDATE` or `DELETE` executes, PostgreSQL does **NOT** overwrite the physical row on disk. Instead, it creates a new version of the row while marking the old version with transaction metadata.

---

## 2. Anatomy of an 8KB Heap Tuple Header

Every row stored in an 8KB disk page has a **23-byte HeapTupleHeader**:

```
+--------------------------------------------------------------------------+
|                     HeapTupleHeaderData (23 Bytes)                       |
+--------------------------------------------------------------------------+
| t_xmin    : 32-bit Transaction ID (TXID) of the creating transaction     |
| t_xmax    : 32-bit TXID of the deleting / updating transaction (0 if live)|
| t_cid     : Command ID within the transaction (sub-statement counter)    |
| t_ctid    : Physical disk address (Page #, Offset #) of current/new row  |
| t_infomask: Status bitmask (COMMITTED, ABORTED, UPDATED, MOVED)          |
+--------------------------------------------------------------------------+
|                         User Data Columns                                |
+--------------------------------------------------------------------------+
```

---

## 3. The `xmin`, `xmax` and `ctid` Fields

You can query these hidden system columns in any SQL statement:

```sql
SELECT ctid, xmin, xmax, id, username FROM users;
```

- **`xmin`:** The Transaction ID that inserted this row.
- **`xmax`:** The Transaction ID that deleted or updated this row. If the row is active and alive, `xmax = 0`.
- **`ctid`:** The physical location `(page_number, tuple_index)`. Example: `(0, 1)` means Disk Page 0, Slot 1.

---

## 4. What Actually Happens During an `UPDATE`?

In PostgreSQL, an `UPDATE` is physically:
$$\text{UPDATE} = \text{INSERT (New Tuple)} + \text{DELETE (Old Tuple)}$$

```
Before UPDATE:
[ Page 0, Slot 1 ] (xmin=500, xmax=0, ctid=(0,1), balance=100)

Executing: UPDATE accounts SET balance = 150 WHERE id = 1; (In TXID 501)

After UPDATE:
[ Page 0, Slot 1 ] (xmin=500, xmax=501, ctid=(0,2), balance=100) <--- Marked Dead!
[ Page 0, Slot 2 ] (xmin=501, xmax=0,   ctid=(0,2), balance=150) <--- New Live Version!
```

Notice what happened:
1. Slot 1 has its `xmax` set to `501`, and its `ctid` points forward to `(0, 2)`.
2. Slot 2 is written with `xmin = 501` and `xmax = 0`.
3. If an older query started at TXID 499, it can still read Slot 1 because its snapshot rules determine that Slot 1 was committed before 499, and the update by 501 happened in the future!

---

## 5. Transaction Visibility & The Snapshot Mechanism

When a transaction begins, PostgreSQL takes an in-memory **Snapshot** consisting of:
- `xmin`: Lowest active TXID currently running in the cluster. Any tuple with `xmin < snapshot.xmin` is guaranteed committed and visible.
- `xmax`: Highest TXID allocated so far + 1. Any tuple with `xmin >= snapshot.xmax` was created in the future and is invisible!
- `xip_list`: List of active, in-progress transactions between `xmin` and `xmax`. Any tuple created by a TXID in this list is invisible.

---

## 6. The Commit Log (`pg_xact`)

Checking whether a TXID committed or rolled back would be too slow if Postgres had to inspect the entire WAL.

PostgreSQL maintains a dense bit array in RAM and disk called **`pg_xact`** (formerly known as `pg_clog`):
- Each transaction requires only **2 bits**:
  - `00`: IN_PROGRESS
  - `01`: COMMITTED
  - `10`: ABORTED (Rolled back)

Once a worker checks `pg_xact`, it sets the **`HEAP_XMIN_COMMITTED`** bit in the tuple's `t_infomask`. Future queries never need to check `pg_xact` again!

---

## 7. Hands-On Inspection of Live vs Dead Tuples

Inspect your table's tuple health using PostgreSQL's performance catalog:

```sql
CREATE TABLE mvcc_test (id INT PRIMARY KEY, counter INT);
INSERT INTO mvcc_test VALUES (1, 100);

-- Update the counter 5 times:
UPDATE mvcc_test SET counter = counter + 1;
UPDATE mvcc_test SET counter = counter + 1;
UPDATE mvcc_test SET counter = counter + 1;
UPDATE mvcc_test SET counter = counter + 1;
UPDATE mvcc_test SET counter = counter + 1;

-- Inspect live vs dead tuples:
SELECT 
    relname, 
    n_live_tup, 
    n_dead_tup, 
    last_vacuum, 
    last_autovacuum
FROM pg_stat_user_tables 
WHERE relname = 'mvcc_test';
-- Output: n_live_tup = 1, n_dead_tup = 5!
```

---

## 8. Summary & Key Takeaways

1. MVCC ensures readers and writers do not block one another.
2. Every row contains `xmin`, `xmax`, and `ctid` tracking its lifecycle.
3. Updates physically insert a new tuple and mark the old tuple as dead.
4. Snapshots compare tuple transaction IDs against active and committed boundaries.
5. The accumulation of dead tuples requires **VACUUM** to reclaim disk space.
