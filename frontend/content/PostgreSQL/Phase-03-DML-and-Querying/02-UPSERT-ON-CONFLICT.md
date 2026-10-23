# 02 — Atomic Upserts with ON CONFLICT

## Table of Contents
1. [The Race Condition Problem](#1-the-race-condition-problem)
2. [PostgreSQL `ON CONFLICT` Syntax](#2-postgresql-on-conflict-syntax)
3. [The `EXCLUDED` Pseudo-Table](#3-the-excluded-pseudo-table)
4. [Idempotency with `ON CONFLICT DO NOTHING`](#4-idempotency-with-on-conflict-do-nothing)
5. [Conditional Upserts with the `WHERE` Clause](#5-conditional-upserts-with-the-where-clause)
6. [Partial Unique Indexes as Conflict Targets](#6-partial-unique-indexes-as-conflict-targets)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The Race Condition Problem

In traditional web applications, developers frequently write code like:

```python
# ANTI-PATTERN: Prone to concurrent race condition errors!
user = db.query("SELECT * FROM user_scores WHERE user_id = ?", user_id)
if user:
    db.execute("UPDATE user_scores SET score = ? WHERE user_id = ?", new_score, user_id)
else:
    db.execute("INSERT INTO user_scores (user_id, score) VALUES (?, ?)", user_id, new_score)
```

### Why This Fails in Production:
Between the `SELECT` and the `INSERT`, a concurrent request arrives. Both requests see that the record does not exist, and both attempt an `INSERT`. One succeeds; the second crashes with a `duplicate key value violates unique constraint` exception!

PostgreSQL solves this atomically inside the engine using **`ON CONFLICT`** (informally called **UPSERT**).

---

## 2. PostgreSQL `ON CONFLICT` Syntax

```sql
INSERT INTO table_name (column_list)
VALUES (value_list)
ON CONFLICT (conflict_target)
DO UPDATE SET column_1 = expression, column_2 = expression;
```

The `conflict_target` must be backed by a **`UNIQUE` constraint**, a **primary key**, or a **unique index**.

---

## 3. The `EXCLUDED` Pseudo-Table

Inside the `DO UPDATE` clause, PostgreSQL provides a special pseudo-table named **`EXCLUDED`**. It contains the values that were submitted for insertion:

```sql
CREATE TABLE product_inventory (
    sku VARCHAR(50) PRIMARY KEY,
    quantity INT NOT NULL,
    total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ingest an order event atomically:
INSERT INTO product_inventory (sku, quantity, total_revenue, updated_at)
VALUES ('LAPTOP-PRO-16', 5, 6000.00, now())
ON CONFLICT (sku) 
DO UPDATE SET 
    quantity = product_inventory.quantity + EXCLUDED.quantity,
    total_revenue = product_inventory.total_revenue + EXCLUDED.total_revenue,
    updated_at = EXCLUDED.updated_at;
```

Notice the distinction:
- `product_inventory.quantity` refers to the **existing value** currently in the table.
- `EXCLUDED.quantity` refers to the **new value** passed in the `INSERT` statement.

---

## 4. Idempotency with `ON CONFLICT DO NOTHING`

For distributed message queues (Kafka, RabbitMQ, SQS) where messages may be delivered at least once:

```sql
CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT now()
);

-- If this event has already been recorded, ignore it silently without raising an error
INSERT INTO processed_events (event_id, payload)
VALUES ('6b0805ea-3d3f-4226-8eb5-8e7c10b74182', '{"action": "payment_success"}')
ON CONFLICT (event_id) DO NOTHING;
```

If the event was already inserted, PostgreSQL simply skips the row and returns `INSERT 0 0` without generating a constraint exception.

---

## 5. Conditional Upserts with the `WHERE` Clause

You can append a `WHERE` condition to the `DO UPDATE` clause to guarantee that updates only take place if specific business conditions are satisfied (e.g. **Optimistic Locking** or version gating):

```sql
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY,
    display_name TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only update if the incoming payload has a strictly higher version
INSERT INTO user_profiles (user_id, display_name, version, updated_at)
VALUES ('0efc7bb3-39d1-419b-a316-d8bb4120ec2c', 'New Name', 3, now())
ON CONFLICT (user_id) 
DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    version = EXCLUDED.version,
    updated_at = now()
WHERE EXCLUDED.version > user_profiles.version;
```

If `EXCLUDED.version <= user_profiles.version`, the row is left completely untouched!

---

## 6. Partial Unique Indexes as Conflict Targets

If your table uses a partial unique index (e.g. ensuring uniqueness only among non-deleted active users):

```sql
CREATE TABLE team_memberships (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_id INT NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'active', 'suspended', 'archived'
    role VARCHAR(20) NOT NULL
);

-- Unique index ONLY for active members
CREATE UNIQUE INDEX idx_unique_active_team_member 
ON team_memberships (team_id, user_id) 
WHERE status = 'active';

-- Specify the exact index predicate in the ON CONFLICT clause:
INSERT INTO team_memberships (team_id, user_id, status, role)
VALUES (10, '3c2f9d8a-1122-3344-5566-778899aabbcc', 'active', 'Admin')
ON CONFLICT (team_id, user_id) WHERE status = 'active'
DO UPDATE SET role = EXCLUDED.role;
```

---

## 7. Hands-On Exercises

1. Create a table `page_views` with `url TEXT`, `view_date DATE`, `view_count INT`, and a compound primary key `(url, view_date)`.
2. Write an `INSERT ... ON CONFLICT` statement that increments `view_count = page_views.view_count + 1`.
3. Execute the statement twice with the same URL and date.
4. Verify that `view_count` becomes `2` without any race condition.

---

## 8. Summary & Key Takeaways

1. `ON CONFLICT` guarantees atomic insert-or-update operations without thread race conditions.
2. The `EXCLUDED` table references the proposed insert values.
3. `ON CONFLICT DO NOTHING` is the premier pattern for idempotent consumer pipelines.
4. The `WHERE` clause inside `DO UPDATE` enables optimistic locking and version-gated updates.
5. Partial unique indexes can be targeted directly by matching their exact index predicate.
