# PostgreSQL Senior & Staff Database Engineering Interview Master Guide

---

## 1. Concurrency, MVCC & Storage Internals

### Q1: How does PostgreSQL implement MVCC at the physical disk layer?
**Answer:**
Unlike MySQL InnoDB which overwrites the live row and writes older versions to an **Undo Log**, PostgreSQL writes row versions directly into the **table heap pages**.
Each 8KB page contains row tuples prefixed by a 23-byte `HeapTupleHeader`:
- `t_xmin`: The Transaction ID (TXID) that created this row version.
- `t_xmax`: The TXID that updated or deleted this row (set to 0 for active, non-deleted rows).
- `t_ctid`: The physical disk address `(page_number, tuple_offset)`.

When an `UPDATE` occurs:
1. PostgreSQL writes a brand-new tuple into free space in the page with `xmin = current_txid` and `xmax = 0`.
2. The old tuple's `xmax` is set to `current_txid`, and its `ctid` points forward to the new tuple's location.
3. Concurrent transactions compare their in-memory **Snapshot** boundaries (`xmin`, `xmax`, active TXID list) against the tuple headers to determine which version is visible.

---

### Q2: Why is an `UPDATE` in PostgreSQL heavier than in MySQL? What is HOT?
**Answer:**
Because an `UPDATE` inserts a new physical tuple, it generates Write-Ahead Log (WAL) traffic for the new tuple and creates a "dead tuple" from the old one, leading to table bloat. Furthermore, if any indexed column changes, every secondary index must be updated with a new pointer.

To mitigate this, PostgreSQL implements **Heap-Only Tuples (HOT)** optimization:
- If an update modifies **only non-indexed columns**, and
- The new tuple fits inside the **same 8KB page** as the old tuple:
PostgreSQL chains the old tuple to the new tuple via `ctid` *without modifying any indexes*. Index scans find the root tuple and follow the internal HOT chain directly inside the page, drastically reducing index write amplification and WAL volume.

---

### Q3: What is Transaction ID (TXID) Wraparound, and how does PostgreSQL prevent it?
**Answer:**
PostgreSQL uses a 32-bit integer for Transaction IDs ($2^{32} \approx 4.29 \text{ billion}$).
Because transaction visibility uses modular arithmetic, past and future transactions are separated by $2^{31}$ (2 billion) transactions. If a database completes 2.1 billion transactions without maintenance, past transactions wrap around and appear to be in the **future**, making all historical data invisible (apparent data loss).

**Prevention:**
The **Autovacuum Freeze** process scans pages that have not been vacuumed within `vacuum_freeze_min_age` (default: 50 million transactions). It replaces old `xmin` identifiers with a special permanent flag: **`HEAP_XMIN_FROZEN`**. Frozen tuples are treated as permanently committed in the past forever. If a cluster approaches `autovacuum_freeze_max_age` (default: 200 million), PostgreSQL enters aggressive autovacuum mode and will eventually stop accepting writes to prevent wraparound corruption.

---

## 2. Indexing & Query Planning

### Q4: Explain the difference between B-Tree, GIN, and BRIN indexes. When would you choose each?
**Answer:**
- **B-Tree ($O(\log N)$):** Self-balancing tree storing scalar keys and row pointers (TIDs). Best for high-cardinality equality (`=`) and range queries (`<`, `<=`, `BETWEEN`) on primary keys, numbers, and dates.
- **GIN (Generalized Inverted Index):** Inverted index mapping individual elements/tokens to lists of matching rows (Posting Lists). Best for multi-element data types: `JSONB` containment (`@>`), Arrays (`@>`, `&&`), and Full-Text Search (`tsvector @@ tsquery`).
- **BRIN (Block Range Index):** Does not index individual rows. Divides the table into contiguous ranges of 8KB disk pages (default: 128 pages) and records only the Minimum and Maximum values found within that block range.
  - *Best For:* Multi-gigabyte append-only tables (IoT metrics, server audit logs, order timestamps) where physical disk order correlates naturally with value order.
  - *Advantage:* Often **1,000x smaller** than a B-Tree (e.g. 500KB vs 1GB).

---

### Q5: What is a Covering Index, and why might an Index-Only Scan still perform Heap Fetches?
**Answer:**
A covering index uses the **`INCLUDE` clause** to append payload columns to B-Tree leaf pages without adding them to branch search nodes:
```sql
CREATE INDEX idx_cov ON orders (customer_id) INCLUDE (total_amount);
```
This enables an **Index-Only Scan**, satisfying the query without reading table data pages.

