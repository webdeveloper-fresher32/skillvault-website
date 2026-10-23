# The Database Landscape — Complete Guide

> "A hardware shop stocks hammers, pipe cutters, and torque wrenches; nobody argues about which is the best tool, only about what is on the bench in front of them."

---

## Table of Contents

1. [The Problem: A Field That Looks Like a Wall of Unrelated Names](#1-the-problem-a-field-that-looks-like-a-wall-of-unrelated-names)
2. [The Hardware Shop Analogy](#2-the-hardware-shop-analogy)
3. [The Mechanism: What Actually Varies Between Families](#3-the-mechanism-what-actually-varies-between-families)
4. [Code Walkthrough: One Product Catalog Across Four Stores](#4-code-walkthrough-one-product-catalog-across-four-stores)
5. [Comparing Managed Hosting to Self-Hosting](#5-comparing-managed-hosting-to-self-hosting)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: A Field That Looks Like a Wall of Unrelated Names

Somebody says "we should put that in Cassandra" or "just use a vector database" and the words carry no structure yet — they sound like brand names rather than answers to specific questions.

### The Wall of Names

```text
PostgreSQL  MySQL  SQLite  Oracle  SQL Server  MongoDB  Couchbase
DynamoDB  Redis  Memcached  Cassandra  HBase  Bigtable  Neo4j
InfluxDB  TimescaleDB  Prometheus  Elasticsearch  OpenSearch  Solr
    ↳ Twenty names, no ordering principle. Nothing here says which
      two are near-substitutes and which two solve unrelated problems.
```

### The Cost of Choosing Without a Map

```text
A team stores 400 GB of session data in a relational database and pays
for durability, joins, and constraints it never uses.
Another stores billing records in a key-value store, then finds that
"which invoices are unpaid this month" means reading every key.
    ↳ Both are the same mistake: picking a family before writing down
      the access pattern.
```

### What's Missing

Every name on that wall is a set of answers to the same handful of questions: what shape is one record, how is a record addressed, what queries are cheap, and what was sacrificed to make them cheap. What is missing is those questions, stated once, so that a new name can be placed on a map rather than memorised.

---

## 2. The Hardware Shop Analogy

Nobody walks into a hardware shop and asks for the best tool. They describe the job — a copper pipe that needs cutting, a bolt that needs a specific torque — and the tool follows from the job. The shop stocks a hammer and a torque wrench not because one is outdated but because they meet different materials.

### One Tool for Everything vs a Stocked Shop

```text
One tool     → a hammer drives nails superbly and ruins a copper pipe;
               every job is forced into its one shape, and the damage
               shows up later, in the material
Stocked shop → the job is described first (material, tolerance, how
               often), then the matching shelf is picked — and most
               jobs still turn out to be hammer jobs
```

### Mapping the Analogy to Database Families

The job description is the access pattern: how a record is looked up, how many records a typical query touches, and what must stay consistent. Each family is a shelf tuned to a class of jobs, and just as most household jobs really are hammer jobs, most applications really are relational-database jobs. The point of a map is not to avoid the common answer — it is to recognise when this particular job is genuinely not one.

---

## 3. The Mechanism: What Actually Varies Between Families

Underneath every name are the same four questions. Once you can answer them for a system, you know roughly what it is good and bad at without ever having used it — and how a record is addressed matters most, because that is what the engine gets to make cheap.

### The Four Questions

```text
1. What is one record?    a row of typed columns? a nested document? an
                          opaque blob? a node with edges? a vector?
2. How is it addressed?   by primary key only? by any column? by
                          partition + sort key? by similarity? by term?
3. What is cheap?         point lookup? range scan? multi-table join?
                          aggregation? traversal to depth 6?
4. What was traded away?  joins? strong consistency? flexible querying?
                          single-node simplicity?
```

### Relational, Document, Key-Value, Wide-Column

```text
RELATIONAL — rows in typed tables, joined by keys, queried in SQL.
  Example: orders JOIN customers JOIN order_items for one invoice.
  Driven by: 1970s applications hard-coded to a physical layout, so any
  storage change broke every program. Declare the data once, query it
  any way, let the engine plan the access.
DOCUMENT — one self-contained JSON-like record, nested, schema-flexible.
  Example: a product with its variants and images in one document,
  fetched whole by _id with no joins.
  Driven by: object graphs that were tedious to spread across five
  tables and reassemble on every read, and schemas that changed weekly.
KEY-VALUE — an opaque value addressed only by its exact key.
  Example: GET session:8f3a returns the serialised session in ~0.2 ms.
  Driven by: the simplest and fastest possible lookup, often in memory,
  where the value's internal structure is the application's business.
WIDE-COLUMN — rows partitioned across nodes by a partition key, sorted
  within each partition by a clustering key.
  Example: partition (sensor_id), clustered by recorded_at, so "last
  1000 readings for sensor 42" is one contiguous read on one node.
  Driven by: write volumes and datasets past what one machine holds,
  accepting that queries not naming the partition key are impractical.
```

### Graph, Time-Series, Vector, Search

```text
GRAPH — nodes and edges as first-class citizens, both with properties.
  Example: "people within 3 hops of Ada who worked at the same firm" is
  one traversal, not three self-joins that degrade with each hop.
  Driven by: relationship-heavy questions of variable or unknown depth.
TIME-SERIES — append-only measurements keyed by (series, timestamp).
  Example: 50,000 CPU samples/sec, queried as "p95 per minute, last 24h".
  Driven by: data that only appends, is read by time window and then
  downsampled, and compresses extremely well when ordered by time.
VECTOR — records are high-dimensional embeddings; the query is "nearest
  neighbours to this vector", answered approximately.
  Example: 1536-dimension embeddings of 2M support articles, top-10 by
  cosine similarity in under 50 ms.
  Driven by: semantic search and retrieval-augmented generation, where
  the match is meaning-based and no exact answer exists at all.
SEARCH ENGINE — an inverted index from analysed terms back to documents,
  ranked by relevance rather than filtered by a predicate.
  Example: "waterproof jacket" matching "water-resistant coat", ranked.
  Driven by: human free-text queries, where stemming, synonyms, typo
  tolerance and ranking matter more than exact predicate matching.
```

---

## 4. Code Walkthrough: One Product Catalog Across Four Stores

The same fact — product `KB-104`, a keyboard, 42 in stock at 89.90 EUR — modelled four ways. What each one makes easy, and what it makes impossible, is the whole point.

### Relational and Document

```sql
-- Illustrative standard SQL. Relational: normalised across tables.
SELECT p.sku, p.name, i.on_hand, pr.amount
  FROM products p
  JOIN inventory i  ON i.sku  = p.sku
  JOIN prices    pr ON pr.sku = p.sku AND pr.currency = 'EUR'
 WHERE p.sku = 'KB-104';
```

```json
// Document: one self-contained record, fetched whole by its id.
{ "_id": "KB-104", "name": "Mechanical Keyboard", "on_hand": 42,
  "prices": [{ "currency": "EUR", "amount": 89.90 }],
  "tags": ["peripherals", "input"] }
```

### Key-Value and Wide-Column

```text
Key-value:   SET product:KB-104 '{...}'   then   GET product:KB-104
  ↳ One round trip, nothing parsed server-side — and no way to ask for
    all products under 100 EUR without reading every key.
Wide-column: partition key (warehouse_id), clustering key (sku)
             SELECT * WHERE warehouse_id = 7 AND sku = 'KB-104';
  ↳ Cheap because it names the partition. Filtering only on price
    would have to touch every partition on every node.
```

### Where This Repo's Courses Sit

```text
Databases/Fundamentals → this course: the engine-agnostic theory
Databases/MySQL, Databases/PostgreSQL → relational (row store, OLTP)
Databases/MongoDB      → document
Databases/Cassandra    → wide-column
Databases/Redis        → key-value, in-memory
  ↳ Take this course first. Schema design, indexing, transactions and
    replication are answered differently by each of those five, and
    the differences only land once the question itself is clear.
```

---

## 5. Comparing Managed Hosting to Self-Hosting

Independent of family, every engine can be run by you or rented as a service. The choice is usually made once and lived with for years.

### Managed vs Self-Hosted

| | Managed service | Self-hosted |
|---|---|---|
| Provisioning | Minutes, from a console or API | Capacity planning, hardware or VMs |
| Backups and point-in-time restore | Configured and tested by the provider | Yours to script, verify, and rehearse |
| Failover and upgrades | Usually automatic; scheduled windows, limited version choice | You build and drill it; any version, any extension |
| Tuning access | Restricted; no superuser, limited config | Full control of config, kernel, storage |
| Cost shape | Higher per GB-hour, no staff time | Lower resource cost, real engineering time |
| Best when | Small teams, standard needs, fast start | Unusual scale, data residency, deep tuning |

### Takeaway

The honest default is a managed relational database. Most applications — including most that describe themselves as high-scale — are served well by one, because their real requirement is a few thousand transactions per second over tens of gigabytes with strong consistency and ad-hoc querying, which is exactly the relational sweet spot. The specialised families exist because specific workloads genuinely broke that model: datasets past one machine, traversals of unknown depth, similarity search that has no exact answer. Novelty is not a reason to choose, and neither is a conference talk about someone else's traffic.

---

## 6. Common Mistakes

- **Choosing a family before writing down the access pattern.** The four questions in Section 3 are answerable in an afternoon and they determine the answer; picking the engine first means retrofitting the access pattern to the tool, which is how billing records end up in a key-value store with no way to ask which invoices are unpaid.
- **Reading "web-scale" advice as if it described your workload.** A design that makes sense at a million writes per second across three data centres usually makes things worse at ten thousand writes per second on one, because the distributed machinery costs latency, weaker guarantees, and operational complexity that only pay off past a threshold you may never reach.
- **Assuming the families are mutually exclusive.** Real systems commonly run a relational database of record with a cache in front, a search index alongside, and an analytical copy behind — each fed from the authoritative store. The question is rarely which single engine, but which one owns the truth and what the others derive from it.
- **Treating a managed service as a reason not to understand the engine.** It removes the operational toil, not the need to know why a query is slow, what an index costs on every write, or what your isolation level actually guarantees. Every topic in this course applies identically to a managed instance.

---

## 7. Hands-On Exercises

**Exercise 1:** Take three features from a system you know and answer Section 3's four questions for each: what one record is, how it is addressed, which query must be cheap, and what you would be willing to give up. Name the family each set of answers points to, and note any case where two features of the same system point to different families.

**Exercise 2:** Write down the top five queries for an online bookshop — product page, search results, order history, stock check, monthly revenue — and mark each with the family that serves it best. Then decide which single store owns the authoritative data and which of the five would be served by a derived copy, and draw the flow of data between them on one page.

**Exercise 3:** Model the same customer — id, name, email, three addresses, six past orders — in relational tables, as one JSON document, and as key-value entries. For each, write down what "change the customer's email" costs and what "list all customers in Ireland" costs. State plainly which representation makes each operation harder and why.

**Exercise 4:** Deliberately reproduce the first mistake in Section 6 on paper. Choose a key-value store for a billing system, then write out how you would answer "which invoices are unpaid this month", "total revenue per customer this year", and "refund invoice 8812 and adjust the ledger atomically". Record where each attempt breaks down, and which specific DBMS capability from Lesson 1 you find yourself reinventing by hand.

**Exercise 5:** For one workload of your choosing, fill in the managed-versus-self-hosted table from Section 5 with your actual numbers: team size, data residency rules, expected data volume, and how many hours per month you can spend on backups, failover drills, and upgrades. Write a three-sentence decision and name the single constraint that decided it.

---

## 8. Interview Q&A

**Q: How would you choose between a relational database and a document database?**
By the access pattern, not the data. If most reads fetch one self-contained aggregate by its identifier and the shape varies between records, a document model fits naturally and avoids reassembling five tables on every read. If the same data is queried many different ways, joined across entities, or needs constraints enforced across records, relational is the better fit because the engine can plan arbitrary queries and enforce integrity centrally. In practice most applications land relational, and modern relational engines index JSON columns well enough to absorb the document-shaped parts.

**Q: What problem was the wide-column family created to solve?**
Datasets and write volumes larger than one machine can hold, once scaling up has run out. Records are partitioned across nodes by a partition key and sorted within each partition by a clustering key, so a query naming the partition key is a contiguous read on a single node no matter how many nodes exist. The trade is severe: queries that do not name the partition key are expensive or impossible, so the schema is designed backwards from the queries rather than forwards from the entities.

**Q: When is a graph database actually the right call over joins in SQL?**
When the traversal depth is variable or unbounded and the relationships are the query rather than a detail of it — "everyone within four hops", "shortest path between these two accounts", "all rings of mutual referrals". Each hop in SQL is another self-join, and the plan degrades quickly as depth grows or is only known at runtime. For fixed one or two-hop relationships, ordinary joins on an indexed foreign key are perfectly good and far more operationally boring.

**Q: What is a vector database for, and how does it differ from a search engine?**
A vector database stores high-dimensional embeddings and answers approximate nearest-neighbour queries — given this vector, return the closest ones — which is how semantic search and retrieval-augmented generation find passages that mean the same thing without sharing any words. A search engine builds an inverted index from analysed terms to documents and ranks by relevance, so it excels at term matching with stemming, synonyms, and typo tolerance. They are complementary; hybrid retrieval that combines a term score with a vector score usually beats either alone.

**Q: A team wants to adopt a new distributed database for a product with 5,000 daily active users. What do you say?**
That the scale being designed for does not exist yet, and the machinery has a real price — weaker consistency, restricted query shapes, more moving parts to operate, and a much smaller pool of people who have debugged it at 3am. A single managed relational instance handles that load comfortably, with strong consistency, ad-hoc querying, and constraints doing the integrity work for free. I would ask which specific limit they expect to hit, and if the answer is a number rather than a feeling, revisit the decision against measurements instead of adopting the architecture years in advance.
