# 01 — PL/pgSQL Functions & Control Structures

## Table of Contents
1. [What is PL/pgSQL?](#1-what-is-plpgsql)
2. [Function Declaration Anatomy](#2-function-declaration-anatomy)
3. [Control Structures: Branching & Loops](#3-control-structures-branching--loops)
4. [Exception Handling (`BEGIN ... EXCEPTION`)](#4-exception-handling-begin--exception)
5. [Volatility Categories: IMMUTABLE, STABLE & VOLATILE](#5-volatility-categories-immutable-stable--volatile)
6. [Returning Sets & Tables (`SETOF`, `TABLE`)](#6-returning-sets--tables-setof-table)
7. [Hands-On Practice Exercises](#7-hands-on-practice-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. What is PL/pgSQL?

**PL/pgSQL** (Procedural Language/PostgreSQL) is a loadable procedural language that extends standard SQL with computational control structures, variable assignments, loops, and custom error handling.

Because code runs inside the PostgreSQL backend worker process right next to the memory buffer pool, it eliminates network roundtrips for multi-step algorithms.

---

## 2. Function Declaration Anatomy

```sql
CREATE OR REPLACE FUNCTION calculate_tier_discount(
    p_user_tier VARCHAR,
    p_order_amount NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    v_discount_rate NUMERIC(4, 2) := 0.00;
    v_final_amount  NUMERIC(12, 2);
BEGIN
    IF p_user_tier = 'PLATINUM' THEN
        v_discount_rate := 0.20;
    ELSIF p_user_tier = 'GOLD' THEN
        v_discount_rate := 0.10;
    ELSE
        v_discount_rate := 0.00;
    END IF;

    v_final_amount := p_order_amount * (1.00 - v_discount_rate);
    RETURN v_final_amount;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Control Structures: Branching & Loops

### 1. `FOR` Loop Over Query Results
```sql
CREATE OR REPLACE FUNCTION calculate_customer_lifetime_value(p_customer_id INT)
RETURNS NUMERIC AS $$
DECLARE
    r RECORD;
    v_total NUMERIC := 0;
BEGIN
    FOR r IN SELECT amount, tax FROM orders WHERE customer_id = p_customer_id LOOP
        v_total := v_total + (r.amount + r.tax);
    END LOOP;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;
```

### 2. Numeric Range Loops & `WHILE`
```sql
FOR i IN 1..10 LOOP
    -- Iterates from 1 to 10
END LOOP;

WHILE v_balance > 0 LOOP
    -- Continues until condition is false
END LOOP;
```

---

## 4. Exception Handling (`BEGIN ... EXCEPTION`)

You can intercept database exceptions (such as unique constraint violations) and implement fallback logic:

```sql
CREATE OR REPLACE FUNCTION register_user_safely(
    p_email VARCHAR, 
    p_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO users (email, name)
    VALUES (p_email, p_name)
    RETURNING id INTO v_id;

    RETURN v_id;

EXCEPTION
    WHEN unique_violation THEN
        -- Intercept duplicate email error and fetch existing ID instead
        SELECT id INTO v_id FROM users WHERE email = p_email;
        RETURN v_id;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Unexpected error registering user: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Volatility Categories: IMMUTABLE, STABLE & VOLATILE

Every function in PostgreSQL belongs to one of three volatility categories. Specifying the correct category is crucial for the query planner:

| Volatility Category | Definition | Query Optimizer Behavior | Example |
|---|---|---|---|
| **`VOLATILE` (Default)** | Output can change on every invocation, even within the same query. | Cannot be cached; evaluated per row. | `random()`, `now()`, any function that modifies tables. |
| **`STABLE`** | Output cannot change within a single SQL statement for the same arguments. | Evaluated once per query scan. | `current_date`, lookups based on static config tables. |
| **`IMMUTABLE`** | Given the same inputs, **always** returns the exact same result forever. | Can be pre-evaluated to a constant; **can be used in Expression Indexes!** | `lower(text)`, mathematical functions (`sin(x)`). |

```sql
-- An IMMUTABLE function:
CREATE OR REPLACE FUNCTION clean_tax_id(raw_id TEXT)
RETURNS TEXT AS $$
    SELECT regexp_replace(upper(raw_id), '[^A-Z0-9]', '', 'g');
$$ LANGUAGE sql IMMUTABLE;

-- Can now be used directly in an expression index!
CREATE INDEX idx_tax_clean ON companies (clean_tax_id(tax_id));
```

---

## 6. Returning Sets & Tables (`SETOF`, `TABLE`)

Functions can return dynamic tables that integrate into the `FROM` clause:

```sql
CREATE OR REPLACE FUNCTION get_active_orders_by_vendor(p_vendor_id INT)
RETURNS TABLE (
    order_id INT,
    total NUMERIC,
    placed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, amount, created_at 
    FROM orders 
    WHERE vendor_id = p_vendor_id AND status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql STABLE;

-- Call the function like a standard table:
SELECT * FROM get_active_orders_by_vendor(42) WHERE total > 100.00;
```

---

## 7. Hands-On Practice Exercises

1. Write an `IMMUTABLE` function `calculate_bmi(weight_kg NUMERIC, height_m NUMERIC)` returning a numeric BMI score.
2. Write a PL/pgSQL function that takes an array of integers and returns their sum using a `FOREACH` loop.
3. Add exception handling to intercept division by zero and return `NULL` gracefully.

---

## 8. Summary & Key Takeaways

1. PL/pgSQL runs procedurally inside the server, minimizing network chatter.
2. Handle errors cleanly using `BEGIN ... EXCEPTION WHEN ...`.
3. Mark pure functions as **`IMMUTABLE`** to enable expression indexing and planner constant-folding.
4. Use `RETURNS TABLE (...)` to return dynamic tabular data callable directly in the `FROM` clause.
