# 01 — Stored Procedures

```
┌──────────────────────────────────────────────────────────────────────┐
│  A stored procedure is a named, compiled SQL program stored in the   │
│  database catalog. Clients invoke it with CALL; the server executes  │
│  it entirely, returning result sets or writing to OUT parameters.    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [What Is a Stored Procedure?](#1-what-is-a-stored-procedure)
2. [DELIMITER — Why It Exists](#2-delimiter--why-it-exists)
3. [Basic Syntax](#3-basic-syntax)
4. [Parameter Modes: IN, OUT, INOUT](#4-parameter-modes-in-out-inout)
5. [Variables: DECLARE and SET](#5-variables-declare-and-set)
6. [Control Flow](#6-control-flow)
   - 6a. IF / ELSEIF / ELSE
   - 6b. CASE
   - 6c. LOOP / LEAVE / ITERATE
   - 6d. WHILE
   - 6e. REPEAT / UNTIL
7. [Cursors](#7-cursors)
8. [Error Handling: DECLARE HANDLER](#8-error-handling-declare-handler)
9. [Calling Procedures](#9-calling-procedures)
10. [Inspecting and Dropping Procedures](#10-inspecting-and-dropping-procedures)
11. [Full Real-World Example: process_monthly_billing()](#11-full-real-world-example-process_monthly_billing)
12. [Common Pitfalls](#12-common-pitfalls)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What Is a Stored Procedure?

Picture this: your app has ten different call sites — a web checkout flow, a nightly batch job, an admin dashboard, a mobile API — and every single one of them needs to run the same five-statement chunk of business logic: check inventory, insert the order, decrement stock, write an audit row, send it all in one transaction. Today that logic is duplicated in JavaScript here, Python there, and a cron script somewhere else. The day the business rule changes, you're hunting through three codebases hoping you didn't miss a spot.

That's the exact pain a stored procedure exists to kill.

**Real-world analogy:** Think of a stored procedure as a laminated recipe card kept in the kitchen. Any chef (any client — web app, batch job, another script) can request "make dish #7" without knowing the individual steps. They just name the dish, hand over the ingredients (IN params), and get back the finished plate (OUT params / result sets). The recipe itself lives in exactly one place — the kitchen — never duplicated across ten different cookbooks.

**So, plainly: what is it?** A stored procedure is a named, precompiled block of SQL logic saved inside the database itself. You call it by name with `CALL`, pass it some inputs, and the server runs the whole thing — as many statements as you like, with branching, loops, and transactions — in one round trip.

Key properties:
- Stored in the `mysql.proc` system table (MySQL 5.x) or `information_schema.routines` (MySQL 8.x)
- Parsed and compiled once; execution plan cached
- Can execute multiple statements, manage transactions, iterate with cursors
- Invoked with `CALL`, never inside a `SELECT`

```
  Application Layer          Database Server
  ─────────────────         ─────────────────────────────────────
  app.js                    MySQL Process
    │                         │
    │  CALL process_invoice(   │
    │    42,                   │   ┌──────────────────────────┐
    │    @status               │   │  procedure body          │
    │  )          ────────────►│   │  BEGIN                   │
    │                         │   │    SELECT ...            │
    │◄─ result set + @status ──│   │    INSERT ...            │
    │                         │   │    COMMIT;               │
                              │   │  END                     │
                              │   └──────────────────────────┘
```

> **Memory hook:** A stored procedure is the laminated recipe card in the kitchen — call it by name, hand it ingredients, get back a finished plate. Nobody outside the kitchen needs to know the steps.

---

## 2. DELIMITER — Why It Exists

Here's a genuinely confusing beginner moment: you paste a perfectly good `CREATE PROCEDURE` statement into the MySQL client, and it errors out on the very first `;` inside the body — long before it even gets to `END`. What happened?

**The problem:** MySQL's client tools treat `;` as "end of statement, send it to the server now." That's fine for a single `SELECT`. But a procedure body is a whole mini-program full of `;` characters — one after every internal statement. If you don't do anything about it, the client chops your `CREATE PROCEDURE` into a dozen fragments and fires them off one at a time, which is not what you want at all.

**The fix:** temporarily tell the client "stop treating `;` as special — use this other symbol instead (conventionally `//` or `$$`)." That way every semicolon inside the body is just an ordinary character to the client, and the whole block travels to the server as one statement. Once you're done, you switch the delimiter back to `;`.

