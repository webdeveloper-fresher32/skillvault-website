# LSM Trees and SSTables — Complete Guide

> "Re-alphabetising a paper address book every time you meet someone is unbearable, so you scribble names on the notepad by the phone and tidy the whole batch into the book once a week."

---

## Table of Contents

1. [The Problem: Every Write Is a Random Page Write](#1-the-problem-every-write-is-a-random-page-write)
2. [The Address Book and Notepad Analogy](#2-the-address-book-and-notepad-analogy)
3. [The Mechanism: Memtable Flush and SSTable](#3-the-mechanism-memtable-flush-and-sstable)
4. [Diagram: A Read Descending Through the Levels](#4-diagram-a-read-descending-through-the-levels)
5. [Code Walkthrough: Bloom Filters and Compaction](#5-code-walkthrough-bloom-filters-and-compaction)
6. [Comparing Size-Tiered to Levelled Compaction](#6-comparing-size-tiered-to-levelled-compaction)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Every Write Is a Random Page Write

A B+ tree keeps its keys in order, which is exactly what makes reads cheap — and exactly what makes writes expensive. An insert must land in the one leaf page where that key belongs, and that page is wherever it happens to be.

### One Insert Touching Four Pages

```text
INSERT INTO events (event_id, payload) VALUES (7710244, '...');
  1-2. read root + internal page      (cached)
  3.   read the target leaf page      ← random 8 KB read
  4-5. modify 200 bytes, write the
       whole 8 KB leaf back           ← random 8 KB write
  6.   leaf full → split, rewrite two leaves + the parent
Sequential write on NVMe 2,000 MB/s vs random 8 KB writes at
~60,000 IOPS ≈ 470 MB/s
  ↳ 200 bytes of intent cost 8-24 KB, written in the slowest
    access pattern the device offers.
```

### What's Missing

Nothing is wrong with the B+ tree — sorted-in-place is the price of a three-read lookup. What is missing is the option to decline that price on the write path: a way to accept a write without immediately finding the one correct place to put it, and to postpone sorting until it can be done in bulk.

---

## 2. The Address Book and Notepad Analogy

A bound, alphabetised address book is wonderful to look up in and miserable to add to: every new name means finding the right page and squeezing it into a full one. So nobody does that. Names get scribbled on the notepad by the phone in arrival order, and once a week the whole batch is copied into a fresh sorted booklet in one sitting.

### Alphabetised Book vs Notepad Plus Weekly Tidy-Up

```text
Address book → every new name means locating one exact page and
               rewriting it; ordered, but painful per entry
Notepad      → next blank line, always; no lookup, no decision
Weekly tidy  → copy the batch into a fresh sorted booklet, in
               order, in bulk; bin the old notepad
Looking up   → notepad, then newest booklet, then older ones;
               the newest mention wins
```

### Mapping the Analogy to an LSM Tree

The notepad is the memtable, the sorted booklet is an SSTable, and the weekly tidy-up is compaction. The cost is that a lookup now consults several booklets instead of one book — and everything else in this lesson is about making that cheap again.

---

## 3. The Mechanism: Memtable Flush and SSTable

A **log-structured merge tree** takes the opposite bet from a B+ tree: never update a page in place, only ever append, and reorganise later in the background.

### The Write Path

```text
write(event_id=7710244, payload='...')
  1. append the record to the write-ahead log   ← sequential
  2. insert into the MEMTABLE (a sorted in-  ← no disk I/O
     memory skip list), then return success
  ...memtable reaches its threshold, say 64 MB...
  3. mark it immutable, start a fresh one
  4. FLUSH it as one new SSTable, written    ← one big
     once, sequentially, never modified        sequential write
  ↳ Nothing is read before being written and nothing on disk is
    ever edited. Delete is a write too: a TOMBSTONE record saying
    "this key is gone as of now".
```

### What an SSTable Contains

An SSTable (sorted string table) is an immutable file of key-value pairs in key order, carrying its own metadata so a reader can skip it without opening the data.

```text
┌──────────────────────────────────────────────┐
│ Data blocks  — key/value pairs in KEY ORDER  │
│ Sparse index — every Nth key → block offset  │
│ Bloom filter — "is this key possibly here?"  │
│ Footer       — min key, max key, entry count │
└──────────────────────────────────────────────┘
  ↳ Immutability makes it safe to read a file mid-compaction, and
    is why SSTables compress well: written once, sorted, unpatched.
```

### Why Reads Got Harder

```text
get(event_id = 7710244) must consult, newest first:
  memtable → SSTable #47 → #46 → #45 → ... → #1
  ↳ Stop at the first hit: newer wins, so #47 supersedes #12 and
    a tombstone in #47 means "deleted" even though #12 holds a
    value. A missing key is the worst case — every file must be
    ruled out before answering "no row".
```

---

## 4. Diagram: A Read Descending Through the Levels

Two cheap per-file filters turn "check every file" back into "check one or two".

### The Read Path with Filters

```text
 get("user:8813")
 ┌──────▼───────┐  hit → return
 │   MEMTABLE   │────────────────▶
 └──────┬───────┘ miss
        ▼
 ┌───────────────────────────────────────────────────────┐
 │ L0  A [min a1..max c9] ↳ out of range → SKIP, no I/O │
 │     B [min t0..max z9] ↳ bloom says PROBABLY NOT→SKIP│
 │ L1  C [min u0..max u9] ↳ bloom MAYBE → sparse index  │
 │                          → read ONE data block → hit │
 └───────────────────────────────────────────────────────┘
```

### Reading the Diagram

The min/max footer is a free exact filter and eliminates most files outright once levels are sorted and non-overlapping. The bloom filter catches the rest: it says "definitely not here" or "probably here", never "definitely here", so a positive answer still costs a real read while a negative one costs nothing but memory.

---

## 5. Code Walkthrough: Bloom Filters and Compaction

The two mechanisms that make LSM reads survivable are a probabilistic membership test and a background merge.

### Sizing a Bloom Filter

```python
# A bit array plus k hash functions. Insert sets k bits; a lookup
# finding any of those k bits unset PROVES the key is absent. No
# false negatives; false positives cost extra bits per key.
bits_per_key = 10          # RocksDB / Cassandra default territory
false_positive_rate = 0.01 # ~1% at 10 bits/key with ~7 hashes
keys = 10_000_000          # keys in one SSTable's filter
memory_bytes = keys * bits_per_key / 8      # 12.5 MB for 10M keys
wasted_reads = keys * false_positive_rate   # 1 in 100 lookups pays
#   ↳ 12.5 MB of RAM removes 99% of the wasted reads for keys not
#     in that file; 20 bits/key buys ~0.05%.
```

### Why Compaction Is Not Optional

```text
After a day of writes with no compaction:
  file count        → thousands; every miss checks all of them
  superseded values → user:8813 written 400 times → 400 copies
  tombstones        → deleted rows still occupy space forever
  disk usage        → grows with WRITES, not with live data
Compaction reads N sorted SSTables, merges them by key, keeps the
newest value per key, drops tombstones once no older file can hold
it, writes ONE new sorted file, and deletes the inputs.
  ↳ Sequential read plus sequential write, but it competes with
    live traffic — a stalled compaction is a classic LSM incident.
```

### The Three Amplifications

```text
Write amplification = bytes written / bytes the app wrote
  ↳ a 200-byte row rewritten by 5 compaction passes = WA of ~5.
Read  amplification = disk reads performed / logical reads issued
  ↳ a lookup checking 6 files before answering = RA of 6.
Space amplification = bytes on disk / bytes of live data
  ↳ 300 GB of files holding 100 GB of current values = SA of 3.
  ↳ You cannot minimise all three: compact harder and WA rises while RA and SA fall.
```

---

## 6. Comparing Size-Tiered to Levelled Compaction

Both merge SSTables; they differ in *which* files they choose to merge, and that choice sets where the three amplifications land.

### Size-Tiered vs Levelled

| | Size-Tiered | Levelled |
|---|---|---|
| Merge rule | Merge N files of similar size into one bigger file | Each level is ~10x the previous; merge a file down into the overlapping files below |
| Files checked per miss | Every file in every tier | At most one per level, plus all of L0 |
| Write amplification | Low — roughly log of the data size | High — each level rewrite multiplies it |
| Space amplification | High — up to ~2x while the largest tier merges | Low — around 1.1x |
| Used by | Cassandra (default), HBase, ScyllaDB | RocksDB, LevelDB, Cassandra (opt-in LCS) |

### Takeaway

Pick by which amplification actually hurts. A time-series or event-log workload writes constantly, rarely overwrites, and queries by recent range — size-tiered keeps write amplification low and the min/max footers do the read filtering anyway. A workload that overwrites the same keys repeatedly and reads them back would drown in obsolete copies under size-tiering, so levelled trades write bandwidth for a small, tidy disk footprint. B+ tree engines like InnoDB and PostgreSQL sit at the far end of the same spectrum: read and space amplification near 1, write amplification paid up front on every single write.

---

## 7. Common Mistakes

- **Assuming an LSM tree is always faster at writes.** It is faster at *ingesting* writes, because the foreground path is an append and a memory insert. The disk work does not disappear; it is deferred into compaction, and a system whose compaction cannot keep up will stall writes outright. Sustained write throughput is bounded by compaction bandwidth, not by how fast the memtable accepts rows.
- **Believing a bloom filter can confirm a key exists.** It answers "definitely not present" or "possibly present" — never "definitely present". A positive answer still requires reading the data block, and at a 1% false positive rate one in a hundred of those reads finds nothing. Treating a bloom hit as an existence proof produces phantom rows.
- **Forgetting that deletes make files bigger.** A delete writes a tombstone, so disk usage goes *up* until compaction can prove no older SSTable holds the key. In Cassandra a tombstone must also outlive `gc_grace_seconds` before removal, and a range scan across a region full of tombstones can read far more than the rows it returns.
- **Comparing engines on write amplification alone.** Write, read and space amplification trade against each other, so a strategy that looks superb on one is paying for it on the others. The only meaningful comparison is against the workload: read/write ratio, overwrite rate, and how much spare disk exists.

---

## 8. Hands-On Exercises

**Exercise 1:** Install RocksDB or LevelDB, write one million keys, then list the data directory and identify the `.sst` files, the `LOG`, and the write-ahead log. Note the file count and total size, then force a compaction and list the directory again.

**Exercise 2:** In Cassandra, create a table, insert rows, and run `nodetool flush` followed by `nodetool tablestats <keyspace>.<table>`. Read off the SSTable count, the bloom filter false-positive ratio, and the space used, then run `nodetool compact` and compare all three.

**Exercise 3:** Compute the three amplifications for a concrete scenario by hand: 100 GB of live data, each key overwritten 5 times, levelled compaction across 4 levels. Estimate write amplification per level, read amplification for a key that does not exist, and space amplification before and after a full compaction.

**Exercise 4:** Implement a bloom filter in about thirty lines — a bit array plus `k` hash functions derived from two base hashes — insert 100,000 keys at 10 bits per key, then query 100,000 keys you never inserted and measure the observed false positive rate against the predicted 1%.

**Exercise 5:** Reproduce the third mistake from Section 7. In Cassandra, insert 100,000 rows, run `nodetool flush` and record the space used; then delete all 100,000 rows, flush again, and record it once more. Confirm the deletes made the table larger, and explain when that space is reclaimed.

---

## 9. Interview Q&A

**Q: Why are appends so much faster than in-place updates on disk?**
An in-place update has to read the target page, modify it, and write the whole page back at a location determined by the key, so a 200-byte change costs an 8 KB random read plus an 8 KB random write, and page splits can multiply that. An append goes to the end of the current file, so many writes coalesce into one large sequential transfer, which is the access pattern both spinning disks and SSDs are fastest at. On an SSD it also matters that a random overwrite forces read-modify-write of a much larger flash erase block, which appends avoid.

**Q: What happens on an LSM tree's write path and read path?**
A write appends to the write-ahead log for durability, then inserts into the in-memory memtable, and returns — no disk seek is involved. When the memtable hits its size threshold it is frozen and flushed sequentially as a new immutable SSTable. A read checks the memtable first, then SSTables newest to oldest, returning at the first hit because newer always supersedes older; a delete is a tombstone record, so finding a tombstone first means the key is gone. Per-file min/max keys and bloom filters let most files be skipped without any I/O.

**Q: What does a bloom filter guarantee, and what does it cost?**
It guarantees no false negatives: if it says a key is absent from a file, the key is genuinely absent, so that file can be skipped without reading it. It permits false positives, at a rate you buy down with memory — roughly 1% at 10 bits per key, around 0.05% at 20. For ten million keys that is about 12.5 MB of RAM to eliminate 99% of the wasted reads on lookups for keys that are not there, which is the single most important optimisation for the LSM miss path.

**Q: What are read, write and space amplification, and why can you not minimise all three?**
Write amplification is bytes written to storage divided by bytes the application wrote; read amplification is disk reads performed per logical read; space amplification is bytes on disk divided by bytes of live data. Compacting more aggressively merges away obsolete copies, which lowers read and space amplification but rewrites the same data repeatedly, raising write amplification. Compacting less does the opposite. Every storage engine is a specific point on that surface, which is why the right question is always which amplification your workload can afford.

**Q: When would you choose size-tiered compaction over levelled?**
Size-tiered merges files of similar size and keeps write amplification low, at the cost of high read amplification and up to roughly 2x space amplification while the largest tier merges — a good fit for write-heavy, append-mostly workloads like event logs and time series, which rarely overwrite and often query by recent range. Levelled keeps each level non-overlapping and roughly ten times the previous, so a miss checks at most one file per level and space amplification stays near 1.1x, paying for it with much higher write amplification. Cassandra defaults to size-tiered while RocksDB and LevelDB default to levelled, and Cassandra will switch to levelled on request for overwrite-heavy, read-heavy tables.
