# 03 — Aggregation Patterns

## Table of Contents

1. [Pattern 1: Top-N Per Group](#1-pattern-1-top-n-per-group)
2. [Pattern 2: Running Totals (Window Sums)](#2-pattern-2-running-totals-window-sums)
3. [Pattern 3: Pivot — Rows to Columns](#3-pattern-3-pivot--rows-to-columns)
4. [Pattern 4: Graph Traversal with $graphLookup](#4-pattern-4-graph-traversal-with-graphlookup)
5. [Pattern 5: Time-Series Analysis](#5-pattern-5-time-series-analysis)
6. [Real-World Pipeline: Monthly Sales Report](#6-real-world-pipeline-monthly-sales-report)
7. [Real-World Pipeline: User Conversion Funnel](#7-real-world-pipeline-user-conversion-funnel)
8. [Real-World Pipeline: Inventory Aging Report](#8-real-world-pipeline-inventory-aging-report)
9. [Pattern Reference Cheat Sheet](#9-pattern-reference-cheat-sheet)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## Setup — Sample Collections

The last file walked the refinery floor, unit by unit: `$match`, `$group`, `$lookup`, `$facet`, and the rest — the full parts catalog. Knowing what each part does is one skill. Knowing which parts to bolt together, in which order, to solve an actual business question is a different skill entirely.

That's what this file is: recipes. Real questions ("who are my top earners per department?", "what's the running revenue total?", "how do I flatten this org chart?") and the exact sequence of stages that answers them — plus the wrong turns people typically take first.

Insert these collections before trying the examples:

```js
// employees — for Top-N and $graphLookup examples
db.employees.drop()
db.employees.insertMany([
  { _id: "E1", name: "Sarah Chen",    dept: "Engineering", salary: 120000, managerId: null     },
  { _id: "E2", name: "Tom Walsh",     dept: "Engineering", salary:  95000, managerId: "E1"     },
  { _id: "E3", name: "Priya Sharma",  dept: "Engineering", salary:  88000, managerId: "E1"     },
  { _id: "E4", name: "James Kim",     dept: "Engineering", salary:  78000, managerId: "E2"     },
  { _id: "E5", name: "Ana Gonzalez",  dept: "Sales",       salary:  82000, managerId: null     },
  { _id: "E6", name: "Ravi Patel",    dept: "Sales",       salary:  65000, managerId: "E5"     },
  { _id: "E7", name: "Nina Kowalski", dept: "Sales",       salary:  61000, managerId: "E5"     },
  { _id: "E8", name: "Luca Rossi",    dept: "HR",          salary:  72000, managerId: null     },
  { _id: "E9", name: "Emma Brown",    dept: "HR",          salary:  55000, managerId: "E8"     }
])

// daily_revenue — for running totals and time-series
db.daily_revenue.drop()
db.daily_revenue.insertMany([
  { date: ISODate("2025-01-01"), region: "APAC", revenue: 5200 },
  { date: ISODate("2025-01-02"), region: "APAC", revenue: 4800 },
  { date: ISODate("2025-01-03"), region: "APAC", revenue: 6100 },
  { date: ISODate("2025-01-01"), region: "EMEA", revenue: 3400 },
  { date: ISODate("2025-01-02"), region: "EMEA", revenue: 3900 },
  { date: ISODate("2025-01-03"), region: "EMEA", revenue: 2800 },
  { date: ISODate("2025-02-01"), region: "APAC", revenue: 7200 },
  { date: ISODate("2025-02-02"), region: "APAC", revenue: 6800 },
  { date: ISODate("2025-02-01"), region: "EMEA", revenue: 4100 },
  { date: ISODate("2025-02-02"), region: "EMEA", revenue: 5300 }
])

// events — for user funnel
db.events.drop()
db.events.insertMany([
  { userId: "U1", event: "page_view",   ts: ISODate("2025-03-01T10:00:00Z") },
  { userId: "U1", event: "signup",      ts: ISODate("2025-03-01T10:05:00Z") },
  { userId: "U1", event: "add_to_cart", ts: ISODate("2025-03-01T10:12:00Z") },
  { userId: "U1", event: "purchase",    ts: ISODate("2025-03-01T10:20:00Z") },
  { userId: "U2", event: "page_view",   ts: ISODate("2025-03-01T11:00:00Z") },
  { userId: "U2", event: "signup",      ts: ISODate("2025-03-01T11:08:00Z") },
  { userId: "U3", event: "page_view",   ts: ISODate("2025-03-01T12:00:00Z") },
  { userId: "U4", event: "page_view",   ts: ISODate("2025-03-01T13:00:00Z") },
  { userId: "U4", event: "signup",      ts: ISODate("2025-03-01T13:10:00Z") },
  { userId: "U4", event: "add_to_cart", ts: ISODate("2025-03-01T13:25:00Z") },
  { userId: "U5", event: "page_view",   ts: ISODate("2025-03-01T14:00:00Z") },
  { userId: "U5", event: "signup",      ts: ISODate("2025-03-01T14:15:00Z") }
])

// inventory — for aging report
db.inventory.drop()
db.inventory.insertMany([
  { sku: "A1", description: "Widget Alpha", qty: 150, receivedDate: ISODate("2024-10-01"), costPerUnit: 25 },
  { sku: "B2", description: "Widget Beta",  qty:  80, receivedDate: ISODate("2024-12-15"), costPerUnit: 45 },
  { sku: "C3", description: "Gadget Pro",   qty:  30, receivedDate: ISODate("2025-01-20"), costPerUnit: 120 },
  { sku: "D4", description: "Gadget Lite",  qty: 220, receivedDate: ISODate("2024-08-01"), costPerUnit: 15 },
  { sku: "E5", description: "Super Widget", qty:  10, receivedDate: ISODate("2025-03-01"), costPerUnit: 200 }
])
```

---

## 1. Pattern 1: Top-N Per Group

**The problem:** "give me the top 2 highest-paid employees in each department." Sounds like it should be a one-liner. It isn't.

Here's the naive move everyone tries first: sort the whole collection, then `$group` by department. Except `$group` doesn't care about the order documents arrived in — or does it? Actually it does, but only through one specific accumulator, and if you don't know which one, you'll get a department's employees back in a shuffled, unpredictable order and no clean way to grab "the top 2."

**The analogy:** think of it like sorting a deck of cards by rank first, then dealing them into 4 piles (one per suit). Because you dealt them in sorted order, the top of each pile is automatically the highest card of that suit. Deal it wrong — piles first, sort later — and you've lost that guarantee.

**The correct recipe:** sort globally first, group with `$push` (which *does* preserve arrival order) to collect each group as an array, then `$slice` that array down to N.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Top-N Per Group Algorithm                                          │
│                                                                     │
│  1. $sort by the ranking field (salary DESC)                        │
│  2. $group by the partition key (dept)                              │
│     — use $push to collect all docs in sorted order                 │
│  3. $project — $slice the accumulated array to take first N         │
│  4. $unwind (optional) to flatten back to individual docs           │
└─────────────────────────────────────────────────────────────────────┘
```

```js
db.employees.aggregate([
  // Step 1: sort by salary descending (preserves order for $first/$push)
  { $sort: { salary: -1 } },

  // Step 2: group by department, collect all employees in salary order
  { $group: {
      _id: "$dept",
      employees: {
        $push: {
          name:   "$name",
          salary: "$salary",
          id:     "$_id"
        }
      }
  }},

  // Step 3: keep only the top 2 per department
  { $project: {
      dept: "$_id",
      _id:  0,
      top2: { $slice: ["$employees", 2] }
  }},

  // Step 4: unwind to produce flat result docs (optional)
  { $unwind: "$top2" },

  // Step 5: reshape output
  { $project: {
      dept:   1,
      name:   "$top2.name",
      salary: "$top2.salary"
  }},

  { $sort: { dept: 1, salary: -1 } }
])
```

Expected output shape:
```
{ dept: "Engineering", name: "Sarah Chen",   salary: 120000 }
{ dept: "Engineering", name: "Tom Walsh",    salary:  95000 }
{ dept: "HR",          name: "Luca Rossi",   salary:  72000 }
{ dept: "HR",          name: "Emma Brown",   salary:  55000 }
{ dept: "Sales",       name: "Ana Gonzalez", salary:  82000 }
{ dept: "Sales",       name: "Ravi Patel",   salary:  65000 }
```

### Why $sort + $push works

MongoDB guarantees that `$push` preserves the order of documents as they arrive at the `$group` stage. Sort first, and that order sticks all the way through `$push` — so `$slice: ["$employees", 2]` reliably gives you the top 2, every time.

**Interview answer:** "Sort the collection by the ranking field, group by the partition key using `$push` to collect documents per group in sorted order, then `$slice` the array in a `$project` stage. This works because `$push` preserves arrival order — sorting first guarantees each group's array is already ranked."

> **Memory hook:** "Sort the deck before you deal it into piles — then the top of every pile is already the best card."

---

## 2. Pattern 2: Running Totals (Window Sums)

**The problem:** "show me APAC's cumulative revenue, day by day." Each row needs to know the sum of itself plus everything before it — a calculation that depends on the *other rows in the result*, not just its own fields. Aggregation stages normally only see one document at a time (or one group). This needs something else.

**The analogy:** it's a bank statement's running balance column. Each line doesn't just show that day's deposit — it shows the deposit *and* the balance-so-far, calculated by walking down the page in order.

MongoDB 5.0+ solves this cleanly with `$setWindowFields` — the aggregation equivalent of SQL's `OVER (PARTITION BY ... ORDER BY ...)`. Older versions need a manual self-accumulation trick.

### MongoDB 5.0+ with $setWindowFields

```js
db.daily_revenue.aggregate([
  { $match: { region: "APAC" } },
  { $sort:  { date: 1 } },
  { $setWindowFields: {
      partitionBy: "$region",
      sortBy:      { date: 1 },
      output: {
        runningTotal: {
          $sum: "$revenue",
          window: { documents: ["unbounded", "current"] }  // from first to current row
        },
        movingAvg3Day: {
          $avg: "$revenue",
          window: { documents: [-2, 0] }  // current row and 2 rows before
        }
      }
  }}
])
```

Output shape:
```
{ date: 2025-01-01, region: "APAC", revenue: 5200, runningTotal: 5200,  movingAvg3Day: 5200 }
{ date: 2025-01-02, region: "APAC", revenue: 4800, runningTotal: 10000, movingAvg3Day: 5000 }
{ date: 2025-01-03, region: "APAC", revenue: 6100, runningTotal: 16100, movingAvg3Day: 5367 }
```

### $setWindowFields window options

```
┌─────────────────────────────────────────────────────────────────────┐
│  Window type         │ Description                                  │
├─────────────────────────────────────────────────────────────────────┤
│  documents: [-N, M]  │ Row-based: N rows before, M rows after      │
│  documents: ["unbounded", "current"] │ All rows from start to now  │
│  range: [-7, 0]      │ Range-based: value offset (e.g., 7 days)    │
│  range: ["unbounded","current"]      │ All values up to current    │
└─────────────────────────────────────────────────────────────────────┘
```

### Pre-5.0 running total (self-join workaround)

Stuck on an older version? You can fake a window function with `$reduce`: collect every row into one array, then walk it manually, carrying a running accumulator forward.

```js
// Group all docs into one array, then use $reduce to accumulate
db.daily_revenue.aggregate([
  { $match:  { region: "APAC" } },
  { $sort:   { date: 1 } },
  { $group:  { _id: "$region", days: { $push: { date: "$date", revenue: "$revenue" } } } },
  { $project: {
      days: {
        $reduce: {
          input:        "$days",
          initialValue: { cumulative: 0, result: [] },
          in: {
            cumulative: { $add: ["$$value.cumulative", "$$this.revenue"] },
            result: {
              $concatArrays: [
                "$$value.result",
                [{ date: "$$this.date",
                   revenue: "$$this.revenue",
                   runningTotal: { $add: ["$$value.cumulative", "$$this.revenue"] } }]
              ]
            }
          }
        }
      }
  }},
  { $unwind: "$days.result" },
  { $replaceRoot: { newRoot: "$days.result" } }
])
```

**Interview answer:** "`$setWindowFields` (MongoDB 5.0) computes window functions — running totals, moving averages, rank — over a partition without needing self-joins. You define a partition, a sort order, and a window (`documents` or `range`) per output field; it's the aggregation equivalent of SQL's `OVER (PARTITION BY ... ORDER BY ...)`."

> **Memory hook:** "It's the running balance column on a bank statement — each line adds itself to everything above it."

---

## 3. Pattern 3: Pivot — Rows to Columns

**The problem:** your data comes in "long" form — one row per region per day — but a report or spreadsheet wants it "wide": one row per day, with each region as its own column.

**The analogy:** this is exactly what a spreadsheet pivot table does. You feed it rows, it reorganizes them so a category becomes a column header.

```
Before pivot:
{ date: "2025-01-01", region: "APAC", revenue: 5200 }
{ date: "2025-01-01", region: "EMEA", revenue: 3400 }

After pivot:
{ date: "2025-01-01", APAC: 5200, EMEA: 3400 }
```

The trick is two operators most people never touch outside this exact scenario: `$arrayToObject` turns a `{k, v}` array into real document fields, and `$mergeObjects` glues that back onto the parent document.

```js
db.daily_revenue.aggregate([
  // Step 1: group by date, push region+revenue pairs
  { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
      regions: {
        $push: { k: "$region", v: "$revenue" }
      }
  }},

  // Step 2: use $arrayToObject to convert array of k/v pairs into an object
  { $project: {
      date:    "$_id",
      _id:     0,
      revenue: { $arrayToObject: "$regions" }
  }},

  // Step 3: merge "revenue" object into root
  { $replaceRoot: {
      newRoot: { $mergeObjects: [ { date: "$date" }, "$revenue" ] }
  }},

  { $sort: { date: 1 } }
])
```

Expected output:
```
{ date: "2025-01-01", APAC: 5200, EMEA: 3400 }
{ date: "2025-01-02", APAC: 4800, EMEA: 3900 }
{ date: "2025-01-03", APAC: 6100, EMEA: 2800 }
{ date: "2025-02-01", APAC: 7200, EMEA: 4100 }
{ date: "2025-02-02", APAC: 6800, EMEA: 5300 }
```

### Key operators used

| Operator | Purpose |
|----------|---------|
| `$dateToString` | Formats a Date as a string |
| `$arrayToObject` | Converts `[{k, v}]` array to a document `{k: v}` |
| `$mergeObjects` | Merges two or more documents into one |
| `$$ROOT` | System variable for the current root document |

**Interview answer:** "Group by the date/dimension key and push `{k: fieldName, v: value}` pairs into an array. Apply `$arrayToObject` to turn that array into a document where each category becomes a field, then `$replaceRoot` with `$mergeObjects` to promote those fields onto the document root."

> **Memory hook:** "It's a spreadsheet pivot table — categories walk from being row values to being column headers."

---

## 4. Pattern 4: Graph Traversal with $graphLookup

**The problem:** "find everyone who reports to Sarah, directly or indirectly" or "find James's entire chain of command." A regular `$lookup` joins one level. But an org chart, a bill-of-materials, or a friends-of-friends graph can be arbitrarily deep — you don't know in advance how many levels to join.

**The analogy:** it's a family tree search. You don't ask "who's my parent, and who's my grandparent, and who's my great-grandparent" as three separate questions — you say "follow the parent link upward until it stops," and let the traversal do the walking.

`$graphLookup` performs **recursive graph traversal** within a single collection. It follows edges (like `managerId → _id`) up or down a tree/graph, however many hops it takes.

```
Org Chart:
                    Sarah Chen (E1)
                   /               \
           Tom Walsh (E2)    Priya Sharma (E3)
           /
   James Kim (E4)
```

### Syntax

```js
{ $graphLookup: {
    from:                    <collection>,        // same collection for self-referential
    startWith:               <expression>,        // initial value(s) to search for
    connectFromField:        <field name>,        // field in found docs to follow next
    connectToField:          <field name>,        // field to match against
    as:                      <output field>,      // array of traversal results
    maxDepth:                <number>,            // optional: limit traversal depth
    depthField:              <field name>,        // optional: add depth level to each result
    restrictSearchWithMatch: <query>              // optional: filter during traversal
} }
```

### Example 1: Find all reports under a manager (downward traversal)

```js
// Find everyone who reports to Sarah Chen (directly or indirectly)
db.employees.aggregate([
  { $match: { name: "Sarah Chen" } },
  { $graphLookup: {
      from:             "employees",
      startWith:        "$_id",           // start with Sarah's _id
      connectFromField: "_id",            // each found employee's _id...
      connectToField:   "managerId",      // ...is matched against managerId of others
      as:               "directReports",
      depthField:       "reportingDepth"
  }},
  { $project: { name: 1, directReports: { name: 1, dept: 1, reportingDepth: 1 } } }
])
```

### Example 2: Find the full management chain above an employee (upward traversal)

```js
// James Kim wants to know his entire chain of command
db.employees.aggregate([
  { $match: { name: "James Kim" } },
  { $graphLookup: {
      from:             "employees",
      startWith:        "$managerId",     // start with James's manager
      connectFromField: "managerId",      // follow managerId up the chain
      connectToField:   "_id",            // match _id of managers
      as:               "managementChain",
      depthField:       "level"
  }},
  { $project: { name: 1, managementChain: { name: 1, dept: 1, level: 1 } } }
])
// Returns: Tom Walsh (level 0), Sarah Chen (level 1)
```

### Example 3: Limit traversal depth and restrict by department

```js
db.employees.aggregate([
  { $match: { managerId: null } },  // start from all top-level managers
  { $graphLookup: {
      from:                    "employees",
      startWith:               "$_id",
      connectFromField:        "_id",
      connectToField:          "managerId",
      as:                      "team",
      maxDepth:                2,              // only go 2 levels deep
      depthField:              "depth",
      restrictSearchWithMatch: { dept: "Engineering" }  // only follow Engineering nodes
  }}
])
```

### When to use $graphLookup vs multiple $lookups

```
┌──────────────────────┬──────────────────────────────────────────────────┐
│ Use $graphLookup     │ When the depth is unknown (tree of variable depth)│
│                      │ Self-referential relationships (org chart, BOM)   │
│                      │ Recursive category hierarchies                    │
│                      │ Social graph traversal (friends of friends)       │
├──────────────────────┼──────────────────────────────────────────────────┤
│ Use multiple $lookup │ When depth is fixed and known in advance          │
│                      │ Joining different collections at each level       │
└──────────────────────┴──────────────────────────────────────────────────┘
```

### Common mistakes

Two traps people fall into with `$graphLookup`:

- **Forgetting `maxDepth` on a graph that might have cycles.** `$graphLookup` does deduplicate visited nodes internally, so it won't loop forever — but an unbounded traversal on a very deep or very wide graph can still explode memory. Set `maxDepth` as a safety net, not just an optimization.
- **Mixing up `startWith` direction.** Going downward (manager → reports) starts with `$_id` and connects `_id → managerId`. Going upward (employee → chain of command) starts with `$managerId` and connects `managerId → _id`. Swap these and you'll traverse the wrong direction entirely.

**Interview answer:** "`$graphLookup` performs recursive traversal of a graph stored in a collection, following edges defined by matching a `connectFromField` against a `connectToField` in the same collection. Typical use cases: org hierarchies, bills-of-materials, social graph friend-of-friend queries, and recursive category trees. `maxDepth` bounds the traversal and `restrictSearchWithMatch` filters which nodes get followed."

> **Memory hook:** "Don't ask for parent, then grandparent, then great-grandparent one at a time — just say 'follow the line up until it stops.'"

---

## 5. Pattern 5: Time-Series Analysis

**The problem:** dates aren't directly useful for grouping — you don't group by an exact timestamp, you group by "which month," "which hour," "which day of week." MongoDB gives you a full toolkit of date-extraction operators for exactly this.

### Date extraction operators

```js
{ $project: {
  year:        { $year:        "$date" },   // 2025
  month:       { $month:       "$date" },   // 1-12
  dayOfMonth:  { $dayOfMonth:  "$date" },   // 1-31
  dayOfWeek:   { $dayOfWeek:   "$date" },   // 1 (Sun) - 7 (Sat)
  dayOfYear:   { $dayOfYear:   "$date" },   // 1-366
  hour:        { $hour:        "$date" },   // 0-23
  minute:      { $minute:      "$date" },   // 0-59
  week:        { $week:        "$date" },   // 0-53 (ISO week)
  isoWeek:     { $isoWeek:     "$date" },   // 1-53 (ISO 8601)
  isoWeekYear: { $isoWeekYear: "$date" }    // 2025
} }
```

### $dateToString — flexible formatting

```js
{ $dateToString: {
    format: "%Y-%m-%d",   // "2025-01-15"
    date:   "$createdAt",
    timezone: "Australia/Sydney"  // optional timezone
} }
```

Common format strings:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `%Y` | 4-digit year | 2025 |
| `%m` | 2-digit month | 01 |
| `%d` | 2-digit day | 15 |
| `%H` | 2-digit hour (24h) | 14 |
| `%M` | 2-digit minute | 30 |
| `%S` | 2-digit second | 00 |
| `%j` | Day of year | 015 |

### Monthly revenue trend with month-over-month change

This one combines a lot of what came before: group by month, sort chronologically, then reach for the same "walk the array with an index" trick from the running-total pattern to compare each month against the one before it.

```js
db.daily_revenue.aggregate([
  // Step 1: group by year + month
  { $group: {
      _id: {
        year:  { $year:  "$date" },
        month: { $month: "$date" }
      },
      monthlyRevenue: { $sum: "$revenue" }
  }},

  // Step 2: sort chronologically
  { $sort: { "_id.year": 1, "_id.month": 1 } },

  // Step 3: collect into array for window calculation
  { $group: {
      _id: null,
      months: { $push: { year: "$_id.year", month: "$_id.month", revenue: "$monthlyRevenue" } }
  }},

  // Step 4: add indexes to compute MoM change
  { $project: {
      months: {
        $map: {
          input: { $range: [0, { $size: "$months" }] },
          as:    "i",
          in: {
            year:    { $arrayElemAt: ["$months.year",    "$$i"] },
            month:   { $arrayElemAt: ["$months.month",   "$$i"] },
            revenue: { $arrayElemAt: ["$months.revenue", "$$i"] },
            prevRevenue: {
              $cond: {
                if:   { $gt: ["$$i", 0] },
                then: { $arrayElemAt: ["$months.revenue", { $subtract: ["$$i", 1] }] },
                else: null
              }
            }
          }
        }
      }
  }},
  { $unwind: "$months" },
  { $replaceRoot: { newRoot: "$months" } },
  { $addFields: {
      momChange: {
        $cond: {
          if:   { $and: [ { $ne: ["$prevRevenue", null] }, { $ne: ["$prevRevenue", 0] } ] },
          then: { $multiply: [
            { $divide: [ { $subtract: ["$revenue", "$prevRevenue"] }, "$prevRevenue" ] },
            100
          ]},
          else: null
        }
      }
  }}
])
```

### Hour-of-day analysis (peak traffic)

```js
db.events.aggregate([
  { $group: {
      _id:   { $hour: "$ts" },
      count: { $sum: 1 }
  }},
  { $sort:  { _id: 1 } },
  { $project: {
      hour:  "$_id",
      count: 1,
      _id:   0,
      label: {
        $concat: [
          { $toString: "$_id" }, ":00 - ",
          { $toString: { $add: ["$_id", 1] } }, ":00"
        ]
      }
  }}
])
```

**Interview answer:** "Use `$year`, `$month`, `$dayOfMonth` and similar operators inside `$project` or `$group` to bucket documents by calendar unit. For display, `$dateToString` formats a date with a pattern like `%Y-%m`. For timezone-aware extraction, pass a `timezone` option, e.g. `{ $month: { date: "$createdAt", timezone: "Australia/Sydney" } }`."

> **Memory hook:** "You never group by the exact second something happened — you group by which bucket of the calendar it falls into."

---

## 6. Real-World Pipeline: Monthly Sales Report

Time to combine several patterns into one pipeline that actually resembles what a stakeholder would ask for: total revenue, order count, average order value, top customer, and a product breakdown — for a given month, in a single query.

**The shape of the ask:** one filtered dataset, several different summaries of it. That's the signature of `$facet` — run the same filtered input through multiple independent sub-pipelines side by side, instead of scanning the collection three separate times for three separate reports.

```js
const YEAR  = 2025
const MONTH = 1

db.orders.aggregate([
  // ── FILTER ──────────────────────────────────────────────────────────
  { $match: {
      status:    "completed",
      createdAt: {
        $gte: new Date(YEAR, MONTH - 1, 1),
        $lt:  new Date(YEAR, MONTH,     1)
      }
  }},

  // ── ENRICH WITH CUSTOMER DATA ────────────────────────────────────────
  { $lookup: {
      from:         "customers",
      localField:   "customerId",
      foreignField: "_id",
      as:           "customer"
  }},
  { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },

  // ── ADD COMPUTED FIELDS ──────────────────────────────────────────────
  { $addFields: {
      orderTotal: {
        $sum: {
          $map: {
            input: "$items",
            as:    "item",
            in:    { $multiply: ["$$item.qty", "$$item.price"] }
          }
        }
      }
  }},

  // ── MULTI-DIMENSIONAL REPORT ─────────────────────────────────────────
  { $facet: {

      // Overall summary
      summary: [
        { $group: {
            _id:         null,
            totalOrders:   { $sum: 1 },
            totalRevenue:  { $sum: "$orderTotal" },
            avgOrderValue: { $avg: "$orderTotal" },
            uniqueCustomers: { $addToSet: "$customerId" }
        }},
        { $project: {
            _id:            0,
            totalOrders:    1,
            totalRevenue:   1,
            avgOrderValue:  { $round: ["$avgOrderValue", 2] },
            customerCount:  { $size: "$uniqueCustomers" }
        }}
      ],

      // Revenue by customer, sorted descending
      topCustomers: [
        { $group: {
            _id:          "$customerId",
            name:         { $first: "$customer.name" },
            orderCount:   { $sum: 1 },
            totalRevenue: { $sum: "$orderTotal" }
        }},
        { $sort:  { totalRevenue: -1 } },
        { $limit: 5 }
      ],

      // Revenue per product SKU
      revenueByProduct: [
        { $unwind: "$items" },
        { $group: {
            _id:     "$items.sku",
            qty:     { $sum: "$items.qty" },
            revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
        }},
        { $sort: { revenue: -1 } }
      ]
  }}
])
```

Pipeline flow diagram:

```
orders (completed, Jan 2025)
        │
        ▼
   $lookup + $unwind
   (enrich with customer)
        │
        ▼
   $addFields
   (compute orderTotal)
        │
        ▼
   $facet ─────────────────────────────────────┐
     │                                          │
     ├── summary sub-pipeline                  │
     │   $group(null) → summary stats          │
     │                                          │
     ├── topCustomers sub-pipeline             │
     │   $group(customerId) → $sort → $limit   │
     │                                          │
     └── revenueByProduct sub-pipeline ────────┘
         $unwind(items) → $group(sku) → $sort
```

Notice the shared `$match` + `$lookup` + `$addFields` prefix runs once — the collection is scanned a single time, and `$facet` just fans the resulting stream out into three parallel summaries. That's the whole reason to reach for `$facet` instead of three separate `aggregate()` calls.

**Interview answer:** "Use `$facet` when you need multiple aggregations over the same filtered dataset and want to avoid re-scanning the collection — the shared `$match`/`$lookup` prefix runs once, then fans out into independent sub-pipelines. Run separate aggregations instead when the filters genuinely differ, when the dataset is too large to hold in memory for `$facet`'s 100 MB limit, or when the sub-pipelines share nothing meaningful."

> **Memory hook:** "One scan through the warehouse, three different clipboards filled out at the same time."

---

## 7. Real-World Pipeline: User Conversion Funnel

**The problem:** "of everyone who viewed a page, how many signed up, added to cart, and actually purchased?" This is the classic marketing funnel — page_view → signup → add_to_cart → purchase — and it needs the conversion rate between every consecutive pair of steps.

```js
const FUNNEL_STEPS = ["page_view", "signup", "add_to_cart", "purchase"]

db.events.aggregate([
  // Step 1: group events by user, collect unique event types
  { $group: {
      _id:    "$userId",
      events: { $addToSet: "$event" }
  }},

  // Step 2: for each funnel step, check if user completed it
  { $project: {
      userId: "$_id",
      _id:    0,
      completedPageView:  { $in: ["page_view",   "$events"] },
      completedSignup:    { $in: ["signup",       "$events"] },
      completedAddToCart: { $in: ["add_to_cart",  "$events"] },
      completedPurchase:  { $in: ["purchase",     "$events"] }
  }},

  // Step 3: count users at each funnel step
  { $group: {
      _id:             null,
      pageViews:       { $sum: { $cond: ["$completedPageView",  1, 0] } },
      signups:         { $sum: { $cond: ["$completedSignup",    1, 0] } },
      addsToCarts:     { $sum: { $cond: ["$completedAddToCart", 1, 0] } },
      purchases:       { $sum: { $cond: ["$completedPurchase",  1, 0] } }
  }},

  // Step 4: compute conversion rates
  { $project: {
      _id:              0,
      pageViews:        1,
      signups:          1,
      addsToCarts:      1,
      purchases:        1,
      signupRate:       { $round: [{ $multiply: [{ $divide: ["$signups",     "$pageViews"] },     100] }, 1] },
      cartRate:         { $round: [{ $multiply: [{ $divide: ["$addsToCarts", "$signups"] },       100] }, 1] },
      purchaseRate:     { $round: [{ $multiply: [{ $divide: ["$purchases",   "$addsToCarts"] },   100] }, 1] },
      overallConversion:{ $round: [{ $multiply: [{ $divide: ["$purchases",   "$pageViews"] },     100] }, 1] }
  }}
])
```

Expected output (with sample data):
```json
{
  "pageViews": 5,
  "signups": 4,
  "addsToCarts": 2,
  "purchases": 1,
  "signupRate": 80.0,
  "cartRate": 50.0,
  "purchaseRate": 50.0,
  "overallConversion": 20.0
}
```

```
Funnel visualization:
█████████████████████████  5 page views   (100%)
████████████████████       4 signups      (80%)
██████████                 2 add-to-carts (40%)
█████                      1 purchase     (20%)
```

Every layer of the funnel narrows — that's the whole point of the visualization. `$addToSet` is doing the quiet but important work here: it collapses each user's event history down to "which distinct event types did they trigger," so a user who viewed the page five times still only counts once.

---

## 8. Real-World Pipeline: Inventory Aging Report

**The problem:** warehouse stock doesn't stay equally useful forever. Something that arrived 8 months ago and hasn't sold is a very different concern than something that arrived last week. The business wants stock bucketed into Fresh (< 30 days), Aging (30-90 days), Stale (90-180 days), and Dead Stock (> 180 days) — sorted so the most urgent category shows up first.

```js
db.inventory.aggregate([
  // Step 1: compute age in days relative to today
  { $addFields: {
      ageDays: {
        $divide: [
          { $subtract: [ new Date(), "$receivedDate" ] },
          1000 * 60 * 60 * 24   // milliseconds to days
        ]
      }
  }},

  // Step 2: add age category
  { $addFields: {
      ageCategory: {
        $switch: {
          branches: [
            { case: { $lt:  ["$ageDays", 30]  }, then: "Fresh"      },
            { case: { $lt:  ["$ageDays", 90]  }, then: "Aging"      },
            { case: { $lt:  ["$ageDays", 180] }, then: "Stale"      }
          ],
          default: "Dead Stock"
        }
      },
      totalCost: { $multiply: ["$qty", "$costPerUnit"] }
  }},

  // Step 3: summarize by category
  { $group: {
      _id:        "$ageCategory",
      skuCount:   { $sum: 1 },
      totalUnits: { $sum: "$qty" },
      totalValue: { $sum: "$totalCost" },
      items:      { $push: { sku: "$sku", description: "$description",
                             qty: "$qty", ageDays: { $round: ["$ageDays", 0] } } }
  }},

  // Step 4: add priority sort order
  { $addFields: {
      sortOrder: {
        $switch: {
          branches: [
            { case: { $eq: ["$_id", "Dead Stock"] }, then: 1 },
            { case: { $eq: ["$_id", "Stale"]      }, then: 2 },
            { case: { $eq: ["$_id", "Aging"]      }, then: 3 }
          ],
          default: 4
        }
      }
  }},

  { $sort:  { sortOrder: 1 } },
  { $project: { sortOrder: 0 } }  // remove helper field
])
```

Notice the `sortOrder` field only exists to control ordering, then gets stripped in the final `$project` — a small, common trick: compute a helper field purely to sort by, then discard it before returning results.

---

## 9. Pattern Reference Cheat Sheet

```
┌─────────────────────────────┬──────────────────────────────────────────────┐
│ Pattern                     │ Key Stages                                   │
├─────────────────────────────┼──────────────────────────────────────────────┤
│ Top-N per group             │ $sort → $group($push) → $project($slice)     │
│ Running total               │ $setWindowFields (5.0+) or $reduce trick     │
│ Moving average              │ $setWindowFields with documents window        │
│ Pivot (rows to columns)     │ $group($push {k,v}) → $arrayToObject         │
│ Org chart / BOM traversal   │ $graphLookup (recursive)                     │
│ Monthly/daily grouping      │ $group with $year/$month/$dayOfMonth          │
│ Time-series formatting      │ $dateToString                                 │
│ Null-safe join              │ $lookup + $unwind(preserveNullAndEmptyArrays) │
│ Multi-metric dashboard      │ $facet with multiple sub-pipelines            │
│ Histogram / bucketing       │ $bucket or $bucketAuto                        │
│ Incremental materialized view│ $merge (whenMatched: "replace")             │
│ Full refresh derived coll.  │ $out                                          │
│ Funnel analysis             │ $group($addToSet) → $project($in) → $group   │
│ Array element enrichment    │ $map over array, then $unwind if needed       │
│ Deduplication               │ $group(_id: $field) → discard                │
└─────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 10. Hands-On Exercises

### Exercise 1 — Top-2 earners per department

Using the `employees` collection, write a pipeline that returns the top 2 highest-paid employees per department. Output should include: `dept`, `rank` (1 or 2), `name`, and `salary`.

<details>
<summary>Solution</summary>

```js
db.employees.aggregate([
  { $sort: { salary: -1 } },
  { $group: {
      _id: "$dept",
      top: { $push: { name: "$name", salary: "$salary" } }
  }},
  { $project: {
      dept: "$_id",
      _id:  0,
      top2: { $slice: ["$top", 2] }
  }},
  { $unwind: { path: "$top2", includeArrayIndex: "rankIndex" } },
  { $project: {
      dept:   1,
      name:   "$top2.name",
      salary: "$top2.salary",
      rank:   { $add: ["$rankIndex", 1] }
  }},
  { $sort: { dept: 1, rank: 1 } }
])
```
</details>

---

### Exercise 2 — Daily revenue running total for EMEA

Using `daily_revenue`, compute the cumulative revenue for EMEA sorted by date ascending. Use `$setWindowFields` if available, or the `$reduce` pattern otherwise.

<details>
<summary>Solution ($setWindowFields)</summary>

```js
db.daily_revenue.aggregate([
  { $match: { region: "EMEA" } },
  { $sort:  { date: 1 } },
  { $setWindowFields: {
      partitionBy: "$region",
      sortBy:      { date: 1 },
      output: {
        runningTotal: {
          $sum: "$revenue",
          window: { documents: ["unbounded", "current"] }
        }
      }
  }},
  { $project: { _id: 0, date: 1, region: 1, revenue: 1, runningTotal: 1 } }
])
```
</details>

---

### Exercise 3 — Pivot daily revenue into wide format

Transform `daily_revenue` so that each output document represents one date with columns for each region's revenue: `{ date, APAC, EMEA }`.

<details>
<summary>Solution</summary>

```js
db.daily_revenue.aggregate([
  { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
      cols: { $push: { k: "$region", v: "$revenue" } }
  }},
  { $project: {
      date:    "$_id",
      _id:     0,
      revenue: { $arrayToObject: "$cols" }
  }},
  { $replaceRoot: {
      newRoot: { $mergeObjects: [ { date: "$date" }, "$revenue" ] }
  }},
  { $sort: { date: 1 } }
])
```
</details>

---

### Exercise 4 — Management chain of James Kim

Using `$graphLookup`, find the full chain of managers above James Kim (E4). Output each manager's name and their distance from James (0 = direct manager, 1 = manager's manager, etc.).

<details>
<summary>Solution</summary>

```js
db.employees.aggregate([
  { $match: { name: "James Kim" } },
  { $graphLookup: {
      from:             "employees",
      startWith:        "$managerId",
      connectFromField: "managerId",
      connectToField:   "_id",
      as:               "chain",
      depthField:       "distance"
  }},
  { $project: {
      _id:  0,
      name: 1,
      chain: { $map: {
        input: "$chain",
        as:    "m",
        in:    { name: "$$m.name", distance: "$$m.distance" }
      }}
  }}
])
```
</details>

---

### Exercise 5 — Inventory aging with total dead-stock value

From the `inventory` collection, compute the total monetary value (`qty * costPerUnit`) of all items classified as "Dead Stock" (received more than 180 days ago).

<details>
<summary>Solution</summary>

```js
db.inventory.aggregate([
  { $addFields: {
      ageDays: {
        $divide: [
          { $subtract: [ new Date(), "$receivedDate" ] },
          86400000   // ms per day
        ]
      }
  }},
  { $match: { ageDays: { $gt: 180 } } },
  { $group: {
      _id:            "Dead Stock",
      totalValue:     { $sum: { $multiply: ["$qty", "$costPerUnit"] } },
      totalUnits:     { $sum: "$qty" },
      skuCount:       { $sum: 1 },
      items:          { $push: "$sku" }
  }}
])
```
</details>

---

## 11. Interview Q&A

**Q1. How do you find the top-N documents per group in MongoDB?**

A: Sort the collection by the ranking field, then group by the partition key using `$push` to collect all documents per group in sorted order. Finally, use `$slice` in a `$project` stage to keep only the first N elements of the collected array. This works because MongoDB's `$push` accumulator preserves the document order as documents arrive at `$group` — if you sort first, the order is maintained.

---

**Q2. What is $setWindowFields and when was it introduced?**

A: `$setWindowFields` (MongoDB 5.0) is a stage that computes window functions — calculations over a sliding or expanding range of documents in a partition. It enables running totals, moving averages, rank, and dense rank without the workarounds needed in older versions. It is the equivalent of SQL's `OVER (PARTITION BY ... ORDER BY ...)` syntax. You define a partition (`partitionBy`), a sort order (`sortBy`), and a window (`documents` or `range`) for each output field.

---

**Q3. How do you perform a pivot (rows to columns) in MongoDB?**

A: Group by the date/dimension key and use `$push` with `{k: fieldName, v: value}` to build an array of key-value pairs. Then apply `$arrayToObject` to convert that array into a document where each region/category becomes a field. Finally use `$replaceRoot` with `$mergeObjects` to promote those fields to the document root.

---

**Q4. What is $graphLookup and what are its use cases?**

A: `$graphLookup` performs recursive traversal of a graph stored in a collection. It follows edges defined by matching a `connectFromField` in found documents against a `connectToField` in the same collection. Use cases include: organizational hierarchy traversal, bill-of-materials (parts containing sub-parts), social graph friend-of-friend queries, and recursive category trees. You can limit depth with `maxDepth` and filter traversed nodes with `restrictSearchWithMatch`.

---

**Q5. How do you extract just the month and year from a date in an aggregation pipeline?**

A: Use `$year` and `$month` operators in `$project` or `$group`: `{ year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }`. For string formatting, use `$dateToString` with a format string like `"%Y-%m"`. For timezone-aware extraction, pass a `timezone` option: `{ $month: { date: "$createdAt", timezone: "Australia/Sydney" } }`.

---

**Q6. What is the difference between $mergeObjects and $arrayToObject?**

A: `$mergeObjects` takes two or more document expressions and merges their fields into a single document — later fields overwrite earlier ones on conflict. `$arrayToObject` converts an array of `{k, v}` pairs (or two-element arrays) into a document. They are often used together in pivot operations: `$arrayToObject` builds the wide-format document from an accumulated array, and `$mergeObjects` combines it with the parent document.

---

**Q7. How would you compute a month-over-month growth percentage in an aggregation?**

A: Group by year and month, sort chronologically, then use `$setWindowFields` with a `documents: [-1, 0]` range to access the previous month's value alongside the current. Compute the percentage change with `$subtract` and `$divide`. In pre-5.0 MongoDB, use `$group(null)` with `$push` to collect all months into an array, then use `$map` with index arithmetic to access adjacent elements via `$arrayElemAt`.

---

**Q8. When would you use $facet vs running the aggregations separately?**

A: Use `$facet` when you need multiple aggregations over the **same filtered dataset** and want to avoid re-scanning the collection. It saves one collection scan (the shared `$match` before `$facet` runs once). Use separate aggregations when: the datasets differ significantly (different filters), the input is so large that holding it in memory for `$facet` hits the 100 MB limit, or the sub-pipelines are so different that sharing the input brings no benefit.

---

**Q9. What is the maxDepth option in $graphLookup and why is it important?**

A: `maxDepth` limits how many recursive hops `$graphLookup` will follow. Without it, the traversal continues until no more matching edges are found — which is correct for finite graphs but dangerous for cyclic graphs (infinite loop) or very deep trees (memory explosion). Always set `maxDepth` when the graph might contain cycles or when you only need a bounded depth (e.g., "find all employees up to 3 levels below the CEO").

---

**Q10. How do you detect and handle cyclic references in $graphLookup?**

A: `$graphLookup` automatically detects cycles and stops revisiting nodes it has already seen — it tracks visited `connectToField` values and will not follow the same edge twice. So you do not need to handle cycles manually. However, you should still set `maxDepth` as a safety bound and verify your data model does not have unintentional cycles that might produce misleading results.

---

*End of Phase 5 — Aggregation. Proceed to Phase 6: Transactions and Data Modeling.*
