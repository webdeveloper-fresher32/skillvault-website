# Element & Evaluation Operators

```
┌─────────────────────────────────────────────────────────────────────┐
│          FILE 03 — ELEMENT & EVALUATION OPERATORS                   │
│                                                                     │
│  Element:    $exists  $type                                         │
│  Evaluation: $regex  $text  $expr  $jsonSchema                      │
│  Avoid:      $where                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

File 02 taught you how to reach *into* arrays. This file asks a different kind of question — not "what's in the field," but "does the field even exist, and is it the type you think it is?" and "does this string loosely match a pattern, a full-text search term, or another field on the same document?" These are the operators that catch data-quality bugs before they become production incidents — the string that snuck in where a number should be, the field that silently went missing after a schema change, the JavaScript `$where` clause that looks convenient but is actually a security hole. Let's work through them one scenario at a time.

## Table of Contents

1. [Sample Dataset](#1-sample-dataset)
2. [Element Operators](#2-element-operators)
   - 2.1 [$exists — Field Presence Check](#21-exists--field-presence-check)
   - 2.2 [$type — BSON Type Check](#22-type--bson-type-check)
3. [Evaluation Operators](#3-evaluation-operators)
   - 3.1 [$regex — Regular Expression Matching](#31-regex--regular-expression-matching)
   - 3.2 [$text — Full-Text Search](#32-text--full-text-search)
   - 3.3 [$expr — Aggregation Expressions in Queries](#33-expr--aggregation-expressions-in-queries)
   - 3.4 [$jsonSchema — Document Validation](#34-jsonschema--document-validation)
4. [Why to Avoid $where](#4-why-to-avoid-where)
5. [Operator Performance Comparison](#5-operator-performance-comparison)
6. [Real-World Use Cases](#6-real-world-use-cases)
7. [Hands-On Exercises](#8-hands-on-exercises)
8. [Interview Q&A](#9-interview-qa)

---

## 1. Sample Dataset

Same drill as always — load the data first, then read every operator below against something real. Notice the deliberately "dirty" rows here: bob and eva are missing fields, carol has a null age and a score stored as the wrong type. Those aren't mistakes in the dataset — they're the whole point. This file is largely about catching exactly that kind of mess.

```js
use platform

db.users.drop()

db.users.insertMany([
  {
    _id: 1,
    username: "alice_wonder",
    email: "alice@example.com",
    fullName: "Alice Wonderland",
    age: 28,
    bio: "Software engineer specialising in distributed systems and MongoDB.",
    role: "admin",
    status: "active",
    score: 1500,
    budget: 2000,
    spent: 1800,
    tags: ["mongodb", "backend", "distributed"],
    joinedAt: new Date("2022-01-15"),
    lastLogin: new Date("2024-03-10"),
    phoneNumber: "+61412345678",
    address: { city: "Sydney", country: "Australia" }
  },
  {
    _id: 2,
    username: "bob_builds",
    email: "bob@example.com",
    fullName: "Bob Builder",
    age: 34,
    bio: "Full-stack developer. Loves React, Node.js and coffee.",
    role: "user",
    status: "active",
    score: 980,
    budget: 1000,
    spent: 400,
    tags: ["javascript", "react", "node"],
    joinedAt: new Date("2022-06-20"),
    lastLogin: new Date("2024-03-09")
    // no phoneNumber — testing $exists
    // no address — testing $exists
  },
  {
    _id: 3,
    username: "carol_codes",
    email: "carol@example.com",
    fullName: "Carol Smith",
    age: null,          // null age — testing $type
    bio: "Data scientist exploring machine learning and Python analytics.",
    role: "user",
    status: "suspended",
    score: "unrated",   // score is a string, not number — testing $type
    budget: 500,
    spent: 600,         // spent > budget — testing $expr
    tags: ["python", "data", "ml"],
    joinedAt: new Date("2023-02-14"),
    lastLogin: new Date("2023-11-01"),
    phoneNumber: "0400-111-222"
  },
  {
    _id: 4,
    username: "david_dev",
    email: "david@company.org",
    fullName: "David Developer",
    age: 41,
    bio: "DevOps engineer. Infrastructure as code, Kubernetes, and CI/CD pipelines.",
    role: "moderator",
    status: "active",
    score: 2200,
    budget: 3000,
    spent: 2900,
    tags: ["devops", "kubernetes", "cicd"],
    joinedAt: new Date("2021-09-01"),
    lastLogin: new Date("2024-03-11"),
    phoneNumber: "+61-422-987-654",
    address: { city: "Melbourne", country: "Australia" },
    internalNote: "Eligible for enterprise plan"  // field absent on others
  },
  {
    _id: 5,
    username: "eva_ng",
    email: "eva@startup.io",
    fullName: "Eva Nguyen",
    age: 26,
    bio: "Frontend developer passionate about UI/UX design and accessibility.",
    role: "user",
    status: "active",
    score: 750,
    budget: 800,
    spent: 200,
    tags: ["frontend", "ux", "accessibility"],
    joinedAt: new Date("2023-08-18"),
    lastLogin: new Date("2024-03-08")
    // no phoneNumber
    // no address
  }
])
```

---

## 2. Element Operators

**The problem these solve:** in a schemaless database, nothing stops one document from having a field that another document simply doesn't have, or from storing a number in one document and a string in another for the "same" field. Element operators are how you interrogate the *shape* of a document rather than its values — "is this field here at all?" and "what kind of value is sitting in it?"

```
┌────────────────────────────────────────────────────────────────┐
│  ELEMENT OPERATORS — "What does the document look like?"       │
│                                                                │
│  $exists  ─── Is this field present in the document?          │
│  $type    ─── What BSON data type is this field?               │
└────────────────────────────────────────────────────────────────┘
```

### 2.1 $exists — Field Presence Check

**The problem:** your `users` collection grew organically — some old accounts never collected a phone number, some never filled in an address. You need to find "who's missing X" or "who has X" without caring what the value of X actually is.

**Real-world analogy:** Checking if a form field was filled out at all — even writing "N/A" counts as filling it in. `$exists` doesn't care whether the answer is good or bad, only whether there's an answer.

**Definition:** `$exists` matches documents that have (or do not have) a specified field, regardless of the field's value.

**Syntax:**
```js
{ field: { $exists: true  } }   // field must exist (even if null)
{ field: { $exists: false } }   // field must NOT exist
```

**The gotcha worth internalizing before you write a single query** — `$exists: true` says "the key is present," not "the key has a meaningful value." A field set to `null` still counts as existing:

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD STATES AND $exists BEHAVIOUR                              │
│                                                                  │
│  { field: "value" }    → $exists: true  ✓  field has value      │
│  { field: null  }      → $exists: true  ✓  field exists, is null│
│  { field: ""    }      → $exists: true  ✓  field exists, empty  │
│  (field absent)        → $exists: false ✓  field not present    │
└──────────────────────────────────────────────────────────────────┘
```

