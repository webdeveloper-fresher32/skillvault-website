# 02 — PostgreSQL Process and Memory Architecture

## Table of Contents
1. [Architectural Overview](#1-architectural-overview)
2. [The Process Model (Process-per-Connection)](#2-the-process-model-process-per-connection)
3. [The Postmaster Daemon](#3-the-postmaster-daemon)
4. [Auxiliary Background Processes](#4-auxiliary-background-processes)
5. [Shared Memory Architecture](#5-shared-memory-architecture)
6. [Local Backend Memory Structures](#6-local-backend-memory-structures)
7. [Disk Storage & The 8KB Page Model](#7-disk-storage--the-8kb-page-model)
8. [Production Memory Sizing Formulas](#8-production-memory-sizing-formulas)
9. [Diagnostic Queries for Process Telemetry](#9-diagnostic-queries-for-process-telemetry)
10. [Summary & Key Takeaways](#10-summary--key-takeaways)

---

## 1. Architectural Overview

PostgreSQL does not operate as a single multi-threaded monolithic process. Instead, it utilizes a robust **multi-process architecture** coordinated via POSIX shared memory and Inter-Process Communication (IPC) semaphores.

This design delivers high fault isolation: if an unexpected segmentation fault or memory bug occurs in an individual client worker process, it cannot corrupt the heap space of neighboring queries.

```
+--------------------------------------------------------------------------------+
|                             POSTGRESQL INSTANCE                                |
|                                                                                |
|   +-----------------------+      Forks      +------------------------------+   |
|   |   Postmaster Daemon   | ------------->  |   Backend Worker (pid 101)   |   |
|   |       (Port 5432)     |                 +------------------------------+   |
|   +-----------------------+      Forks      +------------------------------+   |
|               |                             |   Backend Worker (pid 102)   |   |
|               |                             +------------------------------+   |
|               v Spawns                                                         |
|   +------------------------------------------------------------------------+   |
|   | Background Workers: Checkpointer, BgWriter, Autovacuum, WAL Writer     |   |
|   +------------------------------------------------------------------------+   |
|                                       |                                        |
|   +-----------------------------------v------------------------------------+   |
|   |                        SHARED MEMORY REGION                            |   |
|   |  [ shared_buffers (25% RAM) ] [ wal_buffers ] [ Lock Table / IPC Sem ]  |   |
|   +------------------------------------------------------------------------+   |
|                                       |                                        |
|   +-----------------------------------v------------------------------------+   |
|   |                            DISK STORAGE                                |   |
|   |  Base Data Pages (8KB) <----------- Write-Ahead Log (WAL Segments 16MB)|   |
|   +------------------------------------------------------------------------+   |
+--------------------------------------------------------------------------------+
```

---

## 2. The Process Model (Process-per-Connection)

When a client application connects to PostgreSQL:
1. The **Postmaster** receives the initial TCP connection handshake on port `5432`.
2. Postmaster authenticates the credentials against `pg_hba.conf`.
3. If valid, Postmaster **forks** a brand-new OS process called the **Backend Worker Process** (or backend).
4. The client socket file descriptor is handed over to the backend worker, and Postmaster returns immediately to listening for new connections.

### Consequence: Connection Overhead
Because each connection is an entire OS process consuming roughly 5MB to 10MB of baseline RAM plus private work buffers, PostgreSQL cannot efficiently handle 5,000 idle direct connections. In production, this requires an external connection pooler like **PgBouncer**.

---

## 3. The Postmaster Daemon

The Postmaster (executable name `postgres`) is the supervisor process for the entire database cluster:
- Listens on Unix domain sockets and TCP/IP ports.
- Reads configuration files (`postgresql.conf`, `pg_hba.conf`) on startup and upon receiving `SIGHUP`.
- Monitors backend workers; if a worker crashes unexpectedly, Postmaster kills all other backends, initiates shared memory reset, and executes crash recovery via the Write-Ahead Log.
- Orchestrates clean database shutdown upon `SIGTERM` (smart/fast) or `SIGQUIT` (immediate).

---

## 4. Auxiliary Background Processes

PostgreSQL spawns specialized background workers to maintain cluster health and durability:

| Process | Role | Trigger / Frequency |
|---|---|---|
| **Checkpointer** | Flushes dirty data pages from `shared_buffers` to disk and records a checkpoint record in WAL. | Every `checkpoint_timeout` (default 5 min) or `max_wal_size`. |
| **Background Writer (bgwriter)** | Proactively writes dirty pages to disk so backend queries find free buffers without waiting. | Continuous background scan loop. |
| **WAL Writer** | Flushes Write-Ahead Log records from `wal_buffers` to disk. | Transaction commit or `wal_writer_delay`. |
| **Autovacuum Launcher** | Inspects table update/delete metrics and spawns autovacuum worker processes to reclaim dead tuple space. | Runs continuously; checks every `autovacuum_naptime`. |
| **Stats Collector** | Collects usage statistics (rows read, index hits, table updates) for the query optimizer. | Continuously over UDP messages. |
| **Archiver** | Copies completed WAL segment files (16MB) to cold backup storage for PITR disaster recovery. | Triggered on WAL file rotation. |

---

## 5. Shared Memory Architecture

Shared memory is mapped once at server boot and is accessible to all backend and background processes:

### 1. `shared_buffers`
The shared buffer pool caches 8KB table and index pages read from disk.
- **Default:** 128MB (deliberately low for portability).
- **Production Recommendation:** **25% of total system RAM** on dedicated database hosts.

### 2. `wal_buffers`
Stores unwritten transaction records before flushing them to WAL files.
- Automatically tuned to `1/32` of `shared_buffers`, capped at 16MB (the size of one WAL segment).

### 3. Lock Table & Free Space Map (FSM)
- Tracks heavy-weight table locks, row lock queues, and transaction state.
- The Free Space Map tracks available storage inside existing 8KB pages to accelerate new row inserts.

---

## 6. Local Backend Memory Structures

Unlike `shared_buffers`, local memory is allocated **privately per backend process**:

### 1. `work_mem`
Used by sorting algorithms (`ORDER BY`, `DISTINCT`) and hash joins (`JOIN`, `GROUP BY`).
- **Crucial Rule:** `work_mem` is allocated **per operation**, not per connection. A complex query with 4 joins and 2 sorts can allocate `6 * work_mem` simultaneously!
- **Default:** 4MB.
- **Production Rule:** 32MB–128MB depending on concurrency.

### 2. `maintenance_work_mem`
Used for maintenance tasks: `CREATE INDEX`, `ALTER TABLE ADD FOREIGN KEY`, and `VACUUM`.
- **Default:** 64MB.
- **Production Rule:** 512MB–2GB (since only a few maintenance tasks run concurrently).

### 3. `temp_buffers`
Used for storing session-temporary tables created with `CREATE TEMP TABLE`.

---

## 7. Disk Storage & The 8KB Page Model

PostgreSQL stores all relational data in 8KB disk blocks (pages):

```
+---------------------------------------------------------------+
|                      8KB DISK PAGE LAYOUT                     |
+---------------------------------------------------------------+
| PageHeaderData (24 bytes) - LSN, flags, lower & upper offsets |
+---------------------------------------------------------------+
| Item Pointer Array (line pointers: offset + length)           |
| [Line Ptr 1] [Line Ptr 2] [Line Ptr 3] -------->              |
+---------------------------------------------------------------+
|                   FREE SPACE IN PAGE                          |
+---------------------------------------------------------------+
|                                     <-------- [ Tuple 3 Data ]|
|                          <------------------- [ Tuple 2 Data ]|
|               <------------------------------ [ Tuple 1 Data ]|
+---------------------------------------------------------------+
| Special Space (Index-specific metadata, e.g. B-Tree pointers)  |
+---------------------------------------------------------------+
```

When a row is inserted:
1. A 4-byte line pointer is added to the top of the page.
2. The actual row data (tuple) is placed at the bottom of the page, growing upward into the free space.
3. If free space is exhausted, PostgreSQL allocates another 8KB page.

---

## 8. Production Memory Sizing Formulas

To prevent Out-Of-Memory (OOM) kernel kills on Linux systems:

```
Max Memory Estimate =
    shared_buffers
  + (max_connections * (work_mem * average_sorts_per_query + temp_buffers + 10MB))
  + (autovacuum_max_workers * maintenance_work_mem)
```

### Example: 64GB Dedicated PostgreSQL Server
- `shared_buffers` = 16GB (25%)
- `effective_cache_size` = 48GB (75%, planner hint for OS page cache)
- `maintenance_work_mem` = 2GB
- `work_mem` = 64MB
- `max_connections` = 200 (served behind PgBouncer)
- `wal_buffers` = 16MB

---

## 9. Diagnostic Queries for Process Telemetry

Run these queries to observe processes and buffer hit ratios:

```sql
-- 1. Inspect all active backend processes and their current query state
SELECT 
    pid, 
    usename, 
    client_addr, 
    state, 
    wait_event_type, 
    wait_event, 
    now() - query_start AS duration, 
    query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY duration DESC;

-- 2. Measure Cache Hit Ratio (Should be > 99% in production)
SELECT 
    sum(heap_blks_read) as disk_reads,
    sum(heap_blks_hit)  as buffer_hits,
    round(sum(heap_blks_hit)::numeric / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2) as cache_hit_percentage
FROM pg_statio_user_tables;

-- 3. Check bgwriter and checkpointer statistics
SELECT 
    checkpoints_timed, 
    checkpoints_req, 
    checkpoint_write_time, 
    checkpoint_sync_time, 
    buffers_checkpoint, 
    buffers_clean 
FROM pg_stat_bgwriter;
```

---

## 10. Summary & Key Takeaways

1. PostgreSQL uses a **process-per-connection** model, making external connection pooling essential at scale.
2. `shared_buffers` holds cached 8KB table/index pages across all workers.
3. `work_mem` is allocated privately per sort/hash operation; set it conservatively to avoid OOM crashes.
4. The **Checkpointer** and **Background Writer** ensure durable, performant asynchronous disk writes.
