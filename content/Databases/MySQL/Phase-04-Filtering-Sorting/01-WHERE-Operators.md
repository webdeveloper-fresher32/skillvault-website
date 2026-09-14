# 01 — WHERE Operators

> Filter rows with precision. Know when each operator shines — and when it silently fails.

---

## Table of Contents

1. [Why WHERE Exists](#1-why-where-exists)
2. [Comparison Operators](#2-comparison-operators)
3. [The NULL Gotcha](#3-the-null-gotcha)
4. [BETWEEN x AND y](#4-between-x-and-y)
5. [IN and NOT IN](#5-in-and-not-in)
6. [LIKE — Pattern Matching](#6-like--pattern-matching)
7. [NOT LIKE](#7-not-like)
8. [REGEXP / RLIKE](#8-regexp--rlike)
9. [Combining Conditions — AND / OR / NOT](#9-combining-conditions--and--or--not)
10. [Operator Precedence](#10-operator-precedence)
11. [COALESCE and IFNULL Workarounds](#11-coalesce-and-ifnull-workarounds)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why WHERE Exists

Picture yourself walking into a warehouse with 10 million products stacked floor to
ceiling, and someone hands you a clipboard and says "bring me the ones priced over
$100." You wouldn't carry all 10 million boxes to the front desk and sort them there
— you'd walk the aisles and only pick up the ones that match.

That's exactly the job WHERE does for a SQL query. Without it, `SELECT * FROM
products` would drag every single row back to your application — slow, expensive,
and mostly useless, since you almost never need *all* the rows at once.

So, basic definition: **WHERE is the filter clause that decides which rows survive
into your result set**, evaluated row by row against a condition you supply.

```
┌──────────────────────────────────────────────────────────┐
│  Full Table                                              │
│  ┌──────┬────────────┬───────┐                          │
│  │  id  │  product   │ price │  ← 10,000,000 rows       │
│  ├──────┼────────────┼───────┤                          │
│  │  ..  │     ..     │  ..   │                          │
│  └──────┴────────────┴───────┘                          │
│                 │                                        │
│         WHERE price > 100                               │
│                 │                                        │
│  ┌──────┬────────────┬───────┐                          │
│  │  id  │  product   │ price │  ← 843 rows              │
│  └──────┴────────────┴───────┘                          │
└──────────────────────────────────────────────────────────┘
```

One thing worth internalizing early: MySQL doesn't run WHERE whenever it feels
convenient — it runs in a fixed order. WHERE fires *after* FROM/JOIN (the rows and
joined tables have to exist first) but *before* SELECT projection, GROUP BY, HAVING,
ORDER BY, and LIMIT. That ordering explains a few "gotchas" later in this file — like
why you can't filter on a column alias in WHERE (Q12 in the interview section covers
that).

---

## 2. Comparison Operators

You know these from school-level math — is A equal to B, bigger than B, smaller than
B? SQL just brings the same six comparisons into your WHERE clause so you can slice
rows by them.

### The Core Six

| Operator | Meaning             | Example                     |
|----------|---------------------|-----------------------------|
| `=`      | Equal to            | `WHERE status = 'active'`   |
| `!=`     | Not equal to        | `WHERE status != 'deleted'` |
| `<>`     | Not equal to (ANSI) | `WHERE status <> 'deleted'` |
| `>`      | Greater than        | `WHERE salary > 50000`      |
| `<`      | Less than           | `WHERE age < 18`            |
| `>=`     | Greater or equal    | `WHERE score >= 90`         |
| `<=`     | Less or equal       | `WHERE score <= 100`        |

`!=` and `<>` are functionally identical twins in MySQL — pick whichever your team's
style guide prefers. `<>` is the ANSI SQL standard; `!=` shows up more in
application code because it mirrors most programming languages.

### Equality — Strings Are Case-Insensitive by Default

Here's a surprise for anyone coming from a language where string equality is
strict: in MySQL, `'alice' = 'ALICE'` is often **true**.

```sql
-- Both return the same rows under utf8mb4_general_ci (default collation)
SELECT * FROM users WHERE name = 'alice';
SELECT * FROM users WHERE name = 'ALICE';

-- Force case-sensitive with BINARY
SELECT * FROM users WHERE BINARY name = 'alice';
```

Why? Under the hood, string comparisons don't compare raw bytes — they go through
the column's **collation**, a set of rules for "what counts as equal." The default
`utf8mb4_0900_ai_ci` collation is accent-insensitive *and* case-insensitive (that's
what the `ai_ci` suffix means). If you need strict, byte-for-byte comparison, force
it with `BINARY`.

### Numeric Comparisons

```sql
-- Integer
SELECT * FROM products WHERE quantity > 0;

-- Decimal — watch out for floating-point imprecision
SELECT * FROM measurements WHERE reading = 3.14;  -- can miss rows!

-- Safer pattern for DECIMAL columns:
SELECT * FROM measurements WHERE ABS(reading - 3.14) < 0.0001;
```

### Date Comparisons

```sql
-- Dates compared as strings work because ISO format is lexicographically sortable
SELECT * FROM orders WHERE order_date >= '2024-01-01';
SELECT * FROM orders WHERE order_date BETWEEN '2024-01-01' AND '2024-12-31';

-- DATETIME comparison
SELECT * FROM events WHERE starts_at > NOW();
SELECT * FROM logs   WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### Inequality With Indexes

Not all six operators cost the same at query time — and this is worth knowing
before your table hits a million rows.

`=` can use a B-tree index for a point lookup (very fast — think "jump straight to
the page"). `>`, `<`, `>=`, `<=` can use a range scan — still indexed, but MySQL has
to walk more pages to collect every match. `!=` / `<>` typically forces a full table
scan, because "not this one value" doesn't describe a contiguous range MySQL can
jump to — it has to check every row to rule it out.

```
┌────────────────────────────────────────────────────┐
│  B-Tree Index on salary                            │
│                                                    │
│     30000 → 35000 → 40000 → 50000 → 60000         │
│                       ↑                            │
│         WHERE salary = 40000                       │
│         → single point lookup, O(log n)            │
│                                                    │
│         WHERE salary > 40000                       │
│         → range scan from 40000 onward, O(k)       │
│                                                    │
│         WHERE salary != 40000                      │
│         → full table scan (no index benefit)       │
└────────────────────────────────────────────────────┘
```

---

## 3. The NULL Gotcha

Here's a query almost every beginner writes at some point, and it fails silently:

```sql
SELECT * FROM employees WHERE manager_id = NULL;
```

You run it expecting to find the CEO (the one person with no manager). It comes
back empty. Not an error — just... nothing. That's the trap, and it catches
experienced developers too, not just beginners.

**The real-world analogy:** imagine asking "is your favorite color equal to
*unknown*?" That question doesn't even make sense — you can't compare something to
"I don't know." NULL in SQL is exactly that: not zero, not an empty string, not
false — it's the *absence* of a known value. And you can't meaningfully ask "does
this column equal an absence of value" with `=`.

### The Fatal Mistake

```sql
-- WRONG — this returns 0 rows even if nulls exist
SELECT * FROM employees WHERE manager_id = NULL;

-- WRONG — also returns 0 rows
SELECT * FROM employees WHERE manager_id != NULL;
```

Why do both of these silently return nothing? Because `NULL = NULL` doesn't
evaluate to TRUE — it evaluates to NULL (unknown). And MySQL only keeps a row when
its WHERE condition evaluates to TRUE. An "unknown" answer is treated the same as
"false" for the purposes of deciding whether to keep the row.

### The Correct Way

```sql
-- Check for NULL
SELECT * FROM employees WHERE manager_id IS NULL;

-- Check for not NULL
SELECT * FROM employees WHERE manager_id IS NOT NULL;
```

### Three-Valued Logic (TRUE / FALSE / NULL/UNKNOWN)

This is the part that trips people up conceptually: most of us think in binary
logic — true or false, on or off. MySQL's WHERE clause actually runs on **three**
values: TRUE, FALSE, and NULL (unknown). Any comparison touching a NULL produces
NULL, not TRUE or FALSE — and that NULL then has to combine with AND/OR according
to its own rules, shown below.

```
┌──────────┬───────────┬──────────┐
│    AND   │   TRUE    │  NULL    │
├──────────┼───────────┼──────────┤
│   TRUE   │   TRUE    │  NULL    │
│   FALSE  │   FALSE   │  FALSE   │
│   NULL   │   NULL    │  NULL    │
└──────────┴───────────┴──────────┘

┌──────────┬───────────┬──────────┐
│    OR    │   TRUE    │  NULL    │
├──────────┼───────────┼──────────┤
│   TRUE   │   TRUE    │  TRUE    │
│   FALSE  │   NULL    │  NULL    │
│   NULL   │   TRUE    │  NULL    │
└──────────┴───────────┴──────────┘
```

Read those tables like this: NULL is "contagious" unless the other side of the
operation already settles the answer on its own. `FALSE AND NULL = FALSE` — because
no matter what the unknown value turns out to be, the AND was already doomed by the
FALSE. But `TRUE AND NULL = NULL` — the TRUE side didn't settle anything, so the
unknown still poisons the result. Same logic mirrored for OR: only a TRUE can
rescue an OR from a NULL; a FALSE can't.

### The Correct Way

```sql
-- Check for NULL
SELECT * FROM employees WHERE manager_id IS NULL;

-- Check for not NULL
SELECT * FROM employees WHERE manager_id IS NOT NULL;
```

`IS NULL` and `IS NOT NULL` are special-cased by MySQL specifically so you have a
way to ask "is this unknown?" without falling into the `= NULL` trap — they always
resolve to a clean TRUE or FALSE, never NULL.

### Practical NULL Checks

```sql
-- Employees who have no manager (top-level)
SELECT * FROM employees WHERE manager_id IS NULL;

-- Orders with no shipping address entered yet
SELECT * FROM orders WHERE shipped_to IS NULL;

-- Products with a discount applied (discount is not null AND > 0)
SELECT * FROM products WHERE discount IS NOT NULL AND discount > 0;
```

### `=` vs `IS` — Which One For What

| Comparing to | Use | Why |
|---|---|---|
| A concrete value (`'active'`, `5`, `'2024-01-01'`) | `=` | Ordinary equality check |
| NULL | `IS NULL` / `IS NOT NULL` | `=` and `!=` against NULL always yield NULL, never TRUE |
| NULL-safe equality (both sides might be NULL) | `<=>` | The only operator where `NULL <=> NULL` returns TRUE |

> **Memory hook:** You can't ask "is this equal to unknown?" — you can only ask
> "is this unknown?" That's the difference between `= NULL` (always fails) and
> `IS NULL` (works).

---

## 4. BETWEEN x AND y

Say you want every product priced from $10 to $50. You *could* write
`price >= 10 AND price <= 50` every time — but that's two comparisons and two
chances to fumble the boundary. BETWEEN exists so you can say "give me everything
in this range" in one readable phrase, the same way you'd say "anywhere between
page 10 and page 50" to a librarian, fully expecting pages 10 and 50 themselves to
be included.

That's the key detail worth memorizing: **BETWEEN is inclusive on both ends** — it
is exactly equivalent to `col >= x AND col <= y`, nothing more, nothing less.

```sql
-- Numeric
SELECT * FROM products  WHERE price BETWEEN 10 AND 50;
-- Same as: WHERE price >= 10 AND price <= 50

-- Date — include all of 2024
SELECT * FROM orders WHERE order_date BETWEEN '2024-01-01' AND '2024-12-31';

-- DATETIME — include entire last day (to end of day use 23:59:59 or < next day)
SELECT * FROM logs
WHERE created_at BETWEEN '2024-06-01 00:00:00' AND '2024-06-01 23:59:59';

-- Safer datetime pattern (avoids 23:59:59 edge)
SELECT * FROM logs
WHERE created_at >= '2024-06-01' AND created_at < '2024-06-02';
```

### NOT BETWEEN

```sql
-- Prices outside the 10-50 range
SELECT * FROM products WHERE price NOT BETWEEN 10 AND 50;
-- Same as: WHERE price < 10 OR price > 50
```

### BETWEEN With Strings

```sql
-- Alphabetical range (uses collation)
SELECT * FROM countries WHERE name BETWEEN 'A' AND 'M';
-- Returns Australia, Brazil, Canada, Italy, etc.
```

### BETWEEN and NULL

Remember the three-valued logic from Section 3? It reaches into BETWEEN too. If
either endpoint is NULL, BETWEEN can't determine a definite range, so it returns
NULL — and a NULL result means no rows match, silently.

```sql
-- Returns nothing if min_price or max_price is NULL
DECLARE @min INT = NULL;
SELECT * FROM products WHERE price BETWEEN @min AND 100;  -- 0 rows
```

### Performance Note

Good news on speed: because BETWEEN is just sugar for `>= AND <=`, it gets the same
treatment from the query optimizer — a B-tree index range scan, not a full table
scan.

```
┌──────────────────────────────────────────────────┐
│  EXPLAIN output for BETWEEN                      │
│  type: range                                     │
│  key:  idx_price                                 │
│  Extra: Using index condition                    │
└──────────────────────────────────────────────────┘
```

### BETWEEN vs `>=` / `<=` vs Chained Comparisons

| Form | Reads as | When to prefer |
|---|---|---|
| `BETWEEN x AND y` | "in this range, inclusive" | Ranges, especially dates — most readable |
| `col >= x AND col <= y` | Same result, spelled out | When you need one side exclusive (mix with `<` or `>`) |
| `NOT BETWEEN x AND y` | "outside this range" | Excluding a middle band |

> **Memory hook:** BETWEEN is a librarian who hands you the shelves *and* the two
> end books you asked for — never just the middle.

---

## 5. IN and NOT IN

Suppose you need every order that's `pending`, `processing`, or `shipped`. Writing
`status = 'pending' OR status = 'processing' OR status = 'shipped'` works, but
imagine that list growing to 20 statuses — that's 20 repetitions of `status =`,
20 chances for a typo. IN exists to collapse that whole chain into one clean list,
the way you'd say "I'll take the Tuesday, Wednesday, or Friday flight" instead of
naming each day in a separate sentence.

### IN — Match Any Value in a List

```sql
-- Equivalent to multiple OR conditions
SELECT * FROM orders WHERE status IN ('pending', 'processing', 'shipped');

-- Same as:
SELECT * FROM orders
WHERE status = 'pending'
   OR status = 'processing'
   OR status = 'shipped';
```

IN is cleaner, more readable, and MySQL optimises it better for large lists than a
long chain of ORs.

### IN With Subquery

```sql
-- Products that have been ordered at least once
SELECT * FROM products
WHERE product_id IN (
    SELECT DISTINCT product_id FROM order_items
);
```

MySQL materialises the subquery into a temporary set and performs a semi-join or
hash lookup.

### NOT IN — The NULL Trap

Here's a bug that has shipped to production more times than anyone would like to
admit. It looks completely reasonable:

```sql
-- Suppose departments has a row with dept_id = NULL
SELECT * FROM employees
WHERE dept_id NOT IN (SELECT dept_id FROM departments);
```

The intent is obviously "employees whose department isn't in this list." But if
`departments.dept_id` contains even **one NULL**, this query silently returns
**zero rows** — not an error, just an empty result set that looks like "there's
nothing to find" when really there's a data quality issue hiding underneath.

Why does one stray NULL sink the entire query? Because `NOT IN (1, 2, NULL)`
expands, internally, to:
```
dept_id != 1 AND dept_id != 2 AND dept_id != NULL
```
And you already know `dept_id != NULL` from Section 3 — it evaluates to NULL
(unknown), not TRUE or FALSE. One NULL in that AND chain poisons the whole
expression to NULL, and MySQL treats NULL results as "don't include this row" —
so *every* row gets excluded, even ones that obviously don't match.

```
┌──────────────────────────────────────────────────────────┐
│  NOT IN NULL Trap                                        │
│                                                          │
│  NOT IN (1, 2, NULL)                                     │
│  = dept_id <> 1 AND dept_id <> 2 AND dept_id <> NULL    │
│                                               ↑          │
│                                    evaluates to NULL     │
│                                    whole AND = NULL      │
│                                    → row excluded        │
└──────────────────────────────────────────────────────────┘
```

### Safe Alternative: NOT EXISTS

```sql
-- Safe version that ignores NULLs
SELECT e.*
FROM employees e
WHERE NOT EXISTS (
    SELECT 1
    FROM departments d
    WHERE d.dept_id = e.dept_id
);
```

### IN vs EXISTS — When to Use Which

| Scenario | Prefer |
|----------|--------|
| Small static list | IN |
| Large subquery result | EXISTS (stops at first match) |
| Subquery column might have NULLs | NOT EXISTS |
| Correlated filter logic | EXISTS |

> **Memory hook:** "NOT IN plus one sneaky NULL equals zero rows." If a NOT IN
> query mysteriously returns nothing, check the subquery for NULLs before you check
> anything else.

### IN With Multiple Columns (Row Constructor)

```sql
-- MySQL supports tuple comparisons
SELECT * FROM order_items
WHERE (order_id, product_id) IN (
    (1, 101),
    (1, 102),
    (2, 201)
);
```

---

## 6. LIKE — Pattern Matching

`=` is great when you know the exact string. But what about "find every customer
whose name starts with John" — Johnson, Johnny, Johnathan? You don't know the exact
value, just the shape of it. That's the gap LIKE fills: fuzzy, wildcard-based string
matching, the SQL equivalent of searching your photos folder for `vacation*.jpg`.

Basic definition: LIKE performs wildcard matching on string columns using two
special placeholder characters.

### Wildcard Characters

| Wildcard | Meaning           | Example        | Matches                          |
|----------|-------------------|----------------|----------------------------------|
| `%`      | Zero or more chars | `'John%'`     | John, Johnson, Johnathan         |
| `_`      | Exactly one char   | `'J_hn'`      | John, Jahn, J2hn                 |

### Prefix Search (Index-Friendly)

```sql
-- Can use an index on the name column
SELECT * FROM customers WHERE name LIKE 'John%';
```

Here's why this particular pattern is special, internally: a B-tree index on
`name` stores values in sorted order, like a phone book. `'John%'` tells MySQL
"everything that starts with J-o-h-n" — which in a sorted index is one contiguous
block of leaves, from the first "John..." entry to the last, right before "Johp"
would start. MySQL can jump straight to that block and stop reading the moment it
passes it. Prefix LIKE (`'prefix%'`) is the *only* LIKE pattern that gets this
treatment.

### Suffix Search (Full Scan)

```sql
-- Cannot use index — MySQL must read every row
SELECT * FROM products WHERE sku LIKE '%widget';
```

Flip the pattern around and the trick stops working. `'%widget'` means "ends with
widget" — but a phone book sorted by first letter can't tell you which entries end
in a given suffix without checking each one individually. There's no contiguous
block to jump to, so MySQL falls back to reading every row.

### Contains Search (Full Scan)

```sql
-- Cannot use index
SELECT * FROM articles WHERE title LIKE '%database%';
-- For contains searches, consider FULLTEXT index instead
```

### Single-Character Wildcard

```sql
-- Matches any 5-letter word starting with 'cl' and ending with 'ud'
SELECT * FROM tags WHERE name LIKE 'cl__d';  -- cloud, claud, cl00d

-- Phone numbers with specific pattern
SELECT * FROM contacts WHERE phone LIKE '04________';  -- Australian mobile
```

### Escaping Literal % and _

Here's a mistake waiting to happen: what if the value you're searching for
actually *contains* a literal `%` or `_` character — like a product code
`ABC_123`? Written plainly, `LIKE '%_%'` would treat that underscore as a wildcard,
not a literal character, and match far more than intended. You need to tell MySQL
"no, I mean this character literally" by escaping it.

```sql
-- Find products whose code literally contains an underscore
SELECT * FROM products WHERE code LIKE '%\_%';

-- Or define a custom escape character
SELECT * FROM products WHERE code LIKE '%!_%' ESCAPE '!';
```

### LIKE and Case Sensitivity

Under `utf8mb4_0900_ai_ci` (default), LIKE is case-insensitive.

```sql
SELECT * FROM users WHERE email LIKE '%@GMAIL.COM';   -- matches @gmail.com
SELECT * FROM users WHERE BINARY email LIKE '%@GMAIL.COM';  -- case-sensitive
```

### LIKE Performance Summary

```
┌──────────────────────────────────────────────────────┐
│  LIKE Pattern Performance                            │
│                                                      │
│  'prefix%'    → Index range scan (FAST)             │
│  '%suffix'    → Full table scan   (SLOW)            │
│  '%contains%' → Full table scan   (SLOW)            │
│  'p_ttern'    → Full table scan   (SLOW)            │
│  'exact'      → Use = instead     (FASTEST)         │
└──────────────────────────────────────────────────────┘
```

### Common Mistakes With LIKE

- Forgetting that a leading `%` (as in `'%contains%'` or `'%suffix'`) disables
  index use entirely — reach for a FULLTEXT index if "contains" search needs to be
  fast at scale.
- Forgetting to escape literal `%` or `_` characters that are part of the actual
  data (like a genuine underscore in a product code).
- Assuming LIKE is case-sensitive by default — under the default collation it
  isn't, which can surprise you when validating exact-format strings.

> **Memory hook:** `%` is a "wildcard duffel bag" — stuff any number of characters
> in it. `_` is a "single wildcard sock" — exactly one item, no more, no less. And
> only a `%` at the *end* of a pattern keeps your index alive.

---

## 7. NOT LIKE

Sometimes you want the opposite of a pattern match — "everything except temp
records," "any email that isn't from gmail." NOT LIKE is just LIKE with the result
inverted.

```sql
-- Products whose name does NOT start with 'Temp'
SELECT * FROM products WHERE name NOT LIKE 'Temp%';

-- Emails not from gmail
SELECT * FROM users WHERE email NOT LIKE '%@gmail.com';
```

But watch the NULL gotcha here too — it's the same three-valued logic from Section
3 showing up again. If the column value is NULL, `NULL NOT LIKE 'pattern'`
evaluates to NULL, not TRUE, so those rows get silently excluded from the results
even though "the email isn't from spam.com" feels like it should logically be true
for a row with no email at all.

```sql
-- To include rows where the column is NULL
SELECT * FROM users
WHERE email NOT LIKE '%@spam.com' OR email IS NULL;
```

---

## 8. REGEXP / RLIKE

LIKE is fine for "starts with" or "ends with," but what about "starts with 04,
followed by exactly 8 digits" — a phone number format? LIKE's two wildcards (`%`
and `_`) can't express "digit" or "exactly 8 of them" cleanly. That's where REGEXP
comes in — it borrows the full regular expression syntax you may already know from
other languages, letting you describe much richer shapes of text.

REGEXP (alias RLIKE — same thing, two names) supports full regular expression
matching. Much more powerful than LIKE, but slower, since it can't use an index.

### Basic Syntax

```sql
SELECT * FROM products WHERE name REGEXP 'pattern';
SELECT * FROM products WHERE name RLIKE 'pattern';  -- identical
```

### Anchors

```sql
-- Starts with 'Pro'
SELECT * FROM products WHERE name REGEXP '^Pro';

-- Ends with 'Plus'
SELECT * FROM products WHERE name REGEXP 'Plus$';

-- Exact match (like = but regex-style)
SELECT * FROM products WHERE name REGEXP '^ProPlus$';
```

### Character Classes

```sql
-- Starts with a digit
SELECT * FROM skus WHERE code REGEXP '^[0-9]';

-- Contains only letters and digits (alphanumeric)
SELECT * FROM tags WHERE name REGEXP '^[a-zA-Z0-9]+$';

-- Contains a vowel
SELECT * FROM words WHERE word REGEXP '[aeiouAEIOU]';
```

### Alternation (OR in regex)

```sql
-- Status is active OR paused OR archived
SELECT * FROM campaigns WHERE status REGEXP '^(active|paused|archived)$';

-- Name contains cat or dog
SELECT * FROM pets WHERE species REGEXP 'cat|dog';
```

### Repetition Quantifiers

| Pattern  | Meaning               |
|----------|-----------------------|
| `a*`     | 0 or more 'a'         |
| `a+`     | 1 or more 'a'         |
| `a?`     | 0 or 1 'a'            |
| `a{3}`   | Exactly 3 'a'         |
| `a{2,4}` | 2 to 4 'a'            |

```sql
-- Australian phone: 04 followed by 8 digits
SELECT * FROM contacts WHERE phone REGEXP '^04[0-9]{8}$';

-- Email basic validation
SELECT * FROM users WHERE email REGEXP '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
```

### REGEXP and NULL

No surprises here if you've made it this far: like every comparison operator in
this file, REGEXP returns NULL when the column is NULL — same rule, same fix.

```sql
-- Safely handle NULL
SELECT * FROM users
WHERE email REGEXP '@gmail\\.com' OR email IS NULL;
```

### NOT REGEXP

```sql
-- Products whose name does not match the pattern
SELECT * FROM products WHERE name NOT REGEXP '^[A-Z]';
```

### REGEXP vs LIKE

| Feature | LIKE | REGEXP |
|---------|------|--------|
| Wildcard | % and _ | Full regex syntax |
| Index support | Prefix only | None |
| Case sensitive | No (default) | No (default, use REGEXP BINARY for sensitive) |
| Performance | Faster | Slower |
| Power | Basic | Very powerful |

> **Memory hook:** LIKE speaks two words — "any characters" and "one character."
> REGEXP speaks a whole language. Reach for REGEXP only when LIKE genuinely can't
> say what you mean.

---

## 9. Combining Conditions — AND / OR / NOT

Real filters are rarely one condition. "Engineers earning over $80k, hired since
2020" is three conditions glued together. AND, OR, and NOT are the glue — the same
logical connectors you already use in everyday sentences ("I want coffee AND
toast," "tea OR coffee," "NOT decaf").

### AND — All Must Be True

```sql
SELECT * FROM employees
WHERE department = 'Engineering'
  AND salary > 80000
  AND hire_date >= '2020-01-01';
```

### OR — At Least One Must Be True

```sql
SELECT * FROM orders
WHERE status = 'pending'
   OR status = 'failed';
-- Better written as: WHERE status IN ('pending', 'failed')
```

### NOT — Invert a Condition

```sql
SELECT * FROM products WHERE NOT (price BETWEEN 10 AND 50);
SELECT * FROM users   WHERE NOT email LIKE '%@test.com';
SELECT * FROM orders  WHERE NOT status IN ('cancelled', 'refunded');
```

### Mixing AND and OR — Parentheses Are Critical

```sql
-- WRONG INTENT: finds all admins OR any active non-admin
SELECT * FROM users
WHERE role = 'admin' OR role = 'manager' AND active = 1;
-- AND binds tighter: interpreted as role = 'admin' OR (role = 'manager' AND active = 1)

-- CORRECT INTENT: only admins or managers who are active
SELECT * FROM users
WHERE (role = 'admin' OR role = 'manager') AND active = 1;
```

Always use parentheses when mixing AND and OR. Relying on precedence rules is
a bug waiting to happen.

---

## 10. Operator Precedence

From highest to lowest precedence in MySQL WHERE clauses:

```
┌───────────────────────────────────────────────────┐
│  MySQL Operator Precedence (highest → lowest)    │
│                                                   │
│  1. Arithmetic: * / % + -                        │
│  2. Comparison: = != <> > < >= <=                │
│                 IS (NOT) NULL                     │
│                 (NOT) BETWEEN                     │
│                 (NOT) LIKE                        │
│                 (NOT) REGEXP                      │
│                 (NOT) IN                          │
│  3. NOT                                           │
│  4. AND                                           │
│  5. XOR                                           │
│  6. OR                                            │
└───────────────────────────────────────────────────┘
```

### Practical Example

```sql
-- What does MySQL parse this as?
WHERE a = 1 OR b = 2 AND c = 3

-- Answer (AND binds tighter):
WHERE a = 1 OR (b = 2 AND c = 3)

-- If you wanted OR to apply first:
WHERE (a = 1 OR b = 2) AND c = 3
```

Rule of thumb: **when in doubt, parenthesise**.

---

## 11. COALESCE and IFNULL Workarounds

When you need to treat NULL as a specific value for comparison purposes:

### IFNULL(value, replacement)

```sql
-- Treat NULL discount as 0
SELECT * FROM products WHERE IFNULL(discount, 0) > 0.1;

-- Sort NULLs as if they were 0
SELECT * FROM products ORDER BY IFNULL(discount, 0) DESC;
```

### COALESCE(val1, val2, val3, ...)

Returns the first non-NULL value in the list. More flexible than IFNULL.

```sql
-- Use preferred_name if set, otherwise use first_name
SELECT COALESCE(preferred_name, first_name) AS display_name
FROM users
WHERE COALESCE(preferred_name, first_name) LIKE 'A%';
```

### NULLIF(val, compareval)

Returns NULL if val = compareval, otherwise returns val. Useful to avoid
division-by-zero.

```sql
-- Avoid division by zero
SELECT total_revenue / NULLIF(total_orders, 0) AS avg_order_value
FROM sales_summary;
```

### Real-World Pattern: Default Values in Filters

```sql
-- Show products that are either discounted OR have no price (treat NULL price as 0)
SELECT *
FROM products
WHERE COALESCE(price, 0) BETWEEN 0 AND 100
  AND COALESCE(stock, 0) > 0;
```

---

## 12. Hands-On Exercises

Use the following schema for all exercises:

```sql
CREATE TABLE employees (
    emp_id      INT PRIMARY KEY AUTO_INCREMENT,
    first_name  VARCHAR(50),
    last_name   VARCHAR(50),
    department  VARCHAR(50),
    salary      DECIMAL(10,2),
    hire_date   DATE,
    manager_id  INT,
    email       VARCHAR(100)
);
```

### Exercise 1

Write a query to find all employees in the 'Sales' or 'Marketing' department
with a salary between $40,000 and $90,000, hired after January 1, 2019.

```sql
SELECT emp_id, first_name, last_name, department, salary, hire_date
FROM employees
WHERE department IN ('Sales', 'Marketing')
  AND salary BETWEEN 40000 AND 90000
  AND hire_date > '2019-01-01'
ORDER BY salary DESC;
```

### Exercise 2

Find all employees whose email address is from 'gmail.com' or 'yahoo.com',
excluding those whose last name starts with 'Mc' or 'Mac'.

```sql
SELECT emp_id, first_name, last_name, email
FROM employees
WHERE email REGEXP '@(gmail|yahoo)\\.com$'
  AND last_name NOT REGEXP '^M(c|ac)';
```

### Exercise 3

List all employees who have no manager assigned (top-level employees) and whose
salary is above the company's median assumption of $60,000.

```sql
SELECT emp_id, first_name, last_name, salary
FROM employees
WHERE manager_id IS NULL
  AND salary > 60000
ORDER BY salary DESC;
```

### Exercise 4

Find employees whose first name contains exactly 4 characters and whose
department name ends with 'ing'.

```sql
SELECT emp_id, first_name, last_name, department
FROM employees
WHERE first_name LIKE '____'          -- 4 underscores = 4 characters
  AND department LIKE '%ing';
```

### Exercise 5

Find all employees who were hired in Q1 (January–March) of any year, are
NOT in the 'IT' department, and whose salary is not between $30,000 and $45,000.

```sql
SELECT emp_id, first_name, last_name, department, salary, hire_date
FROM employees
WHERE MONTH(hire_date) BETWEEN 1 AND 3
  AND department != 'IT'
  AND salary NOT BETWEEN 30000 AND 45000
ORDER BY hire_date ASC;
```

---

## 13. Interview Q&A

**Q1. What is the difference between `=` and `IS` when comparing to NULL?**

A: `= NULL` always returns NULL (unknown) — never TRUE or FALSE. MySQL skips
rows where the comparison result is NULL. `IS NULL` is the only correct way to
test whether a value is NULL. This is because NULL represents an unknown value,
and comparing an unknown to anything yields an unknown result.

---

**Q2. Why does `NOT IN` return no rows when the subquery contains a NULL?**

A: `NOT IN (1, 2, NULL)` expands to `val <> 1 AND val <> 2 AND val <> NULL`.
Since `val <> NULL` is always NULL (not TRUE), the entire AND chain becomes NULL,
which MySQL treats as false — so no row passes the filter. The fix is to use
`NOT EXISTS` or add `WHERE col IS NOT NULL` inside the subquery.

---

**Q3. Can LIKE use an index? Under what conditions?**

A: Only `LIKE 'prefix%'` (no leading wildcard) can use a B-tree index, and only
for the prefix portion. Patterns like `'%suffix'` or `'%contains%'` trigger a full
table scan. If you need fast contains-search, use a FULLTEXT index with
`MATCH ... AGAINST`.

---

**Q4. What is the difference between BETWEEN and >= combined with <=?**

A: They are functionally identical — `BETWEEN x AND y` is inclusive on both ends
and is exactly equivalent to `col >= x AND col <= y`. BETWEEN is slightly more
readable, especially for date ranges.

---

**Q5. How does MySQL handle NULL in an IN list?**

A: `col IN (1, NULL, 3)` — MySQL checks equality with each element. If col = 1
or col = 3, it returns TRUE. If col = 2, MySQL checks 2=1 (false), 2=NULL (NULL),
2=3 (false) — result is NULL. So col=2 is excluded. NULLs in an IN list effectively
act as wildcards that prevent non-matching rows from being definitively excluded
(though they also never cause inclusion).

---

**Q6. What is the operator precedence order for AND, OR, NOT?**

A: NOT binds most tightly, then AND, then OR. So `NOT a OR b AND c` is parsed as
`(NOT a) OR (b AND c)`. Always use parentheses when mixing these operators to make
intent explicit.

---

**Q7. How do you search for a literal percent sign using LIKE?**

A: Escape it with a backslash: `LIKE '100\%'` finds the string "100%". You can also
define a custom escape character: `LIKE '100!%' ESCAPE '!'`.

---

**Q8. What is the difference between REGEXP and LIKE?**

A: LIKE supports only two wildcards (`%` for any sequence, `_` for one character).
REGEXP supports full regular expression syntax including anchors, character classes,
quantifiers, and alternation. LIKE prefix patterns can use indexes; REGEXP never
uses indexes. LIKE is faster for simple patterns.

---

**Q9. Explain three-valued logic (TRUE, FALSE, NULL) in MySQL.**

A: MySQL's WHERE clause does not just deal with TRUE and FALSE — any comparison
involving NULL produces NULL (unknown). A row is included in the result only if the
WHERE condition is definitively TRUE. NULL is treated as "not TRUE," so it is
excluded. This affects AND, OR, and NOT operations with NULL operands in non-obvious
ways (e.g., `TRUE AND NULL = NULL`, `FALSE OR NULL = NULL`, `TRUE OR NULL = TRUE`).

---

**Q10. When would you use COALESCE vs IFNULL?**

A: Both substitute a default for NULL. IFNULL(val, default) takes exactly two
arguments and is slightly faster. COALESCE(val1, val2, ..., valN) accepts any
number of arguments and returns the first non-NULL — useful when multiple fallback
columns exist (e.g., `COALESCE(preferred_name, nickname, first_name)`).

---

**Q11. Does `!=` work differently from `<>` in MySQL?**

A: No — they are identical in MySQL. `!=` is a non-ANSI extension; `<>` is the
ISO SQL standard. Both return the same results, including NULL behaviour (neither
can detect NULL values; use IS NOT NULL for that).

---

**Q12. Why can't you use a SELECT alias in a WHERE clause?**

A: MySQL processes clauses in this order: FROM → JOIN → WHERE → GROUP BY → HAVING
→ SELECT → ORDER BY. The alias defined in SELECT does not exist yet when WHERE is
evaluated. You must repeat the expression in WHERE, or wrap the query in a subquery/
CTE and filter on the alias in the outer query.

---

**Q13. How does LIKE behave with case sensitivity?**

A: By default, LIKE follows the column's collation. With `utf8mb4_0900_ai_ci`
(the default), LIKE is case-insensitive and accent-insensitive. To force case
sensitivity, use `BINARY col LIKE 'pattern'` or change the column collation to
`utf8mb4_0900_as_cs`.

---

**Q14. What happens when you apply BETWEEN to NULL values?**

A: If the column value is NULL, `NULL BETWEEN x AND y` evaluates to NULL (not TRUE),
so the row is excluded. Rows with NULL in a BETWEEN column are always silently
filtered out. Add `OR col IS NULL` if you need to include them.

---

**Q15. Give a real-world scenario where REGEXP is more appropriate than LIKE.**

A: Validating that a phone number matches a specific national format, such as
Australian mobiles starting with 04 followed by exactly 8 digits: `REGEXP '^04[0-9]{8}$'`.
LIKE cannot enforce exact digit counts or character class constraints — you would
need `LIKE '04________'` (8 underscores) which is fragile and less readable.
REGEXP also handles alternation natively: `REGEXP '^(04|\\+614)[0-9]{8}$'` covers
both domestic and international mobile formats in one pattern.
