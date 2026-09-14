# B+ Trees — Complete Guide

> "A supermarket with no aisle signs is not a smaller shop — it is the same shop where finding oregano means walking every shelf, and three signs overhead turn that walk into three glances."

---

## Table of Contents

1. [The Problem: Finding One Row Among Ten Million](#1-the-problem-finding-one-row-among-ten-million)
2. [The Supermarket Aisle Sign Analogy](#2-the-supermarket-aisle-sign-analogy)
3. [The Mechanism: Fanout and Tree Height](#3-the-mechanism-fanout-and-tree-height)
4. [Diagram: The Tree and What Happens on a Split](#4-diagram-the-tree-and-what-happens-on-a-split)
5. [Code Walkthrough: Insert Split and Delete Merge](#5-code-walkthrough-insert-split-and-delete-merge)
6. [Comparing Wide and Shallow to Narrow and Deep](#6-comparing-wide-and-shallow-to-narrow-and-deep)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Finding One Row Among Ten Million

Lesson 1 left the `orders` table as an unordered heap of 250,000 pages. Finding `order_id = 88134` in it means reading pages until the row turns up — on average half the table, in the worst case all of it.

### Eliminating Instead of Examining

```text
orders: 10,000,000 rows │ 250,000 pages │ 2 GB
Full scan at 500 MB/s     →  4.0 seconds
Rows examined to find one →  5,000,000 on average, to return 1
Each read must DISCARD most of what remains, not check one more row:
  examine one row per step  → 10,000,000 steps
  discard half per step     → 24 steps  (log2 of 10 million)
  discard 399/400 per step  → 3 steps   (log400 of 10 million)
  ↳ The lever is not "search faster", it is "how much does one
    read let me stop caring about".
```

### What's Missing

Binary search already discards half per step, but it assumes the data is sorted and that jumping to the midpoint is free. Neither holds on disk: a heap is unsorted, and every midpoint jump is a fresh page read. What is missing is a structure that keeps data sorted *and* makes each read discard far more than half.

---

## 2. The Supermarket Aisle Sign Analogy

A large supermarket carries forty thousand products, and nobody finds oregano by walking every shelf. An overhead sign narrows forty thousand products to one aisle in a single glance; the shelf label narrows the aisle to one bay; the bay's own arrangement does the rest. Three glances, not forty thousand steps — and crucially the signs are *wide*, listing twenty aisles at once, rather than a chain of yes/no questions.

### One Wide Sign vs Twenty Yes-No Questions

```text
Wide sign      → "Aisles 1-20" in one glance; nineteen aisles
                 eliminated by a single look upward
Yes-no chain   → "left half of the store? left half of that?" —
                 five separate walks to reach one aisle
Goods on the   → oregano sits on a shelf, never on the sign; signs
shelf only       carry directions, shelves carry stock
```

### Mapping the Analogy to a B+ Tree

Each sign is an internal node: it holds only directions, and it holds many of them so one read eliminates most of the store. The shelves are leaf nodes: they hold the actual goods. And because the aisles run in order, once you are at oregano you can simply walk sideways to paprika without consulting a sign again — which is exactly how range scans work.

---

## 3. The Mechanism: Fanout and Tree Height

The whole design follows from one constraint: a node must be one page, because a page is the unit of I/O. Making the node hold as many keys as will fit is therefore free, and it is what makes the tree shallow.

### Counting Entries Per Node

```text
Internal node = one 8 KB page of (key, child pointer) pairs
  8-byte BIGINT key + 6-byte page pointer = 14 bytes per entry
  (8192 − ~40 bytes of header) / 14       = ~582 entries
  after fill-factor and alignment         = ~400 in practice
  ↳ This is the FANOUT: one page read chooses among 400 subtrees,
    not among 2.
```

### Height for a Given Row Count

```text
level 1 (root)  400^1 =            400 keys reachable
level 2         400^2 =        160,000
level 3         400^3 =     64,000,000   ← 10M rows fit here
level 4         400^4 = 25,600,000,000
  ↳ 3-4 levels covers everything up to billions of rows. The root
    and level 2 are almost always already cached, leaving roughly
    ONE actual disk read per lookup.
```

### The Structure Itself

```text
Internal node  → keys act as separators only; every key also
                 appears in some leaf. No row data lives here.
Leaf node      → holds the key plus either the full row (clustered
                 index) or a pointer to it (secondary index).
Leaf chain     → leaves link left-to-right, so a scan walks them
                 without ever returning to the root.
Balance rule   → every leaf sits at the SAME depth and nodes stay
                 at least half full; height changes only at the root.
```

Keeping data out of internal nodes is the defining difference from a plain B-tree, and it buys two things: higher fanout (no row bytes competing for space with separators, so a shallower tree) and a complete, ordered leaf chain that a range scan can traverse end to end.

---

## 4. Diagram: The Tree and What Happens on a Split

A tree of order 4 (at most 3 keys per node) makes the shapes visible; real nodes hold hundreds.

### A Populated B+ Tree

```text
                       ┌───────────┐
                       │  30 │ 60  │            ← internal: separators
                       └──┬──┴──┬──┘
              ┌───────────┘     └──────────┐
        ┌─────┴─────┐                ┌─────┴──────┐
        │  10 │ 20  │                │  70 │ 85   │
        └──┬──┴──┬──┘                └──┬──┴───┬──┘
     ▼                ▼             ▼               ▼
  ┌───────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │ 5 │ 8 │→ │ 10 │ 12│20 │→ │ 60 │ 65│70 │→ │ 85 │ 91    │
  └───────┘  └────────────┘  └────────────┘  └────────────┘
   leaves, linked left to right ──────────────────────────▶
  ↳ Search for 65: root (65 ≥ 60 → right) → node (65 < 70 → left)
    → leaf. Three reads, and 60 appears in BOTH an internal node
    and a leaf — internal copies are signposts, not data.
```

### Reading the Diagram

Every search takes exactly the same number of reads because every leaf sits at the same depth — a B+ tree has no "lucky" or "unlucky" keys. And because leaves are chained, `WHERE order_id BETWEEN 60 AND 91` descends once and then walks sideways.

---

## 5. Code Walkthrough: Insert Split and Delete Merge

Inserts and deletes must preserve two invariants: leaves stay at equal depth, and nodes stay at least half full. Splits and merges are how.

### Insert 13 Into a Full Leaf

```text
Step 1 — leaf `10│12│20` is full (max 3 keys); 13 belongs here.
Step 2 — SPLIT: divide into two leaves at the median.
           left  = 10 │ 12      right = 13 │ 20
Step 3 — PROMOTE a copy of the right leaf's first key (13) into
         the parent as a new separator.
  parent before: │ 10 │ 20 │     parent after: │ 10 │ 13 │ 20 │
                       ↳ still fits, so the split stops here.
  ↳ A full parent splits the same way and promotes into ITS parent.
    When the ROOT splits, a new root appears and the tree grows one
    level — the only way height increases, for every leaf at once.
```

### Delete 12 and Merge the Underfull Leaf

```text
Step 1 — remove 12:      leaf `10 │ 12`  →  `10`
Step 2 — leaf now holds 1 key, below the half-full floor (2).
Step 3 — BORROW from the right sibling if it can spare a key:
           `10` + sibling `13│20` → `10│13` and `20`,
           then fix the parent separator to 20.
Step 4 — if the sibling is also minimal, MERGE instead:
           `10` + `13` → `10│13`, and DELETE the parent separator,
           which may leave the parent underfull and cascade upward.
  ↳ A merge that empties the root removes a level. Height shrinks
    only at the root, mirroring how it grows.
```

### Range Queries and ORDER BY Come Free

```sql
SELECT order_id, total FROM orders
 WHERE order_id BETWEEN 88134 AND 88999
 ORDER BY order_id;
-- Descend to the leaf holding 88134 → 3 page reads
-- Walk the leaf chain to 88999      → sequential, already in order
-- No sort step: EXPLAIN shows an Index Scan with no Sort above it
```

The leaves are already in key order, so the same descent that answers a point lookup answers a range, and `ORDER BY` on the index key needs no sort at all. `MIN`/`MAX` are the degenerate case: walk to the leftmost or rightmost leaf and stop.

---

## 6. Comparing Wide and Shallow to Narrow and Deep

A balanced binary search tree and a B+ tree both give logarithmic search. On disk they are not remotely comparable, because the base of the logarithm is the number of page reads.

### B+ Tree vs Binary Search Tree

| | B+ Tree | Balanced Binary Search Tree |
|---|---|---|
| Node size | One page (8-16 KB) | One key, two pointers |
| Fanout | ~400 | 2 |
| Height at 10M rows | 3-4 | ~24 |
| Page reads per lookup | 3-4, mostly cached | Up to 24, each a random read |
| Range scan | Descend once, walk linked leaves | In-order traversal, jumping all over |
| Where data lives | Leaves only | Every node |

### Takeaway

A binary tree minimises comparisons; a B+ tree minimises page reads, and a page read costs roughly a hundred thousand times a comparison. Reading 8 KB to make one decision looks wasteful until you notice it is the same price as reading 8 bytes — so the tree spends bytes freely to buy a smaller height. That is why in-memory structures stay narrow and disk structures go wide.

---

## 7. Common Mistakes

- **Confusing a B-tree with a B+ tree.** A classic B-tree stores row data in internal nodes as well as leaves, which shrinks fanout (row bytes crowd out separators) and leaves no complete leaf chain to scan. B+ trees keep internal nodes to pure separators and put all data in linked leaves, which is why essentially every disk-based index in production — InnoDB, PostgreSQL btree, SQL Server — is the B+ variant.
- **Assuming an index physically sorts the table.** In a secondary index the leaves hold `key → row pointer`, and the heap stays in whatever order Lesson 1 left it. Only a clustered index (InnoDB's primary key, a SQL Server clustered index) actually stores rows in the leaves, and a table can have at most one of those.
- **Using a random UUID as a clustered primary key without thinking about splits.** Sequential keys always append to the rightmost leaf, filling pages neatly. Random keys land in random leaves, so a busy table splits pages everywhere at once, leaving them half full — the index inflates and cache hit rates fall. Time-ordered identifiers such as UUIDv7 restore the append pattern.
- **Reading "height 4" as "four disk reads".** The root and the level below it are a handful of pages that stay pinned in the buffer pool, so a warm 4-level tree typically costs one real disk read. This is also why adding rows barely slows lookups: going from 10 million to 10 billion adds one level, and that level is usually cached too.

---

## 8. Hands-On Exercises

**Exercise 1:** Compute the fanout for your own key type by hand — take an 8 KB page, subtract about 40 bytes of header, and divide by (key width + 6-byte pointer) for a `BIGINT`, a `UUID` (16 bytes), and a 40-byte `VARCHAR`. Then compute how many rows each fanout covers at three levels and note how much a wide key costs you.

**Exercise 2:** In PostgreSQL run `CREATE EXTENSION pageinspect;`, build an index on a 1-million-row table, then run `SELECT level, root FROM bt_metap('orders_pkey');` to read the tree's actual height. Add ten million more rows and check whether the level changed.

**Exercise 3:** Run `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE order_id BETWEEN 500 AND 900 ORDER BY order_id` and confirm there is an Index Scan with no Sort node above it. Then order by a non-indexed column and observe the Sort node appear.

**Exercise 4:** Create two copies of the same table, one with a `BIGSERIAL` primary key and one with a `uuid` primary key filled by `gen_random_uuid()`. Insert a million rows into each, then compare `pg_relation_size` of the two primary key indexes. The random-key index should be visibly larger for identical data.

**Exercise 5:** Reproduce the second mistake from Section 7. Create a secondary index on `orders(customer)`, then `SELECT ctid, customer FROM orders ORDER BY customer LIMIT 20` and read the `ctid` page numbers — they will jump around, proving the index is sorted while the heap behind it is not.

---

## 9. Interview Q&A

**Q: Why do databases use B+ trees instead of binary search trees?**
Because the cost that matters on disk is page reads, not comparisons. A binary tree makes one decision per node and would be about 24 levels deep at ten million rows, meaning up to 24 random reads. A B+ tree sizes each node to a full page so one read chooses among roughly 400 subtrees, which puts the same ten million rows within three or four levels — and since the top levels stay cached, a lookup is usually one real disk read.

**Q: What is the difference between a B-tree and a B+ tree?**
A B-tree stores data in internal nodes as well as leaves; a B+ tree stores only separator keys internally and keeps all data in the leaves, which are linked into an ordered chain. That buys higher fanout, because row bytes are not competing with separators for page space, and it makes range scans a single descent followed by a sideways walk. Effectively every disk-based index in production is the B+ variant even when people say "B-tree".

**Q: What happens when you insert into a full node?**
The node splits at its median into two nodes, and a separator key is promoted into the parent. If the parent is also full it splits too, and the process can cascade upward. When the root itself splits, a new root is created and the tree gains a level — that is the only way height ever increases, and because it happens at the root every leaf stays at the same depth, which is what keeps the tree balanced without any rotations.

**Q: Why do range queries and `ORDER BY` come free on an indexed column?**
The leaves already hold keys in sorted order and are linked left to right, so answering `BETWEEN` means descending to the first matching leaf once and then walking the chain sequentially. There is no sort step because there is nothing left to sort — an `EXPLAIN` will show an index scan with no sort node above it. `MIN` and `MAX` are the same idea taken to the edge: descend to the leftmost or rightmost leaf and stop.

**Q: Why can a random UUID primary key hurt a clustered index?**
Sequential keys always land in the rightmost leaf, so pages fill densely and splits are rare and localised. Random keys arrive in random leaves, so pages split all across the tree and each split leaves two half-full pages behind. The index ends up substantially larger for the same data, which means more pages to cache and a lower buffer pool hit rate. Time-ordered identifiers like UUIDv7 keep global uniqueness while restoring the append-only insert pattern.
