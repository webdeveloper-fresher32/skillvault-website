# 02 — Pipeline Stages

## Table of Contents

1. [$match — Filter Documents](#1-match--filter-documents)
2. [$project — Reshape Documents](#2-project--reshape-documents)
3. [$group — Aggregate and Accumulate](#3-group--aggregate-and-accumulate)
4. [$sort — Order the Stream](#4-sort--order-the-stream)
5. [$limit and $skip — Pagination](#5-limit-and-skip--pagination)
6. [$unwind — Deconstruct Arrays](#6-unwind--deconstruct-arrays)
7. [$lookup — Join Collections](#7-lookup--join-collections)
8. [$addFields — Add Computed Fields](#8-addfields--add-computed-fields)
9. [$replaceRoot — Promote a Sub-document](#9-replaceroot--promote-a-sub-document)
10. [$count — Count Documents](#10-count--count-documents)
11. [$facet — Multi-dimensional Aggregation](#11-facet--multi-dimensional-aggregation)
12. [$bucket and $bucketAuto — Histogram Bucketing](#12-bucket-and-bucketauto--histogram-bucketing)
13. [$out and $merge — Write Results](#13-out-and-merge--write-results)
14. [Stage Quick-Reference Table](#14-stage-quick-reference-table)
15. [Hands-On Exercises](#15-hands-on-exercises)
16. [Interview Q&A](#16-interview-qa)

---

## Setup — Sample Collections

The last file introduced the refinery analogy: raw documents go in one end, a series of single-purpose processing units (stages) work on them one at a time, and a refined result comes out the other end. This file is the parts catalog for that refinery — every unit you can bolt onto the assembly line, what it actually does to a document, and where people usually trip over it.

Insert these before trying the examples:

```js
// orders collection
db.orders.drop()
db.orders.insertMany([
  { _id: 1, customerId: "C1", status: "completed", region: "APAC",
    items: [ { sku: "A1", qty: 2, price: 50 }, { sku: "B2", qty: 1, price: 120 } ],
    createdAt: ISODate("2025-01-15") },
  { _id: 2, customerId: "C2", status: "completed", region: "EMEA",
    items: [ { sku: "A1", qty: 5, price: 50 }, { sku: "C3", qty: 2, price: 80 } ],
    createdAt: ISODate("2025-01-20") },
  { _id: 3, customerId: "C1", status: "cancelled", region: "APAC",
    items: [ { sku: "D4", qty: 1, price: 200 } ],
    createdAt: ISODate("2025-02-01") },
  { _id: 4, customerId: "C3", status: "completed", region: "AMER",
    items: [ { sku: "B2", qty: 3, price: 120 }, { sku: "E5", qty: 1, price: 300 } ],
    createdAt: ISODate("2025-02-14") },
  { _id: 5, customerId: "C2", status: "pending", region: "EMEA",
    items: [ { sku: "A1", qty: 10, price: 50 } ],
    createdAt: ISODate("2025-03-05") }
])

// customers collection
db.customers.drop()
db.customers.insertMany([
  { _id: "C1", name: "Acme Corp",    country: "AU", tier: "gold"   },
  { _id: "C2", name: "Beta Ltd",     country: "DE", tier: "silver" },
  { _id: "C3", name: "Gamma Inc",    country: "US", tier: "gold"   },
  { _id: "C4", name: "Delta Co",     country: "JP", tier: "bronze" }
])
```

---

## 1. $match — Filter Documents

**The problem:** you rarely want to process your *entire* collection. Usually you want "just the completed orders" or "just APAC region" — and you want that filter applied as early as physically possible, before any of the expensive work happens.

**The analogy:** `$match` is the bouncer at the door of the refinery. It doesn't reshape anything, doesn't compute anything — it just decides who's allowed in. Everyone who doesn't match gets turned away right there, before they ever reach the expensive machinery further down the line.

`$match` filters documents exactly like the `find()` query document. It accepts all MongoDB query operators.

```
Input stream  ──►  $match  ──►  Only matching documents pass through
```

### Syntax

```js
{ $match: <query document> }
```

### Examples

```js
// Simple equality
{ $match: { status: "completed" } }

// Comparison operators
{ $match: { "items.price": { $gte: 100 } } }

// Date range
{ $match: { createdAt: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") } } }

// Logical operators
{ $match: { $and: [ { region: "APAC" }, { status: "completed" } ] } }
{ $match: { $or:  [ { status: "completed" }, { status: "pending" } ] } }

// Array contains element
{ $match: { "items.sku": "A1" } }

// Regex
{ $match: { "customer.name": { $regex: /^Acme/, $options: "i" } } }
```

### Pipeline example

```js
// Completed APAC orders
db.orders.aggregate([
  { $match: { status: "completed", region: "APAC" } }
])
```

### Performance note

`$match` at the start of a pipeline can use an index. Every document that `$match` eliminates is a document that never reaches downstream stages. This is the single most impactful optimization you can apply.

> **Memory hook:** "`$match` is the bouncer — turn people away at the door, not after they've already eaten the buffet."

---

## 2. $project — Reshape Documents

**The problem:** a raw document usually carries more (or less) than the shape you actually want to hand back to the client — extra internal fields, missing computed values, awkward nesting.

**The analogy:** think of `$project` as a custom stencil. You lay it over each document and only what's cut out of the stencil (plus anything you draw on fresh) makes it through.

`$project` controls which fields appear in the output document and can compute new fields using expressions.

```
Input doc  ──►  $project  ──►  Reshaped doc (new shape, same data)
```

### Syntax

```js
{ $project: {
    field1: 1,           // include
    field2: 0,           // exclude
    newField: <expr>     // compute and include
} }
```

### Include / exclude

```js
// Include only _id, customerId, status (all other fields dropped)
{ $project: { customerId: 1, status: 1 } }

// Exclude _id (otherwise _id is always included)
{ $project: { customerId: 1, status: 1, _id: 0 } }

// Exclude one field, keep everything else
{ $project: { internalCode: 0 } }
```

### Computed fields — string operators

```js
{ $project: {
  // $concat joins strings
  fullLabel: { $concat: ["Order #", { $toString: "$_id" }, " - ", "$status"] },

  // $toUpper / $toLower
  regionUpper: { $toUpper: "$region" },
  statusLower: { $toLower: "$status" },

  // $substr (string, start, length)
  shortRegion: { $substr: ["$region", 0, 2] },     // "APAC" → "AP"

  // $strLenCP — character length
  regionLen: { $strLenCP: "$region" }
} }
```

### Computed fields — arithmetic operators

```js
{ $project: {
  // $add, $subtract, $multiply, $divide
  totalValue: { $multiply: ["$qty", "$price"] },
  discount:   { $multiply: ["$price", 0.1] },
  netPrice:   { $subtract: ["$price", { $multiply: ["$price", 0.1] }] },

  // $abs, $ceil, $floor, $round
  roundedPrice: { $round: ["$price", 2] },

  // $mod — remainder
  remainder: { $mod: ["$qty", 3] }
} }
```

### Conditional expressions

```js
{ $project: {
  // $cond — if / then / else
  label: {
    $cond: {
      if:   { $gte: ["$amount", 1000] },
      then: "high-value",
      else: "standard"
    }
  },

  // Short-form $cond (ternary array)
  label2: { $cond: [ { $gte: ["$amount", 1000] }, "high-value", "standard" ] },

  // $ifNull — substitute when field is null or missing
  displayRegion: { $ifNull: ["$region", "Unknown"] },

  // $switch — multi-branch if/else
  tier: {
    $switch: {
      branches: [
        { case: { $gte: ["$amount", 5000] }, then: "platinum" },
        { case: { $gte: ["$amount", 1000] }, then: "gold"     },
        { case: { $gte: ["$amount",  500] }, then: "silver"   }
      ],
      default: "bronze"
    }
  }
} }
```

### Nested field access and renaming

```js
{ $project: {
  orderId:    "$_id",
  customerRef: "$customerId",
  firstItem:   { $arrayElemAt: ["$items", 0] },
  itemCount:   { $size: "$items" }
} }
```

---

## 3. $group — Aggregate and Accumulate

**The problem:** so far every stage has worked one document at a time. But most of the interesting business questions — "total revenue by region," "how many orders per customer" — need to look at *many* documents and boil them down into one number. Nothing so far can do that.

**The analogy:** `$group` is a sorting office. Every parcel (document) gets thrown into a bin based on its label (the grouping key). Once every parcel has arrived and been sorted, each bin gets weighed, counted, and summarized. You can't announce a bin's final weight halfway through — you have to wait until every parcel that belongs there has actually arrived.

That's the important bit to notice: `$group` is the first stage in this file that has to **wait and see everything** before it can produce a single output document. `$match` and `$project` handle one document and move on; `$group` cannot.

`$group` is the most powerful stage. It collapses the document stream into groups, applying **accumulator** expressions to each group.

```
Many documents ──►  $group  ──►  One document per unique _id value
```

### Syntax

```js
{ $group: {
    _id: <expression>,           // grouping key (null = all docs as one group)
    <outputField>: { <accumulator>: <expression> },
    ...
} }
```

### Grouping key options

```js
// Group by single field
{ $group: { _id: "$region" } }

// Group by multiple fields (compound key)
{ $group: { _id: { region: "$region", status: "$status" } } }

// Group ALL documents into one (grand total)
{ $group: { _id: null, grandTotal: { $sum: "$amount" } } }

// Group by expression
{ $group: { _id: { $toUpper: "$status" } } }
```

### All accumulators

#### $sum

```js
// Count documents in each group
{ $group: { _id: "$region", count: { $sum: 1 } } }

// Sum a numeric field
{ $group: { _id: "$region", totalRevenue: { $sum: "$amount" } } }

// Sum a computed expression
{ $group: { _id: "$customerId",
            totalItems: { $sum: { $size: "$items" } } } }
```

#### $avg

```js
{ $group: { _id: "$region", avgOrderValue: { $avg: "$amount" } } }
```

#### $min and $max

```js
{ $group: { _id: "$region",
            smallestOrder: { $min: "$amount" },
            largestOrder:  { $max: "$amount" },
            earliestOrder: { $min: "$createdAt" },
            latestOrder:   { $max: "$createdAt" } } }
```

#### $count (MongoDB 5.0+)

```js
// Simpler than { $sum: 1 }
{ $group: { _id: "$region", orderCount: { $count: {} } } }
```

#### $push — collect all values into an array

```js
// Collect all order IDs per customer
{ $group: { _id: "$customerId", orderIds: { $push: "$_id" } } }

// Collect entire sub-documents
{ $group: { _id: "$region",
            allOrders: { $push: { id: "$_id", amount: "$amount" } } } }
```

#### $addToSet — collect unique values into an array

```js
// Unique SKUs ordered per customer (no duplicates)
{ $group: { _id: "$customerId", uniqueSkus: { $addToSet: "$sku" } } }
```

#### $first and $last

Returns the first/last value seen for a field within the group. Only meaningful if the documents are sorted before `$group`.

```js
// Most recent order per customer (sort by createdAt desc first)
db.orders.aggregate([
  { $sort:  { createdAt: -1 } },
  { $group: { _id: "$customerId",
              latestOrderId:     { $first: "$_id" },
              latestOrderDate:   { $first: "$createdAt" },
              latestOrderStatus: { $first: "$status" } } }
])
```

#### $stdDevPop and $stdDevSamp

```js
// Population standard deviation of order amounts per region
{ $group: { _id: "$region",
            stdDev: { $stdDevPop: "$amount" },
            stdDevSample: { $stdDevSamp: "$amount" } } }
```

### Full example — comprehensive group

```js
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: {
      _id: "$region",
      orderCount:    { $sum: 1 },
      totalRevenue:  { $sum: "$amount" },
      avgOrderValue: { $avg: "$amount" },
      minOrder:      { $min: "$amount" },
      maxOrder:      { $max: "$amount" },
      customers:     { $addToSet: "$customerId" }
  }},
  { $addFields: { customerCount: { $size: "$customers" } } },
  { $sort: { totalRevenue: -1 } }
])
```

### Common mistakes with $group

- **Forgetting `$group` erases the original document shape.** Once you group, the only fields available downstream are `_id` and whatever accumulators you defined. If you needed `customerName` later, you had to carry it through an accumulator like `$first`.
- **Using `$first`/`$last` without sorting first.** Without an explicit `$sort` immediately before the `$group`, "first" and "last" are whatever order the documents happen to arrive in — which is not guaranteed to mean anything.
- **Confusing `$push` with `$addToSet`** — see the comparison below.

### $push vs $addToSet

| | `$push` | `$addToSet` |
|---|---|---|
| Duplicates | Kept | Removed |
| Order | Insertion order preserved | Not guaranteed |
| Use case | "All order IDs" | "Unique SKUs" |

**Interview answer:** "`$group` collapses a stream of documents into one output document per distinct value of the `_id` expression, applying accumulator operators like `$sum`, `$avg`, `$push`, and `$addToSet` to compute per-group values. It's a blocking stage — it must see every document that could belong to a group before it can emit that group's result — which is why it's subject to the 100 MB per-stage memory limit on large datasets."

> **Memory hook:** "`$group` is the sorting office — parcels go in bins by label, and nobody gets to announce a bin's total weight until the last parcel for that bin has arrived."

---

## 4. $sort — Order the Stream

**The problem:** raw results usually come back in whatever order the storage engine happens to hand them over — not the order that's actually useful to a human or an API consumer.

**The analogy:** `$sort` is exactly what it sounds like — a librarian re-shelving books by whatever rule you give them (alphabetical, newest-first, whatever).

```js
{ $sort: { <field>: 1 | -1, ... } }
// 1 = ascending (A→Z, oldest→newest, smallest→largest)
// -1 = descending
```

```js
// Sort by total descending, then by region ascending (tie-break)
{ $sort: { total: -1, region: 1 } }

// Sort by nested field
{ $sort: { "address.city": 1 } }
```

**Index-backed sort:** If `$sort` is the first stage (or immediately after an index-backed `$match`), MongoDB can use an index to avoid loading all documents for sorting.

**Memory:** Without an index, `$sort` is a blocking stage (must see all documents). Subject to the 100 MB limit. Use `allowDiskUse: true` for large sorts.

> **Memory hook:** "No index, no shortcuts — `$sort` has to see every book before it can put them on the shelf in order."

---

## 5. $limit and $skip — Pagination

**The problem:** nobody wants ten thousand rows dumped on one screen. You want page 3, ten results at a time.

**The analogy:** `$limit` is a bouncer with a headcount ("only the first 10 get in"); `$skip` is a velvet rope ("the first 30 people don't count, start from 31").

```js
{ $limit: <positive integer> }   // take first N documents
{ $skip:  <positive integer> }   // drop first N documents
```

### Pagination pattern

```js
const PAGE_SIZE = 10
const PAGE = 3   // 0-indexed

db.orders.aggregate([
  { $match:  { status: "completed" } },
  { $sort:   { createdAt: -1 } },
  { $skip:   PAGE * PAGE_SIZE },   // skip first 30
  { $limit:  PAGE_SIZE }           // take next 10
])
```

### Important: $sort + $limit optimization

Adjacent `$sort` + `$limit` are automatically merged into an efficient top-K sort:

```js
// MongoDB internally treats this as one operation
{ $sort: { amount: -1 } },
{ $limit: 5 }
// → Finds top-5 without sorting the entire collection
```

> **Memory hook:** "`$skip` + `$limit` is just a velvet rope and a headcount for the club at the end of the pipeline."

---

## 6. $unwind — Deconstruct Arrays

**The problem:** an order document has an `items` array with 2, 5, or 10 line items packed inside. But what if the question you need to answer is per-item — "total revenue by SKU across all orders"? You can't `$group` by something buried inside an array; you first need one document *per item*, not one document per order.

**The analogy:** imagine a shopping receipt with five items printed on one slip of paper. `$unwind` is a photocopier that tears that single receipt into five separate slips — one per item — but photocopies the store name and date onto every single one of them.

`$unwind` takes an array field and outputs one document per array element, copying all other fields.

```
Before $unwind:
{ _id: 1, tags: ["mongodb", "nosql", "database"] }

After { $unwind: "$tags" }:
{ _id: 1, tags: "mongodb"  }
{ _id: 1, tags: "nosql"    }
{ _id: 1, tags: "database" }
```

### Basic syntax

```js
{ $unwind: "$arrayField" }
```

### Full syntax with options

```js
{ $unwind: {
    path: "$items",
    includeArrayIndex: "itemIndex",          // adds a field with the 0-based array index
    preserveNullAndEmptyArrays: true         // keep docs where the array is null/missing/empty
} }
```

### includeArrayIndex example

```js
db.orders.aggregate([
  { $unwind: { path: "$items", includeArrayIndex: "itemPosition" } },
  { $project: { _id: 1, itemPosition: 1, "items.sku": 1, "items.price": 1 } }
])
// Output includes: { _id: 1, itemPosition: 0, items: { sku: "A1", price: 50 } }
//                  { _id: 1, itemPosition: 1, items: { sku: "B2", price: 120 } }
```

### preserveNullAndEmptyArrays example

```js
// Without this option, documents with no "tags" array are silently dropped
db.posts.aggregate([
  { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } }
])
```

### Common pattern: $unwind + $group to work with array elements

```js
// Total revenue per SKU across all orders
db.orders.aggregate([
  { $unwind: "$items" },
  { $group: {
      _id: "$items.sku",
      totalQty:     { $sum: "$items.qty" },
      totalRevenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
  }},
  { $sort: { totalRevenue: -1 } }
])
```

### Common mistakes with $unwind

- **Silently losing documents.** By default, if `items` is missing, `null`, or `[]`, the document does not survive `$unwind` at all — it just vanishes from the stream. This surprises people constantly. If you need to keep those documents, you must explicitly pass `preserveNullAndEmptyArrays: true`.
- **Forgetting it multiplies documents.** An order with 5 items becomes 5 separate documents after `$unwind`. If you `$count` afterward expecting "number of orders," you'll actually get "number of line items."
- **Unwinding before filtering when the filter doesn't need array-level detail.** If your `$match` only needs order-level fields (like `status`), do it *before* `$unwind` — there's no reason to multiply out every array element just to throw most of them away afterward.

**Interview answer:** "`$unwind` deconstructs an array field, outputting one document per array element while copying every other field from the parent document. It's how you get from 'one order document with an items array' to 'one document per line item,' which then lets you `$group` or `$match` on fields that live inside that array. By default it drops documents where the array is missing or empty, which is a very common source of unexpected missing results."

> **Memory hook:** "`$unwind` is a photocopier — one receipt with five items becomes five slips, each stamped with the same store name and date."

---

## 7. $lookup — Join Collections

**The problem:** your `orders` collection stores a `customerId`, but the customer's name and tier live in a completely separate `customers` collection. You need both, in one result.

**The analogy:** `$lookup` is the reference desk at a library. You hand over a call number (`customerId`), the reference desk goes and finds every book with a matching number in another section (`customers`), and hands you back the results as a small stack (an array) attached to your original request.

`$lookup` performs a **left outer join** — for each document in the pipeline, it queries another collection and attaches matching documents as an array field.

```
orders (left)  ──►  $lookup  ──►  orders with embedded customer array
customers (right)
```

### Simple form

```js
{ $lookup: {
    from:         "customers",      // the collection to join
    localField:   "customerId",     // field in the current pipeline document
    foreignField: "_id",            // field in the "from" collection
    as:           "customerInfo"    // output array field name
} }
```

Full example:

```js
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $lookup: {
      from:         "customers",
      localField:   "customerId",
      foreignField: "_id",
      as:           "customer"
  }},
  // "customer" is now an array with 0 or 1 elements
  // Use $unwind to flatten it to a single object
  { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
  { $project: {
      _id: 1,
      status: 1,
      customerName: "$customer.name",
      customerTier: "$customer.tier"
  }}
])
```

### Pipeline form (MongoDB 3.6+)

Allows filtering and reshaping of the joined documents before embedding, and supports joining on computed expressions (not just field equality).

```js
{ $lookup: {
    from:     "customers",
    let:      { ordCustomerId: "$customerId" },    // expose left-side fields
    pipeline: [
      { $match: { $expr: { $eq: ["$_id", "$$ordCustomerId"] } } },
      { $project: { name: 1, tier: 1, _id: 0 } }   // project only needed fields
    ],
    as: "customer"
} }
```

This form is more flexible and can be more efficient when the joined collection is large (you can add indexes and filters inside the pipeline).

### Correlated sub-queries with $lookup pipeline

```js
// For each customer, find their most recent completed order
db.customers.aggregate([
  { $lookup: {
      from: "orders",
      let:  { cid: "$_id" },
      pipeline: [
        { $match: { $expr: { $and: [
            { $eq: ["$customerId", "$$cid"] },
            { $eq: ["$status", "completed"] }
        ]}}},
        { $sort:  { createdAt: -1 } },
        { $limit: 1 }
      ],
      as: "latestOrder"
  }},
  { $unwind: { path: "$latestOrder", preserveNullAndEmptyArrays: true } }
])
```

### Simple form vs pipeline form

| | Simple form | Pipeline form |
|---|---|---|
| Join condition | Field equality only | Any expression |
| Filtering joined docs | No (must `$match` after) | Yes, inside the join |
| Projecting joined docs | No (must `$project` after) | Yes, inside the join |
| Nested `$lookup` | Not directly | Yes |
| Introduced | Always available | MongoDB 3.6+ |

### Common mistakes with $lookup

- **Forgetting the result is always an array.** Even a one-to-one relationship comes back as `customer: [ {...} ]`, not `customer: {...}`. If you skip the `$unwind`, every downstream reference to `$customer.name` will silently return nothing.
- **Dropping unmatched documents by accident.** `$lookup` itself is a left outer join — unmatched left-side documents are kept, just with an empty array. But if you then `$unwind` that array *without* `preserveNullAndEmptyArrays: true`, those unmatched documents get thrown away at that step. The join wasn't the problem; the unwind was.
- **Joining before filtering.** `$lookup` is one of the more expensive stages. If a `$match` can run first and shrink the left-side document count, do that before joining, not after.

**Interview answer:** "`$lookup` performs a left outer join between the current pipeline's documents and another collection. The simple form matches on field equality and always returns an array (even for 1:1 relationships), which is why it's almost always followed by `$unwind`. The pipeline form, using `let` and a sub-pipeline, supports arbitrary match conditions, filtering, and projection of the joined data — making it suitable for correlated sub-queries, like 'find each customer's most recent order.'"

> **Memory hook:** "`$lookup` is the reference desk — hand over a call number, get back a stack of matches, always as a stack (an array) even if there's only one book in it."

---

## 8. $addFields — Add Computed Fields

**The problem:** sometimes you just want to bolt one or two new fields onto a document — you don't want to retype every field you already have just to keep it (which is what `$project` would force you to do).

**The analogy:** if `$project` is a stencil that only lets through what you explicitly cut, `$addFields` is a sticky note — it adds new information to the document without touching or hiding anything that was already there.

`$addFields` is like `$project` but **only adds** new fields — it keeps all existing fields instead of requiring you to explicitly include them.

```js
{ $addFields: { <newField>: <expression>, ... } }
```

This is especially useful when you want to enrich documents without rebuilding the entire projection:

```js
db.orders.aggregate([
  { $unwind: "$items" },
  { $addFields: {
      "items.lineTotal": { $multiply: ["$items.qty", "$items.price"] },
      orderMonth: { $month: "$createdAt" },
      orderYear:  { $year: "$createdAt" }
  }}
])
```

You can also use `$addFields` to overwrite an existing field:

```js
// Normalize status to uppercase
{ $addFields: { status: { $toUpper: "$status" } } }
```

> **Memory hook:** "`$project` is a stencil — only what's cut through survives. `$addFields` is a sticky note — everything stays, plus whatever you write on top."

---

## 9. $replaceRoot — Promote a Sub-document

**The problem:** after a `$lookup` + `$unwind`, or when working with a document that has a meaningful nested object, you sometimes want that nested object to *become* the whole document, not just a field inside it.

**The analogy:** think of it like unpacking a box-within-a-box — instead of keeping the outer shipping box, you throw it away and just keep the inner box as the new "root" item.

`$replaceRoot` replaces the entire pipeline document with a specified sub-document. Often used after `$lookup` to flatten the joined document to the top level.

```js
{ $replaceRoot: { newRoot: <expression> } }
```

### Example

```js
// If each document has an "address" sub-document, promote it to root
db.users.aggregate([
  { $replaceRoot: { newRoot: "$address" } }
])
// Output: { street: "123 Main St", city: "Sydney", country: "AU" }
//         (user-level fields like _id, name are gone)
```

### Merging root with sub-document using $mergeObjects

```js
// Keep top-level fields AND merge in the address fields
db.users.aggregate([
  { $replaceRoot: {
      newRoot: { $mergeObjects: [ "$$ROOT", "$address" ] }
  }}
])
```

> **Memory hook:** "`$replaceRoot` throws away the shipping box and keeps just the inner box as the new item — unless you `$mergeObjects` the two together first."

---

## 10. $count — Count Documents

**The problem:** sometimes all you want out of a whole pipeline is a single number — "how many completed orders are there?" — and writing a full `$group` for that feels like overkill.

`$count` is a shorthand for `{ $group: { _id: null, n: { $sum: 1 } } }` followed by renaming. It returns a single document with the count.

```js
{ $count: "<outputFieldName>" }
```

```js
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $count: "completedOrders" }
])
// Output: { "completedOrders": 3 }
```

> **Memory hook:** "`$count` is `$group: { _id: null, $sum: 1 }` with the paperwork already filled out for you."

---

## 11. $facet — Multi-dimensional Aggregation

**The problem:** you're building a dashboard. It needs a summary card, a breakdown-by-region chart, and a top-3-customers list — all from the *same* underlying data, all on the *same* page load. Running three separate `aggregate()` calls means scanning the same input three times.

**The analogy:** picture a single conveyor belt of raw material feeding into three completely separate machines at once — one stamps out summary parts, one stamps out regional breakdowns, one stamps out a top-3 list — and at the end, all three outputs get boxed together into a single shipment.

`$facet` runs **multiple independent sub-pipelines** on the same input documents in a single aggregation pass. Each sub-pipeline operates on the same input and produces its own output array field.

```
                         ┌──► sub-pipeline A ──► result A ─┐
Input stream ──►  $facet ├──► sub-pipeline B ──► result B ─┤──► one document
                         └──► sub-pipeline C ──► result C ─┘
```

### Syntax

```js
{ $facet: {
    <outputFieldA>: [ <stage>, <stage>, ... ],
    <outputFieldB>: [ <stage>, <stage>, ... ],
    ...
} }
```

### Example — dashboard in one query

```js
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $facet: {
      summary: [
        { $group: { _id: null,
            totalOrders:   { $sum: 1 },
            totalRevenue:  { $sum: "$amount" },
            avgOrderValue: { $avg: "$amount" }
        }}
      ],
      byRegion: [
        { $group: { _id: "$region", count: { $sum: 1 }, revenue: { $sum: "$amount" } } },
        { $sort:  { revenue: -1 } }
      ],
      topCustomers: [
        { $group: { _id: "$customerId", spend: { $sum: "$amount" } } },
        { $sort:  { spend: -1 } },
        { $limit: 3 }
      ]
  }}
])
// Returns ONE document with three fields: summary, byRegion, topCustomers
```

**Note:** `$facet` is a **blocking** stage — it must consume all input documents before running sub-pipelines. The input is held in memory (subject to the 100 MB per-stage limit). Filter aggressively before `$facet`.

### Common mistakes with $facet

- **Not filtering before `$facet`.** Since every sub-pipeline re-processes the same input, an unfiltered `$facet` on a huge collection multiplies the cost by the number of facets. Always `$match` down to the relevant subset first.
- **Expecting index usage inside sub-pipelines.** Indexes generally don't help stages nested inside a `$facet` sub-pipeline the way they would as the very first stage of a top-level pipeline — treat the input to `$facet` as already fully materialized in memory.
- **Trying to use `$facet` output as if it were a normal document stream.** The output is a single document whose fields are arrays — you typically need one more `$project` or `$unwind` per facet if you want to reshape it further downstream.

**Interview answer:** "`$facet` runs several independent aggregation sub-pipelines against the exact same set of input documents in a single pass, producing one output document where each field holds the result array of one sub-pipeline. It's how you build a dashboard — totals, breakdowns, and top-N lists — in one round trip instead of three. The cost is that it's a blocking stage: the entire input must be buffered in memory before any sub-pipeline can run, so filtering aggressively beforehand matters even more than usual."

> **Memory hook:** "One conveyor belt, three machines running at once, one box at the end holding all three outputs."

---

## 12. $bucket and $bucketAuto — Histogram Bucketing

**The problem:** you want a histogram — "how many orders cost $0–500, $500–1000, $1000–2000, $2000+?" You *could* fake this with `$group` and a pile of nested `$cond` expressions, but it's clunky and easy to get wrong.

**The analogy:** think of sorting mail into pigeonholes labeled by ZIP code range. `$bucket` is when *you* decide where the dividers between pigeonholes go. `$bucketAuto` is handing the whole pile to an assistant and saying "just make the piles roughly even size, however you want."

### $bucket — user-defined boundaries

Groups documents into user-specified ranges. Every document must fall within a defined boundary or be routed to a `default` bucket.

```js
{ $bucket: {
    groupBy:    <expression>,     // value to bucket
    boundaries: [<val1>, <val2>, ...],  // N values define N-1 buckets
    default:    <literal>,        // bucket for values outside all boundaries
    output:     { <field>: <accumulator> }  // optional custom output
} }
```

```js
// Bucket orders by amount: 0-499, 500-999, 1000-1999, 2000+
db.orders.aggregate([
  { $bucket: {
      groupBy:    "$amount",
      boundaries: [0, 500, 1000, 2000],
      default:    "2000+",
      output: {
        count:   { $sum: 1 },
        revenue: { $sum: "$amount" }
      }
  }}
])
// Output:
// { _id: 0,      count: 2, revenue: 850  }   (0 ≤ amount < 500)
// { _id: 500,    count: 3, revenue: 2500 }   (500 ≤ amount < 1000)
// { _id: 1000,   count: 4, revenue: 5800 }   (1000 ≤ amount < 2000)
// { _id: "2000+", count: 1, revenue: 2200 }
```

### $bucketAuto — automatic equal-distribution buckets

MongoDB chooses bucket boundaries automatically to distribute documents as evenly as possible.

```js
{ $bucketAuto: {
    groupBy: <expression>,
    buckets: <number of buckets>,
    output:  { <field>: <accumulator> },  // optional
    granularity: "R5" | "R10" | "1-2-5" | "E6" | ...  // optional rounding scheme
} }
```

```js
db.orders.aggregate([
  { $bucketAuto: {
      groupBy: "$amount",
      buckets: 4,
      output: { count: { $sum: 1 }, avgAmount: { $avg: "$amount" } }
  }}
])
// MongoDB automatically chooses 4 equal-size ranges
// Output includes: { _id: { min: 0, max: 500 }, count: 2, avgAmount: 425 }
```

### $bucket vs $bucketAuto

| | `$bucket` | `$bucketAuto` |
|---|---|---|
| Boundaries | You define them explicitly | MongoDB computes them |
| Best for | Known, meaningful ranges (price tiers) | Exploratory analysis, unknown distribution |
| Documents outside range | Go to `default` bucket | Never happens — buckets always cover full range |
| Bucket sizes | Can be uneven (by design) | Roughly even document count per bucket |

### Common mistakes with $bucket

- **Forgetting the `default` bucket.** If a document's value falls outside every boundary and you didn't specify `default`, the pipeline errors out instead of silently dropping the document.
- **Off-by-one confusion on boundaries.** `boundaries: [0, 500, 1000, 2000]` creates *three* buckets (`[0,500)`, `[500,1000)`, `[1000,2000)`), each half-open — inclusive of the lower bound, exclusive of the upper. Anything ≥ 2000 falls to `default`.
- **Reaching for `$bucket` when a plain `$match` range query would do.** `$bucket` shines when you need *several* ranges computed in one pass — for a single range check, a `$match` is simpler.

**Interview answer:** "`$bucket` groups documents into caller-defined numeric ranges, producing a histogram-style summary — it's the aggregation equivalent of `GROUP BY CASE WHEN ... THEN ...` in SQL, but purpose-built and more efficient. `$bucketAuto` does the same job but lets MongoDB pick the boundaries so that documents are distributed as evenly as possible across a requested number of buckets. Use `$bucket` when the ranges have business meaning (price tiers); use `$bucketAuto` for exploratory analysis where you don't yet know a sensible cutoff."

> **Memory hook:** "`$bucket` — you draw the lines on the pigeonholes. `$bucketAuto` — you hand the mail to an assistant and say 'just make the piles even.'"

---

## 13. $out and $merge — Write Results

**The problem:** an aggregation pipeline normally just returns a cursor to the caller. But sometimes you want the *result itself* saved as a collection — a materialized report, a nightly rollup — so other queries can read it cheaply later without re-running the whole pipeline.

### $out — write to a new collection

`$out` writes all pipeline results to a collection, **replacing** it entirely. It must be the last stage.

```js
{ $out: "collection_name" }
// or specify database too (MongoDB 4.4+)
{ $out: { db: "reporting", coll: "monthly_summary" } }
```

```js
db.orders.aggregate([
  { $match:  { status: "completed" } },
  { $group:  { _id: "$region", total: { $sum: "$amount" } } },
  { $out:    "region_totals" }
])
// Creates/replaces the "region_totals" collection
```

**Warning:** `$out` **replaces** the target collection atomically. If the pipeline fails midway, the original collection is preserved (atomic swap).

### $merge — merge results into an existing collection

`$merge` (MongoDB 4.2+) is more flexible than `$out`. It can insert, update, replace, or keep documents based on a matching key.

```js
{ $merge: {
    into:           <collection or { db, coll }>,
    on:             <field or [fields]>,     // matching key(s)
    whenMatched:    "replace" | "keepExisting" | "merge" | "fail" | [ pipeline ],
    whenNotMatched: "insert" | "discard"    | "fail"
} }
```

```js
// Upsert monthly revenue totals into a summary collection
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: {
      _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
      revenue: { $sum: "$amount" },
      count:   { $sum: 1 }
  }},
  { $merge: {
      into:           "monthly_summaries",
      on:             "_id",
      whenMatched:    "replace",
      whenNotMatched: "insert"
  }}
])
```

### $out vs $merge

```
┌────────────────────┬────────────────────────┬────────────────────────────┐
│ Feature            │ $out                   │ $merge                     │
├────────────────────┼────────────────────────┼────────────────────────────┤
│ Replaces collection│ Yes (full replacement) │ No (merges with existing)  │
│ Upsert support     │ No                     │ Yes                        │
│ Partial update     │ No                     │ Yes (whenMatched: "merge") │
│ Target can exist   │ Yes (gets replaced)    │ Yes (gets merged)          │
│ Introduced         │ MongoDB 2.6            │ MongoDB 4.2                │
│ Use case           │ Full refresh of a view │ Incremental update         │
└────────────────────┴────────────────────────┴────────────────────────────┘
```

> **Memory hook:** "`$out` repaints the whole wall. `$merge` only touches up the spots that changed."

---

## 14. Stage Quick-Reference Table

```
┌─────────────────┬───────────────────────────────────────────────┬──────────┐
│ Stage           │ Purpose                                       │ Blocking │
├─────────────────┼───────────────────────────────────────────────┼──────────┤
│ $match          │ Filter documents (like find query)            │ No       │
│ $project        │ Include/exclude/compute fields                │ No       │
│ $addFields      │ Add/overwrite fields, keep everything else    │ No       │
│ $group          │ Group docs, compute accumulators              │ Yes      │
│ $sort           │ Order documents                               │ Yes*     │
│ $limit          │ Take first N documents                        │ No       │
│ $skip           │ Drop first N documents                        │ No       │
│ $unwind         │ Deconstruct array into one doc per element    │ No       │
│ $lookup         │ Left outer join with another collection       │ No       │
│ $replaceRoot    │ Promote sub-document to root                  │ No       │
│ $count          │ Count documents in stream                     │ Yes      │
│ $facet          │ Multiple sub-pipelines on same input          │ Yes      │
│ $bucket         │ Group into user-defined ranges                │ Yes      │
│ $bucketAuto     │ Group into auto-computed ranges               │ Yes      │
│ $out            │ Write results to collection (replaces)        │ Yes      │
│ $merge          │ Merge results into existing collection        │ Yes      │
│ $graphLookup    │ Recursive graph traversal                     │ Yes      │
│ $sample         │ Random sample of N documents                  │ No       │
│ $redact         │ Field-level access control within docs        │ No       │
│ $geoNear        │ Geospatial proximity sort (must be first)     │ No       │
└─────────────────┴───────────────────────────────────────────────┴──────────┘
* Index-backed sort is streaming; in-memory sort is blocking
```

---

## 15. Hands-On Exercises

Use the `orders` and `customers` collections from the Setup section.

### Exercise 1 — $project with computed fields

For each order, project:
- `orderId` (rename from `_id`)
- `statusLabel` (uppercase of `status`)
- `itemCount` (number of items in the `items` array)
- Exclude `_id`

<details>
<summary>Solution</summary>

```js
db.orders.aggregate([
  { $project: {
      _id: 0,
      orderId:     "$_id",
      statusLabel: { $toUpper: "$status" },
      itemCount:   { $size: "$items" }
  }}
])
```
</details>

---

### Exercise 2 — $unwind + $group to get revenue per SKU

Unwind the `items` array, then compute total quantity sold and total revenue (qty * price) for each SKU.

<details>
<summary>Solution</summary>

```js
db.orders.aggregate([
  { $unwind: "$items" },
  { $group: {
      _id: "$items.sku",
      totalQtySold: { $sum: "$items.qty" },
      totalRevenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
  }},
  { $sort: { totalRevenue: -1 } }
])
```
</details>

---

### Exercise 3 — $lookup to enrich orders with customer name

Join the `orders` collection with `customers`. Output: `orderId`, `customerName`, `customerTier`, `status`.

<details>
<summary>Solution</summary>

```js
db.orders.aggregate([
  { $lookup: {
      from:         "customers",
      localField:   "customerId",
      foreignField: "_id",
      as:           "customer"
  }},
  { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
  { $project: {
      _id: 0,
      orderId:      "$_id",
      customerName: "$customer.name",
      customerTier: "$customer.tier",
      status:       1
  }}
])
```
</details>

---

### Exercise 4 — $facet dashboard

In a single aggregation call, compute:
- Total number of orders per `status`
- Average `items` array length across all orders
- The 2 most recent order IDs (by `createdAt`)

<details>
<summary>Solution</summary>

```js
db.orders.aggregate([
  { $facet: {
      countByStatus: [
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ],
      avgItemsPerOrder: [
        { $group: { _id: null, avg: { $avg: { $size: "$items" } } } }
      ],
      recentOrders: [
        { $sort:  { createdAt: -1 } },
        { $limit: 2 },
        { $project: { _id: 1, createdAt: 1 } }
      ]
  }}
])
```
</details>

---

### Exercise 5 — $bucket on item prices

Unwind items, then bucket the item prices into: [0-50), [50-100), [100-200), 200+. Count how many items fall into each bucket.

<details>
<summary>Solution</summary>

```js
db.orders.aggregate([
  { $unwind: "$items" },
  { $bucket: {
      groupBy:    "$items.price",
      boundaries: [0, 50, 100, 200],
      default:    "200+",
      output: {
        itemCount: { $sum: 1 },
        avgPrice:  { $avg: "$items.price" }
      }
  }}
])
```
</details>

---

### Exercise 6 — $addFields + $replaceRoot

Add a `lineTotal` field to each item in the `items` array (qty * price), then unwind and replace the root with the item document (keeping the parent `_id` and `status`).

<details>
<summary>Solution</summary>

```js
db.orders.aggregate([
  { $addFields: {
      items: {
        $map: {
          input: "$items",
          as:    "item",
          in: {
            sku:       "$$item.sku",
            qty:       "$$item.qty",
            price:     "$$item.price",
            lineTotal: { $multiply: ["$$item.qty", "$$item.price"] }
          }
        }
      }
  }},
  { $unwind: "$items" },
  { $replaceRoot: {
      newRoot: { $mergeObjects: [ "$items", { orderId: "$_id", status: "$status" } ] }
  }}
])
```
</details>

---

### Exercise 7 — $merge for incremental reporting

Write a pipeline that computes total revenue per region for completed orders in January 2025 only, and upserts the results into a `regional_revenue` collection (matching on `_id`).

<details>
<summary>Solution</summary>

```js
db.orders.aggregate([
  { $match: {
      status:    "completed",
      createdAt: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") }
  }},
  { $group: { _id: "$region", revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
  { $merge: {
      into:           "regional_revenue",
      on:             "_id",
      whenMatched:    "replace",
      whenNotMatched: "insert"
  }}
])
```
</details>

---

### Exercise 8 — Full pipeline combining 5+ stages

For gold-tier customers only (join with customers), compute the total number of unique SKUs they have ordered across all their completed orders, sorted by unique SKU count descending.

<details>
<summary>Solution</summary>

```js
db.orders.aggregate([
  // Step 1: completed orders only
  { $match: { status: "completed" } },

  // Step 2: join customer info
  { $lookup: {
      from:         "customers",
      localField:   "customerId",
      foreignField: "_id",
      as:           "customer"
  }},
  { $unwind: "$customer" },

  // Step 3: filter to gold tier
  { $match: { "customer.tier": "gold" } },

  // Step 4: unwind items to get individual SKUs
  { $unwind: "$items" },

  // Step 5: group by customer, collect unique SKUs
  { $group: {
      _id:          "$customerId",
      customerName: { $first: "$customer.name" },
      uniqueSkus:   { $addToSet: "$items.sku" }
  }},

  // Step 6: add count of unique SKUs
  { $addFields: { uniqueSkuCount: { $size: "$uniqueSkus" } } },

  // Step 7: sort by count
  { $sort: { uniqueSkuCount: -1 } },

  // Step 8: clean up output
  { $project: { customerName: 1, uniqueSkuCount: 1, uniqueSkus: 1 } }
])
```
</details>

---

## 16. Interview Q&A

**Q1. What does $match do and why should it be early in the pipeline?**

A: `$match` filters the document stream using standard MongoDB query operators. Placing it early in the pipeline reduces the number of documents that reach subsequent (potentially expensive) stages like `$group` or `$lookup`. When it is the first stage, MongoDB's query planner can use an index, making the filter O(log n) instead of O(n).

---

**Q2. What is the difference between $project and $addFields?**

A: `$project` requires you to explicitly include or exclude every field you want in the output. Fields not mentioned are dropped (except `_id` which is included by default). `$addFields` only specifies new or overwritten fields and preserves all existing fields. Use `$project` when you want to change the document shape significantly; use `$addFields` when you just want to enrich documents.

---

**Q3. What are accumulators in $group and name all the ones you know?**

A: Accumulators are expressions that reduce many values (one per document in the group) to a single output value. Standard accumulators: `$sum`, `$avg`, `$min`, `$max`, `$count`, `$push`, `$addToSet`, `$first`, `$last`, `$stdDevPop`, `$stdDevSamp`. `$push` collects all values into an array (with duplicates); `$addToSet` collects unique values only. `$first` and `$last` return the first/last seen value — meaningful only when the input is pre-sorted.

---

**Q4. What does $unwind do and what happens to documents with a missing or empty array?**

A: `$unwind` deconstructs an array field — for each element in the array, it outputs a copy of the document with that element as the field value instead of the array. By default, documents where the array field is missing, null, or empty are **dropped from the stream**. Use `preserveNullAndEmptyArrays: true` to keep those documents.

---

**Q5. What is $lookup and what are the two forms?**

A: `$lookup` performs a left outer join. The simple form matches on field equality (`localField` = `foreignField`) and appends matched documents as an array. The pipeline form (using `let` + `pipeline`) allows complex join conditions, filtering of joined documents, and projections — making it suitable for correlated sub-queries. The result is always an array field; use `$unwind` to flatten it to a single object.

---

**Q6. What is the difference between $out and $merge?**

A: `$out` replaces the target collection entirely (atomic swap). `$merge` can insert new documents, update matching ones, or leave existing documents unchanged based on `whenMatched` and `whenNotMatched` options. Use `$out` for full refresh of derived collections; use `$merge` for incremental updates where you want to preserve existing data.

---

**Q7. When would you use $facet?**

A: When you need multiple independent aggregations over the same input dataset in a single database round-trip — for example, a dashboard that shows totals, a breakdown by region, and a top-N list simultaneously. Without `$facet`, you would need three separate aggregation calls. The trade-off is that `$facet` is a blocking stage that holds the entire input in memory (100 MB limit applies).

---

**Q8. What is $bucket and when would you use it over a plain $group?**

A: `$bucket` groups documents into predefined numeric ranges (boundaries), producing a histogram. It is purpose-built for range-based grouping and is more readable and efficient than expressing ranges with `$cond` inside a `$group`. Use it when you need to answer "how many X fall in the 0-100 range, 100-500 range, 500+ range?" pattern.

---

**Q9. Can you use $lookup to join more than two collections?**

A: Yes. After a `$lookup`, the joined data is embedded in the document as an array. You can then perform another `$lookup` on a different collection, or even use the pipeline form of `$lookup` which itself can contain nested `$lookup` stages. There is no hard limit on the number of joins, but each join adds overhead — keep joins selective.

---

**Q10. How do you handle a $lookup where some documents have no match?**

A: A `$lookup` is a left outer join — documents on the left side that have no matching documents in the joined collection produce an empty array for the `as` field. If you then `$unwind` that field without `preserveNullAndEmptyArrays: true`, those documents are dropped. Use `preserveNullAndEmptyArrays: true` to keep unmatched documents, and check for `null` values downstream.

---

**Q11. What does $replaceRoot do and when would you use it?**

A: `$replaceRoot` replaces the entire pipeline document with a specified expression (usually a sub-document). A common use case is after `$lookup` + `$unwind` when you want the joined document to become the root, or after `$unwind` of nested objects. Use `$mergeObjects` with `$$ROOT` to merge the sub-document into the existing root rather than completely replacing it.

---

**Q12. Explain the difference between $push and $addToSet in $group.**

A: Both collect values into an array during grouping. `$push` appends every value, including duplicates, preserving insertion order. `$addToSet` only adds a value if it is not already in the array, producing a set of unique values (order is not guaranteed). Use `$addToSet` when you need distinct values (e.g., unique SKUs per customer); use `$push` when you need all values including duplicates (e.g., a list of all order IDs).

---

**Q13. What is the difference between $count stage and using $sum: 1 in $group?**

A: `{ $count: "field" }` is a standalone stage that counts all documents in the stream and returns a single document with the count. `{ $sum: 1 }` is an accumulator inside `$group` that counts documents within each group. Use `$count` for a grand total; use `$sum: 1` in `$group` for per-group counts.

---

**Q14. How do $cond, $ifNull, and $switch differ in $project?**

A: `$cond` is a ternary (if/then/else) — it evaluates a boolean expression and returns one of two values. `$ifNull` is a two-argument operator that returns the first argument if it is not null/missing, otherwise the second argument — it is a null-coalescing operator. `$switch` is a multi-branch if/else chain with an optional default. Use `$ifNull` for simple null handling, `$cond` for one condition, and `$switch` for multiple mutually exclusive conditions.

---

**Q15. What is $bucketAuto and how does it differ from $bucket?**

A: `$bucket` requires you to define the boundary values explicitly. `$bucketAuto` automatically determines boundary values by distributing documents as evenly as possible across a specified number of buckets. Use `$bucket` when you have domain knowledge about meaningful ranges (e.g., price tiers). Use `$bucketAuto` for exploratory analysis when you want to see how data is distributed without knowing the ranges in advance.

---

*Next: [03-Aggregation-Patterns.md](./03-Aggregation-Patterns.md) — real-world pipeline patterns and production examples.*
