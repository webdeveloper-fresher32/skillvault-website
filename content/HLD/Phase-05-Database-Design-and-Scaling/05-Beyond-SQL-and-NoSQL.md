# Beyond SQL vs NoSQL

Lesson 04 framed the database decision as a binary: SQL or NoSQL, ACID or eventual consistency, joins or documents. That framing gets you through the *first* database decision in an interview — but real systems rarely stop at one store. The moment an interviewer asks "how would you power search on this?" or "how would you store a year of sensor readings without the disk filling up?" or "how would you find mutual friends three hops out?", a generic SQL or NoSQL answer starts to sound thin. Strong candidates know there's a whole tier of specialized stores built for exactly one of those shapes of problem, and reach for the right one by name.

## The Shape Determines the Store

```
Relational / Document              Columnar               Time-Series            Graph                 Search Index
(Lessons 01-04)                    (Cassandra,            (InfluxDB,             (Neo4j)               (Elasticsearch)
                                    BigQuery, Redshift)    Prometheus TSDB)

Row-oriented:                      Column-oriented:       Row = one metric       Node + edge storage:  Inverted index:
read/write a                       read/write a            at one timestamp:     traversal is a        term → list of
whole row at once                  whole column at once     optimized for         pointer hop, not      documents
                                                             range scans over       a table scan
Great for: point                   Great for: aggregate     time + automatic       Great for: "friends   Great for: full-text
lookups, transactions               (SUM/AVG) over a        downsampling/          of friends of         search, typo
                                     handful of columns       retention              friends" queries      tolerance, facets
                                     across billions of                                                    Bad for: being the
                                     rows                    Bad for: being the     Bad for: aggregate     durable system of
Bad for: aggregating                                          system of record       reporting across      record — it's a
over one column                    Bad for: fetching a                              millions of nodes     read-optimized copy
across the whole table              single full row fast                                                   of data owned
                                                                                                             elsewhere
```

The pattern: each of these stores gave up general-purpose flexibility to get very good at one access pattern. Naming the access pattern first — "we're aggregating over few columns across a huge number of rows" — is what lets you name the right store second.

## Columnar Stores — Aggregate Fast Over Huge Row Counts

**When you'd actually reach for this:** you're running analytical queries — `SUM`, `AVG`, `COUNT` — over a handful of columns across billions of rows, and you don't care about fetching any single row quickly.

