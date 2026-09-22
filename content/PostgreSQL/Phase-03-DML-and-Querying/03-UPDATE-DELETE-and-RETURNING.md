# 03 — UPDATE, DELETE and the RETURNING Clause

## Table of Contents
1. [The Power of the `RETURNING` Clause](#1-the-power-of-the-returning-clause)
2. [`INSERT ... RETURNING`](#2-insert--returning)
3. [`UPDATE ... RETURNING`](#3-update--returning)
4. [`DELETE ... RETURNING`](#4-delete--returning)
5. [Writeable CTEs (Data-Modifying Statements in `WITH`)](#5-writeable-ctes-data-modifying-statements-in-with)
6. [Atomic Move & Archive Pattern](#6-atomic-move--archive-pattern)
7. [Production Soft-Delete Patterns](#7-production-soft-delete-patterns)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. The Power of the `RETURNING` Clause

In standard SQL (such as MySQL), when you insert or update rows, the database only returns the number of affected rows. If you need the newly generated ID, default timestamp, or computed value, your application must issue a subsequent `SELECT` query.

PostgreSQL solves this with the **`RETURNING` clause**: every `INSERT`, `UPDATE`, and `DELETE` statement can return a complete result set of the affected rows, calculated expressions, or specific columns in the same atomic operation.

---

## 2. `INSERT ... RETURNING`

Instantly receive generated identity IDs, UUIDs, and default values without a second network roundtrip:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert and immediately return the auto-generated UUID and timestamp
INSERT INTO users (email) 
VALUES ('dev@skillvault.io')
RETURNING id, created_at;
```

---

## 3. `UPDATE ... RETURNING`

Capture the updated state or compute diffs directly:

```sql
CREATE TABLE account_balances (
    account_id INT PRIMARY KEY,
    balance NUMERIC(12, 2) NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Deduct funds and return the new balance immediately
UPDATE account_balances
SET balance = balance - 150.00,
    last_updated = now()
WHERE account_id = 42 AND balance >= 150.00
RETURNING balance, (balance < 50.00) AS is_low_balance_warning;
```

If no row satisfied `balance >= 150.00`, zero rows are returned, immediately signaling to the application that the transaction was rejected due to insufficient funds.

---

## 4. `DELETE ... RETURNING`

When purging or popping records from a queue:

```sql
CREATE TABLE notification_queue (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    message_body TEXT NOT NULL
);

-- Delete the oldest 5 notifications and retrieve their payload in one step
DELETE FROM notification_queue
WHERE id IN (
    SELECT id FROM notification_queue 
    ORDER BY id ASC 
    LIMIT 5
)
RETURNING recipient_email, message_body;
```

---

## 5. Writeable CTEs (Data-Modifying Statements in `WITH`)

PostgreSQL allows `INSERT`, `UPDATE`, and `DELETE` statements inside Common Table Expressions (`WITH` blocks). This lets you chain complex mutations atomically without needing manual procedural transactions:

```sql
-- Scenario: Create an order and automatically create an order_audit record in one query!
WITH new_order AS (
    INSERT INTO orders (customer_id, order_total)
    VALUES (99, 450.00)
    RETURNING id, customer_id, order_total, created_at
)
INSERT INTO order_audit_log (order_id, action, logged_at)
SELECT id, 'ORDER_CREATED', created_at 
FROM new_order
RETURNING order_id;
```

---

## 6. Atomic Move & Archive Pattern

The classic ETL problem is moving expired rows from a high-throughput active table into an archive cold storage table. With writeable CTEs, this can be done in a **single atomic statement**:

```sql
WITH moved_rows AS (
    -- 1. Delete rows older than 1 year from active table
    DELETE FROM customer_sessions
    WHERE last_active < now() - INTERVAL '1 year'
    RETURNING *
)
-- 2. Insert the deleted rows into the historical archive table
INSERT INTO customer_sessions_archive
SELECT * FROM moved_rows;
```

Because both operations occur inside a single statement, there is **zero risk of duplicate data or lost records** if an error occurs.

---

## 7. Production Soft-Delete Patterns

For regulated applications (HIPAA, SOC2, GDPR), hard deletes are often replaced by **Soft Deletes**:

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    deleted_at TIMESTAMPTZ NULL
);

-- Perform soft delete
UPDATE documents 
SET deleted_at = now() 
WHERE id = 'a8f1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c' 
RETURNING id, deleted_at;

-- Crucial Performance Tip: Create a Partial Index for active documents
CREATE INDEX idx_documents_active 
ON documents (id) 
WHERE deleted_at IS NULL;
```

By filtering queries with `WHERE deleted_at IS NULL`, the query planner uses the ultra-compact partial index, completely ignoring millions of archived records!

---

## 8. Hands-On Exercises

1. Create a table `job_tasks` with `task_id SERIAL`, `task_name TEXT`, `status TEXT DEFAULT 'pending'`, and `started_at TIMESTAMPTZ`.
2. Write an `UPDATE ... RETURNING` query that changes the status of a pending task to `'in_progress'` and sets `started_at = now()`, returning the updated row.
3. Construct a writeable CTE that deletes completed tasks from `job_tasks` and inserts them into a `completed_task_history` table.

---

## 9. Summary & Key Takeaways

1. `RETURNING` eliminates unnecessary secondary `SELECT` lookups.
2. `RETURNING` expressions can compute derived booleans, transformed text, or old/new calculations.
3. **Writeable CTEs** allow data modification pipelines (`DELETE ... RETURNING` -> `INSERT`) in a single atomic SQL command.
4. The atomic archive pattern guarantees data consistency during table purges.
5. Combine soft deletes with **Partial Indexes** (`WHERE deleted_at IS NULL`) to maintain query speed as data ages.
