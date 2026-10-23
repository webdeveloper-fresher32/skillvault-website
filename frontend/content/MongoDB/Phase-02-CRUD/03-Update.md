# MongoDB Phase 02 — Update Operations

## Table of Contents

1. [Overview of Update Operations](#1-overview-of-update-operations)
2. [updateOne() and updateMany()](#2-updateone-and-updatemany)
3. [replaceOne()](#3-replaceone)
4. [Update Operators — Complete Reference](#4-update-operators)
5. [arrayFilters for Nested Array Updates](#5-arrayfilters-for-nested-array-updates)
6. [findOneAndUpdate()](#6-findoneandupdate)
7. [Upsert Option](#7-upsert-option)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Overview of Update Operations

Say you have a `products` document with fifteen fields, and the only thing that changed is the price. In SQL you'd write `UPDATE products SET price = 199.99 WHERE _id = 'PROD-001'` — and under the hood, plenty of engines still touch the whole row. What if you only ever wanted to touch the one field that actually changed, and never risk clobbering the other fourteen by accident?

That's the problem MongoDB's update operators solve. Instead of "give me a full replacement row," you say "reach in and change just this field" — everything else stays exactly as it was.

---

### Real-world analogy

Think of a filing cabinet full of index cards. A SQL-style `UPDATE` pulls the card out and staples a brand-new card over it — the whole card is gone and replaced. MongoDB's `$set` operator is more like a fine-tip pen: you open the drawer, find the card, and cross out just the one line you need to change. Everything else on the card stays in the same handwriting it always had.

---

### Basic definition

MongoDB updates are **atomic at the document level** and support operators (`$set`, `$inc`, `$push`, and friends) that modify specific fields without rewriting the rest of the document.

---

### Internal working — the update command pipeline

Here's what actually happens on the server when you call `updateOne`:

```
Application
     │
     │  updateOne({ _id: X }, { $set: { status: "active" } })
     ▼
┌──────────────────────────────────────────────────────────┐
│                    mongod Server                         │
│                                                          │
│  1. Acquire document-level write lock                    │
│  2. Locate document(s) via filter (uses index if avail)  │
│  3. Apply update operators in-place                      │
│  4. Update indexes for modified fields                   │
│  5. Write to journal (if write concern requires it)      │
│  6. Return result to client                               │
└──────────────────────────────────────────────────────────┘
     │
     ▼
{ acknowledged: true, matchedCount: 1, modifiedCount: 1 }
```

Notice step 1: the lock is scoped to a *single document*, not the whole collection. That's exactly why the atomicity guarantee below is document-level, not collection-level.

---

### Atomicity — the concept worth burning into memory

Here's the guarantee: MongoDB promises that all the operator changes inside one `updateOne()` call against **one document** either all apply, or none do. There's no "half-updated" document sitting around, even if the server crashes mid-write.

**The catch that trips people up:** that guarantee stops at the document boundary. If you call `updateMany()` and it touches 10,000 documents, and the server crashes after document #4,000, you now have 4,000 updated documents and 6,000 untouched ones — with no automatic rollback. `updateMany()` is atomic *per document it touches*, not atomic *across the whole batch*.

**Common mistake:** assuming `updateMany()` behaves like a SQL transaction where the whole statement either fully commits or fully rolls back. It doesn't. If you need true all-or-nothing semantics across multiple documents, you need multi-document transactions (covered in Phase 05) — a plain `updateMany()` will not give you that on its own.

**Interview answer:** *"MongoDB guarantees atomicity at the single-document level — every operator in an update either fully applies to that document or none of it does. That guarantee does not extend across documents: `updateMany()` can be interrupted partway through, leaving some matched documents updated and others not, with no automatic rollback. True multi-document atomicity requires an explicit transaction with a session."*

> **Memory hook:** "One card is all-or-nothing. A stack of cards is one-card-at-a-time — drop the stack mid-shuffle, and some cards are updated, some aren't."

---

## 2. updateOne() and updateMany()

You've got two flavors of the same operation: touch exactly one document, or touch every document that matches. Why would you ever want two separate methods instead of one that just does whatever the filter matches? Because "update everything that matches" and "update the one thing I have in mind" are different enough intents that MongoDB makes you say which one you meant — a small safeguard against accidentally rewriting your whole collection when you only meant to touch one row.

### Syntax

```js
db.collection.updateOne(
  <filter>,          // which document(s) to match
  <update>,          // update operators OR aggregation pipeline
  {
    upsert: <boolean>,                  // default: false
    arrayFilters: [ <filterdoc1>, ...], // for nested array updates
    hint: <indexHint>,                  // force index selection
    writeConcern: <document>,
    comment: <any>
  }
)

// updateMany() — same signature, updates ALL matching documents
db.collection.updateMany(<filter>, <update>, <options>)
```

### Return value

Every update call reports back what actually happened:

```js
{
  acknowledged: true,
  matchedCount: 1,    // how many documents matched the filter
  modifiedCount: 1,   // how many documents were actually changed
  upsertedId: null    // ObjectId of upserted doc if upsert:true
}
```

### matchedCount vs modifiedCount — why they can differ

Here's a case that confuses people the first time they see it:

```
matchedCount = 3, modifiedCount = 1
Means: 3 documents matched the filter, but only 1 was different from the update
(the other 2 already had the target value — no change needed)
```

In other words, `matchedCount` tells you how many documents the filter found; `modifiedCount` tells you how many of those actually had a value to change. If you `$set: { status: "archived" }` on three documents and two are already archived, MongoDB doesn't rewrite them for no reason — it just reports them as matched, not modified.

### Basic updateOne()

```js
// Update a single user's email
db.users.updateOne(
  { _id: ObjectId("64a1f3b2e4b0c12345678901") },
  { $set: { email: "newemail@example.com" } }
);
```

### Basic updateMany()

```js
// Mark all orders from 2023 as "archived"
db.orders.updateMany(
  { createdAt: { $lt: new Date("2024-01-01") } },
  { $set: { status: "archived", archivedAt: new Date() } }
);
```

### Aggregation pipeline as update (MongoDB 4.2+)

Sometimes the new value depends on other fields already in the same document — say, you want `fullName` to be `firstName` and `lastName` glued together. A plain update document can't reference other fields of the document being updated, but an aggregation pipeline can:

```js
// Concatenate firstName and lastName into fullName
db.users.updateMany(
  {},
  [
    { $set: { fullName: { $concat: ["$firstName", " ", "$lastName"] } } }
  ]
);

// Increment score by 10% of its current value
db.games.updateOne(
  { _id: "game-1" },
  [
    { $set: { score: { $multiply: ["$score", 1.1] } } }
  ]
);
```

The `[...]` array syntax (instead of a plain `{...}` update document) is the signal to MongoDB "treat this as a pipeline, not a static set of operators."

---

## 3. replaceOne()

**The problem:** what if you've already assembled the *entire* new document in your application — you fetched it, modified several fields in memory, and now you just want to save the whole thing back? Reaching for `$set` field-by-field would be tedious and error-prone. `replaceOne()` is built for exactly that case.

### Basic definition

`replaceOne()` **completely replaces** a document with a new one, preserving only the `_id`. Every other field is discarded unless it's present in the replacement.

### Syntax

```js
db.collection.replaceOne(
  <filter>,
  <replacement>,    // must NOT contain update operators
  { upsert: <boolean>, writeConcern: <document> }
)
```

### Replace vs update, side by side

This is the comparison that matters most — watch what survives and what doesn't:

```
Original document:
{ _id: 1, name: "Alice", role: "admin", dept: "Engineering", salary: 90000 }

─────────────────────────────────────────────────────────────────────
updateOne with $set:
  db.users.updateOne({ _id: 1 }, { $set: { salary: 95000 } })

  Result: { _id: 1, name: "Alice", role: "admin", dept: "Engineering", salary: 95000 }
  ─ Only salary changed, all other fields preserved ─

─────────────────────────────────────────────────────────────────────
replaceOne:
  db.users.replaceOne({ _id: 1 }, { name: "Alice", salary: 95000 })

  Result: { _id: 1, name: "Alice", salary: 95000 }
  ─ role, dept are GONE — only _id + replacement content remains ─
```

Notice `role` and `dept` simply vanish under `replaceOne()` — not because MongoDB "forgot" them, but because they weren't in the replacement document you handed it, and a replace means "this is now the whole document."

### Compare: updateOne (with $set) vs replaceOne

| | `updateOne` with `$set` | `replaceOne` |
|---|---|---|
| Scope of change | Only the fields you name | The entire document body |
| Fields not mentioned | Untouched | Deleted |
| `_id` | Untouched | Preserved automatically |
| Body shape | Update operators (`$set`, `$inc`, ...) | A plain document, no operators allowed |

### When to use replaceOne()

- When you have the complete new document state in your application
- When you want to ensure no "ghost" fields survive from the old document
- Object-Relational style patterns where you manage the whole entity

```js
// Fetch, modify in app, then replace
const user = await db.collection("users").findOne({ _id: userId });
user.lastLogin = new Date();
user.loginCount = (user.loginCount || 0) + 1;
await db.collection("users").replaceOne({ _id: userId }, user);
```

**Common mistake:** calling `replaceOne()` with a partial object because you only meant to change one or two fields — you'll silently delete every field you didn't include. If you're only touching a couple of fields, reach for `updateOne()` with `$set` instead; save `replaceOne()` for when you genuinely have the full document.

**Interview answer:** *"`updateOne()` applies operators to modify specific fields, leaving everything else on the document untouched. `replaceOne()` throws away the entire document body except `_id` and replaces it wholesale with whatever you pass in. Use `replaceOne()` when your application already holds the complete new state of the document; use `updateOne()` for targeted, partial changes."*

> **Memory hook:** "`$set` edits a line on the card. `replaceOne` throws the card away and staples in a new one — same `_id`, blank slate otherwise."

---

## 4. Update Operators

### Field Operators

#### $set — Set Field Value

The most common operator you'll ever write — it sets a field to a value, creating the field if it doesn't already exist.

```js
// Set one or more fields (creates field if it doesn't exist)
db.products.updateOne(
  { _id: "PROD-001" },
  { $set: { price: 199.99, "metadata.updatedAt": new Date(), inStock: true } }
);
```

#### $unset — Remove a Field

Sometimes a field needs to disappear entirely, not just be set to null or empty. `$unset` deletes the field itself.

```js
// Remove the 'legacyCode' field entirely
db.products.updateOne(
  { _id: "PROD-001" },
  { $unset: { legacyCode: "" } }   // value is irrelevant, use ""
);
```

#### $rename — Rename a Field

```js
// Rename 'qty' to 'quantity' across all products
db.products.updateMany(
  {},
  { $rename: { "qty": "quantity" } }
);
```

#### $inc — Increment / Decrement

Why would you fetch a counter, add 1 in your application, then write it back — risking two requests racing each other and one increment getting lost? `$inc` does the read-modify-write atomically, on the server, in one round trip.

```js
// Increment views by 1
db.articles.updateOne({ _id: "article-1" }, { $inc: { views: 1 } });

// Decrement stock by 5, increment soldCount by 5
db.inventory.updateOne(
  { _id: "SKU-001" },
  { $inc: { stock: -5, soldCount: 5 } }
);
```

#### $mul — Multiply

Same idea as `$inc`, but for multiplication — handy for percentage-based adjustments without reading the value first.

```js
// Apply a 10% price increase to all Electronics
db.products.updateMany(
  { category: "Electronics" },
  { $mul: { price: 1.10 } }
);

// Multiply by 0 to set field to 0 (creating it as 0 if absent)
db.scores.updateOne({ _id: "s1" }, { $mul: { bonus: 0 } });
```

#### $min — Update if New Value is LESS Than Current

```js
// Only update 'lowScore' if the new value is smaller
db.games.updateOne(
  { _id: "player-1" },
  { $min: { lowScore: 42 } }
);
// If current lowScore is 38, no change. If 55, it becomes 42.
```

#### $max — Update if New Value is GREATER Than Current

```js
// Only update 'highScore' if the new value is larger
db.games.updateOne(
  { _id: "player-1" },
  { $max: { highScore: 1500 } }
);
// Useful for tracking maximums without read-modify-write
```

`$min` and `$max` exist so you don't have to fetch the current value, compare it in your application, and conditionally write back — MongoDB does the comparison for you, atomically, in the same call.

#### $currentDate — Set to Current Date

```js
db.orders.updateOne(
  { _id: "ORD-001" },
  {
    $set: { status: "shipped" },
    $currentDate: {
      lastModified: true,                    // sets to Date
      "shipping.timestamp": { $type: "timestamp" }  // sets to BSON Timestamp
    }
  }
);
```

`$currentDate` timestamps at the *server*, at the moment the write is applied — not at the moment your application built the request. On a slow network or a bulk job, that distinction matters for audit accuracy.

---

### Array Operators

#### $push — Append to Array

```js
// Append a single comment
db.posts.updateOne(
  { _id: "post-1" },
  { $push: { comments: { author: "Bob", text: "Great post!", ts: new Date() } } }
);
```

#### $push with $each — Append Multiple Elements

```js
db.posts.updateOne(
  { _id: "post-1" },
  {
    $push: {
      tags: {
        $each: ["mongodb", "nosql", "database"],
        $slice: -10,    // keep only the last 10 tags
        $sort: 1        // sort alphabetically after push
      }
    }
  }
);
```

#### $pull — Remove Elements from Array

```js
// Remove the value "deprecated" from the tags array
db.products.updateOne(
  { _id: "PROD-001" },
  { $pull: { tags: "deprecated" } }
);

// Remove all comments with rating < 1 (on sub-document arrays)
db.posts.updateOne(
  { _id: "post-1" },
  { $pull: { comments: { rating: { $lt: 1 } } } }
);
```

#### $addToSet — Add Only if Not Already Present

Plain `$push` will happily add the same tag twice. If you actually want set semantics — no duplicates, ever — that's what `$addToSet` is for.

```js
// Add "premium" tag only if it's not already in the array (no duplicates)
db.users.updateOne(
  { _id: "user-1" },
  { $addToSet: { roles: "premium" } }
);

// Add multiple elements, avoiding duplicates
db.users.updateOne(
  { _id: "user-1" },
  { $addToSet: { roles: { $each: ["premium", "verified"] } } }
);
```

#### $pop — Remove First or Last Element

```js
// Remove the LAST element (1 = last)
db.queues.updateOne({ _id: "queue-1" }, { $pop: { items: 1 } });

// Remove the FIRST element (-1 = first)
db.queues.updateOne({ _id: "queue-1" }, { $pop: { items: -1 } });
```

### Compare: $push vs $addToSet vs $pull vs $pop

```
┌──────────────────┬──────────────────────────────────────────────────────┐
│ Operator         │ Behaviour                                            │
├──────────────────┼──────────────────────────────────────────────────────┤
│ $push            │ Always appends (allows duplicates)                   │
│ $addToSet        │ Appends only if element not already in array (set    │
│                  │ semantics — no duplicates)                           │
│ $pull            │ Removes ALL matching elements from array             │
│ $pop: 1          │ Removes last element (like stack pop)                │
│ $pop: -1         │ Removes first element (like queue dequeue)           │
└──────────────────┴──────────────────────────────────────────────────────┘
```

**Common mistake:** reaching for `$push` on a "roles" or "tags" style array where duplicates would actually be a bug, and only noticing when a user ends up with `["premium", "premium", "premium"]` after clicking upgrade three times. If duplicates are meaningless or harmful for your array, that's your signal to use `$addToSet`, not `$push`.

### $each and $slice — capping an array's size

```js
// $each: push multiple elements at once
// $slice: after push, keep only the most recent N elements (negative = from end)
// $sort: sort array elements after modification

db.notifications.updateOne(
  { userId: "user-1" },
  {
    $push: {
      history: {
        $each: [
          { msg: "Login", ts: new Date() },
          { msg: "Profile updated", ts: new Date() }
        ],
        $sort: { ts: -1 },     // newest first
        $slice: 50             // keep only 50 most recent notifications
      }
    }
  }
);
```

This combination is how you implement a capped array — a notification feed that never grows past its last 50 entries, without ever running a separate cleanup job.

---

## 5. arrayFilters for Nested Array Updates

**The problem:** you have an array of sub-documents, and you need to update just *one* of them — the one matching some condition — but you don't know (and shouldn't have to know) its index in the array.

```js
// Document structure:
{
  _id: 1,
  students: [
    { name: "Alice", grades: [80, 92, 75] },
    { name: "Bob",   grades: [65, 78, 90] },
    { name: "Carol", grades: [95, 88, 91] }
  ]
}

// PROBLEM: How do you add 5 bonus points to Alice's first grade?
// You can't say "the element where name is Alice" in a simple update.
```

If arrays only let you address elements by numeric index (`students.0.grades`), you'd have to first query the document, find Alice's position in the array yourself, and hard-code that index into your update — fragile, and racy if the array changes between your read and your write. `arrayFilters` lets you describe the *condition* instead of the position.

### Real-world analogy

Think of it like addressing a letter "to whoever is sitting in seat 4B" versus "to whoever's name tag says Alice." A numeric index is seat 4B — if people reshuffle seats, your letter goes to the wrong person. `arrayFilters` addresses by name tag — it always finds the right element regardless of where it currently sits in the array.

### Syntax

```js
db.collection.updateOne(
  <filter>,
  { $set: { "arrayField.$[identifier].nestedField": newValue } },
  { arrayFilters: [ { "identifier.condition": value } ] }
)
```

### Internal working — how MongoDB resolves $[identifier]

```text
updateOne() call arrives with arrayFilters: [{ "student.name": "Alice" }]
        |
        v
MongoDB locates the target document via <filter>
        |
        v
For the array field referenced by $[student], scan its elements
        |
        v
For each element, test it against the arrayFilters condition
("student.name" == "Alice")
        |
   ----------------
   |              |
 matches        no match
   |              |
   v              v
Apply the      Leave this
update to      element
this element   untouched
   |              |
   ----------------
        |
        v
   Write the modified document back (still one atomic
   document-level write, even though multiple array
   elements may have been touched)
```

### Example 1 — Update a Specific Student's Score

```js
db.classes.updateOne(
  { _id: 1 },
  { $inc: { "students.$[student].grades.$[grade]": 5 } },
  {
    arrayFilters: [
      { "student.name": "Alice" },     // identifier: student
      { grade: { $lt: 80 } }           // identifier: grade
    ]
  }
);
// Result: Alice's grades below 80 are incremented by 5
```

Notice this example nests two `$[identifier]` placeholders — one for which student, one for which of *that student's* grades. Each identifier gets its own matching `arrayFilters` entry.

### Example 2 — Update Orders with a Specific Item Status

```js
// Document:
// { _id: "ORD-001", items: [{ sku: "A", status: "processing" }, { sku: "B", status: "shipped" }] }

// Mark only "processing" items as "shipped"
db.orders.updateOne(
  { _id: "ORD-001" },
  { $set: { "items.$[item].status": "shipped" } },
  { arrayFilters: [ { "item.status": "processing" } ] }
);
```

### Example 3 — Bulk Update Across Multiple Documents

```js
// In ALL orders, update the price of SKU "ITEM-001" to 29.99
db.orders.updateMany(
  { "items.sku": "ITEM-001" },
  { $set: { "items.$[item].price": 29.99 } },
  { arrayFilters: [ { "item.sku": "ITEM-001" } ] }
);
```

### Compare: $ (positional) vs $[identifier] (arrayFilters)

```
┌───────────────────────────────────────────────────────────────────────┐
│  $ (positional)                                                       │
│    Updates the FIRST array element that matches the query filter      │
│    db.posts.updateOne(                                                │
│      { "comments.author": "Alice" },                                  │
│      { $set: { "comments.$.approved": true } }                        │
│    )                                                                  │
│    Limitation: only works one level deep                              │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│  $[identifier] (filtered positional — arrayFilters)                   │
│    Updates ALL elements that match the arrayFilter condition          │
│    Works for deeply nested arrays (multiple levels)                   │
│    More flexible — filter by any field in the sub-document            │
└───────────────────────────────────────────────────────────────────────┘
```

**Common mistake:** using bare `$` when you actually need to update more than one matching array element — `$` silently only touches the *first* match and leaves the rest alone, which looks like a bug ("why didn't all the processing items get marked shipped?") rather than the documented, one-element-only behavior it actually is. If you need "all matching elements," reach for `$[identifier]` with `arrayFilters`, not `$`.

**Interview answer:** *"`arrayFilters` let you update specific elements of an array of sub-documents by condition instead of by index. You define one or more named identifiers like `$[student]` in the update path, and pair each with a matching filter document in the `arrayFilters` option. The positional `$` operator is simpler but only updates the first matching element and only works one level deep; `arrayFilters` can update every matching element, at any nesting depth, filtered on any field."*

> **Memory hook:** "`$` finds the first name on the list. `$[identifier]` circles every name that matches — no matter how deep the list is nested."

---

## 6. findOneAndUpdate()

**The problem:** you want to update a document *and* know what it looked like (before or after) — say, claiming the next task off a queue, or generating the next invoice number. Doing this as two separate calls (a `find` then an `updateOne`) leaves a gap: another process could sneak in between your read and your write and grab the same task.

`findOneAndUpdate()` closes that gap by doing both in one atomic round trip: it finds a document, updates it, and hands you the document — all as a single indivisible server-side operation.

### Basic definition

`findOneAndUpdate()` is an **atomic find-and-modify** operation. It returns the document (before or after the update) in a single round-trip. Essential for patterns like "claim a task" or "generate a sequence number".

### Syntax

```js
db.collection.findOneAndUpdate(
  <filter>,
  <update>,
  {
    returnDocument: "before" | "after",   // default: "before"
    sort: <sortDoc>,                       // which document to pick if multiple match
    upsert: <boolean>,
    projection: <projectionDoc>,
    maxTimeMS: <number>
  }
)
```

### returnDocument options

```
returnDocument: "before" (default)
  Returns the document as it was BEFORE the update.
  Use when you need to know the old state.

returnDocument: "after"
  Returns the document as it is AFTER the update.
  Use when you need the new state (e.g., to show user confirmation).
```

### Example — Increment Page Views and Get New Count

```js
const result = await db.collection("articles").findOneAndUpdate(
  { slug: "intro-to-mongodb" },
  { $inc: { views: 1 } },
  {
    returnDocument: "after",
    projection: { title: 1, views: 1, _id: 0 }
  }
);
console.log(`"${result.title}" now has ${result.views} views`);
```

### Example — Task Queue (Claim Next Available Task)

This is the pattern that makes `findOneAndUpdate()` earn its keep. Two workers racing for the same "pending" task cannot both win — MongoDB's document-level lock means only one of them will successfully flip the status before the other's filter (`status: "pending"`) stops matching.

```js
// Atomically pick up the next "pending" task sorted by priority
const task = await db.collection("tasks").findOneAndUpdate(
  { status: "pending" },
  { $set: { status: "processing", claimedBy: workerId, claimedAt: new Date() } },
  {
    sort: { priority: -1, createdAt: 1 },  // highest priority, oldest first
    returnDocument: "after"
  }
);

if (task) {
  await processTask(task);
} else {
  console.log("No pending tasks");
}
```

### Example — Auto-Increment Sequence

```js
// MongoDB does not have AUTO_INCREMENT, but you can simulate it:
async function getNextSequence(name) {
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return result.seq;
}

const nextOrderId = await getNextSequence("orderId");
// Returns 1, 2, 3, ... on successive calls — atomically
```

### Compare: findOneAndUpdate() vs updateOne()

```
┌────────────────────────┬──────────────────────┬───────────────────────┐
│ Feature                │ updateOne()          │ findOneAndUpdate()    │
├────────────────────────┼──────────────────────┼───────────────────────┤
│ Returns                │ Result metadata only │ The document itself   │
│ Round trips            │ 1                    │ 1                     │
│ Get updated document   │ Requires 2nd query   │ Built-in              │
│ Atomicity              │ Document-level       │ Document-level        │
│ Use case               │ Fire and forget      │ Read-modify workflows │
└────────────────────────┴──────────────────────┴───────────────────────┘
```

Both are equally atomic at the document level — that's not the differentiator. The differentiator is that `findOneAndUpdate()` hands you the document in the same trip, which is exactly what you need whenever the *next* step in your code depends on the document's new (or old) state.

**Common mistake:** calling `updateOne()` and then immediately running a separate `findOne()` to see the result. That's two round trips, and worse, it's not atomic — something else could modify the document between your update and your follow-up read. If you need the resulting document, `findOneAndUpdate()` isn't just more convenient, it's the only version of this that's actually safe under concurrency.

**Interview answer:** *"`findOneAndUpdate()` atomically finds a document, applies an update, and returns the document — either its state before or after the change, controlled by `returnDocument`. It's essential whenever the next step of your logic depends on knowing the document's state, like claiming a task from a queue or generating a sequence number, because doing a separate find-then-update would leave a race-condition window that another process could slip into."*

> **Memory hook:** "`updateOne` tells you *how many* cards changed. `findOneAndUpdate` hands you *the card itself* — before or after your pen touched it."

---

## 7. Upsert Option

**The problem:** you're syncing data from an external system, and for any given record you genuinely don't know — and don't want to check first — whether it already exists in your collection. Do you really want to write "if exists, update; else, insert" as two separate round trips, with a race condition lurking between the check and the write?

An **upsert** (update + insert) collapses that into one atomic operation: if a document matches the filter, MongoDB updates it; if none matches, MongoDB inserts a new one instead.

### Enabling Upsert

```js
db.collection.updateOne(
  <filter>,
  <update>,
  { upsert: true }   // ← enable upsert
)
```

### Internal working — how upsert decides what to insert

When no match is found, MongoDB doesn't insert a blank document and then apply the update — it builds the new document out of the pieces you already gave it: the equality conditions from the filter, plus whatever the update operators would have set.

```js
db.products.updateOne(
  { sku: "ITEM-999" },                           // filter
  { $set: { name: "New Product", price: 49.99 } }, // update
  { upsert: true }
);

// If no doc with sku:"ITEM-999" exists, inserts:
// { _id: <newObjectId>, sku: "ITEM-999", name: "New Product", price: 49.99 }
//                        ^── from filter ^── from $set

// Return value includes:
// { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedId: ObjectId("...") }
```

Step by step, that's:

```text
updateOne(filter, update, { upsert: true })
        |
        v
Does any document match <filter>?
        |
   ----------------
   |              |
  YES             NO
   |              |
   v              v
Apply <update>   Build a new document:
to the matched     - take equality fields straight from <filter>
document,           - apply the update operators ($set, etc.) on top
as normal           - generate a new _id
                     - insert it
   |              |
   ----------------
        |
        v
Return result (upsertedId is set only on the insert branch)
```

### $setOnInsert — Apply Only on Insert

But what about a field like `createdAt` — you want it stamped once, at creation, and never touched again on subsequent updates? If you used `$set` for that, every single update would reset the creation timestamp to "now." `$setOnInsert` exists specifically to run only on the insert branch of an upsert, never on the update branch.

```js
// Only set createdAt when the document is first created, not on updates
db.users.updateOne(
  { email: "alice@example.com" },
  {
    $set: { lastSeen: new Date() },               // always update
    $setOnInsert: { createdAt: new Date(), role: "user" }  // only on insert
  },
  { upsert: true }
);
```

### Upsert with replaceOne()

```js
// If matched: replace entire document. If not matched: insert replacement as new doc.
db.configs.replaceOne(
  { environment: "production" },
  { environment: "production", featureFlags: { darkMode: true }, version: 3 },
  { upsert: true }
);
```

### Common Upsert Pattern — Idempotent Sync

```js
// Synchronise an external record into MongoDB — safe to call repeatedly
async function syncProduct(externalProduct) {
  await db.collection("products").updateOne(
    { externalId: externalProduct.id },
    {
      $set: {
        name: externalProduct.name,
        price: externalProduct.price,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date(),
        externalId: externalProduct.id
      }
    },
    { upsert: true }
  );
}
```

Notice why this function is safe to call over and over, on a cron job, forever: the first call inserts, every call after that just updates. That's what "idempotent" buys you — you never need to remember whether this is the first sync or the hundredth.

### Common mistake / race condition warning

Here's the sharp edge: when two concurrent operations upsert on the same filter at nearly the same moment, both can find "no match" simultaneously, and both attempt an insert. If the filter field has a unique index, one of those inserts wins and the other fails with a duplicate key error (code 11000) — even though you used `upsert: true` specifically to avoid handling "does it already exist" yourself.

```js
let retries = 3;
while (retries > 0) {
  try {
    await db.collection("config").updateOne(filter, update, { upsert: true });
    break;
  } catch (err) {
    if (err.code === 11000 && retries > 1) {
      retries--;
    } else {
      throw err;
    }
  }
}
```

The fix isn't to abandon upsert — it's to expect this race can happen under concurrency and retry: catch the duplicate key error and simply try the upsert again, since the second attempt will now find the row the other process just inserted and take the update branch instead.

**Interview answer:** *"An upsert combines update and insert into a single atomic operation: if the filter matches, it updates the existing document; if nothing matches, MongoDB constructs a new document from the filter's equality conditions plus the update operators, and inserts it. `$setOnInsert` lets you set fields — like `createdAt` — that should only ever be written on the insert branch, never overwritten on later updates. Because two concurrent upserts against the same filter can both observe 'no match' at once, upserts against a uniquely-indexed field can still throw a duplicate key error, so production code should be ready to catch and retry."*

> **Memory hook:** "Upsert is 'update if you can find it, insert if you can't' — but two people reaching for the last empty seat at the same instant can still bump into each other."

---

## 8. Hands-On Exercises

### Exercise 1 — E-commerce Inventory Management

Write update operations for an `inventory` collection to:
- Decrease `stockQty` by the purchased quantity and increase `soldCount` atomically
- Add a review sub-document to the `reviews` array, keeping only the 100 most recent
- Remove all reviews with `helpful` count less than 2

```js
// Decrease stock and increase sold count
db.inventory.updateOne(
  { _id: "ITEM-001", stockQty: { $gte: 3 } },  // optimistic locking: ensure enough stock
  { $inc: { stockQty: -3, soldCount: 3 } }
);

// Add review, keep last 100
db.inventory.updateOne(
  { _id: "ITEM-001" },
  {
    $push: {
      reviews: {
        $each: [{ author: "Dave", rating: 5, text: "Excellent!", ts: new Date() }],
        $sort: { ts: -1 },
        $slice: 100
      }
    }
  }
);

// Remove unhelpful reviews
db.inventory.updateOne(
  { _id: "ITEM-001" },
  { $pull: { reviews: { helpful: { $lt: 2 } } } }
);
```

### Exercise 2 — User Role Management

Build operations to:
- Add a "moderator" role to a user (without duplicates)
- Remove the "banned" role from all users
- Rename the field `lastLoginDate` to `lastLoginAt` across all user documents

```js
db.users.updateOne(
  { _id: "user-1" },
  { $addToSet: { roles: "moderator" } }
);

db.users.updateMany({}, { $pull: { roles: "banned" } });

db.users.updateMany({}, { $rename: { lastLoginDate: "lastLoginAt" } });
```

### Exercise 3 — Order Status Machine

An order has nested `items` array. Write an `arrayFilters` update to mark all items with `status: "processing"` as `status: "shipped"` for order `ORD-2024-005`, and set `shippedAt` on those items.

```js
db.orders.updateOne(
  { _id: "ORD-2024-005" },
  {
    $set: {
      "items.$[item].status": "shipped",
      "items.$[item].shippedAt": new Date()
    }
  },
  {
    arrayFilters: [ { "item.status": "processing" } ]
  }
);
```

### Exercise 4 — Leaderboard with $min / $max

A `leaderboard` collection stores player scores. Write operations to:
- Update a player's `highScore` only if the new score is higher
- Update their `bestTime` only if the new time is lower (lower is better in racing games)
- Ensure the record exists by using upsert

```js
db.leaderboard.updateOne(
  { playerId: "player-42" },
  {
    $max: { highScore: 9850 },
    $min: { bestTime: 125.4 },
    $set: { lastPlayedAt: new Date() },
    $setOnInsert: { playerId: "player-42", createdAt: new Date() }
  },
  { upsert: true }
);
```

### Exercise 5 — Sequence Generator with findOneAndUpdate

Implement a general-purpose auto-increment counter service using `findOneAndUpdate()` with upsert. Then use it to generate sequential invoice numbers.

```js
// Counter service
async function nextId(counterName) {
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: counterName },
    { $inc: { value: 1 } },
    {
      upsert: true,
      returnDocument: "after",
      projection: { value: 1, _id: 0 }
    }
  );
  return result.value;
}

// Use it
const invoiceNum = await nextId("invoices");
await db.collection("invoices").insertOne({
  invoiceNumber: `INV-${String(invoiceNum).padStart(6, "0")}`,
  customerId: "CUST-001",
  total: 299.99,
  issuedAt: new Date()
});
```

---

## 9. Interview Q&A

**Q1: What is the difference between updateOne() and replaceOne()?**
`updateOne()` uses update operators (`$set`, `$inc`, etc.) to modify specific fields while leaving the rest untouched. `replaceOne()` replaces the entire document content with the provided replacement, keeping only the `_id`. Use `updateOne()` for partial updates and `replaceOne()` when you have the complete new document state.

**Q2: What does $set do when the field does not exist?**
`$set` creates the field if it does not exist. This is one of MongoDB's key conveniences — you do not need to know whether a field exists before setting it. Contrast with `$inc`, which also creates the field with a default of 0 before incrementing if it does not exist.

**Q3: When would you use $addToSet instead of $push?**
Use `$addToSet` when the array should behave like a mathematical set — no duplicates allowed. It only adds the element if it is not already present. Use `$push` when duplicates are acceptable (e.g., an append-only event log). `$addToSet` is slightly more expensive because MongoDB must check membership first.

**Q4: What is an upsert and when is it useful?**
An upsert is `updateOne()` or `updateMany()` with `{ upsert: true }`. If the filter matches a document, it updates normally. If no document matches, it inserts a new document derived from the filter + update operators. It is useful for idempotent sync operations ("create if not exists, update if exists") and avoids a separate read-then-write pattern.

**Q5: Explain arrayFilters and why they are needed.**
`arrayFilters` lets you target specific elements within an array of sub-documents based on a condition. Without them, you can only update the first matching element (using `$`) or all elements (using `$[]`). With `arrayFilters`, you define a named identifier (e.g., `$[item]`) and a filter condition (e.g., `{ "item.status": "processing" }`), and only matching elements are updated. This is essential for updating nested arrays without knowing element positions.

**Q6: What does returnDocument: "after" do in findOneAndUpdate()?**
By default, `findOneAndUpdate()` returns the document as it looked before the update (`"before"`). Setting `returnDocument: "after"` returns the document reflecting the applied changes. This is useful when you need to confirm the new state — for example, showing a user their updated profile or returning a new sequence number to a caller.

**Q7: What is the difference between $min/$max and $set for numeric fields?**
`$set` unconditionally overwrites the field with the given value. `$min` only updates the field if the new value is less than the current value; `$max` only updates if the new value is greater. This makes `$min`/`$max` ideal for maintaining extremes (lowest price seen, highest score, fastest time) without requiring a read-before-write pattern.

**Q8: How does $currentDate differ from $set with new Date()?**
`$set: { updatedAt: new Date() }` sets the timestamp at the application layer — the time when the driver constructs the message. `$currentDate` sets the timestamp at the server layer — the time when MongoDB applies the write. On high-latency connections or bulk operations, there can be meaningful differences. `$currentDate` is more accurate for server-side audit timestamps.

**Q9: What happens if updateMany() fails halfway through?**
`updateMany()` is NOT atomic across multiple documents. If the server crashes or the operation is interrupted, some documents may be updated and others not. There is no automatic rollback. For multi-document atomicity, you must use multi-document transactions with a session.

**Q10: Can $pull remove multiple elements at once?**
Yes. `$pull` removes ALL array elements that match the condition, not just the first. For example, `{ $pull: { tags: { $in: ["deprecated", "legacy"] } } }` removes every element in `tags` that is either "deprecated" or "legacy". This is different from `$pop`, which only removes one element (the first or last).

**Q11: What is $setOnInsert and why is it useful?**
`$setOnInsert` only executes when the operation results in an insert (not when it updates an existing document). It is used with upserts to set fields like `createdAt` that should be set once at creation and never overwritten on subsequent updates. Without it, using `$set` for `createdAt` would overwrite the creation timestamp every time the document is updated.

**Q12: What is the positional operator $ in updates?**
The `$` operator is a placeholder for the first array element that matched the query filter. For example, `db.posts.updateOne({ "comments.author": "Bob" }, { $set: { "comments.$.approved": true } })` sets `approved: true` on the first comment where `author` is "Bob". It only works one level deep and only updates the first matching element.

**Q13: How do $push with $slice work together?**
`$push` with the `$slice` modifier appends elements and then trims the array to a specified size. A positive slice value keeps the first N elements; a negative value keeps the last N elements. This is useful for implementing capped arrays — for example, keeping only the 50 most recent notifications or the 10 latest audit log entries per document.

**Q14: What is the difference between updateOne() and findOneAndUpdate() in terms of atomicity?**
Both are atomic at the document level — they either fully apply or don't. The difference is not atomicity but **what is returned**. `updateOne()` returns only the operation result metadata (matchedCount, modifiedCount). `findOneAndUpdate()` returns the document itself (before or after the update). For read-modify-write patterns, `findOneAndUpdate()` saves a second round-trip query.

**Q15: How do you increment a field that may not exist yet?**
`$inc` handles this gracefully. If the field does not exist, MongoDB treats its current value as 0 and applies the increment. So `{ $inc: { views: 1 } }` creates `views: 1` if the field was absent. You do not need to use `$set` to initialise the field first.
