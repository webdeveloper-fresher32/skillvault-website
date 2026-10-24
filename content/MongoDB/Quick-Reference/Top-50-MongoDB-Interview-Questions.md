# Top 50 MongoDB Interview Questions (Query Coding & Internals)

Comprehensive production & FAANG-level interview guide covering **MongoDB aggregation query coding problems** (including 2nd highest salary, `$lookup`, `$unwind`, window functions, array updates) and **distributed database architecture** (WiredTiger internals, ESR indexing rule, sharding, replica set consensus, and ACID transactions).

---

## 1. High-Frequency MongoDB Aggregation & Query Coding (Q1 – Q20)

### Q1: How do you find the 2nd Highest Salary in MongoDB? Provide the aggregation pipeline and explain how it handles ties/duplicates.
**Answer:**
In MongoDB, to handle ties correctly (e.g. salaries: `[100k, 100k, 80k]`), you must first deduplicate the salaries using `$group`, sort in descending order, skip 1, and take 1:

```javascript
db.employees.aggregate([
  // 1. Group by salary to eliminate duplicates
  {
    $group: {
      _id: "$salary"
    }
  },
  // 2. Sort salaries in descending order
  {
    $sort: {
      _id: -1
    }
  },
  // 3. Skip the highest salary
  {
    $skip: 1
  },
  // 4. Limit to the 2nd highest
  {
    $limit: 1
  },
  // 5. Clean output shape
  {
    $project: {
      _id: 0,
      secondHighestSalary: "$_id"
    }
  }
]);
```
*Alternative (MongoDB 5.2+ using `$sortArray`):*
```javascript
db.employees.aggregate([
  {
    $group: {
      _id: null,
      uniqueSalaries: { $addToSet: "$salary" }
    }
  },
  {
    $project: {
      _id: 0,
      secondHighest: {
        $arrayElemAt: [
          { $sortArray: { input: "$uniqueSalaries", sortBy: -1 } },
          1
        ]
      }
    }
  }
]);
```

---

### Q2: Write an aggregation pipeline to find the N-th Highest Salary in EACH department in MongoDB.
**Answer:**
```javascript
db.employees.aggregate([
  // Step 1: Sort by department and salary descending
  {
    $sort: {
      department: 1,
      salary: -1
    }
  },
  // Step 2: Group by department and collect unique salaries into sorted array
  {
    $group: {
      _id: "$department",
      salaries: { $addToSet: "$salary" }
    }
  },
  // Step 3: Sort the distinct salary array descending and extract N-th (index 1 for 2nd)
  {
    $project: {
      department: "$_id",
      _id: 0,
      secondHighestSalary: {
        $arrayElemAt: [
          { $sortArray: { input: "$salaries", sortBy: -1 } },
          1 // 0-indexed: 1 represents 2nd highest
        ]
      }
    }
  }
]);
```

---

### Q3: How do you identify duplicate documents by email and delete all duplicates while retaining one copy?
**Answer:**

#### Step 1: Identify duplicates and collect their `_id`s
```javascript
db.users.aggregate([
  {
    $group: {
      _id: "$email",
      count: { $sum: 1 },
      ids: { $push: "$_id" }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  }
]).forEach(function(doc) {
  // Retain the first _id and delete the rest
  doc.ids.shift(); // Removes the first element (the one we want to keep)
  db.users.deleteMany({ _id: { $in: doc.ids } });
});
```

---

### Q4: How do you perform a Relational Join in MongoDB using `$lookup`? Provide an example of basic lookup and pipeline lookup.
**Answer:**

#### Basic `$lookup` (Equality Join)
```javascript
db.orders.aggregate([
  {
    $lookup: {
      from: "customers",        // Target collection
      localField: "customerId", // Field in orders
      foreignField: "_id",      // Field in customers
      as: "customerDetails"     // Output array field
    }
  },
  // Flatten array into object if 1:1 relationship
  {
    $unwind: "$customerDetails"
  }
]);
```

