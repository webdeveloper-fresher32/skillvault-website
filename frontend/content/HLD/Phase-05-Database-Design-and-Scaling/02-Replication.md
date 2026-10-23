# Replication

Your indexed `users` table is now fast per-query — but imagine your app is Instagram-sized: 100,000 reads/sec hitting the database (profile loads, feed queries, follower counts) plus a much smaller stream of writes (new posts, new likes). A single database server, no matter how well indexed, has a ceiling on how many connections and queries it can serve concurrently. One box can't do 100,000 reads/sec forever.

## Master → Read Replicas

The fix looks a lot like the horizontal scaling from Phase 03 — but applied to the database instead of the app server:

```
                         ┌─────────────────┐
                Writes   │                 │
        ┌───────────────▶│  Master DB      │
        │                │  (source of     │
        │                │   truth)        │
        │                └────────┬────────┘
        │                         │  replication stream
        │                         │  (continuously copies
        │                         │   every write)
        │           ┌─────────────┼─────────────┐
        │           ▼             ▼             ▼
        │    ┌────────────┐┌────────────┐┌────────────┐
        │    │ Replica 1  ││ Replica 2  ││ Replica 3  │
        │    │ (read-only)││ (read-only)││ (read-only)│
        │    └─────▲──────┘└─────▲──────┘└─────▲──────┘
        │          │             │             │
        │          └─────────────┼─────────────┘
        │                        │  Reads
   Backend Server ───────────────┘
   (writes → master, reads → any replica)
```

**The rule:** all writes go to the master; all reads are spread across the replicas. The master continuously streams every change it receives to each replica, so the replicas stay (almost) in sync without ever accepting writes directly.

This scales reads the same way a load balancer scales backend traffic — need more read capacity, add another replica. It does nothing for write capacity, though: every write still funnels through the single master, which is why replication solves *read-heavy* scaling problems, not write-heavy ones (that's what Sharding, the next lesson, is for).

## Why "Almost" in Sync: Replication Lag

Copying every write from master to replica takes a small amount of time — network latency, replica processing speed, load on the replica. That gap is **replication lag**, typically milliseconds, sometimes seconds under heavy load.

```
t=0ms    Master:   INSERT post (user posts a new photo)
t=0ms    Master:   write acknowledged to user — "Post successful!"
t=40ms   Replica 2: receives and applies the INSERT
t=0-40ms Replica 2: if queried in this window, the new post is NOT there yet
```

This has a real consistency implication: if a user posts something and their *next* request happens to be routed to a replica that hasn't caught up yet, they might not see their own post for a brief moment — a visible, if usually rare, bug class in poorly designed systems. Common mitigations: route a user's own just-written data to the master for a short window, or accept the brief staleness as a reasonable trade-off. This exact tension — pick consistency or pick availability/performance when they conflict — is the heart of the CAP theorem, covered in depth in Phase 09.

## Interview Q&A

**Q: How does read replication help a system scale?**
A: It lets read traffic be spread across multiple database copies instead of hammering one instance, since most systems are read-heavy (many more reads than writes). Writes still go to a single master, so replication scales reads, not writes.

**Q: What is replication lag, and why does it matter?**
A: The delay between a write landing on the master and that write being reflected on a replica. It matters because a read immediately after a write can hit a replica that hasn't caught up yet, returning stale data — a consistency trade-off you accept in exchange for read scalability.

**Q: If a user posts a comment and then immediately reloads the page and doesn't see it, what's a likely cause, and how would you fix it?**
A: Replication lag — their write went to the master, but their reload was routed to a replica that hasn't received it yet. Fixes include routing that user's own reads to the master for a short window after they write, or using "read-your-own-writes" session stickiness.

**Q: What happens if the master database goes down?**
A: Writes stop working until a replica is promoted to become the new master (failover) — either automatically via the database's high-availability tooling or manually. Reads can often continue against the surviving replicas during this window, which is why replicas also double as a durability/availability safety net, not just a scaling tool.

**Q: Does adding more read replicas help if your bottleneck is actually write throughput?**
A: No — every write still has to go through the single master, so more replicas don't relieve write pressure at all. That's a sharding problem, covered next.
