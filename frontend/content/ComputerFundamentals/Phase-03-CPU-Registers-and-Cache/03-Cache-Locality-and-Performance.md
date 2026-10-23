# Cache Locality and Performance — Complete Guide

## Table of Contents
1. [Cache Hits and Misses — A Refresher](#1-cache-hits-and-misses--a-refresher)
2. [Temporal Locality](#2-temporal-locality)
3. [Spatial Locality](#3-spatial-locality)
4. [How Data Actually Enters the Cache: Cache Lines](#4-how-data-actually-enters-the-cache-cache-lines)
5. [Concrete Example: Row-Major vs Column-Major Traversal](#5-concrete-example-row-major-vs-column-major-traversal)
6. [Benchmarking It Yourself](#6-benchmarking-it-yourself)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Cache Hits and Misses — A Refresher

- **Cache hit**: the CPU looks for data in the cache and finds it. Fast (~1-20 ns depending on level).
- **Cache miss**: the CPU looks for data in the cache and doesn't find it, forcing a trip to a slower level (or all the way to RAM, ~100 ns).

```
Access memory[42]
   │
   ├── Found in L1 cache?  → HIT  (fast)
   └── Not found anywhere in cache → MISS (slow, must fetch from RAM)
```

The entire goal of writing "cache-friendly" code is to maximize the hit rate — structure your program's memory access so the CPU's cache correctly predicts and pre-loads what you're about to need next.

Two properties of memory access patterns determine whether caches can do their job well: **temporal locality** and **spatial locality**.

## 2. Temporal Locality

**Temporal locality**: if a piece of data was accessed recently, it's likely to be accessed again soon.

```python
total = 0
for i in range(1_000_000):
    total += i     # `total` is read AND written on every single iteration
```

Here, the variable `total` exhibits extremely high temporal locality — it's reused a million times in a row. The CPU cache keeps it in the fastest available level (likely a register, and if not, L1 cache) the entire time, so the "recompute total" step is essentially free after the very first access.

Contrast this with code that reads a value once and never touches it again — there's no reuse to exploit, so temporal locality doesn't help.

## 3. Spatial Locality

**Spatial locality**: if a piece of data was accessed, data physically *near* it in memory is likely to be accessed soon too.

```python
arr = [0] * 1_000_000
for i in range(len(arr)):
    arr[i] = i * 2   # sequential access: arr[0], arr[1], arr[2], ...
```

Arrays are stored as one contiguous block of memory. When the CPU fetches `arr[0]`, the cache doesn't just load that single element — it loads an entire **cache line** (a fixed-size chunk, typically 64 bytes) surrounding it, which likely also contains `arr[1]`, `arr[2]`, `arr[3]`, etc. (for a typical 8-byte element). So by the time your loop asks for `arr[1]`, it's often already sitting in cache from the same fetch that grabbed `arr[0]` — a hit, "for free."

Linked lists, by contrast, scatter their nodes across arbitrary memory addresses (each node individually heap-allocated). Walking a linked list means each `node.next` access is likely to land in a completely different, uncached memory region — poor spatial locality, frequent cache misses.

## 4. How Data Actually Enters the Cache: Cache Lines

The cache doesn't fetch memory one byte or one variable at a time — it always fetches in fixed-size blocks called **cache lines**, typically **64 bytes** on modern CPUs.

```
Memory (bytes):  [0][1][2][3][4][5][6][7]...[63][64][65]...
                  └──────────── one 64-byte cache line ────────────┘

Reading byte 3 pulls in ALL of bytes 0-63 into the cache at once.
Reading byte 70 pulls in a DIFFERENT cache line (bytes 64-127).
```

For an array of 8-byte integers (`int64`/`double`), one 64-byte cache line holds **8 consecutive elements**. This means:

- Accessing `arr[0]` through `arr[7]` sequentially costs roughly **one** cache miss (for the first element) plus **seven** cache hits (the rest ride along for free in the same line).
- Accessing `arr[0]`, then jumping to `arr[1000]`, then `arr[2000]`... costs a cache miss on almost *every single access*, because each jump lands in an entirely different cache line.

This is the mechanical reason why sequential access patterns are fast and scattered/strided access patterns are slow — even when both do the exact same number of logical operations.

## 5. Concrete Example: Row-Major vs Column-Major Traversal

Most languages (C, Python with NumPy default, Java, JavaScript typed arrays) store 2D arrays in **row-major order**: the entire first row is laid out contiguously in memory, then the entire second row immediately after it, and so on.

```
2D array (3x4), conceptually:
  [ [ a, b, c, d ],
    [ e, f, g, h ],
    [ i, j, k, l ] ]

Actual memory layout (row-major, contiguous):
  [ a, b, c, d, e, f, g, h, i, j, k, l ]
    └──row 0───┘ └──row 1───┘ └──row 2───┘
```

**Row-major traversal (cache-friendly)** — walk through memory in the same order it's laid out:

```python
import time

ROWS, COLS = 2000, 2000
matrix = [[i + j for j in range(COLS)] for i in range(ROWS)]

start = time.perf_counter()
total = 0
for i in range(ROWS):        # outer loop over rows
    for j in range(COLS):    # inner loop over columns
        total += matrix[i][j]   # matrix[i][j], matrix[i][j+1], ... are adjacent in memory
row_major_time = time.perf_counter() - start

print(f"Row-major total={total}, time={row_major_time:.4f}s")
```

**Column-major traversal (cache-unfriendly)** — same total work, but memory is visited out of order:

```python
start = time.perf_counter()
total = 0
for j in range(COLS):        # outer loop over columns
    for i in range(ROWS):    # inner loop over rows
        total += matrix[i][j]   # matrix[0][j], matrix[1][j], ... are ROWS apart in memory!
col_major_time = time.perf_counter() - start

print(f"Column-major total={total}, time={col_major_time:.4f}s")
print(f"Column-major was {col_major_time / row_major_time:.2f}x slower")
```

Full runnable script (save as `cache_locality_demo.py` and run with `python3 cache_locality_demo.py`):

```python
import time

ROWS, COLS = 2000, 2000
matrix = [[i + j for j in range(COLS)] for i in range(ROWS)]

# Row-major: access order matches memory layout
start = time.perf_counter()
total = 0
for i in range(ROWS):
    for j in range(COLS):
        total += matrix[i][j]
row_major_time = time.perf_counter() - start
print(f"Row-major:    total={total}, time={row_major_time:.4f}s")

# Column-major: access order jumps across memory, row by row
start = time.perf_counter()
total = 0
for j in range(COLS):
    for i in range(ROWS):
        total += matrix[i][j]
col_major_time = time.perf_counter() - start
print(f"Column-major: total={total}, time={col_major_time:.4f}s")

print(f"\nColumn-major was {col_major_time / row_major_time:.2f}x slower "
      f"despite doing the exact same number of additions.")
```

**Why this happens:** in the row-major version, `matrix[i][j]` and `matrix[i][j+1]` sit right next to each other in memory — the same cache line usually covers several consecutive `j` values, so most accesses are cache hits. In the column-major version, `matrix[i][j]` and `matrix[i+1][j]` are `COLS` elements apart in memory (an entire row's width away) — each step in the inner loop jumps to a completely different cache line, causing a cache miss almost every time.

The equivalent C version makes the memory layout even more explicit:

```c
#include <stdio.h>
#include <time.h>

#define ROWS 2000
#define COLS 2000
static int matrix[ROWS][COLS];

int main(void) {
    for (int i = 0; i < ROWS; i++)
        for (int j = 0; j < COLS; j++)
            matrix[i][j] = i + j;

    clock_t start, end;
    long total;

    // Row-major: matrix[i][j] and matrix[i][j+1] are adjacent in memory
    start = clock();
    total = 0;
    for (int i = 0; i < ROWS; i++)
        for (int j = 0; j < COLS; j++)
            total += matrix[i][j];
    end = clock();
    printf("Row-major:    total=%ld, time=%.4fs\n", total,
           (double)(end - start) / CLOCKS_PER_SEC);

    // Column-major: matrix[i][j] and matrix[i+1][j] are COLS ints apart
    start = clock();
    total = 0;
    for (int j = 0; j < COLS; j++)
        for (int i = 0; i < ROWS; i++)
            total += matrix[i][j];
    end = clock();
    printf("Column-major: total=%ld, time=%.4fs\n", total,
           (double)(end - start) / CLOCKS_PER_SEC);

    return 0;
}
```

Compile and run with: `gcc -O2 cache_demo.c -o cache_demo && ./cache_demo`

In both languages, the column-major version typically runs several times slower (commonly 2x-10x depending on matrix size, CPU cache size, and compiler optimizations) — despite performing the identical number of additions in the identical Big-O time complexity, O(rows × cols). This is the key insight: **Big-O complexity does not capture cache behavior** — two algorithms with the same complexity can have very different real-world performance because of memory access patterns.

## 6. Benchmarking It Yourself

If you run the Python script above, note that Python's overhead (interpreter, dynamic typing) may dampen the difference somewhat compared to C, where the effect is usually much more dramatic because there's no interpreter overhead masking the raw memory latency. For the clearest demonstration, use the C version with a large matrix (e.g., 4000x4000) and `-O2` optimization.

---

## 7. Hands-On Exercises

**Exercise 1:** Run the Python `cache_locality_demo.py` script above on your own machine. Record the row-major time, column-major time, and the slowdown ratio.

**Exercise 2:** Modify the script to test matrix sizes of 100x100, 1000x1000, and 5000x5000. Does the slowdown ratio grow, shrink, or stay roughly the same as the matrix gets bigger? Explain why, relating your answer to cache size limits.

**Exercise 3:** Compile and run the C version with `gcc -O2`. Compare the slowdown ratio to the Python version's ratio. Which language shows a more dramatic difference, and why might that be?

**Exercise 4:** In your own words, explain the difference between temporal locality and spatial locality, and give one code example (not from this lesson) that demonstrates each.

**Exercise 5:** Explain why a linked list traversal (`while node: node = node.next`) typically has worse cache performance than an array traversal (`for x in arr`), even though both are O(n) operations.

---

## 8. Interview Q&A

**Q: What is the difference between temporal locality and spatial locality?**
Answer: Temporal locality means recently accessed data is likely to be accessed again soon (e.g., a loop counter reused every iteration). Spatial locality means data physically near recently accessed data is likely to be accessed soon too (e.g., the next element in an array). Caches are designed to exploit both: they keep recently used data around (temporal) and fetch whole blocks of nearby memory at once (spatial).

**Q: Why is row-major traversal of a 2D array faster than column-major traversal?**
Answer: Because most languages store 2D arrays in row-major order — an entire row is contiguous in memory before the next row starts. Row-major traversal accesses memory in the same order it's physically laid out, so consecutive accesses usually land in the same cache line (cache hits). Column-major traversal jumps by an entire row's width on every step, landing in a new, uncached cache line almost every time (cache misses) — despite doing the exact same number of operations.

**Q: What is a cache line, and why does it matter for performance?**
Answer: A cache line is the fixed-size chunk (commonly 64 bytes) that a CPU cache fetches from memory at once — never just a single byte or variable. It matters because accessing one element of an array pulls in several of its neighbors "for free," making sequential access patterns much faster than scattered ones, since a single miss ends up satisfying several subsequent accesses as hits.

**Q: Can two algorithms with the same Big-O time complexity have very different real-world performance? Why?**
Answer: Yes. Big-O measures the growth rate of the number of operations, not how those operations interact with hardware memory. Two O(n) or O(n²) algorithms can differ dramatically in wall-clock time if one has cache-friendly (sequential, reused) memory access patterns and the other has cache-unfriendly (scattered, non-reused) patterns — the row-major vs column-major matrix traversal example is a canonical case, both are O(rows × cols) but one can be several times faster in practice.

**Q: Why do array-based data structures generally outperform linked lists in practice, even when both offer the same asymptotic complexity for a given operation?**
Answer: Arrays store elements contiguously, giving excellent spatial locality — traversing an array benefits heavily from cache-line prefetching. Linked lists scatter their nodes across arbitrary heap addresses (each node allocated independently), so traversing a linked list usually causes a cache miss on nearly every `next` pointer dereference. Both may be O(n) to traverse, but the array's cache-friendly layout makes it substantially faster in wall-clock terms.

**Q: What's a practical way to make code more cache-friendly?**
Answer: Favor contiguous data structures (arrays, structs-of-arrays) over pointer-chasing structures (linked lists, trees with scattered allocations) when performance matters; access multi-dimensional arrays in the order they're stored (row-major for C-like languages); and process data in blocks/tiles that fit within cache size for very large datasets ("cache blocking/tiling"), rather than jumping around unpredictably.
