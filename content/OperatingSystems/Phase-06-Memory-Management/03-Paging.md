# Paging — Complete Guide

## Table of Contents
1. [The Core Idea](#1-the-core-idea)
2. [Pages, Frames, and Page Tables](#2-pages-frames-and-page-tables)
3. [Address Translation — How It Works](#3-address-translation--how-it-works)
4. [Worked Example](#4-worked-example)
5. [The Translation Lookaside Buffer (TLB)](#5-the-translation-lookaside-buffer-tlb)
6. [Advantages Over Contiguous Allocation](#6-advantages-over-contiguous-allocation)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Core Idea

Paging solves external fragmentation (Lesson 2) by breaking BOTH physical memory and a process's logical (virtual) address space into small, fixed-size blocks:

```
Physical RAM  is divided into fixed-size blocks called FRAMES
Logical (process) address space is divided into fixed-size blocks called PAGES

Page size == Frame size (always — this is what makes paging work)
Typical size: 4 KB (4096 bytes), though 2MB/1GB "huge pages" also exist
```

A process's pages do **not** need to sit in contiguous frames. Page 0 of a process might live in frame 12, page 1 in frame 5, page 2 in frame 99 — scattered anywhere. The OS keeps a **page table** per process that records which frame each page is actually stored in.

```
Process's view (logical/virtual address space) — looks contiguous:
┌─────────┬─────────┬─────────┬─────────┐
│ Page 0  │ Page 1  │ Page 2  │ Page 3  │
└─────────┴─────────┴─────────┴─────────┘

Physical RAM (actual layout) — scattered:
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Frame 0 │ Frame 1 │ Frame 2 │ Frame 3 │ Frame 4 │ Frame 5 │
│ (other) │ Page 2  │ (free)  │ Page 0  │ (other) │ Page 3  │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
              ↑                    ↑                   ↑
      (and Page 1 might be in Frame 9, off-screen)

Page Table for this process:
┌──────────┬────────────┐
│ Page #   │  Frame #   │
├──────────┼────────────┤
│   0      │     3      │
│   1      │     9      │
│   2      │     1      │
│   3      │     5      │
└──────────┴────────────┘
```

Because any free frame can hold any page, there's never a "hole too small" — external fragmentation is eliminated.

---

## 2. Pages, Frames, and Page Tables

| Term | Definition |
|------|------------|
| **Page** | A fixed-size chunk of a process's *logical* (virtual) address space |
| **Frame** | A fixed-size chunk of *physical* RAM, exactly the same size as a page |
| **Page Table** | Per-process data structure mapping page number → frame number |
| **Page Table Entry (PTE)** | One row of the page table: frame number + flags (valid, read/write, present, dirty, accessed) |
| **Page Table Base Register (PTBR)** | CPU register (set on context switch) pointing to the current process's page table in memory |

Every process gets its own page table, maintained by the OS and consulted by the CPU's Memory Management Unit (MMU) on every memory access.

```
Each Page Table Entry typically looks like:

┌────────────────────┬───┬───┬───┬───┐
│  Frame Number       │ V │ R/W│ D │ A │
└────────────────────┴───┴───┴───┴───┘
  V = Valid (is this page currently in a frame at all?)
  R/W = Read/Write permission
  D = Dirty bit (has this page been modified since loaded?)
  A = Accessed bit (has this page been read/written recently?)
```

(The Valid/Dirty bits become critical in Phase 7 — Virtual Memory / demand paging.)

---

## 3. Address Translation — How It Works

Every address the CPU generates for a running process is a **logical address** (also called a virtual address). The MMU must translate it to a **physical address** before RAM can actually be accessed. Paging splits a logical address into two parts:

```
Logical Address = [ Page Number | Offset ]

Page Number:  which page does this address fall in?
Offset:       how far into that page is the byte we want?
```

The split point depends on the page size. If the page size is 2^n bytes, the low-order `n` bits of the address are the offset, and the remaining high-order bits are the page number.

```
Translation steps:
1. CPU generates logical address
2. Split it into (Page Number, Offset)
3. Look up Page Number in the Page Table → get Frame Number
4. Physical Address = (Frame Number, Offset)     <- offset is UNCHANGED
5. Access physical RAM at that address
```

```
┌──────────────────────────────────────────────────────────────────┐
│                     Address Translation Diagram                  │
│                                                                    │
│  Logical Address                                                  │
│  ┌────────────────┬────────────┐                                  │
│  │  Page Number(p) │ Offset (d) │                                  │
│  └────────┬───────┴─────┬──────┘                                  │
│           │              │                                        │
│           ▼              │  (offset passes through unchanged)     │
│  ┌─────────────────┐     │                                        │
│  │   Page Table     │     │                                       │
│  │  p  → Frame(f)   │     │                                       │
│  └────────┬─────────┘     │                                       │
│           │                │                                      │
│           ▼                ▼                                      │
│  ┌────────────────┬────────────┐                                  │
│  │  Frame Number(f)│ Offset (d) │  = Physical Address              │
│  └────────────────┴────────────┘                                  │
└──────────────────────────────────────────────────────────────────┘
```

Note the key insight: **only the page number changes (into a frame number) — the offset is identical in both the logical and physical address.**

---

## 4. Worked Example

Assume:

```
Page size:            4 KB = 4096 bytes = 2^12  →  offset = 12 bits
Logical address space: 16 pages (page numbers 0-15)  →  page number = 4 bits
Logical address width: 16 bits total (4 bits page number + 12 bits offset)
```

Page table for this process:

| Page Number | Frame Number |
|:-----------:|:------------:|
| 0 | 5 |
| 1 | 2 |
| 2 | 9 |
| 3 | 1 |

**Translate logical address 0x2050 (hex) to a physical address.**

Step 1 — convert to binary (16 bits):
```
0x2050 = 0010 0000 0101 0000
```

Step 2 — split into page number (top 4 bits) and offset (bottom 12 bits):
```
0010 | 0000 0101 0000
 ▲            ▲
 page number  offset

Page number (binary 0010) = 2  (decimal)
Offset (binary 0000 0101 0000) = 0x050 = 80  (decimal)
```

Step 3 — look up page 2 in the page table:
```
Page 2 → Frame 9
```

Step 4 — build the physical address: keep the offset, replace the page number with the frame number:
```
Physical address = Frame 9, Offset 80
                  = (9 x 4096) + 80
                  = 36,864 + 80
                  = 36,944 decimal
                  = 0x9050 in hex
```

**Result: logical address `0x2050` → physical address `0x9050`.**

```
Quick sanity-check shortcut for hex + power-of-2 page sizes:
Since page size = 4096 = 0x1000, the LAST 3 hex digits are ALWAYS the offset.
Logical:  0x2050  →  page = 0x2, offset = 0x050
Physical: replace page (0x2) with frame (0x9), keep offset (0x050)
        = 0x9050   <- matches!
```

**Try another one yourself:** translate logical address `0x1FFF` using the same page table.
```
0x1FFF → page = 0x1, offset = 0xFFF
Page 1 → Frame 2
Physical address = 0x2FFF
```

---

## 5. The Translation Lookaside Buffer (TLB)

A naive implementation looks up the page table **in RAM** on every single memory access — doubling every memory reference (one to read the page table, one for the actual data). To avoid this, the MMU has a small, fast hardware cache called the **TLB (Translation Lookaside Buffer)** that stores recently used (page → frame) mappings.

```
CPU generates logical address
        │
        ▼
   Is (page → frame) in the TLB?  (checked in parallel, very fast, ~1 cycle)
   ┌─────────┴─────────┐
  YES (TLB hit)        NO (TLB miss)
   │                     │
   ▼                     ▼
Use frame directly   Walk the page table in RAM (slow),
(fast path)          then CACHE the result in the TLB
                     for next time
```

TLB hit rates are typically 95-99% in real workloads because of locality of reference (programs tend to access the same pages repeatedly in short time windows), which is why paging's overhead is manageable in practice.

---

## 6. Advantages Over Contiguous Allocation

| Advantage | Why |
|-----------|-----|
| **No external fragmentation** | Any free frame fits any page — no "hole too small" problem |
| **Efficient memory use** | Only the final page of a process is partially wasted (internal fragmentation), much less waste than contiguous holes |
| **No compaction needed** | Since pages don't need to be adjacent, there's nothing to compact |
| **Simplifies allocation** | The OS just needs a free-frame list; any process can use any set of free frames, in any order |
| **Enables virtual memory** | Pages not currently needed can be marked "not present" and swapped to disk, letting a process's total address space exceed physical RAM (Phase 7) |
| **Enables sharing** | Multiple processes' page tables can point the same physical frame (e.g., shared libraries, `fork()`'s copy-on-write pages) |

### Trade-offs to Know

- Extra memory is needed to store the page tables themselves (mitigated by multi-level page tables in real systems).
- Every memory access technically requires a translation step (mitigated by the TLB).
- Still has (small) internal fragmentation in the last page of each process.

---

## 7. Hands-On Exercises

**Exercise 1:** On Linux, run `getconf PAGE_SIZE` (or `pagesize` on macOS). Note the page size in bytes and express it as `2^n`.

**Exercise 2:** Given a page size of 1 KB (2^10 bytes) and a page table `{0: 4, 1: 7, 2: 2, 3: 10}`, translate logical address `0x0650` to a physical address. Show the binary split of page number vs offset.

**Exercise 3:** A process has a 20-bit logical address space and an 8 KB page size. Calculate: (a) how many bits are used for the offset, (b) how many bits remain for the page number, (c) how many pages the process's address space contains.

**Exercise 4:** Explain, in your own words, why the offset portion of an address never changes during translation, but the page number does.

**Exercise 5:** Research and explain (3-5 sentences) why real 64-bit systems use **multi-level page tables** (e.g., a 4-level table on x86-64) instead of one giant flat page table, and how that relates to Section 6's "extra memory for page tables" trade-off.

---

## 8. Interview Q&A

**Q: What problem does paging solve, and how?**
Answer: Paging eliminates external fragmentation from contiguous memory allocation. It divides physical memory into fixed-size frames and a process's logical address space into equal-size pages, then maps individual pages to individual frames via a per-process page table. Because pages don't need to occupy contiguous physical frames, any free frame can satisfy any page request — there's no "hole too small" problem, and no compaction is ever needed.

**Q: Walk through how a logical address is translated to a physical address in paging.**
Answer: The logical address is split into a page number (high-order bits) and an offset (low-order bits, sized to fit the page size — e.g., 12 bits for a 4KB page). The page number is looked up in the process's page table to get a frame number. The physical address is then formed by combining that frame number with the *same, unchanged* offset. Only the page-number portion of the address changes during translation.

**Q: What is a TLB and why does it matter for paging's performance?**
Answer: A Translation Lookaside Buffer is a small, fast hardware cache in the MMU that stores recently used page-to-frame mappings. Without it, every memory access would require an extra trip to RAM to read the page table, doubling memory latency. Because programs exhibit locality of reference, TLB hit rates are typically 95-99%, so most translations are resolved in about one CPU cycle instead of a full page-table walk.

**Q: Does paging eliminate fragmentation completely?**
Answer: It eliminates external fragmentation entirely, since any free frame fits any page. It does not eliminate internal fragmentation — a process's last page is often only partially used, wasting the unused portion of that page. This waste is bounded by the page size (at most page_size - 1 bytes per process), which is far less costly than the unbounded external fragmentation of contiguous allocation.

**Q: What is stored in a page table entry besides the frame number?**
Answer: Typically a valid/present bit (is this page currently mapped to a physical frame, or has it been swapped out?), read/write (and sometimes execute) permission bits, a dirty bit (has the page been modified since it was loaded, relevant for write-back to disk), and an accessed bit (used by page-replacement algorithms to track recently used pages). These flags let the OS enforce protection and, later, support virtual memory features like swapping.

**Q: Why do modern systems use multi-level page tables instead of a single flat page table?**
Answer: A flat page table for a large address space (e.g., 64-bit) would need an enormous number of entries even if most of the address space is unused by a process, wasting huge amounts of memory just to store the table. Multi-level (hierarchical) page tables break the page number into multiple indices that walk through several smaller tables; unused regions of the address space simply have no entries at all in the higher-level tables, so memory is only spent on page-table structure for the parts of the address space actually in use.
