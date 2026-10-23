# Complete MySQL & SQL Learning Course — From Zero to Database Expert

> Master the world's most popular relational database system from first principles to production-grade design.

---

## Table of Contents

1. [Why SQL & MySQL?](#1-why-sql--mysql)
2. [How to Use This Course](#2-how-to-use-this-course)
3. [Learning Path](#3-learning-path)
4. [ASCII Learning Path Flow Diagram](#4-ascii-learning-path-flow-diagram)
5. [Phase Breakdown](#5-phase-breakdown)
6. [Projects](#6-projects)
7. [Certification](#7-certification)
8. [Getting Started — Installation](#8-getting-started--installation)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)
11. [Resources & Further Reading](#11-resources--further-reading)

---

## 1. Why SQL & MySQL?

### The Case for Learning SQL in 2026

SQL (Structured Query Language) has been the lingua franca of data since 1974. Despite the rise of NoSQL, graph databases, and NewSQL systems, **relational databases still power the majority of the world's transactional data workloads** — banking, e-commerce, healthcare, logistics, and SaaS platforms at every scale.

```
┌─────────────────────────────────────────────────────────────────┐
│              Why SQL Remains Indispensable                      │
├─────────────────────────────────────────────────────────────────┤
│  ACID Guarantees   │ Atomicity, Consistency, Isolation,         │
│                    │ Durability — your data won't lie to you.   │
├─────────────────────────────────────────────────────────────────┤
│  Universal Skill   │ PostgreSQL, Oracle, SQL Server, SQLite,    │
│                    │ BigQuery, Snowflake — all speak SQL.        │
├─────────────────────────────────────────────────────────────────┤
│  Structured Data   │ Schemas enforce correctness at write time, │
│                    │ not read time.                              │
├─────────────────────────────────────────────────────────────────┤
│  Mature Tooling    │ 50 years of optimisers, connectors,        │
│                    │ ORMs, BI tools, and monitoring dashboards.  │
├─────────────────────────────────────────────────────────────────┤
│  High Job Demand   │ "SQL" appears in ~60% of data/backend      │
│                    │ job postings globally (LinkedIn, 2025).     │
└─────────────────────────────────────────────────────────────────┘
```

### Why MySQL Specifically?

| Attribute | MySQL 8.x |
|---|---|
| Licence | GPL / Commercial (Oracle) |
| Market share | #1 open-source RDBMS (DB-Engines ranking) |
| Cloud support | AWS RDS, GCP Cloud SQL, Azure Database for MySQL |
| Storage engines | InnoDB (default, ACID), MyISAM, Memory, NDB |
| Performance | Sub-millisecond reads at 100k+ QPS with tuning |
| Community | 10 million+ active users worldwide |

**Real-world analogy:** SQL is like the English of data storage — not every country speaks it natively, but every serious data professional needs it to collaborate globally.

---

## 2. How to Use This Course

Follow this exact sequence for each phase. Rushing past any step will leave gaps that compound later.

```
┌──────────────────────────────────────────────────────────┐
│                  Recommended Study Loop                  │
│                                                          │
│   1. READ README.md in each Phase folder                 │
│      └── Understand WHY before HOW                       │
│                                                          │
│   2. STUDY the notes/ files                              │
│      └── Annotate, highlight, re-read tricky parts       │
│                                                          │
│   3. COMPLETE exercises/ problems                        │
│      └── Type every query — do NOT copy-paste            │
│                                                          │
│   4. BUILD the projects/ for that phase                  │
│      └── Apply concepts in a realistic schema            │
│                                                          │
│   5. REVIEW interview-qa/ before moving on               │
│      └── Explain each answer aloud in your own words     │
└──────────────────────────────────────────────────────────┘
```

### Study Rhythm

- **Minimum effective dose:** 1 hour/day, 5 days/week
- **Optimal pace:** 1.5–2 hours/day with one project day per week
- **Spaced repetition:** Revisit phase 1–3 notes every two weeks while progressing
- **Accountability:** Keep a `progress.md` in each phase folder with date completed and confidence score (1–5)

### What to Do When Stuck

1. Re-read the official MySQL 8.0 Reference Manual section on the topic.
2. Run `EXPLAIN` on your query — the execution plan usually reveals the problem.
3. Reproduce the issue in a minimal schema (3 tables, 10 rows).
4. Search Stack Overflow with the exact MySQL error code.
5. Move on with a TODO comment and return after the next phase.

---

## 3. Learning Path

| # | Phase | Folder | Est. Time |
|---|---|---|---|
| 1 | SQL Fundamentals | `Phase-01-SQL-Fundamentals` | 1 week |
| 2 | DDL — Data Definition | `Phase-02-DDL` | 1 week |
| 3 | DML — CRUD Operations | `Phase-03-DML-CRUD` | 1.5 weeks |
| 4 | Filtering & Sorting | `Phase-04-Filtering-Sorting` | 1 week |
| 5 | JOINs | `Phase-05-Joins` | 1.5 weeks |
| 6 | Aggregations & GROUP BY | `Phase-06-Aggregations` | 1.5 weeks |
| 7 | Subqueries & CTEs | `Phase-07-Subqueries-CTEs` | 1.5 weeks |
| 8 | Indexes & Query Tuning | `Phase-08-Indexes` | 1.5 weeks |
| 9 | Transactions & Locking | `Phase-09-Transactions` | 1 week |
| 10 | Stored Programs | `Phase-10-Stored-Programs` | 2 weeks |
| 11 | Advanced MySQL | `Phase-11-Advanced-MySQL` | 2 weeks |
| 12 | Database Design | `Phase-12-Database-Design` | 2 weeks |

**Total: 18–22 weeks** studying 1–2 hrs/day.

---

## 4. ASCII Learning Path Flow Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                         FOUNDATION LAYER                              │
│                                                                       │
│   ┌──────────────────┐       ┌──────────────────┐                    │
│   │  Phase 01        │──────▶│  Phase 02        │                    │
│   │  SQL Fundamentals│       │  DDL             │                    │
│   │  (tables, SELECT)│       │  (CREATE, ALTER) │                    │
│   └──────────────────┘       └────────┬─────────┘                    │
│                                       │                               │
│                              ┌────────▼─────────┐                    │
│                              │  Phase 03        │                    │
│                              │  DML / CRUD      │                    │
│                              │  (INSERT, UPDATE)│                    │
│                              └────────┬─────────┘                    │
└───────────────────────────────────────┼───────────────────────────────┘
                                        │
┌───────────────────────────────────────▼───────────────────────────────┐
│                           CORE LAYER                                  │
│                                                                       │
│   ┌──────────────────┐       ┌──────────────────┐                    │
│   │  Phase 04        │       │  Phase 05        │                    │
│   │  Filtering &     │──────▶│  JOINs           │                    │
│   │  Sorting         │       │  (INNER, OUTER,  │                    │
│   │  (WHERE, ORDER)  │       │   SELF, CROSS)   │                    │
│   └──────────────────┘       └────────┬─────────┘                    │
│                                       │                               │
│                     ┌─────────────────▼──────────────────┐           │
│                     │         Phase 06                   │           │
│                     │         Aggregations               │           │
│                     │  (GROUP BY, HAVING, window fns)    │           │
│                     └─────────────────┬──────────────────┘           │
│                                       │                               │
│                     ┌─────────────────▼──────────────────┐           │
│                     │         Phase 07                   │           │
│                     │         Subqueries & CTEs           │           │
│                     │  (correlated, WITH, recursive)     │           │
│                     └─────────────────┬──────────────────┘           │
└───────────────────────────────────────┼───────────────────────────────┘
                                        │
┌───────────────────────────────────────▼───────────────────────────────┐
│                         ADVANCED LAYER                                │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Phase 08   │  │  Phase 09   │  │  Phase 10   │  │  Phase 11   │ │
│  │  Indexes &  │  │  Transactions│  │  Stored     │  │  Advanced   │ │
│  │  Query Tune │  │  & Locking  │  │  Programs   │  │  MySQL      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │                │         │
│         └────────────────┴────────┬───────┘                │         │
│                                   │                         │         │
│                         ┌─────────▼─────────────────────────▼──────┐ │
│                         │           Phase 12                        │ │
│                         │        Database Design                    │ │
│                         │   (normalisation, ER diagrams, patterns)  │ │
│                         └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
                                        │
                              ┌─────────▼──────────┐
                              │   PRODUCTION READY  │
                              │  MySQL OCP / Jobs / │
                              │  Real-World Projects│
                              └─────────────────────┘
```

---

## 5. Phase Breakdown

### Phase 01 — SQL Fundamentals
**What you will learn:** What a relational database is, how MySQL stores data in tables, the difference between a schema and a database, basic `SELECT` queries, data types, and the MySQL client tools.

**Key concepts:** rows, columns, primary keys, NULL, data types (`INT`, `VARCHAR`, `DATE`, `DECIMAL`, `BOOLEAN`), `SELECT *`, `SELECT col`, `LIMIT`, `DISTINCT`.

**Analogy:** A MySQL database is a filing cabinet. Each table is a drawer. Each row is a document. Each column is a field on that document. SQL is the language you use to ask the filing clerk for documents.

---

### Phase 02 — DDL (Data Definition Language)
**What you will learn:** How to create, alter, and drop database objects. Constraints, default values, auto-increment, character sets, and collations.

**Key concepts:** `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `TRUNCATE`, `PRIMARY KEY`, `UNIQUE`, `NOT NULL`, `DEFAULT`, `AUTO_INCREMENT`, `FOREIGN KEY`, `CHECK`, `CREATE INDEX`, `CREATE VIEW`.

**Under the hood:** When you run `CREATE TABLE`, MySQL writes a `.ibd` file (InnoDB tablespace) to disk and registers metadata in the `information_schema`. `ALTER TABLE` can be online (no lock) or offline depending on the operation type.

---

### Phase 03 — DML (Data Manipulation Language / CRUD)
**What you will learn:** How to insert, update, delete, and replace rows. Bulk inserts, upserts (`INSERT ... ON DUPLICATE KEY UPDATE`), and safe deletes.

**Key concepts:** `INSERT INTO`, `VALUES`, `INSERT ... SELECT`, `UPDATE`, `SET`, `DELETE FROM`, `REPLACE INTO`, `TRUNCATE` vs `DELETE`, row-level locking during writes.

---

### Phase 04 — Filtering & Sorting
**What you will learn:** The full power of `WHERE`, comparison and logical operators, pattern matching, range checks, NULL handling, and result ordering.

**Key concepts:** `WHERE`, `AND`, `OR`, `NOT`, `IN`, `NOT IN`, `BETWEEN`, `LIKE`, `REGEXP`, `IS NULL`, `IS NOT NULL`, `ORDER BY`, `ASC`, `DESC`, `LIMIT`, `OFFSET`.

---

### Phase 05 — JOINs
**What you will learn:** How to combine data from multiple tables. The difference between each join type, how the query optimiser chooses join order, and common join pitfalls.

**Key concepts:** `INNER JOIN`, `LEFT JOIN`, `RIGHT JOIN`, `FULL OUTER JOIN` (via `UNION`), `CROSS JOIN`, `SELF JOIN`, `NATURAL JOIN`, join conditions vs filter conditions, multi-table joins.

**Analogy:** A JOIN is like a stapler — it lets you attach rows from two separate documents wherever a common field matches.

---

### Phase 06 — Aggregations & GROUP BY
**What you will learn:** How to summarise data across groups, filter aggregated results, and use window functions for running totals and rankings.

**Key concepts:** `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `GROUP BY`, `HAVING`, `ROLLUP`, `GROUPING SETS`, window functions (`ROW_NUMBER`, `RANK`, `DENSE_RANK`, `LAG`, `LEAD`, `SUM() OVER`, `PARTITION BY`).

---

### Phase 07 — Subqueries & CTEs
**What you will learn:** How to nest queries, when to use a subquery vs a join, correlated subqueries, and the modern CTE (`WITH`) syntax including recursive CTEs.

**Key concepts:** Scalar subqueries, row subqueries, table subqueries, `EXISTS`, `NOT EXISTS`, `IN` with subquery, correlated subqueries, `WITH cte AS (...)`, recursive CTE with `UNION ALL`.

---

### Phase 08 — Indexes & Query Tuning
**What you will learn:** How B-tree indexes work internally, when to add an index, composite index rules, covering indexes, and how to read `EXPLAIN` output.

**Key concepts:** B-tree, hash index, full-text index, spatial index, `CREATE INDEX`, `DROP INDEX`, composite index, prefix index, covering index, `EXPLAIN`, `EXPLAIN ANALYZE`, `SHOW STATUS`, slow query log, `optimizer_trace`.

**Under the hood:** InnoDB's primary key is a clustered index — the actual row data lives in the leaf nodes of the B-tree. Secondary indexes store the primary key value as a pointer, which is why small primary keys matter for memory and I/O.

---

### Phase 09 — Transactions & Locking
**What you will learn:** ACID properties, isolation levels, how InnoDB implements MVCC, explicit transaction control, and deadlock diagnosis.

**Key concepts:** `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE SAVEPOINT`, isolation levels (`READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`), MVCC, row locks, gap locks, next-key locks, deadlocks, `SHOW ENGINE INNODB STATUS`.

---

### Phase 10 — Stored Programs
**What you will learn:** How to write reusable server-side logic in MySQL — stored procedures, stored functions, triggers, and events.

**Key concepts:** `CREATE PROCEDURE`, `IN`/`OUT`/`INOUT` parameters, `CALL`, `CREATE FUNCTION`, `RETURNS`, `DETERMINISTIC`, `CREATE TRIGGER`, `BEFORE`/`AFTER`, `NEW`/`OLD`, `CREATE EVENT`, `DELIMITER`, error handling with `DECLARE ... HANDLER`, cursors.

---

### Phase 11 — Advanced MySQL
**What you will learn:** Replication, partitioning, full-text search, JSON data type, generated columns, and performance schema.

**Key concepts:** Binary log replication (source → replica), GTID-based replication, `PARTITION BY RANGE/LIST/HASH/KEY`, full-text indexes (`MATCH ... AGAINST`), `JSON` type, `JSON_EXTRACT`, `->`, `->>`, generated columns (`VIRTUAL`/`STORED`), `performance_schema`, `sys` schema.

---

### Phase 12 — Database Design
**What you will learn:** How to design schemas that scale — normalisation, ER diagrams, design patterns, and migration strategies.

**Key concepts:** 1NF, 2NF, 3NF, BCNF, denormalisation trade-offs, ER diagram notation (crow's foot), one-to-many, many-to-many (junction tables), self-referencing relationships, soft deletes, audit columns (`created_at`, `updated_at`, `deleted_at`), schema migration tools (Flyway, Liquibase), multi-tenancy patterns.

---

## 6. Projects

### Beginner Projects

| # | Project | Description | Phases Used |
|---|---|---|---|
| B1 | Library Management System | Track books, members, loans, returns, and fines with a normalised schema. | 1–5 |
| B2 | Employee Directory | Department hierarchy, employee records, salary history, and reporting structure. | 1–5 |
| B3 | Online Quiz App | Questions, options, quizzes, student attempts, and automatic scoring. | 1–6 |

### Intermediate Projects

| # | Project | Description | Phases Used |
|---|---|---|---|
| I1 | E-Commerce Order System | Products, categories, carts, orders, payments, inventory tracking, and sales reports. | 1–8 |
| I2 | Hotel Reservation System | Rooms, bookings, guests, billing, seasonal pricing rules, and occupancy analytics. | 1–9 |
| I3 | Blog & CMS Platform | Authors, posts, tags (many-to-many), comments, moderation queue, and full-text search. | 1–10 |

### Advanced Projects

| # | Project | Description | Phases Used |
|---|---|---|---|
| A1 | Banking Ledger | Accounts, double-entry transactions, balance snapshots, interest calculations with ACID transactions and audit triggers. | 1–11 |
| A2 | Multi-Tenant SaaS Analytics | Partitioned event tables, JSON metadata columns, OLAP-style window queries, and schema-per-tenant design. | 1–12 |
| A3 | Social Network Graph | User connections (self-referencing), feed generation via recursive CTEs, notification events, and timeline indexing. | 1–12 |

---

## 7. Certification

### MySQL OCP — Oracle Certified Professional MySQL 8.0 Database Administrator

```
┌──────────────────────────────────────────────────────────────────────┐
│         Oracle Certified Professional — MySQL 8.0 DBA               │
│                                                                      │
│  Exam Code  │  1Z0-908                                               │
│  Duration   │  105 minutes                                           │
│  Questions  │  ~60 multiple-choice / multiple-select                 │
│  Pass Score │  ~64%                                                  │
│  Cost       │  ~USD $245 (varies by country)                         │
│  Validity   │  Lifetime (no renewal required)                        │
│                                                                      │
│  Domains Covered:                                                    │
│  ├── MySQL Architecture & Installation       (~10%)                  │
│  ├── Data Definition & Data Types            (~12%)                  │
│  ├── Data Manipulation & Transactions        (~15%)                  │
│  ├── Query Optimisation & EXPLAIN            (~20%)                  │
│  ├── User Management & Security              (~12%)                  │
│  ├── Backup, Recovery & Replication          (~18%)                  │
│  └── Monitoring & Performance Schema         (~13%)                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Recommended preparation path:**
1. Complete all 12 phases of this course.
2. Read the official MySQL 8.0 Reference Manual chapters on security, backup (`mysqldump`, `mysqlpump`, MySQL Shell), and replication.
3. Take Oracle's official "MySQL 8.0 Database Administrator" training (1Z0-908 exam prep).
4. Practice with Oracle's free sample questions on CertView.
5. Schedule the exam via Pearson VUE.

**Alternative / complementary certifications:**
- AWS Certified Database — Specialty (covers RDS for MySQL in cloud context)
- Google Professional Data Engineer (covers Cloud SQL)

---

## 8. Getting Started — Installation

### macOS (Homebrew)

```bash
# Install MySQL 8
brew install mysql

# Start the MySQL service
brew services start mysql

# Secure the installation (set root password, remove test DB)
mysql_secure_installation

# Connect as root
mysql -u root -p

# Verify version
SELECT VERSION();
```

### Ubuntu / Debian (apt)

```bash
# Update package index
sudo apt update

# Install MySQL Server
sudo apt install mysql-server -y

# Start and enable the service
sudo systemctl start mysql
sudo systemctl enable mysql

# Run the security script
sudo mysql_secure_installation

# Connect (Ubuntu uses auth_socket for root by default)
sudo mysql -u root

# Or create a non-root user immediately
CREATE USER 'student'@'localhost' IDENTIFIED BY 'StrongPass!1';
GRANT ALL PRIVILEGES ON *.* TO 'student'@'localhost';
FLUSH PRIVILEGES;
```

### Windows (MSI Installer)

```
1. Download MySQL Installer from https://dev.mysql.com/downloads/installer/
2. Run mysql-installer-community-8.x.x.x.msi
3. Choose "Developer Default" setup type
4. Follow the wizard — set a root password you will remember
5. MySQL will be installed as a Windows Service (auto-start)
6. Open MySQL Workbench OR run:
   "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
```

### Docker (recommended for course work — no system pollution)

```bash
# Pull the official image
docker pull mysql:8.0

# Run a container with a named volume for data persistence
docker run --name mysql-course \
  -e MYSQL_ROOT_PASSWORD=CoursePass!1 \
  -e MYSQL_DATABASE=course_db \
  -p 3306:3306 \
  -v mysql-course-data:/var/lib/mysql \
  -d mysql:8.0

# Connect via the MySQL client inside the container
docker exec -it mysql-course mysql -u root -p

# Or connect from host using mysql CLI (if installed)
mysql -h 127.0.0.1 -P 3306 -u root -p
```

### First Commands After Connecting

```sql
-- Show all databases
SHOW DATABASES;

-- Create your practice database
CREATE DATABASE IF NOT EXISTS learning_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Switch to it
USE learning_db;

-- Confirm active database
SELECT DATABASE();

-- Show all tables (will be empty at first)
SHOW TABLES;
```

### Recommended GUI Tools

| Tool | Platform | Cost | Best For |
|---|---|---|---|
| MySQL Workbench | Win / Mac / Linux | Free | ER diagrams, query editor, admin |
| DBeaver Community | Win / Mac / Linux | Free | Multi-database, powerful SQL editor |
| TablePlus | Win / Mac | Freemium | Clean UI, fast prototyping |
| DataGrip | Win / Mac / Linux | Paid | Professional IDE, refactoring |

---

## 9. Hands-On Exercises

Work through these five exercises before starting Phase 01. They confirm your environment is working and build foundational muscle memory.

### Exercise 1 — Create and Populate a Sample Schema

```sql
-- Create a simple bookstore schema
CREATE DATABASE IF NOT EXISTS bookstore;
USE bookstore;

CREATE TABLE authors (
    author_id   INT           AUTO_INCREMENT PRIMARY KEY,
    first_name  VARCHAR(50)   NOT NULL,
    last_name   VARCHAR(50)   NOT NULL,
    country     VARCHAR(50),
    born_year   YEAR,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE books (
    book_id     INT           AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200)  NOT NULL,
    author_id   INT           NOT NULL,
    genre       VARCHAR(50),
    price       DECIMAL(7,2)  NOT NULL,
    published   DATE,
    stock       INT           DEFAULT 0,
    FOREIGN KEY (author_id) REFERENCES authors(author_id)
);

INSERT INTO authors (first_name, last_name, country, born_year) VALUES
  ('George',    'Orwell',      'United Kingdom', 1903),
  ('Toni',      'Morrison',    'United States',  1931),
  ('Haruki',    'Murakami',    'Japan',          1949),
  ('Chimamanda','Adichie',     'Nigeria',        1977),
  ('Fyodor',    'Dostoevsky',  'Russia',         1821);

INSERT INTO books (title, author_id, genre, price, published, stock) VALUES
  ('1984',                    1, 'Dystopia',    12.99, '1949-06-08',  42),
  ('Animal Farm',             1, 'Satire',       8.99, '1945-08-17',  67),
  ('Beloved',                 2, 'Literary',    14.99, '1987-09-02',  18),
  ('Norwegian Wood',          3, 'Literary',    13.49, '1987-09-04',  29),
  ('Kafka on the Shore',      3, 'Magical Realism', 15.99, '2002-09-12', 11),
  ('Purple Hibiscus',         4, 'Literary',    11.99, '2003-10-10',  35),
  ('Crime and Punishment',    5, 'Literary',    10.49, '1866-01-01',  55);
```

**Task:** Run each statement, then verify with `SHOW TABLES;` and `SELECT * FROM authors;`.

---

### Exercise 2 — Basic SELECT Queries

```sql
-- 2a. All books with their prices, ordered cheapest first
SELECT title, price
FROM books
ORDER BY price ASC;

-- 2b. Books priced between $10 and $14
SELECT title, price
FROM books
WHERE price BETWEEN 10.00 AND 14.00;

-- 2c. Count of books per genre
SELECT genre, COUNT(*) AS total_books
FROM books
GROUP BY genre
ORDER BY total_books DESC;

-- 2d. Authors from the United Kingdom or Japan
SELECT first_name, last_name, country
FROM authors
WHERE country IN ('United Kingdom', 'Japan');
```

**Task:** Predict the result set before running each query. Then compare your prediction to the actual output.

---

### Exercise 3 — JOIN Practice

```sql
-- 3a. List every book with its author's full name
SELECT
    b.title,
    CONCAT(a.first_name, ' ', a.last_name) AS author_name,
    b.price
FROM books b
INNER JOIN authors a ON b.author_id = a.author_id
ORDER BY author_name, b.title;

-- 3b. Authors and the total stock of their books
SELECT
    CONCAT(a.first_name, ' ', a.last_name) AS author_name,
    COUNT(b.book_id)                        AS num_books,
    SUM(b.stock)                            AS total_stock,
    ROUND(AVG(b.price), 2)                  AS avg_price
FROM authors a
LEFT JOIN books b ON a.author_id = b.author_id
GROUP BY a.author_id, author_name
ORDER BY total_stock DESC;
```

**Task:** Add a third table `sales (sale_id, book_id, quantity, sale_date)` with five rows of your choice and write a three-way JOIN that lists book title, author name, and total units sold.

---

### Exercise 4 — Aggregation & Window Functions

```sql
-- 4a. Rank books by price within each genre
SELECT
    title,
    genre,
    price,
    RANK() OVER (PARTITION BY genre ORDER BY price DESC) AS price_rank
FROM books;

-- 4b. Running total of stock ordered by price
SELECT
    title,
    price,
    stock,
    SUM(stock) OVER (ORDER BY price) AS running_stock
FROM books;

-- 4c. Most expensive book per genre using subquery
SELECT title, genre, price
FROM books b
WHERE price = (
    SELECT MAX(price)
    FROM books
    WHERE genre = b.genre
);
```

**Task:** Rewrite exercise 4c using a CTE and `RANK()`. Confirm both queries return identical results.

---

### Exercise 5 — Index & EXPLAIN

```sql
-- 5a. Run EXPLAIN before adding an index
EXPLAIN SELECT title, price
FROM books
WHERE genre = 'Literary'
ORDER BY price;

-- 5b. Add a composite index
CREATE INDEX idx_genre_price ON books(genre, price);

-- 5c. Run EXPLAIN again — compare key, rows, Extra columns
EXPLAIN SELECT title, price
FROM books
WHERE genre = 'Literary'
ORDER BY price;

-- 5d. Add a covering index that includes title
CREATE INDEX idx_genre_price_title ON books(genre, price, title);

EXPLAIN SELECT title, price
FROM books
WHERE genre = 'Literary'
ORDER BY price;
-- Extra column should now show "Using index" — no table lookup needed
```

**Task:** Document your findings in a table: index name | key_len | rows examined | Extra. Explain in one sentence why the covering index is faster.

---

## 10. Interview Q&A

These 15+ questions cover the topics most frequently asked in MySQL / SQL interviews for backend, data engineering, and DBA roles.

---

**Q1. What is the difference between `DELETE`, `TRUNCATE`, and `DROP`?**

| Command | Removes | WHERE clause | Rollback | Auto-increment reset | DDL/DML |
|---|---|---|---|---|---|
| DELETE | Rows (selectively) | Yes | Yes (inside transaction) | No | DML |
| TRUNCATE | All rows | No | No (in MySQL) | Yes | DDL |
| DROP | Entire table + structure | N/A | No | N/A | DDL |

**Key point:** `TRUNCATE` is faster than `DELETE` on large tables because it does not log individual row deletions — it deallocates the data pages directly. However, it cannot be rolled back in MySQL.

---

**Q2. What are ACID properties and how does InnoDB guarantee them?**

- **Atomicity** — A transaction is all-or-nothing. InnoDB uses the undo log: if a transaction fails, the undo log replays changes in reverse.
- **Consistency** — Constraints (FK, UNIQUE, CHECK) are enforced at commit time, keeping the database in a valid state.
- **Isolation** — Concurrent transactions are shielded from each other's partial changes via MVCC (Multi-Version Concurrency Control) and locking.
- **Durability** — Committed data survives crashes. InnoDB's redo log (write-ahead log) ensures changes are flushed to disk before the commit acknowledgement is returned.

---

**Q3. Explain the difference between a clustered and a non-clustered index.**

A **clustered index** determines the physical order of rows on disk. InnoDB always has exactly one clustered index — the primary key by default. The row data itself lives in the leaf nodes of the clustered B-tree.

A **non-clustered (secondary) index** is a separate B-tree whose leaf nodes store the indexed column(s) plus the primary key value as a row pointer. A lookup via a secondary index therefore requires two B-tree traversals: one to find the PK in the secondary index, and one to fetch the full row from the clustered index (a "double dip" or bookmark lookup).

---

**Q4. What is the N+1 query problem? How do you fix it?**

The N+1 problem occurs when you fetch 1 parent record and then issue N separate queries to fetch its children — one query per parent row. With 1,000 orders this becomes 1,001 queries.

**Fix:** Use a `JOIN` to fetch parent and children in one query, or use an `IN (...)` subquery to batch child lookups. In ORMs, use eager loading (`include`/`joinedload`).

---

**Q5. What is the difference between `HAVING` and `WHERE`?**

`WHERE` filters individual rows **before** aggregation. `HAVING` filters groups **after** aggregation.

```sql
-- WHERE: filter rows first, then group
SELECT genre, COUNT(*) AS cnt
FROM books
WHERE price > 10
GROUP BY genre;

-- HAVING: group first, then filter groups
SELECT genre, COUNT(*) AS cnt
FROM books
GROUP BY genre
HAVING cnt > 2;
```

You cannot reference aggregate functions in `WHERE` because aggregation has not yet occurred at that stage.

---

**Q6. What is a covering index?**

A covering index is an index that contains all the columns needed to satisfy a query — so MySQL can answer the query entirely from the index without touching the base table. `EXPLAIN` shows `Using index` in the `Extra` column when a covering index is used. This eliminates the "double dip" into the clustered index.

---

**Q7. Describe the four isolation levels and the anomalies each prevents.**

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|---|---|---|---|
| READ UNCOMMITTED | Possible | Possible | Possible |
| READ COMMITTED | Prevented | Possible | Possible |
| REPEATABLE READ | Prevented | Prevented | Possible* |
| SERIALIZABLE | Prevented | Prevented | Prevented |

*InnoDB's `REPEATABLE READ` prevents phantoms via gap locks and next-key locks, which is stronger than the SQL standard requires. MySQL's default isolation level is `REPEATABLE READ`.

---

**Q8. What is MVCC and why does it matter for concurrency?**

Multi-Version Concurrency Control maintains multiple versions of each row. When a transaction reads a row, InnoDB finds the version that was committed as of the transaction's start time using the undo log chain. This means **readers do not block writers and writers do not block readers** — a major throughput advantage over systems that use shared locks for reads.

---

**Q9. When would you use a composite index vs multiple single-column indexes?**

Use a **composite index** when queries frequently filter on or sort by multiple columns together. The leftmost-prefix rule applies: an index on `(a, b, c)` can serve queries filtering on `a`, `(a, b)`, or `(a, b, c)`, but not on `b` alone or `(b, c)` alone.

Use **multiple single-column indexes** when queries access each column independently with no consistent combination pattern. The optimiser can sometimes use Index Merge to combine two single-column indexes, but a well-designed composite index is almost always faster.

---

**Q10. What is a deadlock? How does MySQL handle it?**

A deadlock occurs when two transactions each hold a lock the other needs, creating a circular wait. MySQL's InnoDB detects deadlocks automatically using a wait-for graph. When a cycle is detected, InnoDB rolls back the transaction with the smallest undo log (cheapest to undo) and returns error 1213 to the application.

**Prevention strategies:**
- Always access tables and rows in the same order across transactions.
- Keep transactions short — acquire locks close to COMMIT.
- Use `SELECT ... FOR UPDATE` only when you will actually modify the row.

---

**Q11. What is the difference between a subquery and a CTE?**

A **subquery** (derived table or inline view) is embedded directly inside another SQL statement. Each reference to the same subquery causes it to be re-evaluated.

A **CTE** (`WITH` clause) is a named temporary result set defined once and referenced by name. MySQL materialises (or inlines) the CTE at the optimiser's discretion. CTEs improve readability, allow self-reference (recursive CTEs), and can be referenced multiple times without re-evaluation when materialised.

---

**Q12. Explain `EXPLAIN` output — what columns matter most?**

| Column | What to check |
|---|---|
| `type` | Best: `const`/`eq_ref`/`ref`. Worst: `ALL` (full table scan). |
| `key` | Which index (if any) is being used. NULL means no index. |
| `rows` | Estimated rows examined — lower is better. |
| `filtered` | % of rows estimated to pass the WHERE filter after index scan. |
| `Extra` | `Using filesort` / `Using temporary` are red flags. `Using index` is good. |

---

**Q13. What are window functions and when should you use them over GROUP BY?**

Window functions (`ROW_NUMBER`, `RANK`, `SUM() OVER`, `LAG`, `LEAD`) compute a value for each row based on a related set of rows (the "window") **without collapsing rows** the way `GROUP BY` does. Use them when you need both individual row data and an aggregate — for example, showing each employee's salary alongside the department average.

---

**Q14. What is normalisation and when do you intentionally denormalise?**

Normalisation is the process of structuring a schema to reduce data redundancy and improve data integrity (1NF → 2NF → 3NF → BCNF). 

You intentionally **denormalise** when read performance is critical and the data is read far more than it is written — e.g., a pre-aggregated reporting table that avoids repeated expensive joins. Data warehouses (star schema, snowflake schema) are intentionally denormalised for analytical query performance.

---

**Q15. What happens when you run `SELECT ... FOR UPDATE`?**

`SELECT ... FOR UPDATE` places an exclusive (write) lock on each row in the result set. Other transactions attempting to read those rows with `FOR UPDATE` or `LOCK IN SHARE MODE` will block until the first transaction commits or rolls back. Plain `SELECT` (without locking clauses) will still succeed using MVCC (it reads a snapshot). Use this pattern to implement "check-then-act" logic safely — e.g., checking and decrementing inventory inside a transaction.

---

**Q16. How does InnoDB handle a full-text search differently from a `LIKE '%word%'` query?**

`LIKE '%word%'` cannot use a standard B-tree index (leading wildcard) and requires a full table scan. InnoDB's full-text index maintains an inverted index mapping each word to the rows that contain it, enabling fast keyword searches with relevance scoring via `MATCH(col) AGAINST('word' IN NATURAL LANGUAGE MODE)`. For prefix searches (`LIKE 'word%'`), a regular B-tree index works fine.

---

## 11. Resources & Further Reading

### Official Documentation

```
├── MySQL 8.0 Reference Manual
│   └── https://dev.mysql.com/doc/refman/8.0/en/
├── MySQL Shell User Guide
│   └── https://dev.mysql.com/doc/mysql-shell/8.0/en/
└── InnoDB Internals
    └── https://dev.mysql.com/doc/refman/8.0/en/innodb-storage-engine.html
```

### Books

| Title | Author | Level |
|---|---|---|
| Learning MySQL | Seyed Tahaghoghi & Hugh Williams | Beginner |
| High Performance MySQL, 4th ed. | Silvia Botros & Jeremy Tinley | Intermediate–Advanced |
| MySQL Cookbook, 4th ed. | Paul DuBois | Intermediate |
| Database Internals | Alex Petrov | Advanced (theory) |
| Designing Data-Intensive Applications | Martin Kleppmann | Advanced (systems) |

### Practice Platforms

| Platform | URL | Notes |
|---|---|---|
| LeetCode Database | leetcode.com/problemset/database/ | Interview-style SQL problems |
| HackerRank SQL | hackerrank.com/domains/sql | Structured difficulty progression |
| SQLZoo | sqlzoo.net | Interactive, browser-based |
| Mode Analytics | mode.com/sql-tutorial/ | Business analytics focus |
| pgexercises.com | pgexercises.com | PostgreSQL (95% transferable) |

### Useful MySQL System Tables

```sql
-- All databases
SELECT schema_name FROM information_schema.schemata;

-- All tables in current database
SELECT table_name, table_rows, data_length
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY data_length DESC;

-- Index usage statistics (requires performance_schema)
SELECT object_schema, object_name, index_name,
       count_read, count_write
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema = DATABASE()
ORDER BY count_read DESC;
```

---

```
┌─────────────────────────────────────────────────────────────────────┐
│  Last updated: June 2026  |  Maintained by Ganesh Pirikirala        │
└─────────────────────────────────────────────────────────────────────┘
```
