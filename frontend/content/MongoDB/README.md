# Complete MongoDB Learning Course — From Zero to MongoDB Expert

> Master MongoDB from fundamentals to production-grade architectures. Aggregation pipelines, replica sets, sharding, indexing strategies, transactions, and real-world project patterns — all in one structured course.

---

## Table of Contents

1. [Why MongoDB?](#1-why-mongodb)
2. [How to Use This Course](#2-how-to-use-this-course)
3. [Learning Path — 12 Phases](#3-learning-path--12-phases)
4. [Visual Learning Flow](#4-visual-learning-flow)
5. [Projects Table](#5-projects-table)
6. [Certification Path](#6-certification-path)
7. [Getting Started](#7-getting-started)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)
10. [Repository Structure](#10-repository-structure)

---

## 1. Why MongoDB?

### The Problem with Traditional Databases

Relational databases were designed in the 1970s when storage was expensive and data structures were predictable. In the modern world:

- **Data shapes change frequently** — product catalogs have different fields per category
- **Nested relationships** are natural in application code (JSON objects) but painful in SQL (JOIN hell)
- **Scale requirements** explode overnight — a viral app needs horizontal scale, not a bigger server
- **Development velocity** matters — teams need to iterate without ALTER TABLE migrations

### MongoDB is the Answer

```text
┌─────────────────────────────────────────────────────────────┐
│                    Why MongoDB Wins                          │
├──────────────────────┬──────────────────────────────────────┤
│  Relational (SQL)    │  MongoDB (Document DB)               │
├──────────────────────┼──────────────────────────────────────┤
│  Rows & Columns      │  Documents (JSON/BSON)               │
│  Rigid Schema        │  Flexible / Dynamic Schema           │
│  Vertical Scaling    │  Horizontal Scaling (Sharding)       │
│  JOIN-heavy queries  │  Embedded documents = no JOINs       │
│  ALTER TABLE pains   │  Schema evolves with your app        │
│  ORM mapping layers  │  Native JSON — speak app language    │
└──────────────────────┴──────────────────────────────────────┘
```

### Four Core Pillars

#### Pillar 1 — Document Database

MongoDB stores data as **BSON documents** (Binary JSON). A "row" in SQL becomes a rich, nested document:

```json
{
  "_id": "ObjectId('64a7f3c2b1e2d3a4f5c6b7d8')",
  "name": "Ganesh Pirikirala",
  "email": "ganesh@example.com",
  "address": {
    "city": "Sydney",
    "state": "NSW",
    "postcode": "2000"
  },
  "skills": ["MongoDB", "Python", "AWS"],
  "projects": [
    { "name": "E-Commerce API", "status": "production" },
    { "name": "Analytics Dashboard", "status": "development" }
  ],
  "createdAt": "ISODate('2026-06-01T00:00:00Z')"
}
```

> Real-world analogy: Think of a MongoDB document like a physical file folder. You can put anything inside — photos, contracts, sticky notes. SQL is like a spreadsheet where every row must have the same columns.

#### Pillar 2 — Flexible Schema

In MongoDB, documents in the same collection can have **different fields**. This is not chaos — it is intentional design:

```js
// Product catalog — different fields per category
db.products.insertMany([
  { name: "T-Shirt", size: "M", color: "Blue", material: "Cotton" },
  { name: "Laptop", ram: "16GB", storage: "512GB SSD", cpu: "M3 Pro" },
  { name: "Coffee", weight: "500g", roast: "Medium", origin: "Ethiopia" }
])
```

No schema migration. No ALTER TABLE. Just insert and query.

#### Pillar 3 — Horizontal Scale via Sharding

MongoDB scales **out** (more machines) rather than **up** (bigger machine):

```text
                    ┌──────────────┐
                    │    mongos    │  ← Query Router
                    │   (router)   │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Shard 1   │ │   Shard 2   │ │   Shard 3   │
    │  users A-G  │ │  users H-P  │ │  users Q-Z  │
    └─────────────┘ └─────────────┘ └─────────────┘
```

Each shard is itself a replica set. You can add shards as data grows — no downtime required.

#### Pillar 4 — JSON-Native

Your application speaks JSON. MongoDB speaks JSON. No translation layer needed:

```js
// Express.js — data flows from client to DB without transformation
app.post('/users', async (req, res) => {
  const user = req.body;                                // JSON from client
  await db.collection('users').insertOne(user);         // JSON to MongoDB
  res.json(user);                                       // JSON back to client
});
```

Compare to SQL: parse JSON → map to ORM model → generate SQL → parse result set → serialize back to JSON. MongoDB removes three of those five steps.

### When to Choose MongoDB

| Use MongoDB When | Consider SQL When |
|-----------------|-------------------|
| Schema evolves frequently | Complex multi-table transactions |
| Hierarchical / nested data | Strict ACID across many entity types |
| High write throughput needed | Reporting / BI on structured data |
| Horizontal scale is a requirement | Complex many-to-many relationships |
| Geospatial or full-text search | Team is deeply familiar with SQL |
| Content management, product catalogs | Financial ledgers requiring strict audit |
| Real-time analytics pipelines | Joins dominate your access patterns |
| IoT / time-series data at scale | Row-level security is a hard requirement |

---

## 2. How to Use This Course

### Recommended Approach

```text
┌────────────────────────────────────────────────────────────┐
│                  Course Usage Strategy                      │
│                                                            │
│  1. Read theory section first (understand the WHY)         │
│  2. Run all code examples in mongosh or Compass            │
│  3. Complete hands-on exercises before moving forward      │
│  4. Build mini-projects to reinforce each phase            │
│  5. Return to earlier phases — concepts compound           │
└────────────────────────────────────────────────────────────┘
```

### Tools Required

| Tool | Purpose | Install |
|------|---------|---------|
| MongoDB Community Server 7.x | Local database engine | mongodb.com/try/download |
| mongosh | Modern MongoDB shell (replaces mongo) | Bundled with server |
| MongoDB Compass | GUI for exploration and pipelines | mongodb.com/products/compass |
| MongoDB Atlas | Free cloud cluster (M0 tier) | mongodb.com/atlas |
| Node.js 18+ | JavaScript driver examples | nodejs.org |
| Python 3.10+ | PyMongo driver examples | python.org |

### Study Schedule Options

| Learning Style | Daily Time | Total Duration |
|----------------|-----------|----------------|
| Full-time intensive | 3–4 hours/day | 8–10 weeks |
| Part-time (recommended) | 1–2 hours/day | 18–22 weeks |
| Weekend warrior | 4–6 hours/weekend | 24–30 weeks |

---

## 3. Learning Path — 12 Phases

| # | Phase | Folder | Topics Covered | Est. Time |
|---|-------|--------|----------------|-----------|
| 01 | **Fundamentals** | `Phase-01-Fundamentals/` | Installation, mongosh, BSON types, Compass, first queries | 1 week |
| 02 | **CRUD Operations** | `Phase-02-CRUD/` | insertOne/Many, find, updateOne/Many, deleteOne/Many, upsert | 1.5 weeks |
| 03 | **Schema Design** | `Phase-03-Schema-Design/` | Embedding vs referencing, one-to-many, many-to-many, anti-patterns | 2 weeks |
| 04 | **Query Operators** | `Phase-04-Query-Operators/` | $eq, $in, $regex, $elemMatch, $expr, $where, array operators | 1.5 weeks |
| 05 | **Aggregation Pipeline** | `Phase-05-Aggregation/` | $match, $group, $project, $lookup, $unwind, $facet, $bucket | 2.5 weeks |
| 06 | **Indexes** | `Phase-06-Indexes/` | Single, compound, multikey, text, geospatial, TTL, explain(), ESR rule | 2 weeks |
| 07 | **Transactions** | `Phase-07-Transactions/` | ACID, multi-document transactions, sessions, write/read concerns | 1 week |
| 08 | **Performance Tuning** | `Phase-08-Performance/` | Query profiler, explain plans, WiredTiger, connection pooling | 1.5 weeks |
| 09 | **Replication** | `Phase-09-Replication/` | Replica sets, elections, oplog, read preferences, failover | 1.5 weeks |
| 10 | **Sharding** | `Phase-10-Sharding/` | Shard keys, hashed vs ranged, balancer, mongos, chunk management | 2 weeks |
| 11 | **Security** | `Phase-11-Security/` | SCRAM auth, x.509, RBAC, field-level encryption, TLS, audit | 1 week |
| 12 | **Atlas & Cloud** | `Phase-12-Atlas-Cloud/` | Atlas tiers, Atlas Search, Vector Search, Triggers, Charts, Data API | 1.5 weeks |

**Total estimated time: 18–22 weeks** (studying 1–2 hours per day)

---

## 4. Visual Learning Flow

### Phase Progression Diagram

```text
                        MONGODB LEARNING PATH
                        ═════════════════════

┌─────────────────────────────────────────────────────────────┐
│                    START HERE                               │
│              Phase 01 — Fundamentals                        │
│         What is MongoDB · Install · mongosh                 │
│                     1 week                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Phase 02 — CRUD Operations                     │
│    insertOne · find · updateMany · deleteOne                │
│                    1.5 weeks                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│             Phase 03 — Schema Design                        │
│    Embedding vs Referencing · Data Modelling                │
│    One-to-Many · Many-to-Many · Anti-patterns               │
│                     2 weeks                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            Phase 04 — Query Operators                       │
│   Comparison · Logical · Array · Element · Regex            │
│                    1.5 weeks                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          Phase 05 — Aggregation Framework                   │
│   $match · $group · $lookup · $unwind · $facet              │
│   $bucket · $graphLookup · $merge · $out                    │
│                    2.5 weeks                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┴──────────────┐
          ▼                            ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  Phase 06 — Indexes  │    │ Phase 07 — Transactions  │
│  Single · Compound   │    │  Multi-doc ACID · WC/RC  │
│  Text · Geo · TTL    │    │  Sessions · Retryable    │
│      2 weeks         │    │        1 week            │
└──────────┬───────────┘    └────────────┬─────────────┘
           │                             │
           └──────────────┬──────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Phase 08 — Performance Tuning                     │
│    explain() · Query Profiler · WiredTiger cache            │
│    Connection pooling · Slow query log                      │
│                    1.5 weeks                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┴──────────────┐
          ▼                            ▼
┌──────────────────────┐    ┌──────────────────────────┐
│ Phase 09 — Replica   │    │  Phase 10 — Sharding     │
│ Sets & Replication   │    │  Shard Keys · Chunks     │
│ Elections · HA       │    │  Balancer · mongos       │
│      1.5 weeks       │    │        2 weeks           │
└──────────┬───────────┘    └────────────┬─────────────┘
           │                             │
           └──────────────┬──────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                Phase 11 — Security                          │
│    Authentication · RBAC · TLS · Field Encryption           │
│    Auditing · Network Isolation                             │
│                     1 week                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│             Phase 12 — Atlas & Cloud                        │
│    Atlas Tiers · Atlas Search · Data API                    │
│    Triggers · Charts · Stream Processing                    │
│                    1.5 weeks                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              BUILD PROJECTS & CERTIFY                       │
│         Beginner → Intermediate → Advanced                  │
│     C100DEV (Developer) → C100DBA (Administrator)           │
└─────────────────────────────────────────────────────────────┘
```

### Document Model Concept Map

```text
  ┌──────────────────────────────────────────────────┐
  │               MongoDB Concepts                   │
  │                                                  │
  │  Database                                        │
  │    └── Collection  (analogous to SQL table)      │
  │          └── Document  (analogous to SQL row)    │
  │                └── Field  (analogous to column)  │
  │                      └── Value                   │
  │                            ├── Scalar            │
  │                            │     (string, int,   │
  │                            │      bool, date)    │
  │                            ├── Array             │
  │                            │     ["a", "b", "c"] │
  │                            └── Subdocument       │
  │                                  { key: value }  │
  └──────────────────────────────────────────────────┘
```

### Aggregation Pipeline — How Data Flows

```text
  Input         Stage 1       Stage 2       Stage 3       Output
  ┌───────┐    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌───────┐
  │ 1000  │───►│ $match  │──►│ $group  │──►│$project │──►│  5    │
  │ docs  │    │ filter  │   │ reduce  │   │ reshape │   │ docs  │
  └───────┘    └─────────┘   └─────────┘   └─────────┘   └───────┘
                 850 docs       12 docs       12 docs

  Each stage transforms the document stream.
  Stages are composable — add, remove, or reorder freely.
```

---

## 5. Projects Table

### Beginner Projects (Phases 01–04)

| # | Project | Description | Key Skills | Est. Time |
|---|---------|-------------|-----------|-----------|
| B1 | **Personal Task Manager** | CLI to create, list, update, and delete tasks stored in MongoDB | CRUD, date fields, basic filters | 3–4 days |
| B2 | **Recipe Book API** | Store recipes with nested ingredient arrays, search by ingredient | Arrays, $elemMatch, text search | 4–5 days |
| B3 | **Blog CMS** | Posts with embedded comments, tags array, pagination | Embedded docs, $push, $slice | 5–7 days |
| B4 | **Student Grade Tracker** | Students, courses, grade records; calculate averages per student | Aggregation basics, $avg, $sum | 3–4 days |
| B5 | **Product Catalog** | Multi-category catalog with different fields per category | Flexible schema, $exists, $type | 4–5 days |

### Intermediate Projects (Phases 05–08)

| # | Project | Description | Key Skills | Est. Time |
|---|---------|-------------|-----------|-----------|
| I1 | **E-Commerce REST API** | Cart, orders, inventory with full CRUD and basic analytics | Aggregation, indexes, Express.js | 2–3 weeks |
| I2 | **Social Media Feed** | Posts, likes, comments, followers; paginated infinite scroll | $lookup, compound indexes, cursors | 2 weeks |
| I3 | **Real-Time Analytics Dashboard** | Sales data pipeline — revenue by category, top products, cohort | Advanced aggregation, $facet | 2 weeks |
| I4 | **Event Ticketing System** | Events, tickets, bookings with atomic seat reservation | Transactions, write concerns | 1.5 weeks |
| I5 | **Geo-Location Finder** | Store and query Points of Interest by distance from user | 2dsphere indexes, $near, GeoJSON | 1.5 weeks |

### Advanced Projects (Phases 09–12)

| # | Project | Description | Key Skills | Est. Time |
|---|---------|-------------|-----------|-----------|
| A1 | **Distributed Order System** | Multi-region order processing with sharding and saga pattern | Sharding, transactions, oplog | 3–4 weeks |
| A2 | **Atlas Search Engine** | Product search with fuzzy matching, autocomplete, and facets | Atlas Search, Lucene, $search | 2–3 weeks |
| A3 | **AI Product Recommender** | Semantic search using vector embeddings stored in MongoDB | Vector Search, $vectorSearch | 2–3 weeks |
| A4 | **IoT Sensor Platform** | High-throughput time series ingestion with bucketing pattern | Sharding, time series collections | 2–3 weeks |
| A5 | **Multi-Tenant SaaS API** | Tenant isolation, field-level encryption, RBAC, audit log | Security, RBAC, CSFLE | 3 weeks |

---

## 6. Certification Path

### MongoDB Certification Ladder

```text
  ┌───────────────────────────────────────────────────┐
  │           MongoDB Certification Path               │
  └───────────────────────────────────────────────────┘

  Start Here
      │
      ▼
  ┌─────────────────────────────────────────────────┐
  │  MongoDB Associate Developer                    │
  │  Exam: C100DEV                                  │
  │  Topics: CRUD, aggregation, indexes,            │
  │          schema design, drivers, Atlas          │
  │  Recommended after: Phases 01–07                │
  │  Duration: 90 min · 60 questions · 65% pass     │
  │  Cost: USD $150 · Valid 3 years                 │
  └─────────────────────┬───────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────┐
  │  MongoDB Associate DBA                          │
  │  Exam: C100DBA                                  │
  │  Topics: Replication, sharding, security,       │
  │          backup, monitoring, performance        │
  │  Recommended after: Phases 01–11                │
  │  Duration: 90 min · 60 questions · 65% pass     │
  └─────────────────────┬───────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────┐
  │  MongoDB Professional Developer                 │
  │  Exam: C200DEV (advanced level)                 │
  │  Topics: Advanced aggregation, Atlas deep dive, │
  │          performance at scale, architecture     │
  │  Recommended: 1+ year of production MongoDB exp │
  └─────────────────────────────────────────────────┘
```

### C100DEV Domain Breakdown

```text
┌─────────────────────────────────────────────────────────────────────┐
│           MongoDB Associate Developer Certification                  │
│                       C100DEV                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Domain                          Weight    Phases Covering It        │
│  ─────────────────────────────── ───────   ────────────────────────  │
│  CRUD Operations                 17%       Phase 02                  │
│  Indexes                         17%       Phase 06                  │
│  Data Modelling                  17%       Phase 03                  │
│  Aggregation                     17%       Phase 05                  │
│  Atlas Tools & Drivers           13%       Phase 12                  │
│  ACID Transactions               13%       Phase 07                  │
│  Authentication & Authorization   6%       Phase 11                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Certification Study Timeline

```text
Phase 01–04  ──►  Phase 05–07  ──►  Practice Exam 1  ──►  C100DEV
    ▲                  ▲                   ▲
    │                  │                   │
  Weeks 1–6        Weeks 7–13         Weeks 14–16

Phase 08–11  ──►  Phase 12  ──►  Practice Exam 2  ──►  C100DBA
    ▲                ▲                  ▲
    │                │                  │
  Weeks 17–20    Week 21           Week 22
```

### Free Study Resources

```bash
# MongoDB University (free courses)
# https://learn.mongodb.com

# Courses aligned to this repo:
# M001 — MongoDB Basics
# M100 — MongoDB for SQL Professionals
# M121 — The MongoDB Aggregation Framework
# M201 — MongoDB Performance
# M310 — MongoDB Security
# M320 — Data Modeling

# Official documentation
# https://www.mongodb.com/docs/manual/
```

---

## 7. Getting Started

### Step 1: Install MongoDB Locally

```bash
# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0

# Ubuntu / Debian
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod

# Docker (quickest for local dev)
docker run -d -p 27017:27017 --name mongodb mongo:7.0
```

### Step 2: Connect and Verify

```bash
# Connect with mongosh
mongosh

# Should see prompt: test>
# Run a health check
db.runCommand({ ping: 1 })
# Expected: { ok: 1 }

# Check server version
db.version()
```

### Step 3: Create Your First Database

```js
// In mongosh

// Switch to a new database (created on first write)
use learningdb

// Insert a document
db.users.insertOne({
  name: "Ganesh",
  role: "developer",
  skills: ["MongoDB", "Node.js"],
  joinedAt: new Date()
})

// Read it back
db.users.find().pretty()

// Confirm database exists
show dbs
```

### Step 4: Connect to Atlas Free Tier

```bash
# 1. Create free account at mongodb.com/atlas
# 2. Create M0 free cluster (512 MB shared — no credit card)
# 3. Whitelist your IP: Network Access → Add IP Address
# 4. Create database user: Database Access → Add New Database User
# 5. Get connection string: Connect → Drivers → Node.js

# Connect mongosh to Atlas
mongosh "mongodb+srv://cluster0.xxxxx.mongodb.net/learningdb" \
  --username youruser --password yourpassword
```

### Step 5: Install the Node.js Driver

```bash
mkdir mongodb-learning && cd mongodb-learning
npm init -y
npm install mongodb dotenv
```

```js
// connection.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function connect() {
  await client.connect();
  console.log('Connected to MongoDB');
  return client.db('learningdb');
}

module.exports = { connect, client };
```

### Step 6: Install PyMongo (Python)

```bash
pip install pymongo
pip install "pymongo[srv]"   # for Atlas SRV connection strings

python3 - <<'EOF'
from pymongo import MongoClient
client = MongoClient('mongodb://localhost:27017')
db = client.testdb
db.test.insert_one({'hello': 'MongoDB'})
doc = db.test.find_one()
print(doc)
client.close()
EOF
```

---

## 8. Hands-On Exercises

### Exercise 1 — Build an Inventory System

Create a product inventory system from scratch using only the MongoDB shell.

```js
use inventoryDB

db.products.insertMany([
  { name: "Laptop",       category: "electronics", price: 1299.99, stock: 50, tags: ["portable", "work"] },
  { name: "Desk Chair",   category: "furniture",   price: 349.99,  stock: 30, tags: ["ergonomic", "office"] },
  { name: "Coffee Maker", category: "appliances",  price: 89.99,   stock: 100, tags: ["kitchen", "morning"] },
  { name: "Monitor",      category: "electronics", price: 549.99,  stock: 25, tags: ["4K", "work"] },
  { name: "Headphones",   category: "electronics", price: 199.99,  stock: 75, tags: ["wireless", "audio"] },
  { name: "Standing Desk",category: "furniture",   price: 799.99,  stock: 15, tags: ["ergonomic", "adjustable"] },
  { name: "Keyboard",     category: "electronics", price: 129.99,  stock: 60, tags: ["mechanical", "work"] },
  { name: "Blender",      category: "appliances",  price: 59.99,   stock: 45, tags: ["kitchen", "smoothie"] },
  { name: "Webcam",       category: "electronics", price: 79.99,   stock: 90, tags: ["HD", "streaming"] },
  { name: "Bookshelf",    category: "furniture",   price: 249.99,  stock: 20, tags: ["storage", "wood"] }
])

// Find all electronics under $300
db.products.find({ category: "electronics", price: { $lt: 300 } })

// Update stock for a product (simulate a sale)
db.products.updateOne(
  { name: "Laptop" },
  { $inc: { stock: -1 }, $set: { lastSold: new Date() } }
)

// Aggregate: total stock value per category
db.products.aggregate([
  { $group: {
    _id: "$category",
    totalValue: { $sum: { $multiply: ["$price", "$stock"] } },
    productCount: { $sum: 1 }
  }},
  { $sort: { totalValue: -1 } }
])
```

**Challenge**: Write a query that finds all products where `stock < 20` and returns only `name`, `stock`, and `category`.

---

### Exercise 2 — Aggregation Pipeline Mastery

Write a pipeline that produces a monthly revenue report from an orders collection.

```js
db.orders.insertMany([
  { orderId: "O001", customerId: "C1", amount: 150.00, status: "completed", createdAt: new Date("2026-01-15") },
  { orderId: "O002", customerId: "C2", amount: 89.50,  status: "completed", createdAt: new Date("2026-01-20") },
  { orderId: "O003", customerId: "C1", amount: 299.00, status: "cancelled", createdAt: new Date("2026-02-03") },
  { orderId: "O004", customerId: "C3", amount: 450.75, status: "completed", createdAt: new Date("2026-02-14") },
  { orderId: "O005", customerId: "C2", amount: 120.00, status: "completed", createdAt: new Date("2026-03-01") }
])

db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: {
    _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
    totalRevenue: { $sum: "$amount" },
    orderCount: { $sum: 1 },
    avgOrderValue: { $avg: "$amount" }
  }},
  { $sort: { "_id.year": 1, "_id.month": 1 } },
  { $project: {
    _id: 0,
    period: { $concat: [
      { $toString: "$_id.year" }, "-",
      { $lpad: [{ $toString: "$_id.month" }, 2, "0"] }
    ]},
    totalRevenue: { $round: ["$totalRevenue", 2] },
    orderCount: 1,
    avgOrderValue: { $round: ["$avgOrderValue", 2] }
  }}
])
```

**Challenge**: Add a `$lookup` stage to join customer names from a `customers` collection onto each result group.

---

### Exercise 3 — Index Optimization

Measure the query performance improvement from adding a compound index.

```js
// Setup: bulk insert 100,000 user documents
const bulk = [];
for (let i = 0; i < 100000; i++) {
  bulk.push({
    userId: i,
    email: `user${i}@example.com`,
    country: ["AU", "US", "UK", "CA"][i % 4],
    age: 18 + (i % 60),
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
  });
}
db.users.insertMany(bulk);

// Step 1: Query without index — note totalDocsExamined
db.users.find({ country: "AU", age: { $gte: 25, $lte: 35 } })
  .explain("executionStats");
// winningPlan.stage should be COLLSCAN
// totalDocsExamined ≈ 100,000

// Step 2: Create compound index (ESR rule: equality first, range last)
db.users.createIndex({ country: 1, age: 1 });

// Step 3: Query again — compare execution stats
db.users.find({ country: "AU", age: { $gte: 25, $lte: 35 } })
  .explain("executionStats");
// winningPlan.stage should be IXSCAN
// totalDocsExamined ≈ nReturned
```

**Challenge**: Add a `sort` by `createdAt` and observe how the ESR rule requires you to adjust the index.

---

### Exercise 4 — Multi-Document Transactions (ACID)

Implement an atomic bank transfer that rolls back entirely if any step fails.

```js
// Setup: two accounts
db.accounts.insertMany([
  { accountId: "ACC001", owner: "Alice", balance: 1000.00 },
  { accountId: "ACC002", owner: "Bob",   balance: 500.00  }
]);

// Transfer function — must be run in Node.js (mongosh sessions work similarly)
async function transferFunds(client, fromId, toId, amount) {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const accounts = client.db('bankdb').collection('accounts');

      const sender = await accounts.findOne({ accountId: fromId }, { session });
      if (!sender || sender.balance < amount) {
        throw new Error('Insufficient funds or account not found');
      }

      await accounts.updateOne(
        { accountId: fromId },
        { $inc: { balance: -amount } },
        { session }
      );

      await accounts.updateOne(
        { accountId: toId },
        { $inc: { balance: amount } },
        { session }
      );

      await client.db('bankdb').collection('transactions').insertOne({
        from: fromId, to: toId, amount,
        timestamp: new Date(), status: "completed"
      }, { session });
    });
    console.log(`Transfer of ${amount} from ${fromId} to ${toId} completed`);
  } finally {
    await session.endSession();
  }
}
```

**Challenge**: Simulate a failure mid-transaction (throw an error after the debit but before the credit) and verify both account balances remain unchanged.

---

### Exercise 5 — Change Streams (Real-Time Events)

Listen to real-time changes in a collection and react to critical events.

```js
// In Node.js — Terminal 1: start the watcher
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('monitoring');

const pipeline = [
  { $match: {
    operationType: { $in: ["insert", "update"] },
    "fullDocument.severity": "critical"
  }}
];

const changeStream = db.collection('alerts').watch(pipeline, {
  fullDocument: 'updateLookup'
});

changeStream.on('change', (event) => {
  console.log('[CRITICAL ALERT]', {
    op: event.operationType,
    id: event.documentKey._id,
    doc: event.fullDocument
  });
});

// Terminal 2 (mongosh): trigger the watcher
db.alerts.insertOne({
  message: "CPU usage at 98%",
  severity: "critical",
  service: "payments-api",
  timestamp: new Date()
});
// Terminal 1 should immediately print the alert
```

**Challenge**: Store a resume token and implement reconnect logic so the watcher never misses an event even after a network interruption.

---

## 9. Interview Q&A

> Covers the most commonly asked MongoDB topics in technical interviews for backend, full-stack, and data engineering roles.

---

**Q1: What is the difference between `find()` and `aggregate()` in MongoDB?**

`find()` is optimized for simple document retrieval with filtering and projection. It returns a cursor over matching documents. `aggregate()` processes documents through a multi-stage pipeline that can reshape, group, join, and compute derived values. Use `find()` for lookups; use `aggregate()` when you need to compute summaries, reshape data, or join collections.

```js
// find() — retrieve matching documents
db.users.find({ age: { $gte: 18 } }, { name: 1, email: 1 })

// aggregate() — compute summary statistics
db.users.aggregate([
  { $match: { age: { $gte: 18 } } },
  { $group: { _id: "$country", count: { $sum: 1 } } }
])
```

---

**Q2: When should you embed documents vs reference them?**

| Embed | Reference |
|-------|-----------|
| Data is always accessed together | Data is accessed independently |
| One-to-few relationship (bounded) | One-to-many (unbounded growth) |
| Data doesn't change frequently | Data changes often in one place |
| Atomicity is needed across the data | Large subdocuments cause doc bloat |

```js
// Embed: blog post + its 3-5 comments (bounded, accessed together)
{ title: "MongoDB Tips", comments: [{ author: "Alice", text: "Great!" }] }

// Reference: user + their thousands of orders (unbounded)
{ userId: ObjectId("..."), total: 99.99, ... }  // in orders collection
```

---

**Q3: What is a covered query and why does it matter?**

A covered query is satisfied entirely from an index — MongoDB never touches the actual documents. It is the fastest possible query because it avoids a FETCH stage.

```js
// Index on { email: 1, name: 1 }
db.users.createIndex({ email: 1, name: 1 })

// Covered query — only requests fields in the index, excludes _id
db.users.find(
  { email: "user@example.com" },
  { name: 1, _id: 0 }
)
// explain() shows: IXSCAN → no FETCH stage
```

---

**Q4: Explain the ESR rule for compound indexes.**

ESR = **Equality fields first**, **Sort fields second**, **Range fields last**.

When building a compound index for a query with equality, sort, and range conditions, place fields in ESR order for optimal performance:

```js
// Query: users in "AU" (equality), sorted by createdAt, where age > 25 (range)
// ESR index: country → createdAt → age
db.users.createIndex({ country: 1, createdAt: 1, age: 1 })
```

Placing range before sort forces an in-memory sort. ESR lets MongoDB use the index for the sort too.

---

**Q5: What is the oplog and why does it matter?**

The oplog (operations log) is a capped collection in `local.oplog.rs` that records every write operation on the primary. Secondaries tail the oplog to stay in sync. It is also the foundation for change streams and incremental backup strategies. Because it is capped, older entries are overwritten once full — the "oplog window" determines how far behind a secondary can fall before it needs a full resync.

---

**Q6: How does MongoDB handle multi-document transactions?**

MongoDB supports full ACID multi-document transactions using sessions:

```js
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    await col1.updateOne({ _id: id1 }, { $inc: { balance: -100 } }, { session });
    await col2.updateOne({ _id: id2 }, { $inc: { balance: 100 } }, { session });
  });
} finally {
  await session.endSession();
}
```

Limitations: 60-second default timeout, performance overhead, prefer single-document atomic updates when possible.

---

**Q7: What is the difference between write concern and read preference?**

**Write concern** controls how many replica set members must acknowledge a write before it returns success:

- `{ w: 1 }` — primary acknowledges (default)
- `{ w: "majority" }` — majority of nodes must confirm (durable against failover)
- `{ w: 0 }` — fire and forget (highest throughput, no guarantees)

**Read preference** controls which nodes handle read operations:

- `primary` — always read latest data
- `secondary` — can read stale data; reduces primary load
- `nearest` — lowest network latency node

---

**Q8: What is `$lookup` and what are its performance considerations?**

`$lookup` performs a left outer join between two collections in the same database:

```js
db.orders.aggregate([
  { $lookup: {
    from: "users",
    localField: "customerId",
    foreignField: "_id",
    as: "customerDetails"
  }}
])
```

Performance: Ensure an index exists on the `foreignField`. For large collections, `$lookup` performs a full scan of the foreign collection for each input document unless indexed. The `pipeline` form of `$lookup` allows pre-filtering the joined collection before the join, which can dramatically reduce work.

---

**Q9: Explain TTL indexes.**

TTL (Time-To-Live) indexes automatically expire and delete documents after a specified number of seconds past a date field:

```js
// Documents deleted 24 hours after their createdAt timestamp
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 }
)
```

MongoDB runs a background cleanup thread every 60 seconds. Documents are not deleted instantly — there can be up to a 60-second delay after expiry. Useful for sessions, cache, temporary data, and log rotation.

---

**Q10: Difference between a replica set and a sharded cluster?**

| Replica Set | Sharded Cluster |
|-------------|-----------------|
| All nodes hold a full copy of the data | Data is partitioned across shards |
| Provides high availability (HA) | Provides horizontal scalability |
| Automatic failover on primary failure | Query router (mongos) distributes queries |
| Best for datasets up to ~1 TB | Best for multi-TB or massive write rates |
| Simpler operational overhead | More complex setup and maintenance |

A sharded cluster is built on top of replica sets — each shard is itself a replica set.

---

**Q11: Hashed vs ranged shard keys — when to use each?**

| Hashed Sharding | Ranged Sharding |
|-----------------|-----------------|
| Uniform distribution of writes | Writes may hotspot on one shard |
| No range-query routing benefit | Range queries go to one or few shards |
| Good for high-throughput insert-heavy workloads | Good for time-series or range-heavy reads |
| Scatter-gather for all range queries | Targeted queries for range predicates |

Choose hashed for event streams, IoT, and monotonically increasing keys (ObjectId, timestamps). Choose ranged when your most common queries filter by a range on the shard key (e.g., date ranges).

---

**Q12: How does WiredTiger work under the hood?**

WiredTiger is MongoDB's default storage engine. Key internals:

- **Document-level concurrency control**: Multiple writers can update different documents simultaneously using optimistic concurrency (compare-and-swap), not collection-level locking.
- **Compression**: Snappy by default (50–80% size reduction). Optional zlib or zstd for higher compression.
- **Checkpoint**: Writes a consistent snapshot to disk every 60 seconds or every 2 GB of journal data.
- **Cache**: Defaults to 50% of RAM minus 1 GB. Uses an LRU eviction policy. Frequently accessed data stays in memory.

---

**Q13: How do you read and interpret an explain plan?**

```js
db.users.find({ country: "AU", age: { $gt: 25 } }).explain("executionStats")
```

Key fields to look for:

```text
winningPlan.stage        IXSCAN (good) vs COLLSCAN (bad)
totalDocsExamined        How many docs MongoDB scanned
nReturned                How many docs matched the query
executionTimeMillis      Total query duration

