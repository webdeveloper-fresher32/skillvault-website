# Sharding

Replication solved read scaling by copying the *entire* dataset onto more machines — but every one of those replicas still has to hold a full copy of every row, and the master still has to accept every write alone. Eventually you hit a wall replication can't fix: the data itself is too big for one machine to store, or too many writes for one master to absorb, no matter how it's indexed. The fix is to stop copying the whole dataset everywhere, and instead split it into pieces — **shards** — each living on its own database instance.

## Range-Based Sharding

The simplest strategy: split rows into ranges based on some key, and send each range to a different database instance.

```
                         Backend Server
                               │
                 "which shard holds user 'Marcus'?"
                               │
                               ▼
                    ┌──────────────────┐
                    │   Shard Router    │
                    │ (M falls in A-F?  │
                    │  no → G-M → yes)  │
                    └────────┬──────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
 ┌─────────────┐     ┌─────────────┐      ┌─────────────┐
 │  Shard 1    │      │  Shard 2    │      │  Shard 3    │
 │  users A-F  │      │  users G-M  │      │  users N-Z  │
 └─────────────┘     └─────────────┘      └─────────────┘
```

Each shard is a full, independent database — its own disk, its own write capacity, its own indexes. A query for "Marcus" only ever touches Shard 2; Shards 1 and 3 aren't involved at all. Writes are now spread across three masters instead of funneling through one, which is exactly the write-scaling problem replication couldn't solve.

The catch with range sharding: it's easy to end up with **hot shards**. If usernames or, worse, something like signup dates are the shard key, one range can end up far busier than the others (imagine every celebrity account happening to start with the same letter, or a launch-day cohort all landing in one date range).

## Hash-Based Sharding

An alternative: run the shard key through a hash function and use the hash to decide the shard, rather than a human-readable range.

```
shard_index = hash(user_id) % number_of_shards

hash(4471) % 3 = 1   →  Shard 1
hash(9902) % 3 = 0   →  Shard 0
hash(1183) % 3 = 2   →  Shard 2
```

Hashing spreads keys uniformly across shards regardless of any real-world pattern in the key itself (no more "everyone whose name starts with S" clustering) — much better load distribution than naive ranges. The cost: you lose the ability to easily query a *range* of keys (e.g., "all users created in March") in one shard, since related keys are now scattered across all of them.

## The Two Classic Problems Sharding Introduces

**Cross-shard joins.** If `User` lives in one shard by `user_id` but you need to join it against `Order` data that's sharded differently (or the same way, but the join spans multiple users on different shards), you can no longer do a single SQL `JOIN` — the two rows might not even be on the same machine. The application has to fetch from multiple shards and join the results in code, which is slower and more complex than a database-native join.

**Rebalancing when adding a shard.** With `hash(key) % 3`, going to 4 shards changes almost every key's target shard (`% 3` and `% 4` disagree for most inputs) — meaning nearly all the data has to be physically moved. This is the exact problem **consistent hashing** (Phase 04, Lesson 02) was designed to minimize: instead of a plain modulo, consistent hashing arranges shards on a hash ring so that adding or removing one shard only reassigns the small slice of keys near it, not the whole dataset.

```
Naive:  hash(k) % 3 → 4 shards added → hash(k) % 4  → ~75% of keys move
Consistent hashing: adding 1 shard on the ring     → only ~1/N of keys move
```

## Interview Q&A

**Q: Why would you shard a database instead of just adding more read replicas?**
A: Replicas copy the entire dataset and only help read throughput — the write load still funnels through one master, and the whole dataset still has to fit on one machine. Sharding splits the data itself across multiple independent databases, scaling both storage and write throughput.

**Q: What's the trade-off between range-based and hash-based sharding?**
A: Range sharding keeps related keys together, so range queries stay cheap, but can create hot shards if the key distribution is uneven. Hash sharding distributes load evenly, but scatters related keys across shards, making range queries expensive.

**Q: What breaks when you need to join data across two different shards?**
A: You lose the database's native `JOIN` — the rows may live on physically different machines. The application has to issue separate queries to each shard and combine the results itself, which is slower and pushes complexity into application code.

**Q: Why is adding a new shard to a hash-sharded system risky?**
A: With a naive `hash(key) % N`, changing `N` reassigns most keys to a different shard, requiring a massive data migration. Consistent hashing addresses this by only reshuffling the small fraction of keys adjacent to the new shard on the hash ring.

**Q: If you had to shard a `users` table, what would you pick as the shard key, and why?**
A: Usually `user_id`, hashed, because nearly every query in the system is scoped to a single user (their profile, their posts, their orders), so a user's data staying on one shard avoids cross-shard joins for the most common access pattern.
