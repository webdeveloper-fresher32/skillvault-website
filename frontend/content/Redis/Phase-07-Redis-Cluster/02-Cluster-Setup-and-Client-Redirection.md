# 02 — Cluster Setup and Client Redirection

> A comprehensive reference covering how a client finds the right node in a sharded cluster, the difference between `MOVED` and `ASK` redirects, and what live resharding looks like from the client's side.

---

## Table of Contents

1. [The Problem: Which Node Do I Even Talk To?](#1-the-problem-which-node-do-i-even-talk-to)
2. [The Analogy: The Switchboard That Redirects You — and Remembers](#2-the-analogy-the-switchboard-that-redirects-you--and-remembers)
3. [How Clients Find the Right Node: Slot Caching and Redirects](#3-how-clients-find-the-right-node-slot-caching-and-redirects)
4. [MOVED vs ASK: Permanent vs Temporary Redirects](#4-moved-vs-ask-permanent-vs-temporary-redirects)
5. [Cluster-Aware vs Non-Cluster-Aware Clients](#5-cluster-aware-vs-non-cluster-aware-clients)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Which Node Do I Even Talk To?

Phase 07's first lesson established that Redis Cluster spreads the 16384 hash slots across multiple master nodes. That immediately raises a practical question a single-instance Redis never has to answer: **when your application wants to `GET user:1000:name`, which of the cluster's several nodes should it even connect to?**

It gets harder still because slot ownership isn't permanently fixed. Clusters get resized — a new master is added, an old one is removed, and slots get migrated between nodes to rebalance load. If a client naively assumed "node A always owns slot 12182," it would start failing the moment that slot moved somewhere else during a resharding operation. The problem: **how does a client find the correct node for a key, and stay correct even while the cluster is actively reorganizing itself?**

---

## 2. The Analogy: The Switchboard That Redirects You — and Remembers

**Real-world analogy:** imagine calling a large company's main switchboard number because you're not sure which department handles your request. The operator says, "That's actually handled by the billing department, let me give you their direct line" — and now, for every future call about billing, you dial that direct number yourself instead of going through the switchboard again.

But there's a rarer, trickier case: you call the direct line for billing, and someone says, "We're in the middle of moving this desk to a different floor right this second — try the new floor's number for *this one call*, but don't update your address book yet, we're not fully moved." That's a temporary redirect, not a permanent one.

**The permanent "here's the direct line, use it from now on" redirect is `MOVED`. The "just for this one call, we're mid-move" redirect is `ASK`.** A cluster-aware client behaves exactly like the caller in this story: it caches direct lines (the slot-to-node map) after being told them once, and it knows the difference between "update your address book" and "just this once."

---

## 3. How Clients Find the Right Node: Slot Caching and Redirects

A cluster-aware client (a client library built with Redis Cluster support, such as `redis-py`'s `RedisCluster` class) starts by connecting to any node in the cluster and asking for the full slot-to-node mapping — the same information `CLUSTER NODES` from Section 3 of the previous lesson exposes. It caches that mapping locally. From then on, for every command, the client computes `CRC16(key) mod 16384` itself, looks up which node its cached map says owns that slot, and sends the command directly to that node — no guessing, no extra network hop, in the common case.

The mapping can go stale, though — slots migrate during resharding, and a new cluster the client hasn't queried yet might have a completely different layout than the client assumes on first connect. So the protocol has a built-in escape hatch: if a client sends a command to a node that does **not** actually own that key's slot, the node doesn't just fail — it tells the client exactly where to go instead, via a redirect error.

You can see this behavior directly using `redis-cli` in cluster mode (`-c`), which automatically follows redirects for you and prints what's happening:

```
$ redis-cli -c -p 30001
127.0.0.1:30001> set foo bar
-> Redirected to slot [12182] located at 127.0.0.1:30003
OK
127.0.0.1:30003> get foo
"bar"
```

Here, the client connected to port 30001, but `foo` (slot 12182, per Section 3's `CLUSTER KEYSLOT foo` example) actually lives on the node at port 30003. The `-c` flag makes `redis-cli` follow the redirect automatically and reconnect; a real application client library does the same thing programmatically and then **updates its cached slot map** so it doesn't need redirecting for that slot again.

---

## 4. MOVED vs ASK: Permanent vs Temporary Redirects

There are two distinct redirect errors, and the difference matters:

- **`MOVED`** — returned when a slot has been **permanently** reassigned to a different node (a completed resharding operation, or a change in cluster topology). The error looks like `MOVED 3999 127.0.0.1:6381`. A client receiving this should update its cached slot map to point that slot at the new node **from now on** — this redirect represents the new steady state.
- **`ASK`** — returned **only** during an in-progress slot migration, when a specific key has already been moved to the destination node but the slot as a whole hasn't finished migrating yet. The error looks like `ASK 3999 127.0.0.1:6381`. A client receiving this should retry the command against the indicated node for **this one request only** — it must first send the special `ASKING` command on that connection (which tells the destination node "yes, I know this slot isn't fully mine yet, please serve/accept this one key anyway"), then reissue the original command. The client should **not** update its permanent slot map based on an `ASK` — the migration isn't finished, and the next key in that same slot might still be on the old node.

The distinction exists because live resharding moves slots key-by-key, not all at once — during that window, some keys in a slot have already moved and some haven't. `ASK` is how the cluster handles that in-between state correctly without blocking all access to the slot until the entire migration completes.

---

## 5. Cluster-Aware vs Non-Cluster-Aware Clients

| | **Cluster-Aware Client (e.g. `redis-py`'s `RedisCluster`)** | **Plain Single-Node Client Pointed at One Cluster Node** |
|---|---|---|
| **Understands slots** | Yes — computes `CRC16(key) mod 16384` and caches the slot map | No — has no concept of slots at all |
| **Handles `MOVED`** | Automatically follows the redirect and updates its cache | Sees an unexpected error reply it doesn't know how to interpret |
| **Handles `ASK`** | Automatically sends `ASKING` then retries | Same — doesn't understand it, request effectively fails |
| **Multi-key command safety** | Refuses/errors clearly on cross-slot keys unless hash-tagged | May appear to "work" against one node until data spans slots unpredictably |
| **Appropriate for Redis Cluster?** | Yes, by design | No — will behave unpredictably in production |

**Common mistakes:**
- Pointing a plain, non-cluster-aware client library at a single node of a Redis Cluster deployment and expecting it to "just work" — it can talk to that one node fine for keys that happen to live there, but has no logic to follow `MOVED`/`ASK` redirects, so requests for keys on other nodes fail or silently misbehave depending on the library.
- Assuming Redis Cluster is a strictly-better upgrade that gives you more capacity "for free" — it also multiplies operational surface area: more nodes to monitor, cross-slot command restrictions to design around, and resharding operations to run carefully. Phase 12 revisits this directly as "do you actually need clustering, or would a bigger single instance plus Sentinel-managed replication solve your actual problem?"

**Interview angle:** "What's the difference between a `MOVED` and an `ASK` redirect in Redis Cluster?" is a common way interviewers probe whether you understand cluster internals beyond the surface-level "keys get sharded" pitch. The strong answer distinguishes permanent topology changes (`MOVED`, update your map) from an in-flight migration affecting one key at a time (`ASK`, retry once via `ASKING`, don't update your map) — and connects it back to why resharding needs to happen without taking the whole slot offline during the move.

---

## 6. Hands-On Exercises

These exercises work with a single locally running Redis instance in cluster-command-aware mode, or conceptually on paper if you don't have a multi-node cluster running.

### Exercise 1 — Trace a redirect by hand

Given `CLUSTER KEYSLOT foo` returns `12182`, and imagine your cluster's slot map says slots 10923-16383 are owned by the node at `127.0.0.1:30003` — while you're connected to `127.0.0.1:30001`. Write out, step by step, what error you'd expect back from `SET foo bar` sent to port 30001, and exactly what a cluster-aware client would do next.

### Exercise 2 — MOVED vs ASK decision table

Create a short table with two rows, "MOVED" and "ASK," and three columns: "What triggered it," "Should the client update its cached slot map?," and "Does the client need to send anything before retrying?" Fill in all six cells from memory, then check your answers against Section 4.

### Exercise 3 — Explain the risk of a naive client

Write 2-3 sentences explaining, in your own words, what would go wrong if you connected a plain single-node Redis client (with no cluster awareness at all) to one node of a 3-master cluster and used it to `GET` keys that are spread across all three nodes.

---

## 7. Interview Q&A

### Q1. How does a cluster-aware client know which node to send a command to?

**Answer:** It computes the key's slot itself (`CRC16(key) mod 16384`) and looks it up in a locally cached slot-to-node map, which it originally fetched by querying any cluster node (the same data `CLUSTER NODES` exposes). This avoids an extra network hop on every request in the common case, only falling back to following a redirect when its cached map is stale.

---

### Q2. What's the difference between a `MOVED` and an `ASK` error?

**Answer:** `MOVED` means a slot has been permanently reassigned to a different node, and the client should update its cached slot map going forward. `ASK` means a specific key has moved to a new node mid-migration but the slot as a whole hasn't finished moving, so the client should retry just that one request against the new node (after sending `ASKING`) without permanently updating its slot map, since the migration isn't complete yet.

---

### Q3. What must a client do before retrying a command after receiving `ASK`?

**Answer:** It must send the `ASKING` command on the connection to the destination node first, then reissue the original command. `ASKING` tells that node to accept the command for this one key even though the node doesn't yet fully own the slot it belongs to.

---

### Q4. What happens if you use a non-cluster-aware client against a Redis Cluster deployment?

**Answer:** It will work only for keys that happen to live on whichever single node it's connected to. It has no logic to interpret `MOVED`/`ASK` redirect errors, so requests for keys owned by other nodes will fail or behave unpredictably, and multi-key commands spanning nodes will not be handled correctly at all.

---

### Q5. Does adding Redis Cluster capacity come without any tradeoffs?

**Answer:** No — clustering solves a specific problem (a dataset too large for one node's RAM) but adds real operational complexity: more nodes to deploy and monitor, cross-slot command restrictions requiring hash tags, and resharding operations that must be run and reasoned about carefully. It's worth confirming a single well-sized instance or Sentinel-managed replication genuinely can't meet the requirement before reaching for clustering.

---

> 🧠 **Memory hook:** "`MOVED` means update your address book for good; `ASK` means just this one call goes to the new floor — the move isn't finished yet."