#### Advanced `$lookup` with Sub-pipeline & Custom Join Conditions
```javascript
db.customers.aggregate([
  {
    $lookup: {
      from: "orders",
      let: { custId: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$customerId", "$$custId"] },
                { $gte: ["$orderTotal", 500] } // Custom filter during join
              ]
            }
          }
        },
        { $sort: { orderDate: -1 } },
        { $limit: 3 } // Only top 3 high-value orders
      ],
      as: "recentHighValueOrders"
    }
  }
]);
```

---

### Q5: Write a query to find all employees who earn more than their direct manager in MongoDB.
**Answer:**
```javascript
db.employees.aggregate([
  // Join employee with manager document
  {
    $lookup: {
      from: "employees",
      localField: "managerId",
      foreignField: "_id",
      as: "manager"
    }
  },
  {
    $unwind: "$manager"
  },
  // Compare employee salary with manager salary
  {
    $match: {
      $expr: {
        $gt: ["$salary", "$manager.salary"]
      }
    }
  },
  {
    $project: {
      _id: 0,
      employeeName: "$name",
      employeeSalary: "$salary",
      managerName: "$manager.name",
      managerSalary: "$manager.salary"
    }
  }
]);
```

---

### Q6: How do you calculate a Cumulative Running Total in MongoDB?
**Answer:**
In MongoDB 5.0+, use the **`$setWindowFields`** stage:

```javascript
db.transactions.aggregate([
  {
    $setWindowFields: {
      partitionBy: "$accountId",
      sortBy: { transactionDate: 1 },
      output: {
        runningTotal: {
          $sum: "$amount",
          window: {
            documents: ["unbounded", "current"]
          }
        }
      }
    }
  }
]);
```

---

### Q7: How do you calculate a 7-day Moving / Rolling Average in MongoDB?
**Answer:**
```javascript
db.dailySales.aggregate([
  {
    $setWindowFields: {
      sortBy: { salesDate: 1 },
      output: {
        movingAvg7Days: {
          $avg: "$revenue",
          window: {
            documents: [-6, "current"] // 6 rows prior + current row = 7 days
          }
        }
      }
    }
  }
]);
```

---

### Q8: Find all customers who have NEVER placed an order in MongoDB (Anti-Join).
**Answer:**
```javascript
db.customers.aggregate([
  {
    $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "customerId",
      as: "orders"
    }
  },
  // Filter where orders array is empty
  {
    $match: {
      orders: { $eq: [] }
    }
  },
  {
    $project: {
      _id: 1,
      name: 1,
      email: 1
    }
  }
]);
```

---

### Q9: What is `$unwind` and why must you often use `preserveNullAndEmptyArrays`?
**Answer:**
`$unwind` deconstructs an array field from the input document to output a document for *each* element in the array:

```javascript
// Input: { _id: 1, item: "Laptop", tags: ["tech", "work"] }
// Output: 
// { _id: 1, item: "Laptop", tags: "tech" }
// { _id: 1, item: "Laptop", tags: "work" }
```
**`preserveNullAndEmptyArrays: true`:**
By default, if the array field is `null`, missing, or empty `[]`, `$unwind` **drops the document completely** (behaving like an `INNER JOIN`).
Setting `preserveNullAndEmptyArrays: true` preserves the document (behaving like a `LEFT JOIN`):
```javascript
{
  $unwind: {
    path: "$tags",
    preserveNullAndEmptyArrays: true
  }
}
```

---

### Q10: How do you generate Multi-Faceted Search results (Pagination + Total Count + Category Breakdown) in a single database round-trip?
**Answer:**
Use the **`$facet`** stage to execute parallel sub-pipelines over the filtered input documents:

```javascript
db.products.aggregate([
  // Initial filter
  {
    $match: { status: "ACTIVE" }
  },
  {
    $facet: {
      // Facet 1: Paginated Items
      paginatedResults: [
        { $sort: { price: 1 } },
        { $skip: 20 },
        { $limit: 10 }
      ],
      // Facet 2: Total Matching Document Count
      totalCount: [
        { $count: "count" }
      ],
      // Facet 3: Grouping by Category with Average Price
      categoryStats: [
        {
          $group: {
            _id: "$category",
            totalProducts: { $sum: 1 },
            avgPrice: { $avg: "$price" }
          }
        }
      ]
    }
  }
]);
```

