# CAP Theorem

Imagine your database from Phase 05 is replicated across two data centers — one in the US, one in Europe — for speed and redundancy. One night, the network link between them goes down. Both data centers are still up and serving traffic; they just can't talk to each other. A write happens in the US. A read for that same data happens, seconds later, in Europe. What should the European node do — return the old (possibly stale) value, or refuse to answer at all until it can confirm it has the latest one?

There is no trick answer here. You must pick one. That forced choice, and nothing more mystical than that, is the CAP theorem.

## The three properties

```
        Consistency                 Availability
   Every read returns the      Every request gets a
   most recent write (or        response (success or
   an error)                    failure) — never hangs
            \                        /
             \                      /
              \                    /
           Partition Tolerance
     The system keeps working even
     when nodes can't talk to each
     other (network partition)
```

- **Consistency (C)** — every node returns the same, most up-to-date data. A read right after a write always sees that write.
- **Availability (A)** — every request receives a (non-error) response, even if it might not reflect the most recent write.
- **Partition Tolerance (P)** — the system continues operating even when the network between nodes is broken.

CAP theorem states: **when a network partition happens, you can only guarantee Consistency or Availability — not both.** You get to design for at most two of the three properties overall, but partitions are a fact of life in any real network, so in practice the meaningful choice is C vs. A *during* a partition.

## Why "P" isn't really a choice

In a single-machine system, partitions can't happen — there's only one node. But the entire point of the systems this course has been building since Phase 02 (multiple servers, replicated databases, multi-region deployments) is to have more than one machine. Any time you have more than one machine talking over a real network, that network can and eventually will fail to deliver a message in time — a switch dies, a cable gets cut, a data center loses connectivity. You cannot engineer this risk down to zero.

So "pick C, A, or P" is a bit misleading. Partition tolerance isn't something you opt into — it's the reality of distributed systems. The actual design decision is: **when a partition happens, does this system favor Consistency or Availability?** That's why CAP is more accurately framed as a CP-vs-AP choice.

## A CP system: reject requests to stay correct

```
   US Node ──X── EU Node     (partition: link is down)

   Client → EU Node: "read balance"
   EU Node: "I can't confirm I have the latest write from the US side.
             I will not answer rather than risk giving you stale data."
   → Returns an error / times out
```

A **CP system** chooses correctness over uptime during a partition. If a node can't confirm it's in sync with the rest of the cluster, it refuses to serve the request rather than risk returning wrong data. Traditional relational databases configured for strong consistency, and systems like ZooKeeper or etcd (used for configuration/coordination, not user-facing traffic), behave this way. This is the right choice when a wrong answer is worse than no answer — a bank balance, an inventory count for the last item in stock, a payment status.

## An AP system: stay up, accept staleness

```
   US Node ──X── EU Node     (partition: link is down)

   Client → EU Node: "read profile bio"
   EU Node: "I have a copy of this data, even if it's a few seconds
             old. I'll answer rather than fail the request."
   → Returns the last-known value (possibly stale)
```

An **AP system** chooses uptime over perfect correctness during a partition. Every node keeps answering requests using whatever data it locally has, even knowing that data might be a little stale until the partition heals and replicas resync. Systems like Cassandra (in its typical configuration) and DNS behave this way. This is the right choice when staying available matters more than perfect freshness — a social media like count, a product description, a user's profile bio. Nobody is harmed if a like count is off by a few seconds during a rare network blip; plenty of users are harmed if the entire feed goes down instead.

## Interview Q&A

**Q: What does CAP theorem actually say?**
A: In a distributed system, when a network partition occurs, you can only guarantee either Consistency (every read sees the latest write) or Availability (every request gets a non-error response) — not both simultaneously. You cannot have perfect consistency and perfect availability at the same time while the network is partitioned.

**Q: Is Partition Tolerance really optional? Why do we say "pick two of three"?**
A: Not in any realistic distributed system — any system running on more than one machine over a real network will eventually experience a partition, so partition tolerance isn't a choice you can opt out of. The "pick two" framing is a simplification; in practice, the actual decision you're making is what happens *during* a partition: do you favor Consistency (CP) or Availability (AP)? Outside of a partition, most systems can offer both C and A most of the time.

**Q: Give an example of a system that should be CP, and one that should be AP.**
A: A payment/inventory system for the last unit of a product should be CP — it's far worse to sell the same item twice (an availability win but a consistency loss) than to briefly reject a purchase request while nodes resync. A social media "like" counter or a user's profile data should be AP — showing a slightly stale like count is harmless, but taking the entire feed offline because one replica can't confirm freshness is a much worse user experience.

**Q: How does CAP theorem relate to the database replication you learned in Phase 05?**
A: Replication is exactly the setup where CAP applies — a master and its read replicas are separate nodes that can experience a network partition between them. If a replica can't confirm it has the master's latest write, a CP-leaning system would refuse to serve that read (or force it to go to the master), while an AP-leaning system would serve the replica's last-known value anyway. Replication lag, mentioned in Phase 05, is essentially the "cost of choosing availability" made visible even without a full network partition.

**Q: If I say "we chose eventual consistency for our system," what am I really saying in CAP terms?**
A: You're saying the system leans AP — during a partition (or even just normal replication delay), you're willing to serve reads that may be temporarily stale in exchange for the system always staying available and responsive, on the bet that all replicas will converge to the same value once the partition heals or replication catches up.
