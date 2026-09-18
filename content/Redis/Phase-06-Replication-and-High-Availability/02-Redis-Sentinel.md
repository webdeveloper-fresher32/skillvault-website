# 02 — Redis Sentinel

> A comprehensive reference covering why replication alone isn't high availability, how Redis Sentinel monitors, detects failure, and automates failover, quorum-based decision making, and how a Sentinel-aware client finds the current master.

---

## Table of Contents

1. [The Problem: Someone Has to Notice the Master Died](#1-the-problem-someone-has-to-notice-the-master-died)
2. [The Analogy: An On-Call Team Watching the Manager](#2-the-analogy-an-on-call-team-watching-the-manager)
3. [Internal Flow: Monitoring, Quorum, and Automatic Failover](#3-internal-flow-monitoring-quorum-and-automatic-failover)
4. [Code Example: A Minimal Sentinel Setup](#4-code-example-a-minimal-sentinel-setup)
5. [Sentinel vs Plain Replication](#5-sentinel-vs-plain-replication)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Someone Has to Notice the Master Died

The previous lesson set up a master and a replica, and showed how to promote a replica by hand with `REPLICAOF NO ONE`. That works — but it requires a human to notice the master is down, decide which replica to promote, run the command, and then update every application's configuration to point at the new master. During a real incident, at an inconvenient hour, that manual sequence is slow and error-prone at exactly the moment speed and correctness matter most.

The core problem: **replication gives you copies of the data, but nothing watches the master's health, decides it has actually failed (as opposed to a brief network blip), and automatically promotes a replica and reconfigures everyone else — that orchestration has to come from somewhere.**

---

## 2. The Analogy: An On-Call Team Watching the Manager

**Real-world analogy:** recall the manager-and-assistants setup from the previous lesson. Now add an on-call team whose entire job is watching the manager's health. If the manager stops responding, the on-call team doesn't panic and immediately declare an emergency on the say-so of just one member — they check with each other first, to rule out "my phone connection to the manager is just flaky right now" from "the manager is actually unreachable to everyone." Once enough of them agree the manager is genuinely gone, they run a quick election among the assistants, promote one to be the new manager, and tell everyone in the office — including anyone calling in from outside — where to send requests from now on.

**That on-call team is Redis Sentinel.** Sentinel processes monitor masters and replicas, agree among themselves (via quorum) that a master is truly down before acting, and then automatically perform the failover that Section 1's manual `REPLICAOF NO ONE` dance used to require a human for.

---

## 3. Internal Flow: Monitoring, Quorum, and Automatic Failover

A **Sentinel** is a special running mode of the `redis-server` binary (started as `redis-sentinel` or `redis-server --sentinel`), dedicated entirely to monitoring — it doesn't store your application's keys. In production you run **multiple Sentinel processes**, typically on separate machines, all watching the same master-replica set:

1. **Monitoring.** Each Sentinel continuously pings the master (and, once discovered through the master, its replicas) to check they're responsive, and gathers replication info from each.
2. **Subjective vs. objective down.** If one Sentinel stops getting a timely reply from the master, it marks the master as **SDOWN** (Subjectively Down) — from that one Sentinel's point of view only. This is deliberately not enough to trigger a failover, because that one Sentinel's *own* network connection could be the problem, not the master.
3. **Quorum agreement.** Sentinels ask each other whether they also see the master as down. Once at least the configured **quorum** number of Sentinels agree, the master is marked **ODOWN** (Objectively Down) — the group consensus, not one node's opinion.
4. **Leader election among Sentinels.** The Sentinels themselves elect one Sentinel to actually carry out the failover, using a majority vote among all running Sentinels (which is why running an odd number, and at least three, is the standard recommendation — a majority needs to be reachable to elect a leader).
5. **Failover.** The elected leader Sentinel picks the best-qualified replica (favoring one that's most caught-up on replication), sends it `REPLICAOF NO ONE` to promote it, reconfigures the other replicas to follow the new master with `REPLICAOF`, and updates its own records of who the current master is.
6. **Client notification.** Sentinel-aware clients ask Sentinel for the current master's address rather than hardcoding it, so they automatically pick up the new master after a failover.

```
Sentinel 1 ──▶ ping master ──▶ no reply ──▶ marks SDOWN (my own view only)
Sentinel 2 ──▶ ping master ──▶ no reply ──▶ marks SDOWN
Sentinel 3 ──▶ ping master ──▶ no reply ──▶ marks SDOWN
        │
        └── quorum of Sentinels agree ──▶ ODOWN ──▶ leader election among Sentinels
                                                          │
                                                          └──▶ elected Sentinel promotes best replica,
                                                               reconfigures the rest, updates master record
```

---

## 4. Code Example: A Minimal Sentinel Setup

A Sentinel is configured with its own config file, separate from the Redis instances it watches. A minimal `sentinel.conf`:

```conf
port 26379
sentinel monitor mymaster 127.0.0.1 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 10000
```

- `sentinel monitor mymaster 127.0.0.1 6379 2` — watch the master named `mymaster` at `127.0.0.1:6379`, and require **quorum 2** (at least 2 Sentinels must agree it's down) before marking it ODOWN.
- `sentinel down-after-milliseconds mymaster 5000` — how long a master can go unresponsive before one Sentinel marks it SDOWN.
- `sentinel failover-timeout mymaster 10000` — how long to wait between failover attempts/steps before considering it stalled.

Start it with: `redis-sentinel /path/to/sentinel.conf` (Sentinels normally run on port `26379` by default, separate from the Redis data-port `6379`).

Once running, query it directly with `redis-cli` pointed at the Sentinel's port (not the Redis master's port):

```bash
redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
# 1) "127.0.0.1"
# 2) "6379"
```

`SENTINEL get-master-addr-by-name mymaster` returns whichever host/port is currently the real master — this is exactly the lookup a Sentinel-aware client library performs instead of hardcoding an address, which is why the address returned here automatically changes after a failover. Other useful inspection commands: `SENTINEL sentinels mymaster` (list the other Sentinels this one knows about) and `SENTINEL masters` (list all masters this Sentinel is monitoring, with their current state).

A Sentinel-aware client in Python, using `redis-py`'s built-in `Sentinel` support:

```python
from redis.sentinel import Sentinel

sentinel = Sentinel([("localhost", 26379), ("localhost", 26380), ("localhost", 26381)], socket_timeout=0.1)
master = sentinel.master_for("mymaster", socket_timeout=0.1)  # always resolves to the current master

master.set("greeting", "hello via sentinel")
```

`sentinel.master_for("mymaster", ...)` returns a client that asks Sentinel for the current master's address on each connection, rather than a fixed host/port baked into the application — so if a failover happens, the next call transparently talks to the newly-promoted master.

---

## 5. Sentinel vs Plain Replication

| | **Plain replication (Phase 6, Lesson 1)** | **Replication + Sentinel** |
|---|---|---|
| **Keeps replica data in sync** | Yes | Yes |
| **Detects master failure** | No — nothing is watching | Yes — via quorum-based monitoring |
| **Promotes a replica automatically** | No — manual `REPLICAOF NO ONE` | Yes — automatic failover |
| **Tells clients where the new master is** | No — application must be updated manually | Yes — clients query Sentinel for the current address |
| **Minimum recommended process count** | 1 master + 1+ replicas | 1 master + 1+ replicas + 3+ Sentinels |

**Common mistakes:**
- Running a single Sentinel process. One Sentinel has nobody to reach quorum with — it can mark a master SDOWN from its own view, but the "objective," consensus-based ODOWN state that the plan requires (and the majority-vote leader election for the failover itself) needs multiple Sentinels agreeing. A lone Sentinel defeats the entire purpose of quorum-based failure detection.
- Hardcoding the master's host/port in application configuration even after adopting Sentinel. If clients don't use Sentinel-aware connection logic (like `redis-py`'s `Sentinel`/`master_for`), a failover promotes a new master that the application has no way of discovering, and it keeps trying to talk to the old, now-demoted instance.
- Setting quorum higher than makes sense for the number of Sentinels actually running (e.g., quorum of 3 with only 2 Sentinels deployed) — ODOWN can never be reached, so failover never triggers no matter how long the master is actually down.

**Interview angle:** "How does Redis achieve high availability?" is a very common follow-up once a candidate has explained replication. The answer interviewers are listening for is specifically Sentinel's two-stage failure-detection design — SDOWN (one Sentinel's opinion) versus ODOWN (quorum-confirmed consensus) — because that distinction is what prevents a single flaky network link from triggering an unnecessary, disruptive failover. Mentioning that clients need Sentinel-aware connection logic (not a hardcoded address) to actually benefit from an automated failover shows you understand this is an end-to-end mechanism, not just a server-side feature.

---

## 6. Common Mistakes

- Deploying exactly one Sentinel "to get started" and assuming it provides real automated failover — it can't reach quorum with itself, so it can't distinguish a real outage from its own network hiccup.
- Forgetting that application code still needs a Sentinel-aware client (or equivalent proxy/service-discovery layer) — Sentinel automating the server-side failover accomplishes nothing if every client is still pointed at a fixed, now-stale master address.
- Setting `down-after-milliseconds` too low for a network with any jitter, causing Sentinels to flag a perfectly healthy master as down (and potentially trigger unnecessary failovers) during ordinary transient latency spikes.

---

## 7. Hands-On Exercises

### Exercise 1 — Configure and start a single Sentinel

Using the master/replica pair from the previous lesson, write a `sentinel.conf` monitoring your master with quorum `1` (acceptable for local experimentation only, never production), start it with `redis-sentinel`, and query `SENTINEL get-master-addr-by-name mymaster` to confirm it correctly reports your master's address.

### Exercise 2 — Simulate a failure and watch a failover happen

Stop the master process entirely (e.g., `redis-cli -p 6379 SHUTDOWN NOSAVE` or killing the process). After `down-after-milliseconds` elapses, query Sentinel again with `SENTINEL get-master-addr-by-name mymaster` and confirm the address returned is now your former replica's address — Sentinel promoted it automatically.

### Exercise 3 — Connect with a Sentinel-aware client

Using `redis-py`'s `redis.sentinel.Sentinel`, write a short script that resolves the current master via `sentinel.master_for("mymaster", ...)`, writes a key, then (after simulating the failover from Exercise 2) confirms the same code — unchanged — now reads/writes against the newly-promoted master without any manual reconfiguration.

---

## 8. Interview Q&A

### Q1. What problem does Redis Sentinel solve that plain replication doesn't?

**Answer:** Plain replication keeps replicas' data in sync with a master but has no mechanism to detect that the master has failed or to promote a replica automatically. Sentinel adds monitoring, quorum-based failure detection, and automated failover on top of replication, so a master failure is handled without a human manually running `REPLICAOF NO ONE`.

---

### Q2. What is the difference between SDOWN and ODOWN in Sentinel?

**Answer:** SDOWN (Subjectively Down) is one Sentinel's individual observation that the master isn't responding — it could be a real outage or just that one Sentinel's network path. ODOWN (Objectively Down) is reached only once a configured quorum of Sentinels independently agree the master is down, which is the trigger Sentinel actually acts on for failover.

---

### Q3. Why should you run at least three Sentinel processes instead of one?

**Answer:** A single Sentinel can't reach quorum with itself, so it can never distinguish "the master is actually down" from "I personally can't reach it," defeating the purpose of consensus-based detection. Running an odd number of at least three lets Sentinels reach quorum for ODOWN and a majority vote to elect the Sentinel that performs the failover.

---

### Q4. How does a client application know where the current master is after a Sentinel-driven failover?

**Answer:** A Sentinel-aware client (such as `redis-py`'s `Sentinel`/`master_for`) queries Sentinel for the current master's address — via the same lookup as `SENTINEL get-master-addr-by-name <name>` — instead of using a hardcoded host and port, so it automatically picks up the new master's address after a failover.

---

### Q5. What does the quorum number in `sentinel monitor mymaster <ip> <port> <quorum>` actually control?

**Answer:** It's the minimum number of Sentinels that must agree a master is unreachable before it's marked ODOWN (objectively down) and a failover is triggered. It does not, by itself, set how many Sentinels are required to actually carry out the failover — that separate step uses a majority vote among all running Sentinels to elect the one that performs it.

---

> 🧠 **Memory hook:** "One Sentinel's opinion is SDOWN — just gossip. Enough Sentinels agreeing is ODOWN — that's when the on-call team actually promotes a new manager."
