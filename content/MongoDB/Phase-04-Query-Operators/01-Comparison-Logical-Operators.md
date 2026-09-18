# Comparison & Logical Operators

```
┌─────────────────────────────────────────────────────────────────────┐
│             FILE 01 — COMPARISON & LOGICAL OPERATORS                │
│                                                                     │
│   $eq  $ne  $gt  $gte  $lt  $lte  $in  $nin                        │
│   $and  $or  $not  $nor  implicit $and  dot notation                │
└─────────────────────────────────────────────────────────────────────┘
```

Every query you'll ever write in MongoDB boils down to answering one question, over and over: "does this document match what I'm looking for?" Comparison operators answer that question for a *single field* ("is price greater than 100?"). Logical operators answer it for *combinations of fields* ("is it electronics AND under $200?"). That's really the whole file — everything below is just variations on those two ideas.

## Table of Contents

1. [Sample Dataset](#1-sample-dataset)
2. [Comparison Operators](#2-comparison-operators)
   - 2.1 [$eq — Equal](#21-eq--equal)
   - 2.2 [$ne — Not Equal](#22-ne--not-equal)
   - 2.3 [$gt and $gte — Greater Than](#23-gt-and-gte--greater-than)
   - 2.4 [$lt and $lte — Less Than](#24-lt-and-lte--less-than)
   - 2.5 [$in — In Array](#25-in--in-array)
   - 2.6 [$nin — Not In Array](#26-nin--not-in-array)
3. [Logical Operators](#3-logical-operators)
   - 3.1 [$and — All Must Match](#31-and--all-must-match)
   - 3.2 [Implicit $and](#32-implicit-and)
   - 3.3 [$or — At Least One Matches](#33-or--at-least-one-matches)
   - 3.4 [$not — Negate a Condition](#34-not--negate-a-condition)
   - 3.5 [$nor — None Must Match](#35-nor--none-must-match)
4. [Dot Notation for Nested Queries](#4-dot-notation-for-nested-queries)
5. [Complex Multi-Condition Examples](#5-complex-multi-condition-examples)
6. [Comparison: SQL vs MongoDB](#6-comparison-sql-vs-mongodb)
7. [Under the Hood — How the Query Planner Uses These](#7-under-the-hood--how-the-query-planner-uses-these)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Sample Dataset

Before touching a single operator, get some data in front of you — every example below is meant to be run, not just read.

Insert this dataset before running any examples:

```js
use ecommerce

db.products.drop()

db.products.insertMany([
  {
    _id: 1,
    name: "Laptop Pro 15",
    category: "electronics",
    brand: "TechCorp",
    price: 1299,
    discount: 10,
    stock: 34,
    rating: 4.7,
    specs: { ram: 16, storage: 512, weight: 1.8 },
    tags: ["portable", "professional", "fast"]
  },
  {
    _id: 2,
    name: "Wireless Mouse",
    category: "electronics",
    brand: "ClickMaster",
    price: 49,
    discount: 5,
    stock: 200,
    rating: 4.2,
    specs: { dpi: 1600, buttons: 6, weight: 0.09 },
    tags: ["ergonomic", "wireless"]
  },
  {
    _id: 3,
    name: "Standing Desk",
    category: "furniture",
    brand: "ErgoSpace",
    price: 599,
    discount: 0,
    stock: 12,
    rating: 4.9,
    specs: { width: 140, height: 75, weight: 35 },
    tags: ["office", "ergonomic", "adjustable"]
  },
  {
    _id: 4,
    name: "USB-C Hub",
    category: "electronics",
    brand: "TechCorp",
    price: 79,
    discount: 15,
    stock: 0,
    rating: 3.8,
    specs: { ports: 7, weight: 0.12 },
    tags: ["connectivity", "portable"]
  },
  {
    _id: 5,
    name: "Mechanical Keyboard",
    category: "electronics",
    brand: "KeyForge",
    price: 149,
    discount: 0,
    stock: 75,
    rating: 4.6,
    specs: { keys: 104, backlit: true, weight: 1.1 },
    tags: ["gaming", "typing", "clicky"]
  },
  {
    _id: 6,
    name: "Monitor 27in",
    category: "electronics",
    brand: "ViewMax",
    price: 399,
    discount: 20,
    stock: 18,
    rating: 4.4,
    specs: { resolution: "2560x1440", refresh: 144, weight: 5.2 },
    tags: ["gaming", "professional"]
  },
  {
    _id: 7,
    name: "Office Chair",
    category: "furniture",
    brand: "ErgoSpace",
    price: 349,
    discount: 5,
    stock: 25,
    rating: 4.8,
    specs: { maxLoad: 120, adjustable: true, weight: 18 },
    tags: ["office", "ergonomic", "comfortable"]
  },
  {
    _id: 8,
    name: "Webcam HD",
    category: "electronics",
    brand: "ViewMax",
    price: 89,
    discount: 0,
    stock: 0,
    rating: 3.5,
    specs: { resolution: "1920x1080", fps: 30, weight: 0.08 },
    tags: ["remote-work", "streaming"]
  }
])
```

Keep this collection open in a shell tab — every query in this file runs against it.

---

## 2. Comparison Operators

```
┌─────────────────────────────────────────────────────────────────┐
│  COMPARISON OPERATORS — THE BUILDING BLOCKS                     │
│                                                                 │
│  Think of them as the WHERE clause comparisons in SQL           │
│  but applied per-field in a document                            │
│                                                                 │
│  field: { $operator: value }                                    │
└─────────────────────────────────────────────────────────────────┘
```

If you've ever written a SQL `WHERE` clause, you already know these — MongoDB just spells them with a dollar sign instead of a symbol. Let's go through them one at a time.

---

### 2.1 $eq — Equal

**The problem:** you want documents where a field is exactly some value — the most basic filter there is.

**Real-world analogy:** A price tag that reads exactly $49.00. Not "around $49," not "$49 or less" — exactly $49.00.

**Definition:** `$eq` matches documents where a field equals an exact value.

**Syntax:**
```js
{ field: { $eq: value } }

// Shorthand (implicit $eq — preferred):
{ field: value }
```

**Examples:**

```js
// Find the product that costs exactly $149
db.products.find({ price: { $eq: 149 } })

// Shorthand form (identical result):
db.products.find({ price: 149 })

// Find all electronics (string equality)
db.products.find({ category: { $eq: "electronics" } })

// Find products with zero discount (number equality)
db.products.find({ discount: { $eq: 0 } })

// $eq on a nested field (dot notation)
db.products.find({ "specs.weight": { $eq: 1.8 } })
```

**Output for first query:**
```
[ { _id: 5, name: 'Mechanical Keyboard', price: 149, ... } ]
```

Why would you ever write the long form `{ $eq: value }` when the shorthand does the same thing? Mostly when you're building queries dynamically in code and the operator itself is a variable — you can't easily interpolate an operator into shorthand syntax, but you can drop it straight into an `$eq` object.

- Use `{ field: value }` (shorthand) for simple equality — it is idiomatic MongoDB.
- Use `{ field: { $eq: value } }` when building queries dynamically in code where the operator slot is a variable.

---

### 2.2 $ne — Not Equal

**The problem:** "give me everything except this one thing."

**Real-world analogy:** "Show me everything on the menu except the burger."

**Definition:** `$ne` matches documents where a field does NOT equal a value, including documents where the field does not exist.

**Syntax:**
```js
{ field: { $ne: value } }
```

**Examples:**

```js
// All products that are NOT furniture
db.products.find({ category: { $ne: "furniture" } })

// Products not made by TechCorp
db.products.find({ brand: { $ne: "TechCorp" } })

// Products that have a non-zero discount
db.products.find({ discount: { $ne: 0 } })

// Products not rated 4.7
db.products.find({ rating: { $ne: 4.7 } })
```

Here's the part that trips people up: "not equal" sounds like it should only care about documents that *have* the field. It doesn't.

**Important gotcha — $ne matches missing fields too:**
```js
// If some documents don't have a "discount" field at all,
// $ne will include them because the value is not 0.
db.products.find({ discount: { $ne: 0 } })
// To exclude documents without the field, combine with $exists:
db.products.find({ discount: { $exists: true, $ne: 0 } })
```

Think about it from MongoDB's point of view — if a document has no `discount` field, that field's value definitely isn't `0`, so the condition technically holds. If you don't want that, you have to say so explicitly with `$exists`.

---

### 2.3 $gt and $gte — Greater Than

**The problem:** filtering by a threshold — "show me anything above X."

**Real-world analogy:** A price filter "above $100" (`$gt`) vs "from $100 up" (`$gte`) — the difference is whether the boundary itself counts.

**Definition:** `$gt` matches values strictly greater than the specified value. `$gte` matches values greater than or equal to it.

**Syntax:**
```js
{ field: { $gt: value }  }   // strictly greater than
{ field: { $gte: value } }   // greater than or equal
```

**Examples:**

```js
// Products costing more than $300
db.products.find({ price: { $gt: 300 } })
// Returns: Standing Desk (599), Laptop Pro 15 (1299), Monitor 27in (399), Office Chair (349)

// Products costing $299 or more (includes Standing Desk at exactly $299)
db.products.find({ price: { $gte: 299 } })

// Well-rated products (4.5 stars and above)
db.products.find({ rating: { $gte: 4.5 } })

// Products weighing more than 1 kg (nested field)
db.products.find({ "specs.weight": { $gt: 1 } })

// In stock — more than 0 units
db.products.find({ stock: { $gt: 0 } })

// Range query — price between $50 and $200 (exclusive)
db.products.find({ price: { $gt: 50, $lt: 200 } })
```

These two also work on strings, not just numbers — worth knowing before you get surprised by it.

**Works on strings too (lexicographic order):**
```js
// Products whose name comes after "M" alphabetically
db.products.find({ name: { $gt: "M" } })
// Returns: Monitor 27in, Mechanical Keyboard, Standing Desk, Webcam HD, Wireless Mouse
```

---

### 2.4 $lt and $lte — Less Than

The mirror image of `$gt`/`$gte` — same idea, opposite direction.

**Definition:** `$lt` matches values strictly less than the specified value. `$lte` matches values less than or equal to it.

**Syntax:**
```js
{ field: { $lt: value }  }   // strictly less than
{ field: { $lte: value } }   // less than or equal
```

**Examples:**

```js
// Budget products — under $100
db.products.find({ price: { $lt: 100 } })
// Returns: Wireless Mouse (49), USB-C Hub (79), Webcam HD (89)

// Products rated 4.0 or below
db.products.find({ rating: { $lte: 4.0 } })
// Returns: USB-C Hub (3.8), Webcam HD (3.5)

// Low stock alert — 20 or fewer units
db.products.find({ stock: { $lte: 20 } })
// Returns: Standing Desk (12), USB-C Hub (0), Webcam HD (0), Monitor 27in (18)

// Price range: $100 to $500 (inclusive)
db.products.find({ price: { $gte: 100, $lte: 500 } })
```

That last one — combining `$gte` and `$lte` on the same field — is how you write a "between" query. Here's what's actually being matched:

**Range query flow diagram:**
```
     $gte 100              $lte 500
        │                    │
────────┼────────────────────┼────────
   0   100   149  299  349  399  500   599   1299
        ╠═══════════════════════╣
             MATCHED RANGE
```

---

### 2.5 $in — In Array

**The problem:** you have a *list* of acceptable values, not just one — "match if it's any of these."

**Real-world analogy:** SQL `WHERE category IN ('electronics', 'furniture')`.

**Definition:** `$in` matches documents where a field's value equals any value in a provided array. When used on an array field, it matches documents where the array contains any of the values.

**Syntax:**
```js
{ field: { $in: [value1, value2, value3, ...] } }
```

**Examples:**

```js
// Products in either electronics or furniture category
db.products.find({ category: { $in: ["electronics", "furniture"] } })

// Specific brands we carry
db.products.find({ brand: { $in: ["TechCorp", "ViewMax"] } })
// Returns: Laptop Pro 15, USB-C Hub, Monitor 27in, Webcam HD

// Products with specific IDs
db.products.find({ _id: { $in: [1, 3, 5] } })

// Price hit points (exact price list)
db.products.find({ price: { $in: [49, 79, 89, 149] } })

// $in against array fields — matches if array CONTAINS any of the values
db.products.find({ tags: { $in: ["gaming", "wireless"] } })
// Returns: Wireless Mouse (has "wireless"), Monitor 27in and Mechanical Keyboard (have "gaming")

// Regex patterns inside $in
db.products.find({ name: { $in: [/^W/, /^L/] } })
// Matches names starting with W or L
```

**Performance note:** `$in` with an index is very efficient — MongoDB uses the index to jump to each value, one lookup per value in the array, all inside a single scan.

---

### 2.6 $nin — Not In Array

The negated cousin of `$in` — same shape, opposite answer.

**Definition:** `$nin` matches documents where a field's value does NOT appear in the provided array. Also matches documents where the field does not exist (same reasoning as `$ne` above).

**Syntax:**
```js
{ field: { $nin: [value1, value2, ...] } }
```

**Examples:**

```js
// All brands except TechCorp and ViewMax
db.products.find({ brand: { $nin: ["TechCorp", "ViewMax"] } })
// Returns: Wireless Mouse, Standing Desk, Mechanical Keyboard, Office Chair

// Products not in specific price points
db.products.find({ price: { $nin: [49, 79, 89] } })

// Products that don't have the "gaming" or "wireless" tags
db.products.find({ tags: { $nin: ["gaming", "wireless"] } })
```

**$in vs $nin summary:**

```
┌─────────────┬────────────────────────────────────────────┐
│  Operator   │  Matches when...                           │
├─────────────┼────────────────────────────────────────────┤
│ $in         │ field value IS in the provided array       │
│ $nin        │ field value is NOT in the provided array   │
│             │ (also matches if field doesn't exist)      │
└─────────────┴────────────────────────────────────────────┘
```

> **Memory hook:** "$in is a guest list — you're on it or you're not. $nin is the bouncer's other list."

---

## 3. Logical Operators

```
┌─────────────────────────────────────────────────────────────────┐
│  LOGICAL OPERATORS — COMBINING CONDITIONS                       │
│                                                                 │
│  These wrap arrays of query conditions.                         │
│  They let you combine comparison operators into complex logic.  │
└─────────────────────────────────────────────────────────────────┘
```

Comparison operators handle one field at a time. But real queries usually need to say things like "electronics AND under $200" or "furniture OR discounted." That's what this whole section is for — combining conditions.

---

### 3.1 $and — All Must Match

**The problem:** you need every single condition to hold, not just one of them.

**Real-world analogy:** A job posting that requires "5+ years experience AND a degree AND React skills" — all three, not just one. A candidate who only ticks two boxes is out.

**Definition:** `$and` takes an array of conditions; ALL must be satisfied for a document to match.

**Syntax:**
```js
{ $and: [ { condition1 }, { condition2 }, ... ] }
```

**Examples:**

```js
// Electronics that cost less than $200
db.products.find({
  $and: [
    { category: "electronics" },
    { price: { $lt: 200 } }
  ]
})
// Returns: Wireless Mouse (49), USB-C Hub (79), Mechanical Keyboard (149), Webcam HD (89)

// In-stock electronics with high ratings
db.products.find({
  $and: [
    { category: "electronics" },
    { stock: { $gt: 0 } },
    { rating: { $gte: 4.5 } }
  ]
})
// Returns: Laptop Pro 15, Mechanical Keyboard

// Products with discount AND a specific brand
db.products.find({
  $and: [
    { discount: { $gt: 0 } },
    { brand: "TechCorp" }
  ]
})
```

Here's a question worth asking: if plain comma-separated fields already mean AND (see the next section), why does `$and` even exist? Because JavaScript objects can't have two keys with the same name.

**When you MUST use explicit $and:**
Use explicit `$and` when you need to apply multiple conditions to the **same field**:

```js
// WRONG — second condition overwrites the first (JavaScript object key collision)
db.products.find({ price: { $gt: 100 }, price: { $lt: 500 } })

// RIGHT — use $and when the field is the same in both conditions
// (though for range queries on one field, you can merge them)
db.products.find({ price: { $gt: 100, $lt: 500 } })  // this works for ranges

// MANDATORY $and — two $or clauses on the same document
db.products.find({
  $and: [
    { $or: [{ category: "electronics" }, { category: "furniture" }] },
    { $or: [{ brand: "TechCorp" }, { brand: "ErgoSpace" }] }
  ]
})
```

That last example is the real reason `$and` earns its keep: you can't have two `$or` keys in the same object either, for exactly the same reason.

---

### 3.2 Implicit $and

**The problem:** writing `$and: [...]` for every query feels heavy when most of the time you just want "match all of these fields."

Good news — you don't have to. MongoDB already treats a plain multi-field query as an AND.

**Definition:** When you place multiple fields at the top level of a query document, MongoDB applies implicit $and — ALL fields must match.

```js
// These two queries are IDENTICAL:
db.products.find({ category: "electronics", stock: { $gt: 0 } })

db.products.find({
  $and: [
    { category: "electronics" },
    { stock: { $gt: 0 } }
  ]
})
```

**Implicit $and flow:**
```
Query Document
  ├── category: "electronics"    ─── condition 1
  ├── stock: { $gt: 0 }          ─── condition 2
  └── rating: { $gte: 4.0 }      ─── condition 3
        │
        ALL must be true
        │
        ▼
    Matched Documents
```

**Best practice:** Use implicit $and (shorthand) for cleaner code when conditions are on different fields. Use explicit `$and` only when you need two conditions on the same field key or two `$or` operators.

---

### 3.3 $or — At Least One Matches

**The problem:** you're happy with any one of several conditions being true — you don't need all of them.

**Real-world analogy:** "Hire someone who knows Python OR JavaScript OR Go" — any single language qualifies, you're not asking for all three.

**Definition:** `$or` takes an array of conditions; at least ONE must be satisfied.

**Syntax:**
```js
{ $or: [ { condition1 }, { condition2 }, ... ] }
```

**Examples:**

```js
// Cheap products OR heavily discounted products
db.products.find({
  $or: [
    { price: { $lt: 100 } },
    { discount: { $gte: 15 } }
  ]
})
// Returns: Wireless Mouse, USB-C Hub, Webcam HD, Monitor 27in, Laptop Pro 15

// Products from either brand
db.products.find({
  $or: [
    { brand: "ErgoSpace" },
    { brand: "KeyForge" }
  ]
})

// Out of stock OR very low stock
db.products.find({
  $or: [
    { stock: { $eq: 0 } },
    { stock: { $lte: 10 } }
  ]
})
```

**$or with different field types:**
```js
db.products.find({
  $or: [
    { category: "furniture" },       // category match
    { price: { $gt: 1000 } },        // price condition
    { rating: { $lt: 4.0 } }         // rating condition
  ]
})
```

**Performance tip:** MongoDB can use separate indexes for each clause of an `$or` and merge the results. This is called an "index union". However, if any clause lacks an index, MongoDB falls back to a collection scan for that clause — so an `$or` is only as fast as its weakest branch.

---

### 3.4 $not — Negate a Condition

**The problem:** you want to flip the result of an existing condition — but that condition might already be more than a simple equality.

**Real-world analogy:** "Show me products where it is NOT the case that price > $500."

**Definition:** `$not` inverts the effect of an operator expression. It matches documents where the field does NOT satisfy the given condition, OR where the field does not exist.

**Syntax:**
```js
{ field: { $not: { $operator: value } } }
```

**Important:** `$not` wraps around an operator expression (like `{ $gt: 100 }`), NOT around a field-value pair. It is a field-level operator, not a top-level operator — this is exactly why it's not interchangeable with `$nor`, which we'll get to next.

**Examples:**

```js
// Products where price is NOT greater than 500
// (includes products without a "price" field)
db.products.find({ price: { $not: { $gt: 500 } } })
// Equivalent to: price <= 500 OR price doesn't exist

// Products where rating is NOT in the 4.x range
db.products.find({ rating: { $not: { $gte: 4.0, $lte: 4.9 } } })

// $not with $regex — products whose name does NOT contain "Pro"
db.products.find({ name: { $not: /Pro/ } })

// $not with $in — brands that are not in the list
db.products.find({ brand: { $not: { $in: ["TechCorp", "ErgoSpace"] } } })
```

**Common mistake:** confusing `$not` with `$ne`. They overlap for simple equality, but `$not` is the only one that can wrap arbitrary operators like `$gt`, `$regex`, or `$in`.

**$not vs $ne:**

```
┌────────────────┬───────────────────────────────────────────────┐
│  Operator      │  Usage                                        │
├────────────────┼───────────────────────────────────────────────┤
│ $ne            │ Negates equality: { field: { $ne: val } }     │
│ $not           │ Negates any operator expression:              │
│                │ { field: { $not: { $gt: val } } }             │
│                │ { field: { $not: /regex/ } }                  │
└────────────────┴───────────────────────────────────────────────┘
```

> **Memory hook:** "$ne only knows how to say 'not that value.' $not can say 'not any condition you throw at it.'"

---

### 3.5 $nor — None Must Match

**The problem:** you want to exclude documents on *several* fronts at once — not just "not A," but "not A and not B and not C."

**Real-world analogy:** "I want movies that are NOT horror AND NOT comedy AND NOT romance."

**Definition:** `$nor` takes an array of conditions; documents match only if NONE of the conditions are satisfied.

**Syntax:**
```js
{ $nor: [ { condition1 }, { condition2 }, ... ] }
```

**Examples:**

```js
// Products that are neither furniture nor out of stock
db.products.find({
  $nor: [
    { category: "furniture" },
    { stock: { $eq: 0 } }
  ]
})
// Returns all electronics that have stock > 0

// Products that are not low-rated AND not expensive
db.products.find({
  $nor: [
    { rating: { $lt: 4.0 } },
    { price: { $gt: 500 } }
  ]
})

// Products without specific tags and not by TechCorp
db.products.find({
  $nor: [
    { tags: { $in: ["gaming"] } },
    { brand: "TechCorp" }
  ]
})
```

Notice the shape here: `$nor` operates on a whole *array of conditions*, each of which can touch a different field — whereas `$not` operates on one field's operator expression. That's the distinction that matters most in interviews.

**Logical truth table:**
```
┌─────────┬─────────┬──────────┬─────────┬─────────┐
│ Cond A  │ Cond B  │  $and    │  $or    │  $nor   │
├─────────┼─────────┼──────────┼─────────┼─────────┤
│ true    │ true    │  true    │  true   │  false  │
│ true    │ false   │  false   │  true   │  false  │
│ false   │ true    │  false   │  true   │  false  │
│ false   │ false   │  false   │  false  │  true   │
└─────────┴─────────┴──────────┴─────────┴─────────┘
```

**Interview answer:** "`$and`, `$or`, and `$nor` are the three top-level logical operators, each taking an array of query conditions. `$and` requires every condition to be true, `$or` requires at least one, and `$nor` requires none of them to be true — it's the logical inverse of `$or`. `$not`, by contrast, is a field-level operator that negates a single operator expression rather than a whole array of conditions."

> **Memory hook:** "$nor is $or wearing a 'none of the above' badge."

---

## 4. Dot Notation for Nested Queries

**The problem:** your documents aren't flat — a product has a `specs` sub-document, an order has a `shipping.address`. How do you query inside that without pulling the whole sub-document out first?

**Real-world analogy:** Giving directions to a specific drawer inside a specific cabinet — "kitchen, second drawer" — rather than describing the whole kitchen.

**Definition:** MongoDB's dot notation lets you query fields inside embedded documents without unwrapping them.

**Syntax:**
```js
{ "outerField.innerField": value }
{ "level1.level2.level3": value }
```

**The sample dataset has specs as an embedded document:**
```
product
  ├── name
  ├── price
  └── specs            ← embedded document
        ├── ram
        ├── storage
        └── weight
```

**Examples:**

```js
// Find products with exactly 16GB RAM
db.products.find({ "specs.ram": 16 })

// Laptops with storage >= 256GB
db.products.find({ "specs.storage": { $gte: 256 } })

// Lightweight products (under 1 kg)
db.products.find({ "specs.weight": { $lt: 1 } })

// Products with 7 or more ports
db.products.find({ "specs.ports": { $gte: 7 } })

// Monitors with high refresh rate
db.products.find({ "specs.refresh": { $gte: 120 } })
```

**Combining dot notation with logical operators:**
```js
// High-spec lightweight electronics
db.products.find({
  $and: [
    { category: "electronics" },
    { "specs.weight": { $lt: 0.5 } },
    { rating: { $gte: 4.0 } }
  ]
})
```

**Three-level nesting:**
```js
// Hypothetical deeply nested document
db.orders.find({ "shipping.address.city": "Sydney" })
db.users.find({ "profile.preferences.theme": "dark" })
```

Here's the mistake almost everyone makes at least once: forgetting the quotes-and-dot, and instead trying to match the sub-document as a whole object.

**WARNING — dot notation vs whole object match:**
```js
// WRONG: tries to match the entire specs object exactly
db.products.find({ specs: { ram: 16 } })
// This will only match documents where specs is EXACTLY { ram: 16 } and nothing else

// RIGHT: use dot notation to query individual nested fields
db.products.find({ "specs.ram": 16 })
```

> **Memory hook:** "The dot is your finger pointing through the document — `specs.ram` says 'go into specs, then grab ram,' not 'specs must equal this whole thing.'"

---

## 5. Complex Multi-Condition Examples

Real-world queries rarely use a single operator. Here are production-style queries that combine everything covered so far.

**Example 1 — E-commerce product search with filters:**
```js
// User filters: category=electronics, price 50-500, rating >= 4.0, in stock
db.products.find({
  category: "electronics",
  price: { $gte: 50, $lte: 500 },
  rating: { $gte: 4.0 },
  stock: { $gt: 0 }
})
```

**Example 2 — Promotional campaign targeting:**
```js
// Products eligible for flash sale:
// Must be electronics OR furniture with discount already applied
// AND price must be under $500
// AND must have stock
db.products.find({
  $and: [
    {
      $or: [
        { category: "electronics" },
        { $and: [{ category: "furniture" }, { discount: { $gt: 0 } }] }
      ]
    },
    { price: { $lt: 500 } },
    { stock: { $gt: 0 } }
  ]
})
```

**Example 3 — Inventory management alert:**
```js
// Items needing restock: out of stock OR stock < 15, but not discontinued (price > 0)
db.products.find({
  $and: [
    {
      $or: [
        { stock: 0 },
        { stock: { $lt: 15 } }
      ]
    },
    { price: { $gt: 0 } }
  ]
})
```

**Example 4 — Brand comparison report:**
```js
// TechCorp products that are expensive, OR ErgoSpace products regardless of price
db.products.find({
  $or: [
    { brand: "TechCorp", price: { $gte: 500 } },
    { brand: "ErgoSpace" }
  ]
})
```

**Example 5 — Nested field with logical operators:**
```js
// Portable products (weight < 2 kg) that are well-rated AND either gaming or professional
db.products.find({
  "specs.weight": { $lt: 2 },
  rating: { $gte: 4.5 },
  $or: [
    { tags: "gaming" },
    { tags: "professional" }
  ]
})
```

**Example 6 — Exclusion-based query:**
```js
// Everything except: TechCorp products that cost over $200
db.products.find({
  $nor: [
    { brand: "TechCorp", price: { $gt: 200 } }
  ]
})
```

---

## 6. Comparison: SQL vs MongoDB

If you're coming from SQL, this table is your cheat sheet — every operator above, mapped to the `WHERE` clause you already know.

```
┌──────────────────────────────────┬────────────────────────────────────────┐
│  SQL                             │  MongoDB                               │
├──────────────────────────────────┼────────────────────────────────────────┤
│ WHERE price = 149                │ { price: 149 }                         │
│ WHERE price != 149               │ { price: { $ne: 149 } }                │
│ WHERE price > 100                │ { price: { $gt: 100 } }                │
│ WHERE price >= 100               │ { price: { $gte: 100 } }               │
│ WHERE price < 500                │ { price: { $lt: 500 } }                │
│ WHERE price <= 500               │ { price: { $lte: 500 } }               │
│ WHERE price BETWEEN 100 AND 500  │ { price: { $gte: 100, $lte: 500 } }    │
│ WHERE brand IN ('A', 'B')        │ { brand: { $in: ['A', 'B'] } }         │
│ WHERE brand NOT IN ('A', 'B')    │ { brand: { $nin: ['A', 'B'] } }        │
│ WHERE a=1 AND b=2                │ { a: 1, b: 2 }                         │
│ WHERE a=1 OR b=2                 │ { $or: [{ a: 1 }, { b: 2 }] }          │
│ WHERE NOT (price > 500)          │ { price: { $not: { $gt: 500 } } }      │
│ WHERE NOT (a=1 OR b=2)           │ { $nor: [{ a: 1 }, { b: 2 }] }         │
│ WHERE specs.ram = 16             │ { "specs.ram": 16 }                    │
└──────────────────────────────────┴────────────────────────────────────────┘
```

---

## 7. Under the Hood — How the Query Planner Uses These

It's worth peeking behind the curtain here, because "why is my query slow?" almost always comes back to this diagram.

When you run a query, MongoDB's query planner goes through stages:

```
Query
  │
  ▼
┌─────────────────┐
│  Parse query    │  Convert to internal representation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Plan cache?    │  Check if a winning plan was cached
└────────┬────────┘
         │ (cache miss)
         ▼
┌─────────────────┐
│  Generate plans │  One plan per candidate index
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Race plans     │  Run all plans in parallel briefly
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pick winner    │  Fewest reads wins; cache it
└────────┬────────┘
         │
         ▼
     Results
```

Not every operator plays equally well with an index — this is the part worth memorizing:

**Index usage with comparison operators:**
- `$eq`, `$gt`, `$gte`, `$lt`, `$lte` — all use index range scans efficiently.
- `$in` — performs multiple point lookups on the index (one per value in the array).
- `$ne`, `$nin`, `$not` — typically cannot use an index efficiently; they often trigger collection scans because they match "everything except" a set of values.
- `$or` — can use index union; each condition may use its own index.
- `$and` — MongoDB picks the most selective index from among the conditions.

**Explain plan to verify index usage:**
```js
db.products.find({ price: { $gte: 100, $lte: 500 } }).explain("executionStats")
// Look for: winningPlan.inputStage.stage === "IXSCAN" (index scan - good)
// Avoid:    winningPlan.inputStage.stage === "COLLSCAN" (collection scan - bad)
```

> **Memory hook:** "Positive operators (equals, ranges, in-lists) can use a signpost. Negative operators (not-equal, not-in) have to walk every aisle to be sure."

---

## 8. Hands-On Exercises

Use the dataset from Section 1. Write and run each query yourself.

**Exercise 1 — Comparison Range:**
Find all products priced between $80 and $400 (inclusive) that have at least 10 units in stock. Sort results by price ascending.

```js
// Your query here:
db.products.find(
  { price: { $gte: 80, $lte: 400 }, stock: { $gte: 10 } }
).sort({ price: 1 })
```

**Exercise 2 — Logical OR with Conditions:**
Find all products that either:
- Belong to the "furniture" category with a rating above 4.5, OR
- Belong to "electronics" and cost under $100

```js
// Your query here:
db.products.find({
  $or: [
    { category: "furniture", rating: { $gt: 4.5 } },
    { category: "electronics", price: { $lt: 100 } }
  ]
})
```

**Exercise 3 — Nested Fields and Exclusion:**
Find electronics products where the specs weight is under 2 kg, but exclude any products from TechCorp.

```js
// Your query here:
db.products.find({
  category: "electronics",
  "specs.weight": { $lt: 2 },
  brand: { $ne: "TechCorp" }
})
```

**Exercise 4 — $in and $nin Together:**
Find products whose brand is either "TechCorp" or "KeyForge", but whose price is NOT in [49, 79, 89].

```js
// Your query here:
db.products.find({
  brand: { $in: ["TechCorp", "KeyForge"] },
  price: { $nin: [49, 79, 89] }
})
```

**Exercise 5 — Complex $and/$or combination:**
Write a query to find products suitable for a "home office bundle" promotion:
- Must be either electronics or furniture
- Must have a rating of at least 4.4
- Must be in stock (stock > 0)
- Must NOT be a gaming product (tags should not include "gaming")
- Price must be under $1000

```js
// Your query here:
db.products.find({
  $and: [
    { $or: [{ category: "electronics" }, { category: "furniture" }] },
    { rating: { $gte: 4.4 } },
    { stock: { $gt: 0 } },
    { tags: { $nin: ["gaming"] } },
    { price: { $lt: 1000 } }
  ]
})
```

---

## 9. Interview Q&A

**Q1: What is the difference between `{ price: 100 }` and `{ price: { $eq: 100 } }`?**

A: They are functionally identical. The shorthand `{ price: 100 }` is implicit `$eq` and is idiomatic MongoDB. The explicit form `{ price: { $eq: 100 } }` is used in dynamic query building where the operator is assigned from a variable. The query planner treats both the same way.

---

**Q2: Does `$ne` match documents where the field doesn't exist?**

A: Yes. `{ price: { $ne: 100 } }` will also match documents that have no `price` field at all, because a missing field does not equal 100. To restrict to documents that have the field but not that value, combine with `$exists`: `{ price: { $exists: true, $ne: 100 } }`.

---

**Q3: When do you need explicit `$and` vs implicit `$and`?**

A: Implicit `$and` (comma-separated top-level fields) works when all conditions are on different fields. You need explicit `$and` in two cases:
1. When two or more conditions target the same field key — JavaScript object keys are unique, so the second overwrites the first.
2. When combining two or more `$or` operators — `{ $or: [...], $or: [...] }` would collapse to one; wrap both inside `$and: [{ $or: [...] }, { $or: [...] }]`.

---

**Q4: What is the performance difference between `$in` and multiple `$or` conditions?**

A: `$in` on a single field is more efficient than an equivalent `$or` with multiple `$eq` clauses. Internally, MongoDB can perform multiple index lookups for each value in `$in` within a single IXSCAN. With `$or`, MongoDB may need to evaluate and merge multiple subplans. Always prefer `$in` when checking one field against many values.

---

**Q5: Can you use `$gt` and `$lt` on strings?**

A: Yes. MongoDB compares strings lexicographically using the collation (default: binary comparison, case-sensitive, uppercase before lowercase in ASCII). For example, `"Laptop" < "Wireless"` because 'L' (76) < 'W' (87) in ASCII. Be careful with mixed case — uppercase letters sort before lowercase.

---

**Q6: What does `$nor` return and how is it different from `$not`?**

A: `$nor` is a top-level logical operator that takes an array of conditions and returns documents where NONE of the conditions are true. `$not` is a field-level operator that negates a single operator expression on one field. `$nor` can negate across multiple fields at once.

---

**Q7: Can you use dot notation inside `$in`?**

A: Yes. `db.products.find({ "specs.ram": { $in: [8, 16, 32] } })` is valid — dot notation works with any operator including `$in`, `$gt`, `$regex`, etc.

---

**Q8: How does the query planner handle `$or` with indexes?**

A: MongoDB can perform an "index OR" (index union) where each branch of `$or` uses its own index and the results are merged with deduplication. This requires each branch to have a usable index. If any branch lacks an index, that branch falls back to a COLLSCAN and the performance degrades. For best performance, ensure every `$or` clause field has an index.

---

**Q9: What is a "covered query" and can comparison operators participate in one?**

A: A covered query is one where all fields in the query predicate AND the projection are in the same index — MongoDB never touches the actual documents, only the index. Yes, comparison operators like `$eq`, `$gt`, `$lt` participate in covered queries as long as the queried fields and projected fields are all in the index. Check with `.explain("executionStats")` and look for `totalDocsExamined: 0`.

---

**Q10: How do you write a range query in MongoDB that mimics SQL's BETWEEN?**

A: Combine `$gte` and `$lte` on the same field in one object:
```js
db.products.find({ price: { $gte: 100, $lte: 500 } })
```
Both operators are applied to the same field key — this is valid because they are nested inside the same value object. This avoids the key-collision problem.

---

**Q11: What happens when you use `$in` with an empty array?**

A: `{ field: { $in: [] } }` matches NO documents — the empty array means "field value must be one of these zero values," which is impossible. This is equivalent to a query that always returns an empty result set. MongoDB short-circuits this early without scanning.

---

**Q12: Explain the difference between `$or` and `$in` — when would you choose each?**

A: Use `$in` when comparing ONE field against MULTIPLE values: `{ brand: { $in: ["A","B","C"] } }`. Use `$or` when combining conditions on MULTIPLE different fields or with different operator types: `{ $or: [{ price: { $lt: 100 } }, { discount: { $gt: 20 } }] }`. For the same-field, same-operator case, `$in` is more concise and slightly more efficient.

---

**Q13: Can dot notation query arrays of embedded documents?**

A: Yes. If a field is an array of documents, dot notation will check if ANY element in the array has the matching field value. For example, `{ "orders.status": "shipped" }` on a document with `orders: [{ status: "shipped" }, { status: "pending" }]` would match. For more control (multiple conditions on the same element), use `$elemMatch` (covered in File 02).

---

**Q14: How does MongoDB evaluate `$not` with a regular expression?**

A: `{ name: { $not: /Pro/ } }` matches documents where `name` does NOT contain "Pro" and also matches documents where `name` doesn't exist. Internally, MongoDB cannot use a standard index for negated regex — it must scan and check each document. This is a known performance concern for large collections.

---

**Q15: What is the operator precedence in MongoDB queries?**

A: MongoDB does not have traditional operator "precedence" like a programming language. Query conditions are evaluated independently per document. The key rule is: at the top level, conditions are implicitly ANDed. Within a field's operator object, all conditions on that field are ANDed (e.g., `{ $gt: 10, $lt: 50 }` means "greater than 10 AND less than 50"). Logical operators (`$and`, `$or`, `$nor`) allow you to override this default AND behaviour explicitly.
