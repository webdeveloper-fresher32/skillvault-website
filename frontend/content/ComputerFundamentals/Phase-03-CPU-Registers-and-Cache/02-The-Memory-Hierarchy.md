# The Memory Hierarchy — Complete Guide

## Table of Contents
1. [The Core Idea](#1-the-core-idea)
2. [The Hierarchy Pyramid](#2-the-hierarchy-pyramid)
3. [Each Level Explained](#3-each-level-explained)
4. [Approximate Latency Numbers](#4-approximate-latency-numbers)
5. [Why This Layering Exists](#5-why-this-layering-exists)
6. [Putting It Together: A Memory Access](#6-putting-it-together-a-memory-access)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Core Idea

No single type of memory can be simultaneously huge, cheap, and fast — physics and economics won't allow it. So every computer instead uses a **hierarchy** of memory types, each one trading size for speed:

```
Smaller & Faster & More Expensive per byte
        ↕
Bigger & Slower & Cheaper per byte
```

The CPU always prefers to find data in the fastest level available. When it can't (a "miss"), it has to reach further down the pyramid, paying a speed penalty each time.

## 2. The Hierarchy Pyramid

```
                          ▲
                         ╱ ╲
                        ╱   ╲        REGISTERS
                       ╱     ╲       ~100s of bytes · fastest · most expensive
                      ╱───────╲
                     ╱         ╲     L1 CACHE
                    ╱           ╲    ~32-64 KB per core
                   ╱─────────────╲
                  ╱               ╲  L2 CACHE
                 ╱                 ╲ ~256 KB-1 MB per core
                ╱───────────────────╲
               ╱                     ╲  L3 CACHE
              ╱                       ╲ ~8-32 MB, shared across cores
             ╱─────────────────────────╲
            ╱                           ╲  RAM (Main Memory)
           ╱                             ╲ ~8-128 GB
          ╱───────────────────────────────╲
         ╱                                 ╲  DISK (SSD/HDD)
        ╱                                   ╲ ~256 GB-few TB · slowest · cheapest
       ╱─────────────────────────────────────╲
                          ▼
       Bigger, Slower, Cheaper per byte
```

Every level down: capacity goes up by roughly one to three orders of magnitude, and latency also goes up by roughly one to three orders of magnitude. This is not a coincidence — it's a direct consequence of the physical engineering tradeoffs discussed in Lesson 01.

## 3. Each Level Explained

| Level | Typical Size | Managed By | Notes |
|-------|-------------|------------|-------|
| **Registers** | A few hundred bytes total | Compiler + CPU | Inside the CPU core itself. Covered in Lesson 01. |
| **L1 Cache** | 32–64 KB per core | Hardware (cache controller) | Usually split into L1i (instructions) and L1d (data). Private per core. |
| **L2 Cache** | 256 KB–1 MB per core | Hardware | Larger, slightly slower than L1. Usually private per core. |
| **L3 Cache** | 8–32 MB | Hardware | Shared across all cores on the chip. Acts as a buffer before going all the way to RAM. |
| **RAM** | 8–128+ GB | OS (virtual memory) | Volatile — cleared on power loss. Where your program's data and code actually live while running. |
| **Disk (SSD/HDD)** | 256 GB–several TB | OS (filesystem) | Persistent storage. Where the RAM's contents get "paged" to when there isn't enough RAM (swap). |

Caches (L1/L2/L3) are typically not manually managed by the programmer at all — the CPU's cache controller automatically decides what to keep and evict based on recent memory access patterns. Your job as a developer is simply to write code whose access patterns cooperate well with how caches work (that's the subject of Lesson 03).

## 4. Approximate Latency Numbers

These numbers vary by hardware generation, but the *relative* magnitudes are the important thing to internalize:

| Level | Approximate Latency | Roughly Equivalent To (scaled to human time, if 1 CPU cycle = 1 second) |
|-------|---------------------|---------------------------------------------------------------------------|
| Register access | ~0.3 ns (< 1 cycle) | 1 second |
| L1 cache hit | ~1 ns | a few seconds |
| L2 cache hit | ~3-4 ns | ~10 seconds |
| L3 cache hit | ~10-20 ns | ~1 minute |
| RAM access | ~100 ns | ~5-6 minutes |
| SSD access | ~10,000-100,000 ns (10-100 µs) | ~hours |
| HDD access (seek) | ~1,000,000-10,000,000 ns (1-10 ms) | ~days to weeks |

The famous takeaway engineers quote: **"RAM is the new disk."** Once you've paid the cost of falling out of cache into RAM, you've already lost ~100x compared to a cache hit — and falling further to disk is a loss of another ~1,000x-100,000x on top of that.

## 5. Why This Layering Exists

Two properties of real-world programs make this hierarchy actually work well in practice, instead of being a constant string of expensive misses:

- **Most programs reuse a small set of data repeatedly** (loop variables, function locals) — so keeping recently used data close to the CPU pays off most of the time.
- **Most programs access memory in predictable patterns** (sequentially through arrays, or repeatedly through the same few variables) — so caches can "guess" what you'll need next reasonably well.

These two properties are formalized as **temporal locality** and **spatial locality**, covered in depth in Lesson 03.

Because of these properties, a well-designed cache can satisfy the vast majority of memory requests (often 90-99%) without ever touching RAM — even though the cache itself is thousands of times smaller than RAM.

## 6. Putting It Together: A Memory Access

When your code reads a variable, here's the (simplified) journey the CPU takes:

```
CPU wants to read address 0x1000
        │
        ▼
   Is it in L1 cache?  ──Yes──▶ Return value (~1 ns)   [L1 HIT]
        │ No
        ▼
   Is it in L2 cache?  ──Yes──▶ Copy to L1, return (~4 ns)  [L2 HIT]
        │ No
        ▼
   Is it in L3 cache?  ──Yes──▶ Copy to L2 & L1, return (~15 ns) [L3 HIT]
        │ No
        ▼
   Fetch from RAM  ──▶ Copy to L3, L2, L1, return (~100 ns)  [CACHE MISS]
        │
        ▼
   (If page not in RAM at all — a "page fault" —
    the OS must fetch it from disk: ~10,000-10,000,000 ns)
```

Every "miss" at a level means paying that level's full latency, on top of everything already tried below it. This cascading cost is exactly why cache-friendly code (Lesson 03) can make an algorithm with the *same* Big-O complexity run several times faster in practice.

---

## 7. Hands-On Exercises

**Exercise 1:** On your own machine, find your CPU's actual cache sizes. On Linux: `lscpu | grep -i cache`. On macOS: `sysctl -a | grep cache`. Record your L1, L2, and L3 sizes.

**Exercise 2:** Using the latency table above, calculate roughly how many L1 cache accesses you could perform in the time it takes to do a single RAM access. Then calculate how many RAM accesses you could do in the time of a single SSD access.

**Exercise 3:** Explain in your own words why L1 cache is small (tens of KB) while L3 cache is large (tens of MB), tying your answer back to the size-vs-speed tradeoff from Lesson 01.

**Exercise 4:** Draw (on paper or in a text file) your own version of the memory hierarchy pyramid, labeling each level with its approximate size and latency from memory, without looking at this lesson.

**Exercise 5:** Research what "swap" or "paging" means in the context of an OS running low on RAM. Explain why heavy swapping makes a computer feel dramatically slower, connecting it to the disk latency numbers above.

---

## 8. Interview Q&A

**Q: Why do computers use a memory hierarchy instead of one big fast memory?**
Answer: Because no single memory technology can be simultaneously fast, large, and cheap — that's a fundamental physical/economic tradeoff. Fast memory (like SRAM used in caches) is expensive and can't be made large; large memory (like the flash in an SSD) is cheap but slow. The hierarchy layers multiple types together so the system gets the speed of small fast memory for hot data and the capacity of large cheap memory for everything else.

**Q: Roughly how much slower is a RAM access compared to an L1 cache hit?**
Answer: Roughly 100x. An L1 cache hit is typically around 1 nanosecond, while a RAM access is typically around 100 nanoseconds. This gap is why CPU cache design and cache-friendly programming patterns have such an outsized impact on real-world performance.

**Q: What is a cache miss and why is it expensive?**
Answer: A cache miss occurs when requested data isn't found in a given cache level, forcing the CPU to check the next, slower level down (L2, then L3, then RAM, potentially then disk). It's expensive because each level down carries roughly an order-of-magnitude (or more) latency penalty, and a miss at every level compounds — the CPU pays for every failed lookup on the way down before it finally gets the data.

**Q: What's the difference between L1, L2, and L3 cache?**
Answer: L1 is the smallest (tens of KB) and fastest, private to each CPU core, and often split into separate instruction and data caches. L2 is larger (hundreds of KB to a few MB), slightly slower, usually still private per core. L3 is the largest (several MB to tens of MB), slower still, and shared across all cores on the chip — acting as a last line of defense before falling back to RAM.

**Q: Why is "RAM is the new disk" a common saying among performance engineers?**
Answer: It highlights that the latency gap between cache and RAM (~100x) has become comparable in *relative* significance to the gap that used to exist between RAM and disk in earlier computing eras. In modern systems tuned for performance, a RAM access is now treated as the "slow path" to be minimized, the same way disk access used to be treated — because so much work fits and executes out of cache.

**Q: What determines whether a program benefits from the cache hierarchy at all?**
Answer: Its memory access pattern. Programs with high temporal locality (reusing the same data repeatedly) and spatial locality (accessing nearby memory addresses) benefit enormously, because caches are built to exploit exactly those patterns. Programs with random, scattered memory access patterns see far less benefit and pay RAM-level latency much more often — this is explored in depth in the next lesson on cache locality.