Efficiency ratio: nReturned / totalDocsExamined
A ratio near 1.0 = highly selective index
A ratio of 1/100000 = full collection scan for 1 result
```

---

**Q14: How do you handle schema migrations in MongoDB?**

Three main strategies:

1. **Lazy migration** — Add logic to your app to handle both old and new schemas. On each read, upgrade the document if it is the old format. On each write, use the new format.

2. **Background migration script** — Iterate all documents in batches and update them:
   ```js
   db.users.updateMany(
     { schemaVersion: { $exists: false } },
     { $set: { schemaVersion: 2, status: "active" } }
   )
   ```

3. **Schema versioning pattern** — Add a `schemaVersion` field to each document and maintain version-aware logic in your application layer.

---

**Q15: What are change streams and how do they differ from polling?**

| Polling | Change Streams |
|---------|---------------|
| App queries DB on an interval | DB pushes events to the app immediately |
| Wasted queries when nothing changed | Event-driven — zero wasted reads |
| May miss rapid successive changes | Every change is captured in order |
| Simple to implement | Requires resume token handling |

Change streams are backed by the oplog and support **resume tokens** — if the consumer disconnects and reconnects, it resumes from the exact point it stopped without missing any events.

---

**Q16: Explain the bucket pattern for time-series data.**

Instead of one document per measurement, the bucket pattern groups N measurements into one document:

```js
// Without bucket: 1 doc per sensor reading (10M docs/day for 1000 sensors)
{ sensorId: "S1", timestamp: ISODate("..."), value: 23.5 }

