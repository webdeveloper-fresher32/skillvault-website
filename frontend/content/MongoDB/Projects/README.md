# MongoDB Projects Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   MONGODB PROJECT CURRICULUM                    │
│              9 Projects · 3 Difficulty Levels                   │
└─────────────────────────────────────────────────────────────────┘
```

## Table of Contents

1. [Curriculum Structure](#curriculum-structure)
2. [Beginner Projects](#beginner-projects)
3. [Intermediate Projects](#intermediate-projects)
4. [Advanced Projects](#advanced-projects)
5. [Learning Path](#learning-path)
6. [Skills Matrix](#skills-matrix)

---

## Curriculum Structure

```
Projects/
├── 01-Beginner-Projects.md
│   ├── Project 1: Contact Book
│   ├── Project 2: Movie Database
│   └── Project 3: Simple Blog
│
├── 02-Intermediate-Projects.md
│   ├── Project 4: E-Commerce Product Catalog
│   ├── Project 5: Social Media Feed
│   └── Project 6: Analytics Dashboard
│
└── 03-Advanced-Projects.md
    ├── Project 7: Real-Time Chat App
    ├── Project 8: Multi-Tenant SaaS
    └── Project 9: IoT Time Series
```

---

## Beginner Projects

| # | Project | Key Concepts | Estimated Time |
|---|---------|-------------|----------------|
| 1 | Contact Book | CRUD, embedded docs, array ops | 2-3 hrs |
| 2 | Movie Database | Indexing, text search, sorting | 3-4 hrs |
| 3 | Simple Blog | $push/$pull, nested arrays, queries | 3-4 hrs |

---

## Intermediate Projects

| # | Project | Key Concepts | Estimated Time |
|---|---------|-------------|----------------|
| 4 | E-Commerce Product Catalog | Aggregation, $lookup, multi-collection | 6-8 hrs |
| 5 | Social Media Feed | Pagination, pipelines, denormalization | 6-8 hrs |
| 6 | Analytics Dashboard | Time-series, $bucket, $facet | 8-10 hrs |

---

## Advanced Projects

| # | Project | Key Concepts | Estimated Time |
|---|---------|-------------|----------------|
| 7 | Real-Time Chat App | Change streams, transactions, triggers | 10-14 hrs |
| 8 | Multi-Tenant SaaS | Sharding, RBAC, Atlas private endpoints | 12-16 hrs |
| 9 | IoT Time Series | Time series collections, windowed aggs | 10-14 hrs |

---

## Learning Path

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   BEGINNER   │────>│   INTERMEDIATE   │────>│   ADVANCED   │
│              │     │                  │     │              │
│ · CRUD ops   │     │ · Aggregation    │     │ · Streaming  │
│ · Schemas    │     │ · Multi-collect  │     │ · Sharding   │
│ · Indexing   │     │ · Pagination     │     │ · RBAC       │
│ · Arrays     │     │ · $lookup        │     │ · Atlas ops  │
└──────────────┘     └──────────────────┘     └──────────────┘
```

### Prerequisites by Level

**Beginner** — No prior MongoDB experience needed. Basic JS/JSON knowledge helpful.

**Intermediate** — Complete all three beginner projects first. Understand aggregation pipeline basics.

**Advanced** — Complete intermediate projects. Understand MongoDB Atlas, replication concepts, and application-level design patterns.

---

## Skills Matrix

| Skill | Contact Book | Movie DB | Blog | E-Commerce | Social Feed | Analytics | Chat | SaaS | IoT |
|-------|:-----------:|:--------:|:----:|:----------:|:-----------:|:---------:|:----:|:----:|:---:|
| insertOne/Many | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| find/findOne | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| updateOne/Many | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| deleteOne/Many | Y | - | Y | Y | Y | - | Y | Y | - |
| Embedded Docs | Y | Y | Y | Y | Y | - | Y | Y | - |
| Array Operators | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Indexes | - | Y | Y | Y | Y | Y | Y | Y | Y |
| Text Search | - | Y | Y | - | Y | - | Y | - | - |
| Aggregation | - | Y | Y | Y | Y | Y | Y | Y | Y |
| $lookup | - | - | - | Y | Y | Y | Y | Y | - |
| $bucket/$facet | - | - | - | - | - | Y | - | - | Y |
| Transactions | - | - | - | - | - | - | Y | Y | - |
| Change Streams | - | - | - | - | - | - | Y | - | Y |
| Sharding | - | - | - | - | - | - | - | Y | Y |
| Atlas TS | - | - | - | - | - | - | - | - | Y |

---

## File Descriptions

### [01-Beginner-Projects.md](./01-Beginner-Projects.md)
Three foundational projects covering the essential MongoDB CRUD operations, schema design with embedded documents and arrays, basic indexing, and text search. Each project includes full schema definitions, setup instructions, 10 specific tasks with solutions, hands-on exercises, and interview Q&A.

### [02-Intermediate-Projects.md](./02-Intermediate-Projects.md)
Three intermediate projects introducing aggregation pipelines, multi-collection joins with $lookup, cursor-based pagination, time-series bucketing, and funnel analysis. Builds on beginner patterns with production-oriented design decisions.

### [03-Advanced-Projects.md](./03-Advanced-Projects.md)
Three advanced projects covering MongoDB Atlas-specific features: change streams, multi-document ACID transactions, sharding strategies, role-based access control, and time series collections with windowed aggregations.

---

> Start with `01-Beginner-Projects.md` and work your way through each file sequentially.
> Every project is self-contained with its own setup, tasks, and exercises.
