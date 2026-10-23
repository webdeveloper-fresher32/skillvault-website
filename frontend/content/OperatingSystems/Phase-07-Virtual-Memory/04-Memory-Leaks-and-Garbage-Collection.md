# Memory Leaks and Garbage Collection — Complete Guide

## Table of Contents
1. [Memory Leaks: OS/Process Level vs Language Level](#1-memory-leaks-osprocess-level-vs-language-level)
2. [How a Leak Plays Out Against Virtual Memory](#2-how-a-leak-plays-out-against-virtual-memory)
3. [Garbage Collection Fundamentals](#3-garbage-collection-fundamentals)
4. [Reference Counting](#4-reference-counting)
5. [Mark-and-Sweep](#5-mark-and-sweep)
6. [Generational Garbage Collection](#6-generational-garbage-collection)
7. [Tying It to Virtual Memory](#7-tying-it-to-virtual-memory)
8. [Python's GC and Node's V8 GC, Briefly](#8-pythons-gc-and-nodes-v8-gc-briefly)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Memory Leaks: OS/Process Level vs Language Level

A "memory leak" means memory that's no longer needed is never freed. The term is used at two different layers, and interviewers often expect you to distinguish them.

```
┌─────────────────────────────────────────────────────────────────┐
│ OS / Process-Level Leak                                         │
│                                                                   │
│  A process's virtual address space keeps growing over its        │
│  lifetime because it keeps allocating memory (via malloc/mmap/    │
│  brk) and never releases it back to the OS — regardless of        │
│  which programming language caused it. The OS has no idea         │
│  WHY the process wants more memory; it just keeps handing out     │
│  new pages/frames on request.                                     │
├─────────────────────────────────────────────────────────────────┤
│ Language-Level Leak                                              │
│                                                                   │
│  Inside the process, the application logic itself loses track      │
│  of objects it no longer needs — e.g., an ever-growing cache with  │
│  no eviction, a forgotten event-listener registration, a global    │
│  collection that's only ever appended to. In garbage-collected      │
│  languages (Java, Python, JS/Node), these objects are technically  │
│  still "reachable" from a root (a leftover reference), so the GC    │
│  correctly refuses to reclaim them — the GC is doing its job        │
│  perfectly; the *application* is holding on to garbage.             │
└─────────────────────────────────────────────────────────────────┘
```

The crucial insight: **the OS can't fix a language-level leak.** The OS only tracks pages handed to a process; it has no concept of "objects" inside that process's heap. Even a perfectly implemented garbage collector cannot free memory that the application logic still technically references — from the GC's point of view, that memory is legitimately "in use." A leak in a GC'd language is really "accidental retention," not a failure of garbage collection.

In non-GC'd languages (C, C++, manual `malloc`/`free`), a leak is simpler: the programmer called `malloc` and never called the matching `free`, so the memory is unreachable by the program going forward but the OS still considers those pages allocated to the process until the process exits.

---

## 2. How a Leak Plays Out Against Virtual Memory

```
Process lifetime, virtual memory footprint over time:

Healthy process:
  RSS │      ___----____----____----____
      │  __/                              (grows and shrinks —
      │_/                                  allocates, frees, reuses)
      └───────────────────────────────────▶ time

Leaking process:
  RSS │                                  ___/
      │                          ___/
      │                  ___/
      │          ___/
      │  ___/
      │_/
      └───────────────────────────────────▶ time
       (heap only ever grows — never comes back down)
```

What actually happens, mechanically:

1. The leaking process keeps requesting heap memory (its language runtime asks the OS for more pages via `brk`/`mmap` when its internal allocator runs out of free space).
2. The OS obliges — it has no way to know the process isn't really using most of that memory productively; from the OS's perspective, that's just "this process's working set is growing."
3. As the leak grows, the process's resident set (RSS) grows, consuming physical frames.
4. Eventually, physical RAM fills up. Other processes (and this one) start faulting more as the system runs low on free frames — a slow-motion path directly toward the thrashing described in Lesson 3.
5. If left unchecked, the OS's OOM killer (Linux) may eventually terminate the leaking process (or, unluckily, an innocent one) to relieve memory pressure.

This is exactly why a memory leak in one microservice, container, or process can degrade an entire machine or node — it isn't just "that service's problem," it's a slow drain on the shared physical memory pool that every other process on the host depends on.

---

## 3. Garbage Collection Fundamentals

Garbage collection (GC) is an automatic memory management scheme: instead of the programmer explicitly calling `free`, the language runtime periodically identifies objects that are no longer reachable from the program's "roots" (local variables on the stack, global variables, CPU registers) and reclaims their memory.

```
Roots (stack variables, globals) ──▶ Object A ──▶ Object B
                                                       │
                                                       ▼
                                                   Object C

Object D  (nothing points to it — UNREACHABLE)

GC's job: find objects like D (unreachable from any root) and
          free the memory they occupy, so it can be reused for
          future allocations.
```

Three classic strategies, each with different tradeoffs, are covered below: reference counting, mark-and-sweep, and generational collection (which is really an optimization layered on top of mark-and-sweep-style tracing).

---

## 4. Reference Counting

**Idea:** Every object carries a counter of how many references point to it. When a reference is created, increment; when a reference goes away, decrement. When the count hits zero, the object is immediately freed.

```
x = Object()      # Object refcount = 1
y = x             # Object refcount = 2
del x             # Object refcount = 1
del y             # Object refcount = 0 → freed immediately
```

**Pros:** Memory is reclaimed the instant it becomes garbage — no unpredictable pause later. Simple to reason about.

**Cons:** Cannot detect **reference cycles** — two objects that reference each other but are unreachable from any root will never hit a refcount of zero on their own.

```
Object A ──references──▶ Object B
   ▲                          │
   └──────references──────────┘

Nothing outside points to A or B, but A's refcount is 1 (from B)
and B's refcount is 1 (from A). Pure reference counting will
NEVER free either of them — a classic memory leak caused by cycles.
```

Python uses reference counting as its primary mechanism (every object has a `refcount` field) but backs it up with a separate cyclic garbage collector specifically to catch cases like the one above.

---

## 5. Mark-and-Sweep

**Idea:** Periodically pause and trace, starting from the roots, every object that's reachable — "marking" each one as it's found. Anything not marked afterward is garbage and gets "swept" (freed) in one pass.

```
Phase 1: MARK
  Start at roots → follow every reference → mark each object visited

  Roots ──▶ [A: marked] ──▶ [B: marked]
                                 │
                                 ▼
                            [C: marked]

  [D: NOT marked]  [E: NOT marked]  (unreachable — includes cycles!)

Phase 2: SWEEP
  Walk the entire heap. Free every object that ISN'T marked.
  → D and E are freed, even though they reference each other,
    because mark-and-sweep doesn't rely on counting references —
    it only cares about reachability from roots.
```

**Pros:** Correctly handles reference cycles (unlike naive reference counting) — reachability, not reference count, decides what's garbage.

**Cons:** Requires "stop the world" (or at least stop-and-scan a region) while marking/sweeping, causing a pause. Naive mark-and-sweep also re-scans the *entire* heap every collection, which gets slower as heaps grow — this is the problem generational GC solves.

---

## 6. Generational Garbage Collection

**Key observation (the "generational hypothesis"):** most objects die young. A huge fraction of allocated objects (temporary variables, short-lived request objects, loop iterators) become garbage almost immediately, while a small fraction survive for a long time (caches, singletons, long-lived config objects).

```
Heap divided into generations:

┌───────────────────────┐     ┌─────────────────────────────┐
│   Young Generation      │     │      Old Generation          │
│   (small, fast to scan) │     │  (large, scanned rarely)      │
│                         │     │                                │
│  new objects allocated  │ ──▶ │  objects that survived         │
│  here first             │     │  several young-gen collections │
│                         │     │  get "promoted" here           │
└───────────────────────┘     └─────────────────────────────┘
      │
      │  Minor GC: scans ONLY the young generation.
      │  Fast, frequent (most garbage dies here — cheap to reclaim).
      │
      ▼
   Survivors after N minor GCs → promoted to old generation

  Major/Full GC: scans the old generation (and often everything).
  Slow, infrequent — because most old-gen objects are still alive,
  scanning them repeatedly would be wasted work.
```

**Why this is faster:** instead of re-scanning the whole heap on every collection (as naive mark-and-sweep would), the collector spends most of its effort on the small young generation where garbage is dense and cheap to find, and only occasionally pays the cost of scanning the much larger, mostly-alive old generation. This dramatically reduces average pause time and CPU overhead for typical workloads.

---

## 7. Tying It to Virtual Memory

Garbage collection operates entirely *inside* a process's virtual address space — it manages the process's heap, which itself lives on some subset of the process's virtual pages. The relationship to virtual memory (this phase's overall topic) is direct:

```
Process Virtual Address Space
┌─────────────────────────────────────┐
│ Code                                 │
│ Data                                 │
│ Heap  ◀── GC manages objects HERE   │
│   (young gen pages, old gen pages)   │
│   ...                                │
│ Stack                                │
└─────────────────────────────────────┘
        │
        │  Heap pages are backed by physical frames like any other
        │  page — demand-paged in, evictable, subject to page faults
        ▼
   Physical RAM / Swap (Phase 7, Lessons 1-3)
```

- If a language runtime's heap grows large (due to a real leak, or just legitimate large working data), the OS treats those extra heap pages exactly like any other memory: more resident pages, more physical frames consumed, more pressure toward thrashing if RAM is tight.
- A "major GC pause" is partly slow *because* scanning a large old generation may touch pages that have been swapped out or are cold in the CPU cache — triggering page faults or cache misses mid-collection.
- GC reduces heap fragmentation (many collectors compact surviving objects together), which — much like OS-level compaction (Phase 6, Lesson 2) — makes future allocations faster and reduces wasted space between live objects.
- Returning freed memory to the OS is a separate step from freeing it inside the heap: many runtimes free an object internally (making it available for reuse by future allocations in that same process) without ever calling back to the OS to shrink the process's virtual memory footprint. That's why a process's RSS/VSZ can look "high" even right after a big GC — the memory was freed at the language level but not necessarily returned to the OS.

---

## 8. Python's GC and Node's V8 GC, Briefly

### Python

```
Primary mechanism: reference counting (every object has ob_refcnt)
  - Object freed the instant refcount hits 0 — deterministic, immediate

Backup mechanism: generational cyclic GC (the `gc` module)
  - Specifically hunts for REFERENCE CYCLES that refcounting alone
    can't collect (see Section 4)
  - Has 3 generations (gen0, gen1, gen2) — objects that survive a
    gen0 collection get promoted to gen1, then gen2
  - Runs the cyclic collector periodically based on allocation
    thresholds, not on every single allocation/deallocation
```

### Node.js (V8 engine)

```
V8's heap is generational, using a Mark-and-Sweep / Mark-and-Compact
tracing collector (NOT reference counting):

  New Space (young generation)
    - Small, uses a "Scavenger" (copying) collector
    - Very fast, very frequent minor GCs
    - Objects that survive two scavenges get promoted

  Old Space (old generation)
    - Larger, uses Mark-Sweep-Compact
    - Less frequent, more expensive "Major GC"
    - V8 uses incremental and concurrent marking to break this work
      into small chunks, avoiding long stop-the-world pauses

Common Node.js "memory leak" causes at the language level:
  - Global arrays/maps/caches that only ever grow
  - Closures unintentionally retaining large objects in scope
  - Event listeners registered but never removed
  - Timers (setInterval) holding references to objects forever
```

Both are ultimately reclaiming memory *within* the process's virtual heap — neither can do anything about the process's overall virtual memory footprint being large if the application logic keeps legitimate (reachable) references around. That distinction — GC correctness vs application-level retention — is the same OS-vs-language-level distinction from Section 1, just seen from the runtime's perspective.

---

## 9. Hands-On Exercises

**Exercise 1:** Write a small Python script that creates two objects referencing each other in a cycle (`a.next = b; b.next = a`) with no other references to them, then `del a; del b`. Use `gc.collect()` and `gc.get_stats()` (or simply reason about it) to explain why reference counting alone wouldn't free them, but the cyclic collector does.

**Exercise 2:** Write a small Node.js script that intentionally leaks memory (e.g., push objects into a module-level array forever inside a `setInterval` and never clear it). Run it with `node --expose-gc` and log `process.memoryUsage().heapUsed` every few seconds to watch RSS grow.

**Exercise 3:** Explain, without running code, why a Node.js process's RSS might stay high even several seconds after a large object was set to `null` and should be garbage collectable. (Hint: think about GC scheduling and whether freed heap memory is always returned to the OS.)

**Exercise 4:** Draw a diagram (by hand or ASCII) of a young generation with 5 objects, where 4 die after one minor GC and 1 survives to be promoted to the old generation. Label the minor GC and the promotion step.

**Exercise 5:** In your own words, explain why "the garbage collector is broken" is almost always the wrong diagnosis for a memory leak in Java, Python, or Node.js, and what the right diagnosis usually is instead.

---

## 10. Interview Q&A

**Q: What's the difference between a memory leak at the OS level and at the language level?**
Answer: An OS/process-level leak is simply a process whose virtual memory footprint keeps growing because it keeps requesting pages from the OS and never releases them, regardless of cause. A language-level leak is more specific: application code retains references to objects it no longer actually needs (a growing cache with no eviction, a forgotten listener, a cycle), so a garbage collector — correctly, from its own point of view — treats those objects as still reachable and refuses to free them. The OS has no visibility into individual objects; it only sees the process's overall memory requests.

**Q: If a language has garbage collection, why can it still have memory leaks?**
Answer: Garbage collection only reclaims memory that is unreachable from the program's roots. If application logic still holds a reference to an object — even accidentally, such as via a global collection that's only appended to, or a closure capturing more than intended — the GC correctly considers it live and will never free it. The "leak" is really accidental retention by the application, not a GC malfunction.

**Q: Explain reference counting and its major weakness.**
Answer: Reference counting attaches a count to every object tracking how many references point to it; the count is incremented on reference creation and decremented on reference removal, and the object is freed the instant the count reaches zero. Its major weakness is that it cannot collect reference cycles — two or more objects that reference each other but are unreachable from any root will keep each other's counts above zero forever, leaking memory. Python solves this with a separate cyclic garbage collector layered on top of its primary reference-counting mechanism.

**Q: How does mark-and-sweep differ from reference counting, and why does it handle cycles correctly?**
Answer: Mark-and-sweep periodically traces all objects reachable from the roots (marking them), then frees everything left unmarked in a sweep phase. Because it determines liveness by actual reachability from roots — not by counting internal references between objects — a cycle of objects with no path back to a root is correctly identified as garbage and freed, unlike pure reference counting.

**Q: What is generational garbage collection and why is it faster than plain mark-and-sweep?**
Answer: It's based on the observation that most objects die young. The heap is split into a young generation (frequently, cheaply collected via a fast "minor GC" since most garbage is found there) and an old generation (objects that survived multiple young-gen collections get promoted there, and are scanned much less often via a slower "major GC"). This avoids repeatedly re-scanning long-lived objects that are almost always still alive, dramatically cutting average collection cost compared to scanning the entire heap every time.

**Q: How do memory leaks relate back to virtual memory and thrashing?**
Answer: A leak causes a process's heap to keep growing, which means the language runtime keeps requesting more virtual pages from the OS, which the OS backs with more physical frames as they're touched. As the leaking process's resident set grows, it consumes physical memory that other processes need, increasing system-wide page fault rates and pushing the system toward thrashing (Lesson 3). In severe cases, the OS's OOM killer may terminate a process — sometimes the leaking one, sometimes an unrelated victim — to relieve the memory pressure the leak created.
