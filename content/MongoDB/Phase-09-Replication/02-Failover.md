# 02 — Automatic Failover & Elections in MongoDB Replica Sets

## Table of Contents

1. [What Is Automatic Failover?](#1-what-is-automatic-failover)
2. [Failure Detection: How MongoDB Knows the Primary Is Gone](#2-failure-detection)
3. [Raft-Based Election Algorithm — Step by Step](#3-raft-based-election-algorithm)
4. [Who Becomes the New Primary?](#4-who-becomes-the-new-primary)
5. [Network Partitions and Split-Brain Prevention](#5-network-partitions)
6. [Rollback: What Happens to Uncommitted Writes](#6-rollback)
7. [Monitoring with rs.status()](#7-monitoring-with-rsstatus)
8. [rs.printReplicationInfo()](#8-rsprintreplicationinfo)
9. [Heartbeat Interval Configuration](#9-heartbeat-interval-configuration)
10. [The stepDown Command](#10-the-stepdown-command)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What Is Automatic Failover?

### The problem this solves

Picture the manager-and-assistants office from File 01. Every write goes through the manager (Primary), and the assistants (Secondaries) just keep their notebooks in sync. Now ask the obvious, uncomfortable question: what happens the moment the manager can't be reached anymore? Server crashed, network cable unplugged, VM rebooted mid-shift — doesn't matter why. The point is: nobody is left who's allowed to write the official decision log.

Without a plan for this, the office grinds to a halt. Every request that needs a decision just... waits. Forever, or until a human notices and manually appoints someone. That's the pain automatic failover exists to remove.

### The real-world analogy, continued

The assistants don't sit around waiting for HR to hire a new manager. They notice the manager has gone quiet, hold a quick meeting among themselves, agree on who has the most complete and up-to-date notebook, and that assistant becomes the new manager — all without a single human being involved.

That's exactly MongoDB's automatic failover: when the Primary goes silent for too long, the Secondaries detect it, elect one of themselves, and the replica set keeps accepting writes again — typically within seconds.

### Basic definition

**Automatic failover** is the process by which a MongoDB replica set detects that its Primary is unreachable and automatically elects a new Primary from the remaining eligible Secondaries, with no manual intervention required.

### Why it matters — the before/after picture

```
Without Failover:          With Automatic Failover:
─────────────────          ───────────────────────
Primary crashes            Primary crashes
      │                          │
      ▼                          ▼
Application errors         Detection (0-10s)
      │                          │
      ▼                          ▼
Manual intervention        Election (typically 12-30s total)
required                         │
      │                          ▼
Hours of downtime          New primary elected
                                 │
                                 ▼
                           Application reconnects
                           (driver handles automatically)
```

### Timeline of a typical failover

It helps to see the whole sequence laid out on a clock, start to finish:

```
t=0s    Primary crashes / becomes unreachable
t=2s    Secondaries notice heartbeat missed (first ping fails)
t=10s   electionTimeoutMillis expires — election triggered
t=10s   Secondaries call for election
t=12s   Election completes, new primary steps up
t=13s   New primary begins accepting writes
t=15s   Application driver detects topology change
t=15s   Writes resume on new primary
────────────────────────────────────────────────────────────
Total downtime: ~12-30 seconds (depends on network/config)
```

Worth noting up front, since it's a common misconception: failover is not instant. There's a real, measurable gap — usually low double-digit seconds — where the replica set has no Primary at all and writes simply fail. We'll unpack exactly why in the next two sections.

---

## 2. Failure Detection

### The problem

Before anyone can elect a new manager, the assistants first need a reliable way to notice the old one is actually gone — not just busy, not just slow to respond to one message, but genuinely unreachable. Detect too eagerly and you get false alarms (a manager who steps out for two minutes gets replaced mid-meeting). Detect too slowly and the office sits idle longer than it needs to.

### Heartbeat Mechanism

Each member of a replica set sends heartbeat pings to every other member every **2 seconds** (configurable via `heartbeatIntervalMillis`) — the same quick "you good?" check introduced in File 01. A heartbeat is a lightweight isMaster/hello command.

```
Replica Set: { PRIMARY, SECONDARY-1, SECONDARY-2 }

  PRIMARY ◄────────────────── SECONDARY-1
     │    ────────────────── ►     │
     │                             │
     │    ◄────────────────── SECONDARY-2
     └─── ────────────────── ►
     
  SECONDARY-1 ◄────────────── SECONDARY-2
              ────────────── ►

  Every 2 seconds: each node pings all others.
  If no response within electionTimeoutMillis (10s default),
  the node is declared unreachable.
```

### electionTimeoutMillis: the critical setting

This is the dial that decides "how many missed check-ins before we assume the manager isn't coming back."

```
Default: 10,000ms (10 seconds)

What it controls:
  - How long a secondary waits before calling for an election
  - Lower value = faster failover but more false positives
  - Higher value = slower failover but more resilient to network blips

┌─────────────────────────────────────────────────────────┐
│  electionTimeoutMillis = 10000 (default)                │
│                                                         │
│  Timeline:                                              │
│  0ms     - Primary stops responding                     │
│  0-2000ms - Secondaries attempt heartbeat pings         │
│  2000ms  - Heartbeat times out, retry                   │
│  10000ms - Election timeout reached                     │
│  10000ms - Secondary calls for election                 │
└─────────────────────────────────────────────────────────┘
```

### Configuring the timeout

```js
// View current replica set configuration
rs.conf()

// Change electionTimeoutMillis to 5 seconds (faster failover)
cfg = rs.conf()
cfg.settings.electionTimeoutMillis = 5000
rs.reconfig(cfg)
```

> **Memory hook:** "It's not one missed text that worries the assistants — it's ten straight seconds of silence."

---

## 3. Raft-Based Election Algorithm

MongoDB's election protocol is based on the **Raft consensus algorithm**, with MongoDB-specific extensions for priority, votes, and optime. This is the tricky part of the whole topic, so let's slow down and walk it step by step — who calls the meeting, who gets to vote, and how a winner is actually decided.

### Step-by-step election process

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTION ALGORITHM                           │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Primary becomes unreachable
─────────────────────────────────────────────────────────────────
  SECONDARY-1 and SECONDARY-2 both detect missing heartbeats.
  After electionTimeoutMillis, one of them calls for election.

STEP 2: Candidate announces itself
─────────────────────────────────────────────────────────────────
  SECONDARY-1 (or whichever has the highest priority/optime)
  transitions to CANDIDATE state and increments its term number.
  
  Term: a logical clock. Each election bumps the term by 1.
  Think of it as "election round 7" — everyone tracks this.

STEP 3: Candidate solicits votes
─────────────────────────────────────────────────────────────────
  Candidate sends VoteRequest to all other members:
  {
    term: 7,               // "I'm in election round 7"
    candidateId: "SEC-1",
    lastLogIndex: 10045,   // My most recent oplog entry index
    lastLogTerm: 6         // What term that entry was written in
  }

STEP 4: Other members evaluate the vote request
─────────────────────────────────────────────────────────────────
  Each member checks:
  a) Have I already voted in term 7? (can only vote once per term)
  b) Is the candidate's oplog as up-to-date as mine?
     - If candidate.lastLogTerm > mine → YES, vote granted
     - If candidate.lastLogTerm == mine AND candidate.lastLogIndex
       >= mine → YES, vote granted
     - Otherwise → NO, reject vote
  c) Is the candidate eligible (priority > 0)?

STEP 5: Candidate collects votes
─────────────────────────────────────────────────────────────────
  In a 3-member set, candidate needs 2 votes (majority of 3).
  In a 5-member set, candidate needs 3 votes.
  
  Formula: majority = floor(totalVotes / 2) + 1

STEP 6: Winner transitions to PRIMARY
─────────────────────────────────────────────────────────────────
  Once majority votes received:
  - Candidate becomes PRIMARY
  - Broadcasts its new role via heartbeats
  - Begins accepting writes
  - Issues "no-op" write to oplog to establish its primacy

STEP 7: Old primary (if it recovers) steps down
─────────────────────────────────────────────────────────────────
  If old primary comes back online:
  - It sees a higher term number in heartbeats
  - It recognizes it is no longer primary
  - It transitions to SECONDARY automatically
  - Begins catching up via oplog replication
```

Notice the shape of this: it's exactly the office meeting from the analogy, just spelled out formally. Step 3-4 is "whoever wants to be the new manager has to prove their notebook is as complete as everyone else's" — nobody votes for a candidate who's obviously behind.

### Term numbers: the logical clock

Think of the "term" as simply "which election round are we on" — a number that only ever goes up, never resets, and lets every member instantly tell whose information is more recent.

```
Before failure:
  All members: term = 6, PRIMARY = Node A

Node A crashes:
  Node B calls election → term = 7
  Node B wins → PRIMARY = Node B, term = 7

Node A recovers:
  Node A has term = 6
  First heartbeat from Node B has term = 7
  Node A: "I see a higher term, I must step down"
  Node A becomes SECONDARY, syncs oplog from Node B
```

### Election timing: why secondaries don't all vote at once

Here's a subtlety worth calling out: if both assistants tried to call the meeting at the exact same instant, you could end up with a tied vote and nobody winning. MongoDB avoids this with randomized election timers:

```
When primary disappears:
  SECONDARY-1 waits: 150ms (random)
  SECONDARY-2 waits: 350ms (random)

  SECONDARY-1 calls election first → usually wins before
  SECONDARY-2 even starts campaigning.
  
  This randomization prevents two nodes from simultaneously
  calling elections and splitting the vote 1:1.
```

> **Memory hook:** "Term number is just the meeting's agenda number — a higher number always means a more recent decision, and anyone stuck on an old number knows to step aside."

---

## 4. Who Becomes the New Primary?

Not every assistant is an equally good candidate for manager. Three factors determine electability, in priority order.

### Factor 1: Priority score

```
Priority is set in rs.conf() per member. Range: 0 to 1000.
Default: 1

┌─────────────────────────────────────────────────────────┐
│  Members with priority = 0 are NEVER elected primary    │
│  (useful for hidden members, analytics replicas)        │
│                                                         │
│  Members with higher priority are preferred when their  │
│  oplog is sufficiently up-to-date.                      │
└─────────────────────────────────────────────────────────┘

Example config:
  { host: "mongo1:27017", priority: 2 }   ← preferred primary
  { host: "mongo2:27017", priority: 1 }   ← backup
  { host: "mongo3:27017", priority: 0 }   ← never primary (analytics)
```

### Factor 2: Most up-to-date optime

Priority alone isn't enough, though — you don't want to promote the assistant with the fanciest title if their notebook is missing the last twenty minutes of entries.

```
optime = the timestamp of the last oplog entry applied

Member A: optime = { ts: Timestamp(1700000050, 1), t: 6 }
Member B: optime = { ts: Timestamp(1700000030, 1), t: 6 }

Member A is 20 seconds ahead → Member A wins the vote
even if priority is equal.

WHY: You don't want to elect a stale secondary as primary —
it would miss 20 seconds of writes that would then need rollback.
```

### Factor 3: Network reachability (quorum)

And finally, it doesn't matter how senior or how caught-up a candidate is if the rest of the office can't actually reach them.

```
For a node to win, it must be reachable by a MAJORITY:

5-node set, partition splits into {A, B} and {C, D, E}:

  {A, B} side:
    - Can reach 2 nodes (not majority of 5)
    - Cannot elect a primary
    - Stays in read-only mode

  {C, D, E} side:
    - Can reach 3 nodes (majority of 5)
    - CAN elect a primary
    - Continues serving reads AND writes

This is the "majority quorum" rule — prevents split-brain.
```

### Eligibility summary table

| Condition | Effect on Election |
|-----------|-------------------|
| priority = 0 | Never becomes primary |
| priority > 1 | Preferred over priority = 1 members |
| optime behind by > 10s | Less likely to win vs up-to-date node |
| Cannot reach majority | Cannot win election |
| votes = 0 | Cannot vote (non-voting member) |
| hidden = true | Cannot become primary |
| arbiter | Can vote but never becomes primary |

> **Memory hook:** "Rank breaks ties, but nobody promotes the assistant whose notebook is behind — and nobody gets promoted if the rest of the office can't even reach them."

---

## 5. Network Partitions

### The Split-Brain Problem

Here's the nightmare scenario this whole majority-quorum rule exists to prevent: imagine the office building's phone line gets cut, splitting it into two groups who can no longer talk to each other. If both groups independently decided "our old manager is gone, let's promote someone," you'd end up with **two managers**, each confidently writing their own decision log, with no way to reconcile them later. That's split-brain, and it's exactly the kind of data divergence a database absolutely cannot allow.

```
Without quorum protection:

  ┌──────────────┐    Network   ┌──────────────┐
  │   Node A     │    Split     │   Node B     │
  │  (was PRIMARY)│ ─── X ─── │  (SECONDARY) │
  └──────────────┘              └──────────────┘

  Without quorum: Node B might elect itself primary.
  Now you have TWO primaries accepting writes → DATA DIVERGENCE.

With MongoDB's majority quorum:
  Node A: only 1/2 members reachable → stays primary (has quorum)
  Node B: only 1/2 members reachable → cannot elect (no quorum)

  In a 2-node set you ALWAYS need an arbiter or 3rd node
  to ensure majority is achievable after a failure.
```

### 3-Node Set Partition Scenarios

```
Scenario 1: 2 nodes on one side
─────────────────────────────────
  {A-PRIMARY, B} | {C}
  
  Left side: 2/3 = majority → keeps primary or can elect
  Right side: 1/3 = not majority → read-only

Scenario 2: Even split impossible in odd-sized sets
────────────────────────────────────────────────────
  This is why MongoDB recommends ODD numbers of voting members.
  3-node, 5-node, 7-node sets.

  With 4 voting members: a 2/2 split = no majority on either side
  → total write outage until partition heals.
  Always use 3, 5, or 7 voting members.
```

**Common mistake:** assuming any 3 (or 5, or 7) node replica set automatically survives every partition gracefully. It only works if voting members stay at an odd count. Add a 4th voting member without thinking it through, and you've just created a scenario where a clean 2-2 split leaves nobody able to elect anyone — a full write outage until the network heals, even though nothing actually "failed."

> **Memory hook:** "Never let a tie be possible — an office that can split 50/50 can end up with two managers, or none at all."

---

## 6. Rollback

### What Is Rollback and When Does It Happen?

Here's a scenario the analogy makes obvious: suppose the old manager wrote something in their private notes, but never got the chance to read it aloud to the assistants before vanishing. That entry never made it into anyone else's notebook. When the old manager comes back and rejoins as an assistant, that private, unshared note simply doesn't exist as far as the rest of the office is concerned — and it has to be discarded.

That's rollback: it occurs when a primary writes data that never reached a majority of members, then crashes. When it comes back online as a secondary, it discovers those writes are not in the new primary's oplog.

```
SCENARIO:
─────────────────────────────────────────────────────────
t=0   Primary A writes document { _id: 101, order: "pizza" }
t=0   Write NOT yet replicated to any secondary
t=1   Primary A crashes
t=10  Election: Secondary B becomes new primary
t=15  Application writes { _id: 102, order: "burger" } to B
t=30  Old Primary A comes back online
      A's oplog: [..., { _id: 101, order: "pizza" }]
      B's oplog: [..., { _id: 102, order: "burger" }]
      A's write was never majority-committed!

RESULT: A must roll back { _id: 101 }
```

### The Rollback Process

```
┌─────────────────────────────────────────────────────────────┐
│                    ROLLBACK STEPS                           │
└─────────────────────────────────────────────────────────────┘

1. Recovering node (old primary) connects to new primary
2. Finds the common oplog point (last shared operation)
3. Identifies all writes AFTER the common point that are
   NOT in the new primary's oplog
4. Writes rolled-back documents to:
   <dbpath>/rollback/<collection>.<timestamp>.bson
5. Removes those documents from its own data
6. Reapplies the new primary's oplog from the common point
7. Node becomes a healthy secondary

The rollback/ folder files are BSON files — you can examine
them with bsondump and manually recover data if needed.
```

### Finding and Recovering Rolled-Back Writes

```bash
# Find rollback files (run on the node that did rollback)
ls /var/lib/mongodb/rollback/

# Output might look like:
# orders.2023-11-15T14-30-00.0.bson

# Inspect rolled-back documents
bsondump /var/lib/mongodb/rollback/orders.2023-11-15T14-30-00.0.bson

# Output example:
# {"_id":{"$oid":"655455..."},"order":"pizza","status":"pending"}

# Restore if appropriate (after human review)
mongorestore --db myapp --collection orders \
  /var/lib/mongodb/rollback/orders.2023-11-15T14-30-00.0.bson
```

### Preventing Data Loss: Write Concern w:majority

The good news: you're not powerless here. You can simply tell MongoDB "don't confirm this write to my application until it's actually safe from rollback."

```js
// Without majority write concern (risky):
db.orders.insertOne(
  { order: "pizza", status: "pending" },
  { writeConcern: { w: 1 } }  // Only waits for primary to acknowledge
)
// If primary crashes before replicating → THIS GETS ROLLED BACK

// With majority write concern (safe):
db.orders.insertOne(
  { order: "pizza", status: "pending" },
  { writeConcern: { w: "majority", wtimeout: 5000 } }
)
// Waits until majority of replica set has the write
// If primary crashes after this → write is SAFE, will not roll back
```

### Rollback Size Limit

```
MongoDB has a default rollback limit of 300MB.
If a node has more than 300MB of writes to roll back,
MongoDB will refuse to perform automatic rollback.

You'll see this in the logs:
  "too much data to rollback"

In this case, you must:
1. Shut down the node
2. Perform an initial sync (resync from scratch)
   rs.resync()  -- or wipe dbpath and restart
```

**Common mistake:** assuming `w: 1` (the default) is "safe enough" because the primary acknowledged the write. It isn't — that acknowledgment only means the manager wrote it in their own private notes, not that any assistant has copied it down yet. If you care about a write surviving a crash, use `w: "majority"`.

> **Memory hook:** "If the manager never got to announce it out loud, it never really happened — from the office's point of view."

---

## 7. Monitoring with rs.status()

### Running rs.status()

```js
rs.status()
```

### Annotated rs.status() Output

```json
{
  "set": "myReplicaSet",              // Replica set name
  "date": "2023-11-15T14:00:00Z",     // Current time on this node
  "myState": 1,                       // 1=PRIMARY, 2=SECONDARY, etc.
  "term": 7,                          // Current election term
  "syncSourceHost": "",               // Empty if this IS the primary
  "syncSourceId": -1,
  "heartbeatIntervalMillis": 2000,    // How often heartbeats fire
  "majorityVoteCount": 2,             // Votes needed for majority
  "writeMajorityCount": 2,
  "votingMembersCount": 3,
  "writableVotingMembersCount": 2,
  
  "members": [
    {
      "_id": 0,
      "name": "mongo1:27017",
      "health": 1,                    // 1=healthy, 0=unreachable
      "state": 1,                     // 1=PRIMARY
      "stateStr": "PRIMARY",
      "uptime": 86400,                // Seconds this member has been up
      "optime": {
        "ts": Timestamp(1700056800, 1),
        "t": 7                        // Election term of this optime
      },
      "optimeDate": "2023-11-15T14:00:00Z",
      "lastAppliedWallTime": "2023-11-15T14:00:00Z",
      "lastDurableWallTime": "2023-11-15T14:00:00Z",
      "syncSourceHost": "",
      "syncSourceId": -1,
      "infoMessage": "",
      "electionTime": Timestamp(1700056200, 1),  // When elected
      "electionDate": "2023-11-15T13:50:00Z",
      "configVersion": 1,
      "configTerm": 7,
      "self": true,                   // This is the node you're on
      "lastHeartbeatMessage": ""
    },
    {
      "_id": 1,
      "name": "mongo2:27017",
      "health": 1,
      "state": 2,                     // 2=SECONDARY
      "stateStr": "SECONDARY",
      "uptime": 86300,
      "optime": {
        "ts": Timestamp(1700056798, 1),
        "t": 7
      },
      "optimeDate": "2023-11-15T13:59:58Z",
      // Note: 2 seconds behind primary's optime — normal replication lag
      "optimeDurable": {
        "ts": Timestamp(1700056798, 1),
        "t": 7
      },
      "optimeDurableDate": "2023-11-15T13:59:58Z",
      "lastHeartbeatRecv": "2023-11-15T14:00:01Z",
      "lastHeartbeatMessage": "",
      "syncSourceHost": "mongo1:27017",  // Syncing from primary
      "syncSourceId": 0,
      "configVersion": 1,
      "configTerm": 7
    },
    {
      "_id": 2,
      "name": "mongo3:27017",
      "health": 0,                    // UNHEALTHY!
      "state": 8,                     // 8=DOWN
      "stateStr": "(not reachable/healthy)",
      "uptime": 0,
      "optime": {
        "ts": Timestamp(0, 0),
        "t": -1
      },
      "optimeDurableDate": "1970-01-01T00:00:00Z",
      "lastHeartbeat": "2023-11-15T14:00:00Z",
      "lastHeartbeatRecv": "2023-11-15T13:58:30Z",  // Last seen 90s ago!
      "lastHeartbeatMessage": "Error connecting to mongo3:27017",
      "configVersion": -1,
      "configTerm": -1
    }
  ],
  "ok": 1
}
```

### State Codes Reference

| State Code | State String | Meaning |
|-----------|--------------|---------|
| 0 | STARTUP | Starting up, loading config |
| 1 | PRIMARY | Accepting reads and writes |
| 2 | SECONDARY | Replicating from primary |
| 3 | RECOVERING | Catching up / initial sync |
| 5 | STARTUP2 | Initial sync in progress |
| 6 | UNKNOWN | Cannot reach member |
| 7 | ARBITER | Voting only, no data |
| 8 | DOWN | Member is down/unreachable |
| 9 | ROLLBACK | Currently rolling back |
| 10 | REMOVED | Removed from replica set |

### Key Things to Check in rs.status()

```
┌────────────────────────────────────────────────────────────┐
│  HEALTH CHECKLIST                                          │
├────────────────────────────────────────────────────────────┤
│  1. Exactly one member with state: 1 (PRIMARY)            │
│  2. All members health: 1                                  │
│  3. Replication lag < acceptable threshold                 │
│     (optimeDate difference between PRIMARY and SECONDARY)  │
│  4. No member in state 8 (DOWN) or 9 (ROLLBACK)           │
│  5. syncSourceHost is sensible (not syncing in loops)     │
└────────────────────────────────────────────────────────────┘
```

### Calculating Replication Lag from rs.status()

```js
// Quick way to check replication lag
var status = rs.status()
var primary = status.members.find(m => m.state === 1)
var secondaries = status.members.filter(m => m.state === 2)

secondaries.forEach(sec => {
  var lagMs = primary.optimeDate - sec.optimeDate
  print(sec.name + " lag: " + lagMs + "ms")
})
```

---

## 8. rs.printReplicationInfo()

### What It Shows

`rs.printReplicationInfo()` displays information about the **oplog** — the same decision log from File 01, the capped collection that stores all write operations for replication purposes.

```js
rs.printReplicationInfo()
```

### Sample Output Annotated

```
configured oplog size:   1024MB           ← Max size of oplog
log length start to end: 86400 secs (24 hrs)  ← How far back oplog goes
oplog first event time:  Wed Nov 14 2023 14:00:00 GMT  ← Oldest entry
oplog last event time:   Thu Nov 15 2023 14:00:00 GMT  ← Newest entry
now:                     Thu Nov 15 2023 14:00:05 GMT
```

### Why Oplog Window Matters

```
┌─────────────────────────────────────────────────────────────┐
│                   OPLOG WINDOW ANALOGY                      │
│                                                             │
│  Think of the oplog as a DVR recording.                     │
│  It records the last N hours of writes.                     │
│                                                             │
│  If a secondary falls behind more than the oplog window,   │
│  it CANNOT sync incrementally — it must do a full           │
│  initial sync (like wiping the DVR and starting fresh).    │
│                                                             │
│  Example:                                                   │
│  Oplog window: 24 hours                                     │
│  Secondary was down for: 36 hours                           │
│  Result: Secondary needs initial sync                       │
│                                                             │
│  Solution: increase oplog size on high-write systems        │
└─────────────────────────────────────────────────────────────┘
```

### Changing Oplog Size

```js
// MongoDB 3.6+ — change oplog size online
db.adminCommand({ replSetResizeOplog: 1, size: 2048 })  // 2GB
```

### rs.printSecondaryReplicationInfo()

```js
// Shows lag info for each secondary
rs.printSecondaryReplicationInfo()

// Sample output:
// source: mongo2:27017
//   syncedTo: Thu Nov 15 2023 13:59:58 GMT
//   0 secs (0 hrs) behind the primary
// source: mongo3:27017
//   syncedTo: Thu Nov 15 2023 13:55:00 GMT
//   298 secs (0.08 hrs) behind the primary   ← 5 min lag! Investigate.
```

---

## 9. Heartbeat Interval Configuration

### Default Settings

```
heartbeatIntervalMillis: 2000   (2 seconds between heartbeats)
electionTimeoutMillis:   10000  (10 seconds before triggering election)
heartbeatTimeoutSecs:    10     (timeout waiting for heartbeat response)
```

### How to Change Them

```js
cfg = rs.conf()

// Make heartbeats faster (reduces failover time but increases network traffic)
cfg.settings.heartbeatIntervalMillis = 1000   // 1 second
cfg.settings.electionTimeoutMillis = 5000     // 5 second election timeout

rs.reconfig(cfg)
```

### Trade-off Table

| Setting | Lower Value | Higher Value |
|---------|-------------|--------------|
| heartbeatIntervalMillis | Faster failure detection, more network traffic | Slower detection, less network load |
| electionTimeoutMillis | Faster failover, more false elections | Slower failover, more stable |
| heartbeatTimeoutSecs | Faster timeouts, more sensitive to network jitter | More tolerant of slow networks |

### Relationship Between Settings

It's easy to tweak one of these numbers in isolation and not realize how they chain together into the total downtime figure from Section 1. Here's the full chain:

```
Detection → Election → Recovery Timeline:

  heartbeatIntervalMillis = 2000ms
      │
      ▼
  First missed heartbeat detected at 2s
      │
      ▼
  electionTimeoutMillis = 10000ms
      │
      ▼
  After 10s without response → candidate calls election
      │
      ▼
  Election takes ~1-2 heartbeat cycles = 2-4s
      │
      ▼
  Total: ~12-14 seconds from crash to new primary ready

  With lower settings (heartbeat=500ms, election=2000ms):
  Total: ~3-5 seconds (much faster but more risk of false elections)
```

**Common mistake:** tuning `electionTimeoutMillis` down aggressively (say, to 1-2 seconds) to chase faster failover, without accounting for normal network jitter. A brief GC pause or a slow disk flush on the primary can then trigger a completely unnecessary election — swapping out a perfectly healthy manager because they were a second late to a check-in.

> **Memory hook:** "Total downtime is detection time plus election time — shaving either number shaves the total, but shave too hard and you start firing managers who were just momentarily busy."

---

## 10. The stepDown Command

### What stepDown Does

Sometimes you don't want to wait for an emergency — you want to plan the handover. `rs.stepDown()` gracefully steps down the current primary to a secondary, triggering an election on your own terms rather than after a crash. Use this for:
- Planned maintenance
- Upgrading the primary node
- Moving primary to a different data center
- Testing failover without killing a process

```js
// Step down for 60 seconds (default)
rs.stepDown()

// Step down for 120 seconds, wait up to 10s for secondaries to catch up
rs.stepDown(120, 10)
// Parameters: (stepDownSecs, secondaryCatchUpPeriodSecs)
```

### What Happens When You Call stepDown

Unlike a crash, a stepDown gives everyone advance notice — think of it as the manager announcing "I'm stepping down at the end of this meeting, please make sure someone's notebook is caught up first":

```
┌─────────────────────────────────────────────────────────────┐
│                    stepDown SEQUENCE                        │
└─────────────────────────────────────────────────────────────┘

1. MongoDB checks: is any secondary within 10 seconds of primary?
   (If no secondary is caught up, stepDown is rejected)

2. Primary stops accepting new writes

3. Waits for at least one secondary to catch up to its optime
   (up to secondaryCatchUpPeriodSecs, default 10s)

4. Primary transitions to SECONDARY state

5. Other members detect state change via heartbeat

6. An eligible secondary calls an election

7. New primary is elected (usually within 10-20 seconds)

8. Application reconnects via driver topology discovery
```

### Force stepDown (even if no secondary is caught up)

```js
// Force step down even without a caught-up secondary
// USE WITH CAUTION — could elect a stale secondary
rs.stepDown(60, 0)  // secondaryCatchUpPeriodSecs = 0

// Or via admin command with force:
db.adminCommand({
  replSetStepDown: 60,
  secondaryCatchUpPeriodSecs: 0,
  force: true
})
```

### Preventing stepDown During Critical Operations

```js
// On application side: use sessions with causalConsistency
// to ensure reads after a primary switch see the latest data
const session = client.startSession({ causalConsistency: true })
const result = await collection.findOne({}, { session })
session.endSession()
```

**Common mistake:** treating `rs.stepDown()` as instantaneous just because it's a deliberate, planned action rather than a crash. It still has to wait for a secondary to catch up and still triggers a real election — the application still experiences a short write gap, just a safer and more predictable one than a crash-triggered failover.

> **Memory hook:** "A planned handover still takes a minute to hand over the notebook properly — 'graceful' doesn't mean 'instant.'"

---

## 11. Hands-On Exercises

### Exercise 1: Simulate Failover in a Local 3-Node Replica Set

**Objective:** Watch automatic failover happen in real time.

```bash
# Start 3 mongod instances on different ports
mkdir -p /tmp/rs/{rs0,rs1,rs2}

mongod --replSet myRS --port 27017 --dbpath /tmp/rs/rs0 --fork --logpath /tmp/rs/rs0/mongod.log
mongod --replSet myRS --port 27018 --dbpath /tmp/rs/rs1 --fork --logpath /tmp/rs/rs1/mongod.log
mongod --replSet myRS --port 27019 --dbpath /tmp/rs/rs2 --fork --logpath /tmp/rs/rs2/mongod.log

# Connect and initiate the replica set
mongosh --port 27017
```

```js
rs.initiate({
  _id: "myRS",
  members: [
    { _id: 0, host: "localhost:27017", priority: 2 },
    { _id: 1, host: "localhost:27018", priority: 1 },
    { _id: 2, host: "localhost:27019", priority: 1 }
  ]
})

// Wait for election, then check status
rs.status()

// Insert some data
use testdb
for (let i = 0; i < 100; i++) {
  db.items.insertOne({ n: i, t: new Date() })
}
```

```bash
# Now kill the primary (find the PID of port 27017)
kill $(lsof -t -i:27017)

# Watch in another terminal — connect to port 27018
mongosh --port 27018
```

```js
// Watch the election happen
while (true) {
  let s = rs.status()
  print(new Date(), s.myState, s.members.map(m => m.stateStr).join(", "))
  sleep(1000)
}
```

**Expected outcome:** Within 15 seconds, one of the secondaries becomes PRIMARY.

---

### Exercise 2: Observe and Force Rollback

**Objective:** Understand what gets rolled back and where rollback files appear.

```js
// On primary: write with w:1 (not majority)
db.criticalData.insertOne(
  { msg: "this might get rolled back", ts: new Date() },
  { writeConcern: { w: 1 } }
)

// Immediately kill the primary before it replicates
// (In a real test: kill mongod PID right after insert)
```

```bash
# On the node that comes back as secondary:
ls /var/lib/mongodb/rollback/
bsondump /var/lib/mongodb/rollback/criticalData.*.bson
```

**Expected outcome:** The document appears in the rollback folder.

---

### Exercise 3: Read and Interpret rs.status() Output

**Objective:** Practice diagnosing replica set health from rs.status() output.

```js
// Connect to any member and run:
let s = rs.status()

// Write a diagnostic function
function diagnoseRS(status) {
  let primary = status.members.find(m => m.state === 1)
  let secondaries = status.members.filter(m => m.state === 2)
  let down = status.members.filter(m => m.health === 0)
  
  print("=== Replica Set Health Report ===")
  print("Primary: " + (primary ? primary.name : "NO PRIMARY!"))
  print("Secondaries: " + secondaries.map(s => s.name).join(", "))
  print("Down members: " + (down.length > 0 ? down.map(d => d.name).join(", ") : "None"))
  
  if (primary) {
    secondaries.forEach(sec => {
      let lagSecs = (primary.optimeDate - sec.optimeDate) / 1000
      print("Replication lag for " + sec.name + ": " + lagSecs + "s")
      if (lagSecs > 30) print("  WARNING: lag exceeds 30 seconds!")
    })
  }
  
  print("Election term: " + status.term)
}

diagnoseRS(rs.status())
```

---

### Exercise 4: Test Priority-Based Elections

**Objective:** Confirm that priority controls which secondary becomes primary.

```js
// Change priority so mongo3 is the preferred primary
cfg = rs.conf()
cfg.members[0].priority = 1   // mongo1
cfg.members[1].priority = 1   // mongo2
cfg.members[2].priority = 3   // mongo3 — HIGHEST PRIORITY
rs.reconfig(cfg)

// Now step down the current primary
rs.stepDown()

// Check who won the election
rs.status()
// Expected: mongo3 should be the new primary (highest priority)
```

---

### Exercise 5: Monitor Oplog Window and Simulate Stale Secondary

**Objective:** Understand when a secondary needs initial sync.

```js
// Check current oplog window
rs.printReplicationInfo()

// Simulate high write load to shrink the oplog window
for (let i = 0; i < 100000; i++) {
  db.flood.insertOne({ n: i, data: "x".repeat(1000) })
}

// Temporarily pause a secondary (SIGSTOP in Linux)
// db.adminCommand({ replSetMaintenance: true })  -- on secondary node

// Check if secondary fell behind
rs.printSecondaryReplicationInfo()

// If the secondary's lag exceeds the oplog window, it needs resync:
// On the secondary node:
db.adminCommand({ resync: 1 })
```

---

## 12. Interview Q&A

**Q1: What triggers an automatic failover in MongoDB?**
A: When a primary becomes unreachable for longer than `electionTimeoutMillis` (default 10 seconds), the secondaries call an election. The first secondary to reach the candidacy threshold solicits votes from other members. A majority of votes is required to win.

**Q2: How does MongoDB prevent two nodes from both becoming primary (split-brain)?**
A: MongoDB requires a strict majority of voting members to elect a primary. In a 3-node set, this means 2 votes. If a network partition splits the set into groups of 1 and 2, only the group of 2 has majority and can elect a primary. The single node becomes read-only.

**Q3: What is the Raft protocol and how does MongoDB use it?**
A: Raft is a consensus algorithm ensuring all nodes agree on the same sequence of log entries. MongoDB's replica set elections are based on Raft. Each election is assigned a "term" (logical clock). Nodes can only vote once per term. The candidate with the most up-to-date oplog and highest priority wins.

**Q4: What is optime and why does it matter in elections?**
A: Optime is the timestamp of the last oplog entry a member has applied. During elections, a candidate must have an optime at least as recent as any voter's optime — otherwise the voter rejects the request. This ensures the elected primary has all majority-committed writes.

**Q5: What is rollback and when does it happen?**
A: Rollback occurs when a primary has writes that were never replicated to a majority, then crashes. When it comes back online as a secondary, those writes conflict with the new primary's oplog. MongoDB automatically rolls back those writes and saves them to the `rollback/` folder in BSON format for manual inspection.

**Q6: How can you prevent data loss during a primary failure?**
A: Use `writeConcern: { w: "majority" }` for critical writes. This ensures the write is acknowledged only after a majority of replica set members have persisted it. Such writes will NOT be rolled back even if the primary fails immediately after acknowledgment.

**Q7: What is the rollback size limit and what happens if it's exceeded?**
A: The default limit is 300MB. If a node has more than 300MB of writes to roll back, MongoDB refuses automatic rollback and logs "too much data to rollback". The solution is to perform an initial sync by wiping the node's dbpath and restarting, which re-copies all data from the sync source.

**Q8: How does rs.stepDown() differ from killing the primary process?**
A: `rs.stepDown()` is a graceful operation — it waits for a secondary to catch up, stops accepting writes cleanly, and transitions to secondary state. Killing the process is abrupt — in-flight operations are interrupted, clients get connection errors, and there may be partially written data that needs rollback.

**Q9: What is a priority-0 member used for?**
A: Priority-0 members never become primary but participate in elections by voting. Common use cases include: dedicated analytics/reporting replicas (you don't want these to become primary), members in a different data center (prefer local primary), and hidden members used for backup.

**Q10: How do you see replication lag for each secondary?**
A: Run `rs.printSecondaryReplicationInfo()` for a quick summary. For more detail, use `rs.status()` and compare `optimeDate` between the primary (state: 1) and each secondary (state: 2). The difference in seconds is the replication lag.

**Q11: What is the oplog window and why does it matter?**
A: The oplog is a capped collection that stores the last N hours of write operations. If a secondary falls behind more than the oplog window, it cannot catch up incrementally and must perform a full initial sync. On write-heavy systems, you should monitor the oplog window with `rs.printReplicationInfo()` and increase oplog size if needed.

**Q12: Can you have a 2-node replica set?**
A: Technically yes, but it's not recommended. A 2-node set cannot maintain a majority if either node is unreachable (1 out of 2 is not a majority). The standard solution is to add a 3rd voting member (even an arbiter) to allow majority elections. An arbiter votes but holds no data.

**Q13: What state codes indicate a problem in rs.status()?**
A: State 8 (DOWN) and state 6 (UNKNOWN) indicate a member is unreachable. State 9 (ROLLBACK) indicates a node is currently rolling back writes. State 3 (RECOVERING) typically means a node is catching up after a restart — this is normal and transient.

**Q14: What happens if you call rs.stepDown() and no secondary is caught up?**
A: By default, MongoDB waits up to 10 seconds (secondaryCatchUpPeriodSecs) for a secondary to catch up. If none catch up in that time, the stepDown fails with an error. You can force it with `force: true` or set `secondaryCatchUpPeriodSecs: 0`, but this may elect a stale secondary.

**Q15: How does heartbeatIntervalMillis affect failover speed?**
A: Lower values mean faster failure detection (secondaries notice the primary is gone sooner) but more network traffic. Higher values mean slower detection but less background chatter. The total failover time is roughly `electionTimeoutMillis` + one election cycle (~2-4 seconds), so reducing `electionTimeoutMillis` has more impact than reducing `heartbeatIntervalMillis`.

---

*Phase 9, File 2 of 2 — MongoDB Replication Series*
*See also: 01-Replica-Sets-Setup.md for initial configuration*