---

### Q11: Explain the difference between `$elemMatch` and standard Dot-Notation when querying arrays of sub-documents.
**Answer:**
- **Dot-Notation (`"grades.score": { $gte: 90 }`):** Matches if *any* element satisfies the condition independently. If querying two fields on an array (`"grades.subject": "Math"` AND `"grades.score": 95`), dot notation can match where one element has Math and a *different* element has 95!
- **`$elemMatch`:** Requires that a **single individual element** satisfies **all** criteria simultaneously.

```javascript
// Matches only students who scored >= 90 in Math specifically:
db.students.find({
  grades: {
    $elemMatch: { subject: "Math", score: { $gte: 90 } }
  }
});
```

---

### Q12: How do you update a specific element inside an array using the Positional Operators (`$`, `$[]`, and `$[<identifier>]`)?
**Answer:**
MongoDB provides 3 positional update operators:
1. **`$` (First Matched Element):** Updates the first array element that matched the query filter.
   ```javascript
   db.students.updateOne(
     { _id: 1, "grades.subject": "Math" },
     { $set: { "grades.$.score": 95 } }
   );
   ```
2. **`$[]` (All Elements):** Updates every element in the array unconditionally.
   ```javascript
   db.students.updateOne(
     { _id: 1 },
     { $inc: { "grades.$[].score": 5 } } // Adds 5 points to all subjects
   );
   ```
3. **`$[<identifier>]` (Filtered Positional):** Updates elements that match specific `arrayFilters` conditions.
   ```javascript
   db.students.updateOne(
     { _id: 1 },
     { $set: { "grades.$[elem].grade": "A+" } },
     { arrayFilters: [{ "elem.score": { $gte: 90 } }] }
   );
   ```

---

### Q13: What is the difference between `$push` and `$addToSet` in updates? How do you keep an array capped at $N$ items?
**Answer:**
- **`$push`**: Appends an element to an array regardless of whether it already exists (allows duplicates).
- **`$addToSet`**: Appends an element only if it does not already exist in the array (set semantics, prevents duplicates).

**Capped Array on Update (e.g. keeping only the 5 most recent activities):**
```javascript
db.users.updateOne(
  { _id: userId },
  {
    $push: {
      recentLogins: {
        $each: [{ timestamp: new Date(), ip: "192.168.1.1" }],
        $sort: { timestamp: -1 },
        $slice: 5 // Retains only the top 5 elements
      }
    }
  }
);
```

---

### Q14: How does an Upsert work in MongoDB, and what is `$setOnInsert`?
**Answer:**
When `{ upsert: true }` is passed to `updateOne()`:
- If a document matching the query filter exists, it performs an update.
- If no matching document exists, it inserts a new document combining the query filter and update fields.

**`$setOnInsert`:**
Sets fields **only if an insert occurs**. If the document already exists and an update occurs, `$setOnInsert` is completely ignored:
```javascript
db.userStats.updateOne(
  { userId: 42 },
  {
    $inc: { visits: 1 },
    $setOnInsert: { createdAt: new Date(), firstReferrer: "google.com" }
  },
  { upsert: true }
);
```

---

### Q15: Why is `findOneAndUpdate` preferred over `find` followed by `updateOne` in concurrent systems?
**Answer:**
`findOneAndUpdate` executes **atomically on a single document**.
If two concurrent worker processes execute:
1. `doc = find({ status: "PENDING" })`
2. `updateOne({ _id: doc._id }, { status: "PROCESSING" })`
Both workers will find the **same document** simultaneously (Race Condition / Double Processing).

With `findOneAndUpdate`, the find and update lock the document atomically:
```javascript
const job = await db.jobs.findOneAndUpdate(
  { status: "PENDING" },
  { $set: { status: "PROCESSING", lockedAt: new Date() } },
  { sort: { priority: -1 }, returnDocument: "after" }
);
```
Only one worker can claim the job; the other worker gets the next pending job.