**Examples:**

```js
// Users who have provided a phone number
db.users.find({ phoneNumber: { $exists: true } })
// Returns: alice (has phone), carol (has phone), david (has phone)

// Users without a phone number
db.users.find({ phoneNumber: { $exists: false } })
// Returns: bob, eva

// Users without an address (fully absent field)
db.users.find({ address: { $exists: false } })
// Returns: bob, carol, eva

// Users with an internalNote (admin-only field)
db.users.find({ internalNote: { $exists: true } })
// Returns: david

// $exists: true includes null values!
db.users.find({ age: { $exists: true } })
// Returns ALL 5 users — carol's age is null but the field exists

// To find users with a non-null age:
db.users.find({ age: { $exists: true, $ne: null } })
// Returns: alice, bob, david, eva

// $exists combined with other operators
db.users.find({
  phoneNumber: { $exists: true },
  status: "active"
})
// Users who are active AND have a phone number
```

**Common mistake:** writing `{ age: { $exists: true } }` when you actually meant "age is set to something real." As the query above shows, this returns carol too, even though her `age` is `null`. If you want "field exists and isn't null," you have to say so explicitly with `$ne: null`.

**Common use case — data quality audit:**
```js
// Count how many documents are missing the "address" field
db.users.countDocuments({ address: { $exists: false } })

// Find documents where specific required fields are absent
db.users.find({
  $or: [
    { email: { $exists: false } },
    { username: { $exists: false } },
    { role: { $exists: false } }
  ]
})
```

**Schema evolution with $exists:**
```js
// When adding a new field "tier" to existing documents:
// Step 1: Find which documents haven't been migrated yet
db.users.find({ tier: { $exists: false } })

// Step 2: Migrate them
db.users.updateMany(
  { tier: { $exists: false } },
  { $set: { tier: "free" } }
)
```

This is the same lazy-migration idea from the Schema Versioning Pattern in Phase 03 — `$exists: false` is exactly how you'd find the stragglers still waiting to be upgraded.

> **Memory hook:** "$exists checks if the mailbox has a letter in it — even a blank piece of paper counts as a letter. It doesn't grade the letter."

---

### 2.2 $type — BSON Type Check

**The problem:** carol's `score` field holds the string `"unrated"` while everyone else's holds a number. Nothing in MongoDB stopped that from happening — there's no column type to enforce it. `$type` is how you go looking for exactly that kind of drift before it crashes your application code (imagine calling `.toFixed(2)` on a string).

**Real-world analogy:** A warehouse inspector who doesn't care what's written on the box's label — they open it and check "is this actually a box of screws, or did someone put nails in a screws box by mistake?"

**Definition:** `$type` matches documents where a field is of a specific BSON data type. This is crucial for catching type inconsistencies in schemaless collections.

**Syntax:**
```js
{ field: { $type: typeNumber } }
{ field: { $type: "typeName" } }   // string alias — preferred
{ field: { $type: [type1, type2] } } // match multiple types
```

**BSON Type Reference Table:**

```
┌──────┬───────────────────┬────────────────────────────────────┐
│  Num │  String Alias     │  Description                       │
├──────┼───────────────────┼────────────────────────────────────┤
│  1   │ "double"          │ 64-bit float                       │
│  2   │ "string"          │ UTF-8 string                       │
│  3   │ "object"          │ Embedded document                  │
│  4   │ "array"           │ Array                              │
│  5   │ "binData"         │ Binary data                        │
│  7   │ "objectId"        │ ObjectId                           │
│  8   │ "bool"            │ Boolean                            │
│  9   │ "date"            │ Date (UTC)                         │
│ 10   │ "null"            │ Null                               │
│ 11   │ "regex"           │ Regular expression                 │
│ 16   │ "int"             │ 32-bit integer                     │
│ 17   │ "timestamp"       │ MongoDB internal timestamp         │
│ 18   │ "long"            │ 64-bit integer                     │
│ 19   │ "decimal"         │ 128-bit decimal (Decimal128)       │
│ -1   │ "minKey"          │ Min key (less than all)            │
│ 127  │ "maxKey"          │ Max key (greater than all)         │
└──────┴───────────────────┴────────────────────────────────────┘
```

Don't try to memorize the whole table — in practice you'll reach for `"string"`, `"object"`, `"array"`, `"date"`, `"null"`, and `"number"` (see below) 95% of the time. The numeric codes exist mostly for legacy compatibility; the string aliases are what you should actually type.

**Examples:**