```sql
-- Tell the client: treat // as the end of a statement
DELIMITER //

CREATE PROCEDURE my_proc()
BEGIN
    SELECT 1;   -- this semicolon is INSIDE the body, not a terminator
    SELECT 2;
END //

-- Restore the default
DELIMITER ;
```

Worth noting: in application code (Python's `mysql-connector`, Node's `mysql2`, etc.) you do **not** need `DELIMITER` at all — that's purely a client-tool convenience. Your driver sends the entire `CREATE PROCEDURE` string as one single API call, with no semicolon-splitting in between, so there's nothing to work around.

**Common mistake:** forgetting to switch the delimiter back to `;` after you're done. If you leave it as `//`, every ordinary statement you type afterward will just sit there waiting for a `//` that never comes — it looks like the client has frozen.

> **Memory hook:** `DELIMITER //` is you telling the client "hold your horses on every `;` you see until I say `//` — this whole block is one package."

---

## 3. Basic Syntax

Strip away the DELIMITER dance and a procedure definition is just this shape: a name, a parameter list, some optional characteristics, and a `BEGIN...END` body.

```sql
DELIMITER //

CREATE PROCEDURE procedure_name (
    [parameter_list]
)
[characteristic ...]
BEGIN
    -- procedure body
    sql_statements;
END //

DELIMITER ;
```

### Characteristics (optional)

| Keyword | Meaning |
|---------|---------|
| `COMMENT 'text'` | Human-readable description |
| `LANGUAGE SQL` | Always SQL in MySQL; included for ANSI compatibility |
| `SQL SECURITY DEFINER` | Execute with the creator's privileges (default) |
| `SQL SECURITY INVOKER` | Execute with the caller's privileges |

```sql
DELIMITER //

CREATE PROCEDURE get_customer_invoices(IN p_customer_id INT)
COMMENT 'Returns all invoices for a given customer ID'
SQL SECURITY INVOKER
BEGIN
    SELECT
        i.invoice_id,
        i.issued_date,
        i.total_amount,
        i.status
    FROM invoices i
    WHERE i.customer_id = p_customer_id
    ORDER BY i.issued_date DESC;
END //

DELIMITER ;
```

---

## 4. Parameter Modes: IN, OUT, INOUT

```
┌──────────┬──────────────────────────────────────────────────────────┐
│  Mode    │  Behavior                                                │
├──────────┼──────────────────────────────────────────────────────────┤
│  IN      │  Value passed IN from caller. Procedure can read it.     │
│          │  Changes inside the procedure do NOT affect the caller.  │
├──────────┼──────────────────────────────────────────────────────────┤
│  OUT     │  Placeholder. Procedure writes to it.                    │
│          │  Caller reads the value after CALL completes.            │
│          │  Initial value inside procedure is NULL.                 │
├──────────┼──────────────────────────────────────────────────────────┤
│  INOUT   │  Caller passes a value IN and reads the (modified)       │
│          │  value back OUT. The procedure can both read and write.  │
└──────────┴──────────────────────────────────────────────────────────┘
```

```sql
DELIMITER //

-- IN: read-only input
CREATE PROCEDURE show_plan_price(IN p_plan VARCHAR(50))
BEGIN
    SELECT plan_name, monthly_price
    FROM subscriptions
    WHERE plan_name = p_plan
    LIMIT 1;
END //

-- OUT: write output back to caller
CREATE PROCEDURE count_active_subscriptions(OUT p_count INT)
BEGIN
    SELECT COUNT(*) INTO p_count
    FROM subscriptions
    WHERE status = 'active';
END //

-- INOUT: read and modify
CREATE PROCEDURE apply_discount(INOUT p_price DECIMAL(8,2), IN p_pct DECIMAL(5,2))
BEGIN
    SET p_price = p_price * (1 - p_pct / 100);
END //

DELIMITER ;

-- Calling them:
CALL show_plan_price('Enterprise');

CALL count_active_subscriptions(@cnt);
SELECT @cnt;

SET @price = 199.99;
CALL apply_discount(@price, 15.00);
SELECT @price;   -- 169.9915
```

---