---

### Q16: How do you compare two fields within the same document using `$expr`?
**Answer:**
Standard query operators compare a field against a constant literal. To compare two fields in the same document, use `$expr`:

```javascript
// Find orders where actual shipping cost exceeded quoted shipping fee
db.orders.find({
  $expr: {
    $gt: ["$actualShippingCost", "$quotedShippingFee"]
  }
});
```

---

### Q17: How do you implement Full-Text Search in MongoDB? What are its limits?
**Answer:**
1. Create a Text Index:
   ```javascript
   db.articles.createIndex({ title: "text", body: "text" }, { weights: { title: 10, body: 2 } });
   ```
2. Search with relevance score sorting:
   ```javascript
   db.articles.find(
     { $text: { $search: "distributed database" } },
     { score: { $meta: "textScore" } }
   ).sort({ score: { $meta: "textScore" } });
   ```
**Limitations:**
- Only **one** text index per collection.
- No typo tolerance or fuzzy matching (for typo-tolerance and autocomplete, use MongoDB Atlas Search with Apache Lucene).

---

### Q18: How do Geospatial Queries work in MongoDB?
**Answer:**
1. Store location as GeoJSON point:
   ```javascript
   { location: { type: "Point", coordinates: [-73.9857, 40.7484] } } // [longitude, latitude]
   ```
2. Create a `2dsphere` index:
   ```javascript
   db.restaurants.createIndex({ location: "2dsphere" });
   ```
3. Query nearby restaurants within 5 km:
   ```javascript
   db.restaurants.find({
     location: {
       $near: {
         $geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
         $maxDistance: 5000 // In meters
       }
     }
   });
   ```

---

### Q19: How do you conditionally sum or aggregate in MongoDB (equivalent to SQL `CASE WHEN`)?
**Answer:**
Use the `$cond` or `$switch` operator inside `$group`:

```javascript
db.orders.aggregate([
  {
    $group: {
      _id: "$storeId",
      totalCompleted: {
        $sum: {
          $cond: [{ $eq: ["$status", "COMPLETED"] }, "$amount", 0]
        }
      },
      totalCancelled: {
        $sum: {
          $cond: [{ $eq: ["$status", "CANCELLED"] }, "$amount", 0]
        }
      }
    }
  }
]);
```

---

### Q20: What is the difference between `ordered: true` and `ordered: false` in `bulkWrite` and `insertMany`?
**Answer:**
- **`ordered: true` (Default):** MongoDB executes write operations serially. If an error occurs (e.g. duplicate key), execution stops immediately; subsequent operations in the array are **not attempted**.
- **`ordered: false`:** MongoDB can execute operations in parallel and reorder them for performance. If an error occurs, MongoDB logs the error and continues executing all remaining operations.

---

## 2. Schema Design & Data Modeling (Q21 – Q30)

### Q21: What are the golden rules for Embedding vs. Referencing in MongoDB?
**Answer:**
- **Embed when:**
  - 1:1 relationships where entities are always retrieved together (e.g. `User` and `UserProfile`).
  - 1:Few relationships (e.g. `User` and 2–3 `Addresses`).
  - Data is viewed together in the primary access pattern and bounded in size.
- **Reference (Normalize) when:**
  - 1:Many large or unbounded relationships (e.g. `Blog` and 50,000 `Comments`).
  - Many-to-Many relationships (e.g. `Students` and `Courses`).
  - The embedded entity is updated frequently from multiple sources (embedding would cause duplicate writes).
  - Documents risk exceeding the **16MB BSON limit**.

---

### Q22: Why does MongoDB enforce a 16MB document size limit? What is GridFS?
**Answer:**
The 16MB limit ensures that single documents do not consume disproportionate RAM in the WiredTiger cache, monopolize network I/O, or bloat replication oplog entries.
**GridFS:**
For files > 16MB (videos, high-res images, PDF archives), MongoDB uses GridFS. It divides the file into contiguous **255 KB chunks** stored across two collections:
- `fs.files`: Stores metadata (filename, upload date, file size, content type).
- `fs.chunks`: Stores binary chunks with a pointer to the file `_id` and chunk sequence index.

