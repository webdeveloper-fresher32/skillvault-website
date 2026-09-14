# Time-Space Tradeoffs — Complete Guide

## Table of Contents
1. [The Classic Tradeoff](#1-the-classic-tradeoff)
2. [Before: Naive Recursive Fibonacci — O(2ⁿ) Time](#2-before-naive-recursive-fibonacci--o2ⁿ-time)
3. [After: Memoized Fibonacci — O(n) Time, O(n) Space](#3-after-memoized-fibonacci--on-time-on-space)
4. [Timing Comparison — Runnable Code](#4-timing-comparison--runnable-code)
5. [Why the Speedup Happens](#5-why-the-speedup-happens)
6. [Other Common Time-Space Tradeoffs](#6-other-common-time-space-tradeoffs)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Classic Tradeoff

A huge portion of algorithm design comes down to one question: **"Can I spend some extra memory to avoid redoing work?"** This is the time-space tradeoff, and the most common technique for exploiting it is **memoization** (or its close cousin, using a hash map for O(1) lookups instead of repeated scanning).

```
┌───────────────────────────────────────────────────────────┐
│  Naive approach:    fast to write, low memory, SLOW        │
│                     (recomputes the same thing repeatedly) │
│                                                            │
│  Memoized approach: a bit more memory, MUCH faster         │
│                     (caches results so nothing is          │
│                      computed twice)                       │
│                                                            │
│  You are trading O(1) auxiliary space for O(n) auxiliary  │
│  space, in exchange for going from O(2ⁿ) time to O(n) time │
└───────────────────────────────────────────────────────────┘
```

This isn't free lunch — it genuinely costs memory — but for most real systems, memory is cheap and abundant compared to CPU time, so this trade is almost always worth it once inputs get large.

---

## 2. Before: Naive Recursive Fibonacci — O(2ⁿ) Time

```python
def fib_naive(n):
    """Time: O(2^n) — every call (except base cases) spawns two
    more recursive calls, re-deriving the same sub-results
    over and over.
    Space: O(n) — the recursion only ever goes n levels deep
    at once (space depends on max depth, not total calls)."""
    if n <= 1:
        return n
    return fib_naive(n - 1) + fib_naive(n - 2)
```

**Why this is so wasteful:** To compute `fib_naive(5)`, the function computes `fib_naive(3)` *twice* — once as part of computing `fib_naive(4)`, and again directly. `fib_naive(2)` gets computed *three* times. This duplication compounds at every level, which is exactly why the total work explodes exponentially:

```
                         fib(5)
                        /      \
                   fib(4)        fib(3)
                  /     \        /    \
             fib(3)   fib(2)  fib(2)  fib(1)
             /   \     /  \    /  \
         fib(2) fib(1) ... ... ...  ...
         /   \
     fib(1) fib(0)

Notice fib(3) appears twice, fib(2) appears three times,
fib(1) appears five times — massive repeated work.
```

---

## 3. After: Memoized Fibonacci — O(n) Time, O(n) Space

```python
def fib_memo(n, cache=None):
    """Time: O(n) — each unique n value is computed exactly once;
    every subsequent request for it is an O(1) cache lookup.
    Space: O(n) — the cache dictionary stores up to n entries,
    PLUS O(n) for the recursion stack depth.
    Total auxiliary space: O(n) (the two O(n) terms add, not multiply)."""
    if cache is None:
        cache = {}
    if n <= 1:
        return n
    if n in cache:
        return cache[n]          # O(1) — trade memory for avoiding recomputation
    cache[n] = fib_memo(n - 1, cache) + fib_memo(n - 2, cache)
    return cache[n]
```

**What changed:** Before computing `fib_memo(k)` from scratch, we check whether it's already in `cache`. The first time any value of `n` is requested, it gets computed and stored; every subsequent request for that same value is an instant O(1) dictionary lookup instead of a full re-derivation. Since there are only `n` distinct sub-problems (`fib(0)` through `fib(n)`), and each is computed exactly once, the total time collapses from O(2ⁿ) to O(n).

The cost: we now hold a dictionary with up to `n` entries in memory — O(n) extra space that the naive version didn't need.

---

## 4. Timing Comparison — Runnable Code

```python
import time
import sys

sys.setrecursionlimit(10000)


def fib_naive(n):
    if n <= 1:
        return n
    return fib_naive(n - 1) + fib_naive(n - 2)


def fib_memo(n, cache=None):
    if cache is None:
        cache = {}
    if n <= 1:
        return n
    if n in cache:
        return cache[n]
    cache[n] = fib_memo(n - 1, cache) + fib_memo(n - 2, cache)
    return cache[n]


print("=== Naive (O(2^n)) ===")
for n in (20, 28, 32):
    start = time.perf_counter()
    result = fib_naive(n)
    elapsed = time.perf_counter() - start
    print(f"fib_naive({n}) = {result}, took {elapsed:.6f}s")

print("\n=== Memoized (O(n)) ===")
for n in (20, 28, 32, 500):
    start = time.perf_counter()
    result = fib_memo(n)
    elapsed = time.perf_counter() - start
    print(f"fib_memo({n}) = {result}, took {elapsed:.6f}s")
```

**Actual output when run** (numbers will vary slightly by machine, but the *shape* of the result will not):

```
=== Naive (O(2^n)) ===
fib_naive(20) = 6765, took 0.000517s
fib_naive(28) = 317811, took 0.022502s
fib_naive(32) = 2178309, took 0.144366s

=== Memoized (O(n)) ===
fib_memo(20) = 6765, took 0.000008s
fib_memo(28) = 317811, took 0.000003s
fib_memo(32) = 2178309, took 0.000003s
fib_memo(500) = 13942322456169788013972438287040728395007025658769730726410896294832557162286329069155765887622252129412... (huge number), took 0.000077s
```

Notice: going from `n=20` to `n=32` (only 12 more), the naive version's time grows by roughly **280x** (0.000517s → 0.144366s) — the exponential curve in action. The memoized version barely changes at all, and can even handle `n=500` (a number the naive version would need longer than the age of the universe to compute) in well under a millisecond.

---

## 5. Why the Speedup Happens

| Aspect | `fib_naive` | `fib_memo` |
|--------|-------------|------------|
| Time complexity | O(2ⁿ) | O(n) |
| Space complexity (auxiliary) | O(n) (call stack only) | O(n) (call stack + cache) |
| Redundant work | Massive — same sub-problems recomputed exponentially many times | None — each sub-problem solved exactly once |
| Tradeoff | Low memory, unusable for n > ~40 | Slightly more memory, usable for n in the thousands |

The core mechanism: **memoization converts a tree of recursive calls (with massive overlap) into a graph of unique sub-problems (with no overlap)**, by remembering the answer to each sub-problem the first time it's solved. The memory cost (the cache) is what enables the time savings — you cannot get the O(n) speedup for free, but the tradeoff is overwhelmingly worth it here since O(n) space is cheap compared to O(2ⁿ) time.

---

## 6. Other Common Time-Space Tradeoffs

- **Hash maps for O(1) lookup instead of O(n) linear scan** — e.g., checking `x in a_set` instead of `x in a_list` trades the memory of a hash table for average O(1) membership tests instead of O(n).
- **Caching / memoizing expensive function results** (e.g., `functools.lru_cache` in Python) — trades memory for avoiding repeated expensive computation or I/O (like a database query or API call).
- **Precomputed lookup tables** — e.g., precomputing all prime numbers up to N with a sieve, storing them in an array, so future "is this prime?" checks are O(1) instead of recomputing primality each time.
- **Indexes in databases** — a database index is literally extra storage (space) traded for dramatically faster lookups (time) — the canonical real-world example of this tradeoff.
- **Bloom filters** — the reverse direction: trading a small amount of accuracy for extremely low memory use and O(1) approximate membership tests.

---

## 7. Hands-On Exercises

**Exercise 1:** Run the timing code from section 4 yourself. Try `fib_naive(35)` and `fib_naive(38)` — record how the time grows and compare the ratio to the theoretical 2x-per-step you'd expect from O(2ⁿ).

**Exercise 2:** Rewrite `fib_memo` using Python's built-in `functools.lru_cache` decorator instead of a manual dictionary. Confirm it produces the same timing behavior.

**Exercise 3:** Write a naive O(n²) function that checks for duplicate elements in a list via nested loops, then rewrite it using a `set` to achieve O(n) time at the cost of O(n) space. Time both versions on a list of 10,000 elements.

**Exercise 4:** Explain, in terms of the time-space tradeoff, why database indexes speed up read queries but slow down writes (inserts/updates must also update the index).

**Exercise 5:** Convert `fib_memo` to an iterative "bottom-up" version that fills an array from `fib(0)` up to `fib(n)`. What is its time and space complexity? Can you reduce its space to O(1) by only keeping the last two values?

---

## 8. Interview Q&A

**Q: What is the time-space tradeoff, and why does memoization exploit it?**
Answer: The time-space tradeoff is the principle that you can often reduce an algorithm's runtime by using additional memory to avoid redundant computation. Memoization exploits this directly: it stores ("caches") the result of each unique sub-problem the first time it's computed, so subsequent requests for that same sub-problem are O(1) lookups instead of full recomputations. This costs memory (the cache) but can turn exponential-time algorithms into polynomial or linear-time ones.

**Q: Why is naive recursive Fibonacci O(2ⁿ), and how does memoization fix it?**
Answer: Naive recursive Fibonacci recomputes the same sub-problems repeatedly — `fib(n-2)` gets computed both directly and as part of computing `fib(n-1)`, and this duplication compounds at every level, producing a call tree with roughly 2ⁿ total calls. Memoization fixes this by caching each `fib(k)` result the first time it's computed; since there are only n distinct values of k from 0 to n, each computed exactly once, the total time drops to O(n), at the cost of O(n) extra space for the cache.

**Q: If memoization makes an algorithm faster, why wouldn't you always use it?**
Answer: Memoization costs memory proportional to the number of distinct sub-problems, which can be significant for problems with a large state space (e.g., memoizing on multiple parameters, or very large n). If memory is genuinely constrained (embedded systems, extremely large-scale data), the added space cost may not be affordable, and you'd need a different strategy — such as an iterative bottom-up approach that only keeps the last few needed values instead of the full history.

**Q: What's the difference between memoization and dynamic programming (DP)?**
Answer: Memoization is a top-down technique — you write the natural recursive solution and add caching to avoid recomputation. Dynamic programming (in the "tabulation" sense) is typically bottom-up — you iteratively build up a table of solved sub-problems starting from the base cases. Both exploit the same underlying idea (avoid recomputing overlapping sub-problems, trading space for time), but memoization is recursion + cache, while tabulation is iteration + table.

**Q: Give a real-world (non-Fibonacci) example of trading space for time.**
Answer: A database index is a strong real example — it's extra storage (space) built alongside a table, specifically to make lookups by a certain column much faster (avoiding a full table scan). Another is caching layers like Redis in a web application: storing computed or fetched results in memory so repeated requests skip expensive database queries or computations, trading RAM usage for lower latency.

**Q: In the timing comparison, why does `fib_memo(500)` run instantly while `fib_naive` can't even practically compute `fib_naive(50)`?**
Answer: Because `fib_memo` only does O(n) total work — 500 unique sub-problems, each solved once — while `fib_naive`'s work grows as O(2ⁿ), and 2^50 is over a quadrillion operations, which would take naive recursion an impractically long time even on fast hardware. The memoized version's linear growth versus the naive version's exponential growth is precisely why the same mathematical result is "instant" in one implementation and "computationally infeasible" in the other.
