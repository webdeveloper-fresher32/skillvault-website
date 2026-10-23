# Page Replacement Algorithms — Complete Guide

## Table of Contents
1. [Why Page Replacement Exists](#1-why-page-replacement-exists)
2. [FIFO (First-In-First-Out)](#2-fifo-first-in-first-out)
3. [LRU (Least Recently Used)](#3-lru-least-recently-used)
4. [Optimal (Belady's MIN)](#4-optimal-beladys-min)
5. [Comparing the Three](#5-comparing-the-three)
6. [Belady's Anomaly](#6-beladys-anomaly)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Page Replacement Exists

When a page fault happens and RAM has no free frame left, the OS must **evict** (replace) some page currently in RAM to make room for the page that's needed now. Which page to evict matters enormously for performance — pick badly and the OS spends its time constantly re-loading pages it just threw out (see Phase 7, lesson 3: Thrashing).

```
RAM is full. A page fault just occurred. The OS must pick a VICTIM:

┌─────────┬─────────┬─────────┐
│ Frame 0 │ Frame 1 │ Frame 2 │   ← all occupied
│ Page 7  │ Page 2  │ Page 9  │
└─────────┴─────────┴─────────┘
         │
         │  Which one do we evict to load the new page?
         ▼
   This is exactly the question page replacement
   algorithms answer.
```

All the algorithms below are graded on one metric: **number of page faults** for a given reference string (the sequence of pages a process touches) and a given number of available frames. Fewer faults = better.

We'll use this reference string throughout, with **3 frames** available:

```
Reference string:  1  2  3  4  1  2  5  1  2  3  4  5
Index:             1  2  3  4  5  6  7  8  9  10 11 12
```

---

## 2. FIFO (First-In-First-Out)

**Rule:** Evict the page that has been in memory the *longest*, regardless of how recently or often it was used. Think of it as a queue — the oldest page in is the first page out.

### Worked Example (3 frames)

| Ref | 1 | 2 | 3 | 4 | 1 | 2 | 5 | 1 | 2 | 3 | 4 | 5 |
|-----|---|---|---|---|---|---|---|---|---|---|---|---|
| Frame A | 1 | 1 | 1 | **2** | **3** | **4** | **1** | 1 | 1 | **2** | **5** | 5 |
| Frame B | — | 2 | 2 | 2 | 4 | 1 | 2 | 2 | 2 | 3 | 3 | **3** |
| Frame C | — | — | 3 | 3 | 1 | 2 | 5 | 5 | 5 | 5 | 4 | 4 |
| Fault?  | F | F | F | F | F | F | F | H | H | F | F | H |

*(Bold marks the page that just entered a frame, evicting whatever was oldest.)*

**Total: 9 faults, 3 hits.**

Walkthrough of the tricky steps: at index 4 (ref `4`), frames hold `{1,2,3}` and `1` is the oldest (it entered first) — so `1` is evicted, not `2` or `3`, even though `1` might be about to be used again very soon. That "doesn't care about future use" blind spot is FIFO's core weakness.

---

## 3. LRU (Least Recently Used)

**Rule:** Evict the page that hasn't been touched for the *longest time* — i.e., look backward in history and evict whoever was used least recently. This approximates "pages used recently will likely be used again soon" (temporal locality).

### Worked Example (3 frames)

| Ref | 1 | 2 | 3 | 4 | 1 | 2 | 5 | 1 | 2 | 3 | 4 | 5 |
|-----|---|---|---|---|---|---|---|---|---|---|---|---|
| Frame A | 1 | 1 | 1 | **2** | **3** | **4** | **1** | 1 | 1 | **1** | **2** | **3** |
| Frame B | — | 2 | 2 | 2 | 4 | 1 | 2 | 2 | 2 | 2 | 3 | 4 |
| Frame C | — | — | 3 | 3 | 1 | 2 | 5 | 5 | 5 | 3 | 4 | 5 |
| Fault?  | F | F | F | F | F | F | F | H | H | F | F | F |

**Total: 10 faults, 2 hits.**

Notice LRU actually does *worse* than FIFO on this particular string (10 vs 9 faults) — LRU is a heuristic based on the past, and the past doesn't always predict the future well. In general LRU tends to outperform FIFO on real workloads with strong temporal locality, but no page-replacement heuristic beats Optimal, and none is guaranteed to beat FIFO on every single string.

LRU is normally implemented with a counter/timestamp per page (updated on every access) or a doubly linked list that's reordered on every access (move accessed page to the front). True LRU is expensive to track precisely at scale, so real OS kernels approximate it (e.g., the "clock"/second-chance algorithm using a reference bit).

---

## 4. Optimal (Belady's MIN)

**Rule:** Evict the page that will *not be used for the longest time in the future* (or never again). This requires knowing the future reference sequence in advance — which is impossible in a real running system. Optimal exists purely as a **theoretical benchmark**: no real algorithm can beat it, so it tells you how close FIFO/LRU/etc. are to the best possible outcome.

### Worked Example (3 frames)

| Ref | 1 | 2 | 3 | 4 | 1 | 2 | 5 | 1 | 2 | 3 | 4 | 5 |
|-----|---|---|---|---|---|---|---|---|---|---|---|---|
| Frames in RAM | {1} | {1,2} | {1,2,3} | {1,2,**4**} | {1,2,4} | {1,2,4} | {1,2,**5**} | {1,2,5} | {1,2,5} | {2,5,**3**} | {5,3,**4**} | {5,3,4} |
| Fault?  | F | F | F | F | H | H | F | H | H | F | F | H |

**Total: 7 faults, 5 hits.**

Walkthrough: at index 4 (ref `4`), frames hold `{1,2,3}`. Looking ahead: `1` is needed again at index 5, `2` at index 6, `3` not until index 10 (the farthest away). So Optimal evicts `3` — the page whose next use is furthest in the future. This look-ahead is exactly why Optimal always produces the fewest (or tied-fewest) faults of any algorithm on a given string.

---

## 5. Comparing the Three

| Algorithm | Faults (this example) | Needs future knowledge? | Real-world use |
|-----------|:---:|:---:|---|
| **Optimal** | 7 | Yes (impossible in practice) | Benchmark only |
| **FIFO** | 9 | No | Simple, rarely used alone — ignores usage pattern |
| **LRU** | 10 (on this string) | No (uses past only) | Common; approximated via clock/second-chance algorithms |

```
Faults on this example:   Optimal (7)  ≤  FIFO (9)  <  LRU (10)

General truth:  Optimal is ALWAYS ≤ every other algorithm, for any string.
                FIFO vs LRU: neither always beats the other — it depends
                on the access pattern.
```

Real operating systems (Linux, Windows) don't implement textbook LRU exactly — it's too expensive to update ordering on every single memory access at scale. Instead they use approximations like the **clock algorithm** (a circular list of pages with a reference bit, sweeping through and giving pages a "second chance" if their bit is set) which gets LRU-like behavior cheaply.

---

## 6. Belady's Anomaly

Intuitively, giving a process **more frames** should never increase its page fault count — more RAM should only help, never hurt. FIFO breaks this intuition. This surprising behavior is called **Belady's Anomaly**.

### Reference String: `1 2 3 4 1 2 5 1 2 3 4 5` — FIFO with 3 vs 4 frames

**3 frames (from Section 2 above): 9 faults.**

**4 frames:**

| Ref | 1 | 2 | 3 | 4 | 1 | 2 | 5 | 1 | 2 | 3 | 4 | 5 |
|-----|---|---|---|---|---|---|---|---|---|---|---|---|
| Frames in RAM (queue order) | {1} | {1,2} | {1,2,3} | {1,2,3,4} | {1,2,3,4} | {1,2,3,4} | {2,3,4,**5**} | {3,4,5,**1**} | {4,5,1,**2**} | {5,1,2,**3**} | {1,2,3,**4**} | {2,3,4,**5**} |
| Fault?  | F | F | F | F | H | H | F | F | F | F | F | F |

**Total: 10 faults, 2 hits.**

```
   3 frames → 9  faults
   4 frames → 10 faults    ← MORE memory, MORE faults!

This is Belady's Anomaly: for FIFO specifically, increasing the
number of frames can, for certain reference strings, increase
(not decrease) the number of page faults.
```

**Why this happens:** FIFO's eviction choice depends only on arrival order, not on usage. Adding a frame changes *which* page happens to be "oldest" at each step in a way that isn't monotonically better — the set of pages resident in RAM at any given moment with 4 frames isn't a superset of the set with 3 frames, the way it would be for "stack algorithms" like LRU and Optimal.

**Key fact for interviews:** algorithms in the **stack algorithm** family (LRU, Optimal) are mathematically proven immune to Belady's Anomaly — for those, more frames can never increase fault count. FIFO is not a stack algorithm, which is precisely why it's vulnerable.

---

## 7. Hands-On Exercises

**Exercise 1:** For reference string `7 0 1 2 0 3 0 4 2 3 0 3 2` with 3 frames, compute the number of page faults using FIFO. Show the frame contents at every step in a table like the ones above.

**Exercise 2:** Using the same reference string as Exercise 1, compute the number of page faults using LRU. Compare your result to FIFO — which performed better?

**Exercise 3:** Using the same reference string as Exercise 1, compute the number of page faults using Optimal. Confirm that Optimal's fault count is less than or equal to both FIFO's and LRU's.

**Exercise 4:** Construct your own reference string (at least 10 references, using at least 4 distinct page numbers) and demonstrate Belady's Anomaly with FIFO by comparing 3-frame and 4-frame fault counts. (Hint: reuse the pattern from Section 6 as a starting point and tweak it.)

**Exercise 5:** Explain why LRU is provably immune to Belady's Anomaly but FIFO is not. (Hint: think about whether the set of pages held with N frames is always a subset of the pages held with N+1 frames at every step.)

---

## 8. Interview Q&A

**Q: What is a page replacement algorithm, and why do we need one?**
Answer: When a page fault occurs and physical memory has no free frame, the OS must choose an existing resident page to evict to make room for the new one. A page replacement algorithm is the policy used to choose that victim. The choice matters because a bad policy causes far more page faults (and disk I/O) than a good one for the same amount of memory.

**Q: Explain FIFO page replacement and its main weakness.**
Answer: FIFO evicts whichever page has been resident in memory the longest, tracked as a simple queue — oldest in, first out. Its weakness is that it ignores how recently or frequently a page is actually used; a heavily-used page can be evicted purely because it happened to load early, right before it's needed again. This is also the algorithm affected by Belady's Anomaly.

**Q: Explain LRU and why real systems approximate it instead of implementing it exactly.**
Answer: LRU evicts the page that hasn't been accessed for the longest time, based on the idea that recently used pages are likely to be used again soon (temporal locality). Exact LRU requires updating an access-time/ordering structure on every single memory reference, which is too expensive to do in hardware/software at CPU speeds for every access. Real systems approximate it cheaply with algorithms like the clock/second-chance algorithm, which uses a single reference bit per page.

**Q: What is the Optimal (Belady's MIN) algorithm, and why can't it be used in production?**
Answer: Optimal evicts the page that won't be needed for the longest time in the future, guaranteeing the fewest possible faults for any given reference string and frame count. It requires perfect knowledge of future memory accesses, which is impossible for a running system to know in advance. It's used only as a theoretical yardstick to measure how close practical algorithms (FIFO, LRU, clock) come to the best possible result.

**Q: What is Belady's Anomaly? Give an example of when it occurs.**
Answer: Belady's Anomaly is the counter-intuitive result where increasing the number of available page frames increases the number of page faults, for certain reference strings under FIFO. For example, the reference string `1 2 3 4 1 2 5 1 2 3 4 5` produces 9 faults with 3 frames but 10 faults with 4 frames under FIFO. It occurs because FIFO is not a "stack algorithm" — the set of resident pages with N frames is not guaranteed to be a subset of the resident pages with N+1 frames at every step.

**Q: Which algorithms are immune to Belady's Anomaly, and why?**
Answer: Stack algorithms — most notably LRU and Optimal — are immune. They have the property that the set of pages held in memory with N frames is always a subset of the pages held with N+1 frames at every point in the reference string, so adding frames can only keep more pages resident, never fewer. FIFO lacks this subset property, which is why it alone can exhibit the anomaly.
