# 01 — What is PostgreSQL?

## Table of Contents
1. [Introduction to PostgreSQL](#1-introduction-to-postgresql)
2. [Historical Evolution & Philosophy](#2-historical-evolution--philosophy)
3. [The Object-Relational Model Explained](#3-the-object-relational-model-explained)
4. [Key Architectural Pillars](#4-key-architectural-pillars)
5. [PostgreSQL vs MySQL vs Commercial RDBMS](#5-postgresql-vs-mysql-vs-commercial-rdbms)
6. [The Extensibility Engine](#6-the-extensibility-engine)
7. [Hands-On Verification Exercises](#7-hands-on-verification-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. Introduction to PostgreSQL

PostgreSQL (pronounced *post-gres-Q-L*, often abbreviated as simply **Postgres**) is an open-source, enterprise-class **Object-Relational Database Management System (ORDBMS)**. Known as the "world's most advanced relational database", it has earned a reputation over four decades for reliability, feature robustness, and strict standards compliance.

Unlike many databases that were built first as lightweight web storage engines and retrofitted with transactional rigor later, PostgreSQL was architected from inception to guarantee complete **ACID compliance** (Atomicity, Consistency, Isolation, Durability) under extreme concurrent workloads.

```
┌────────────────────────────────────────────────────────┐
│               PostgreSQL Core Philosophy               │
├────────────────────────────────────────────────────────┤
│  1. Correctness Over Speed: Data integrity is never     │
│     compromised for benchmark shortcuts.              │
│  2. Complete Extensibility: Users can add custom data  │
│     types, index access methods, and procedural logic. │
│  3. Strict Standards Compliance: Adheres to ANSI SQL   │
│     specifications (SQL:2023).                         │
│  4. True Open Source: Governed by the PostgreSQL Global│
│     Development Group under a liberal BSD-style licence│
└────────────────────────────────────────────────────────┘
```

---

## 2. Historical Evolution & Philosophy

The lineage of PostgreSQL traces directly to the pioneers of relational database theory:

1. **Ingres (1977–1985):** Developed at UC Berkeley by Michael Stonebraker. Proved the viability of relational systems alongside IBM's System R.
2. **POSTGRES (1986–1994):** Stonebraker led the POSTGRES project (standing for "Post-Ingres") to address limitations in the pure relational model, specifically introducing support for complex types, inheritance, rules, and procedures.
3. **Postgres95 (1995):** Andrew Yu and Jolly Chen replaced the PostQUEL query language with standard SQL and significantly overhauled the engine.
4. **PostgreSQL 6.0+ (1997–Present):** The project was released to the global open-source community as PostgreSQL. Major milestones include Write-Ahead Logging (WAL) in v7.1, Point-In-Time Recovery (PITR) in v8.0, Streaming Replication in v9.0, JSONB in v9.4, Declarative Partitioning in v10, Parallel Querying in v11, and vector embeddings support (`pgvector`) in modern releases.

---

## 3. The Object-Relational Model Explained

Standard relational databases treat columns strictly as scalar values (numbers, strings, dates). An **Object-Relational** database treats user data as extensible entities with behavior, complex inheritance, and nested domain types.

### How PostgreSQL Combines Both Worlds:
- **Custom Composite Types:** You can define a composite struct and store it directly in a table column:
  ```sql
  CREATE TYPE address_type AS (
      street VARCHAR(100),
      city VARCHAR(50),
      postal_code VARCHAR(20)
  );

  CREATE TABLE companies (
      id UUID PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      hq_address address_type
  );
  ```
- **Table Inheritance:** Tables can inherit columns and constraints from parent tables:
  ```sql
  CREATE TABLE vehicles (
      vin VARCHAR(17) PRIMARY KEY,
      manufacturer VARCHAR(50),
      production_year INT
  );

  CREATE TABLE electric_vehicles () INHERITS (vehicles);
  -- electric_vehicles has vin, manufacturer, and production_year automatically
  ```
- **Custom Operator Overloading:** You can define how custom types compare, sort, and calculate using mathematical and geometric operators.

---

## 4. Key Architectural Pillars

### 1. Multi-Version Concurrency Control (MVCC)
In PostgreSQL, reads never block writes, and writes never block reads. When an UPDATE occurs, PostgreSQL creates a new version of the row (tuple) while preserving the old version for concurrent transactions that began earlier.

### 2. Extensible Type & Indexing System
Postgres does not restrict you to B-Tree indexes. It provides:
- **B-Tree:** Default balanced tree for equality and range comparisons.
- **GIN (Generalized Inverted Index):** Indexing multi-value elements like JSONB keys and array elements.
- **GiST (Generalized Search Tree):** Custom geometric coordinates, IP ranges, and full-text vectors.
- **BRIN (Block Range Index):** Ultra-compact indexing for multi-gigabyte append-only time series.

### 3. Standards Compliance
PostgreSQL supports 170 of the 179 mandatory features required for full SQL:2023 compliance, including Window Functions, Common Table Expressions (Recursive CTEs), Check Constraints, and Lateral Joins.

---

## 5. PostgreSQL vs MySQL vs Commercial RDBMS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Architectural Matrix                              │
├─────────────────────┬───────────────────────┬───────────────────────────────┤
│ Dimension           │ PostgreSQL            │ MySQL 8                       │
├─────────────────────┼───────────────────────┼───────────────────────────────┤
│ Process Model       │ Multi-Process (fork)  │ Multi-Threaded                │
│ Concurrency Engine  │ MVCC with Heap Tuples │ MVCC with InnoDB Undo Logs    │
│ JSON Support        │ JSONB (Binary, GIN)   │ JSON (Binary format)          │
│ Query Planner       │ Genetic Algorithm,    │ Rule-based & cost-based,      │
│                     │ Parallel Join/Scan    │ limited parallel execution    │
│ Extensibility       │ C extensions, types   │ Plugin API, storage engines   │
│ Replication         │ Physical streaming &  │ Binlog-based row/statement    │
│                     │ Logical pub/sub       │ replication                   │
│ Open Source Licence │ PostgreSQL (BSD-like) │ GPL v2 (Oracle commercial)    │
└─────────────────────┴───────────────────────┴───────────────────────────────┘
```

---

## 6. The Extensibility Engine

Unlike traditional black-box databases, PostgreSQL allows developers to write extensions that run inside the server process with full access to internal hooks:

```sql
-- Enable cryptographic primitives
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generate a cryptographically secure UUID v4
SELECT gen_random_uuid();

-- Hash a plaintext password with bcrypt
SELECT crypt('SuperSecretPass123!', gen_salt('bf', 12));
```

Leading cloud platforms use this extensibility to transform PostgreSQL into specialized engines:
- **pgvector:** Fast approximate nearest neighbor (ANN) vector search for LLM embeddings.
- **PostGIS:** Industry-standard geospatial database engine.
- **TimescaleDB:** High-performance time-series data storage on top of PostgreSQL tables.

---

## 7. Hands-On Verification Exercises

Open your terminal or `psql` shell and execute the following checks to inspect your PostgreSQL server:

```sql
-- 1. Check PostgreSQL version and compile platform
SELECT version();

-- 2. Inspect active client connection info
SELECT 
    inet_client_addr() AS client_ip,
    inet_server_addr() AS server_ip,
    inet_server_port() AS server_port,
    current_database() AS db_name,
    current_user AS connected_user;

-- 3. View installed extensions
SELECT name, default_version, installed_version, comment 
FROM pg_available_extensions 
WHERE installed_version IS NOT NULL;
```

---

## 8. Summary & Key Takeaways

1. PostgreSQL is an **Object-Relational** database engine rooted in research excellence and rigorous ACID guarantees.
2. Its **MVCC engine** handles concurrent readers and writers without read locking.
3. PostgreSQL is an **extensible platform**: you can add custom types, functions, foreign data wrappers, and vector indexes.
4. It adheres strictly to ANSI SQL standards, making it the preferred choice for mission-critical enterprise systems.
