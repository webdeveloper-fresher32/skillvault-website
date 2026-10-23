# 02 — Data Modeling

> "Ask not what data you have — ask what questions your application needs to answer. Build the schema around the queries, not the other way around."

---

## Table of Contents

1. [The MongoDB Modeling Philosophy](#1-the-mongodb-modeling-philosophy)
2. [The 8 Schema Design Patterns](#2-the-8-schema-design-patterns)
   - 2.1 [Polymorphic Pattern](#21-polymorphic-pattern)
   - 2.2 [Attribute Pattern](#22-attribute-pattern)
   - 2.3 [Bucket Pattern](#23-bucket-pattern)
   - 2.4 [Outlier Pattern](#24-outlier-pattern)
   - 2.5 [Computed Pattern](#25-computed-pattern)
   - 2.6 [Schema Versioning Pattern](#26-schema-versioning-pattern)
   - 2.7 [Extended Reference Pattern](#27-extended-reference-pattern)
   - 2.8 [Subset Pattern](#28-subset-pattern)
3. [Relationship Types](#3-relationship-types)
   - 3.1 [One-to-One](#31-one-to-one)
   - 3.2 [One-to-Many](#32-one-to-many)
   - 3.3 [Many-to-Many](#33-many-to-many)
4. [Real-World Domain Examples](#4-real-world-domain-examples)
   - 4.1 [Blog Platform](#41-blog-platform)
   - 4.2 [E-Commerce](#42-e-commerce)
   - 4.3 [Social Network](#43-social-network)
5. [Pattern Selection Guide](#5-pattern-selection-guide)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The MongoDB Modeling Philosophy

Let's start with the most important sentence in this entire file:

> "Ask not what data you have — ask what questions your application needs to answer."

This one line is the biggest mental shift between SQL thinking and MongoDB thinking. Let's actually see the difference, side by side, instead of just reading the theory.

---

### SQL mindset

In SQL, you usually start by thinking:

```
What entities do we have?

User
Product
Order
Payment
```

Then you create a table for each one:

```
Users table
Orders table
Payments table
```

And only *after* that do you write your queries.

So when someone asks "give me a user's order history," you end up doing this:

```
Users
  |
  JOIN
  |
Orders
  |
  JOIN
  |
Products
```

Three tables, glued together at read time.

---

### MongoDB mindset

MongoDB flips the question. Instead of "what entities do I have," it asks:

> "What does my application need to read, and how often?"

Say you're building an e-commerce app. The single most common thing that happens is:

```
Customer opens a product page
```

That page needs, all at once:

```
Product name
Price
Images
Rating
Recent reviews
Availability
```

MongoDB's answer: why make 5 separate queries (or 5 JOINs) for one page load? Just store the things that are read together, together.

```js
{
  name: "iPhone",
  price: 999,

  rating: {
    avg: 4.8,
    count: 5000
  },

  recentReviews: [
    { user: "John", text: "Amazing" }
  ],

  inventory: {
    available: true
  }
}
```

One document. One read. Fast.

---

### The main decision you'll make, over and over

Every relationship in your data has exactly two options:

```
Embed
  OR
Reference
```

**Embed** — put the related data directly inside the parent document.

```js
{
  name: "John",
  address: {
    city: "London",
    country: "UK"
  }
}
```

Everything lives together. One read gets you everything.

**Reference** — store just an ID, and keep the related data in its own collection (this is basically a SQL foreign key).

```js
// users
{ _id: 1, name: "John" }

// orders
{ orderId: 100, userId: 1 }
```

So how do you decide which one to use? Three questions:

1. How often is this data accessed *together* with its parent?
2. How large can it grow?
3. How often does it change?

Keep these three questions in your head — every pattern below is really just a different answer to them.

---

### Turning this into a repeatable process

```text
┌──────────────────────────────────────────────────────────────────┐
│           MongoDB Schema Design Process                         │
│                                                                  │
│   Step 1: List your application's most frequent queries         │
│           (what does the app read most? write most?)            │
│                                                                  │
│   Step 2: For each query, identify the data it needs            │
│           (which fields? which related entities?)               │
│                                                                  │
│   Step 3: Decide embed vs reference for each relationship       │
│           (covered in detail in Section 3 below)                │
│                                                                  │
│   Step 4: Apply relevant patterns to optimise for scale         │
│           (the 8 patterns covered in Section 2)                 │
│                                                                  │
│   Step 5: Validate with realistic data volumes and load         │
└──────────────────────────────────────────────────────────────────┘
```

Before designing anything, it helps to just write this down for your domain:

| Query / Operation | Frequency | Reads | Writes | Latency Requirement |
|------------------|-----------|-------|--------|---------------------|
| Load product page | Very High | product + reviews | — | < 50 ms |
| Place order | High | inventory check | order + inventory | < 200 ms |
| Generate sales report | Low | all orders | — | < 30 s |
| Update product price | Medium | — | product | < 100 ms |

Whatever sits at the top of that table — high frequency, low latency tolerance — is what your schema should be optimized for. Rare, batch-style operations (like the sales report) can be slow. Nobody's staring at a loading spinner waiting for a monthly report.

---

## 2. The 8 Schema Design Patterns

Think of these as eight recurring "shapes" of problem. Once you recognize the shape, the pattern name just falls out.

### 2.1 Polymorphic Pattern

**The problem, as a story:**

Imagine you're building a vehicle marketplace. You've got:

```
Cars
Motorcycles
Trucks
```

In SQL, your instinct is to create three separate tables:

```
Cars table
Motorcycles table
Trucks table
```

That's fine, until someone asks: "show me all vehicles." Now you need a `UNION` across three tables with different columns. Messy.

**MongoDB's answer:** put them all in one collection.

```js
db.vehicles.insertMany([
  {
    type: "car",
    make: "Toyota",
    model: "Camry",
    doors: 4,
    fuelType: "hybrid"
  },
  {
    type: "motorcycle",
    make: "Ducati",
    model: "Panigale V4",
    engineCC: 1103,
    hasABS: true
    // no 'doors' here — that's fine
  },
  {
    type: "truck",
    make: "Volvo",
    axles: 6,
    payloadTonnes: 20
  }
]);
```

Notice the `type` field on every document. That's the important part — it's called the **discriminator field**. It tells your application "here's what kind of thing this is, so here's which fields to expect."

Now querying is trivial:

```js
// All vehicles
db.vehicles.find();

// Only motorcycles
db.vehicles.find({ type: "motorcycle" });

// All hybrids, regardless of type
db.vehicles.find({ fuelType: "hybrid" });
```

**The catch:** different documents have different fields. A car has `doors`, a motorcycle has `engineCC`, a truck has `payloadTonnes`. Your application code has to expect that some fields simply won't be there — you can't assume every document looks the same.

**Where you'll actually see this:** product catalogs (a book, a laptop, and a subscription are all "products" but need different fields), CMS content (articles vs. videos vs. podcasts), activity feeds (likes, comments, shares — all "activities," all different shapes).

> **Memory hook:** "One drawer, many kinds of tools — labeled so you know which one you picked up."

---

### 2.2 Attribute Pattern

**The problem:** too many optional fields.

Picture a product catalog. A laptop needs:

```
RAM
CPU
Screen size
Battery
```

A pair of shoes needs:

```
Size
Material
Color
```

If you design this the naive way — one field per possible attribute — you get a document like this:

```js
{
  name: "shoe",
  color: "black",
  size: 42,
  ram: null,
  cpu: null,
  camera: null
  // ... hundreds more, mostly null
}
```

That's a lot of wasted, meaningless nulls sitting in every document.

**The fix:** turn attributes into a list of key/value pairs instead of individual fields.

```js
{
  name: "shoe",
  specs: [
    { k: "color", v: "black" },
    { k: "size",  v: 42 }
  ]
}
```

Now here's the payoff — adding a brand new attribute tomorrow needs zero schema changes:

```js
{ k: "waterproof", v: true }
```

Just push another object into the array. Done.

You also only need **one index** to cover every possible attribute, instead of one index per field:

```js
db.products.createIndex({ "specs.k": 1, "specs.v": 1 });

// Find all waterproof products
db.products.find({ specs: { $elemMatch: { k: "waterproof", v: true } } });
```

**Where you'll see this:** product catalogs, dynamic forms, any kind of configuration/metadata store, scientific data with variable measurements per record.

> **Memory hook:** "Don't give every product a hundred empty drawers — just hand it a labeled bag of whatever it actually has."

---

### 2.3 Bucket Pattern

**The problem:** too many tiny documents.

Say you're storing IoT sensor data. Every second, a device reports its temperature. That's:

```
86,400 documents per device per day
```

Now multiply that by 10,000 devices. You're generating hundreds of millions of documents a day, most of them a few bytes each. That's brutal on index size, storage, and compression.

**The fix:** stop storing one document per reading. Group readings into "buckets" — say, one document per device per hour.

```js
// BEFORE — one tiny document per reading (don't do this at scale)
{ deviceId: "D001", ts: ISODate("2024-01-01T00:00:01Z"), temp: 22.1 }
{ deviceId: "D001", ts: ISODate("2024-01-01T00:00:02Z"), temp: 22.3 }
// ... 86,400 of these, per device, per day

// AFTER — one document per device per hour
{
  deviceId: "D001",
  bucketStart: ISODate("2024-01-01T00:00:00Z"),
  count: 3600,
  min: 21.8,
  max: 23.1,
  readings: [
    { ts: ISODate("2024-01-01T00:00:01Z"), temp: 22.1 },
    { ts: ISODate("2024-01-01T00:00:02Z"), temp: 22.3 }
    // ... up to 3600 entries
  ]
}
```

Adding a new reading just pushes into the current bucket and updates the running stats in one atomic operation:

```js
db.sensorData.updateOne(
  { deviceId: "D001", bucketStart: ISODate("2024-01-01T00:00:00Z"), count: { $lt: 3600 } },
  {
    $push: { readings: { ts: new Date(), temp: 22.5 } },
    $inc:  { count: 1 },
    $min:  { min: 22.5 },
    $max:  { max: 22.5 }
  },
  { upsert: true }
);
```

**Why this is a big deal:**
- 1,000,000 raw readings might collapse into ~1,000 bucket documents.
- Need the max temperature for a bucket? It's already sitting there in `max` — no scanning required.
- Similar data compresses much better when it's grouped together.

**What's actually happening internally, step by step:**

```text
Reading arrives (deviceId, timestamp, temp)
        |
        v
Does a bucket already exist for this device + this hour,
with count < 3600?
        |
   ----------------
   |              |
  YES             NO
   |              |
   v              v
$push reading   Create a new bucket document
into readings   with this reading as entry #1
array, $inc
count, $min/
$max the stats
   |              |
   ----------------
        |
        v
   Bucket document updated/created (one write, one document)
```

The key trick is that `upsert: true` — you never have to check "does a bucket exist?" yourself and then decide whether to insert or update; MongoDB does both in one atomic call.

**Common mistake:** picking a bucket window that's either too small (you're back to almost-one-document-per-reading, defeating the purpose) or too large (a single document grows huge and every write to it gets slower as the array grows). Most teams settle on "one bucket per hour" or "one bucket per N readings" — pick whichever keeps a bucket in the low hundreds of KB, comfortably under the 16MB document limit.

**Interview answer:** "The Bucket Pattern groups many small, frequently-written measurements into a single document per time window instead of one document per measurement. This reduces the total document/index count by orders of magnitude, improves compression since similar data sits together, and lets you maintain pre-aggregated stats like min/max/sum on the bucket itself so common queries don't need to scan raw data."

> **Memory hook:** "Don't log one entry per second in a new notebook — fill one notebook per hour, and jot the day's high/low on the cover."

**Where you'll see this:** IoT, stock ticks, server metrics, logs. MongoDB 5.0+ even has native **Time Series collections** that do this bucketing for you automatically — use those for new projects, and fall back to the manual pattern when you need finer control.

---

### 2.4 Outlier Pattern

**The problem:** most of your documents are small and well-behaved, but a rare few are enormous.

Classic example — a social network. A normal user has:

```
~500 followers
```

A celebrity has:

```
50 million followers
```

If you naively embed the followers array on the user document, that celebrity's document alone could blow past MongoDB's 16MB document limit, and every operation touching it becomes slow.

**The fix:** design for the 99% common case, and give the 1% outliers a separate overflow home.

```js
// Normal user — everything fits right here
{
  username: "alice",
  followers: [/* up to ~1000 ids */],
  hasOverflow: false
}

// Celebrity — only the first batch lives on the main doc
{
  username: "celebrity",
  followers: [/* first 1000 ids */],
  hasOverflow: true   // application knows to go fetch more
}
```

The extra followers for celebrities live in their own collection:

```js
// followerOverflow collection
{
  userId: ObjectId("..."),
  page: 1,
  followers: [/* next batch */]
}
```

**What's happening internally when you fetch followers:**

```text
getFollowers(userId)
        |
        v
Read the user document (always fast — it's small)
        |
        v
Check hasOverflow
        |
   ----------------
   |              |
 false           true
   |              |
   v              v
Return the      Also query followerOverflow
embedded        collection for this userId,
followers       concat the extra pages onto
array — done    the embedded array, then return
```

99.9% of the time you take the `false` branch — one document read, nothing extra. Only the rare celebrity pays for the second query.

**Common mistake:** trying to "future proof" every document by designing it around the worst-case (celebrity) size from day one. That makes every normal user's document carry structure and overhead it never needs. The Outlier Pattern is deliberately the opposite: bet on the common case, and let outliers be slightly more expensive to handle.

**Interview answer:** "The Outlier Pattern handles the small percentage of documents that would otherwise be disproportionately large — like a celebrity account with 50 million followers. Instead of designing every document around that worst case, you optimize for the common, small case, add a flag like `hasOverflow`, and push the excess data for outliers into a separate overflow collection that's only queried when the flag is set."

> **Memory hook:** "Design the shelf for a normal book — give the encyclopedia its own separate shelf."

**The core idea:** optimize for the common case, and treat the rare exception as, well, an exception — handled separately, not baked into every document's shape.

---

### 2.5 Computed Pattern

**The problem:** expensive calculations that run on every single read.

Say a product has 10 million reviews, and every time someone opens the product page, you calculate the average rating live. That's an expensive aggregation, running over and over, for the exact same answer most of the time.

**The fix:** calculate it once, when the data changes — not every time someone reads it.

```js
{
  product: "iPhone",
  rating: {
    average: 4.7,
    count: 100000
  }
}
```

When a new review comes in, you don't recompute from scratch — you just update the running numbers:

```js
db.products.updateOne(
  { _id: productId },
  { $inc: { "rating.count": 1 } }
  // plus a recalculated running average
);
```

**The tradeoff, stated plainly:** writes get slightly more work to do (updating the computed value). In exchange, reads become instant — no scanning, no aggregating, just reading a number that's already sitting there.

**What's happening internally, comparing the two approaches:**

```text
WITHOUT Computed Pattern            WITH Computed Pattern
--------------------------          --------------------------
Page load                           Page load
   |                                    |
   v                                    v
Run aggregation over               Read product.rating.average
ALL reviews for this product       (already sitting on the doc)
   |                                    |
   v                                    v
Return average                     Return average
(slow — scans N reviews            (fast — O(1), no scan)
every single page view)

                                    New review submitted
                                        |
                                        v
                                    $inc the running total/count
                                    on the product document
                                    (small extra write cost, paid
                                     once, not on every read)
```

The whole idea is *moving the expensive work from read-time to write-time* — and writes (new reviews) happen far less often than reads (page views).

**Common mistake:** updating the source data (say, deleting a review directly in the database, or bulk-editing via a script) without also updating the computed field. The computed value silently goes stale, and nobody notices until the numbers look wrong.

**Interview answer:** "The Computed Pattern pre-calculates and stores aggregated values — like an average rating or total revenue — on the document itself, updating them incrementally whenever the source data changes, instead of recalculating from scratch on every read. It trades a small amount of extra write complexity for dramatically faster, O(1) reads."

> **Memory hook:** "Don't recount the votes every time someone asks who's winning — keep a running scoreboard."

**Where you'll see this:** ratings, revenue totals, leaderboards, view counters — basically anywhere you show a number on every page load that would otherwise require scanning a huge collection.

---

### 2.6 Schema Versioning Pattern

**The problem:** your schema needs to change, but you have millions of existing documents.

Say your `users` collection originally stored:

```js
{ name: "John Smith" }
```

But now you want:

```js
{ firstName: "John", lastName: "Smith" }
```

You can't just flip a switch and migrate millions of documents in one shot — that's a big risky operation, and you can't afford the downtime.

**The fix:** add a version number, and let old and new shapes coexist.

```js
// old documents
{ name: "John Smith", schemaVersion: 1 }

// new documents
{ firstName: "John", lastName: "Smith", schemaVersion: 2 }
```

Your application code understands both versions, and migrates documents lazily — whenever one happens to get touched, it gets upgraded to the latest version. Over time, a background job can clean up any stragglers still on v1.

```text
Phase 1: Deploy app that reads v1 and v2, writes only v2
Phase 2: Documents migrate lazily as they're touched
Phase 3: Background job mops up remaining v1 documents
Phase 4: Remove v1-handling code once none are left
```

**What's actually happening internally when a document gets touched:**

```text
Document read (for update or normal use)
        |
        v
Check schemaVersion field
        |
   ----------------
   |              |
   v = 1          v = 2
   |              |
   v              |
Run normalise()   |
to upgrade it     |
to v2 shape       |
   |              |
   ----------------
        |
        v
   Document is now guaranteed v2 shape
   in application memory (write it back
   as v2 if you're saving anyway)
```

Notice nothing here requires a maintenance window — every document upgrades itself, lazily, exactly when it's naturally touched by real traffic.

**Common mistake:** forgetting to actually write the field back to the database after normalising it in application code. If you only "fix it in memory" but never persist the upgrade, the document stays on v1 forever and every future read pays the normalise cost again.

**Interview answer:** "Schema Versioning adds a `schemaVersion` field to every document so old and new document shapes can coexist safely. The application is written to understand every version it might encounter, normalising older documents on the fly and writing them back in the new shape. This avoids a single risky, downtime-inducing bulk migration in favour of a gradual, lazy one, with an optional background job to sweep up stragglers."

> **Memory hook:** "Old passports still work at the airport — just stamped 'please renew' until you actually do."

No big-bang migration, no downtime.

---

### 2.7 Extended Reference Pattern

**The problem:** you constantly need just a couple of fields from a related collection.

Say you're showing an order. Normally:

```js
// orders
{ customerId: 123 }

// customers
{ _id: 123, name: "John" }
```

Every single time you render an order, you need the customer's name — which means a lookup, every time.

**The fix:** copy the small, frequently-needed fields directly onto the order.

```js
{
  orderId: 100,
  customer: {
    id: 123,
    name: "John"
  }
}
```

No lookup needed anymore.

**Here's the subtle but important part:** this is a *snapshot*, taken at the time the order was placed. If John later changes his name, his old orders still show "John" as it was back then. That's not a bug — for something like an invoice, that's actually the *correct* behavior. You don't want your past invoices silently changing because a customer updated their profile.

**When to reach for this:** the referenced data rarely changes, you need it on nearly every query, and it's small (a name and email — not an entire subdocument).

> **Memory hook:** "Print the customer's name on the receipt — don't make every future re-print call the customer to ask again."

---

### 2.8 Subset Pattern

**The problem:** huge arrays inside a document that you rarely need in full.

A product might have 50,000 reviews. Does the product page need all 50,000 the moment it loads? No — realistically, it shows the latest 5.

**The fix:** only keep the "hot" subset embedded, and push the rest into its own collection.

```js
// products collection — just the recent 5
{
  name: "Keyboard",
  recentReviews: [/* 5 reviews */],
  reviewCount: 50000
}

// reviews collection — the other 49,995 live here
{ productId: ObjectId("..."), author: "Charlie", rating: 3, body: "Decent." }
```

The product page load stays small and fast. If someone actually wants to page through all 50,000 reviews, *that* query goes to the `reviews` collection — not the product document.

> **Memory hook:** "The store window shows the 5 best-sellers — the warehouse holds the rest."

---

## 3. Relationship Types

Now that you've seen the 8 patterns, let's zoom out to the three relationship shapes every schema is built from.

### 3.1 One-to-One

Example: a User and their Profile. One user has exactly one profile.

**Usually: embed.** If the two things are basically always read together, why split them up?

```js
{
  name: "John",
  profile: {
    bio: "Developer"
  }
}
```

The one exception is when the related data needs different access rules — say, a user's payment details, which might be encrypted differently or accessed by a completely different service. In that case, reference it instead, in its own collection.

---

### 3.2 One-to-Many

Example: Customer → Orders. One customer, many orders.

The question that decides everything here: **how many is "many"?**

**Small and bounded → embed it:**

```js
{
  name: "John",
  orders: [ {}, {} ]
}
```

**Large or unbounded → reference it.** A customer could place millions of orders over their lifetime — you don't want that living inside the customer document.

```js
// orders
{ customerId: 1 }

db.orders.find({ customerId: 1 });
db.orders.createIndex({ customerId: 1 });
```

There's a third middle-ground option too: the parent stores an *array of child IDs* (rather than the children storing a parent ID). Useful when you need to preserve order, like a course's ordered list of lesson IDs:

```js
{
  title: "MongoDB for Beginners",
  lessonIds: [ObjectId("l1"), ObjectId("l2"), ObjectId("l3")]
}
```

---

### 3.3 Many-to-Many

Example: Students and Courses. A student takes many courses; a course has many students.

In SQL, this always means a junction table. In MongoDB, you get a choice.

**Small scale → arrays on both sides:**

```js
// student
{ courses: [1, 2, 3] }

// course
{ students: [10, 22, 45] }
```

**Larger scale, or the relationship itself has data attached to it → a junction collection:**

```js
// enrollments
{
  studentId: 1,
  courseId: 10,
  grade: "A"
}
```

Notice that `grade` field — it doesn't belong to the student or the course, it belongs to the *relationship between them*. That's your signal that you need a junction collection: whenever the relationship itself carries data, not just an association.

---

## 4. Real-World Domain Examples

Patterns are easiest to remember once you've seen them combined in an actual app. Here are three.

### 4.1 Blog Platform

**Entities:** Users, Posts, Comments, Tags

**What the app does most often:** load a post with its author and a handful of recent comments.

```js
// posts collection
{
  title: "Mastering Aggregation Pipelines",
  author: { _id: ObjectId("u1"), username: "alice" },   // Extended Reference
  tags: ["mongodb", "aggregation"],
  stats: { views: 14203, likes: 342, commentCount: 47 }, // Computed
  recentComments: [                                       // Subset
    { author: "Bob", body: "Excellent breakdown!" }
  ]
}

// comments collection — the full history lives here
{ postId: ObjectId("post1"), author: "Dave", body: "Really helpful." }
```

Three patterns, one document: Extended Reference (author snapshot), Computed (the stats block), Subset (only recent comments embedded).

---

### 4.2 E-Commerce

**Entities:** Products, Orders, Customers, Inventory

```js
// products — Attribute + Computed + Subset, all at once
{
  name: "Mechanical Wireless Keyboard",
  specs: [ { k: "color", v: "space grey" }, { k: "connectivity", v: "bluetooth" } ],
  computed: { avgRating: 4.6, reviewCount: 234 },
  recentReviews: [ { author: "Alice", rating: 5 } ],
  inventory: { qty: 145, available: 133 }
}

// orders — Extended Reference for the customer snapshot
{
  customer: { id: "cust1", name: "Alice Nguyen", email: "alice@example.com" },
  items: [ { productId: "prod1", qty: 2, lineTotal: 178.00 } ],
  total: 195.80
}
```

Notice how the product page can render in a single read, and the order keeps a frozen snapshot of the customer's name at purchase time.

---

### 4.3 Social Network

**Entities:** Users, Posts, Follows, Likes

```js
// users — Outlier Pattern for followers
{
  username: "alice",
  followerCount: 2341,
  followerIds: [/* up to 1000 */],
  hasMoreFollowers: false
}

// posts — Extended Reference + Subset
{
  authorUsername: "alice",              // avoids a lookup on every feed render
  body: "Just shipped a new guide!",
  likeCount: 89,
  recentLikerIds: [/* first 50, for "Alice and 88 others liked this" */]
}
```

---

## 5. Pattern Selection Guide

If you forget everything else, remember this: match the *symptom* you're seeing to the pattern that fixes it.

```text
┌──────────────────────────────────────────────────────────────────┐
│                  Pattern Selection Guide                        │
├────────────────────┬─────────────────────────────────────────── ┤
│ Symptom / Problem  │ Recommended Pattern(s)                      │
├────────────────────┼─────────────────────────────────────────── ┤
│ Multiple entity    │ Polymorphic                                 │
│ types in one query │                                             │
│                    │                                             │
│ Sparse optional    │ Attribute                                   │
│ fields (many null) │                                             │
│                    │                                             │
│ Time-series / IoT  │ Bucket (or native Time Series collection)  │
│ high write rate    │                                             │
│                    │                                             │
│ 1% of documents    │ Outlier                                     │
│ are "celebrity"    │                                             │
│ sized outliers     │                                             │
│                    │                                             │
│ Expensive read-    │ Computed                                    │
│ time aggregations  │                                             │
│                    │                                             │
│ Evolving schema,   │ Schema Versioning                          │
│ live migration     │                                             │
│                    │                                             │
│ $lookup too slow,  │ Extended Reference                         │
│ need 2-3 fields    │ (denormalise key fields)                   │
│                    │                                             │
│ Document too large │ Subset                                      │
│ due to one array   │ (embed hot subset, reference cold data)    │
└────────────────────┴─────────────────────────────────────────── ┘
```

---

## 6. Hands-On Exercises

**Exercise 1 — Polymorphic Pattern**

A company sells three types of products: physical goods (have weight, dimensions), digital downloads (have fileSize, downloadUrl), and subscriptions (have billingCycle, trialDays). Design a single `products` collection using the Polymorphic Pattern. Insert one of each, then write a query that finds all products under $20.

**Exercise 2 — Bucket Pattern**

A smart home hub logs temperature readings every 10 seconds from 5 sensors. Design a Bucket Pattern schema where each document holds one hour of readings (360 per bucket). Write the `updateOne` upsert that adds a new reading to the current bucket, including `$min` and `$max` maintenance.

**Exercise 3 — Computed Pattern**

An e-commerce site shows each product's average rating. Without the Computed Pattern, this requires a slow aggregation. Implement the Computed Pattern: when a new review is inserted, atomically update the product's `computed.avgRating` using the running average formula:

```
newAvg = (oldAvg * oldCount + newRating) / (oldCount + 1)
```

Write the update operation.

**Exercise 4 — Schema Versioning**

You have a `contacts` collection. Version 1 stores `{ name, phone }`. Version 2 splits this into `{ firstName, lastName, phones: [{type, number}] }`. Write:
1. A `normaliseContact(doc)` function that upgrades v1 to v2.
2. A query that finds all v1 documents still needing migration.
3. An update that migrates a single document in-place.

**Exercise 5 — Many-to-Many Design Decision**

You are building a recipe platform. Recipes have many ingredients, and ingredients appear in many recipes. The `recipeIngredient` relationship also has a `quantity` and `unit` field. Design the schema:
1. Show the junction collection approach.
2. Show a viable embedding approach.
3. Explain which you would choose for a public recipe site with 1 million recipes and why.

---

## 7. Interview Q&A

**Q1: What are the 8 official MongoDB schema design patterns?**

A: Polymorphic, Attribute, Bucket, Outlier, Computed, Schema Versioning, Extended Reference, and Subset. Each solves a specific class of modeling problem: Polymorphic for multiple types, Attribute for sparse fields, Bucket for time-series, Outlier for celebrity data, Computed for expensive aggregations, Schema Versioning for live migrations, Extended Reference for denormalising join fields, Subset for oversized arrays.

---

**Q2: How does MongoDB model a Many-to-Many relationship differently from SQL?**

A: SQL requires a junction table. MongoDB has options: embed arrays of references on both sides (good for small-medium N without relationship attributes), or use an explicit junction collection (good for large N or when the relationship itself has attributes like `enrolledAt` or `grade`).

---

**Q3: Explain the Bucket Pattern and name an ideal use case.**

A: The Bucket Pattern groups many small measurements into a single document per time window (e.g., one document per sensor per hour). This reduces index size, improves compression, and allows pre-aggregated stats (min, max, sum) to be stored alongside raw data. Ideal use case: IoT sensor telemetry, financial tick data, server metrics.

---

**Q4: What is the Outlier Pattern solving?**

A: It solves the problem of a few "celebrity" documents that would be enormous if designed naively. For example, a social network user with 50 million followers would have an unbounded `followers` array. The Outlier Pattern designs for the common case (small followers array), adds a `hasOverflow` flag, and stores excess data in an overflow collection that only outliers use.

---

**Q5: When would you use the Computed Pattern?**

A: When an aggregated value (total revenue, average rating, leaderboard score) is read frequently but computed from many source documents. Instead of running an expensive aggregation on every read, you pre-compute and store the value when the source data changes. This trades slightly more complex writes for dramatically faster reads.

---

**Q6: How do you migrate a live production collection with millions of documents to a new schema without downtime?**

A: Use the Schema Versioning Pattern. Add a `schemaVersion` field. Deploy code that reads both old and new versions and writes only the new version. Documents migrate lazily as they are touched. A background job can then clean up remaining old-version documents during off-peak hours.

---

**Q7: What is the difference between the Extended Reference Pattern and the Subset Pattern?**

A: Extended Reference copies a few fields from a *referenced* document into the *referencing* document (e.g., copying customer name into the order). Subset Pattern splits a *single* document's large array into a hot subset (in the main document) and a cold full set (in a separate collection). Extended Reference reduces lookup joins; Subset reduces document size.

---

**Q8: Describe the Attribute Pattern and why it is better than wide sparse documents.**

A: The Attribute Pattern converts sparse optional fields into an array of `{k, v}` pairs. Instead of creating 100 nullable columns for product attributes, you store only the attributes that apply. A single compound index on `{ k: 1, v: 1 }` covers all attribute queries. This is more efficient in index size and document space.

---

**Q9: In the One-to-Many relationship, what determines whether you embed or reference?**

A: Key factors: (1) cardinality — small bounded N favours embedding, large/unbounded N favours referencing; (2) access pattern — if children are always accessed with the parent, embed; if queried independently, reference; (3) update frequency — frequently updated child data is cheaper to maintain as references; (4) document size — embedding must keep the document under 16 MB.

---

**Q10: What is the primary advantage of starting schema design from access patterns rather than data structure?**

A: Queries that match the data layout can be served from a single document read with no joins. MongoDB has no optimiser for distributed JOIN operations (unlike SQL). Designing from access patterns ensures the most frequent queries are O(1) lookups or simple range scans with indexes, rather than multi-collection join pipelines.

---

**Q11: Why might you store `authorUsername` inside a post document even though it exists in the users collection?**

A: This is the Extended Reference Pattern. Rendering a news feed requires the author's username for every post. Copying it into the post document avoids a `$lookup` join on every feed query. The tradeoff: if a user changes their username, existing posts still show the old username — which may or may not be acceptable depending on business requirements.

---

**Q12: A student table and a course table in SQL are joined by a junction table `enrollments`. How would you model this in MongoDB for a university system with 50,000 students and 200 courses?**

A: Use a junction collection `enrollments` with fields `studentId`, `courseId`, `enrolledAt`, `grade`. Create indexes on both `studentId` and `courseId`. For low-cardinality queries like "how many courses does a student take?" (typically < 10), you could also embed a small array of `courseIds` on the student document and use the junction collection only when relationship attributes (grade, dates) are needed.

---

**Q13: When is the Polymorphic Pattern preferable to separate collections per type?**

A: When you frequently query across all types together (e.g., "all active vehicles regardless of type", "all content items in a feed"). Querying a single collection is simpler and avoids `$unionWith` across multiple collections. Separate collections make sense when types have very different access patterns, index needs, or team ownership.

---

**Q14: How does the Bucket Pattern interact with MongoDB's native Time Series collections?**

A: MongoDB Time Series collections (5.0+) implement the Bucket Pattern automatically and transparently. You insert individual measurements; MongoDB internally buckets them by time and metaField. Use native Time Series for new IoT/metrics workloads; use the manual Bucket Pattern when you need more control over bucket granularity, need pre-aggregated fields, or are on MongoDB < 5.0.

---

**Q15: What is the risk of the Computed Pattern and how do you mitigate it?**

A: The risk is that the pre-computed value becomes stale if the source data is updated without updating the computed field — especially if updates happen in bulk or via scripts that bypass application code. Mitigate by: always updating computed fields in the same transaction as the source update; using MongoDB multi-document transactions for critical financials; or using Change Streams to trigger recomputation asynchronously.