---

### Q23: Explain the Bucket Pattern. When is it used?
**Answer:**
Instead of storing 1 document per data point (e.g., IoT temperature sensor reading every second = 86,400 documents/day):
The **Bucket Pattern** groups measurements into a single document representing a discrete time bucket (e.g. 1 hour or 1 day):
```javascript
{
  sensorId: 101,
  date: "2026-10-23",
  hour: 14,
  count: 3600,
  readings: [
    { sec: 0, temp: 22.1 },
    { sec: 1, temp: 22.2 }
  ]
}
```
**Benefits:** Reduces index footprint by 100x–1,000x, improves cache locality, and speeds up historical range queries.

---

### Q24: What is the Subset Pattern?
**Answer:**
In e-commerce, a product might have 10,000 reviews. 95% of users only look at the **first 10 reviews**.
Instead of referencing all reviews in a separate collection (requiring a `$lookup` on every page load), or embedding all 10,000 reviews (bloating the document):
**Subset Pattern:**
Embed the **10 most recent reviews** directly inside the `Product` document. Store the full archive of 10,000 reviews in a separate `reviews` collection.
Page loads fetch the product + top reviews in a single disk read ($O(1)$).

---

### Q25: What is the Extended Reference Pattern?
**Answer:**
Instead of embedding an entire foreign document or just storing an `_id` (which forces a `$lookup` join), embed only the **critical, rarely changing fields** needed for display.
*Example in Orders:*
```javascript
{
  orderId: 501,
  customer: {
    id: ObjectId("..."),
    name: "Alice Smith", // Cached for display
    shippingCity: "Seattle"
  },
  items: [...]
}
```
Eliminates `$lookup` joins on invoice generation and order history pages.

---

### Q26: What is the Outlier Pattern?
**Answer:**
Occurs when a small percentage of documents break normal schema assumptions (e.g. Twitter/X: 99.9% of users have < 500 followers, but a celebrity has 50,000,000 followers).
If followers are embedded in an array, the celebrity document hits the 16MB limit.
**Outlier Pattern:**
Set an `hasOverflow: true` flag on the outlier document. The first 1,000 followers are stored embedded; remaining millions of followers overflow into a separate `followers` collection.

---

### Q27: What is the Polymorphic Pattern in MongoDB?
**Answer:**
Used when documents in a collection share common attributes but have distinct specialized fields (e.g. an `athletes` collection storing runners, swimmers, and boxers).
All documents reside in the same collection with a `schemaType` or `type` discriminant:
```javascript
{ name: "Michael Phelps", sport: "SWIMMING", strokes: ["Freestyle", "Butterfly"] }
{ name: "Usain Bolt", sport: "RUNNING", best100mTime: 9.58 }
```
Allows single-query retrieval across all athletes while keeping specialized fields intact.

---

### Q28: How do you enforce Schema Validation in MongoDB?
**Answer:**
Using `$jsonSchema` in collection validation rules:
```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "age"],
      properties: {
        name: { bsonType: "string" },
        email: { bsonType: "string", pattern: "^.+@.+$" },
        age: { bsonType: "int", minimum: 18 }
      }
    }
  },
  validationAction: "error" // "error" rejects writes; "warn" logs warnings
});
```

---

### Q29: What is the Single-Document Atomicity guarantee in MongoDB?
**Answer:**
In MongoDB, any write operation on a **single document is strictly atomic**, including modifications to embedded arrays and sub-documents. If an update modifies 10 fields and pushes to 2 arrays inside a single document, either all modifications succeed or none do.
No multi-document transaction is required if your data model embeds related entities within the same document.

---

