# Phase 4: Query Operators

```
┌─────────────────────────────────────────────────────────────────┐
│                   PHASE 4 — QUERY OPERATORS                     │
│                                                                 │
│   Duration : 1 Week                                             │
│   Goal     : Master every major query operator in MongoDB       │
│   Files    : 3 topic files + this README                        │
└─────────────────────────────────────────────────────────────────┘
```

## Table of Contents

1. [Overview](#overview)
2. [Files in This Phase](#files-in-this-phase)
3. [Learning Path](#learning-path)
4. [Quick Operator Reference](#quick-operator-reference)
5. [Week Schedule](#week-schedule)
6. [Prerequisites](#prerequisites)
7. [How to Practice](#how-to-practice)

---

## Overview

Phase 4 builds on the CRUD operations from Phase 2 and the schema patterns from
Phase 3. You will learn how to write precise, efficient queries using MongoDB's
rich operator vocabulary — the same operators used in production systems at scale.

MongoDB operators are grouped by function:

```
┌──────────────────────────────────────────────────────────────┐
│                  OPERATOR TAXONOMY                           │
│                                                              │
│  ┌──────────────────┐   ┌──────────────────┐                │
│  │   Comparison     │   │    Logical        │                │
│  │  $eq  $ne  $gt   │   │  $and $or         │                │
│  │  $gte $lt  $lte  │   │  $not $nor        │                │
│  │  $in  $nin       │   │                   │                │
│  └──────────────────┘   └──────────────────┘                │
│                                                              │
│  ┌──────────────────┐   ┌──────────────────┐                │
│  │     Array        │   │    Element        │                │
│  │  $all $elemMatch │   │  $exists $type    │                │
│  │  $size           │   │                   │                │
│  └──────────────────┘   └──────────────────┘                │
│                                                              │
│  ┌──────────────────┐   ┌──────────────────┐                │
│  │   Evaluation     │   │   Update (Array)  │                │
│  │  $regex $text    │   │  $push $pull      │                │
│  │  $expr $where    │   │  $addToSet $pop   │                │
│  │  $jsonSchema     │   │  $each $slice     │                │
│  └──────────────────┘   └──────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

---

## Files in This Phase

| # | File | Topics Covered | Lines |
|---|------|----------------|-------|
| 1 | [01-Comparison-Logical-Operators.md](./01-Comparison-Logical-Operators.md) | `$eq` `$ne` `$gt` `$gte` `$lt` `$lte` `$in` `$nin` `$and` `$or` `$not` `$nor` | 400+ |
| 2 | [02-Array-Operators.md](./02-Array-Operators.md) | `$all` `$elemMatch` `$size` nested arrays `$push` `$pull` `$addToSet` `$pop` `$each` `$slice` | 400+ |
| 3 | [03-Element-Evaluation-Operators.md](./03-Element-Evaluation-Operators.md) | `$exists` `$type` `$regex` `$text` `$expr` `$jsonSchema` avoid `$where` | 400+ |

---

## Learning Path

```
Day 1-2
  └── 01-Comparison-Logical-Operators.md
        ├── Read fully with notes
        ├── Run every example in mongosh
        └── Complete all 5 exercises

Day 3-4
  └── 02-Array-Operators.md
        ├── Read fully with notes
        ├── Run every example in mongosh
        └── Complete all 5 exercises

Day 5-6
  └── 03-Element-Evaluation-Operators.md
        ├── Read fully with notes
        ├── Run every example in mongosh
        └── Complete all 5 exercises

Day 7
  └── Review & consolidation
        ├── Redo exercises without looking at notes
        ├── Read all Interview Q&A sections
        └── Write 5 original queries using mixed operators
```

---

## Quick Operator Reference

```
┌──────────────┬────────────────────────────────────────────────┐
│ Operator     │ Purpose                                        │
├──────────────┼────────────────────────────────────────────────┤
│ $eq          │ Equal to value                                 │
│ $ne          │ Not equal to value                             │
│ $gt          │ Greater than                                   │
│ $gte         │ Greater than or equal                          │
│ $lt          │ Less than                                      │
│ $lte         │ Less than or equal                             │
│ $in          │ Value is in array                              │
│ $nin         │ Value is not in array                          │
├──────────────┼────────────────────────────────────────────────┤
│ $and         │ All conditions must match                      │
│ $or          │ At least one condition matches                 │
│ $not         │ Negate a condition                             │
│ $nor         │ None of the conditions match                   │
├──────────────┼────────────────────────────────────────────────┤
│ $all         │ Array contains all listed values               │
│ $elemMatch   │ At least one array element matches all criteria│
│ $size        │ Array has exact number of elements             │
├──────────────┼────────────────────────────────────────────────┤
│ $exists      │ Field exists (or does not exist)               │
│ $type        │ Field is of a specific BSON type               │
│ $regex       │ Field matches regular expression               │
│ $text        │ Full-text search on indexed fields             │
│ $expr        │ Use aggregation expressions inside find()      │
│ $jsonSchema  │ Validate documents against JSON Schema         │
│ $where       │ (Avoid) JavaScript expression evaluation       │
└──────────────┴────────────────────────────────────────────────┘
```

---

## Week Schedule

| Day | Activity | Time |
|-----|----------|------|
| Monday | Read File 01, run comparison examples | 1.5 hrs |
| Tuesday | Run logical examples, complete File 01 exercises | 1.5 hrs |
| Wednesday | Read File 02, run array query examples | 1.5 hrs |
| Thursday | Run array update examples, complete File 02 exercises | 1.5 hrs |
| Friday | Read File 03 completely, run all examples | 1.5 hrs |
| Saturday | Complete File 03 exercises | 1.0 hr |
| Sunday | Review all Q&A, write original mixed queries | 1.0 hr |

---

## Prerequisites

Before starting Phase 4, confirm you are comfortable with:

```
Phase 1  ─── MongoDB shell, documents, collections, databases
Phase 2  ─── insertOne/Many, findOne/find, updateOne/Many, deleteOne/Many
Phase 3  ─── Embedding vs referencing, schema patterns, validation basics
```

---

## How to Practice

Start a local MongoDB instance and create a practice database:

```js
// Connect via mongosh
mongosh

// Create and switch to practice database
use phase4_practice

// Insert sample data for exercises (see each file for specific datasets)
db.products.insertMany([
  { name: "Laptop", price: 999, tags: ["electronics", "computers"], stock: 45 },
  { name: "Phone",  price: 699, tags: ["electronics", "mobile"],    stock: 120 },
  { name: "Desk",   price: 299, tags: ["furniture", "office"],      stock: 8 }
])
```

Run every example as you read. Muscle memory beats passive reading every time.
