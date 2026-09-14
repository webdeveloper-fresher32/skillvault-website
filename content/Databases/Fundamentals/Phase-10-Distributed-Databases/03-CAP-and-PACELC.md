# CAP and PACELC — Complete Guide

> "When the phone line between two branch shops goes down, the clerk holding the last coat must either refuse to sell it or sell it anyway and accept that the other branch may have just sold the same coat."

---

## Table of Contents

1. [The Problem: A Theorem Everyone Quotes and Few State Correctly](#1-the-problem-a-theorem-everyone-quotes-and-few-state-correctly)
2. [The Two-Branch Shop Analogy](#2-the-two-branch-shop-analogy)
3. [The Mechanism: What C and A and P Actually Mean](#3-the-mechanism-what-c-and-a-and-p-actually-mean)
4. [Diagram: One Partition Played Out Both Ways](#4-diagram-one-partition-played-out-both-ways)
5. [Code Walkthrough: PACELC and the Case CAP Ignores](#5-code-walkthrough-pacelc-and-the-case-cap-ignores)
6. [Comparing PA Systems to PC Systems](#6-comparing-pa-systems-to-pc-systems)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: A Theorem Everyone Quotes and Few State Correctly

CAP is repeated more often than it is read. The usual paraphrase — "pick two of consistency, availability, partition tolerance" — is wrong in a way that leads to real design mistakes, because it suggests a menu of three where there is a single conditional choice.

### The Quote and What It Leaves Out

```text
What people say:
  "CAP says pick two of C, A, P. We picked AP."
What the theorem says:
  When the network drops messages between nodes, a system cannot both
  answer every request at every non-failing node and keep every answer
  linearizable. It must give up one of those two — and only then.
Missing from the paraphrase:
  ↳ P is a fact about the network, not a design option you decline.
  ↳ The choice binds only during a partition; the rest of the time,
    which is nearly all the time, CAP constrains nothing.
  ↳ C means linearizability. It is not the C in ACID.
```

### What's Missing

The paraphrase gives no guidance for the 99.9% of the time when the network is fine, which is exactly when latency-versus-consistency decisions are made and where most user-visible behaviour comes from. PACELC (Section 5) is the extension that covers it.

---

## 2. The Two-Branch Shop Analogy

Two branches of a shop share one stock list over a phone line, and one coat is left. While the line works, either branch can ring the other before selling and the stock list stays correct. When the line goes down, the clerk faces exactly two options, and no third option exists: refuse to sell until the line is back, or sell and accept that the other branch may be selling the same coat right now.

### Refuse the Sale vs Sell It Anyway

```text
Refuse the sale  → the stock list is never wrong, but a customer
                   standing at the counter with cash is turned away
Sell it anyway   → every customer is served, but the two branches now
                   disagree about the coat, and someone has to
                   reconcile that when the line comes back
```

### Mapping the Analogy to CAP

The dead phone line is the partition. Refusing the sale is choosing consistency and sacrificing availability. Selling anyway is choosing availability and sacrificing consistency. Note what the shop cannot do: it cannot decide the phone line will not break. That is the P everyone thinks they are choosing.

---

## 3. The Mechanism: What C and A and P Actually Mean

Each letter has a precise formal meaning from the 2002 proof by Gilbert and Lynch, and every common misreading comes from substituting a colloquial meaning for one of them.

### C Is Linearizability

```text
Linearizability: the system behaves as if there is one single copy of
the data, and every operation appears to take effect at one instant
between its invocation and its response — so once a write completes,
every later read anywhere returns that value or a newer one.

  ACID's C  → "a transaction moves the database from one valid state
               to another; declared constraints still hold"
  CAP's C   → "reads never see a stale copy; there is one timeline"
    ↳ Different concepts with the same letter. A system can satisfy
      ACID's C on every node and still violate CAP's C, because each
      node can be internally valid and disagree with its peers.
```

### A Is Every Non-Failing Node Answering

```text
Available (CAP): every request received by a non-failing node must
result in a non-error response. Not "the cluster stays up." Not "four
nines." Not "responds quickly."
  ↳ A node returning HTTP 503 because it cannot reach a quorum is
    unavailable in CAP terms, even if the rest of the cluster is fine.
  ↳ A system with 99.999% measured uptime can still be CP: the metric
    says how often partitions happen, not what it does in one.
  ↳ CAP's A bounds nothing about how long the answer takes; a reply
    after 40 seconds counts. That alone makes CAP a poor guide to
    real system behaviour.
```

### P Is Not a Choice

```text
Partition tolerance: the system keeps working when the network drops
or delays arbitrary messages between nodes.
  ↳ Cables get cut, switches misconfigure, a rack loses its uplink,
    and a long GC pause makes a node look identical to an absent one.
  ↳ So a system does not "choose P" — it chooses what to do when P
    happens. A so-called CA system is either single-node, where
    inter-node partitions cannot exist, or one that has not decided,
    which means it fails unpredictably in its first partition.
```

---

## 4. Diagram: One Partition Played Out Both Ways

### One Partition and Two Choices

```text
Account balance for user 77 is 100. Replicas R1 (us-east) and R2 (eu).
A link failure splits them. Alice's client talks to R1, Bob's to R2.

            ╳ link down ╳
   ┌──────────┐     ┌──────────┐
   │  R1 =100 │  ╳  │  R2 =100 │
   └────┬─────┘     └─────┬────┘
   Alice: withdraw 100   Bob: read balance

CHOICE 1 — keep C, give up A (CP)
   R1 cannot reach a majority, so it refuses the withdrawal: error.
   R2 cannot confirm it holds the newest value, so it refuses the read.
     ↳ Alice sees "service unavailable, try again". Bob sees the same.
       Nobody is ever shown a wrong number, and nobody is served.

CHOICE 2 — keep A, give up C (AP)
   R1 accepts the withdrawal locally: R1 = 0.
   R2 answers Bob from its own copy: "balance 100".
     ↳ Both requests succeed. Bob is told 100 when the truth is 0.
       If Bob also withdraws, the account goes to -100 and the two
       writes must be merged when the link returns.
```

### Reading the Diagram

Both branches are legitimate engineering choices, and which one is right depends entirely on the data. For a bank balance, showing 100 to Bob is worse than showing an error. For a product page view counter or a social feed, an error is worse than a stale number. The theorem does not choose for you; it only proves the third option — serve everyone and never be stale — does not exist.

---

## 5. Code Walkthrough: PACELC and the Case CAP Ignores

CAP describes only the partitioned case. Daniel Abadi's PACELC extension adds the branch that covers normal operation, which is where nearly all real latency lives.

### The PACELC Formulation

```text
if (Partition):        choose Availability or Consistency
else:                  choose Latency      or Consistency

Read as: "PAC / ELC" — a system is labelled with one choice from each
branch, giving PA/EL, PA/EC, PC/EL, or PC/EC.
  ↳ CAP is only the first half. PACELC keeps it and adds the half
    that applies while the network is healthy.
```

### The Latency-Consistency Tradeoff With No Partition

```text
Healthy network. Write w=5 to a 3-replica group, then read.

EC — consistency over latency:
  write → wait for a quorum to acknowledge      ≈ 8 ms
  read  → contact a quorum, or route to leader  ≈ 6 ms
    ↳ Every read reflects every completed write. You pay a round trip
      to another node on operations that a single copy would serve
      from local memory.
EL — latency over consistency:
  write → acknowledge from the nearest replica  ≈ 1 ms
  read  → answer from the nearest replica       ≈ 1 ms
    ↳ Six times faster and may return a value that is 200 ms stale.
      No partition is involved. This is a pure speed-of-light and
      round-trip-count decision, invisible to CAP.
```

### Reading a PACELC Label

```text
PA/EL  → stays up when partitioned, prefers speed otherwise
PC/EC  → refuses rather than diverge, and pays for consistency always
PA/EC  → serves through a partition, but is strict when healthy
PC/EL  → refuses during a partition, yet serves stale reads when
         healthy — unusual, and it exists: PNUTS was designed this way
  ↳ The label belongs to a configuration, not to a product name. A
    store with tunable consistency is PA/EL under one setting and
    closer to PC/EC under another, in the same cluster, per query.
```

---

## 6. Comparing PA Systems to PC Systems

The useful question is not which letters a product claims but what a given configuration does in each of the two branches.

### PA Systems vs PC Systems

| | Partition branch (PAC) | No-partition branch (ELC) |
|---|---|---|
| Dynamo-style stores (Cassandra, Riak) | PA — every replica keeps answering; conflicts resolved later | EL by default — tunable per query via consistency levels |
| Leader-based stores using a consensus group (etcd, ZooKeeper, HBase) | PC — the minority side stops answering | EC — reads are served consistently, paying the round trip |
| Spanner-style stores using synchronised clocks | PC — a partitioned minority cannot commit | EC — commit-wait spends latency to keep global ordering |
| MongoDB with majority write concern | PA in Abadi's classification — the old primary can accept writes that are later rolled back | EC — a majority read concern gives a single timeline |
| A single-node PostgreSQL instance | Not applicable — no inter-node partition can exist | Not applicable — one copy has nothing to diverge from |

### Takeaway

Read the table as behaviours, not brands. Most of these systems can be configured out of their default column: a Dynamo-style store queried at a quorum consistency level behaves closer to EC, and a leader-based store reading from a follower behaves like EL. The classification belongs to the read and write settings on a specific query path, which is exactly what an interviewer is testing when they ask you to classify a system.

---

## 7. Common Mistakes

- **Saying "we chose AP" as though P were declined by CP systems.** Both AP and CP systems are partition tolerant; that is the shared premise, not the difference. The difference is what each does during a partition, so the accurate sentence is "during a partition we keep answering and reconcile afterwards" — which also forces you to say what reconciliation actually does.
- **Confusing CAP's C with ACID's C.** ACID's consistency means declared constraints and invariants still hold after a transaction; CAP's consistency means linearizability, a single-copy illusion with real-time ordering. A single-node database can be fully ACID and the question of CAP's C never arises, and an AP cluster can enforce every constraint locally on each node while still returning stale reads.
- **Treating CAP's A as an uptime target.** CAP availability is the formal property that every request to a non-failing node returns a non-error response, with no time bound at all. It is not a service level objective, and a CP system with a well-run network can easily post better real-world uptime than a nominally AP system with an operational problem.
- **Using CAP to reason about a healthy network.** Partitions are rare; latency is constant. If a design discussion about read replicas or quorum sizes keeps invoking CAP, it is the wrong tool — the question is the ELC branch, where consistency is paid for in milliseconds rather than in availability.

---

## 8. Hands-On Exercises

**Exercise 1:** Write down the CAP theorem in one sentence without using the phrase "pick two", then check your sentence against three things: does it mention partitions as the precondition, does it define C as linearizability, and does it define A as every non-failing node responding.

**Exercise 2:** Take the balance scenario from Section 4 and extend it to five replicas split 3-2. Play out a write arriving on the majority side and a read arriving on the minority side under both the CP and AP choices, and state which of the four requests succeed in each case.

**Exercise 3:** Start a three-node etcd or Consul cluster in Docker, confirm a write succeeds, then run `docker network disconnect` on one node and issue reads and writes to both the isolated node and the remaining two. Record the exact errors the minority node returns and match them to the CP row of Section 6.

**Exercise 4:** For each of these features, decide the PACELC branch you want and justify it in one sentence: an ATM withdrawal, a "users also viewed" carousel, a seat reservation for a concert, a like count, and a password change. Note which ones changed your mind between the P branch and the E branch.

**Exercise 5:** Deliberately make the mistake from Section 7 and defend "we are CA" for a two-datacentre deployment. Then write out what the system does when the link between the datacentres drops, and identify which letter you actually gave up — this is the exercise that shows CA is not a configuration, it is an unanswered question.

---

## 9. Interview Q&A

**Q: How would you state the CAP theorem precisely?**
In an asynchronous network where messages between nodes can be lost or delayed arbitrarily, no distributed data store can be simultaneously linearizable and available, where available means every request reaching a non-failing node gets a non-error response. Since network partitions are a property of the network rather than a design decision, the practical reading is: while a partition is in progress you must choose between consistency and availability, and when there is no partition the theorem says nothing at all.

**Q: What is wrong with "pick two of three"?**
It implies partition tolerance is one of the options you can trade away, and it is not — a distributed system cannot prevent its network from failing, so the only real choice is what to do when the failure happens. It also implies the tradeoff applies all the time, when it only binds during a partition. Systems described as CA are almost always either single-node, where inter-node partitions cannot occur, or systems that have not decided what to do in a partition and will therefore behave unpredictably in one.

**Q: Is the C in CAP the same as the C in ACID?**
No, and conflating them is the most common CAP error. ACID's C means a transaction preserves the database's declared constraints and invariants, so it is a property of a single transaction against a schema. CAP's C is linearizability: the system behaves as if there is a single copy of the data, so once a write completes, no later read anywhere returns an older value. A cluster can enforce every ACID constraint on every node and still fail CAP's C by serving a stale read from a lagging replica.

**Q: What does PACELC add and why does it matter more day to day?**
PACELC says: if there is a Partition, choose Availability or Consistency; Else, choose Latency or Consistency. The second branch is the one that applies almost all the time, because partitions are rare and network round trips are constant, so the real everyday decision is whether a read pays for a quorum round trip or is answered immediately from the nearest replica and may be stale. It matters because most user-visible "the data looked wrong for a second" behaviour comes from the E branch, not from any partition.

**Q: How would you classify a system that lets you set a consistency level per query?**
I would refuse to give the product a single label and classify the query path instead. The same Cassandra cluster is PA/EL for a write at ONE and a read at ONE, and behaves close to PA/EC for a write at QUORUM and a read at QUORUM, since `W + R > N` then makes reads see the latest acknowledged write while the network is healthy. That is the honest answer, and it is also the more useful one, because the classification you actually need is for the specific operation whose behaviour you are designing around.
