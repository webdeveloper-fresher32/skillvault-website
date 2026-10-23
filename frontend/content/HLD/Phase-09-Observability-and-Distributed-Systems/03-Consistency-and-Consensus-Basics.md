# Consistency and Consensus Basics

Compare two numbers you've seen on a screen: your bank balance, and a like count under an Instagram post. If your bank balance shows $500 half a second after a $200 withdrawal actually cleared, that's a real problem — you might overdraw. If a like count shows 4,201 for a few seconds after it actually became 4,202, nobody notices and nobody is harmed. Both are "just a number stored somewhere," but the correctness requirement around each is completely different. That difference is what "consistency model" means in practice, and it's the natural follow-up to Phase 09 Lesson 02's CAP theorem: CAP tells you *that* you're trading consistency for availability during a partition; consistency models tell you *how much* consistency you're actually giving up.

## Strong consistency vs. eventual consistency

```
STRONG CONSISTENCY (bank balance)          EVENTUAL CONSISTENCY (like count)

Write: balance = balance - 200             Write: likes = likes + 1
        │                                          │
        ▼                                          ▼
  Every subsequent read, from                Replicas update in the
  any node, sees the new                     background; a read RIGHT
  balance immediately —                      AFTER the write MIGHT see
  or the read blocks/fails                   the old value briefly
  until it can guarantee that.               ...but converges to the
                                              correct value shortly after.
```

- **Strong consistency**: after a write completes, every subsequent read — from any node, immediately — sees that write. Guaranteeing this usually means coordinating across nodes before confirming the write, which costs latency and, per the CAP theorem, availability during a partition.
- **Eventual consistency**: after a write, reads *might* briefly return stale data, but if no new writes happen, all replicas will eventually converge to the same, correct value. This is cheaper and more available, at the cost of a brief window of staleness.

The choice isn't "which one is better" — it's "what does this specific piece of data actually require?" A bank balance, an inventory count for the last item in stock, and a payment status all need strong consistency, because a wrong answer causes real harm (overdraft, overselling, double payment). A like count, a view count, a "last seen" timestamp, and most social-feed content tolerate eventual consistency just fine, and demanding strong consistency for them would only add latency and reduce availability for no real benefit.

## Why distributed systems need consensus

Once you accept that a system runs on multiple nodes (Phase 03's horizontal scaling, Phase 05's replication), a basic question keeps coming up: **which node's version of the truth wins when two nodes disagree, or when one node has to be picked to coordinate a write?** In a single-server system this question doesn't exist — there's only one copy of the truth. In a distributed system, the nodes have to *agree* on an answer, even though messages between them can be delayed, dropped, or arrive out of order. Getting a group of unreliable, independent nodes to agree on a single value or a single leader is called **consensus**, and it turns out to be a genuinely hard problem — not because the idea is complicated, but because you have to handle every possible ordering of failures and delays and still end up with one agreed answer.

A common, concrete use of consensus is **leader election**: picking exactly one node to be "the master" that coordinates writes (like the master in Phase 05's replication setup), so that two nodes never independently accept conflicting writes at the same time. If the leader crashes, the remaining nodes need to run a new round of consensus to elect a new leader — without ending up with two nodes that both believe they're the leader at once (a dangerous state called "split brain").

## Quorum: agreeing by majority

```
   5-node cluster, quorum = 3 (majority)

   ┌────┐  ┌────┐  ┌────┐        ┌────┐  ┌────┐
   │ N1 │  │ N2 │  │ N3 │        │ N4 │  │ N5 │
   └────┘  └────┘  └────┘        └────┘  └────┘
     ✔        ✔        ✔      (partitioned away)

   3 nodes agree → quorum reached → write/election succeeds
   even though 2 nodes are unreachable.
```

A **quorum** is simply the minimum number of nodes that must agree before an operation (a write, a leader election) is considered valid — typically a strict majority (e.g., 3 of 5 nodes). Requiring a majority, rather than unanimous agreement, is what lets the system keep making progress even when some nodes are down or unreachable: as long as more than half the nodes are healthy and can talk to each other, they can still agree on a value, and — critically — it's mathematically impossible for two different majorities to form on both sides of a partition at the same time, which is what prevents split-brain.

**Raft** and **Paxos** are the two consensus algorithms almost every real system (etcd, ZooKeeper, most modern distributed databases) is built on. At the interview level, you don't need to derive either protocol — you need to recognize that "leader election" and "quorum-based agreement" are the concepts they solve, and be able to name them as "the algorithms that solve this" when the topic comes up.

## Interview Q&A

**Q: What's the difference between strong and eventual consistency, with an example of each?**
A: Strong consistency guarantees that any read immediately after a write returns that write's value, from any node — a bank balance needs this, because a stale read could let someone overdraw. Eventual consistency allows a brief window where a read might return a stale value, but guarantees all replicas converge to the correct value over time if no new writes occur — a social media like count is fine with this, since a few seconds of staleness causes no real harm and the trade-off buys lower latency and higher availability.

**Q: Why can't a distributed system just always use strong consistency and avoid the problem entirely?**
A: Guaranteeing strong consistency across multiple nodes requires coordinating (usually via consensus) before confirming any write, which adds latency to every operation and, per the CAP theorem, forces the system to reject requests during a network partition rather than serve possibly-stale data. For data that doesn't need perfect freshness, that cost is pure overhead — you'd be paying availability and performance for a guarantee nobody needed.

**Q: What is consensus, and why is it hard in a distributed system?**
A: Consensus is the process by which a group of independent nodes agree on a single value or decision (such as who the leader is, or what the next committed write is), despite messages between them being delayed, dropped, or reordered. It's hard because the algorithm has to produce a correct, single agreed answer under every possible combination of node crashes and network delays — including scenarios where nodes can't tell whether a peer is slow or actually dead.

**Q: What is a quorum, and why is it usually "majority" rather than "all nodes"?**
A: A quorum is the minimum number of nodes that must agree for an operation to be considered valid, typically a strict majority of the cluster. Majority (rather than unanimous) agreement lets the system keep functioning even when some nodes are down or unreachable, and it guarantees that two conflicting majorities can never form at the same time on either side of a network split — which is exactly what prevents "split brain," where two nodes both believe they're in charge.

**Q: I've heard of Raft and Paxos — do I need to know how they work internally for a system design interview?**
A: Generally no, unless you're interviewing for infrastructure/distributed-systems-heavy roles. What matters at the typical system design interview level is recognizing *what problem* they solve — safely electing a single leader and reaching agreement across nodes via quorum, even with node failures and network delays — and being able to name them as the standard, battle-tested solutions rather than trying to invent your own ad hoc coordination scheme on the spot.