A row-oriented database stores `(user_id, country, plan, signup_date, last_login, ...)` together on disk, so reading one full row is cheap but computing `AVG(plan_price)` across 500 million users means reading every column of every row just to touch one of them. A columnar store like **Cassandra** (wide-column) or **BigQuery**/**Redshift** (OLAP warehouses) stores each column contiguously, so that same aggregate only touches the `plan_price` column — often compressed, since a column of similar values compresses far better than a mixed row.

```python
# Row store: to average plan_price, still reads every column of every row.
SELECT AVG(plan_price) FROM users;   -- on Postgres, scans full rows

# Columnar store: reads only the plan_price column, compressed and contiguous.
SELECT AVG(plan_price) FROM users;   -- on BigQuery, scans one column
```

**Example system:** a business intelligence dashboard computing daily revenue trends across a billing platform's entire history reaches for BigQuery or Redshift rather than running that aggregate against the production Postgres instance — which would lock rows and starve real transactional traffic.

## Time-Series Databases — Timestamped Metrics at Scale

**When you'd actually reach for this:** you're writing a continuous stream of timestamped measurements (CPU load, temperature, request latency) and your queries are almost always range-based ("last 24 hours," "last 5 minutes downsampled to 1-minute buckets"), with old data expiring automatically.

A time-series database like **InfluxDB** or **Prometheus's** own TSDB indexes data by time first, storing it in time-ordered chunks so a range query is a sequential scan rather than an index lookup across scattered rows. Built-in **retention policies** automatically drop or downsample data past a certain age — a metric doesn't need per-second precision after 30 days, so it gets rolled up into 1-hour averages and the raw points are discarded.

```
Prometheus scrapes /metrics every 15s:
  http_requests_total{status="200"} 84213  @ t=1000
  http_requests_total{status="200"} 84240  @ t=1015
  http_requests_total{status="200"} 84266  @ t=1030
  ...
Query: rate(http_requests_total[5m])   -- range query, not a point lookup
Retention: raw samples kept 15 days, then downsampled to 1h buckets
```

**Example system:** the metrics pipeline monitoring the fleet of stateless servers from Phases 03-04 — CPU, memory, request latency per instance — writes into Prometheus, not the application's main database, because a general-purpose SQL or NoSQL store has no native concept of retention or time-bucketed downsampling and would grow unbounded.

## Graph Databases — Traversing Relationships

**When you'd actually reach for this:** the core query is "find things connected to this thing, N hops away" — mutual friends, recommendation paths, fraud rings — and a relational join would need to chain across the same table multiple times, getting slower with every additional hop.

In SQL, "friends of my friends who aren't already my friends" against a `friendships(user_id, friend_id)` table means self-joining that table twice and filtering — each hop is a new join, and the query planner's cost grows fast as hops increase. A graph database like **Neo4j** stores relationships as first-class edges with direct pointers between nodes, so traversing a hop is a pointer dereference, not a table scan-and-join. Depth doesn't change the fundamental operation, just how many hops you walk.

```
SQL: friends-of-friends requires a self-join
SELECT DISTINCT f2.friend_id
FROM friendships f1
JOIN friendships f2 ON f1.friend_id = f2.user_id
WHERE f1.user_id = 42 AND f2.friend_id != 42;

Cypher (Neo4j): friends-of-friends is a graph pattern
MATCH (me:User {id: 42})-[:FOLLOWS]->()-[:FOLLOWS]->(fof)
RETURN DISTINCT fof;
```

**Example system:** Instagram or Twitter's "who follows whom" and "people you may know" features (touched on as case studies elsewhere in this course) are the textbook use case — the underlying data is a social graph, and a graph database would make multi-hop suggestion queries fast where a relational self-join chain would degrade badly as the network grows.

## Search-Index Stores — Full-Text Search, Not a System of Record

**When you'd actually reach for this:** users need to type free-text queries with typo tolerance, ranked relevance, and filters ("faceted search" — filter by price range *and* category *and* rating at once), and a database `LIKE '%term%'` query is both too slow and too dumb (no ranking, no typo tolerance, no stemming).

**Elasticsearch** builds an **inverted index** — for every term, a list of which documents contain it — so a search for "wireless mouse" is a fast lookup into the term index rather than a scan of every row's text column. Critically, Elasticsearch is usually **not the source of truth**: the primary database still owns the canonical record, and a copy of the searchable fields is indexed into Elasticsearch asynchronously, kept in sync but disposable — if the index is lost, it's rebuilt from the real data store.

```
Document store (source of truth):          Elasticsearch (read-optimized copy):
{id: 501, name: "Wireless Mouse",     -->   Inverted index:
 price: 24.99, category: "Electronics"}      "wireless" -> [501, 892, ...]
                                              "mouse"    -> [501, 733, ...]
                                             Query: "wireless mouse" AND category:Electronics
                                             -> ranked, typo-tolerant, faceted results
```

**Example system:** searching file names and content inside Google Drive, or product search on an e-commerce site, is search-index territory — the file metadata still lives in a primary database, but an Elasticsearch index sitting alongside it is what makes "misspelled search term returns the right file in under 100ms with instant category filters" possible.

## Decision Table

| Workload description | Reach for | Why |
|---|---|---|
| "Debit one account, credit another, both or neither" | SQL (Lesson 04) | ACID transactions, strong consistency |
| "Store chat messages / feed posts at huge write volume" | Document NoSQL (Lesson 04) | Flexible schema, horizontal write scale |
| "Average order value across 2 billion rows, last quarter" | Columnar (BigQuery, Redshift) | Column-oriented aggregation, not row lookups |
| "CPU/latency metrics every 15s, alert on last 5 minutes, discard after 30 days" | Time-series (Prometheus, InfluxDB) | Time-ordered storage, built-in retention/downsampling |
| "Who follows whom, friends-of-friends, shortest connection path" | Graph (Neo4j) | Relationships as first-class edges, not joins |
| "Search file names/content with typos and category filters" | Search index (Elasticsearch) | Inverted index, ranked relevance, faceted filtering — but not the system of record |

## Interview Q&A

**Q: If a candidate answers "we'd use NoSQL" for a full-text search feature, what's missing?**
A: NoSQL solves for flexible schema and write scale, not for ranked, typo-tolerant, faceted text search — that requires an inverted index like Elasticsearch. "NoSQL" alone doesn't tell an interviewer you understand *why* search needs a fundamentally different index structure than key-based or document lookups.

**Q: Why shouldn't Elasticsearch be treated as the primary database for a feature?**
A: Because it's built for read-optimized search, not durability guarantees or transactional writes, and it's typically populated asynchronously from a real system of record. If the index is corrupted or lost, the expectation is that it gets rebuilt from the source database — losing an Elasticsearch index should never mean losing data.

**Q: How would you design storage for a service tracking server CPU and memory metrics every 15 seconds across 10,000 machines?**
A: A time-series database like Prometheus or InfluxDB, not the main relational store — the write pattern is a continuous stream of timestamped values, queries are almost always time-range scans, and a retention/downsampling policy is needed so the raw data doesn't grow unbounded, none of which a general-purpose SQL or NoSQL store handles natively.

**Q: A social network needs "people you may know" based on friends-of-friends. Why is this a graph database problem rather than a SQL problem?**
A: Because the query is a multi-hop traversal, and each additional hop in SQL means another self-join on the same table, with cost growing quickly as hop count increases. A graph database like Neo4j stores relationships as direct edges, so walking a hop is a pointer dereference rather than a join, keeping multi-hop queries fast regardless of graph size.

**Q: Why is a columnar database a poor fit for an application's main transactional database?**
A: Because columnar stores are optimized for reading/aggregating a few columns across huge numbers of rows, not for fetching or updating one complete row at a time — the opposite of what a transactional workload (read a user, update their order, commit) needs. That's why columnar stores like BigQuery or Redshift sit alongside a transactional database as an analytics layer, not in place of it.
