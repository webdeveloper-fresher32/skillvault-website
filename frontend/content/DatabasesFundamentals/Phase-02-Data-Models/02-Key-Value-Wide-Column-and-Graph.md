# Key-Value, Wide-Column, and Graph Models — Complete Guide

> "A cloakroom ticket gets your coat back in one move, a warehouse aisle stacks whatever fits on each shelf, and a family tree answers 'who is related to whom' by following lines — none of the three is a filing cabinet of identical forms."

---

## Table of Contents

1. [The Problem: Three Access Patterns Tables Serve Badly](#1-the-problem-three-access-patterns-tables-serve-badly)
2. [The Cloakroom, Warehouse, and Family Tree Analogy](#2-the-cloakroom-warehouse-and-family-tree-analogy)
3. [The Mechanism: Get and Put, Partition Keys, and Traversal](#3-the-mechanism-get-and-put-partition-keys-and-traversal)
4. [Diagram: The Same Order Data in Three Layouts](#4-diagram-the-same-order-data-in-three-layouts)
5. [Code Walkthrough: One Question Written Three Ways](#5-code-walkthrough-one-question-written-three-ways)
6. [Comparing Wide-Column to Column-Store](#6-comparing-wide-column-to-column-store)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Three Access Patterns Tables Serve Badly

Lesson 1 modelled an e-commerce shop as tables and as documents. Both assume the interesting questions are about entities and their attributes. Three real workloads in the same shop are not shaped like that at all.

### What Each Workload Actually Asks For

```text
Session lookup   → given token "a91f…", return the session blob.
                   40,000/sec, 1 ms budget, no query beyond the key.
Clickstream      → 300,000 events/sec, appended forever, read back as
                   "last 500 events for user 412, newest first".
Recommendation   → "products bought by people who bought what Priya
                   bought" — 3 hops, and tomorrow someone wants 5.
      ↳ The first needs no query engine at all; the second outgrows one
        machine's write path; the third has no fixed join count.
```

### What's Missing

A relational engine can answer all three. It pays for a query planner the session lookup never uses, keeps secondary indexes the clickstream must update on every insert, and expresses the recommendation as a recursive join whose cost grows with a depth the schema does not know. What is missing is a model whose shape matches the question.

---

## 2. The Cloakroom, Warehouse, and Family Tree Analogy

A cloakroom needs no catalogue: hand over ticket 214, get coat 214 back, and the attendant never has to know what colour it is. A warehouse aisle takes whatever arrives, on whatever shelf has room, with no requirement that every bay hold the same thing. A family tree pinned to a wall answers "how is Priya related to Sam" by tracing lines, not by looking anyone up in a list.

### Ticket, Shelf, and Tree

```text
Cloakroom ticket → one number in, one bundle out; nobody searches the
                   racks by colour, so the racks need no index at all
Warehouse aisle  → each bay holds a different mix, added to constantly;
                   the aisle number is what tells you where to go
Family tree      → the value is in the lines between people, and the
                   answer is found by walking them, however many it takes
```

### Mapping the Analogy to the Three Models

The ticket is key-value: the whole contract is a key in, an opaque value out. The aisle is wide-column: a partition key routes you to a place where sparse, varying columns accumulate. The tree is graph: relationships are first-class objects, and queries are walks over them rather than repeated matching of key columns.

---

## 3. The Mechanism: Get and Put, Partition Keys, and Traversal

Each model earns its speed by removing something the relational model offers. Knowing what was removed is how you tell whether the model fits.

### Key-Value: The Entire API Is Two Operations

```text
put(key, value)   → store opaque bytes under an exact key
get(key)          → return them, or nothing
delete(key)       → remove them
      ↳ There is no "find all values where status = 'active'". The
        store never parses the value, so it needs no schema, no
        planner, no join logic, and no secondary index to maintain.
        Routing is a hash of the key: any node can compute, in
        constant time and without asking anyone, which node holds it.
```

### Wide-Column: Partition Key, Clustering Key, Sparse Columns

```text
PARTITION KEY user_id=412        ← decides which machine stores this
  CLUSTERING KEY ts DESC         ← decides the order rows sit in on disk
    2025-03-14T09:12  page=/kb-87   referrer=email    ab_variant=B
    2025-03-14T09:10  page=/cart    cart_value=138.00
    2025-03-14T09:07  page=/home
      ↳ Rows in one partition need not share columns; a column exists
        only for the rows that set it. Writes are appends, and every
        partition can be written on a different machine at once.
```

### Graph: Nodes, Edges, and Traversal

```text
(User 412) -[:PLACED]-> (Order 5001) -[:CONTAINS]-> (Product KB-87)
(User 907) -[:PLACED]-> (Order 5044) -[:CONTAINS]-> (Product KB-87)
      ↳ An edge is a stored object with a type, a direction, and its
        own properties. Following one is a pointer hop from the node
        you are already on — the cost of a traversal grows with the
        number of edges actually walked, not the size of the tables.
```

---

## 4. Diagram: The Same Order Data in Three Layouts

Order 5001 — placed by user 412, containing product KB-87 — laid out by each model.

### Three Layouts of One Fact

```text
KEY-VALUE                WIDE-COLUMN                 GRAPH
┌──────────────────┐     ┌────────────────────┐      ┌────────┐
│ order:5001       │     │ part. key user:412 │      │ U 412  │
│  → {opaque blob} │     │  5001 total=138.00 │      └───┬────┘
└──────────────────┘     │  5044 total=89.00  │     PLACED│
  one hop, no search     │  5102 coupon=WK10  │      ┌───▼────┐
                         └────────────────────┘      │ O 5001 │
                          rows differ in columns     └───┬────┘
                          appended, never rewritten CONTAINS│
                                                     ┌────▼────┐
                                                     │ P KB-87 │
                                                     └─────────┘
```

### Reading the Diagram

The key-value box has no internal structure the store can see, which is exactly why it is fast. The wide-column partition groups every row for user 412 onto one machine so a range read over them is sequential, and note that row 5102 has a column the others lack. The graph stores the arrows themselves, so "which products did 412 buy" is two hops rather than two key matches.

---

## 5. Code Walkthrough: One Question Written Three Ways

Each of Section 1's three workloads, written in the model that fits it and contrasted with the relational version of the same request.

### The Session Lookup as Key-Value

```text
put("session:a91f7c", {user_id: 412, exp: 1741946400}, ttl=1800s)
get("session:a91f7c")  → the blob, or nothing if it expired
      ↳ The relational version is SELECT ... WHERE token = ?, which
        descends an index, reads a row, and consults a planner — work
        the key-value store skips entirely because it cannot do
        anything else. The lost ability is the whole optimization.
```

### The Event Feed as Wide-Column

```text
Table events:  PARTITION KEY (user_id), CLUSTERING KEY (ts DESC)
Read: fetch partition user_id=412, take the first 500 rows.
      ↳ Because the clustering key already stored them newest-first,
        this is one sequential read of adjacent bytes on one machine —
        no sort, no secondary index. The relational equivalent,
        ORDER BY ts DESC LIMIT 500, needs an index on (user_id, ts)
        that must be updated on all 300,000 writes per second.
```

### The Recommendation as Graph Traversal

```sql
-- Standard SQL, illustrative: 3 hops written out by hand.
SELECT DISTINCT p3.product_id
FROM order_items p1
JOIN order_items p2 ON p2.product_id = p1.product_id
JOIN order_items p3 ON p3.order_id   = p2.order_id
WHERE p1.order_id IN (SELECT order_id FROM orders WHERE user_id = 412);
```

```text
Graph equivalent (illustrative pseudocode):
  MATCH (u:User {id:412})-[:PLACED]->()-[:CONTAINS]->(p)
        <-[:CONTAINS]-()<-[:PLACED]-(other)-[:PLACED]->()-[:CONTAINS]->(rec)
  RETURN DISTINCT rec
      ↳ Depth 4 is one more arrow. In SQL it is one more JOIN clause
        written by hand, or a recursive CTE whose termination and cost
        you now own. Unknown-depth traversal is the case graph models
        exist for; a fixed two-table lookup is not.
```

---

## 6. Comparing Wide-Column to Column-Store

The two names sound identical and describe opposite systems, which is the single most common source of confusion in this area.

### Wide-Column vs Column-Store

| | Wide-column (Bigtable lineage) | Column-store (columnar/analytical) |
|---|---|---|
| Physical layout | All columns of one row stored together, per partition | Each column stored separately across all rows |
| "Column" means | A sparse, per-row, dynamically named field | A physically separate array of one field's values |
| Built for | High write volume, key-and-range reads across many machines | Scanning a few columns over billions of rows |
| Typical read | "The last 500 rows in partition user:412" | "The average of one column across the whole table" |
| Compression | Per-partition, modest | Very high — one column, one data type, adjacent |

### Takeaway

Wide-column is row-oriented storage with a flexible column set per row; column-store is genuinely column-oriented storage. The former is an operational, write-heavy model; the latter is an analytical, scan-heavy one. If a system is described as "wide-column" and someone expects analytics-grade scan speed from it, the naming has misled them, not the engine.

---

## 7. Common Mistakes

- **Expecting a key-value store to answer questions about values.** There is no `WHERE`, so "all sessions for user 412" is either impossible or a full keyspace scan. The usual fix is to write a second key — `user:412:sessions` — at the same time, which means the application, not the engine, now owns keeping the two consistent.
- **Designing wide-column tables from entities instead of from queries.** The partition key must come from what the read asks for, because a read that does not name a partition key has to hit every machine. Modelling `events` by `event_id` and then wanting "everything for user 412" produces exactly that scatter-gather.
- **Letting a partition grow without bound, or choosing a key that concentrates traffic.** A partition key of `country` puts every row for a large market on one replica set; a partition keyed by day puts all of today's writes on one machine while the rest idle. Both are hot partitions, and both look fine in a small test.
- **Reaching for a graph database for shallow, fixed-depth relationships.** A user with many orders is one foreign key and one join. Graph models pay off when depth is variable and the traversal itself is the query — friend-of-friend, fraud rings, dependency chains — not merely because two things are related.

---

## 8. Hands-On Exercises

**Exercise 1:** Model a URL shortener in both key-value and relational form. Write the exact key format and value payload for the key-value version, then the `CREATE TABLE` for the relational one. Write down what the key-value version cannot answer at all, and what a business would eventually ask that forces you to add something.

**Exercise 2:** Model a ride-hailing trip-events feed as wide-column and as relational tables. Choose the partition key and clustering key explicitly, state the exact read they make cheap, then name one reasonable question your chosen partition key makes expensive.

**Exercise 3:** Model a professional social network — people, employers, skills, connections — as relational tables and as a graph. Write the SQL for "people two connections away from Priya who list SQL as a skill", then the graph traversal, and note how each changes when the requirement becomes "up to four connections away".

**Exercise 4:** Deliberately reproduce the hot-partition mistake from Section 7: design a wide-column `orders` table partitioned by `order_date`, then describe the write distribution across ten machines during one business day. Re-partition it by `user_id` and state which query you have now made expensive.

**Exercise 5:** Take the wide-column vs column-store table from Section 6 and write, for each of these three queries, which of the two you would choose and why: "last 500 clicks for user 412", "average basket value across all orders in 2024", "every column of one specific order". Justify each in one sentence.

---

## 9. Interview Q&A

**Q: Why is a key-value store fast, given it does less than a relational database?**
It is fast *because* it does less. The value is opaque bytes, so there is no schema to check, no planner to run, no secondary index to maintain, and no way to query by anything but the exact key. That last constraint is what lets the system route a request by hashing the key — any node can work out which node owns it without coordination — so a lookup is one network hop and one hash-table or LSM read.

**Q: What is a partition key in a wide-column model, and why does it dominate the design?**
It is the value that decides which machine stores a group of rows, and it is also the only thing a read can efficiently name. Rows sharing a partition key sit together and are ordered by the clustering key, so a range read over them is sequential. Because a query that does not specify a partition key has to contact every node, you design the table starting from the query you need to serve rather than from the entity you are storing.

**Q: Is a wide-column store the same as a column-store?**
No, and the names actively mislead. A wide-column store keeps all of a row's columns together and simply allows the set of columns to vary from row to row; it is an operational, write-heavy, row-oriented model. A column-store physically stores each column as its own array across all rows, which makes scanning one or two columns over billions of rows and compressing them extremely efficient; it is an analytical model.

**Q: When is a graph model genuinely the right choice over joins?**
When the relationships are the data and the traversal depth is variable or unknown at design time — friend-of-friend recommendations, fraud rings, permission inheritance, dependency resolution. In SQL each additional hop is another self-join or a recursive CTE whose cost and termination you have to manage; in a graph engine an edge traversal is a pointer hop, so cost tracks the number of edges actually walked rather than table size.

**Q: If these models are so specialised, why do teams still start with relational?**
Because relational handles a wide range of access patterns adequately and only becomes the wrong answer under a specific pressure — a latency floor, a write rate one machine cannot absorb, or a traversal of unknown depth. Adopting a specialised model means giving up something real: ad-hoc queries, cross-entity transactions, or a single system to operate. The honest reason to switch is a measured access pattern the general model serves badly, not a preference for the newer name.