```js
// Find users where "score" is a number (should be, but carol's is a string)
db.users.find({ score: { $type: "double" } })
db.users.find({ score: { $type: 1 } })       // same query, number alias
// Returns: alice, bob, david, eva

// Find the corrupted record where score is a string
db.users.find({ score: { $type: "string" } })
// Returns: carol ("unrated" is a string)

// Find users where age is null (type 10)
db.users.find({ age: { $type: "null" } })
// Returns: carol (age: null)

// Find users where age is a number (not null, not missing)
db.users.find({ age: { $type: "int" } })
db.users.find({ age: { $type: ["int", "double", "long"] } })  // any numeric type

// Check that joinedAt is actually a Date type
db.users.find({ joinedAt: { $type: "date" } })

// Check that address is an embedded document
db.users.find({ address: { $type: "object" } })
// Returns: alice, david

// Check that tags is an array
db.users.find({ tags: { $type: "array" } })

// Match multiple types — score is either a number or a string
db.users.find({ score: { $type: ["double", "int", "long", "string"] } })
```

**Data type audit — finding type inconsistencies:**
```js
// In a collection that should have numeric prices, find string values
db.products.find({ price: { $type: "string" } })

// Find any field that is not the expected type
db.users.find({
  $or: [
    { age: { $not: { $type: ["int", "double", "long", "null"] } }, age: { $exists: true } },
    { score: { $type: "string" } }
  ]
})
```

**The one alias worth calling out on its own — `"number"` is special:**
```js
// "number" matches int, double, long, and decimal all at once
db.users.find({ score: { $type: "number" } })
// Returns: alice, bob, david, eva (any numeric type)
```

This is genuinely tricky the first time you see it, because `"number"` isn't a real BSON type in the table above — it's a MongoDB-provided convenience alias that expands to "any of the four numeric types." Forgetting this distinction is a common trap: someone checks `{ field: { $type: "int" } }`, gets zero results, and assumes the field is missing or corrupted — when really the value is just stored as a `"double"` instead of an `"int"`, and they needed `"number"` all along.

> **Memory hook:** "$type is the warehouse inspector who opens the box regardless of its label — and 'number' is the inspector's shortcut for 'any kind of screw, I don't care which.'"

---

## 3. Evaluation Operators

Element operators asked about document *shape*. Evaluation operators go a level deeper — pattern matching inside strings, full-text relevance ranking, comparing one field against another, and validating a document's entire structure in one shot. These are the operators that do real computational work at query time, and several of them have real performance implications you need to understand before you ship them.

### 3.1 $regex — Regular Expression Matching

**The problem:** you need "usernames starting with a" or "Australian phone numbers" or "bio mentions MongoDB or Python" — none of which is a plain equality check, and none of which `$eq` or `$in` can express.

**Real-world analogy:** A proofreader scanning a page for a pattern — not looking for one exact word, but for any word that fits a shape, like "any word ending in -ing."

**Definition:** `$regex` matches documents where a string field matches a specified regular expression pattern.

**Syntax:**
```js
// Form 1 — operator form (recommended with options)
{ field: { $regex: /pattern/flags } }
{ field: { $regex: "pattern", $options: "flags" } }

// Form 2 — shorthand regex literal
{ field: /pattern/flags }
```

**Regex Options:**

```
┌────────┬─────────────────────────────────────────────────────┐
│ Flag   │ Meaning                                             │
├────────┼─────────────────────────────────────────────────────┤
│ i      │ Case-insensitive matching                           │
│ m      │ Multiline — ^ and $ match start/end of each line    │
│ x      │ Extended — allows whitespace and comments in regex  │
│ s      │ Dotall — dot (.) matches newline characters too     │
└────────┴─────────────────────────────────────────────────────┘
```

**Examples:**

```js
// Case-insensitive search for "mongo" in bio
db.users.find({ bio: { $regex: /mongo/i } })
db.users.find({ bio: { $regex: "mongo", $options: "i" } })
// Returns: alice ("MongoDB" in bio)

// Users whose email ends with .io
db.users.find({ email: /\.io$/ })
// Returns: eva

// Users whose username starts with "a" or "e"
db.users.find({ username: /^[ae]/ })
// Returns: alice_wonder, eva_ng

// Find Australian phone numbers (starting with +61)
db.users.find({ phoneNumber: { $regex: /^\+61/ } })
// Returns: alice (+61412345678), david (+61-422-987-654)

// Bio mentions Python OR MongoDB (case-insensitive)
db.users.find({ bio: { $regex: /python|mongodb/i } })
// Returns: alice (MongoDB), carol (Python)

// Username contains underscore followed by exactly 2 characters
db.users.find({ username: /_[a-z]{2}$/ })
// Returns: eva_ng

// Search for word boundary — whole word "data"
db.users.find({ bio: { $regex: /\bdata\b/i } })
// Returns: carol ("Data scientist... data")

// Multiline bio — ^ matches start of any line
db.users.find({ bio: { $regex: /^devops/im } })
// Returns: david (bio starts with "DevOps")
```

**Index usage with $regex — the part that actually matters for production:**

Here's the thing nobody tells you until your query is slow in prod: `$regex` can only use a B-tree index in one narrow situation — a pattern anchored at the start with `^`, made of literal characters, with no `i` flag.

```js
// $regex can use an index ONLY for prefix patterns (anchored at start, no i flag)
// GOOD — uses index: starts with literal characters, case-sensitive
db.users.find({ username: /^alice/ })          // index scan from "alice" prefix

// BAD — cannot use index efficiently:
db.users.find({ username: /alice/ })           // unanchored — must scan
db.users.find({ username: { $regex: /^alice/i } })  // case-insensitive — must scan

// Always create a text index for full-text search; use $regex only for pattern matching
```

