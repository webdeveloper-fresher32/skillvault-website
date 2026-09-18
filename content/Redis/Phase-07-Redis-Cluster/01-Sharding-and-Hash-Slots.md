# 01 — Sharding and Hash Slots

> A comprehensive reference covering why a single Redis instance eventually runs out of room, how Redis Cluster splits the keyspace into 16384 hash slots, and how hash tags keep related keys together.

---

## Table of Contents

1. [The Problem: What Happens When Your Data Doesn't Fit in One Machine's RAM](#1-the-problem-what-happens-when-your-data-doesnt-fit-in-one-machines-ram)
2. [The Analogy: Branch Libraries and a Master Directory](#2-the-analogy-branch-libraries-and-a-master-directory)
3. [How Redis Cluster Divides the Keyspace: Hash Slots](#3-how-redis-cluster-divides-the-keyspace-hash-slots)
4. [Hash Tags: Keeping Related Keys Together](#4-hash-tags-keeping-related-keys-together)
5. [Single Instance vs Sentinel vs Cluster](#5-single-instance-vs-sentinel-vs-cluster)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: What Happens When Your Data Doesn't Fit in One Machine's RAM

Phase 6 solved two real problems: read scaling (replicas can serve reads) and availability (Sentinel promotes a replica if the master dies). But look closely at what replication actually does — it **copies** the entire dataset onto every replica. Every single node in a replicated setup, master or replica, still has to hold the *whole* dataset in memory.

That's fine right up until it isn't. If your working set grows to 200GB and the biggest machine you can reasonably provision has 128GB of RAM, replication cannot help you — adding more replicas gives you more copies of a dataset that already doesn't fit, not more room. The problem replication can't solve: **how do you scale the total amount of data Redis can hold, not just the number of readers who can access it?**

The answer is **sharding** — splitting the dataset itself across multiple masters, so each one only needs to hold a fraction of the total data. Redis's built-in solution for this is called **Redis Cluster**.

---

## 2. The Analogy: Branch Libraries and a Master Directory

**Real-world analogy:** imagine one giant central library has grown so large that no single building can physically hold every book anymore. The solution: split the collection into several branch libraries across town — one holds fiction A-M, another holds fiction N-Z, another holds non-fiction, and so on. No single branch holds the whole collection, but together they hold everything.

Critically, there's a **directory** (a card catalog, a phone system) that tells you which branch has the book you want, so you don't have to guess or visit every branch. If you show up at the wrong branch, the librarian there can tell you exactly which branch to try instead.

**The branches are Redis Cluster's master nodes. The directory is the hash slot mapping.** Each master owns a defined slice of the keyspace, just like each branch owns a defined slice of the book collection — and any node in the cluster can tell a client which node actually owns the key it's asking about.

---

## 3. How Redis Cluster Divides the Keyspace: Hash Slots

Redis Cluster doesn't divide keys the way you might first guess — it doesn't assign literal key ranges (`"a"` through `"m"` on one node, for example) directly. Instead, it divides the *entire possible keyspace* into a fixed number of **16384 hash slots**, numbered 0 through 16383. Every master node in the cluster owns some subset of these slots — for example, in a 3-master cluster, node A might own slots 0-5460, node B slots 5461-10922, and node C slots 10923-16383.

To figure out which slot a given key belongs to, Redis computes:

```
slot = CRC16(key) mod 16384
```

`CRC16` is a checksum function that turns a key's bytes into a number; taking that number modulo 16384 spreads keys roughly evenly across all 16384 slots regardless of what the keys look like. This calculation is deterministic — the same key always maps to the same slot, on every node, every time — which is exactly what lets any node in the cluster compute where a key *should* live without needing to ask anyone else.

You can ask Redis to run this calculation for you directly:

```
$ redis-cli -p 30001 CLUSTER KEYSLOT foo
(integer) 12182
```

That tells you the key `"foo"` belongs to slot 12182 — whichever master node owns slot 12182 is the only node allowed to store or serve that key. You can also inspect the full slot-ownership map for the cluster with `CLUSTER NODES`, which lists every node along with the slot ranges it owns:

```
$ redis-cli -p 30001 CLUSTER NODES
07c37dfeb235213a872192d90877d0cd55635b91 127.0.0.1:30004@31004 slave e7d1eecce10fd6bb5eb35b9f99a514335d9ba9ca 0 1699999999000 4 connected
67ed2db8d677e59ec4a4cefb06858cf2a1a89fa1 127.0.0.1:30002@31002 master - 0 1699999999010 2 connected 5461-10922
292f8b365bb7edb5e285caf0b7e6ddc7265d2f4f 127.0.0.1:30003@31003 master - 0 1699999999020 3 connected 10923-16383
e7d1eecce10fd6bb5eb35b9f99a514335d9ba9ca 127.0.0.1:30001@31001 myself,master - 0 1699999999030 1 connected 0-5460
```

Each line shows a node ID, its `ip:port@cluster-bus-port`, its role (`master` or `slave` and who it replicates from), and — for masters — the slot ranges it owns, shown at the end of the line (e.g. `0-5460`).

---

## 4. Hash Tags: Keeping Related Keys Together

There's a wrinkle: many real operations touch more than one key at once — `MGET user:1000:name user:1000:email`, or a `MULTI`/`EXEC` transaction (Phase 8) that updates two related keys together. If `CRC16(key) mod 16384` sent `user:1000:name` to one node and `user:1000:email` to a different node, a multi-key operation across them would be impossible — no single node holds both keys, and Redis Cluster refuses to silently coordinate a query across nodes on your behalf.

The fix is a **hash tag**: if a key contains a substring wrapped in curly braces, Redis hashes *only that substring* to compute the slot, ignoring the rest of the key. So:

- `{user:1000}:name`
- `{user:1000}:email`
- `{user:1000}:followers`

All three keys hash based on `user:1000` alone (the part inside `{}`), so all three land on the exact same slot — and therefore the exact same node — even though the full key strings are different. This is exactly how the earlier "session data" style examples from Phase 3 can be adapted for cluster use: wrap the shared identifier in braces whenever multiple keys for the same logical entity need to live together.

---

## 5. Single Instance vs Sentinel vs Cluster

| | **Single Instance** | **Sentinel-Managed Replication (Phase 6)** | **Redis Cluster** |
|---|---|---|---|
| **Solves** | Nothing extra — one node, one point of failure | Availability (automatic failover) + read scaling | Horizontal capacity (data sharded across masters) + availability |
| **Every node holds the full dataset?** | Yes (only one node exists) | Yes — every replica is a full copy | No — each master holds only its owned slots |
| **Max dataset size** | Limited by one machine's RAM | Limited by one machine's RAM (still fully replicated) | Limited by combined RAM across all masters |
| **Client complexity** | Trivial — one address | Needs Sentinel-aware client to find current master | Needs cluster-aware client to track slot ownership |
| **Operational complexity** | Lowest | Moderate | Highest |

**Common mistakes:**
- Running a multi-key command (`MGET`, `MULTI`/`EXEC` touching several keys, a Lua script referencing multiple keys) across keys that hash to different slots — Redis Cluster will reject this with a `CROSSSLOT` error, since it can't guarantee atomicity across separate nodes. Hash tags are the fix, not a workaround to avoid.
- Reaching for Redis Cluster the moment a dataset feels "big," without first confirming a single well-sized instance (or Sentinel-managed replication for availability alone) can't handle it — clustering solves a specific problem (data too large for one node's RAM) and adds real operational overhead in exchange, a tradeoff Phase 12 revisits directly.

**Interview angle:** "How does Redis Cluster shard data, and why 16384 slots specifically?" is a classic clustering question. The expected answer covers the `CRC16(key) mod 16384` formula, the fact that slots (not raw key ranges) are the unit of ownership and rebalancing, and — as a bonus — that 16384 was chosen as a practical balance: large enough to distribute keys evenly and rebalance in reasonably fine-grained chunks, but small enough that the per-node slot-to-node bitmap stays a manageable size to gossip between nodes even in large clusters.

---

## 6. Hands-On Exercises

You don't need a running cluster for these — a single `redis-cli` connected to any Redis instance can answer `CLUSTER KEYSLOT` even without cluster mode enabled, since it's a pure computation.

### Exercise 1 — Compute slots for related keys

Using any running Redis instance, run `CLUSTER KEYSLOT user:1000:name` and `CLUSTER KEYSLOT user:1000:email`. Note whether they return the same slot number. Now run `CLUSTER KEYSLOT {user:1000}:name` and `CLUSTER KEYSLOT {user:1000}:email` and compare. Explain in your own words why hash tags change the result.

### Exercise 2 — Design a slot layout

On paper, sketch a 3-master cluster and divide the 16384 slots into three roughly equal ranges. Then list 5 example keys from an application you know (e.g. `user:42:profile`, `order:99:items`) and, using the hash-tag rule, decide which keys would need a shared hash tag to guarantee they land on the same node.

### Exercise 3 — Read a `CLUSTER NODES` line by line

Take the `CLUSTER NODES` sample output shown in Section 3. For each line, identify: the node's role (master or slave), which node it replicates from (if it's a slave), and which slot range (if any) it owns. Write one sentence per line explaining what would happen to that slot range if that specific node crashed right now.

---

## 7. Interview Q&A

### Q1. Why can't Redis replication alone solve the "dataset too big for one machine" problem?

**Answer:** Replication copies the *entire* dataset onto every replica — it scales read throughput and availability, not total capacity. Every node in a replicated setup, master or replica, still needs enough RAM to hold the whole dataset, so if the dataset itself doesn't fit on one machine, adding replicas doesn't help. Sharding the data itself across multiple masters — what Redis Cluster does — is the only way to scale total capacity.

---

### Q2. How does Redis Cluster decide which node owns a given key?

**Answer:** Redis Cluster divides the entire keyspace into 16384 fixed hash slots. A key's slot is computed as `CRC16(key) mod 16384`, and each master node owns a defined subset of those 16384 slots. Any node can perform this calculation and knows (via the gossiped cluster slot map) which node currently owns the resulting slot, so lookups don't require a separate directory service.

---

### Q3. What is a hash tag and why does it exist?

**Answer:** A hash tag is a substring wrapped in `{}` inside a key name, e.g. `{user:1000}:name`. When present, Redis computes the slot hash using only the content inside the braces rather than the whole key, which lets you force multiple related keys onto the same slot (and therefore the same node) so multi-key operations across them are possible.

---

### Q4. What happens if you run a multi-key command across keys in different slots?

**Answer:** Redis Cluster returns a `CROSSSLOT` error and refuses to execute the command, because it cannot atomically coordinate an operation across two different physical nodes. The fix is to use a shared hash tag on the related keys so they land on the same slot, not to try to force the cross-node operation through some other means.

---

### Q5. Why 16384 hash slots specifically, rather than, say, a million?

**Answer:** 16384 is large enough to spread keys evenly across even a fairly large number of master nodes while keeping rebalancing granular, but small enough that the slot-to-node ownership map stays compact enough to be efficiently gossiped between all nodes in the cluster (as part of a bitmap that scales with slot count, not key count).

---

> 🧠 **Memory hook:** "16384 slots, one formula — `CRC16(key) mod 16384` — every key has a home, and `{hashtags}` are how you make two keys share one."
