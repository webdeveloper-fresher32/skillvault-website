# 03 — Performance Telemetry, Lock Diagnostics & Benchmarking

## Table of Contents
1. [The PostgreSQL Observability Stack](#1-the-postgresql-observability-stack)
2. [Real-Time Inspection with `pg_stat_activity`](#2-real-time-inspection-with-pg_stat_activity)
3. [Diagnosing Lock Contention & Deadlocks](#3-diagnosing-lock-contention--deadlocks)
4. [Safely Terminating Problematic Queries](#4-safely-terminating-problematic-queries)
5. [Core Cluster Health Ratios](#5-core-cluster-health-ratios)
6. [Automated Log Analysis with `pgBadger`](#6-automated-log-analysis-with-pgbadger)
7. [Stress Testing with `pgbench`](#7-stress-testing-with-pgbench)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The PostgreSQL Observability Stack

Maintaining a healthy database requires monitoring four fundamental vectors:
1. **Saturation:** Connection counts, CPU utilization, disk I/O queue depth.
2. **Traffic:** Transactions Per Second (TPS), query arrival rate.
3. **Latency:** P95/P99 query durations, lock wait times.
4. **Errors:** Deadlocks, constraint failures, serialization rollbacks.

---

## 2. Real-Time Inspection with `pg_stat_activity`

The `pg_stat_activity` view is the command center for real-time investigation:

```sql
-- Find all queries running longer than 5 seconds:
SELECT 
    pid, 
    usename, 
    client_addr, 
    state, 
    now() - query_start AS runtime, 
    wait_event_type, 
    wait_event, 
    query 
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND (now() - query_start) > INTERVAL '5 seconds'
ORDER BY runtime DESC;
```

### The "Idle in Transaction" Hazard
If an application thread issues `BEGIN;`, executes an update, and then stalls waiting for a slow third-party HTTP call before issuing `COMMIT;`:
- That connection holds row locks and prevents autovacuum from cleaning dead tuples!
- **Mitigation in `postgresql.conf`:**
  ```ini
  idle_in_transaction_session_timeout = 30s  # Automatically terminates hung transactions!
  ```

---

## 3. Diagnosing Lock Contention & Deadlocks

When transactions freeze, identify which backend process is blocking others:

```sql
SELECT 
    blocked_locks.pid     AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid    AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query   AS blocked_statement,
    blocking_activity.query  AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

---

## 4. Safely Terminating Problematic Queries

When a runaway rogue query threatens cluster stability:

### Option 1: Soft Cancel (`pg_cancel_backend`)
Attempts to interrupt the currently running query (sends `SIGINT`), leaving the connection open:
```sql
SELECT pg_cancel_backend(12489);
```

### Option 2: Hard Terminate (`pg_terminate_backend`)
Immediately severs the client socket and kills the backend OS process (sends `SIGTERM`):
```sql
SELECT pg_terminate_backend(12489);
```

---

## 5. Core Cluster Health Ratios

### 1. Buffer Cache Hit Ratio (Should be > 99%)
```sql
SELECT 
    sum(heap_blks_read) as disk_reads,
    sum(heap_blks_hit)  as buffer_hits,
    round(sum(heap_blks_hit)::numeric / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2) as hit_ratio
FROM pg_statio_user_tables;
```

### 2. Transaction Commit vs Rollback Ratio
A sudden surge in rollbacks indicates serialization conflicts or application bugs:
```sql
SELECT 
    datname,
    xact_commit,
    xact_rollback,
    round(xact_rollback::numeric / nullif(xact_commit + xact_rollback, 0) * 100, 2) AS rollback_rate_pct
FROM pg_stat_database
WHERE datname = current_database();
```

---

## 6. Automated Log Analysis with `pgBadger`

Configure PostgreSQL to output rich performance telemetry to logs:

```ini
# In postgresql.conf:
logging_collector = on
log_min_duration_statement = 250    # Log any query taking longer than 250ms
log_checkpoints = on                # Log checkpoint duration and dirty buffer counts
log_lock_waits = on                 # Log any lock acquired after 1000ms delay
log_temp_files = 0                  # Log whenever queries spill to disk!
```

Run `pgBadger` to generate comprehensive visual HTML dashboards showing slow query heatmaps, peak QPS hours, and lock histograms:
```bash
pgbadger /var/log/postgresql/postgresql-16-main.log -o daily_report.html
```

---

## 7. Stress Testing with `pgbench`

Validate server hardware and `postgresql.conf` tuning using the built-in TPC-B benchmarking tool:

### Step 1: Initialize Benchmark Schema (Scale Factor = 50 -> ~5M accounts)
```bash
pgbench -i -s 50 -h localhost -U vaultmaster skillvault
```

### Step 2: Run Concurrent Stress Test (20 Clients, 4 Threads for 60 Seconds)
```bash
pgbench -c 20 -j 4 -T 60 -h localhost -U vaultmaster skillvault
```

### Example Result:
```
transaction type: <builtin: TPC-B (sort of)>
scaling factor: 50
query mode: simple
number of clients: 20
number of threads: 4
maximum number of tries: 1
duration: 60 s
number of transactions actually processed: 184,210
latency average = 6.512 ms
initial connection time = 12.430 ms
tps = 3070.166821 (without initial connection time)
```

---

## 8. Summary & Key Takeaways

1. Use `pg_stat_activity` to detect long-running queries and `idle in transaction` sessions.
2. Configure `idle_in_transaction_session_timeout` to kill orphaned sessions holding locks.
3. Use `pg_cancel_backend(pid)` for soft cancel, and `pg_terminate_backend(pid)` for emergency kill.
4. Maintain a **Cache Hit Ratio > 99%** by appropriately sizing `shared_buffers`.
5. Log queries taking over 250ms and analyze logs regularly using **pgBadger**.
6. Benchmark throughput and latency before and after configuration changes using **pgbench**.
