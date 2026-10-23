# Segmentation — Complete Guide

## Table of Contents
1. [The Core Idea](#1-the-core-idea)
2. [How Segmentation Works](#2-how-segmentation-works)
3. [Address Translation with Segments](#3-address-translation-with-segments)
4. [Segmentation vs Paging](#4-segmentation-vs-paging)
5. [Segmentation with Paging Combined](#5-segmentation-with-paging-combined)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Core Idea

Paging (Lesson 3) splits memory into fixed-size, meaningless chunks — a page boundary has nothing to do with the structure of the program. Segmentation instead splits a process's address space into variable-size, **logically meaningful** units that mirror how a programmer actually thinks about a program:

```
A typical process, viewed as segments:

┌────────────────────────────────────────────────┐
│  Segment 0: Code (.text)         — 8 KB          │
│  Segment 1: Global data (.data)  — 4 KB          │
│  Segment 2: Heap                 — grows up       │
│  Segment 3: Stack                — grows down     │
│  Segment 4: Shared library       — 2 KB           │
└────────────────────────────────────────────────┘
```

Each segment is a separate logical entity, with its own size and its own protection attributes (e.g., code is read/execute-only, the stack is read/write, data may be read-only after init). This maps naturally onto how compilers and linkers already organize a program.

---

## 2. How Segmentation Works

Instead of one flat page table, each process has a **segment table**. Each entry describes one segment:

```
Segment Table
┌────────────┬─────────────┬────────┬────────────┐
│ Segment #  │ Base (addr) │  Limit │ Protection │
├────────────┼─────────────┼────────┼────────────┤
│ 0 (Code)   │  4000       │  2000  │  R-X       │
│ 1 (Data)   │  8000       │  1500  │  RW-       │
│ 2 (Heap)   │  15000      │  3000  │  RW-       │
│ 3 (Stack)  │  25000      │  1000  │  RW-       │
└────────────┴─────────────┴────────┴────────────┘

Base  = starting physical address of this segment
Limit = size of the segment (in bytes) — used for bounds checking
```

A logical address in a segmented system is a pair: `(segment number, offset within segment)`.

```
Physical RAM layout (segments placed wherever they fit — contiguous per segment,
but segments themselves can be scattered, just like variable partitions):

0     4000        6000  8000      9500        15000         18000  25000  26000
├──────┼───────────┼─────┼──────────┼────────────┼──────────────┼───────┼─────┤
│ (OS) │  Segment 0│(free)│Segment 1 │   (free)   │  Segment 2   │(free) │Seg 3│
│      │  (Code)   │      │  (Data)  │            │   (Heap)     │       │(Stk)│
└──────┴───────────┴─────┴──────────┴────────────┴──────────────┴───────┴─────┘
```

Because segments are variable-sized and placed via contiguous allocation for each segment, segmentation **reintroduces external fragmentation** between segments — exactly the problem paging was designed to avoid. This is the key motivation for combining the two (Section 5).

---

## 3. Address Translation with Segments

```
Logical Address = (Segment Number s, Offset d)

Translation steps:
1. Use segment number (s) to index into the Segment Table
2. Retrieve Base and Limit for that segment
3. Bounds check: is offset (d) < Limit?
      NO  → trap: "segmentation fault" (this is literally where the term comes from!)
      YES → continue
4. Physical Address = Base + Offset
```

```
┌───────────────────────────────────────────────────────────────────┐
│                 Segmentation Address Translation                  │
│                                                                     │
│  Logical Address: (Segment = 1, Offset = 300)                      │
│                                                                     │
│         ┌───────────────┐                                          │
│         │ Segment Table  │                                          │
│         │  s=1 → Base=8000, Limit=1500                              │
│         └───────┬───────┘                                           │
│                 │                                                   │
│        Bounds check: 300 < 1500?  YES, continue                     │
│                 │                                                   │
│                 ▼                                                   │
│     Physical Address = Base + Offset = 8000 + 300 = 8300             │
└───────────────────────────────────────────────────────────────────┘
```

**Worked example 2 (a failing bounds check):** Logical address `(Segment = 3, Offset = 1200)` using the segment table above (Segment 3: Base=25000, Limit=1000).
```
Bounds check: is 1200 < 1000?  NO.
Result: trap → Segmentation Fault (the offset exceeds the segment's declared size)
```

This is precisely why an out-of-bounds array access or stack overflow in C/C++ produces a "Segmentation fault (core dumped)" — the hardware/OS detected the offset exceeded the segment's limit.

---

## 4. Segmentation vs Paging

| | Paging | Segmentation |
|---|---|---|
| Unit of division | Fixed-size pages | Variable-size segments |
| Meaning of the unit | Arbitrary (no relation to program structure) | Logical (code, data, stack, heap — matches how programmers think) |
| Address form | (page number, offset) — invisible to programmer | (segment number, offset) — can be exposed to programmer/compiler |
| External fragmentation | None | Yes (segments vary in size, just like variable partitioning) |
| Internal fragmentation | Yes (last page only) | None (each segment sized exactly as needed) |
| Protection granularity | Per page (coarse — a page might mix code and data) | Per segment (natural — whole segment is code, or whole segment is stack) |
| Sharing | Share individual pages | Share entire logical units (e.g., one shared code segment) |
| Table needed | Page table (page → frame) | Segment table (segment → base, limit) |

Neither is strictly "better" — they solve different problems. Paging optimizes for eliminating external fragmentation; segmentation optimizes for meaningful, protectable, shareable logical units. Real systems typically want both, which leads to Section 5.

---

## 5. Segmentation with Paging Combined

Modern systems (and historically, x86 protected mode) combine both: divide a process into logically meaningful **segments**, but internally represent each segment using **pages**, so segments themselves never need to be contiguous in physical RAM.

```
Logical Address = (Segment Number, Page Number, Offset)

Segmented-Paged Translation:
1. Segment Number  → index into Segment Table
2. Segment Table Entry does NOT give a physical base anymore —
   it gives the address of a PAGE TABLE for that segment
3. Page Number     → index into that segment's own Page Table → Frame Number
4. Physical Address = Frame Number + Offset  (same as pure paging, Section 3 of Lesson 3)
```

```
┌──────────────────────────────────────────────────────────────────────┐
│               Segmentation + Paging Combined                          │
│                                                                        │
│  Logical Address: (Segment = 1 [Data], Page = 2, Offset = 50)          │
│                                                                        │
│    Segment Table                                                      │
│    ┌─────┬────────────────────────┐                                   │
│    │ Seg │ → Page Table Pointer    │                                  │
│    ├─────┼────────────────────────┤                                   │
│    │  0  │ → Page Table for Code   │                                  │
│    │  1  │ → Page Table for Data ──┼──┐                                │
│    │  2  │ → Page Table for Heap   │  │                                │
│    └─────┴────────────────────────┘  │                                │
│                                        ▼                                │
│                          Page Table (segment 1's own)                  │
│                          ┌──────────┬───────────┐                      │
│                          │ Page 0   │ Frame 12   │                     │
│                          │ Page 1   │ Frame 4    │                     │
│                          │ Page 2   │ Frame 30   │ ◀── matched          │
│                          └──────────┴───────────┘                      │
│                                        │                                │
│                                        ▼                                │
│                     Physical Address = Frame 30 + Offset 50             │
└──────────────────────────────────────────────────────────────────────┘
```

### Why Combine Them?

| Benefit | Source |
|---------|--------|
| No external fragmentation | Because each segment is internally paged — physical frames can scatter freely |
| Logical protection & sharing per segment | Because segments still map to meaningful program units (code, data, stack) |
| A process's segments can each grow independently | Adding pages to a segment's page table doesn't require moving anything |
| Still get internal fragmentation | Small trade-off, confined to the last page of each segment |

### Real-World Note

x86 CPUs support this "segmentation + paging" model in protected mode. In practice, most modern OSes (Linux, Windows, macOS) configure segments to span the **entire address space** (base=0, limit=max) essentially turning segmentation into a no-op, and rely on paging alone for memory management — while still using a couple of real segments for specific purposes (e.g., thread-local storage via the `FS`/`GS` segment registers on x86-64). Pure segmentation as a *primary* memory management scheme has mostly fallen out of favor because of its external fragmentation, but the *logical* idea of segments (code/data/heap/stack) lives on conceptually even in flat, purely-paged systems.

---

## 6. Hands-On Exercises

**Exercise 1:** Using the segment table in Section 2, translate logical address `(Segment = 0, Offset = 1999)` and `(Segment = 0, Offset = 2001)`. Explain why one succeeds and one fails.

**Exercise 2:** Draw a segment table for a process with these segments: Code (Base=1000, Limit=500), Stack (Base=6000, Limit=800), Heap (Base=2000, Limit=1200). Translate `(Segment=Heap, Offset=1199)` and `(Segment=Heap, Offset=1200)`.

**Exercise 3:** On Linux, run `cat /proc/self/maps` (or on macOS, `vmmap $$` inside a shell) and identify at least 3 distinct logical regions (e.g., stack, heap, shared libraries) in your own shell process's address space — these are the modern, OS-level analog of "segments," even though the underlying hardware today is purely paged.

**Exercise 4:** Explain in your own words why pure segmentation reintroduces external fragmentation, referencing Lesson 2.

**Exercise 5:** Write a short paragraph explaining why a "segmentation fault" is named after segmentation's bounds-check mechanism, even on systems that use pure paging today (hint: paging still does a similar valid/invalid check on the page table entry).

---

## 7. Interview Q&A

**Q: What is segmentation, and how is it different from paging?**
Answer: Segmentation divides a process's address space into variable-size, logically meaningful units (code, data, heap, stack), each described by a base and limit in a segment table. Paging divides memory into fixed-size, logically meaningless chunks (pages/frames). Segmentation naturally maps to program structure and allows per-segment protection and sharing, but — because segments vary in size — reintroduces external fragmentation, which paging was designed to eliminate.

**Q: How does address translation work in a purely segmented system?**
Answer: A logical address is a pair (segment number, offset). The segment number indexes into the segment table to retrieve that segment's base address and limit. The offset is checked against the limit for a bounds violation; if it's within bounds, the physical address is simply base + offset. If the offset exceeds the limit, the hardware traps — this is the origin of the term "segmentation fault."

**Q: Why does segmentation suffer from external fragmentation while paging does not?**
Answer: Segments are variable-sized and, like variable partitioning, are allocated as contiguous physical blocks — as segments are created and destroyed over time, the free space between them fragments into scattered holes that may be too small for new segments, even if total free memory is sufficient. Paging avoids this because every page and frame is the same fixed size, so any free frame fits any page.

**Q: Why would a system combine segmentation with paging instead of using just one?**
Answer: Combining them gets the benefits of both: segments still represent meaningful, independently-protectable, independently-shareable logical units (code, data, stack), while each segment is internally implemented using paging so its pages can be scattered anywhere in physical RAM. This eliminates the external fragmentation that pure segmentation would cause, at the cost of a small, bounded amount of internal fragmentation in each segment's last page.

**Q: In a combined segmentation-paging scheme, what does a segment table entry point to?**
Answer: Instead of pointing directly to a physical base address (as in pure segmentation), a segment table entry points to that segment's own page table. Translating an address becomes a two-step lookup: segment number selects a page table, then the page number (extracted from the logical address) is looked up in that page table to get a frame number, which combines with the offset to form the physical address.

**Q: Why doesn't a "segmentation fault" always mean the system is actually using hardware segmentation?**
Answer: The term originated when segmentation's bounds check (offset >= limit) was the mechanism that caught out-of-bounds accesses. Modern systems are almost entirely paged, but paging performs an analogous check — a page table entry can be marked invalid/not-present, and accessing an unmapped or out-of-bounds virtual address still triggers a hardware trap that the OS reports the same way. The name "segmentation fault" stuck as generic terminology for any invalid memory access, even on purely paged systems.