### Q30: What are Schema Anti-Patterns to avoid in MongoDB?
**Answer:**
1. **Unbounded Growing Arrays:** Pushing to an array without `$slice` or bounds until the document hits 16MB.
2. **Relational Emulation:** Normalizing everything into tiny collections and chaining 6 `$lookup` stages in queries.
3. **Large Numbers of Collections:** Having 1 collection per user or 1 collection per day (strains WiredTiger metadata cache).

---

## 3. Indexing, Performance & WiredTiger Internals (Q31 – Q40)

### Q31: What is the ESR (Equality, Sort, Range) Rule for Compound Indexes?
**Answer:**
When creating a compound index for a query that contains equality filters, sorting, and range conditions, place the fields in this exact order:
1. **E — Equality:** Fields queried with exact values (`status: "ACTIVE"`).
2. **S — Sort:** Fields specifying order (`sort: { createdAt: -1 }`).
3. **R — Range:** Fields queried with ranges (`age: { $gte: 21 }`).

```javascript
// Query:
db.orders.find({ status: "SHIPPED", total: { $gt: 100 } }).sort({ orderDate: -1 });

// Ideal Compound Index following ESR:
db.orders.createIndex({ status: 1, orderDate: -1, total: 1 });
```
> If Sort is placed after Range, MongoDB cannot use the index to satisfy the sort and must perform an expensive in-memory sort (`SORT` stage).

---

### Q32: What is a Multikey Index? What are its restrictions?
**Answer:**
A multikey index indexes elements inside an array. If a document has `tags: ["tech", "database", "cloud"]`, MongoDB creates 3 separate index entries pointing to the same document.
**Restriction:**
A compound multikey index **cannot index more than one array field**. (e.g. indexing `{ tags: 1, authors: 1 }` where both `tags` and `authors` are arrays is prohibited because it would generate a Cartesian product of index entries).

---

### Q33: What is a Covered Query in MongoDB? Why is it the fastest query possible?
**Answer:**
A query is **covered** when:
1. All fields in the query filter are part of an index, AND
2. All returned fields in the projection are part of that same index (and `_id` is explicitly excluded if not part of the index).

```javascript
db.users.createIndex({ email: 1, username: 1 });

db.users.find(
  { email: "alice@example.com" },
  { email: 1, username: 1, _id: 0 } // Covered!
);
```
**Why it's fastest:**
MongoDB answers the query entirely from RAM index pages without loading documents from disk (`totalDocsExamined: 0`).

---

### Q34: What is a TTL (Time-To-Live) Index?
**Answer:**
A single-field index on a Date field that automatically deletes documents after a specified time:
```javascript
// Automatically deletes user sessions 3600 seconds (1 hour) after createdAt
db.sessions.createIndex(
  { createdAt: 1 }, 
  { expireAfterSeconds: 3600 }
);
```
A background thread runs every 60 seconds to purge expired documents.

---

### Q35: How do you interpret `explain("executionStats")` output in MongoDB?
**Answer:**
Look at:
- **`stage`**:
  - `IXSCAN`: Used an index (good).
  - `COLLSCAN`: Full collection table scan (bad for large collections).
  - `FETCH`: Retrieved documents from disk pages.
  - `SORT`: In-memory sort (bad if memory exceeded).
- **`totalDocsExamined` vs `nReturned`**:
  - In an optimal index, `totalDocsExamined == nReturned`.
  - If `totalDocsExamined: 100000` and `nReturned: 1`, the query examined 100k documents to find 1 (missing index).

---

### Q36: Explain the WiredTiger Storage Engine Architecture (Cache, Eviction, Checkpoints).
**Answer:**
- **Cache:** By default, WiredTiger allocates 50% of (Total RAM - 1GB) for its in-memory buffer pool.
- **Checkpoints:** Every 60 seconds (or 2GB of data), WiredTiger writes a consistent snapshot checkpoint of dirty pages to disk.
- **Journal (Write-Ahead Log):** Records every write between checkpoints. Flushed to disk every 100ms (or on demand via `j: true`), enabling crash recovery between checkpoints.
- **Eviction:** When cache fills (>80% dirty/full), background threads evict clean pages and flush dirty pages to disk.

---