## 5. Variables: DECLARE and SET

Local variables are declared at the **top** of a `BEGIN...END` block before any executable statements.

```sql
DELIMITER //

CREATE PROCEDURE variable_demo()
BEGIN
    -- DECLARE must come before any other statement in the block
    DECLARE v_total     DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_count     INT           DEFAULT 0;
    DECLARE v_label     VARCHAR(20)   DEFAULT 'unknown';

    -- SET assigns a value
    SET v_count = 10;
    SET v_label = 'active';

    -- SELECT ... INTO assigns from a query result
    SELECT SUM(total_amount) INTO v_total
    FROM invoices
    WHERE status = 'paid';

    SELECT v_count, v_label, v_total;
END //

DELIMITER ;
```

### Variable Scoping Rules

```
BEGIN  -- outer block
    DECLARE v_x INT DEFAULT 1;

    BEGIN  -- inner block
        DECLARE v_x INT DEFAULT 99;  -- shadows outer v_x
        SELECT v_x;  -- returns 99
    END;

    SELECT v_x;  -- returns 1  (outer scope restored)
END
```

Variables declared in a block are visible only within that block and its nested blocks. They are destroyed when the block exits.

### User-Defined vs Local Variables

| Type | Syntax | Scope | Lifetime |
|------|--------|-------|---------|
| Local | `DECLARE v_name TYPE` | Current procedure block | Until block exits |
| User-defined | `@varname` | Current session | Until session ends or overwritten |

User-defined variables (`@`) persist across `CALL` statements in the same session — useful for reading OUT params but dangerous if you forget they carry state.

---

## 6. Control Flow

### 6a. IF / ELSEIF / ELSE

```sql
DELIMITER //

CREATE PROCEDURE classify_invoice(IN p_invoice_id INT, OUT p_category VARCHAR(20))
BEGIN
    DECLARE v_amount DECIMAL(10,2);
    DECLARE v_status VARCHAR(10);

    SELECT total_amount, status
    INTO v_amount, v_status
    FROM invoices
    WHERE invoice_id = p_invoice_id;

    IF v_status = 'paid' THEN
        SET p_category = 'closed';
    ELSEIF v_status = 'overdue' AND v_amount > 1000.00 THEN
        SET p_category = 'high-risk';
    ELSEIF v_status = 'overdue' THEN
        SET p_category = 'overdue';
    ELSE
        SET p_category = 'open';
    END IF;
END //

DELIMITER ;
```

### 6b. CASE

Two forms: **simple** (compare one value) and **searched** (evaluate conditions).

```sql
-- Simple CASE
CASE v_status
    WHEN 'paid'    THEN SET v_label = 'Paid in Full';
    WHEN 'overdue' THEN SET v_label = 'Payment Overdue';
    WHEN 'draft'   THEN SET v_label = 'Draft';
    ELSE                SET v_label = 'Unknown';
END CASE;

-- Searched CASE (more flexible)
CASE
    WHEN v_amount > 10000 THEN SET v_tier = 'enterprise';
    WHEN v_amount > 1000  THEN SET v_tier = 'business';
    WHEN v_amount > 100   THEN SET v_tier = 'standard';
    ELSE                       SET v_tier = 'micro';
END CASE;
```

### 6c. LOOP / LEAVE / ITERATE

`LOOP` is an unconditional loop — you must explicitly `LEAVE` it or it runs forever.

```sql
DELIMITER //

CREATE PROCEDURE loop_demo()
BEGIN
    DECLARE v_i INT DEFAULT 1;

    counter_loop: LOOP
        IF v_i > 5 THEN
            LEAVE counter_loop;   -- break out of the loop
        END IF;

        IF MOD(v_i, 2) = 0 THEN
            SET v_i = v_i + 1;
            ITERATE counter_loop; -- continue to next iteration
        END IF;

        INSERT INTO audit_log (table_name, record_id, action)
        VALUES ('loop_demo', v_i, 'INSERT');

        SET v_i = v_i + 1;
    END LOOP counter_loop;
END //

DELIMITER ;
```

### 6d. WHILE

Evaluates the condition **before** each iteration.