**Escaping special characters:**
```js
// Search for a literal dot in email domains
db.users.find({ email: /\.[a-z]{3}$/ })  // .com, .org, .net etc.

// Search for a literal +61 in phone
db.users.find({ phoneNumber: /^\+61/ })  // escape + with backslash
```

**Common mistake:** reaching for `/keyword/i` to "search" a text field and being surprised when it's slow on a large collection. Case-insensitivity and unanchored patterns both force a full collection scan — there's no way around it with a regular index. If you actually need to search *within* text (not just match a prefix), that's what `$text` and a text index are for — which is exactly where we're headed next.

> **Memory hook:** "$regex can only use the index if it starts reading from the very first letter, case-sensitive — the moment it has to 'search anywhere' or 'ignore case,' it has to read every page."

---

### 3.2 $text — Full-Text Search

**The problem:** `$regex` is great for patterns, but terrible for "search my bios for anything mentioning developer or engineer, ranked by relevance, ignoring words like 'the' and 'and'." That's a fundamentally different problem — full-text search — and MongoDB has a purpose-built tool for it.

**Definition:** `$text` performs a text search on fields that have a **text index**. It tokenises search terms, removes stop words, and optionally applies stemming.

**Step 1 — Create a text index:**
```js
// Single field text index
db.users.createIndex({ bio: "text" })

// Compound text index (multiple fields searched together)
db.users.createIndex(
  { bio: "text", fullName: "text" },
  { name: "bio_fullname_text" }
)

// Weighted text index — bio matches count 3x more than fullName
db.users.createIndex(
  { bio: "text", fullName: "text" },
  {
    weights: { bio: 3, fullName: 1 },
    name: "weighted_text_idx"
  }
)
```

**Step 2 — Use $text in a query:**
```js
// Syntax
{ $text: { $search: "search terms" } }
```

**$text search options:**

```
┌─────────────────┬──────────────────────────────────────────────────────┐
│ Option           │ Description                                         │
├─────────────────┼──────────────────────────────────────────────────────┤
│ $search          │ The string to search for                            │
│ $language        │ Language for stop words/stemming (default: english) │
│ $caseSensitive   │ Boolean, default false                              │
│ $diacriticSens.. │ Boolean, default false (accents treated as same)    │
└─────────────────┴──────────────────────────────────────────────────────┘
```

**Search term behaviour — the part people get surprised by:**
```
┌──────────────────────────────┬────────────────────────────────────────┐
│ Search String                │ Meaning                                │
├──────────────────────────────┼────────────────────────────────────────┤
│ "python data"                │ Either "python" OR "data" (default OR) │
│ "\"machine learning\""       │ Exact phrase "machine learning"        │
│ "python -javascript"         │ Has "python" but NOT "javascript"      │
└──────────────────────────────┴────────────────────────────────────────┘
```

That first row trips people up constantly — `$search: "python data"` does not mean "must contain both words." It's an OR by default. If you want both words, you'd need `"\"python\" \"data\""` style phrase terms, or filter further in application code.

**Examples:**

```js
// Drop old index if it exists and create fresh
db.users.dropIndex("bio_text")
db.users.createIndex({ bio: "text", fullName: "text" })

// Search for "engineer" in bio or fullName
db.users.find({ $text: { $search: "engineer" } })
// Returns: alice ("Software engineer"), david ("DevOps engineer")

// Search for "data" — matches Data scientist
db.users.find({ $text: { $search: "data" } })
// Returns: carol

// Exact phrase search
db.users.find({ $text: { $search: "\"machine learning\"" } })
// Returns: carol

// Exclusion — has "developer" but NOT "frontend"
db.users.find({ $text: { $search: "developer -frontend" } })
// Returns: bob (Full-stack developer), david (DevOps engineer — "engineer" stem)

// Multiple terms — OR search
db.users.find({ $text: { $search: "python mongodb" } })
// Returns: alice, carol

// Get relevance score and sort by it
db.users.find(
  { $text: { $search: "engineer developer" } },
  { score: { $meta: "textScore" }, username: 1, fullName: 1 }
).sort({ score: { $meta: "textScore" } })
// Returns documents sorted by text relevance — highest match first
```

That last query is the one to remember as a pair — projecting `$meta: "textScore"` without also sorting by it just attaches a number to each result; the sort is what actually orders "most relevant first."

**$text with $language:**
```js
// French text search (different stop words)
db.articles.createIndex({ content: "text" }, { default_language: "french" })
db.articles.find({ $text: { $search: "bonjour", $language: "french" } })

// Override language per query
db.users.find({ $text: { $search: "exemple", $language: "french" } })
```

**Text index limitations — worth knowing before you design around one:**
```
┌─────────────────────────────────────────────────────────────────┐
│  TEXT INDEX CONSTRAINTS                                         │
│                                                                 │
│  ✗ Only ONE text index per collection                           │
│  ✗ Cannot combine text index with 2dsphere or hashed index      │
│  ✗ $text cannot be used in $or with non-text queries            │
│    (use aggregation $text stage instead)                        │
│  ✗ Does not support prefix matching (use $regex for that)       │
│  ✓ Language-aware stemming (running → run)                      │
│  ✓ Stop word removal (the, a, is...)                            │
│  ✓ Case-insensitive by default                                  │
└─────────────────────────────────────────────────────────────────┘
```

> **Memory hook:** "$regex reads letter by letter looking for a shape; $text has already built a dictionary at the back of the book — it just looks up the word."

---

### 3.3 $expr — Aggregation Expressions in Queries

**The problem:** "find users who spent more than their budget" is comparing two *fields on the same document* against each other. Comparison operators like `$gt` only ever compare a field to a fixed value you supply — they have no way to say "compare field A to field B." `$expr` is the bridge that lets aggregation-pipeline-style expressions run inside a plain `find()` filter.

