# MongoDB Quick-Reference

```
┌─────────────────────────────────────────────────────────────┐
│              MongoDB Quick-Reference Section                 │
│                                                             │
│   Fast lookup resources for developers and interviewees     │
└─────────────────────────────────────────────────────────────┘
```

## Table of Contents

1. [What Is In This Section](#what-is-in-this-section)
2. [File Descriptions](#file-descriptions)
3. [How To Use This Section](#how-to-use-this-section)
4. [Quick Navigation Guide](#quick-navigation-guide)
5. [Study Strategy](#study-strategy)
6. [Hands-On Exercises](#hands-on-exercises)

---

## What Is In This Section

This section provides fast, dense reference material for MongoDB. It is intended for:

- Developers who need a command or operator syntax and do not want to open full documentation
- Interview candidates who need to review key concepts quickly
- Students who have completed deeper notes and want a condensed review layer

The materials here do not replace conceptual notes. They complement them by giving you
lookup tables, syntax templates, and Q&A drills.

---

## File Descriptions

### MongoDB-Cheatsheet.md

A 600+ line dense reference document. It is organized into these sections:

```
├── mongosh Navigation Commands
├── CRUD Quick Reference
├── Query Operators (complete table)
├── Update Operators (complete table)
├── Aggregation Pipeline Stages
├── Common Aggregation Expressions
├── Index Commands
├── Replica Set Commands
└── Admin Commands
```

Use this file when:
- You cannot remember the exact syntax for an operator
- You need a quick reminder of what a pipeline stage does
- You want to compare multiple operators side by side

### Interview-Questions.md

A 50 Q&A file covering four domains:

```
├── Fundamentals             (Q1  - Q10)
├── CRUD & Queries           (Q11 - Q20)
├── Schema Design            (Q21 - Q30)
├── Indexes & Performance    (Q31 - Q40)
└── Replication, Sharding,
    Transactions             (Q41 - Q50)
```

Use this file when:
- Preparing for a technical MongoDB interview
- Doing daily review drills (10 questions per session)
- Checking whether your understanding of a concept is correct

---

## How To Use This Section

### For Interview Prep

```
Day 1: Q1  - Q10   (Fundamentals)
Day 2: Q11 - Q20   (CRUD & Queries)
Day 3: Q21 - Q30   (Schema Design)
Day 4: Q31 - Q40   (Indexes & Performance)
Day 5: Q41 - Q50   (Replication, Sharding, Transactions)
Day 6: Full cheatsheet scan - flag any unfamiliar operators
Day 7: Repeat weakest day
```

### For Active Development

Keep the cheatsheet open in a split pane. Use Ctrl+F to jump to the relevant section.
The section headers are designed to be grep-friendly:

```bash
grep -n "## Update Operators" MongoDB-Cheatsheet.md
grep -n "## Aggregation" MongoDB-Cheatsheet.md
```

### For Quick Syntax Lookup

Each operator in the cheatsheet has a one-line example. The pattern is:

```
| operator | purpose | example |
```

Find your operator, copy the example, adapt it.

---

## Quick Navigation Guide

```
┌─────────────────────────────────────────────────────────────────┐
│  Task                        │  Go To                           │
├─────────────────────────────────────────────────────────────────┤
│  Forgot insertMany syntax    │  Cheatsheet > CRUD               │
│  What does $bucket do?       │  Cheatsheet > Aggregation Stages │
│  ESR rule question           │  Interview Q31                   │
│  Shard key selection         │  Interview Q44                   │
│  $elemMatch vs dot notation  │  Interview Q17                   │
│  TTL index                   │  Interview Q35 + Cheatsheet      │
│  rs.status output fields     │  Cheatsheet > Replica Set        │
│  ACID in MongoDB             │  Interview Q47                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Study Strategy

### Active Recall Method

Do not just read the Q&A file. Cover the answer, write your answer from memory,
then compare. This is more effective than passive reading.

### Spaced Repetition

Mark questions you struggled with. Return to them after 1 day, then 3 days, then 1 week.

### Connect To Practice

After reading any section of the cheatsheet, open a mongosh session and run the
commands you just read about. Muscle memory reinforces syntax recall.

---

## Hands-On Exercises

1. Open mongosh, create a database called `practice`, and insert 10 documents into a
   `users` collection using insertMany. Each document should have: name, age, city, tags (array).

2. Write a query that finds all users over age 25 who live in either "Sydney" or "Melbourne".
   Use $and and $in operators. Then rewrite it without $and using implicit AND syntax.

3. Build an aggregation pipeline that groups users by city, counts them, computes average age,
   and sorts results by count descending. Add a $project stage to rename fields.

4. Create a compound index on { city: 1, age: -1 }. Run explain("executionStats") on a
   query that should use it. Verify IXSCAN appears in the winning plan.

5. Simulate a multi-document transaction: debit 100 from one user's balance field and
   credit 100 to another user's balance field. Wrap in startSession/startTransaction/
   commitTransaction. Then intentionally throw an error and verify abortTransaction works.

---

*Last updated: June 2026*
*Part of: MongoDB & SQL Study Notes*