// With bucket: 60 readings per document (167k docs/day for 1000 sensors)
{
  sensorId: "S1",
  hour: ISODate("2026-06-23T10:00:00Z"),
  count: 60,
  measurements: [
    { t: ISODate("2026-06-23T10:00:00Z"), v: 23.5 },
    { t: ISODate("2026-06-23T10:01:00Z"), v: 23.7 }
  ],
  stats: { min: 23.1, max: 24.0, sum: 1416.0 }
}
```

Benefits: 60x fewer documents, pre-computed stats for fast aggregation, better index efficiency, lower storage overhead.

---

**Q17: What is Atlas Search and how does it compare to MongoDB native text indexes?**

| MongoDB Text Index | Atlas Search |
|-------------------|--------------|
| Built-in, no extra cost | Powered by Apache Lucene |
| Basic keyword matching | Relevance-scored full-text search |
| No fuzzy/typo tolerance | Fuzzy matching, diacritics, stemming |
| No autocomplete support | Autocomplete operator built-in |
| Limited faceting | Full faceted navigation with $searchMeta |
| Single language per collection | Per-field language analyzers |
| Available everywhere | Atlas clusters only |

Atlas Search indexes your collection data asynchronously in Lucene and exposes results via the `$search` aggregation stage. It is the right choice for user-facing search experiences.

---

## 10. Repository Structure

```text
MongoDB/
├── README.md                               ← You are here
│
├── Phase-01-Fundamentals/
│   ├── README.md
│   ├── 01-What-is-MongoDB.md
│   └── 02-Installation-Setup.md
│
├── Phase-02-CRUD/
│   ├── README.md
│   ├── 01-Insert-Operations.md
│   ├── 02-Find-Queries.md
│   ├── 03-Update-Operations.md
│   └── 04-Delete-Operations.md
│
├── Phase-03-Schema-Design/
│   ├── README.md
│   ├── 01-Embedding-vs-Referencing.md
│   ├── 02-One-to-Many-Patterns.md
│   ├── 03-Many-to-Many-Patterns.md
│   └── 04-Schema-Design-Patterns.md
│
├── Phase-04-Query-Operators/
│   ├── README.md
│   ├── 01-Comparison-Operators.md
│   ├── 02-Logical-Operators.md
│   ├── 03-Array-Operators.md
│   └── 04-Element-Regex-Operators.md
│
├── Phase-05-Aggregation/
│   ├── README.md
│   ├── 01-Pipeline-Stages.md
│   ├── 02-Group-Expressions.md
│   ├── 03-Lookup-Join.md
│   ├── 04-Advanced-Stages.md
│   └── 05-Aggregation-Patterns.md
│
├── Phase-06-Indexes/
│   ├── README.md
│   ├── 01-Single-Field-Indexes.md
│   ├── 02-Compound-Indexes.md
│   ├── 03-Multikey-Text-Geo-Indexes.md
│   └── 04-Index-Strategy-Guide.md
│
├── Phase-07-Transactions/
│   ├── README.md
│   ├── 01-ACID-in-MongoDB.md
│   └── 02-Multi-Document-Transactions.md
│
├── Phase-08-Performance/
│   ├── README.md
│   ├── 01-Query-Plans-Explain.md
│   └── 02-Profiler-Slow-Queries.md
│
├── Phase-09-Replication/
│   ├── README.md
│   ├── 01-Replica-Sets.md
│   └── 02-Read-Write-Concerns.md
│
├── Phase-10-Sharding/
│   ├── README.md
│   ├── 01-Sharding-Concepts.md
│   └── 02-Shard-Key-Selection.md
│
├── Phase-11-Security/
│   ├── README.md
│   ├── 01-Authentication.md
│   ├── 02-Authorization-RBAC.md
│   └── 03-Encryption-TLS.md
│
├── Phase-12-Atlas-Cloud/
│   ├── README.md
│   ├── 01-Atlas-Overview.md
│   ├── 02-Atlas-Search.md
│   └── 03-Triggers-Data-API.md
│
├── Projects/
│   ├── Beginner/
│   ├── Intermediate/
│   └── Advanced/
│
└── Quick-Reference/
    ├── Cheat-Sheet.md
    └── Interview-Questions.md
```

---

```text
┌─────────────────────────────────────────────────────────────────┐
│                   Complete MongoDB Course                        │
│                                                                  │
│  12 Phases  ·  18–22 Weeks  ·  15 Projects  ·  3 Certifications │
│                                                                  │
│  Last updated: June 2026 | Maintained by Ganesh Pirikirala       │
└─────────────────────────────────────────────────────────────────┘
```

> "MongoDB is not a replacement for relational databases — it is a different tool for a different class of problems. Master both, and you master data."

---

*Last updated: June 2026 | Maintained by Ganesh Pirikirala*

*MongoDB, Atlas, and mongosh are trademarks of MongoDB, Inc. This course is an independent learning resource, not affiliated with MongoDB, Inc.*
