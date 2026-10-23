# Fragmentation — Complete Guide

## Table of Contents
1. [What is Fragmentation?](#1-what-is-fragmentation)
2. [Internal Fragmentation](#2-internal-fragmentation)
3. [External Fragmentation](#3-external-fragmentation)
4. [Internal vs External — Side by Side](#4-internal-vs-external--side-by-side)
5. [Compaction](#5-compaction)
6. [Why Paging Mostly Fixes This](#6-why-paging-mostly-fixes-this)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is Fragmentation?

Fragmentation is wasted, unusable memory that accumulates as a system allocates and frees memory over time. It comes in two flavors depending on *where* the waste sits:

```
Internal fragmentation:  waste INSIDE an allocated block
External fragmentation:  waste BETWEEN allocated blocks (scattered free holes)
```

Both reduce how effectively RAM is actually used, even when "free memory" totals look healthy.

---

## 2. Internal Fragmentation

Happens when memory is allocated in **fixed-size chunks** (a partition, a page, a size class) and the process doesn't use all of the chunk it was given. The leftover space inside the chunk is wasted — no one else can use it, because it technically "belongs" to the process holding the chunk.

```
Fixed partition size: 4 MB per partition

┌──────────────────────────────────┐
│ Partition (4 MB)                 │
│ ┌───────────────────┐            │
│ │ Process needs 2.5MB│  used     │
│ └───────────────────┘            │
│                     ┌───────────┐│
│                     │  wasted   ││ <- 1.5 MB internal fragmentation
│                     │  (1.5MB)  ││    (allocated to this process,
│                     └───────────┘│     but unused by anyone)
└──────────────────────────────────┘
```

This is the same problem seen with fixed partitioning (Lesson 1) and reappears with **paging**: if a process needs 10,001 bytes and the page size is 4 KB (4096 bytes), it needs 3 full pages (12,288 bytes) — wasting 2,287 bytes in the last page. That waste is internal fragmentation.

```
Process needs: 10,001 bytes.  Page size: 4096 bytes.
Pages required: ceil(10001 / 4096) = 3 pages = 12,288 bytes allocated

┌────────────┬────────────┬────────────┐
│  Page 0    │  Page 1    │  Page 2    │
│  (full)    │  (full)    │ used: 1809 │
│  4096 B    │  4096 B    │ waste: 2287│
└────────────┴────────────┴────────────┘
                              ^^^^^^^^^^
                        internal fragmentation
```

**Key trait:** the waste is *inside* a block that is already assigned to someone — it can't be reused by any other process until that whole block is freed.

---

## 3. External Fragmentation

Happens with **variable-sized** allocation. Individual holes of free memory scattered across RAM may each be too small to satisfy a new request, even though the *total* free memory is more than enough.

```
Physical RAM (20 MB) after processes have come and gone:

┌──────┬────────┬──────┬────────┬──────┬─────────┬──────┐
│ P1   │  free  │ P2   │  free  │ P3   │  free   │ P4   │
│ 3MB  │ 2MB    │ 4MB  │ 1.5MB  │ 2MB  │ 3.5MB   │ 4MB  │
└──────┴────────┴──────┴────────┴──────┴─────────┴──────┘

Total free memory = 2 + 1.5 + 3.5 = 7 MB
New request: a process needing 5 MB contiguous memory

Result: REQUEST FAILS.
No single hole is >= 5 MB, even though 7 MB is free in total.
```

**Key trait:** the waste is *between* allocated blocks — the memory itself isn't given to anyone, but it's unusable because it's fragmented into pieces too small individually.

This is the natural, unavoidable long-term result of variable partitioning: processes of different sizes are loaded and freed in an unpredictable order, leaving a "Swiss cheese" pattern of holes.

---

## 4. Internal vs External — Side by Side

| | Internal Fragmentation | External Fragmentation |
|---|---|---|
| Where waste lives | Inside an allocated block | Between allocated blocks |
| Caused by | Fixed-size allocation units (partitions, pages) | Variable-size allocation over time |
| Visible as "free"? | No — memory looks "used" | Yes — memory looks "free" but is unusably scattered |
| Fixable by compaction? | No — compaction can't shrink a block's internal waste | Yes — compaction merges holes into one big block |
| Typical fix | Smaller allocation units (smaller pages), or accept the waste | Compaction, or move to paging/segmentation to avoid needing contiguity |

---

## 5. Compaction

Compaction is the process of **shuffling allocated blocks together** in physical memory to merge all the small scattered free holes into one large contiguous free block.

```
Before compaction:
┌──────┬────────┬──────┬────────┬──────┬─────────┬──────┐
│ P1   │  free  │ P2   │  free  │ P3   │  free   │ P4   │
│ 3MB  │ 2MB    │ 4MB  │ 1.5MB  │ 2MB  │ 3.5MB   │ 4MB  │
└──────┴────────┴──────┴────────┴──────┴─────────┴──────┘

                    │  compaction: relocate P1, P2, P3, P4
                    │  to be adjacent, sliding them toward one end
                    ▼

After compaction:
┌──────┬──────┬──────┬──────┬────────────────────────────┐
│ P1   │ P2   │ P3   │ P4   │      free (7 MB, one block) │
│ 3MB  │ 4MB  │ 2MB  │ 4MB  │                              │
└──────┴──────┴──────┴──────┴────────────────────────────┘

Now the 5 MB request from Section 3 succeeds.
```

### Costs of Compaction

- **Expensive:** every relocated process's memory must be physically copied — for gigabytes of RAM, this can take a significant amount of time.
- **Requires relocation support:** all references (pointers) to memory inside a process must be updated to reflect the new physical location, which is only feasible if addresses are relocatable (e.g., via a base register that gets updated) rather than hard-coded absolute addresses.
- **Pauses execution:** processes being moved typically must be paused during their own compaction, hurting responsiveness.

Because of this cost, compaction is a poor long-term fix — it's a band-aid for external fragmentation, not a cure. This is one of the biggest reasons operating systems moved to **paging** (Lesson 3), which sidesteps the need for contiguous physical memory entirely.

---

## 6. Why Paging Mostly Fixes This

A quick preview before the next lesson: paging breaks a process's memory into small, fixed-size **pages** that can be scattered anywhere in physical RAM (in fixed-size **frames**) — they don't need to be adjacent to each other at all.

```
Contiguous allocation:  process needs one unbroken 10MB block  → external fragmentation risk
Paging:                 process needs 2,560 x 4KB pages, scattered ANYWHERE in RAM → no external fragmentation
```

Since every "chunk" (page/frame) is the same fixed size, there's no way to end up with a hole "too small" to be useful — any free frame fits any needed page. External fragmentation effectively disappears. The trade-off: paging reintroduces a *small* amount of internal fragmentation (waste in the last, partially-used page of a process), but that's typically far cheaper than external fragmentation ever was.

---

## 7. Hands-On Exercises

**Exercise 1:** Draw (in ASCII, like the diagrams above) a 24 MB RAM timeline where processes of 5MB, 3MB, and 6MB are loaded, then the 3MB one exits, then a new process needs 4MB. Show whether the request succeeds and why.

**Exercise 2:** A process requests 18,500 bytes of memory on a system with a 4 KB (4096 byte) page size. Calculate how many pages are allocated and exactly how many bytes of internal fragmentation result.

**Exercise 3:** Using the RAM layout from Section 3 (holes of 2MB, 1.5MB, 3.5MB, total 7MB free), simulate running compaction. Draw the "before" and "after" layouts and state the size of the single merged free block.

**Exercise 4:** Explain in your own words (3-4 sentences) why compaction cannot fix internal fragmentation, only external fragmentation.

**Exercise 5:** Research one real allocator (e.g., the buddy system used in the Linux kernel for physical page allocation). Write a short paragraph on how it limits fragmentation, and whether the fragmentation it deals with is internal, external, or both.

---

## 8. Interview Q&A

**Q: What's the difference between internal and external fragmentation?**
Answer: Internal fragmentation is wasted space inside an allocated block — for example, a process needing 2.5 MB placed into a fixed 4 MB partition wastes 1.5 MB that no one else can use. External fragmentation is wasted space between allocated blocks — many small free holes scattered through memory that individually are too small to satisfy a new request, even though the sum of free memory would be enough.

**Q: Which fragmentation type does fixed partitioning cause, and which does variable partitioning cause?**
Answer: Fixed partitioning causes internal fragmentation, since a process is placed in a fixed-size slot regardless of its actual size. Variable partitioning avoids internal fragmentation (each allocation is exactly the requested size) but causes external fragmentation over time, as processes of different sizes are allocated and freed, leaving scattered gaps.

**Q: What is compaction and what problem does it solve?**
Answer: Compaction relocates allocated memory blocks so they sit adjacent to each other, merging all the small scattered free holes into one large contiguous free block. It solves external fragmentation. It does not help internal fragmentation, since that waste is inside blocks that are already allocated and in use.

**Q: Why is compaction expensive, and why don't modern OSes rely on it?**
Answer: Compaction requires physically copying potentially gigabytes of memory, updating every relocated process's addresses (feasible only with relocatable/base-register addressing), and pausing affected processes during the move — all of which is slow and disruptive. Modern OSes instead use paging, which avoids the need for contiguous physical memory altogether, sidestepping external fragmentation without ever needing to compact.

**Q: How does paging reduce fragmentation compared to contiguous allocation?**
Answer: Paging divides memory into small, fixed-size pages/frames that can be scattered anywhere in physical RAM rather than requiring one unbroken block. Since every free frame is the same size and fits any needed page, there's no such thing as a "hole too small to use" — external fragmentation essentially disappears. Paging does still cause a small amount of internal fragmentation in the last (partially filled) page of a process, but this is typically much cheaper than the external fragmentation it replaces.

**Q: Can internal fragmentation be completely eliminated?**
Answer: Not without variable-size, exact allocation, which reintroduces external fragmentation — so in practice it's a trade-off, not a solve-both-simultaneously problem. Systems reduce internal fragmentation's *impact* by using smaller fixed allocation units (e.g., smaller page sizes), but smaller units also mean more bookkeeping overhead (bigger page tables), so real systems pick a page size that balances the two costs.
