# 01 — What is MongoDB?

> A comprehensive reference covering MongoDB's core concepts, architecture, terminology, and practical usage.

---

## Table of Contents

1. [What is MongoDB](#1-what-is-mongodb)
2. [SQL vs NoSQL](#2-sql-vs-nosql)
3. [MongoDB Architecture](#3-mongodb-architecture)
4. [Core Terminology](#4-core-terminology)
5. [BSON Data Types](#5-bson-data-types)
6. [MongoDB Editions](#6-mongodb-editions)
7. [Use Cases](#7-use-cases)
8. [When NOT to Use MongoDB](#8-when-not-to-use-mongodb)
9. [mongosh Basics](#9-mongosh-basics)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is MongoDB

Let's start with the problem, not the product.

You're building an app. A "user" in your head isn't a flat row — it's a name, an email, an address, some tags, maybe a list of recent searches. In a relational database, that one mental object gets sawed apart into a `users` row, an `addresses` row, a `user_tags` row, all connected by foreign keys. To read "one user," you have to glue those pieces back together with JOINs, every single time.

MongoDB's pitch is simple: why saw the object apart in the first place? Just store it the way you think about it.

That's the whole idea behind **MongoDB** — an open-source, **document-oriented NoSQL database** built for flexibility, scalability, and developer speed. Instead of rows and columns, it stores data as **documents**: self-contained units of data that map naturally onto objects in your application code.

---

### 1.1 The Document Model

**Real-world analogy:** think of a document like a folder in a filing cabinet. Everything about "Alice" — her contact card, her address slip, her tags — sits in one folder labeled "Alice." You don't need to walk to three different cabinets to reconstruct who she is.

Technically, a MongoDB document is a JSON-like structure. Under the hood, MongoDB serialises it into **BSON** (Binary JSON) for efficient storage and retrieval — more on why in the next section.

```json
{
  "_id": "ObjectId(\"64b1f3c2e4b0a1234567890a\")",
  "name": "Alice Nguyen",
  "email": "alice@example.com",
  "age": 29,
  "address": {
    "street": "42 Harbour St",
    "city": "Sydney",
    "postcode": "2000"
  },
  "tags": ["developer", "mongodb", "nodejs"],
  "createdAt": "ISODate(\"2024-07-15T08:30:00Z\")"
}
```

A few things worth noticing:
- Documents are **self-describing** — no external schema file is required to understand the data.
- Fields can hold **nested documents** (`address`) and **arrays** (`tags`).
- Every document has a unique `_id` field (auto-generated as an `ObjectId` if omitted).
- Different documents in the same collection can have **different fields** (flexible schema).

That last point is the big one — and it's what makes the "filing cabinet" analogy hold. One folder can have a sticky note stapled to it that another folder doesn't. Nobody enforces that every folder looks identical.

---

### 1.2 JSON vs BSON

Here's a question worth asking: if documents look like JSON, why doesn't MongoDB just store JSON?

Because JSON is a *text* format — great for humans and for sending data over the wire, but slow to parse and light on data types (it doesn't even have a native `Date` or an efficient way to store binary data). A database that has to serve thousands of reads per second can't afford to re-parse a giant text blob every time. So MongoDB stores a binary-encoded cousin of JSON called **BSON**, which is faster to traverse and adds the extra types a real database needs.

| Feature         | JSON                          | BSON                                      |
|-----------------|-------------------------------|-------------------------------------------|
| Format          | Human-readable text           | Binary-encoded                            |
| Data types      | String, Number, Boolean, etc. | Richer — Date, ObjectId, Int32/64, etc.   |
| Storage size    | Larger (verbose)              | Smaller and faster to parse               |
| Usage           | Wire protocol / drivers       | On-disk storage                           |
| Traversal speed | Sequential text parse         | Random-access via length-prefixed fields  |

The "random-access via length-prefixed fields" row is the non-obvious part, so let's slow down on it.

**Internal working — how BSON actually gets read:**

```text
JSON field lookup                     BSON field lookup
------------------                    ------------------
{"a": 1, "b": "long string...", "c": 3}   [len][type|"a"][1][type|"b"][len]["long..."][type|"c"][3]
        |                                          |
        v                                          v
To find "c", the parser must          Each field has a length prefix,
read/skip character by                so the engine can jump straight
character through "a" and "b"         past "b" without reading its
first — it doesn't know how           bytes at all. It just skips
long "b" is until it hits             `len` bytes and lands on "c".
the closing quote.
```

That length-prefix trick is why BSON is described as supporting "random access" — the storage engine can skip whole fields without parsing their contents, which text JSON simply can't do.

The good news: you almost never touch raw BSON yourself. MongoDB drivers (Node.js, Python, Java, etc.) transparently convert your language's objects to BSON on the way in, and back again on the way out.

> **Memory hook:** "JSON is a handwritten letter — you read it start to finish. BSON is a book with a table of contents — you jump straight to the page you need."

---

### 1.3 The `mongod` Process

Every database needs something running in the background actually holding the data and answering requests — for MongoDB, that's `mongod`. Think of it as the actual employee working inside the filing cabinet office: it listens for people knocking (client connections), fetches folders (documents), and files new ones away.

`mongod` is the primary daemon process for MongoDB. It:

- Listens for client connections (default port **27017**)
- Manages data files on disk (WiredTiger storage engine by default)
- Handles read/write operations, indexing, and replication
- Enforces access control

```
┌──────────────────────────────────────────────────┐
│                  mongod process                  │
│                                                  │
│  ┌────────────┐   ┌──────────────┐               │
│  │  Network   │   │  WiredTiger  │               │
│  │  Layer     │──▶│  Storage     │               │
│  │ (port 27017│   │  Engine      │               │
│  └────────────┘   └──────────────┘               │
│                          │                       │
│                   ┌──────▼──────┐                │
│                   │  Data files │                │
│                   │  (.wt)      │                │
│                   └─────────────┘                │
└──────────────────────────────────────────────────┘
```

Starting `mongod` manually:

```bash
# Start with default config
mongod

# Start with custom config file
mongod --config /etc/mongod.conf

# Start on a custom port with a specific data directory
mongod --port 27018 --dbpath /data/mydb
```

---

## 2. SQL vs NoSQL

### 2.1 The Big Picture

Why does NoSQL even exist? Relational databases had already "won" by the 1970s and were the default for decades. But somewhere around the late 2000s, companies like Google, Amazon, and Facebook hit a wall: their data was growing faster than any single, vertically-scaled SQL server could handle, and their data didn't always fit neatly into normalised tables anyway. NoSQL — and MongoDB in particular — grew out of that pressure. It's not "SQL but worse," it's a different set of trade-offs optimised for scale and flexibility.

### 2.2 Comparison Table

| Dimension             | SQL (Relational)                            | NoSQL — MongoDB                               |
|-----------------------|-----------------------------------------------|-----------------------------------------------|
| Data model            | Tables, rows, columns                       | Collections, documents (JSON/BSON)            |
| Schema                | Fixed, enforced at DB level                 | Flexible, enforced at application level       |
| Relationships         | Foreign keys + JOINs                        | Embedded documents or `$lookup`               |
| Scalability           | Vertical (bigger server)                    | Horizontal (sharding across many servers)     |
| Transactions          | ACID by default, multi-table                | ACID within a document; multi-doc since v4.0  |
| Query language        | SQL (standardised)                          | MQL (MongoDB Query Language)                  |
| Joins                 | Native, efficient                           | `$lookup` (aggregation); prefer embedding     |
| Indexing              | B-tree indexes                              | B-tree + geospatial, text, hashed, wildcard   |
| Consistency model     | Strong consistency                          | Tunable (readConcern / writeConcern)          |
| Best fit              | Structured, relational data                 | Hierarchical, variable, rapidly changing data |
| Examples              | PostgreSQL, MySQL, Oracle, SQL Server       | MongoDB, Couchbase, DynamoDB                  |

### 2.3 When to Use SQL

- Your data is highly relational (many-to-many relationships with normalised tables)
- You need complex multi-table transactions guaranteed by ACID
- Compliance/regulatory requirements demand strict schema enforcement
- Heavy reporting with complex JOINs across many tables (data warehousing)
- Your team already has deep SQL expertise and the data model is stable

### 2.4 When to Use MongoDB

- Document-shaped data (orders with line items, user profiles with preferences)
- Schema changes frequently — you are iterating fast on a product
- Horizontal scaling is required (write throughput exceeds a single server's capacity)
- Hierarchical or nested data that would require many JOIN tables in SQL
- Real-time analytics, IoT event streams, content management

### 2.5 Real-World Analogy

Think of SQL as a **spreadsheet** — everything must fit into predefined columns and every row must have the same shape. MongoDB is more like a **filing cabinet of folders** — each folder (document) can contain whatever you need, and two folders do not need to look the same.

---

## 3. MongoDB Architecture

MongoDB can run as one lonely process on your laptop, or as a globe-spanning cluster serving millions of requests a second. The architecture section is really the story of *how you get from one to the other* — and each step exists to solve a specific pain the previous step couldn't.

### 3.1 Standalone

**The problem it solves:** none, really — this is the starting point, not a fix. It's just one `mongod` instance, nothing backing it up.

The simplest deployment: one `mongod` instance. Suitable for development only — no redundancy.

```
┌─────────────┐        ┌─────────────┐
│   Client    │───────▶│   mongod    │
│ (app/shell) │        │ (port 27017)│
└─────────────┘        └─────────────┘
```

If that one machine dies, your data is unavailable (or gone, if the disk is toast). Fine for a laptop, not fine for production.

---

### 3.2 Replica Set

**The problem it solves:** "what happens when the one server holding my data crashes at 3 a.m.?"

**Real-world analogy:** a replica set is like having an understudy in a play. The lead actor (primary) performs every night, but the understudy (secondary) has watched every rehearsal and knows the part cold. If the lead is suddenly unavailable, the understudy steps in — the show goes on without the audience needing to know anything went wrong.

A replica set provides **high availability** via automatic failover. One primary accepts writes; secondaries replicate asynchronously and can serve reads.

```
                  ┌──────────────────────────────┐
                  │        Replica Set            │
                  │                              │
┌─────────┐       │  ┌──────────┐                │
│ Client  │──────▶│  │ Primary  │◀── writes       │
└─────────┘       │  └────┬─────┘                │
                  │       │ replication           │
                  │  ┌────▼─────┐  ┌──────────┐  │
                  │  │Secondary │  │Secondary │  │
                  │  │  (read)  │  │ (standby)│  │
                  │  └──────────┘  └──────────┘  │
                  └──────────────────────────────┘
```

- Minimum 3 nodes recommended (1 primary + 2 secondaries)
- Automatic election occurs when the primary goes down
- Oplog (operations log) is the replication mechanism

**Internal working — what actually happens when the primary disappears:**

```text
Primary stops responding to heartbeats
        |
        v
Secondaries notice (missed heartbeats past a timeout)
        |
        v
Remaining nodes hold an election
        |
        v
A secondary with the most up-to-date data + majority votes
becomes the new primary
        |
        v
Clients' drivers detect the new topology and re-route
writes to the new primary automatically
```

**Common mistake:** assuming 2 nodes is "good enough" for high availability. With only 2 nodes, if one goes down there's no majority left to elect a new primary — the surviving node can't safely promote itself. That's why 3 (or an odd number, or 2 + an arbiter) is the recommended minimum.

**Interview answer:** "A replica set is a group of mongod instances holding the same data, with one primary accepting writes and secondaries replicating from it via the oplog. If the primary fails, the remaining nodes hold an automatic election and promote a new primary, usually within seconds, giving you high availability without manual intervention."

> **Memory hook:** "One lead actor, understudies waiting in the wings — the show never stops for the audience."

---

### 3.3 Sharded Cluster (Full Architecture)

**The problem it solves:** replica sets solve *availability*, but every node in a replica set still holds a full copy of *all* the data. What happens when your dataset is simply too big — or your write load too high — for any single machine to handle, no matter how beefy?

**Real-world analogy:** imagine one enormous library trying to hold every book ever published. At some point you stop building a bigger single library and instead open branch libraries across the city, each holding a slice of the collection, with a central directory telling visitors which branch has the book they want. That's sharding.

For massive horizontal scaling, MongoDB uses **sharding** — distributing data across multiple replica sets called shards.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Sharded Cluster                               │
│                                                                      │
│  ┌────────────┐     ┌─────────────────────────────────────────────┐ │
│  │  Clients   │────▶│          mongos (Query Router)              │ │
│  │ (apps)     │     │  Routes queries to correct shard(s)        │ │
│  └────────────┘     └──────────┬──────────────────────────────────┘ │
│                                │                                     │
│              ┌─────────────────┼─────────────────┐                  │
│              │                 │                 │                  │
│              ▼                 ▼                 ▼                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ Config Servers│  │    Shard 1    │  │       Shard 2         │   │
│  │ (replica set) │  │ (replica set) │  │   (replica set)       │   │
│  │               │  │               │  │                       │   │
│  │ ┌───────────┐ │  │ ┌───────────┐ │  │ ┌───────────────────┐ │   │
│  │ │  Primary  │ │  │ │  Primary  │ │  │ │     Primary       │ │   │
│  │ └───────────┘ │  │ └─────┬─────┘ │  │ └────────┬──────────┘ │   │
│  │ ┌───────────┐ │  │ ┌─────▼─────┐ │  │ ┌────────▼──────────┐ │   │
│  │ │ Secondary │ │  │ │ Secondary │ │  │ │    Secondary      │ │   │
│  │ └───────────┘ │  │ └─────┬─────┘ │  │ └────────┬──────────┘ │   │
│  │ ┌───────────┐ │  │ ┌─────▼─────┐ │  │ ┌────────▼──────────┐ │   │
│  │ │ Secondary │ │  │ │ Secondary │ │  │ │    Secondary      │ │   │
│  │ └───────────┘ │  │ └───────────┘ │  │ └───────────────────┘ │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
│    Stores cluster        Data partitioned by shard key ranges        │
│    metadata                                                          │
└──────────────────────────────────────────────────────────────────────┘
```

**Component roles:**

| Component       | Role                                                                 |
|-----------------|------------------------------------------------------------------------|
| `mongos`        | Query router — receives client queries, routes to correct shard(s)  |
| Config servers  | Store metadata: which chunks live on which shard                     |
| Shards          | Actual data storage; each shard is its own replica set               |
| Shard key       | The field used to partition data across shards (e.g., `userId`)     |
| Chunks          | Contiguous ranges of shard key values, moved between shards          |

Notice each "shard" in the diagram is itself a full replica set — sharding and replication aren't alternatives, they stack on top of each other. Sharding solves "too much data/traffic for one machine"; replication (inside each shard) solves "what if that one machine dies."

**Common mistake:** picking a shard key casually (say, an incrementing timestamp). If every new write's shard key value is always "the highest one so far," every insert lands on the *same* shard — the exact bottleneck sharding was supposed to eliminate. A good shard key has high cardinality and spreads writes evenly.

**Interview answer:** "Sharding is MongoDB's horizontal scaling mechanism. Data is partitioned across multiple shards — each its own replica set — based on a shard key. A `mongos` router sits in front, directing each query to the shard(s) that hold the relevant data, while config servers track which chunks of the key range live on which shard. You reach for sharding when a single replica set can no longer handle the write throughput or dataset size, and choosing a shard key with high cardinality and even write distribution is the make-or-break decision."

> **Memory hook:** "One library got too big — open branch libraries, and hire a librarian at the front desk who knows which branch has your book."

---

### 3.4 WiredTiger Storage Engine

**The problem it solves:** somebody has to actually take documents in memory and turn them into bytes on disk, safely, even if the power cuts out mid-write. That's the storage engine's job.

MongoDB has used WiredTiger as its default storage engine since v3.2.

```
Write path:
┌───────────┐    ┌─────────────────┐    ┌──────────────┐
│ Write op  │───▶│  Journal (WAL)  │───▶│  Data files  │
│           │    │  (durability)   │    │  (.wt files) │
└───────────┘    └─────────────────┘    └──────────────┘

Key features:
├── Document-level concurrency control (locks per document, not collection)
├── Compression (snappy by default, zlib/zstd available)
├── In-memory cache (50% of RAM - 1 GB by default)
└── Checkpoints every 60 seconds (or 2 GB of journal data)
```

**Internal working — why the journal comes before the data files:** if MongoDB wrote straight to the data files and the process died halfway through updating a B-tree page, you could be left with a half-written, corrupted structure. Instead, the write is appended to the journal first (a simple, sequential, append-only log — cheap and fast to make durable), acknowledged, and only *then* applied to the actual data files during a checkpoint. If the process crashes between checkpoints, MongoDB just replays the journal on restart to catch up.

**Common mistake:** thinking "document-level concurrency" means "collection-level locking." It's finer-grained than that — two threads can update two different documents in the same collection at the same time without blocking each other, which is a big part of why WiredTiger scales so much better than the old MMAPv1 engine it replaced.

**Interview answer:** "WiredTiger is MongoDB's default storage engine since 3.2. It gives document-level concurrency control instead of collection-level locking, compresses data on disk (snappy by default), keeps a configurable in-memory cache of hot pages, and uses a write-ahead journal so that a crash between checkpoints can be recovered from by replaying the journal rather than losing data."

> **Memory hook:** "Write it in your notebook (journal) before you carve it in stone (data files) — if you're interrupted, you still have the notebook."

---

## 4. Core Terminology

If architecture is the "how it runs" story, terminology is just a translation dictionary — mapping words you already know from SQL onto MongoDB's vocabulary so the rest of this course doesn't feel foreign.

### 4.1 SQL to MongoDB Mapping

| SQL Concept      | MongoDB Equivalent | Notes                                                    |
|------------------|--------------------|------------------------------------------------------------|
| Database         | Database           | Same concept — a namespace containing collections        |
| Table            | Collection         | No fixed schema; documents in a collection can vary      |
| Row              | Document           | A BSON object with key-value pairs                       |
| Column           | Field              | A key in a document; each document controls its own fields|
| Primary Key      | `_id` field        | Auto-generated ObjectId unless you supply one            |
| Foreign Key      | Reference (manual) | No enforced FK constraints; references stored as values  |
| JOIN             | `$lookup`          | Aggregation pipeline stage; embedding is usually preferred|
| Index            | Index              | Same concept; MongoDB adds geospatial, text, wildcard    |
| View             | View               | Read-only views via `db.createView()`                    |
| Stored Procedure | JavaScript in Shell| Limited; application-side logic preferred                |
| Transaction      | Multi-doc transaction| Available since MongoDB 4.0 across replica sets        |
| Schema           | Validator (optional)| Enforced via `$jsonSchema` in collection validators     |

### 4.2 Structural Hierarchy

Zooming out, here's how those pieces nest inside each other:

```
MongoDB Server (mongod)
│
├── Database: "ecommerce"
│   ├── Collection: "users"
│   │   ├── Document: { _id: ObjectId(...), name: "Alice", ... }
│   │   ├── Document: { _id: ObjectId(...), name: "Bob", ... }
│   │   └── Document: { _id: ObjectId(...), name: "Carol", ... }
│   │
│   ├── Collection: "orders"
│   │   ├── Document: { _id: ObjectId(...), userId: ObjectId(...), total: 129.99 }
│   │   └── Document: { _id: ObjectId(...), userId: ObjectId(...), total: 45.00 }
│   │
│   └── Collection: "products"
│       └── ...
│
└── Database: "analytics"
    └── Collection: "events"
        └── ...
```

### 4.3 ObjectId

**The problem it solves:** every document needs a unique ID, and in a distributed system you can't just have a single counter ticking up (which server owns the counter? what if two servers insert at the same instant?). You need IDs that are unique *without* anyone coordinating.

MongoDB's answer is the `ObjectId` — a 12-byte value that's clever enough to be globally unique without a central authority:

```
ObjectId("64b1f3c2e4b0a1234567890a")

Breakdown:
┌──────────────┬──────────┬───────────────┬────────────┐
│  Timestamp   │ Machine  │   Process ID  │  Counter   │
│  (4 bytes)   │ (3 bytes)│   (2 bytes)   │  (3 bytes) │
│  Unix epoch  │ hash     │               │ random inc │
└──────────────┴──────────┴───────────────┴────────────┘
```

Notice how it's built: a timestamp, a machine fingerprint, a process ID, and a counter, all glued together. Two different machines generating IDs at the same millisecond still won't collide, because their machine/process bytes differ. It's the same trick as a passport number encoding a country and issuing office — the "where it came from" is baked into the ID itself.

This design means ObjectIds are:
- **Sortable by creation time** (the first 4 bytes are a timestamp)
- **Globally unique** without a central coordinator
- **Compact** — 12 bytes vs a UUID's 16 bytes

> **Memory hook:** "An ObjectId is a mini passport — timestamp, issuing machine, and a serial number baked right into the ID, so nobody needs to call home to check for duplicates."

---

## 5. BSON Data Types

We already met BSON in Section 1.2 as "the binary format MongoDB actually stores." Now let's look at what extra types it buys you over plain JSON — because JSON alone doesn't even have a real `Date` type, which is a problem the moment you're running a production database.

| BSON Type       | Type Number | Example Value                                    | Notes                                   |
|-----------------|-------------|----------------------------------------------------|-----------------------------------------|
| Double          | 1           | `3.14`                                           | 64-bit IEEE 754 float                   |
| String          | 2           | `"hello world"`                                  | UTF-8 encoded                           |
| Object          | 3           | `{ "city": "Sydney" }`                           | Embedded document                       |
| Array           | 4           | `["a", "b", "c"]`                                | Ordered list                            |
| Binary data     | 5           | `BinData(0, "c2hlbGw=")`                         | Raw bytes (images, files)               |
| ObjectId        | 7           | `ObjectId("64b1f3c2e4b0a1234567890a")`           | 12-byte unique identifier               |
| Boolean         | 8           | `true` / `false`                                 |                                         |
| Date            | 9           | `ISODate("2024-07-15T08:30:00Z")`                | Milliseconds since Unix epoch           |
| Null            | 10          | `null`                                           | Absence of a value                      |
| Regular Expr.   | 11          | `/^alice/i`                                      | PCRE regex                              |
| 32-bit Integer  | 16          | `NumberInt(42)`                                  | Exact integer (no float imprecision)    |
| Timestamp       | 17          | `Timestamp(1689408600, 1)`                       | Internal replication use; prefer Date   |
| 64-bit Integer  | 18          | `NumberLong("9007199254740993")`                 | Large integers beyond JS safe int       |
| Decimal128      | 19          | `NumberDecimal("19.99")`                         | High-precision decimal (financial data) |
| Min Key         | -1          | `MinKey()`                                       | Sorts before all other values           |
| Max Key         | 127         | `MaxKey()`                                       | Sorts after all other values            |

### 5.1 Type Gotchas

Here's a trap that catches people early on: JavaScript (and JSON) only has one number type — a 64-bit float. That's fine for most things, but terrible for money, where "close enough" isn't good enough.

```js
// JavaScript numbers are all 64-bit floats — this can lose precision
db.products.insertOne({ price: 19.99 })           // stored as Double

// Use Decimal128 for financial data
db.products.insertOne({ price: NumberDecimal("19.99") })  // exact

// Use NumberLong for IDs beyond 2^53
db.events.insertOne({ externalId: NumberLong("9007199254740993") })
```

**Common mistake:** storing prices or account balances as plain doubles because "it looked fine in testing." Floating-point rounding errors compound over thousands of transactions — always reach for `NumberDecimal` (Decimal128) for financial data.

> **Memory hook:** "A Double is a photo of a number — close enough to look right. Decimal128 is the number itself, exact down to the last cent."

---

## 6. MongoDB Editions

### 6.1 Feature Comparison

Not every deployment needs the same thing — a side project doesn't need LDAP authentication, and a bank probably doesn't want to hand-roll its own sharded cluster. MongoDB ships in three flavours to match:

| Feature                         | Community Edition | Enterprise Edition | MongoDB Atlas (DBaaS) |
|----------------------------------|--------------------|---------------------|-------------------------|
| Price                           | Free (SSPL)       | Paid               | Pay-as-you-go         |
| Core CRUD & Aggregation         | Yes               | Yes                | Yes                   |
| Replica sets                    | Yes               | Yes                | Yes (managed)         |
| Sharding                        | Yes               | Yes                | Yes (managed)         |
| In-memory storage engine        | No                | Yes                | No                    |
| LDAP authentication             | No                | Yes                | Yes                   |
| Kerberos authentication         | No                | Yes                | No                    |
| Encrypted storage engine        | No                | Yes                | Yes (always-on)       |
| Audit logging                   | No                | Yes                | Yes                   |
| Ops Manager / Cloud Manager     | No                | Yes                | Managed internally    |
| Automated backups               | Manual            | Ops Manager        | Yes (point-in-time)   |
| Atlas Search (full-text)        | No                | No                  | Yes (Lucene-powered)  |
| Atlas Vector Search             | No                | No                  | Yes                   |
| Atlas Data Federation           | No                | No                  | Yes                   |
| Online Archive                  | No                | No                  | Yes                   |
| Global clusters (multi-region)  | Manual            | Manual              | Yes (GUI-driven)      |
| Performance Advisor             | No                | No                  | Yes                   |
| Schema Advisor                  | No                | No                  | Yes                   |

### 6.2 Which to Choose?

```
Decision tree:
│
├─ Learning / side projects? ──────────────────▶ Community Edition (free, local)
│
├─ Production, self-hosted, need LDAP/audit? ──▶ Enterprise Edition
│
└─ Production, want managed infra? ────────────▶ MongoDB Atlas
    │
    ├─ Small team / startup? ──▶ Atlas Serverless or M10 shared
    ├─ Growing product?      ──▶ Atlas Dedicated (M30+)
    └─ Large enterprise?    ──▶ Atlas Enterprise / private endpoints
```

---

## 7. Use Cases

### 7.1 Where MongoDB Excels

#### Product Catalogs and E-commerce

Here's the pain: products vary wildly in attributes. A T-shirt has `size` and `color`; a laptop has `RAM`, `CPU`, `screen_size`. In SQL you would need an EAV (Entity-Attribute-Value) anti-pattern or a separate table per category — both awkward. In MongoDB, each product document just carries exactly the fields relevant to it.

```json
{
  "_id": "ObjectId(...)",
  "name": "MacBook Pro 14",
  "category": "laptops",
  "price": 2499.00,
  "specs": {
    "cpu": "Apple M3 Pro",
    "ram_gb": 18,
    "storage_tb": 0.5,
    "display_inches": 14.2
  }
}
```

#### User Profiles

User profiles grow over time — preferences, activity history, social connections, notification settings. Embedding related data avoids expensive JOINs.

```json
{
  "_id": "ObjectId(...)",
  "username": "alice_ng",
  "preferences": {
    "theme": "dark",
    "notifications": { "email": true, "push": false }
  },
  "recentSearches": ["mongodb tutorial", "nodejs best practices"],
  "achievements": [
    { "name": "First Login", "earnedAt": "ISODate(...)" }
  ]
}
```

#### Content Management Systems (CMS)

Articles, pages, and media objects all have different schemas. MongoDB lets editors add custom metadata fields without a database migration.

#### IoT and Time-Series Data

MongoDB 5.0+ has native **time-series collections** optimised for sensor readings and metrics, with automatic bucketing for efficient storage and queries.

```js
db.createCollection("sensorReadings", {
  timeseries: {
    timeField: "timestamp",
    metaField: "sensorId",
    granularity: "seconds"
  }
})
```

#### Real-Time Analytics Dashboards

The aggregation pipeline (`$group`, `$bucket`, `$facet`) enables complex analytical queries directly on operational data, without an ETL pipeline.

#### Mobile and Gaming Applications

Leaderboards, player state, achievements, and session data are all document-shaped and benefit from MongoDB's flexible schema and low-latency reads.

### 7.2 Industry Examples

| Industry    | Use Case                                    | Why MongoDB                                      |
|-------------|-----------------------------------------------|----------------------------------------------------|
| E-commerce  | Product catalog, orders, recommendations    | Variable product attributes, embedded line items |
| Healthcare  | Patient records, clinical notes             | Variable fields per condition, HIPAA compliance  |
| Media       | Article CMS, user comments, tags            | Flexible content models                          |
| Financial   | Trade confirmations, account snapshots      | Document = natural audit record                  |
| Gaming      | Player profiles, leaderboards, game state   | Low-latency writes, flexible schemas             |
| Logistics   | Parcel tracking, route optimisation         | Geospatial indexes, nested location data         |
| SaaS        | Multi-tenant configuration, audit trails    | Per-tenant schema variations                     |

---

## 8. When NOT to Use MongoDB

Every tool has a shape it's good at, and MongoDB is no exception. If you find yourself fighting the document model constantly, that's a signal — not a reason to force it, but a reason to check whether a relational database fits your actual problem better.

### 8.1 Complex Multi-Table Transactions

While MongoDB 4.0+ supports multi-document ACID transactions, they come with performance overhead. If your entire data model is relational — with many interleaved tables that need atomic updates — a relational database is a better fit.

```
Example: Double-entry bookkeeping
  DEBIT accounts SET balance = balance - 100 WHERE id = 1;
  CREDIT accounts SET balance = balance + 100 WHERE id = 2;

In SQL: One transaction, two rows — trivial and fast.
In MongoDB: Two documents, transaction overhead, or denormalise (difficult for accounting).
```

### 8.2 Strict Schema Enforcement

MongoDB's schema validation is optional and less mature than SQL DDL. If you need guaranteed column types, NOT NULL constraints, CHECK constraints, and foreign key integrity enforced at the database layer, a relational database provides stronger guarantees.

### 8.3 Complex Reporting and Aggregations Across Many Entities

If you have dozens of normalised tables with complex JOIN hierarchies for BI/reporting, SQL (especially with a columnar database like Redshift or BigQuery) will outperform MongoDB significantly. MongoDB's `$lookup` is powerful but not optimised for multi-table star-schema queries.

### 8.4 When NOT to Use (Summary)

| Scenario                                      | Better Choice                         |
|-------------------------------------------------|------------------------------------------|
| Complex relational data, many JOINs           | PostgreSQL, MySQL                     |
| Financial double-entry ledger                 | PostgreSQL with strong ACID           |
| Heavy BI / analytical queries on normalised data | Redshift, BigQuery, Snowflake      |
| Strict regulatory schema (e.g., HIPAA tables) | Oracle, SQL Server with audit tools   |
| Graph traversals (social networks, fraud)     | Neo4j, Amazon Neptune                 |
| Simple key-value cache                        | Redis, Memcached                      |
| Full-text search as primary feature           | Elasticsearch (or Atlas Search)       |

---

## 9. mongosh Basics

`mongosh` is the modern MongoDB Shell, replacing the legacy `mongo` shell. Think of it as your day-to-day steering wheel for the database — everything below is stuff you'll type dozens of times a day once you're working with MongoDB regularly.

### 9.1 Connecting

```bash
# Connect to local instance (default port 27017)
mongosh

# Connect to a specific host and port
mongosh "mongodb://localhost:27017"

# Connect to Atlas cluster
mongosh "mongodb+srv://cluster0.abcde.mongodb.net/mydb" --username myUser

# Connect with authentication
mongosh --username admin --password secret --authenticationDatabase admin
```

### 9.2 Database Navigation

```js
// List all databases
show dbs

// Switch to (or create) a database
use ecommerce

// Show current database
db

// Drop current database
db.dropDatabase()
```

### 9.3 Collection Operations

```js
// List collections in current database
show collections

// Create a collection explicitly
db.createCollection("products")

// Create a collection with validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email"],
      properties: {
        name: { bsonType: "string" },
        email: { bsonType: "string", pattern: "^.+@.+\\..+$" }
      }
    }
  }
})

// Drop a collection
db.products.drop()
```

### 9.4 Useful Status Commands

```js
// Database statistics
db.stats()

// Collection statistics
db.users.stats()

// Server status (connections, memory, operations)
db.serverStatus()

// Current operations
db.currentOp()

// List indexes on a collection
db.users.getIndexes()

// Explain a query (shows index usage)
db.users.find({ email: "alice@example.com" }).explain("executionStats")
```

### 9.5 Basic CRUD in mongosh

```js
// INSERT
db.users.insertOne({ name: "Alice", email: "alice@example.com", age: 29 })
db.users.insertMany([
  { name: "Bob", email: "bob@example.com", age: 34 },
  { name: "Carol", email: "carol@example.com", age: 27 }
])

// READ
db.users.find()                              // all documents
db.users.find({ age: { $gt: 28 } })         // filtered
db.users.findOne({ email: "alice@example.com" })  // first match
db.users.find().sort({ age: -1 }).limit(5)  // sorted, limited

// UPDATE
db.users.updateOne(
  { email: "alice@example.com" },
  { $set: { age: 30 } }
)
db.users.updateMany(
  { age: { $lt: 30 } },
  { $set: { tier: "junior" } }
)

// DELETE
db.users.deleteOne({ email: "carol@example.com" })
db.users.deleteMany({ tier: "junior" })
```

### 9.6 Helpful Shell Tips

```js
// Pretty-print results
db.users.find().pretty()

// Count documents
db.users.countDocuments({ age: { $gt: 25 } })

// Distinct values
db.users.distinct("city")

// mongosh shorthand — it() iterates to next batch of results
it

// Load an external JS file
load("/path/to/script.js")
```

---

## 10. Hands-On Exercises

### Exercise 1 — Explore a Fresh MongoDB Instance

**Goal:** Get comfortable navigating mongosh and understanding the default state of a MongoDB server.

**Steps:**

```bash
# Start mongosh
mongosh
```

```js
// 1. List all databases — observe the built-in admin, config, local DBs
show dbs

// 2. Check the current database
db

// 3. Switch to a new database (it won't appear in show dbs until data is inserted)
use exercise_db

// 4. Insert a document to materialise the database
db.test.insertOne({ hello: "world", createdAt: new Date() })

// 5. Verify it now appears
show dbs

// 6. Check stats
db.stats()
```

**Expected outcome:** You should see `exercise_db` appear after the insert, with `db.stats()` showing 1 collection and 1 document.

---

### Exercise 2 — Model a Product Catalog

**Goal:** Practice the document model by designing and inserting varied product documents.

```js
use product_catalog

// Insert a clothing item
db.products.insertOne({
  name: "Classic White Tee",
  category: "clothing",
  price: 29.99,
  variants: [
    { size: "S", color: "white", stock: 15 },
    { size: "M", color: "white", stock: 20 },
    { size: "L", color: "white", stock: 8 }
  ],
  tags: ["casual", "cotton", "unisex"]
})

// Insert an electronics item (different shape — no variants, different specs)
db.products.insertOne({
  name: "Wireless Mouse",
  category: "electronics",
  price: 49.95,
  specs: {
    connectivity: "Bluetooth 5.0",
    battery_life_months: 12,
    dpi: 1600
  },
  inStock: true,
  tags: ["peripheral", "wireless"]
})

// Query: find all products under $50
db.products.find({ price: { $lt: 50 } })

// Query: find electronics only
db.products.find({ category: "electronics" })

// Query: find products with "wireless" tag
db.products.find({ tags: "wireless" })
```

**Observation:** Notice how both documents coexist in the same collection despite having completely different fields — this is MongoDB's flexible schema in action.

---

### Exercise 3 — Compare SQL and MongoDB Approaches

**Goal:** Translate a SQL mental model to MongoDB.

Imagine a SQL schema:

```sql
CREATE TABLE users (
  id       INT PRIMARY KEY AUTO_INCREMENT,
  name     VARCHAR(100),
  email    VARCHAR(100) UNIQUE
);

CREATE TABLE addresses (
  id      INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT REFERENCES users(id),
  street  VARCHAR(200),
  city    VARCHAR(100)
);

SELECT u.name, a.city
FROM users u
JOIN addresses a ON u.id = a.user_id
WHERE u.email = 'alice@example.com';
```

Now model this in MongoDB (embedding approach — no JOIN needed):

```js
use sql_vs_mongo

// MongoDB: embed the address inside the user document
db.users.insertOne({
  name: "Alice Nguyen",
  email: "alice@example.com",
  address: {
    street: "42 Harbour St",
    city: "Sydney"
  }
})

// Query: no JOIN required — the data is already together
db.users.findOne(
  { email: "alice@example.com" },
  { name: 1, "address.city": 1 }
)
```

**Reflection question:** When would you NOT embed and instead use a reference (separate collection)?

Answer: when the sub-document is large, frequently updated independently, or shared across many parent documents.

---

### Exercise 4 — BSON Types in Practice

**Goal:** Experience the difference between BSON types and learn why they matter.

```js
use bson_types

// Insert a document with multiple BSON types
db.observations.insertOne({
  sensor_id: "SENSOR-001",
  timestamp: new Date(),                  // ISODate — proper Date type
  temperature: 22.5,                      // Double
  humidity: NumberInt(65),                // 32-bit integer
  pressure_pa: NumberLong("101325"),      // 64-bit integer
  price_usd: NumberDecimal("19.99"),      // Exact decimal
  is_active: true,                        // Boolean
  metadata: null,                         // Null
  raw_bytes: new BinData(0, "AAEC")       // Binary
})

// Check what was stored
db.observations.findOne()

// Date comparison query (works because timestamp is a proper Date)
db.observations.find({
  timestamp: { $gte: new Date("2024-01-01") }
})

// Demonstrate float imprecision vs Decimal128
db.observations.insertOne({ label: "float_test", val: 0.1 + 0.2 })
db.observations.insertOne({ label: "decimal_test", val: NumberDecimal("0.3") })
db.observations.find({}, { label: 1, val: 1 })
```

**Observation:** The `float_test` document will show `0.30000000000000004`; the `decimal_test` will show `0.3` exactly.

---

### Exercise 5 — Explore Server Stats and Explain Plans

**Goal:** Learn operational commands to understand what MongoDB is doing under the hood.

```js
use ecommerce

// Insert sample data
db.orders.insertMany([
  { customerId: 1, total: 99.99,  status: "shipped",   createdAt: new Date("2024-01-10") },
  { customerId: 2, total: 249.00, status: "pending",   createdAt: new Date("2024-02-15") },
  { customerId: 1, total: 45.50,  status: "delivered", createdAt: new Date("2024-03-01") },
  { customerId: 3, total: 12.00,  status: "shipped",   createdAt: new Date("2024-03-20") }
])

// Step 1: Run a query and explain it (will show COLLSCAN — full collection scan)
db.orders.find({ customerId: 1 }).explain("executionStats")
// Look for: "stage": "COLLSCAN" — no index used

// Step 2: Create an index
db.orders.createIndex({ customerId: 1 })

// Step 3: Run the same query again
db.orders.find({ customerId: 1 }).explain("executionStats")
// Look for: "stage": "IXSCAN" — index is now used

// Step 4: View all indexes
db.orders.getIndexes()

// Step 5: Collection stats
db.orders.stats()
```

**Key takeaway:** Always check `explain()` before and after adding indexes. A `COLLSCAN` on a large collection is a performance problem; an `IXSCAN` is what you want.

---

## 11. Interview Q&A

### Q1. What is MongoDB and how does it differ from a relational database?

**Answer:** MongoDB is a document-oriented NoSQL database that stores data as BSON documents (JSON-like objects) in collections rather than rows in tables. The key differences are: (1) **Schema flexibility** — documents in the same collection can have different fields; (2) **Data model** — related data is embedded in one document rather than spread across normalised tables requiring JOINs; (3) **Scalability** — MongoDB is designed for horizontal scaling via sharding, while most RDBMS scale vertically; (4) **Query language** — MongoDB uses MQL (and the aggregation pipeline) rather than SQL. MongoDB does support ACID transactions since v4.0, but they carry overhead compared to in-document atomicity.

---

### Q2. What is BSON and why does MongoDB use it instead of JSON?

**Answer:** BSON (Binary JSON) is a binary-encoded serialisation format that extends JSON with additional data types (Date, ObjectId, Int32, Int64, Decimal128, BinData, etc.) and metadata (length prefixes for efficient traversal). MongoDB uses BSON because: (1) it is more space-efficient than text JSON; (2) it supports types critical for a database (especially `Date` and precise numerics); (3) length-prefixed fields allow the storage engine to skip over fields without parsing them, enabling fast random access; (4) it serialises and deserialises faster than text JSON parsing.

---

### Q3. What is the `_id` field in MongoDB?

**Answer:** Every MongoDB document must have an `_id` field that acts as the primary key. If you do not supply one, the driver auto-generates a 12-byte `ObjectId`. An `ObjectId` encodes a 4-byte Unix timestamp, a 3-byte machine identifier, a 2-byte process ID, and a 3-byte incrementing counter. This design guarantees global uniqueness without a central coordinator and makes ObjectIds naturally sortable by insertion time. You can override `_id` with any unique value (a UUID, an integer, a compound document), but you are responsible for ensuring uniqueness.

---

### Q4. Explain the difference between embedding and referencing in MongoDB.

**Answer:** **Embedding** means storing related data as a nested sub-document or array within the parent document (denormalised). **Referencing** means storing the `_id` of a related document in another collection (similar to a foreign key).

Use **embedding** when: data is always accessed together; the embedded data has a bounded size; the relationship is one-to-one or one-to-few; you want to read/write atomically in one operation.

Use **referencing** when: the sub-document is large and frequently updated independently; data is shared by many parent documents; you need to avoid document size limits (16 MB BSON limit); the relationship is many-to-many.

---

### Q5. What is a replica set and why is it important?

**Answer:** A replica set is a group of `mongod` instances that maintain the same dataset. One node is the **primary** (accepts all writes), and the others are **secondaries** (replicate from the primary via the oplog). If the primary becomes unavailable, an automatic election selects a new primary within seconds. Replica sets provide: (1) **High availability** via automatic failover; (2) **Data redundancy** (copies of data on multiple machines); (3) **Read scaling** by directing reads to secondaries; (4) **Zero-downtime maintenance** (step down primary, maintain, re-add). A minimum of 3 nodes (1 primary + 2 secondaries, or 2 + 1 arbiter) is recommended to ensure a majority quorum.

---

### Q6. What is sharding and when would you use it?

**Answer:** Sharding is MongoDB's method of horizontal scaling — distributing data across multiple replica sets (shards). Each shard holds a subset of the data determined by a **shard key**. A `mongos` router receives client queries and routes them to the relevant shard(s). Config servers store the cluster's metadata (chunk ranges). You would use sharding when: write throughput exceeds a single replica set's capacity; the working dataset exceeds available RAM and storage on a single server; you need geographic data distribution for latency reasons. Choosing a good shard key is critical — it should have high cardinality, avoid monotonic patterns, and align with query patterns.

---

### Q7. What are the ACID properties and how does MongoDB support them?

**Answer:** ACID stands for Atomicity, Consistency, Isolation, Durability. In MongoDB: **Atomicity** — all operations on a single document are atomic by default; since v4.0, multi-document transactions are also atomic. **Consistency** — write concerns and read concerns let you tune the consistency level (e.g., `writeConcern: "majority"` ensures a write is replicated to a majority of nodes before acknowledging). **Isolation** — MongoDB uses document-level locking with WiredTiger; transactions use snapshot isolation. **Durability** — the journal (write-ahead log) ensures committed writes survive crashes; `j: true` in writeConcern confirms journal flush.

---

### Q8. What is the aggregation pipeline?

**Answer:** The aggregation pipeline is MongoDB's primary data transformation framework. It processes documents through a sequence of **stages**, where each stage transforms the input and passes results to the next stage. Common stages include: `$match` (filter), `$group` (group and aggregate), `$project` (reshape), `$sort`, `$limit`, `$skip`, `$lookup` (JOIN), `$unwind` (flatten arrays), `$addFields`, `$bucket`, `$facet`. It is more powerful than simple `find()` queries and replaces the deprecated MapReduce framework.

```js
db.orders.aggregate([
  { $match: { status: "shipped" } },
  { $group: { _id: "$customerId", totalSpent: { $sum: "$total" } } },
  { $sort: { totalSpent: -1 } },
  { $limit: 10 }
])
```

---

### Q9. What is an index in MongoDB and what types are available?

**Answer:** An index is a data structure (B-tree by default) that stores a small portion of the collection's data in an easy-to-traverse form, enabling efficient queries without scanning every document. MongoDB supports: **Single field** (`{ age: 1 }`); **Compound** (`{ lastName: 1, firstName: 1 }`); **Multikey** (automatically created when indexing array fields); **Text** (full-text search on string fields); **Geospatial** (`2dsphere` for GeoJSON, `2d` for legacy coordinates); **Hashed** (used for hash-based sharding); **Wildcard** (`{ "$**": 1 }` — indexes all fields in a document); **Sparse** (only indexes documents that have the indexed field); **TTL** (automatically expires documents after a time period); **Partial** (indexes only documents matching a filter expression).

---

### Q10. How does MongoDB handle schema validation?

**Answer:** MongoDB's flexible schema does not enforce structure by default, but you can add **schema validation** using `$jsonSchema` (or legacy operators like `$type`, `$regex`). Validation rules are set at the collection level via `db.createCollection()` or `db.runCommand({ collMod: ... })`. You can set `validationLevel` to `"strict"` (all inserts and updates must pass) or `"moderate"` (only new inserts and updates to valid documents must pass). `validationAction` can be `"error"` (reject invalid ops) or `"warn"` (log but allow). This is useful for enforcing required fields and data types without the rigidity of a fixed SQL schema.

---

### Q11. What is the WiredTiger storage engine?

**Answer:** WiredTiger is MongoDB's default storage engine since v3.2. Key features: (1) **Document-level concurrency** — WiredTiger uses MVCC (Multi-Version Concurrency Control), allowing concurrent reads and writes at the document level without collection-level locks; (2) **Compression** — snappy by default (fast, moderate compression); zlib and zstd available for higher compression ratios; (3) **In-memory cache** — configurable (defaults to 50% of RAM minus 1 GB); data is served from cache for hot reads; (4) **Checkpoints** — WiredTiger writes a consistent snapshot to disk every 60 seconds; the journal (WAL) handles durability between checkpoints; (5) **Journaling** — records every write operation before applying it, enabling crash recovery.

---

### Q12. What is the difference between `find()` and `aggregate()`?

**Answer:** `find()` is used for straightforward queries — filtering, projecting, sorting, limiting documents from a single collection. It is optimised for simplicity and low overhead. `aggregate()` executes a **pipeline** of stages and is used for complex data transformations: grouping, joining collections (`$lookup`), computing new fields, bucketing data, and multi-stage filtering. Performance-wise, `find()` is slightly faster for simple queries. For anything beyond basic filtering/projection, `aggregate()` is more powerful. In fact, `find()` is internally implemented as a single `$match` + `$project` aggregation in newer MongoDB versions.

---

### Q13. Explain write concern and read concern.

**Answer:** **Write concern** controls the acknowledgment level for write operations. `w: 1` (default) — acknowledged by the primary. `w: "majority"` — acknowledged by a majority of replica set members (durable if the primary fails). `w: 0` — fire and forget (no acknowledgment). `j: true` — requires journal flush before acknowledgment. **Read concern** controls the consistency level of read operations. `local` — returns data from the local node (may not be majority-committed). `majority` — returns only data acknowledged by a majority of nodes. `linearizable` — strongest guarantee; reads reflect all majority-committed writes before the read started. `snapshot` — used in transactions; reads a consistent snapshot. Choose `writeConcern: "majority"` and `readConcern: "majority"` for the strongest durability guarantees at the cost of latency.

---

### Q14. How do you model a one-to-many relationship in MongoDB?

**Answer:** There are two primary patterns:

**Option A — Embed (one-to-few):** Store the "many" side as an array inside the "one" document. Best when the array is bounded, always accessed with the parent, and not too large.

```json
{ "_id": 1, "name": "Alice", "orders": [{ "total": 99 }, { "total": 45 }] }
```

**Option B — Reference (one-to-many or one-to-squillions):** Store the parent's `_id` in each child document and use `$lookup` when you need to join them. Best when the "many" side is large, updated independently, or shared across parents.

```json
// users collection: { "_id": 1, "name": "Alice" }
// orders collection: { "_id": 101, "userId": 1, "total": 99 }
```

The rule of thumb: **embed** when data is accessed together; **reference** when data is accessed independently.

---

### Q15. What is the MongoDB aggregation `$lookup` stage and how does it compare to a SQL JOIN?

**Answer:** `$lookup` performs a left outer join between the input documents and a foreign collection. It adds an array field to each input document containing matching documents from the foreign collection.

```js
db.orders.aggregate([
  {
    $lookup: {
      from: "users",           // foreign collection
      localField: "userId",    // field in orders
      foreignField: "_id",     // field in users
      as: "userDetails"        // output array field name
    }
  }
])
```

Compared to SQL JOIN: `$lookup` always produces a **left outer join**; the joined data is returned as a **nested array** (not flat rows); it does not support the full range of SQL JOIN types natively (though `$lookup` with pipeline syntax can simulate complex conditions). Performance is generally inferior to SQL JOINs on heavily normalised data because MongoDB is optimised for denormalised document access. In practice, if you find yourself using `$lookup` frequently, consider whether embedding would better serve your access pattern.

---

*End of 01-What-is-MongoDB.md*
