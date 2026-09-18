# MySQL Constraints — Complete Guide

## Table of Contents
1. [What Are Constraints?](#1-what-are-constraints)
2. [PRIMARY KEY](#2-primary-key)
3. [FOREIGN KEY](#3-foreign-key)
4. [UNIQUE](#4-unique)
5. [NOT NULL](#5-not-null)
6. [DEFAULT](#6-default)
7. [CHECK Constraints](#7-check-constraints)
8. [AUTO_INCREMENT](#8-auto_increment)
9. [Naming Constraints](#9-naming-constraints)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What Are Constraints?

**The problem:** Imagine your `users` table has no rules at all. Nothing stops someone from inserting a row with no email, two rows with the same email, an age of `-5`, or an order that points to a customer who doesn't exist. The table will happily store all of it — garbage in, garbage stored forever.

**A real-world analogy:** think of constraints as the bouncer at a club door, not the cleanup crew afterward. A bouncer checks IDs *before* letting someone in — much cheaper than trying to figure out who shouldn't have been there after the party's already a mess. Constraints check every row *before* it's written, so bad data never even gets in.

**Basic definition:** constraints are rules attached to columns (or combinations of columns) that MySQL enforces automatically on every INSERT and UPDATE. If a row would violate a rule, MySQL rejects it with an error — it doesn't store it and clean up later.

Here's the cast of characters you're about to meet, and the specific kind of "bad data" each one is a bouncer for:

```
┌────────────────────────────────────────────────────────────────┐
│  Constraint    │  What It Prevents                            │
├────────────────────────────────────────────────────────────────┤
│  PRIMARY KEY   │  Duplicate or NULL row identifiers           │
│  FOREIGN KEY   │  Orphaned records (referencing non-existent) │
│  UNIQUE        │  Duplicate values in a column                │
│  NOT NULL      │  Empty/missing required values               │
│  DEFAULT       │  Missing values (fills with a default)       │
│  CHECK         │  Values outside allowed range/pattern        │
└────────────────────────────────────────────────────────────────┘
```

> **Memory hook:** "Constraints are the bouncer at the door — they stop bad data before it gets in, not clean it up after."

---

## 2. PRIMARY KEY

**The problem:** say you have two customers both named "John Smith," both living in the same city. How does the database tell them apart when you need to update just one of their records? Nothing about their data is guaranteed unique — names collide, phone numbers change hands, emails get reused. You need *something* on every row that is guaranteed to be one-of-a-kind and never empty.

**Real-world analogy:** it's a passport number or a national ID. Two people can share a name, a birthday, even an address — but never a passport number. That's the one field a government can always use to say "this is definitely that specific person, not someone else."

**Basic definition:** a PRIMARY KEY uniquely identifies each row in a table. It is automatically NOT NULL and UNIQUE — MySQL enforces both rules for you the moment you declare one.

```sql
-- Column-level (single column)
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100)
);

-- Table-level (same result, but required for composite keys)
CREATE TABLE users (
  id    INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(100),
  PRIMARY KEY (id)
);

-- Composite PRIMARY KEY (two columns together = unique)
CREATE TABLE order_items (
  order_id   INT NOT NULL,
  product_id INT NOT NULL,
  quantity   INT NOT NULL,
  PRIMARY KEY (order_id, product_id)   -- combination must be unique
);
```

**Only one PRIMARY KEY per table.** Each table should have one — without it, there's no reliable way to reference individual rows.

> **Memory hook:** "PRIMARY KEY is the passport number — one per person, never blank, never shared."

---

## 3. FOREIGN KEY

**The problem:** what stops someone from inserting an order for a customer that doesn't exist? Without a rule in place, you could happily insert `orders (customer_id = 9999)` even though there's no customer #9999 anywhere in your `customers` table. Now you have an "orphaned" row — a child pointing at a parent that was never there, or that got deleted out from under it. Reports break, joins return nonsense, and nobody can explain where the order came from.

**Real-world analogy:** think of it like a library card. You can't check out a book against a library card number that doesn't exist in the library's membership system. The library card *must* correspond to a real, registered member — that's the whole point of checking it at the counter.

**Basic definition:** a FOREIGN KEY enforces referential integrity — a value in column A must exist in column B of another table. It's the mechanism that keeps "child" rows honest about which "parent" rows they claim to belong to.

```sql
CREATE TABLE orders (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  total       DECIMAL(10,2),
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
```

**How the check actually happens, internally:** every INSERT or UPDATE that touches a FK column triggers a lookup in the parent table before the write is allowed to commit.

```
INSERT INTO orders (customer_id, ...)
              │
              ▼
   Does customer_id exist in customers.id?
              │
     ┌────────┴────────┐
     │                 │
    YES                NO
     │                 │
     ▼                 ▼
  Row inserted     Error: Cannot add or update
                    a child row: a foreign key
                    constraint fails
```

And the same check runs in reverse when you try to delete or update the *parent* row — MySQL has to decide what happens to the children left behind. That's exactly what `ON DELETE` / `ON UPDATE` actions control.

### ON DELETE / ON UPDATE Actions

| Action | Behavior |
|--------|---------|
| `CASCADE` | Delete/update child rows automatically |
| `SET NULL` | Set FK column to NULL in child rows |
| `SET DEFAULT` | Set FK column to its DEFAULT value |
| `RESTRICT` | Reject the delete/update (error) |
| `NO ACTION` | Same as RESTRICT (checked at statement end) |

```sql
-- Example: delete a customer → automatically delete their orders
ON DELETE CASCADE

-- Example: delete a category → set product.category_id to NULL
ON DELETE SET NULL

-- Example: prevent deleting a department that has employees
ON DELETE RESTRICT
```

### Checking FK Constraints

```sql
-- Temporarily disable FK checks (for bulk imports)
SET foreign_key_checks = 0;
-- ... bulk import ...
SET foreign_key_checks = 1;
```

**Common mistakes/confusions:**

- **Insert ordering.** You must insert the parent row *before* the child row. Trying to insert an order for a customer that hasn't been created yet fails — even if you're "about to" insert that customer two lines later in the same script. Parents first, always.
- **Cascade surprises.** `ON DELETE CASCADE` is powerful but can silently wipe out far more data than you intended — deleting a customer could cascade through orders, then order_items, then invoices, all in one statement. Always think through the full chain before choosing CASCADE.
- **Disabling checks for bulk import and forgetting to re-enable them.** `SET foreign_key_checks = 0` is meant to be temporary — leaving it off means orphaned rows can sneak back in.

**Interview answer:** referential integrity means every FK value must match an existing PK value in the referenced table — no orphaned records. MySQL enforces this at INSERT time (rejecting a child row whose parent doesn't exist) and at DELETE/UPDATE time on the parent (rejecting, cascading, or nulling out child rows depending on the configured action).

> **Memory hook:** "FOREIGN KEY is the library card check — no card number, no book leaves the building."

---

## 4. UNIQUE

**The problem:** a PRIMARY KEY already guarantees your `id` column is one-of-a-kind, but what about `email`? Two users could still sign up with the exact same email address unless something stops them — and now your login system doesn't know which account "john@example.com" refers to.

**Real-world analogy:** think of it like a username on a website — plenty of people can be named "John," but only one account can claim the username `john123`.

**Basic definition:** UNIQUE ensures no two rows have the same value in the specified column(s). Unlike PRIMARY KEY, a table can have several UNIQUE constraints, and the column is still allowed to hold NULL.

```sql
-- Single column
CREATE TABLE users (
  id    INT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20)  UNIQUE   -- NULL is allowed and NULLs don't conflict with each other
);

-- Composite unique (combination must be unique)
CREATE TABLE team_members (
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  UNIQUE KEY uq_team_user (team_id, user_id)
);
```

**NULL and UNIQUE — the part that trips people up:** in MySQL, a UNIQUE column can have multiple NULLs, because NULL is never considered equal to another NULL. So `phone` above can be left blank on a hundred different rows without any conflict — it's only when two rows both try to store the *same actual value* that the constraint fires.

**Compare with PRIMARY KEY:**

| | PRIMARY KEY | UNIQUE |
|---|---|---|
| NULLs allowed? | No | Yes (multiple NULLs allowed) |
| How many per table? | Exactly one | As many as you need |
| Purpose | The main row identifier | Prevents duplicate values in any column |

**Interview answer:** a PRIMARY KEY is UNIQUE + NOT NULL, and a table can only have one. It's the main identifier for rows. UNIQUE allows NULLs (multiple NULLs are permitted), can be applied to several columns independently, and a table can have as many UNIQUE constraints as it needs.

> **Memory hook:** "UNIQUE is the username — one per person, but you're allowed to leave it blank."

---

## 5. NOT NULL

**The problem:** what happens if someone inserts a product with no `name`, or an employee with no `salary`? Those aren't optional details — a nameless product or a salary-less employee is just broken data.

**Real-world analogy:** it's a required field on a form — you can't submit a job application with the "Name" box left empty.

Prevents a column from storing NULL. Every INSERT must provide a value (or have a DEFAULT).

```sql
CREATE TABLE products (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,   -- must always have a name
  price       DECIMAL(10,2) NOT NULL,  -- must always have a price
  description TEXT         NULL        -- optional (NULL is allowed)
);
```

**When to use NOT NULL:** On any column where the absence of a value would be a data error — names, prices, status codes, foreign keys.

> **Memory hook:** "NOT NULL is the required field on the form — no value, no submit."

---

## 6. DEFAULT

**The problem:** every new blog post should start as a `'draft'` with `0` views — but do you really want to type `status = 'draft', views = 0` on every single INSERT, forever? And what if a developer on the team forgets and leaves it blank?

**Real-world analogy:** it's the pre-filled "quantity: 1" box on a shopping cart — you don't have to type it, but you can always overwrite it if you're buying more than one.

**Basic definition:** DEFAULT provides a fallback value when no value is given during INSERT.

```sql
CREATE TABLE posts (
  id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  status     ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  views      INT          NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Insert without specifying defaulted columns:
INSERT INTO posts (title) VALUES ('My First Post');
-- status='draft', views=0, created_at=now(), is_active=1
```

### MySQL 8.0+ Expression Defaults

```sql
-- Computed default
expiry_date DATE DEFAULT (CURRENT_DATE + INTERVAL 30 DAY)
```

> **Memory hook:** "DEFAULT is the pre-filled quantity box — type nothing, get a sensible answer anyway."

---

## 7. CHECK Constraints

**The problem:** NOT NULL stops an empty salary, but it won't stop a salary of `-50000`, or an employee age of `200`, or a gender field set to `'banana'`. You need a rule that checks not just "is there a value" but "is this value actually sensible."

**Real-world analogy:** think of it like an age-verification gate at a bar — it doesn't just check that you *have* an ID, it checks that the birthdate on it actually clears the minimum age.

**Basic definition:** CHECK validates a condition before allowing an insert or update — the row is only written if the condition evaluates to true. Available in MySQL 8.0+ (in earlier versions, CHECK was parsed but silently ignored).

```sql
CREATE TABLE employees (
  id         INT          PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  age        INT          NOT NULL,
  salary     DECIMAL(10,2) NOT NULL,
  gender     CHAR(1),

  CONSTRAINT chk_age_valid   CHECK (age BETWEEN 16 AND 100),
  CONSTRAINT chk_salary_pos  CHECK (salary > 0),
  CONSTRAINT chk_gender      CHECK (gender IN ('M', 'F', 'X'))
);

-- Test it:
INSERT INTO employees (name, age, salary) VALUES ('John', 15, 50000);
-- Error: Check constraint 'chk_age_valid' is violated.
```

### Adding CHECK to Existing Table

```sql
ALTER TABLE employees
  ADD CONSTRAINT chk_new_rule CHECK (salary < 1000000);
```

**Common mistakes/confusions:** the biggest one is assuming CHECK "just works" on any MySQL version — it was silently ignored before 8.0, so a constraint that looks perfectly valid in your CREATE TABLE statement may have never actually been enforced on an older server. Always verify the MySQL version before relying on CHECK for critical validation.

**Interview answer:** a CHECK constraint defines a condition that every row must satisfy before it's accepted. Before MySQL 8.0, CHECK constraints were parsed but silently ignored — meaning invalid data could slip through even with a CHECK clause sitting right there in the schema. MySQL 8.0+ enforces them properly; for earlier versions you'd need triggers or application-level validation instead.

> **Memory hook:** "CHECK is the bouncer checking the birthdate on the ID, not just checking that an ID exists."

---

## 8. AUTO_INCREMENT

**The problem:** every row needs a unique PRIMARY KEY value, but do you really want to manually track "what's the next free ID" yourself, in application code, every single time you insert a row? That's a recipe for race conditions the moment two inserts happen at once.

**Real-world analogy:** it's a take-a-number dispenser at a deli counter — you never have to ask "am I number 42 or has someone already taken that?" The machine just hands you the next number, guaranteed unused.

**Basic definition:** AUTO_INCREMENT automatically assigns the next available integer on insert.

```sql
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY
);

INSERT INTO users VALUES ();  -- id=1
INSERT INTO users VALUES ();  -- id=2
INSERT INTO users VALUES ();  -- id=3
DELETE FROM users WHERE id = 2;
INSERT INTO users VALUES ();  -- id=4 (gaps are NOT reused)

-- Get the last inserted ID
SELECT LAST_INSERT_ID();   -- returns 4
```

### AUTO_INCREMENT Behaviors

```sql
-- Check current auto_increment value
SHOW CREATE TABLE users;

-- Reset auto_increment (only works if new value > current max)
ALTER TABLE users AUTO_INCREMENT = 100;

-- Gaps are normal and intentional — don't rely on sequential IDs
```

**Common mistake:** assuming gaps mean something is broken. They don't — MySQL reserves a number the moment an INSERT is attempted, even if that transaction later fails or rolls back. Deleted rows also leave permanent gaps, since IDs are never reused. Application logic should never assume IDs are sequential or gap-free.

**Interview answer:** MySQL reserves AUTO_INCREMENT values even for failed transactions or rolled-back inserts, and gaps also appear when rows are deleted. This is intentional — reusing IDs could cause race conditions and security issues (e.g., a deleted user's ID being handed to a brand-new, unrelated user). Application logic should never assume sequential IDs.

> **Memory hook:** "AUTO_INCREMENT is the deli counter's take-a-number machine — it never hands out the same number twice, gaps and all."

---

## 9. Naming Constraints

Always name your constraints — unnamed constraints get cryptic auto-generated names.

```sql
CREATE TABLE orders (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  status      ENUM('pending','paid','shipped') DEFAULT 'pending',
  total       DECIMAL(10,2) NOT NULL,

  -- Named foreign key
  CONSTRAINT fk_orders_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,

  -- Named check
  CONSTRAINT chk_orders_total_positive
    CHECK (total > 0),

  -- Named unique
  CONSTRAINT uq_orders_reference
    UNIQUE (reference_number)
);
```

**Naming convention:** `fk_<table>_<column>`, `uq_<table>_<column>`, `chk_<table>_<rule>`

Why bother naming them at all? Because when a constraint fails or needs to be dropped later, `chk_orders_total_positive` in an error message tells you exactly what went wrong — an auto-generated name like `orders_chk_1` doesn't.

> **Memory hook:** "Name your constraints like you'd label moving boxes — future-you doing a DROP CONSTRAINT will thank present-you."

### Dropping Named Constraints

```sql
-- Drop foreign key
ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer_id;

-- Drop unique
ALTER TABLE orders DROP INDEX uq_orders_reference;

-- Drop check
ALTER TABLE orders DROP CHECK chk_orders_total_positive;
```

---

## 10. Hands-On Exercises

**Exercise 1:** Create a `students` table with: id (PK auto), student_number (UNIQUE NOT NULL), name (NOT NULL), gpa (DECIMAL 3,2, CHECK 0.0-4.0), enrolled_at (TIMESTAMP DEFAULT NOW()).

**Exercise 2:** Create a `courses` and `enrollments` table. enrollments should have a composite PK of (student_id, course_id) and FK references to both, with ON DELETE CASCADE.

**Exercise 3:** Try to insert a student with GPA = 5.0 — observe the CHECK constraint error. Then insert a valid record.

**Exercise 4:** Insert two rows into students with the same student_number — observe the UNIQUE constraint error.

**Exercise 5:** Delete a student who has enrollments — with CASCADE, what happens? Then test with RESTRICT — what happens?

---

## 11. Interview Q&A

**Q: What is the difference between PRIMARY KEY and UNIQUE constraint?**
Answer: A PRIMARY KEY is UNIQUE + NOT NULL and there can only be one per table. It is the main identifier for rows. UNIQUE allows NULLs (multiple NULLs are permitted), can be on multiple columns, and a table can have many UNIQUE constraints.

**Q: What is referential integrity and how does FOREIGN KEY enforce it?**
Answer: Referential integrity means every FK value must match an existing PK value in the referenced table (no orphaned records). MySQL enforces this on INSERT (can't add a child with non-existent parent) and DELETE (can't delete a parent that has children unless CASCADE/SET NULL is configured).

**Q: What is the difference between ON DELETE CASCADE and ON DELETE RESTRICT?**
Answer: CASCADE automatically deletes child rows when the parent is deleted. RESTRICT prevents the parent from being deleted if any child rows reference it, returning an error. Use CASCADE for tightly coupled data (order → order_items); use RESTRICT to protect against accidental deletion.

**Q: Why are there gaps in AUTO_INCREMENT sequences?**
Answer: MySQL reserves AUTO_INCREMENT values even for failed transactions or rolled-back inserts. Gaps also appear when rows are deleted. This is intentional — reusing IDs could cause race conditions and security issues. Application logic should never assume sequential IDs.

**Q: Can a FOREIGN KEY column be NULL?**
Answer: Yes. A NULL FK value means "no associated parent" (optional relationship). This is valid and doesn't violate referential integrity. To make the relationship mandatory, add NOT NULL to the FK column.

**Q: What is a CHECK constraint and when was it properly enforced in MySQL?**
Answer: CHECK constraints define a condition that every row must satisfy. Before MySQL 8.0, CHECK constraints were parsed but silently ignored. MySQL 8.0+ enforces them properly. For earlier versions, you'd need triggers or application-level validation.
