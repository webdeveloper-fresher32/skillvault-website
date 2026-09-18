# Array Operators

```
┌─────────────────────────────────────────────────────────────────────┐
│                  FILE 02 — ARRAY OPERATORS                          │
│                                                                     │
│  Query:  $all  $elemMatch  $size                                    │
│  Update: $push $pull $addToSet $pop $each $slice $sort              │
│  Topic:  Querying nested arrays                                     │
└─────────────────────────────────────────────────────────────────────┘
```

File 01 covered comparing and combining *fields*. But real documents rarely stop at flat fields — a student has a list of courses, a cart has a list of items, a product has a list of reviews. The moment a field becomes an array, "does this match?" gets a lot more interesting: does it mean *any* element matches, *all* elements match, or *one specific* element matches every condition at once? That distinction is what this whole file is about — reading arrays precisely, and then updating them safely.

## Table of Contents

1. [Sample Dataset](#1-sample-dataset)
2. [How MongoDB Stores Arrays](#2-how-mongodb-stores-arrays)
3. [Array Query Operators](#3-array-query-operators)
   - 3.1 [$all — Contains All Elements](#31-all--contains-all-elements)
   - 3.2 [$elemMatch — Element Matches Multiple Conditions](#32-elemmatch--element-matches-multiple-conditions)
   - 3.3 [$size — Exact Array Length](#33-size--exact-array-length)
4. [Querying Nested Arrays](#4-querying-nested-arrays)
5. [Array Update Operators](#5-array-update-operators)
   - 5.1 [$push — Append Elements](#51-push--append-elements)
   - 5.2 [$pull — Remove Elements by Value/Condition](#52-pull--remove-elements-by-valuecondition)
   - 5.3 [$addToSet — Add If Not Duplicate](#53-addtoset--add-if-not-duplicate)
   - 5.4 [$pop — Remove First or Last Element](#54-pop--remove-first-or-last-element)
   - 5.5 [$each — Push Multiple Elements](#55-each--push-multiple-elements)
   - 5.6 [$slice — Trim Array After Push](#56-slice--trim-array-after-push)
   - 5.7 [$sort (with $push) — Sort Array After Push](#57-sort-with-push--sort-array-after-push)
6. [The Positional $ Operator](#6-the-positional--operator)
7. [Comparison Table — Array Update Operators](#7-comparison-table--array-update-operators)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Sample Dataset

Same drill as File 01 — get the data loaded first, then read the operators against something real instead of in the abstract.

```js
use ecommerce

db.students.drop()

db.students.insertMany([
  {
    _id: 1,
    name: "Alice Chen",
    courses: ["MongoDB", "SQL", "Python"],
    scores: [
      { subject: "MongoDB", grade: 92, passed: true },
      { subject: "SQL",     grade: 78, passed: true },
      { subject: "Python",  grade: 55, passed: false }
    ],
    badges: ["fast-learner", "consistent"],
    loginDays: [1, 3, 5, 7, 8, 12]
  },
  {
    _id: 2,
    name: "Bob Martinez",
    courses: ["MongoDB", "JavaScript", "Node.js"],
    scores: [
      { subject: "MongoDB",    grade: 65, passed: true  },
      { subject: "JavaScript", grade: 88, passed: true  },
      { subject: "Node.js",    grade: 91, passed: true  }
    ],
    badges: ["consistent", "night-owl"],
    loginDays: [2, 4, 6, 8, 10]
  },
  {
    _id: 3,
    name: "Carol Kim",
    courses: ["SQL", "Python"],
    scores: [
      { subject: "SQL",    grade: 95, passed: true  },
      { subject: "Python", grade: 88, passed: true  }
    ],
    badges: ["top-scorer"],
    loginDays: [1, 2, 3, 4, 5, 6, 7]
  },
  {
    _id: 4,
    name: "David Osei",
    courses: ["MongoDB", "SQL", "Python", "JavaScript"],
    scores: [
      { subject: "MongoDB",    grade: 72, passed: true  },
      { subject: "SQL",        grade: 45, passed: false },
      { subject: "Python",     grade: 80, passed: true  },
      { subject: "JavaScript", grade: 60, passed: true  }
    ],
    badges: [],
    loginDays: [5, 10, 15, 20]
  },
  {
    _id: 5,
    name: "Eva Nguyen",
    courses: ["MongoDB", "Python", "JavaScript"],
    scores: [
      { subject: "MongoDB",    grade: 98, passed: true  },
      { subject: "Python",     grade: 95, passed: true  },
      { subject: "JavaScript", grade: 97, passed: true  }
    ],
    badges: ["top-scorer", "fast-learner", "consistent"],
    loginDays: [1,2,3,4,5,6,7,8,9,10,11,12,13,14]
  }
])

// Also create a products collection for update operator demos
db.carts.drop()
db.carts.insertMany([
  {
    _id: 101,
    userId: "user_A",
    items: ["laptop", "mouse", "keyboard"],
    recentSearches: ["monitor", "headphones", "webcam", "dock", "hub"],
    wishlist: [
      { product: "Chair",   price: 349 },
      { product: "Monitor", price: 399 },
      { product: "Desk",    price: 599 }
    ]
  },
  {
    _id: 102,
    userId: "user_B",
    items: ["phone", "case"],
    recentSearches: ["charger", "cable"],
    wishlist: [
      { product: "Phone Pro", price: 999 },
      { product: "Earbuds",   price: 199 }
    ]
  }
])
```

Keep both collections open in a shell tab — every query and update below runs against them.

---

## 2. How MongoDB Stores Arrays

**The problem this solves:** in a relational database, "a student has many courses" usually means a separate `enrollments` table and a JOIN just to answer "what courses does Alice take?" MongoDB asks: why split that out at all, if the array is small and always read together with the student?

**Real-world analogy:** think of a folder that holds a checklist right inside it, instead of a separate filing cabinet you have to walk to and cross-reference every time you open the folder.

MongoDB is a document database with first-class array support. Arrays are not stored as separate join tables — they live inside the document itself.

```
┌─────────────────────────────────────────────────────────────────┐
│  Document with array fields                                     │
│                                                                 │
│  {                                                              │
│    _id: 1,                                                      │
│    name: "Alice",                                               │
│    courses: ["MongoDB", "SQL", "Python"],    ← simple array    │
│    scores: [                                 ← array of docs   │
│      { subject: "MongoDB", grade: 92 },                        │
│      { subject: "SQL",     grade: 78 }                         │
│    ]                                                            │
│  }                                                              │
│                                                                 │
│  Array index access: scores.0.grade === 92                      │
│  (zero-based indexing with dot notation)                        │
└─────────────────────────────────────────────────────────────────┘
```

**Key behaviours:**
- MongoDB indexes each array element individually (multikey index).
- A query like `{ courses: "MongoDB" }` matches if ANY element of the `courses` array equals "MongoDB".
- Order within an array is preserved.
- Arrays can contain mixed types.

> **Memory hook:** "The checklist lives inside the folder — you never have to walk to another cabinet just to see what's on it."

---

## 3. Array Query Operators

### 3.1 $all — Contains All Elements

**The problem:** you want to check that an array contains a whole *set* of values, not just one. "Give me every student who knows MongoDB" is one condition. "Give me every student who knows MongoDB *and* SQL *and* Python" is a different kind of question — and writing `{ courses: "MongoDB", courses: "SQL" }` won't work (same key-collision issue from File 01).

**Real-world analogy:** A job posting that requires ALL of: "MongoDB, SQL, and Python" skills — a candidate who knows all three (plus others) qualifies. A candidate who only knows two of the three does not.

**Definition:** `$all` matches documents where an array field contains ALL of the specified values (order does not matter, extra elements are allowed).

**Syntax:**
```js
{ arrayField: { $all: [value1, value2, ...] } }
```

**Examples:**

```js
// Students enrolled in BOTH MongoDB AND SQL
db.students.find({ courses: { $all: ["MongoDB", "SQL"] } })
// Returns: Alice (has both), David (has both)
// NOT Bob: only has MongoDB, not SQL

// Students with all three courses: MongoDB, SQL, Python
db.students.find({ courses: { $all: ["MongoDB", "SQL", "Python"] } })
// Returns: Alice, David

// Students who have earned both "consistent" and "fast-learner" badges
db.students.find({ badges: { $all: ["consistent", "fast-learner"] } })
// Returns: Alice, Eva

// Order does not matter — same result:
db.students.find({ courses: { $all: ["Python", "MongoDB"] } })
```

Worth pausing on that last one: `$all` doesn't care what order the values were pushed in, and it doesn't care if the array has *more* elements than the ones you listed. It only cares that every value you asked for shows up somewhere.

**$all vs simple array equality — a common mix-up:**
```js
// Exact match — array must be exactly ["MongoDB", "SQL"] in that order
db.students.find({ courses: ["MongoDB", "SQL"] })

// $all — array must CONTAIN both, in any order, with any extras
db.students.find({ courses: { $all: ["MongoDB", "SQL"] } })
```

That first query is deceptively strict — it demands the array be *exactly* `["MongoDB", "SQL"]`, nothing more, nothing less, in that exact order. It's easy to reach for it thinking it means "contains both," when really you wanted `$all`.

**$all with $elemMatch inside (advanced — covered fully once you've read 3.2):**
```js
// Students who have a score doc with grade >= 90 for ANY subject
// AND a separate score doc with passed: false
db.students.find({
  scores: {
    $all: [
      { $elemMatch: { grade: { $gte: 90 } } },
      { $elemMatch: { passed: false } }
    ]
  }
})
```

> **Memory hook:** "$all is the job posting that wants every skill on the list — extra skills are a bonus, missing even one is a rejection."

---

### 3.2 $elemMatch — Element Matches Multiple Conditions

**The problem:** here's a trap that catches almost everyone at least once. Say you want "students who scored 90+ in some subject AND failed some subject." You write two conditions on the `scores` array and expect them to describe one struggling-but-brilliant student. Except MongoDB doesn't assume the two conditions have to land on the *same* array element — and that's a very different question from "one particular score entry has both a high grade and a fail."

**Real-world analogy:** Imagine a hiring filter: "an employee who was rated 'excellent' in some review AND was late to work in some other review" — that could describe two completely different periods of the same person's history. What you probably actually meant was "one specific review where they were both excellent *and* had an attendance issue noted." Those are different searches, and `$elemMatch` is how you ask for the second one.

**Definition:** `$elemMatch` matches documents where at least ONE array element satisfies ALL of the specified conditions simultaneously.

**Syntax:**
```js
{ arrayField: { $elemMatch: { condition1, condition2, ... } } }
```

**Internal working — the critical distinction, with vs without `$elemMatch`:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  WITHOUT $elemMatch                                                 │
│                                                                     │
│  db.students.find({                                                 │
│    "scores.grade": { $gte: 90 },                                    │
│    "scores.passed": false                                           │
│  })                                                                 │
│                                                                     │
│  MongoDB checks: does ANY element have grade >= 90?   YES/NO        │
│              AND does ANY element have passed = false? YES/NO       │
│  These conditions can match DIFFERENT array elements!               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Student Alice:                                              │   │
│  │    { subject: "MongoDB", grade: 92, passed: true  }  ← 92   │   │
│  │    { subject: "Python",  grade: 55, passed: false } ← false │   │
│  │                                                              │   │
│  │  grade >= 90? YES (from MongoDB element)                     │   │
│  │  passed = false? YES (from Python element)                   │   │
│  │  WITHOUT $elemMatch → MATCHES (even though they're different │   │
│  │  elements)                                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  WITH $elemMatch                                                    │
│                                                                     │
│  db.students.find({                                                 │
│    scores: { $elemMatch: { grade: { $gte: 90 }, passed: false } }   │
│  })                                                                 │
│                                                                     │
│  MongoDB checks: does ONE element have grade >= 90 AND passed=false?│
│  BOTH conditions must match the SAME element.                       │
│                                                                     │
│  Alice: No single element has both grade >= 90 AND passed = false.  │
│  → DOES NOT MATCH                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Examples:**

```js
// WITHOUT $elemMatch — finds students with ANY element grade >= 90
// AND ANY element passed = false (they can be different elements)
db.students.find({
  "scores.grade": { $gte: 90 },
  "scores.passed": false
})
// Returns: Alice (92 in MongoDB; false in Python — different elements!)

// WITH $elemMatch — finds students where ONE score element has grade >= 90 AND passed = false
db.students.find({
  scores: { $elemMatch: { grade: { $gte: 90 }, passed: false } }
})
// Returns: Nothing! No single score doc has both high grade AND failed status.

// Find students with a failing grade (below 60)
db.students.find({
  scores: { $elemMatch: { grade: { $lt: 60 } } }
})
// Returns: Alice (55 in Python), David (45 in SQL)

// Find students who passed MongoDB with grade >= 80
db.students.find({
  scores: { $elemMatch: { subject: "MongoDB", grade: { $gte: 80 }, passed: true } }
})
// Returns: Alice (92), Eva (98)

// Find students with a grade between 60 and 75 in any subject
db.students.find({
  scores: { $elemMatch: { grade: { $gte: 60, $lte: 75 } } }
})
// Returns: Alice (55 too low, 78 too high — no), Bob (65), David (72, 60)
```

**When you don't actually need `$elemMatch`:**
```js
// For a simple array of scalars with one condition, $elemMatch is not required:
db.students.find({ loginDays: 7 })          // finds students who logged in on day 7
db.students.find({ loginDays: { $gt: 10 } }) // finds students with any loginDay > 10

// But for arrays of embedded documents, always use $elemMatch for multi-condition:
db.students.find({
  scores: { $elemMatch: { subject: "SQL", grade: { $gte: 80 } } }
})
```

The rule of thumb: one condition on a scalar array, no `$elemMatch` needed. Two or more conditions that must land on the *same* embedded document, `$elemMatch` is mandatory — otherwise you silently get the "different elements" behaviour from the diagram above.

**Interview answer:** "Without `$elemMatch`, MongoDB evaluates each condition independently across all elements of the array — condition A can be satisfied by element 1 while condition B is satisfied by element 2, and the document still matches. With `$elemMatch`, all the listed conditions must be satisfied by a single array element. This distinction only matters once you have two or more conditions on an array of embedded documents — for a single condition, or a flat array of scalars, the two forms behave the same."

> **Memory hook:** "Without `$elemMatch`, MongoDB is happy if the clues come from different suspects. With `$elemMatch`, one suspect has to check every box."

---

### 3.3 $size — Exact Array Length

**The problem:** sometimes what you care about isn't *what's* in the array, but *how many* things are in it — "students taking exactly 2 courses," "carts with exactly one item left."

**Real-world analogy:** A shopping cart display that says "3 items" — you're not asking what's in the cart, just how many things are sitting in it.

**Definition:** `$size` matches documents where an array field has an exact number of elements.

**Syntax:**
```js
{ arrayField: { $size: number } }
```

**Important limitation:** `$size` only supports exact equality — there is no `$size: { $gt: 3 }`. For range queries on array length, use aggregation or `$expr`.

**Examples:**

```js
// Students enrolled in exactly 2 courses
db.students.find({ courses: { $size: 2 } })
// Returns: Carol (SQL, Python)

// Students enrolled in exactly 3 courses
db.students.find({ courses: { $size: 3 } })
// Returns: Alice, Bob, Eva

// Students with exactly 4 courses
db.students.find({ courses: { $size: 4 } })
// Returns: David

// Students with no badges (empty array)
db.students.find({ badges: { $size: 0 } })
// Returns: David

// Students who logged in on exactly 5 days
db.students.find({ loginDays: { $size: 5 } })
// Returns: Bob

// Range on array length — workaround using $expr
// Students enrolled in MORE than 2 courses:
db.students.find({
  $expr: { $gt: [{ $size: "$courses" }, 2] }
})
// Returns: Alice, Bob, David, Eva
```

That last query is the one worth remembering — since `$size` can't take a range operator directly, `$expr` plus the aggregation-style `$size` expression is the escape hatch whenever you need "more than N" or "fewer than N" elements.

> **Memory hook:** "$size counts, it doesn't inspect — 'exactly 3 items,' full stop, no 'more than' allowed without help from `$expr`."

---

## 4. Querying Nested Arrays

**The problem:** real documents combine everything above — arrays of embedded documents, array indexes, and even arrays inside arrays. Once you've seen `$elemMatch` and dot notation individually, the natural next question is "how do these combine in a real query?"

When your documents contain arrays of embedded documents, you combine dot notation, `$elemMatch`, and comparison operators.

**Array of embedded documents structure:**
```
student
  ├── name
  └── scores  ← array of documents
        ├── [0]: { subject: "MongoDB", grade: 92, passed: true }
        ├── [1]: { subject: "SQL",     grade: 78, passed: true }
        └── [2]: { subject: "Python",  grade: 55, passed: false }
```

**Query patterns:**

```js
// 1. Match if ANY element's field satisfies the condition (dot notation)
db.students.find({ "scores.grade": { $gte: 90 } })
// Returns students with AT LEAST ONE score of 90+

// 2. Match if ANY element's specific field equals a value
db.students.find({ "scores.subject": "MongoDB" })

// 3. Match using index position — first score element's grade
db.students.find({ "scores.0.grade": { $gte: 80 } })

// 4. Multi-condition on same element (use $elemMatch)
db.students.find({
  scores: { $elemMatch: { subject: "Python", grade: { $gte: 80 } } }
})

// 5. Combine array query with non-array field
db.students.find({
  name: { $ne: "David Osei" },
  scores: { $elemMatch: { passed: false } }
})
```

**Arrays within arrays (matrix-style):**
```js
db.matrices.insertOne({
  _id: 1,
  data: [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
})

// Query nested array element: data[1][2] (row 1, col 2)
db.matrices.find({ "data.1.2": 6 })
```

**Array of objects with $all and $elemMatch combined:**
```js
// Students who have BOTH a MongoDB score AND a Python score where grade >= 80
db.students.find({
  scores: {
    $all: [
      { $elemMatch: { subject: "MongoDB", grade: { $gte: 80 } } },
      { $elemMatch: { subject: "Python",  grade: { $gte: 80 } } }
    ]
  }
})
// Returns: Eva (98 MongoDB, 95 Python)
```

That combo — `$all` wrapping multiple `$elemMatch` clauses — is really "AND across elements, with each condition anchored to its own element." It's the answer to "find documents where two *different, independent* embedded documents each satisfy their own multi-field condition."

---

## 5. Array Update Operators

Reading arrays is only half the picture — production apps constantly need to grow, shrink, and reshape them too: append a course, remove a stale search term, cap a log at the last N entries. That's what this whole section is for.

```
┌────────────────────────────────────────────────────────────────┐
│  UPDATE COMMAND STRUCTURE                                      │
│                                                                │
│  db.collection.updateOne(                                      │
│    { filter },           ← which document(s) to update        │
│    { $operator: { field: value } }   ← what to change         │
│  )                                                             │
└────────────────────────────────────────────────────────────────┘
```

### 5.1 $push — Append Elements

**The problem:** a student finishes a new course, or gets a new score entry — you need to add it to an existing array without rewriting the whole array yourself.

**Real-world analogy:** Adding one more line to a running to-do list — you don't retype the whole list, you just add the new item to the end.

`$push` appends one or more elements to an array. If the field does not exist, it creates the array.

**Syntax:**
```js
// Single element
{ $push: { arrayField: value } }

// Multiple elements (with $each)
{ $push: { arrayField: { $each: [v1, v2, v3] } } }
```

**Examples:**

```js
// Alice completes a new course — add "Node.js" to her courses
db.students.updateOne(
  { _id: 1 },
  { $push: { courses: "Node.js" } }
)

// Alice gets a new score document
db.students.updateOne(
  { _id: 1 },
  { $push: { scores: { subject: "Node.js", grade: 84, passed: true } } }
)

// Add multiple badges at once (using $each)
db.students.updateOne(
  { _id: 4 },
  { $push: { badges: { $each: ["hard-worker", "improved"] } } }
)

// $push always allows duplicates — pushing "MongoDB" again adds it twice
db.students.updateOne(
  { _id: 1 },
  { $push: { courses: "MongoDB" } }  // courses now has "MongoDB" twice!
)
```

That last example is worth flagging early, because it sets up the very next operator: `$push` will happily add the same value twice. If you don't want duplicates, you want `$addToSet` (Section 5.3), not `$push`.

**Before/After diagram:**
```
BEFORE: courses: ["MongoDB", "SQL", "Python"]
$push "Node.js"
AFTER:  courses: ["MongoDB", "SQL", "Python", "Node.js"]
```

> **Memory hook:** "$push never checks the guest list — it just lets everyone in, twice if you ask it to."

---

### 5.2 $pull — Remove Elements by Value or Condition

**The problem:** the opposite of `$push` — a course gets dropped, a badge gets revoked, a stale entry needs to disappear from the array, wherever it happens to sit.

**Real-world analogy:** Crossing an item off a to-do list — except `$pull` crosses off *every* matching item, not just the first one it finds.

`$pull` removes all array elements that match a specified value or condition.

**Syntax:**
```js
// Remove by exact value
{ $pull: { arrayField: value } }

// Remove by condition
{ $pull: { arrayField: { $operator: value } } }

// Remove embedded documents by field condition
{ $pull: { arrayField: { field: value } } }
```

**Examples:**

```js
// Remove "Python" from Bob's courses
db.students.updateOne(
  { _id: 2 },
  { $pull: { courses: "Python" } }
)

// Remove all loginDays less than 5 from Alice
db.students.updateOne(
  { _id: 1 },
  { $pull: { loginDays: { $lt: 5 } } }
)
// Before: [1, 3, 5, 7, 8, 12]
// After:  [5, 7, 8, 12]

// Remove the "night-owl" badge
db.students.updateOne(
  { _id: 2 },
  { $pull: { badges: "night-owl" } }
)

// Remove the failing score from David (grade < 50)
db.students.updateOne(
  { _id: 4 },
  { $pull: { scores: { grade: { $lt: 50 } } } }
)

// Remove a specific embedded document by matching a field
db.carts.updateOne(
  { _id: 101 },
  { $pull: { wishlist: { product: "Monitor" } } }
)

// $pull from ALL documents in a collection
db.students.updateMany(
  {},
  { $pull: { courses: "deprecated-course" } }
)
```

**Common mistake:** expecting `$pull` to remove just the first match, like some array `.splice()` calls you may be used to from application code. It doesn't — it removes *every* element that matches the condition, in one pass.

---

### 5.3 $addToSet — Add If Not Duplicate

**The problem:** you want `$push`'s behaviour, but without the risk of the same value ending up in the array twice — think tags, badges, roles: things that conceptually form a *set*, not a list.

**Real-world analogy:** A guest list at the door — if your name's already on it, the bouncer doesn't write it down again.

`$addToSet` adds an element to an array only if it is not already present. It treats the array as a set (no duplicates).

**Syntax:**
```js
{ $addToSet: { arrayField: value } }
```

**$push vs $addToSet:**
```
┌─────────────┬──────────────────────────────────────────────────────┐
│  Operator   │  Behaviour when element already exists               │
├─────────────┼──────────────────────────────────────────────────────┤
│ $push       │ Always appends — creates duplicates                  │
│ $addToSet   │ Checks first — skips if already present              │
└─────────────┴──────────────────────────────────────────────────────┘
```

**Examples:**

```js
// Add "JavaScript" to Alice's courses — will add because it's new
db.students.updateOne(
  { _id: 1 },
  { $addToSet: { courses: "JavaScript" } }
)

// Try to add "SQL" to Alice's courses — already there, NO change
db.students.updateOne(
  { _id: 1 },
  { $addToSet: { courses: "SQL" } }
)
// courses remains unchanged

// Add multiple badges, skipping existing ones (with $each)
db.students.updateOne(
  { _id: 5 },
  { $addToSet: { badges: { $each: ["consistent", "marathon-learner"] } } }
)
// "consistent" already exists → skipped
// "marathon-learner" is new → added

// Add items to cart (common e-commerce pattern)
db.carts.updateOne(
  { _id: 101 },
  { $addToSet: { items: "laptop" } }  // "laptop" already in items → no change
)

db.carts.updateOne(
  { _id: 101 },
  { $addToSet: { items: "webcam" } }  // "webcam" not in items → added
)
```

**Common mistake — assuming object comparison is "close enough":**
```js
// $addToSet compares objects by deep equality
// This will add a duplicate if ANY field differs:
db.carts.updateOne(
  { _id: 101 },
  { $addToSet: { wishlist: { product: "Monitor", price: 400 } } }
  // Even though product "Monitor" exists at price 399, this adds a NEW element
  // because { product:"Monitor", price:400 } !== { product:"Monitor", price:399 }
)
```

The bouncer analogy only holds for scalars and identical objects. If you're adding embedded documents, `$addToSet` compares them field-by-field — one different value (even just a price) means it's treated as a brand new element, not a duplicate.

**Interview answer:** "`$addToSet` behaves like `$push` but first checks whether the value already exists in the array, using deep equality for objects. If it already exists, nothing changes; if not, it's appended. This makes it the right tool for set-like fields — tags, roles, badges — where duplicates would be meaningless, while `$push` remains the right tool when duplicates are fine or order/frequency matters, like a log of events."

> **Memory hook:** "$addToSet is the bouncer checking the guest list first; $push just waves everyone through."

---

### 5.4 $pop — Remove First or Last Element

**The problem:** sometimes you don't want to remove a *specific* value — you just want to trim the array from one end, like discarding the oldest search term or the most recent login day.

**Real-world analogy:** Like a deque (double-ended queue) — pop from front or back.

`$pop` removes the first OR last element from an array.

**Syntax:**
```js
{ $pop: { arrayField: 1  } }   // remove LAST element
{ $pop: { arrayField: -1 } }   // remove FIRST element
```

**Examples:**

```js
// Remove the last loginDay from Alice
db.students.updateOne(
  { _id: 1 },
  { $pop: { loginDays: 1 } }
)
// Before: [1, 3, 5, 7, 8, 12]
// After:  [1, 3, 5, 7, 8]

// Remove the first loginDay from Alice
db.students.updateOne(
  { _id: 1 },
  { $pop: { loginDays: -1 } }
)
// Before: [1, 3, 5, 7, 8]
// After:  [3, 5, 7, 8]

// Remove the last search from user_A's recentSearches
db.carts.updateOne(
  { _id: 101 },
  { $pop: { recentSearches: 1 } }
)
```

**Use case — sliding window of recent items:**
```js
// Maintain a "last 5 searches" window:
// 1. Push new search to front
db.carts.updateOne(
  { _id: 101 },
  { $push: { recentSearches: { $each: ["new-search"], $position: 0 } } }
)
// 2. Trim to 5 elements max
db.carts.updateOne(
  { _id: 101 },
  { $push: { recentSearches: { $each: [], $slice: 5 } } }
)
```

> **Memory hook:** "1 pops from the back of the line, -1 pops from the front — same sign convention you'll see again in `$slice` below."

---

### 5.5 $each — Push Multiple Elements

**The problem:** what if a student finishes three courses in one sitting? Calling `$push` three separate times means three separate round trips to the database for what's really one logical update.

`$each` is a modifier used with `$push` (and `$addToSet`) to add multiple elements in a single operation.

**Syntax:**
```js
{ $push: { arrayField: { $each: [v1, v2, v3, ...] } } }
{ $addToSet: { arrayField: { $each: [v1, v2, v3, ...] } } }
```

**Examples:**

```js
// Add 3 new loginDays to Carol in one operation
db.students.updateOne(
  { _id: 3 },
  { $push: { loginDays: { $each: [8, 9, 10] } } }
)

// Add multiple courses to Bob
db.students.updateOne(
  { _id: 2 },
  { $push: { courses: { $each: ["Python", "TypeScript"] } } }
)

// Add new score documents for David
db.students.updateOne(
  { _id: 4 },
  {
    $push: {
      scores: {
        $each: [
          { subject: "React",   grade: 85, passed: true },
          { subject: "Node.js", grade: 79, passed: true }
        ]
      }
    }
  }
)

// $each with $addToSet (skips existing values)
db.students.updateOne(
  { _id: 1 },
  { $addToSet: { badges: { $each: ["consistent", "new-badge", "fast-learner"] } } }
)
// "consistent" and "fast-learner" already exist → skipped
// "new-badge" is new → added
```

Notice `$each` never shows up alone — it's always a modifier riding along inside `$push` or `$addToSet`. That's also true of the next two operators, `$slice` and `$sort`.

---

### 5.6 $slice — Trim Array After Push

**The problem:** "recent searches" or "last N activities" fields can't be allowed to grow forever — you need to add a new entry *and* trim the array back down to a fixed size, in one atomic step.

`$slice` is used as a modifier with `$push` + `$each` to limit the size of an array after elements are added. This is essential for implementing capped arrays (e.g., "keep only last N items").

**Syntax:**
```js
{ $push: { arrayField: { $each: [...], $slice: N } } }
```

| $slice value | Effect |
|---|---|
| Positive N | Keep the first N elements |
| Negative N | Keep the last N elements |
| 0 | Empty the array |

**Examples:**

```js
// Keep only the last 3 loginDays (sliding window — most recent)
db.students.updateOne(
  { _id: 1 },
  { $push: { loginDays: { $each: [15], $slice: -3 } } }
)
// Before: [3, 5, 7, 8]
// After push+slice: [7, 8, 15]  (kept last 3)

// Cap recentSearches to 5 items
db.carts.updateOne(
  { _id: 101 },
  {
    $push: {
      recentSearches: {
        $each: ["ultrawide-monitor"],
        $slice: -5    // keep the 5 most recently pushed items
      }
    }
  }
)

// $slice with no new items — just trim the array
db.students.updateOne(
  { _id: 2 },
  { $push: { loginDays: { $each: [], $slice: 3 } } }
)
// Keeps only the first 3 loginDays; adds nothing new

// Keep first 2 courses (slice from the start)
db.students.updateOne(
  { _id: 4 },
  { $push: { courses: { $each: [], $slice: 2 } } }
)
// courses: ["MongoDB", "SQL", "Python", "JavaScript"] → ["MongoDB", "SQL"]
```

That third example is a nice trick to remember: `$each: []` pushes nothing new, so `$slice` alone becomes a way to just trim an existing array down to size.

> **Memory hook:** "Same sign rule as `$pop`: negative looks backward and keeps the most recent; positive looks forward and keeps the earliest."

---

### 5.7 $sort (with $push) — Sort Array After Push

**The problem:** you push a new score in, but you also want the array to stay ordered (say, highest grade first) — without a separate sort step on the client.

`$sort` is a modifier used with `$push` + `$each` to sort the array after elements are added. It sorts the entire array, not just the newly added elements.

**Syntax:**
```js
{ $push: { arrayField: { $each: [...], $sort: 1 } } }         // ascending
{ $push: { arrayField: { $each: [...], $sort: -1 } } }        // descending
{ $push: { arrayField: { $each: [...], $sort: { field: 1 } } } } // by embedded field
```

**Examples:**

```js
// Add login days and keep sorted ascending
db.students.updateOne(
  { _id: 3 },
  { $push: { loginDays: { $each: [3, 1, 11], $sort: 1 } } }
)
// Result is sorted ascending

// Add new score and sort all scores by grade descending
db.students.updateOne(
  { _id: 2 },
  {
    $push: {
      scores: {
        $each: [{ subject: "TypeScript", grade: 74, passed: true }],
        $sort: { grade: -1 }    // sort by grade, highest first
      }
    }
  }
)

// Sort wishlist by price ascending, then keep top 3 (combine $sort + $slice)
db.carts.updateOne(
  { _id: 101 },
  {
    $push: {
      wishlist: {
        $each: [{ product: "Headphones", price: 249 }],
        $sort: { price: 1 },   // sort cheapest first
        $slice: 3              // keep only 3 items
      }
    }
  }
)
```

That last example is the pattern you'll actually use in production — `$sort` plus `$slice` together in one `$push` gives you a live top-N leaderboard, maintained with a single atomic write.

---

## 6. The Positional $ Operator

**The problem:** everything so far replaces or trims a whole array. But what if you just want to fix *one* field inside *one* matching element — say, correct Alice's MongoDB grade — without touching the rest of the array or rewriting it from scratch?

**Real-world analogy:** Correcting one line item on an invoice instead of re-typing the entire invoice.

When you need to update a specific matching element inside an array, use the positional `$` operator.

**Syntax:**
```js
db.collection.updateOne(
  { "arrayField.subField": matchValue },
  { $set: { "arrayField.$.subField": newValue } }
)
```

The `$` refers to the first element that matched the query condition.

**How it actually resolves, step by step:**
```
1. Query filter runs first: { _id: 1, "scores.subject": "MongoDB" }
       │
       ▼
2. MongoDB finds the document, then finds WHICH array index
   inside "scores" satisfied "scores.subject": "MongoDB"
   (say, index 0)
       │
       ▼
3. The "$" in the update path is substituted with that index:
   "scores.$.grade"  →  "scores.0.grade"
       │
       ▼
4. Only scores[0].grade is set — every other array element
   is left completely untouched
```

**Examples:**

```js
// Update Alice's MongoDB grade to 95
db.students.updateOne(
  { _id: 1, "scores.subject": "MongoDB" },
  { $set: { "scores.$.grade": 95 } }
)

// Mark a score as extra credit
db.students.updateOne(
  { _id: 5, "scores.subject": "JavaScript" },
  { $set: { "scores.$.extraCredit": true } }
)

// Update all matching elements — $[] (all positional) — MongoDB 3.6+
db.students.updateOne(
  { _id: 1 },
  { $set: { "scores.$[].passed": true } }  // set passed=true for ALL score elements
)

// Update matching elements with arrayFilters — $[identifier] — MongoDB 3.6+
db.students.updateOne(
  { _id: 4 },
  {
    $set: { "scores.$[elem].passed": true }
  },
  {
    arrayFilters: [{ "elem.grade": { $gte: 70 } }]
  }
)
// Updates only score elements where grade >= 70
```

**Compare the three positional forms:**

| Operator | Updates | Needs `arrayFilters`? |
|---|---|---|
| `$` | The single first element matched by the query filter | No |
| `$[]` | Every element in the array, unconditionally | No |
| `$[identifier]` | Only elements matching a condition given separately | Yes |

**Common mistake:** using plain `$` when you actually meant "every element that matches a grade condition." `$` only ever touches the *one* element that the top-level query filter happened to match — if two score entries both have `grade >= 70`, `$` still only updates the first one it finds. That's exactly the gap `$[identifier]` with `arrayFilters` was introduced (in MongoDB 3.6) to close.

**Interview answer:** "The positional `$` operator lets you update a specific array element without knowing its index — it's replaced at runtime with the index of the first element that matched the query's filter condition. It only ever touches one element. To update every element unconditionally, use `$[]`. To update every element that matches a condition of its own — independent of the top-level query filter — use `$[identifier]` combined with the `arrayFilters` option."

> **Memory hook:** "$ fixes one line on the invoice, $[] rewrites every line, $[identifier] fixes only the lines that fail a spot-check."

---

## 7. Comparison Table — Array Update Operators

```
┌──────────────┬──────────────────────────────┬─────────────────────────────────────┐
│  Operator    │  What It Does                │  Notes                              │
├──────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ $push        │ Appends element(s) to array  │ Allows duplicates                   │
│ $addToSet    │ Adds if not already present  │ No duplicates; deep equality check  │
│ $pull        │ Removes by value/condition   │ Removes ALL matching elements       │
│ $pop         │ Removes first or last item   │ 1=last, -1=first                    │
│ $each        │ Push/addToSet multiple items │ Modifier for $push and $addToSet    │
│ $slice       │ Trim array to N elements     │ Modifier for $push; pos/neg N       │
│ $sort        │ Sort array after push        │ Modifier for $push                  │
│ $            │ Positional — first match     │ Used in update path                 │
│ $[]          │ All elements                 │ MongoDB 3.6+                        │
│ $[id]        │ Filtered elements            │ MongoDB 3.6+; needs arrayFilters    │
└──────────────┴──────────────────────────────┴─────────────────────────────────────┘
```

---

## 8. Hands-On Exercises

Use the `students` and `carts` collections from Section 1.

**Exercise 1 — $all and $size:**
Find all students who are enrolled in both "MongoDB" and "JavaScript" courses AND have exactly 3 courses total.

```js
// Your query here:
db.students.find({
  courses: { $all: ["MongoDB", "JavaScript"] },
  courses: { $size: 3 }
})
// Correction — key collision! Use $and:
db.students.find({
  $and: [
    { courses: { $all: ["MongoDB", "JavaScript"] } },
    { courses: { $size: 3 } }
  ]
})
// Returns: Bob (MongoDB, JavaScript, Node.js — 3 courses)
```

**Exercise 2 — $elemMatch precision:**
Find students who have a score where the grade is between 60 and 75 (inclusive) AND passed is true, as a SINGLE array element.

```js
// Your query here:
db.students.find({
  scores: {
    $elemMatch: {
      grade: { $gte: 60, $lte: 75 },
      passed: true
    }
  }
})
// Returns: Bob (65, true), David (72, true and 60, true)
```

**Exercise 3 — Array Update with $push and $each:**
David completed two new courses: "TypeScript" and "React". Add both to his courses array and add the "improved" badge. Do this in one updateOne call.

```js
// Your update here:
db.students.updateOne(
  { _id: 4 },
  {
    $push: { courses: { $each: ["TypeScript", "React"] } },
    $addToSet: { badges: "improved" }
  }
)
```

**Exercise 4 — Capped recent searches:**
For user_A (cart _id: 101), add "standing-desk" to recentSearches. Then slice the array to keep only the most recent 3 searches. Do this in a single update.

```js
// Your update here:
db.carts.updateOne(
  { _id: 101 },
  {
    $push: {
      recentSearches: {
        $each: ["standing-desk"],
        $slice: -3
      }
    }
  }
)
```

**Exercise 5 — Complex array removal:**
From ALL students, remove any score document where both the grade is below 70 AND passed is false. Then remove "deprecated" from all course arrays (no student has it, so it's a safe no-op — but write the query correctly).

```js
// Remove failing-and-below-70 scores from all students
db.students.updateMany(
  {},
  { $pull: { scores: { grade: { $lt: 70 }, passed: false } } }
)

// Remove "deprecated" course from all students
db.students.updateMany(
  {},
  { $pull: { courses: "deprecated" } }
)
```

---

## 9. Interview Q&A

**Q1: What is the difference between `$all` and `$in` for array fields?**

A: `$in` matches a document if the array contains AT LEAST ONE of the specified values. `$all` matches a document only if the array contains ALL of the specified values. Example: `{ courses: { $in: ["MongoDB", "SQL"] } }` matches students who know either MongoDB or SQL (or both). `{ courses: { $all: ["MongoDB", "SQL"] } }` matches only students who know both.

---

**Q2: Explain the critical difference between querying with and without `$elemMatch`.**

A: Without `$elemMatch`, MongoDB evaluates conditions across ALL array elements independently — condition A can match element 1 while condition B matches element 2. With `$elemMatch`, MongoDB requires that a SINGLE array element satisfies ALL the conditions simultaneously. This distinction matters whenever you have multiple conditions and need them to apply to the same array element.

---

**Q3: Can `$size` be used with a range operator like `$gt`?**

A: No. `$size` only supports exact equality. To query for arrays with more or fewer than N elements, use `$expr` with the `$size` aggregation expression: `{ $expr: { $gt: [{ $size: "$arrayField" }, N] } }`. This is less index-friendly but works correctly.

---

**Q4: What is the difference between `$push` and `$addToSet`?**

A: `$push` always appends the element, allowing duplicates. `$addToSet` checks if the element already exists (using deep equality) and only adds it if absent. Use `$addToSet` when modelling sets (tags, roles, unique items); use `$push` when order matters or duplicates are allowed (log entries, events).

---

**Q5: How does `$pull` decide what to remove from an array?**

A: `$pull` evaluates each array element against the condition. For scalar arrays, it removes elements equal to the given value. For arrays of embedded documents, it removes elements where the sub-document matches the condition (using the same query semantics as `find()`). It removes ALL matching elements, not just the first.

---

**Q6: What does `$pop: 1` vs `$pop: -1` do?**

A: `$pop: 1` removes the LAST element of the array. `$pop: -1` removes the FIRST element. Think of it as the stack perspective: 1 = pop from the end, -1 = pop from the beginning.

---

**Q7: When would you use `$slice` with a negative number vs a positive number?**

A: Use a negative slice (e.g., `$slice: -5`) to keep the most recently added elements — the last N elements. Use a positive slice (e.g., `$slice: 5`) to keep the first N elements. In "recent items" patterns (search history, activity log), negative slice is almost always what you want.

---

**Q8: How does MongoDB handle a query like `{ tags: "gaming" }` on an array field?**

A: MongoDB treats this as "does the `tags` array contain the element `"gaming"`?" — it checks array membership automatically. This is equivalent to `{ tags: { $in: ["gaming"] } }`. This works because MongoDB creates a multikey index on array fields, storing one index entry per array element.

---

**Q9: What is a multikey index and how does it relate to array operators?**

A: A multikey index is created automatically by MongoDB when you index a field that contains an array. MongoDB creates one index entry per array element, allowing efficient queries like `{ tags: "gaming" }` or `{ tags: { $in: ["gaming"] } }`. The tradeoff is that multikey indexes are larger and compound indexes with two or more array fields are restricted.

---

**Q10: How do you update a specific element inside an array without replacing the whole array?**

A: Use the positional `$` operator in the update path combined with a query that matches the element. For example: `db.students.updateOne({ _id: 1, "scores.subject": "SQL" }, { $set: { "scores.$.grade": 85 } })`. The `$` in the update path refers to the first matched array element. For updating multiple matching elements, use `$[identifier]` with `arrayFilters` (MongoDB 3.6+).
