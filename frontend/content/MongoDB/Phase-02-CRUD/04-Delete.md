# MongoDB Phase 02 — Delete Operations

## Table of Contents

1. [Overview of Delete Operations](#1-overview-of-delete-operations)
2. [deleteOne()](#2-deleteone)
3. [deleteMany()](#3-deletemany)
4. [findOneAndDelete()](#4-findoneanddelete)
5. [Soft Delete Pattern](#5-soft-delete-pattern)
6. [drop() vs deleteMany({})](#6-drop-vs-deletemany)
7. [bulkWrite() for Mixed Operations](#7-bulkwrite-for-mixed-operations)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Overview of Delete Operations

Sooner or later every collection fills up with documents nobody wants anymore — expired sessions, cancelled orders, a product that's been discontinued for two years. MongoDB gives you three tools to get rid of them: `deleteOne()`, `deleteMany()`, and `findOneAndDelete()`.

---

### Real-World Analogy

`deleteOne()` is like pulling a single card from a filing cabinet and shredding it. `deleteMany()` is like emptying an entire drawer, card by card. `drop()` (covered in Section 6) is like throwing the whole filing cabinet into a bonfire — instantaneous, and the office layout (indexes, metadata) goes with it.

---

Before touching any of these, one thing is worth saying out loud: all three are **destructive and permanent**. Once a document is gone, it's gone — unless you have a backup, or you built a soft-delete pattern in ahead of time (Section 5).

**So what actually happens on the server when you call `deleteOne({ _id: X })`?** It's not just "document disappears" — there's a small sequence of steps happening under the hood:

```
Application
     │
     │  deleteOne({ _id: X })
     ▼
┌──────────────────────────────────────────────────────────┐
│                    mongod Server                         │
│                                                          │
│  1. Locate document via filter (uses index if available) │
│  2. Remove document from collection data file            │
│  3. Remove all index entries pointing to this document   │
│  4. WiredTiger marks the space as available (not zeroed) │
│  5. Write tombstone to journal                           │
│  6. Return result to client                              │
└──────────────────────────────────────────────────────────┘
     │
     ▼
{ acknowledged: true, deletedCount: 1 }
```

Notice step 4 — the space isn't wiped clean, it's just marked reusable. That's an internal storage-engine detail, but it's why deleting documents doesn't always shrink the file on disk immediately.

---

### Atomicity: deleteOne() vs deleteMany()

Here's a question worth asking yourself before you run a `deleteMany()` that matches 100,000 documents: if the server crashes halfway through, what state is your collection left in?

Like all MongoDB write operations, deletes are **atomic at the document level**. A single `deleteOne()` is guaranteed to either delete the document fully or not at all — there's no in-between state where a document is "half deleted."

But `deleteMany()` is a different story. It is **not** atomic across all matched documents. Internally, it processes them one at a time:

```
deleteMany({ status: "guest" })   →  matches 100,000 documents
        │
        ▼
   delete doc 1  (atomic)
   delete doc 2  (atomic)
   delete doc 3  (atomic)
   ...
   delete doc 47,213  ← server crashes here
        │
        ▼
   Result: 47,213 documents gone, 52,787 still there.
   No rollback. No "all or nothing."
```

Each individual deletion is safe and complete. The batch as a whole is not — there's no wrapping transaction undoing the first 47,213 deletes if the last one never happens.

**Common mistake:** assuming `deleteMany()` behaves like a database transaction — either everything is removed or nothing is. It doesn't. If you need true all-or-nothing behavior across multiple documents, you need to wrap the operation in a multi-document transaction explicitly.

*Interview answer:* "MongoDB write operations, including deletes, are atomic at the single-document level — a document is either fully deleted or untouched. However, `deleteMany()` is not atomic as a whole; it deletes matched documents one at a time, so an interruption partway through leaves some documents deleted and others not. For guaranteed all-or-nothing behavior across multiple documents, you need a multi-document transaction."

> **Memory hook:** "Each card is shredded whole, never half-shredded — but emptying the drawer one card at a time means someone can pull the plug halfway through."

---

## 2. deleteOne()

Most of the time, you don't want to delete "everything matching some condition" — you want to delete *one specific thing*: this user, this session, this product. That's what `deleteOne()` is for.

`deleteOne()` removes the **first** document that matches the filter. If multiple documents match, only one is removed — the one with the lowest natural-order position in the collection, roughly the oldest inserted document, unless a sort index changes that.

### Syntax

```js
db.collection.deleteOne(
  <filter>,
  {
    hint: <indexHint>,        // optional — force index selection
    writeConcern: <document>, // optional
    comment: <any>            // optional (4.4+)
  }
)
```

### Return Value

```js
{ acknowledged: true, deletedCount: 1 }  // document found and deleted
{ acknowledged: true, deletedCount: 0 }  // no document matched filter
```

### Examples

```js
// Delete a specific user by _id (most common — unambiguous)
db.users.deleteOne({ _id: ObjectId("64a1f3b2e4b0c12345678901") });

// Delete first expired session
db.sessions.deleteOne({ expiresAt: { $lt: new Date() } });

// Delete by business key
db.products.deleteOne({ sku: "ITEM-DISCONTINUED-001" });
```

---

**Why would you ever want to delete by `_id` instead of by, say, a name?** Because "the first John in the collection" is not a well-defined thing — you have no real control over which document that is. `_id` is the one field guaranteed to point at exactly one document.

```
Deleting by non-unique field:
  db.users.deleteOne({ name: "John" })
  ─ Ambiguous: which John? Only the first match is deleted.
  ─ Hard to predict which document is removed.

Deleting by _id (recommended):
  db.users.deleteOne({ _id: userId })
  ─ Unambiguous: exactly one document, no surprises.
  ─ Uses the _id index — O(log n), very fast.
```

> **Memory hook:** deleting by anything other than `_id` is like shouting "John, you're fired!" into a room with three Johns in it.

---

## 3. deleteMany()

Sometimes "one document" isn't the goal at all — you want every log entry older than 90 days gone, or every guest session cleared out. That's the job of `deleteMany()`: it removes **all** documents matching the filter, in one call.

### Syntax

```js
db.collection.deleteMany(
  <filter>,
  {
    hint: <indexHint>,
    writeConcern: <document>
  }
)
```

### Return Value

```js
{ acknowledged: true, deletedCount: 42 }  // 42 documents deleted
{ acknowledged: true, deletedCount: 0  }  // no matches
```

### Examples

```js
// Delete all logs older than 90 days
const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
db.logs.deleteMany({ createdAt: { $lt: cutoff } });

// Delete all guest sessions
db.sessions.deleteMany({ userType: "guest" });

// Delete all soft-deleted records (cleanup job)
db.orders.deleteMany({ deleted: true, deletedAt: { $lt: cutoff } });

// Delete all documents — clears the collection but keeps it and its indexes
db.tempData.deleteMany({});
```

---

**What happens if that filter matches a few million documents, not a few dozen?** As you just saw in Section 1, `deleteMany()` walks the matches one at a time. On older MongoDB versions, deleting millions of documents in a single call can:

- Lock the collection for an extended period
- Generate a large volume of oplog entries (which drags down replica set lag)

The fix isn't a different command — it's doing the same `deleteMany()` in smaller bites:

```js
// Batch delete in chunks to reduce pressure
async function batchDelete(filter, batchSize = 1000) {
  let deletedTotal = 0;
  let result;
  do {
    // Find IDs in this batch first, then delete by ID
    const docs = await db.collection("logs").find(filter, { _id: 1 }).limit(batchSize).toArray();
    if (docs.length === 0) break;
    const ids = docs.map(d => d._id);
    result = await db.collection("logs").deleteMany({ _id: { $in: ids } });
    deletedTotal += result.deletedCount;
    console.log(`Deleted ${deletedTotal} so far...`);
  } while (result.deletedCount === batchSize);
  return deletedTotal;
}

await batchDelete({ createdAt: { $lt: cutoff } });
```

Each batch is small enough that it doesn't hold a lock for long or flood the oplog — other operations get a chance to run between batches.

---

## 4. findOneAndDelete()

Picture this: you're deleting a user, and you want to email them a goodbye note with their name in it. `deleteOne()` won't help you here — it only tells you *how many* documents were removed, not what was in them. You'd need to `findOne()` first, then `deleteOne()` second — two round trips, and a small window where another process could sneak in between your read and your delete.

`findOneAndDelete()` closes that gap. It atomically **finds** a document, **deletes** it, and **returns** the deleted document — all in a single round-trip. Think of it as MongoDB's version of a stack "pop": you don't peek and then remove separately, you pop and get the value back in one motion.

### Syntax

```js
db.collection.findOneAndDelete(
  <filter>,
  {
    sort: <sortDoc>,              // which document to pick if multiple match
    projection: <projectionDoc>, // which fields to return
    hint: <indexHint>,
    maxTimeMS: <number>
  }
)
```

### Return Value

Returns the **deleted document** (or `null` if no match). This is the document as it existed right before deletion.

**How is this different internally from doing `findOne()` then `deleteOne()`?**

```
findOne() + deleteOne()                    findOneAndDelete()
------------------------                   ------------------
Round trip 1: findOne()                    Round trip 1: findOneAndDelete()
   → read document                            → server finds AND deletes
        |                                        the document atomically,
        v                                        then returns it
Round trip 2: deleteOne()
   → delete by _id                          Nothing can sneak in between
        |                                    "read" and "remove" — there's
        v                                    no gap, because there's only
Gap between the two calls:                  one server-side operation.
another process could delete
or modify the document first
```

### Examples

```js
// Delete and return a specific user
const deletedUser = await db.collection("users").findOneAndDelete(
  { _id: userId },
  { projection: { password: 0 } }  // exclude sensitive fields from return
);
if (deletedUser) {
  console.log(`Deleted: ${deletedUser.name} (${deletedUser.email})`);
  // send farewell email, clean up related data, etc.
}
```

---

**Where this pattern really shines: task queues.** You have many workers competing to grab the next job, and you need exactly one worker to get each task — never two workers processing the same one.

```js
// Atomically claim the highest-priority pending task
async function claimNextTask(workerId) {
  const task = await db.collection("taskQueue").findOneAndDelete(
    { status: "pending" },
    { sort: { priority: -1, queuedAt: 1 } }
  );

  if (!task) return null;

  // Move to "inProgress" collection for tracking
  await db.collection("tasksInProgress").insertOne({
    ...task,
    claimedBy: workerId,
    claimedAt: new Date(),
    status: "processing"
  });

  return task;
}
```

Because the find-and-remove is atomic, two workers calling `claimNextTask()` at the same instant can never walk away with the same task.

### findOneAndDelete() vs deleteOne()

| Feature                | deleteOne()          | findOneAndDelete()   |
|-------------------------|----------------------|-----------------------|
| Returns                | `{deletedCount: N}`    | The deleted document |
| Round trips needed     | 2 (find + delete)    | 1 (atomic)           |
| Use case               | Discard only         | Read + remove        |
| Atomicity              | Document-level       | Document-level       |
| Projection support     | No                   | Yes                  |

**Common mistake:** reaching for `findOneAndDelete()` even when you never actually use the returned document. If you're only discarding the document and never inspect it, `deleteOne()` is simpler and communicates intent better — save `findOneAndDelete()` for when you genuinely need what was removed.

*Interview answer:* "`findOneAndDelete()` atomically finds, deletes, and returns a document in a single round-trip, unlike `deleteOne()` which only reports how many documents were removed. It's the right tool whenever you need the deleted document's data afterward — for auditing, notifications, archiving — or when you need atomic claim-and-remove semantics like a task queue, since there's no gap between the read and the delete for a race condition to sneak into."

> **Memory hook:** "`deleteOne()` shreds the card. `findOneAndDelete()` photocopies it first — in the same motion, not two separate trips to the machine."

---

## 5. Soft Delete Pattern

Here's a scenario that should make you nervous about hard deletes: a support rep accidentally deletes the wrong customer account. With `deleteOne()`, that data is gone — permanently, unless you have a backup lying around. Compliance audits, "undo" buttons, and historical reporting all have the same problem: sometimes you need the *appearance* of deletion without actually losing the data.

That's what a **soft delete** (or logical delete) gives you: mark a document as deleted without physically removing it. This preserves data history, enables recovery, supports audit trails, and satisfies compliance requirements. (GDPR's actual right-to-erasure is a separate concern, handled by a periodic purge job — more on that below.)

Think of it like a "trash" folder in an email client, rather than the shredder. The email is still there, just hidden from your inbox view, until someone empties the trash for good.

### Implementation

The trick is simple: instead of calling `deleteOne()`, you call `updateOne()` and flip a flag.

```js
// 1. Add deleted fields to your document schema
{
  _id: ObjectId("..."),
  name: "Alice",
  email: "alice@example.com",
  // ... other fields ...
  deleted: false,            // boolean flag
  deletedAt: null,           // timestamp
  deletedBy: null            // who deleted it
}

// 2. Soft delete operation — update instead of delete
async function softDelete(collectionName, filter, actorId) {
  return db.collection(collectionName).updateOne(
    { ...filter, deleted: false },      // only delete non-deleted docs
    {
      $set: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: actorId
      }
    }
  );
}

// Usage
await softDelete("users", { _id: userId }, "admin-user-id");
```

---

**The catch — and it's an easy one to forget:** the document is still sitting right there in the collection. Every single query you write from now on has to remember to exclude it, or "deleted" users will keep showing up in your app as if nothing happened.

```js
// Active records query — MUST always include deleted: false
db.users.find({ deleted: false, status: "active" });

// Or use a wrapper function
function activeQuery(filter) {
  return { ...filter, deleted: false };
}
db.users.find(activeQuery({ status: "active" }));

// Admin view — include deleted
db.users.find({ deleted: true }).sort({ deletedAt: -1 });

// Restore a soft-deleted record
db.users.updateOne(
  { _id: userId, deleted: true },
  { $set: { deleted: false }, $unset: { deletedAt: "", deletedBy: "" } }
);
```

**Common mistake:** writing a query that forgets `deleted: false` even once. It only takes one forgotten filter — a report, an admin dropdown, an API endpoint — to leak "deleted" records back into view. Wrapping the filter in a helper function like `activeQuery()` above is exactly how you prevent that class of bug.

### Index for Soft Delete

Since every active-record query now filters on `deleted: false`, it pays to build an index around that reality — but you don't want to index the ever-growing pile of deleted documents too. A **partial index** solves this: it only indexes documents matching a condition.

```js
// Index only active (non-deleted) documents — smaller, faster
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { deleted: false }, unique: true }
);

// Compound index including the deleted flag
db.orders.createIndex({ customerId: 1, deleted: 1, createdAt: -1 });
```

That partial index also quietly solves another problem: a *unique* index on `email` would normally stop a soft-deleted user's address from ever being reused. Scoping the uniqueness constraint to `deleted: false` means a new signup with the same email is allowed once the old account is soft-deleted.

### Soft Delete vs Hard Delete

| Consideration        | Soft Delete          | Hard Delete          |
|-----------------------|-----------------------|-----------------------|
| Data recovery        | Easy (update flag)   | Requires backup      |
| Audit trail          | Built-in             | Requires change log  |
| Storage              | Grows over time      | Storage reclaimed    |
| Query complexity     | Must add deleted:0   | Simpler queries      |
| Index efficiency     | Larger indexes       | Leaner indexes       |
| GDPR purge           | Still needed later   | Immediate            |
| Accidental delete    | Recoverable          | Permanent loss       |

### Periodic Purge Job

Soft delete buys you a safety net, but that net can't hold documents forever — storage grows, indexes bloat, and eventually you actually do need to let the data go for good. The way to reconcile "recoverable for a while" with "gone eventually" is a scheduled job that hard-deletes anything past its grace period.

```js
// Permanently purge soft-deleted records older than 30 days
async function purgeDeleted(collectionName) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await db.collection(collectionName).deleteMany({
    deleted: true,
    deletedAt: { $lt: thirtyDaysAgo }
  });
  console.log(`Purged ${result.deletedCount} records from ${collectionName}`);
}
```

*Interview answer:* "A soft delete marks a document as deleted via a flag like `deleted: true` instead of physically removing it, which gives you recovery, audit trails, and undo functionality that a hard delete can't. The trade-off is that every query touching that collection now has to explicitly filter out deleted documents, and the collection keeps growing unless you pair the pattern with a periodic purge job that hard-deletes records past some retention window — otherwise you get index bloat and, if you have unique indexes, fields like email staying permanently 'reserved' by deleted accounts."

> **Memory hook:** "Soft delete is the trash folder, not the shredder — but somebody still has to empty the trash eventually."

---

## 6. drop() vs deleteMany({})

Suppose you want to completely empty a collection. Both `drop()` and `deleteMany({})` can get you there — but reach for the wrong one and you'll either lose structure you needed, or wait far longer than necessary. They are not interchangeable.

### drop() — Destroy the Entire Collection

```js
// Drop the collection — removes documents, indexes, AND collection metadata
db.tempCollection.drop();

// Returns: true if successful, false if collection didn't exist
```

### deleteMany({}) — Remove All Documents, Preserve Structure

```js
// Delete every document but keep the collection shell (indexes, validation rules, etc.)
db.tempCollection.deleteMany({});

// Returns: { acknowledged: true, deletedCount: N }
```

---

**Why is one of these instant and the other one takes a while for a big collection?** It comes down to what each one actually has to touch internally.

```
drop():
  ┌───────────────────────────────────────────────────────────┐
  │  MongoDB simply removes the collection namespace entry    │
  │  from the catalog. WiredTiger deallocates the entire      │
  │  table file. All index files removed simultaneously.      │
  │  This is why it is O(1) regardless of document count.     │
  └───────────────────────────────────────────────────────────┘

deleteMany({}):
  ┌───────────────────────────────────────────────────────────┐
  │  MongoDB iterates every document in the collection,       │
  │  removes each from the data file, and removes each        │
  │  document's entries from every index one by one.          │
  │  Time = O(n * indexes). For 1M docs with 5 indexes,       │
  │  this means 5M index entry removals.                      │
  └───────────────────────────────────────────────────────────┘
```

`drop()` doesn't care whether the collection has 10 documents or 10 billion — it's deleting the whole file, not walking its contents. `deleteMany({})` has to visit every single document and every single index entry that points at it, one at a time. That difference only gets more dramatic as the collection grows.

### Comparison

| Feature                  | drop()              | deleteMany({})       |
|----------------------------|-----------------------|------------------------|
| Removes documents        | Yes                 | Yes                  |
| Removes indexes          | Yes (all indexes)   | No (indexes remain)  |
| Removes validation rules | Yes                 | No                   |
| Removes collection       | Yes                 | No                   |
| Performance              | O(1) — instant      | O(n) — per document  |
| Oplog entries            | 1 (drop command)    | 1 per deleted doc    |
| Use case                 | Complete teardown (test cleanup, etc) | Clear data, keep schema/indexes |

### When to Use Which

```js
// Use drop() when:
// - Running test cleanup (drop and recreate)
// - Schema migration (need to rebuild indexes)
// - Completely abandoning a collection

// Use deleteMany({}) when:
// - Clearing data but keeping indexes (avoids expensive index rebuild)
// - Clearing data but keeping validation rules
// - Scheduled data expiry where the collection structure must stay

// Test setup pattern — recreate clean state
async function resetTestCollection() {
  await db.collection("testOrders").drop().catch(() => {}); // ignore if not exists
  await db.createCollection("testOrders", { /* validator */ });
  await db.collection("testOrders").createIndex({ customerId: 1 });
}
```

**Common mistake:** reaching for `drop()` as the "faster" option without thinking about what it throws away. If your collection has three hand-tuned compound indexes and a JSON schema validator that took real effort to design, `drop()` throws all of that on the bonfire along with the data — and you pay to rebuild it, which on a large collection can take far longer than the `deleteMany({})` you were trying to avoid.

*Interview answer:* "`drop()` removes the collection's namespace entry from the catalog and lets WiredTiger deallocate the whole underlying file in one shot, so it's O(1) regardless of document count — but it takes the indexes and validation rules with it. `deleteMany({})` has to walk every document and remove its entries from every index individually, making it O(n times number of indexes), but it leaves the collection's structure — indexes, validators — intact. Use `drop()` for a full teardown, like resetting test fixtures; use `deleteMany({})` when you need to clear data but keep expensive-to-rebuild indexes or validation rules in place."

> **Memory hook:** "`drop()` burns the whole filing cabinet — instant, but you lose the labeled folders too. `deleteMany({})` empties each folder by hand, one card at a time, but the cabinet and its labels survive."

### TTL Indexes — Automatic Deletion

Both of the tools above are things *you* trigger. But a lot of deletes are actually just "this document should vanish after some amount of time" — sessions, tokens, temporary caches. Writing a cron job to run `deleteMany()` on a schedule works, but MongoDB already has a built-in answer: a **TTL (Time-To-Live) index**.

```js
// MongoDB auto-deletes documents 1 hour after 'createdAt'
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });

// MongoDB auto-deletes documents when 'expiresAt' is reached
db.tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

Internally, a background thread inside `mongod` — the TTL monitor — wakes up roughly every 60 seconds, checks for documents past their expiry, and removes them for you. No application code, no scheduled job to maintain, no risk of the cleanup job silently failing to run one night.

*Interview answer:* "A TTL index is a special index on a date field that tells MongoDB to automatically delete documents once a given number of seconds has passed since that date. A background thread, the TTL monitor, checks for expired documents roughly every 60 seconds and removes them — so it's the idiomatic replacement for a manually scheduled `deleteMany()` job for time-based expiry, at the cost of ~60-second precision rather than exact-second deletion."

> **Memory hook:** "TTL indexes are a self-cleaning oven — set the temperature once, stop thinking about scheduling the cleanup."

---

## 7. bulkWrite() for Mixed Operations

Imagine a nightly sync job: insert a few new products, update prices on existing ones, mark some out of stock, and delete the discontinued ones — maybe a hundred operations in total. Firing each one off as its own network call means paying the round-trip cost a hundred times over. `bulkWrite()` lets you hand the server the whole batch — inserts, updates, and deletes mixed together — in a single trip.

### Syntax

```js
db.collection.bulkWrite(
  [
    { insertOne:  { document: <doc> } },
    { updateOne:  { filter: <f>, update: <u>, upsert: <bool> } },
    { updateMany: { filter: <f>, update: <u> } },
    { replaceOne: { filter: <f>, replacement: <r> } },
    { deleteOne:  { filter: <f> } },
    { deleteMany: { filter: <f> } }
  ],
  {
    ordered: <boolean>,       // default: true
    writeConcern: <document>
  }
)
```

### Mixed Operations Example — Daily Sync Job

```js
const result = await db.collection("products").bulkWrite([
  // Insert new products from today's feed
  {
    insertOne: {
      document: { sku: "NEW-001", name: "Wireless Headphones", price: 79.99, inStock: true }
    }
  },
  {
    insertOne: {
      document: { sku: "NEW-002", name: "USB-C Hub", price: 39.99, inStock: true }
    }
  },
  // Update price for an existing product
  {
    updateOne: {
      filter: { sku: "EXIST-123" },
      update: { $set: { price: 149.99, lastPriceUpdate: new Date() } }
    }
  },
  // Mark out-of-stock items
  {
    updateMany: {
      filter: { sku: { $in: ["OOS-001", "OOS-002", "OOS-003"] } },
      update: { $set: { inStock: false } }
    }
  },
  // Delete discontinued items
  {
    deleteOne: {
      filter: { sku: "DISC-999" }
    }
  },
  // Delete all items not seen in the last 6 months
  {
    deleteMany: {
      filter: { lastSeenAt: { $lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } }
    }
  }
], { ordered: false }); // continue on errors for resilience

console.log(`Inserted:  ${result.insertedCount}`);
console.log(`Matched:   ${result.matchedCount}`);
console.log(`Modified:  ${result.modifiedCount}`);
console.log(`Deleted:   ${result.deletedCount}`);
console.log(`Upserted:  ${result.upsertedCount}`);
```

---

**Notice the `{ ordered: false }` at the end of that call.** That's not a random default — it's a real decision with real consequences, and it's easy to get backwards.

```
ordered: true
  ┌──────────────────────────────────────────────────────────┐
  │  Operations execute in array order, sequentially         │
  │  An error stops all subsequent operations                │
  │  Useful when operations depend on each other             │
  │  (e.g., insert a parent doc before inserting children)   │
  └──────────────────────────────────────────────────────────┘

ordered: false
  ┌──────────────────────────────────────────────────────────┐
  │  Operations can execute in any order (MongoDB optimises) │
  │  Errors are collected and reported, but don't stop       │
  │  remaining operations                                    │
  │  Higher throughput — preferred for independent ops       │
  └──────────────────────────────────────────────────────────┘
```

Ask yourself one question to pick between them: **does any operation in this batch depend on another one having already happened?** If yes — say, a delete has to happen before an insert of the replacement — you need `ordered: true`, or MongoDB is free to run them in whatever order is fastest, which could mean the insert lands before the delete and briefly (or permanently) collide.

```js
// Sync pattern: delete old version, insert new version atomically via bulkWrite
async function syncRecord(record) {
  await db.collection("catalog").bulkWrite([
    { deleteOne: { filter: { externalId: record.id } } },
    { insertOne: { document: {
      externalId: record.id,
      ...record,
      syncedAt: new Date()
    }}}
  ], { ordered: true }); // ordered: true ensures delete before insert
}
```

If the operations are independent of each other — like purging log entries by three unrelated criteria — `ordered: false` is strictly better: MongoDB can batch them for maximum throughput, and one failed operation won't block the rest from completing.

**Common mistake:** defaulting to `ordered: false` "for speed" on a batch where a later insert actually depends on an earlier delete having already happened. Independent-looking operations aren't always independent — check for hidden dependencies (same key, same document) before turning ordering off.

### Performance: bulkWrite vs Loop

```
100 delete operations:

Loop (100 × deleteOne):
  ┌────────────────────────────────────────┐
  │  100 network round-trips               │
  │  Each: request + wait + response       │
  │  Total: ~200-500ms on LAN               │
  └────────────────────────────────────────┘

bulkWrite (100 deleteOnes in one call):
  ┌────────────────────────────────────────┐
  │  1 network round-trip                  │
  │  Server processes all 100 ops          │
  │  Total: ~5-20ms on LAN                  │
  └────────────────────────────────────────┘

Speedup: 10x - 50x for network-bound workloads
```

That gap is entirely network latency, not server processing time — the server can chew through 100 operations quickly either way. What `bulkWrite()` saves you is the 99 extra "round trip" waits that a loop of individual calls forces you to pay.

*Interview answer:* "`bulkWrite()` batches multiple insert, update, and delete operations — including mixed types — into a single network round-trip instead of one round-trip per operation. The `ordered` option controls whether operations run strictly in sequence and stop at the first error (`true`, needed when later operations depend on earlier ones, like inserting a replacement after deleting the old version) or run independently for maximum throughput with errors just collected and reported (`false`, best for unrelated operations like purging logs by different criteria)."

> **Memory hook:** "`ordered: true` is a single-file line where a dropped baton stops the relay; `ordered: false` is everyone running their own leg at once."

---

## 8. Hands-On Exercises

### Exercise 1 — User Account Deletion

Implement a user deletion workflow that:
1. Soft-deletes the user (sets `deleted: true`, `deletedAt`, `deletedBy`)
2. Deletes all the user's active sessions from the `sessions` collection immediately
3. Marks all the user's pending orders as "cancelled"

```js
async function deleteUser(userId, adminId) {
  // 1. Soft delete the user
  await db.collection("users").updateOne(
    { _id: userId, deleted: false },
    { $set: { deleted: true, deletedAt: new Date(), deletedBy: adminId } }
  );

  // 2. Hard delete all sessions
  await db.collection("sessions").deleteMany({ userId });

  // 3. Cancel pending orders
  await db.collection("orders").updateMany(
    { userId, status: "pending" },
    { $set: { status: "cancelled", cancelledAt: new Date(), reason: "user_deleted" } }
  );
}
```

### Exercise 2 — Log Rotation

Write a log rotation function that:
- Deletes all `DEBUG` level logs older than 7 days
- Deletes all `INFO` level logs older than 30 days
- Deletes all `ERROR` level logs older than 90 days
- Returns a summary of how many logs were deleted per level

```js
async function rotateLogs() {
  const now = Date.now();
  const cutoffs = {
    DEBUG: new Date(now - 7  * 24 * 60 * 60 * 1000),
    INFO:  new Date(now - 30 * 24 * 60 * 60 * 1000),
    ERROR: new Date(now - 90 * 24 * 60 * 60 * 1000)
  };

  const results = {};
  for (const [level, cutoff] of Object.entries(cutoffs)) {
    const r = await db.collection("logs").deleteMany({
      level,
      createdAt: { $lt: cutoff }
    });
    results[level] = r.deletedCount;
  }

  return results;
}
```

### Exercise 3 — Atomic Pop from a Priority Queue

Use `findOneAndDelete()` to implement a message queue where workers atomically claim and remove a message. Use sort by priority descending, then enqueuedAt ascending (oldest high-priority first).

```js
async function dequeueMessage(consumerId) {
  const message = await db.collection("messageQueue").findOneAndDelete(
    { status: "queued", deliveryAttempts: { $lt: 5 } }, // skip failed messages
    {
      sort: { priority: -1, enqueuedAt: 1 },
      projection: { payload: 1, topic: 1, priority: 1, _id: 1 }
    }
  );

  if (!message) {
    return null;
  }

  // Archive the message as "processing"
  await db.collection("messageProcessing").insertOne({
    ...message,
    consumerId,
    startedAt: new Date(),
    status: "processing"
  });

  return message;
}
```

### Exercise 4 — Bulk Cleanup with bulkWrite()

Write a single `bulkWrite()` call that cleans up a `cache` collection by:
- Deleting all entries with `hits: 0` (never accessed)
- Deleting all entries that expired more than an hour ago
- Updating all remaining entries to reset `hits` to 0 for the next period

```js
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

await db.collection("cache").bulkWrite([
  {
    deleteMany: { filter: { hits: 0 } }
  },
  {
    deleteMany: { filter: { expiresAt: { $lt: oneHourAgo } } }
  },
  {
    updateMany: {
      filter: {},
      update: { $set: { hits: 0, periodStartedAt: new Date() } }
    }
  }
], { ordered: true }); // ordered: true so resets happen after deletes
```

### Exercise 5 — drop() vs deleteMany({}) Decision

You are running integration tests. Your test suite needs to reset the `testOrders` collection before each test run. The collection has 3 custom indexes and a JSON schema validator. Choose the right approach and implement it:

```js
// Option A: drop() then recreate — use when you also want fresh indexes
async function resetCollection() {
  await db.collection("testOrders").drop().catch(() => {}); // ignore "ns not found"

  await db.createCollection("testOrders", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["customerId", "total"],
        properties: {
          customerId: { bsonType: "string" },
          total:      { bsonType: "number", minimum: 0 }
        }
      }
    }
  });

  await db.collection("testOrders").createIndex({ customerId: 1 });
  await db.collection("testOrders").createIndex({ status: 1, createdAt: -1 });
  await db.collection("testOrders").createIndex({ total: 1 });
}

// Option B: deleteMany({}) — use when re-creating indexes would be slow
// and the index structure is not being tested
async function clearCollection() {
  await db.collection("testOrders").deleteMany({});
  // indexes and validation rules preserved — faster for repeat test runs
}
```

---

## 9. Interview Q&A

**Q1: What is the difference between deleteOne() and deleteMany()?**
`deleteOne()` removes only the first document matching the filter. If multiple documents match, only one (the "first" in natural order) is removed. `deleteMany()` removes ALL documents matching the filter. Use `deleteOne()` when you are targeting a specific document (ideally by `_id`) and `deleteMany()` for bulk removal by a condition.

**Q2: What does findOneAndDelete() return, and when should you use it over deleteOne()?**
`findOneAndDelete()` returns the deleted document itself (or null if no match). `deleteOne()` returns only `{ acknowledged, deletedCount }`. Use `findOneAndDelete()` when you need the deleted document's data — for example, to log it, send a farewell email, move it to an archive collection, or implement a queue pop pattern. It saves a separate read query and is atomic.

**Q3: What is a soft delete and why is it preferred in production systems?**
A soft delete marks a document as deleted (typically `{ deleted: true, deletedAt: Date }`) without physically removing it. Production systems prefer it because: it enables data recovery from accidental deletions; it preserves audit trails for compliance; it allows "undo" functionality; and it lets you analyse historical data. The trade-off is increased storage and the requirement to add `deleted: false` to all active queries.

**Q4: What is the difference between drop() and deleteMany({}) performance-wise?**
`drop()` is O(1) — MongoDB removes the collection namespace from the catalog and WiredTiger deallocates the table file instantly, regardless of how many documents exist. `deleteMany({})` is O(n*i) where n is document count and i is index count — MongoDB must remove each document and all its index entries individually. For large collections, `drop()` can be thousands of times faster.

**Q5: When would you use deleteMany({}) instead of drop() even though drop() is faster?**
Use `deleteMany({})` when you need to preserve the collection structure: custom indexes (especially compound or text indexes that took time to create), JSON schema validation rules, collection-level options, or access control. Dropping and recreating requires rebuilding all indexes, which can be expensive. `deleteMany({})` clears data while leaving the structure intact.

**Q6: Is deleteMany() atomic?**
At the document level, each individual deletion within `deleteMany()` is atomic. However, `deleteMany()` as a whole is NOT atomic — it does not wrap all deletions in a transaction. If the operation is interrupted, some documents will be deleted and others will not. For full atomicity across multiple documents, use multi-document transactions.

**Q7: How do TTL indexes relate to delete operations?**
A TTL (Time-To-Live) index is a special index on a date field that instructs MongoDB to automatically delete documents after a specified number of seconds. MongoDB runs a background thread (the TTL monitor) every 60 seconds that executes `deleteMany()` for expired documents. It is the idiomatic way to implement data expiry without manual scheduled jobs. Precision is approximately 60 seconds.

**Q8: How do you safely delete large numbers of documents without affecting production performance?**
Use batch deletes: first find document IDs in small batches (e.g., 1000 at a time), then delete by those IDs. This limits the lock hold time and oplog entry size per operation, giving other operations a chance to run. Additionally, run large deletes during off-peak hours, and consider using a TTL index for time-based expiry instead of manual batch jobs.

**Q9: What happens when you call deleteOne() with an empty filter {}?**
`deleteOne({})` deletes one document — whichever MongoDB picks first in natural order. This is dangerous. For `deleteMany({})`, it deletes ALL documents in the collection. Always include a specific filter to avoid accidental mass deletion. In production, add application-level guards or MongoDB role-based access control to prevent destructive operations on sensitive collections.

**Q10: How does bulkWrite() improve delete performance compared to looping deleteOne()?**
`bulkWrite()` batches multiple operations into a single network round-trip. Each individual `deleteOne()` in a loop requires a separate request-response cycle. For 100 deletes on a LAN, looping takes ~200ms (100 × 2ms per round-trip); `bulkWrite()` takes ~5ms. The speedup is proportional to network latency and scales linearly with the number of operations.

**Q11: Can you mix deletes and inserts in the same bulkWrite() call?**
Yes. `bulkWrite()` accepts any combination of `insertOne`, `updateOne`, `updateMany`, `replaceOne`, `deleteOne`, and `deleteMany`. With `ordered: true`, operations execute sequentially in array order (useful when an insert depends on a prior delete). With `ordered: false`, MongoDB may reorder for efficiency but all operations are attempted.

**Q12: What is the risk of soft delete without a periodic purge job?**
Without purging, soft-deleted documents accumulate indefinitely, causing: storage growth; index bloat (soft-deleted docs still have index entries); query performance degradation as indexes grow larger; and eventually exceeding storage quotas. Additionally, if you have a unique index on a field like `email`, a soft-deleted user's email remains "reserved" and prevents re-registration. Always pair soft delete with a scheduled purge job.

**Q13: How do you restore a soft-deleted document?**
Use `updateOne()` to flip the deleted flag: `db.collection.updateOne({ _id: id, deleted: true }, { $set: { deleted: false }, $unset: { deletedAt: "", deletedBy: "" } })`. Optionally, also `$set` a `restoredAt` and `restoredBy` field for the audit trail.

**Q14: What is the ordered option in bulkWrite() and when should you use ordered: false for deletes?**
With `ordered: true`, operations execute sequentially and stop on the first error. With `ordered: false`, all operations are attempted regardless of errors — failures are collected and reported at the end. Use `ordered: false` for independent delete operations (e.g., purging log entries by different criteria) to maximise throughput and ensure all batches complete even if some fail. Use `ordered: true` when deletions must happen before subsequent inserts or updates in the same batch.

**Q15: How can you verify that a deleteOne() actually removed the correct document before executing in production?**
Use `findOne()` with the same filter first to preview which document would be deleted. Alternatively, use `findOneAndDelete()` in development/testing — it returns the deleted document, letting you inspect and log it. In production, always target by `_id` when possible to eliminate ambiguity, and add application-level confirmation steps for irreversible destructive operations.
