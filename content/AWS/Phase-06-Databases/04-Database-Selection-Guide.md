# Database Selection Guide — The Right Database for Every Scenario

## Table of Contents
1. [Master Decision Flowchart](#master-decision-flowchart)
2. [Service Summaries](#service-summaries)
3. [When to Use Each Database](#when-to-use-each-database)
4. [Real-World Scenarios](#real-world-scenarios)
5. [Cost Comparison](#cost-comparison)
6. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Master Decision Flowchart

```
START: What is your primary data access need?
                        |
          +-------------+--------------+
          |                            |
   RELATIONAL / SQL              NOSQL needed
   (structured data,             (flexible schema,
    complex queries)              massive scale)
          |                            |
          |                    +-------+-------+
          |                    |               |
          |              Key-Value or      Documents?
          |              simple lookup?     JSON?
          |                    |               |
          |                    |            DocumentDB
          |                    |            (MongoDB)
          ↓                    ↓
    Need OLTP or OLAP?    Need extreme         |
          |               performance?         |
    +-----+------+             |               |
    |            |            YES → DynamoDB   |
  OLTP         OLAP           NO  → RDS        |
  (fast small  (big analytics      (if schema  |
   transactions) queries)           needed)   |
    |            |
    ↓            ↓
   RDS         Redshift

ADDITIONAL NEEDS:
  Caching (sub-ms reads) → ElastiCache (Redis/Memcached)
  Full-text search → OpenSearch
  Graph relationships → Neptune
  Time-series data → Timestream
  Ledger (immutable) → QLDB
```

---

## Service Summaries

### Quick Reference Card

```
+------------------+--------------------------------------------------+
| Service          | One-Line Description                             |
+------------------+--------------------------------------------------+
| Amazon RDS       | Managed relational DB (MySQL, PgSQL, etc.)       |
| Amazon Aurora    | High-performance MySQL/PgSQL-compatible DB       |
| DynamoDB         | Serverless NoSQL key-value + document DB         |
| ElastiCache      | In-memory cache (Redis / Memcached)              |
| Redshift         | Petabyte-scale data warehouse (OLAP)             |
| DocumentDB       | MongoDB-compatible document database             |
| Neptune          | Graph database (relationships)                  |
| Keyspaces        | Cassandra-compatible wide-column store           |
| Timestream       | Serverless time-series database                 |
| QLDB             | Immutable ledger database                       |
| OpenSearch       | Search and analytics engine                      |
+------------------+--------------------------------------------------+
```

---

## When to Use Each Database

### Amazon RDS (Relational Database Service)

```
USE RDS WHEN:
+------------------------------------------+
| ✓ Data is structured and relational      |
| ✓ Need ACID transactions                 |
| ✓ Complex SQL queries (JOINs, GROUP BY)  |
| ✓ Existing application uses SQL          |
| ✓ Online transaction processing (OLTP)   |
| ✓ Financial data, inventory, user data   |
| ✓ Need to do ad-hoc queries             |
| ✓ Schema is relatively stable           |
+------------------------------------------+

DO NOT USE RDS WHEN:
+------------------------------------------+
| ✗ Need massive scale (millions req/sec)  |
| ✗ Flexible/changing schema              |
| ✗ Need global active-active write        |
| ✗ Need to store large blobs/media        |
| ✗ Doing analytics on terabytes           |
+------------------------------------------+

SUPPORTED ENGINES:
  MySQL, PostgreSQL, MariaDB (open source, no license fee)
  Oracle, SQL Server (license required)
  Aurora MySQL, Aurora PostgreSQL (AWS-native, fastest)
  
BEST FOR:
  E-commerce (orders, products, inventory)
  Banking/financial systems
  Healthcare records (HIPAA-compliant)
  SaaS applications
  ERP systems
```

### Amazon Aurora

```
USE AURORA WHEN:
+------------------------------------------+
| ✓ All RDS use cases PLUS...              |
| ✓ Need up to 5× faster than MySQL        |
| ✓ Need up to 15 read replicas            |
| ✓ Need global database (multi-region)    |
| ✓ Need faster automatic failover         |
| ✓ Need Serverless (Aurora Serverless v2) |
| ✓ Willing to pay ~20% more than RDS      |
+------------------------------------------+

AURORA vs RDS:
  Same: SQL, ACID transactions, managed service
  Better in Aurora: Performance, scale, availability, serverless
  Worse in Aurora: Cost, limited to MySQL/PostgreSQL engines
  
AURORA SERVERLESS v2 WHEN:
  Variable or unpredictable traffic
  New applications (unknown scale)
  Dev/test environments
  Apps with hours of inactivity
```

### Amazon DynamoDB

```
USE DYNAMODB WHEN:
+------------------------------------------+
| ✓ Need millisecond latency at ANY scale  |
| ✓ Need truly serverless database         |
| ✓ Workload can grow to millions req/sec  |
| ✓ Access patterns are known and fixed    |
| ✓ Schema is flexible / varies per item   |
| ✓ Global active-active needed            |
| ✓ Cost-effective at massive scale        |
| ✓ IoT, gaming, mobile, session data      |
+------------------------------------------+

DO NOT USE DYNAMODB WHEN:
+------------------------------------------+
| ✗ Need complex SQL queries (JOINs)        |
| ✗ Access patterns are unknown/ad-hoc     |
| ✗ Need OLAP / business intelligence       |
| ✗ Need to do aggregations (SUM, AVG)      |
| ✗ Small datasets (RDS is simpler)         |
| ✗ Team unfamiliar with NoSQL modeling     |
+------------------------------------------+

BEST FOR:
  Shopping carts and user sessions
  Leaderboards and gaming state
  IoT device state and telemetry
  Product catalogs with varying attributes
  Real-time bidding
  Social media activity feeds
  Serverless application backends
```

### Amazon ElastiCache

```
USE ELASTICACHE WHEN:
+------------------------------------------+
| ✓ Need sub-millisecond read latency      |
| ✓ Same data read many times (hot data)   |
| ✓ Want to reduce database load           |
| ✓ Session management (web apps)          |
| ✓ Real-time leaderboards (Redis)         |
| ✓ Rate limiting (Redis counters)         |
| ✓ Pub/Sub messaging (Redis)              |
| ✓ Temporary data with TTL                |
+------------------------------------------+

ELASTICACHE IS NOT:
  A primary database (not persistent by default)
  A replacement for your database
  A solution for complex queries
  
REDIS vs MEMCACHED:
  Redis:      HA, persistence, rich data types, pub/sub
  Memcached:  Simple, multi-threaded, pure cache
  Default:    Choose Redis (more features, same price)
```

### Amazon Redshift

```
USE REDSHIFT WHEN:
+------------------------------------------+
| ✓ OLAP (Online Analytical Processing)    |
| ✓ Business intelligence / reporting      |
| ✓ Queries scan terabytes of data         |
| ✓ Complex analytics (GROUP BY, WINDOW)   |
| ✓ Data warehouse use case                |
| ✓ Combine data from multiple sources     |
| ✓ Historical trend analysis              |
+------------------------------------------+

DO NOT USE REDSHIFT WHEN:
+------------------------------------------+
| ✗ Operational/transactional queries      |
| ✗ Need to update individual rows often   |
| ✗ Small data (< 100 GB)                  |
| ✗ Need millisecond response for OLTP     |
+------------------------------------------+

KEY FEATURES:
  Columnar storage (excellent for analytics)
  Massively parallel query execution
  Up to petabytes of data
  Redshift Spectrum: Query data in S3 directly
  Serverless option available

COMPARISON:
  RDS OLTP: "Get order #123 for user 456" (fast, specific)
  Redshift OLAP: "What were total sales by region last quarter?" (big scan)
```

---

## Real-World Scenarios

### Scenario 1: E-Commerce Platform

```
REQUIREMENTS:
  - Product catalog (varying attributes per product)
  - Order management (transactional, relational)
  - Shopping cart (user-specific, fast access)
  - Session management (thousands of concurrent users)
  - Product search (full-text search)
  - Sales analytics (reports, dashboards)
  - User reviews (semi-structured)

RECOMMENDED ARCHITECTURE:
+-------------------+     Component     +-------------------+
|                   |                   |                   |
| Product Catalog   | → DynamoDB        | Flexible schema  |
|                   |   (NoSQL)         | High read volume  |
+-------------------+                   +-------------------+
|                   |                   |                   |
| Orders /          | → RDS Aurora      | ACID transactions |
| Inventory         |   (MySQL)         | Relational data   |
+-------------------+                   +-------------------+
|                   |                   |                   |
| Shopping Cart     | → DynamoDB        | Fast, serverless  |
| Sessions          |   or ElastiCache  | TTL-based expiry  |
+-------------------+                   +-------------------+
|                   |                   |                   |
| Product Search    | → OpenSearch      | Full-text search  |
|                   |                   | Faceted search    |
+-------------------+                   +-------------------+
|                   |                   |                   |
| Sales Reports     | → Redshift        | OLAP queries      |
| Analytics         |                   | Data warehouse    |
+-------------------+                   +-------------------+
|                   |                   |                   |
| DB Query Cache    | → ElastiCache     | Reduce DB load    |
|                   |   Redis           | Hot product data  |
+-------------------+                   +-------------------+
```

### Scenario 2: Real-Time Gaming Application

```
REQUIREMENTS:
  - Game state (per player)
  - Leaderboards (real-time, global)
  - Session tokens (expire after inactivity)
  - Player profiles (varying attributes)
  - Match history (append-only, historical)
  - Anti-cheat analytics

RECOMMENDED ARCHITECTURE:
  Game State      → DynamoDB (fast reads/writes, flexible)
  Leaderboards    → ElastiCache Redis (sorted sets, microseconds)
  Sessions/Tokens → ElastiCache Redis (TTL-based expiry)
  Player Profiles → DynamoDB (schema-flexible)
  Match History   → DynamoDB (append-only, time-series GSI)
  Anti-cheat      → Redshift (batch analytics on S3 data)
```

### Scenario 3: Financial Services Platform

```
REQUIREMENTS:
  - Account management (strict ACID)
  - Transaction processing (double-entry accounting)
  - Regulatory reporting (7-year retention, audit trail)
  - Fraud detection (real-time scoring)
  - Customer 360 view (data aggregation)
  - Market data (time-series, milliseconds)

RECOMMENDED ARCHITECTURE:
  Core Banking     → RDS Aurora PostgreSQL (ACID, complex SQL)
  Audit Trail      → QLDB (immutable, cryptographically verifiable)
  Fraud Signals    → ElastiCache Redis (real-time counters, rates)
  Reports          → Redshift (regulatory, compliance, BI)
  Market Data      → Timestream (time-series, native SQL)
  Customer 360     → Redshift (aggregate from multiple sources)
```

### Scenario 4: IoT Platform

```
REQUIREMENTS:
  - Device registry (device metadata)
  - Device state (current readings)
  - Sensor telemetry (time-series, high volume)
  - Alerts (trigger on thresholds)
  - Historical analysis (trending, ML)

RECOMMENDED ARCHITECTURE:
  Device Registry  → DynamoDB (fast lookup by device ID)
  Device State     → DynamoDB (current state, fast updates)
  Telemetry        → Timestream (time-series optimized)
  Alert State      → ElastiCache Redis (fast threshold checks)
  Historical ML    → S3 + Redshift or SageMaker
```

### Scenario 5: Social Network

```
REQUIREMENTS:
  - User profiles
  - Posts and comments
  - Social graph (who follows whom)
  - News feed (aggregated from connections)
  - Search (users, hashtags, posts)
  - Trending topics (real-time)

RECOMMENDED ARCHITECTURE:
  User Profiles   → DynamoDB (flexible, high scale)
  Posts/Comments  → DynamoDB (single-table design)
  Social Graph    → Neptune (graph database, relationship queries)
  News Feed       → DynamoDB + ElastiCache (precomputed, cached)
  Search          → OpenSearch (full-text, hashtags)
  Trending        → ElastiCache Redis (sorted sets, sliding window)
```

---

## Cost Comparison

```
+------------------+------------------+---------------------------+
| Service          | Pricing Model    | Approximate Monthly Cost  |
|                  |                  | (small production)        |
+------------------+------------------+---------------------------+
| RDS MySQL        | Per instance     | $50-200 (db.t3.medium)    |
| (db.t3.medium)   | + storage        |                           |
+------------------+------------------+---------------------------+
| Aurora MySQL     | Per instance     | $70-300 (db.t3.medium)    |
| (db.t3.medium)   | + storage        | ~20% more than RDS        |
+------------------+------------------+---------------------------+
| DynamoDB         | Per request +    | $0 idle + usage           |
| On-Demand        | storage          | Very cost-effective       |
+------------------+------------------+---------------------------+
| DynamoDB         | Per capacity     | $30-100 (small tables)    |
| Provisioned      | unit/hr          |                           |
+------------------+------------------+---------------------------+
| ElastiCache      | Per node/hr      | $30-150 (cache.t3.medium) |
| Redis            |                  |                           |
+------------------+------------------+---------------------------+
| Redshift         | Per node/hr      | $180+ (dc2.large)         |
|                  | + storage        |                           |
+------------------+------------------+---------------------------+
| Aurora           | Per ACU/second   | Near $0 at zero scale     |
| Serverless v2    | (scale-to-zero   | ~$100/mo moderate use     |
|                  | not available)   |                           |
+------------------+------------------+---------------------------+

Note: Actual costs vary by region. Check AWS Pricing Calculator.
Cheapest: DynamoDB on-demand for small/variable workloads
Most expensive: Redshift (but justified for petabyte analytics)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using RDS for Everything

```
PROBLEM:
  Team uses RDS for session storage
  Sessions table: 10 million rows, 10,000 reads/second
  Database CPU at 95%, slow queries everywhere

CAUSE:
  Sessions are not relational data
  Sessions have simple key-value access patterns
  Sessions expire (TTL)
  All of these are perfect for ElastiCache Redis

SOLUTION:
  Move sessions to ElastiCache Redis
  RDS back to normal: relational business data only
```

### Anti-Pattern 2: Using DynamoDB for Analytics

```
PROBLEM:
  Team stores all sales data in DynamoDB
  CFO wants: "Show sales by region for last quarter"
  Developer writes Scan with FilterExpression
  Scan reads 100 GB of data, takes minutes, costs hundreds of dollars

CAUSE:
  DynamoDB is optimized for transactional access by key
  Analytics requires scanning large datasets (OLAP)

SOLUTION:
  Use DynamoDB Streams to replicate data to Redshift
  Or: Export DynamoDB to S3, query with Athena
  Or: Store transaction data in DynamoDB, analytics data in Redshift
```

### Anti-Pattern 3: Using ElastiCache as Primary Database

```
PROBLEM:
  Team stores all user data in Redis only
  Redis restarts → all user data lost
  (NoEviction policy → errors when cache full)

CAUSE:
  Redis is a cache/cache-plus, not a primary database
  In-memory data can be lost

SOLUTION:
  Use RDS or DynamoDB as primary source of truth
  ElastiCache as caching layer in front of primary database
  Redis persistence (AOF) if data must survive restarts
```

### Anti-Pattern 4: Scanning DynamoDB

```
PROBLEM:
  Application does: Scan(FilterExpression="status = ACTIVE")
  Table has 10 million items
  Only 10,000 have status=ACTIVE
  Scan reads and charges for all 10 million items → expensive and slow

CAUSE:
  FilterExpression is applied AFTER reading all items (not as a filter on index)

SOLUTION:
  Add a GSI with status as partition key
  Query(GSI PK="ACTIVE") → reads only ACTIVE items
  99% cost reduction, much faster
```

### Anti-Pattern 5: Wrong Partition Key

```
PROBLEM:
  Table: UserActivity
  Partition Key: date (e.g., "2024-01-15")
  All activity today → same partition → HOT PARTITION
  DynamoDB throttles → ProvisionedThroughputExceededException

CAUSE:
  Low cardinality partition key
  Traffic concentrated on today's partition

SOLUTION:
  Add random suffix: partition_key = date + "#" + random(1-10)
  Or: Use user_id as partition key (high cardinality)
  Or: Use write sharding with GSI
```

---

## Common Exam Scenarios and Answers

| Scenario | Best Choice | Key Reason |
|----------|-------------|------------|
| Online banking transactions | RDS Aurora | ACID, complex SQL, strong consistency |
| Shopping cart for 1M users | DynamoDB | Serverless, scales, key-value access |
| Product search with filters | OpenSearch | Full-text search capability |
| Q4 sales report by region | Redshift | OLAP, scanning large datasets |
| User session storage | ElastiCache Redis | Sub-ms reads, TTL, in-memory |
| Real-time game leaderboard | ElastiCache Redis | Sorted sets, microsecond latency |
| Social network connections | Neptune | Graph queries, relationship traversal |
| IoT sensor telemetry | Timestream | Time-series optimized, retention policies |
| Financial audit trail | QLDB | Immutable, cryptographic verification |
| Reduce RDS read load | ElastiCache Redis | Cache hot queries, sub-ms reads |
| Variable traffic database | Aurora Serverless v2 | Auto-scale compute, cost-effective |
| Multi-region active-active | DynamoDB Global Tables | Built-in multi-region writes |
| Migration from MongoDB | DocumentDB | MongoDB-compatible API |
| Migration from Cassandra | Keyspaces | Cassandra-compatible API |
