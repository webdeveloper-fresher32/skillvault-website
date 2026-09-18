# MongoDB Phase 02 — Read & Query Operations

## Table of Contents

1. [Overview of Read Operations](#1-overview-of-read-operations)
2. [find() vs findOne()](#2-find-vs-findone)
3. [Projection — Shaping the Output](#3-projection)
4. [Dot Notation for Nested Fields](#4-dot-notation-for-nested-fields)
5. [Querying Arrays](#5-querying-arrays)
6. [Cursor Methods](#6-cursor-methods)
7. [explain() Basics](#7-explain-basics)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Overview of Read Operations

Say you've got a collection of a million users, and your app just needs to show the ones with `status: "active"`. Do you really want MongoDB to open every single document and check? For a handful of documents, sure, nobody would notice. For a million, that's the difference between an instant response and a page that hangs.

That's the whole problem a **read operation** has to solve: given a filter, find the matching documents as cheaply as possible. Every read goes through MongoDB's **query planner**, whose entire job is picking the fastest route to the answer — an index scan when it can, a full collection scan when it has no other choice.

---

### Real-world analogy

`find()` behaves like the index at the back of a textbook. Flip to the index, look up "MongoDB," and it tells you exactly which pages to turn to (that's an **IXSCAN** — index scan). Without an index, you're stuck reading the book cover to cover, page by page, checking each one for the word "MongoDB" (that's a **COLLSCAN** — collection scan). Fine for a 10-page pamphlet. Miserable for a 10,000-page encyclopedia.

---

### What's actually happening when you call find()

```
Application
     │
     │  find({ status: "active" })
     ▼
┌──────────────────────────────────────────────────────┐
│                   mongod Server                      │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │             Query Planner                      │  │
│  │   1. Parse filter + projection                 │  │
│  │   2. Enumerate candidate plans                 │  │
│  │   3. Select winning plan (index if available)  │  │
│  └────────────────────────────┬───────────────────┘  │
│                               │                      │
│  ┌────────────────────────────▼───────────────────┐  │
│  │             Query Executor                     │  │
│  │   IXSCAN (index scan)  OR  COLLSCAN            │  │
│  │   Apply projection                             │  │
│  │   Return cursor                                │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
     │
     ▼
  Cursor (lazy — batches of 101 docs by default)
```

Notice the result isn't "all your documents shipped over the wire at once" — it's a **cursor**, a lazy pointer to the results. We'll come back to why that matters in Section 6.

> **Memory hook:** "find() is the book's index — explain() (Section 7) is how you check whether MongoDB actually used it."

---

## 2. find() vs findOne()

### Syntax

```js
// find() — returns a Cursor
db.collection.find(
  <filter>,       // query filter document (optional, default: {})
  <projection>    // projection document (optional)
)

// findOne() — returns a single document or null
db.collection.findOne(
  <filter>,
  <projection>
)
```

The question to ask yourself before picking one: *am I expecting one document, or potentially many?* Looking something up by `_id`? You already know there's at most one match — `findOne()` says that intent out loud and hands you the document directly, no cursor unwrapping needed. Expecting a list — all active users, all products in a category? `find()` is the one built for that.

### Key Differences

| Feature           | find()                           | findOne()                        |
|-------------------|----------------------------------|----------------------------------|
| Returns           | Cursor (lazy iterator)           | Document or null                 |
| When no match     | Empty cursor                     | null                             |
| Limit             | No built-in limit (use .limit()) | Implicitly limit 1               |
| Use case          | Multiple documents               | Single lookup (by _id, etc.)     |
| Memory            | Streams in batches               | Loads one document into memory   |

### find() — All Documents

```js
// Return ALL documents in collection (use with care on large collections!)
db.users.find();

// With filter
db.users.find({ status: "active" });

// With filter and projection (show only name, email; hide _id)
db.users.find({ status: "active" }, { name: 1, email: 1, _id: 0 });
```

### findOne() — First Match

```js
// Find by _id (most common pattern)
db.users.findOne({ _id: ObjectId("64a1f3b2e4b0c12345678901") });

// Find first user from Sydney
const user = db.users.findOne({ "address.city": "Sydney" });
if (user) {
  console.log(user.name);
} else {
  console.log("Not found");
}
```

---

### Comparison Operators in Filters

An equality filter like `{ category: "Electronics" }` only gets you so far. The moment you need "greater than," "one of these," or "not this," you reach for comparison operators:

```js
// Equality
db.products.find({ category: "Electronics" });

// Comparison
db.products.find({ price: { $gt: 100 } });          // price > 100
db.products.find({ price: { $gte: 100 } });         // price >= 100
db.products.find({ price: { $lt: 500 } });          // price < 500
db.products.find({ price: { $lte: 500 } });         // price <= 500
db.products.find({ price: { $ne: 0 } });            // price != 0

// Range (between 100 and 500)
db.products.find({ price: { $gte: 100, $lte: 500 } });

// In / Not In
db.products.find({ category: { $in: ["Electronics", "Computers"] } });
db.products.find({ status:   { $nin: ["discontinued", "draft"] } });
```

### Logical Operators

Sometimes one field's condition isn't enough — you need to combine several. That's what the logical operators are for:

```js
// AND (implicit — multiple fields in same filter object)
db.products.find({ category: "Electronics", inStock: true });

// AND (explicit)
db.products.find({
  $and: [
    { price: { $gte: 100 } },
    { price: { $lte: 500 } }
  ]
});

// OR
db.products.find({
  $or: [
    { category: "Electronics" },
    { category: "Computers" }
  ]
});

// NOR — neither condition is true
db.products.find({
  $nor: [
    { inStock: false },
    { discontinued: true }
  ]
});

// NOT
db.products.find({ price: { $not: { $gt: 1000 } } });
```

### Element Operators

```js
// Field exists
db.users.find({ phone: { $exists: true } });
db.users.find({ phone: { $exists: false } });

// Field is a specific BSON type
db.users.find({ age: { $type: "number" } });
db.users.find({ age: { $type: ["number", "string"] } }); // multiple types
```

### Regex Queries

```js
// Case-insensitive search on name
db.users.find({ name: { $regex: /^alice/i } });

// Contains "mongo" anywhere (inefficient without a text index)
db.articles.find({ title: { $regex: /mongo/i } });
```

Worth flagging early: that second regex — matching "mongo" *anywhere* in the string — can't use a normal index efficiently (there's no way to build a sorted index entry for "contains this substring at any position"). If you're doing this kind of search often, you want a text index, not a plain regex scan.

---

## 3. Projection

Here's a question worth asking every time you write a query: does your application actually need the *entire* document back, or just two or three fields off it? If a user document carries a `bio`, a `preferences` blob, and a `passwordHash`, and all your login page needs is `name` and `email`, why drag the rest of it across the network?

That's the problem **projection** solves — it controls *which fields* MongoDB returns, so you're not paying for bytes you'll never use.

### Inclusion Projection (1 = include)

```js
// Return ONLY name, email, status. _id is included by default.
db.users.find({}, { name: 1, email: 1, status: 1 });

// Return ONLY name and email, suppress _id
db.users.find({}, { name: 1, email: 1, _id: 0 });
```

### Exclusion Projection (0 = exclude)

```js
// Return everything EXCEPT password and __v
db.users.find({}, { password: 0, __v: 0 });
```

---

### The _id special rule

Here's the part that trips up almost everyone the first time: you can't mix `1`s and `0`s in the same projection. Pick a lane — either say what you *want* (inclusion) or say what you *don't want* (exclusion). MongoDB won't let you say "give me `name`, but not `password`" in one projection, because that's ambiguous about every other field you didn't mention.

Except for one field: `_id`. It's included automatically whether you ask for it or not, and it's the one field allowed to break the "no mixing" rule — you can always bolt `_id: 0` onto an otherwise pure inclusion projection to suppress it.

```
┌────────────────────────────────────────────────────────────┐
│  _id is INCLUDED by default in every projection            │
│  You must EXPLICITLY set _id: 0 to suppress it             │
│                                                            │
│  Exception: you CANNOT mix include and exclude in the      │
│  same projection EXCEPT for _id                             │
│                                                            │
│  Valid:   { name: 1, email: 1 }           (include only)   │
│  Valid:   { password: 0, secret: 0 }      (exclude only)   │
│  Valid:   { name: 1, email: 1, _id: 0 }   (_id exception)  │
│  INVALID: { name: 1, password: 0 }        (mixed)          │
└────────────────────────────────────────────────────────────┘
```

**Common mistake:** writing `{ name: 1, password: 0 }` expecting "give me name, and definitely not password." MongoDB rejects this outright — it's a mixed projection, and `_id` is the only field exempt from the rule. If you want just `name`, write `{ name: 1, _id: 0 }` instead.

**Interview answer:** "MongoDB projections are either inclusion-style or exclusion-style, and you can't combine the two in a single projection document — except for `_id`, which is included by default and can always be explicitly excluded regardless of whether the rest of the projection is inclusion or exclusion. Trying to mix, say, `{ name: 1, password: 0 }`, throws an error because it's unclear whether every other unmentioned field should be included or excluded."

> **Memory hook:** "Pick include-only or exclude-only — `_id` is the one guest allowed to leave the party either way."

### Projection on Nested Fields

```js
// Only return the city inside the address sub-document
db.users.find({}, { "address.city": 1, name: 1, _id: 0 });

// Exclude only the street from address (return all other address fields)
db.users.find({}, { "address.street": 0 });
```

### Array Projection Operators

Sometimes you don't want to shape which *fields* come back — you want to shape which *array elements* come back. That's what `$slice` and the positional `$` are for:

```js
// $slice — return first 3 elements of 'comments' array
db.posts.find({}, { title: 1, comments: { $slice: 3 } });

// $slice — return last 2 elements
db.posts.find({}, { title: 1, comments: { $slice: -2 } });

// $slice — skip 5, return next 3
db.posts.find({}, { title: 1, comments: { $slice: [5, 3] } });

// $ positional — return the first matching array element
db.products.find(
  { "reviews.rating": { $gte: 4 } },
  { "reviews.$": 1 }
);
```

---

## 4. Dot Notation for Nested Fields

You've embedded a sub-document — say, an `address` object inside a `user` document. Now you need to query "give me every user in Sydney." The address isn't a top-level field, it's nested one level down. How do you even point at `city` inside `address`?

MongoDB's answer is **dot notation**: write the path as a string, `"address.city"`, and MongoDB reaches straight into the embedded document (or array) for you.

### Querying Embedded Documents

```js
// Sample document structure:
{
  _id: 1,
  name: "Alice",
  address: {
    street: "42 Maple Ave",
    city: "Sydney",
    state: "NSW",
    postcode: "2000"
  },
  employer: {
    company: "Acme Corp",
    role: "Engineer",
    since: 2021
  }
}

// Query on nested field — use quotes around dot-notation key
db.users.find({ "address.city": "Sydney" });
db.users.find({ "address.postcode": "2000", "employer.role": "Engineer" });

// Deep nesting
db.users.find({ "employer.address.suburb": "Pyrmont" });
```

### Projection with Dot Notation

```js
// Return name and city only
db.users.find(
  { "address.city": "Sydney" },
  { name: 1, "address.city": 1, _id: 0 }
);

// Result:
// { name: "Alice", address: { city: "Sydney" } }
// Note: the full address sub-document is NOT returned — only 'city' inside it
```

---

### Exact sub-document match vs. dot-notation field match

Here's a gotcha that catches almost everyone at least once: `{ address: {...} }` and `{ "address.city": ... }` look like they should do the same thing. They don't — and the difference can quietly break a query that looked perfectly reasonable.

```js
// EXACT sub-document match — requires ALL fields in exact order
db.users.find({
  address: { street: "42 Maple Ave", city: "Sydney", state: "NSW", postcode: "2000" }
});
// This ONLY matches if address has exactly these 4 fields in exactly this order.

// DOT NOTATION field match — flexible, recommended
db.users.find({ "address.city": "Sydney" });
// Matches any document where address.city is "Sydney" regardless of other fields.
```

| | `{ address: {...} }` | `{ "address.city": "Sydney" }` |
|---|---|---|
| Matches on | The *entire* sub-document, as one BSON value | Just the one nested field |
| Field order | Must match exactly | Irrelevant |
| Extra/missing fields | Breaks the match | No effect |
| Typical use | Rare — you know the whole shape and want an exact equality check | The normal, everyday way to query nested data |

**Common mistake:** writing `{ address: { city: "Sydney" } }` expecting "any user whose address city is Sydney" — and getting zero results back, because that query actually means "address is an object with *only* a `city` field, nothing else." The instinct to write it that way is natural (it mirrors how the document looks), but it's asking for an exact whole-object match, not a field-level match.

**Interview answer:** "Matching on a bare embedded field name, like `{ address: {...} }`, tells MongoDB to compare the entire sub-document as a single BSON value — every field has to be present, with the same values, in the same key order. Dot notation, like `{ 'address.city': 'Sydney' }`, instead reaches into the sub-document and compares just that one field, ignoring everything else in it. In practice you almost always want dot notation, because exact whole-document matches are brittle — any extra field or different key order breaks them."

> **Memory hook:** "Matching the whole folder vs. matching one page inside it — dot notation only cares about the page."

---

## 5. Querying Arrays

Arrays are first-class citizens in MongoDB — a document field can just *be* a list, and the query engine has a several different strategies for matching into it, depending on what exactly you mean by "match."

### Sample Documents

```js
db.posts.insertMany([
  { _id: 1, title: "Intro to MongoDB", tags: ["mongodb", "nosql", "database"] },
  { _id: 2, title: "SQL vs NoSQL",     tags: ["nosql", "sql", "comparison"] },
  { _id: 3, title: "MongoDB Indexes",  tags: ["mongodb", "performance"] },
  { _id: 4, title: "Node.js Guide",    tags: ["nodejs", "javascript"] }
]);
```

### Exact Array Match

```js
// Matches ONLY documents where tags is EXACTLY ["mongodb", "nosql", "database"]
// — same elements, same order
db.posts.find({ tags: ["mongodb", "nosql", "database"] });
```

### Element Match (contains)

```js
// Matches documents where tags array CONTAINS "mongodb" (anywhere in array)
db.posts.find({ tags: "mongodb" });
// Returns docs 1 and 3

// Using $in — matches if array contains ANY of these values
db.posts.find({ tags: { $in: ["mongodb", "sql"] } });
// Returns docs 1, 2, 3

// Using $all — array must contain ALL of these values (any order)
db.posts.find({ tags: { $all: ["mongodb", "nosql"] } });
// Returns doc 1 only
```

| Query | Meaning | Logical shape |
|---|---|---|
| `{ tags: "mongodb" }` | array contains this one value | equality/contains |
| `{ tags: { $in: [...] } }` | array contains *any* of these values | OR |
| `{ tags: { $all: [...] } }` | array contains *all* of these values (any order) | AND |
| `{ tags: [...] }` | array *is exactly* this list, in this order | strict equality |

---

### $elemMatch — matching conditions against a single array element

Here's the trap. Say you're querying orders, and each order has an `items` array of `{ sku, qty, price }` sub-documents. You want "orders with an item where qty > 5 AND price > 10." So naturally, you write:

```js
db.orders.insertMany([
  {
    _id: 1,
    items: [
      { sku: "A", qty: 10, price: 5  },
      { sku: "B", qty: 3,  price: 20 }
    ]
  },
  {
    _id: 2,
    items: [
      { sku: "A", qty: 5,  price: 15 },
      { sku: "C", qty: 10, price: 8  }
    ]
  }
]);

// WITHOUT $elemMatch — conditions can be satisfied by DIFFERENT array elements
db.orders.find({ "items.qty": { $gt: 5 }, "items.price": { $gt: 10 } });
```

This looks right, but it isn't asking what you think. Dot notation on an array field doesn't pin both conditions to the *same* element — it just asks "does *some* element satisfy `qty > 5`?" and, separately, "does *some* element satisfy `price > 10`?" They're allowed to be different elements entirely.

Trace it through: in doc 1, `items[0]` has `qty=10` (satisfies `qty > 5`), and `items[1]` has `price=20` (satisfies `price > 10`) — two different elements, each covering one condition. In doc 2, `items[0]` has `price=15` (satisfies `price > 10`), and `items[1]` has `qty=10` (satisfies `qty > 5`) — again, two different elements. So the query above returns **both** documents, even though neither one actually has a single item that is both high-quantity *and* high-price.

That's the bug. Here's the fix — `$elemMatch` forces both conditions onto one and the same array element:

```js
// WITH $elemMatch — SINGLE element must satisfy ALL conditions
db.orders.find({
  items: { $elemMatch: { qty: { $gt: 5 }, price: { $gt: 10 } } }
});
```

Now check each document against *this* rule — does any one item have `qty > 5` and `price > 10` at the same time? Doc 1: `items[0]` is `qty=10, price=5` (qty passes, price fails), `items[1]` is `qty=3, price=20` (qty fails, price passes) — no single item passes both. Doc 2: `items[0]` is `qty=5, price=15` (qty fails — 5 is not > 5), `items[1]` is `qty=10, price=8` (qty passes, price fails) — no single item passes both. So this query correctly returns **neither** document, because no order actually has one item satisfying both conditions at once.

**What's actually happening internally:**

```
Without $elemMatch:
  "items.qty" > 5      →  scan array, ANY element matching?  (independent check)
  "items.price" > 10   →  scan array, ANY element matching?  (independent check)
  Document matches if BOTH checks pass — regardless of which elements passed them

With $elemMatch:
  For each element in items:
      does THIS element satisfy qty > 5 AND price > 10?
  Document matches only if ONE element passes the combined check
```

**Common mistake:** assuming `{ "items.qty": {$gt:5}, "items.price": {$gt:10} }` is equivalent to `$elemMatch` because "they're both querying the items array." They are not equivalent — the plain dot-notation version lets each condition be satisfied by a different array element, which silently produces false positives whenever an array has more than one sub-document.

**Interview answer:** "`$elemMatch` is needed whenever you're filtering on an array of sub-documents and multiple conditions need to hold on the *same* element. Without it, MongoDB checks each condition independently against the whole array — so a document can match even if no single element satisfies every condition, because different elements each satisfy a different condition. `$elemMatch` fixes that by requiring one element to pass the entire embedded condition set at once."

> **Memory hook:** "Plain dot notation asks 'does anyone in the room wear a hat AND does anyone wear glasses' — `$elemMatch` asks 'is there one person wearing both.'"

### Array Size Query

```js
// Documents where tags array has exactly 3 elements
db.posts.find({ tags: { $size: 3 } });

// Greater than 2 elements — $size does not support ranges, use this workaround:
db.posts.find({ "tags.2": { $exists: true } }); // index 2 exists => at least 3 elements
```

### Querying by Array Index

```js
// Match documents where the FIRST tag (index 0) is "mongodb"
db.posts.find({ "tags.0": "mongodb" });
```

---

## 6. Cursor Methods

`find()` doesn't hand you an array — it hands you a **cursor**, a pointer to the result set sitting on the server. Why does that matter? Because if your query matches a million documents, MongoDB isn't going to try to shove a million documents down the wire in one go — it fetches them lazily, in batches (101 documents in the first batch, then up to 4MB chunks after that). Cursor methods are how you tell it to sort, skip, or cap those results before they're returned.

### Cursor Method Chain

```
db.collection.find(<filter>)
  .sort(<sortSpec>)
  .skip(<n>)
  .limit(<n>)
  .projection(<projection>)   // alternative to passing as 2nd arg
  .toArray()                  // or .forEach() or iterate
```

### sort()

```js
// Ascending (1), Descending (-1)
db.products.find().sort({ price: 1 });             // cheapest first
db.products.find().sort({ price: -1 });            // most expensive first

// Multi-field sort — primary sort by category, secondary by price
db.products.find().sort({ category: 1, price: -1 });
```

### limit()

```js
// Return at most 10 documents
db.products.find({ inStock: true }).sort({ price: 1 }).limit(10);
```

### skip()

```js
// Skip the first 20 documents (pagination)
db.products.find().sort({ name: 1 }).skip(20).limit(10);
```

---

### Pagination — and why skip() eventually breaks down

Building a "Page 2, Page 3..." UI seems like the most natural thing in the world to reach for `skip()` and `limit()`:

```
Page 1: skip(0).limit(10)
Page 2: skip(10).limit(10)
Page 3: skip(20).limit(10)
Page N: skip((N-1)*10).limit(10)
```

This works fine — right up until your collection gets big and someone requests page 5,000. Why would that be a problem? Because `skip(n)` isn't a teleport. MongoDB still has to walk through and discard every one of those `n` documents before it can start returning the ones you actually want.

```
skip(49990).limit(10)
        │
        ▼
Walk past documents 1 → 49990, discarding each one
        │
        ▼
Only NOW start collecting the next 10 to return
```

That's O(n) work for a result you only wanted 10 rows from — and it gets slower, page after page, the deeper a user pages in.

**The fix:** cursor-based (a.k.a. keyset) pagination. Instead of counting "skip this many rows," you remember the last document you *saw* — usually its `_id`, since ObjectIds sort by insertion time — and ask for "everything after that one":

```js
WARNING: skip() is O(n) — it scans and discards. For large collections,
use range-based pagination with _id or a timestamp field instead:

// Efficient cursor-based pagination
db.events.find({ _id: { $gt: lastSeenId } }).sort({ _id: 1 }).limit(10);
```

| | skip()/limit() pagination | Cursor-based (keyset) pagination |
|---|---|---|
| How it locates the page | Counts and discards `n` documents | Jumps straight to `_id > lastSeenId` via the index |
| Cost as pages get deeper | Grows linearly — gets slower | Stays constant |
| Supports "jump to page 500" | Yes | Not directly — only "next"/"previous" |
| Best for | Small collections, admin UIs with page numbers | Infinite scroll, APIs, large collections |

**Common mistake:** reaching for `skip()`/`limit()` on a collection you expect to grow into the millions, because it's the first pagination pattern everyone learns. It's fine for small collections and for the first handful of pages — the trouble only shows up once users (or bots) page deep enough that the discarded prefix becomes large.

**Interview answer:** "`skip(n)` is O(n) — MongoDB has to walk past and discard `n` documents before it can return anything, so performance degrades as users page deeper into a large result set. The scalable alternative is cursor-based, or keyset, pagination: instead of counting rows to skip, you remember the last document's `_id` (or a timestamp) from the previous page and query for documents greater than that value, sorted the same way. That turns an O(n) skip into an efficient indexed range query, at the cost of not being able to jump arbitrarily to 'page 500' directly."

> **Memory hook:** "skip() is walking down every aisle in the shop before reaching yours — keyset pagination is walking straight to where you left off."

### count() / countDocuments()

```js
// countDocuments() — accurate count using the query (recommended)
db.users.countDocuments({ status: "active" });

// estimatedDocumentCount() — uses collection metadata, very fast but approximate
db.users.estimatedDocumentCount();

// Deprecated: db.users.count() — do not use in new code
```

### toArray()

```js
// Materialise all cursor results into an in-memory array
const results = await db.collection("products").find({ inStock: true }).toArray();
console.log(results.length);
```

### forEach()

```js
// Process each document without loading all into memory at once
db.collection("logs").find({ level: "ERROR" }).forEach(doc => {
  console.log(doc.message);
});
```

### Cursor Flow Diagram

```
Server Side                              Client Side
─────────────────────────────────────    ─────────────────────────
┌────────────────────────────────┐       ┌──────────────────────┐
│  Collection / Index            │       │  Application Code    │
│                                │       │                      │
│  Cursor maintained on server   │       │  cursor = find(...)  │
│  (default 10 min timeout)      │◄─────►│  cursor.next()       │
│                                │       │  cursor.toArray()    │
│  Batch 1: 101 docs ──────────► │       │  cursor.forEach()    │
│  Batch 2: up to 4MB ─────────► │       │                      │
└────────────────────────────────┘       └──────────────────────┘

noCursorTimeout() — prevents the 10-min server cursor timeout
                    for long-running ETL operations
```

### noCursorTimeout

```js
// For long-running batch processing
const cursor = db.collection("bigData").find({}).noCursorTimeout();
// Remember to manually close the cursor when done:
cursor.close();
```

---

## 7. explain() Basics

You've written a query. It works. But is it *fast*, or did it just get lucky on a small test collection? You can't tell that just by looking at the query — you need to ask MongoDB to show its work. That's what `explain()` is for: it reveals the **query execution plan** — which index (if any) was used, how many documents were scanned versus returned, and how long it actually took.

### Usage

```js
// Default verbosity — "queryPlanner"
db.users.find({ status: "active" }).explain();

// "executionStats" — includes actual execution counts and timings
db.users.find({ status: "active" }).explain("executionStats");

// "allPlansExecution" — shows all candidate plans considered
db.users.find({ status: "active" }).explain("allPlansExecution");
```

### Key Fields to Read

```js
// executionStats output (simplified)
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "IXSCAN",              // ← GOOD: index scan
      "indexName": "status_1"
    }
  },
  "executionStats": {
    "nReturned": 150,                 // documents returned to client
    "totalKeysExamined": 150,         // index keys scanned
    "totalDocsExamined": 150,         // documents fetched from collection
    "executionTimeMillis": 2          // total query time
  }
}
```

---

### IXSCAN vs. COLLSCAN

The single most important thing `explain()` tells you is which of these two stages won:

```
┌──────────────────────────────────────────────────────────────────┐
│  COLLSCAN (Collection Scan) — BAD for large collections          │
│                                                                  │
│  stage: "COLLSCAN"                                               │
│  totalDocsExamined: 1,000,000   ← scanned entire collection     │
│  nReturned: 150                 ← returned only 150             │
│  executionTimeMillis: 850       ← slow!                          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  IXSCAN (Index Scan) — GOOD                                      │
│                                                                  │
│  stage: "IXSCAN"                                                 │
│  totalKeysExamined: 152         ← scanned 152 index entries      │
│  totalDocsExamined: 150         ← fetched 150 documents          │
│  nReturned: 150                 ← returned 150                   │
│  executionTimeMillis: 2         ← fast!                          │
└──────────────────────────────────────────────────────────────────┘
```

The number to watch is `nReturned` versus `totalDocsExamined`. In the COLLSCAN case, MongoDB opened a million documents to hand back 150 — that ratio (150 / 1,000,000) is the smoking gun that something needs an index. In the IXSCAN case, that ratio is close to 1 — barely any wasted work.

**Common mistake:** adding an index and never actually checking `explain()` again to confirm it got picked up. Indexes don't help if the query planner doesn't choose them — mismatched field order in a compound index, or a query shape the index doesn't cover, can leave you silently back on COLLSCAN even after you've "added an index."

**Interview answer:** "`explain('executionStats')` shows whether a query used an index scan (IXSCAN) or a full collection scan (COLLSCAN), plus how many documents and index keys were examined versus how many were actually returned. A COLLSCAN with a low `nReturned`-to-`totalDocsExamined` ratio on a large collection is the classic sign of a missing index — MongoDB is opening far more documents than it needs to in order to find a small number of matches."

> **Memory hook:** "COLLSCAN reads every page of the book; IXSCAN checks the index first — explain() tells you which one just happened."

### Covered Query

A **covered query** takes this idea one step further: if every field in the filter *and* the projection is already present in a single index, MongoDB doesn't need to open the actual document at all — it can answer entirely out of the index.

```js
// Index: { email: 1, name: 1 }
// Query only touches index — "covered"
db.users.find(
  { email: "alice@example.com" },
  { name: 1, email: 1, _id: 0 }         // _id: 0 is required for covered query
);
// executionStats.totalDocsExamined: 0   ← pure index read!
```

Notice the `_id: 0` — this is the same projection rule from Section 3, applied here for a reason: `_id` isn't in this index, so unless you explicitly exclude it from the projection, MongoDB has to fetch the actual document just to get `_id`, and the query stops being covered.

> **Memory hook:** "A covered query never opens the book — the index itself already has every answer you asked for."

---

## 8. Hands-On Exercises

### Exercise 1 — E-commerce Product Search

Given a `products` collection with fields `name`, `price`, `category`, `inStock`, `tags`, and `ratings` (array of numbers), write queries to:
- Find all Electronics under $500 that are in stock
- Find products tagged with both "portable" and "wireless"
- Find the top 5 most expensive products, returning only name and price

```js
// 1. Electronics under $500, in stock
db.products.find({ category: "Electronics", price: { $lt: 500 }, inStock: true });

// 2. Tagged with both "portable" AND "wireless"
db.products.find({ tags: { $all: ["portable", "wireless"] } });

// 3. Top 5 most expensive — name and price only
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: -1 }).limit(5);
```

### Exercise 2 — Pagination

Implement page-based pagination for a `news` collection sorted by `publishedAt` descending. Page size is 20.

```js
function getPage(pageNumber) {
  return db.news
    .find({ status: "published" }, { title: 1, publishedAt: 1, author: 1, _id: 0 })
    .sort({ publishedAt: -1 })
    .skip((pageNumber - 1) * 20)
    .limit(20)
    .toArray();
}

// Page 1
getPage(1);
// Page 3
getPage(3);
```

### Exercise 3 — Nested Document Queries

Given a `employees` collection where each document has an `address.city`, `skills` (array), and `salary`, find:
- All employees in "Melbourne" earning over $90,000
- Employees who have "Python" in their skills array
- Employees whose first skill (index 0) is "JavaScript"

```js
db.employees.find({ "address.city": "Melbourne", salary: { $gt: 90000 } });
db.employees.find({ skills: "Python" });
db.employees.find({ "skills.0": "JavaScript" });
```

### Exercise 4 — $elemMatch on Embedded Arrays

A `students` collection has a `grades` array of `{ subject, score }` objects. Find all students who have a score above 85 in "Mathematics" specifically (not just 85+ in any subject AND having Mathematics).

```js
db.students.find({
  grades: {
    $elemMatch: {
      subject: "Mathematics",
      score: { $gt: 85 }
    }
  }
});
```

### Exercise 5 — explain() Analysis

Run the following query and check the explain output. Then create an index to turn the COLLSCAN into an IXSCAN and verify with explain().

```js
// Step 1: run explain before index
db.orders.find({ status: "pending", total: { $gt: 100 } }).explain("executionStats");
// Note: stage is COLLSCAN

// Step 2: create compound index
db.orders.createIndex({ status: 1, total: 1 });

// Step 3: run explain after index
db.orders.find({ status: "pending", total: { $gt: 100 } }).explain("executionStats");
// Note: stage is now IXSCAN, totalDocsExamined drops dramatically
```

---

## 9. Interview Q&A

**Q1: What is the difference between find() and findOne()?**
`find()` returns a Cursor that lazily iterates over all matching documents in batches. `findOne()` returns the first matching document directly (or null), equivalent to `find().limit(1)` but more convenient for single-document lookups. Use `findOne()` for lookups by `_id` or unique fields; use `find()` when you expect multiple results.

**Q2: What is a cursor in MongoDB and why is it lazy?**
A cursor is a server-side pointer to the query result set. It is lazy because documents are not all sent to the client immediately — they are fetched in batches (first batch: 101 docs, subsequent batches: up to 4MB). This prevents memory exhaustion when queries match millions of documents. The cursor is held on the server for 10 minutes by default.

**Q3: Can you mix inclusion and exclusion in the same projection?**
No, with one exception. You cannot mix `field: 1` (include) and `field: 0` (exclude) in the same projection document. The only exception is `_id`, which can be explicitly set to 0 alongside an inclusion projection. Attempting to mix them results in a server error.

**Q4: What is the difference between querying `{ tags: "mongodb" }` and `{ tags: ["mongodb"] }` when tags is an array?**
`{ tags: "mongodb" }` matches any document where the `tags` array CONTAINS the element "mongodb" anywhere. `{ tags: ["mongodb"] }` matches documents where `tags` is EXACTLY the array `["mongodb"]` with only that single element. The dot notation / element approach is almost always what you want.

**Q5: Explain $elemMatch and when you must use it.**
`$elemMatch` is required when you need a single element within an array of sub-documents to satisfy multiple conditions simultaneously. Without it, MongoDB will satisfy the conditions across DIFFERENT elements in the array, producing false positives. For example, `{ items.qty: { $gt: 5 }, items.price: { $gt: 10 } }` can match a document where one item has qty > 5 and a completely different item has price > 10.

**Q6: How does skip() affect performance on large collections?**
`skip(n)` is O(n) — MongoDB must scan and discard `n` documents even if it never returns them to the client. For page 1000 with page size 20, MongoDB skips 19,980 documents. At scale, this becomes very slow. The solution is **cursor-based (keyset) pagination**: remember the last `_id` (or timestamp) seen and use `{ _id: { $gt: lastSeenId } }` instead of skip.

**Q7: What does explain("executionStats") tell you?**
It reveals: the winning query plan (IXSCAN vs COLLSCAN), which index was used, `nReturned` (documents returned), `totalKeysExamined` (index entries scanned), `totalDocsExamined` (collection documents fetched), and `executionTimeMillis` (total query time). The key ratio to watch is `nReturned / totalDocsExamined` — if it is much less than 1, you are scanning many documents to return few, indicating a missing or inefficient index.

**Q8: What is a covered query?**
A covered query is one where all fields referenced in the filter and projection are present in a single index. MongoDB can satisfy the query entirely from the index without ever fetching documents from the collection. This is the fastest possible query execution. Covered queries require `_id: 0` in the projection unless `_id` is part of the index.

**Q9: How do you query for documents where a field does NOT exist?**
Use `{ fieldName: { $exists: false } }`. This matches documents where `fieldName` is completely absent. Note this is different from `{ fieldName: null }`, which matches both documents where the field is null AND where the field does not exist.

**Q10: What is the default sort order in MongoDB?**
MongoDB does not guarantee any natural ordering unless you explicitly sort. The "natural order" (`$natural: 1`) is the on-disk insertion order, but this can change after updates or deletes. Always specify an explicit `.sort()` when order matters.

**Q11: How does dot notation work with arrays of sub-documents?**
Dot notation on an array field like `"items.price"` will match a document if ANY element in the `items` array has the specified `price` value. MongoDB automatically iterates through all array elements. For example, `{ "items.price": { $gt: 10 } }` matches if any item has price > 10.

**Q12: What is the difference between $in and $all for array fields?**
`$in` tests if a field value (or any array element) matches ANY of the given values — it is an OR condition. `$all` tests if an array field contains ALL of the given values — it is an AND condition. For example, `{ tags: { $in: ["a","b"] } }` matches docs with "a" or "b"; `{ tags: { $all: ["a","b"] } }` matches docs with both "a" and "b".

**Q13: How do you count documents matching a filter efficiently?**
Use `db.collection.countDocuments({ filter })`. For an approximate total count without a filter, use `estimatedDocumentCount()` which reads collection metadata instead of executing a query. Avoid the deprecated `count()` method in modern MongoDB drivers.

**Q14: What happens to a cursor if you don't iterate it?**
The server holds the cursor open for 10 minutes (default `cursorTimeoutMillis`). After that, MongoDB automatically closes it and frees server resources. If your processing takes longer, use `.noCursorTimeout()` on the cursor and explicitly close it when done.

**Q15: How do you efficiently find the 10 most recently inserted documents?**
Since ObjectId encodes the insertion timestamp, sort by `_id` descending: `db.collection.find().sort({ _id: -1 }).limit(10)`. This uses the default `_id` index and is extremely fast regardless of collection size. No separate `createdAt` field needed.
