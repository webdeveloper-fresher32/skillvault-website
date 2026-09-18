# MongoDB Phase 02 — Create & Insert Operations

## Table of Contents

1. [Overview of Insert Operations](#1-overview-of-insert-operations)
2. [insertOne()](#2-insertone)
3. [insertMany()](#3-insertmany)
4. [ObjectId Anatomy](#4-objectid-anatomy)
5. [Write Concern (w / j / wtimeout)](#5-write-concern)
6. [bulkWrite() Operations](#6-bulkwrite-operations)
7. [JSON Schema Validation ($jsonSchema)](#7-json-schema-validation)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Overview of Insert Operations

Before you can query, update, or delete anything, you need data sitting in the database. So the very first question is: what actually happens the moment you call `insertOne()`? What does the server do between "here's my document" and "OK, saved"?

**Real-world analogy:** think of MongoDB like a library. A **database** is the library building, a **collection** is a shelf labelled "Biographies", and each **document** is an individual book. `insertOne()` places one book on the shelf; `insertMany()` places a trolley-load at once. Nobody hands you a form to fill in describing what a "book" must look like before you're allowed to put one on the shelf — you just put it there.

That last bit matters: MongoDB stores data as **BSON documents** (Binary JSON), and collections are **schema-less by default**. Unlike SQL tables, you do NOT define columns before inserting. The collection is created the moment you insert the first document, if it doesn't already exist.

```js
// No CREATE TABLE equivalent needed
db.users.insertOne({ name: "Alice" }); // collection "users" created automatically
```

So what actually happens inside the server when that call lands? Here's the pipeline:

```
Your Application
      │
      │  insert command (BSON)
      ▼
┌─────────────────────────────┐
│  mongod  (server process)   │
│                             │
│  1. Validate document       │
│  2. Assign _id if missing   │
│  3. Write to WiredTiger     │
│     ┌──────────────────┐    │
│     │  Journal (WAL)   │    │
│     │  Collection file │    │
│     │  Index files     │    │
│     └──────────────────┘    │
│  4. Acknowledge to client   │
└─────────────────────────────┘
```

Four steps, every single insert, no exceptions: validate, assign an `_id` if you didn't give one, write it to storage (journal + collection file + indexes), then tell the client "done." Everything else in this file is really just variations on step 4 — *how* the server acknowledges, and *how many* documents it accepts in one go.

---

## 2. insertOne()

The simplest possible case: you have one document, you want it saved. `insertOne()` is the tool for that.

### Syntax

```js
db.collection.insertOne(
  <document>,
  {
    writeConcern: <document>,   // optional
    comment: <any>              // optional (4.4+)
  }
)
```

### Minimal Example

```js
db.products.insertOne({
  name: "Laptop",
  price: 1299.99,
  inStock: true,
  tags: ["electronics", "computers"]
});
```

### Return Value

Notice what comes back isn't the document itself — it's a receipt telling you the write was accepted and what `_id` got assigned:

```js
// insertOne() returns:
{
  acknowledged: true,          // write concern was satisfied
  insertedId: ObjectId("64a1f3b2e4b0c12345678901")
}
```

### Providing Your Own _id

Why would you want to override MongoDB's auto-generated ObjectId? Because sometimes you already have a natural, unique identifier — a SKU, an email, an external system's ID — and there's no reason to carry two IDs around when one will do.

```js
db.products.insertOne({
  _id: "SKU-00123",           // custom string _id
  name: "Mechanical Keyboard",
  price: 179.99
});
```

| _id Type      | Example                              | When to Use                        |
|---------------|--------------------------------------|------------------------------------|
| ObjectId      | ObjectId("64a1...")                  | Default — always unique, sortable  |
| String        | "SKU-00123"                          | Natural business key exists        |
| Number        | 42                                   | Sequential ID from external system |
| UUID          | UUID("550e8400-...")                 | Cross-system interoperability      |

### Inserting Nested Documents (Embedded)

Because there's no rigid schema, a document can carry whole nested structures — objects inside objects, arrays of objects — all in a single insert:

```js
db.orders.insertOne({
  orderId: "ORD-2024-001",
  customer: {
    name: "Bob Smith",
    email: "bob@example.com",
    address: {
      street: "42 Maple Ave",
      city: "Sydney",
      postcode: "2000"
    }
  },
  items: [
    { sku: "LAPTOP-01", qty: 1, unitPrice: 1299.99 },
    { sku: "MOUSE-04",  qty: 2, unitPrice: 29.99  }
  ],
  createdAt: new Date(),
  status: "pending"
});
```

### Full Options Reference

Beyond the document itself, you can tell the server how durable the write needs to be (more on that in Section 5), and tag it with a comment that shows up later in logs/profiler output — handy when you're debugging "who wrote this and why":

```js
db.inventory.insertOne(
  {
    item: "canvas",
    qty: 100,
    tags: ["cotton"],
    size: { h: 28, w: 35.5, uom: "cm" }
  },
  {
    writeConcern: { w: "majority", j: true, wtimeout: 5000 },
    comment: "seeding initial inventory"   // appears in profiler/logs
  }
);
```

### Error: Duplicate Key

`_id` is unique per collection, always. Try to insert one that already exists, and MongoDB throws a `WriteError`:

```
MongoServerError: E11000 duplicate key error collection: shop.products
index: _id_ dup key: { _id: "SKU-00123" }
```

Handle it in application code:

```js
try {
  await db.collection("products").insertOne({ _id: "SKU-00123", name: "Keyboard" });
} catch (err) {
  if (err.code === 11000) {
    console.error("Duplicate _id — document already exists");
  } else {
    throw err;
  }
}
```

---

## 3. insertMany()

`insertOne()` in a loop, a thousand times, means a thousand network round-trips. Why pay that price when you can hand the server a trolley-load of documents in one go?

### Syntax

```js
db.collection.insertMany(
  [ <document1>, <document2>, ... ],
  {
    ordered: <boolean>,         // default: true
    writeConcern: <document>,
    comment: <any>
  }
)
```

### Return Value

```js
{
  acknowledged: true,
  insertedIds: {
    "0": ObjectId("64a1f3b2e4b0c12345678901"),
    "1": ObjectId("64a1f3b2e4b0c12345678902"),
    "2": ObjectId("64a1f3b2e4b0c12345678903")
  }
}
```

### Ordered vs Unordered — Critical Difference

Here's the question that actually matters in practice: you're inserting 5 documents, and document 3 fails (say, a duplicate key). Do documents 4 and 5 still get attempted?

The answer depends entirely on one option: `ordered`.

```
ordered: true  (DEFAULT)
┌─────────────────────────────────────────────────┐
│  Doc 1 ──► insert OK                            │
│  Doc 2 ──► insert OK                            │
│  Doc 3 ──► ERROR (dup key)  ◄── STOPS HERE      │
│  Doc 4 ──► NOT attempted                        │
│  Doc 5 ──► NOT attempted                        │
└─────────────────────────────────────────────────┘

ordered: false
┌─────────────────────────────────────────────────┐
│  Doc 1 ──► insert OK                            │
│  Doc 2 ──► insert OK                            │
│  Doc 3 ──► ERROR (dup key)  ◄── logged, continue│
│  Doc 4 ──► insert OK                            │
│  Doc 5 ──► insert OK                            │
└─────────────────────────────────────────────────┘
```

With `ordered: true` (the default), MongoDB processes documents strictly in array order and stops dead at the first failure — everything after it is simply never attempted. With `ordered: false`, MongoDB fires ahead through the whole batch regardless of failures, and reports every error at the end. Nothing is rolled back either way: whatever succeeded before the failure stays inserted.

### Ordered Example (default)

```js
db.students.insertMany([
  { _id: 1, name: "Alice", grade: "A" },
  { _id: 2, name: "Bob",   grade: "B" },
  { _id: 3, name: "Carol", grade: "A" }
]);
```

### Unordered Example — Best for Bulk Seeding

```js
db.students.insertMany(
  [
    { _id: 1, name: "Alice" },  // may already exist
    { _id: 4, name: "Dave"  },  // new
    { _id: 5, name: "Eve"   },  // new
  ],
  { ordered: false }
);
// Result: _id:4 and _id:5 inserted; _id:1 fails with dup key but does NOT block others
```

### Compare: ordered vs unordered

| | `ordered: true` (default) | `ordered: false` |
|---|---|---|
| Stops on first error? | Yes | No |
| Documents after the failure | Never attempted | Still attempted |
| Best for | Sequential, dependent data | Bulk seeding / imports where you want max successful inserts |
| Error reporting | Reports the single failure | Collects and reports all failures at the end |

**Common mistake:** assuming `ordered: false` means "no errors are reported." It still reports every failure — it just doesn't let one bad document block the rest of the batch. Also, don't assume `ordered: false` guarantees insertion order in the collection; without `ordered: true`, MongoDB may parallelize the writes, so document 5 could land before document 2.

**Interview answer:** "`ordered: true`, the default, processes documents sequentially and halts on the first error, leaving later documents unattempted. `ordered: false` continues past errors, attempting every document in the batch and reporting all failures together at the end — this maximizes the number of successful inserts, which is exactly what you want for bulk seeding or imports where a handful of duplicate keys shouldn't block the rest of the data."

> **Memory hook:** "Ordered is a single-file line that halts at the first tripped wire. Unordered is everyone running for the exits at once — a few might stumble, but the rest get through."

### Performance Tip — Batch Size

When inserting thousands of documents, chunk them into batches of ~1000 for optimal throughput. MongoDB's wire protocol limit is 48MB per batch message.

```js
const docs = Array.from({ length: 50000 }, (_, i) => ({ seq: i, data: "..." }));

const BATCH = 1000;
for (let i = 0; i < docs.length; i += BATCH) {
  await db.collection("bigcoll").insertMany(docs.slice(i, i + BATCH), { ordered: false });
}
```

---

## 4. ObjectId Anatomy

If you don't supply an `_id`, MongoDB doesn't just hand you a random string — it hands you something quietly clever: a value that already encodes *when* the document was created, without you ever storing a separate timestamp field.

**Real-world analogy:** it's like a serial number stamped on a manufactured part that encodes the factory, the production line, and the exact minute it rolled off — you can read a lot of history off the number itself, without looking anything up.

**Basic definition:** every document without an explicit `_id` receives an **ObjectId** — a 12-byte BSON type that packs in a timestamp, a random value, and a counter.

### Byte Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                  ObjectId  (12 bytes = 24 hex chars)             │
├──────────────┬──────────────────────┬──────────────────────────┐ │
│  4 bytes     │  5 bytes             │  3 bytes                 │ │
│  Timestamp   │  Random Value        │  Incrementing Counter    │ │
│  (Unix secs) │  (machine+process)   │  (random start)          │ │
└──────────────┴──────────────────────┴──────────────────────────┘

Example:  64 a1 f3 b2  |  e4 b0 c1 23 45  |  67 89 01
           ──────────     ───────────────     ────────
           Unix time      Random (unique      Counter
           1688300466     per process)
```

### Timestamp Extraction

Because the first 4 bytes are a Unix timestamp, you can derive the creation time from any ObjectId — no separate `createdAt` field needed:

```js
const oid = new ObjectId("64a1f3b2e4b0c12345678901");
console.log(oid.getTimestamp());
// 2023-07-02T14:27:46.000Z
```

### Sorting by _id == Sorting by Insertion Time

A nice side effect of that leading timestamp: sorting by `_id` sorts by insertion time too, since ObjectIds are (roughly) monotonically increasing.

```js
// Get the 10 most recently inserted documents
db.events.find().sort({ _id: -1 }).limit(10);
```

### ObjectId Uniqueness Guarantee

Here's the non-obvious part: how does MongoDB guarantee two ObjectIds never collide, when they're being generated on different machines, by different processes, at the same instant, with no coordination between them?

```
Uniqueness comes from THREE layers:
  1. Timestamp   — different seconds cannot collide
  2. Random part — different machines/processes cannot collide
  3. Counter     — within the same second on same process, counter prevents collision
```

Each layer covers the gap the one before it leaves open. Same second? The random per-process value keeps two different machines apart. Same second *and* same process? The incrementing counter keeps two calls apart. No central coordinator, no round-trip to ask "is this ID taken" — it's just structurally unlikely to collide.

**Common mistake:** treating ObjectId as a purely random UUID and assuming its only job is uniqueness. It's also information — throwing it away and adding a redundant `createdAt` field is often unnecessary duplication (though in practice many teams still store `createdAt` explicitly for readability and because it survives a document being re-inserted with a new `_id`).

**Interview answer:** "An ObjectId is 12 bytes made of three parts: a 4-byte Unix timestamp, a 5-byte random value unique to the machine and process, and a 3-byte counter that starts at a random value and increments. The timestamp means you can derive creation time without a separate field and that sorting by `_id` approximates sorting by insertion order. The random-plus-counter combination means uniqueness holds even across machines generating IDs simultaneously with zero coordination."

> **Memory hook:** "Timestamp says *when*, random says *where*, counter says *which one this second* — three layers, zero collisions."

### Constructing an ObjectId from a Date

```js
// Find all documents inserted after a specific date
const dateFloor = ObjectId.createFromTime(new Date("2024-01-01").getTime() / 1000);
db.logs.find({ _id: { $gt: dateFloor } });
```

---

## 5. Write Concern

Picture this: you call `insertOne()`, and the "OK, saved" response comes back in 2 milliseconds. Except — saved *where*, exactly? In memory on one server? Flushed to disk? Copied to two other machines in case this one catches fire? MongoDB doesn't just pick one answer for you — it lets you dial in exactly how much confidence you want *before* it tells you "done."

That dial is **Write Concern**. It controls **how many acknowledgements** MongoDB waits for before declaring an insert successful.

### The Three Parameters

| Parameter  | Type          | Meaning                                                    |
|------------|---------------|------------------------------------------------------------|
| `w`        | number/string | How many nodes must acknowledge the write                  |
| `j`        | boolean       | Must the write be flushed to the on-disk journal (WAL)?   |
| `wtimeout` | milliseconds  | How long to wait before timing out (only when w > 1)      |

### w Values Explained

```
┌────────────────────────────────────────────────────────────────────┐
│  w: 0  — Fire and Forget                                           │
│          Client does NOT wait for any acknowledgement.             │
│          Fastest but zero durability guarantee.                    │
│                                                                    │
│  w: 1  — Primary Acknowledged (DEFAULT)                            │
│          Primary node confirms the write was received in memory.   │
│                                                                    │
│  w: 2  — Primary + 1 Secondary                                     │
│          Two nodes in the replica set must confirm.                │
│                                                                    │
│  w: "majority"  — Quorum Write                                     │
│          More than half the voting nodes must confirm.             │
│          Survives primary failover. Recommended for critical data. │
└────────────────────────────────────────────────────────────────────┘
```

Notice the pattern: the further down this list you go, the more nodes have to agree "yes, I have this write" before you get your acknowledgement back — and the longer that naturally takes.

### j (Journaling) Explained

There's a second, independent dial layered on top: even if the primary has acknowledged the write, is it sitting only in memory, or has it actually been flushed to a durable on-disk journal?

```
j: false (default when w:1)          j: true
─────────────────────────────        ─────────────────────────────
Write sits in memory buffer          Write flushed to journal file
Very fast                            Slightly slower (~1-2ms extra)
Lost on unclean shutdown             Survives unclean shutdown
```

### Replica Set Write Concern Flow

Here's what actually happens on the wire when you ask for `{ w: "majority", j: true }`:

```
Client
  │
  │ insertOne({...}, { writeConcern: { w: "majority", j: true } })
  ▼
Primary  ────────────────────────────────────────────►  ACK to client
  │                                                      (after majority)
  ├──── Oplog replication ────► Secondary 1 (ACKs)
  │
  └──── Oplog replication ────► Secondary 2 (ACKs)
```

The primary doesn't reply the instant it writes locally — it waits until enough secondaries have replicated the oplog entry and acknowledged it too. That wait is exactly the cost of durability.

### The Durability / Speed Tradeoff

This is really the whole story of Write Concern in one sentence: **every step up in `w` or turning on `j` buys you more certainty that the write survives a crash, and every step costs you latency.** There's no free lunch — you're explicitly trading speed for durability, and MongoDB lets you make that trade per-operation, not just once globally.

### Code Examples

```js
// Fire and forget — logging/telemetry
db.clickEvents.insertOne(
  { userId: "u123", page: "/home", ts: new Date() },
  { writeConcern: { w: 0 } }
);

// Default — primary acknowledged
db.sessions.insertOne(
  { token: "abc", userId: "u123", expiresAt: new Date() }
  // w:1 is default
);

// Maximum durability — financial transactions
db.transactions.insertOne(
  { from: "acct-A", to: "acct-B", amount: 500.00, ts: new Date() },
  { writeConcern: { w: "majority", j: true, wtimeout: 5000 } }
);
```

Notice the pairing: throwaway telemetry gets `w: 0` (who cares if one click event vanishes), and money movement gets `w: "majority", j: true` (nothing about a financial transaction is allowed to vanish, even if the primary crashes a millisecond later).

### Compare: write concern levels

| Setting | Waits for | Survives primary crash? | Survives unclean shutdown? | Typical use |
|---|---|---|---|---|
| `w: 0` | Nothing | No | No | Analytics, telemetry, click tracking |
| `w: 1` (default) | Primary in-memory | No | No | General-purpose, most app writes |
| `w: 2` | Primary + 1 secondary | Yes | Depends on `j` | Slightly more critical writes |
| `w: "majority"` + `j: true` | Majority of voting nodes, journaled | Yes | Yes | Financial transactions, critical data |

**Common mistake:** assuming the default `w: 1` is "safe" in every sense. It only confirms the primary has the write in memory — if that primary crashes before replicating or journaling, the write can be lost. Also, forgetting that `wtimeout` only bounds how long you *wait* for the acknowledgement — if it expires, the write may still complete on the server; only the client's confirmation timed out.

**Interview answer:** "Write Concern controls how many nodes must acknowledge a write, and whether it must be journaled to disk, before MongoDB reports success back to the client. `w` sets the acknowledgement count — from `0` (fire and forget) up through `1` (primary only, the default) to `\"majority\"` (a quorum, which survives primary failover). `j: true` additionally requires the write be flushed to the on-disk journal, so it survives an unclean shutdown. It's fundamentally a durability-versus-latency dial: for financial transactions you'd use `{ w: \"majority\", j: true }` because the certainty is worth the extra milliseconds, while for high-volume telemetry you might use `w: 0` because occasional loss is an acceptable price for maximum throughput."

> **Memory hook:** "w is *how many hands* shook on it, j is *whether it's in ink or pencil* — more hands and ink cost you time, but nothing gets lost."

### writeConcern in Connection String

```
mongodb://host:27017/mydb?w=majority&journal=true&wtimeoutMS=5000
```

---

## 6. bulkWrite() Operations

Suppose you need to insert three new items, bump the quantity on an existing one, and delete a batch of discontinued products — all as part of the same logical action. Do you really want three separate round-trips to the server for that? `bulkWrite()` exists precisely so you don't have to.

`bulkWrite()` sends multiple write operations (insert, update, delete) in a **single network round-trip**. Far more efficient than looping individual operations.

### Supported Operation Types

| Operation         | Description                                    |
|-------------------|------------------------------------------------|
| `insertOne`       | Insert a single document                       |
| `updateOne`       | Update first matching document                 |
| `updateMany`      | Update all matching documents                  |
| `replaceOne`      | Replace first matching document entirely       |
| `deleteOne`       | Delete first matching document                 |
| `deleteMany`      | Delete all matching documents                  |

### Syntax

```js
db.collection.bulkWrite(
  [ <operation1>, <operation2>, ... ],
  {
    ordered: <boolean>,       // default: true
    writeConcern: <document>
  }
)
```

### Internal working — one round trip, many operation types

```text
Client builds an array of mixed operations
        |
        v
bulkWrite(ops) sent to server as ONE request
        |
        v
Server executes each op in sequence (or parallel if unordered)
   |         |         |          |
insertOne  updateOne  replaceOne  deleteMany
   |         |         |          |
        v
Server assembles ONE combined result document
(insertedCount, matchedCount, modifiedCount,
 deletedCount, upsertedCount, ...)
        |
        v
Single response sent back to client
```

The important thing that makes this different from just calling five methods back to back: it's still five operations happening on the server, but only **one** network trip in each direction — the client isn't waiting on five separate request/response cycles.

### Full Example

```js
const result = await db.collection("inventory").bulkWrite([
  // Insert a new product
  {
    insertOne: {
      document: { _id: "ITEM-099", name: "USB Hub", qty: 50, price: 39.99 }
    }
  },
  // Update stock quantity for an existing item
  {
    updateOne: {
      filter: { _id: "ITEM-001" },
      update: { $inc: { qty: -5 } },
      upsert: false
    }
  },
  // Upsert a product (insert if not found)
  {
    updateOne: {
      filter: { _id: "ITEM-999" },
      update: { $set: { name: "HDMI Cable", qty: 200, price: 14.99 } },
      upsert: true
    }
  },
  // Replace a document entirely
  {
    replaceOne: {
      filter: { _id: "ITEM-010" },
      replacement: { _id: "ITEM-010", name: "Webcam Pro", qty: 30, price: 99.99 }
    }
  },
  // Delete discontinued items
  {
    deleteMany: {
      filter: { discontinued: true }
    }
  }
]);
```

### Return Value

Notice it's a single combined receipt covering every operation type in the batch — you don't get five separate results, you get one summary:

```js
{
  acknowledged: true,
  insertedCount: 1,
  insertedIds: { "0": "ITEM-099" },
  matchedCount: 2,
  modifiedCount: 2,
  deletedCount: 3,
  upsertedCount: 1,
  upsertedIds: { "2": "ITEM-999" }
}
```

### Ordered vs Unordered bulkWrite

Exactly the same rule that applied to `insertMany()` applies here — `ordered: true` stops the whole batch at the first error; `ordered: false` powers through and reports everything at the end.

```js
// ordered: true (default) — stops on first error
await db.collection("logs").bulkWrite(ops, { ordered: true });

// ordered: false — continues past errors, maximizes throughput
await db.collection("logs").bulkWrite(ops, { ordered: false });
```

**Common mistake:** assuming an `updateOne` or `deleteMany` failing partway through an ordered `bulkWrite()` rolls back the operations that already succeeded. It doesn't — just like `insertMany()`, whatever already executed stays executed; only the *remaining, not-yet-attempted* operations are skipped.

**Interview answer:** "`bulkWrite()` lets you send a mixed array of insert, update, and delete operations to the server in a single round trip, which is its key advantage over calling those methods individually in a loop. `ordered` controls whether it stops at the first failing operation (default `true`) or keeps executing the rest of the batch and reports every error at the end (`false`) — the same tradeoff as `insertMany()`, just generalized across operation types."

> **Memory hook:** "One envelope, five different errands inside it — the mail carrier makes one trip, not five."

### Performance Comparison

```
Single inserts in a loop (1000 docs):
  ┌─────────────────────────────────────┐
  │  1000 × network round-trips          │
  │  Approx time: ~500ms–2s             │
  └─────────────────────────────────────┘

bulkWrite (1000 docs):
  ┌─────────────────────────────────────┐
  │  1 network round-trip               │
  │  Approx time: ~20–80ms              │
  └─────────────────────────────────────┘
```

---

## 7. JSON Schema Validation ($jsonSchema)

Application-level validation is easy to forget, easy to bypass (a script writing straight to the database, a teammate poking around in `mongosh`), and easy to get subtly wrong across multiple services that all touch the same collection. What if the database itself refused to store a document that doesn't look right — no matter who or what is writing it?

That's what **document validation** gives you. MongoDB 3.6+ supports it using JSON Schema, and it enforces data quality at the database layer — not just the application layer.

### Creating a Collection with Validation

```js
db.createCollection("employees", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "department", "salary"],
      properties: {
        name: {
          bsonType: "string",
          description: "must be a string and is required"
        },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "must be a valid email address"
        },
        department: {
          bsonType: "string",
          enum: ["Engineering", "Marketing", "Finance", "HR"],
          description: "must be one of the allowed department names"
        },
        salary: {
          bsonType: "number",
          minimum: 30000,
          maximum: 500000,
          description: "salary must be between 30000 and 500000"
        },
        startDate: {
          bsonType: "date",
          description: "optional — must be a BSON date if provided"
        },
        skills: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "optional — array of skill strings"
        }
      }
    }
  },
  validationLevel: "strict",      // "strict" (default) | "moderate"
  validationAction: "error"       // "error" (default) | "warn"
});
```

Two knobs on this validator decide how strict and how forgiving it is. They're easy to gloss over, but they matter a lot in practice — especially the moment you try to add validation to a collection that already has years of messy data in it.

### validationLevel Options

`validationLevel` answers: *which writes actually get checked?*

| Level      | Behaviour                                                          |
|------------|---------------------------------------------------------------------|
| `strict`   | All inserts AND updates must pass validation (default)              |
| `moderate` | Inserts must pass; updates only validated if document already valid |

Why would `moderate` ever be preferable to `strict`? Picture bolting validation onto a `products` collection that's been running for two years with no rules at all. Plenty of existing documents won't conform to your shiny new schema. With `strict`, the moment anyone tries to update one of those legacy documents — even just to bump a `qty` field — the update gets rejected, because updating triggers a full validation check. With `moderate`, MongoDB only re-validates documents that were already valid to begin with; the legacy stragglers can still be touched without the validator blocking you, giving you room to migrate them gradually.

### validationAction Options

`validationAction` answers: *what happens when a write fails the check?*

| Action  | Behaviour                                              |
|---------|--------------------------------------------------------|
| `error` | Reject document — throw WriteError (default)           |
| `warn`  | Allow document but log a warning in mongod logs        |

`warn` is the "dry run" mode — useful when you're rolling out a new validator on a live collection and want to see, via the logs, how many writes *would* have failed before you flip it over to `error` and start actually blocking them.

### Internal working — what the server does on write

```
Insert document
      │
      ▼
┌─────────────────────────────────┐
│  Validation Engine              │
│                                 │
│  1. Check required fields       │
│  2. Check bsonType per field    │
│  3. Check pattern/enum/min/max  │
│  4. If validationAction=error   │
│     └─► reject + throw error    │
│     If validationAction=warn    │
│     └─► insert + log warning    │
└─────────────────────────────────┘
```

Notice validation happens on the *way in*, before the document is written to storage — not as an afterthought. And notice the split at the bottom: `error` and `warn` both run the exact same checks, they just disagree about what to do once a check fails.

### Valid Insert

```js
db.employees.insertOne({
  name: "Jane Doe",
  email: "jane.doe@acme.com",
  department: "Engineering",
  salary: 95000,
  startDate: new Date("2024-03-01"),
  skills: ["JavaScript", "MongoDB", "React"]
});
// OK: all required fields present, types match, salary in range
```

### Invalid Insert — Will Throw

```js
db.employees.insertOne({
  name: "John",
  email: "not-an-email",           // fails pattern
  department: "Legal",             // not in enum
  salary: 25000                    // below minimum
});
// MongoServerError: Document failed validation
```

### Adding Validation to an Existing Collection

This is exactly the "years of messy data" scenario from above — notice `validationLevel: "moderate"` doing the work of not breaking every existing document the moment this runs:

```js
db.runCommand({
  collMod: "products",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["sku", "price"],
      properties: {
        sku:   { bsonType: "string" },
        price: { bsonType: "number", minimum: 0 }
      }
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
});
```

### Viewing Validation Rules

```js
db.getCollectionInfos({ name: "employees" })[0].options.validator;
```

**Common mistake:** treating `$jsonSchema` validation as a substitute for application-level validation entirely. It's a last line of defense — a safety net that catches bad data regardless of which service wrote it — but it typically produces less friendly error messages than something you'd show a user in a form. Keep both layers: validate early in the application for good UX, and validate again at the database for a guarantee that holds no matter who's writing.

**Interview answer:** "JSON Schema validation lets you attach a `$jsonSchema` validator to a collection so MongoDB itself enforces required fields, BSON types, enums, ranges, and regex patterns on every insert and update — not just whatever your application code happens to check. `validationLevel` controls whether existing non-conforming documents are exempted (`moderate`) or everything is checked (`strict`), and `validationAction` controls whether a failing write is rejected outright (`error`) or just logged as a warning while still allowed through (`warn`). The `moderate` + `warn` combination is especially useful when retrofitting validation onto a collection that already has years of inconsistent data."

> **Memory hook:** "The bouncer at the door checks everyone (`strict`) or just lets in anyone who was already inside (`moderate`) — and either turns people away (`error`) or just writes their name down and lets them in anyway (`warn`)."

---

## 8. Hands-On Exercises

### Exercise 1 — E-commerce Product Catalog

Create a collection `products` with JSON Schema validation requiring `name` (string), `price` (number >= 0), `category` (enum: ["Electronics", "Clothing", "Books", "Home"]), and `inStock` (boolean). Insert 5 valid products using `insertMany()`. Then attempt to insert a product with a negative price and observe the error.

```js
// Your solution here
db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "price", "category", "inStock"],
      properties: {
        name:     { bsonType: "string" },
        price:    { bsonType: "number", minimum: 0 },
        category: { bsonType: "string", enum: ["Electronics","Clothing","Books","Home"] },
        inStock:  { bsonType: "bool" }
      }
    }
  }
});
```

### Exercise 2 — ObjectId Time Travel

Insert a document into a collection `timeline` without specifying `_id`. Then retrieve the document and extract the insertion timestamp using `getTimestamp()`. Compare it to a `createdAt` field you also store. Verify they are within the same second.

### Exercise 3 — Bulk Import with Error Handling

You have 1000 user records to import. Some records have duplicate `email` fields (unique index exists). Write a `bulkWrite()` or `insertMany()` with `ordered: false` to maximise successful inserts. Log how many succeeded and how many failed.

```js
const users = [ /* array of 1000 user objects */ ];
try {
  const result = await db.collection("users").insertMany(users, { ordered: false });
  console.log(`Inserted: ${result.insertedCount}`);
} catch (err) {
  console.log(`Inserted: ${err.result.insertedCount}`);
  console.log(`Errors:   ${err.writeErrors.length}`);
}
```

### Exercise 4 — Write Concern Benchmarking

Insert 100 documents three times with different write concerns: `w:0`, `w:1`, `w:"majority"`. Measure the time each takes. Note the trade-off between speed and durability.

```js
const docs = Array.from({length: 100}, (_, i) => ({ seq: i, data: "test" }));

console.time("w:0");
await db.collection("bench").insertMany(docs, { writeConcern: { w: 0 } });
console.timeEnd("w:0");

console.time("w:1");
await db.collection("bench").insertMany(docs, { writeConcern: { w: 1 } });
console.timeEnd("w:1");
```

### Exercise 5 — Mixed bulkWrite

Write a `bulkWrite()` that in a single call: inserts 3 new log entries, updates the `count` field of an existing summary document using `$inc`, and deletes all log entries older than 30 days.

```js
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
await db.collection("logs").bulkWrite([
  { insertOne: { document: { level: "INFO",  msg: "Server started",  ts: new Date() } } },
  { insertOne: { document: { level: "WARN",  msg: "High memory",     ts: new Date() } } },
  { insertOne: { document: { level: "ERROR", msg: "DB timeout",      ts: new Date() } } },
  { updateOne: { filter: { _id: "summary" }, update: { $inc: { count: 3 } }, upsert: true } },
  { deleteMany: { filter: { ts: { $lt: thirtyDaysAgo } } } }
]);
```

---

## 9. Interview Q&A

**Q1: What happens if you insert a document without specifying `_id`?**
MongoDB automatically generates a 12-byte ObjectId and assigns it as `_id`. This is done at the driver level before the document is sent to the server, so the client always knows the `_id` immediately.

**Q2: What is the difference between `ordered: true` and `ordered: false` in `insertMany()`?**
With `ordered: true` (default), MongoDB processes documents sequentially and stops at the first error — all remaining documents are not inserted. With `ordered: false`, MongoDB processes all documents and reports all errors at the end; successfully inserted documents remain inserted regardless of other failures.

**Q3: Explain the three components of an ObjectId.**
An ObjectId is 12 bytes: (1) 4 bytes for the Unix timestamp in seconds — encoding when the document was created; (2) 5 bytes of random data unique to the machine and process, preventing collisions across nodes; (3) 3 bytes for an incrementing counter starting at a random value, preventing collisions within the same second on the same process.

**Q4: What write concern should you use for financial transactions?**
Use `{ w: "majority", j: true }`. `w: "majority"` ensures more than half the replica set nodes have the write, surviving a primary failover. `j: true` ensures the write is flushed to the on-disk journal, surviving an unclean shutdown.

**Q5: What is `w: 0` write concern and when would you use it?**
`w: 0` is "fire and forget" — the client does not wait for any acknowledgement from the server. It is the fastest option but provides no durability guarantee. Use it for high-throughput, loss-tolerant data like analytics events, click tracking, or telemetry where occasional data loss is acceptable.

**Q6: Can you perform inserts and deletes in the same `bulkWrite()` call?**
Yes. `bulkWrite()` accepts any mix of `insertOne`, `updateOne`, `updateMany`, `replaceOne`, `deleteOne`, and `deleteMany` operations in a single array. This is its primary advantage over looping individual operations.

**Q7: What is JSON Schema validation and at what layer does it operate?**
JSON Schema validation (`$jsonSchema`) is enforced at the MongoDB server/database layer. It validates documents on insert and update based on defined rules (required fields, BSON types, enums, min/max, regex patterns). This is separate from application-level validation and acts as a final safety net.

**Q8: What is `validationLevel: "moderate"` used for?**
When adding validation to an existing collection that may already contain non-conforming documents. With `moderate`, only new inserts and updates to documents that already conform to the schema are validated. Existing non-conforming documents are not rejected on update.

**Q9: How do you extract the insertion time from an ObjectId without storing a `createdAt` field?**
Use `objectId.getTimestamp()` in the MongoDB shell or driver. This returns a JavaScript Date object derived from the first 4 bytes of the ObjectId. The precision is to the second.

**Q10: What is the maximum document size in MongoDB?**
16 megabytes (16 MB) per document. This limit prevents any single document from consuming excessive RAM or network bandwidth. For larger binary data, use GridFS.

**Q11: How does `bulkWrite()` improve performance over individual operations?**
`bulkWrite()` batches multiple operations into a single network round-trip. Individual operations each require a request-response cycle. For 1000 inserts, this reduces ~1000 round-trips to 1, dramatically reducing latency. On a typical LAN, this can be 10–50x faster.

**Q12: What is the difference between `insertMany()` and `bulkWrite()` with only `insertOne` operations?**
`insertMany()` is simpler and slightly more efficient for pure insert workloads since MongoDB has a dedicated insert wire protocol message. `bulkWrite()` is more flexible, supporting mixed operation types. For inserting only, prefer `insertMany()`.

**Q13: If an `insertMany()` with `ordered: true` fails on document 3 of 10, which documents are in the collection?**
Documents 1 and 2 are in the collection. MongoDB does not roll back the successful inserts before the failure point. There is no automatic transaction behaviour unless you are using multi-document transactions explicitly.

**Q14: How do you add a unique constraint on a field other than `_id`?**
Create a unique index: `db.collection.createIndex({ email: 1 }, { unique: true })`. After this, any insert or update that would create a duplicate value in the `email` field will fail with error code 11000 (duplicate key error).

**Q15: What does `wtimeout` do and what happens when it expires?**
`wtimeout` specifies how many milliseconds to wait for `w` secondary nodes to acknowledge the write. If the timeout expires before enough nodes acknowledge, MongoDB returns a `WriteConcernError`. Importantly, the write may still have been applied — `wtimeout` is about the acknowledgement wait, not the operation itself.
