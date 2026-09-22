# 02 — Foreign Data Wrappers (FDW) & Federated Queries

## Table of Contents
1. [What is SQL/MED and FDW?](#1-what-is-sqlmed-and-fdw)
2. [The `postgres_fdw` Extension](#2-the-postgres_fdw-extension)
3. [Step-by-Step Setup Walkthrough](#3-step-by-step-setup-walkthrough)
4. [Importing Remote Schemas](#4-importing-remote-schemas)
5. [Query Pushdown Optimization](#5-query-pushdown-optimization)
6. [Cross-Cluster Federated Joins](#6-cross-cluster-federated-joins)
7. [The FDW Ecosystem (`file_fdw`, `mysql_fdw`)](#7-the-fdw-ecosystem-file_fdw-mysql_fdw)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. What is SQL/MED and FDW?

**SQL/MED** (Management of External Data) is an official ANSI SQL standard allowing databases to integrate external data sources directly into standard SQL queries.

In PostgreSQL, this is implemented through **Foreign Data Wrappers (FDW)**. An FDW allows a local PostgreSQL database to query tables living on remote PostgreSQL servers, MySQL instances, CSV files, or Kafka streams as if they were local tables.

---

## 2. The `postgres_fdw` Extension

The built-in `postgres_fdw` module connects two PostgreSQL database clusters:

```
┌──────────────────────────┐                      ┌──────────────────────────┐
│   LOCAL POSTGRES SERVER  │                      │  REMOTE POSTGRES SERVER  │
│                          │                      │                          │
│  SELECT * FROM           │  PostgreSQL Protocol │  Physical Table:         │
│  foreign_users           │ ───────────────────► │  users (10M rows)        │
│  JOIN local_orders ...   │     (TCP 5432)       │                          │
└──────────────────────────┘                      └──────────────────────────┘
```

---

## 3. Step-by-Step Setup Walkthrough

### Step 1: Enable the Extension
```sql
CREATE EXTENSION IF NOT EXISTS postgres_fdw;
```

### Step 2: Define the Remote Foreign Server Connection
```sql
CREATE SERVER analytics_cluster
FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (
    host 'analytics-db.internal.cloud',
    port '5432',
    dbname 'warehouse',
    fetch_size '1000'
);
```

### Step 3: Map Local Users to Remote Credentials
```sql
CREATE USER MAPPING FOR vaultmaster
SERVER analytics_cluster
OPTIONS (
    user 'remote_reader',
    password 'SuperSecureWarehousePass2026!'
);
```

---

## 4. Importing Remote Schemas

Instead of declaring each foreign table column by column, import the entire remote schema in one command:

```sql
CREATE SCHEMA remote_warehouse;

-- Import all tables from the remote 'public' schema into local 'remote_warehouse':
IMPORT FOREIGN SCHEMA public
FROM SERVER analytics_cluster
INTO remote_warehouse;
```

Now you can query `remote_warehouse.events` just like any standard local table:
```sql
SELECT * FROM remote_warehouse.events WHERE event_type = 'CLICK' LIMIT 10;
```

---

## 5. Query Pushdown Optimization

The primary risk of federated queries is network saturation: if a remote table has 50 million rows, does PostgreSQL download all 50 million rows across the network just to execute a `WHERE id = 5` filter?

**No!** `postgres_fdw` implements intelligent **Query Pushdown**:
- **Predicate Pushdown:** `WHERE`, `LIMIT`, and `ORDER BY` clauses are sent across the wire and executed on the remote server.
- **Aggregate Pushdown (Postgres 10+):** `SUM()`, `AVG()`, and `GROUP BY` are computed on the remote cluster; only the summarized result is transferred.
- **Join Pushdown (Postgres 11+):** Joins between two foreign tables living on the same remote server are executed remotely.

```sql
EXPLAIN VERBOSE
SELECT event_type, COUNT(*) 
FROM remote_warehouse.events 
WHERE created_at >= '2026-01-01'
GROUP BY event_type;
```

### Output:
```
Foreign Scan:
  Remote SQL: SELECT event_type, count(*) FROM public.events 
              WHERE (created_at >= '2026-01-01') GROUP BY event_type
```
The entire aggregation ran remotely—only a handful of summary rows crossed the network!

---

## 6. Cross-Cluster Federated Joins

Join local operational transactional tables with historical foreign data seamlessly:

```sql
SELECT 
    u.email,
    u.full_name,
    COUNT(re.id) AS total_historical_events
FROM local_users u
JOIN remote_warehouse.events re ON u.id = re.user_id
WHERE u.tier = 'ENTERPRISE'
GROUP BY u.email, u.full_name;
```

---

## 7. The FDW Ecosystem (`file_fdw`, `mysql_fdw`)

- **`file_fdw`:** Directly query local CSV or TSV files on the database server as if they were SQL tables without importing them into heap memory.
- **`mysql_fdw`:** Connect and join directly against legacy MySQL / MariaDB databases.
- **`mongo_fdw`:** Query collections in MongoDB clusters via standard SQL.

---

## 8. Hands-On Exercises

1. Enable `postgres_fdw` in your database.
2. Create a foreign server pointing to localhost (or another database).
3. Create a user mapping.
4. Define a foreign table and verify that `EXPLAIN VERBOSE` shows predicate pushdown.

---

## 9. Summary & Key Takeaways

1. Foreign Data Wrappers implement the SQL/MED standard for cross-database querying.
2. `postgres_fdw` links disparate PostgreSQL instances over standard TCP connections.
3. `IMPORT FOREIGN SCHEMA` eliminates repetitive DDL declarations for remote tables.
4. **Query pushdown** ensures filters, sorting, and aggregations execute on the remote machine.
5. FDW enables unified enterprise reporting across legacy and distributed database stacks.
