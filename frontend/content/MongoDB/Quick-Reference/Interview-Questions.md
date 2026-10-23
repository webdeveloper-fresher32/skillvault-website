# MongoDB Interview Questions — 50 Q&A
## Complete Preparation Guide

```
┌─────────────────────────────────────────────────────────────────┐
│   Fundamentals    │  CRUD & Queries  │   Schema Design          │
│   Q1 – Q10        │  Q11 – Q20       │   Q21 – Q30              │
├─────────────────────────────────────────────────────────────────┤
│  Indexes & Perf   │  Replication, Sharding & Transactions       │
│  Q31 – Q40        │  Q41 – Q50                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Fundamentals — Q1–Q10](#fundamentals)
2. [CRUD & Queries — Q11–Q20](#crud--queries)
3. [Schema Design — Q21–Q30](#schema-design)
4. [Indexes & Performance — Q31–Q40](#indexes--performance)
5. [Replication, Sharding & Transactions — Q41–Q50](#replication-sharding--transactions)

---

## Fundamentals

---

**Q1: What is MongoDB and how does it differ from a relational database?**

Answer: MongoDB is a document-oriented NoSQL database that stores data as BSON documents inside collections rather than rows inside tables. Unlike relational databases, MongoDB has no fixed schema — each document in a collection can have a different structure. There are no JOINs at the storage engine level; instead, related data is either embedded in the same document or referenced by `_id`. MongoDB scales horizontally via sharding, whereas most relational databases scale vertically or require complex partitioning setups.

---

**Q2: What are the differences between BSON and JSON?**

Answer: JSON is a text-based format supporting six types: string, number, boolean, null, array, and object. BSON (Binary JSON) is a binary-encoded superset that adds types such as `ObjectId`, `Date`, `Binary`, `Decimal128`, `Int32`, `Int64`, `Timestamp`, and `Regex`. BSON is more efficient for traversal (it stores length prefixes so fields can be skipped without parsing) and supports data types needed for databases — for example, JSON has only one `number` type, whereas BSON distinguishes 32-bit int, 64-bit int, and double. MongoDB stores and transmits data as BSON; the shell and drivers convert to/from JSON or language-native objects.

---

**Q3: What is the internal structure of an ObjectId?**

Answer: An ObjectId is a 12-byte value: 4 bytes are a Unix timestamp (seconds since epoch), 5 bytes are a random value unique to the machine and process, and 3 bytes are an incrementing counter initialized to a random value. This structure ensures uniqueness across distributed systems without coordination. Because the first 4 bytes encode creation time, you can infer a document's approximate creation time from its `_id` using `ObjectId.getTimestamp()`, and sorting by `_id` is roughly chronological.

---

**Q4: Why does MongoDB have a 16 MB document size limit?**

Answer: The 16 MB limit exists to discourage unbounded document growth and to keep working set memory manageable. Very large documents must be loaded entirely into RAM for processing, and they increase the cost of replication since entire documents (or at least modified fields) are shipped in the oplog. For large binary data, MongoDB offers GridFS, which splits files into 255 KB chunks stored as separate documents, avoiding the size cap entirely. The 16 MB limit also prevents single-document operations from monopolizing network and I/O resources.

---

**Q5: When should you choose MongoDB over a relational database?**

Answer: MongoDB excels when the data model is document-shaped (nested objects, arrays), schemas evolve frequently, horizontal scalability is needed from the start, or queries are primarily on single entities rather than complex multi-table JOINs. Relational databases are better when strict referential integrity across many entities is required, when complex multi-table ad hoc analytics are the dominant workload, or when the team's tooling (BI tools, ORMs) is deeply relational. In practice, the choice often hinges on whether the access patterns align with document retrieval or relational cross-table queries.

---

**Q6: What is a collection and how does it differ from a table?**

Answer: A collection is a grouping of documents in MongoDB, analogous to a table, but without an enforced schema. Different documents in the same collection can have entirely different fields. Collections are created implicitly on first insert and do not require a `CREATE TABLE` DDL statement. MongoDB supports schema validation via `$jsonSchema` validators, but this is optional and not enforced by the storage engine. Unlike a table, a collection has no foreign key relationships to other collections at the database engine level.

---

**Q7: What is the WiredTiger storage engine and what are its key features?**

Answer: WiredTiger has been MongoDB's default storage engine since version 3.2. It provides document-level concurrency control using MVCC (Multi-Version Concurrency Control), meaning multiple readers and writers can operate on different documents simultaneously without blocking each other. WiredTiger supports configurable compression (Snappy by default, optionally zlib or zstd) for both data and indexes, typically reducing on-disk size by 60–80%. It also supports encryption at rest and write-ahead logging (journaling) for crash recovery.

---

**Q8: What is the oplog and why is it important?**

Answer: The oplog (operations log) is a special capped collection (`local.oplog.rs`) that records every write operation applied to the primary in a replica set. Secondary members tail the oplog to replay operations and stay in sync. The oplog is also the foundation for change streams, Atlas Search sync, Atlas Triggers, and third-party CDC (change data capture) tools like Debezium. Each oplog entry contains the operation type (`i` insert, `u` update, `d` delete), the namespace, and enough information to re-apply the operation idempotently.

---

**Q9: What is a capped collection and when would you use one?**

Answer: A capped collection is a fixed-size circular buffer — once it reaches its size limit, new documents overwrite the oldest ones, preserving insertion order. Because no deletion logic is needed, inserts are extremely fast. Capped collections are suitable for logs, recent-activity feeds, and rolling windows of sensor data where only the latest N records are relevant. They do not support `delete` (individual document deletion) or index creation on arbitrary fields once capped. The oplog itself is a capped collection.

---

**Q10: Explain the MongoDB consistency model — how does read concern interact with write concern?**

Answer: Write concern controls how many replica set members must acknowledge a write before the driver returns success (`w:1` = primary only, `w:"majority"` = majority of members, `j:true` = journal on disk). Read concern controls how fresh the data must be: `local` reads the latest data on the queried node (may not be durable), `majority` reads only data acknowledged by a majority (durable), and `linearizable` provides the strongest guarantee but has the highest latency. For consistent reads after writes, pair `w:"majority"` with `readConcern: "majority"`. Causal consistency (sessions) ensures that reads always see writes the same session issued, even when reading from secondaries.

---

## CRUD & Queries

---

**Q11: What is the difference between `insertOne` and `insertMany` ordered vs. unordered behavior?**

Answer: `insertMany` accepts an `ordered` option (default `true`). With `ordered: true`, MongoDB inserts documents sequentially and stops on the first error — any document before the error is committed, any after is not attempted. With `ordered: false`, MongoDB attempts all inserts in parallel and continues past errors, committing all successful inserts regardless of failures. For bulk imports where partial success is acceptable, `ordered: false` is faster because it allows parallel processing and does not short-circuit on a duplicate key error.

---

**Q12: What is the difference between `$elemMatch` and dot-notation for querying arrays?**

Answer: Dot-notation on arrays (`"address.city": "Sydney"`) queries whether any element in the array satisfies the condition independently per-field. When you need multiple conditions to apply to the same array element simultaneously, you must use `$elemMatch`. For example, `{ scores: { $elemMatch: { subject: "math", grade: { $gte: 90 } } } }` requires a single element where both `subject` is "math" AND `grade >= 90`. Without `$elemMatch`, the query could match a document where one element has `subject: "math"` and a different element has `grade: 90`, which is often incorrect.

---

**Q13: How does `$text` search work in MongoDB and what are its limitations?**

Answer: `$text` uses a text index to perform tokenized full-text search with stemming and stop-word removal. You create a text index with `db.collection.createIndex({ field: "text" })` or a compound text index over multiple fields. The `$text` operator then searches those fields with the given search string, supporting phrase search (`"exact phrase"`), term exclusion (`-badword`), and language-specific stemming. Limitations include: only one text index per collection, no relevance tuning or boost per field (all fields weighted equally unless you specify weights), no proximity/span queries, and much simpler ranking than Lucene-based Atlas Search.

---

**Q14: Explain the aggregation pipeline and how it differs from `find`.**

Answer: The aggregation pipeline is a multi-stage data transformation framework where each stage receives documents from the previous stage and passes transformed results to the next. Stages include `$match` (filter), `$group` (aggregate), `$project` (reshape), `$sort`, `$limit`, `$lookup` (left outer join), `$unwind` (deconstruct arrays), `$facet` (parallel sub-pipelines), and many others. Unlike `find`, which can only filter and project, the aggregation pipeline can compute new fields, join collections, group and count, and reshape documents arbitrarily. Under the hood, MongoDB's query planner can push `$match` and `$sort` before other stages to use indexes.

---

**Q15: What does `$lookup` do and what are its performance implications?**

Answer: `$lookup` performs a left outer join between the current collection and a foreign collection, adding matched documents as an array field. For large collections without proper indexes on the `foreignField`, `$lookup` can be extremely slow because each input document triggers a full scan of the foreign collection. Always ensure the `foreignField` has an index. The `pipeline` form of `$lookup` (using a sub-pipeline) is more flexible but also more expensive. Consider whether embedding is more appropriate — if the join is always performed and the embedded data is not too large or unbounded, embedding avoids the runtime cost entirely.

---

**Q16: What is `$unwind` and when would you use it?**

Answer: `$unwind` deconstructs an array field into separate documents — one output document per array element. For example, a document with `tags: ["a", "b", "c"]` becomes three documents each with a single `tags` value. This is necessary before `$group` when you want to count or aggregate by array element. You can also use `{ includeArrayIndex: "idx" }` to preserve the original array position, and `preserveNullAndEmptyArrays: true` to keep documents where the array is missing or empty rather than filtering them out.

---

**Q17: How does upsert work in MongoDB?**

Answer: An upsert (`{ upsert: true }` in `updateOne` or `updateMany`) performs an update if a matching document exists, or inserts a new document if no match is found. The inserted document is constructed from the filter criteria plus the update fields. If the update uses `$set`, only the specified fields are set; if it is a replacement (no operator), the entire document is replaced. Upserts are atomic — there is no race condition between the find and the insert/update. They are useful for "write-if-not-exists" patterns like idempotent event processing.

---

**Q18: Explain the `$expr` operator.**

Answer: `$expr` allows the use of aggregation expressions inside a query filter, enabling comparisons between fields within the same document. For example, `{ $expr: { $gt: ["$totalAmount", "$discountedAmount"] } }` finds documents where `totalAmount` exceeds `discountedAmount` — something not possible with regular query operators that compare a field to a literal value. `$expr` can use the full set of aggregation operators (`$add`, `$multiply`, `$cond`, etc.) and can leverage indexes if the expressions resolve to indexed fields.

---

**Q19: What is a bulk write operation and why use it?**

Answer: `bulkWrite` lets you send a batch of mixed write operations (insertOne, updateOne, updateMany, deleteOne, deleteMany, replaceOne) in a single network round trip, dramatically reducing latency for high-volume write workloads. In ordered mode (default), operations execute sequentially and stop on error. In unordered mode, all operations are attempted and errors are collected. For ETL pipelines, bulk imports, or event processors that buffer writes, `bulkWrite` is far more efficient than issuing individual writes.

---

**Q20: What is the difference between `deleteOne` and `findOneAndDelete`?**

Answer: `deleteOne` removes the first matching document and returns an acknowledgment object with `deletedCount`. `findOneAndDelete` atomically finds a document, deletes it, and returns the deleted document in a single operation — useful when you need to act on the document's contents after deletion (e.g., task queue pattern where a worker dequeues and processes). `findOneAndDelete` supports `sort` to control which document is selected when multiple match. The atomicity is document-level, ensuring no other operation sees the document between the find and delete.

---

## Schema Design

---

**Q21: What are the key decision criteria for embedding vs. referencing?**

Answer: Embed when: the data is always accessed together (high cohesion), the child data is owned by the parent (1-to-1 or 1-to-few with bounded size), and the embedded data does not exceed ~16 MB. Reference when: the related data is large or unbounded in size, the child entity is shared across many parent documents, or the child is independently queried and updated. The dominant access pattern is the most important factor — if you always load the parent with its children, embedding avoids a round trip. If you frequently update children independently or query them standalone, referencing is cleaner.

---

**Q22: What is the bucket pattern and when is it useful?**

Answer: The bucket pattern groups multiple time-series or sequential data points into a single document (a "bucket") rather than storing one document per event. For example, instead of 3,600 separate documents for per-second sensor readings per hour, you store one document per hour containing an array of 3,600 readings. This reduces document count (lower index size, faster range scans), improves compression, and aligns with how data is typically consumed (hourly aggregations). The trade-off is that appending to a bucket requires an `updateOne` with `$push`, and bucket boundaries must be chosen carefully to avoid documents growing beyond 16 MB.

---

**Q23: What is the unbounded array anti-pattern?**

Answer: An unbounded array is an array field that grows indefinitely as the application runs — for example, `{ postId: 1, likes: [ userId1, userId2, ... ] }` where every user who likes a post is appended. As the array grows, documents approach the 16 MB limit, every read loads all data even if only a count is needed, and `$push` becomes slower as the array index is updated. The fix is to either store likes as separate documents in a `likes` collection (referencing pattern), maintain a `likeCount` counter updated with `$inc`, or use the bucket pattern to shard likes into time-bounded documents.

---

**Q24: Explain schema versioning in MongoDB.**

Answer: Because MongoDB is schemaless, different documents in the same collection may have been written at different application versions with different shapes. The schema versioning pattern adds a `schemaVersion: 1` field to every document. Application code checks the version and applies migration logic on read (lazy migration) or a background job migrates documents in bulk. This avoids expensive all-at-once migrations on large collections. Atlas Schema Advisor and Compass can detect shape diversity and suggest when migration is needed. The versioning pattern is especially important for long-running applications with millions of documents.

---

**Q25: What is the extended reference pattern?**

Answer: The extended reference pattern denormalizes a subset of frequently read fields from a referenced document into the parent document to avoid joins at read time. For example, instead of storing only `{ authorId: ObjectId(...) }` on a blog post, you also store `{ authorId: ObjectId(...), authorName: "Alice", authorAvatar: "url" }`. The trade-off is write complexity — when the author's name changes, both the `authors` collection and all `posts` documents must be updated. This is acceptable when the denormalized fields change rarely (names, avatars) but the parent is read very frequently.

---

**Q26: What is the polymorphic pattern?**

Answer: The polymorphic pattern stores documents of similar but not identical shapes in the same collection, using a `type` or `kind` discriminator field. For example, a `shapes` collection stores `{ type: "circle", radius: 5 }` and `{ type: "rectangle", width: 4, height: 6 }`. Application code branches on `type` to apply the correct logic. This is preferable to separate collections when querying across all shape types is common (avoids `$unionWith`) and the documents share enough structure. A partial index on `type` can optimize type-specific queries.

---

**Q27: When would you use `$jsonSchema` validation?**

Answer: `$jsonSchema` validators enforce document structure at the database level — useful for catching application bugs, ensuring data quality in multi-team environments, and providing a contract for the collection. You can require fields, restrict types, set min/max lengths, and use `if/then/else` for conditional validation. Choose `validationAction: "error"` to reject invalid documents or `"warn"` to log but allow them (useful during migration). Unlike application-level validation, `$jsonSchema` runs server-side and cannot be bypassed by any driver.

---

**Q28: What is the computed pattern?**

Answer: The computed pattern pre-calculates and stores the result of expensive calculations in the document rather than recomputing them on every read. For example, an e-commerce product document might store `averageRating: 4.3` and `reviewCount: 127` rather than computing them via aggregation on every product page load. These values are updated by a write trigger or background job when new reviews arrive. The pattern trades write complexity and potential slight staleness for dramatically faster reads, which is appropriate when reads far outnumber writes.

---

**Q29: What is the tree pattern and what variants exist?**

Answer: The tree pattern models hierarchical data (org charts, category trees, nested comments) in MongoDB. The main variants are: (1) Parent Reference — each node stores its parent's `_id`, simple but requires recursive queries for ancestors. (2) Child References — each node stores an array of child `_id`s, good for shallow trees. (3) Array of Ancestors — each node stores the full path from root to itself as an array, enabling fast subtree queries with `$in` but costly on moves. (4) Materialized Path — each node stores a string path like `/root/parent/child`, enabling regex-based subtree queries. The right choice depends on whether tree reads, writes, or moves dominate.

---

**Q30: What is the outlier pattern?**

Answer: The outlier pattern handles documents that would violate the design of normal documents — for example, a book with 1,000,000 reviews while most books have under 100. Rather than forcing the schema to handle extreme cases that affect only 0.1% of documents, you store a flag `hasExtraReviews: true` and split overflow data into extension documents. The application checks the flag and makes additional queries only when needed. This keeps the common case fast and simple without the 99.9% of normal documents paying a tax for the rare outliers.

---

## Indexes & Performance

---

**Q31: Explain the ESR (Equality, Sort, Range) rule for compound index field ordering.**

Answer: The ESR rule states that compound index fields should be ordered as: Equality fields first (fields queried with exact match `{field: value}`), then Sort fields (fields used in `sort()`), then Range fields (fields queried with `$gt`, `$lt`, `$in`, etc.). Equality fields narrow the index range the most, so they should come first. Sort fields must be contiguous and in order to enable index-sort (avoiding an in-memory sort). Range fields come last because they produce a range scan that the sort cannot use anyway. Violating ESR often causes index-sort fallback or poor selectivity.

---

**Q32: What is a covered query?**

Answer: A covered query is one where all the fields in the query filter, sort, and projection are contained in the index — meaning MongoDB can satisfy the query entirely from the index without reading any documents from the collection. The `explain()` output shows `"totalDocsExamined": 0` for a covered query. To create a covered query, ensure the index includes every field the query references. Note: `_id` must be explicitly excluded from projection if it is not in the index, since MongoDB would otherwise need to fetch it from the document.

---

**Q33: How does a TTL (Time-To-Live) index work mechanically?**

Answer: A TTL index is a single-field index on a `Date` field with an `expireAfterSeconds` option. A background thread (`TTLMonitor`) runs approximately every 60 seconds, scans the TTL index for documents whose indexed date plus `expireAfterSeconds` is less than the current time, and deletes them. Because the cleanup is asynchronous, documents may survive up to ~60 seconds past their expiry. TTL indexes only work on single `Date` fields (not compound, not arrays of dates — actually arrays of dates are supported and the soonest date is used). They are commonly used for sessions, caches, and temporary notifications.

---

**Q34: What is a partial index and when should you use one?**

Answer: A partial index only indexes documents that match a filter expression, reducing index size and write overhead compared to a full index. For example, `db.orders.createIndex({ userId: 1 }, { partialFilterExpression: { status: "active" } })` only indexes active orders. Any query that benefits from the index must include the partial filter in its own query predicate, or MongoDB will not use it. Partial indexes are powerful for sparse data (e.g., indexing only documents with a specific optional field) or hot subsets of a large collection where most queries target the subset.

---

**Q35: What is a multikey index and what are its limitations?**

Answer: A multikey index is automatically created when you index a field that holds an array — MongoDB indexes each array element individually. This allows efficient queries like `{ tags: "mongodb" }` on a `tags: ["mongodb", "database"]` field. The limitation is that a compound index can have at most one multikey field per document (though the index definition itself can include multiple array fields as long as each individual document only has one of them as an array). Multikey indexes also cannot be used as covered queries for array fields.

---

**Q36: What is the difference between `hint()` and MongoDB's default index selection?**

Answer: MongoDB's query planner runs candidate query plans in parallel (the "plan cache race"), picks the winner by counting works (document examinations), and caches the winning plan. `hint()` forces a specific index, bypassing the planner. Use `hint()` when the planner consistently picks a suboptimal index (e.g., due to misleading statistics), during debugging, or in high-frequency queries where you want deterministic behavior and have validated the index choice. Avoid `hint()` in general application code because it can break query correctness if the index is dropped; prefer creating a better index and letting the planner choose.

---

**Q37: How do you interpret `explain("executionStats")` output?**

Answer: The key fields to examine are: `totalDocsExamined` vs `totalDocsReturned` (a large ratio means poor selectivity — index not selective enough or full scan), `totalKeysExamined` vs `totalDocsExamined` (if equal and low, the index is efficient), `stage` (`COLLSCAN` means no index used — usually bad for large collections; `IXSCAN` means index scan; `FETCH` means reading documents after the index scan), `executionTimeMillis` (actual query time), and `indexBounds` (shows which part of the index was scanned). An ideal query shows `IXSCAN → FETCH` with `totalDocsExamined ≈ totalDocsReturned`.

---

**Q38: What is index intersection and is it commonly used?**

Answer: Index intersection allows MongoDB to combine two or more indexes to satisfy a single query, avoiding the need for a compound index. For example, a query on `{ age: { $gt: 30 }, city: "Sydney" }` could use two separate single-field indexes via intersection. In practice, MongoDB uses index intersection infrequently because compound indexes are more efficient — the planner prefers them when available. Intersection adds overhead (fetching two sets of `_id`s and finding their intersection). It is more of a fallback mechanism than a primary design strategy.

---

**Q39: What is a sparse index?**

Answer: A sparse index only includes documents where the indexed field exists and is non-null, skipping documents without the field. This is useful for optional fields that appear in only a fraction of documents — a regular index would store a null entry for every document missing the field, wasting space. Note: queries that need to find documents where the field is absent (`{ field: { $exists: false } }`) cannot use a sparse index and will fall back to a full scan. Partial indexes (with `partialFilterExpression`) are generally more explicit and flexible than sparse indexes.

---

**Q40: How do background index builds work in MongoDB 4.4+?**

Answer: Starting in MongoDB 4.4, all index builds are "hybrid" — they hold an exclusive lock only briefly at the start and end of the build, allowing reads and writes to proceed normally during the majority of the build phase. The build tracks concurrent writes in a side table and merges them at the end. Before 4.4, background builds were slower and foreground builds locked the collection. The `createIndex` command now always uses the hybrid approach. You can monitor build progress with `db.currentOp({ "command.createIndexes": { $exists: true } })`.

---

## Replication, Sharding & Transactions

---

**Q41: How does the replica set election algorithm work?**

Answer: When a primary becomes unavailable, the remaining members hold an election. Each candidate votes for itself and solicits votes from other members. A member votes yes only if the candidate has an oplog entry at least as recent as its own (ensuring no data loss). A candidate wins by receiving a majority of votes (e.g., 2 of 3 in a 3-member set). MongoDB uses the Raft-inspired protocol with priority values — higher-priority members are preferred as primaries. The election completes in under 12 seconds in healthy networks. Arbiters vote but hold no data; they help break ties in even-numbered sets.

---

**Q42: What are the read preference modes and when would you use each?**

Answer: `primary` (default) always reads from the primary — strongly consistent. `primaryPreferred` reads from the primary if available, falls back to a secondary. `secondary` always reads from a secondary — may see stale data. `secondaryPreferred` prefers secondaries, falls back to primary — useful for analytics workloads to offload the primary. `nearest` reads from the node with the lowest network latency regardless of role — best for geographically distributed apps where latency matters more than freshness. Combining read preference with `maxStalenessSeconds` bounds how out-of-date a secondary read can be.

---

**Q43: What makes a shard key bad and what are the consequences?**

Answer: A bad shard key causes an uneven distribution of data or queries across shards. Low-cardinality keys (e.g., `status` with only three values) create at most three chunks, leaving most shards idle. Monotonically increasing keys (e.g., auto-increment IDs, timestamps) cause all writes to go to the last chunk on one shard ("hotspot"), defeating the purpose of horizontal scaling. Non-query-aligned keys mean most queries must be broadcast to all shards (scatter-gather). Consequences include hotspot shards, poor horizontal scalability, and high latency scatter-gather queries. Good shard keys have high cardinality, are not monotonically increasing (or are hashed), and appear in most query predicates.

---

**Q44: What is hashed sharding and when is it appropriate?**

Answer: Hashed sharding applies a hash function to the shard key value before distributing chunks, ensuring even distribution even for monotonically increasing keys like `ObjectId` or timestamps. The trade-off is that range queries on the shard key become scatter-gather (since adjacent values hash to different shards), so you lose range locality. Hashed sharding is ideal when even write distribution matters most and range queries on the shard key are rare or absent — for example, sharding a `logs` collection by `_id` (which is monotonically increasing) to spread write load.

---

**Q45: What are the ACID guarantees in MongoDB?**

Answer: MongoDB provides ACID at the single-document level without any special configuration — a write to one document is atomic, consistent, isolated, and durable (with journaling). For multi-document ACID transactions (introduced in MongoDB 4.0 for replica sets, 4.2 for sharded clusters), MongoDB wraps multiple operations in a session with `startTransaction()`. These transactions support snapshot isolation, rollback on abort, and all-or-nothing semantics across multiple collections. MongoDB uses MVCC (WiredTiger) and two-phase commit (2PC) for distributed transactions across shards.

---

**Q46: What are the limitations of multi-document transactions in MongoDB?**

Answer: Multi-document transactions have a default 60-second timeout (configurable) and a 16 MB oplog entry limit per transaction. They add write conflicts — if two transactions modify the same document concurrently, one is aborted. Transactions on sharded clusters require the use of sessions and incur the overhead of two-phase commit. They should be used sparingly for genuinely multi-document atomic operations; using them as a crutch to avoid good schema design leads to contention and performance problems. MongoDB recommends limiting transactions to a small number of documents and keeping them short.

---

**Q47: What is the difference between a replica set and a sharded cluster?**

Answer: A replica set provides high availability and redundancy — the same data is replicated across multiple nodes (typically 3), with one primary accepting writes and secondaries providing failover and read scaling. A sharded cluster provides horizontal write and storage scalability — data is partitioned across multiple shards, each of which is itself a replica set. A sharded cluster includes `mongos` routers (query routing layer) and config servers (stores cluster metadata). You use a replica set when one server's storage and write throughput is sufficient; you add sharding when data volume or write throughput exceeds what a single replica set can handle.

---

**Q48: What is a zone in sharding and how is it different from a tag?**

Answer: Tags and zones are the same concept; "zones" is the newer terminology used from MongoDB 3.4 onwards. A zone (tag) is a named label associated with a set of shards. You assign key ranges to zones using `sh.addTagRange` (older API) or zone commands, and the balancer ensures chunks in that range only live on shards assigned to the zone. This is used for data locality (geo-distribution of a global cluster), hardware tiering (hot data on SSD shards, cold on HDD), or tenant isolation (each tenant's data on their own shard).

---

**Q49: What is change streams and how do they work?**

Answer: Change streams provide a real-time, resumable stream of data change events (insert, update, delete, replace) from a collection, database, or entire cluster. Under the hood, they are backed by the oplog — MongoDB transforms raw oplog entries into a richer, easier-to-consume event format. Change streams return a resume token with each event; if the connection drops, you restart the stream from the last resume token, guaranteeing no missed events (as long as the token is within the oplog retention window). They are the foundation for Atlas Triggers, Atlas Search sync, and any CDC pipeline built on MongoDB.

---

**Q50: Explain causal consistency and when it matters.**

Answer: Causal consistency guarantees that in a client session, a read always reflects all prior writes in the same session — even when reading from a secondary. Without causal consistency, a write to the primary followed immediately by a read from a secondary could return stale data that does not include the write. MongoDB implements causal consistency using logical operation times (cluster times): the session tracks the latest `operationTime` it has seen, and all subsequent reads are required to wait until the queried node has caught up to at least that time. This matters in applications that write data and immediately display it to the same user, especially when reads are routed to secondaries for load balancing.
