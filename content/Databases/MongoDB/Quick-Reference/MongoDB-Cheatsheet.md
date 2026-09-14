# MongoDB Cheatsheet — Dense Reference

```
┌──────────────────────────────────────────────────────────────────────┐
│                     MONGODB COMPLETE CHEATSHEET                      │
│           Operators · Syntax · Pipelines · Admin Commands            │
└──────────────────────────────────────────────────────────────────────┘
```

## Table of Contents

1. [mongosh Navigation Commands](#1-mongosh-navigation-commands)
2. [CRUD Quick Reference](#2-crud-quick-reference)
3. [Query Operators](#3-query-operators)
4. [Update Operators](#4-update-operators)
5. [Aggregation Pipeline Stages](#5-aggregation-pipeline-stages)
6. [Common Aggregation Expressions](#6-common-aggregation-expressions)
7. [Index Commands](#7-index-commands)
8. [Replica Set Commands](#8-replica-set-commands)
9. [Admin Commands](#9-admin-commands)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. mongosh Navigation Commands

```bash
# Connect to local instance
mongosh

# Connect to remote host with auth
mongosh "mongodb://user:pass@host:27017/dbname"

# Connect with connection string
mongosh "mongodb+srv://cluster.mongodb.net/mydb" --username admin
```

| Command | Description |
|---|---|
| `show dbs` | List all databases on the server |
| `use <dbName>` | Switch to (or create) a database |
| `show collections` | List collections in current db |
| `show tables` | Alias for show collections |
| `db` | Print current database name |
| `db.getName()` | Return current database name as string |
| `db.dropDatabase()` | Drop the current database entirely |
| `db.createCollection("name")` | Explicitly create a collection |
| `db.createCollection("name", { capped: true, size: 1048576, max: 1000 })` | Create capped collection |
| `db.<col>.drop()` | Drop a collection |
| `db.<col>.renameCollection("newName")` | Rename a collection |
| `db.<col>.count()` | Count documents (deprecated: use countDocuments) |
| `db.<col>.countDocuments({})` | Count all documents |
| `db.<col>.countDocuments({ age: { $gt: 18 } })` | Count with filter |
| `db.<col>.estimatedDocumentCount()` | Fast approximate count (uses metadata) |
| `db.<col>.distinct("field")` | List distinct values for a field |
| `db.<col>.distinct("city", { age: { $gte: 18 } })` | Distinct with filter |
| `exit` | Exit mongosh |
| `quit()` | Exit mongosh |
| `cls` | Clear screen |
| `help` | Show help menu |
| `db.help()` | Show db-level methods |
| `db.<col>.help()` | Show collection-level methods |

---

## 2. CRUD Quick Reference

### INSERT

```js
// insertOne — insert a single document, returns { acknowledged, insertedId }
db.users.insertOne({
  name: "Alice",
  age: 30,
  city: "Sydney",
  tags: ["admin", "user"]
})

// insertMany — insert array of documents, returns { acknowledged, insertedIds }
db.users.insertMany([
  { name: "Bob",   age: 25, city: "Melbourne" },
  { name: "Carol", age: 28, city: "Brisbane"  },
  { name: "Dave",  age: 35, city: "Sydney"    }
])

// insertMany with ordered: false — continue on error, don't stop at first failure
db.users.insertMany(
  [ { _id: 1, name: "A" }, { _id: 1, name: "B" }, { _id: 2, name: "C" } ],
  { ordered: false }
)
```

### FIND

```js
// findOne — return first match or null
db.users.findOne({ name: "Alice" })

// find — return cursor of all matches
db.users.find({ city: "Sydney" })

// find with projection — include fields (1) or exclude fields (0)
db.users.find({ city: "Sydney" }, { name: 1, age: 1, _id: 0 })

// find with sort, skip, limit — chained on cursor
db.users.find({}).sort({ age: -1 }).skip(10).limit(5)

// find with dot notation — query nested field
db.orders.find({ "address.city": "Sydney" })

// find all documents
db.users.find({})

// pretty print (mongosh auto-prettifies, legacy shell needed .pretty())
db.users.find({}).pretty()

// Return only first document
db.users.findOne({})
```

### UPDATE

```js
// updateOne — update first matching document
db.users.updateOne(
  { name: "Alice" },                   // filter
  { $set: { age: 31, city: "Perth" } } // update
)

// updateMany — update all matching documents
db.users.updateMany(
  { city: "Sydney" },
  { $inc: { loginCount: 1 } }
)

// upsert — insert if not found, update if found
db.users.updateOne(
  { email: "new@example.com" },
  { $set: { name: "New User", age: 22 } },
  { upsert: true }
)

// replaceOne — replace entire document (except _id)
db.users.replaceOne(
  { name: "Bob" },
  { name: "Bob", age: 26, city: "Adelaide", updatedAt: new Date() }
)

// findOneAndUpdate — update and return document
db.users.findOneAndUpdate(
  { name: "Alice" },
  { $set: { age: 32 } },
  { returnDocument: "after" }  // "before" returns pre-update doc
)
```

### DELETE

```js
// deleteOne — delete first matching document
db.users.deleteOne({ name: "Dave" })

// deleteMany — delete all matching documents
db.users.deleteMany({ city: "Brisbane" })

// deleteMany all — danger: removes every document, keeps collection
db.users.deleteMany({})

// findOneAndDelete — delete and return the document
db.users.findOneAndDelete({ name: "Carol" })
```

---

## 3. Query Operators

### Comparison Operators

| Operator | Meaning | Example |
|---|---|---|
| `$eq` | Equal to | `{ age: { $eq: 25 } }` |
| `$ne` | Not equal to | `{ status: { $ne: "inactive" } }` |
| `$gt` | Greater than | `{ age: { $gt: 18 } }` |
| `$gte` | Greater than or equal | `{ age: { $gte: 18 } }` |
| `$lt` | Less than | `{ price: { $lt: 100 } }` |
| `$lte` | Less than or equal | `{ score: { $lte: 50 } }` |
| `$in` | Matches any value in array | `{ city: { $in: ["Sydney", "Perth"] } }` |
| `$nin` | Matches none of values in array | `{ status: { $nin: ["banned", "inactive"] } }` |

### Logical Operators

| Operator | Meaning | Example |
|---|---|---|
| `$and` | All conditions must be true | `{ $and: [{ age: { $gt: 18 } }, { city: "Sydney" }] }` |
| `$or` | At least one condition true | `{ $or: [{ city: "Sydney" }, { city: "Perth" }] }` |
| `$not` | Inverts condition | `{ age: { $not: { $gt: 18 } } }` |
| `$nor` | None of conditions true | `{ $nor: [{ age: { $lt: 0 } }, { age: { $gt: 150 } }] }` |

```js
// Implicit AND — multiple fields in same document = AND
db.users.find({ city: "Sydney", age: { $gte: 18 } })

// Explicit $and needed when same field appears twice
db.users.find({ $and: [{ age: { $gt: 18 } }, { age: { $lt: 65 } }] })
```

### Element Operators

| Operator | Meaning | Example |
|---|---|---|
| `$exists` | Field exists (true) or not (false) | `{ phone: { $exists: true } }` |
| `$type` | Field is of BSON type | `{ age: { $type: "int" } }` or `{ age: { $type: 16 } }` |

```js
// Common $type values
// "double"=1  "string"=2  "object"=3  "array"=4  "bool"=8
// "date"=9    "null"=10   "int"=16    "long"=18  "decimal"=19
db.users.find({ score: { $type: ["int", "double"] } })
```

### Evaluation Operators

| Operator | Meaning | Example |
|---|---|---|
| `$regex` | Match field against regex | `{ name: { $regex: /^Al/, $options: "i" } }` |
| `$text` | Full-text search (requires text index) | `{ $text: { $search: "coffee shop" } }` |
| `$expr` | Use aggregation expressions in query | `{ $expr: { $gt: ["$spent", "$budget"] } }` |
| `$mod` | Field value modulo equals remainder | `{ qty: { $mod: [4, 0] } }` |
| `$where` | JavaScript expression (avoid in prod) | `{ $where: "this.age > 18" }` |
| `$jsonSchema` | Validate against JSON Schema | `{ $jsonSchema: { required: ["name"] } }` |

```js
// $text search with sort by relevance score
db.articles.find(
  { $text: { $search: "mongodb performance" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })

// $expr — compare two fields in same document
db.orders.find({ $expr: { $gt: ["$revenue", "$cost"] } })
```

### Array Operators

| Operator | Meaning | Example |
|---|---|---|
| `$all` | Array contains all specified values | `{ tags: { $all: ["admin", "user"] } }` |
| `$elemMatch` | At least one array element matches all conditions | `{ scores: { $elemMatch: { $gt: 80, $lt: 100 } } }` |
| `$size` | Array has exactly N elements | `{ tags: { $size: 3 } }` |

```js
// $elemMatch vs dot notation difference
// Dot notation: each condition can match DIFFERENT elements
db.results.find({ "scores.value": { $gt: 80 }, "scores.grade": "A" })

// $elemMatch: ALL conditions must match SAME element
db.results.find({ scores: { $elemMatch: { value: { $gt: 80 }, grade: "A" } } })
```

### Projection Operators (in find second argument)

| Operator | Meaning | Example |
|---|---|---|
| `$` | Return first array element matching query | `{ "scores.$": 1 }` |
| `$elemMatch` | Return first element matching condition | `{ scores: { $elemMatch: { grade: "A" } } }` |
| `$slice` | Return subset of array elements | `{ comments: { $slice: 5 } }` or `{ $slice: [-5] }` |
| `$meta` | Return metadata (text score, index key) | `{ score: { $meta: "textScore" } }` |

---

## 4. Update Operators

### Field Update Operators

| Operator | Meaning | Example |
|---|---|---|
| `$set` | Set field to value (create if absent) | `{ $set: { age: 30, city: "Perth" } }` |
| `$unset` | Remove field from document | `{ $unset: { tempField: "" } }` |
| `$inc` | Increment numeric field by value | `{ $inc: { loginCount: 1, score: -5 } }` |
| `$mul` | Multiply field by value | `{ $mul: { price: 1.1 } }` |
| `$rename` | Rename a field | `{ $rename: { "oldName": "newName" } }` |
| `$min` | Set field to value only if value is less than current | `{ $min: { lowestScore: 40 } }` |
| `$max` | Set field to value only if value is greater than current | `{ $max: { highScore: 95 } }` |
| `$currentDate` | Set field to current date | `{ $currentDate: { updatedAt: true } }` |
| `$setOnInsert` | Set field only if upsert causes insert | `{ $setOnInsert: { createdAt: new Date() } }` |

```js
// $currentDate with type specification
db.users.updateOne(
  { name: "Alice" },
  { $currentDate: { lastLogin: { $type: "timestamp" } } }
)

// Combine multiple operators in one update
db.users.updateOne(
  { name: "Alice" },
  {
    $set:         { city: "Brisbane" },
    $inc:         { loginCount: 1 },
    $currentDate: { lastLogin: true },
    $unset:       { tempToken: "" }
  }
)
```

### Array Update Operators

| Operator | Meaning | Example |
|---|---|---|
| `$push` | Append element to array | `{ $push: { tags: "vip" } }` |
| `$pull` | Remove elements matching condition | `{ $pull: { tags: "spam" } }` |
| `$addToSet` | Add element only if not already present | `{ $addToSet: { tags: "premium" } }` |
| `$pop` | Remove first (-1) or last (1) element | `{ $pop: { queue: -1 } }` |
| `$pullAll` | Remove all instances of listed values | `{ $pullAll: { scores: [0, -1] } }` |

### Array Update Modifiers (used with $push)

| Modifier | Meaning | Example |
|---|---|---|
| `$each` | Push multiple elements at once | `{ $push: { tags: { $each: ["a","b","c"] } } }` |
| `$slice` | Keep only N elements after push | `{ $push: { log: { $each: ["new"], $slice: -10 } } }` |
| `$sort` | Sort array after modification | `{ $push: { scores: { $each: [85], $sort: -1 } } }` |
| `$position` | Insert at specific index | `{ $push: { items: { $each: ["x"], $position: 0 } } }` |

```js
// Full $push with modifiers — add score, keep sorted, keep last 5
db.players.updateOne(
  { _id: playerId },
  {
    $push: {
      recentScores: {
        $each:     [92],
        $sort:     -1,
        $slice:    5
      }
    }
  }
)

// $pull with condition — remove array elements matching condition
db.users.updateMany(
  {},
  { $pull: { scores: { $lt: 10 } } }
)

// Positional operator $ — update matched array element
db.students.updateOne(
  { "grades.subject": "Math" },
  { $set: { "grades.$.score": 95 } }
)

// $[] — update all array elements
db.students.updateMany(
  {},
  { $inc: { "scores.$[]": 5 } }
)

// $[identifier] — filtered positional update
db.students.updateMany(
  {},
  { $set: { "scores.$[elem].passed": true } },
  { arrayFilters: [{ "elem.score": { $gte: 50 } }] }
)
```

---

## 5. Aggregation Pipeline Stages

```
Input Collection
     │
     ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ $match  │────▶│ $group  │────▶│ $sort   │────▶│ $project│
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                      │
                                                      ▼
                                               Output Documents
```

| Stage | Description |
|---|---|
| `$match` | Filter documents (like find query); place early for index use |
| `$group` | Group documents by expression; compute accumulators per group |
| `$project` | Reshape documents: include/exclude/rename/compute fields |
| `$sort` | Sort documents by field(s); -1 = descending, 1 = ascending |
| `$limit` | Pass only first N documents |
| `$skip` | Skip first N documents |
| `$unwind` | Deconstruct array field; output one doc per array element |
| `$lookup` | Left outer join to another collection |
| `$addFields` | Add new fields without hiding existing ones |
| `$replaceRoot` | Promote embedded doc to top-level document |
| `$replaceWith` | Alias for $replaceRoot (v4.2+) |
| `$count` | Count documents passing through; output `{ fieldName: N }` |
| `$facet` | Run multiple pipelines on same input set in parallel |
| `$bucket` | Categorize docs into manually defined ranges |
| `$bucketAuto` | Automatically distribute docs into N buckets |
| `$sortByCount` | Group by expression, count, sort by count descending |
| `$sample` | Return N random documents |
| `$out` | Write pipeline results to a collection (replaces collection) |
| `$merge` | Merge pipeline results into collection (v4.2+); more options than $out |
| `$unionWith` | Combine pipeline results with another collection (v4.4+) |
| `$graphLookup` | Recursive lookup for tree/graph traversal |
| `$redact` | Restrict document content based on stored access info |
| `$geoNear` | Return docs sorted by proximity to a point; must be first stage |
| `$indexStats` | Return index usage statistics |
| `$collStats` | Return collection statistics |
| `$currentOp` | Return current operations on the instance |
| `$listSessions` | List sessions from the system.sessions collection |
| `$densify` | Fill gaps in numeric or date sequences (v5.1+) |
| `$fill` | Fill null/missing values using forward/backward fill (v5.3+) |
| `$documents` | Generate documents from an array literal (v6.0+) |
| `$setWindowFields` | Compute window function over partitions (v5.0+) |
| `$changeStream` | Watch for changes (used in change stream pipelines) |

```js
// Full aggregation example — sales by city, top 3
db.orders.aggregate([
  { $match:   { status: "complete", year: 2025 } },
  { $group:   { _id: "$city", totalRevenue: { $sum: "$amount" }, orderCount: { $sum: 1 } } },
  { $sort:    { totalRevenue: -1 } },
  { $limit:   3 },
  { $project: { _id: 0, city: "$_id", totalRevenue: 1, orderCount: 1 } }
])

// $lookup example — join orders with users
db.orders.aggregate([
  {
    $lookup: {
      from:         "users",
      localField:   "userId",
      foreignField: "_id",
      as:           "userInfo"
    }
  },
  { $unwind: "$userInfo" },
  { $project: { orderId: 1, amount: 1, "userInfo.name": 1, "userInfo.email": 1 } }
])

// $facet example — run two sub-pipelines simultaneously
db.products.aggregate([
  {
    $facet: {
      byCategory: [
        { $group: { _id: "$category", count: { $sum: 1 } } }
      ],
      priceStats: [
        { $group: { _id: null, avgPrice: { $avg: "$price" }, maxPrice: { $max: "$price" } } }
      ]
    }
  }
])

// $unwind with preserveNullAndEmptyArrays
db.users.aggregate([
  { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } }
])

// $bucket — group products by price range
db.products.aggregate([
  {
    $bucket: {
      groupBy:    "$price",
      boundaries: [0, 25, 50, 100, 250],
      default:    "Other",
      output: {
        count: { $sum: 1 },
        products: { $push: "$name" }
      }
    }
  }
])
```

---

## 6. Common Aggregation Expressions

### Accumulator Expressions (used in $group)

| Expression | Description | Example |
|---|---|---|
| `$sum` | Sum of values; `$sum: 1` counts documents | `{ total: { $sum: "$amount" } }` |
| `$avg` | Average of values | `{ avgAge: { $avg: "$age" } }` |
| `$min` | Minimum value | `{ minScore: { $min: "$score" } }` |
| `$max` | Maximum value | `{ maxScore: { $max: "$score" } }` |
| `$first` | First value in group (depends on sort) | `{ firstName: { $first: "$name" } }` |
| `$last` | Last value in group | `{ lastLogin: { $last: "$loginAt" } }` |
| `$push` | Accumulate values into array | `{ allNames: { $push: "$name" } }` |
| `$addToSet` | Accumulate unique values into array | `{ uniqueCities: { $addToSet: "$city" } }` |
| `$count` | Count documents in group (v5.0+) | `{ total: { $count: {} } }` |
| `$stdDevPop` | Population standard deviation | `{ dev: { $stdDevPop: "$score" } }` |
| `$stdDevSamp` | Sample standard deviation | `{ dev: { $stdDevSamp: "$score" } }` |

### String Expressions

| Expression | Description | Example |
|---|---|---|
| `$concat` | Concatenate strings | `{ $concat: ["$first", " ", "$last"] }` |
| `$toUpper` | Convert to uppercase | `{ $toUpper: "$name" }` |
| `$toLower` | Convert to lowercase | `{ $toLower: "$email" }` |
| `$substr` | Extract substring | `{ $substr: ["$code", 0, 3] }` |
| `$strLenCP` | String length in code points | `{ $strLenCP: "$name" }` |
| `$trim` | Remove whitespace | `{ $trim: { input: "$name" } }` |
| `$ltrim` | Remove leading whitespace | `{ $ltrim: { input: "$name" } }` |
| `$rtrim` | Remove trailing whitespace | `{ $rtrim: { input: "$name" } }` |
| `$split` | Split string into array | `{ $split: ["$csv", ","] }` |
| `$regexMatch` | Returns bool if string matches regex | `{ $regexMatch: { input: "$email", regex: /@/ } }` |
| `$regexFind` | Returns first match details | `{ $regexFind: { input: "$text", regex: /\d+/ } }` |

### Date Expressions

| Expression | Description | Example |
|---|---|---|
| `$year` | Extract year | `{ $year: "$createdAt" }` |
| `$month` | Extract month (1-12) | `{ $month: "$createdAt" }` |
| `$dayOfMonth` | Day of month (1-31) | `{ $dayOfMonth: "$date" }` |
| `$dayOfWeek` | Day of week (1=Sun, 7=Sat) | `{ $dayOfWeek: "$date" }` |
| `$hour` | Extract hour | `{ $hour: "$timestamp" }` |
| `$minute` | Extract minute | `{ $minute: "$timestamp" }` |
| `$dateToString` | Format date as string | `{ $dateToString: { format: "%Y-%m-%d", date: "$date" } }` |
| `$dateFromString` | Parse string to date | `{ $dateFromString: { dateString: "$dateStr" } }` |
| `$dateDiff` | Difference between two dates (v5.0+) | `{ $dateDiff: { startDate: "$start", endDate: "$$NOW", unit: "day" } }` |
| `$dateAdd` | Add duration to date (v5.0+) | `{ $dateAdd: { startDate: "$date", unit: "month", amount: 1 } }` |

### Conditional Expressions

| Expression | Description | Example |
|---|---|---|
| `$cond` | If-then-else | `{ $cond: { if: { $gte: ["$age", 18] }, then: "adult", else: "minor" } }` |
| `$cond` (short) | Short-form array | `{ $cond: [{ $gte: ["$age", 18] }, "adult", "minor"] }` |
| `$ifNull` | Return alt if field is null/missing | `{ $ifNull: ["$phone", "N/A"] }` |
| `$switch` | Multi-branch conditional | See below |

```js
// $switch example
{
  $switch: {
    branches: [
      { case: { $lt: ["$score", 50] },  then: "Fail"   },
      { case: { $lt: ["$score", 75] },  then: "Pass"   },
      { case: { $lt: ["$score", 90] },  then: "Merit"  }
    ],
    default: "Distinction"
  }
}
```

### Arithmetic Expressions

| Expression | Description | Example |
|---|---|---|
| `$add` | Add numbers or add ms to date | `{ $add: ["$price", "$tax"] }` |
| `$subtract` | Subtract | `{ $subtract: ["$revenue", "$cost"] }` |
| `$multiply` | Multiply | `{ $multiply: ["$qty", "$price"] }` |
| `$divide` | Divide | `{ $divide: ["$total", "$count"] }` |
| `$mod` | Modulo | `{ $mod: ["$value", 10] }` |
| `$abs` | Absolute value | `{ $abs: "$delta" }` |
| `$ceil` | Round up | `{ $ceil: "$rating" }` |
| `$floor` | Round down | `{ $floor: "$rating" }` |
| `$round` | Round to N decimal places | `{ $round: ["$price", 2] }` |
| `$sqrt` | Square root | `{ $sqrt: "$area" }` |
| `$pow` | Raise to power | `{ $pow: ["$base", "$exp"] }` |

### Type Conversion Expressions

| Expression | Description |
|---|---|
| `$toString` | Convert to string |
| `$toInt` | Convert to 32-bit integer |
| `$toLong` | Convert to 64-bit integer |
| `$toDouble` | Convert to double |
| `$toDecimal` | Convert to decimal128 |
| `$toBool` | Convert to boolean |
| `$toDate` | Convert to Date |
| `$toObjectId` | Convert to ObjectId |
| `$convert` | Generic conversion with onError/onNull options |

---

## 7. Index Commands

### Creating Indexes

```js
// Single field index (ascending)
db.users.createIndex({ age: 1 })

// Single field index (descending)
db.users.createIndex({ createdAt: -1 })

// Compound index — field order matters! Use ESR rule
// Equality fields first, Sort fields second, Range fields last
db.orders.createIndex({ status: 1, orderDate: -1, amount: 1 })

// Unique index
db.users.createIndex({ email: 1 }, { unique: true })

// Sparse index — only index documents where field exists
db.users.createIndex({ phone: 1 }, { sparse: true })

// TTL index — auto-delete documents after N seconds
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })

// Text index — full text search
db.articles.createIndex({ title: "text", body: "text" })

// Text index with weights
db.articles.createIndex(
  { title: "text", body: "text" },
  { weights: { title: 10, body: 1 }, name: "ArticleTextIndex" }
)

// Wildcard index — index all fields in a document
db.products.createIndex({ "$**": 1 })

// Wildcard index on specific path
db.products.createIndex({ "attributes.$**": 1 })

// 2dsphere index — geospatial (GeoJSON)
db.places.createIndex({ location: "2dsphere" })

// 2d index — legacy coordinate pairs
db.places.createIndex({ coords: "2d" })

// Hashed index — for hash-based sharding
db.users.createIndex({ userId: "hashed" })

// Partial index — index only subset of documents
db.orders.createIndex(
  { amount: 1 },
  { partialFilterExpression: { status: { $eq: "active" } } }
)

// Collation index — case-insensitive text comparison
db.users.createIndex(
  { name: 1 },
  { collation: { locale: "en", strength: 2 } }
)

// Hidden index — index exists but optimizer ignores it (for testing)
db.users.createIndex({ age: 1 }, { hidden: true })

// Create index in background (pre-4.2; now always non-blocking)
db.users.createIndex({ age: 1 }, { background: true })
```

### Viewing and Managing Indexes

```js
// List all indexes on a collection
db.users.getIndexes()

// Get index sizes
db.users.stats().indexSizes

// Drop a specific index by name
db.users.dropIndex("age_1")

// Drop a specific index by spec
db.users.dropIndex({ age: 1 })

// Drop all non-_id indexes
db.users.dropIndexes()

// Rebuild all indexes
db.users.reIndex()

// Hide/unhide index (v4.4+)
db.runCommand({ collMod: "users", index: { name: "age_1", hidden: true } })
db.runCommand({ collMod: "users", index: { name: "age_1", hidden: false } })
```

### Using explain()

```js
// Three verbosity modes
db.users.find({ age: { $gt: 25 } }).explain()
db.users.find({ age: { $gt: 25 } }).explain("queryPlanner")     // default
db.users.find({ age: { $gt: 25 } }).explain("executionStats")   // run query, get stats
db.users.find({ age: { $gt: 25 } }).explain("allPlansExecution") // run all plans

// Explain on aggregation
db.orders.explain("executionStats").aggregate([
  { $match: { status: "complete" } },
  { $group: { _id: "$city", total: { $sum: "$amount" } } }
])

// Key fields to check in executionStats
// winningPlan.stage         — IXSCAN (good) vs COLLSCAN (investigate)
// executionStats.nReturned  — documents returned
// executionStats.totalDocsExamined  — should be close to nReturned
// executionStats.totalKeysExamined  — index entries scanned
```

### Index Types Reference

```
┌───────────────────┬────────────────────────────────────────────┐
│ Index Type        │ When To Use                                │
├───────────────────┼────────────────────────────────────────────┤
│ Single Field      │ Queries filtering/sorting on one field     │
│ Compound          │ Queries on multiple fields (ESR rule)      │
│ Multikey          │ Queries on array field values              │
│ Text              │ Full-text search on string fields          │
│ 2dsphere          │ GeoJSON geometry queries                   │
│ 2d                │ Legacy coordinate pair queries             │
│ Hashed            │ Equality queries; shard key hashing        │
│ Wildcard          │ Dynamic/unpredictable field structures     │
│ TTL               │ Auto-expire documents by date field        │
│ Partial           │ Index only a filtered subset of docs       │
│ Sparse            │ Index only docs where field exists         │
│ Unique            │ Enforce uniqueness constraint              │
│ Clustered         │ Time-series / table-scan optimization      │
└───────────────────┴────────────────────────────────────────────┘
```

---

## 8. Replica Set Commands

```js
// Initiate a replica set with config
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017" },
    { _id: 1, host: "mongo2:27017" },
    { _id: 2, host: "mongo3:27017" }
  ]
})

// Check replica set status — most important command
rs.status()
// Key fields:
// set            — replica set name
// members[]      — array of member info
//   .name        — host:port
//   .health      — 1 = healthy, 0 = unreachable
//   .state       — 1=PRIMARY, 2=SECONDARY, 6=UNKNOWN, 10=REMOVED
//   .stateStr    — "PRIMARY" / "SECONDARY" / etc
//   .optime      — last oplog entry applied
//   .optimeDate  — datetime of last oplog
//   .lastHeartbeatMessage — error message if unhealthy

// Get replica set configuration
rs.conf()

// Add a new member to the set
rs.add("mongo4:27017")

// Add an arbiter
rs.addArb("mongoarb:27017")

// Remove a member
rs.remove("mongo4:27017")

// Force primary to step down (triggers election)
rs.stepDown()

// Step down with explicit secondaryCatchUpPeriodSecs
rs.stepDown(120)  // wait up to 120s for secondary to catch up

// Freeze a secondary — prevent it from becoming primary
rs.freeze(60)  // freeze for 60 seconds

// Check if connected to primary
db.isMaster()           // legacy
db.hello()              // v5.0+ preferred

// Set read preference on connection
db.getMongo().setReadPref("secondaryPreferred")

// Read from secondary explicitly in mongosh
db.getMongo().setReadPref("secondary")

// Oplog status
rs.printReplicationInfo()      // primary: oplog size, time range
rs.printSecondaryReplicationInfo()  // lag of each secondary

// Force resync a member (from mongosh on the member itself)
db.adminCommand({ resync: 1 })

// Reconfigure the set
let config = rs.conf()
config.members[2].priority = 0
config.members[2].hidden = true
rs.reconfig(config)

// Force reconfigure (if majority unavailable)
rs.reconfig(config, { force: true })
```

### Replica Set Member States

```
┌──────┬─────────────────┬──────────────────────────────────────┐
│ Code │ State           │ Meaning                              │
├──────┼─────────────────┼──────────────────────────────────────┤
│  0   │ STARTUP         │ Not yet a member of any set          │
│  1   │ PRIMARY         │ Accepts writes                       │
│  2   │ SECONDARY       │ Replicating data, can serve reads    │
│  3   │ RECOVERING      │ Performing initial sync or rollback  │
│  5   │ STARTUP2        │ Joined set, loading data             │
│  6   │ UNKNOWN         │ Not reached by this member           │
│  7   │ ARBITER         │ Votes only, holds no data            │
│  8   │ DOWN            │ Unreachable                          │
│  9   │ ROLLBACK        │ Rolling back writes                  │
│ 10   │ REMOVED         │ Removed from the set                 │
└──────┴─────────────────┴──────────────────────────────────────┘
```

---

## 9. Admin Commands

### Database Statistics

```js
// Database-level stats
db.stats()
// Key fields: db, collections, views, objects, avgObjSize, dataSize,
//             storageSize, indexes, indexSize, totalSize, ok

// Collection-level stats
db.users.stats()
db.users.stats({ scale: 1024 })  // output in KB

// Server status — comprehensive server info
db.serverStatus()
db.serverStatus().connections   // connection stats
db.serverStatus().opcounters    // insert/query/update/delete counts
db.serverStatus().wiredTiger    // WiredTiger engine stats
db.serverStatus().repl          // replication info
db.serverStatus().mem           // memory usage

// Validate a collection — check for inconsistencies
db.users.validate()
db.users.validate({ full: true })  // full check (slow, locks)
```

### Operations Management

```js
// List currently running operations
db.currentOp()
db.currentOp({ active: true })
db.currentOp({ "command.find": { $exists: true } })  // only find ops
db.currentOp({ secs_running: { $gt: 5 } })           // long-running ops

// Using aggregation (v4.2+)
db.adminCommand({ currentOp: 1, active: true })

// Kill an operation by opId
db.killOp(12345)

// Kill all operations matching a filter
db.currentOp({ secs_running: { $gt: 30 } }).inprog.forEach(op => db.killOp(op.opid))

// Profiler — capture slow queries
db.getProfilingStatus()              // get current level and threshold
db.setProfilingLevel(0)              // off
db.setProfilingLevel(1, { slowms: 100 })  // log slow ops > 100ms
db.setProfilingLevel(2)              // log ALL operations
db.system.profile.find().sort({ ts: -1 }).limit(5)  // read profile data

// Log verbosity
db.setLogLevel(1)           // set default verbosity
db.setLogLevel(2, "query")  // set component verbosity
```

### User & Role Management

```js
// Create user
db.createUser({
  user:  "appUser",
  pwd:   "securePassword",
  roles: [{ role: "readWrite", db: "myApp" }]
})

// Create user with multiple roles
db.createUser({
  user:  "dbAdmin",
  pwd:   "adminPass",
  roles: [
    { role: "dbAdmin",    db: "myApp" },
    { role: "readWrite",  db: "myApp" }
  ]
})

// List users
db.getUsers()

// Drop user
db.dropUser("appUser")

// Update user password
db.updateUser("appUser", { pwd: "newPassword" })

// Grant additional roles
db.grantRolesToUser("appUser", [{ role: "read", db: "reporting" }])

// Revoke roles
db.revokeRolesFromUser("appUser", [{ role: "read", db: "reporting" }])

// Built-in roles reference
// read            — read any collection in db
// readWrite       — read and write any collection
// dbAdmin         — administrative tasks (index, stats)
// dbOwner         — all privileges on db
// userAdmin       — create/modify users in db
// clusterAdmin    — manage the whole cluster
// root            — superuser
// readAnyDatabase — read across all databases
```

### Backup & Maintenance

```bash
# mongodump — logical backup
mongodump --host localhost:27017 --db myApp --out /backup/dir
mongodump --uri "mongodb+srv://..." --db myApp --collection users

# mongorestore
mongorestore --host localhost:27017 --db myApp /backup/dir/myApp

# mongodump with archive and compression
mongodump --db myApp --archive=/backup/myApp.gz --gzip

# mongoexport — export to JSON or CSV
mongoexport --db myApp --collection users --out users.json
mongoexport --db myApp --collection users --type csv --fields name,age,city --out users.csv

# mongoimport
mongoimport --db myApp --collection users --file users.json
mongoimport --db myApp --collection users --type csv --headerline --file users.csv

# mongotop — real-time collection-level I/O statistics
mongotop 5  # refresh every 5 seconds

# mongostat — real-time server statistics
mongostat --host localhost:27017
```

### Transactions

```js
// Multi-document ACID transaction
const session = db.getMongo().startSession()
session.startTransaction({
  readConcern:  { level: "snapshot" },
  writeConcern: { w: "majority" }
})

try {
  const accounts = session.getDatabase("bank").accounts
  accounts.updateOne({ _id: "alice" }, { $inc: { balance: -100 } })
  accounts.updateOne({ _id: "bob"   }, { $inc: { balance:  100 } })
  session.commitTransaction()
} catch (err) {
  session.abortTransaction()
  throw err
} finally {
  session.endSession()
}
```

---

## 10. Hands-On Exercises

1. **CRUD Drill**: Create a `library` database with a `books` collection. Insert 20 books with fields:
   title, author, genre, year, pages, ratings (array of numbers). Query: find all books
   with average rating > 4 AND more than 300 pages. Update: add a "featured" field to the top 5
   rated books. Delete: remove all books published before 1950.

2. **Aggregation Pipeline**: Using the `library` database, build a pipeline that:
   groups by genre, calculates average pages and average rating per genre, sorts by average
   rating descending, and uses $project to format output cleanly with field renamed.

3. **Index Optimization**: Insert 100,000 random user documents with name/age/city/status fields.
   Run a compound query without any index and note the execution time from explain(). Create the
   optimal compound index, rerun, and compare totalDocsExamined vs nReturned.

4. **$lookup Join**: Create an `orders` collection and a `customers` collection. Write an
   aggregation using $lookup to join them, $unwind the joined array, and $project to produce
   a flat document with customer name and order amount.

5. **Transaction Simulation**: Set up a `bank` database with an `accounts` collection containing
   two documents each with a balance field. Write a transaction that transfers 500 from one
   account to another. Then modify it to throw an intentional error mid-transaction and verify
   the balances remain unchanged (abortTransaction works).

---

## 11. Interview Q&A

**Q: What is a covered query and why is it significant?**
Answer: A covered query is one where all fields in the filter, sort, and projection are part of a single index — MongoDB can satisfy the query entirely from the index without reading any documents from disk. It is significant because it eliminates document fetches, drastically reducing I/O. You can verify a query is covered when explain() shows IXSCAN with no FETCH stage and totalDocsExamined equals 0.

**Q: What is the ESR rule for compound indexes?**
Answer: ESR stands for Equality-Sort-Range. When building a compound index, put Equality fields first (fields with exact match conditions), then Sort fields, then Range fields (fields with $gt, $lt, $in with multiple values etc). This ordering maximizes index efficiency because equality conditions narrow the index scan most aggressively, the sort fields allow MongoDB to avoid an in-memory sort, and range fields come last since they cannot eliminate the need to scan a range of keys.

**Q: Explain the difference between $out and $merge in aggregation.**
Answer: $out writes the entire pipeline result to a named collection, replacing the collection atomically if it exists. $merge (v4.2+) is more flexible — it can merge results into an existing collection by matching on fields, and supports actions like merge, replace, keepExisting, fail, or a custom pipeline. $merge also allows writing to collections in different databases, and does not drop the target collection before writing.

**Q: What is the difference between a sparse index and a partial index?**
Answer: A sparse index omits documents where the indexed field is missing or null. A partial index is more general — it indexes only documents that match an arbitrary filter expression (e.g., only active users, only documents where amount > 100). A partial index can index documents whether or not a field exists, as long as they satisfy the filter. Partial indexes are preferred over sparse indexes because they are more expressive.

**Q: How does WiredTiger handle concurrency?**
Answer: WiredTiger uses document-level concurrency control with optimistic locking. Multiple readers and writers can operate on different documents in the same collection concurrently without blocking each other. For collection-level operations that require exclusive access (like index builds), WiredTiger uses intention locks. WiredTiger also uses a checkpoint mechanism to flush data to disk every 60 seconds and on clean shutdown, with the journal providing durability between checkpoints.

**Q: What is the oplog and how does replication use it?**
Answer: The oplog (operations log) is a special capped collection in the `local` database on every replica set member. The primary records every write operation to the oplog in idempotent form. Secondaries tail the primary's oplog and replay operations in the same order, keeping their data synchronized. Because it is a capped collection, the oplog has a fixed size; if a secondary falls too far behind (the oplog wraps), it must perform an initial sync from scratch.

**Q: Describe the difference between readConcern majority and local.**
Answer: readConcern "local" returns data from the local mongod instance regardless of whether it has been replicated to a majority of nodes — this is the default and fastest option but data could be rolled back if the primary fails before replication. readConcern "majority" only returns data that has been acknowledged by a majority of replica set members, guaranteeing the data will not be rolled back. The tradeoff is slightly higher latency because MongoDB must wait for majority acknowledgment before returning results.

**Q: What causes a "write conflict" in a transaction and how is it resolved?**
Answer: A write conflict occurs when two concurrent transactions attempt to write to the same document at the same time. WiredTiger detects this through its MVCC (multi-version concurrency control) mechanism. When a conflict is detected, one transaction is aborted with a WriteConflict error. The application is responsible for retrying the aborted transaction. This is different from traditional RDBMS locking — MongoDB uses optimistic concurrency, so conflicts are detected at commit time rather than causing one transaction to wait.

**Q: What is the bucket pattern in schema design?**
Answer: The bucket pattern is used for time-series or IoT data where many small measurements arrive frequently. Instead of storing one document per measurement (leading to millions of tiny documents), you group N measurements into one "bucket" document — for example, one document per hour per device containing an array of readings for that hour. This reduces document count dramatically, improves index efficiency, and enables efficient range queries over time. It is the design pattern that MongoDB's native time-series collections use internally.

**Q: How does $graphLookup work and when would you use it?**
Answer: $graphLookup performs a recursive lookup on a collection, following a chain of references defined by a connectFromField and connectToField. It is used for tree or graph structures — for example, finding all ancestors or descendants in an org chart, all friends of friends in a social graph, or all subcategories under a category. It outputs all documents reachable from a starting set up to a configurable maxDepth. Without $graphLookup, graph traversal would require multiple round trips to the database from application code.

**Q: What is the difference between $addFields and $project?**
Answer: $project reshapes the document — you must explicitly include or exclude fields, and by default all fields not mentioned are dropped (except _id). $addFields only adds or overwrites specified fields; all existing fields are preserved automatically. Use $addFields when you want to compute new fields without losing existing ones. Use $project when you want precise control over the output shape, especially to reduce document size in large pipelines.

**Q: Explain change streams and their use cases.**
Answer: Change streams allow applications to subscribe to real-time data changes in a collection, database, or entire deployment. They are built on the oplog and use a resume token so they can survive application restarts without missing events. Use cases include: invalidating application caches when data changes, sending notifications to users, synchronizing data to external systems (Elasticsearch, data warehouses), and building event-driven microservices. Change streams require a replica set or sharded cluster (not a standalone mongod).

**Q: What is the difference between $set (update operator) and $set in aggregation update pipeline?**
Answer: Both operators share the name but operate in different contexts. In a standard update operation, $set sets specific fields to literal values. In an update with an aggregation pipeline (v4.2+, using an array as the update argument), $set is an aggregation stage that can reference the document's own existing fields and use aggregation expressions — enabling conditional updates, field calculations, and referencing other fields in the same update. This allows things like incrementing a field based on another field's value in a single atomic update.

**Q: How does MongoDB ensure durability with journaling?**
Answer: MongoDB uses a write-ahead log called the journal. Before acknowledging a write with writeConcern "majority" or "j: true", MongoDB writes the operation to the journal on disk. The journal is written in 100ms batches by default. If mongod crashes, it replays the journal on restart to recover any operations that were committed but not yet written to the main data files. Without journaling (not recommended in production), a crash between checkpoint intervals could cause data loss.

**Q: What are zone sharding and tag-aware sharding used for?**
Answer: Zone sharding (called tag-aware sharding in earlier versions) allows you to assign ranges of shard key values to specific shards or groups of shards. This is used for data locality — for example, routing European customer data to shards in EU datacenters and US customer data to US shards for latency or data sovereignty requirements. It is also used for workload isolation (directing high-priority queries to dedicated hardware) and tiered storage (moving old data to cheaper shards while keeping recent data on fast storage).

**Q: What is the $merge stage's "whenMatched" option and how does it differ from $out?**
Answer: The whenMatched option in $merge controls what happens when an output document matches an existing document in the target collection. Options are: "merge" (default — merge fields), "replace" (replace entire document), "keepExisting" (keep existing, discard pipeline output), "fail" (throw error on match), or a custom update pipeline. $out has none of this flexibility — it always replaces the entire target collection atomically. This makes $merge suitable for incremental updates and aggregation result merging, while $out suits full collection replacement scenarios.
