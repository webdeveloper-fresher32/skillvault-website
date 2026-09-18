# 01 — Documents & Collections

> "A document is not just a row with columns — it is a self-describing unit of data that can contain arrays, nested objects, and mixed types, all in one atomic read."

---

## Table of Contents

1. [What Is a Document?](#1-what-is-a-document)
2. [Nested Documents and Arrays](#2-nested-documents-and-arrays)
3. [Mixed Types and the Flexible Schema](#3-mixed-types-and-the-flexible-schema)
4. [Schema-on-Read vs Schema-on-Write](#4-schema-on-read-vs-schema-on-write)
5. [The 16 MB Document Size Limit](#5-the-16-mb-document-size-limit)
6. [ObjectId Anatomy](#6-objectid-anatomy)
7. [Capped Collections](#7-capped-collections)
8. [Collections vs Tables: Side-by-Side](#8-collections-vs-tables-side-by-side)
9. [BSON Under the Hood](#9-bson-under-the-hood)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What Is a Document?

Here's the problem relational rows have always had: a row can only hold flat, fixed columns. If a user has three phone numbers, a table can't just say "here, have a list" — you need a whole separate `phone_numbers` table and a JOIN to stitch it back together, just to read one person's data.

A MongoDB **document** doesn't have that problem. It's a set of field-value pairs stored in BSON (Binary JSON), and a field's value can be a list, a nested object, or a mix of types — whatever the data actually looks like.

**Real-world analogy:** think of a document like a filled-in form clipped to a manila folder. The form can have blank sections, sticky notes stuck to it (nested objects), a stapled list of attachments (arrays), and different handwriting from form to form (flexible schema). A relational table is more like a pre-printed ledger sheet — every row must fill in every column, blank or not.

**Basic definition:** a document is the basic unit of data in MongoDB — the rough equivalent of a row in a relational table, but far more expressive.

```text
┌──────────────────────────────────────────────────────────────┐
│                     A MongoDB Document                       │
│                                                              │
│   {                                                          │
│     "_id"   : ObjectId("64f1a2b3c4d5e6f7a8b9c0d1"),         │
│     "name"  : "Alice Nguyen",                               │
│     "email" : "alice@example.com",                          │
│     "age"   : 31,                                           │
│     "active": true                                          │
│   }                                                          │
│                                                              │
│   Field names → strings (keys)                               │
│   Values     → any BSON type                                 │
│   _id        → required, unique within the collection        │
└──────────────────────────────────────────────────────────────┘
```

A few ground rules worth knowing before you start writing documents:

- Field names are strings; they are case-sensitive (`Name` != `name`).
- Field names cannot start with `$` or contain `.` (these are reserved in query operators).
- `_id` is mandatory. If you do not provide it, the driver generates an `ObjectId`.
- A document may have **up to 100 levels of nesting** (practical limit before performance degrades).

---

## 2. Nested Documents and Arrays

### 2.1 Nested (Embedded) Documents

Why would you want a field whose value is itself a whole document? Because a lot of real-world data is naturally nested — an order *has* a shipping address, it doesn't just relate to one somewhere else. MongoDB lets you store that address right where it belongs, so there's no JOIN needed to read parent + child together — they live in the same document.

```js
// An order document with an embedded address
db.orders.insertOne({
  _id: ObjectId(),
  orderId: "ORD-1042",
  customer: {
    name: "Bob Chen",
    email: "bob@example.com"
  },
  shippingAddress: {
    street: "12 King St",
    city: "Sydney",
    state: "NSW",
    postcode: "2000",
    country: "AU"
  },
  total: 149.95,
  placedAt: new Date()
});
```

**Querying nested fields** uses dot notation — you just walk down the path with dots:

```js
// Find all orders shipped to Sydney
db.orders.find({ "shippingAddress.city": "Sydney" });

// Find orders where customer email matches
db.orders.find({ "customer.email": "bob@example.com" });
```

### 2.2 Arrays

Same idea, but for lists. A field value can be an array of any BSON type — including other documents, so you can have an array of little sub-records.

```js
// A blog post with embedded comments array
db.posts.insertOne({
  title: "Getting Started with MongoDB",
  tags: ["mongodb", "nosql", "database"],
  comments: [
    { author: "Alice", body: "Great post!", postedAt: new Date("2024-01-10") },
    { author: "Dave",  body: "Very helpful.",  postedAt: new Date("2024-01-11") }
  ],
  viewCount: 1042
});
```

**Querying arrays:**

```js
// Documents where tags array contains "nosql"
db.posts.find({ tags: "nosql" });

// Documents where any comment was posted by Alice
db.posts.find({ "comments.author": "Alice" });

// $elemMatch: both conditions on the SAME array element
db.posts.find({
  comments: { $elemMatch: { author: "Alice", body: /Great/ } }
});
```

That last one matters more than it looks — without `$elemMatch`, MongoDB would happily match a document where *one* comment is by Alice and a *different* comment contains "Great", even if no single comment satisfies both. `$elemMatch` pins both conditions to the same array element.

### 2.3 Arrays of Mixed Types

MongoDB arrays can hold heterogeneous types:

```js
// Valid — mixed types in an array
{ values: [1, "two", true, null, { x: 3 }] }
```

This is unusual in practice but fully supported. It is a sign you may want to reconsider your schema if you find yourself doing it often.

---

## 3. Mixed Types and the Flexible Schema

### 3.1 Polymorphic Documents in One Collection

In SQL, every row in a table must have the same columns — that's the whole point of a table. In MongoDB, documents in the same collection can have completely different shapes, side by side:

```js
// vehicles collection — cars and motorcycles together
{ type: "car",        make: "Toyota", doors: 4, engineLitres: 2.0 }
{ type: "motorcycle", make: "Ducati", cylinders: 2, cc: 937 }
{ type: "truck",      make: "Volvo",  payload_tonnes: 20, axles: 6 }
```

This is the foundation of the **Polymorphic Pattern** (covered in File 02).

### 3.2 Optional Fields

Because there is no fixed schema, optional fields simply do not appear in documents where they are not relevant — there's no `NULL` column sitting there taking up space just in case:

```js
// Premium users have a subscriptionExpiry field; free users do not
{ username: "alice", tier: "premium", subscriptionExpiry: ISODate("2025-06-01") }
{ username: "bob",   tier: "free" }
```

Query for documents missing a field using `$exists`:

```js
db.users.find({ subscriptionExpiry: { $exists: false } }); // free users
```

### 3.3 Field Type Variation (and Why to Avoid It)

MongoDB allows the same field to hold different types across documents:

```js
{ price: 9.99 }     // Double
{ price: "free" }   // String
{ price: null }     // Null
```

**Avoid this unless you have a very specific reason.** Mixed-type fields make index range queries unreliable, aggregation type coercions surprising, and application-level validation harder.

---

## 4. Schema-on-Read vs Schema-on-Write

This is one of the most important conceptual distinctions between MongoDB and relational databases — and it explains almost every other difference in this file.

In SQL, the schema is a gatekeeper: you define it up front, and the database refuses anything that doesn't fit. MongoDB flips that — it accepts whatever shape you hand it, and it's your application's job to make sense of it when reading it back. That's why it's called schema-on-*read* rather than schema-on-*write*.

```text
┌──────────────────────────────┬──────────────────────────────────────┐
│   Schema-on-Write (SQL)      │   Schema-on-Read (MongoDB default)   │
├──────────────────────────────┼──────────────────────────────────────┤
│ Schema defined in DDL before │ No DDL required; collection created  │
│ any data is inserted.        │ on first insert.                     │
│                              │                                      │
│ Database REJECTS data that   │ Database ACCEPTS any document shape. │
│ violates the schema.         │ Application interprets the shape.    │
│                              │                                      │
│ ALTER TABLE is painful at    │ Adding a new field requires no DDL   │
│ scale (locks, migrations).   │ — just start inserting docs with it. │
│                              │                                      │
│ Every row guaranteed to have │ Documents may be missing fields.     │
│ every column.                │ Application must handle nulls.       │
│                              │                                      │
│ Strong guarantees upfront.   │ Flexibility upfront; discipline      │
│                              │ required in application code.        │
└──────────────────────────────┴──────────────────────────────────────┘
```

### 4.1 Optional Schema Validation (Best of Both Worlds)

So does "no schema" mean "no rules at all"? Not quite — MongoDB supports **JSON Schema validation** so you can add constraints without giving up the flexibility:

```js
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "email"],
      properties: {
        username: {
          bsonType: "string",
          minLength: 3,
          description: "must be a string of at least 3 characters"
        },
        email: {
          bsonType: "string",
          pattern: "^.+@.+\\..+$",
          description: "must be a valid email address"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150
        }
      }
    }
  },
  validationAction: "error"   // "warn" to log without rejecting
});
```

### 4.2 Under the Hood: How Schema Flexibility Works

So what actually happens the moment you call `insertOne`? Step by step:

```text
insertOne(doc)
      |
      v
1. Serialise the document to BSON
      |
      v
2. Check the document size (must be < 16 MB)
      |
      v
3. Run any attached validator (if configured)
      |
      v
4. Write the BSON bytes to the WiredTiger storage engine
      |
      v
5. Update any existing indexes
```

Notice what's *missing* from that list — there's no column-map lookup, no schema cache, no type coercion. The raw bytes go straight to disk. The *meaning* of those bytes is interpreted entirely by your application on the way out, which is exactly what "schema-on-read" means in practice.

---

## 5. The 16 MB Document Size Limit

**The problem this limit prevents:** imagine MongoDB let documents grow without bound. Someone eventually embeds a 500 MB video inside a single document, that document gets pulled into RAM as a whole every time it's touched, and now one bad document can degrade the whole server. MongoDB heads this off with a hard rule.

### 5.1 Why 16 MB?

MongoDB enforces a hard cap of **16 megabytes** per document. This limit exists to:

- Prevent single documents from consuming all available RAM when loaded into the working set.
- Keep network transfer times predictable.
- Discourage anti-patterns like storing entire file contents inside a document.

```text
┌─────────────────────────────────────────────────────────────┐
│              Document Size Progression                      │
│                                                             │
│  Tiny doc    ~100 bytes   → a simple user profile          │
│  Small doc   ~1 KB        → a blog post with 5 comments    │
│  Medium doc  ~100 KB      → a post with 200 embedded imgs  │
│  Large doc   ~1 MB        → embed with caution             │
│  Huge doc    ~10 MB       → serious design smell           │
│  LIMIT       16 MB        → MongoDB hard error             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 What Happens When You Hit the Limit

It's not a soft warning — the insert just fails outright:

```js
// This will throw: BSONError: document too large
db.badCollection.insertOne({ blob: "x".repeat(17 * 1024 * 1024) });
// MongoServerError: BSONObj size: 17825800 (0x10FFF08) is invalid.
// Size must be between 0 and 16793600(16MB)
```

### 5.3 Workarounds for Large Data

So what do you actually do when your data wants to be bigger than 16 MB? You've got four escape hatches, roughly in order of how often you'll reach for them:

**Option 1 — Referencing (most common)**

Instead of embedding 10,000 comments in one post, store comments in a separate `comments` collection and reference the post by `postId`.

**Option 2 — GridFS**

For binary files (PDFs, images, videos) larger than 16 MB, use MongoDB's **GridFS** specification. GridFS splits the file into 255 KB chunks and stores them in two collections: `fs.files` (metadata) and `fs.chunks` (binary data).

```js
// Using the official Node.js driver
const bucket = new GridFSBucket(db);
const uploadStream = bucket.openUploadStream("report.pdf");
fs.createReadStream("./report.pdf").pipe(uploadStream);
```

**Option 3 — External Object Storage**

Store large assets in S3 / GCS / Azure Blob, and keep only the URL and metadata in MongoDB. This is the most scalable approach for media-heavy applications.

**Option 4 — Compression**

For compressible text data (logs, JSON payloads), compress at the application layer before inserting. WiredTiger also does block-level compression (Snappy by default, zlib/zstd optional).

**Common mistake:** treating the 16 MB limit as something you'll "deal with later." Documents that grow via `$push` (comments, log entries, sensor readings) can silently creep toward the limit in production, and the failure only shows up once real traffic hits it — which is exactly when you don't want surprises. Design for unbounded growth (reference it) from the start if there's any chance an array keeps growing forever.

> **Memory hook:** "16 MB is the moving-truck size limit — if your cargo won't fit, you don't build a bigger truck, you make a second trip (reference it) or use a freight company (GridFS/S3)."

---

## 6. ObjectId Anatomy

Every MongoDB document has a required `_id` field. If you do not provide one, the driver generates an `ObjectId` — a 12-byte value designed to be globally unique *without any central coordinator handing out ids*. That last part is the interesting bit: how do thousands of independent MongoDB clients generate ids that never collide, with zero communication between them?

### 6.1 The 12-Byte Layout

The trick is baking uniqueness into the structure itself — time, machine, and a counter, glued together:

```text
┌───────────────────────────────────────────────────────────┐
│                   ObjectId — 12 Bytes                     │
├──────────────┬──────────────────┬────────┬────────────────┤
│  4 bytes     │  5 bytes         │ 3 bytes│                │
│  Unix        │  Random value    │ Incr.  │ Hex string     │
│  timestamp   │  (machine+proc)  │ counter│ representation │
│  (seconds)   │                  │        │                │
├──────────────┼──────────────────┼────────┼────────────────┤
│  64f1a2b3    │  c4d5e6f7a8      │ b9c0d1 │ 24 hex chars   │
└──────────────┴──────────────────┴────────┴────────────────┘
```

| Bytes | Content | Why |
|-------|---------|-----|
| 0–3 | Unix timestamp (big-endian seconds) | Documents are roughly sortable by insertion time for free |
| 4–8 | Random value per process | Ensures uniqueness across machines and processes |
| 9–11 | Incrementing counter (starts random) | Uniqueness within the same second and process |

### 6.2 Extracting the Timestamp

Here's the payoff of that layout: because the first 4 bytes are literally a Unix timestamp, you can pull the approximate creation time out of any `_id` — **without ever having stored a separate `createdAt` field**.

```js
// In mongosh
const id = ObjectId("64f1a2b3c4d5e6f7a8b9c0d1");
id.getTimestamp();
// ISODate("2023-09-01T10:22:27.000Z")
```

```js
// In Node.js application code
const createdAt = new mongoose.Types.ObjectId(doc._id).getTimestamp();
```

### 6.3 Custom _id Values

You are not required to use ObjectId. Any unique BSON value works:

```js
// String _id
db.countries.insertOne({ _id: "AU", name: "Australia", capital: "Canberra" });

// Number _id
db.products.insertOne({ _id: 10042, sku: "ABC-123", price: 29.99 });

// Compound _id (embedded document)
db.stockLevels.insertOne({ _id: { warehouse: "SYD", sku: "ABC-123" }, qty: 150 });
```

Use natural keys as `_id` when you know they are globally unique and will not change. Avoid mutable natural keys (email addresses, usernames) as `_id` — changing them is painful.

### 6.4 Sorting by ObjectId = Sorting by Insertion Time (Approximately)

```js
// Get the 10 most recently inserted documents
db.events.find().sort({ _id: -1 }).limit(10);
```

This is a free sort — no extra `createdAt` index needed — because ObjectId values are naturally ordered by the timestamp component.

**Interview answer:** "An ObjectId is 12 bytes: a 4-byte Unix timestamp, a 5-byte random value tied to the machine and process, and a 3-byte incrementing counter. Combining time, machine identity, and a counter lets every MongoDB client generate globally unique ids independently, with no coordination needed — and as a bonus, since the first bytes are a timestamp, ids are naturally sortable by creation time and can substitute for a `createdAt` field."

> **Memory hook:** "An ObjectId is a mini passport stamp — time, place, and serial number baked into one ID, no central office required."

---

## 7. Capped Collections

**The problem:** you want a rolling log — like the last 30 days of audit events, or the last 1000 chat messages — without writing a cleanup job that periodically deletes old rows. Wouldn't it be nice if the database just did that for you automatically?

### 7.1 What Is a Capped Collection?

A **capped collection** is a fixed-size, circular buffer. Once the collection reaches its configured size limit, MongoDB automatically overwrites the oldest documents as new ones are inserted.

**Real-world analogy:** think of a security camera recording loop — the last 48 hours are always available, and older footage just gets taped over automatically. Nobody has to remember to delete yesterday's tape.

```text
                    Capped Collection — Circular Buffer Analogy
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   New writes ──►  [ slot 1 ] [ slot 2 ] [ slot 3 ] ...       │
│                                                               │
│   When full:                                                  │
│   [ slot N+1 overwrites slot 1 ] ──► oldest data gone        │
│                                                               │
│   Think of it like a security camera recording loop:         │
│   the last 48 hours are always available, older footage      │
│   is automatically taped over.                                │
└───────────────────────────────────────────────────────────────┘
```

### 7.2 Creating a Capped Collection

```js
// Size is in BYTES; max is optional document count cap
db.createCollection("auditLog", {
  capped: true,
  size: 10485760,   // 10 MB
  max: 10000        // optional: also cap at 10,000 documents
});
```

Both `size` and `max` can be set; MongoDB enforces whichever limit is hit first.

### 7.3 Properties and Constraints

| Property | Detail |
|----------|--------|
| Insert order preserved | Documents are stored in natural insertion order |
| No deletions | You cannot delete individual documents from a capped collection |
| No document growth | Updates that increase document size are rejected |
| Auto-expiry | Oldest documents silently removed when size limit reached |
| Fast tailable cursors | Supports `tailable` cursors (like `tail -f` on a log file) |

### 7.4 Use Cases

```text
┌──────────────────────────────────────────────────────────────┐
│               Capped Collection Use Cases                    │
├──────────────────────────────────────────────────────────────┤
│  ✓  Application audit logs (keep last 30 days of events)    │
│  ✓  High-frequency sensor readings (rolling window)         │
│  ✓  Chat message history (last N messages per room)         │
│  ✓  Real-time event streams consumed by tailable cursors    │
│  ✓  Cache layer: recently viewed items, recent searches     │
│  ✗  Data that needs individual deletions                    │
│  ✗  Data that requires updates expanding document size      │
│  ✗  Long-term archival (use TTL indexes instead)             │
└──────────────────────────────────────────────────────────────┘
```

### 7.5 Tailable Cursors

Here's a neat trick that only works because insertion order is guaranteed: a tailable cursor stays open after reaching the last document and waits for new inserts, exactly like `tail -f` on a log file.

```js
// Node.js example — tailable cursor on a capped collection
const cursor = db.collection("auditLog").find(
  {},
  { tailable: true, awaitData: true }
);

for await (const doc of cursor) {
  console.log("New audit event:", doc);
}
```

### 7.6 Converting a Regular Collection to Capped

**Common mistake:** assuming you can just "flip a flag" on an existing collection to make it capped. You can't — you must recreate it:

```js
// 1. Export data if needed
// 2. Drop existing collection
db.myLogs.drop();
// 3. Recreate as capped
db.createCollection("myLogs", { capped: true, size: 5242880 }); // 5 MB
```

> **Memory hook:** "A capped collection is a security-camera tape loop, not a filing cabinet — new footage always overwrites the oldest, and you can't reach in and pull out a single frame."

---

## 8. Collections vs Tables: Side-by-Side

```text
┌────────────────────────┬──────────────────────┬──────────────────────┐
│ Concept                │ SQL (Relational)      │ MongoDB              │
├────────────────────────┼──────────────────────┼──────────────────────┤
│ Data unit              │ Row                  │ Document             │
│ Data group             │ Table                │ Collection           │
│ Database               │ Database / Schema    │ Database             │
│ Schema enforcement     │ DDL (CREATE TABLE)   │ Optional validator   │
│ Unique row identity    │ PRIMARY KEY          │ _id field            │
│ FK relationship        │ FOREIGN KEY          │ Manual reference     │
│ Join                   │ JOIN                 │ $lookup or embed     │
│ Nested data            │ Separate table + JOIN│ Embedded document    │
│ Lists/arrays           │ Junction table       │ Array field          │
│ Partial rows           │ NULL columns         │ Missing field        │
│ Row size limit         │ Varies (often < 8 KB)│ 16 MB per document   │
└────────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 9. BSON Under the Hood

MongoDB stores and transmits data in **BSON** (Binary JSON), not plain text JSON. Why not just use JSON directly? Because plain JSON is slow to parse (it's text — you have to scan character by character) and it's missing types MongoDB actually needs, like dates and precise decimals. BSON was designed to:

- Be fast to traverse (prefixed with byte lengths)
- Support additional types not in JSON (Date, Binary, ObjectId, Decimal128)
- Be compact for network transfer

### 9.1 Key BSON Types to Know

| BSON Type | JSON Equivalent | Notes |
|-----------|----------------|-------|
| Double | Number (float) | 64-bit IEEE 754 |
| String | String | UTF-8 |
| Object | Object `{}` | Embedded document |
| Array | Array `[]` | Ordered list |
| ObjectId | — | 12-byte unique id |
| Boolean | Boolean | |
| Date | — | 64-bit milliseconds since epoch |
| Null | null | |
| Int32 | Number (int) | 32-bit integer |
| Int64 / Long | Number (int) | 64-bit integer |
| Decimal128 | — | High-precision decimal (financial) |
| Binary | — | Raw bytes (files, UUIDs) |
| Timestamp | — | Internal MongoDB use (replication) |
| Regular Expression | — | `{ $regex: "pattern" }` |

### 9.2 Decimal128 for Financial Data

Here's a classic gotcha: **always use `Decimal128` for monetary values.** IEEE 754 doubles look precise, but they introduce floating-point rounding errors that are unacceptable once real money is involved:

```js
// BAD — floating point error
{ price: 0.1 + 0.2 }   // stored as 0.30000000000000004

// GOOD — exact decimal
{ price: NumberDecimal("0.30") }
```

> **Memory hook:** "Doubles are for measurements, Decimal128 is for money — nobody wants their invoice to say $0.30000000000000004."

---

## 10. Hands-On Exercises

Work through these in mongosh or Compass before moving on.

**Exercise 1 — Document Inspection**

Insert the following document into a `library` collection, then use dot notation to query books written by "Tolkien":

```js
db.library.insertOne({
  title: "The Fellowship of the Ring",
  author: { firstName: "J.R.R.", lastName: "Tolkien" },
  genres: ["fantasy", "adventure"],
  published: 1954,
  ratings: [
    { user: "alice", score: 5 },
    { user: "bob",   score: 4 }
  ]
});
// Your query here:
// db.library.find({ ??? })
```

**Exercise 2 — ObjectId Timestamp**

Insert 5 documents into a `log` collection with a 1-second `sleep()` between each, then verify that `_id.getTimestamp()` reflects insertion time:

```js
for (let i = 0; i < 5; i++) {
  db.log.insertOne({ msg: `Event ${i}` });
  sleep(1000);
}
db.log.find().forEach(doc => print(doc._id.getTimestamp()));
```

**Exercise 3 — Capped Collection**

Create a capped collection `recentSearches` limited to 5 documents, insert 8 documents, then verify only the last 5 remain:

```js
db.createCollection("recentSearches", { capped: true, size: 4096, max: 5 });
for (let i = 1; i <= 8; i++) {
  db.recentSearches.insertOne({ query: `search ${i}`, ts: new Date() });
}
db.recentSearches.find().toArray(); // should show only searches 4-8
```

**Exercise 4 — Schema Validation**

Create a `products` collection that rejects documents missing `sku` or `price`, then test it:

```js
db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["sku", "price"],
      properties: {
        price: { bsonType: "double", minimum: 0 }
      }
    }
  },
  validationAction: "error"
});
// This should succeed:
db.products.insertOne({ sku: "ABC-001", price: 19.99 });
// This should fail (missing sku):
db.products.insertOne({ price: 5.00 });
```

**Exercise 5 — Mixed-Type Exploration**

Insert documents into a `sensors` collection where the `value` field holds different types (int, string, embedded doc). Then use `$type` to find only numeric readings:

```js
db.sensors.insertMany([
  { deviceId: "D01", value: 23 },
  { deviceId: "D02", value: "offline" },
  { deviceId: "D03", value: { celsius: 21.5, fahrenheit: 70.7 } },
  { deviceId: "D04", value: null }
]);
// Find only numeric values:
db.sensors.find({ value: { $type: ["int", "double", "decimal"] } });
```

---

## 11. Interview Q&A

**Q1: What is the maximum size of a MongoDB document, and why does that limit exist?**

A: 16 MB. The limit prevents any single document from monopolising available RAM or causing unpredictable network latency. It also discourages the anti-pattern of embedding unlimited child data in a parent document.

---

**Q2: What is schema-on-read, and how does it differ from schema-on-write?**

A: Schema-on-write means the database enforces the schema before storing data (SQL DDL). Schema-on-read means the database stores whatever is given; the application interprets the shape when it reads data back. MongoDB defaults to schema-on-read but allows optional JSON Schema validators for enforcement.

---

**Q3: Explain the anatomy of an ObjectId.**

A: An ObjectId is 12 bytes: 4 bytes of Unix timestamp (seconds), 5 bytes of a random value tied to the machine and process, and 3 bytes of an incrementing counter starting at a random value. This design ensures global uniqueness without a central coordinator.

---

**Q4: How would you extract the creation time from a document without a `createdAt` field?**

A: If the `_id` is an ObjectId, call `_id.getTimestamp()` in mongosh or use the equivalent driver method. The first 4 bytes of an ObjectId encode the Unix timestamp in seconds.

---

**Q5: What is a capped collection? Name two real-world use cases.**

A: A capped collection is a fixed-size circular buffer where the oldest documents are automatically overwritten when the collection reaches its size limit. Use cases: application audit logs (retain last N days), real-time event streams consumed via tailable cursors.

---

**Q6: Can you delete a specific document from a capped collection?**

A: No. Individual deletions are not supported. The only way to remove data from a capped collection is to drop the entire collection or wait for the circular buffer to overwrite old entries.

---

**Q7: Why should monetary values use Decimal128 instead of Double?**

A: IEEE 754 double-precision floats cannot represent all decimal fractions exactly (e.g., 0.1 + 0.2 = 0.30000000000000004). Decimal128 is a high-precision decimal type that avoids these rounding errors, which are critical in financial calculations.

---

**Q8: What does dot notation allow you to do in MongoDB queries?**

A: Dot notation allows you to query and project fields within nested (embedded) documents and arrays without loading the entire parent document. For example, `"shippingAddress.city"` queries the `city` field inside the `shippingAddress` subdocument.

---

**Q9: What are the constraints on field names in a MongoDB document?**

A: Field names must be strings. They cannot start with `$` (reserved for query operators) and cannot contain `.` (used as the dot-notation path separator). The `_id` field name is reserved and must always be unique within a collection.

---

**Q10: Describe GridFS and when you would use it.**

A: GridFS is a MongoDB specification for storing and retrieving files larger than 16 MB. It splits files into 255 KB chunks stored in `fs.chunks`, and stores metadata (filename, uploadDate, contentType) in `fs.files`. Use it for large binary files (PDFs, videos, firmware images) when you want to keep file storage inside MongoDB rather than a separate object store.

---

**Q11: What happens if you try to insert a document larger than 16 MB?**

A: MongoDB throws a `BSONObj size invalid` error and the insert is rejected. The document never touches the collection.

---

**Q12: What is the difference between `_id: ObjectId()` and `_id: UUID()`?**

A: Both are unique identifiers but differ in format. `ObjectId` is 12 bytes and embeds a timestamp. `UUID` is 16 bytes (a binary subtype in BSON) and is fully random with no embedded timestamp. Use ObjectId for MongoDB-native apps; use UUID when you need interoperability with other systems that expect standard UUIDs.

---

**Q13: How do you enforce that a field must exist in all new documents without using SQL-style DDL?**

A: Use MongoDB's JSON Schema validator with `required` array in `$jsonSchema`. Existing documents are not retroactively validated; only new inserts and updates are checked.

---

**Q14: What is a tailable cursor and which collection type supports it?**

A: A tailable cursor stays open after reaching the last document and waits for new inserts, similar to `tail -f` on a log file. Only capped collections support tailable cursors because their insert-order guarantee is required for correct cursor position tracking.

---

**Q15: If two documents are inserted within the same second from two different servers, will their ObjectIds collide?**

A: Very unlikely. The 5-byte random component includes process-specific randomness. Even in the same second, the combination of random value and incrementing counter makes collisions statistically negligible. MongoDB's ObjectId generation is designed for distributed systems precisely to avoid the need for a central ID coordinator.