### Q37: What is the 100MB RAM limit in Aggregation Pipelines, and how is it resolved?
**Answer:**
By default, each stage in an aggregation pipeline is allocated a maximum of **100 MB of RAM**. If a `$sort` or `$group` stage exceeds 100MB, the query fails with: `exceeded memory limit for $sort`.
**Fix:**
Add `{ allowDiskUse: true }` to allow stages to spill temporary data to disk:
```javascript
db.orders.aggregate([...], { allowDiskUse: true });
```

---

### Q38: What are Partial Indexes and Sparse Indexes in MongoDB?
**Answer:**
- **Sparse Index:** Only contains entries for documents that actually have the indexed field (ignores documents where field is missing).
- **Partial Index:** Uses a `partialFilterExpression` to index only documents matching an arbitrary filter:
  ```javascript
  db.orders.createIndex(
    { orderDate: 1 },
    { partialFilterExpression: { status: "PENDING" } }
  );
  ```
  Only pending orders are indexed, keeping the index microscopic and fast.

---

### Q39: What is a Collation in MongoDB?
**Answer:**
Collation specifies language-specific rules for string comparison and sorting (e.g. case sensitivity, accent marks):
```javascript
db.users.createIndex(
  { username: 1 },
  { collation: { locale: "en", strength: 2 } } // strength 2 = Case-Insensitive
);
```

---

### Q40: What happens during an in-memory Sort without an index?
**Answer:**
If a sort cannot use an index and `{ allowDiskUse: true }` is not set, MongoDB performs an in-memory sort capped at **100MB RAM**. If the dataset exceeds 100MB, the query crashes immediately.

---

## 4. Replication, Sharding, Consistency & Transactions (Q41 – Q50)

### Q41: Explain Replica Set Architecture in MongoDB.
**Answer:**
A Replica Set consists of a group of `mongod` nodes maintaining identical data:
- **Primary:** Receives all write operations. Writes changes to its `oplog`.
- **Secondary:** Replicates the Primary's oplog asynchronously to maintain mirror state. Can serve read queries if `readPreference` allows.
- **Arbiter:** Holds no data and cannot become primary. Participates only in voting during elections to break ties (use odd number of voting nodes instead whenever possible).

---

### Q42: How does Replica Set Failover and Election work?
**Answer:**
Nodes send heartbeats every **2 seconds**. If the Primary does not respond within **10 seconds** (`electionTimeoutMillis`):
1. Secondaries declare the primary dead and call an election based on the **Raft consensus protocol**.
2. Only secondaries that have the most up-to-date oplog can win the election.
3. Once a candidate receives a majority of votes ($N/2 + 1$), it transitions to Primary.
4. Total failover typically completes in **under 5 seconds**.

---

### Q43: Explain Write Concern (`w: 1`, `w: "majority"`, `j: true`).
**Answer:**
Controls write acknowledgment before returning success to the application:
- **`w: 1`**: Acknowledged as soon as the **Primary node's memory** accepts the write. (Risk: data lost if primary crashes before replicating).
- **`w: "majority"`**: Acknowledged only after a **strict majority of replica set nodes** have committed the write to memory. (Guarantees write cannot be rolled back during failover).
- **`j: true`**: Acknowledged only after written to the on-disk **journal** on the primary.

---

### Q44: Explain Read Concern (`local`, `majority`, `linearizable`).
**Answer:**
- **`local` (Default):** Returns the node's latest data. Does not verify whether data has been committed to a majority (data could be rolled back if primary fails).
- **`majority`:** Returns data that has been acknowledged by a majority of nodes. Immune to failover rollbacks.
- **`linearizable`:** Primary confirms with a quorum of nodes before returning, guaranteeing strict serializability across real-time reads.

---

### Q45: What is Causal Consistency in MongoDB?
**Answer:**
In distributed systems, a user writes data to the Primary and immediately reads from a Secondary. Because replication is asynchronous, the Secondary might not have received the write yet (Read-Your-Own-Writes violation).
**Causal Consistency (via Client Sessions):**
Passes logical cluster times across operations in a session:
```javascript
const session = client.startSession({ causalConsistency: true });
```
Guarantees:
1. **Read your own writes.**
2. **Monotonic reads** (reads never see time move backward).
3. **Writes follow reads.**

