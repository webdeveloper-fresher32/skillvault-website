# Partitioning and Consistent Hashing — Complete Guide

> "A cloakroom that has outgrown one rail does not buy a longer rail — it opens a second rail and needs a rule for which coat goes where, and that rule decides how much work a third rail creates."

---

## Table of Contents

1. [The Problem: A Table That Outgrows One Machine](#1-the-problem-a-table-that-outgrows-one-machine)
2. [The Library Shelving Analogy](#2-the-library-shelving-analogy)
3. [The Mechanism: Three Ways to Assign a Key to a Partition](#3-the-mechanism-three-ways-to-assign-a-key-to-a-partition)
4. [Diagram: The Consistent Hashing Ring](#4-diagram-the-consistent-hashing-ring)
5. [Code Walkthrough: Counting Keys Moved by Modulo and by a Ring](#5-code-walkthrough-counting-keys-moved-by-modulo-and-by-a-ring)
6. [Comparing Local Secondary Indexes to Global Secondary Indexes](#6-comparing-local-secondary-indexes-to-global-secondary-indexes)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: A Table That Outgrows One Machine

Replication (Lesson 1) puts a full copy of the data on every node, so it does nothing for two limits: a dataset larger than one machine's disk, and a write rate larger than one machine's write path. Partitioning — also called sharding — splits the data so each node holds a different subset.

### One Table Past One Machine

```text
  events table:  14 TB and growing 40 GB/day
  node disk:     4 TB
    ↳ Replication makes 3 copies of 14 TB. It never makes 14 TB fit.
  write rate:    38,000 inserts/sec
  one leader:    ~8,000 inserts/sec sustained
    ↳ Every follower must apply all 38,000 writes too, so adding
      followers never moves the write ceiling.
  Across 8 partitions: ~1.75 TB and ~4,750 inserts/sec per node
```

### What's Missing

Splitting the data is easy to state and hard to do well, because two questions decide everything: which partition a given key belongs to, and what happens to that answer when the number of partitions changes. Get the first wrong and one node melts while seven idle; get the second wrong and adding a node reshuffles the entire dataset.

---

## 2. The Library Shelving Analogy

A library that has outgrown one room can split its books by author surname — A–F in room one, G–M in room two — which makes "everything by Le Guin" a single walk to a single room, but leaves the S room permanently crowded because so many surnames start with S. Or it can give every book an arbitrary accession number and shelve by that: rooms fill evenly, and "everything by Le Guin" now means walking every room.

### Surname Shelves vs Accession Numbers

```text
Shelve by surname  → neighbours stay together, so a range of surnames
                     is one trip — but the popular letters overflow
                     their room while others sit half empty
Shelve by number   → every room holds the same count, and nothing that
                     belongs together is together, so "everything by
                     X" visits every room
```

### Mapping the Analogy to Partitioning

Surname shelving is key-range partitioning: ordered, scan-friendly, and prone to hot spots. Accession-number shelving is hash partitioning: even, and hostile to range scans. The librarian's index card saying which room holds which book is the third option, a directory.

---

## 3. The Mechanism: Three Ways to Assign a Key to a Partition

Every partitioning scheme is a function from a key to a partition. There are only three shapes it takes.

### Key-Range Partitioning

```text
partition 1: customer_id  'a'  .. 'f'
partition 2: customer_id  'g'  .. 'm'
partition 3: customer_id  'n'  .. 's'
partition 4: customer_id  't'  .. 'z'
  ↳ Keys stay sorted inside a partition, so a range scan such as
    WHERE customer_id BETWEEN 'ba' AND 'bz' reads one partition.
  ↳ Boundaries come from the data, and a partition that grows too
    large is split in two.
Hot spot: partition by timestamp and every insert for the current
hour lands on the newest partition; the other three take zero.
```

### Hash Partitioning

```text
partition = hash(customer_id) mod 4   ← Section 5 shows why mod is
                                        the wrong rule to expose
  hash("cust-8812") = 3391847521  → mod 4 = 1
  hash("cust-8813") = 1120044109  → mod 4 = 1
  hash("cust-8814") = 2847100933  → mod 4 = 3
  ↳ Adjacent keys land on unrelated partitions. Load spreads evenly.
  ↳ WHERE customer_id BETWEEN 'ba' AND 'bz' now asks every partition,
    because the hash destroyed the ordering.
Compromise: a compound key hashes the first column to pick the
partition and sorts rows by the second column inside it.
```

### Directory-Based Partitioning

```text
lookup table (kept in a small strongly consistent store):
  cust-8812 → partition 7;  tenant "acme" at 18 TB → partitions 9-11
  ↳ Total freedom: move any key anywhere, give a huge tenant its own
    nodes, migrate one customer without touching the scheme.
  ↳ Every read and write consults the directory first — one more hop
    and one more thing that must not go down.
```

---

## 4. Diagram: The Consistent Hashing Ring

### The Ring with Virtual Nodes

```text
Hash space 0 .. 2^32-1 bent into a circle. Each node is hashed onto
several points called tokens; a key is hashed onto a point and belongs
to the first token clockwise from it.

                     0 / 2^32
                        ┌──┐
             n3-v9 ─────┤  ├───── n1-v4
                    ┌───┘  └───┐
    key "cust-8812" ●          │  n2-v7
             n2-v1 ─┤ clockwise├───── n3-v2
                    └───┐  ┌───┘
             n1-v6 ─────┴──┴───── n2-v3
  ↳ "cust-8812" hashes between n2-v1 and n1-v4, so it belongs to n1.
  ↳ Add n4: it drops ~128 tokens onto the ring and takes only the keys
    immediately counter-clockwise of each. Every other key keeps its
    existing owner.
  ↳ Remove n2: each of its ranges goes to the next token clockwise,
    spread across many nodes rather than dumped on one.
```

### Reading the Diagram

Virtual nodes are the reason both bullets above are true. With one token per node, three nodes cut the circle into three arcs of wildly unequal size, and losing a node hands its whole arc to a single neighbour. With 128 tokens per node the arcs average out, the load per node is close to even, and departures and arrivals are shared. Tokens are also how you give a bigger machine more data: give it more tokens.

---

## 5. Code Walkthrough: Counting Keys Moved by Modulo and by a Ring

The argument for consistent hashing is a number, so measure it. This script places 100,000 keys with `hash % N`, then on a ring, and counts how many change owner when a fourth node becomes a fifth.

### The Modulo Experiment

```python
# rebalance.py — run it; the numbers below are what it prints
import bisect, zlib

def h(s):
    return zlib.crc32(s.encode())
keys = [f"cust-{i}" for i in range(100_000)]
moved = sum(1 for k in keys if h(k) % 4 != h(k) % 5)
print(moved / len(keys))   # 0.80 — 80,000 of 100,000 keys change node
```

### The Same Experiment on a Ring

```python
def build(nodes, vnodes=128):
    ring = sorted((h(f"{n}#{v}"), n) for n in nodes for v in range(vnodes))
    return [p for p, _ in ring], [n for _, n in ring]

def owner(points, owners, key):
    return owners[bisect.bisect(points, h(key)) % len(points)]

p4, o4 = build(["n1", "n2", "n3", "n4"])
p5, o5 = build(["n1", "n2", "n3", "n4", "n5"])
moved = sum(1 for k in keys if owner(p4, o4, k) != owner(p5, o5, k))
print(moved / len(keys))        # ~0.18 — only n5's fair share moves
```

### Reading the Two Numbers

```text
hash % 4 → hash % 5      80% of keys move   ~11 TB of a 14 TB dataset
consistent hashing ring  ~18% of keys move  ~2.5 TB, n5's own share
  ↳ About 20% is the floor: five nodes each hold a fifth, so a fifth
    of the data must move regardless. Modulo moves four times that
    minimum, while the cluster serves traffic on cold caches.
  ↳ Consistent hashing is no faster to compute and spreads load no
    better than a good hash. It is simply cheaper to change N.
```

---

## 6. Comparing Local Secondary Indexes to Global Secondary Indexes

Partitioning is defined on the primary key, so a query on any other column has to be answered by an index that itself has to live somewhere. There are two places to put it.

### Local vs Global Secondary Indexes

| | Local (partitioned by document) | Global (partitioned by term) |
|---|---|---|
| Index contents | Each partition indexes only its own rows | The index is partitioned by the indexed value itself |
| Write path | One partition — row and index entry are co-located | Row on one partition, index entry on another; usually applied asynchronously |
| Read path | Scatter-gather: ask every partition, merge the results | One partition holds every match for `colour = red` |
| Read latency | Bounded by the slowest partition, so tail latency grows with partition count | One hop, independent of cluster size |

### Takeaway

Local indexes make writes cheap and reads expensive; global indexes make reads cheap and writes expensive and often eventually consistent. Scatter-gather is the reason local indexes get slower as the cluster grows: with 64 partitions, a p99 read waits on the worst of 64 responses, so tail latencies that were rare become normal.

---

## 7. Common Mistakes

- **Partitioning on a monotonically increasing key.** A timestamp or auto-increment id under range partitioning sends every insert to the newest partition, which becomes the single hot node while the rest of the cluster idles — the exact bottleneck partitioning was supposed to remove. Prefix the key with something that varies per write, such as a device or tenant id, so writes spread while related rows stay together.
- **Assuming a good hash function eliminates hot spots.** Hashing fixes skew caused by uneven key distribution, not skew caused by uneven key popularity. If one celebrity account receives 40% of all reads, hashing puts that single key on one partition and that partition takes 40% of the load; splitting it needs a deliberate fix such as appending a two-digit suffix to fan the key across 100 partitions and reading all 100 back.
- **Exposing `hash(key) % N` as the placement rule.** It works perfectly until N changes, and then roughly `1 - 1/N'` of the whole dataset moves, as Section 5 measures. Use a ring, or a fixed large number of partitions mapped onto nodes, so N in the hash never changes.
- **Choosing a partition key that the common query does not filter on.** If every query filters on `customer_id` but the data is partitioned by `order_id`, every query becomes a scatter-gather across all partitions. The partition key should be the column the dominant access pattern already carries.

---

## 8. Hands-On Exercises

**Exercise 1:** Run the `rebalance.py` script from Section 5 as written, then change it to grow from 8 nodes to 9. Record the modulo and ring percentages for both experiments and confirm the ring number approaches `1/9` while the modulo number stays near 90%.

**Exercise 2:** Modify `build()` to use `vnodes=1` and print, for 4 nodes, how many of the 100,000 keys each node owns. Then rerun with `vnodes=128`. Quantify how uneven single-token placement is and explain why virtual nodes exist.

**Exercise 3:** Design the partition key for a table storing `(device_id, recorded_at, temperature)` for 50,000 IoT devices writing once per second, where the dominant query is "the last 24 hours for one device". State the partition key and the sort key, and explain why partitioning on `recorded_at` alone would fail.

**Exercise 4:** Take a `products` table partitioned by `product_id` and a query filtering on `colour`. Write out the request flow for a local secondary index across 16 partitions, then for a global one, and count how many partitions each read and each write touches.

**Exercise 5:** Reproduce the celebrity hot spot from Section 7. Build a key list where one key appears in 40% of a million simulated reads, hash-partition it across 8 nodes, and print per-node read counts. Then apply the suffix fix — write to `celebrity-00` through `celebrity-99` and read all 100 — and print the counts again, noting what the fix costs on the read path.

---

## 9. Interview Q&A

**Q: What is the difference between replication and partitioning and why do you usually need both?**
Replication puts complete copies of the same data on several nodes, which buys availability, read scale and durability. Partitioning splits the data so each node holds a different subset, which is the only one of the two that addresses a dataset bigger than one disk or a write rate bigger than one machine. Real systems combine them: the data is split into partitions and each partition is then replicated, so a node failure loses neither a partition nor the ability to serve it.

**Q: What actually goes wrong with `hash(key) % N`?**
It is a fine placement function as long as N never changes, and N changing is the entire point of adding a machine. When four nodes become five, `hash % 4` and `hash % 5` disagree for about 80% of keys, so 80% of the dataset has to move across the network while the cluster is still serving traffic. Consistent hashing places nodes and keys on a shared hash ring so that adding a node only reassigns keys in the arcs that node newly covers — about `1/N`, which is the unavoidable minimum.

**Q: Why do virtual nodes exist?**
With one point per node on the ring, the arcs between nodes are random and therefore very unequal, so one node can end up with several times the data of another. Giving each node many tokens — often 128 or 256 — averages those arcs out so the load per node is close to even. It also means that when a node leaves, its ranges are inherited by many different successors rather than dumped entirely on one neighbour, and it lets you weight a larger machine simply by giving it more tokens.

**Q: When would you choose range partitioning over hash partitioning?**
When range scans dominate the workload, because range partitioning keeps keys in sorted order inside a partition, so "all readings for device 12 between Monday and Wednesday" reads one partition sequentially instead of asking every node. The price is hot spots: any key that increases monotonically, such as a timestamp, sends all current writes to one partition. The common compromise is a compound key — hash the first component to choose the partition, keep rows sorted by the second component within it.

**Q: What is a scatter-gather read and why does it get worse as the cluster grows?**
It is the read pattern forced by a local secondary index: since each partition indexes only its own rows, a query on the indexed column must be sent to every partition and the results merged. The cost is not the average latency but the tail — the query cannot finish until the slowest partition answers, so with 64 partitions you are waiting on the worst of 64 responses on every request. A global, term-partitioned index avoids that by putting all entries for a given value on one partition, at the cost of writes touching several partitions and the index typically lagging behind the data.
