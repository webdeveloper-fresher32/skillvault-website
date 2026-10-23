# PostgreSQL Production Cheatsheet

---

## 1. Essential `psql` Commands

| Command | Action |
|---|---|
| `\l+` | List all databases with disk sizes and encodings |
| `\c <dbname>` | Switch connection to `<dbname>` |
| `\dt+` | List all tables in active search path with physical sizes |
| `\d+ <table>` | Describe table columns, default expressions, constraints, and indexes |
| `\di+` | List all indexes with disk sizes |
| `\dn` | List all schemas |
| `\df+` | List user-defined and system functions |
| `\timing` | Toggle query execution timer on/off |
| `\x auto` | Automatically toggle expanded vertical display for wide tables |
| `\e` | Open current query buffer in external editor ($EDITOR) |
| `\copy ...` | Execute client-side CSV export/import over standard TCP |
| `\q` | Quit psql shell |

---

## 2. Advanced DDL & Data Types

```sql
-- Rich Built-in Types
UUID                   -- 128-bit unique identifier: gen_random_uuid()
JSONB                  -- Decomposed binary JSON: indexable via GIN
TEXT[]                 -- Dynamic 1D or multi-dimensional array
TSRANGE / DATERANGE    -- Continuous intervals: tsrange('2026-01-01', '2026-06-01')
INET / CIDR            -- IPv4 and IPv6 network addresses with subnet matching
TIMESTAMPTZ            -- Timestamp with Time Zone (Stores UTC internally)

-- Generated Stored Column
CREATE TABLE cart (
    price NUMERIC(10, 2),
    qty INT,
    total NUMERIC(12, 2) GENERATED ALWAYS AS (price * qty) STORED
);

-- Identity Columns (SQL Standard alternative to SERIAL)
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

---

## 3. JSONB Operators & Syntax

```sql
-- Extraction
col -> 'key'                 -- Extract nested JSONB object
col ->> 'key'                -- Extract nested field AS TEXT
col #> '{a, b, c}'           -- Extract path AS JSONB
col #>> '{a, b, c}'          -- Extract path AS TEXT

-- Containment & Existence
col @> '{"status": "ok"}'    -- Does left contain right? (Uses GIN index!)
col <@ '{"status": "ok"}'    -- Is left contained by right?
col ? 'key_name'             -- Does top-level key exist?
col ?| array['a', 'b']       -- Does ANY of these keys exist?
col ?& array['a', 'b']       -- Do ALL of these keys exist?

-- Modification
col || '{"tier": "gold"}'    -- Merge/overwrite top-level keys
col - 'key_name'             -- Delete top-level key
col #- '{address, zip}'      -- Delete nested path
jsonb_set(col, '{a,b}', '"val"') -- In-place nested update
```

---

## 4. DML: Upserts & RETURNING

```sql
-- Atomic UPSERT with EXCLUDED pseudo-table
INSERT INTO page_hits (url, hits, last_hit)
VALUES ('/blog', 1, now())
ON CONFLICT (url)
DO UPDATE SET 
    hits = page_hits.hits + EXCLUDED.hits,
    last_hit = EXCLUDED.last_hit;

-- Idempotent Event Consumer
INSERT INTO event_log (event_id, payload)
VALUES ('uuid-here', '{}')
ON CONFLICT (event_id) DO NOTHING;

-- DML RETURNING Clause
INSERT INTO users (email) VALUES ('test@domain.com') RETURNING id, created_at;
UPDATE accounts SET balance = balance - 50 WHERE id = 1 RETURNING balance;
DELETE FROM queue WHERE id = 10 RETURNING *;
```

---

## 5. Window Functions & Frame Syntax

```sql
SELECT 
    dept, 
    salary,
    -- Ranking
    ROW_NUMBER() OVER w AS row_num,
    RANK()       OVER w AS rnk,
    DENSE_RANK() OVER w AS dense_rnk,
    NTILE(4)     OVER w AS quartile,
    -- Offsets
    LAG(salary, 1, 0)  OVER w AS prev_salary,
    LEAD(salary, 1, 0) OVER w AS next_salary,
    -- Cumulative Running Total
    SUM(salary) OVER (
        PARTITION BY dept 
        ORDER BY salary DESC 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_dept_salary
FROM employees
WINDOW w AS (PARTITION BY dept ORDER BY salary DESC);
```

---

## 6. Index Creation Quick-Reference

```sql
-- Covering Index (Zero-Heap Index Only Scan)
CREATE INDEX idx_orders_covering ON orders (customer_id, status) INCLUDE (total_amount);

-- GIN Index for JSONB Containment (@>)
CREATE INDEX idx_data_path_gin ON documents USING gin (payload jsonb_path_ops);

-- BRIN Index for Big Data Time-Series (99% smaller than B-Tree!)
CREATE INDEX idx_logs_time_brin ON server_logs USING brin (recorded_at);

-- Partial Index (Active records only)
CREATE INDEX idx_orders_pending ON orders (created_at) WHERE status = 'PENDING';

-- Expression Index (Case-insensitive email)
CREATE INDEX idx_users_lower_email ON users (lower(email));

-- Zero-Downtime Online Index Build
CREATE INDEX CONCURRENTLY idx_users_phone ON users (phone_number);
```

---

## 7. PostgreSQL Server Memory Tuning (64GB RAM Dedicated Server)

```ini
shared_buffers = 16GB            # 25% of total server RAM
effective_cache_size = 48GB     # 75% of RAM (Planner assumption of OS page cache)
maintenance_work_mem = 2GB      # Memory for VACUUM, CREATE INDEX
work_mem = 64MB                 # Memory per sort/hash operation
wal_buffers = 16MB              # Top-level WAL buffer cap
random_page_cost = 1.1          # Set to 1.1 for NVMe SSDs (default 4.0 is for HDD)
effective_io_concurrency = 200  # Concurrent SSD I/O channels
```