**Real-world analogy:** SQL's `WHERE column1 > column2` — comparing two columns of the same row, something a simple `WHERE column1 > 100` can't do on its own.

**Definition:** `$expr` allows you to use aggregation pipeline expressions inside a `find()` query filter. This enables cross-field comparisons, computed values, and complex logic that comparison operators alone cannot express.

**Syntax:**
```js
{ $expr: { aggregationExpression } }
```

**Cross-field comparison:**
```js
// Users who have spent more than their budget (over budget)
db.users.find({
  $expr: { $gt: ["$spent", "$budget"] }
})
// Returns: carol (spent: 600 > budget: 500)

// Users who spent at least 90% of their budget
db.users.find({
  $expr: {
    $gte: [
      "$spent",
      { $multiply: ["$budget", 0.9] }
    ]
  }
})
// Returns: alice (spent 1800 of 2000 = 90%), carol (over budget), david (spent 2900 of 3000 = 96.7%)

// Users where spent equals budget (exactly on budget)
db.users.find({
  $expr: { $eq: ["$spent", "$budget"] }
})
```

**Computed values in filter:**
```js
// Users where score is more than twice the number of tags they have
db.users.find({
  $expr: {
    $gt: [
      "$score",
      { $multiply: [{ $size: "$tags" }, 2] }
    ]
  }
})

// Users whose username length is more than 8 characters
db.users.find({
  $expr: {
    $gt: [{ $strLenCP: "$username" }, 8]
  }
})
// Returns: alice_wonder (11), carol_codes (11), david_dev (9)

// Users who joined in 2022 (using date parts)
db.users.find({
  $expr: {
    $eq: [{ $year: "$joinedAt" }, 2022]
  }
})
// Returns: alice, bob
```

**$expr with conditional logic:**
```js
// Users where, IF they are active, their score must be >= 800
db.users.find({
  $expr: {
    $or: [
      { $ne: ["$status", "active"] },           // not active → always include
      { $gte: ["$score", 800] }                 // active → must have score >= 800
    ]
  }
})
// Returns: alice (active, 1500), bob (active, 980), carol (suspended), david (active, 2200)
// Excludes: eva (active, 750 < 800)
```

