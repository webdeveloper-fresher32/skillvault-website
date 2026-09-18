# Phase 02 — CRUD Operations in MongoDB

```
+---------------------------------------------------------------+
|                  PHASE 02: CRUD OPERATIONS                    |
|  Create  |  Read  |  Update  |  Delete  — the four pillars   |
+---------------------------------------------------------------+
```

## Table of Contents

1. [Phase Overview](#1-phase-overview)
2. [Learning Objectives](#2-learning-objectives)
3. [File Map](#3-file-map)
4. [Prerequisites](#4-prerequisites)
5. [Estimated Timeline](#5-estimated-timeline)
6. [Key Concepts Summary](#6-key-concepts-summary)
7. [Quick Reference Cheatsheet](#7-quick-reference-cheatsheet)
8. [How to Use This Phase](#8-how-to-use-this-phase)

---

## 1. Phase Overview

CRUD stands for **Create, Read, Update, Delete** — the four fundamental operations any
database must support. In MongoDB, these map to a rich set of driver and shell methods
that operate on **documents** inside **collections**.

Unlike SQL, MongoDB's CRUD API is document-oriented:

```
SQL                          MongoDB
-----------                  -------------------
INSERT INTO ...       -->    insertOne() / insertMany()
SELECT ...            -->    find() / findOne()
UPDATE ...            -->    updateOne() / updateMany() / replaceOne()
DELETE FROM ...       -->    deleteOne() / deleteMany()
```

MongoDB CRUD operations target a single collection at a time. Joins are replaced by
embedded documents or the `$lookup` aggregation stage (covered in Phase 05).

---

## 2. Learning Objectives

By the end of Phase 02 you will be able to:

```
+------------------------------------------------------------------+
| CREATE                                                           |
|  - Insert single and multiple documents                          |
|  - Understand ObjectId anatomy and custom _id                    |
|  - Configure writeConcern for durability guarantees              |
|  - Use bulk write operations for high-throughput inserts         |
|  - Enforce schema validation with $jsonSchema                    |
+------------------------------------------------------------------+
| READ                                                             |
|  - Query documents with find() and findOne()                     |
|  - Shape results with projections (include/exclude)              |
|  - Navigate nested fields with dot notation                      |
|  - Query array fields with $elemMatch, $all, $size               |
|  - Control result sets with sort(), limit(), skip()              |
+------------------------------------------------------------------+
| UPDATE                                                           |
|  - Modify fields with $set, $unset, $inc and 10+ operators       |
|  - Target array elements with arrayFilters                       |
|  - Perform atomic read-modify-write with findOneAndUpdate()      |
|  - Upsert — insert if not found, update if found                 |
+------------------------------------------------------------------+
| DELETE                                                           |
|  - Remove one or many documents                                  |
|  - Use findOneAndDelete() for atomic retrieval + removal         |
|  - Distinguish soft delete vs hard delete                        |
|  - Know when to use drop() vs deleteMany({})                     |
+------------------------------------------------------------------+
```

---

## 3. File Map

```
Phase-02-CRUD/
├── README.md                  <-- You are here (overview + cheatsheet)
├── 01-Create-Insert.md        <-- insertOne, insertMany, ObjectId, writeConcern,
│                                  bulk write, $jsonSchema validation
├── 02-Read-Query.md           <-- find, projections, dot notation, array queries,
│                                  cursor methods (sort/limit/skip/count)
├── 03-Update.md               <-- updateOne/Many, replaceOne, all update operators,
│                                  arrayFilters, findOneAndUpdate, upsert
└── 04-Delete.md               <-- deleteOne/Many, findOneAndDelete, soft delete,
                                   drop vs deleteMany, bulk operations
```

---

## 4. Prerequisites

Before starting Phase 02, confirm you have completed or understand:

| Prerequisite | Where Covered |
|---|---|
| MongoDB shell (mongosh) basics | Phase 01 |
| Creating databases and collections | Phase 01 |
| Document structure (BSON / JSON) | Phase 01 |
| Connecting to a MongoDB instance | Phase 01 |
| Basic query filter syntax | Phase 01 |

If you are missing any prerequisite, revisit Phase 01 before continuing.

---

## 5. Estimated Timeline

```
Week 1
  Day 1-2  ── 01-Create-Insert.md
               insertOne, insertMany, ordered/unordered, ObjectId anatomy
  Day 3    ── 01-Create-Insert.md (continued)
               writeConcern, bulk write, $jsonSchema validation
  Day 4-5  ── 02-Read-Query.md
               find, findOne, projections, dot notation, array queries

Week 2 (first half)
  Day 1-2  ── 02-Read-Query.md (continued)
               cursor methods, forEach iteration, real-world query patterns
  Day 3    ── 03-Update.md
               updateOne/Many, all update operators
  Day 4    ── 03-Update.md (continued)
               arrayFilters, findOneAndUpdate, upsert
  Day 5    ── 04-Delete.md
               all delete methods, soft delete, bulk operations

  + 2 days buffer for exercises and review
Total: ~1.5 weeks
```

---

## 6. Key Concepts Summary

### The MongoDB CRUD Document Lifecycle

```
               insertOne()
               insertMany()
               bulkWrite()
                    |
                    v
+-------------------------------------------+
|           MongoDB Collection               |
|                                           |
|  { _id: ObjectId("..."), field: value }  |
|  { _id: ObjectId("..."), field: value }  |
|  { _id: ObjectId("..."), field: value }  |
|                                           |
+-------------------------------------------+
        |              |              |
        v              v              v
     find()       updateOne()    deleteOne()
     findOne()    updateMany()   deleteMany()
                  replaceOne()   findOneAndDelete()
                  findOneAndUpdate()
```

### CRUD Operations at a Glance

| Operation | Method | Returns |
|---|---|---|
| Insert one | `insertOne(doc)` | `InsertOneResult` |
| Insert many | `insertMany([docs])` | `InsertManyResult` |
| Find many | `find(filter)` | Cursor |
| Find one | `findOne(filter)` | Document or null |
| Update one | `updateOne(filter, update)` | `UpdateResult` |
| Update many | `updateMany(filter, update)` | `UpdateResult` |
| Replace one | `replaceOne(filter, replacement)` | `UpdateResult` |
| Find + update | `findOneAndUpdate(filter, update)` | Document |
| Delete one | `deleteOne(filter)` | `DeleteResult` |
| Delete many | `deleteMany(filter)` | `DeleteResult` |
| Find + delete | `findOneAndDelete(filter)` | Document |

---

## 7. Quick Reference Cheatsheet

```js
// ---- CREATE ----
db.users.insertOne({ name: "Alice", age: 30 })
db.users.insertMany([{ name: "Bob" }, { name: "Carol" }])

// ---- READ ----
db.users.find({ age: { $gt: 25 } })
db.users.findOne({ name: "Alice" })
db.users.find({}, { name: 1, _id: 0 })          // projection
db.users.find().sort({ age: -1 }).limit(5)       // cursor methods

// ---- UPDATE ----
db.users.updateOne({ name: "Alice" }, { $set: { age: 31 } })
db.users.updateMany({ active: false }, { $set: { archived: true } })
db.users.findOneAndUpdate(
  { name: "Alice" },
  { $inc: { loginCount: 1 } },
  { returnDocument: "after" }
)

// ---- DELETE ----
db.users.deleteOne({ name: "Alice" })
db.users.deleteMany({ archived: true })
db.users.findOneAndDelete({ name: "Bob" })
```

---

## 8. How to Use This Phase

Each file in this phase follows a consistent structure:

```
1. Concept Introduction    — What it is, real-world analogy
2. Syntax Reference        — Method signatures with parameter tables
3. Code Examples           — Runnable mongosh / Node.js examples
4. Under the Hood          — What MongoDB actually does internally
5. Common Mistakes         — Pitfalls and how to avoid them
6. Hands-On Exercises      — 5 exercises with hints
7. Interview Q&A           — 10+ questions with detailed answers
```

**Recommended workflow:**

1. Read the concept introduction and analogy.
2. Type every code example into mongosh — do not just read them.
3. Complete all 5 exercises before checking hints.
4. Review the Q&A section as if preparing for a technical interview.
5. Move to the next file only after exercises feel comfortable.

---

*Phase 02 — CRUD Operations | MongoDB Learning Path*
*Estimated duration: 1.5 weeks*
