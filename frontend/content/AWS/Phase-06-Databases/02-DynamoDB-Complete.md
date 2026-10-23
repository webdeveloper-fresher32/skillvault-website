# DynamoDB — The Definitive Guide

## Table of Contents
1. [What is DynamoDB](#what-is-dynamodb)
2. [DynamoDB Data Model](#dynamodb-data-model)
3. [Primary Keys](#primary-keys)
4. [Indexes](#indexes)
5. [Read/Write Capacity](#readwrite-capacity)
6. [DynamoDB Operations](#dynamodb-operations)
7. [Access Patterns and Design](#access-patterns-and-design)
8. [Single-Table Design](#single-table-design)
9. [DynamoDB Streams](#dynamodb-streams)
10. [Global Tables](#global-tables)
11. [DAX (DynamoDB Accelerator)](#dax-dynamodb-accelerator)
12. [DynamoDB Best Practices](#dynamodb-best-practices)
13. [Interview Q&A](#interview-qa)

---

## What is DynamoDB

Amazon DynamoDB is a fully managed, serverless, **NoSQL** key-value and document database.

```
+------------------------------------------+
|            DYNAMODB IN ONE BOX           |
+------------------------------------------+
| Type:       NoSQL (Key-Value + Document) |
| Latency:    Single-digit milliseconds    |
|             (consistent at any scale)    |
| Scale:      Unlimited (auto-scales)      |
| Managed:    100% (no servers to manage) |
| HA:         Multi-AZ by default          |
| Durability: 11 nines (like S3)          |
| Encryption: Enabled by default          |
+------------------------------------------+
```

**What makes DynamoDB different:**

```
RELATIONAL DB (RDS):
  - Predefined schema (tables, columns, types)
  - SQL queries (flexible but can be slow at scale)
  - Scale: Vertical (bigger machine) or Read Replicas
  - Joins, transactions across tables
  - Best for: structured relational data, complex queries

DYNAMODB:
  - Flexible schema (only PK is fixed)
  - API-based access (GetItem, Query, Scan)
  - Scale: Horizontal (auto-shards infinitely)
  - No joins (denormalize your data)
  - Best for: high-scale, predictable access patterns
```

**DynamoDB is NOT a replacement for RDS.** Use DynamoDB when:
- You have predictable access patterns
- You need massive scale (millions of requests/second)
- You need consistent single-digit ms latency at any scale
- You want serverless, zero-ops database

Do NOT use DynamoDB when:
- You need complex SQL queries (JOINs, GROUP BY, aggregations)
- You have unpredictable, ad-hoc query patterns
- You're doing OLAP/reporting (use Redshift)

---

## DynamoDB Data Model

```
DYNAMODB HIERARCHY:

Account → Region → Tables → Items → Attributes

TABLE:
  └── Items (like rows in SQL, but flexible schema)
          └── Attributes (like columns, but flexible)
```

### Tables, Items, Attributes

```
TABLE: Users
+------------------+------------------+------------------+------------------+
| PK: UserId       | Name             | Email            | Age              |
| (Partition Key)  | (String attr)    | (String attr)    | (Number attr)    |
+------------------+------------------+------------------+------------------+
| USER#001         | "Alice Smith"    | "alice@ex.com"   | 30               |
| USER#002         | "Bob Jones"      | "bob@ex.com"     | (not present!)   |
| USER#003         | "Carol Brown"    | "carol@ex.com"   | 25               |
+------------------+------------------+------------------+------------------+

Key points:
  - UserId (PK) must be in EVERY item
  - Other attributes are OPTIONAL (Bob has no Age)
  - Different items can have DIFFERENT attributes
  - No schema enforcement (except PK)
```

**Attribute Types:**

```
Scalars:
  String (S):   "hello", "2024-01-15"
  Number (N):   42, 3.14, -100
  Binary (B):   Base64-encoded binary data
  Boolean (BOOL): true, false
  Null (NULL):   null

Collections:
  String Set (SS):  ["red", "green", "blue"]
  Number Set (NS):  [1, 2, 3]
  Binary Set (BS):  [b"...", b"..."]
  List (L):         ["string", 42, true, null]  (ordered, mixed types)
  Map (M):          {"key": "value", "nested": {"a": 1}}  (document)
```

**Item size limit:** Maximum **400 KB** per item (sum of all attribute names + values)

---

## Primary Keys

The primary key uniquely identifies each item. It determines which physical partition (shard) stores the item.

### Option 1: Simple Primary Key (Partition Key Only)

```
TABLE: Sessions
+----------------------------+------------------+------------------+
| PK: SessionId              | UserId           | ExpiresAt        |
| (Partition Key)            |                  |                  |
+----------------------------+------------------+------------------+
| "sess_abc123"              | "USER#001"       | 1705314000       |
| "sess_def456"              | "USER#002"       | 1705317600       |
+----------------------------+------------------+------------------+

Access: GetItem(PK = "sess_abc123") → instant
```

Use when: Every item has a unique natural key, and you only ever need to access items by that key.

### Option 2: Composite Primary Key (Partition Key + Sort Key)

```
TABLE: Orders
+------------------+------------------+------------------+------------------+
| PK: UserId       | SK: OrderId      | Amount           | Status           |
| (Partition Key)  | (Sort Key)       |                  |                  |
+------------------+------------------+------------------+------------------+
| "USER#001"       | "ORDER#2024-001" | 150.00           | "DELIVERED"      |
| "USER#001"       | "ORDER#2024-002" | 87.50            | "SHIPPED"        |
| "USER#001"       | "ORDER#2024-003" | 200.00           | "PENDING"        |
| "USER#002"       | "ORDER#2024-010" | 45.00            | "DELIVERED"      |
+------------------+------------------+------------------+------------------+

Access patterns:
  GetItem(PK="USER#001", SK="ORDER#2024-001") → single item
  Query(PK="USER#001") → all orders for USER#001
  Query(PK="USER#001", SK begins_with "ORDER#2024-002") → filter
```

**Rules for composite primary key:**
- PK + SK combination must be unique
- Multiple items can have the same PK (but different SK)
- Items with the same PK are stored together on the same partition
- SK supports range queries: =, <, <=, >, >=, BETWEEN, begins_with

### How Partition Key Determines Storage

```
PARTITION KEY → Hash Function → Partition Number → Physical Node

"USER#001" → hash(USER#001) = 7 → Partition 7 → Node A
"USER#002" → hash(USER#002) = 3 → Partition 3 → Node B
"USER#003" → hash(USER#003) = 7 → Partition 7 → Node A  (same node as USER#001)

Items with same PK: stored on same partition
Items with different PK: likely stored on different partitions
```

### Designing Good Partition Keys

**The Goal:** Distribute data and traffic evenly across partitions. Avoid "hot partitions."

```
BAD PARTITION KEY EXAMPLES:

1. date = "2024-01-15"
   All items for today go to ONE partition
   Millions of writes to one partition → HOT PARTITION
   
2. status = "ACTIVE"
   Most items have ACTIVE status
   Almost all queries hit one partition

3. country = "US"
   Most users are in the US
   US partition overwhelmed

GOOD PARTITION KEY EXAMPLES:

1. user_id (UUID or KSUID)
   Each user gets their own partition key
   Traffic distributed across users

2. device_id
   Millions of IoT devices → millions of PKs
   Even distribution

3. order_id (auto-generated UUID)
   Each order has unique ID
   Random distribution
```

**Hot partition detection:**
- CloudWatch: `ConsumedReadCapacityUnits` and `ConsumedWriteCapacityUnits` per partition
- DynamoDB Contributor Insights: shows which keys are most accessed

---

## Indexes

DynamoDB has two types of secondary indexes for alternate access patterns.

### Local Secondary Index (LSI)

```
DEFINITION:
  Same Partition Key as base table
  DIFFERENT Sort Key
  Must be defined at TABLE CREATION (cannot add later)
  
TABLE: UserActivity
Base Table:     PK=UserId, SK=Timestamp
LSI:            PK=UserId, SK=ActivityType
                (alternate way to query user's activities by type)

+------------------+------------------+--------------------+------------------+
| PK: UserId       | SK: Timestamp    | LSI SK: ActType    | Description      |
+------------------+------------------+--------------------+------------------+
| "USER#001"       | "2024-01-15T09:00"| "LOGIN"           | "Mobile login"   |
| "USER#001"       | "2024-01-15T09:05"| "PURCHASE"        | "Bought product" |
| "USER#001"       | "2024-01-15T09:10"| "VIEW"            | "Viewed item"    |
+------------------+------------------+--------------------+------------------+

Query via base table: "All activity for USER#001 ordered by time"
Query via LSI:        "All PURCHASE activities for USER#001"
```

**LSI Rules:**
- Max 5 LSIs per table
- Same PK as base table (same partition)
- Strong or eventual consistency on reads
- Consumes table's RCU/WCU (no separate capacity)
- MUST be created at table creation — cannot add to existing table

### Global Secondary Index (GSI)

```
DEFINITION:
  DIFFERENT Partition Key (and optional different Sort Key)
  Can be added to EXISTING tables
  Different capacity allocation
  
TABLE: Orders
Base Table:  PK=UserId, SK=OrderId
GSI:         PK=Status, SK=OrderDate
             (allows querying "all PENDING orders by date")

+------------------+------------------+-------------------+------------------+
| PK: UserId       | SK: OrderId      | GSI PK: Status    | GSI SK: OrderDate|
+------------------+------------------+-------------------+------------------+
| "USER#001"       | "ORDER#001"      | "PENDING"         | "2024-01-15"     |
| "USER#001"       | "ORDER#002"      | "SHIPPED"         | "2024-01-14"     |
| "USER#002"       | "ORDER#003"      | "PENDING"         | "2024-01-15"     |
+------------------+------------------+-------------------+------------------+

GSI (Status, OrderDate):
  "PENDING" | "2024-01-15" → ORDER#001
  "PENDING" | "2024-01-15" → ORDER#003

Query via GSI: "All PENDING orders from 2024-01-15"
Query via base: "All orders for USER#001"
```

**GSI Rules:**
- Max 20 GSIs per table (default)
- Can be added at any time (even after table exists)
- Have their own RCU/WCU allocation (or inherit if on-demand)
- Eventual consistency only (no strong consistency from GSI)
- Partition key of GSI does NOT need to be unique (multiple items can have same GSI PK)

### LSI vs GSI Comparison

```
+----------------------------+----------------------------+
|           LSI              |           GSI              |
+----------------------------+----------------------------+
| Same PK as base            | Different PK from base     |
| Must create at table time  | Can add anytime            |
| Shares table capacity      | Own capacity               |
| Strong consistency allowed | Eventual consistency only  |
| Max 5 per table            | Max 20 per table           |
| Same partition as item     | Different partitions       |
+----------------------------+----------------------------+
```

**Sparse Index Pattern:**

If a GSI key attribute is optional (not in all items), only items WITH that attribute appear in the GSI. This creates a "sparse index" — much smaller than the full table — useful for finding "all items with attribute X set."

```
Example: All orders with expedited_shipping = true

Only items with expedited_shipping appear in GSI
Much fewer items → faster, cheaper queries
```

---

## Read/Write Capacity

### Provisioned Capacity Mode

You specify the number of read and write capacity units per second.

```
RCU (Read Capacity Unit):
  1 RCU = 1 strongly consistent read per second for item up to 4 KB
  1 RCU = 2 eventually consistent reads per second for item up to 4 KB

WCU (Write Capacity Unit):
  1 WCU = 1 write per second for item up to 1 KB
```

**RCU Calculation Examples:**

```
Example 1: Read a 6 KB item with strong consistency
  Data size: 6 KB / 4 KB = 1.5 → round up to 2 read units
  Consistency: strong → 1× multiplier
  RCU consumed: 2

Example 2: Read a 6 KB item with eventual consistency
  Data size: 6 KB / 4 KB = 1.5 → round up to 2 read units
  Consistency: eventual → 0.5× multiplier
  RCU consumed: 1

Example 3: Read a 1.5 KB item with strong consistency
  Data size: 1.5 KB / 4 KB = 0.375 → round up to 1 read unit
  Consistency: strong → 1× multiplier
  RCU consumed: 1
```

**WCU Calculation Examples:**

```
Example 1: Write a 2.5 KB item
  Size: 2.5 KB / 1 KB = 2.5 → round up to 3 KB
  WCU consumed: 3

Example 2: Write a 0.5 KB item
  Size: 0.5 KB / 1 KB = 0.5 → round up to 1 KB
  WCU consumed: 1

Example 3: Write 10 items, each 0.5 KB, per second
  Each item: 1 WCU (round up from 0.5)
  Total: 10 WCU/second needed
```

### On-Demand Capacity Mode

```
+------------------------------------------+
|           ON-DEMAND MODE                 |
+------------------------------------------+
| Pay per request:                         |
|   Read request unit: $0.25 per million  |
|   Write request unit: $1.25 per million |
| No capacity planning                     |
| Scales to any traffic instantly          |
| More expensive than provisioned at scale |
+------------------------------------------+
| USE WHEN:                                |
| - Unknown traffic patterns              |
| - New tables / new applications         |
| - Very spiky, unpredictable traffic     |
| - Low average traffic with peak spikes  |
+------------------------------------------+
```

### Read Consistency Options

```
EVENTUALLY CONSISTENT READS (default):
  Returns data that might be slightly stale
  (lag of milliseconds from latest write)
  Costs: 0.5 RCU per 4 KB
  Use when: Most reads (staleness is acceptable)

STRONGLY CONSISTENT READS:
  Returns the most up-to-date data
  Includes all writes before the read
  Costs: 1 RCU per 4 KB (2× more expensive)
  Use when: Critical reads where you MUST see latest data
  Not available: On GSIs (always eventually consistent)

TRANSACTIONAL READS (TransactGetItems):
  ACID-compliant read across multiple items
  Costs: 2 RCUs per 4 KB (2× more than strongly consistent)
  Use when: You need to read multiple items atomically
```

### Auto Scaling

```
DynamoDB Auto Scaling:
  Monitors consumed capacity
  Automatically adjusts provisioned capacity
  Target utilization: e.g., 70% (scale up when above, down when below)
  Scale range: Set min and max capacity
  
  Works best for: Gradual traffic changes
  Not instant: Takes minutes to scale
  
For burst traffic: On-Demand mode handles better
```

---

## DynamoDB Operations

### Core CRUD Operations

```
PutItem:
  Create or replace an item completely
  If item with same PK exists, REPLACES entire item
  Use when: Creating new item or full replacement
  
GetItem:
  Read a single item by its primary key
  Fastest and cheapest read operation
  Use when: You know the exact PK (and SK)

UpdateItem:
  Modify specific attributes without replacing whole item
  Creates item if it doesn't exist (upsert behavior)
  Use when: Updating counters, changing one field

DeleteItem:
  Remove an item by primary key
  Can use condition to ensure item exists first

BatchWriteItem:
  Write or delete up to 25 items in ONE API call
  NOT transactional (each write independent)
  More efficient than 25 individual PutItem calls

BatchGetItem:
  Read up to 100 items in ONE API call (across tables)
  NOT transactional
```

### Query vs Scan

```
QUERY — Efficient, uses indexes:
  KeyConditionExpression: PK (required) + SK (optional range)
  FilterExpression: Additional filtering (applied AFTER reading)
  Returns: All items matching PK (+ SK condition if specified)
  
  Query(PK="USER#001") → returns all items where PK="USER#001"
  Cost: Reads only relevant items (efficient)
  
  Use when: You know the partition key

SCAN — Expensive, reads everything:
  Reads EVERY item in the table
  Then filters (FilterExpression) — filter happens AFTER reading all
  
  Scan(FilterExpression="status = ACTIVE")
  Cost: Reads ENTIRE table, then filters. Very expensive.
  
  Use when: AVOID if possible. Use for:
    - One-time data migrations
    - Admin tools (not user-facing)
    - Very small tables
```

```
THE GOLDEN RULE: Design your data model so all queries use Query, never Scan.

If you find yourself needing to Scan, you likely need:
  1. A GSI with the filter attribute as the GSI partition key
  2. A redesign of your access patterns
```

### Condition Expressions

Condition expressions make operations fail if a condition is not met:

```python
# Only update if item exists
table.update_item(
    Key={'UserId': 'USER#001'},
    UpdateExpression='SET balance = balance + :amount',
    ExpressionAttributeValues={':amount': 100},
    ConditionExpression='attribute_exists(UserId)'  # fails if item doesn't exist
)

# Optimistic locking: only update if version matches
table.update_item(
    Key={'UserId': 'USER#001'},
    UpdateExpression='SET balance = :new_balance, version = version + :inc',
    ExpressionAttributeValues={':new_balance': 500, ':inc': 1},
    ConditionExpression='version = :expected_version',
    ExpressionAttributeValues={
        ':new_balance': 500,
        ':inc': 1,
        ':expected_version': 3
    }
)
```

### Transactions

DynamoDB supports ACID transactions across multiple items and tables:

```python
# TransactWriteItems: up to 100 operations atomically
dynamodb.transact_write_items(
    TransactItems=[
        {
            'Update': {
                'TableName': 'Accounts',
                'Key': {'AccountId': 'ACC-001'},
                'UpdateExpression': 'SET balance = balance - :amount',
                'ConditionExpression': 'balance >= :amount',
                'ExpressionAttributeValues': {':amount': {'N': '100'}}
            }
        },
        {
            'Update': {
                'TableName': 'Accounts',
                'Key': {'AccountId': 'ACC-002'},
                'UpdateExpression': 'SET balance = balance + :amount',
                'ExpressionAttributeValues': {':amount': {'N': '100'}}
            }
        }
    ]
)
# Both updates succeed or both fail
# Cost: 2× normal WCU per operation
```

---

## Access Patterns and Design

**The #1 rule of DynamoDB design:** Know your access patterns BEFORE designing your table. DynamoDB is designed around specific access patterns, not flexible ad-hoc querying.

### Step-by-Step Design Process

```
Step 1: List ALL entity types
  Users, Orders, Products, Reviews, Sessions...

Step 2: List ALL access patterns
  - Get user by ID
  - Get all orders for a user
  - Get order by order ID
  - Get all orders with status PENDING
  - Get product by ID
  - Get all reviews for a product
  - ...

Step 3: Map access patterns to table design
  For each access pattern: which primary key + sort key enables it?
  Which access patterns need a GSI?

Step 4: Design keys to enable access patterns
  Sometimes one table design can serve all patterns (single-table)
```

### Example Design: E-commerce System

```
Access Patterns:
  1. Get user profile by user ID
  2. Get all orders for a user
  3. Get a specific order
  4. Get all orders with status PENDING (for admin)
  5. Get user by email (for login)

TABLE DESIGN:
+------------------+------------------+------------------+
| PK               | SK               | Attributes       |
+------------------+------------------+------------------+
| USER#001         | PROFILE          | name, phone, ... |
| USER#001         | ORDER#2024-001   | total, items, .. |
| USER#001         | ORDER#2024-002   | total, items, .. |
| USER#002         | PROFILE          | name, phone, ... |
| ORDER#2024-001   | METADATA         | status, date, .. |
+------------------+------------------+------------------+

Access Pattern 1: Query(PK="USER#001", SK="PROFILE") → user profile
Access Pattern 2: Query(PK="USER#001", SK begins_with "ORDER#") → all orders
Access Pattern 3: GetItem(PK="USER#001", SK="ORDER#2024-001") → specific order
Access Pattern 4: GSI(PK=status, SK=date) → Query(GSI PK="PENDING") → all pending

GSI for Access Pattern 5 (login by email):
  GSI: PK=email → Query(GSI PK="user@example.com") → user
```

---

## Single-Table Design

Single-table design stores MULTIPLE entity types in ONE DynamoDB table. This is the recommended approach for complex applications.

### Why Single-Table Design?

```
MULTI-TABLE APPROACH (SQL thinking):
  Table: Users    → user data
  Table: Orders   → order data
  Table: Products → product data
  
  To get "user + their orders": 
    Query Users + Query Orders → two API calls
    In SQL: JOIN (one query)
    In DynamoDB: No joins → two separate reads

SINGLE-TABLE APPROACH:
  Table: MyApp  → ALL entity types
  
  Items:
    PK=USER#001, SK=PROFILE → user data
    PK=USER#001, SK=ORDER#001 → order data (linked to user!)
    
  To get "user + their orders":
    Query(PK="USER#001") → ONE API call → returns user + all orders
    
BENEFIT: Fewer API calls = lower latency + lower cost
```

### Single-Table Design Example

```
TABLE: ECommerceApp
+------------------+------------------+------------------+------------------+
| PK               | SK               | Type             | Other Attributes |
+------------------+------------------+------------------+------------------+
| USER#001         | PROFILE          | USER             | name, email, ... |
| USER#001         | ORDER#2024-001   | ORDER            | total, status,...|
| USER#001         | ORDER#2024-002   | ORDER            | total, status,...|
| USER#001         | ADDRESS#HOME     | ADDRESS          | street, city, ...|
| PRODUCT#P001     | METADATA         | PRODUCT          | name, price, ... |
| PRODUCT#P001     | REVIEW#R001      | REVIEW           | rating, text, ...|
| PRODUCT#P001     | REVIEW#R002      | REVIEW           | rating, text, ...|
| ORDER#2024-001   | METADATA         | ORDER_DETAIL     | items, shipping..|
+------------------+------------------+------------------+------------------+

QUERIES:
  "Get user profile":    GetItem(PK=USER#001, SK=PROFILE)
  "Get user's orders":   Query(PK=USER#001, SK begins_with ORDER#)
  "Get user + orders":   Query(PK=USER#001) → user profile + all orders
  "Get product reviews": Query(PK=PRODUCT#P001, SK begins_with REVIEW#)
  "Get specific order":  GetItem(PK=USER#001, SK=ORDER#2024-001)
                    OR:  GetItem(PK=ORDER#2024-001, SK=METADATA)
```

### Overloaded Keys (Entity Type Encoding)

The pattern of prefixing IDs with entity type (USER#, ORDER#, PRODUCT#) is called **key overloading**:

```
Using prefixes:
  USER#001       → identifies a user record
  ORDER#001      → identifies an order record
  PRODUCT#001    → identifies a product record
  
SK as entity relationship:
  SK=PROFILE         → user's own profile
  SK=ORDER#001       → user's order (order belongs to user)
  SK=ADDRESS#HOME    → user's home address
  
This allows Query(PK=USER#001) to return ALL records related to that user:
  - Profile
  - All orders
  - All addresses
  In ONE API call!
```

---

## DynamoDB Streams

DynamoDB Streams captures a time-ordered sequence of item-level changes in a table.

### How Streams Work

```
+------------------+     CHANGE      +------------------+
|   DynamoDB       | → captured in → |  DynamoDB Stream |
|   Table          |                 |  (24 hr window)  |
+------------------+                 +--------+---------+
  PUT, UPDATE, DELETE                         |
                                              | triggers
                                    +--------+---------+
                                    | Lambda Function  |
                                    | (processes event)|
                                    +------------------+
```

### Stream Record Types

```
Stream record contains:
  eventName: "INSERT" | "MODIFY" | "REMOVE"
  
  For INSERT:
    NewImage: {item attributes after insertion}
    OldImage: null
  
  For MODIFY:
    NewImage: {item attributes AFTER update}
    OldImage: {item attributes BEFORE update}
  
  For REMOVE:
    NewImage: null
    OldImage: {item attributes of deleted item}
```

### Use Cases for Streams

```
1. CROSS-TABLE REPLICATION
   User updates profile in DynamoDB →
   Stream → Lambda → Update Elasticsearch index

2. AGGREGATION/COUNTERS
   New order inserted →
   Stream → Lambda → Increment daily sales counter

3. EVENT SOURCING
   Any item change → Stream → Lambda → Publish to SNS/SQS/EventBridge

4. SEARCH INDEX
   New product added to DynamoDB →
   Stream → Lambda → Index in OpenSearch

5. CACHE INVALIDATION
   User data updated →
   Stream → Lambda → Invalidate ElastiCache entry

6. GLOBAL TABLES
   DynamoDB Streams is the underlying mechanism for Global Tables replication
```

### DynamoDB Streams + Lambda

```python
# Lambda triggered by DynamoDB Stream
def handler(event, context):
    for record in event['Records']:
        event_name = record['eventName']
        
        if event_name == 'INSERT':
            new_item = record['dynamodb']['NewImage']
            # Process new item
            process_new_order(new_item)
        
        elif event_name == 'MODIFY':
            old_item = record['dynamodb']['OldImage']
            new_item = record['dynamodb']['NewImage']
            # Process modification
            handle_status_change(old_item, new_item)
        
        elif event_name == 'REMOVE':
            old_item = record['dynamodb']['OldImage']
            # Process deletion
            cleanup_resources(old_item)
```

---

## Global Tables

DynamoDB Global Tables provide **multi-region, active-active** replication.

```
+------------------+           +------------------+           +------------------+
|   us-east-1      |           |   eu-west-1      |           |  ap-southeast-2  |
|   DynamoDB       | <-------> |   DynamoDB       | <-------> |   DynamoDB       |
|   (Read+Write)   | replicate |   (Read+Write)   | replicate |   (Read+Write)   |
+------------------+           +------------------+           +------------------+

All regions: ACTIVE (accept writes and reads)
Replication:  Sub-second (uses DynamoDB Streams internally)
Conflicts:    Last writer wins (based on timestamp)
```

**Global Tables use cases:**
- Low-latency reads for global users (read from nearest region)
- Active-active disaster recovery
- Data sovereignty with local read/write in each region

```bash
# Add a global table replica region
aws dynamodb update-table \
  --table-name MyGlobalTable \
  --replica-updates '[{"Create": {"RegionName": "eu-west-1"}}]'
```

---

## DAX (DynamoDB Accelerator)

DAX is an in-memory cache specifically designed for DynamoDB.

### DAX Architecture

```
+----------+     +----------+     +----------+
|          |     |          |     |          |
|   App    |---->|   DAX    |---->| DynamoDB |
|          |     | Cluster  |     |  Table   |
+----------+     +----------+     +----------+

Cache HIT:   App → DAX returns data (microseconds)
Cache MISS:  App → DAX → DynamoDB fetches → DAX caches → returns data

DAX is API-compatible with DynamoDB
Minimal code change: just change endpoint
```

### DAX vs ElastiCache for DynamoDB

```
+---------------------------+---------------------------+
|           DAX             |        ElastiCache        |
+---------------------------+---------------------------+
| DynamoDB-specific cache   | General-purpose cache     |
| Transparent (same API)    | Requires code changes     |
| Item-level + Query cache  | Application-managed       |
| Microsecond latency       | Microsecond latency       |
| Strong consistency        | Custom consistency logic  |
| Simple to add             | More flexible             |
+---------------------------+---------------------------+

Use DAX when: Want transparent DynamoDB caching with no code change
Use ElastiCache when: Complex caching needs, or caching across databases
```

**DAX use cases:**
- Read-heavy workloads with mostly same items being read repeatedly
- Eventually consistent reads (DAX is eventually consistent)
- Reduce DynamoDB read costs

**When NOT to use DAX:**
- Write-heavy workloads (DAX doesn't help much)
- Strongly consistent reads (DAX doesn't cache these)
- Applications with very low cache hit rates

---

## DynamoDB Best Practices

### 1. Partition Key Design

```
GOAL: Evenly distribute traffic across partitions

HIGH CARDINALITY KEYS:
  ✓ UUID / KSUID (random, high uniqueness)
  ✓ user_id (billions of users → billions of PKs)
  ✓ device_id (millions of IoT devices)

LOW CARDINALITY KEYS (avoid as PK):
  ✗ status (only a few values: active, inactive)
  ✗ country (200 countries → 200 partitions max)
  ✗ date (year-month → 12 per year)

WRITE SHARDING (workaround for low cardinality):
  If you MUST use status as PK, add random suffix:
  PK = "PENDING#" + random(1-10)
  
  Write to: PENDING#3, PENDING#7, PENDING#1
  Query all: Query each shard and combine
  Downside: More complex queries
```

### 2. Avoid Scans

```
NEVER: scan table looking for items by non-key attribute
INSTEAD: 
  - Add a GSI with that attribute as PK
  - Redesign your data model
  
EXCEPTION: Scans are OK for:
  - Migration scripts (one-time, off-peak)
  - Admin tooling (never user-facing)
  - Very small tables (< 1 MB)
  
PARALLEL SCAN (when you must scan large tables):
  Split table into N segments
  Scan each segment in parallel
  Combine results
  Faster but still expensive
```

### 3. Use GSIs Wisely

```
GSIs provide alternate access patterns but cost capacity.

BEST PRACTICES:
  Project only needed attributes into GSI (not all attributes)
  Monitor GSI consumed capacity separately
  GSI throttling ≠ table throttling (separate limits)
  
SPARSE GSI:
  Only add GSI key attribute to items that need it
  GSI only contains those items (much smaller, cheaper to query)
  
  Example: active_flag = "true" (only on active items)
  GSI: PK = active_flag
  GSI only contains active items
  Query: "Get all active items" → small, fast
```

### 4. TTL (Time to Live)

Automatically delete items after a specified time. No WCU consumed for deletion.

```python
# Set TTL when writing item
table.put_item(
    Item={
        'SessionId': 'sess_abc123',
        'UserId': 'USER#001',
        'Data': 'session data',
        'ExpiresAt': int(time.time()) + 3600  # expires in 1 hour
    }
)

# Enable TTL on table
aws dynamodb update-time-to-live \
  --table-name Sessions \
  --time-to-live-specification "Enabled=true, AttributeName=ExpiresAt"
```

**TTL use cases:**
- Session data expiration
- Cache data with natural expiry
- Audit logs older than N days
- Temporary tokens

---

## Interview Q&A

### Q1: What is the difference between a partition key and a sort key?

**Answer:**
- **Partition Key (Hash Key):** Determines which physical partition (shard) stores the item. The hash of the partition key value is used to route the item to a specific node. Must be unique if used alone as the primary key.
- **Sort Key (Range Key):** Optional second part of the primary key. Items with the same partition key are stored together, sorted by the sort key. Enables range queries on items within the same partition.

With a composite primary key (PK + SK), the combination must be unique, but you can have multiple items with the same PK (sorted by SK). This enables modeling one-to-many relationships in a single table.

---

### Q2: What is the difference between LSI and GSI?

**Answer:**
- **LSI:** Uses the SAME partition key as the base table but a different sort key. Must be created at table creation time. Cannot be added later. Shares the table's read/write capacity. Allows strongly consistent reads.
- **GSI:** Can have a completely DIFFERENT partition key (and optional sort key). Can be added to existing tables at any time. Has its own separate read/write capacity units. Only supports eventually consistent reads.

Rule of thumb: Use LSI when you need an alternate sort key for the same partition. Use GSI when you need a completely different access pattern with a different partition key.

---

### Q3: What is a hot partition and how do you avoid it?

**Answer:** A hot partition occurs when too many requests target the same partition (same partition key value), exceeding that partition's throughput limits and causing throttling.

**Causes:**
- Low-cardinality partition keys (status, date, country)
- "Celebrity" items (one user has millions of followers)
- Poor partition key design

**Solutions:**
1. **Use high-cardinality partition keys** — UUID, user_id, device_id
2. **Write sharding** — Add random suffix to low-cardinality PKs (e.g., `STATUS#PENDING#3`)
3. **Exponential backoff** — Retry logic in application
4. **DAX** — Cache hot items to reduce DynamoDB pressure
5. **Use On-Demand mode** — Automatically handles traffic spikes

---

### Q4: What is the difference between Query and Scan?

**Answer:**
- **Query:** Reads only items with a specific partition key (and optional sort key filter). Efficient — reads only the relevant data. Must specify the partition key. O(n) where n is number of matching items.
- **Scan:** Reads EVERY item in the table, then applies any filter expression. Very inefficient and expensive — filter is applied AFTER reading all data. O(N) where N is total table size.

**Critical point:** FilterExpression on a Scan doesn't reduce the items read (and charged) — it only filters the returned results. You're charged for all scanned items regardless.

Design your data model so all application queries use Query, never Scan. If you need Scan-like access, add a GSI.

---

### Q5: Explain the single-table design pattern.

**Answer:** Single-table design stores multiple entity types (users, orders, products) in a single DynamoDB table. Items from different entity types coexist, distinguished by their key patterns (e.g., PK prefixes like `USER#`, `ORDER#`, `PRODUCT#`).

**Why:** In DynamoDB, related items in the same partition can be retrieved in ONE Query call. Multiple tables require multiple API calls (DynamoDB has no JOINs). Single-table design allows fetching a user + all their orders in one Query by putting them under the same partition key (`USER#001`).

**Tradeoff:** More complex to understand and maintain vs. familiar relational approach, but provides better performance (fewer API calls) and lower cost (fewer read operations).

---

### Q6: What is DynamoDB on-demand mode vs provisioned mode?

**Answer:**
- **Provisioned:** You specify exact RCU and WCU. Pay per hour for provisioned capacity. Can set auto-scaling. More cost-effective at predictable, sustained traffic. Can throttle if traffic exceeds provisioned capacity.
- **On-demand:** No capacity planning. Pay per request (read/write request units). More expensive per request, but no over-provisioning. Handles any traffic instantly. Better for unpredictable or new workloads.

**Switch between them:** You can switch a table between on-demand and provisioned mode (maximum twice per day for on-demand → provisioned, no limit for provisioned → on-demand).

---

### Q7: What is DAX and when should you use it?

**Answer:** DAX (DynamoDB Accelerator) is an in-memory cache cluster specifically designed for DynamoDB. It's API-compatible with DynamoDB — you just change the endpoint in your application. It provides microsecond read latency for cached items vs millisecond from DynamoDB directly.

**Use when:**
- Read-heavy workloads with high cache hit rates
- Same items are read repeatedly (hot items)
- Eventually consistent reads are acceptable (DAX doesn't serve strongly consistent reads from cache)

**Do NOT use when:**
- Write-heavy workloads (DAX caches reads, not writes)
- Strongly consistent reads required
- Low repeat-read rate (cache misses add overhead)
- Very small tables (DynamoDB is already fast enough)

---

### Q8: How does DynamoDB handle transactions?

**Answer:** DynamoDB supports ACID transactions through `TransactWriteItems` and `TransactGetItems` APIs:

- **TransactWriteItems:** Atomic write of up to 100 items across multiple tables (all succeed or all fail)
- **TransactGetItems:** Atomic read of up to 100 items (consistent snapshot view)

**Cost:** Transactional operations cost 2× the normal RCU/WCU.

**Use case:** Bank transfer (debit one account, credit another — must both succeed or both fail), e-commerce inventory (check stock + place order atomically).

DynamoDB transactions are serializable — the highest isolation level. Unlike optimistic locking (which can fail and retry), transactions are handled at the DynamoDB level.

---

### Q9: What are DynamoDB Streams and what are they used for?

**Answer:** DynamoDB Streams capture a chronological log of every change (INSERT, MODIFY, DELETE) to items in a table. Each stream record contains the before and/or after state of the item. Records are retained for 24 hours.

**Common use cases:**
1. Triggering Lambda on data changes (event-driven architectures)
2. Cross-table replication (sync DynamoDB changes to Elasticsearch/OpenSearch)
3. Aggregations and derived data (count items, maintain summary tables)
4. Audit trails (log every change)
5. Cross-region replication via Global Tables (uses Streams internally)

Lambda polls the stream shards automatically — no polling infrastructure needed.

---

### Q10: What is a DynamoDB Global Table?

**Answer:** Global Tables provide multi-region, active-active DynamoDB replication. You designate multiple AWS regions, and DynamoDB automatically replicates writes to all regions with typically sub-second lag.

**Active-active** means you can READ AND WRITE in every region (unlike RDS Read Replicas which are read-only).

**Conflict resolution:** Last writer wins (based on timestamp). Concurrent conflicting writes are resolved by the most recent timestamp.

**Use cases:**
- Global applications needing low-latency reads in multiple regions
- Disaster recovery (any region can serve writes)
- Data compliance (keep data in specific regions while globally accessible)

---

### Q11: How do you model a many-to-many relationship in DynamoDB?

**Answer:** In DynamoDB, many-to-many relationships require adjacency list design.

**Example:** Students and Courses (a student can enroll in many courses, a course has many students)

```
TABLE: Enrollments
PK             | SK
STUDENT#001    | COURSE#MATH101    (student enrolled in course)
STUDENT#001    | COURSE#HIST201
STUDENT#002    | COURSE#MATH101
COURSE#MATH101 | STUDENT#001       (course has this student)
COURSE#MATH101 | STUDENT#002

Query: "What courses is STUDENT#001 enrolled in?"
  Query(PK=STUDENT#001, SK begins_with COURSE#) → MATH101, HIST201

Query: "What students are in COURSE#MATH101?"
  Query(PK=COURSE#MATH101, SK begins_with STUDENT#) → STUDENT#001, STUDENT#002
```

Two rows per relationship (one from each entity's perspective) enables both directions of query without scanning.

---

### Q12: What is the maximum item size in DynamoDB and how does it affect design?

**Answer:** The maximum item size is **400 KB** (including all attribute names and values).

**Design implications:**
1. **Large attribute values:** Store large blobs (images, documents) in S3 and keep only the S3 reference in DynamoDB
2. **Large collections:** If a list/set can grow unboundedly (e.g., a user's entire order history), store each element as a separate item (one-to-many relationship) rather than in a nested list attribute
3. **Attribute name length matters:** Attribute names count toward the 400 KB limit. Use short attribute names (trade readability for capacity)

**Example:** A user item with a List of all their reviews could hit 400 KB if they write many reviews. Instead, store reviews as separate items with PK=USER#ID, SK=REVIEW#ID.

---

### Q13: How does DynamoDB consistency work?

**Answer:** DynamoDB offers two consistency models:

**Eventually consistent reads (default):**
- DynamoDB replicates across 3 nodes in a region
- Eventually consistent reads may return data from a node that hasn't yet received the latest write (milliseconds behind)
- Costs: 0.5 RCU per 4 KB (half the cost of strong)
- Use for: Most reads where slight staleness is acceptable

**Strongly consistent reads:**
- Always returns the most up-to-date data
- DynamoDB reads from the leader node
- Costs: 1 RCU per 4 KB
- Not available on GSIs (always eventually consistent)
- Use for: Critical reads that must reflect latest writes

**Transactional reads:**
- Even stronger — serializable isolation across multiple items
- Costs: 2 RCU per 4 KB
- Use for: Reading multiple items that must form a consistent snapshot

For most applications, eventually consistent reads are sufficient and cost-effective.

---

### Q14: How does TTL work in DynamoDB?

**Answer:** TTL (Time to Live) automatically deletes items when the TTL timestamp expires. You designate one attribute as the TTL attribute (must be a Number containing a Unix epoch timestamp in seconds).

**Process:**
1. DynamoDB periodically scans for items where the TTL attribute is in the past
2. Expired items are deleted within 48 hours (usually within minutes)
3. Deletions do NOT consume WCU — they're free
4. Deleted items DO appear in DynamoDB Streams (for auditing or side effects)

**Important:** Items may remain visible for up to 48 hours after expiry. If your application must not see expired items, add a filter in your application code.

**Use cases:** Session management, cache expiration, soft-delete with automatic cleanup, temporary tokens, time-bounded audit records.
