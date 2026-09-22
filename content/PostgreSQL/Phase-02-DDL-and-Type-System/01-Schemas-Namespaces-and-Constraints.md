# 01 — Schemas, Namespaces & Advanced Constraints

## Table of Contents
1. [Understanding Schemas and Namespaces](#1-understanding-schemas-and-namespaces)
2. [The `search_path` and Schema Isolation](#2-the-search_path-and-schema-isolation)
3. [Multi-Tenancy Architectures: Schema-per-Tenant](#3-multi-tenancy-architectures-schema-per-tenant)
4. [Advanced Table Constraints](#4-advanced-table-constraints)
5. [Exclusion Constraints (The `EXCLUDE` Clause)](#5-exclusion-constraints-the-exclude-clause)
6. [Generated & Computed Columns](#6-generated--computed-columns)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. Understanding Schemas and Namespaces

In PostgreSQL, a database contains one or more named **schemas**, which contain tables, views, functions, and indexes. A schema acts like an operating system directory namespace, preventing name collisions.

By default, every new database includes a schema named `public`. When an unadorned table name is referenced (e.g. `SELECT * FROM users`), PostgreSQL searches schemas according to the session's `search_path`.

```sql
-- Create custom business domain schemas
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS core;

-- Create a table inside a specific schema
CREATE TABLE billing.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL
);
```

---

## 2. The `search_path` and Schema Isolation

The `search_path` variable is a comma-delimited list of schemas that PostgreSQL checks in order when resolving object names:

```sql
-- View current search path (default: "$user", public)
SHOW search_path;

-- Change search path for current session
SET search_path TO billing, public;

-- Change default search path for a specific database user
ALTER ROLE app_user SET search_path TO core, billing, public;
```

---

## 3. Multi-Tenancy Architectures: Schema-per-Tenant

Enterprise SaaS applications often adopt a **Schema-per-Tenant** pattern:
- **Shared DB, Separate Schemas:** Tenant A data lives in `tenant_apple.*`, while Tenant B lives in `tenant_google.*`.
- **Zero Query Modification:** The application connects and executes `SET search_path TO tenant_apple;`. All ORM queries (`SELECT * FROM orders`) automatically resolve to the isolated tenant schema without requiring `WHERE tenant_id = ?` filters on every query!

```sql
-- Provisioning a new tenant
CREATE SCHEMA tenant_acme;
CREATE TABLE tenant_acme.users (LIKE core.users INCLUDING ALL);
CREATE TABLE tenant_acme.orders (LIKE core.orders INCLUDING ALL);
```

---

## 4. Advanced Table Constraints

PostgreSQL allows rich validation directly in the engine:

### 1. `CHECK` Constraints with Complex Expressions
```sql
CREATE TABLE employees (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    salary NUMERIC(10, 2) NOT NULL,
    min_bonus NUMERIC(10, 2) DEFAULT 0,
    hire_date DATE NOT NULL,
    termination_date DATE,
    -- Enforce positive salary
    CONSTRAINT chk_salary_positive CHECK (salary > 0),
    -- Cross-column comparison: termination must be after hire date
    CONSTRAINT chk_valid_employment_window CHECK (
        termination_date IS NULL OR termination_date >= hire_date
    )
);
```

### 2. Domain Constraints
You can define reusable typed domains with embedded rules:
```sql
-- Define a reusable email domain type
CREATE DOMAIN email_address AS VARCHAR(255)
    CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

CREATE TABLE customers (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_email email_address NOT NULL
);
```

---

## 5. Exclusion Constraints (The `EXCLUDE` Clause)

Standard SQL `UNIQUE` constraints only verify exact equality (`col1 = col2`). What if you need to prevent **overlapping time intervals** (e.g. hotel room reservations or conference room bookings)?

PostgreSQL provides **Exclusion Constraints** using GiST indexes to enforce that no two rows satisfy a comparison operator across ranges.

```sql
-- Enable btree_gist extension to combine scalar types with range types in GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE room_reservations (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_number INT NOT NULL,
    reservation_period TSRANGE NOT NULL,
    -- Prevent overlapping reservations for the SAME room
    CONSTRAINT no_overlapping_room_bookings 
        EXCLUDE USING gist (
            room_number WITH =, 
            reservation_period WITH &&
        )
);

-- Attempting overlapping insert:
INSERT INTO room_reservations (room_number, reservation_period)
VALUES (101, tsrange('2026-06-01 14:00', '2026-06-05 11:00'));

-- This second insert will be REJECTED with a constraint violation!
INSERT INTO room_reservations (room_number, reservation_period)
VALUES (101, tsrange('2026-06-03 12:00', '2026-06-07 10:00'));
-- ERROR: conflicting key value violates exclusion constraint "no_overlapping_room_bookings"
```

---

## 6. Generated & Computed Columns

PostgreSQL supports `GENERATED ALWAYS AS ... STORED` columns, computed automatically from other columns and indexed:

```sql
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL,
    discount_pct NUMERIC(4, 2) DEFAULT 0.00,
    -- Stored generated column
    total_net_price NUMERIC(12, 2) GENERATED ALWAYS AS (
        (unit_price * quantity) * (1.00 - discount_pct)
    ) STORED
);

-- Index the computed column directly
CREATE INDEX idx_inventory_net_price ON inventory_items(total_net_price);
```

---

## 7. Hands-On Exercises

1. Create a schema called `logistics` and set your active `search_path` to include it.
2. Create a table `logistics.shipments` with:
   - `id` as `UUID DEFAULT gen_random_uuid()`
   - `tracking_number` as unique alphanumeric string
   - `weight_kg` check constraint > 0 and <= 5000
   - `dispatched_at` and `delivered_at` check constraint ensuring delivery is after dispatch
3. Verify the constraints by attempting an invalid insert where `delivered_at` precedes `dispatched_at`.

---

## 8. Summary & Key Takeaways

1. Schemas partition databases into logical namespaces, supporting multi-tenant isolation via `search_path`.
2. Cross-column `CHECK` constraints guarantee business logic invariants directly at storage time.
3. Reusable `DOMAIN` types allow consistent regex and range validation across multiple tables.
4. `EXCLUDE` constraints solve difficult temporal and geometric overlap problems atomically in SQL.
5. Generated columns allow pre-computed, indexable virtual expressions that update automatically on writes.
