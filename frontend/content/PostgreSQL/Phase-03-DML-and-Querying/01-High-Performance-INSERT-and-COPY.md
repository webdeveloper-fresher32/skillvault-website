# 01 — High-Performance INSERT & Bulk Ingestion with COPY

## Table of Contents
1. [The Cost of Individual Inserts](#1-the-cost-of-individual-inserts)
2. [Multi-Row Batch Inserts](#2-multi-row-batch-inserts)
3. [The PostgreSQL `COPY` Protocol](#3-the-postgresql-copy-protocol)
4. [Using `\copy` in Client Applications & psql](#4-using-copy-in-client-applications--psql)
5. [Unlogged Tables for High-Speed Scratch Processing](#5-unlogged-tables-for-high-speed-scratch-processing)
6. [Tuning Parameters for Mega-Ingestion Jobs](#6-tuning-parameters-for-mega-ingestion-jobs)
7. [Hands-On Benchmark](#7-hands-on-benchmark)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The Cost of Individual Inserts

Executing 10,000 separate `INSERT INTO table VALUES (...)` statements creates severe bottlenecks:
- **Network Latency:** 10,000 individual network roundtrips.
- **Transaction Overhead:** Each auto-committed statement incurs a transaction ID allocation, lock acquisition, and WAL flush.
- **Parsing & Planning:** The SQL parser and optimizer must analyze 10,000 identical statement structures.

```
Individual Inserts (10k rows): ~15–30 seconds
Multi-Row Batch Insert (10k rows): ~0.45 seconds
COPY Stream (10k rows): ~0.08 seconds (100x+ faster!)
```

---

## 2. Multi-Row Batch Inserts

You can insert multiple tuples within a single SQL statement:

```sql
INSERT INTO metrics (sensor_id, reading, recorded_at) VALUES 
    (101, 23.4, now()),
    (102, 25.1, now()),
    (103, 19.8, now()),
    (104, 21.0, now());
```

### Optimal Batch Sizing
In backend applications (Java/Spring, Node.js, Python), chunk bulk inserts into batches of **1,000 to 5,000 rows**. Exceeding 10,000 rows per batch causes memory bloat in client query buffers and locks table pages for too long.

---

## 3. The PostgreSQL `COPY` Protocol

The `COPY` command streams raw delimited data directly into PostgreSQL's internal heap page formatting engine, bypassing SQL parsing, planning, and execution trees.

```sql
-- Syntax for server-side file access (requires superuser or pg_read_server_files role)
COPY transactions (account_id, amount, transaction_type, recorded_at)
FROM '/var/lib/postgresql/data/imports/transactions_2026.csv'
WITH (FORMAT csv, HEADER true, DELIMITER ',');
```

### Binary COPY Format
For maximum performance, PostgreSQL supports `FORMAT binary`. It streams data in PostgreSQL's native endian format, eliminating string-to-binary serialization parsing.

---

## 4. Using `\copy` in Client Applications & psql

Standard `COPY` requires the server process to have direct access to the file path on the database host's filesystem. When running against remote cloud databases (AWS RDS, Supabase, Neon), use **`\copy`** (client-side):

```bash
# Ingest local file into remote PostgreSQL instance
psql -h aws-rds-cluster.internal -U vaultmaster -d prod_db \
  -c "\copy customers FROM './customers_export.csv' WITH (FORMAT csv, HEADER true);"
```

In programming languages:
- **Python (psycopg3):** `cursor.copy("COPY table FROM STDIN")`
- **Java (pgjdbc):** `PGConnection.getCopyAPI().copyIn(...)`
- **Go (pgx):** `conn.CopyFrom(...)`

---

## 5. Unlogged Tables for High-Speed Scratch Processing

If you are ingesting transient staging data that can be re-created if the server crashes, declare the table as **`UNLOGGED`**:

```sql
CREATE UNLOGGED TABLE staging_sensor_data (
    sensor_id INT,
    payload JSONB,
    ingested_at TIMESTAMPTZ DEFAULT now()
);
```

### Why Unlogged Tables Ingest 3x Faster:
- Writes to unlogged tables **generate ZERO Write-Ahead Log (WAL) traffic**.
- Disk I/O is reduced by more than 50%.
- **Tradeoff:** Unlogged tables are automatically truncated upon an unexpected crash or failover, and they are not replicated to streaming read replicas.

---

## 6. Tuning Parameters for Mega-Ingestion Jobs

When performing initial data migrations or loading billions of records:

1. **Drop Secondary Indexes & Foreign Keys First:** Insert all rows, then run `CREATE INDEX` in parallel. Bulk-building an index via external sorting is 10x faster than updating the B-Tree page-by-page during insertion.
2. **Increase `maintenance_work_mem`:** Give Postgres 1GB–2GB of RAM to sort keys when rebuilding indexes after the load.
3. **Defer Constraints:**
   ```sql
   SET CONSTRAINTS ALL DEFERRED;
   ```
4. **Temporarily increase `max_wal_size`:** Prevents the checkpointer from constantly thrashing disk during heavy loading:
   ```sql
   SET max_wal_size = '32GB';
   ```

---

## 7. Hands-On Benchmark

Test bulk insertion speed locally:

```sql
-- Create target benchmark table
CREATE TABLE bulk_bench (
    id INT GENERATED ALWAYS AS IDENTITY,
    payload UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Turn on timing
\timing on

-- Test generate_series ingestion (1,000,000 rows in single statement)
INSERT INTO bulk_bench (payload)
SELECT gen_random_uuid() 
FROM generate_series(1, 1000000);
-- Typical result on modern SSD: ~1.8 to 2.5 seconds for 1 Million rows!
```

---

## 8. Summary & Key Takeaways

1. Never execute high-volume inserts row-by-row in production.
2. Batch small loads in chunks of 1,000–5,000 rows.
3. For large file imports, the `COPY` / `\copy` streaming protocol is the fastest ingestion mechanism available.
4. Use `UNLOGGED` tables for temporary ETL staging to bypass WAL disk serialization.
5. Drop and recreate secondary indexes when loading massive historical datasets.
