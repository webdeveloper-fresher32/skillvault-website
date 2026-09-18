# A Database Selection Framework — Complete Guide

> "Nobody needs a seven-tonne lorry for the school run, but plenty of people buy one anyway because once a year they might have to move a sofa."

---

## Table of Contents

1. [The Problem: Picking a Database Before Knowing the Workload](#1-the-problem-picking-a-database-before-knowing-the-workload)
2. [The Vehicle Purchase Analogy](#2-the-vehicle-purchase-analogy)
3. [The Mechanism: Six Questions That Decide the Answer](#3-the-mechanism-six-questions-that-decide-the-answer)
4. [Diagram: The Selection Decision Path](#4-diagram-the-selection-decision-path)
5. [Code Walkthrough: Measuring the Workload Before Choosing](#5-code-walkthrough-measuring-the-workload-before-choosing)
6. [Comparing One Datastore to Polyglot Persistence](#6-comparing-one-datastore-to-polyglot-persistence)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Picking a Database Before Knowing the Workload

Database selection is usually argued as a preference — someone likes documents, someone else read a blog post about a write-heavy benchmark — and the decision gets made before anyone has written down what the system actually has to do.

### How the Choice Usually Gets Made

```text
"We should use a document store, schemas slow us down."
"Cassandra scales to petabytes."          ← we have 40 GB
"Postgres can't handle our write volume."  ← 30 writes/second
"Let's use Redis as the primary store."    ← durability never discussed
  ↳ Every one is an answer. None followed a question about this
    system's data, access patterns, or consistency needs.
```

### What's Missing

Any engine can be defended in the abstract and attacked in the abstract. What is missing is a fixed set of questions, asked in a fixed order, whose answers narrow the field before anyone's preference gets a vote — so the decision is reproducible by someone else and defensible six months later.

---

## 2. The Vehicle Purchase Analogy

Choosing a vehicle is not a debate about which vehicle is best. It is a short list of questions: what do you carry, how far, how often, where do you park it, and who is going to service it. A hatchback and a lorry are both correct answers to different sets of answers, and the expensive mistake is buying for the once-a-year sofa rather than the twice-a-day school run.

### Sizing the Vehicle to the Journey

```text
Buy for the rare case   → a lorry that costs more to fuel, park, insure
                          and licence, every single day, so that one
                          Saturday a year is slightly easier
Buy for the daily case  → a hatchback for the school run, and hire a
                          van for the day you move the sofa
```

### Mapping the Analogy to Database Selection

The daily journey is the access pattern that runs a thousand times a minute; the sofa is the analytics query someone runs once a quarter. Engines get chosen for the sofa constantly — "but what if we need to scale" — and the daily cost of that choice is paid in operations, hiring, and every feature that now needs a join the engine cannot do.

---

## 3. The Mechanism: Six Questions That Decide the Answer

The framework is six questions. Answer them with numbers and sentences, in writing, before naming a single product.

### The Six Questions

```text
1. What shape is the data?
   ↳ Related rows? Nested documents read whole? Key lookups? Edges?
2. What are the known access patterns?
   ↳ List the actual queries: "get order by id", "list a customer's
     orders newest first", "sum revenue by region by month".
3. What consistency does the domain genuinely require?
   ↳ Money movement and stock decrement: strong, transactional.
     A like counter or a view count: eventual is fine and cheaper.
4. What is the read/write ratio?
   ↳ 100:1 read-heavy invites caching and read replicas (Phase 11).
     1:1 or write-heavy makes every extra index a real cost (Phase 6).
5. What scale is real, not imagined?
   ↳ Rows today, growth per month, working set in GB, peak QPS.
6. What does the team already operate well?
   ↳ Backups tested, monitoring wired, someone who has debugged a bad
     query plan at 3am on this engine before.
Order management for a mid-size retailer, answered:
  orders/order_lines/customers/products, related — 12 queries, 4 of
  them joins — strong consistency on stock — 20:1 reads — 8M orders,
  +400k/month, 350 peak QPS — team has run PostgreSQL in production.
  ↳ Every answer points the same way. No decision is left to make.
```

### The Decision Table

| Workload signal | Model that fits | Typical engines |
|---|---|---|
| Related entities, joins, transactions across them | Relational | PostgreSQL, MySQL |
| Whole aggregate read and written as one unit, few cross-entity joins | Document | MongoDB |
| Key lookup only, latency-critical, tolerable to lose on restart | Key-value cache | Redis |
| Huge write volume, partition key known for every read, no joins | Wide-column | Cassandra |
| Relationships themselves are the query (depth, paths) | Graph | Neo4j |
| Scans over billions of rows, aggregate by column | Columnar / OLAP | ClickHouse, warehouses |

---

## 4. Diagram: The Selection Decision Path

### From Answers to a Shortlist

```text
Six answers written down?
   │  No → stop. Nothing below this line is decidable.
   ▼ Yes
Multi-entity transactions, or joins the app cannot cheaply fake?
   │
   ├── Yes ──────────────────────► Relational (the default)
   │
   └── No ──► Every read served by one known key?
                │
                ├── Yes ────────► Key-value or wide-column
                │
                └── No ──► Scan-and-aggregate over columns?
                             │
                             ├── Yes ──► Columnar / OLAP
                             └── No ───► Document store
                                             │
   Then, for whichever branch you landed on:  ▼
   Does the team already operate this engine?
   ├─ Yes → decided
   └─ No  → buy it managed, or pick the one they do operate
```

### Reading the Diagram

Every branch is a question about the workload except the last one, which is a question about the team — and it is deliberately last and deliberately binding. An engine nobody can debug under pressure is a worse choice than a slightly less ideal engine that someone has already restored from backup once (Phase 9).

---

## 5. Code Walkthrough: Measuring the Workload Before Choosing

Question 5 — real scale — is the one most often answered with a feeling. It is arithmetic, and the inputs are already in the current system.

### Counting the Writes You Actually Have

```sql
-- Writes per day, from the table that receives the most of them.
SELECT date_trunc('day', created_at) AS day, count(*) AS rows_written
FROM orders
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
-- 400,000 rows/month ≈ 13,300/day ≈ 0.15 writes/second average,
-- and roughly 1.5/second at a 10x daily peak.
```

### Turning Row Counts into Bytes

```text
8,000,000 orders x ~400 bytes/row      ≈  3.2 GB
32,000,000 order_lines x ~120 bytes    ≈  3.8 GB
indexes, roughly 40% of table size     ≈  2.8 GB
total working set                      ≈  9.8 GB
  ↳ This fits in RAM on a modest single instance. Every argument for
    sharding this dataset is about an imagined dataset, not this one.
```

### Listing the Access Patterns Before the Schema

```text
P1  get order by id                          ~2,000/min
P2  list customer's orders, newest first       ~600/min
P3  order + its lines + product names           ~800/min   (join)
P4  revenue by region by month                     ~2/day  (scan)
P5  search orders by customer email             ~40/min
  ↳ P3 is a three-table join on the hot path. In a document store it
    becomes an application-side fan-out, or a denormalized copy that
    must be kept in sync on every product rename.
```

---

## 6. Comparing One Datastore to Polyglot Persistence

Polyglot persistence — using several datastores, each suited to part of the workload — is correct in principle and routinely underpriced in practice, because the cost is not the query performance, it is everything around it.

### One Store vs Several

| | Single relational store | Polyglot (relational + document + search + cache) |
|---|---|---|
| Query fit | Good for most patterns, poor for a few | Excellent per pattern |
| Backup and restore | One procedure, one restore test | Four procedures, four restore tests, four RPO/RTO targets |
| Monitoring | One dashboard, one alert set | Four, each with different failure signatures |
| Upgrades and CVEs | One upgrade cycle | Four, on four vendors' schedules |
| Consistency between stores | Not applicable | Your problem: dual writes, drift, reconciliation jobs |
| Hiring and on-call | One skill set | Four, or one person who is a single point of failure |

### Managed vs Self-Hosted

| | Managed service | Self-hosted |
|---|---|---|
| Cost | Commonly 2–3x the raw compute price for the same instance size | Instance price plus the salaried hours nobody counts |
| Control | Restricted superuser, limited extensions, vendor's version cadence | Full control of config, extensions, kernel, upgrade timing |
| Failover, backups, patching | Automated by the vendor, on the vendor's maintenance windows | Yours to build, yours to actually test (Phase 9), on your own timing |

### Takeaway

Every additional datastore is another thing to back up, monitor, secure, upgrade, and hire for, and that cost is paid every month whether or not the query advantage is being used. The honest default is to start relational and add a second store only when a named access pattern is demonstrably badly served by the first — and to buy managed unless there is a specific control requirement, because the price difference is usually smaller than the cost of the engineer-days it replaces.

---

## 7. Common Mistakes

- **Choosing for the scale you hope to have rather than the scale you have.** A single well-indexed instance with a warm cache handles workloads far larger than most teams assume — tens of thousands of reads per second and datasets that fit in RAM. Designing for a hundred times that means paying the distributed-systems tax (Phase 10) from day one for a benefit that may never arrive, and arriving there with a schema shaped by a guess.
- **Treating "we might need flexibility" as an access pattern.** Schema flexibility is a real property, but it is not a query. If nobody can name the pattern that a rigid schema blocks, the flexibility argument is a preference, and it trades away constraints and joins that would have caught bugs.
- **Adding a datastore instead of an index.** A large share of "the database is too slow, we need something faster" turns out to be a missing composite index or an N+1 query (Phases 6 and 11). Measure the actual plan before the actual migration.
- **Ignoring the team question because it feels unrigorous.** Operational familiarity is not a soft factor. It determines how fast an incident ends, whether backups have ever been restored, and whether the first production surprise is diagnosed or guessed at.

---

## 8. Hands-On Exercises

**Exercise 1:** Take a system you have worked on and write down all six answers from Section 3 in full sentences and numbers — no product names allowed anywhere in the document. Then, and only then, write the engine you would pick and check whether the six answers actually imply it.

**Exercise 2:** For the same system, list every access pattern the way P1–P5 are listed in Section 5, with an estimated frequency for each. Mark which ones cross more than one entity.

**Exercise 3:** Run the row-count and byte arithmetic from Section 5 against a real table: count the rows, estimate average row width, add 40% for indexes, and state whether the working set fits in the RAM of a single mid-size instance.

**Exercise 4:** Take the polyglot table in Section 6 and cost out a specific second datastore for your system — write the backup procedure, the three alerts you would add, the upgrade owner, and who is on call for it. Decide again afterwards.

**Exercise 5:** Deliberately reproduce the third mistake in Section 7. Find a query someone has called "too slow for this database", read its plan (Phase 7), add the composite index it needs, and re-measure. Record the before and after timings and compare that effort against a migration to a different engine.

---

## 9. Interview Q&A

**Q: How do you choose a database for a new service?**
I start with six questions before naming any product: what shape the data is, what the known access patterns are, what consistency the domain genuinely requires, the read/write ratio, the real current scale with a growth number attached, and what the team already operates well. Those answers usually collapse the choice to one or two candidates without any argument about engines. If I cannot answer them yet, that is the finding — the decision is not ready to be made.

**Q: Why do you default to a relational database?**
Because relational engines handle the widest range of access patterns acceptably, including patterns nobody has thought of yet, and because constraints, joins and transactions catch a class of bug that otherwise becomes application code. Most systems' data really is relational in shape, and most scale arguments against relational databases are made at a scale a single well-indexed instance handles comfortably. I move off the default when a named access pattern is demonstrably badly served — not as an opening position.

**Q: What is polyglot persistence and what does it actually cost?**
It is using more than one datastore, each fitted to part of the workload — say relational for transactions plus a search index plus a cache. The query fit is genuinely better, but every store added is another backup and restore procedure, another monitoring surface, another upgrade and CVE cycle, another skill on the on-call rota, and a new consistency problem between stores that is now yours to solve. I would add one when a specific pattern justifies it and the team can name who operates it.

**Q: When would you pick managed over self-hosted?**
Almost always, unless there is a concrete control requirement — an extension the vendor does not offer, a data residency constraint, or an upgrade cadence that has to be ours. Managed typically costs a multiple of the raw compute price, but it buys automated failover, backups that exist by default, and patching that would otherwise be somebody's week. Self-hosting is cheaper on the invoice and frequently more expensive in salaried hours, and those hours only get counted after the first unplanned failover.

**Q: A colleague says you need a distributed database because the service will grow. How do you respond?**
I ask for the numbers: rows today, growth per month, working set size, and peak queries per second, then compare that against what one instance with a warm cache actually does. If the working set is tens of gigabytes and peak load is in the hundreds of queries per second, a single node with proper indexing handles it, and going distributed early buys partition-aware modelling, weaker consistency and a much harder operational story for no present benefit. If the numbers really do exceed a single node, I would still start with read replicas and caching before partitioning, because those are reversible.
