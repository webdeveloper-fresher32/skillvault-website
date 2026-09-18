# Replication Topologies — Complete Guide

> "A restaurant chain keeps the same recipe binder in every kitchen — the trouble starts the moment two kitchens are each allowed to edit their own copy."

---

## Table of Contents

1. [The Problem: One Copy Is One Failure Away](#1-the-problem-one-copy-is-one-failure-away)
2. [The Recipe Binder Analogy](#2-the-recipe-binder-analogy)
3. [The Mechanism: Three Replication Topologies](#3-the-mechanism-three-replication-topologies)
4. [Diagram: A Write Travelling Through a Single-Leader Cluster](#4-diagram-a-write-travelling-through-a-single-leader-cluster)
5. [Code Walkthrough: Replication Lag Anomalies as Timelines](#5-code-walkthrough-replication-lag-anomalies-as-timelines)
6. [Comparing Synchronous Replication to Asynchronous Replication](#6-comparing-synchronous-replication-to-asynchronous-replication)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: One Copy Is One Failure Away

Replication means keeping the same data on more than one machine. People reach for it for four different reasons, and those reasons do not want the same design.

### One Node and Four Goals That Pull Apart

```text
Single node holding the `orders` table:
  Availability  → node reboots for a kernel patch, the whole app is down
  Read scale    → 40,000 reads/sec land on one disk and one page cache
  Locality      → a customer in Sydney pays 280 ms per query to us-east-1
  Durability    → the disk dies, and the only copy dies with it
Add three replicas and each goal pulls a different way:
  Durability wants the write on every replica before acknowledging
  Latency wants the write acknowledged by the leader alone
```

### What's Missing

Copying bytes to another machine is the easy half. What is missing is a rule for where writes are allowed to happen — one node, several nodes, or any node — because that single choice decides whether conflicts can exist at all, and everything else in this lesson follows from it.

---

## 2. The Recipe Binder Analogy

A restaurant chain prints the same recipe binder for every kitchen. If head office is the only place allowed to change a recipe and every kitchen receives the printed update, the binders differ only by how recently the courier arrived. If instead each kitchen is allowed to scribble in its own binder, two kitchens can change the same recipe on the same day in different directions, and no courier can fix that.

### Head Office Edits vs Kitchen Edits

```text
Head office only  → one authoritative binder; a kitchen may be hours
                    behind, but never contradicts another kitchen
Any kitchen edits → edits land instantly, close to the cook, and work
                    while the courier is stuck — but two kitchens can
                    now hold contradictory pages for one recipe
```

### Mapping the Analogy to Replication

Head office is the leader; the courier is the replication stream; the delay between print and delivery is replication lag. Letting every kitchen edit is multi-leader replication, and the contradictory pages are write conflicts, which someone must resolve.

---

## 3. The Mechanism: Three Replication Topologies

The topology is defined by which nodes are allowed to accept a write.

### Single-Leader Replication

```text
   client ───── all writes ─────► LEADER (node A)
                                    │  replication stream: an ordered
                    ┌───────────────┼──────┐   log of every change
                    ▼               ▼      ▼
              FOLLOWER B     FOLLOWER C   FOLLOWER D
                    └─── reads may be served by any node ───┘
Failover: leader A dies → promote B → clients redirected to B
  ↳ If A returns still believing it is leader and some clients still
    point at it, two nodes accept writes for the same rows. That is
    split-brain, and it produces conflicts a single-leader system has
    no resolution logic for. Fencing — forcing the old leader to step
    down or be powered off — exists to prevent it.
```

### Multi-Leader Replication and Write Conflicts

```text
  us-east LEADER  ◄────── bidirectional replication ──────►  eu-west LEADER

  t0  user edits product 55 title in us-east → "Trail Runner v2"
  t0  colleague edits it in eu-west          → "Trail Runner II"
  t1  both replicate — each node sees a value it did not write
Resolution strategies:
  Last-write-wins  → keep the row with the highest timestamp
    ↳ Silently discards the other write, and two machines' wall clocks
      disagree, so the survivor may not be the later edit at all.
  Version vectors  → per-replica counters travel with the value
    ↳ Detects the two writes were concurrent rather than ordered, and
      returns both values as siblings instead of dropping one.
  Application merge → the app decides what merging means here
    ↳ Union two shopping carts; keep both titles for a human to pick.
```

### Leaderless Replication

```text
Client writes directly to several nodes; no node is special.
  write(cart:88) ──► node1 ok   node2 ok   node3 timeout
  read(cart:88)  ──► node1 v7   node2 v7   node3 v5
     ↳ Read repair: the client or coordinator sees node3 is stale and
       writes v7 back to it during the read itself.
     ↳ Anti-entropy: a background process compares replicas and copies
       missing values across — it fixes data nobody reads.
```

---

## 4. Diagram: A Write Travelling Through a Single-Leader Cluster

### The Path of One Committed Write

```text
  client
    │ INSERT INTO orders (id, total) VALUES (9001, 42.50)
    ▼
┌────────────┐  1. write to the WAL, apply locally
│   LEADER   │  2. ship the change to the followers
└─────┬──────┘
  ┌───┴────────────┬────────────────┐
  ▼                ▼                ▼
FOLLOWER B     FOLLOWER C      FOLLOWER D
synchronous    asynchronous    asynchronous, 900 ms behind
  │ 3. B confirms it has durably stored the change
  ▼
┌────────────┐  4. acknowledge the commit
│   LEADER   │ ──► client sees "committed"
└────────────┘
      ↳ At this instant the row exists on the leader and B.
        A read routed to D still returns "no such order 9001".
```

### Reading the Diagram

The client is told the write committed at step 4, after one follower confirmed. C and D catch up whenever they catch up. Every anomaly in the next section lives in the gap between step 4 and D applying the change.

---

## 5. Code Walkthrough: Replication Lag Anomalies as Timelines

Three named anomalies follow from asynchronous lag. Each has a symptom a user can describe without knowing what a replica is.

### Read-Your-Writes

```text
t0  user 12 POSTs a comment      → LEADER (saved, acknowledged)
t1  page reloads, GET routed to  → FOLLOWER D (900 ms behind)
t2  response: the comment list without the comment just written
    ↳ Symptom: "I posted it and it vanished." The user posts again,
      so now there are two comments.
Fix: route reads this user's own write could affect to the leader.
```

### Monotonic Reads

```text
t0  user 12 loads the thread, read → FOLLOWER C (200 ms behind): 41 comments
t1  user refreshes, read           → FOLLOWER D (900 ms behind): 39 comments
    ↳ Symptom: "Two comments disappeared when I refreshed."
      Time appears to move backwards for that reader.
Fix: pin each reader to one replica by hashing the user id to it.
```

### Consistent Prefix Reads

```text
Two writes on two partitions, causally ordered:
  W1  partition 3:  question posted — "Is the store open on Sunday?"
  W2  partition 7:  reply posted    — "Yes, 10 to 4."
Observer reads a replica of partition 7 before partition 3 caught up:
  sees "Yes, 10 to 4."                 ← the reply
  sees "Is the store open on Sunday?"  ← the question, afterwards
    ↳ Symptom: the effect is visible before its cause.
Fix: keep causally related writes in one partition, or track and
     enforce the causal order explicitly.
```

---

## 6. Comparing Synchronous Replication to Asynchronous Replication

Whether the leader waits for a follower before acknowledging a write is the single knob that trades write latency against how much data a leader crash can lose.

### Synchronous vs Asynchronous

| | Synchronous | Asynchronous |
|---|---|---|
| Leader acknowledges | After the follower confirms it stored the change | As soon as the leader itself stored it |
| Write latency | Leader time plus the slowest confirming follower's round trip | Leader time only |
| Data loss on leader crash | None for acknowledged writes — the follower has them | Any write not yet shipped is lost when the old leader is discarded |
| One follower stalls | Writes block until it responds or is dropped from the set | No effect — the follower falls further behind |

### Takeaway

Fully synchronous replication to every follower makes availability worse, not better — every follower becomes a machine that can stall all writes. The usual compromise, semi-synchronous replication, keeps exactly one follower synchronous so an acknowledged write always exists in two places, while the rest stream asynchronously and are allowed to lag.

---

## 7. Common Mistakes

- **Treating last-write-wins as a conflict resolution strategy rather than a data loss policy.** It always converges, which is why it is popular, but it converges by throwing one write away with no error and no record. Combined with unsynchronised wall clocks it can discard the write that genuinely happened later, so it is only safe for data where a lost update does not matter, such as a cached counter or a last-seen timestamp.
- **Adding read replicas to fix a write bottleneck.** Replicas multiply read capacity, but every replica must apply every write, so a single-leader cluster's write ceiling is one node's write ceiling no matter how many followers exist. Scaling writes needs partitioning (Lesson 2), not replication.
- **Assuming failover is automatic and safe.** Promoting a follower requires deciding the old leader is really dead, which is undecidable from the outside — a slow node and a dead node look identical. Without fencing, a recovered old leader that still believes it is the leader creates split-brain and accepts conflicting writes.
- **Sending a read to a replica immediately after writing to the leader.** This is read-your-writes lag, and it shows up as the single most common bug report after a team introduces replicas: "I saved it and it did not save." The write was fine; the read went to a node that had not received it yet.

---

## 8. Hands-On Exercises

**Exercise 1:** On paper, size a single-leader cluster for a service taking 2,000 writes/sec and 40,000 reads/sec where one node handles 5,000 operations/sec. Count how many followers are needed for the read load, then state what happens to the write load as you add them, and explain why the write number does not improve.

**Exercise 2:** Write out the full timeline for a leader crash under asynchronous replication where the leader acknowledged order 9001 at t0 and crashed at t1 before shipping it. Show what the promoted follower's `orders` table contains, and what the customer who received a confirmation page now sees.

**Exercise 3:** Take a shopping cart replicated across two leaders. Replica A adds "tent" while replica B removes "stove" from the same cart concurrently. Show the final cart under last-write-wins, then under an application-level merge that treats the cart as a set with add and remove tombstones. Note which one loses a user action.

**Exercise 4:** Reproduce the monotonic reads anomaly on paper with three followers lagging 100 ms, 400 ms, and 2 s. Write the sequence of comment counts a user sees over four refreshes when the load balancer picks a replica at random, then redo it with the user pinned to one replica.

**Exercise 5:** Deliberately apply the mistake from Section 7: design a "who is online" feature using last-write-wins on a `last_seen` timestamp with two leaders whose clocks differ by 3 seconds. Show a concrete pair of writes where the earlier real-world event wins, then argue whether that matters for this specific feature — this is the case where last-write-wins is genuinely acceptable.

---

## 9. Interview Q&A

**Q: Why would you replicate a database, and do all the reasons want the same design?**
Four reasons: availability so a node failure is not an outage, read scalability so reads spread across machines, locality so users read from a nearby region, and durability so a dead disk is not a dead dataset. They do not want the same design — durability wants writes confirmed on many nodes before acknowledging, latency wants the leader to acknowledge alone, and locality wants writes accepted near the user, which pushes you toward multi-leader and therefore toward conflicts. You pick a topology by deciding which of those goals actually dominates for your workload.

**Q: What is split-brain and why does failover make it possible?**
Split-brain is two nodes simultaneously believing they are the leader and both accepting writes for the same rows. It happens during failover because there is no reliable way to distinguish a dead leader from a slow or network-isolated one, so the system promotes a follower while the old leader may still be alive and serving clients that have not been redirected. The mitigation is fencing: forcing the old leader to stop accepting writes before the new one starts, typically with a lease, an epoch or term number that the storage layer rejects if stale, or by powering the old node off.

**Q: Why is last-write-wins dangerous?**
Because "wins" means the other write is silently discarded — no error, no sibling, no log entry the application can act on. It also depends on comparing timestamps from different machines whose clocks are not perfectly synchronised, so the write that survives may not be the one that actually happened last in real time. It is acceptable only where losing a concurrent update is harmless, such as a cached counter or a last-seen field; it is not acceptable for a shopping cart or an account balance.

**Q: What is the difference between read repair and anti-entropy in a leaderless system?**
Read repair happens on the read path: when a client reads from several replicas and sees one returning a stale version, it writes the newer value back to that replica immediately. Anti-entropy is a background process that compares replicas independently of any client request and copies over what is missing. You need both, because read repair only ever fixes data somebody reads — rarely-read keys would stay stale forever without a background sweep.

**Q: A user reports "I saved my profile and the change disappeared, then came back a minute later." What is happening?**
That is replication lag producing a read-your-writes violation: the write went to the leader, the subsequent read was routed to a follower that had not applied it yet, and by the time the user looked again the follower had caught up. The fix is not to make replication faster but to route reads that the user's own recent write could affect to the leader, or to a replica known to have applied at least up to that write's position in the replication log. A related fix, pinning a user to a single replica, additionally prevents the monotonic reads case where a refresh appears to move time backwards.