```sql
DELIMITER //

CREATE PROCEDURE generate_weekly_reminders(IN p_weeks INT)
BEGIN
    DECLARE v_week INT DEFAULT 1;
    DECLARE v_due  DATE;

    WHILE v_week <= p_weeks DO
        SET v_due = DATE_ADD(CURDATE(), INTERVAL v_week WEEK);

        INSERT INTO audit_log (table_name, record_id, action, new_value)
        VALUES ('reminders', v_week, 'INSERT',
                JSON_OBJECT('due_date', v_due, 'week', v_week));

        SET v_week = v_week + 1;
    END WHILE;
END //

DELIMITER ;
```

### 6e. REPEAT / UNTIL

Evaluates the condition **after** each iteration — always executes at least once.

```sql
DELIMITER //

CREATE PROCEDURE backoff_retry(IN p_max_attempts INT, OUT p_success TINYINT)
BEGIN
    DECLARE v_attempt  INT DEFAULT 1;
    DECLARE v_done     TINYINT DEFAULT 0;

    SET p_success = 0;

    REPEAT
        -- simulate an operation that might fail
        IF RAND() > 0.7 THEN
            SET v_done    = 1;
            SET p_success = 1;
        END IF;

        SET v_attempt = v_attempt + 1;
    UNTIL v_done = 1 OR v_attempt > p_max_attempts
    END REPEAT;
END //

DELIMITER ;
```

---

## 7. Cursors

A **cursor** is a pointer that traverses a `SELECT` result row by row. Use cursors when set-based SQL cannot express the logic (e.g., per-row decisions with branching).

### Cursor Lifecycle

```
DECLARE cur CURSOR FOR <select>
         │
         ▼
OPEN cur           ← executes the SELECT, materialises the result set
         │
         ▼
FETCH cur INTO var ← advances pointer, copies current row into variable(s)
         │         ← repeat until NOT FOUND handler fires
         ▼
CLOSE cur          ← releases the result set
```

### NOT FOUND Handler Pattern

```sql
DELIMITER //

CREATE PROCEDURE cursor_basics()
BEGIN
    -- 1. Declare variables to hold row data
    DECLARE v_customer_id INT;
    DECLARE v_email       VARCHAR(100);
    DECLARE v_done        INT DEFAULT 0;

    -- 2. Declare the cursor
    DECLARE cur_customers CURSOR FOR
        SELECT customer_id, email
        FROM customers
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);

    -- 3. Declare the NOT FOUND handler
    --    MUST be declared AFTER the cursor
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    -- 4. Open the cursor
    OPEN cur_customers;

    -- 5. Fetch loop
    fetch_loop: LOOP
        FETCH cur_customers INTO v_customer_id, v_email;

        IF v_done = 1 THEN
            LEAVE fetch_loop;
        END IF;

        -- Process each row
        INSERT INTO audit_log (table_name, record_id, action)
        VALUES ('customers', v_customer_id, 'INSERT');
    END LOOP fetch_loop;

    -- 6. Close the cursor
    CLOSE cur_customers;
END //

DELIMITER ;
```

### Important Cursor Rules

- Cursors are **read-only** and **forward-only** in MySQL — no scrolling back.
- You can have multiple cursors open simultaneously, each with its own `NOT FOUND` handler.
- The `NOT FOUND` handler fires on any `FETCH` that finds no more rows — **check `v_done` immediately after `FETCH`** before using the variables, or you will process the last row twice.
- Avoid cursors when a single `UPDATE ... JOIN` or `INSERT ... SELECT` can do the job — set-based operations are orders of magnitude faster.

```
┌───────────────────────────────────────────────────────┐
│  DECLARATION ORDER (strictly enforced in MySQL)       │
│                                                       │
│  1. DECLARE local variables                           │
│  2. DECLARE cursors                                   │
│  3. DECLARE handlers                                  │
│  4. Executable statements                             │
└───────────────────────────────────────────────────────┘
```

---

## 8. Error Handling: DECLARE HANDLER

### Handler Syntax

```sql
DECLARE handler_type HANDLER FOR condition_value
    handler_action;
```

| Component | Options |
|-----------|---------|
| `handler_type` | `CONTINUE` (proceed), `EXIT` (leave block) |
| `condition_value` | `SQLEXCEPTION`, `SQLWARNING`, `NOT FOUND`, specific SQLSTATE, named condition |
| `handler_action` | Single statement or `BEGIN...END` block |