---

### Q46: How do Multi-Document ACID Transactions work in MongoDB?
**Answer:**
MongoDB 4.0+ supports multi-document transactions across collections, replica sets, and sharded clusters using a **Two-Phase Commit**:
```javascript
const session = client.startSession();
session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { level: "majority" }
});

try {
  await ordersCollection.insertOne([{ orderId: 101, amount: 250 }], { session });
  await accountsCollection.updateOne({ _id: "cust1" }, { $inc: { balance: -250 } }, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
} finally {
  session.endSession();
}
```
> **Performance Note:** Multi-document transactions carry locking and performance overhead. Good schema design (embedding) avoids the need for transactions in 95% of use cases.

---

### Q47: Explain Sharding Architecture in MongoDB (`mongos`, Config Servers, Shards).
**Answer:**
Sharding provides horizontal write & storage scalability across nodes:
- **`mongos` (Query Router):** Stateless routing service. Applications connect to `mongos` instead of shards directly. Routes queries to the appropriate shard based on the Shard Key.
- **Config Database (Replica Set):** Stores cluster metadata, shard key ranges, and routing tables.
- **Shards:** Each shard is an independent **Replica Set** holding a subset of the sharded data (Chunks).

---

### Q48: What are the criteria for choosing a Good Shard Key?
**Answer:**
1. **High Cardinality:** The key must have millions of distinct values (e.g. `userId` or `uuid`), not binary or enum values (e.g. `country` or `gender` would cause jumbo un-split chunks).
2. **Low Frequency:** No single value should dominate 20% of traffic.
3. **Non-Monotonic:** Monotonically increasing keys (e.g. `auto_increment id` or `timestamp`) cause **hotspotting** — all write traffic hits only the highest shard chunk. Use **Hashed Sharding** for monotonically increasing values.

---

### Q49: Ranged Sharding vs. Hashed Sharding.
**Answer:**
- **Ranged Sharding:** Divides data into contiguous ranges `[min, max]`.
  - *Best For:* Range queries (`WHERE date >= '2026-01-01' AND date < '2026-02-01'`), as `mongos` targets only the specific shard containing that range.
  - *Drawback:* Risks write hotspotting on monotonically increasing fields.
- **Hashed Sharding:** Computes an MD5 hash of the shard key to distribute writes uniformly across all shards.
  - *Best For:* Randomly distributed write scaling.
  - *Drawback:* Range queries become **Scatter-Gather** queries (broadcast to every shard in the cluster).

---

### Q50: Detailed Architectural Decision Matrix: PostgreSQL vs MongoDB. When should you choose each in production?
**Answer:**

| Architectural Requirement | Choose PostgreSQL | Choose MongoDB |
|---|---|---|
| **Data Relationships** | Deeply relational (5+ normalized tables, joins, strict foreign keys) | Document-oriented, hierarchical (JSON/BSON, embedded nested structures) |
| **Schema Evolution** | Structured, predictable schema requiring DDL migrations | Dynamic, highly polymorphic, frequently evolving payload structures |
| **ACID Multi-Table Transactions** | Core business requirement across 100% of domain | Needed infrequently; single-document atomicity suffices for 95% |
| **Write Scaling** | Vertical scaling, read replicas, declarative table partitioning | Native horizontal auto-sharding out-of-the-box across commodity servers |
| **Complex Aggregations & Analytics** | Advanced ANSI SQL, window functions, recursive CTEs, complex grouping | Aggregation Pipeline, `$lookup`, `$facet`, `$setWindowFields` |
| **Text & Search** | Full-text search via `tsvector` and GIN | Atlas Search (integrated Lucene engine with full fuzzy search) |
| **Best Production Fit** | Core Banking, ERP, Accounting, Relational SaaS platforms | Content Management, Catalogs, IoT, User Profiles, Mobile Backends, Real-time telemetry |
