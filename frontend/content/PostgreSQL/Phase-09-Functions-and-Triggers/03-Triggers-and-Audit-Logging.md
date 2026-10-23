# 03 — Triggers, Auditing & Event Triggers

## Table of Contents
1. [The Two-Step Trigger Architecture](#1-the-two-step-trigger-architecture)
2. [Timing: `BEFORE`, `AFTER` and `INSTEAD OF`](#2-timing-before-after-and-instead-of)
3. [Row-Level vs Statement-Level Triggers](#3-row-level-vs-statement-level-triggers)
4. [Special Trigger Variables (`NEW`, `OLD`, `TG_OP`)](#4-special-trigger-variables-new-old-tg_op)
5. [Building an Enterprise JSON Audit Logging Engine](#5-building-an-enterprise-json-audit-logging-engine)
6. [Preventing Schema Destruction with Event Triggers](#6-preventing-schema-destruction-with-event-triggers)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The Two-Step Trigger Architecture

Unlike databases where the trigger definition and procedural code are combined into a single block, PostgreSQL separates triggers into two distinct components:
1. **The Trigger Function:** A reusable PL/pgSQL function declared with `RETURNS TRIGGER`.
2. **The Trigger Binding:** The `CREATE TRIGGER` statement that attaches the function to a specific table, event, and timing.

This separation promotes reuse: a single generic audit logger function can be bound to 50 different tables across your schema!

---

## 2. Timing: `BEFORE`, `AFTER` and `INSTEAD OF`

- **`BEFORE`:** Executes before the row is physically written or modified.
  - Can modify `NEW` (e.g. normalizing phone numbers, populating `updated_at = now()`).
  - Returning `NULL` silently cancels the operation for that row!
- **`AFTER`:** Executes after the row write is complete.
  - Ideal for secondary logging, audit records, or message queues where data must be guaranteed written.
- **`INSTEAD OF`:** Applies only to **Views**, allowing custom insert/update logic on non-updatable complex join views.

---

## 3. Row-Level vs Statement-Level Triggers

- **`FOR EACH ROW`:** Fires once for every individual row modified. If an `UPDATE` modifies 5,000 rows, the trigger executes 5,000 times.
- **`FOR EACH STATEMENT`:** Fires exactly once per SQL command, regardless of whether 0 or 1,000,000 rows were modified. Ideal for bulk validation or statement-level event counters.

---

## 4. Special Trigger Variables (`NEW`, `OLD`, `TG_OP`)

Inside any PL/pgSQL trigger function, the following variables are automatically populated:

| Variable | Type | Description |
|---|---|---|
| **`NEW`** | `RECORD` | The incoming row values for `INSERT` or `UPDATE` (NULL in DELETE). |
| **`OLD`** | `RECORD` | The previous row values before `UPDATE` or `DELETE` (NULL in INSERT). |
| **`TG_OP`** | `TEXT` | The operation string: `'INSERT'`, `'UPDATE'`, `'DELETE'`, or `'TRUNCATE'`. |
| **`TG_TABLE_NAME`**| `TEXT`| Name of the table that triggered the execution. |
| **`TG_WHEN`** | `TEXT` | `'BEFORE'` or `'AFTER'`. |

---

## 5. Building an Enterprise JSON Audit Logging Engine

Here is a production-grade, generic audit logger that can be attached to any table in your database to record complete before-and-after change diffs as `JSONB`:

```sql
-- 1. Centralized immutable audit table
CREATE TABLE enterprise_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schema_name TEXT NOT NULL,
    table_name  TEXT NOT NULL,
    operation   TEXT NOT NULL,
    client_user TEXT NOT NULL DEFAULT current_user,
    client_ip   INET DEFAULT inet_client_addr(),
    old_record  JSONB,
    new_record  JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Generic Trigger Function
CREATE OR REPLACE FUNCTION process_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO enterprise_audit_log (schema_name, table_name, operation, old_record)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, to_jsonb(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO enterprise_audit_log (schema_name, table_name, operation, old_record, new_record)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO enterprise_audit_log (schema_name, table_name, operation, new_record)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach to any table!
CREATE TABLE customer_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id INT NOT NULL,
    credit_limit NUMERIC(10, 2) NOT NULL
);

CREATE TRIGGER trg_audit_customer_billing
AFTER INSERT OR UPDATE OR DELETE ON customer_billing
FOR EACH ROW EXECUTE FUNCTION process_audit_trail();
```

---

## 6. Preventing Schema Destruction with Event Triggers

While standard triggers respond to DML (`INSERT`, `UPDATE`), **Event Triggers** respond to DDL events (`ddl_command_start`, `ddl_command_end`, `sql_drop`).

Use Event Triggers to prevent accidental `DROP TABLE` in production:

```sql
CREATE OR REPLACE FUNCTION block_production_drops()
RETURNS event_trigger AS $$
BEGIN
    RAISE EXCEPTION 'DROP TABLE is forbidden in production! Disable this event trigger first.';
END;
$$ LANGUAGE plpgsql;

CREATE EVENT TRIGGER trg_protect_schema 
ON ddl_command_start 
WHEN TAG IN ('DROP TABLE', 'DROP SCHEMA')
EXECUTE FUNCTION block_production_drops();
```

---

## 7. Hands-On Exercises

1. Create a `products` table with columns `id, name, price, updated_at`.
2. Write a `BEFORE UPDATE` trigger function that automatically sets `NEW.updated_at = now()`.
3. Attach the trigger to `products` and verify that any update refreshes `updated_at` automatically.
4. Attach the `process_audit_trail` function to `products` and verify that updates appear in `enterprise_audit_log`.

---

## 8. Summary & Key Takeaways

1. PostgreSQL triggers require a function returning `TRIGGER` bound via `CREATE TRIGGER`.
2. Use `BEFORE` triggers to modify `NEW` columns or validate invariants before disk write.
3. Use `AFTER` triggers for audit trails and notification publishing.
4. `to_jsonb(OLD)` and `to_jsonb(NEW)` enable zero-schema generic JSON audit logging.
5. **Event Triggers** intercept DDL statements to enforce production schema protections.