### Common Patterns

```sql
DELIMITER //

CREATE PROCEDURE safe_insert_customer(
    IN  p_first  VARCHAR(50),
    IN  p_last   VARCHAR(50),
    IN  p_email  VARCHAR(100),
    OUT p_result VARCHAR(100)
)
BEGIN
    -- Exit handler: fires on any SQL exception, leaves the BEGIN block
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: transaction rolled back';
    END;

    START TRANSACTION;

    INSERT INTO customers (first_name, last_name, email)
    VALUES (p_first, p_last, p_email);

    COMMIT;
    SET p_result = CONCAT('OK: customer created with id ', LAST_INSERT_ID());
END //

DELIMITER ;
```

### Named Conditions

```sql
DELIMITER //

CREATE PROCEDURE insert_with_named_condition(IN p_email VARCHAR(100))
BEGIN
    -- Define a named condition for duplicate key violations
    DECLARE duplicate_entry CONDITION FOR SQLSTATE '23000';

    DECLARE CONTINUE HANDLER FOR duplicate_entry
    BEGIN
        SELECT CONCAT('Email already registered: ', p_email) AS message;
    END;

    INSERT INTO customers (first_name, last_name, email)
    VALUES ('Test', 'User', p_email);
END //

DELIMITER ;
```

### SIGNAL — Raising Your Own Errors

```sql
DELIMITER //

CREATE PROCEDURE validate_price(IN p_price DECIMAL(8,2))
BEGIN
    IF p_price < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Price cannot be negative',
                MYSQL_ERRNO  = 1644;
    END IF;

    SELECT p_price AS validated_price;
END //

DELIMITER ;
```

SQLSTATE `'45000'` is the conventional "user-defined exception" class. Use it for business rule violations. SQLSTATE values starting with `'HY'`, `'23'`, `'42'` etc. are reserved for engine errors.

---

## 9. Calling Procedures

```sql
-- No parameters
CALL refresh_daily_stats();

-- IN only
CALL get_customer_invoices(42);

-- IN and OUT
CALL count_active_subscriptions(@cnt);
SELECT @cnt AS active_count;

-- INOUT
SET @price = 250.00;
CALL apply_discount(@price, 10);
SELECT @price AS discounted_price;

-- Multiple OUT params
CALL get_invoice_summary(42, @total, @count, @last_date);
SELECT @total, @count, @last_date;
```

### Nesting: CALL inside a Procedure

```sql
DELIMITER //

CREATE PROCEDURE process_new_customer(IN p_email VARCHAR(100))
BEGIN
    DECLARE v_result VARCHAR(100);

    CALL safe_insert_customer('New', 'Customer', p_email, v_result);

    IF v_result LIKE 'OK%' THEN
        -- additional logic after successful insert
        SELECT v_result AS status;
    END IF;
END //

DELIMITER ;
```

---

## 10. Inspecting and Dropping Procedures

```sql
-- List all procedures in the current database
SHOW PROCEDURE STATUS WHERE Db = DATABASE();

-- Show the source of a specific procedure
SHOW CREATE PROCEDURE process_monthly_billing;

-- Query the information schema (more detail)
SELECT
    routine_name,
    routine_type,
    definer,
    created,
    last_altered,
    security_type,
    routine_comment
FROM information_schema.routines
WHERE routine_schema = DATABASE()
  AND routine_type   = 'PROCEDURE'
ORDER BY routine_name;

-- Drop safely
DROP PROCEDURE IF EXISTS old_procedure_name;

-- Recreate with changes (MySQL has no ALTER PROCEDURE for body changes)
DROP PROCEDURE IF EXISTS get_customer_invoices;
-- then CREATE PROCEDURE get_customer_invoices ...
```

---

## 11. Full Real-World Example: process_monthly_billing()

This procedure:
1. Iterates all active subscriptions using a cursor
2. Creates a new invoice for each subscription
3. Inserts a line item based on the subscription plan
4. Updates invoice totals
5. Rolls back and logs errors per customer without aborting the entire batch

