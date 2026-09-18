# 03 — Embedding vs Referencing

> "Every schema decision in MongoDB reduces to one question: should this related data live inside the document, or should it live in a separate collection with a link?"

---

## Table of Contents

1. [The Core Tradeoff](#1-the-core-tradeoff)
2. [Embedding — Deep Dive](#2-embedding--deep-dive)
3. [Referencing — Deep Dive](#3-referencing--deep-dive)
4. [The Decision Tree](#4-the-decision-tree)
5. [$lookup — Performing Joins in MongoDB](#5-lookup--performing-joins-in-mongodb)
6. [Hybrid Approach](#6-hybrid-approach)
7. [Anti-Patterns to Avoid](#7-anti-patterns-to-avoid)
8. [Comparison Tables](#8-comparison-tables)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Core Tradeoff

You've seen the 8 schema design patterns in File 02, and more than a few of them — Extended Reference, Subset, Outlier — were really just different flavors of one underlying decision. Time to pull that decision out and look at it directly.

In a relational database, you don't get a choice: you normalise data into separate tables and JOIN them at query time, every time. MongoDB actually gives you a choice on every single relationship in your schema — embed it, or reference it.

```text
┌─────────────────────────────────────────────────────────────────┐
│                   The Fundamental Choice                        │
│                                                                 │
│   EMBED                           REFERENCE                     │
│   ──────                          ─────────                     │
│   Related data stored inside      Related data in its own       │
│   the parent document             collection; linked by _id     │
│                                                                 │
│   {                               // posts collection           │
│     _id: ...,                     { _id: "p1", title: "..." }  │
│     title: "My Post",                                           │
│     comments: [          VS.      // comments collection        │
│       { body: "Great!" }          { postId: "p1",              │
│     ]                               body: "Great!" }           │
│   }                                                             │
│                                                                 │
│   One read to get everything      Two reads (or $lookup)        │
│   Less flexible for updates       More flexible for updates     │
└─────────────────────────────────────────────────────────────────┘
```

There is no universally correct answer here — anyone who tells you "always embed" or "always reference" hasn't shipped a real schema. The right choice depends on:

1. **Cardinality** — how many related items exist?
2. **Access pattern** — are they always queried together?
3. **Update frequency** — how often does the related data change?
4. **Document size** — will embedding keep documents under a safe size?
5. **Atomicity needs** — must the parent and child update together?

Keep these five in your head — everything below is just working through what each one implies.

---

## 2. Embedding — Deep Dive

### 2.1 What Embedding Looks Like

```js
// A user with their address EMBEDDED
{
  _id: ObjectId("u1"),
  name: "Alice Nguyen",
  email: "alice@example.com",
  address: {
    street: "42 George St",
    city: "Sydney",
    state: "NSW",
    postcode: "2000",
    country: "AU"
  }
}

// A post with comments EMBEDDED (array of subdocuments)
{
  _id: ObjectId("p1"),
  title: "Getting Started",
  body: "...",
  tags: ["mongodb", "tutorial"],
  comments: [
    { _id: ObjectId("c1"), author: "Bob", body: "Great post!", ts: ISODate("2024-01-10") },
    { _id: ObjectId("c2"), author: "Eve", body: "Very helpful!", ts: ISODate("2024-01-11") }
  ]
}
```

### 2.2 Pros of Embedding

| Pro | Explanation |
|-----|-------------|
| Single document read | All data in one I/O operation; no JOIN needed |
| Atomic writes | Update parent + children in one `updateOne` — no transactions required |
| Data locality | Parent and children stored together on disk; fewer page faults |
| Simpler queries | No `$lookup`; no multi-collection coordination |
| Better read performance | Fewer round trips to the database |

### 2.3 Cons of Embedding

Nothing is free, though. The same properties that make embedding fast for reads make it awkward the moment the data doesn't behave the way you assumed it would:

| Con | Explanation |
|-----|-------------|
| Document growth | Arrays grow with each new child; may approach 16 MB limit |
| Data duplication | If the same subdocument is embedded in multiple parents, it must be updated in all of them |
| No independent queries | Hard to query children without knowing the parent |
| Write amplification | Updating a shared embedded value requires finding and updating every parent |
| Memory waste on partial reads | Loading a post just to count comments pulls the entire comments array |

### 2.4 When to Embed

```text
✓  The relationship is "contains" or "belongs exclusively to"
   Example: address belongs to one user, not shared

✓  The child data is always accessed with the parent
   Example: order line items are always shown with the order

✓  The number of children is small and bounded
   Example: a product has at most 5 images

✓  The child data rarely changes independently
   Example: historical order line items never change after placing

✓  You need atomic parent+child updates without transactions
   Example: post + its tags updated together

✓  Low cardinality one-to-few relationship
   Rule of thumb: safe to embed if N < ~100
```

### 2.5 Updating Embedded Documents

Once data lives inside an array, updating *one specific element* takes a bit more care than a flat field update. Here's the progression from fragile to safe:

```js
// Update a specific comment in an array (by index — fragile)
db.posts.updateOne(
  { _id: ObjectId("p1") },
  { $set: { "comments.0.body": "Updated comment text" } }
);

// Update by matching a field value inside the array (safer)
db.posts.updateOne(
  { _id: ObjectId("p1"), "comments._id": ObjectId("c1") },
  { $set: { "comments.$.body": "Updated comment text" } }
);

// Update ALL matching array elements with $[<identifier>] (arrayFilters)
db.posts.updateOne(
  { _id: ObjectId("p1") },
  { $set: { "comments.$[elem].flagged": true } },
  { arrayFilters: [{ "elem.author": "Bob" }] }
);

// Add a new comment to the array
db.posts.updateOne(
  { _id: ObjectId("p1") },
  { $push: { comments: { _id: ObjectId(), author: "Dave", body: "Me too!", ts: new Date() } } }
);

// Remove a specific comment
db.posts.updateOne(
  { _id: ObjectId("p1") },
  { $pull: { comments: { _id: ObjectId("c1") } } }
);
```

Notice why the index-based update (`comments.0.body`) is fragile: if a comment gets deleted or reordered, index `0` no longer points at the comment you think it does. Matching by `_id` with the positional `$` operator is almost always the safer habit.

---

## 3. Referencing — Deep Dive

### 3.1 What Referencing Looks Like

```js
// users collection
{ _id: ObjectId("u1"), name: "Alice Nguyen", email: "alice@example.com" }

// posts collection — references user by _id
{ _id: ObjectId("p1"), authorId: ObjectId("u1"), title: "My Post", body: "..." }

// comments collection — references post by _id
{ _id: ObjectId("c1"), postId: ObjectId("p1"), author: "Bob", body: "Great!" }
```

### 3.2 Pros of Referencing

| Pro | Explanation |
|-----|-------------|
| Normalised data | One source of truth; update in one place, reflected everywhere |
| Unbounded relationships | Collections can grow without hitting document size limits |
| Independent queries | Query comments without loading posts |
| Smaller documents | Parent documents stay lean; working set fits in RAM |
| Schema flexibility | Referenced collection can evolve independently |

### 3.3 Cons of Referencing

Referencing solves embedding's problems, but it brings back the exact cost MongoDB's document model was trying to avoid in the first place: joins.

| Con | Explanation |
|-----|-------------|
| Multiple reads | Need at least two reads or a `$lookup` to join data |
| No automatic joins | $lookup is explicit and slower than embedded reads |
| No cross-collection atomicity | Without transactions, parent and child can become inconsistent |
| Application-side joins | Application may have to do multiple queries and merge in code |
| Index maintenance | Foreign key fields must be indexed for performance |

### 3.4 When to Reference

```text
✓  The relationship is one-to-many with large or unbounded N
   Example: a post might have 10,000 comments

✓  The child entities are frequently accessed independently
   Example: comments are listed in a "recent comments" global feed

✓  The child data changes frequently and is shared across parents
   Example: a product category name shared by 10,000 products

✓  Many-to-many relationships
   Example: tags used by many posts; posts having many tags

✓  The parent document would exceed safe size limits if you embedded
   Rule of thumb: if N > ~1000 or unbounded, reference

✓  You need separate access control on the child collection
```

### 3.5 Creating and Using References

```js
// Insert a user
const userResult = await db.collection("users").insertOne({
  name: "Alice Nguyen",
  email: "alice@example.com"
});
const userId = userResult.insertedId;

// Insert a post referencing that user
await db.collection("posts").insertOne({
  authorId: userId,   // the reference (foreign key)
  title: "My First Post",
  body: "Hello, MongoDB world!"
});

// Index the foreign key for fast lookups
db.posts.createIndex({ authorId: 1 });
db.comments.createIndex({ postId: 1 });
```

That last pair of index calls isn't optional housekeeping — skip it, and every reference lookup degenerates into a full collection scan. More on why in Section 5.4.

---

## 4. The Decision Tree

All of Sections 2 and 3 boil down to a handful of yes/no questions. Here's the whole decision as one flowchart you can run through every time you face a new relationship:

```text
                   New relationship to model
                            │
                            ▼
              ┌─────────────────────────┐
              │  Is cardinality bounded  │
              │  and small (N < ~100)?   │
              └─────────────────────────┘
                   │            │
                  YES            NO
                   │            │
                   ▼            ▼
        ┌──────────────┐   ┌──────────────────────┐
        │ Is the child  │   │  Reference child     │
        │ always loaded │   │  collection          │
        │ with parent?  │   │  (child → parent FK) │
        └──────────────┘   └──────────────────────┘
             │      │
            YES      NO
             │      │
             ▼      ▼
    ┌──────────────┐  ┌──────────────────────────────┐
    │ Does child   │  │  Reference collection        │
    │ data change  │  │  (parent stores array of IDs │
    │ independently│  │  or child stores parent FK)  │
    │ AND is shared│  └──────────────────────────────┘
    │ across docs? │
    └──────────────┘
         │      │
        YES      NO
         │      │
         ▼      ▼
  ┌──────────┐  ┌─────────────────────────────────┐
  │ Reference│  │  Embed (or Subset Pattern        │
  │          │  │  if concerned about future size) │
  └──────────┘  └─────────────────────────────────┘
```

### Decision Summary Table

| Condition | Decision |
|-----------|----------|
| Small, bounded N (< ~100) + always together | Embed |
| Large or unbounded N | Reference |
| Shared data across multiple parents | Reference |
| Child queried independently | Reference |
| Child rarely changes | Embed |
| Child changes frequently / independently | Reference |
| Need atomic parent+child update | Embed (or use transactions if referencing) |
| Document approaching 16 MB | Reference (or Subset Pattern) |
| Many-to-many | Reference (junction collection or ID arrays) |

---

## 5. $lookup — Performing Joins in MongoDB

Once you choose referencing, you've deliberately given up the "one document, one read" convenience — so how do you get the joined data back when you actually need it? That's what `$lookup` is for: an aggregation stage that joins collections at query time, MongoDB's answer to a SQL JOIN.

### 5.1 Basic $lookup Syntax

```js
// Join posts with their authors
db.posts.aggregate([
  {
    $lookup: {
      from: "users",         // foreign collection name
      localField: "authorId", // field in the current collection
      foreignField: "_id",    // field in the foreign collection
      as: "author"           // output array field name
    }
  },
  // $lookup always returns an array; $unwind to get a single object
  { $unwind: "$author" },
  {
    $project: {
      title: 1,
      body: 1,
      "author.name": 1,
      "author.email": 1
    }
  }
]);
```

Notice the `$unwind` right after `$lookup` — that's not decoration, it's necessary. `$lookup` always hands back an array of matches, even when you know there's exactly one author per post. `$unwind` collapses that single-element array into a plain object so the rest of the pipeline can treat `author` like a normal embedded document.

### 5.2 $lookup with Pipeline (Advanced — MongoDB 3.6+)

Sometimes a plain field-equality join isn't enough — you want to filter *which* related documents get joined in. For that, `$lookup` accepts a full sub-pipeline:

```js
// Join orders with only their non-cancelled items from a separate collection
db.orders.aggregate([
  { $match: { status: "confirmed" } },
  {
    $lookup: {
      from: "orderItems",
      let: { orderId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$orderId", "$$orderId"] } } },
        { $match: { cancelled: { $ne: true } } },
        { $project: { sku: 1, qty: 1, unitPrice: 1 } }
      ],
      as: "items"
    }
  }
]);
```

### 5.3 Multiple $lookup Joins

You can chain as many `$lookup` stages as you need — each one just joins in another collection:

```js
// Fetch post + author + comments in one pipeline
db.posts.aggregate([
  { $match: { _id: ObjectId("p1") } },

  // Join author
  {
    $lookup: {
      from: "users",
      localField: "authorId",
      foreignField: "_id",
      as: "author"
    }
  },
  { $unwind: "$author" },

  // Join comments
  {
    $lookup: {
      from: "comments",
      localField: "_id",
      foreignField: "postId",
      as: "comments"
    }
  },

  // Project only needed fields
  {
    $project: {
      title: 1,
      body: 1,
      "author.name": 1,
      "author.email": 1,
      "comments.body": 1,
      "comments.author": 1
    }
  }
]);
```

### 5.4 Performance Considerations for $lookup

`$lookup` is convenient, but it is not free — under the hood it still has to find matching documents in the foreign collection, and if there's no index to help, that means a full scan for every single document coming through the pipeline.

```text
┌──────────────────────────────────────────────────────────────┐
│              $lookup Performance Tips                        │
├──────────────────────────────────────────────────────────────┤
│  ✓  Always index the foreignField in the foreign collection  │
│     db.users.createIndex({ _id: 1 })  ← already indexed     │
│     db.comments.createIndex({ postId: 1 })  ← add this      │
│                                                              │
│  ✓  Filter with $match BEFORE $lookup to reduce documents   │
│     that need joining                                        │
│                                                              │
│  ✓  Use $project after $lookup to avoid carrying large       │
│     joined documents through the rest of the pipeline       │
│                                                              │
│  ✗  Avoid $lookup on unindexed fields — it will             │
│     perform a collection scan for each joined document      │
│                                                              │
│  ✗  $lookup cannot span shards in older MongoDB versions    │
│     (fully supported from v5.1+ with sharded collections)  │
└──────────────────────────────────────────────────────────────┘
```

### 5.5 $lookup vs Application-Side Join

You don't actually have to use `$lookup` at all — you could just fetch the parent, then fetch the child yourself, in application code. Both are valid; they're just different places to put the join logic.

```js
// Option A — $lookup (server-side join)
const result = await db.posts.aggregate([
  { $match: { _id: postId } },
  { $lookup: { from: "users", localField: "authorId", foreignField: "_id", as: "author" } }
]).next();

// Option B — Application-side join (two queries)
const post   = await db.posts.findOne({ _id: postId });
const author = await db.users.findOne({ _id: post.authorId });
const result = { ...post, author };
```

**When application-side join is better:**
- You are already fetching the parent and need only one specific child.
- The child collection is sharded and `$lookup` across shards is restricted.
- The application-side logic includes complex conditional fetching.

**When $lookup is better:**
- You need to aggregate or filter across the joined documents.
- You want the join logic centralised in the database layer.
- You are working with MongoDB Charts, BI Connector, or Atlas Data API.

---

## 6. Hybrid Approach

In practice, hardly anyone picks pure embedding or pure referencing for an entire schema — most real schemas mix both, document by document. The goal stays the same one from Section 1: satisfy the most frequent queries with a single document read, while keeping documents a manageable size.

### Pattern: Embed Hot Data, Reference Cold Data

```js
// Product page loads frequently — embed the most relevant data
{
  _id: ObjectId("prod1"),
  name: "Wireless Keyboard",
  price: 89.00,
  // HOT: displayed on every product page → embedded
  images: [
    { url: "https://cdn.example.com/kb-main.jpg", alt: "Front view" },
    { url: "https://cdn.example.com/kb-side.jpg", alt: "Side view" }
  ],
  recentReviews: [
    { author: "Alice", rating: 5, body: "Excellent!" },
    { author: "Bob",   rating: 4, body: "Good value." }
  ],
  avgRating: 4.6,
  reviewCount: 234,

  // COLD: loaded only on "View All Reviews" → referenced
  // Full reviews are in the reviews collection, filtered by productId
}
```

### Pattern: Summary + Full Split

```js
// Invoice document — summary always shown, line items on demand
{
  _id: ObjectId("inv1"),
  invoiceNumber: "INV-20240301-001",
  customerId: ObjectId("c1"),
  // Summary (always shown on invoice list)
  subtotal: 549.00,
  tax: 54.90,
  total: 603.90,
  status: "paid",
  issuedAt: ISODate("2024-03-01"),

  // Line item count (summary)
  lineItemCount: 3,

  // OPTIONAL: embed line items if invoice always shown with items
  // OR reference them if they are very numerous
  lineItems: [
    { description: "MongoDB Atlas M30", qty: 1, unitPrice: 549.00 }
  ]
}
```

---

## 7. Anti-Patterns to Avoid

These are the mistakes that don't show up in development, with your handful of test documents — they only bite once real traffic and real scale hit the collection. Recognizing them now saves you a painful migration later.

### Anti-Pattern 1: Unbounded Arrays

**Problem:** Embedding a potentially unlimited array will eventually hit the 16 MB document limit.

```js
// DANGEROUS: comments array grows without limit
{
  _id: ObjectId("p1"),
  title: "Popular Post",
  comments: [
    { body: "comment 1" },
    { body: "comment 2" },
    // ... 50,000 more comments eventually
  ]
}
// Document size: UNKNOWN, growing, potentially > 16 MB
```

**Fix:** Reference comments in a separate collection:

```js
// posts collection — lean document
{ _id: ObjectId("p1"), title: "Popular Post", commentCount: 50000 }

// comments collection — unbounded but manageable
{ _id: ObjectId("c1"), postId: ObjectId("p1"), body: "comment 1" }
```

### Anti-Pattern 2: Massive Documents

**Problem:** Embedding large blobs (base64 images, full HTML, large JSON payloads) in documents creates slow reads, high RAM usage, and potential size limit violations.

```js
// DANGEROUS: base64 image stored in document
{
  _id: ObjectId("prod1"),
  name: "Product",
  imageData: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..." // 2 MB of base64
}
```

**Fix:** Store images in S3/GCS and reference by URL:

```js
{ _id: ObjectId("prod1"), name: "Product", imageUrl: "https://cdn.example.com/prod1.jpg" }
```

### Anti-Pattern 3: Unnecessary Normalisation (Over-Referencing)

**Problem:** Splitting data into too many collections for data that is always accessed together, mimicking SQL normalisation where it is not needed.

```js
// OVER-NORMALISED: three collections for one logical entity
// users, userProfiles, userPreferences — always loaded together
// Requires three $lookups or three queries for every page load
```

**Fix:** Embed data that is always read together:

```js
{
  _id: ObjectId("u1"),
  username: "alice",
  profile: { bio: "...", avatarUrl: "..." },
  preferences: { theme: "dark", emailNotifications: true }
}
```

### Anti-Pattern 4: Using Arrays as Lookup Tables

**Problem:** Storing key-value pairs as parallel arrays is fragile and creates confusing queries.

```js
// DANGEROUS: parallel arrays — keys[0] corresponds to values[0]
{
  configKeys:   ["maxRetries", "timeout", "region"],
  configValues: [3,             5000,      "us-east-1"]
}
```

**Fix:** Use the Attribute Pattern (array of objects) or a nested object:

```js
// Better — array of objects (Attribute Pattern)
{
  config: [
    { k: "maxRetries", v: 3 },
    { k: "timeout",    v: 5000 },
    { k: "region",     v: "us-east-1" }
  ]
}

// Or a nested object if keys are known and stable
{
  config: { maxRetries: 3, timeout: 5000, region: "us-east-1" }
}
```

### Anti-Pattern 5: Deep Nesting Beyond 3 Levels

**Problem:** Documents nested 6–10 levels deep are difficult to query, update, and reason about.

```js
// HARD TO WORK WITH: 6 levels deep
{
  company: {
    department: {
      team: {
        project: {
          task: {
            subtask: { name: "Update README" }
          }
        }
      }
    }
  }
}
```

**Fix:** Flatten the structure or split into related collections. If hierarchy is essential, consider the adjacency list pattern or materialised path pattern.

### Anti-Pattern 6: Storing Files Directly in Documents

```js
// DANGEROUS: storing PDF content as binary in a document
{ _id: ObjectId("doc1"), filename: "report.pdf", content: BinData(0, "...huge binary...") }
// Will hit 16 MB limit for any real file
```

**Fix:** Use GridFS for files > 16 MB, or object storage (S3) + URL reference for all binary files.

> **Memory hook:** "If you can picture a document winning a 'biggest file in the collection' award, it's already an anti-pattern — reference it, or ship it off to S3/GridFS instead."

---

## 8. Comparison Tables

### Embedding vs Referencing: Full Comparison

| Dimension | Embedding | Referencing |
|-----------|-----------|-------------|
| Read performance | Excellent (1 document read) | Good (1+ reads or $lookup) |
| Write complexity | Simple for parent-only updates; complex for child updates | Simple targeted updates on child collection |
| Atomicity | Built-in single-document atomicity | Requires multi-document transactions for consistency |
| Data duplication | Possible if data shared across parents | None — single source of truth |
| Document size | Grows with child data | Stays small and predictable |
| Maximum children | Bounded by 16 MB document limit | Unlimited |
| Index efficiency | Indexes cover parent fields; array indexes for children | Each collection has its own targeted indexes |
| Independent child queries | Difficult (must know parent) | Easy (query children collection directly) |
| Schema evolution | Change in child requires update in all parents | Change child schema once |
| Best cardinality | One-to-one, one-to-few | One-to-many, many-to-many |

### When Each is Ideal

| Use Case | Recommendation |
|----------|---------------|
| User + address (1:1) | Embed address |
| Order + line items (1:few, always together) | Embed line items |
| Post + comments (1:many, unbounded) | Reference comments |
| Product + category (shared across products) | Reference category |
| Invoice + customer name (snapshot) | Embed customer name at time of invoice (Extended Reference) |
| Student + courses (N:M) | Reference with junction collection |
| Sensor device + readings (time-series) | Bucket Pattern (hybrid embed within bucket document) |

---

## 9. Hands-On Exercises

**Exercise 1 — Embed or Reference Decision**

For each of the following relationships, state your decision (embed / reference) and give one reason:

1. A library book and its ISBN (one-to-one, immutable).
2. A shopping cart and its items (one-to-few, always loaded together, volatile).
3. A YouTube channel and its video uploads (one-to-many, potentially millions).
4. A movie and its cast members (many-to-many, actors in many movies).
5. A customer invoice and the customer's name as it was at invoice time.

**Exercise 2 — $lookup Pipeline**

Given these two collections:

```js
// employees
{ _id: 1, name: "Alice", departmentId: 10 }
{ _id: 2, name: "Bob",   departmentId: 20 }
{ _id: 3, name: "Eve",   departmentId: 10 }

// departments
{ _id: 10, name: "Engineering", budget: 500000 }
{ _id: 20, name: "Marketing",   budget: 200000 }
```

Write a `$lookup` aggregation that returns each employee with their department name and budget. Also write the query to find all employees in departments with budget > 300,000.

**Exercise 3 — Fix the Anti-Pattern**

The following schema is used in production but is causing document size warnings. Identify the anti-pattern and rewrite it:

```js
{
  _id: ObjectId("forum1"),
  title: "MongoDB Forum",
  posts: [
    {
      postId: 1,
      body: "How do I design schemas?",
      replies: [
        { replyId: 1, body: "Use patterns!", likes: 42 },
        // potentially thousands more replies per post
      ]
    }
    // hundreds of posts
  ]
}
```

**Exercise 4 — Referencing with Transactions**

You are building a banking system. An account transfer must debit one account and credit another atomically. Accounts are stored in separate documents (referenced). Write the transaction-based transfer using the `withTransaction` helper:

```js
// accounts collection
{ _id: "ACC-001", owner: "Alice", balance: NumberDecimal("1000.00") }
{ _id: "ACC-002", owner: "Bob",   balance: NumberDecimal("500.00") }

// Write the transfer function:
async function transfer(session, fromId, toId, amount) {
  // Your implementation here
}
```

**Exercise 5 — Hybrid Schema Design**

Design a schema for a hotel booking system with these requirements:

- A hotel has many rooms (dozens, not thousands).
- Each room has a list of bookings (potentially thousands over the hotel's lifetime).
- When displaying a room, show its current availability for the next 30 days.
- Booking history needs to be searchable by guest name and date range.
- Guest profiles are shared across multiple bookings.

Produce:
1. The `hotels` document structure.
2. The `bookings` document structure.
3. The `guests` document structure.
4. The indexes you would create.
5. The query to find all bookings for a guest by email.

---

## 10. Interview Q&A

**Q1: What are the two main ways to model relationships in MongoDB?**

A: Embedding (storing related data as a subdocument or array inside the parent document) and referencing (storing a foreign key — typically a `_id` — and linking to a separate collection). Embedding optimises for reads by avoiding joins; referencing optimises for flexibility and handles unbounded growth.

---

**Q2: What is the "rule of thumb" for deciding between embedding and referencing based on cardinality?**

A: If the relationship has a small, bounded number of children (N < ~100), embedding is generally safe and provides better read performance. If N can grow without bound or is already in the thousands, referencing is safer and prevents document size issues.

---

**Q3: What is a $lookup and how does it differ from a SQL JOIN?**

A: `$lookup` is an aggregation stage that performs a left outer join between the current collection and a foreign collection based on matching field values. Unlike SQL JOINs, `$lookup` is explicit (not automatic), requires indexing the foreign field for performance, and returns joined data as an array. SQL JOINs are optimised by the query planner automatically; `$lookup` is always a manual pipeline stage.

---

**Q4: What is the unbounded array anti-pattern and why is it dangerous?**

A: Embedding an array that can grow without limit (e.g., all comments for a popular post). As more documents are pushed to the array, the parent document approaches the 16 MB size limit. Once reached, all subsequent inserts fail and the document becomes unwriteable. The fix is to store children in a separate collection with a reference to the parent.

---

**Q5: Explain why you would use referencing even when embedding would work technically.**

A: Even when embedding fits within 16 MB, referencing may be preferable when: the same child data is shared across multiple parents (avoiding duplication and synchronisation problems); the child data changes frequently (one update vs updating every parent); or the children need to be queried independently without loading the parent.

---

**Q6: What happens in MongoDB if you need to update both a parent and a child document atomically, and they are in separate collections?**

A: Without additional measures, these two updates are not atomic — a failure between them leaves the data in an inconsistent state. The solution is to use a **multi-document ACID transaction** (supported from MongoDB 4.0 for replica sets, 4.2 for sharded clusters). Wrap both updates in `session.withTransaction()`.

---

**Q7: What is `$unwind` and why is it typically used after `$lookup`?**

A: `$unwind` deconstructs an array field, outputting one document per array element. `$lookup` always returns the joined documents as an array (even if only one document matches). If you expect exactly one match (e.g., looking up an author by foreign key), `$unwind` converts the single-element array into a plain embedded object, making subsequent `$project` and `$match` stages simpler.

---

**Q8: When would you choose an application-side join over a server-side $lookup?**

A: Application-side joins are preferable when: the join logic involves conditional fetching based on business rules; the foreign collection is sharded and `$lookup` across shards is restricted; or you are already fetching the parent document and need only one specific referenced child. For analytics, reporting, and complex multi-collection joins, server-side `$lookup` is cleaner.

---

**Q9: Describe the "massive document" anti-pattern and give two fixes.**

A: Storing large binary data (base64 images, full file content) directly in a MongoDB document. This bloats the working set, slows reads, and risks hitting the 16 MB limit. Fix 1: use object storage (S3, GCS) and store only the URL in MongoDB. Fix 2: use MongoDB GridFS for files that must stay in MongoDB and are larger than 16 MB.

---

**Q10: What is the Extended Reference Pattern and when would you use it?**

A: The Extended Reference Pattern copies a small number of fields from a referenced document directly into the referencing document. For example, copying `customerName` and `email` into an order document so that order queries never need a `$lookup` join. Use it when: a few fields are needed on almost every query; those fields rarely change; and the cost of a `$lookup` per query is unacceptable at scale.

---

**Q11: How do you update a single element inside an embedded array without replacing the whole array?**

A: Use the positional operator `$` combined with an array filter in the `find` criteria to match the specific element. For example:
```js
db.posts.updateOne(
  { _id: postId, "comments._id": commentId },
  { $set: { "comments.$.body": "Updated text" } }
);
```
The `$` refers to the first matched array element. For multiple matching elements, use `$[]` or `$[<identifier>]` with `arrayFilters`.

---

**Q12: A blog's post document currently has comments embedded. The blog is going viral and posts are hitting the 16 MB limit. How do you migrate to referencing without downtime?**

A: Use a gradual migration strategy. Deploy application code that writes new comments to a separate `comments` collection (not the embedded array). Continue reading from both the embedded array (existing comments) and the `comments` collection (new ones) and merge them in application code. Run a background migration script to move existing embedded comments to the `comments` collection and clear the embedded array. Once migration is complete, remove the dual-read logic.

---

**Q13: What index should you always create when using referencing?**

A: An index on the foreign key field in the child collection. For example, if `comments` reference `posts` via a `postId` field, create `db.comments.createIndex({ postId: 1 })`. Without this index, every `$lookup` or `find({ postId: X })` performs a collection scan.

---

**Q14: Why is "over-referencing" (normalising everything like SQL) an anti-pattern in MongoDB?**

A: MongoDB has no query planner that automatically optimises JOINs. Every `$lookup` is explicit and relatively expensive compared to embedded reads. Normalising data that is always accessed together forces multiple queries or pipeline stages on every request, eliminating the performance benefits of a document model and adding operational complexity without gain.

---

**Q15: Summarise the embedding vs referencing decision in one framework.**

A: Ask three questions: (1) How many? — small bounded N suggests embedding, large or unbounded N suggests referencing. (2) Together or apart? — data always read together should be embedded; data queried independently should be referenced. (3) How often does it change? — rarely changing data suits embedding; frequently changing or shared data suits referencing. When in doubt, model for the most frequent access pattern and revisit as workloads evolve.
