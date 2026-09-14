# ACID Properties in MongoDB

## Table of Contents

1. [What is ACID?](#1-what-is-acid)
2. [Atomicity](#2-atomicity)
3. [Consistency](#3-consistency)
4. [Isolation](#4-isolation)
5. [Durability](#5-durability)
6. [Read Concerns](#6-read-concerns)
7. [Write Concerns](#7-write-concerns)
8. [Causally Consistent Sessions](#8-causally-consistent-sessions)
9. [ACID Decision Flow](#9-acid-decision-flow)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is ACID?

Picture this: you're transferring $500 from your savings account to your checking account. Under the hood, that's two separate operations:

```
1. Debit Account A by $500
2. Credit Account B by $500
```

Now imagine the bank's server crashes right between step 1 and step 2. Account A is down $500. Account B never got it. The money just... vanished.

That's the exact problem ACID exists to solve. Nobody wants to be the customer whose $500 disappeared into a crash log.

---

### The four guarantees, in plain English

ACID is a bundle of four promises a database makes about how it handles operations like that transfer:

```
┌─────────────────────────────────────────────────────────────┐
│                        ACID                                 │
├──────────────┬──────────────────────────────────────────────┤
│ A — Atomicity│ All operations succeed or none do            │
│ C — Consistency│ DB moves from one valid state to another  │
│ I — Isolation│ Concurrent transactions do not interfere    │
│ D — Durability│ Committed data survives crashes            │
└──────────────┴──────────────────────────────────────────────┘
```

Go back to the bank transfer and each letter clicks into place:

- **Atomicity** — either both the debit and the credit happen, or neither does. No half-transfers.
- **Consistency** — before and after the transfer, the total money in the system is the same. The database never lands in a state that breaks the rules (like a negative balance).
- **Isolation** — if two transfers involving Account A happen at the same second, they don't scramble each other's numbers.
- **Durability** — once the bank says "transfer complete," that's final. Even if the server loses power one second later, the transfer is not undone.

So: ACID isn't an academic checklist — it's just "don't lose money, don't corrupt data, don't let concurrent requests trip over each other, and don't forget what already happened."

---

### MongoDB's ACID story (it wasn't always like this)

```
| Version   | What was added                                  |
|-----------|--------------------------------------------------|
| 1.x – 3.x | Single-document atomicity only                   |
| 4.0       | Multi-document ACID transactions (replica sets)  |
| 4.2       | Distributed transactions across shards           |
| 4.4+      | Refinements: read concern `snapshot` in transactions |
```

Why does this table matter? Because for years, "MongoDB doesn't support transactions" was a legitimate criticism. It's no longer true — but understanding *when* it became true tells you a lot about how MongoDB expects you to model data (hint: embed first, transact only when you must).

---

## 2. Atomicity

### 2.1 Single-Document Atomicity (Always Free)

Here's the thing most people miss: MongoDB gives you atomicity **for free**, no transaction needed, as long as everything you're changing lives inside one document.

This is MongoDB's real superpower, and it's the entire reason the "embed related data together" advice exists in the first place.

```
┌──────────────────────────────────────────────────────┐
│  Single Document Update                              │
│                                                      │
│  db.orders.updateOne(                                │
│    { _id: 1 },                                       │
│    { $set: { status: "shipped" },                    │
│      $push: { history: { event: "shipped",           │
│                          date: new Date() } } }      │
│  )                                                   │
│                                                      │
│  ┌──────────────┐                                    │
│  │  Atomic!     │  Both $set and $push happen        │
│  │  No txn      │  together or not at all            │
│  │  needed      │                                    │
│  └──────────────┘                                    │
└──────────────────────────────────────────────────────┘
```

Why is this atomic, mechanically? WiredTiger (the default storage engine) uses **document-level locking** combined with a write-ahead log (journal). A single document write is a single journal entry — it either fully replays on recovery, or it's discarded. There's no in-between state where half the fields updated.

---

### 2.2 Multi-Document Atomicity (Explicit Transaction)

The free lunch ends the moment your data spans multiple documents or collections. Then you need an explicit transaction to get the same all-or-nothing guarantee.

**When you actually need it:**

```
┌─────────────────────────────────────────────────────────────┐
│  E-commerce order placement                                  │
│                                                             │
│  Operation 1: Insert into orders collection                 │
│  Operation 2: Decrement inventory in products collection    │
│  Operation 3: Debit wallet in users collection               │
│                                                             │
│  These MUST all succeed or all fail.                        │
│  Without a transaction, a crash between ops leaves          │
│  the DB in a half-written, inconsistent state.               │
└─────────────────────────────────────────────────────────────┘
```

**Rule of thumb — embed vs. reference:**

```
If related data changes together → embed → single-document atomic
If related data is queried independently → reference → may need transaction
```

Keep that rule of thumb pinned somewhere. It's the single most useful sentence in this whole file for deciding whether you even need transactions — often the answer is "no, just redesign the schema."

---

### 2.3 How MongoDB Implements Atomicity Internally

So what's actually happening when you call `commitTransaction()`? MongoDB uses **Multi-Version Concurrency Control (MVCC)**, backed by WiredTiger snapshots:

1. A transaction acquires a read timestamp (a snapshot of the data at that point).
2. All writes are buffered in a private write set — invisible to everyone else.
3. On `commitTransaction`, writes are applied atomically to the journal.
4. On `abortTransaction`, the write set is discarded — no trace in the DB, as if it never happened.

```
Timeline:

T=0   Transaction starts, snapshot taken
T=1   Write A buffered (not yet visible to other readers)
T=2   Write B buffered
T=3   commitTransaction → writes flushed atomically
T=4   Both A and B visible to all readers simultaneously
```

Notice step T=1 and T=2 — nothing is visible to anyone else until T=3. That's the crux of "isolation," which we'll dig into properly in Section 4.

---

## 3. Consistency

### 3.1 What Consistency Means in MongoDB

"Consistency" in ACID doesn't mean "the data is always correct" in some magical sense — it means the database only ever moves from one **valid state** to another valid state. It never lets a write leave things half-broken.

MongoDB enforces validity through three mechanisms:

1. **Document validation rules (schema validation)**
2. **Application-level constraints**
3. **Unique indexes**

---

### 3.2 Schema Validation (MongoDB 3.6+)

Think of schema validation as a bouncer standing at the door of your collection: it checks every document trying to get in, and turns away anything that doesn't meet the dress code.

```js
db.createCollection("accounts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["owner", "balance", "currency"],
      properties: {
        owner: {
          bsonType: "string",
          description: "must be a string and is required"
        },
        balance: {
          bsonType: "number",
          minimum: 0,
          description: "balance cannot be negative"
        },
        currency: {
          enum: ["USD", "AUD", "EUR"],
          description: "only supported currencies"
        }
      }
    }
  },
  validationAction: "error"   // "warn" to log without rejecting
});
```

`validationAction` has two settings, and they matter for different moments in a project's life:
- `"error"` (default) — rejects writes that violate the schema. Use this once you trust your schema.
- `"warn"` — logs a warning but lets the write through anyway. Handy while you're migrating an existing collection and don't want to break production traffic on day one.

---

### 3.3 Checking and Modifying Validation Rules

Schemas evolve. You're not locked into whatever rules you wrote on day one — you can inspect and update them later:

```js
// See existing validation
db.getCollectionInfos({ name: "accounts" });

// Update validation rules on existing collection
db.runCommand({
  collMod: "accounts",
  validator: {
    $jsonSchema: { /* updated schema */ }
  },
  validationLevel: "strict"   // "moderate" only validates new/updated docs
});
```

`validationLevel: "moderate"` is the gentler option — it only checks documents as they're inserted or updated, leaving old, already-existing documents untouched even if they'd fail the new rules.

---

### 3.4 Consistency vs. CAP Theorem

Zoom out to a distributed replica set, and "consistency" starts trading off against availability. When a network partition happens, MongoDB has to pick a side — and it lets *you* dial that trade-off via **read concerns** and **write concerns** (covered in Sections 6 and 7).

```
Strong consistency  ←──────────────────────→  High availability
  (linearizable)                                   (local)
```

---

## 4. Isolation

### 4.1 Snapshot Isolation via MVCC

Here's a scenario: you're reading a customer's balance while, at the very same instant, another process is updating it. What number should you see — the old one or the new one?

MongoDB's answer is: whatever the balance was the moment *your* read started. This is called **snapshot isolation** — each transaction sees a consistent snapshot of the data as it existed at the moment it began. Writes by other concurrent transactions stay invisible until after they commit.

**Real-world analogy:** think of a library photocopier. The instant you press "copy," the copy captures the book exactly as it looked at that moment. Someone could scribble in the original a second later — your copy doesn't care. It's frozen.

```
┌──────────────────────────────────────────────────────┐
│  MVCC — Multi-Version Concurrency Control            │
│                                                      │
│  Document versions in WiredTiger:                    │
│                                                      │
│  Version 1 (T=10): { balance: 1000 }  ← TxnA sees  │
│  Version 2 (T=15): { balance: 900  }  ← TxnB wrote  │
│  Version 3 (T=20): { balance: 850  }  ← TxnC wrote  │
│                                                      │
│  TxnA (started at T=12) always reads Version 1       │
│  regardless of how many newer versions exist.        │
└──────────────────────────────────────────────────────┘
```

Notice TxnA started at T=12 — *after* Version 1 was written but before Version 2. It's frozen on Version 1 for its entire lifetime, no matter what TxnB or TxnC do afterward.

---

### 4.2 Isolation Levels Compared

Snapshot isolation is just one point on a spectrum of database isolation levels. Here's where it sits relative to the classic textbook levels:

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|---|---|---|---|
| Read Uncommitted | Yes | Yes | Yes |
| Read Committed | No | Yes | Yes |
| Repeatable Read | No | No | Yes |
| **Snapshot (MongoDB)** | **No** | **No** | **No** |
| Serializable | No | No | No |

MongoDB's snapshot isolation sits between "Repeatable Read" and full "Serializable." It blocks dirty reads, non-repeatable reads, and phantom reads — but it theoretically allows **write skew** anomalies (rare enough in practice that most teams never hit it).

---

### 4.3 Read Your Own Writes

One thing that trips people up: does a transaction see its *own* uncommitted writes? Yes, always.

```js
const session = client.startSession();
session.startTransaction();

// Write something
await db.collection("accounts").updateOne(
  { _id: "acct1" },
  { $inc: { balance: -100 } },
  { session }
);

// Read it back — sees the -100 deduction even before commit
const acct = await db.collection("accounts").findOne(
  { _id: "acct1" },
  { session }
);
// acct.balance reflects the -100 deduction

await session.commitTransaction();
```

Makes sense once you think about it: snapshot isolation hides *other* transactions' writes from you — it was never meant to hide your own.

---

### 4.4 Write Conflicts

What happens when two transactions both reach for the same document at the same time?

```
TxnA writes doc X  →  TxnB tries to write doc X
                        →  WriteConflict error
                           TxnB must abort and retry
```

MongoDB raises a `WriteConflict` error (code 112). This is optimistic concurrency in action — MongoDB doesn't make transactions queue up and wait for a lock; it lets them race, and whichever commits first wins. The loser gets an error and has to retry from scratch. Your application code is responsible for catching that error and retrying — we'll see the exact retry pattern in the next lesson on multi-document transactions.

---

## 5. Durability

### 5.1 The WiredTiger Journal

Durability answers one question: once MongoDB tells you "yes, that write is done," can you trust it — even if the server loses power one millisecond later?

MongoDB achieves this through the **WiredTiger write-ahead journal (WAJ)**. Think of the journal as a running diary: before the change is filed away neatly into its permanent home, it's first jotted down in the diary. If the power goes out mid-filing, MongoDB just re-reads the diary on restart and replays whatever it finds.

```
Write flow:

Application
    │
    ▼
MongoDB mongod process
    │
    ├─── 1. Write buffered in memory (in-memory dirty pages)
    │
    ├─── 2. Journal entry written to disk (WAL file)
    │         [This is the durable point — crash-safe after here]
    │
    └─── 3. Checkpoint: dirty pages flushed to data files
                         (every 60 s by default)
```

That middle step is the one that matters. The moment the journal entry hits disk, the write is durable — even though the "real" data file hasn't been touched yet.

On a crash, MongoDB replays the journal from the last checkpoint. Anything that made it into the journal gets replayed and is therefore safe.

---

### 5.2 Journal Commit Interval

```js
// mongod.conf
storage:
  wiredTiger:
    engineConfig:
      journalCompressor: snappy   # compress journal entries

// Default journal sync: every 100ms
// For j:true writes: sync happens before acknowledgement
```

---

### 5.3 Durability in Replica Sets

Here's a subtlety worth pausing on: a single node's journal only guarantees durability *on that node*. If the primary journals a write and then immediately dies before replicating it, that write can vanish during failover.

True durability in a replica set means the write has been journaled on a **majority of nodes** — that way, even if the primary is gone for good, at least one surviving node has the data.

```
Primary ──journal──► Acknowledged to client (w:1)
   │
   ├──oplog──► Secondary 1 journals ─┐
   │                                  ├─ w:majority acknowledgement
   └──oplog──► Secondary 2 journals ─┘
```

---

## 6. Read Concerns

### 6.1 What problem read concerns solve

Say you read a document straight off the primary. Is that data guaranteed to still be there tomorrow? Not necessarily — if the primary crashes before that write replicates anywhere else, and a secondary takes over, that write can quietly disappear. You just read data that got "rolled back."

Read concerns exist to let you choose, per query, how much you trust what you're reading. It's a dial between **recency** (see the newest data, even if it's risky) and **safety** (only see data that's guaranteed to stick around).

```
┌──────────────┬────────────────────────────────────────────────────┐
│ Read Concern │ Description                                        │
├──────────────┼────────────────────────────────────────────────────┤
│ local        │ Returns most recent data on the queried node.      │
│              │ May return data that is rolled back later.         │
│              │ Default for standalone & replica set primary reads.│
├──────────────┼────────────────────────────────────────────────────┤
│ available    │ Like local but for sharded clusters. May return    │
│              │ orphaned documents from incomplete migrations.     │
│              │ Lowest latency, lowest guarantees.                 │
├──────────────┼────────────────────────────────────────────────────┤
│ majority     │ Returns data acknowledged by a majority of nodes.  │
│              │ Guarantees data will not be rolled back.           │
│              │ Slightly higher latency.                           │
├──────────────┼────────────────────────────────────────────────────┤
│ linearizable │ Guarantees reading the most recent majority-       │
│              │ committed data. Waits for preceding writes to      │
│              │ propagate. Highest consistency, highest latency.   │
│              │ Only for single-document reads.                    │
├──────────────┼────────────────────────────────────────────────────┤
│ snapshot     │ Used inside multi-document transactions.           │
│              │ Returns data from a consistent snapshot at the     │
│              │ transaction start time.                            │
└──────────────┴────────────────────────────────────────────────────┘
```

---

### 6.2 Setting Read Concern in Node.js

```js
// On a specific operation
const result = await db.collection("accounts").findOne(
  { _id: "acct1" },
  { readConcern: { level: "majority" } }
);

// On the collection level
const accountsColl = db.collection("accounts").withReadConcern("majority");

// On the session (applies to all ops in the session)
const session = client.startSession();
session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
});
```

---

### 6.3 Read Concern Comparison Table

| Concern | Prevents rollback? | Reads stale data? | Latency | Use case |
|---|---|---|---|---|
| local | No | Possibly | Lowest | Analytics, dashboards |
| available | No | Yes (shards) | Lowest | Approximate reporting |
| majority | Yes | Slightly | Low-medium | Financial reads |
| linearizable | Yes | Never | Highest | Authoritative balance checks |
| snapshot | Yes (within txn) | No (snapshot) | Low (in txn) | Transactions |

The pattern to notice: the safer the guarantee, the more latency you pay. Nothing's free — pick the row that matches how much a stale or rolled-back read would actually hurt in your use case.

---

### 6.4 The Stale Read Problem (local vs majority)

Let's walk through exactly how a "rolled back" read happens, step by step:

```
Scenario: Primary P, Secondaries S1 and S2

1. Write W1 commits on P (acknowledged w:1)
2. Client reads from P → sees W1 ✓
3. P crashes before replicating W1
4. S1 elected as new primary → W1 never happened
5. Client reads from S1 → W1 is gone
```

Notice the client in step 2 saw perfectly valid-looking data — there was no error, no warning. It just turned out, a moment later, to never have really happened.

```
With readConcern majority:
Step 1 would not acknowledge until W1 is on majority of nodes.
So step 3 cannot happen — W1 is safe before acknowledgement.
```

**Common mistake:** assuming `readConcern: "local"` (the default) is "safe enough" for financial or authoritative data just because it's the default. Defaults optimize for speed, not safety — check what you actually need before trusting them.

**Interview answer:** "`local` read concern returns whatever is on the node you queried right now, which can theoretically be rolled back if the primary fails before replicating it. `majority` read concern only returns data that's already been acknowledged by a majority of replica set members, which guarantees it survives any single node failure. The trade-off is latency — majority reads wait slightly longer for that safety guarantee."

> **Memory hook:** "`local` is reading today's newspaper before the editor's final check — `majority` waits for the print run everyone agrees on."

---

## 7. Write Concerns

### 7.1 What problem write concerns solve

If read concerns answer "how much do I trust what I'm reading," write concerns answer the mirror question: "how sure do I need to be that my write actually stuck, before I move on?"

```js
{
  w: <value>,          // number of nodes, or "majority"
  j: <boolean>,        // require journal flush before ack
  wtimeout: <ms>       // how long to wait for w acknowledgement
}
```

---

### 7.2 w Values

```
┌───────────────┬──────────────────────────────────────────────────┐
│ w value       │ Meaning                                          │
├───────────────┼──────────────────────────────────────────────────┤
│ 0             │ Fire and forget — no acknowledgement at all.     │
│               │ Fastest. No guarantee whatsoever.               │
├───────────────┼──────────────────────────────────────────────────┤
│ 1 (default)   │ Primary acknowledges receipt.                    │
│               │ Does not guarantee replication to secondaries.  │
├───────────────┼──────────────────────────────────────────────────┤
│ 2, 3, ...     │ Exactly N nodes must acknowledge.               │
│               │ Use with care — if a secondary is down,         │
│               │ writes will block until wtimeout.               │
├───────────────┼──────────────────────────────────────────────────┤
│ "majority"    │ More than half the voting nodes must ack.        │
│               │ Best balance of safety and availability.         │
└───────────────┴──────────────────────────────────────────────────┘
```

---

### 7.3 The j (Journal) Flag

`w` controls *how many nodes* must confirm — `j` controls *how confirmed* each of those confirmations really is.

```js
// j: false (default) — write acknowledged when in memory
// Risk: if mongod crashes before journal flush, write is lost

// j: true — write acknowledged only after journal flush to disk
// Guarantees: survives process crash
// Cost: adds ~1ms latency (journal sync interval)

await db.collection("orders").insertOne(order, {
  writeConcern: { w: "majority", j: true, wtimeout: 5000 }
});
```

---

### 7.4 Write Concern Safety Matrix

| w | j | Survives process crash? | Survives primary failover? |
|---|---|---|---|
| 0 | false | No | No |
| 1 | false | No | No |
| 1 | true | Yes | No |
| majority | false | Maybe | Yes (usually) |
| majority | true | Yes | Yes |

Only the bottom row survives *both* failure modes. That's why `{ w: "majority", j: true }` is the go-to setting for anything you truly can't afford to lose.

---

### 7.5 wtimeout

```js
// If majority acknowledgement is not received within 5 seconds,
// return a WriteConcernError (but the write may have still succeeded!)
{
  writeConcern: { w: "majority", wtimeout: 5000 }
}
```

**Important — a common trap:** A `wtimeout` error does NOT mean the write failed. It only means the acknowledgement didn't arrive in time. The write may well have gone through anyway. Don't blindly retry on a `wtimeout` error — query to confirm the actual state first, or you risk applying the same write twice.

---

### 7.6 Choosing Write Concern for Your Workload

```
Financial data / critical records
  → { w: "majority", j: true }

User session data / analytics events
  → { w: 1 } (default is fine)

Logging / append-only telemetry
  → { w: 0 } (fire and forget acceptable)

Real-time leaderboards
  → { w: 1, j: false } (speed over safety)
```

The underlying question is always: "if this write silently disappeared, would anyone notice or care?" Money — yes. A leaderboard flicker — probably not.

---

## 8. Causally Consistent Sessions

### 8.1 The Problem: Monotonic Reads

Here's a strange bug that can happen in a replica set: you write something, then immediately read it back — from a secondary — and it's not there. Not because it failed, but because replication hasn't caught up yet.

```
Client writes document (goes to primary)
Client reads from secondary → document may not be there yet (replication lag)
```

Imagine updating your profile picture and then refreshing the page, only to see your old one for a few seconds. Confusing, and it erodes trust in the app.

---

### 8.2 Causal Consistency to the Rescue

MongoDB's **causally consistent sessions** (introduced in 3.6) fix exactly this. They track a logical clock across every operation in a session. Each operation carries a "cluster time" token, and MongoDB guarantees that subsequent reads in the same session always see data at least as recent as the previous write in that session — even if that read lands on a lagging secondary.

```js
const session = client.startSession({ causalConsistency: true });

// Write
await db.collection("users").updateOne(
  { _id: "user1" },
  { $set: { verified: true } },
  { session }
);

// This read is GUARANTEED to see the above write,
// even if directed to a secondary
const user = await db.collection("users").findOne(
  { _id: "user1" },
  { session, readPreference: "secondaryPreferred" }
);
// user.verified === true  (guaranteed)

session.endSession();
```

---

### 8.3 Four Causal Consistency Guarantees

```
┌─────────────────────────────────────┬────────────────────────────┐
│ Guarantee                           │ Meaning                    │
├─────────────────────────────────────┼────────────────────────────┤
│ Read your own writes                │ A session always sees its  │
│                                     │ own previous writes        │
├─────────────────────────────────────┼────────────────────────────┤
│ Monotonic reads                     │ A session never reads      │
│                                     │ older data than it saw     │
│                                     │ in a previous read         │
├─────────────────────────────────────┼────────────────────────────┤
│ Monotonic write                     │ Writes in a session are    │
│                                     │ ordered consistently       │
├─────────────────────────────────────┼────────────────────────────┤
│ Write follows read                  │ Writes happen after reads  │
│                                     │ that causally preceded them│
└─────────────────────────────────────┴────────────────────────────┘
```

---

### 8.4 Sessions vs Transactions

It's easy to conflate a "session" with a "transaction" — they're related but not the same tool.

| Feature | Session | Transaction |
|---|---|---|
| Causal consistency | Yes | Yes (stronger) |
| Atomicity | No | Yes |
| Rollback | No | Yes |
| Performance cost | Very low | Higher |
| Use for | Read-your-writes | Multi-doc atomicity |

A plain causally consistent session is cheap and solves "don't show me stale data I just wrote." A transaction is the heavier tool for "these five writes must all succeed together or all fail together" — that's the subject of the next lesson.

---

## 9. ACID Decision Flow

Put everything in this file together, and here's the mental checklist to run through before writing any operation:

```
Need to perform a database operation?
            │
            ▼
Is it a single document?
   │YES                    │NO
   ▼                       ▼
Always atomic.       Does it span multiple
No transaction       docs/collections?
needed.                    │YES
                           ▼
                  Is performance critical?
                   │YES               │NO
                   ▼                  ▼
            Can you redesign      Use explicit
            schema to embed?      transaction
            │YES     │NO          (4.0+ replica set
            ▼        ▼             4.2+ shards)
          Embed     Use
          data &   transaction +
          avoid    tune read/write
          txn      concerns
```

Notice how many branches lead back to "embed the data" — MongoDB genuinely wants you to reach for transactions as a last resort, not a default habit.

---

## 10. Hands-On Exercises

**Exercise 1 — Schema Validation**

Create a `payments` collection with JSON Schema validation that enforces:
- `amount` is a positive number
- `currency` is one of `["USD", "AUD", "GBP"]`
- `status` is one of `["pending", "completed", "failed"]`
- `createdAt` is a date

Try inserting a document with a negative amount and observe the error. Then change `validationAction` to `"warn"` and repeat.

---

**Exercise 2 — Read Concern Comparison**

Set up a 3-node replica set locally (or use Atlas). Insert a document with `writeConcern: { w: 1 }` (only primary). Then immediately query a secondary with `readConcern: "local"` and `readConcern: "majority"`. Use `db.adminCommand({ replSetGetStatus: 1 })` to observe replication lag. Measure the difference in results.

---

**Exercise 3 — Write Concern Timing**

Write a script that inserts 1,000 documents with each of these write concerns and measures total time:
- `{ w: 0 }`
- `{ w: 1 }`
- `{ w: 1, j: true }`
- `{ w: "majority" }`
- `{ w: "majority", j: true }`

Discuss the latency differences and what safety each level provides.

---

**Exercise 4 — Causal Consistency Demonstration**

Write a script that:
1. Creates a causally consistent session
2. Inserts a document via the session
3. Immediately reads that document using `readPreference: "secondaryPreferred"` within the same session
4. Asserts the document is present

Then repeat without a session and observe that the read sometimes returns nothing (depending on replication lag).

---

**Exercise 5 — Write Conflict Simulation**

Write two async functions that both attempt to update the same document inside concurrent transactions. Observe the `WriteConflict` error. Implement a retry loop that catches error code 112 and retries the transaction up to 3 times. Verify only one final state is persisted.

---

## 11. Interview Q&A

**Q1: Is every MongoDB write atomic?**
A: Single-document writes are always atomic — MongoDB guarantees this regardless of the number of fields being modified. Multi-document writes are NOT atomic by default; you need an explicit `startTransaction` / `commitTransaction` block for that.

---

**Q2: What is the difference between `readConcern: "local"` and `readConcern: "majority"`?**
A: `local` returns the most recent data on the queried node but that data might be rolled back if the node's writes have not been replicated to a majority yet. `majority` only returns data that has been acknowledged by a majority of replica set members, guaranteeing it will not be rolled back.

---

**Q3: What does `j: true` in a write concern guarantee?**
A: It guarantees that the write has been flushed to the WiredTiger journal on disk before acknowledgement. This means the write survives a mongod process crash (the journal is replayed on restart). Without `j: true`, the acknowledgement comes when the write is in memory, which is lost in a crash.

---

**Q4: What is MVCC and why does MongoDB use it?**
A: Multi-Version Concurrency Control stores multiple versions of each document so that readers and writers do not block each other. Readers see a consistent snapshot of the data without acquiring locks; writers work on new versions. MongoDB uses WiredTiger's MVCC implementation to achieve snapshot isolation with high concurrency.

---

**Q5: Can a transaction span multiple collections?**
A: Yes. Multi-document transactions in MongoDB 4.0+ can span multiple collections within the same replica set. MongoDB 4.2+ extends this to transactions across shards (distributed transactions).

---

**Q6: What is snapshot isolation and what anomalies does it prevent?**
A: Snapshot isolation gives each transaction a consistent point-in-time view of the database. It prevents dirty reads (reading uncommitted data), non-repeatable reads (getting different values for the same key within a transaction), and phantom reads (new rows appearing between reads in a transaction). It does not prevent all write-skew anomalies, unlike full serializable isolation.

---

**Q7: What happens if two transactions try to write the same document simultaneously?**
A: MongoDB uses optimistic concurrency. The second transaction to attempt the write receives a `WriteConflict` error (code 112). The application must catch this error and retry the entire transaction. The first transaction to commit wins.

---

**Q8: What is a causally consistent session and when would you use it?**
A: A causally consistent session tracks a logical clock so that operations within the session are always causally ordered — you always read your own writes and never read data older than data you already saw. Use it when reading from secondaries but needing to see writes you just made (e.g., write then immediately redirect user to a page that reads the same data).

---

**Q9: What is the risk of using `readConcern: "linearizable"`?**
A: `linearizable` waits until all preceding writes have been replicated to a majority before returning, guaranteeing you always read the most up-to-date committed data. The risk is significant latency (it must contact the primary and wait for confirmation) and it only works on single-document reads, not multi-document queries.

---

**Q10: What does `wtimeout` mean and what does it NOT mean?**
A: `wtimeout` specifies how long (in ms) to wait for the write concern acknowledgement. If the timeout expires, MongoDB returns a `WriteConcernError`. Critically, this does NOT mean the write failed — the write may have succeeded and simply not been acknowledged in time. The application should verify state before blindly retrying.

---

**Q11: How does the WiredTiger journal provide durability?**
A: WiredTiger maintains a write-ahead log (journal). Every write is appended to the journal before being applied to data files. On a crash, MongoDB replays the journal from the last checkpoint to recover any writes that made it into the journal but not yet into data files. Checkpoints happen every 60 seconds by default; in between, the journal is the source of truth.

---

**Q12: When should you NOT use a transaction?**
A: Avoid transactions when: the operation only touches a single document (always atomic without a transaction), the performance cost is unacceptable (transactions have ~3x overhead), or you can redesign the schema to embed related data in one document. Transactions are a tool of last resort in MongoDB — schema design should eliminate the need in most cases.

---

**Q13: What is the difference between `readConcern: "available"` and `readConcern: "local"` on a sharded cluster?**
A: On a sharded cluster during a chunk migration, a shard might temporarily hold documents it no longer owns (orphaned documents). `local` may return these orphaned documents for performance reasons. `available` is the same as `local` on a standalone/replica set, but on shards it is even more permissive. Neither prevents stale reads; for that, use `majority`.

---

**Q14: Can you use aggregation pipelines inside a transaction?**
A: Yes. In MongoDB 4.0+ you can run aggregation pipeline stages (`$match`, `$group`, `$lookup`, etc.) inside a transaction. The aggregation will see the transaction's snapshot (including the current session's uncommitted writes). Be aware that `$out` and `$merge` are not allowed inside transactions.

---

**Q15: How do read and write concerns interact?**
A: They are orthogonal controls. Write concern determines how durable a write is before acknowledgement. Read concern determines which version of data a read returns. For maximum consistency, pair `writeConcern: { w: "majority", j: true }` with `readConcern: "majority"`. This ensures writes are durable before they can be read, and reads only return data that is durably replicated.