```sql
DELIMITER //

CREATE PROCEDURE process_monthly_billing(
    IN  p_billing_month DATE,       -- first day of the month to bill, e.g. '2026-06-01'
    OUT p_invoices_created INT,
    OUT p_errors_encountered INT
)
COMMENT 'Creates monthly invoices for all active subscriptions'
BEGIN
    -- ── local variables ──────────────────────────────────────────────
    DECLARE v_sub_id        INT;
    DECLARE v_cust_id       INT;
    DECLARE v_plan          VARCHAR(50);
    DECLARE v_price         DECIMAL(8,2);
    DECLARE v_new_invoice   INT;
    DECLARE v_done          INT DEFAULT 0;

    DECLARE v_invoices_ok   INT DEFAULT 0;
    DECLARE v_invoices_err  INT DEFAULT 0;

    -- ── cursor: all active subscriptions ─────────────────────────────
    DECLARE cur_subs CURSOR FOR
        SELECT s.subscription_id, s.customer_id, s.plan_name, s.monthly_price
        FROM   subscriptions s
        WHERE  s.status = 'active'
        ORDER  BY s.subscription_id;

    -- ── handlers ─────────────────────────────────────────────────────
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET v_invoices_err = v_invoices_err + 1;
        -- log the failure without aborting the loop
        INSERT INTO audit_log (table_name, record_id, action, new_value)
        VALUES (
            'invoices',
            IFNULL(v_sub_id, -1),
            'INSERT',
            JSON_OBJECT(
                'error',        'billing_failed',
                'subscription', v_sub_id,
                'month',        p_billing_month
            )
        );
    END;

    -- ── initialise output params ─────────────────────────────────────
    SET p_invoices_created   = 0;
    SET p_errors_encountered = 0;

    OPEN cur_subs;

    billing_loop: LOOP
        FETCH cur_subs INTO v_sub_id, v_cust_id, v_plan, v_price;

        IF v_done = 1 THEN
            LEAVE billing_loop;
        END IF;

        -- Each invoice is its own transaction so one failure doesn't
        -- roll back the entire batch.
        START TRANSACTION;

        -- Create the invoice header
        INSERT INTO invoices (
            customer_id,
            issued_date,
            due_date,
            total_amount,
            status
        ) VALUES (
            v_cust_id,
            p_billing_month,
            DATE_ADD(p_billing_month, INTERVAL 14 DAY),
            v_price,
            'sent'
        );

        SET v_new_invoice = LAST_INSERT_ID();

        -- Create the line item
        INSERT INTO invoice_items (
            invoice_id,
            description,
            quantity,
            unit_price
        ) VALUES (
            v_new_invoice,
            CONCAT(v_plan, ' — ', DATE_FORMAT(p_billing_month, '%M %Y')),
            1,
            v_price
        );

        -- Audit trail
        INSERT INTO audit_log (table_name, record_id, action, new_value)
        VALUES (
            'invoices',
            v_new_invoice,
            'INSERT',
            JSON_OBJECT(
                'subscription_id', v_sub_id,
                'customer_id',     v_cust_id,
                'plan',            v_plan,
                'amount',          v_price,
                'month',           p_billing_month
            )
        );

        COMMIT;
        SET v_invoices_ok = v_invoices_ok + 1;

    END LOOP billing_loop;

    CLOSE cur_subs;

    -- Write final counts to OUT params
    SET p_invoices_created   = v_invoices_ok;
    SET p_errors_encountered = v_invoices_err;

END //

DELIMITER ;

-- ── Invoking the billing run ──────────────────────────────────────────
CALL process_monthly_billing('2026-06-01', @created, @errors);

SELECT
    @created AS invoices_created,
    @errors  AS errors_encountered;
```

### Execution Flow Diagram

```
CALL process_monthly_billing('2026-06-01', @created, @errors)
        │
        ▼
  OPEN cursor (SELECT active subscriptions)
        │
        ▼
  ┌─── FETCH next row ◄─────────────────────┐
  │         │                               │
  │    v_done = 1?  ──YES──► LEAVE loop     │
  │         │ NO                            │
  │         ▼                               │
  │    START TRANSACTION                    │
  │         │                               │
  │    INSERT invoices ──► LAST_INSERT_ID() │
  │         │                               │
  │    INSERT invoice_items                 │
  │         │                               │
  │    INSERT audit_log                     │
  │         │                               │
  │    COMMIT ──────────────────────────────┘
  │
  │  (SQLEXCEPTION HANDLER catches any failure:
  │   ROLLBACK, increment error count, log, continue)
  │
  ▼
CLOSE cursor
SET OUT params
```

