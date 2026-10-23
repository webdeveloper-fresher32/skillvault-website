# Replica Sets — MongoDB Phase 9, File 01

## Table of Contents

1. [What Is a Replica Set?](#1-what-is-a-replica-set)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Member Roles Explained](#3-member-roles-explained)
4. [The Oplog — Engine of Replication](#4-the-oplog--engine-of-replication)
5. [Setting Up a Replica Set](#5-setting-up-a-replica-set)
6. [Read Preferences](#6-read-preferences)
7. [Replication Lag — Causes and Mitigation](#7-replication-lag--causes-and-mitigation)
8. [Priority and Votes](#8-priority-and-votes)
9. [Hidden Members](#9-hidden-members)
10. [Delayed Replicas](#10-delayed-replicas)
11. [Under the Hood — How Sync Works](#11-under-the-hood--how-sync-works)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. What Is a Replica Set?

Here's the scenario that makes this whole topic make sense: you have one MongoDB server, `mongod`, running your production app. One night, its disk dies. Or the VM gets rebooted. Or someone `kill -9`s the wrong process. What happens to your app?

Nothing good. Every read and write goes to that one server — no server, no database, no app. That's the problem a **Replica Set** exists to solve.

---

### The manager-and-assistants analogy

Picture an office with one manager and two assistants.

- The **manager** (Primary) is the only one allowed to make final decisions and write them into the official decision log.
- The **assistants** (Secondaries) don't make decisions themselves — they just read the manager's decision log and copy every entry into their own notebooks, so they're always caught up.
- If the manager suddenly quits (server crash), the assistants don't sit around waiting for someone to hire a replacement. They hold a quick meeting, agree on who has the most complete, up-to-date notebook, and that assistant becomes the new manager. Work continues.

Translate that back to MongoDB:

- **Primary** = the manager. All writes go here.
- **Secondaries** = the assistants. They continuously copy the manager's decisions.
- **Oplog** = the decision log itself — the record of every decision (write) the manager made, in order.

That's a Replica Set: a group of `mongod` processes maintaining identical copies of the same data, with one of them in charge of writes at any given time.

---

### Basic definition

A **Replica Set** is a group of `mongod` processes that maintain the same dataset. It gives you three things:

- **High Availability** — automatic failover if the primary goes down
- **Data Redundancy** — multiple physical copies of every document
- **Read Scalability** — reads can be distributed across secondaries (with trade-offs)

---

## 2. Architecture Diagram

Let's actually look at how the manager/assistants setup is wired together, because the shape of it matters later (elections, lag, hidden nodes — it all builds on this diagram).

### Standard 3-Member Replica Set

```
┌─────────────────────────────────────────────────────────────────┐
│                        Replica Set: rs0                         │
│                                                                  │
│   ┌─────────────────┐         ┌─────────────────┐               │
│   │    PRIMARY       │  oplog  │   SECONDARY 1   │               │
│   │  mongo1:27017    ├────────►│  mongo2:27017   │               │
│   │                  │         │                 │               │
│   │  - All writes    │         │  - Reads oplog  │               │
│   │  - Reads (def.)  │         │  - Applies ops  │               │
│   │  - Maintains     │         │  - Can serve    │               │
│   │    oplog         │         │    reads        │               │
│   └────────┬─────────┘         └─────────────────┘               │
│            │                                                     │
│            │ oplog                                               │
│            ▼                                                     │
│   ┌─────────────────┐                                            │
│   │   SECONDARY 2   │                                            │
│   │  mongo3:27017   │                                            │
│   │                 │                                            │
│   │  - Reads oplog  │                                            │
│   │  - Applies ops  │                                            │
│   │  - Can serve    │                                            │
│   │    reads        │                                            │
│   └─────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Replica Set With Arbiter

Sometimes you want an odd number of voters (more on why in Section 8) but don't want to pay for a full extra data-carrying server. That's what an Arbiter is for — a vote, with no data attached.

```
┌──────────────────────────────────────────────────────────────────┐
│                       Replica Set: rs0                            │
│                                                                   │
│   ┌──────────────┐    oplog    ┌──────────────┐                  │
│   │   PRIMARY    │────────────►│  SECONDARY   │                  │
│   │ mongo1:27017 │             │ mongo2:27017  │                  │
│   └──────────────┘             └──────────────┘                  │
│           │                           │                          │
│           │ heartbeat                 │ heartbeat                │
│           │                           │                          │
│           └──────────┐  ┌────────────┘                          │
│                      ▼  ▼                                        │
│               ┌──────────────┐                                   │
│               │   ARBITER    │                                   │
│               │ mongo3:27017 │                                   │
│               │              │                                   │
│               │  - No data   │                                   │
│               │  - Votes     │                                   │
│               │    only      │                                   │
│               └──────────────┘                                   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Heartbeat Flow

How does anyone actually know the manager is still at their desk? Every member pings every other member every 2 seconds, like a quick "you good?" text. If a ping times out, that member gets marked unavailable.

```
mongo1 ──── heartbeat every 2s ────► mongo2
mongo1 ◄─── heartbeat every 2s ──── mongo2
mongo1 ──── heartbeat every 2s ────► mongo3
mongo1 ◄─── heartbeat every 2s ──── mongo3
mongo2 ──── heartbeat every 2s ────► mongo3
mongo2 ◄─── heartbeat every 2s ──── mongo3
```

---

## 3. Member Roles Explained

Not everyone in the office plays the same role. Here's the full breakdown.

### Role Comparison Table

| Role | Holds Data | Votes in Elections | Can Become Primary | Serves Reads |
|------|-----------|-------------------|-------------------|-------------|
| Primary | Yes | Yes | N/A (already primary) | Yes (default) |
| Secondary | Yes | Yes | Yes (if priority > 0) | Yes (if configured) |
| Arbiter | No | Yes | No | No |
| Hidden | Yes | Yes | No (priority = 0) | No |
| Delayed | Yes | Yes | No (priority = 0) | No |

### Primary

The Primary is the authoritative node — the manager. All write operations go here. MongoDB's default write concern `w:1` means the write is acknowledged once the Primary has written it. And every write the Primary makes gets logged in its **oplog** — the decision log the assistants are all copying from.

### Secondary

Secondaries continuously tail the Primary's oplog and replay each operation against their own data — exactly like an assistant copying entries out of the manager's decision log into their own notebook, one entry at a time.

```
Primary Oplog Entry
       │
       ▼
Secondary pulls new oplog entries (initial sync or ongoing)
       │
       ▼
Secondary applies each operation to its local data
       │
       ▼
Secondary updates its local "lastApplied" timestamp
```

### Arbiter

An Arbiter is a `mongod` process that participates in elections but **does not hold any data**. Use it when you need an odd number of voting members but can't afford another full data-bearing node — it's a vote, not an assistant.

Caution: Arbiters are not recommended in most production environments because they don't contribute to redundancy — if a data-bearing node dies, an arbiter can't step in and serve data. MongoDB Atlas, for example, doesn't use arbiters.

---

## 4. The Oplog — Engine of Replication

### What problem does this solve?

If every secondary had to constantly ask the primary "what's changed since I last checked, tell me everything, in detail" — that's expensive and awkward to coordinate. Instead, MongoDB keeps a single running log of every write, in order, that any secondary can just tail continuously. That log is the **oplog** — the decision log in our analogy.

### What Is the Oplog?

The **oplog** (operations log) is a special **capped collection** named `local.oplog.rs`. It records every write operation that modifies data on the Primary. Secondaries continuously read from this collection and replay the operations.

### Oplog Location

```
local database (NOT replicated itself)
└── oplog.rs  (capped collection)
    ├── { ts: Timestamp, op: "i", ns: "mydb.users", o: {...} }
    ├── { ts: Timestamp, op: "u", ns: "mydb.orders", o2: {...}, o: {...} }
    └── { ts: Timestamp, op: "d", ns: "mydb.sessions", o: { _id: ... } }
```

### Oplog Entry Fields

| Field | Description | Example |
|-------|-------------|---------|
| `ts` | Timestamp of the operation | `Timestamp(1687000000, 1)` |
| `t` | Term number (for elections) | `5` |
| `op` | Operation type | `"i"`, `"u"`, `"d"`, `"c"`, `"n"` |
| `ns` | Namespace (db.collection) | `"mydb.users"` |
| `o` | Operation document | `{ _id: 1, name: "Alice" }` |
| `o2` | Query document (updates only) | `{ _id: 1 }` |
| `ui` | UUID of the collection | UUID |
| `wall` | Wall-clock time | ISODate |

### Operation Types

```
op: "i"  → insert
op: "u"  → update
op: "d"  → delete
op: "c"  → command (createCollection, dropCollection, etc.)
op: "n"  → no-op (used for heartbeats/timing)
```

### Oplog Is Idempotent

Here's a subtlety that trips people up: what happens if a secondary crashes halfway through replaying an entry, and restarts? Does it risk applying the same operation twice and corrupting the data?

It doesn't — because of a critical property of the oplog: **every operation can be applied multiple times and produce the same result.** MongoDB transforms operations internally to make this true.

For example, an `$inc` operation isn't stored as "add 5 to the current value" (which would double-apply badly on replay) — it's stored as a `$set` with the final value. Replaying it once or ten times lands on the exact same result.

```js
// Application writes:
db.counters.updateOne({ _id: "visits" }, { $inc: { count: 1 } })

// Oplog stores (idempotent form):
{ op: "u", ns: "mydb.counters", 
  o2: { _id: "visits" },
  o: { $v: 2, diff: { u: { count: 42 } } }  // sets to final value
}
```

> **Memory hook:** "The decision log doesn't say 'add one more' — it says 'the final count is 42.' Read it once or ten times, you land in the same place."

### Oplog Size

The oplog is a **capped collection** — it has a fixed maximum size. When it fills up, older entries are overwritten, oldest first. The "oplog window" is how far back in time the oplog actually covers.

```bash
# Check oplog status
rs.printReplicationInfo()

# Output:
# configured oplog size:   2048 MB
# log length start to end: 72 hrs (259200 secs)
# oplog first event time:  Mon Jun 20 2026 00:00:00 GMT+0000
# oplog last event time:   Mon Jun 23 2026 00:00:00 GMT+0000
# now:                     Mon Jun 23 2026 12:00:00 GMT+0000
```

If a Secondary is offline longer than the oplog window, it can't catch up via normal replication — the entries it needs have already been overwritten. It has to perform an **initial sync** (a full resync from the Primary), which is a much heavier operation.

### Setting Oplog Size

```bash
# In mongod.conf:
replication:
  oplogSizeMB: 10240  # 10 GB

# Or at runtime (MongoDB 3.6+):
db.adminCommand({ replSetResizeOplog: 1, size: 10240 })
```

### Viewing the Oplog

```js
// Connect to the local database
use local

// View recent oplog entries
db.oplog.rs.find().sort({ $natural: -1 }).limit(5).pretty()

// View oplog for a specific collection
db.oplog.rs.find({ ns: "mydb.orders" }).sort({ $natural: -1 }).limit(10)
```

**Interview answer:** "The oplog is a capped collection on the Primary that records every write in order. Secondaries tail it continuously and replay each entry to stay in sync. It's designed to be idempotent — replaying an entry twice produces the same result — so a secondary that crashes mid-replay can safely resume without corrupting data. Its fixed size defines the 'oplog window,' and any secondary that falls behind that window has to fall back to a full initial sync."

---

## 5. Setting Up a Replica Set

Enough theory — let's actually stand one up. There are two common ways to do it locally.

### Method 1: Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: "3.8"
services:
  mongo1:
    image: mongo:7.0
    container_name: mongo1
    ports:
      - "27017:27017"
    command: mongod --replSet rs0 --bind_ip_all
    networks:
      - mongonet

  mongo2:
    image: mongo:7.0
    container_name: mongo2
    ports:
      - "27018:27017"
    command: mongod --replSet rs0 --bind_ip_all
    networks:
      - mongonet

  mongo3:
    image: mongo:7.0
    container_name: mongo3
    ports:
      - "27019:27017"
    command: mongod --replSet rs0 --bind_ip_all
    networks:
      - mongonet

networks:
  mongonet:
    driver: bridge
```

```bash
# Start containers
docker-compose up -d

# Connect to mongo1 and initiate the replica set
docker exec -it mongo1 mongosh
```

### Method 2: Manual mongod Configuration

```bash
# mongod.conf for each node
# Node 1
storage:
  dbPath: /data/db1
net:
  port: 27017
  bindIp: 0.0.0.0
replication:
  replSetName: "rs0"

# Node 2
storage:
  dbPath: /data/db2
net:
  port: 27018
  bindIp: 0.0.0.0
replication:
  replSetName: "rs0"

# Node 3
storage:
  dbPath: /data/db3
net:
  port: 27019
  bindIp: 0.0.0.0
replication:
  replSetName: "rs0"
```

```bash
# Start each node
mongod --config /etc/mongod1.conf
mongod --config /etc/mongod2.conf
mongod --config /etc/mongod3.conf
```

### Initiating the Replica Set

Standing up the servers isn't enough on its own — they don't know about each other yet. `rs.initiate()` is the step that actually forms the group and tells them who the members are.

```js
// Connect to the first node
mongosh --port 27017

// Initiate with a full configuration
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017", priority: 2 },
    { _id: 1, host: "mongo2:27017", priority: 1 },
    { _id: 2, host: "mongo3:27017", priority: 1 }
  ]
})

// Verify
rs.status()
```

### Adding Members Later

```js
// Add a new secondary
rs.add("mongo4:27017")

// Add an arbiter
rs.addArb("mongo5:27017")

// Remove a member
rs.remove("mongo4:27017")
```

### Connection String for Replica Set

One more thing worth noticing here: your application never connects to "the primary" by name. It connects to the whole set, and the driver figures out who's currently in charge.

```js
// Application connection string
const uri = "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0"

// With authentication
const uri = "mongodb://user:password@mongo1:27017,mongo2:27017,mongo3:27017/mydb?replicaSet=rs0&authSource=admin"
```

---

## 6. Read Preferences

### What problem does this solve?

By default, every read goes to the Primary — same as every write. That's the safest option, but it means the Primary is doing 100% of the work while the Secondaries just sit there quietly copying the oplog. If you've got a reporting job or an analytics dashboard hammering the database, why make the Primary suffer for it when two idle assistants are sitting right there with (almost) the same data?

Read preference is simply: *which member should this read go to?*

### Read Preference Modes

```
┌─────────────────────┬──────────────────────────────────────────────────────┐
│ Mode                │ Description                                          │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ primary             │ Default. All reads go to the Primary. Guarantees     │
│                     │ reading latest committed data.                       │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ primaryPreferred    │ Reads from Primary if available. Falls back to a     │
│                     │ Secondary if Primary is unavailable.                 │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ secondary           │ All reads go to Secondaries. Never reads from        │
│                     │ Primary. May return stale data.                      │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ secondaryPreferred  │ Reads from Secondaries if available. Falls back to   │
│                     │ Primary if no Secondary is available.                │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ nearest             │ Reads from the member with the lowest network        │
│                     │ latency, regardless of type.                         │
└─────────────────────┴──────────────────────────────────────────────────────┘
```

### Setting Read Preference in Code

```js
// Node.js driver — collection level
const collection = db.collection("products", {
  readPreference: "secondaryPreferred"
})

// Per-operation level
db.collection("analytics").find({}).withReadPreference(
  new ReadPreference("secondary")
)

// Connection string level
const uri = "mongodb://mongo1:27017,mongo2:27017/?replicaSet=rs0&readPreference=secondaryPreferred"

// Mongosh
db.products.find({}).readPref("secondary")
```

### Tag Sets for Targeted Reads

Sometimes "any secondary" isn't specific enough — say you want reads to prefer a secondary in the same region, or one dedicated to analytics. Tag sets let you label members and target reads at those labels.

```js
// Configure tags in replica set config
rs.reconfig({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017", priority: 2, tags: { region: "us-east", type: "primary" } },
    { _id: 1, host: "mongo2:27017", priority: 1, tags: { region: "us-east", type: "analytics" } },
    { _id: 2, host: "mongo3:27017", priority: 1, tags: { region: "us-west", type: "analytics" } }
  ]
})

// Read from US-East analytics node
db.reports.find({}).readPref("secondary", [{ region: "us-east", type: "analytics" }])
```

### Read Preference Trade-offs

There's no free lunch here — it's a straight line from "always correct, always slow to scale" to "fastest, most likely stale":

```
primary              → Strongest consistency, no scalability for reads
                       ↕
primaryPreferred     → High consistency, some read resilience
                       ↕
secondaryPreferred   → Good read scalability, may read stale data
                       ↕
secondary            → Maximum read offload, always potentially stale
                       ↕
nearest              → Minimum latency, may read stale data
```

### When to Use Each Mode

| Use Case | Recommended Mode |
|----------|-----------------|
| Financial transactions | `primary` |
| Real-time inventory checks | `primary` |
| Reports / analytics (lag-tolerant) | `secondary` or `secondaryPreferred` |
| Caching layer reads | `nearest` |
| Reads during primary failover | `primaryPreferred` |
| Geographically distributed reads | `nearest` with tag sets |

**Interview answer:** "Read preference controls which replica set members a read operation can target. `primary` is the safest and default — it guarantees the latest committed data but doesn't scale reads. `secondary`/`secondaryPreferred` let you offload read traffic onto assistants at the cost of potential staleness from replication lag. `nearest` optimizes purely for latency. The right choice depends entirely on whether the read needs to be current or just fast."

---

## 7. Replication Lag — Causes and Mitigation

### What problem does this describe?

The assistants don't copy the manager's decision log instantaneously — there's always some delay between "the manager wrote it down" and "the assistant's notebook has it too." That delay is **replication lag**: the time between when a write occurs on the Primary and when it's reflected on a Secondary.

Why does it matter? Because anyone reading from a Secondary (see Section 6) might be looking at slightly old data — and if the Primary suddenly disappears, whichever Secondary is furthest behind is the one you don't want to become the new manager (more on that in File 02, Failover).

### Measuring Replication Lag

```js
// Check lag for all members
rs.printSlaveReplicationInfo()
// (deprecated alias, still works)

rs.printSecondaryReplicationInfo()

// Or via rs.status()
rs.status().members.forEach(m => {
  if (m.state === 2) { // SECONDARY state
    print(m.name + " lag: " + m.optimeDate)
  }
})
```

### Common Causes of Lag

```
┌─────────────────────────────────────────────────────────────┐
│              Causes of Replication Lag                       │
│                                                             │
│  1. HIGH WRITE THROUGHPUT                                   │
│     Primary receives more writes than Secondary can         │
│     replay. The oplog cursor falls behind.                  │
│                                                             │
│  2. SLOW SECONDARY HARDWARE                                 │
│     Secondary has slower disk I/O or CPU than Primary.      │
│     Operations apply slower than they arrive.               │
│                                                             │
│  3. NETWORK CONGESTION                                      │
│     Slow or congested network between Primary and           │
│     Secondary delays oplog transfer.                        │
│                                                             │
│  4. LONG-RUNNING OPERATIONS ON SECONDARY                    │
│     Read queries on Secondaries can block oplog             │
│     application (reads acquire shared locks).               │
│                                                             │
│  5. INDEX BUILDS ON SECONDARY                               │
│     Index creation is replicated and can be expensive.      │
│                                                             │
│  6. CHAINED REPLICATION                                     │
│     Secondary syncing from another Secondary rather         │
│     than Primary creates an extra hop.                      │
└─────────────────────────────────────────────────────────────┘
```

### Mitigation Strategies

```js
// 1. Disable chained replication (force sync from primary only)
cfg = rs.conf()
cfg.settings.chainingAllowed = false
rs.reconfig(cfg)

// 2. Increase oplog size to give more recovery window
db.adminCommand({ replSetResizeOplog: 1, size: 20480 }) // 20 GB

// 3. Use write concern to detect lag issues
db.orders.insertOne(
  { item: "widget", qty: 100 },
  { writeConcern: { w: 2, wtimeout: 5000 } }  // wait for 2 members, timeout 5s
)

// 4. Monitor with a dedicated alert threshold (pseudo-code)
// Alert if lag > 60 seconds
```

**Common mistake:** assuming a replica set gives you "instant" consistency everywhere. It doesn't — replication is asynchronous by default. If your app reads its own write from a Secondary immediately after writing to the Primary, it might not see it yet. If that matters for correctness (e.g., "show the user their own order right after placing it"), read from the Primary or use causal consistency, not a Secondary.

---

## 8. Priority and Votes

### Priority

Priority controls which member is most likely to become the Primary during an election — think of it as how strongly a given assistant is being groomed as the manager's successor. Higher priority = preferred candidate.

```js
// Default priority is 1 for all members
// Priority 0 = never becomes primary
// Priority can be any float from 0 to 1000

cfg = rs.conf()
cfg.members[0].priority = 3   // strongly preferred primary
cfg.members[1].priority = 1   // can become primary
cfg.members[2].priority = 0   // never becomes primary (e.g., analytics node)
rs.reconfig(cfg)
```

### Votes

Priority decides *who* wins an election; votes decide *whether an election can happen at all*. Each member can have 0 or 1 vote, and a member needs votes from a majority of voting members to become Primary.

```
Replica Set with 5 members:
┌─────────┬──────────┬───────┐
│ Member  │ Priority │ Votes │
├─────────┼──────────┼───────┤
│ mongo1  │ 2        │ 1     │  ← primary candidate
│ mongo2  │ 1        │ 1     │  ← can vote and be elected
│ mongo3  │ 1        │ 1     │  ← can vote and be elected
│ mongo4  │ 0        │ 0     │  ← data node, no vote
│ mongo5  │ 0        │ 0     │  ← data node, no vote
└─────────┴──────────┴───────┘

Majority of 3 voting members = 2 votes required to elect a primary
```

### Votes vs Priority Interaction

```
Scenario: mongo1 (primary) goes down

Remaining voting members: mongo2 (votes:1), mongo3 (votes:1)
Majority needed: 2 of 3 → 2 votes
mongo2 and mongo3 have 2 votes total → election succeeds

Priority determines WHICH one wins (mongo2 has priority 1, mongo3 has priority 1)
→ tie broken by most up-to-date oplog timestamp
```

### Non-Voting Members

Members with `votes: 0` can't participate in elections but still replicate data. Use for:
- Read replicas that should not affect election quorums
- Analytics nodes
- Delayed backup replicas

**Common mistake:** confusing priority and votes as the same setting. A member with `priority: 0` still votes (it just can never win). A member with `votes: 0` can never even be counted toward the majority, whether or not it has priority. They're independent knobs, and misconfiguring the voting member count (see File 02's discussion of odd vs even splits) is a classic way to accidentally create a replica set that can't elect anyone during a partition.

---

## 9. Hidden Members

### What problem does this solve?

Say you want to run heavy analytics queries against a full copy of your data without slowing down the app, and without risking your app's driver accidentally sending regular reads to that overloaded node. A plain Secondary won't do — client drivers can still route reads to it. You need a member that replicates everything but is otherwise invisible to the app.

A **hidden member** is exactly that: a Secondary that:
- Replicates data from the Primary
- Is **invisible to client drivers** — the driver will never route reads to it
- Has `priority: 0` so it can never become Primary
- Still participates in elections (with 1 vote, unless also set to votes:0)

### Use Cases for Hidden Members

```
┌─────────────────────────────────────────────────────────────┐
│                   Hidden Member Use Cases                    │
│                                                             │
│  1. DEDICATED REPORTING NODE                                │
│     Run heavy aggregation queries without impacting         │
│     production traffic. Since it's hidden, the app         │
│     driver won't accidentally route reads here.             │
│                                                             │
│  2. BACKUP NODE                                             │
│     Run mongodump or filesystem snapshots from a           │
│     hidden member without affecting the Primary.           │
│                                                             │
│  3. INTEGRATION TEST ENVIRONMENT                            │
│     Expose the hidden member to a test pipeline without    │
│     risk of it becoming the production primary.            │
└─────────────────────────────────────────────────────────────┘
```

### Configuring a Hidden Member

```js
cfg = rs.conf()

// Make member at index 2 hidden
cfg.members[2].priority = 0
cfg.members[2].hidden = true

rs.reconfig(cfg)

// Verify
rs.conf().members[2]
// { _id: 2, host: "mongo3:27017", priority: 0, hidden: true, ... }
```

### Connecting Directly to a Hidden Member

Even though drivers hide this member from connection routing, you can connect to it directly for admin tasks:

```bash
# Direct connection (bypasses replica set routing)
mongosh "mongodb://mongo3:27017/?directConnection=true"
```

### Hidden vs Non-Hidden Visibility

```
Client Driver Connection String:
  mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0

Driver discovers topology:
  mongo1 → PRIMARY   (visible, receives writes + possibly reads)
  mongo2 → SECONDARY (visible, can receive reads)
  mongo3 → HIDDEN    (NOT listed in isMaster/hello response — driver ignores)
```

> **Memory hook:** "A hidden member is on the payroll but not in the company directory — it does real work, but nobody calls it by accident."

---

## 10. Delayed Replicas

### What problem does this solve?

Every safeguard we've covered so far protects against a server dying. But what protects you against a *human* mistake — someone drops the wrong collection, or an application bug runs a destructive update across the whole database? Every Secondary faithfully replicates that mistake within seconds. Redundancy doesn't save you from replicating your own error everywhere, instantly.

A **delayed replica** (also called a **delayed secondary**) is the fix: it replicates data from the Primary but applies operations only after a configured time delay.

### Purpose

Delayed replicas provide a rolling **point-in-time recovery** window. If someone accidentally drops a collection or runs a destructive update, the delayed replica still has the data from before the mistake — as long as the delay is longer than the time it took to notice the problem.

### Real-World Analogy

A delayed replica is like a tape backup that was made an hour ago. Your live database might be corrupted right now, but the tape from an hour ago is clean.

### Configuration

```js
cfg = rs.conf()

// Set a 1-hour delay (in seconds)
cfg.members[3].priority = 0
cfg.members[3].hidden = true
cfg.members[3].secondaryDelaySecs = 3600  // 1 hour

rs.reconfig(cfg)

// Verify
rs.conf().members[3]
// {
//   _id: 3,
//   host: "mongo4:27017",
//   priority: 0,
//   hidden: true,
//   secondaryDelaySecs: 3600
// }
```

### Delay Sizes and Trade-offs

| Delay | Recovery Window | Lag Overhead | Use Case |
|-------|----------------|-------------|---------|
| 1 hour | 1 hour | High storage for oplog | Quick human-error recovery |
| 6 hours | 6 hours | Very large oplog needed | Business-hours mistake recovery |
| 24 hours | 24 hours | Massive oplog | Regulatory compliance / audit |

### Important Constraints

There are a few ways this configuration bites people if they're not careful:

```
1. secondaryDelaySecs must be smaller than the oplog window
   If oplog window = 24h and delay = 48h → the delayed member
   will fall off the oplog and require a full resync.

2. Delayed members should always have hidden: true
   Otherwise drivers might route reads to a 1-hour-old replica.

3. Delayed members still vote
   If you have 3 voting members and 1 is delayed, a failover
   could happen even while the delayed member is running.
   Set votes: 0 if the delayed member should not influence elections.
```

### Recovering From the Delayed Member

```bash
# 1. Stop the delayed member's mongod
# 2. Copy its data directory to a new instance
# 3. Start the new instance WITHOUT --replSet (standalone mode)
# 4. Perform your recovery operations
# 5. Export recovered data and import to production
```

**Interview answer:** "A delayed replica applies oplog entries after a fixed delay, effectively giving you a rolling point-in-time snapshot of the database. If a destructive operation happens on the Primary — an accidental drop, a bad bulk update — the delayed replica still holds the pre-mistake data as long as the delay window is longer than your detection time. It must always be hidden (so drivers never read stale data from it by accident), and its delay must stay within the oplog window or it'll fall off and need a full resync."

> **Memory hook:** "It's the security-camera footage from an hour ago — useless for right now, priceless the moment something goes wrong."

---

## 11. Under the Hood — How Sync Works

### Initial Sync

When a new member joins a replica set (or a member falls too far behind — recall the oplog window from Section 4), it can't just "catch up" incrementally anymore. It has to start over completely. That's an **initial sync**:

```
Initial Sync Process
─────────────────────────────────────────────────────────────
Step 1: Clone all databases from the sync source (usually Primary)
        - Copies all collection data
        - May take minutes to hours for large datasets

Step 2: Apply oplog entries that occurred during the clone
        - Catches up with writes that happened during Step 1
        - This is the "oplog catchup" phase

Step 3: Build indexes
        - Background index builds on the new member

Step 4: Transition to SECONDARY state
        - Member joins the set and begins normal replication
─────────────────────────────────────────────────────────────
```

### Ongoing Replication

Once a member is caught up, this is the steady-state loop it runs forever — the assistant continuously reading the manager's decision log:

```
┌──────────────────────────────────────────────────────────┐
│                  Ongoing Replication Loop                 │
│                                                          │
│  Secondary                                               │
│     │                                                    │
│     ├── 1. Query Primary oplog for entries newer than    │
│     │       its last applied timestamp                   │
│     │                                                    │
│     ├── 2. Pull batch of oplog entries (up to 16MB)      │
│     │                                                    │
│     ├── 3. Apply each entry to local storage engine      │
│     │       (WiredTiger)                                 │
│     │                                                    │
│     ├── 4. Update local oplog.rs with the entries        │
│     │                                                    │
│     └── 5. Update lastApplied / lastDurable timestamps   │
│                                                          │
│  Repeat continuously                                     │
└──────────────────────────────────────────────────────────┘
```

### Sync Source Selection

By default, MongoDB uses **chained replication** — a Secondary can sync from another Secondary instead of the Primary directly. Why would you want that? It reduces load on the Primary. The trade-off: it introduces an extra hop, so that Secondary is a little further behind than it would be syncing straight from the source.

```
With chaining:
Primary → Secondary1 → Secondary2
         (Secondary2 is one hop further behind)

Without chaining (chainingAllowed: false):
Primary → Secondary1
Primary → Secondary2
         (Both secondaries sync directly from Primary)
```

---

## 12. Hands-On Exercises

### Exercise 1 — Set Up a 3-Node Replica Set Locally

Start three `mongod` instances using Docker Compose (see Section 5). Connect to the first node and run `rs.initiate()` with all three members. Verify with `rs.status()` and confirm one member shows `"stateStr": "PRIMARY"`.

Expected outcome: `rs.status()` shows 3 members — 1 PRIMARY, 2 SECONDARY.

---

### Exercise 2 — Observe Oplog Entries

1. Connect to the PRIMARY and insert 5 documents into `testdb.items`.
2. Switch to the `local` database: `use local`
3. Run `db.oplog.rs.find({ ns: "testdb.items" }).sort({ $natural: -1 }).limit(5).pretty()`
4. Identify the `op` field for each entry (should all be `"i"` for insert).
5. Perform an update on one document and find the corresponding oplog entry. Note how the update is stored in idempotent form.

---

### Exercise 3 — Test Read Preferences

1. Connect to the replica set with a standard connection string.
2. Issue a `find()` query with `readPreference: "primary"` — note which host responds (use `db.runCommand({ isMaster: 1 })` to confirm).
3. Issue the same query with `readPreference: "secondary"`.
4. Simulate high load by running a `while` loop inserting documents and observe which nodes serve reads under `secondaryPreferred`.

---

### Exercise 4 — Configure a Hidden Member

1. Add a fourth member to your replica set.
2. Reconfigure it with `priority: 0` and `hidden: true`.
3. Connect an application with the replica set connection string.
4. Confirm the driver does not route reads to the hidden member (check connection pool stats or use a network sniffer).
5. Verify you can still connect directly with `directConnection=true`.

---

### Exercise 5 — Configure a Delayed Replica

1. Add a fifth member (or repurpose the hidden member from Exercise 4).
2. Set `secondaryDelaySecs: 300` (5 minutes), `priority: 0`, `hidden: true`.
3. Insert data to the PRIMARY and observe that the delayed member does NOT reflect the data for 5 minutes.
4. Check `rs.printSecondaryReplicationInfo()` and note the lag shown.
5. After 5 minutes, confirm the data appears on the delayed member.

---

## 13. Interview Q&A

**Q1: What is a Replica Set and why do we need it?**

A Replica Set is a group of MongoDB servers that maintain the same data. We need it for high availability (automatic failover), data redundancy (protection against data loss), and optionally for read scalability by distributing reads to Secondaries.

---

**Q2: What is the oplog?**

The oplog (operations log) is a special capped collection `local.oplog.rs` on the Primary that records every write operation. Secondaries continuously tail this collection and replay the operations to keep their data in sync with the Primary.

---

**Q3: Why is the oplog idempotent, and why does that matter?**

Idempotency means applying an operation multiple times produces the same result. This matters because if a Secondary crashes mid-replay and restarts, it can safely replay oplog entries from the last successfully applied position without corrupting data. MongoDB transforms operations (e.g., `$inc` becomes `$set` with the final value) to achieve idempotency.

---

**Q4: What happens if a Secondary falls behind the oplog window?**

If a Secondary goes offline longer than the oplog window (the time span covered by the capped oplog collection), it enters `RECOVERING` state and cannot catch up via normal oplog replication. It must perform a full **initial sync**, cloning all data from the Primary again.

---

**Q5: What is the difference between `priority` and `votes`?**

`priority` determines how likely a member is to win an election (higher = more preferred). `votes` determines whether a member can participate in an election at all. A member with `votes: 0` cannot vote but still replicates data. A member with `priority: 0` can vote but will never win an election (will not become primary).

---

**Q6: What is the difference between `secondaryPreferred` and `secondary` read preference?**

`secondary` routes all reads to Secondary nodes and will never use the Primary. If no Secondary is available, the read fails. `secondaryPreferred` routes reads to Secondaries when available but falls back to the Primary if all Secondaries are down. `secondaryPreferred` is safer for most use cases.

---

**Q7: Why would you use a hidden member?**

A hidden member is useful for dedicated analytics or reporting workloads, backup operations, or integration test environments. Because it is invisible to client drivers, it will never accidentally receive application traffic. It still replicates all data, giving you a full copy for reporting or backup purposes.

---

**Q8: What is the minimum recommended number of members in a Replica Set, and why?**

The recommended minimum is 3 members (or 2 data-bearing members + 1 arbiter). This ensures a majority quorum of at least 2 can always be reached even if 1 member fails. A 2-member set without an arbiter cannot elect a new Primary if one member fails.

---

**Q9: What is chained replication and what are the trade-offs?**

Chained replication allows a Secondary to sync from another Secondary rather than directly from the Primary. The benefit is reduced load on the Primary. The downside is increased replication lag on the chained Secondary (it is always one hop behind the Secondary it syncs from). You can disable it with `settings.chainingAllowed = false`.

---

**Q10: How does a delayed replica help with disaster recovery?**

A delayed replica applies oplog entries with a configured time delay (e.g., 1 hour). If a destructive operation (accidental drop, bad update) occurs on the Primary, the delayed replica still holds the data from before the mistake — as long as the delay window exceeds the time to detect the problem. You can use it as a point-in-time recovery source.

---

**Q11: What write concern should you use to ensure data is replicated before acknowledging a write?**

Use `{ w: "majority" }` write concern. This waits for the write to be applied to the majority of voting members (including the Primary) before returning success. For a 3-member set, this means 2 members must acknowledge the write.

---

**Q12: What is the difference between an Arbiter and a Secondary?**

A Secondary holds a full copy of the data, participates in elections, and can serve reads. An Arbiter holds NO data, participates in elections (contributes a vote), but cannot serve reads or become Primary. Arbiters are lightweight and exist only to provide an odd voting member count.

---

**Q13: How do you check replication lag for all members?**

Run `rs.printSecondaryReplicationInfo()` to see the replication lag for each Secondary. You can also use `rs.status()` and examine the `optimeDate` field for each member, comparing it to the Primary's optime.

---

**Q14: Can a read from a Secondary return stale data?**

Yes. Because Secondaries apply oplog entries asynchronously, there is always some potential lag. A read from a Secondary might not reflect writes that occurred very recently on the Primary. For use cases requiring the latest data, use `readPreference: "primary"`.

---

**Q15: How do you force a specific member to become Primary?**

You can use `rs.stepDown()` on the current Primary to trigger an election. To bias which member wins, increase its `priority` value relative to others before stepping down. You cannot directly "promote" a member; you can only influence election outcomes through priority settings and by stepping down the current Primary.
