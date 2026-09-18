# Phase 01 — Fundamentals

> Build a rock-solid conceptual foundation before writing a single query.
> This phase answers "what is MongoDB, why does it exist, and how do I get it running?"

---

## Table of Contents

1. [Phase Objectives](#1-phase-objectives)
2. [Prerequisites](#2-prerequisites)
3. [Topics in This Phase](#3-topics-in-this-phase)
4. [Learning Sequence Diagram](#4-learning-sequence-diagram)
5. [Key Concepts at a Glance](#5-key-concepts-at-a-glance)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Phase Checklist](#7-phase-checklist)
8. [Interview Q&A — Fundamentals (15 Questions)](#8-interview-qa--fundamentals-15-questions)
9. [Navigation](#9-navigation)

---

## 1. Phase Objectives

By the end of Phase 01 you will be able to:

- [ ] Explain the difference between relational and document databases with concrete examples
- [ ] Describe MongoDB's internal data model: databases, collections, documents, fields, BSON
- [ ] Map SQL concepts (table, row, column, JOIN) to their MongoDB equivalents
- [ ] Install MongoDB Community 7.0 on macOS, Linux, or via Docker
- [ ] Connect to a MongoDB instance using `mongosh` and issue basic commands
- [ ] Install and use MongoDB Compass for visual data exploration
- [ ] Create a database, create a collection, and insert your first document
- [ ] Understand the purpose and structure of `_id` and `ObjectId`
- [ ] Describe the MongoDB ecosystem: Atlas, Compass, mongosh, drivers, Ops Manager

**These objectives map directly to the "Foundations" domain of the MongoDB C100DEV exam.**

---

## 2. Prerequisites

```text
┌─────────────────────────────────────────────────┐
│              PREREQUISITES FOR PHASE 01         │
├─────────────────────────────────────────────────┤
│  Hard Requirements                              │
│  ─────────────────────────────────────────────  │
│  ✓  Basic comfort with the terminal/CLI         │
│  ✓  Understand what a database is in general    │
│                                                 │
│  Helpful (but not required)                     │
│  ─────────────────────────────────────────────  │
│  ○  Some exposure to SQL (easier comparisons)   │
│  ○  Any JSON experience (REST APIs, config)     │
│  ○  Any programming language (JS, Python, etc.) │
│                                                 │
│  NOT Required                                   │
│  ─────────────────────────────────────────────  │
│  ✗  Prior NoSQL knowledge                       │
│  ✗  MongoDB experience                          │
│  ✗  Distributed systems theory                  │
└─────────────────────────────────────────────────┘
```

This is the first phase — there are no MongoDB prerequisites. Start here.

---

## 3. Topics in This Phase

### Topic File Index

| # | File                                              | Topics Covered                                                        | Est. Time |
|---|---------------------------------------------------|-----------------------------------------------------------------------|-----------|
| 1 | [01-What-is-MongoDB.md](./01-What-is-MongoDB.md)  | Document DB concept, BSON, collections, JSON vs BSON, MongoDB history, ecosystem overview, SQL-to-MongoDB mapping, use cases, CAP theorem intro | 3–4 hours |
| 2 | [02-Installation-Setup.md](./02-Installation-Setup.md) | Install MongoDB Community 7.0 (macOS/Linux/Docker), mongosh setup, Compass install, first database, `_id` and ObjectId deep dive, connection strings | 3–4 hours |

### What Each File Covers

```text
01-What-is-MongoDB.md
├── What is a document database?
├── JSON and BSON explained
├── MongoDB data hierarchy
│   ├── Database
│   ├── Collection (≈ Table)
│   ├── Document (≈ Row)
│   └── Field (≈ Column)
├── SQL → MongoDB concept mapping
├── MongoDB ecosystem overview
│   ├── mongod (server daemon)
│   ├── mongosh (shell)
│   ├── Compass (GUI)
│   ├── Atlas (cloud)
│   └── Drivers (Node, Python, Java, Go...)
├── When to use MongoDB vs SQL
├── Real-world companies using MongoDB
├── CAP theorem — where MongoDB sits
├── Hands-On Exercises (5)
└── Interview Q&A (15)

02-Installation-Setup.md
├── Install on macOS (Homebrew)
├── Install on Ubuntu/Debian
├── Install via Docker (recommended for dev)
├── mongosh — connect, basic commands
├── MongoDB Compass — install and tour
├── Creating your first database
├── Creating your first collection (explicit vs implicit)
├── Inserting your first document
├── Understanding _id and ObjectId
│   ├── ObjectId structure (12 bytes)
│   ├── Timestamp extraction
│   └── Custom _id values
├── Connection string anatomy
├── Hands-On Exercises (5)
└── Interview Q&A (10)
```

---

## 4. Learning Sequence Diagram

```text
                PHASE 01 LEARNING FLOW
                ══════════════════════

  ┌──────────────────────────────────────┐
  │   Start: No MongoDB knowledge        │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │   01-What-is-MongoDB.md              │
  │   ─────────────────────────────────  │
  │   Read the concepts (45 min)         │
  │   → Document DB vs Relational        │
  │   → BSON, collections, documents     │
  │   → MongoDB ecosystem map            │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │   Hands-On: Exercises 1–5            │
  │   (answer conceptual questions,      │
  │    draw data models on paper)        │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │   02-Installation-Setup.md           │
  │   ─────────────────────────────────  │
  │   Install MongoDB + mongosh          │
  │   Connect to your local instance     │
  │   Install Compass                    │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │   Hands-On: Exercises 1–5            │
  │   (create DB, insert documents,      │
  │    explore Compass, decode ObjectId) │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │   Review Interview Q&A               │
  │   Phase 01 Checklist (all ticked?)   │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────┐
  │   Phase 02 — CRUD Operations  ──►    │
  └──────────────────────────────────────┘
```

---

## 5. Key Concepts at a Glance

### The MongoDB Data Hierarchy

```text
MongoDB Instance (mongod)
└── Database: "ecommerce"
    ├── Collection: "users"
    │   ├── Document: { _id: ObjectId("..."), name: "Alice", age: 30 }
    │   ├── Document: { _id: ObjectId("..."), name: "Bob",  age: 25 }
    │   └── Document: { _id: ObjectId("..."), name: "Carol", age: 35,
    │                   address: { city: "Sydney", postcode: "2000" } }
    │
    ├── Collection: "products"
    │   ├── Document: { _id: ObjectId("..."), sku: "LAPTOP-001",
    │   │               price: 1299.99, tags: ["electronics", "computers"] }
    │   └── Document: { _id: ObjectId("..."), sku: "MOUSE-007",
    │                   price: 49.99, tags: ["electronics", "accessories"] }
    │
    └── Collection: "orders"
        └── Document: { _id: ObjectId("..."), customerId: ObjectId("..."),
                        items: [ { sku: "LAPTOP-001", qty: 1, price: 1299.99 } ],
                        total: 1299.99, status: "shipped" }
```

### SQL to MongoDB Terminology Mapping

| SQL Term          | MongoDB Term      | Notes                                            |
|-------------------|-------------------|--------------------------------------------------|
| Database          | Database          | Same concept                                     |
| Table             | Collection        | No fixed schema required                         |
| Row               | Document          | JSON/BSON object                                 |
| Column            | Field             | Not all documents need the same fields           |
| Primary Key       | `_id`             | Auto-generated as ObjectId if not provided       |
| Foreign Key       | Reference (DBRef) | Manual or via $lookup — no enforced constraints  |
| JOIN              | `$lookup`         | Aggregation stage; embedding preferred instead   |
| INDEX             | Index             | Same purpose; B-tree + specialised types         |
| VIEW              | View              | Read-only aggregation result, same concept       |
| Stored Procedure  | Aggregation / JS  | `$function` stage or Atlas Functions             |

### BSON Data Types

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ BSON Type       │ Example Value                                   │
├─────────────────┼────────────────────────────────────────────────┤
│ Double          │ 3.14                                            │
│ String          │ "hello"                                         │
│ Object          │ { key: "value" }                                │
│ Array           │ [1, 2, 3]                                       │
│ Binary Data     │ BinData(0, "...")  — for files, UUIDs           │
│ ObjectId        │ ObjectId("507f1f77bcf86cd799439011")            │
│ Boolean         │ true / false                                    │
│ Date            │ ISODate("2026-06-23T10:00:00Z")                 │
│ Null            │ null                                            │
│ Regular Expr.   │ /pattern/flags                                  │
│ 32-bit Integer  │ NumberInt(42)                                   │
│ 64-bit Integer  │ NumberLong(9007199254740992)                    │
│ Decimal128      │ NumberDecimal("9.99")  — precise financial data │
│ Timestamp       │ Timestamp(1, 1)  — internal replication use     │
│ Min/Max Key     │ MinKey() / MaxKey()  — shard range boundaries   │
└─────────────────┴────────────────────────────────────────────────┘
```

### ObjectId Structure

```text
ObjectId("507f1f77bcf86cd799439011")
          │         │     │   │
          └─────────┘     │   └── 3-byte random counter (process-local)
          4-byte Unix      │
          timestamp        └── 5-byte random value (machine+process)
          (seconds)

Extracting the timestamp:
  ObjectId("507f1f77bcf86cd799439011").getTimestamp()
  // ISODate("2012-10-15T21:26:47Z")
```

---

## 6. Hands-On Exercises

Complete these exercises after reading both topic files in this phase.

### Exercise 1 — Conceptual Mapping

Without looking at notes, draw the SQL-to-MongoDB mapping table from memory.
For each of the following SQL statements, write the equivalent MongoDB concept (not code — just the concept):

```sql
-- What MongoDB concept replaces each of these?
SELECT * FROM users;                          -- Collection scan
SELECT name, email FROM users WHERE age > 18; -- Projection + filter
INSERT INTO users (name, age) VALUES (...);   -- insertOne
CREATE INDEX idx_email ON users(email);       -- createIndex
SELECT * FROM orders JOIN users ON ...;       -- $lookup or embedding
```

Answer key is in `01-What-is-MongoDB.md` under "SQL to MongoDB Mapping".

### Exercise 2 — Design a Document

A relational database stores a blog with these tables:

```text
posts:    post_id, title, content, published_at, author_id
authors:  author_id, name, bio, email
tags:     tag_id, label
post_tags: post_id, tag_id
comments: comment_id, post_id, author_name, body, created_at
```

Redesign this as a MongoDB document. Write the JSON structure for a single blog post
document that embeds appropriate related data. Consider: what gets embedded vs referenced?

### Exercise 3 — Install and Connect

Follow `02-Installation-Setup.md` to:

1. Install MongoDB (Community 7.0) using your preferred method
2. Start the `mongod` server
3. Connect with `mongosh`
4. Run `db.runCommand({ ping: 1 })` and confirm you see `{ ok: 1 }`
5. Run `show dbs` and identify the three default system databases

```bash
# Expected output of show dbs:
admin    40.00 KiB
config   72.00 KiB
local    72.00 KiB
```

### Exercise 4 — First Document

In `mongosh`, create a database called `learning` and insert a document
representing yourself as a developer:

```js
use learning

db.developers.insertOne({
  name: "Your Name",
  skills: ["JavaScript", "Python"],   // use your own skills
  experience_years: 3,                // your number
  location: {
    city: "Sydney",
    country: "Australia"
  },
  learning_mongodb: true,
  started_at: new Date()
})
```

After inserting:
1. Run `db.developers.find().pretty()` and inspect the auto-generated `_id`
2. Extract the timestamp from the `_id` using `.getTimestamp()`
3. Open Compass and visually confirm the document is there

### Exercise 5 — ObjectId Deep Dive

```js
// Run this in mongosh and answer the questions below:
const id = ObjectId()

// Q1: What is the hex string representation?
id.toString()

// Q2: When was this ObjectId created?
id.getTimestamp()

// Q3: Are two ObjectIds ever identical? Generate 5 and compare:
[ObjectId(), ObjectId(), ObjectId(), ObjectId(), ObjectId()]
  .map(o => o.toString())

// Q4: Create a document with a custom _id (not auto-generated):
db.custom.insertOne({ _id: "user-alice-001", name: "Alice" })

// Q5: What happens if you try to insert another document
//     with the same custom _id?
db.custom.insertOne({ _id: "user-alice-001", name: "Duplicate" })
// Expected: WriteError — E11000 duplicate key error
```

---

## 7. Phase Checklist

Use this checklist before moving to Phase 02.

```text
PHASE 01 COMPLETION CHECKLIST
══════════════════════════════

Conceptual Understanding
  [ ] I can explain what a document database is without notes
  [ ] I can map SQL terms (table/row/column) to MongoDB equivalents
  [ ] I understand BSON and the most common data types
  [ ] I understand what ObjectId is and how its 12 bytes are structured
  [ ] I can explain the MongoDB data hierarchy (instance → DB → collection → doc)
  [ ] I know when to choose MongoDB over a relational database

Installation & Environment
  [ ] MongoDB Community 7.0 is installed and running on my machine
  [ ] I can connect to MongoDB using mongosh
  [ ] I have MongoDB Compass installed and can view databases
  [ ] I know the three default system databases (admin, config, local)

First Steps in mongosh
  [ ] I can create and switch databases with `use dbName`
  [ ] I can insert a document with insertOne()
  [ ] I can view documents with find()
  [ ] I can extract a timestamp from an ObjectId
  [ ] I have completed all 5 hands-on exercises

Ready for Phase 02?
  [ ] All items above are checked
  [ ] I've reviewed the Interview Q&A section below
  [ ] ──► Proceed to Phase 02 — CRUD Operations
```

---

## 8. Interview Q&A — Fundamentals (15 Questions)

These questions are commonly asked in MongoDB developer interviews and appear
in the C100DEV certification exam.

---

**Q1. What is MongoDB and how does it differ from a relational database?**

MongoDB is a document-oriented NoSQL database that stores data as BSON (Binary JSON)
documents in collections, rather than rows in tables. Key differences:
- Schema is flexible — documents in the same collection can have different fields
- Related data is often embedded in a single document rather than split across tables
- There are no JOINs in the traditional sense — use `$lookup` or embed data
- Horizontal scaling (sharding) is built in, whereas RDBMS typically scales vertically

---

**Q2. What is BSON and how does it differ from JSON?**

BSON (Binary JSON) is MongoDB's internal binary serialisation format. Differences:
- BSON is binary (compact storage, fast traversal); JSON is text
- BSON supports additional data types: ObjectId, Date, Binary, Decimal128, Int32, Int64
- JSON only supports string, number, boolean, null, array, and object
- BSON documents have a maximum size of 16MB
- When you write JSON in mongosh, the driver converts it to BSON before storing

---

**Q3. What is a collection in MongoDB? Does it require a schema?**

A collection is a grouping of BSON documents, analogous to a table in SQL. Collections
do NOT enforce a schema by default — any document can go into any collection. However:
- Schema validation rules can be added via `$jsonSchema` validators
- By convention, collections store documents of the same "type"
- Collections are created automatically on first insert (implicit creation)
- They can also be created explicitly with `db.createCollection()`

---

**Q4. What is _id in MongoDB? Is it required?**

`_id` is the primary key field of every MongoDB document. It is always required — if
you do not provide one, MongoDB auto-generates an `ObjectId`. Rules:
- `_id` must be unique within a collection
- It can be any BSON type (not just ObjectId) — common choices: ObjectId, String, UUID, Int
- A unique index on `_id` is always created automatically
- You cannot update the `_id` field after a document is inserted

---

**Q5. Explain the structure of an ObjectId.**

An ObjectId is a 12-byte value composed of:

```text
Bytes 0–3:  Unix timestamp (seconds since epoch) — allows sorting by insertion time
Bytes 4–8:  Random value unique to the machine and process (5 bytes)
Bytes 9–11: An incrementing counter, initialised to a random value (3 bytes)
```

This design ensures global uniqueness without a central coordinator, which is important
for distributed inserts across multiple application servers.

---

**Q6. What is the maximum document size in MongoDB?**

16 megabytes (16 MB). This limit exists to prevent queries from accidentally consuming
excessive RAM or network bandwidth. For large binary objects (images, videos, files),
use GridFS, which splits the data into 255KB chunks stored as separate documents.

---

**Q7. What are the three system databases in MongoDB?**

- `admin`: Administrative database. Users with roles here have cluster-wide access.
  Commands like `dropDatabase`, `shutdown` require auth against the admin database.
- `local`: Stores replication oplog and replica set configuration. Never replicated.
- `config`: Used by sharded clusters to store shard metadata, chunk ranges, balancer state.

---

**Q8. What is MongoDB Atlas?**

MongoDB Atlas is MongoDB's fully managed cloud database service. It runs on AWS, GCP,
and Azure. Atlas handles:
- Automated backups, monitoring, and alerts
- Replica set provisioning (minimum 3-node clusters)
- Atlas Search (full-text search powered by Apache Lucene)
- Atlas Data API (HTTP-based access without a driver)
- Atlas Triggers (serverless functions on DB events)
- Atlas Charts (native data visualisation)
- Free tier: M0 cluster, 512MB storage

---

**Q9. What is mongosh? How does it differ from the legacy mongo shell?**

`mongosh` is the modern MongoDB Shell, first released in MongoDB 5.0 as the default shell.
Differences from the legacy `mongo` shell:
- Written in Node.js (not C++); supports modern JavaScript (ES2020+, async/await)
- Better autocomplete and syntax highlighting
- Consistent API with the MongoDB Node.js driver
- The legacy `mongo` shell was deprecated in MongoDB 5.0 and removed in 6.0

---

**Q10. Name five MongoDB data types not found in standard JSON.**

1. **ObjectId** — 12-byte unique identifier
2. **Date** / **ISODate** — millisecond-precision timestamp
3. **Decimal128** — 128-bit IEEE decimal (precise monetary values)
4. **NumberLong** (Int64) — 64-bit integer (JSON numbers are double-precision float)
5. **BinData** — arbitrary binary data (e.g., encrypted fields, UUIDs, images)

Bonus: **Timestamp** (internal replication), **MinKey/MaxKey** (sharding bounds)

---

**Q11. What is the difference between embedding and referencing in MongoDB?**

**Embedding**: Store related data as a nested sub-document or array within the parent document.
- Pro: Single read retrieves all data (no JOIN), atomic updates to the entire document
- Con: Document size grows; duplication if the sub-document is shared

**Referencing**: Store the `_id` of related documents, like a foreign key in SQL.
- Pro: No duplication; works well for large or frequently-updated related data
- Con: Requires a second query or `$lookup` to resolve the reference

Rule of thumb: embed for data that is accessed together and "owned" by the parent.
Reference for data shared across many documents or that changes independently.

---

**Q12. What is the CAP theorem and where does MongoDB sit?**

CAP theorem states a distributed system can guarantee only two of three:
- **C**onsistency: every read returns the most recent write
- **A**vailability: every request receives a response (even if stale)
- **P**artition tolerance: system continues during network partitions

MongoDB is **CP by default** (Consistency + Partition tolerance).
- Primary-only reads ensure consistent data
- Read preference `secondaryPreferred` trades consistency for availability
- Write concern `w: "majority"` ensures durability before acknowledging writes

---

**Q13. How does MongoDB handle schema changes compared to SQL?**

SQL: Schema changes require DDL statements (`ALTER TABLE ADD COLUMN`). Depending on
the database and table size, this can lock the table and take minutes or hours.

MongoDB: No migration is needed. New fields can be added to individual documents
immediately. Old documents simply lack the new field — queries that reference it
return null or can use `$exists` to filter. When a consistent schema is needed,
use JSON Schema validation (`$jsonSchema`) on the collection.

---

**Q14. What MongoDB version introduced native multi-document ACID transactions?**

Multi-document ACID transactions were introduced in **MongoDB 4.0** (July 2018) for
replica sets, and extended to sharded clusters in **MongoDB 4.2**.
Prior to 4.0, atomicity was guaranteed only at the single-document level.
Single-document operations are still atomic in all versions.

---

**Q15. What is WiredTiger and why does it matter?**

WiredTiger is MongoDB's default storage engine since MongoDB 3.2. Key characteristics:
- Document-level concurrency control (multiple writes to the same collection do not block each other, only same-document writes)
- Compression: Snappy by default (reduces disk size ~70% vs uncompressed), optional zlib/zstd
- In-memory caching: defaults to 50% of RAM minus 1GB; configurable
- Journal-based crash recovery (write-ahead log)
- Replaced MMAPv1, which was removed in MongoDB 4.2

---

## 9. Navigation

```text
┌──────────────────────────────────────────────────────────────────┐
│                      PHASE 01 NAVIGATION                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Previous:  ← (none — this is Phase 01, the starting point)    │
│                                                                  │
│   Topics:                                                        │
│     01-What-is-MongoDB.md    What is MongoDB, BSON, ecosystem    │
│     02-Installation-Setup.md Install, mongosh, Compass, _id      │
│                                                                  │
│   Next:  Phase 02 — CRUD Operations →                           │
│          Phase-02-CRUD/README.md                                 │
│                                                                  │
│   Main Course README:  ../README.md                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Estimated Time for This Phase: 1 week (6–8 hours total)**

| Session       | Activity                                          | Time    |
|---------------|---------------------------------------------------|---------|
| Session 1     | Read 01-What-is-MongoDB.md                        | 1 hr    |
| Session 2     | Exercises 1 & 2 (conceptual + document design)    | 1 hr    |
| Session 3     | Read 02-Installation-Setup.md, install MongoDB    | 2 hrs   |
| Session 4     | Exercises 3, 4 & 5 (mongosh hands-on)             | 1.5 hrs |
| Session 5     | Review Q&A, complete checklist                    | 30 min  |

---

> Phase 01 of 12 | [Back to Main README](../README.md) | Next: [Phase 02 — CRUD Operations](../Phase-02-CRUD/README.md)
>
> Last updated: June 2026 | Maintained by Ganesh Pirikirala
