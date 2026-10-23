# 02 — PostgreSQL Rich Data Types

## Table of Contents
1. [Beyond Traditional SQL Types](#1-beyond-traditional-sql-types)
2. [Universally Unique Identifiers (UUID)](#2-universally-unique-identifiers-uuid)
3. [Arrays: Definition, Operators & Unnesting](#3-arrays-definition-operators--unnesting)
4. [Range Types & Continuous Intervals](#4-range-types--continuous-intervals)
5. [Network Address Types (`inet` and `cidr`)](#5-network-address-types-inet-and-cidr)
6. [Enumerated Types (`ENUM`)](#6-enumerated-types-enum)
7. [Temporal Types: Why You Must Always Use `TIMESTAMPTZ`](#7-temporal-types-why-you-must-always-use-timestamptz)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. Beyond Traditional SQL Types

While systems like MySQL provide basic numeric and string primitives, PostgreSQL features an expansive, type-safe ecosystem of specialized data types. Utilizing these built-in types simplifies application logic, improves storage density, and unlocks dedicated hardware-accelerated operators and index types.

---

## 2. Universally Unique Identifiers (UUID)

In distributed and microservice systems, auto-incrementing integers (`1, 2, 3`) reveal business metrics (e.g. order volume) and invite enumeration attacks. PostgreSQL provides native, 128-bit compact storage for UUIDs:

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO accounts (account_number) VALUES ('ACC-98124');
SELECT id, account_number FROM accounts;
-- Output id: e7b2353a-4467-4d79-9944-1f2939be3345 (stored as 16 bytes on disk!)
```

---

## 3. Arrays: Definition, Operators & Unnesting

PostgreSQL permits any valid data type (integers, strings, UUIDs, custom types) to be stored as a multi-element **Array**.

```sql
CREATE TABLE articles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}'
);

-- Insert array literals
INSERT INTO articles (title, tags) VALUES 
    ('PostgreSQL Indexing', ARRAY['database', 'performance', 'sql']),
    ('Microservices Design', ARRAY['architecture', 'docker', 'cloud']),
    ('Distributed Consensus', ARRAY['architecture', 'raft', 'database']);
```

### Array Operators & Functions

```sql
-- 1. Contains operator (@>): Find articles that have the tag 'database'
SELECT * FROM articles WHERE tags @> ARRAY['database'];

-- 2. Overlap operator (&&): Find articles that have EITHER 'sql' OR 'docker'
SELECT * FROM articles WHERE tags && ARRAY['sql', 'docker'];

-- 3. Unnesting: Explode array elements into individual relational rows
SELECT id, title, unnest(tags) AS individual_tag FROM articles;

-- 4. Aggregating rows back into an array
SELECT array_agg(title) AS all_titles FROM articles;

-- 5. Indexing arrays for instant sub-millisecond lookups
CREATE INDEX idx_articles_tags_gin ON articles USING gin(tags);
```

---

## 4. Range Types & Continuous Intervals

Instead of storing two distinct columns (`start_date`, `end_date`), PostgreSQL provides **Range Types** that represent contiguous spans of values:

- `daterange`: Range of `date`
- `tsrange`: Range of `timestamp without time zone`
- `tstzrange`: Range of `timestamp with time zone`
- `numrange`: Range of `numeric`
- `int4range`: Range of `integer`

```sql
CREATE TABLE hotel_rates (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_type VARCHAR(50) NOT NULL,
    valid_window DATERANGE NOT NULL,
    nightly_rate NUMERIC(8, 2) NOT NULL
);

INSERT INTO hotel_rates (room_type, valid_window, nightly_rate) VALUES
    ('Deluxe Suite', daterange('2026-06-01', '2026-08-31', '[]'), 249.99),
    ('Deluxe Suite', daterange('2026-09-01', '2026-11-30', '[]'), 179.99);

-- Query: Find the rate applicable for July 15, 2026 using containment (@>)
SELECT * FROM hotel_rates 
WHERE valid_window @> '2026-07-15'::date;

-- Check if two ranges overlap (&&)
SELECT daterange('2026-01-01', '2026-06-30') && daterange('2026-06-01', '2026-12-31');
-- Returns: true
```

---

## 5. Network Address Types (`inet` and `cidr`)

PostgreSQL provides specialized IP address parsing, subnet calculations, and CIDR mask matching directly in SQL:

```sql
CREATE TABLE security_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID,
    ip_address INET NOT NULL,
    accessed_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO security_audit_log (ip_address) VALUES 
    ('192.168.1.45'),
    ('10.0.4.12'),
    ('2001:4860:4860::8888');

-- Subnet Containment (<<=): Find all logs originating from 192.168.1.0/24 subnet
SELECT * FROM security_audit_log 
WHERE ip_address <<= '192.168.1.0/24'::inet;
```

---

## 6. Enumerated Types (`ENUM`)

Enums enforce a strict, static set of permissible string values while storing them internally as compact 4-byte integer identifiers:

```sql
CREATE TYPE shipment_status AS ENUM (
    'pending', 
    'processing', 
    'in_transit', 
    'delivered', 
    'cancelled'
);

CREATE TABLE logistics_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status shipment_status DEFAULT 'pending'
);

-- Adding a new value safely without rebuilding the table:
ALTER TYPE shipment_status ADD VALUE 'returned' AFTER 'cancelled';
```

---

## 7. Temporal Types: Why You Must Always Use `TIMESTAMPTZ`

PostgreSQL offers two primary timestamp types:
1. `TIMESTAMP` (`timestamp without time zone`): **Never use this in production!** It drops timezone offsets and assumes whatever local timezone the server process happens to be in.
2. `TIMESTAMPTZ` (`timestamp with time zone`): **The gold standard.** 
   - Converts input timestamps from any timezone into UTC for physical storage.
   - Converts UTC back to the client's session timezone upon display.
   - Completely immune to Daylight Saving Time (DST) corruption.

```sql
-- Demonstrate TIMESTAMPTZ behavior
SET timezone TO 'America/New_York';
SELECT '2026-01-01 12:00:00+00'::timestamptz;
-- Output: 2026-01-01 07:00:00-05

SET timezone TO 'Asia/Tokyo';
SELECT '2026-01-01 12:00:00+00'::timestamptz;
-- Output: 2026-01-01 21:00:00+09

-- Interval Arithmetic
SELECT now() + INTERVAL '14 days 6 hours';
```

---

## 8. Hands-On Exercises

1. Create a table `device_telemetry` featuring:
   - `device_uuid` as `UUID`
   - `ip_address` as `INET`
   - `error_codes` as `INT[]`
   - `recorded_at` as `TIMESTAMPTZ DEFAULT now()`
2. Insert three rows with different array values.
3. Write a query to find all devices that encountered error code `500` using the `@>` operator.
4. Create a GIN index on `error_codes` and inspect it using `\d+ device_telemetry`.

---

## 9. Summary & Key Takeaways

1. `UUID` provides native 16-byte distributed keys via `gen_random_uuid()`.
2. PostgreSQL `Arrays` eliminate redundant join tables for simple multi-value tags and can be indexed with GIN.
3. `Range Types` simplify time-period overlapping and containment queries.
4. `INET` and `CIDR` provide network subnet search primitives.
5. Always use `TIMESTAMPTZ` to ensure flawless UTC persistence across distributed services.
