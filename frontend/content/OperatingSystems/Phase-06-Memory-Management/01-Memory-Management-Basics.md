# Memory Management Basics — Complete Guide

## Table of Contents
1. [Why Memory Management Exists](#1-why-memory-management-exists)
2. [What the Memory Manager Tracks](#2-what-the-memory-manager-tracks)
3. [Contiguous Memory Allocation](#3-contiguous-memory-allocation)
4. [Fixed (Static) Partitioning](#4-fixed-static-partitioning)
5. [Variable (Dynamic) Partitioning](#5-variable-dynamic-partitioning)
6. [Allocation Strategies: First-Fit, Best-Fit, Worst-Fit](#6-allocation-strategies-first-fit-best-fit-worst-fit)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Memory Management Exists

### The Problem

RAM is small, fast, and shared. At any moment, a server might be running a web server, a database, a cron job, and a dozen background services — all competing for the same finite pool of physical memory. Someone has to decide:

- Which process gets which bytes of RAM?
- What happens when a process needs more memory than is free?
- How do we stop Process A from reading or corrupting Process B's memory?
- What happens when memory fills up completely?

```
Physical RAM: 8 GB total

Without a memory manager:
  Process A writes directly to address 0x1000
  Process B also writes directly to address 0x1000
  → Corruption, crashes, security holes

With a memory manager (the OS):
  Process A believes it owns addresses 0x0000-0xFFFF   (its own "view")
  Process B believes it owns addresses 0x0000-0xFFFF   (its own "view")
  OS secretly maps each to different, non-overlapping physical RAM
  → Isolation, safety, no coordination needed between processes
```

The OS's memory manager is the component responsible for allocating, tracking, protecting, and reclaiming RAM on behalf of every process.

### Goals of a Memory Manager

| Goal | Meaning |
|------|---------|
| **Allocation** | Give each process the memory it asks for |
| **Isolation / Protection** | Prevent one process from touching another's memory |
| **Efficient utilization** | Minimize wasted memory (fragmentation — see Lesson 2) |
| **Relocation** | Allow a process's memory to be placed anywhere in RAM (or moved later) |
| **Sharing** | Allow controlled sharing (e.g., shared libraries, IPC shared memory) |

---

## 2. What the Memory Manager Tracks

The OS maintains bookkeeping structures — separate from the RAM itself — to know:

```
┌─────────────────────────────────────────────┐
│ OS Memory Manager Bookkeeping                │
├─────────────────────────────────────────────┤
│  - Which regions of RAM are free              │
│  - Which regions are allocated, and to whom   │
│  - Base address + limit (size) per process    │
│  - Access permissions (read/write/execute)    │
└─────────────────────────────────────────────┘
```

Every process has a **base register** (start address) and a **limit register** (size of its allocation) maintained by the OS. Every memory access a process makes is checked against these before being allowed to reach physical RAM:

```
CPU generates address --> Check: base <= address < base + limit ?
                              |                          |
                             Yes                         No
                              |                          |
                    Access allowed              Trap: Segmentation Fault
```

This is the hardware-enforced basis of process isolation.

---

## 3. Contiguous Memory Allocation

The earliest and simplest scheme: give each process one unbroken (contiguous) block of physical RAM.

```
Physical RAM (16 MB)
0 MB ┌────────────────────┐
     │   Operating System │  0-2 MB   (reserved, always resident)
2 MB ├────────────────────┤
     │   Process A        │  2-6 MB   (4 MB contiguous block)
6 MB ├────────────────────┤
     │   Process B        │  6-9 MB   (3 MB contiguous block)
9 MB ├────────────────────┤
     │   Free              │  9-16 MB
16 MB└────────────────────┘
```

Simple to implement and fast to access (a single base+offset calculation), but it has a fatal flaw covered in the next lesson: fragmentation. It also requires that a process's entire memory footprint fit into RAM as one unbroken chunk — a program can't grow past its neighbor without being moved.

There are two ways the OS decides how to carve up RAM into these contiguous blocks: **fixed partitioning** and **variable partitioning**.

---

## 4. Fixed (Static) Partitioning

RAM is divided into a fixed number of partitions **at boot time**, each of a predetermined size. Every process is loaded into a partition, one process per partition.

```
Physical RAM (16 MB) divided into 4 fixed partitions of 4 MB each:

┌────────────────┬────────────────┬────────────────┬────────────────┐
│  Partition 1   │  Partition 2   │  Partition 3   │  Partition 4   │
│    4 MB        │    4 MB        │    4 MB        │    4 MB        │
│  [Process A]   │  [Process B]   │  [ free ]      │  [Process C]   │
└────────────────┴────────────────┴────────────────┴────────────────┘
```

### Characteristics

| Aspect | Detail |
|--------|--------|
| Number of processes in memory | Limited to the number of partitions |
| Partition sizes | Fixed at boot; may be equal or unequal sizes |
| Wasted memory | A process smaller than its partition wastes the leftover space (**internal fragmentation**) |
| Implementation | Simple — a table of partitions with a used/free flag |
| Historical use | Early mainframe batch systems (e.g., OS/360 MFT) |

**Problem:** if a process needs 5 MB but the largest free partition is 4 MB, it simply cannot run — even though the *total* free memory across all partitions might be plenty.

---

## 5. Variable (Dynamic) Partitioning

Instead of pre-carving RAM into fixed slots, the OS allocates a partition **exactly as large as the requesting process needs**, at the time it needs it.

```
Physical RAM (16 MB), variable partitioning:

Time T1: Only OS loaded
┌────────────────────────────────────────────────────────┐
│ OS (2 MB)  │              Free (14 MB)                  │
└────────────────────────────────────────────────────────┘

Time T2: Process A (5 MB) and Process B (3 MB) loaded
┌────────────┬────────────────┬──────────┬────────────────┐
│ OS (2 MB)  │ Process A(5MB) │ B (3MB)  │  Free (6 MB)   │
└────────────┴────────────────┴──────────┴────────────────┘

Time T3: Process A exits, leaving a "hole" exactly 5 MB wide
┌────────────┬────────────────┬──────────┬────────────────┐
│ OS (2 MB)  │  hole (5 MB)   │ B (3MB)  │  Free (6 MB)   │
└────────────┴────────────────┴──────────┴────────────────┘
```

This is more memory-efficient than fixed partitioning (no wasted space *inside* a partition), but it introduces **external fragmentation** — over time RAM becomes a patchwork of small, scattered free holes that individually may be too small to satisfy a new request, even though their sum is large enough. (Fully explored in Lesson 2.)

### Fixed vs Variable Partitioning — Summary

| | Fixed Partitioning | Variable Partitioning |
|---|---|---|
| Partition size | Set once at boot | Sized per-process, on demand |
| Degree of multiprogramming | Limited by partition count | Limited only by total free memory |
| Internal fragmentation | Yes (process < partition size) | No |
| External fragmentation | No | Yes |
| Allocation complexity | Trivial (fixed table) | Requires a free-list + allocation strategy |
| Real-world relevance | Mostly historical | Basis for modern heap allocators, and a stepping stone toward paging |

---

## 6. Allocation Strategies: First-Fit, Best-Fit, Worst-Fit

With variable partitioning, the OS keeps a **free list** of holes (address + size). When a new process arrives, it must pick *which* hole to use.

```
Free list: [Hole1: 6MB] [Hole2: 4MB] [Hole3: 20MB] [Hole4: 8MB]
Incoming request: 5 MB
```

| Strategy | Rule | Result on example above | Trade-off |
|----------|------|--------------------------|-----------|
| **First-Fit** | Use the first hole big enough | Hole1 (6MB) → 1MB hole left | Fast; leaves small unusable slivers near the start |
| **Best-Fit** | Use the smallest hole that's still big enough | Hole2 (4MB) is too small to skip to; among the holes that fit (6, 20, 8), the smallest is Hole1 (6MB) → 1MB hole left | Minimizes leftover waste per allocation, but leaves tiny unusable slivers over time and is slower (must scan all holes) |
| **Worst-Fit** | Use the largest hole available | Hole3 (20MB) → 15MB hole left | Leaves large, more reusable leftover holes; but large holes get eaten quickly |

In practice, **first-fit** is usually fastest and performs comparably to best-fit with much less scanning overhead. Best-fit sounds smart but tends to create many tiny, useless fragments. Worst-fit generally performs the worst in real workloads. Modern general-purpose allocators (like `glibc`'s `malloc`) use much more sophisticated approaches (segregated free lists, buddy systems) built on these same basic ideas.

---

## 7. Hands-On Exercises

**Exercise 1:** On Linux/macOS, run `free -h` (Linux) or `vm_stat` (macOS). Identify total RAM, used, and free memory. Which of these numbers would the OS's memory manager be updating constantly?

**Exercise 2:** Given 20 MB of RAM split into fixed partitions of sizes 2, 4, 8, and 6 MB, and incoming processes requiring 3 MB, 7 MB, and 5 MB in that order — decide which partition each is placed into, and calculate the total internal fragmentation.

**Exercise 3:** Using the same free list from Section 6 (`6MB, 4MB, 20MB, 8MB`), manually trace First-Fit, Best-Fit, and Worst-Fit for a sequence of requests: 5 MB, then 3 MB, then 7 MB. Draw the resulting free list after each request.

**Exercise 4:** Write a short (pseudo-code or real Python/JS) function `first_fit(holes, size)` that returns the index of the first hole large enough for `size`, or `-1` if none fits.

**Exercise 5:** Research: look up how `malloc` in glibc organizes free memory ("bins", "chunks"). Write 3-4 sentences on how it resembles or differs from the first-fit/best-fit strategies described here.

---

## 8. Interview Q&A

**Q: Why does an OS need a memory manager instead of letting processes access RAM directly?**
Answer: Direct access would let any process read or overwrite any other process's memory — including the kernel's — leading to crashes, data corruption, and security vulnerabilities. The memory manager allocates isolated regions to each process and uses hardware (base/limit registers, or later, page tables) to enforce that a process can only touch the memory it owns. It also handles reclaiming memory when a process exits and deciding how to fit competing memory requests into limited RAM.

**Q: What is the difference between fixed and variable partitioning?**
Answer: Fixed partitioning divides RAM into a set number of partitions of predetermined size at boot time — simple, but limits how many processes can run at once and wastes memory when a process is smaller than its partition (internal fragmentation). Variable partitioning allocates a partition exactly the size a process needs, at load time — no internal fragmentation, but over time it creates scattered free holes (external fragmentation) as processes of different sizes come and go.

**Q: What is internal fragmentation, briefly, and which partitioning scheme causes it?**
Answer: Internal fragmentation is wasted space *inside* an allocated block — e.g., a 3 MB process placed in a 4 MB fixed partition wastes 1 MB that no other process can use. It's a direct consequence of fixed-size partitioning (or any allocation rounded up to a fixed block size).

**Q: Compare first-fit, best-fit, and worst-fit allocation strategies.**
Answer: First-fit scans the free list and picks the first hole big enough — it's fast and works well in practice. Best-fit picks the smallest hole that still satisfies the request, minimizing waste per allocation but tending to litter memory with many tiny, unusable slivers over time, and it's slower since it must scan the entire list. Worst-fit picks the largest available hole, hoping to leave a usefully large remainder, but tends to quickly consume the large holes needed for bigger future requests. In practice, first-fit is often the best overall trade-off.

**Q: What do base and limit registers do?**
Answer: They're per-process hardware registers the OS sets during a context switch. The base register holds the starting physical address of the process's memory region; the limit register holds its size. Every memory address the CPU generates for that process is checked to fall within `[base, base+limit)`; violations raise a hardware trap (e.g., segmentation fault), enforcing process isolation without software needing to check every access.

**Q: Why did contiguous allocation eventually get replaced by paging in modern OSes?**
Answer: Contiguous allocation (fixed or variable) requires a process's entire address space to occupy one unbroken block of physical RAM, which causes fragmentation and forces expensive compaction, and it can't run a process larger than the largest available free hole even if total free memory is sufficient. Paging solves this by breaking memory into small, fixed-size chunks that don't need to be adjacent to each other, eliminating external fragmentation and allowing a process's memory to be scattered across RAM (covered in Lesson 3).
