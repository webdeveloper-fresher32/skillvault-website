# Databases, Tables & Basics — MySQL Fundamentals

## Table of Contents
1. [Creating Databases](#1-creating-databases)
2. [Navigating Databases](#2-navigating-databases)
3. [Creating Tables](#3-creating-tables)
4. [Viewing Table Structure](#4-viewing-table-structure)
5. [Data Types Overview](#5-data-types-overview)
6. [Storage Engines](#6-storage-engines)
7. [The information_schema](#7-the-information_schema)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Creating Databases

Before you can store a single row of data, MySQL needs somewhere to put it. That "somewhere" is a database — think of it as a filing cabinet. Each drawer in the cabinet (each database) holds its own set of folders (tables), and two different cabinets never mix their folders together. A blog's database and an inventory system's database can both have a `users` table without any conflict, because they live in separate cabinets.

So the very first command you'll run in any real project is: create the cabinet.

```sql
-- Basic
CREATE DATABASE mydb;

-- Best practice: specify character set + collation
CREATE DATABASE mydb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Why utf8mb4? MySQL's old 'utf8' only stores 3-byte chars (misses emoji 🎉).
-- utf8mb4 is true UTF-8 supporting all Unicode characters.

-- Safe creation (no error if exists)
CREATE DATABASE IF NOT EXISTS mydb;

-- Drop a database (CAREFUL — deletes everything!)
DROP DATABASE IF EXISTS mydb;
```

Two things worth calling out here. First, always set `utf8mb4` explicitly — MySQL's plain `utf8` is a historical trap: it only stores 3-byte characters, so it silently can't hold emoji or some rare CJK characters. `utf8mb4` is the *real* UTF-8. Second, `IF NOT EXISTS` and `IF EXISTS` are your safety nets — they turn "this already exists" or "this doesn't exist" from a hard error into a quiet no-op, which is exactly what you want in setup scripts you might re-run.

> **Memory hook:** "utf8 in MySQL is a liar — utf8mb4 is the one that actually speaks full Unicode."

---

## 2. Navigating Databases

Once you've got one or more cabinets (databases) sitting on the server, you need a way to see what's there, and to tell MySQL which drawer you're currently working in. That's what this section is about — pure navigation, no new data created yet.

```sql
-- List all databases
SHOW DATABASES;

-- Switch to a database
USE mydb;

-- See which database is active
SELECT DATABASE();

-- List tables in current database
SHOW TABLES;

-- List tables in another database without switching
SHOW TABLES FROM other_db;

-- Show the CREATE DATABASE statement
SHOW CREATE DATABASE mydb;
```

Notice `USE mydb;` doesn't return any data — it just tells MySQL "every command I run from now on, assume it's about this database unless I say otherwise." That's why `SELECT DATABASE();` is handy: it's a quick sanity check for "wait, which drawer am I actually in right now?"

---

## 3. Creating Tables

A database on its own is an empty cabinet — it doesn't store anything until you add folders. In MySQL, a table is that folder: a spreadsheet with strict rules. Unlike an actual spreadsheet, you can't just type whatever you want into any cell — every column has a declared data type, and MySQL enforces it. Try to put text into a column defined as `INT`, and MySQL will reject it (or silently mangle it, depending on mode — which is exactly why strict typing matters).

Here's a real table definition, with every clause doing a specific job:

```sql
CREATE TABLE users (
  id         INT          NOT NULL AUTO_INCREMENT,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  email      VARCHAR(100) NOT NULL UNIQUE,
  age        TINYINT      UNSIGNED,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  is_active  BOOLEAN      DEFAULT TRUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Reading this line by line: `id` auto-numbers itself so you never have to invent unique IDs by hand. `username` and `email` must always have a value (`NOT NULL`) and no two users can share one (`UNIQUE`). `age` is `UNSIGNED` because nobody's age is negative — no point wasting a bit on a sign we'll never use. `created_at` fills itself in with the current time if you don't specify one. Here's what each clause actually means:

### Key Clauses Explained

| Clause | Meaning |
|--------|---------|
| `AUTO_INCREMENT` | MySQL auto-assigns next integer on insert |
| `NOT NULL` | Column cannot be empty |
| `DEFAULT x` | Value used when column not specified in INSERT |
| `UNIQUE` | No two rows can have the same value |
| `PRIMARY KEY` | Unique + not null, one per table |
| `ENGINE=InnoDB` | Use InnoDB storage engine (default in MySQL 8) |
| `DEFAULT CHARSET=utf8mb4` | Character encoding for string columns |

---

## 4. Viewing Table Structure

You just created a table — but what if it's someone else's table, or one you built months ago and forgot the details of? You need a way to ask MySQL "what does this table actually look like?" without digging through old scripts.

```sql
-- Quick column summary
DESCRIBE users;
-- or shorthand:
DESC users;

-- Full CREATE TABLE statement
SHOW CREATE TABLE users\G

-- List all indexes on a table
SHOW INDEX FROM users;

-- Table size and row count
SELECT
  table_name,
  table_rows,
  ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
FROM information_schema.TABLES
WHERE table_schema = DATABASE() AND table_name = 'users';
```

`DESCRIBE` (or its shorthand `DESC`) gives you the quick column-by-column summary — types, nullability, keys, defaults. `SHOW CREATE TABLE` gives you the *exact* statement that would recreate the table, which is far more useful when you need to copy a table's structure elsewhere or double-check a subtle constraint. The `\G` at the end just prints the output vertically instead of as a cramped horizontal table — handy when a row has many columns.

---

## 5. Data Types Overview

Every column needs a data type, and choosing the right one matters more than it looks. Pick a type that's too small and you'll hit a wall later (an `age` column that can't go past 127). Pick one that's too big and you're wasting storage across millions of rows. Here's the menu.

### Numeric Types

| Type | Storage | Range (signed) | Use When |
|------|---------|----------------|----------|
| TINYINT | 1 byte | -128 to 127 | flags, small codes |
| SMALLINT | 2 bytes | -32,768 to 32,767 | counts under 32k |
| INT | 4 bytes | -2.1B to 2.1B | most IDs, counts |
| BIGINT | 8 bytes | ±9.2 quintillion | large IDs, timestamps |
| DECIMAL(p,s) | varies | exact | money, prices |
| FLOAT | 4 bytes | ~7 digits precision | scientific data |
| DOUBLE | 8 bytes | ~15 digits precision | high-precision float |

Add `UNSIGNED` to double the max positive value (e.g. `INT UNSIGNED` = 0 to 4.2B). It's a one-word trick worth remembering: if a column can never legitimately be negative — an age, a stock count, a price — `UNSIGNED` gives you a bigger usable range for free.

### String Types

| Type | Max Size | Use When |
|------|----------|----------|
| CHAR(n) | 255 chars | Fixed length: codes, ISO codes |
| VARCHAR(n) | 65,535 bytes | Variable length: names, emails |
| TEXT | 65,535 bytes | Long text: descriptions |
| MEDIUMTEXT | 16 MB | Articles, blog posts |
| LONGTEXT | 4 GB | Full documents |

**Here's the question every beginner asks: why do we even need both CHAR and VARCHAR?**

Imagine two ways to store a country code like `"US"`. One way always reserves exactly the same amount of space no matter what — like a form with a fixed-width box that always prints `US` padded out to whatever width you declared. The other way stores only as many characters as you actually gave it, plus a tiny bit of bookkeeping to remember the length.

That's the whole difference:

- **CHAR(n)** always stores exactly `n` bytes, padding shorter values with spaces. Fast and predictable, but wasteful if the length varies.
- **VARCHAR(n)** stores only the actual string length (plus 1-2 bytes to record how long it is). Efficient for anything that isn't a fixed size.

| | CHAR(n) | VARCHAR(n) |
|---|---------|------------|
| Storage | Always n bytes | Actual length + 1-2 bytes |
| Best for | Fixed-length values (country codes, fixed IDs) | Variable-length values (names, emails) |
| Trailing spaces | Padded automatically | Not padded |

**Common mistake:** using VARCHAR everywhere "just in case," even for genuinely fixed-length data like a 2-letter country code or a fixed-format product SKU. It works fine, but CHAR is a hair faster and self-documents that "this is always exactly this long."

**Interview answer:** "CHAR(n) always reserves n bytes and pads shorter values with spaces, making it ideal for fixed-length data like ISO country codes. VARCHAR(n) stores only the actual content plus a small length prefix, so it's more space-efficient for data whose length varies, like names or emails."

> **Memory hook:** "CHAR is a labeled box that's always the same size — VARCHAR is a bag that shrinks or grows to fit what's inside."

### Date & Time Types

| Type | Storage | Format | Notes |
|------|---------|--------|-------|
| DATE | 3 bytes | YYYY-MM-DD | dates only |
| TIME | 3 bytes | HH:MM:SS | times only |
| DATETIME | 8 bytes | YYYY-MM-DD HH:MM:SS | no timezone |
| TIMESTAMP | 4 bytes | YYYY-MM-DD HH:MM:SS | stored as UTC, auto-updates |
| YEAR | 1 byte | YYYY | year only |

**This one trips people up constantly: DATETIME and TIMESTAMP look identical on the surface — same format, same-ish precision — so why does MySQL bother having both?**

The difference only shows up once timezones enter the picture. Say your server is in London and a user in Tokyo submits a form at their local 9 AM.

```
User's local time: Tokyo 09:00
        |
        v
   Which column type stores it?
        |
   ------------------
   |                |
TIMESTAMP          DATETIME
   |                |
   v                v
Converted to UTC   Stored exactly as given,
on the way in,     no conversion — "09:00"
converted back to  is what you'll always
the reading        get back, regardless
session's timezone of who's reading it or
on the way out     where they are
```

So TIMESTAMP is "timezone-aware" — two people in two timezones reading the same TIMESTAMP value will each see it converted to their own local time. DATETIME is a plain, literal record of whatever string you inserted — no conversion, ever.

| | DATETIME | TIMESTAMP |
|---|----------|-----------|
| Timezone handling | None — stores exactly what's given | Converts to UTC on write, to local on read |
| Storage | 8 bytes | 4 bytes |
| Range | Up to year 9999 | Limited (32-bit unix time, ~2038) |
| Auto-update support | No | Yes — `ON UPDATE CURRENT_TIMESTAMP` |

**Common mistake:** assuming DATETIME and TIMESTAMP are interchangeable because they print the same way in a query result. They diverge the moment your server, your application, or your users span more than one timezone.

**Interview answer:** "TIMESTAMP is stored internally as UTC and converted to the session's timezone on retrieval, and it supports auto-updating columns like `updated_at`. DATETIME stores the literal value with no timezone awareness at all. TIMESTAMP is also limited to the 32-bit unix time range — it runs out in 2038 — while DATETIME comfortably reaches year 9999."

> **Memory hook:** "TIMESTAMP travels with a passport and adjusts to local time zones — DATETIME just writes down whatever you told it, word for word."

### Special Types

Beyond the basics, MySQL has a few purpose-built types for common shapes of data — a yes/no flag, a fixed set of allowed values, or a bag of structured data:

```sql
is_active  BOOLEAN          -- alias for TINYINT(1), 0=false 1=true
status     ENUM('active','inactive','banned')  -- one value from list
tags       SET('read','write','admin')          -- multiple values from list
metadata   JSON                                 -- validated JSON (MySQL 5.7+)
```

---

## 6. Storage Engines

Here's a question a lot of people never think to ask: when MySQL stores your table on disk, what's actually managing that file underneath? The answer is a **storage engine** — a pluggable component that decides how rows are physically stored, how locking works during concurrent writes, and whether transactions exist at all. Different engines make very different tradeoffs, and picking the wrong one can quietly cost you data integrity down the line.

```sql
-- Check available engines
SHOW ENGINES;

-- Check engine for a table
SELECT engine FROM information_schema.TABLES
WHERE table_schema = 'mydb' AND table_name = 'users';
```

### InnoDB vs MyISAM

The two engines you'll actually run into are InnoDB and MyISAM. Picture two different filing systems: InnoDB is a modern vault — if the power cuts mid-write, it can recover cleanly, and it only locks the one row being edited so other people can keep working on other rows. MyISAM is an older filing cabinet — quick and simple, but if two people reach for the same drawer, one has to wait for the whole drawer (not just the folder), and there's no rollback if something goes wrong mid-write.

| Feature | InnoDB | MyISAM |
|---------|--------|--------|
| ACID transactions | ✅ Yes | ❌ No |
| Row-level locking | ✅ Yes | ❌ Table-level only |
| Foreign keys | ✅ Yes | ❌ No |
| Crash recovery | ✅ Automatic | ❌ Manual repair needed |
| Full-text search | ✅ MySQL 5.6+ | ✅ Yes |
| Use case | General purpose (default) | Legacy read-heavy |

**Common mistake:** assuming storage engine choice doesn't matter much, or inheriting MyISAM tables from an old project without questioning it. Table-level locking under MyISAM means one write can stall every other read/write on that table — a real problem the moment you have concurrent traffic.

**Interview answer:** "InnoDB supports ACID transactions, row-level locking, and foreign key constraints, which makes it the safe default for essentially any application with concurrent writes. MyISAM only offers table-level locking and no transaction support, so it's largely a legacy choice reserved for read-heavy, low-concurrency workloads."

**Always use InnoDB** unless you have a very specific reason not to — and in modern MySQL 8, it already is the default.

> **Memory hook:** "InnoDB locks one drawer at a time and remembers where it left off after a power cut — MyISAM locks the whole cabinet and shrugs if the lights go out."

---

## 7. The information_schema

Suppose you need to answer a question like "which tables in this database are the largest?" or "does this table have a foreign key, and what does it point to?" You could dig through old CREATE TABLE scripts — or you could just *ask MySQL*, because MySQL keeps a complete, queryable catalog of its own structure.

That catalog is `information_schema` — a virtual database (it's not a "real" database you created; MySQL maintains it automatically) that describes every other database, table, column, index, and constraint on the server. Think of it as a card catalog in a library: it doesn't hold the books themselves, just organized facts about where everything is and what it looks like.

**A common point of confusion:** `information_schema` is itself queried with normal `SELECT` statements, just like any other table — it just happens to hold metadata *about* your schema rather than your actual application data.

```sql
-- All tables in a database
SELECT table_name, table_rows, engine, create_time
FROM information_schema.TABLES
WHERE table_schema = 'mydb'
ORDER BY table_rows DESC;

-- All columns in a table
SELECT column_name, data_type, is_nullable, column_default, extra
FROM information_schema.COLUMNS
WHERE table_schema = 'mydb' AND table_name = 'users'
ORDER BY ordinal_position;

-- All indexes across all tables
SELECT table_name, index_name, column_name, non_unique
FROM information_schema.STATISTICS
WHERE table_schema = 'mydb'
ORDER BY table_name, index_name;

-- All foreign keys
SELECT
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.KEY_COLUMN_USAGE
WHERE table_schema = 'mydb' AND referenced_table_name IS NOT NULL;
```

> **Memory hook:** "information_schema is the library's card catalog — it describes every book on the shelves without being one itself."

---

## 8. Hands-On Exercises

Time to put all of this together — creating databases, tables, and then interrogating them the way you just learned.

**Exercise 1:** Create a database called `store` with utf8mb4 charset. Create a `products` table with: id (auto-increment PK), name (varchar 200, not null), price (decimal 10,2), stock (int unsigned, default 0), created_at (datetime auto).

**Exercise 2:** Use `DESCRIBE products` and `SHOW CREATE TABLE products` — identify all constraints and defaults.

**Exercise 3:** Create a second table `categories` with id and name. Add a `category_id` column to products referencing categories.

**Exercise 4:** Query `information_schema.TABLES` to list all tables in your `store` database with their engine and estimated row count.

**Exercise 5:** Use `SHOW INDEX FROM products` — what indexes exist? Which were created automatically?

---

## 9. Interview Q&A

**Q: What is the difference between CHAR and VARCHAR?**
Answer: CHAR(n) always stores exactly n bytes, padding with spaces if shorter — good for fixed-length values like country codes. VARCHAR(n) stores only the actual string length plus 1-2 bytes for the length prefix — efficient for variable-length data like names and emails.

**Q: What is utf8mb4 and why should you use it instead of utf8 in MySQL?**
Answer: MySQL's `utf8` is actually a 3-byte encoding that cannot store 4-byte Unicode characters (emoji, rare CJK characters). `utf8mb4` is the true 4-byte UTF-8 and should always be used. Modern MySQL 8.0 defaults to utf8mb4.

**Q: What is AUTO_INCREMENT and what happens to gaps?**
Answer: AUTO_INCREMENT automatically assigns the next integer value on each INSERT. If you delete rows or rollback inserts, gaps appear in the sequence — MySQL does not reuse numbers. This is by design to prevent race conditions and ensure uniqueness.

**Q: What is the difference between DATETIME and TIMESTAMP?**
Answer: TIMESTAMP is stored as UTC and converted to the server's local timezone on retrieval — it also supports ON UPDATE CURRENT_TIMESTAMP. DATETIME stores the exact value you insert with no timezone conversion. TIMESTAMP has a 2038 limit (32-bit unix time); DATETIME goes to year 9999.

**Q: What is information_schema?**
Answer: information_schema is a read-only virtual database built into MySQL that provides metadata about all databases, tables, columns, indexes, and constraints. It's useful for schema inspection, dynamic SQL generation, and monitoring.

**Q: Why is InnoDB preferred over MyISAM?**
Answer: InnoDB supports ACID transactions, row-level locking, and foreign key constraints — essential for data integrity in any serious application. MyISAM offers only table-level locking and no transactions, making it unsuitable for concurrent write workloads.
