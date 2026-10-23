# 02 — Stored Procedures with Transaction Control

## Table of Contents
1. [Functions vs Stored Procedures: The Crucial Difference](#1-functions-vs-stored-procedures-the-crucial-difference)
2. [Why Traditional Functions Cannot `COMMIT`](#2-why-traditional-functions-cannot-commit)
3. [Creating and Calling Stored Procedures](#3-creating-and-calling-stored-procedures)
4. [Autonomous Batch Processing with Periodic `COMMIT`](#4-autonomous-batch-processing-with-periodic-commit)
5. [`INOUT` Parameters for Returning Values from Procedures](#5-inout-parameters-for-returning-values-from-procedures)
6. [Handling Rollbacks and Savepoints](#6-handling-rollbacks-and-savepoints)
7. [Hands-On Practice Exercises](#7-hands-on-practice-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. Functions vs Stored Procedures: The Crucial Difference

For over twenty years (until PostgreSQL 11), PostgreSQL did **not** support true SQL Stored Procedures. It only supported `FUNCTION`s.

Starting in PostgreSQL 11, the PostgreSQL Global Development Group introduced **`CREATE PROCEDURE`**:

```
┌───────────────────────────┬─────────────────────────────────┬──────────────────────────────────┐
│ Dimension                 │ FUNCTION                        │ PROCEDURE                        │
├───────────────────────────┼─────────────────────────────────┼──────────────────────────────────┤
│ Invocation                │ `SELECT my_func();`             │ `CALL my_proc();`                │
│ Return Value              │ Must return a scalar, set, void │ Does not return a scalar (INOUT) │
│ Transaction Control       │ **NO COMMIT / ROLLBACK allowed**│ **YES! Can COMMIT & ROLLBACK**   │
│ Context                   │ Part of a larger SQL expression │ Standalone statement execution   │
└───────────────────────────┴─────────────────────────────────┴──────────────────────────────────┘
```

---

## 2. Why Traditional Functions Cannot `COMMIT`

A function is executed as part of an outer SQL expression (e.g. `SELECT id, calculate_discount(price) FROM orders`).

If a function could issue a `COMMIT`, it would commit half the rows of the ongoing `SELECT` statement while leaving the other half uncommitted, completely breaking relational transaction atomicity. Therefore, PostgreSQL strictly forbids transaction control inside functions.

---

## 3. Creating and Calling Stored Procedures

Procedures are declared using `CREATE PROCEDURE` and executed with the `CALL` statement:

```sql
CREATE OR REPLACE PROCEDURE transfer_funds(
    p_sender_id INT,
    p_recipient_id INT,
    p_amount NUMERIC
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Deduct from sender
    UPDATE accounts 
    SET balance = balance - p_amount 
    WHERE id = p_sender_id AND balance >= p_amount;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient balance in sender account %', p_sender_id;
    END IF;

    -- Add to recipient
    UPDATE accounts 
    SET balance = balance + p_amount 
    WHERE id = p_recipient_id;

    -- Commit transaction explicitly!
    COMMIT;
END;
$$;

-- Invocation:
CALL transfer_funds(101, 202, 500.00);
```

---

## 4. Autonomous Batch Processing with Periodic `COMMIT`

### The Production Dilemma:
Suppose you need to delete 20,000,000 old audit records. If you run `DELETE FROM logs WHERE created_at < '2024-01-01';`:
- Locks the table for hours.
- Fills up transaction memory and locks the autovacuum freeze horizon.
- If the server restarts after 99% completion, the entire 20 million row delete **rolls back**, wasting hours of work!

### The Solution: Batched Deletion with Intermediate Commits
With Stored Procedures, you can delete in chunks of 50,000 and commit each batch autonomously:

```sql
CREATE OR REPLACE PROCEDURE purge_old_audit_logs(p_batch_size INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_rows_deleted INT := 0;
    v_iteration    INT := 0;
BEGIN
    LOOP
        -- Delete a bounded chunk
        DELETE FROM audit_logs
        WHERE id IN (
            SELECT id FROM audit_logs
            WHERE created_at < now() - INTERVAL '1 year'
            LIMIT p_batch_size
        );
        
        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        v_iteration := v_iteration + 1;

        -- Commit this batch to disk immediately!
        COMMIT;

        RAISE NOTICE 'Batch %: purged % records. Transaction committed.', v_iteration, v_rows_deleted;

        -- Exit loop once no more rows match
        EXIT WHEN v_rows_deleted < p_batch_size;
    END LOOP;
    
    RAISE NOTICE 'Purge job completed successfully!';
END;
$$;

-- Run the purge in safe 5,000-row chunks:
CALL purge_old_audit_logs(5000);
```

---

## 5. `INOUT` Parameters for Returning Values from Procedures

While procedures do not have a `RETURNS` clause, you can pass output back using `INOUT` parameters:

```sql
CREATE OR REPLACE PROCEDURE compute_cluster_stats(
    IN p_cluster_id INT,
    INOUT p_active_nodes INT DEFAULT 0,
    INOUT p_total_memory_gb NUMERIC DEFAULT 0.0
)
LANGUAGE plpgsql AS $$
BEGIN
    SELECT COUNT(*), COALESCE(SUM(memory_gb), 0)
    INTO p_active_nodes, p_total_memory_gb
    FROM nodes
    WHERE cluster_id = p_cluster_id AND status = 'ONLINE';
END;
$$;

-- Call procedure and observe returned INOUT values:
CALL compute_cluster_stats(1);
```

---

## 6. Handling Rollbacks and Savepoints

Procedures can roll back partial work when errors occur without aborting the entire process:

```sql
CREATE OR REPLACE PROCEDURE process_partner_invoices()
LANGUAGE plpgsql AS $$
BEGIN
    -- Do batch 1
    INSERT INTO partner_sync VALUES (1);
    COMMIT;

    -- Do batch 2 with error recovery
    BEGIN
        INSERT INTO partner_sync VALUES (2);
        -- Intentionally cause division by zero
        PERFORM 1 / 0;
        COMMIT;
    EXCEPTION WHEN division_by_zero THEN
        ROLLBACK;
        RAISE NOTICE 'Batch 2 failed and was rolled back safely. Batch 1 remains committed!';
    END;
END;
$$;
```

---

## 7. Hands-On Practice Exercises

1. Create a `temporary_events` table with 50,000 sample rows.
2. Write a stored procedure that iterates through the table in batches of 1,000, updates a `processed = true` flag, and issues a `COMMIT` after each batch.
3. Test running the procedure with `CALL` and verify that each batch is persisted progressively.

---

## 8. Summary & Key Takeaways

1. `FUNCTION`s run inside expressions and **cannot** issue `COMMIT` or `ROLLBACK`.
2. `PROCEDURE`s are invoked with `CALL` and have full transaction control.
3. Use Stored Procedures for **heavy batch processing** (chunked archiving, migrations) to commit progressively and avoid huge transaction locks.
4. Pass return data from procedures using `INOUT` parameters.