---

## 12. Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Processing last row twice | Logic executes one extra time | Check `v_done` immediately after `FETCH`, before any other logic |
| Wrong DECLARE order | `ERROR 1337: Variable or condition declaration after cursor or handler` | Declare vars first, then cursors, then handlers |
| Forgetting DELIMITER | `ERROR 1064` near first `;` inside body | Wrap with `DELIMITER //` ... `DELIMITER ;` |
| OUT param is NULL after CALL | Logic path never assigned it | Initialise OUT params explicitly with `SET p_out = default_value` at procedure start |
| SELECT in procedure sends result to client | Unwanted result set appears | Use `SELECT ... INTO var` for assignments; only bare `SELECT` without `INTO` sends results to the client |
| SQLEXCEPTION handler swallowing errors silently | Bugs are hidden | Always log in the handler body; consider re-raising with `RESIGNAL` in debug builds |
| Cursor query ignores new rows inserted mid-loop | Stale result set | Cursors snapshot the result at OPEN time; this is by design — re-open if you need freshness |

---

## 13. Hands-On Exercises

**Exercise 1 — Basic IN/OUT**
Write `get_customer_summary(IN p_id INT, OUT p_full_name VARCHAR(101), OUT p_invoice_count INT)` that returns the customer's full name and total number of invoices.

**Exercise 2 — WHILE Loop**
Write `generate_invoice_schedule(IN p_customer_id INT, IN p_months INT)` that inserts `p_months` draft invoices for the given customer, each dated one month apart starting from the current month.

**Exercise 3 — Cursor with Error Handling**
Write `mark_overdue_invoices(OUT p_updated INT)` that uses a cursor to iterate all `sent` invoices with a `due_date` older than today, sets their status to `overdue`, and counts how many were updated. Wrap each update in error handling.

**Exercise 4 — CASE and SIGNAL**
Write `update_subscription_status(IN p_sub_id INT, IN p_new_status VARCHAR(20))` that validates the new status value against the allowed enum (`active`, `paused`, `cancelled`). If invalid, SIGNAL a user-defined error with SQLSTATE `'45000'` and a descriptive message. If valid, perform the UPDATE.

**Exercise 5 — Nested CALL**
Write `onboard_customer(IN p_first VARCHAR(50), IN p_last VARCHAR(50), IN p_email VARCHAR(100), IN p_plan VARCHAR(50))` that calls `safe_insert_customer`, then, if successful, inserts an `active` subscription for the new customer starting today. Use a local variable to capture the result of the first CALL.

---

## 14. Interview Q&A

**Q1: What is the difference between a stored procedure and a function in MySQL?**
A: A procedure is called with `CALL` and cannot be used inside a SQL expression. It can have IN, OUT, and INOUT parameters, return multiple result sets, and contain transaction control statements. A function is called inside a SQL expression (e.g., `SELECT func()`), must return exactly one scalar value via `RETURN`, can only have IN parameters, and cannot use `COMMIT`/`ROLLBACK` inside the body (unless it calls no SQL at all).

**Q2: Why do you need DELIMITER when creating a procedure in the MySQL CLI?**
A: The MySQL client uses `;` as its statement terminator. A procedure body contains multiple `;` characters. By switching to an alternate delimiter (`//` or `$$`) before the `CREATE PROCEDURE`, you tell the client to treat the entire block as one statement and send it to the server intact.

**Q3: What happens if you declare a cursor BEFORE declaring your handler for NOT FOUND?**
A: MySQL enforces a strict declaration order within a `BEGIN...END` block: variables first, then cursors, then handlers. Reversing this order produces `ERROR 1337: Variable or condition declaration after cursor or handler declaration`.

**Q4: What is the difference between a CONTINUE handler and an EXIT handler?**
A: A `CONTINUE` handler executes its body and then resumes execution at the statement after the one that triggered the condition. An `EXIT` handler executes its body and then exits the `BEGIN...END` block in which the handler was declared — effectively ending that scope.

**Q5: Why should you check v_done immediately after FETCH, before using the fetched variables?**
A: When `FETCH` reaches the end of the result set, MySQL fires the NOT FOUND condition and the handler sets your flag variable (e.g., `v_done = 1`), but the row variables retain the values from the previous successful fetch. If you process the variables before checking the flag, you execute logic on stale data from the last row, effectively processing it a second time.

