# 01 — What is SQL & MySQL?

## Table of Contents

1. [What is SQL?](#1-what-is-sql)
2. [Declarative vs Imperative](#2-declarative-vs-imperative)
3. [Set-Based Operations](#3-set-based-operations)
4. [SQL Standards History](#4-sql-standards-history)
5. [SQL Sublanguages](#5-sql-sublanguages)
6. [What is MySQL?](#6-what-is-mysql)
7. [MySQL Architecture](#7-mysql-architecture)
8. [InnoDB vs MyISAM](#8-innodb-vs-myisam)
9. [SQL vs NoSQL](#9-sql-vs-nosql)
10. [MySQL vs Other RDBMS](#10-mysql-vs-other-rdbms)
11. [Real-World MySQL Usage](#11-real-world-mysql-usage)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. What is SQL?

Imagine you've got a spreadsheet with a million rows of customer orders, and someone asks you:
"Which customers spent over $500 last month, sorted by amount?" You *could* write a program that
loops through every row, checks a date, adds up totals, and sorts the result. Or you could just
... ask for it, in a language the database itself understands, and let it figure out the fastest
way to get you the answer. That second option is SQL.

**SQL** (Structured Query Language) is the standard language for interacting with relational
database management systems (RDBMS). Pronounced either "S-Q-L" or "sequel", it was originally
developed at IBM in the early 1970s as part of the System R research project.

SQL lets you:
- **Define** the structure of data (tables, constraints, indexes)
- **Manipulate** data (insert, update, delete rows)
- **Query** data (select, join, aggregate)
- **Control** access (grant/revoke permissions)
- **Manage transactions** (commit, rollback)

### The Core Idea

Think of a relational database as a perfectly organised filing cabinet. Each drawer is a table,
each folder inside a row, and each piece of paper inside a column. SQL is the instructions you
give a librarian who knows exactly how to find, file, or reorganise anything instantly — without
you needing to describe the physical steps.

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                      │
│              (Python, Node.js, Java, ...)                │
└────────────────────────┬────────────────────────────────┘
                         │  SQL statement (text)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  MySQL SERVER                            │
│  Parses SQL → Plans execution → Accesses data on disk   │
└────────────────────────┬────────────────────────────────┘
                         │  Result set (rows + columns)
                         ▼
                  Back to your app
```

> **Memory hook:** SQL is you telling the librarian *what* you want to find — not walking the aisles yourself.

---

## 2. Declarative vs Imperative

Here's a question that trips up a lot of people moving from a general-purpose language (Python,
Java, JavaScript) into SQL: "where's the loop?" You write `SELECT * FROM users WHERE age > 30`
and... that's it. No `for` loop, no manual comparison, no index management. Where did all that
logic go? It didn't disappear — it moved *inside* the database engine, and you never have to
write it yourself. That's the whole point of this distinction, and it's one of SQL's most
powerful — and most misunderstood — characteristics.

### Analogy

Imperative is giving a taxi driver turn-by-turn directions: "turn left here, go straight for two
blocks, turn right at the light." Declarative is telling the driver your destination and letting
them use GPS. You don't care *how* they get there — you just care that you arrive.

### The Basic Definition

| Paradigm | You describe... | You control... | Example |
|----------|----------------|----------------|---------|
| **Imperative** | *How* to do it | Every step | Loop through array, compare each element |
| **Declarative** | *What* you want | Nothing — engine decides | `SELECT * FROM users WHERE age > 30` |

### Under the Hood

When you write:

```sql
SELECT first_name, last_name
FROM   employees
WHERE  department = 'Engineering'
ORDER  BY last_name;
```

You are telling MySQL *what data you want*. MySQL's query optimizer then:

1. Checks statistics about the `employees` table (row count, index cardinality).
2. Decides whether to use an index on `department` or do a full table scan.
3. Chooses a sort algorithm (filesort vs index sort).
4. Executes the chosen physical plan.

You never wrote a loop. You never managed memory. You described the desired result and let the
database engine — a piece of software with decades of optimization work — figure out the best way
to get there.

### Common Confusion

New SQL learners often try to "help" the database by writing SQL that mimics imperative loops —
cursors that step row-by-row, or nested queries that recompute the same thing repeatedly. This
usually makes things *slower*, not faster, because it fights the optimizer instead of trusting it.
The right instinct is the opposite: describe the result set you want as a single statement, and
let MySQL pick the plan.

### Interview Answer

"Declarative means you specify *what* result you want, not *how* to compute it — the query
optimizer decides the access path, join order, and sort strategy based on statistics it holds
about the data, which usually beats a hand-rolled procedural algorithm."

> **Memory hook:** Imperative = turn-by-turn directions. Declarative = "take me to the airport" and let the GPS worry about the route.

---

## 3. Set-Based Operations

Picture this: you need the department name for every employee, and you have 10,000 employees.
An imperative instinct says "loop through each employee, look up their department, print the
pair" — one row at a time, 10,000 trips to the data. SQL refuses to think that way. Instead, it
grabs the *entire* employees table and the *entire* departments table, matches them up as whole
groups, and hands back one combined result — all in a single operation. That's set-based
thinking, and it's rooted in relational algebra (Codd, 1970): every SQL query takes one or more
**sets** as input and returns a new set as output.

```
employees table          departments table
┌────┬───────────┐       ┌────┬─────────────┐
│ id │ dept_id   │  JOIN │ id │ name        │
├────┼───────────┤  ───► ├────┼─────────────┤
│  1 │    10     │       │ 10 │ Engineering │
│  2 │    10     │       │ 20 │ Marketing   │
│  3 │    20     │       └────┴─────────────┘
└────┴───────────┘

Result set (a new set of rows):
┌────┬─────────────┐
│ id │ name        │
├────┼─────────────┤
│  1 │ Engineering │
│  2 │ Engineering │
│  3 │ Marketing   │
└────┴─────────────┘
```

Key set operations in SQL:
- `UNION` — combine two result sets (removes duplicates)
- `UNION ALL` — combine without deduplication
- `INTERSECT` — rows in both sets
- `EXCEPT` / `MINUS` — rows in first set but not second

> **Memory hook:** SQL doesn't fetch rows one at a time like a waiter taking orders individually — it brings the whole tray out at once.

---

## 4. SQL Standards History

Ever wonder why the same `WITH RECURSIVE` query or window function works (mostly) the same way
whether you're on MySQL, PostgreSQL, or SQL Server? It's because SQL isn't just "whatever each
vendor decided to build" — it's standardised by ANSI and ISO, and vendors track that standard
(with their own extensions on top). Each revision below added new features. MySQL does not
implement every feature of every standard but tracks the major ones.

| Standard | Year | Key Additions |
|----------|------|---------------|
| SQL:86 | 1986 | First ANSI standard; basic SELECT, INSERT, UPDATE, DELETE |
| SQL:89 | 1989 | Integrity constraint enhancements |
| SQL:92 | 1992 | JOIN syntax, subqueries, CASE, string functions, CAST |
| SQL:99 | 1999 | Recursive queries (WITH RECURSIVE), triggers, OO extensions, OLAP basics |
| SQL:2003 | 2003 | Window functions (OVER/PARTITION BY), XML support, sequences, MERGE |
| SQL:2008 | 2008 | TRUNCATE TABLE standard, INSTEAD OF triggers |
| SQL:2011 | 2011 | Temporal tables (system-versioned), period definitions |
| SQL:2016 | 2016 | JSON support (JSON_VALUE, JSON_TABLE), polymorphic tables |
| SQL:2023 | 2023 | Property graph queries, JSON improvements |

> MySQL 8.0 supports most of SQL:2003 including window functions, CTEs, and JSON. MySQL 8.4 and
> later continue improving SQL:2016 JSON compliance.

---

## 5. SQL Sublanguages

If SQL did everything with one giant flat command set, it would be chaos — "wait, does `CREATE`
insert data or build a table?" To keep things sane, SQL statements are grouped into five
sublanguages by *job*: some build the shelves (schema), some stock them (data), some read what's
on them (queries), some decide who's allowed in the room (permissions), and some make sure a
multi-step job either fully happens or doesn't happen at all (transactions). Think of it as five
departments in the same company, each with its own toolkit:

```
┌─────────────────────────────────────────────────────────────────┐
│                          SQL                                     │
├───────────┬───────────┬───────────┬───────────┬─────────────────┤
│   DDL     │   DML     │   DQL     │   DCL     │      TCL        │
│ (Define)  │(Manipulate│  (Query)  │ (Control) │  (Transaction)  │
└───────────┴───────────┴───────────┴───────────┴─────────────────┘
```

| Sublanguage | Full Name | Statements | Purpose |
|-------------|-----------|------------|---------|
| **DDL** | Data Definition Language | `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME` | Define and modify schema structure |
| **DML** | Data Manipulation Language | `INSERT`, `UPDATE`, `DELETE`, `REPLACE` | Add, change, remove rows |
| **DQL** | Data Query Language | `SELECT` | Retrieve data (sometimes grouped with DML) |
| **DCL** | Data Control Language | `GRANT`, `REVOKE` | Manage user permissions |
| **TCL** | Transaction Control Language | `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `SET TRANSACTION` | Control transaction boundaries |

### DDL Examples

```sql
-- CREATE: make a new table
CREATE TABLE products (
    id          INT           NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)  NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id)
);

-- ALTER: add a column
ALTER TABLE products ADD COLUMN stock INT DEFAULT 0;

-- DROP: permanently remove a table
DROP TABLE IF EXISTS products;

-- TRUNCATE: remove all rows, reset AUTO_INCREMENT (faster than DELETE)
TRUNCATE TABLE products;
```

### DML Examples

```sql
-- INSERT
INSERT INTO products (name, price, stock) VALUES ('Widget', 9.99, 100);

-- UPDATE
UPDATE products SET price = 11.99 WHERE id = 1;

-- DELETE
DELETE FROM products WHERE stock = 0;
```

### DQL Example

```sql
-- SELECT
SELECT name, price FROM products WHERE price < 20 ORDER BY price ASC;
```

### DCL Examples

```sql
-- GRANT
GRANT SELECT, INSERT ON mydb.products TO 'app_user'@'localhost';

-- REVOKE
REVOKE INSERT ON mydb.products FROM 'app_user'@'localhost';
```

### TCL Examples

```sql
-- Begin a transaction (MySQL auto-commits by default; use START TRANSACTION to override)
START TRANSACTION;

UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;

-- If all good
COMMIT;

-- If something went wrong
ROLLBACK;

-- Partial rollback
SAVEPOINT before_update;
UPDATE accounts SET balance = balance - 100 WHERE id = 3;
ROLLBACK TO SAVEPOINT before_update;
```

> **Memory hook:** DDL builds the shelves, DML stocks them, DQL reads the labels, DCL guards the door, TCL makes sure a delivery is all-or-nothing.

---

## 6. What is MySQL?

So SQL is the *language*. MySQL is one of the *engines* that speaks it. If SQL is like "English,"
MySQL is a specific person (or company) who understands English and can actually go fetch, file,
or update your data when you ask.

MySQL is an open-source **relational database management system** (RDBMS). It is the most widely
deployed open-source database in the world and forms the "M" in the classic LAMP stack
(Linux, Apache, MySQL, PHP/Python/Perl).

### History Timeline

```
1994  ──  Michael Widenius ("Monty") and David Axmark start development at TcX DataKonsult AB
1995  ──  MySQL 1.0 released internally; public release later that year
2000  ──  MySQL goes open-source under GPL
2001  ──  MySQL AB founded as a company
2003  ──  MySQL 4.0 introduces InnoDB as default-capable engine
2004  ──  MySQL 4.1 adds subqueries, UTF-8
2005  ──  MySQL 5.0 adds stored procedures, triggers, views, cursors
2008  ──  Sun Microsystems acquires MySQL AB for $1 billion
2009  ──  Oracle acquires Sun (and MySQL); Monty forks MySQL → MariaDB
2010  ──  MySQL 5.5 makes InnoDB the default storage engine
2013  ──  MySQL 5.6 adds full-text search in InnoDB, better optimizer
2015  ──  MySQL 5.7 adds JSON data type, generated columns
2018  ──  MySQL 8.0 — window functions, CTEs, roles, utf8mb4 default
2024  ──  MySQL 8.4 LTS released (Long Term Support)
2025  ──  MySQL 9.x Innovation releases continue
```

### Why MySQL Became Dominant

1. **Free and open-source** — zero licensing cost for most use cases.
2. **Fast reads** — especially with MyISAM (before InnoDB dominated); web workloads are read-heavy.
3. **Easy to install** — one package, works on every OS.
4. **Massive hosting support** — every shared hosting provider offered MySQL.
5. **Huge community** — StackOverflow, official docs, third-party books.

### MariaDB Fork

After Oracle's acquisition, Monty Widenius created **MariaDB** in 2009 as a community-driven
fork. MariaDB maintains drop-in compatibility with MySQL but adds:
- Aria storage engine (crash-safe MyISAM replacement)
- Column Store (columnar storage for analytics)
- Different optimizer improvements
- Some diverging syntax (e.g., `SEQUENCE` objects)

Many Linux distributions ship MariaDB as the default "MySQL" package. For this curriculum we
target MySQL 8.0+, but most examples run unchanged on MariaDB 10.x.

> **Memory hook:** Free, fast, and everywhere — that's how a database becomes the "M" in LAMP.

---

## 7. MySQL Architecture

Ever run a slow query and wonder *where* the time actually went — parsing the SQL text? deciding
a plan? reading from disk? MySQL isn't one monolithic blob of code; it's built in three distinct
layers, and each layer is a different place things can go right or wrong. Understanding the
layers helps you diagnose performance problems, choose storage engines wisely, and understand
what changes when you tune configuration.

```
┌──────────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATIONS                          │
│     mysql CLI │ MySQL Workbench │ Node.js │ Python │ Java        │
└────────────────────────────┬─────────────────────────────────────┘
                             │  TCP/IP or Unix socket (port 3306)
┌────────────────────────────▼─────────────────────────────────────┐
│                   CONNECTION LAYER                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ Authentication  │  │  Thread / Conn.  │  │   SSL / TLS    │  │
│  │ (user, host,    │  │  Pool Management │  │   Encryption   │  │
│  │  password hash) │  │  (one thread per │  │                │  │
│  └─────────────────┘  │  connection)     │  └────────────────┘  │
│                        └──────────────────┘                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                      SQL LAYER                                   │
│  ┌────────────┐  ┌────────────┐  ┌───────────────────────────┐  │
│  │   Parser   │  │ Optimizer  │  │      Query Cache          │  │
│  │            │  │            │  │  (deprecated in 8.0;      │  │
│  │ Tokenise → │  │ Statistics │  │   removed in 8.0.3)       │  │
│  │ AST build  │  │ Cost model │  │                           │  │
│  │ Validate   │  │ Plan pick  │  └───────────────────────────┘  │
│  └────────────┘  └────────────┘                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            Execution Engine / Buffer Pool                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │  Storage Engine API (handler interface)
┌────────────────────────────▼─────────────────────────────────────┐
│                  STORAGE ENGINE LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────┐  │
│  │   InnoDB    │  │   MyISAM    │  │  Memory  │  │  NDB     │  │
│  │  (default)  │  │  (legacy)   │  │  (temp)  │  │(cluster) │  │
│  │  ACID/MVCC  │  │  Fast reads │  │ RAM only │  │          │  │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  └──────────┘  │
└─────────┼────────────────┼──────────────┼────────────────────────┘
          │                │              │
┌─────────▼────────────────▼──────────────▼────────────────────────┐
│                     FILE SYSTEM / DISK                           │
│   .ibd files   │   .MYD / .MYI   │   ib_logfile (redo log)      │
└──────────────────────────────────────────────────────────────────┘
```

### Layer Breakdown

**Connection Layer**
- Handles TCP/IP connections on port 3306 (or Unix socket `/var/run/mysqld/mysqld.sock`).
- Authenticates each client: checks username, host, and password against the `mysql.user` table.
- Spawns one OS thread per connection (thread-per-connection model). MySQL 8.0 adds a thread pool
  plugin that reuses threads for high-concurrency workloads.
- Manages SSL/TLS negotiation.

**SQL Layer**
- **Parser**: Tokenises the SQL text, builds an Abstract Syntax Tree (AST), validates syntax.
- **Preprocessor**: Resolves table/column names, checks privileges.
- **Query Optimizer**: The heart of performance. Uses cost-based optimization — estimates I/O and
  CPU cost of different plans and picks the cheapest. Uses index statistics (`ANALYZE TABLE`
  updates these).
- **Execution Engine**: Calls the storage engine's handler API to fetch rows.

**Storage Engine Layer**
- MySQL's "pluggable storage engine" architecture is unique. The SQL layer calls a common handler
  API; the engine below does the actual I/O.
- You can mix engines per table: `ENGINE=InnoDB` on transactional tables, `ENGINE=Memory` on
  session temp tables.

> **Memory hook:** Connection layer answers the door, SQL layer plans the trip, storage engine layer actually walks to the shelf and grabs the data.

---

## 8. InnoDB vs MyISAM

Here's a scenario worth sitting with: your bank app deducts $100 from account A and adds $100 to
account B. Halfway through, the server crashes. If only the deduction happened, $100 just
vanished into thin air. This is *exactly* the kind of problem that decided MySQL's whole storage
engine story. For years MySQL shipped with MyISAM as the default, which had no concept of "these
two updates must happen together, or not at all." That gap is precisely why InnoDB — which does
guarantee this — took over as the default in MySQL 5.5 (2010). Understanding why explains ACID,
locking, and crash recovery all at once.

| Feature | InnoDB | MyISAM |
|---------|--------|--------|
| **ACID compliance** | Full (Atomicity, Consistency, Isolation, Durability) | No (no transaction support) |
| **Transaction support** | Yes — `START TRANSACTION`, `COMMIT`, `ROLLBACK` | No |
| **Locking granularity** | Row-level locking | Table-level locking |
| **Foreign key support** | Yes — enforced at engine level | No (syntax accepted but ignored) |
| **Crash recovery** | Automatic via redo log (`ib_logfile`) | Manual repair with `myisamchk` |
| **MVCC** | Yes — Multi-Version Concurrency Control | No |
| **Full-text search** | Yes (since MySQL 5.6) | Yes (since early versions) |
| **Clustered index** | Yes — primary key = clustered index | No — heap table, separate .MYI index |
| **Storage files** | `.ibd` per table (with `innodb_file_per_table`) | `.MYD` (data) + `.MYI` (index) |
| **COUNT(*) without WHERE** | Slower (no stored row count) | Very fast (stores total) |
| **Compression** | Yes (Barracuda format) | Yes (read-only compressed) |
| **Use case** | OLTP, anything requiring transactions | Legacy read-heavy, no-transaction needs |

### ACID Explained

Go back to that bank transfer. What actually needs to be *guaranteed* so you never lose or
duplicate money? Four things, and each has a letter:

```
A — Atomicity:    A transaction is all-or-nothing. Transfer $100: both debit AND credit happen,
                  or neither does. No partial updates.

C — Consistency:  DB moves from one valid state to another. Constraints (FK, UNIQUE, NOT NULL)
                  are always satisfied after a commit.

I — Isolation:    Concurrent transactions don't see each other's uncommitted changes
                  (configurable via isolation levels).

D — Durability:   Once committed, data survives crashes. InnoDB writes to redo log before
                  applying to data pages (Write-Ahead Logging).
```

**Common mistake:** assuming ACID means "the database is always slow but safe." In practice
InnoDB achieves ACID *and* high concurrency at the same time — that's exactly what MVCC (next)
is for. ACID is not a performance tax; it's a correctness guarantee, and InnoDB is engineered to
give it to you cheaply.

### MVCC — Multi-Version Concurrency Control

Here's a puzzle: if a `SELECT` had to wait for every in-progress `UPDATE` on the same table to
finish (to avoid reading half-written data), your database would grind to a halt under any real
concurrent load. So how does InnoDB let reads and writes happen on the same rows, at the same
time, without either one blocking the other?

The trick: InnoDB keeps old versions of rows (in the **undo log**) so that read queries can see a
consistent snapshot of data at the time their transaction started, without blocking writes. This
is why `SELECT` does not need to acquire locks in InnoDB's default isolation level (REPEATABLE
READ). It's like taking a photograph of the data at the moment you started reading — no matter
what changes after that, your photograph stays the same until you're done.

```
Time ──────────────────────────────────────────────►

Txn A: START TRANSACTION;
       SELECT balance FROM accounts WHERE id=1;   ← sees $1000 (snapshot at T1)
                                                   
Txn B:                  UPDATE accounts SET balance=500 WHERE id=1;
                        COMMIT;                    ← balance is now $500 on disk

Txn A:       SELECT balance FROM accounts WHERE id=1;   ← still sees $1000 (its snapshot)
             COMMIT;

Result: Txn A got a consistent view. No lock needed. No blocking.
```

**Interview answer:** "MVCC lets InnoDB keep old row versions in the undo log so a reader always
sees a consistent snapshot from when its transaction began, without needing shared locks. This
means reads never block writes and writes never block reads, which is why InnoDB can sustain high
concurrency while still being fully ACID-compliant."

> **Memory hook:** ACID is the promise ("your money is safe"). MVCC is the trick that keeps that promise fast ("take a snapshot, don't wait in line").

---

## 9. SQL vs NoSQL

You're in a system design interview and someone asks: "would you use MySQL or MongoDB for this
product catalog?" There's no universally correct answer — SQL databases (RDBMS) and NoSQL
databases solve genuinely different problems, and picking the right one is exactly the kind of
trade-off reasoning these interviews are testing for.

| Dimension | SQL (RDBMS) | NoSQL |
|-----------|-------------|-------|
| **Data structure** | Rigid schema — tables, columns with types | Flexible — documents, key-value, graph, column-family |
| **Schema** | Schema-on-write (defined before data) | Schema-on-read (structure inferred at query time) |
| **ACID** | Strong ACID by default (InnoDB, PostgreSQL) | Eventual consistency by default; some support ACID (MongoDB 4.0+) |
| **Scalability** | Vertical (bigger server) + read replicas | Horizontal sharding built-in (Cassandra, MongoDB) |
| **Query language** | Standardised SQL — portable | Proprietary API per product |
| **Joins** | Native, optimised | Typically no native joins; embed or denormalize |
| **Transactions** | Multi-statement transactions | Limited (MongoDB) or none (Redis, Cassandra) |
| **Consistency model** | Strong consistency | CAP theorem trade-offs (AP or CP) |
| **Best for** | Financial systems, ERP, reporting, known structure | Catalogs, social feeds, event logs, high write throughput |
| **Examples** | MySQL, PostgreSQL, Oracle, SQL Server | MongoDB, Cassandra, Redis, DynamoDB, Neo4j |

### When to Choose SQL

- Data has well-defined relationships (orders → line items → products → customers).
- You need transactions (financial transfers, inventory management).
- Ad-hoc reporting and complex queries matter.
- Team knows SQL well; ecosystem of ORMs, BI tools, etc.

### When to Choose NoSQL

- Schema evolves rapidly (early-stage product, A/B testing).
- Massive write throughput needed (IoT sensor data, event streams).
- Data is naturally document-shaped (product catalog with variable attributes).
- Geographic distribution with partition tolerance priority.

> **Memory hook:** SQL is a filing cabinet with strict labeled folders. NoSQL is a pile of labeled boxes you can reshape anytime. Pick the cabinet when the shape of your data is known and relationships matter; pick the boxes when the shape keeps changing and you need to move fast.

---

## 10. MySQL vs Other RDBMS

Not every RDBMS is interchangeable, even though they all speak SQL. Choosing MySQL vs PostgreSQL
vs SQLite vs SQL Server is less about "which is best" and more about "which fits this job" — the
table below lines them up side by side.

| Feature | MySQL 8.0 | PostgreSQL 16 | SQLite 3.x | SQL Server 2022 |
|---------|-----------|---------------|------------|-----------------|
| **License** | GPL / commercial | PostgreSQL (permissive) | Public domain | Proprietary |
| **Typical use** | Web apps, SaaS | Complex queries, PostGIS, analytics | Embedded, mobile | Enterprise Windows |
| **Window functions** | Yes (8.0+) | Yes (extensive) | Yes (3.25+) | Yes |
| **CTEs** | Yes (8.0+) | Yes | Yes | Yes |
| **JSON support** | Yes (5.7+), JSON_TABLE | Yes, JSONB (indexed) | Yes (basic) | Yes (JSON functions) |
| **Full-text search** | Built-in | tsvector / tsquery | FTS5 extension | Full-text catalog |
| **Replication** | Binary log, GTID, Group Replication | Streaming + logical | Not built-in | Always On AG |
| **Partitioning** | RANGE, LIST, HASH, KEY | RANGE, LIST, HASH | Partial (views) | Full support |
| **Stored procs** | Yes | Yes (PL/pgSQL, Python, etc.) | No | Yes (T-SQL) |
| **Concurrency model** | MVCC (InnoDB) | MVCC | WAL (serialized writes) | MVCC |
| **Max DB size** | Unlimited (OS/disk) | Unlimited | 281 TB | 524 PB |
| **Default port** | 3306 | 5432 | N/A (file) | 1433 |

### Key Differentiators

**MySQL strengths**: Speed on simple OLTP reads, massive deployment base, excellent cloud managed
options (RDS, Cloud SQL, PlanetScale), easy replication setup.

**PostgreSQL strengths**: Standards compliance, rich type system (arrays, ranges, custom types),
better complex query optimizer, PostGIS for geospatial, logical replication flexibility.

**SQLite strengths**: Zero-config, single file, embedded in browsers/mobile/IoT, great for
testing.

**SQL Server strengths**: Deep Windows/Azure integration, excellent BI tooling (SSRS, SSAS),
T-SQL stored procedure ecosystem.

> **Memory hook:** MySQL for speed and scale on the web, Postgres for rich queries and standards, SQLite for "it fits in your pocket," SQL Server for "it lives in a Windows shop."

---

## 11. Real-World MySQL Usage

All this theory is well and good, but does it actually hold up at planet-scale traffic? It does —
MySQL powers some of the highest-traffic systems ever built:

```
┌────────────────┬──────────────────────────────────────────────────────────┐
│ Company        │ MySQL Usage                                               │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Facebook       │ User profiles, social graph, messages; sharded across    │
│                │ thousands of servers; built MyRocks (RocksDB storage      │
│                │ engine) to reduce storage costs by 50%                    │
├────────────────┼──────────────────────────────────────────────────────────┤
│ YouTube        │ Video metadata (titles, descriptions, view counts),       │
│                │ comments, user playlists — billions of rows               │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Twitter        │ Core tweet store (before migrating parts to Manhattan/    │
│                │ Manhattan DB); user accounts still MySQL-backed           │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Airbnb         │ Listings, bookings, payments; migrated to Vitess           │
│                │ (MySQL sharding middleware) to handle growth               │
├────────────────┼──────────────────────────────────────────────────────────┤
│ GitHub         │ Repositories, issues, pull requests; one of the largest   │
│                │ MySQL deployments; open-sourced gh-ost (online schema      │
│                │ change tool) and Orchestrator (HA management)              │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Shopify        │ Merchant stores, orders, products; uses Vitess for         │
│                │ horizontal sharding                                        │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Wikipedia      │ Article content and metadata on MariaDB (MySQL fork)      │
└────────────────┴──────────────────────────────────────────────────────────┘
```

### Scale Challenges These Companies Solved

- **Sharding**: Splitting one logical database across many physical servers (by user ID, region, etc.)
- **Read replicas**: One primary for writes, N replicas for reads.
- **Online schema changes**: Altering a table with 1 billion rows without locking it (tools: pt-online-schema-change, gh-ost).
- **Connection pooling**: 10,000 app servers × 10 connections each = 100,000 connections. ProxySQL or PgBouncer multiplexes them.

> **Memory hook:** If Facebook, YouTube, and GitHub trust MySQL with billions of rows, it's a safe bet for your project too.

---

## 12. Hands-On Exercises

Complete these after reading this file. You will need MySQL installed (see next file).

**Exercise 1 — SQL Sublanguage Classification**
For each statement below, identify which sublanguage it belongs to (DDL/DML/DQL/DCL/TCL):
```sql
a)  CREATE INDEX idx_email ON users(email);
b)  DELETE FROM orders WHERE status = 'cancelled';
c)  SELECT COUNT(*) FROM products;
d)  GRANT SELECT ON mydb.* TO 'reporting'@'%';
e)  ROLLBACK;
```

**Exercise 2 — Declarative Thinking**
Write an imperative description (pseudocode) of what this SQL does, then explain why the
declarative version is better:
```sql
SELECT department, AVG(salary) AS avg_salary
FROM   employees
WHERE  hire_date >= '2020-01-01'
GROUP  BY department
HAVING AVG(salary) > 75000
ORDER  BY avg_salary DESC;
```

**Exercise 3 — Storage Engine Decision**
You are designing a database for a bank's transaction ledger. The system must:
- Record every debit and credit atomically.
- Roll back incomplete transactions on crash.
- Handle 500 concurrent users updating their balances.
- Support foreign keys between `accounts` and `transactions` tables.

Which storage engine do you choose and why? What would break if you chose MyISAM?

**Exercise 4 — SQL vs NoSQL**
A startup is building a product catalog for an e-commerce site. Products have wildly different
attributes: a shirt has `size` and `colour`, a laptop has `RAM` and `CPU`, a book has `ISBN` and
`author`. Write a one-paragraph recommendation: SQL, NoSQL, or hybrid? Justify with trade-offs.

**Exercise 5 — History Research**
Find and note the MySQL version that introduced each feature:
- Stored procedures
- JSON data type
- Window functions
- utf8mb4 as default character set
- CTEs (WITH clause)

---

## 13. Interview Q&A

---

**Q1: What does "declarative" mean in the context of SQL?**

A: Declarative means you specify *what* result you want, not *how* to compute it. You write
`SELECT ... WHERE ...` and MySQL's query optimizer decides whether to use an index, which join
algorithm to use, and what order to process predicates. This contrasts with imperative languages
where you write explicit loops and conditionals. The benefit is that the database engine —
which has statistics about data distribution — often finds a better plan than a programmer
hand-writing the algorithm.

---

**Q2: What are the five SQL sublanguages?**

A: DDL (Data Definition Language — CREATE, ALTER, DROP), DML (Data Manipulation Language —
INSERT, UPDATE, DELETE), DQL (Data Query Language — SELECT), DCL (Data Control Language —
GRANT, REVOKE), and TCL (Transaction Control Language — COMMIT, ROLLBACK, SAVEPOINT). In
practice DQL is often grouped into DML, making four sublanguages in some textbooks.

---

**Q3: What is ACID and why does it matter?**

A: ACID stands for Atomicity (all-or-nothing transactions), Consistency (constraints always
satisfied), Isolation (concurrent transactions don't see each other's uncommitted state), and
Durability (committed data survives crashes). It matters because without ACID you can have
money disappear during a bank transfer, inventory go negative, or see corrupted half-written
data. InnoDB provides full ACID; MyISAM does not.

---

**Q4: Why did MySQL become so popular?**

A: It was free, fast for read-heavy web workloads, easy to install, and supported by every
shared hosting provider in the LAMP stack era (late 1990s–2000s). The combination of zero
cost, simplicity, and sufficient performance for most web applications created a massive
developer community and ecosystem that compounded over decades.

---

**Q5: What is MVCC and how does InnoDB use it?**

A: Multi-Version Concurrency Control keeps old row versions in the undo log so readers can
see a consistent snapshot at the start of their transaction without acquiring shared locks.
This means `SELECT` queries don't block `INSERT/UPDATE/DELETE` and vice versa, enabling high
concurrency. The trade-off is that long-running transactions keep undo log entries alive,
consuming space and slowing purge.

---

**Q6: What is the difference between DELETE and TRUNCATE?**

A: `DELETE` is DML — it removes rows one by one, fires triggers, respects WHERE clauses, and
can be rolled back within a transaction. `TRUNCATE` is DDL — it drops and recreates the table
structure, is much faster for removing all rows, resets AUTO_INCREMENT, cannot be rolled back
in most MySQL configurations, and does not fire row-level triggers.

---

**Q7: What is the storage engine layer in MySQL?**

A: MySQL's pluggable storage engine architecture separates the SQL processing layer from the
actual data storage. The SQL layer calls a common handler API; any registered engine (InnoDB,
MyISAM, Memory, NDB, RocksDB) can answer those calls. This means different tables in the same
database can use different engines. InnoDB is the default and recommended engine for almost
all use cases.

---

**Q8: Why was MariaDB created?**

A: When Oracle acquired Sun Microsystems (and MySQL) in 2009–2010, the open-source community
feared Oracle would commercialise MySQL, slow development, or restrict the GPL license. Michael
Widenius (MySQL's original author) forked MySQL into MariaDB, a community-governed project.
MariaDB remains drop-in compatible with MySQL but has diverged with its own storage engines,
optimizer improvements, and features.

---

**Q9: What is a clustered index and why does InnoDB use one?**

A: A clustered index stores the actual row data in the index's B-Tree leaf pages, ordered by
the primary key. InnoDB always has exactly one clustered index (the primary key, or a hidden
one if no PK is defined). This means primary key lookups are extremely fast — one B-Tree
traversal reaches the row. Secondary indexes store the primary key value as their row pointer,
so a secondary index lookup requires two B-Tree traversals (once to find the PK, once to find
the row). MyISAM uses a heap file for rows and separate index files — no clustering.

---

**Q10: What is row-level vs table-level locking?**

A: Table-level locking (MyISAM) locks the entire table for a write operation — every other
writer and reader must wait. Row-level locking (InnoDB) locks only the specific rows being
modified, allowing concurrent reads and writes to different rows to proceed simultaneously.
Row-level locking dramatically improves concurrency for OLTP workloads with many simultaneous
users touching different rows.

---

**Q11: When would you choose MySQL over PostgreSQL?**

A: MySQL is a strong choice when: you need the largest possible managed cloud ecosystem
(AWS RDS, Google Cloud SQL, Azure Database for MySQL are all mature), your workload is
simple OLTP (inserts, point lookups, simple joins), your team is familiar with MySQL, or
you are migrating an existing MySQL application. PostgreSQL is typically better for complex
queries, analytical workloads, geospatial data (PostGIS), custom types, or when standards
compliance and feature richness matter more than familiarity.

---

**Q12: What SQL standard introduced window functions?**

A: SQL:2003 introduced the `OVER` clause for window functions. MySQL added support for window
functions in version 8.0 (released April 2018). Before 8.0, MySQL developers had to simulate
window functions with variables (`@rank := @rank + 1`) or subqueries, which was verbose and
often slow.

---

**Q13: What is the difference between UNION and UNION ALL?**

A: Both combine result sets from two SELECT statements with matching column counts and
compatible types. `UNION` removes duplicate rows (requires a sort or hash deduplication step).
`UNION ALL` keeps all rows including duplicates and is faster because no deduplication is
needed. Use `UNION ALL` by default unless deduplication is a business requirement.

---

**Q14: Why was the query cache removed in MySQL 8.0?**

A: The query cache stored the exact text of SELECT statements alongside their result sets.
Any write to a table invalidated ALL cached queries touching that table — a global mutex.
Under high write concurrency the mutex became a bottleneck worse than the cache's benefit.
Oracle deprecated it in 5.7 and removed it entirely in 8.0, recommending application-level
caching (Redis, Memcached) instead.

---

**Q15: What is a transaction isolation level?**

A: Isolation levels control how much one transaction can see of another's uncommitted work.
MySQL InnoDB supports four levels from the SQL standard:
- `READ UNCOMMITTED` — can see uncommitted ("dirty") data from other transactions.
- `READ COMMITTED` — only sees committed data; different reads in same transaction may differ.
- `REPEATABLE READ` (default) — snapshot taken at first read; same query returns same rows.
- `SERIALIZABLE` — strongest; transactions execute as if sequential; highest lock contention.
The default REPEATABLE READ prevents dirty reads and non-repeatable reads but allows phantom
reads (mitigated in InnoDB by gap locks).
