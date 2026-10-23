# 01 — Declarative Table Partitioning

## Table of Contents
1. [Why Partition? (The 100-Million Row Problem)](#1-why-partition-the-100-million-row-problem)
2. [Declarative Partitioning Strategies](#2-declarative-partitioning-strategies)
3. [Range Partitioning (Time-Series & Financial Years)](#3-range-partitioning-time-series--financial-years)
4. [List & Hash Partitioning](#4-list--hash-partitioning)
5. [The Power of Partition Pruning](#5-the-power-of-partition-pruning)
6. [Instant Data Aging: `ATTACH` and `DETACH CONCURRENTLY`](#6-instant-data-aging-attach-and-detach-concurrently)
7. [Default Partitions & Caveats](#7-default-partitions--caveats)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. Why Partition? (The 100-Million Row Problem)

When a table grows past 100 million rows:
- Indexes no longer fit in RAM (`shared_buffers`), degrading lookups to slow disk seeks.
- `VACUUM` takes hours to complete.
- Purging old data via `DELETE` causes massive WAL generation and table bloat.

**Table Partitioning** splits a single logical table into multiple smaller physical tables (partitions) under the hood, while preserving a single unified table interface for application queries.

---

## 2. Declarative Partitioning Strategies

PostgreSQL supports three declarative partitioning methods:

1. **RANGE:** Partitions based on contiguous value spans (dates, timestamps, price brackets).
2. **LIST:** Partitions based on explicit discrete values (country codes, currencies, tenant tiers).
3. **HASH:** Partitions based on a modulus and remainder hash of a key (e.g. distributing evenly across 16 shards).

---

## 3. Range Partitioning (Time-Series & Financial Years)

```sql
-- 1. Create the partitioned master table
CREATE TABLE sensor_readings (
    sensor_id INT NOT NULL,
    reading_time TIMESTAMPTZ NOT NULL,
    temperature NUMERIC(5, 2),
    humidity NUMERIC(5, 2)
) PARTITION BY RANGE (reading_time);

-- 2. Create physical monthly partitions
CREATE TABLE sensor_readings_2026_01 
    PARTITION OF sensor_readings
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');

CREATE TABLE sensor_readings_2026_02 
    PARTITION OF sensor_readings
    FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');

CREATE TABLE sensor_readings_2026_03 
    PARTITION OF sensor_readings
    FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');
```

When you insert a row:
```sql
INSERT INTO sensor_readings VALUES (1, '2026-02-15 12:00:00Z', 21.5, 45.0);
```
PostgreSQL automatically routes the tuple into the `sensor_readings_2026_02` partition!

---

## 4. List & Hash Partitioning

### List Partitioning by Country:
```sql
CREATE TABLE regional_users (
    id UUID NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    email TEXT
) PARTITION BY LIST (country_code);

CREATE TABLE users_na PARTITION OF regional_users FOR VALUES IN ('US', 'CA', 'MX');
CREATE TABLE users_eu PARTITION OF regional_users FOR VALUES IN ('DE', 'FR', 'UK', 'NL');
```

### Hash Partitioning:
```sql
CREATE TABLE order_cache (
    order_id UUID NOT NULL,
    payload JSONB
) PARTITION BY HASH (order_id);

-- Create 4 evenly distributed buckets:
CREATE TABLE order_cache_0 PARTITION OF order_cache FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE order_cache_1 PARTITION OF order_cache FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE order_cache_2 PARTITION OF order_cache FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE order_cache_3 PARTITION OF order_cache FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

---

## 5. The Power of Partition Pruning

When a query includes a partition key filter, PostgreSQL activates **Partition Pruning**—it analyzes the `WHERE` clause and **completely excludes non-matching partitions from the query plan**:

```sql
EXPLAIN SELECT * FROM sensor_readings 
WHERE reading_time >= '2026-02-10' AND reading_time < '2026-02-20';
```

### Plan Output:
```
Seq Scan on sensor_readings_2026_02 (cost=0.00..38.25 rows=120 width=28)
  Filter: ((reading_time >= '2026-02-10'...) AND (reading_time < '2026-02-20'...))
```

PostgreSQL did not even touch `sensor_readings_2026_01` or `sensor_readings_2026_03`! Queries scan only 1/12th of the data on disk.

---

## 6. Instant Data Aging: `ATTACH` and `DETACH CONCURRENTLY`

In a standard table, deleting 10 million old records takes hours and ruins performance.
In a partitioned table, **aging out data is an instant metadata operation**:

```sql
-- Detach old partition concurrently without blocking active queries:
ALTER TABLE sensor_readings DETACH PARTITION sensor_readings_2026_01 CONCURRENTLY;

-- Drop the standalone table instantly in 1 millisecond:
DROP TABLE sensor_readings_2026_01;
-- 10 million rows vanished with ZERO WAL bloat!
```

---

## 7. Default Partitions & Caveats

If a row is inserted that doesn't match any declared partition, PostgreSQL throws an error. To prevent dropped writes, attach a **`DEFAULT` partition**:

```sql
CREATE TABLE sensor_readings_default PARTITION OF sensor_readings DEFAULT;
```

> [!WARNING]
> **Primary Key Constraint:** In a partitioned table, the **partition key must be part of every unique constraint and primary key**. You cannot have a primary key on `id` alone; it must be `PRIMARY KEY (id, reading_time)`.

---

## 8. Hands-On Exercises

1. Create a table `audit_logs` partitioned by month on `event_time`.
2. Create partitions for the current and previous month.
3. Insert test rows across both months.
4. Run `EXPLAIN` on a query filtering on a single month and verify that partition pruning eliminated the unused partition.

---

## 9. Summary & Key Takeaways

1. Partitioning divides massive tables into manageable physical chunks.
2. **Partition Pruning** allows queries to skip irrelevant partitions entirely.
3. Dropping a partition (`DROP TABLE partition_name`) reclaims gigabytes in 1 millisecond without table bloat.
4. Always include the partition key in primary key and unique constraint definitions.
5. Use `DETACH PARTITION CONCURRENTLY` for zero-downtime maintenance.
