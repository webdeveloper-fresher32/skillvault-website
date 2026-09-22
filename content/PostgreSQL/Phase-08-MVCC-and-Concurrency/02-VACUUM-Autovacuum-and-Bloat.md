# 02 — VACUUM, Autovacuum Tuning & Bloat Management

## Table of Contents
1. [The Genesis of Bloat in PostgreSQL](#1-the-genesis-of-bloat-in-postgresql)
2. [What Standard VACUUM Does (and Doesn't Do)](#2-what-standard-vacuum-does-and-doesnt-do)
3. [Standard VACUUM vs VACUUM FULL](#3-standard-vacuum-vs-vacuum-full)
4. [Zero-Downtime De-Bloating with `pg_repack`](#4-zero-downtime-de-bloating-with-pg_repack)
5. [The Autovacuum Trigger Formula](#5-the-autovacuum-trigger-formula)
6. [Tuning Autovacuum for High-Throughput Production](#6-tuning-autovacuum-for-high-throughput-production)
7. [The Nightmare Scenario: Transaction ID (TXID) Wraparound](#7-the-nightmare-scenario-transaction-id-txid-wraparound)
8. [Hands-On Monitoring Queries](#8-hands-on-monitoring-queries)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. The Genesis of Bloat in PostgreSQL

Because `UPDATE` and `DELETE` leave old row versions (dead tuples) on disk, tables and indexes continuously accumulate dead space known as **Bloat**.

If dead tuples are not pruned:
- Sequential scans read gigabytes of dead data, exhausting RAM buffers.
- Disk usage inflates uncontrollably.
- B-Tree indexes expand and fragment.

---

## 2. What Standard VACUUM Does (and Doesn't Do)

When you run `VACUUM orders;`:
1. Scans pages for dead tuples that are no longer visible to any running transaction.
2. Removes dead tuples and updates the **Free Space Map (FSM)** so subsequent `INSERT` statements can reuse those empty page slots.
3. Updates the **Visibility Map (VM)** to accelerate Index-Only Scans.
4. **DOES NOT return disk space to the operating system!** The physical file size on the OS disk remains unchanged—the reclaimed space is kept inside the table for future rows.

---

## 3. Standard VACUUM vs VACUUM FULL

```
┌──────────────────┬─────────────────────────────┬────────────────────────────────┐
│ Dimension        │ Standard VACUUM             │ VACUUM FULL                    │
├──────────────────┼─────────────────────────────┼────────────────────────────────┤
│ Locking Level    │ ShareUpdateExclusiveLock    │ AccessExclusiveLock            │
│ Reads Allowed?   │ YES (100% concurrent reads) │ NO (Blocks all reads & writes!)│
│ Writes Allowed?  │ YES (100% concurrent writes)│ NO                             │
│ Reclaims to OS?  │ NO (Keeps in FSM)           │ YES (Rewrites table from scratch)
│ Extra Disk Space │ Minimal                     │ Requires 2x table size on disk │
└──────────────────┴─────────────────────────────┴────────────────────────────────┘
```

> [!CAUTION]
> **Never run `VACUUM FULL` in production!** It acquires an `AccessExclusiveLock`, completely freezing application traffic until the entire table is rewritten.

---

## 4. Zero-Downtime De-Bloating with `pg_repack`

To reclaim physical OS disk space without downtime, senior engineers use the open-source extension **`pg_repack`**:

```bash
pg_repack -h localhost -d skillvault -t orders
```

### How `pg_repack` Works:
1. Creates a shadow table and logs real-time mutations via temporary triggers.
2. Copies all live data from the bloated table into the compact shadow table.
3. Applies logged mutations to catch up with live traffic.
4. Swaps the catalog tables in a 2-millisecond lock window and drops the old bloated table.

---

## 5. The Autovacuum Trigger Formula

The background daemon determines when to vacuum a table using this threshold formula:

$$\text{Threshold} = \text{autovacuum\_vacuum\_threshold} + (\text{autovacuum\_vacuum\_scale\_factor} \times \text{n\_live\_tup})$$

- **Default threshold:** `50` rows.
- **Default scale factor:** `0.20` (20% of the table).

### The Big Table Scaling Problem:
If a table has **100,000,000 rows**:
$$50 + (0.20 \times 100,000,000) = \mathbf{20,000,050 \text{ dead tuples!}}$$
The database will wait until **20 million dead rows** accumulate before autovacuum even triggers! By that time, the table has bloated by tens of gigabytes.

---

## 6. Tuning Autovacuum for High-Throughput Production

### Step 1: Global Tuning in `postgresql.conf`
```ini
autovacuum = on
autovacuum_max_workers = 5              # Default 3 is often too few
autovacuum_vacuum_cost_limit = 2000     # Default 200 throttles autovacuum too aggressively!
autovacuum_vacuum_cost_delay = 2        # Default 2ms
autovacuum_naptime = 15s                # Check table metrics every 15 seconds
```

### Step 2: Aggressive Per-Table Overrides
For large, high-frequency transactional tables:

```sql
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.02,  -- Trigger at 2% instead of 20%
    autovacuum_vacuum_threshold = 1000,
    autovacuum_vacuum_cost_limit = 5000     -- Give this table dedicated I/O throughput
);
```

---

## 7. The Nightmare Scenario: Transaction ID (TXID) Wraparound

PostgreSQL uses 32-bit integers for transaction IDs ($2^{32} \approx 4.2 \text{ billion}$).

Because modular comparison is used:
- If a database runs for 2 billion transactions without vacuuming old tuples, past transactions will suddenly appear to be in the **future**, causing catastrophic data loss!
- To prevent this, PostgreSQL triggers an emergency **Autovacuum Freeze**:
  - Sets the `HEAP_XMIN_FROZEN` bit on old tuples.
  - Frozen tuples are treated as permanently visible in the past forever.
- If the freeze reaches `autovacuum_freeze_max_age`, PostgreSQL enters read-only emergency mode and will shut down until vacuum completes.

---

## 8. Hands-On Monitoring Queries

```sql
-- 1. Identify tables with the highest dead tuple bloat:
SELECT 
    schemaname, 
    relname, 
    n_live_tup, 
    n_dead_tup, 
    round(n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_tuple_percent,
    last_vacuum, 
    last_autovacuum 
FROM pg_stat_user_tables 
ORDER BY n_dead_tup DESC 
LIMIT 10;

-- 2. Check risk of Transaction ID Wraparound (Distance to 2 Billion):
SELECT 
    datname, 
    age(datfrozenxid) AS age_in_txids,
    2^31 - 1000000 - age(datfrozenxid) AS txids_remaining_before_shutdown
FROM pg_database
ORDER BY age_in_txids DESC;
```

---

## 9. Summary & Key Takeaways

1. `UPDATE` and `DELETE` produce dead tuples, leading to table and index bloat.
2. Standard `VACUUM` marks dead space in the Free Space Map; it does not shrink the file on disk.
3. Never use `VACUUM FULL` in production; use `pg_repack` for online de-bloating.
4. Scale factors of 20% fail on large tables; lower `autovacuum_vacuum_scale_factor` to `0.01–0.05` on high-write tables.
5. Autovacuum freezing prevents catastrophic 32-bit transaction ID wraparound.
