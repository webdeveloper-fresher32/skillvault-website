# MongoDB Query Optimization

> Phase 08 — Performance | File 01 of 02

---

## Table of Contents

1. [Why Query Optimization Matters](#1-why-query-optimization-matters)
2. [The explain() Method — Three Verbosity Modes](#2-the-explain-method--three-verbosity-modes)
   - 2.1 [queryPlanner Mode](#21-queryplanner-mode)
   - 2.2 [executionStats Mode](#22-executionstats-mode)
   - 2.3 [allPlansExecution Mode](#23-allplansexecution-mode)
3. [Reading Execution Stats — Ratio Analysis](#3-reading-execution-stats--ratio-analysis)
   - 3.1 [nReturned](#31-nreturned)
   - 3.2 [nDocsExamined](#32-ndocsexamined)
   - 3.3 [nKeysExamined](#33-nkeysexamined)
   - 3.4 [Efficiency Ratios and What They Signal](#34-efficiency-ratios-and-what-they-signal)
4. [db.currentOp() — Inspecting Active Operations](#4-dbcurrentop--inspecting-active-operations)
5. [mongostat — Operations Per Second](#5-mongostat--operations-per-second)
6. [mongotop — Time Per Collection](#6-mongotop--time-per-collection)
7. [Slow Query Log and slowms](#7-slow-query-log-and-slowms)
8. [Patterns to Avoid](#8-patterns-to-avoid)
   - 8.1 [$where Operator](#81-where-operator)
   - 8.2 [Regex Without Anchor](#82-regex-without-anchor)
   - 8.3 [Large $in Arrays](#83-large-in-arrays)
   - 8.4 [Missing Indexes on Filter Fields](#84-missing-indexes-on-filter-fields)
9. [Projection to Limit Data Transfer](#9-projection-to-limit-data-transfer)
10. [Read Preferences](#10-read-preferences)
11. [Optimization Checklist](#11-optimization-checklist)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Query Optimization Matters

Picture this: it's 2am, an alert fires, and one query that used to return in 5ms is now taking 5 seconds. Nothing in the code changed. What changed is the data — it grew. That's the entire chapter in one sentence: **the query didn't get slower, the collection got bigger, and nobody was watching.**

Real-world analogy: imagine a library with 10 million books and no card catalog. A bad query is the librarian walking every aisle, reading the title of every single book, looking for the three about "MongoDB." A good query — backed by an index — is the librarian walking straight to the card catalog, looking up "MongoDB," and walking directly to shelf 4B. Same library, same books, wildly different amount of walking.

That's really all "query optimization" is: making sure MongoDB always has a card catalog to consult, and knowing how to check whether it's actually using one.

---

### The problem, in numbers

Here's why this sneaks up on teams. The query and the code never change — only the row count does:

```
Performance degradation without optimization:
                                                           
  10K docs ──── 5ms  ──► OK                                
  100K docs ─── 50ms ──► Acceptable                        
  1M docs ───── 5s   ──► Slow (COLLSCAN)                   
  10M docs ────50s   ──► Unacceptable                       
                                                           
  Same query, same hardware — only document count changes. 
```

Notice the query was "fine" for the first three rows of that table. That's exactly why this bites teams in production and never in a demo — nobody load-tests with 10 million documents before launch.

---

### The three-part toolkit

Fixing this kind of problem always breaks down into the same three moves: understand what's happening, diagnose what's currently slow, then fix it.

```
┌────────────────────────────────────────────────────┐
│           QUERY OPTIMIZATION PILLARS               │
├──────────────────┬─────────────────┬───────────────┤
│   UNDERSTAND     │    DIAGNOSE     │     FIX        │
│                  │                 │                │
│  explain()       │  currentOp()    │  Add indexes   │
│  Execution stats │  mongostat      │  Rewrite query │
│  Query plans     │  mongotop       │  Project only  │
│                  │  Slow query log │  needed fields │
└──────────────────┴─────────────────┴───────────────┘
```

Everything in this file is one of those three columns. Keep that table in the back of your mind — it's the map for the rest of the chapter.

---

## 2. The explain() Method — Three Verbosity Modes

Here's the question `explain()` answers: "MongoDB, what are you actually going to do with this query — and how do I know before I find out the hard way in production?"

Think of `explain()` as asking a GPS for the route *before* you drive, instead of just hitting "start" and hoping. You can append it to any find(), aggregate(), update(), or delete() operation.

### Syntax

```js
// On a cursor
db.collection.find(query).explain(verbosity)

// On a query object
db.collection.explain(verbosity).find(query)

// On an aggregation
db.collection.explain(verbosity).aggregate(pipeline)
```

`explain()` isn't one mode — it's three, and they trade off information against cost. Think of them as three different ways to ask "how would this go?": one that just reads the map, one that does a real test-drive, and one that test-drives every possible route to compare them.

```
┌────────────────────────────────────────────────────────────────┐
│               explain() VERBOSITY SPECTRUM                     │
│                                                                │
│  queryPlanner ──────── executionStats ──── allPlansExecution   │
│                                                                │
│  Does NOT run     Runs winning plan     Runs ALL candidate     │
│  the query        and collects stats    plans and compares     │
│                                                                │
│  Fastest          Balanced              Most information       │
│  (no I/O)         (some I/O)            (most I/O)             │
└────────────────────────────────────────────────────────────────┘
```

---

### 2.1 queryPlanner Mode

`queryPlanner` is the default mode, and it's the safest one — MongoDB works out which plan it *would* use, but never actually executes the query. No documents get touched. That's why you can run this on a live production database at 2pm on Black Friday without a second thought.

```js
db.orders.find({ status: "pending", userId: 42 }).explain("queryPlanner")
```

Output structure (key fields):

```json
{
  "queryPlanner": {
    "plannerVersion": 1,
    "namespace": "mydb.orders",
    "indexFilterSet": false,
    "parsedQuery": {
      "$and": [
        { "status": { "$eq": "pending" } },
        { "userId": { "$eq": 42 } }
      ]
    },
    "winningPlan": {
      "stage": "FETCH",
      "inputStage": {
        "stage": "IXSCAN",
        "keyPattern": { "userId": 1, "status": 1 },
        "indexName": "userId_1_status_1",
        "direction": "forward",
        "indexBounds": {
          "userId": [ "[42, 42]" ],
          "status": [ "[\"pending\", \"pending\"]" ]
        }
      }
    },
    "rejectedPlans": []
  }
}
```

What to look for in queryPlanner:
- `winningPlan.stage` — is it IXSCAN or COLLSCAN?
- `indexName` — which index was chosen?
- `indexBounds` — is the index scan range tight or wide?
- `rejectedPlans` — were other indexes considered?

---

### 2.2 executionStats Mode

This is the one you'll reach for 90% of the time. `queryPlanner` tells you the *plan* — `executionStats` actually runs it and tells you what really happened: how many documents got touched, how long it took, how much work was wasted.

```js
db.orders.find({ status: "pending", userId: 42 }).explain("executionStats")
```

Output includes everything from queryPlanner PLUS:

```json
{
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 3,
    "executionTimeMillis": 2,
    "totalKeysExamined": 3,
    "totalDocsExamined": 3,
    "executionStages": {
      "stage": "FETCH",
      "nReturned": 3,
      "executionTimeMillisEstimate": 0,
      "works": 4,
      "advanced": 3,
      "needTime": 0,
      "needYield": 0,
      "saveState": 0,
      "restoreState": 0,
      "isEOF": 1,
      "docsExamined": 3,
      "inputStage": {
        "stage": "IXSCAN",
        "nReturned": 3,
        "keysExamined": 3,
        "indexName": "userId_1_status_1"
      }
    }
  }
}
```

Here's a small internal detail worth knowing: every call into a stage increments a `works` counter. A FETCH stage with `works: 4` and `nReturned: 3` simply means 3 documents were returned plus one final "I'm done" (EOF) signal. If you ever see `works` climbing much higher than `nReturned`, that's the stage doing a lot of churning for not much payoff.

---

### 2.3 allPlansExecution Mode

Sometimes you don't just want to know which plan won — you want to know *how close* the runner-up was, or whether MongoDB is quietly making a bad call. That's what `allPlansExecution` is for: it runs every candidate plan side-by-side during a trial period (a "race" — whichever plan returns 101 documents, or finishes, first wins) and reports stats for each.

```js
db.orders.find({ status: "pending", userId: 42 }).explain("allPlansExecution")
```

This mode reveals:
- Why MongoDB picked one index over another
- Whether a rejected plan was close in performance
- Whether index selection might flip with different data distributions

```json
{
  "allPlansExecution": [
    {
      "nReturned": 3,
      "executionTimeMillisEstimate": 0,
      "totalKeysExamined": 3,
      "totalDocsExamined": 3,
      "executionStages": { "stage": "IXSCAN", "indexName": "userId_1_status_1" }
    },
    {
      "nReturned": 3,
      "executionTimeMillisEstimate": 5,
      "totalKeysExamined": 150,
      "totalDocsExamined": 150,
      "executionStages": { "stage": "IXSCAN", "indexName": "status_1" }
    }
  ]
}
```

Look at the difference: the first plan scanned 3 keys to return 3 documents. The second scanned 150 keys for the same 3 documents. MongoDB correctly picked the first one — but you'd never know *how much* better it was without running this mode.

When to reach for allPlansExecution:
- Index selection looks wrong (MongoDB chose a suboptimal index)
- After adding a new index, to confirm it is being used
- Investigating query plan cache invalidation issues

---

## 3. Reading Execution Stats — Ratio Analysis

Here's the single most useful trick in this entire file: three numbers, compared to each other, tell you almost everything about whether a query is healthy.

```
┌──────────────────────────────────────────────────────────┐
│                THREE CORE COUNTERS                        │
│                                                          │
│  nKeysExamined ──► How many index entries were scanned   │
│  nDocsExamined ──► How many documents were loaded        │
│  nReturned     ──► How many documents matched the query  │
│                                                          │
│  Perfect query: all three values are EQUAL               │
└──────────────────────────────────────────────────────────┘
```

If you remember nothing else from this file, remember that last line: **in a perfectly efficient query, all three numbers match.** Every deviation from that tells a specific story — and that's what the rest of this section walks through.

### 3.1 nReturned

The number of documents that actually matched your query filter and got sent back to the client. This is the "useful work" — the thing you actually wanted.

### 3.2 nDocsExamined

The number of documents MongoDB had to pull off disk (or out of memory) just to *check* whether they matched. Here's the part people trip over: using an index to find candidates doesn't mean the index alone can answer the question. If the filter includes a condition the index doesn't cover, MongoDB still has to fetch the whole document and check that condition by hand.

```
Index covers userId only, filter also includes status:

  Index scan returns keys for userId=42 → 150 keys
  MongoDB fetches 150 full documents
  Filter on status eliminates 147 documents
  nReturned = 3, nDocsExamined = 150

  This is inefficient. A compound index on (userId, status)
  would reduce nDocsExamined to 3.
```

150 documents fetched, only 3 kept. That's 147 wasted disk reads for nothing — and it's exactly the kind of thing `nDocsExamined` vs `nReturned` will expose immediately, even though the query "used an index" the whole time.

### 3.3 nKeysExamined

The number of index keys MongoDB scanned on its way to finding candidates. This can actually be *higher* than nDocsExamined — which sounds backwards until you realize it happens when the index range scanned is wider than what other filters end up allowing through, or when a multikey index means several keys point at the same document.

### 3.4 Efficiency Ratios and What They Signal

Once you've got the three counters, the pattern between them tells you which of five situations you're in:

```
┌────────────────────────────────────────────────────────────────────┐
│                    RATIO ANALYSIS TABLE                            │
├──────────────────────────┬─────────────────┬───────────────────────┤
│ Scenario                 │ Ratio           │ What it means         │
├──────────────────────────┼─────────────────┼───────────────────────┤
│ Perfect covered query    │ Keys=Docs=Ret=N  │ No fetch needed       │
│ Good indexed query       │ Keys≈Docs≈Ret    │ Tight index bounds    │
│ Partial index match      │ Docs >> Ret      │ Post-filter waste     │
│ Full collection scan     │ Docs = total    │ No index used         │
│ Very selective index     │ Keys >> Docs     │ Sparse/multi-key idx  │
└──────────────────────────┴─────────────────┴───────────────────────┘
```

**Common mistake:** seeing `IXSCAN` in the winning plan and assuming the query is "fine." An index being used at all says nothing about how *well* it's being used — a query can use an index and still examine 500 documents to return 1. Always check the ratio, not just the stage name.

Rule of thumb: if `nDocsExamined / nReturned > 10`, investigate adding or improving an index.

```js
// Quick efficiency check script
function queryEfficiency(explainOutput) {
  const stats = explainOutput.executionStats;
  const ratio = stats.totalDocsExamined / (stats.nReturned || 1);
  console.log(`nReturned:      ${stats.nReturned}`);
  console.log(`nDocsExamined:  ${stats.totalDocsExamined}`);
  console.log(`nKeysExamined:  ${stats.totalKeysExamined}`);
  console.log(`Efficiency:     ${(1/ratio * 100).toFixed(1)}%`);
  if (ratio > 100) console.log("WARNING: Very inefficient query");
  else if (ratio > 10) console.log("CAUTION: Index may need improvement");
  else console.log("OK: Query is reasonably efficient");
}

const result = db.orders.find({ status: "pending" }).explain("executionStats");
queryEfficiency(result);
```

**Interview answer:** "The three core counters in executionStats — nKeysExamined, nDocsExamined, and nReturned — describe the efficiency of a query. In a perfectly tuned, fully covered query, all three are equal. When nDocsExamined is far larger than nReturned, the index found candidates but couldn't filter them precisely, so MongoDB is fetching and discarding documents. My rule of thumb is to investigate when that ratio crosses about 10:1."

> **Memory hook:** "Three numbers, one story: if they don't match, someone's doing wasted work."

---

## 4. db.currentOp() — Inspecting Active Operations

Here's the scenario: the database is under load *right now*, something is running long, and you need to know what — without waiting for it to finish or digging through logs after the fact. `db.currentOp()` is your live look at everything the server is doing at this exact second. Think of it as `top` for MongoDB operations, or a hospital's live patient monitor instead of yesterday's chart.

```js
// Show all active operations
db.currentOp()

// Filter to only long-running operations (> 5 seconds)
db.currentOp({ "secs_running": { $gt: 5 } })

// Show only operations on a specific database
db.currentOp({ "ns": /^mydb\./ })

// Show only write operations
db.currentOp({ "op": { $in: ["insert", "update", "remove"] } })
```

Key fields in currentOp output:

```json
{
  "inprog": [
    {
      "opid": 12345,
      "op": "query",
      "ns": "mydb.orders",
      "query": { "status": "pending" },
      "planSummary": "COLLSCAN",
      "secs_running": 45,
      "microsecs_running": 45123456,
      "waitingForLock": false,
      "numYields": 892,
      "locks": { "Global": "r", "Database": "r", "Collection": "r" },
      "client": "192.168.1.10:51234",
      "desc": "conn127",
      "threadId": "140234567890"
    }
  ]
}
```

```
┌──────────────────────────────────────────────────────────┐
│              currentOp() KEY FIELDS                      │
├───────────────┬──────────────────────────────────────────┤
│ opid          │ Operation ID — use to kill with killOp() │
│ op            │ query / insert / update / remove / cmd   │
│ planSummary   │ COLLSCAN or IXSCAN — quick health check  │
│ secs_running  │ Duration so far in seconds               │
│ waitingForLock│ Is this op blocked on a lock?             │
│ numYields     │ Times op yielded CPU — high = slow disk  │
│ client        │ Which application server sent this query │
└───────────────┴──────────────────────────────────────────┘
```

Notice `planSummary: "COLLSCAN"` sitting right there in the sample output — that's your smoking gun before you've even opened `explain()`.

Killing a runaway operation:

```js
// Kill operation with opid 12345
db.killOp(12345)
```

Here's the workflow you'd actually run during a real incident, step by step:

```
Step 1: db.currentOp({ secs_running: { $gt: 10 } })
         ── Find long-running operations

Step 2: Check planSummary — if COLLSCAN on large collection, that's the culprit

Step 3: db.killOp(opid) if necessary to unblock the system

Step 4: Identify the query pattern from the "query" field

Step 5: Run explain("executionStats") on that query pattern

Step 6: Add appropriate index
```

Notice this loops right back into everything from Section 2 and 3 — currentOp() tells you *where* to point explain(), it doesn't replace it.

---

## 5. mongostat — Operations Per Second

Sometimes you don't want to inspect one query — you want a pulse check on the whole server. Is it under water right now, or fine? `mongostat` is that pulse check: a real-time, refreshing view of server activity, in the same spirit as the Unix `vmstat` or `iostat` commands. By default it samples once a second.

```bash
# Basic usage — refresh every 1 second
mongostat

# Connect to a remote host
mongostat --host mongodb://user:pass@host:27017

# Wider output interval (every 5 seconds)
mongostat --rowcount 0 5

# JSON output for programmatic parsing
mongostat --json
```

Sample output:

```
insert  query  update  delete  getmore  command  dirty  used  flushes  vsize   res    qrw   arw  net_in  net_out  conn    time
     0     12       3       0        0    2|0     0.5%  38.2%       0  1.57G  214M   0|0   1|0  1.27k    36.1k    11  Dec 15 14:23:01.000
     0    145       8       1        0    3|0     0.7%  38.4%       0  1.57G  214M   0|0   1|0  14.2k   182.0k    11  Dec 15 14:23:02.000
```

```
┌──────────────────────────────────────────────────────────────────┐
│                   mongostat COLUMN GUIDE                         │
├───────────────┬──────────────────────────────────────────────────┤
│ insert        │ Insert operations per second                     │
│ query         │ Query operations per second                      │
│ update        │ Update operations per second                     │
│ delete        │ Delete operations per second                     │
│ getmore       │ Cursor getMore operations per second             │
│ command       │ Commands per second (format: local|replicated)   │
│ dirty         │ % of WiredTiger cache with dirty pages           │
│ used          │ % of WiredTiger cache in use                     │
│ flushes       │ WiredTiger checkpoints per interval               │
│ vsize         │ Virtual memory used by mongod                    │
│ res           │ Resident memory used by mongod                   │
│ qrw           │ Clients waiting for read/write locks              │
│ arw           │ Active clients in read/write operations          │
│ conn          │ Number of open connections                        │
└───────────────┴──────────────────────────────────────────────────┘
```

Most of these columns you'll glance at and move on. A handful of them are actual warning lights — worth memorizing:

```
dirty > 20%  ─► WiredTiger cache under pressure; checkpoints can't keep up
used  > 95%  ─► Cache eviction is happening; expect latency spikes
qrw   > 0    ─► Lock contention; writes are blocking reads
conn  spike  ─► Connection pool exhaustion in application tier
query spikes ─► Sudden load increase; check for missing index
```

---

## 6. mongotop — Time Per Collection

`mongostat` tells you the server is under strain. It doesn't tell you *which collection* is causing it. That's the gap `mongotop` fills — think of it as "top," but instead of showing which process is eating CPU, it shows which collection is eating read/write time.

```bash
# Basic usage — refresh every 1 second
mongotop

# Refresh every 5 seconds
mongotop 5

# Connect to replica set
mongotop --host "rs0/host1:27017,host2:27017"

# JSON output
mongotop --json
```

Sample output:

```
                             ns    total    read    write  2024-12-15T14:30:00Z
              mydb.orders    45ms   42ms     3ms
           mydb.inventory    12ms    8ms     4ms
            mydb.sessions     8ms    7ms     1ms
              mydb.users      3ms    3ms     0ms
          admin.system.roles   0ms    0ms     0ms
```

```
┌──────────────────────────────────────────────────────────┐
│               mongotop INTERPRETATION                    │
│                                                          │
│  High READ time  ──► Collection needs better read index  │
│                      or query is scanning too many docs  │
│                                                          │
│  High WRITE time ──► Heavy write load; check write       │
│                      concern settings, index overhead    │
│                                                          │
│  Sudden spike    ──► Background job? Batch insert?       │
│                      Runaway query? Check currentOp()    │
└──────────────────────────────────────────────────────────┘
```

Once mongotop points at a culprit collection, the investigation is a straight line — hand that name straight to currentOp(), then to explain():

```
mongotop shows "orders" collection consuming 90% of time
  ──► db.currentOp({ ns: "mydb.orders" })
      ──► Find active queries on that collection
          ──► Check planSummary for COLLSCAN
              ──► Run explain() on the query
                  ──► Add missing index
```

---

## 7. Slow Query Log and slowms

Real-time tools like currentOp, mongostat, and mongotop are great when you're watching the server live. But most performance problems aren't caught live — they're caught the next morning, when someone asks "why was the app slow at 3am?" For that, you need something writing things down automatically. That's the slow query log: MongoDB logs any query slower than a threshold called `slowms`, with zero manual effort on your part.

### Configuring slowms in mongod.conf

```yaml
# /etc/mongod.conf
operationProfiling:
  slowOpThresholdMs: 100    # Log queries slower than 100ms
  mode: slowOp              # off | slowOp | all
  slowOpSampleRate: 1.0     # Sample 100% of slow ops (0.0 to 1.0)
```

### Configuring at Runtime (no restart needed)

```js
// Set slow query threshold to 200ms for current mongod
db.setProfilingLevel(0, { slowms: 200 })

// Check current profiling settings
db.getProfilingStatus()
// Returns: { "was" : 0, "slowms" : 200, "sampleRate" : 1 }
```

### Reading the Log

Slow queries appear in the MongoDB log (typically `/var/log/mongodb/mongod.log`):

```
2024-12-15T14:30:01.234+0000 I COMMAND [conn127] command mydb.orders
  command: find { find: "orders", filter: { status: "pending" }, ... }
  planSummary: COLLSCAN
  keysExamined:0 docsExamined:1250000 nreturned:432
  protocol:op_msg 4521ms
```

Look at that line closely: `keysExamined:0`, `docsExamined:1250000`, `nreturned:432`, and `planSummary: COLLSCAN`. That's every red flag from Section 3 sitting in one log line — a full scan of 1.25 million documents to return 432.

### Parsing Slow Query Log with Shell

```bash
# Find all COLLSCAN queries in the log
grep "COLLSCAN" /var/log/mongodb/mongod.log | tail -20

# Find queries slower than 1 second
grep "protocol:op_msg" /var/log/mongodb/mongod.log | \
  awk -F'ms' '{ if ($1+0 > 1000) print }' | head -20

# Count slow queries by collection
grep "COLLSCAN" /var/log/mongodb/mongod.log | \
  grep -oP 'command \K\S+' | sort | uniq -c | sort -rn
```

### slowms Tuning Strategy

How aggressive should the threshold be? It depends entirely on how much noise you can tolerate versus how much you need to catch:

```
┌─────────────────────────────────────────────────────────┐
│              slowms TUNING STRATEGY                     │
│                                                         │
│  Development:   slowms: 0    (log everything)           │
│  Staging:       slowms: 50   (catch anything > 50ms)    │
│  Production:    slowms: 100  (standard threshold)        │
│  High-traffic:  slowms: 250  (reduce log noise)          │
│                                                         │
│  TIP: Use sampleRate: 0.1 on very high-traffic systems  │
│  to log 10% of slow queries and reduce I/O overhead.    │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Patterns to Avoid

These four are the recurring ways a query quietly throws away the benefit of having an index at all. Each one looks harmless when you write it.

### 8.1 $where Operator

Why would you ever avoid something as flexible as running arbitrary JavaScript against your documents? Because that flexibility comes at the cost of MongoDB's entire optimizer — `$where` executes a JS function against *every single document* in the collection. It forces a full collection scan and can never use an index, no matter what fields you reference inside it.

```js
// NEVER do this in production
db.orders.find({
  $where: function() {
    return this.total > this.discount * 10;
  }
})

// DO THIS INSTEAD — use a computed field or $expr
db.orders.find({
  $expr: { $gt: ["$total", { $multiply: ["$discount", 10] }] }
})

// Or add a computed field when inserting documents
// { total: 500, discount: 20, highValue: true }  ← add this field
db.orders.createIndex({ highValue: 1 })
db.orders.find({ highValue: true })
```

Why $where is dangerous:
- JavaScript evaluation is single-threaded
- Cannot use indexes
- Blocks other operations due to JS engine lock (MongoDB 4.4 and earlier)
- Security risk — JavaScript injection if user input is passed in

### 8.2 Regex Without Anchor

Here's a case where two queries that *look* almost identical behave completely differently underneath. `/laptop/` and `/^laptop/` seem like a cosmetic difference — one character — but only one of them can use an index.

A regex that does not start with `^` (beginning of string anchor) cannot use an index prefix scan and must examine all index entries.

```js
// BAD — cannot use index, scans all values
db.products.find({ name: /laptop/ })

// BAD — case-insensitive without anchor is especially slow
db.products.find({ name: /laptop/i })

// GOOD — anchored at start, can use index range scan
db.products.find({ name: /^laptop/ })

// BETTER — use text index for full-text search
db.products.createIndex({ name: "text" })
db.products.find({ $text: { $search: "laptop" } })
```

```
Index scan comparison for name field with index:

  /^laptop/   ──► IXSCAN  ── scans from "laptop" forward ── fast
  /laptop/    ──► IXSCAN  ── must check all entries ─────── slow
  /laptop$/   ──► COLLSCAN ─ cannot use index at all ─────── very slow
```

**Why the anchor matters, in one sentence:** an index on a string field is really just the values sorted alphabetically, and `^laptop` is the only pattern that describes a contiguous *range* in that sorted order — everything else means "check every entry, just in case."

### 8.3 Large $in Arrays

`$in` feels like a single query, but underneath, MongoDB treats every value in that array as its own separate index lookup. Fine for 5 values. A different story for 10,000.

```js
// PROBLEMATIC — 10,000 IDs in $in
const userIds = [...Array(10000).keys()];
db.orders.find({ userId: { $in: userIds } })

// This generates 10,000 separate index point lookups
// The query planner may not even use the index at > ~1000 values
```

Better alternatives for large $in arrays:

```js
// Option 1: Use a range if IDs are sequential
db.orders.find({ userId: { $gte: 1, $lte: 10000 } })

// Option 2: Use a lookup / $in batch in smaller chunks
async function chunkedFind(ids, chunkSize = 200) {
  const results = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const docs = await db.orders.find({ userId: { $in: chunk } }).toArray();
    results.push(...docs);
  }
  return results;
}

// Option 3: Denormalize — store a flag on the documents instead
// { userId: 42, isVipUser: true }
db.orders.createIndex({ isVipUser: 1 })
db.orders.find({ isVipUser: true })
```

Rule of thumb: keep `$in` arrays under 1000 elements.

### 8.4 Missing Indexes on Filter Fields

This one is the most obvious of the four, and still the most common in the wild: a query filters on fields, and nobody ever built an index for them.

```js
// SLOW — status has millions of distinct values but no index
db.events.find({ userId: 123, eventDate: { $gte: ISODate("2024-01-01") } })

// Check what indexes exist
db.events.getIndexes()

// Add compound index — order matters! ESR Rule:
// Equality fields first, Sort fields second, Range fields last
db.events.createIndex({ userId: 1, eventDate: 1 })

// Now verify improvement
db.events.find({ userId: 123, eventDate: { $gte: ISODate("2024-01-01") } })
  .explain("executionStats")
```

Notice the comment above the `createIndex` call — "order matters." That's not a throwaway remark; it's a whole rule of its own, and it's worth internalizing because it applies to nearly every compound index you'll ever build:

```
┌─────────────────────────────────────────────────────────────┐
│                      ESR RULE                               │
│                                                             │
│  E ── Equality conditions first                             │
│  S ── Sort conditions next                                  │
│  R ── Range conditions last                                 │
│                                                             │
│  Query: userId = 42, sort by date, date >= 2024-01-01       │
│  Index: { userId: 1, date: 1 }                              │
│         ──────E────   ──SR──                                │
│                                                             │
│  Do NOT put range fields before sort fields —               │
│  doing so forces an in-memory sort.                         │
└─────────────────────────────────────────────────────────────┘
```

> **Memory hook:** "Equality, Sort, Range — E-S-R, in that order, every time you build a compound index."

---

## 9. Projection to Limit Data Transfer

Here's a question worth asking every time you write a `find()`: does the caller actually need the whole document, or just two fields off it? Projection is how you tell MongoDB "just send me what I asked for" — cutting down on network transfer, memory pressure on your app server, and the time the driver spends deserializing bytes it's about to throw away.

```js
// BAD — fetches entire document when you only need two fields
db.users.find({ status: "active" })

// GOOD — only fetch name and email
db.users.find({ status: "active" }, { name: 1, email: 1, _id: 0 })

// GOOD — aggregate with $project for complex transformations
db.orders.aggregate([
  { $match: { status: "shipped" } },
  { $project: { orderId: 1, total: 1, createdAt: 1 } }
])
```

```
Without projection on a 5KB document:
  1000 results × 5KB = 5MB transferred

With projection (only 3 fields, ~100 bytes):
  1000 results × 100B = 100KB transferred

50x reduction in network transfer with zero application logic change.
```

That's a 50x win from adding one extra argument to a query you'd already written. Worth doing as a habit, not just a fix.

---

### Covered queries — the ultimate projection optimization

Push projection to its logical extreme and you get something even better than "smaller documents transferred" — you get documents that never have to be loaded from storage at all.

A covered query is one where the index itself contains all the fields needed to satisfy the query (both filter and projection). MongoDB never loads the actual document — the answer comes directly from the index.

```js
// Index: { userId: 1, status: 1, createdAt: 1 }
db.orders.createIndex({ userId: 1, status: 1, createdAt: 1 })

// Covered query — ALL projected fields are in the index
// nDocsExamined will be 0 in explain() output
db.orders.find(
  { userId: 42, status: "shipped" },      // filter fields in index
  { userId: 1, status: 1, createdAt: 1, _id: 0 }  // projected fields in index
)
```

**Common mistake:** forgetting that `_id` is always returned unless explicitly excluded with `_id: 0`. If `_id` is not in the index, the query cannot be covered — one missing exclusion silently breaks the whole optimization.

---

## 10. Read Preferences

Not every read needs the freshest possible data. A dashboard showing yesterday's numbers doesn't care if it's reading from a replica that's half a second behind the primary — but a login check absolutely does. Read preferences let you make that tradeoff explicit: which replica set member should actually serve this read?

```
┌────────────────────────────────────────────────────────────────────┐
│                    READ PREFERENCE MODES                           │
├──────────────────────┬─────────────────────────────────────────────┤
│ primary (default)    │ Always read from primary — strong           │
│                      │ consistency, no extra nodes needed          │
├──────────────────────┼─────────────────────────────────────────────┤
│ primaryPreferred     │ Read from primary; fall back to secondary   │
│                      │ if primary unavailable                      │
├──────────────────────┼─────────────────────────────────────────────┤
│ secondary            │ Always read from a secondary — lower load   │
│                      │ on primary; eventual consistency            │
├──────────────────────┼─────────────────────────────────────────────┤
│ secondaryPreferred   │ Prefer secondary; fall back to primary      │
├──────────────────────┼─────────────────────────────────────────────┤
│ nearest              │ Read from the member with lowest network    │
│                      │ latency — geographic optimization           │
└──────────────────────┴─────────────────────────────────────────────┘
```

Setting read preference in the driver:

```js
// Node.js — connection string
const client = new MongoClient("mongodb://host1,host2,host3/mydb?readPreference=secondaryPreferred");

// Per-operation read preference
const result = await db.collection("reports")
  .find({ year: 2024 })
  .withReadPreference(ReadPreference.SECONDARY)
  .toArray();
```

When to use each read preference:

```
primary              ── Financial transactions, user auth, anything
                        requiring up-to-date data

secondaryPreferred   ── Analytics queries, reports, dashboards,
                        search results where slight staleness is OK

nearest              ── Globally distributed apps where latency
                        matters more than consistency

secondary            ── Dedicated analytics node in replica set;
                        long-running aggregations that should not
                        impact primary performance
```

---

## 11. Optimization Checklist

Everything above compresses into one checklist. Run through it before any new query pattern ships to production:

```
┌─────────────────────────────────────────────────────────────────┐
│              QUERY OPTIMIZATION CHECKLIST                       │
├─────────────────────────────────────────────────────────────────┤
│ [ ] Run explain("executionStats") — no COLLSCAN on large coll  │
│ [ ] nDocsExamined / nReturned ratio < 10                        │
│ [ ] Index exists for all filter + sort fields                   │
│ [ ] Compound index follows ESR rule                             │
│ [ ] No $where operator                                          │
│ [ ] Regex patterns anchored with ^ where possible              │
│ [ ] $in arrays under 1000 elements                              │
│ [ ] Projection used to limit returned fields                    │
│ [ ] Consider covered query if same data is queried repeatedly   │
│ [ ] Read preference set appropriately for consistency needs     │
│ [ ] slowms configured and log monitored                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Hands-On Exercises

### Exercise 1 — Compare explain() Modes

Set up a test collection and compare the three explain modes.

```js
// Setup
use performance_test
db.products.drop()

for (let i = 0; i < 100000; i++) {
  db.products.insertOne({
    sku: `SKU-${i}`,
    category: ["electronics","clothing","food"][i % 3],
    price: Math.random() * 1000,
    inStock: i % 5 !== 0
  })
}

// Task 1: Run all three explain modes on this query
// db.products.find({ category: "electronics", inStock: true })
// Compare: winningPlan stage, nDocsExamined, execution time

// Task 2: Add an index and repeat
db.products.createIndex({ category: 1, inStock: 1 })

// Task 3: What changed in the execution stats?
// Expected: COLLSCAN → IXSCAN, nDocsExamined drops dramatically
```

### Exercise 2 — Identify Inefficient Ratios

```js
// This query has a bad ratio. Find out why and fix it.
db.products.createIndex({ category: 1 })  // only category indexed

const result = db.products.find({
  category: "electronics",
  price: { $lt: 100 }
}).explain("executionStats")

// Questions:
// 1. What is nDocsExamined vs nReturned?
// 2. Why is the ratio bad even with an index?
// 3. What index would make it better?
// Answer: add { category: 1, price: 1 } compound index
```

### Exercise 3 — Use currentOp() to Find Slow Queries

```js
// Terminal 1: Start a slow query (no index on price alone)
db.products.drop()
for (let i = 0; i < 500000; i++) db.products.insertOne({ price: Math.random() * 1000 })

// This will be slow — run it in background or another shell
db.products.find({ price: { $gt: 999.99 } }).toArray()

// Terminal 2: While Terminal 1 query is running
db.currentOp({ "secs_running": { $gt: 0 }, "op": "query" })

// Observe: planSummary should show COLLSCAN
// Record the opid and kill it: db.killOp(opid)
```

### Exercise 4 — Avoid $where, Use $expr

```js
// Setup: orders with total and discount
db.orders.drop()
for (let i = 0; i < 50000; i++) {
  db.orders.insertOne({
    orderId: i,
    total: Math.floor(Math.random() * 1000) + 100,
    discount: Math.floor(Math.random() * 50)
  })
}

// Task 1: Time this $where query
const t1 = Date.now()
db.orders.find({ $where: "this.total > this.discount * 5" }).toArray()
console.log("$where time:", Date.now() - t1, "ms")

// Task 2: Rewrite with $expr and time it
const t2 = Date.now()
db.orders.find({ $expr: { $gt: ["$total", { $multiply: ["$discount", 5] }] } }).toArray()
console.log("$expr time:", Date.now() - t2, "ms")

// Task 3: Can you index $expr? Add a computed field instead.
// db.orders.updateMany({}, [{ $set: { isHighValue: { $gt: ["$total", { $multiply: ["$discount", 5] }] } } }])
// db.orders.createIndex({ isHighValue: 1 })
```

### Exercise 5 — Measure Projection Impact

```js
// Setup: documents with many fields
db.users.drop()
for (let i = 0; i < 10000; i++) {
  db.users.insertOne({
    userId: i,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    address: { street: `${i} Main St`, city: "Sydney", postcode: "2000" },
    preferences: { theme: "dark", notifications: true, language: "en" },
    history: Array.from({length: 20}, (_, j) => ({ action: `action_${j}`, date: new Date() })),
    metadata: { createdAt: new Date(), updatedAt: new Date(), version: 1 }
  })
}

// Task 1: Time full document fetch
let t = Date.now()
db.users.find({ userId: { $lt: 1000 } }).toArray()
console.log("Without projection:", Date.now() - t, "ms")

// Task 2: Time with projection
t = Date.now()
db.users.find({ userId: { $lt: 1000 } }, { name: 1, email: 1, _id: 0 }).toArray()
console.log("With projection:", Date.now() - t, "ms")

// Task 3: Achieve a covered query
db.users.createIndex({ userId: 1, name: 1, email: 1 })
t = Date.now()
db.users.find(
  { userId: { $lt: 1000 } },
  { userId: 1, name: 1, email: 1, _id: 0 }
).toArray()
console.log("Covered query:", Date.now() - t, "ms")
// Verify: explain should show no FETCH stage
```

---

## 13. Interview Q&A

**Q1: What are the three modes of explain() and when do you use each?**

A: `queryPlanner` shows the chosen plan without executing the query — safe for production, no I/O cost. `executionStats` runs the winning plan and returns nReturned, nDocsExamined, nKeysExamined — used during active tuning to measure actual efficiency. `allPlansExecution` runs all candidate plans in a race to compare them — useful when you suspect MongoDB chose the wrong index or after adding a new index.

---

**Q2: What does a nDocsExamined/nReturned ratio of 500 tell you?**

A: The query examined 500 documents to return 1. This is a severe inefficiency. Either the query is doing a collection scan, the index is poorly chosen (e.g., a low-selectivity single-field index with a post-filter on another field), or the query filter is very unselective. A good ratio is 1:1 for index-backed queries.

---

**Q3: What is a covered query and how do you create one?**

A: A covered query is one where all fields referenced in the filter AND projection are present in the index, so MongoDB never loads the actual document from the data files. To create one: build a compound index that includes every field in the filter and every field you project, then exclude `_id` in the projection (since `_id` is not in custom indexes unless explicitly included). The explain output will show no FETCH stage.

---

**Q4: Why is $where dangerous in production?**

A: `$where` executes JavaScript against every document, forcing a full collection scan — it cannot use any index. It is also single-threaded in JavaScript execution, creates a security risk if user input is interpolated, and in older MongoDB versions acquired a global JavaScript lock. Use `$expr` with aggregation operators instead.

---

**Q5: What is the ESR rule for compound index design?**

A: Equality fields go first, Sort fields go second, Range fields go last. This ordering ensures MongoDB can use the index to both filter by equality, support the sort without an in-memory sort, and then narrow by range. Placing range fields before sort fields breaks the sort optimization.

---

**Q6: How does db.currentOp() help during a production incident?**

A: It shows all operations currently executing on the server with their query, planSummary (showing COLLSCAN vs IXSCAN), duration, lock status, and client IP. You can identify long-running queries, see if they are blocked waiting for locks, find their opid, and kill them with `db.killOp(opid)`.

---

**Q7: What do the "dirty" and "used" percentages in mongostat mean?**

A: `dirty` is the percentage of the WiredTiger cache containing pages that have been modified but not yet flushed to disk. If dirty exceeds 20%, checkpoint flushing cannot keep up and you will see latency spikes. `used` is the total cache utilization — if it exceeds 95%, MongoDB starts evicting pages to make room, causing additional disk I/O.

---

**Q8: How do you configure and use the slow query log?**

A: Set `slowOpThresholdMs` in mongod.conf under `operationProfiling`, or at runtime with `db.setProfilingLevel(0, { slowms: 100 })`. MongoDB then logs any query exceeding that threshold to its log file with the planSummary, docsExamined, keysExamined, and execution time. You can grep the log for COLLSCAN entries to find unindexed queries.

---

**Q9: Why can a regex query with ^ use an index but one without ^ cannot?**

A: An index on a string field stores values in sorted alphabetical order. A regex anchored with ^ (like `/^laptop/`) defines a range in that sorted order — MongoDB can jump directly to entries starting with "laptop" and stop when it reaches "laptoo". An unanchored regex like `/laptop/` could match "gaming-laptop" or "laptop-stand" anywhere in the string, requiring the engine to check every index entry.

---

**Q10: When should you use the "secondary" read preference?**

A: When running analytics queries, generating reports, or performing aggregations that are large and time-consuming. These should not compete with the primary's write throughput. Also useful for geographically distributed applications where a secondary in the same region provides lower latency than a remote primary. Avoid for operations requiring up-to-date data (auth, financial transactions) since secondaries have replication lag.

---

**Q11: What is the difference between mongostat and mongotop?**

A: `mongostat` shows server-wide metrics per second — operations count (inserts, queries, updates), memory usage, cache dirty percentage, connections, and lock wait queue. `mongotop` shows per-collection time spent in read and write operations. Use mongostat to detect overall server stress; use mongotop to identify which specific collection is causing it.

---

**Q12: How can a large $in array degrade performance even with an index?**

A: Each value in `$in` generates a separate index lookup. With 10,000 values, MongoDB executes 10,000 B-tree traversals. The query planner may abandon the index entirely at very large sizes. Additionally, the result set must be merged and de-duplicated. Solutions: use ranges instead of enumerated values, batch into smaller $in queries, or denormalize data to avoid the pattern.

---

**Q13: What fields in currentOp() indicate lock contention?**

A: `waitingForLock: true` means the operation is blocked. The `locks` field shows which lock levels are held. `numYields` shows how many times the operation released the CPU to allow other operations through — very high yield counts often indicate the operation is hitting cold data requiring disk I/O. The `qrw` column in mongostat (queue read/write) shows how many operations are waiting.

---

**Q14: Can you explain() an aggregation pipeline? What should you look for?**

A: Yes — `db.collection.explain("executionStats").aggregate(pipeline)`. Look for the first `$match` stage: it should use IXSCAN not COLLSCAN. Check for a `$sort` stage that appears before a `$limit` — MongoDB can optimize this into an index-backed top-k sort. Look for `$lookup` stages that lack indexes on the foreign collection's join field, which will cause collection scans.

---

**Q15: What is the sampleRate parameter in operationProfiling and when is it useful?**

A: `sampleRate` (0.0 to 1.0) controls what percentage of slow queries are actually logged. A value of 1.0 (default) logs all queries exceeding slowms. On very high-traffic systems where slow queries still number in the thousands per second, setting sampleRate to 0.1 logs a representative 10% sample, dramatically reducing log I/O overhead while still providing actionable data.
