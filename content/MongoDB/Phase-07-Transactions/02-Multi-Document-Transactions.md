# Multi-Document Transactions in MongoDB

## Table of Contents

1. [Why Multi-Document Transactions?](#1-why-multi-document-transactions)
2. [Transaction Architecture](#2-transaction-architecture)
3. [Full Node.js Transaction Example](#3-full-nodejs-transaction-example)
4. [Error Handling and Retry Logic](#4-error-handling-and-retry-logic)
5. [Transaction Limitations](#5-transaction-limitations)
6. [Retryable Writes](#6-retryable-writes)
7. [Distributed Transactions Across Shards](#7-distributed-transactions-across-shards)
8. [Transaction Performance Tuning](#8-transaction-performance-tuning)
9. [Common Patterns](#9-common-patterns)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Multi-Document Transactions?

### 1.1 The Problem with Multiple Writes

Remember the bank transfer from the previous lesson — $500 moving from Account A to Account B? We used it to explain ACID in the abstract. Now let's actually build it, because a fund transfer is never really *one* write. It's always two:

```
accounts collection

┌─────────────────┐        ┌─────────────────┐
│  Account A      │        │  Account B      │
│  balance: 1000  │  ────► │  balance: 500   │
│                 │        │                 │
└─────────────────┘        └─────────────────┘

Operation 1: accounts.updateOne({ _id: "A" }, { $inc: { balance: -200 } })
Operation 2: accounts.updateOne({ _id: "B" }, { $inc: { balance: +200 } })
```

Here's the failure mode we warned about earlier, now made concrete: if the process crashes between Operation 1 and Operation 2, that $200 has left Account A and never arrived at Account B. It didn't get stuck anywhere — it just vanished into thin air.

```
Crash between Op1 and Op2 → $200 vanishes into thin air.
```

Single-document atomicity — the free lunch from Section 2 of the last lesson — doesn't save us here, because the two updates touch two *different* documents. That's exactly the gap multi-document transactions were built to close. MongoDB 4.0 solved this by letting you wrap both operations in one atomic unit: either both happen, or neither does.

### 1.2 When to Use Transactions (Decision Guide)

Before reaching for a transaction, though, ask the question we planted at the end of the last lesson: could this just be one document instead of two? Here's the actual decision path:

```
Does your operation touch more than one document?
                │
                ▼
         Yes ─────────────────────────────────────────┐
                                                       │
Can you redesign the schema to embed all related data  │
into a single document?                                │
         │                                             │
    Yes  │                   No                        │
    ▼                        ▼                         │
  Embed & avoid         Is this a replica set          │
  transaction          (4.0+) or sharded               │
  (best option)        cluster (4.2+)?                 │
                              │                        │
                         Yes  │                        │
                         ▼                             │
                    Use explicit                        │
                    transaction ◄──────────────────────┘
```

**Good candidates for transactions** — cases where embedding genuinely isn't an option because the documents are independent entities that need to be queried and updated on their own:
- Fund transfers between accounts
- E-commerce order placement (deduct inventory + create order + charge wallet)
- Booking systems (reserve seat + create reservation + charge)
- Event sourcing (write event + update aggregate)

**Bad candidates (redesign schema instead)** — cases where the "multi-document" problem is really just a modeling mistake:
- User profile + preferences → embed preferences in user document
- Order + order items → embed items array in order document
- Blog post + tags → embed tags array in post document

> **Memory hook:** "Before you reach for a transaction, ask: could these just be one document? A transaction is a seatbelt — great to have, but redesigning the road so you don't need it is better."

---

## 2. Transaction Architecture

### 2.1 Components

So what actually happens, mechanically, between `startTransaction()` and `commitTransaction()`? Here's the full round trip:

```
┌──────────────────────────────────────────────────────────────────┐
│                    Transaction Lifecycle                         │
│                                                                  │
│  Client                MongoDB Driver              mongod        │
│    │                        │                        │           │
│    │  client.startSession() │                        │           │
│    │ ──────────────────────►│                        │           │
│    │  session object        │                        │           │
│    │ ◄──────────────────────│                        │           │
│    │                        │                        │           │
│    │  session.startTransaction()                      │           │
│    │ ──────────────────────►│  beginTransaction cmd  │           │
│    │                        │ ──────────────────────►│           │
│    │                        │  snapshot taken on     │           │
│    │                        │  first read            │           │
│    │                        │                        │           │
│    │  db operations with { session } passed           │           │
│    │ ──────────────────────►│ ──────────────────────►│           │
│    │                        │  writes buffered in    │           │
│    │                        │  write set             │           │
│    │                        │                        │           │
│    │  session.commitTransaction()                     │           │
│    │ ──────────────────────►│  commitTransaction cmd │           │
│    │                        │ ──────────────────────►│           │
│    │                        │  write set applied     │           │
│    │                        │  atomically to journal │           │
│    │  ack                   │  ack                   │           │
│    │ ◄──────────────────────│ ◄──────────────────────│           │
└──────────────────────────────────────────────────────────────────┘
```

Notice the "snapshot taken on first read" step — this is the same MVCC snapshot mechanism from the previous lesson, just triggered lazily, the moment your transaction's first read actually happens.

### 2.2 The Session Object

Every transaction needs a **session** — a logical grouping of operations that MongoDB can track as one unit. It carries:
- `lsid` (logical session ID) — identifies the session across all nodes
- `txnNumber` — monotonically increasing transaction number
- Cluster time and operation time (for causal consistency)
- Transaction state (none / starting / in_progress / committed / aborted)

There's one rule you cannot forget: every transactional operation must pass `{ session }` as an option. (We'll come back to what happens when you forget — it's a classic bug, and it's in the Interview Q&A below.)

### 2.3 The Oplog and Transactions

Under the hood, when a transaction commits:

1. All operations are written as a single oplog entry (up to 16 MB)
2. If the transaction is too large for one oplog entry, MongoDB uses **applyOps** with multiple entries (still atomic at the commit level)
3. Secondaries apply the entire transaction atomically during replication

> **Memory hook:** "A transaction is a sealed envelope — the driver stuffs every write into it, and the server only ever opens the whole envelope at once, never a page at a time."

---

## 3. Full Node.js Transaction Example

Theory is fine, but let's actually write the bank transfer end-to-end.

### 3.1 Setup

```bash
npm install mongodb
```

```js
// connection.js
const { MongoClient } = require("mongodb");

const uri = "mongodb://localhost:27017/?replicaSet=rs0";
// Transactions require a replica set or sharded cluster
// Standalone mongod does NOT support multi-document transactions

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

module.exports = client;
```

### 3.2 Simple Fund Transfer

Here's the six-step shape every transaction follows: create a session, start the transaction, do your operations (always passing `{ session }`), commit, catch and abort on error, and always close the session. Watch for those six steps in the comments below.

```js
// transferFunds.js
const client = require("./connection");

async function transferFunds(fromAccountId, toAccountId, amount) {
  await client.connect();
  const db = client.db("bank");
  const accounts = db.collection("accounts");

  // Step 1: Create a session
  const session = client.startSession();

  try {
    // Step 2: Start the transaction with read/write concerns
    session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority", j: true },
      readPreference: "primary",
    });

    // Step 3: Perform operations — ALWAYS pass { session }
    const fromAccount = await accounts.findOne(
      { _id: fromAccountId },
      { session }
    );

    if (!fromAccount) {
      throw new Error(`Account ${fromAccountId} not found`);
    }

    if (fromAccount.balance < amount) {
      throw new Error(
        `Insufficient funds: balance ${fromAccount.balance}, requested ${amount}`
      );
    }

    // Debit the sender
    await accounts.updateOne(
      { _id: fromAccountId },
      { $inc: { balance: -amount } },
      { session }
    );

    // Credit the receiver
    await accounts.updateOne(
      { _id: toAccountId },
      { $inc: { balance: amount } },
      { session }
    );

    // Record the transfer in a ledger collection
    await db.collection("ledger").insertOne(
      {
        from: fromAccountId,
        to: toAccountId,
        amount,
        timestamp: new Date(),
        status: "completed",
      },
      { session }
    );

    // Step 4: Commit the transaction
    await session.commitTransaction();
    console.log(`Transfer of ${amount} from ${fromAccountId} to ${toAccountId} committed.`);

  } catch (error) {
    // Step 5: Abort on any error
    console.error("Transaction failed, aborting:", error.message);
    await session.abortTransaction();
    throw error;

  } finally {
    // Step 6: Always end the session
    await session.endSession();
  }
}

module.exports = transferFunds;
```

Notice the shape of the `catch` block — any error at all, whether it's "account not found," "insufficient funds," or a network hiccup, triggers an abort. Nothing partial ever gets left behind.

### 3.3 E-Commerce Order Placement

The bank transfer is the simplest possible case: two documents, one collection. Real workloads are rarely that tidy. Order placement is the classic "everything must succeed together" example — it touches three collections (products, orders, wallets) plus a fourth (carts) to clean up:

```js
// placeOrder.js
async function placeOrder(userId, cartItems, paymentDetails) {
  const session = client.startSession();

  try {
    session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });

    const db = client.db("shop");

    // 1. Check and reserve inventory for each item
    for (const item of cartItems) {
      const product = await db.collection("products").findOne(
        { _id: item.productId },
        { session }
      );

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}: ` +
          `requested ${item.quantity}, available ${product.stock}`
        );
      }

      // Decrement stock atomically
      await db.collection("products").updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity } },
        { session }
      );
    }

    // 2. Calculate order total
    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // 3. Create the order document
    const orderResult = await db.collection("orders").insertOne(
      {
        userId,
        items: cartItems,
        total,
        status: "confirmed",
        createdAt: new Date(),
      },
      { session }
    );

    const orderId = orderResult.insertedId;

    // 4. Debit user's wallet
    const wallet = await db.collection("wallets").findOne(
      { userId },
      { session }
    );

    if (!wallet || wallet.balance < total) {
      throw new Error("Insufficient wallet balance");
    }

    await db.collection("wallets").updateOne(
      { userId },
      {
        $inc: { balance: -total },
        $push: {
          transactions: {
            orderId,
            amount: -total,
            date: new Date(),
          },
        },
      },
      { session }
    );

    // 5. Clear the user's cart
    await db.collection("carts").deleteOne({ userId }, { session });

    // Commit everything atomically
    await session.commitTransaction();
    return orderId;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
```

If the wallet check fails on step 4, the inventory decrements from step 1 and the order insert from step 3 are all rolled back too — nothing is left half-applied.

---

## 4. Error Handling and Retry Logic

### 4.1 Error Categories

Here's a mistake that trips up almost everyone the first time they write transaction code: treating every error the same way. Not all transaction errors mean the same thing, and retrying the wrong kind of error the wrong way can cause real damage (like double-charging a wallet). The MongoDB driver differentiates:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Transaction Errors                          │
├────────────────────┬────────────────────────────────────────────┤
│ TransientTransaction│ Temporary condition — safe to retry the  │
│ Error (TMTE)        │ entire transaction. e.g. write conflict,  │
│                     │ lock timeout, network hiccup             │
├────────────────────┼────────────────────────────────────────────┤
│ UnknownTransaction │ The commit outcome is unknown (network    │
│ CommitResult (UTCR) │ error during commit). Retry the commit   │
│                     │ only — do NOT retry whole transaction    │
├────────────────────┼────────────────────────────────────────────┤
│ Application error  │ Business logic failure (insufficient      │
│                     │ funds, not found). Do NOT retry.         │
└────────────────────┴────────────────────────────────────────────┘
```

The distinction that matters most: `TransientTransactionError` means nothing committed yet, so replaying the whole transaction is safe. `UnknownTransactionCommitResult` means the commit command was sent but you never heard back — the writes might already be applied, so re-running all the operations from scratch could double them up. In that case you only retry the *commit*, not the operations.

### 4.2 The Recommended Retry Pattern

Here's the official pattern MongoDB recommends, which handles both error categories correctly — notice the two separate retry loops, one for the whole transaction and a nested one just for the commit:

```js
// transactionWithRetry.js
async function runTransactionWithRetry(txnFunc, client) {
  while (true) {
    const session = client.startSession();

    try {
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });

      // Run the user-supplied transaction function
      await txnFunc(session);

      // Attempt to commit — may throw UnknownTransactionCommitResult
      while (true) {
        try {
          await session.commitTransaction();
          return; // Success
        } catch (commitError) {
          if (
            commitError.errorLabels &&
            commitError.errorLabels.includes("UnknownTransactionCommitResult")
          ) {
            // The commit outcome is unknown — retry the commit only
            console.log("Retrying commit due to UnknownTransactionCommitResult...");
            continue;
          }
          // Any other commit error — abort and propagate
          await session.abortTransaction();
          throw commitError;
        }
      }

    } catch (error) {
      if (
        error.errorLabels &&
        error.errorLabels.includes("TransientTransactionError")
      ) {
        // Transient error — safe to retry the whole transaction
        console.log("Retrying transaction due to TransientTransactionError...");
        await session.endSession();
        continue; // Restart the while(true) loop
      }

      // Non-retryable error — abort and propagate
      await session.abortTransaction();
      throw error;

    } finally {
      await session.endSession();
    }
  }
}

// Usage
await runTransactionWithRetry(async (session) => {
  await transferFundsInSession(session, "A", "B", 200);
}, client);
```

### 4.3 Error Labels Reference

```js
// Check if an error is retryable
function isTransientError(error) {
  return (
    error.errorLabels &&
    error.errorLabels.includes("TransientTransactionError")
  );
}

function isUnknownCommitResult(error) {
  return (
    error.errorLabels &&
    error.errorLabels.includes("UnknownTransactionCommitResult")
  );
}

// Common error codes in transactions
// 112  WriteConflict           — two txns wrote same doc
// 24   LockTimeout             — could not acquire lock in time
// 251  NoSuchTransaction       — txn expired or unknown
// 256  TransactionTooOld       — another txn committed same doc
```

### 4.4 Max Retry Attempts (Production Safety)

The pattern above retries forever, which is fine for a demo but risky in production — an unlucky transaction could loop indefinitely under heavy contention. In practice you'll want a cap:

```js
async function runTransactionWithRetryLimit(txnFunc, client, maxAttempts = 3) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    const session = client.startSession();

    try {
      session.startTransaction({ writeConcern: { w: "majority" } });
      await txnFunc(session);
      await session.commitTransaction();
      return;
    } catch (error) {
      await session.abortTransaction();

      if (
        attempt < maxAttempts &&
        error.errorLabels &&
        error.errorLabels.includes("TransientTransactionError")
      ) {
        console.log(`Transaction attempt ${attempt} failed, retrying...`);
        await session.endSession();
        continue;
      }

      throw error; // Give up after maxAttempts
    } finally {
      await session.endSession();
    }
  }
}
```

> **Memory hook:** "`TransientTransactionError` — nothing landed, redo the whole thing. `UnknownTransactionCommitResult` — you just don't know if it landed, so only ask again, don't redo the work."

---

## 5. Transaction Limitations

Transactions aren't free, and they aren't unlimited. Here are the walls you'll actually hit in production.

### 5.1 Time Limit — 60 Seconds

```
┌──────────────────────────────────────────────────────────┐
│  Transaction Runtime Limit                               │
│                                                          │
│  Default: 60 seconds from startTransaction              │
│                                                          │
│  If exceeded → MongoDB automatically aborts the txn     │
│  Error code: 290 (TransactionExceededLifetimeLimitSeconds)│
│                                                          │
│  Change via (mongod.conf):                              │
│  transactionLifetimeLimitSeconds: 120                   │
│                                                          │
│  Change via runtime:                                     │
│  db.adminCommand({                                       │
│    setParameter: 1,                                      │
│    transactionLifetimeLimitSeconds: 120                  │
│  })                                                      │
└──────────────────────────────────────────────────────────┘
```

**Implication:** Do not do slow external operations (HTTP calls, file I/O) inside a transaction. Prepare all data before starting.

### 5.2 Oplog Size — 16 MB Per Entry

Each transaction produces a single oplog entry (or a bounded number of entries). The total size of all write operations in a transaction must fit within the oplog entry size limit (16 MB by default).

```
Total data written in transaction ≤ 16 MB
(This is not the number of documents — it's the total BSON size of all operations)
```

If exceeded, the transaction fails with:
```
"Transaction is too large and will not fit in the oplog"
```

**Implication:** Do not use transactions for bulk imports. Batch large operations outside transactions.

### 5.3 Performance Cost

Transactions in MongoDB are more expensive than non-transactional operations — for reasons that should feel familiar from the architecture diagram in Section 2:

```
┌──────────────────────────────────────────────────────────┐
│  Performance Overhead                                    │
│                                                          │
│  1. Snapshot acquisition (MVCC overhead)                 │
│  2. Write buffering (writes held in memory until commit) │
│  3. Lock acquisition on commit                           │
│  4. Oplog write is larger than individual ops            │
│  5. Replication of larger oplog entry                    │
│                                                          │
│  Rough estimate: 3x–10x slower than equivalent          │
│  non-transactional operations                            │
└──────────────────────────────────────────────────────────┘
```

### 5.4 Unsupported Operations Inside Transactions

The following are NOT allowed inside a multi-document transaction:

| Operation | Reason |
|---|---|
| `db.createCollection()` | DDL operations are not transactional |
| `db.createIndex()` | DDL operations are not transactional |
| `db.dropCollection()` | DDL operations are not transactional |
| `$out` in aggregation | Writes to another collection outside the txn |
| `$merge` in aggregation | Writes to another collection outside the txn |
| `count()` (deprecated) | Use `countDocuments()` instead |
| Operations on non-existent collections | Collection must exist before txn starts (4.4+: implicit creation allowed) |

### 5.5 Collection Must Exist

```js
// BAD — collection "newcoll" does not exist, will error in transactions
// (before MongoDB 4.4)
session.startTransaction();
await db.collection("newcoll").insertOne({ x: 1 }, { session }); // Error!

// GOOD — create collection first, then use in transaction
await db.createCollection("newcoll");
session.startTransaction();
await db.collection("newcoll").insertOne({ x: 1 }, { session }); // OK
```

MongoDB 4.4+ allows implicit collection creation inside a transaction (first write creates the collection), but only for new collections not referenced in the same transaction's reads.

### 5.6 Limitations Summary Table

| Limitation | Value / Detail |
|---|---|
| Max runtime | 60 s (configurable) |
| Max oplog entry size | 16 MB |
| DDL operations | Not allowed |
| Standalone mongod | Not supported |
| Requires replica set | Yes (4.0+) |
| Cross-shard | Requires 4.2+ |
| `$out` / `$merge` | Not allowed |
| Nesting transactions | Not supported |
| Read preference in txn | Must be `primary` (reads go to primary) |

> **Memory hook:** "A transaction is a short sprint, not a marathon — 60 seconds, 16 MB, no side errands (DDL, HTTP calls) allowed along the way."

---

## 6. Retryable Writes

### 6.1 What Are Retryable Writes?

Here's a scenario that's easy to confuse with the transaction retry logic above, but it's actually a completely different, simpler mechanism. Your client sends a single `insertOne`. The write succeeds on the server — but the acknowledgement gets lost on the way back (a network blip, a primary failover). From the client's point of view, it looks like the write failed. What do you do — retry?

If you retry naively, you risk inserting the same document twice. **Retryable writes** solve exactly this: MongoDB tracks write operations by their `lsid` and `txnNumber`, and deduplicates any retry of the same operation.

```
Without retryable writes:
  Client sends insertOne → Network drop → Client retries → Duplicate inserted!

With retryable writes:
  Client sends insertOne (lsid=X, txnNumber=1)
  → Network drop
  → Client retries (same lsid=X, txnNumber=1)
  → Server sees "already did txnNumber=1 for session X" → returns previous result
  → No duplicate!
```

### 6.2 Enabling Retryable Writes

```js
// Enable in connection string
const client = new MongoClient(
  "mongodb://localhost:27017/?replicaSet=rs0&retryWrites=true"
);

// Enable in options object
const client = new MongoClient(uri, { retryWrites: true }); // default since driver 3.6
```

Retryable writes are enabled by default in modern MongoDB drivers.

### 6.3 Which Operations Are Retryable?

```
Retryable:
  ✓ insertOne
  ✓ insertMany (if ordered: false)
  ✓ updateOne
  ✓ replaceOne
  ✓ deleteOne
  ✓ findOneAndUpdate
  ✓ findOneAndReplace
  ✓ findOneAndDelete
  ✓ bulkWrite (if all operations are retryable)

NOT retryable:
  ✗ insertMany (if ordered: true and multi-insert)
  ✗ updateMany
  ✗ deleteMany
  ✗ Any aggregation with $out/$merge
```

Notice the pattern: everything in the retryable list touches exactly *one* document. That's not a coincidence — the distinction is that operations modifying a single document are idempotent (retry it a hundred times, you land on the same end state). Operations that modify many documents are not safely retryable, because a retry might catch the operation mid-application and apply part of it twice.

### 6.4 Retryable Writes vs Transactions

It's worth being precise about how these two relate, because people often reach for a transaction when a retryable write would have done the job:

| Feature | Retryable Writes | Transactions |
|---|---|---|
| Purpose | Survive transient network errors | Atomic multi-doc operations |
| Scope | Single operation | Multiple operations |
| Atomicity across docs | No | Yes |
| Performance cost | Near-zero | Higher |
| Use for | All single-doc writes | Multi-doc atomicity |

> **Memory hook:** "Retryable writes are 'did my one letter actually get delivered?' — transactions are 'did this whole stack of letters get delivered together?'"

---

## 7. Distributed Transactions Across Shards

### 7.1 What Are Distributed Transactions?

Everything so far assumed both documents live on the same replica set. But what if Account A and Account B live on different shards? MongoDB 4.2 extended multi-document transactions to handle exactly this case — a **distributed transaction**, also called a cross-shard transaction.

```
Sharded cluster:
                    mongos (router)
                        │
          ┌─────────────┼─────────────┐
          │             │             │
       Shard 1       Shard 2       Shard 3
   (accounts A–F)  (accounts G–M)  (accounts N–Z)

Transfer from Account "Alice" (Shard 1) to Account "Nathan" (Shard 3)
→ Requires distributed transaction touching Shard 1 and Shard 3
```

### 7.2 Two-Phase Commit Protocol

A single-node commit is straightforward — one journal write, done. But committing across independent shards is trickier: what if Shard 1 successfully applies its half and Shard 3 crashes right before applying its half? MongoDB solves this the classic distributed-systems way, with a **two-phase commit (2PC)** protocol:

```
Phase 1 — Prepare:
  mongos tells all participant shards to prepare
  Each shard writes a prepare record to its oplog
  Each shard holds locks on involved documents
  Each shard reports: ready | abort

Phase 2 — Commit (or Abort):
  If ALL shards say ready → mongos sends commit to all shards
  If ANY shard says abort → mongos sends abort to all shards

┌─────────────────────────────────────────────────────────────┐
│  mongos                                                     │
│    │                                                         │
│    ├──PREPARE──► Shard1: "ready"                            │
│    ├──PREPARE──► Shard2: "ready"                            │
│    │                                                         │
│    ├──COMMIT──► Shard1: applied                             │
│    └──COMMIT──► Shard2: applied                             │
└─────────────────────────────────────────────────────────────┘
```

The whole point of Phase 1 is that nobody commits until *everybody* has confirmed they're able to. Only once every shard says "ready" does Phase 2 tell them all to actually apply their writes.

### 7.3 Coordinator Shard

In a distributed transaction, one shard is elected as the **transaction coordinator**:
- The coordinator manages the 2PC protocol
- The coordinator's identity is stored in the `config.transactions` collection
- If the coordinator shard crashes during commit, other nodes use the stored record to resume

### 7.4 Node.js Code — Cross-Shard Transaction

Here's the pleasant surprise: your application code doesn't change at all. The driver and `mongos` handle the 2PC dance transparently — you write the same `startTransaction` / `commitTransaction` block as before:

```js
async function crossShardTransfer(fromId, toId, amount) {
  // Connection must go through mongos, not directly to a shard
  const client = new MongoClient("mongodb://mongos-host:27017/");
  await client.connect();

  const session = client.startSession();

  try {
    session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });

    const accounts = client.db("bank").collection("accounts");

    // These two documents may live on different shards
    // MongoDB handles the distribution internally
    await accounts.updateOne(
      { _id: fromId },
      { $inc: { balance: -amount } },
      { session }
    );

    await accounts.updateOne(
      { _id: toId },
      { $inc: { balance: amount } },
      { session }
    );

    await session.commitTransaction();
    console.log("Cross-shard transfer committed");

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
    await client.close();
  }
}
```

### 7.5 Distributed Transaction Overhead

That transparency comes at a real cost, though — 2PC means extra network round trips per shard involved:

```
Single-shard transaction:     ~5–20 ms overhead
Cross-shard transaction:      ~50–200 ms overhead (2PC adds round trips)

Extra costs:
  1. Prepare phase (extra network round trip per shard)
  2. Coordinator recovery on crash (reread config.transactions)
  3. Lock contention across shards
  4. Larger oplog entries (once per shard)
```

**Architecture advice:** Design your shard key so that related documents that are frequently updated together land on the same shard. This avoids distributed transactions entirely.

> **Memory hook:** "A single-shard transaction is one clerk signing one form. A cross-shard transaction is a conference call where every branch has to say 'ready' before anyone signs anything."

---

## 8. Transaction Performance Tuning

By now the theme should be clear: transactions cost more than plain writes, so use them deliberately. Here's how to keep that cost as low as possible when you do need them.

### 8.1 Keep Transactions Short

```
┌──────────────────────────────────────────────────────────────┐
│  Transaction Duration Guidelines                             │
│                                                              │
│  Target:    < 1 second                                       │
│  Warning:   > 5 seconds                                      │
│  Danger:    > 30 seconds (approaching 60 s limit)            │
│                                                              │
│  Longer transactions =                                       │
│    - More lock contention                                    │
│    - More write conflicts                                     │
│    - Higher abort/retry rate                                 │
│    - Larger snapshot to maintain in memory                   │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Prepare Data Before Starting

The 60-second limit from Section 5.1 means anything slow — an HTTP call, a file read — has no business running while the transaction's clock is ticking. Fetch it first, then start the clock:

```js
// BAD — slow external call inside transaction
session.startTransaction();
const exchangeRate = await fetchExchangeRateFromAPI(); // HTTP call = slow!
await accounts.updateOne({ ... }, { $mul: { balance: exchangeRate } }, { session });
await session.commitTransaction();

// GOOD — prepare data before starting transaction
const exchangeRate = await fetchExchangeRateFromAPI(); // Outside transaction
session.startTransaction();
await accounts.updateOne({ ... }, { $mul: { balance: exchangeRate } }, { session });
await session.commitTransaction();
```

### 8.3 Minimize Number of Operations

Each operation inside a transaction adds latency and increases the chance of write conflicts. Use atomic update operators instead of read-modify-write patterns where possible.

```js
// BAD — read-modify-write pattern (two ops + race condition)
const doc = await coll.findOne({ _id: 1 }, { session });
const newValue = doc.counter + 1;
await coll.updateOne({ _id: 1 }, { $set: { counter: newValue } }, { session });

// GOOD — single atomic operation (no transaction needed at all!)
await coll.updateOne({ _id: 1 }, { $inc: { counter: 1 } });
```

Notice the "GOOD" version doesn't even need a transaction anymore — it's back to single-document atomicity, free of charge.

### 8.4 Index Your Transaction Queries

Transactions that do collection scans hold locks for longer and generate more write conflicts. Ensure all queries inside transactions hit indexes.

```js
// Ensure these fields are indexed before using in transactions
db.accounts.createIndex({ userId: 1 });
db.orders.createIndex({ userId: 1, status: 1 });

// Then inside transaction — these will use indexes (fast)
await accounts.findOne({ userId: "u123" }, { session });
await orders.find({ userId: "u123", status: "pending" }, { session });
```

### 8.5 Monitoring Transaction Performance

```js
// Check slow transactions in currentOp
db.adminCommand({
  currentOp: true,
  $or: [
    { "transaction.timePreparedMicros": { $exists: true } },
    { "transaction.timeActiveMicros": { $gt: 1000000 } }  // > 1 second
  ]
});

// Atlas: Profiler → filter on "transaction" namespace
// Metrics to watch:
//   - transactions.currentActive
//   - transactions.totalAborted
//   - transactions.totalCommitted
//   - transactions.totalStarted
```

> **Memory hook:** "Prep your ingredients before you turn on the stove — nothing slow happens once the transaction clock starts."

---

## 9. Common Patterns

A few recurring shapes show up again and again once you start writing real transactional code. Here are the three worth recognizing by name.

### 9.1 The "Check-Then-Act" Pattern

You check a condition, then act on it — classic "is this seat still available?" logic. It has to run inside a transaction to be safe, because between the check and the act, another transaction could sneak in and take the seat:

```js
// Classic: check a condition then act based on it
// Must be inside a transaction to be safe

async function reserveSeat(flightId, seatNumber, userId, session) {
  const seat = await db.collection("seats").findOne(
    { flightId, seatNumber },
    { session }
  );

  if (!seat) throw new Error("Seat not found");
  if (seat.status !== "available") throw new Error("Seat already taken");

  // Within the snapshot, the seat was available — safe to update
  await db.collection("seats").updateOne(
    { flightId, seatNumber, status: "available" }, // Re-check in filter!
    { $set: { status: "reserved", reservedBy: userId, reservedAt: new Date() } },
    { session }
  );
}
```

**The re-check in the filter** (`status: "available"`) is a belt-and-suspenders safety. If the seat was taken by another transaction between the `findOne` and `updateOne` (write conflict scenario), the `updateOne` would match zero documents, allowing you to detect the conflict.

### 9.2 Event Sourcing Pattern

```js
// Write an event AND update the aggregate in one transaction
async function publishEvent(aggregateId, event, session) {
  const db = client.db("eventstore");

  // Append event to immutable event log
  await db.collection("events").insertOne(
    { aggregateId, ...event, timestamp: new Date() },
    { session }
  );

  // Update the read model (materialized view)
  await db.collection("aggregates").updateOne(
    { _id: aggregateId },
    { $set: event.payload, $inc: { version: 1 } },
    { session, upsert: true }
  );
}
```

### 9.3 Saga Pattern (Without Transactions)

What about a workflow that spans multiple *services*, not just MongoDB collections — where a transaction can't reach? For long-running workflows that span services, use the **Saga pattern** instead of a distributed transaction:

```
Order Service                Inventory Service         Payment Service
     │                              │                        │
     │ 1. Create Order (pending)    │                        │
     │──────────────────────────────────────────────────────►│
     │                              │                        │
     │ 2. Reserve Inventory ────────►│                        │
     │                              │ success                │
     │ 3. Charge Payment ────────────────────────────────────►│
     │                              │                        │ fail!
     │ 4. Compensate: release inventory ◄─────────────────────│
     │ 5. Compensate: cancel order  │                        │
```

Sagas are better than distributed transactions when:
- Operations span microservices (not just MongoDB shards)
- Steps take a long time (human approval, external API)
- You want to maximize availability

> **Memory hook:** "A transaction says 'undo automatically if anything fails.' A saga says 'here's a specific undo step for each stage — run it yourself if things go wrong.'"

---

## 10. Hands-On Exercises

**Exercise 1 — Bank Transfer Transaction**

Set up a local replica set (`mongod --replSet rs0`). Create an `accounts` collection with two documents:
```json
{ "_id": "alice", "balance": 1000, "currency": "USD" }
{ "_id": "bob",   "balance": 500,  "currency": "USD" }
```
Write a Node.js function `transfer(from, to, amount)` using a transaction with `readConcern: "snapshot"` and `writeConcern: { w: "majority" }`. Test:
- Happy path: transfer $200 from Alice to Bob
- Insufficient funds: transfer $2000 from Alice to Bob (should abort)
- Verify final balances after each test

---

**Exercise 2 — Retry on Write Conflict**

Simulate a write conflict:
1. Manually begin a transaction in the MongoDB shell and update a document but do NOT commit yet
2. In Node.js, run a transaction that tries to update the same document
3. Observe the `WriteConflict` error (code 112)
4. Implement retry logic that retries up to 5 times with exponential backoff (100ms, 200ms, 400ms...)
5. Commit the shell transaction and observe the Node.js transaction eventually succeeding

---

**Exercise 3 — Transaction Timeout**

Set `transactionLifetimeLimitSeconds: 10` on your mongod. Write a transaction that:
1. Starts the transaction
2. Inserts a document
3. Sleeps for 15 seconds (`await new Promise(resolve => setTimeout(resolve, 15000))`)
4. Attempts to commit

Observe the `TransactionExceededLifetimeLimitSeconds` error. Discuss: what happens to the insert? Is the data in the database?

---

**Exercise 4 — E-Commerce Order with Inventory Check**

Build a `placeOrder` function that atomically:
1. Checks inventory for each cart item
2. Decrements inventory for each item
3. Creates an order document
4. Records a transaction in a payments collection

Write a concurrent test that places 10 orders simultaneously for the same item with stock of 5. Verify that exactly 5 orders succeed and 5 fail with "insufficient stock" — not 10 successes followed by negative inventory.

---

**Exercise 5 — Measure Transaction Overhead**

Write a benchmark that performs 100 fund transfers (each touching 2 documents) in two ways:
1. Without transactions (two separate updateOne calls)
2. With transactions (startTransaction → 2 updates → commit)

Measure total time for 100 operations each way. Calculate the overhead percentage. Then add error injection (randomly throw in 20% of cases) and measure how retry logic affects throughput.

---

## 11. Interview Q&A

**Q1: What MongoDB version added multi-document transactions and what version extended them to shards?**
A: MongoDB 4.0 (2018) added multi-document ACID transactions for replica sets. MongoDB 4.2 (2019) extended this to distributed transactions across sharded clusters.

---

**Q2: What happens if you forget to pass `{ session }` to an operation inside a transaction?**
A: The operation executes outside the transaction context — as a regular, non-transactional write. It is committed immediately and permanently, regardless of whether the surrounding transaction commits or aborts. This is a common bug. Always pass `{ session }` to every operation inside a transaction.

---

**Q3: What is the difference between `TransientTransactionError` and `UnknownTransactionCommitResult`?**
A: `TransientTransactionError` means the transaction failed before commit due to a transient issue (write conflict, network error, lock timeout). It is safe to retry the entire transaction from scratch. `UnknownTransactionCommitResult` means the commit command was sent but the client does not know if it succeeded (network error during commit). In this case, retry only the commit, not the entire transaction — the writes may have already been applied.

---

**Q4: Can you nest transactions in MongoDB?**
A: No. MongoDB does not support nested transactions or savepoints. If you call `startTransaction` while already inside a transaction, it throws an error. Design your code so that transactional logic is at the top level and helper functions accept a session parameter rather than starting their own transactions.

---

**Q5: What is the 16 MB oplog limit and what does it mean for transactions?**
A: MongoDB's oplog stores operations for replication. Each oplog entry has a maximum size of 16 MB. For a transaction, all the write operations must fit within this limit as a single oplog entry. In practice, this means transactions that write very large documents or modify hundreds of documents may hit this limit. Avoid using transactions for bulk data migrations.

---

**Q6: How does the MongoDB driver's retryable writes feature differ from manually retrying a transaction?**
A: Retryable writes handle the scenario where a single write operation succeeded on the server but the acknowledgement was lost due to a network issue. The driver automatically retries the write and the server deduplicates it using the session ID and transaction number. Manual transaction retry handles broader failure scenarios (write conflicts, transient errors) where the entire set of operations needs to be re-executed. Use both: retryable writes for single-op resilience, manual retry for multi-op transactions.

---

**Q7: What does "snapshot isolation" mean inside a transaction?**
A: When a transaction starts, MongoDB takes a consistent snapshot of the database at the start time. All reads within the transaction see data as it was at that moment, regardless of concurrent writes by other transactions. Writes within the transaction are buffered in a private write set and not visible to other transactions until commit. This prevents dirty reads, non-repeatable reads, and phantom reads.

---

**Q8: Why must reads inside a transaction go to the primary?**
A: Transactions use `readPreference: "primary"` internally. This is because the transaction's snapshot is maintained on the primary, and all reads must see a consistent view of the buffered writes in the transaction's write set. Secondaries do not have access to the in-progress transaction's state and may be behind on replication, making them unsuitable for transactional reads.

---

**Q9: How does MongoDB's two-phase commit work for distributed (cross-shard) transactions?**
A: MongoDB uses a two-phase commit protocol coordinated by a designated coordinator shard. In Phase 1 (Prepare), the coordinator asks all participant shards to prepare — each shard writes a prepare record to its oplog and holds locks on involved documents. If all shards report ready, Phase 2 (Commit) begins: the coordinator sends commit to all shards, which apply their writes atomically. If any shard reports abort in Phase 1, the coordinator sends abort to all shards, undoing the prepare records.

---

**Q10: What is a write conflict (error code 112) and when does it occur?**
A: A write conflict occurs when two concurrent transactions attempt to modify the same document. MongoDB uses optimistic locking — both transactions proceed until commit time, when the second to try to commit raises a WriteConflict error (code 112). The second transaction must abort and retry. This is expected behavior; applications must handle it with retry logic.

---

**Q11: How do you monitor active transactions in MongoDB?**
A: Use `db.adminCommand({ currentOp: true })` and filter for operations with a `transaction` field. Look for `timeActiveMicros` to find long-running transactions. In Atlas, the Performance Advisor and Real-Time Performance Panel show active transactions. Key metrics: `serverStatus().transactions.currentActive`, `totalCommitted`, `totalAborted`, `totalStarted`. A high abort/start ratio indicates contention.

---

**Q12: What is the "coordinator shard" in a distributed transaction and why does it matter for recovery?**
A: The coordinator shard is the shard that manages the two-phase commit protocol for a distributed transaction. It stores a coordinator record in its local `config.transactions` collection. If the coordinator shard crashes mid-commit, the record allows it (or another node) to resume the commit on restart, preventing the transaction from being left in a half-committed state. This is MongoDB's crash recovery mechanism for distributed transactions.

---

**Q13: Can you use `$lookup` (joins) inside a transaction?**
A: Yes, `$lookup` aggregation stages work inside transactions and respect the transaction's snapshot. However, if the `$lookup` is joining collections on different shards, it can significantly increase transaction complexity and latency. Consider whether denormalization (embedding the looked-up data) would be a better schema design choice.

---

**Q14: What is the recommended pattern for long-running workflows that cannot fit in a 60-second transaction?**
A: Use the Saga pattern instead of a single long transaction. Break the workflow into a series of local transactions, each with a compensating transaction to undo if a later step fails. For example: (1) create order as "pending", (2) reserve inventory, (3) charge payment. If step 3 fails, execute compensating actions: release inventory, cancel order. Store saga state in a dedicated collection to handle coordinator crashes.

---

**Q15: What is the performance impact of transactions and when should you design to avoid them?**
A: Transactions add 3x–10x overhead compared to equivalent non-transactional operations, due to snapshot acquisition, write buffering, lock acquisition on commit, and larger oplog entries. Avoid them by: (1) embedding related data in a single document (single-document atomicity is always free), (2) using atomic update operators like `$inc`, `$push`, `$set` that combine read-modify-write in one atomic op, (3) designing shard keys that co-locate frequently co-modified documents on the same shard to minimize distributed transaction overhead. Use transactions only when atomic multi-document guarantees are truly required.
