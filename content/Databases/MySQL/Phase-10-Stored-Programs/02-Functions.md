# Stored Functions — MySQL Complete Guide

## Table of Contents
1. [Functions vs Procedures](#1-functions-vs-procedures)
2. [Creating Functions](#2-creating-functions)
3. [Variables and Control Flow](#3-variables-and-control-flow)
4. [Built-in Function Categories](#4-built-in-function-categories)
5. [Practical Function Examples](#5-practical-function-examples)
6. [Managing Functions](#6-managing-functions)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Functions vs Procedures

**The problem, as a story:**

You just finished the previous lesson and built `apply_discount()` as a stored procedure. It works great when you `CALL` it. But now you want something slightly different — you want to show a discounted price *as a column* in a report:

```sql
SELECT product_name, price, apply_discount(price, 10) AS discounted_price
FROM products;
```

Try that with a procedure and MySQL slaps you with an error. Procedures live outside of SQL expressions — you can only invoke them with `CALL`, standalone, one at a time. You can't drop one into the middle of a `SELECT` list, a `WHERE` clause, or an `ORDER BY`. If the whole point is to reuse a calculation *inline*, inside a query, a procedure simply isn't built for that job.

That's the gap a **stored function** fills.

**Real-world analogy:** think of a stored procedure as sending a work order to a contractor — you hand it a job, it goes off and does a bunch of things (maybe several), and reports back separately. A stored function is more like a calculator button. You press it *in the middle* of doing something else — a spreadsheet formula — and it hands back exactly one number, right there, without interrupting the flow.

**Basic definition:** a stored function is a named block of SQL that takes input parameters, computes a single value, and returns it via `RETURN` — and, because it returns exactly one value, MySQL lets you call it anywhere an expression is allowed: `SELECT`, `WHERE`, `ORDER BY`, even inside another function.

Here's the head-to-head comparison, the same one you'll want to keep in your head every time you're deciding "should this be a function or a procedure?":

| Feature | Stored Function | Stored Procedure |
|---------|----------------|-----------------|
| Returns | Single value (RETURNS) | 0 or more via OUT params |
| Called in | SELECT, WHERE, expressions | CALL statement only |
| Can use in SQL | ✅ Yes | ❌ No |
| Transaction control | ❌ No COMMIT/ROLLBACK | ✅ Yes |
| Use case | Compute and return a value | Perform a workflow |

**Common confusion:** people reach for a procedure first because that's what they learned earlier in this phase, then get surprised when `CALL apply_discount(...)` refuses to sit inside a `SELECT`. The fix isn't a workaround — it's recognizing you picked the wrong tool. If the goal is "one value, usable inline," that's a function's job description, not a procedure's.

**Interview answer:** "A stored function must return exactly one value via `RETURN` and can be used anywhere a scalar expression is valid — `SELECT`, `WHERE`, `ORDER BY`. A stored procedure can return zero, one, or many results (via `OUT`/`INOUT` parameters or result sets), supports transaction control (`COMMIT`/`ROLLBACK`), but can only be invoked with `CALL`, never embedded inside another SQL statement."

> **Memory hook:** "A procedure is a contractor you send a work order to; a function is the calculator button you press mid-formula."

---

## 2. Creating Functions

The shape of a function looks a lot like the procedure syntax you already know, with two differences that matter: a `RETURNS` clause (mandatory — a function without a declared return type doesn't compile), and a `DETERMINISTIC` / `NOT DETERMINISTIC` declaration that a procedure never needed.

```sql
DELIMITER $$

CREATE FUNCTION function_name(param1 TYPE, param2 TYPE)
RETURNS return_type
DETERMINISTIC   -- or NOT DETERMINISTIC
BEGIN
  -- body
  RETURN value;
END$$

DELIMITER ;
```

### DETERMINISTIC vs NOT DETERMINISTIC

**The problem this solves:** MySQL's binary log (`binlog`) records statements so they can be replayed on a replica server or during point-in-time recovery. If a function's output can change between calls — say it reads `NOW()` or `RAND()` — then replaying the same statement later would produce a *different* result on the replica than it did on the primary. Data would silently drift out of sync between servers. MySQL needs to know, up front, whether it's safe to just replay your function call, or whether it needs to log the actual *result* instead of the call itself.

**Real-world analogy:** think of `DETERMINISTIC` as a promise you're signing. "Given the same inputs, I will always hand you the same answer — no dice rolls, no checking the clock." If you can't honestly make that promise (because your function peeks at `NOW()`, `RAND()`, a session variable, or reads mutable table data), you must declare `NOT DETERMINISTIC` instead. Lying about it doesn't cause an immediate error, but it can quietly corrupt replication down the line.

**Basic definition:**
- `DETERMINISTIC` — same inputs always produce the same output. No side effects, no dependence on the clock, random numbers, or changing external state.
- `NOT DETERMINISTIC` (the default if you omit it) — the output can vary between calls even with identical inputs.

**Why it matters specifically for binary logging:** with statement-based replication, MySQL logs the `CALL`/`INSERT`/`UPDATE` statement itself and re-executes it on the replica. If your function is genuinely non-deterministic and you mislabel it as `DETERMINISTIC`, the replica might compute a different value than the primary did — corrupting data integrity across your cluster. This is exactly why MySQL requires you to declare this up front for functions used inside data-modifying statements, and why `NOT DETERMINISTIC` functions may force row-based logging instead of statement-based logging.

```sql
-- DETERMINISTIC: same inputs always give same output (no random, no NOW())
CREATE FUNCTION square(n INT)
RETURNS INT
DETERMINISTIC
BEGIN
  RETURN n * n;
END;

-- NOT DETERMINISTIC: depends on external state
CREATE FUNCTION current_day()
RETURNS VARCHAR(10)
NOT DETERMINISTIC
BEGIN
  RETURN DATE_FORMAT(NOW(), '%Y-%m-%d');
END;
```

**Internal working — what happens when a function is called inline:**

A procedure call is a standalone round trip: client sends `CALL`, server runs the whole body, client gets a result set back. A function call is different — it's evaluated *inside* the query execution plan, once per row (or once per expression evaluation), as the query engine walks through it:

```text
SELECT full_name(first_name, last_name) AS name FROM employees;
        │
        ▼
Query engine builds an execution plan for the SELECT
        │
        ▼
For each row in `employees`:
        │
        ├─► pause row processing
        │       │
        │       ▼
        │   invoke full_name(first, last) as a nested call
        │       │
        │       ▼
        │   function body runs, hits RETURN, hands back ONE value
        │       │
        ▼       ▼
   substitute that value into the `name` column for this row
        │
        ▼
   continue to next row
```

That's the core difference: a procedure is called once, standalone, via `CALL`. A function gets woven directly into the row-by-row (or expression-by-expression) evaluation of a query — which is also exactly why it's restricted to returning one scalar value; anything else wouldn't fit into a single "cell" of the result set.

**Common mistakes to watch for:**

- **Forgetting the `DETERMINISTIC`/`NOT DETERMINISTIC` declaration entirely.** MySQL won't always reject the `CREATE FUNCTION` outright, but if binary logging is enabled with strict settings, you'll hit `ERROR 1418 (HY000): This function has none of DETERMINISTIC...` — MySQL is refusing to log something it can't guarantee is replay-safe.
- **Declaring `DETERMINISTIC` on a function that isn't.** No error here, just quiet, deferred pain — a replica that eventually disagrees with the primary.
- **Forgetting the mandatory single `RETURN`.** Every code path through the function body must reach a `RETURN` statement. Unlike a procedure — which can just fall off the end of its `BEGIN...END` block having done its work via `OUT` params — a function that exits without returning a value is a compile-time error.

**Interview answer:** "`DETERMINISTIC` tells MySQL that given the same inputs, the function always produces the same output, with no reliance on `NOW()`, `RAND()`, session variables, or mutable table state. This matters for binary logging and replication — if a function's result can vary between calls, MySQL can't safely just replay the statement on a replica; it needs the actual computed value logged instead. Mislabeling a non-deterministic function as `DETERMINISTIC` doesn't error immediately, but can silently desynchronize replicas."

> **Memory hook:** "DETERMINISTIC is a promise: same inputs, same answer, no peeking at the clock or rolling dice — break that promise and your replicas quietly drift apart."

### Simple Examples

```sql
DELIMITER $$

-- Full name formatter
CREATE FUNCTION full_name(first VARCHAR(50), last VARCHAR(50))
RETURNS VARCHAR(101)
DETERMINISTIC
BEGIN
  RETURN CONCAT(first, ' ', last);
END$$

-- Tax calculator
CREATE FUNCTION calc_tax(price DECIMAL(10,2), rate DECIMAL(5,2))
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
  RETURN ROUND(price * rate / 100, 2);
END$$

DELIMITER ;

-- Use in queries
SELECT full_name(first_name, last_name) AS name FROM employees;
SELECT price, calc_tax(price, 10) AS tax FROM products;
```

---

## 3. Variables and Control Flow

Everything you learned about `DECLARE`, `SET`, `IF`, `CASE`, and `WHILE` in the procedures lesson still applies here — a function body is still just a `BEGIN...END` block. The only thing that changes is the ending: instead of the block just finishing (or setting an `OUT` parameter), it must funnel down to a single `RETURN`.

### Local Variables

Same idea as before — `DECLARE` a working variable, `SET` it as you go, and use it to build up the value you eventually hand back with `RETURN`.

```sql
DELIMITER $$

CREATE FUNCTION age_category(birth_date DATE)
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
  DECLARE age_years INT;
  DECLARE category VARCHAR(20);

  SET age_years = TIMESTAMPDIFF(YEAR, birth_date, CURDATE());

  IF age_years < 18 THEN
    SET category = 'Minor';
  ELSEIF age_years < 65 THEN
    SET category = 'Adult';
  ELSE
    SET category = 'Senior';
  END IF;

  RETURN category;
END$$

DELIMITER ;
```

### CASE in Functions

You don't even need a `DECLARE`d variable for something this simple — a `CASE` expression can be the entire body of `RETURN`, since `CASE` itself evaluates to a single value:

```sql
DELIMITER $$

CREATE FUNCTION grade_letter(score INT)
RETURNS CHAR(1)
DETERMINISTIC
BEGIN
  RETURN CASE
    WHEN score >= 90 THEN 'A'
    WHEN score >= 80 THEN 'B'
    WHEN score >= 70 THEN 'C'
    WHEN score >= 60 THEN 'D'
    ELSE 'F'
  END;
END$$

DELIMITER ;
```

### LOOP / WHILE in Functions

Loops work exactly like they did inside a procedure — the only difference is that once the loop finishes, the accumulated result gets handed back with `RETURN` instead of being left sitting in a variable. Here's a classic factorial calculator, built by looping and multiplying:

```sql
DELIMITER $$

CREATE FUNCTION factorial(n INT)
RETURNS BIGINT
DETERMINISTIC
BEGIN
  DECLARE result BIGINT DEFAULT 1;
  DECLARE i INT DEFAULT 1;

  WHILE i <= n DO
    SET result = result * i;
    SET i = i + 1;
  END WHILE;

  RETURN result;
END$$

DELIMITER ;

SELECT factorial(10);  -- 3628800
```

> **Memory hook:** "Same DECLARE/SET/IF/WHILE toolbox as procedures — just aim it at one final RETURN instead of an OUT parameter."

---

## 4. Built-in Function Categories

Before you go writing your own custom functions for everything, it's worth pausing — MySQL already ships with a huge library of built-in functions covering strings, numbers, and dates. If a built-in already does the job, use it; save the custom `CREATE FUNCTION` effort for logic that's actually specific to your business (like `to_slug` or `working_days` later in this lesson).

### String Functions

Text manipulation — trimming, searching, padding, reformatting:

```sql
SELECT UPPER('hello');            -- HELLO
SELECT LOWER('WORLD');            -- world
SELECT LENGTH('abc');             -- 3
SELECT CHAR_LENGTH('café');       -- 4 (characters, not bytes)
SELECT SUBSTRING('Hello', 2, 3); -- ell
SELECT TRIM('  hello  ');        -- hello
SELECT REPLACE('foo bar', 'foo', 'baz');  -- baz bar
SELECT CONCAT('Hello', ' ', 'World');     -- Hello World
SELECT FORMAT(12345.678, 2);     -- 12,345.68
SELECT LPAD('5', 3, '0');        -- 005
SELECT LOCATE('ll', 'Hello');    -- 3
```

### Numeric Functions

Rounding, arithmetic, and the occasional random number:

```sql
SELECT ROUND(3.456, 2);   -- 3.46
SELECT CEIL(3.2);          -- 4
SELECT FLOOR(3.9);         -- 3
SELECT ABS(-5);            -- 5
SELECT MOD(10, 3);         -- 1
SELECT POWER(2, 10);       -- 1024
SELECT SQRT(144);          -- 12
SELECT RAND();             -- random 0..1
SELECT TRUNCATE(3.456, 1); -- 3.4
```

Notice `RAND()` in that list — it's the textbook example of a *non-deterministic* built-in. If you ever wrap it inside your own custom function, that's exactly the case where you'd declare `NOT DETERMINISTIC` (see Section 2).

### Date Functions

Today's date, date math, and formatting — the building blocks behind things like `age_category` and `working_days` later in this lesson:

```sql
SELECT NOW();                          -- 2026-06-24 10:30:00
SELECT CURDATE();                      -- 2026-06-24
SELECT CURTIME();                      -- 10:30:00
SELECT DATE_ADD('2026-01-01', INTERVAL 30 DAY);  -- 2026-01-31
SELECT DATEDIFF('2026-12-31', '2026-01-01');     -- 364
SELECT YEAR(NOW()), MONTH(NOW()), DAY(NOW());
SELECT DATE_FORMAT(NOW(), '%d/%m/%Y'); -- 24/06/2026
SELECT LAST_DAY('2026-02-01');        -- 2026-02-28
SELECT TIMESTAMPDIFF(YEAR, '1990-01-01', CURDATE()); -- age in years
```

---

## 5. Practical Function Examples

This is where it clicks — the built-ins from Section 4 are the ingredients, and a custom function is the recipe that combines several of them into one reusable piece of business logic.

### Slug Generator

Ever wondered how a blog title like "Hello World! My Post" turns into a clean URL segment like `hello-world-my-post`? That's a slug generator — lowercase, spaces swapped for dashes, anything that isn't a letter/digit/dash stripped out. Rather than repeating that chain of string functions in every INSERT, wrap it once in a function:

```sql
DELIMITER $$

CREATE FUNCTION to_slug(title VARCHAR(255))
RETURNS VARCHAR(255)
DETERMINISTIC
BEGIN
  DECLARE slug VARCHAR(255);
  SET slug = LOWER(TRIM(title));
  SET slug = REPLACE(slug, ' ', '-');
  SET slug = REGEXP_REPLACE(slug, '[^a-z0-9-]', '');
  RETURN slug;
END$$

DELIMITER ;

SELECT to_slug('Hello World! My Post');  -- hello-world-my-post
```

### Working Days Calculator

HR and payroll systems need this constantly: given a start date and end date, how many *working* days (Monday–Friday) fall in between? Looping day-by-day and checking `DAYOFWEEK` against Saturday/Sunday is exactly the kind of thing you don't want copy-pasted across a dozen reports — one function, called wherever needed:

```sql
DELIMITER $$

CREATE FUNCTION working_days(start_date DATE, end_date DATE)
RETURNS INT
DETERMINISTIC
BEGIN
  DECLARE days INT DEFAULT 0;
  DECLARE d DATE;
  SET d = start_date;
  WHILE d <= end_date DO
    IF DAYOFWEEK(d) NOT IN (1, 7) THEN  -- 1=Sunday, 7=Saturday
      SET days = days + 1;
    END IF;
    SET d = DATE_ADD(d, INTERVAL 1 DAY);
  END WHILE;
  RETURN days;
END$$

DELIMITER ;
```

> **Memory hook:** "Any calculation you'd otherwise copy-paste into ten different queries belongs in a function, not in ten different queries."

---

## 6. Managing Functions

Once a function is deployed, you'll occasionally need to check what's actually in the database, inspect a function's definition, or remove one. There's no `ALTER FUNCTION` for changing the body in MySQL — if the logic needs to change, you drop it and recreate it:

```sql
-- List all functions in current database
SHOW FUNCTION STATUS WHERE Db = DATABASE();

-- View function definition
SHOW CREATE FUNCTION calc_tax\G

-- Drop a function
DROP FUNCTION IF EXISTS calc_tax;

-- Modify: MySQL has no ALTER FUNCTION for body changes
-- Must DROP and re-CREATE
```

---

## 7. Hands-On Exercises

**Exercise 1:** Write a function `days_until_birthday(birth_date DATE)` that returns the number of days until the next birthday.

**Exercise 2:** Write a function `mask_email(email VARCHAR(255))` that returns `jo***@example.com` (masks middle of local part).

**Exercise 3:** Write a function `fibonacci(n INT)` using a WHILE loop that returns the nth Fibonacci number.

**Exercise 4:** Write a function `price_with_discount(price DECIMAL(10,2), discount_pct INT)` and use it in a SELECT to show original price, discount amount, and final price.

**Exercise 5:** Write a function `format_phone(phone VARCHAR(20))` that takes 10 digits and returns `(xxx) xxx-xxxx` format.

---

## 8. Interview Q&A

**Q: What is the difference between a stored function and a stored procedure?**
Answer: A stored function returns a single value and can be used directly inside SQL expressions (SELECT, WHERE, ORDER BY). A stored procedure performs actions and can return multiple values via OUT parameters, but must be called with CALL — it cannot be embedded in SQL expressions.

**Q: What does DETERMINISTIC mean for a function?**
Answer: DETERMINISTIC means the function always returns the same output for the same input — no side effects, no dependency on external state like current time or random values. MySQL uses this for query optimization. Mark functions as NOT DETERMINISTIC if they call NOW(), RAND(), or read variable data.

**Q: Can stored functions use transactions?**
Answer: No. Stored functions cannot use COMMIT, ROLLBACK, or START TRANSACTION. Only stored procedures support transaction control. Functions are designed to compute and return a value, not to manage data workflows.

**Q: How do you return a value from a function?**
Answer: Using the RETURN statement. You must declare the return type in RETURNS clause. Every code path must reach a RETURN statement — MySQL will error if a path exits without returning.

**Q: When should you use a stored function vs a view?**
Answer: Use a stored function when you need to compute a value based on input parameters (dynamic computation). Use a view when you want to encapsulate a static query for reuse. Functions are called with arguments; views have no parameters.