**$expr for array length comparisons (workaround for $size's limitation from File 02):**
```js
// Users with more than 2 tags
db.users.find({
  $expr: { $gt: [{ $size: "$tags" }, 2] }
})

// Users with exactly 3 tags
db.users.find({
  $expr: { $eq: [{ $size: "$tags" }, 3] }
})
```

**How to read an $expr query — the vocabulary it draws from:**
```
find() filter
  └── $expr
        └── aggregation expression
              ├── $gt, $lt, $eq, $ne, $gte, $lte  (comparisons)
              ├── $add, $subtract, $multiply, $divide (arithmetic)
              ├── $size, $arrayElemAt, $first, $last  (array)
              ├── $strLenCP, $toUpper, $substr        (string)
              ├── $year, $month, $dayOfMonth          (date)
              └── $cond, $ifNull, $switch             (conditional)
```

`$expr` isn't a new mini-language to learn from scratch — it's your ticket into the same aggregation expression vocabulary you'll meet in the Aggregation phase, just usable inside a plain `find()`.

> **Memory hook:** "$expr is the one operator that lets a document compare itself to itself — 'is my spending bigger than my own budget?' — something no ordinary comparison operator can even ask."

---

### 3.4 $jsonSchema — Document Validation

**The problem:** checking one field's type with `$type`, another's presence with `$exists`, a third's range with `$gte`/`$lte` — one document, ten manual checks stitched together with `$and`. `$jsonSchema` lets you describe the *entire* expected shape of a document in one declarative block, and reuse that same block both for querying and for enforcing writes.

**Definition:** `$jsonSchema` validates documents against a JSON Schema specification. Use it in collection validators (enforced on insert/update) or in `find()` queries to identify non-conforming documents.

**Syntax:**
```js
// In find() — query documents matching the schema
db.collection.find({ $jsonSchema: { ...schemaDefinition } })

// In createCollection() — enforce schema on write
db.createCollection("users", {
  validator: { $jsonSchema: { ...schemaDefinition } }
})

// In collMod — add/update validator on existing collection
db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: { ...schemaDefinition } }
})
```

**JSON Schema keywords used in MongoDB:**

```
┌──────────────────┬────────────────────────────────────────────────────┐
│ Keyword          │ Purpose                                            │
├──────────────────┼────────────────────────────────────────────────────┤
│ bsonType         │ BSON type (string alias): "string", "int", "date"  │
│ required         │ Array of field names that must be present          │
│ properties       │ Object defining schema for each field              │
│ minimum/maximum  │ Numeric range validation                           │
│ minLength/maxLen │ String length validation                           │
│ enum             │ Field must be one of specified values              │
│ pattern          │ String must match this regex                       │
│ description      │ Documentation only (no enforcement)                │
└──────────────────┴────────────────────────────────────────────────────┘
```

**Example — Define and enforce user schema:**

```js
// Define the schema
const userSchema = {
  bsonType: "object",
  required: ["username", "email", "role", "status"],
  properties: {
    username: {
      bsonType: "string",
      minLength: 3,
      maxLength: 30,
      pattern: "^[a-z0-9_]+$",
      description: "Lowercase alphanumeric and underscore only"
    },
    email: {
      bsonType: "string",
      pattern: "^[^@]+@[^@]+\\.[^@]+$",
      description: "Must be a valid email address"
    },
    age: {
      bsonType: ["int", "null"],
      minimum: 13,
      maximum: 120,
      description: "Age in years, 13-120, may be null"
    },
    role: {
      bsonType: "string",
      enum: ["admin", "moderator", "user"],
      description: "User role must be one of the allowed values"
    },
    status: {
      bsonType: "string",
      enum: ["active", "suspended", "deleted"]
    },
    score: {
      bsonType: "number",
      minimum: 0,
      description: "Numeric score, non-negative"
    },
    joinedAt: {
      bsonType: "date"
    }
  }
}

// Apply to collection
db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: userSchema },
  validationLevel: "moderate",   // "strict" | "moderate" | "off"
  validationAction: "error"      // "error" | "warn"
})
```

**Use $jsonSchema in find() to find invalid documents:**
```js
// Find documents that do NOT conform to the schema (violating documents)
db.users.find({
  $nor: [{ $jsonSchema: userSchema }]
})
// This finds documents that FAIL the schema — useful for data quality checks

// Find documents that DO conform
db.users.find({ $jsonSchema: userSchema })
// Returns: alice, bob, david, eva (all valid)
// Missing: carol (score is "unrated" string, age is null but that's allowed)

// Check for a specific violation — score is not a number
db.users.find({
  $nor: [{
    $jsonSchema: {
      bsonType: "object",
      properties: {
        score: { bsonType: "number" }
      }
    }
  }]
})
// Returns: carol (score: "unrated")
```

That `$nor: [{ $jsonSchema: ... }]` trick is worth remembering on its own — `$jsonSchema` only has a "does this match" form, so wrapping it in `$nor` is how you flip it into "find the documents that fail."

**validationLevel options:**
```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Level        │ Behaviour                                                │
├──────────────┼──────────────────────────────────────────────────────────┤
│ strict       │ All inserts AND updates must pass validation             │
│ moderate     │ Inserts must pass; updates to EXISTING invalid docs ok   │
│ off          │ No validation enforced (schema ignored)                  │
└──────────────┴──────────────────────────────────────────────────────────┘
```

`moderate` is exactly the safety valve you want during a migration: existing bad documents (like carol's) are grandfathered in and can still be updated without blocking on unrelated fields, while every brand-new insert has to be clean.

> **Memory hook:** "$jsonSchema is the bouncer with a full checklist at the door — instead of asking ten separate yes/no questions, it reads the whole checklist in one glance."

---

## 4. Why to Avoid $where

**The problem `$where` seems to solve:** "I just want to write a JavaScript condition and let MongoDB run it" — which sounds convenient right up until you realize what that convenience actually costs.

`$where` allows you to run arbitrary JavaScript expressions to filter documents. It is powerful but dangerous and should be avoided in all production code.

**How it works:**
```js
// $where syntax (DO NOT USE IN PRODUCTION)
db.users.find({ $where: "this.spent > this.budget" })
db.users.find({ $where: function() { return this.score > 1000; } })
```

Notice that's the exact same "spent > budget" question `$expr` answered a moment ago — and that's not a coincidence. It's the example to hold onto: `$where` and `$expr` can express the same query, but only one of them is safe to run.

**Why to avoid it:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEMS WITH $where                                               │
│                                                                     │
│  1. SECURITY — JavaScript injection attacks                         │
│     If user input is ever embedded in the $where string,            │
│     attackers can execute arbitrary code on your server.            │
│     Example: { $where: userInput }  ← CRITICAL VULNERABILITY        │
│                                                                     │
│  2. PERFORMANCE — Cannot use indexes                                │
│     $where must load every document into the JS engine and run      │
│     the script. Full collection scan every time. No exceptions.     │
│                                                                     │
│  3. SLOW — JavaScript execution overhead                            │
│     Even for small collections, the V8 JS engine startup and        │
│     context switching per document is far slower than native         │
│     BSON operators.                                                 │
│                                                                     │
│  4. DEPRECATED — Removed in Atlas, restricted in newer versions     │
│     MongoDB Atlas disables $where entirely. Self-hosted deployments  │
│     may allow it but it is considered legacy.                        │
│                                                                     │
│  5. NO SERVER-SIDE CACHING — Each $where query is unique to the JS  │
│     engine and bypasses the plan cache.                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Always use $expr instead:**
```js
// WRONG — uses $where, slow and risky
db.users.find({ $where: "this.spent > this.budget" })

// RIGHT — uses $expr, can use indexes, safe
db.users.find({ $expr: { $gt: ["$spent", "$budget"] } })

// WRONG
db.users.find({ $where: "this.username.length > 8" })

// RIGHT
db.users.find({ $expr: { $gt: [{ $strLenCP: "$username" }, 8] } })
```

**Common mistake:** reaching for `$where` because it feels natural — "I know JavaScript, I'll just write a JS condition." Every single case where that impulse strikes has an `$expr` equivalent that is safer, often faster, and won't be silently disabled the moment you move to Atlas.

> **Memory hook:** "$where hands the front door key to a stranger and says 'run whatever code you like'; $expr only ever lets you pick from a locked toolbox of safe comparisons."

---

## 5. Operator Performance Comparison

```
┌─────────────────┬──────────────┬────────────────────────────────────────┐
│ Operator        │ Index Use    │ Notes                                  │
├─────────────────┼──────────────┼────────────────────────────────────────┤
│ $exists: true   │ Partial      │ Sparse index needed for best perf      │
│ $exists: false  │ Poor         │ Must scan to confirm absence           │
│ $type           │ Poor         │ Type not stored in standard indexes     │
│ $regex (prefix) │ Good         │ Only ^pattern with no i flag           │
│ $regex (other)  │ Poor         │ Full scan required                     │
│ $text           │ Excellent    │ Dedicated text index; inverted index   │
│ $expr           │ Limited      │ Some expressions can use indexes       │
│ $jsonSchema     │ None         │ Always full scan                       │
│ $where          │ None         │ Always full scan + JS overhead         │
└─────────────────┴──────────────┴────────────────────────────────────────┘
```

**When to use what:**

```
Need to check field presence?
  └── Use $exists

Need to validate field type?
  └── Use $type

Need pattern matching on a string?
  ├── Prefix match (^pattern, case-sensitive) → $regex (uses index)
  └── Full-text search across words → $text (requires text index)

Need to compare two fields in same document?
  └── Use $expr (NOT $where)

Need to enforce/query document structure?
  └── Use $jsonSchema

Using JavaScript for filtering?
  └── Replace with $expr — $where is deprecated and unsafe
```

---

## 6. Real-World Use Cases

**Data Migration Audit:**
```js
// Find documents missing the new "tier" field added in v2 schema
db.users.find({ tier: { $exists: false } })

// Find documents where "score" was accidentally stored as a string
db.users.find({ score: { $type: "string" } })

// Fix them all
db.users.updateMany(
  { score: { $type: "string" } },
  [{ $set: { score: { $toDouble: "$score" } } }]
)
```

**Search Feature:**
```js
// Create text index for blog post search
db.posts.createIndex(
  { title: "text", body: "text", tags: "text" },
  { weights: { title: 5, body: 1, tags: 3 } }
)

// User search query with relevance score
db.posts.find(
  { $text: { $search: req.query.q } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } }).limit(10)
```

**E-commerce Stock Alert:**
```js
// Products where the reorder threshold field exists AND stock is below it
db.products.find({
  reorderThreshold: { $exists: true },
  $expr: { $lte: ["$stock", "$reorderThreshold"] }
})
```

**User Segmentation:**
```js
// Power users — active, high score, and have been logged in recently
db.users.find({
  status: "active",
  score: { $gte: 1000 },
  $expr: {
    $gte: [
      "$lastLogin",
      { $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 30 } }
    ]
  }
})
```

**Schema Validation Report:**
```js
const requiredSchema = {
  bsonType: "object",
  required: ["email", "username", "role"],
  properties: {
    email:    { bsonType: "string" },
    username: { bsonType: "string" },
    role:     { enum: ["admin", "moderator", "user"] }
  }
}

// Count how many documents fail schema
db.users.countDocuments({ $nor: [{ $jsonSchema: requiredSchema }] })

// List them
db.users.find(
  { $nor: [{ $jsonSchema: requiredSchema }] },
  { _id: 1, username: 1, email: 1, role: 1 }
)
```

---

## 8. Hands-On Exercises

Use the `users` collection from Section 1.

**Exercise 1 — $exists and $type:**
Find all users who:
- Have an address field (it exists)
- Have an age that is a number (not null)
- Have a phone number

```js
db.users.find({
  address:     { $exists: true },
  age:         { $type: "number" },
  phoneNumber: { $exists: true }
})
// Returns: alice (has all three), david (has all three)
```

**Exercise 2 — $regex with options:**
Find all users whose bio mentions either "engineer" or "developer" (case-insensitive), and whose email does NOT end in .com.

```js
db.users.find({
  bio:   { $regex: /engineer|developer/i },
  email: { $not: /\.com$/ }
})
// Returns: david (engineer, email ends in .org), eva (developer, email ends in .io)
```

**Exercise 3 — $text search with scoring:**
First create a text index on `bio` and `fullName`. Then find all users whose bio or name matches "developer engineer" and return their names sorted by relevance.

```js
// Step 1: create index
db.users.createIndex({ bio: "text", fullName: "text" })

// Step 2: query with relevance sort
db.users.find(
  { $text: { $search: "developer engineer" } },
  { fullName: 1, score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })
// Returns: alice, bob, david, eva (all mention developer or engineer)
// david may score highest with "DevOps engineer" + "Developer" in fullName
```

**Exercise 4 — $expr cross-field:**
Find all users where the remaining budget (budget - spent) is less than 200. Also include users who are over budget (spent > budget).

```js
db.users.find({
  $expr: {
    $lt: [
      { $subtract: ["$budget", "$spent"] },
      200
    ]
  }
})
// Returns: carol (600 - 500 = -100 < 200), david (3000 - 2900 = 100 < 200), alice (2000 - 1800 = 200 — NOT included, 200 is not < 200)
// If you want <= 200: $lte instead
```

**Exercise 5 — $jsonSchema data audit:**
Write a `$jsonSchema` query to find all users where the `score` field is not a number (it should be). Return only `_id`, `username`, and `score`.

```js
db.users.find(
  {
    $nor: [{
      $jsonSchema: {
        bsonType: "object",
        properties: {
          score: { bsonType: "number" }
        }
      }
    }],
    score: { $exists: true }   // ensure field exists (missing is different from wrong type)
  },
  { _id: 1, username: 1, score: 1 }
)
// Returns: carol (_id: 3, username: "carol_codes", score: "unrated")
```

---

## 9. Interview Q&A

**Q1: What is the difference between `$exists: true` and checking for `null`?**

A: `$exists: true` matches documents where the field is present in the document, even if its value is `null`. `{ field: null }` (or `{ field: { $eq: null } }`) matches documents where the field is either `null` OR the field is absent entirely. These two cases can overlap: a field set to `null` will match both `$exists: true` AND `{ field: null }`.

---

**Q2: How does `$type` differ from checking the value directly?**

A: `$type` checks the BSON data type of the field's value, not the value itself. It answers "what kind of data is this?" rather than "what is this data?". This is essential in schemaless MongoDB collections where the same field can hold different types across documents — a `$type` check catches that mismatch before it causes errors in application code.

---

**Q3: When can $regex use an index and when can it not?**

A: `$regex` can use a B-tree index only for left-anchored patterns — patterns starting with `^` followed by literal characters, without the `i` (case-insensitive) flag. For example, `{ username: /^alice/ }` can use an index on `username`. Any unanchored pattern (`/alice/`), any case-insensitive pattern (`/^alice/i`), or any pattern with special characters at the start cannot use a standard index efficiently. For full-text searching, use a text index with `$text` instead.

---

**Q4: What is a text index and why can you only have one per collection?**

A: A text index is a special MongoDB index that tokenises string fields into individual words, removes stop words, optionally applies stemming, and creates an inverted index mapping each word to the documents containing it. MongoDB limits one text index per collection because the index can cover multiple fields and the tokenisation/weighting is done at index creation time. If you need to search additional fields later, you must drop and recreate the text index with the new fields included.

---

**Q5: What is `$meta: "textScore"` and how is it used?**

A: `$meta: "textScore"` extracts the relevance score computed by the text index for each document matching a `$text` query. The score is based on term frequency (how often the search term appears), inverse document frequency (how rare the term is), and field weights. It is used in the projection: `{ score: { $meta: "textScore" } }` and in the sort: `.sort({ score: { $meta: "textScore" } })` to return results from most to least relevant.

---

**Q6: What can $expr do that comparison operators cannot?**

A: `$expr` enables three things that basic comparison operators cannot: (1) comparing two fields within the same document against each other (e.g., `$gt: ["$spent", "$budget"]`); (2) using computed values in the filter (e.g., multiplying a field by a constant and comparing); and (3) using the full aggregation expression vocabulary inside a query filter, including date operators, string operators, array operators, and conditional logic.

---

**Q7: How does `$jsonSchema` differ from using `$type` and `$exists` manually?**

A: `$jsonSchema` provides declarative, composable schema validation in a single expression. It can validate required fields, types, string patterns, numeric ranges, array structures, and nested documents all at once. Using individual `$type` and `$exists` checks requires a complex `$and`/`$or` expression and is harder to maintain. `$jsonSchema` also integrates with MongoDB's collection validator to enforce schema on every write operation, which manual query operators cannot do.

---

**Q8: What are `validationLevel` and `validationAction` in collection validators?**

A: `validationLevel` controls which documents are validated: `strict` (all inserts and updates must pass), `moderate` (inserts must pass; updates to already-invalid documents are allowed through), `off` (no validation). `validationAction` controls what happens when validation fails: `error` (rejects the write and returns an error), `warn` (allows the write but logs a warning). In production, `strict` + `error` is the safest for new collections. `moderate` + `warn` is useful during migrations.

---

**Q9: Why is $where dangerous and what exactly can go wrong?**

A: `$where` executes arbitrary JavaScript in the mongod server process. The risks are: (1) Server-Side JavaScript Injection — if any user-controlled input is included in the `$where` expression without sanitisation, an attacker can execute any JS code with the privileges of the mongod process; (2) Denial of Service — a malicious or accidental infinite loop in `$where` can consume all server CPU; (3) No index use means even a legitimate `$where` query will cause a full collection scan. MongoDB has disabled `$where` entirely on Atlas clusters.

---

**Q10: How do you search for an exact phrase with $text?**

A: Wrap the phrase in escaped double quotes within the `$search` string: `{ $text: { $search: "\"machine learning\"" } }`. Without the quotes, MongoDB treats each word as an independent search term (OR logic). With the quotes, it only matches documents where both words appear adjacent and in that order.

---

**Q11: Can you use $text inside an $or query?**

A: Not directly in a `find()` filter. MongoDB restricts `$text` to appear at the top level of the query (or inside `$and` at the top level). Using `$text` inside `$or` is not allowed in the query language. The workaround is to use the `$text` aggregation operator inside an `$match` stage in an aggregation pipeline, or to run separate queries and merge the results in application code.

---

**Q12: What is a sparse index and how does it relate to $exists?**

A: A sparse index only includes index entries for documents that have the indexed field (and whose value is not null). A normal (non-sparse) index includes entries for all documents, storing null for missing fields. For `$exists: true` queries on a field that is absent from many documents, a sparse index is far smaller and more efficient. Create one with: `db.users.createIndex({ phoneNumber: 1 }, { sparse: true })`.

---

**Q13: How does MongoDB handle $type matching for numbers stored as different numeric BSON types?**

A: MongoDB has separate BSON types for `int` (32-bit), `long` (64-bit), `double` (64-bit float), and `decimal` (128-bit Decimal128). `{ field: { $type: "int" } }` will NOT match a value stored as a double even if they compare equal numerically. The special alias `"number"` matches all numeric types: `{ field: { $type: "number" } }` is equivalent to `{ field: { $type: ["int", "long", "double", "decimal"] } }`.

---

**Q14: What is the `$` meta projection operator and when else is it used besides textScore?**

A: The `$meta` projection operator in MongoDB currently supports `"textScore"` (the relevance score from a `$text` query) and `"indexKey"` (the index key for the winning plan, used for debugging). In the aggregation pipeline, `$meta` is used similarly. For `$text` queries, always pair the `$meta` textScore projection with a corresponding `$meta` sort to actually order by relevance — without the sort, document order is arbitrary.

---

**Q15: How would you audit an entire production collection for schema violations without taking the system down?**

A: Use `$jsonSchema` inside a `find()` with `$nor` to identify non-conforming documents without blocking writes: `db.collection.find({ $nor: [{ $jsonSchema: schemaDefinition }] })`. Add `.hint()` if there is a useful index. For large collections, paginate with `_id` cursors instead of `skip`. Run the audit during low-traffic windows. After identifying violations, fix data with `updateMany` and then add a collection validator with `validationLevel: "moderate"` first (to allow existing bad docs through while requiring new writes to be valid), then tighten to `"strict"` once all violations are resolved.