**Q6: When would you use an INOUT parameter instead of separate IN and OUT parameters?**
A: When the procedure semantically transforms a value — you pass in a price and get back the discounted price, or pass in a count and get back an incremented count. It communicates "this value is both input and output" clearly in the signature. Functionally it is equivalent to separate IN/OUT params, but it reduces the parameter count and makes the mutation intent explicit.

**Q7: What is SQL SECURITY DEFINER vs INVOKER?**
A: `DEFINER` means the procedure runs with the privileges of the user who created it, regardless of who calls it. `INVOKER` means it runs with the privileges of the caller. DEFINER is the default and enables privilege elevation patterns (a low-privilege app user can call a procedure that accesses tables they cannot directly query). INVOKER is safer when you want the procedure to respect the caller's actual permissions.

**Q8: Can a stored procedure call another stored procedure?**
A: Yes. You use `CALL inner_procedure(args)` inside the body. MySQL supports nested calls up to the `max_sp_recursion_depth` system variable (default 0, meaning no recursion; set it to allow recursive procedures). Circular recursion is possible but must be guarded with a depth counter.

**Q9: How do you re-run a modified version of a procedure?**
A: MySQL's `ALTER PROCEDURE` can change characteristics (COMMENT, SQL SECURITY, etc.) but **not the body**. To change the body, you must `DROP PROCEDURE IF EXISTS proc_name` and then `CREATE PROCEDURE proc_name ...` again. Many teams wrap this in a migration script that always drops before re-creating.

**Q10: What does LAST_INSERT_ID() return inside a procedure, and is it safe in concurrent usage?**
A: `LAST_INSERT_ID()` returns the auto-increment value generated by the most recent `INSERT` statement **in the current connection**. It is connection-scoped — concurrent inserts from other connections do not interfere. Inside a procedure, it reflects the last `INSERT` executed within that procedure's connection context.

**Q11: Explain the cursor NOT FOUND pattern — specifically the DECLARE order requirement.**
A: The NOT FOUND `CONTINUE HANDLER` must be declared after the cursor itself in MySQL's declaration block (vars → cursors → handlers). The handler sets a flag variable (`v_done = 1`). Because it is a `CONTINUE` handler, after the flag is set, control returns to the statement after the `FETCH` — which is why you check `IF v_done = 1 THEN LEAVE loop END IF` immediately after every `FETCH`.

**Q12: How would you pass an array or list of values to a stored procedure?**
A: MySQL has no native array parameter type. Common patterns: (1) pass a comma-delimited string and use a parsing procedure with `FIND_IN_SET` or a split UDF; (2) insert the list into a temporary table before calling the procedure and read from it inside; (3) pass a JSON array and use `JSON_TABLE` (MySQL 8.0+) to expand it.

**Q13: What is SIGNAL SQLSTATE '45000' used for?**
A: `'45000'` is the ANSI-reserved SQLSTATE class for user-defined exceptions. Using it with `SIGNAL` lets a procedure raise a custom error that propagates to the caller like any engine error. `'45000'` is the conventional choice for application-level business rule violations (invalid input, constraint not enforced by the schema, etc.).

**Q14: How does MySQL handle a transaction started inside a procedure?**
A: You can use `START TRANSACTION`, `COMMIT`, and `ROLLBACK` inside a procedure body. If the procedure is called from within an existing transaction started by the caller, the inner `COMMIT` commits the outer transaction too — MySQL does not support true nested transactions (savepoints exist but `COMMIT` inside a procedure commits everything). Design procedures to either own their transactions entirely or leave transaction control to the caller.

**Q15: What are the performance implications of using cursors vs set-based SQL?**
A: Cursors process rows one at a time, issuing per-row engine calls. Set-based SQL (single `UPDATE`, `INSERT ... SELECT`, etc.) processes all matching rows in one engine pass, leverages indexes fully, and avoids the overhead of row-by-row context switches. As a rule of thumb, if the logic can be expressed as a single SQL statement, avoid a cursor. Use cursors only when per-row conditional branching is genuinely required and cannot be expressed with `CASE` in a single statement.