**Why Heap Fetches Occur:**
B-Tree leaf pages do not store transaction visibility information (`xmin`/`xmax`). To ensure a tuple is visible to the querying transaction, PostgreSQL checks the **Visibility Map (VM)**:
- If the VM marks the 8KB table page as **all-visible** (every row committed before oldest running transaction), Postgres skips the heap entirely (`Heap Fetches: 0`).
- If the VM bit is not set, Postgres must fetch the physical heap page to verify visibility. Regular `VACUUM` runs are required to keep the Visibility Map clean.

---

## 3. Concurrency & Isolation

### Q6: What is Write Skew, and why doesn't `Repeatable Read` prevent it?
**Answer:**
Write Skew occurs when two concurrent transactions read overlapping data, make disjoint decisions based on that data, and write to separate rows, violating a cross-row constraint.

*Example:* A hospital requires at least one doctor on-call.
- Alice and Bob are both on-call.
- Alice runs `SELECT count(*) WHERE on_call = true;` (sees 2), and updates Alice's status to `false`.
- Bob runs `SELECT count(*) WHERE on_call = true;` (sees 2), and updates Bob's status to `false`.
- Both commit! Now zero doctors are on-call.

**Why Repeatable Read Fails:**
Repeatable Read guarantees you see a consistent snapshot and prevents row-level conflicts on the *same* row. Because Alice updated row A and Bob updated row B, there was no row write conflict!

**How to Solve in PostgreSQL:**
1. Use **`SERIALIZABLE`** isolation: PostgreSQL's Serializable Snapshot Isolation (SSI) tracks non-blocking **SIREAD locks** in shared memory. It detects the dependency cycle (rw-antidependency) and aborts one transaction with error `40001: could not serialize access`.
2. Or use explicit locking: `SELECT ... FOR UPDATE` or table-level advisory locks.

---

### Q7: How do you build a high-throughput queue in PostgreSQL without lock contention?
**Answer:**
Using **`SELECT ... FOR UPDATE SKIP LOCKED`**:

```sql
WITH next_item AS (
    SELECT id FROM task_queue 
    WHERE status = 'pending' 
    ORDER BY priority DESC, id ASC 
    LIMIT 1 
    FOR UPDATE SKIP LOCKED
)
UPDATE task_queue
SET status = 'processing', worker_id = 'worker-1'
FROM next_item WHERE task_queue.id = next_item.id
RETURNING task_queue.*;
```

`SKIP LOCKED` instructs backend workers to skip any rows currently locked by other concurrent transactions, immediately acquiring the next unlocked item. This eliminates thread blocking and prevents worker contention across hundreds of concurrent pods.

---

## 4. High Availability, Replication & Scaling

### Q8: What is the purpose of a Replication Slot in Streaming Replication?
**Answer:**
By default, the primary database removes WAL files once checkpoints finish. If a standby node is disconnected or lags behind, the primary might purge WAL segments that the standby has not yet received, resulting in replication failure.

A **Replication Slot** tells the primary: *"Do not delete or recycle any WAL segment on disk until the standby with this slot name has acknowledged receiving and applying it."*
- *Benefit:* Standbys can safely reconnect after hours of downtime without desyncing.
- *Operational Risk:* If a standby goes down permanently and its slot is not dropped, the primary's disk will continuously accumulate WAL files until disk space is 100% exhausted.

---

### Q9: Why does PostgreSQL require PgBouncer in production? What are the tradeoffs of Transaction Pooling?
**Answer:**
PostgreSQL uses a **process-per-connection** model (forking an OS process per client) rather than a thread-per-connection model. 2,000 idle connections consume gigabytes of RAM and induce severe CPU context switching.

**PgBouncer** is a lightweight multiplexer. In **Transaction Pooling Mode**, it maintains a small pool of active backend connections (e.g. 50) and leases them to client sockets strictly for the duration of a transaction (`BEGIN ... COMMIT`), returning the connection immediately after.

**Tradeoffs / Restrictions of Transaction Pooling:**
- Session-level state is lost between transactions.
- `SET search_path` does not persist across transactions (configure per role instead).
- Session advisory locks (`pg_advisory_lock`) can leak (use `pg_advisory_xact_lock` instead).
- Temporary tables (`CREATE TEMP TABLE`) cannot be used reliably.

---

### Q10: How does Row-Level Security (RLS) work for multi-tenant isolation?
**Answer:**
Row-Level Security enforces tenant filtering in the database query planner.
1. Enable RLS on tables: `ALTER TABLE documents ENABLE ROW LEVEL SECURITY;`.
2. Define a security policy using the `USING` and `WITH CHECK` clauses:
   ```sql
   CREATE POLICY tenant_policy ON documents
   FOR ALL
   USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
   WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
   ```
3. The application middleware executes `SET LOCAL app.tenant_id = '...'` at the beginning of each request transaction.
4. When any query runs (e.g. `SELECT * FROM documents`), PostgreSQL automatically rewrites the execution tree to append the tenant check, preventing data leakage even if application developers omit tenant filters.
