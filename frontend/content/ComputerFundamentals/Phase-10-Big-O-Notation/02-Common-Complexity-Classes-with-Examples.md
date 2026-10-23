# Common Complexity Classes with Examples — Complete Guide

## Table of Contents
1. [O(1) — Constant Time](#1-o1--constant-time)
2. [O(log n) — Logarithmic Time](#2-olog-n--logarithmic-time)
3. [O(n) — Linear Time](#3-on--linear-time)
4. [O(n log n) — Linearithmic Time](#4-on-log-n--linearithmic-time)
5. [O(n²) — Quadratic Time](#5-on²--quadratic-time)
6. [O(n³) — Cubic Time](#6-on³--cubic-time)
7. [O(2ⁿ) — Exponential Time](#7-o2ⁿ--exponential-time)
8. [O(n!) — Factorial Time](#8-on--factorial-time)
9. [Summary Table](#9-summary-table)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. O(1) — Constant Time

The number of operations does **not** depend on input size at all.

```python
def get_first_element(lst):
    """O(1): accessing an index or a dict key takes the same time
    whether the list has 3 elements or 3 million."""
    return lst[0]


def is_even(n):
    """O(1): a single arithmetic + comparison operation, always."""
    return n % 2 == 0
```

**Why it's O(1):** Array indexing (`lst[0]`) and dictionary key lookups are implemented as direct memory address / hash computations — they don't scan anything. No loop, no recursion, no dependency on `n` — the work is fixed regardless of input size.

---

## 2. O(log n) — Logarithmic Time

The number of operations grows very slowly because the problem size is **cut by a constant factor** (usually half) on every step.

```python
def binary_search(sorted_list, target):
    """O(log n): each iteration discards half of the remaining
    search space, so the loop runs about log2(n) times."""
    low, high = 0, len(sorted_list) - 1
    while low <= high:
        mid = (low + high) // 2
        if sorted_list[mid] == target:
            return mid
        elif sorted_list[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
```

**Why it's O(log n):** Every iteration halves the search space (`low..high`). Starting from `n` elements, after `k` halvings only `n / 2^k` elements remain. The loop ends when that shrinks to ~1, i.e., `k ≈ log₂(n)`. Doubling the input only adds *one more* iteration — that's the signature of logarithmic growth.

---

## 3. O(n) — Linear Time

The number of operations grows in direct proportion to the input size.

```python
def find_max(lst):
    """O(n): must look at every element once to guarantee
    it hasn't missed a larger value."""
    current_max = lst[0]
    for value in lst:
        if value > current_max:
            current_max = value
    return current_max
```

**Why it's O(n):** The `for` loop touches each of the `n` elements exactly once, doing a constant amount of work per element. Total work = `n × constant` → O(n). Doubling the list doubles the work.

---

## 4. O(n log n) — Linearithmic Time

Typical of efficient comparison-based sorting: you do a "linear pass" of work at each of `log n` levels of splitting.

```python
def merge_sort(lst):
    """O(n log n): the list is split in half recursively (log n
    levels of splitting), and each level does O(n) work merging."""
    if len(lst) <= 1:
        return lst

    mid = len(lst) // 2
    left = merge_sort(lst[:mid])
    right = merge_sort(lst[mid:])

    return _merge(left, right)


def _merge(left, right):
    """Merging two sorted halves takes O(n) — a single linear pass."""
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result
```

**Why it's O(n log n):** The recursion tree has `log n` levels (each level halves the list, like binary search). At every level, the total work across all the merge calls at that level is O(n) (each element is touched once per level by `_merge`). `log n` levels × `O(n)` work per level = O(n log n).

---

## 5. O(n²) — Quadratic Time

Typical of nested loops where the inner loop also scans (a meaningful fraction of) the input.

```python
def has_duplicate_pair(lst):
    """O(n^2): for every element, scan every other element —
    n * n comparisons in the worst case."""
    n = len(lst)
    for i in range(n):
        for j in range(n):
            if i != j and lst[i] == lst[j]:
                return True
    return False


def bubble_sort(lst):
    """O(n^2): classic nested-loop sort — n passes, each doing
    up to n comparisons/swaps."""
    n = len(lst)
    for i in range(n):
        for j in range(0, n - i - 1):
            if lst[j] > lst[j + 1]:
                lst[j], lst[j + 1] = lst[j + 1], lst[j]
    return lst
```

**Why it's O(n²):** The outer loop runs `n` times, and for each outer iteration, the inner loop also runs on the order of `n` times. Total work ≈ `n × n = n²`. This is the classic "nested loop over the same collection" pattern — extremely common (and often accidental) in real code, e.g., checking every pair of items.

---

## 6. O(n³) — Cubic Time

Three nested loops, each scanning (a fraction of) the input.

```python
def count_triplets_with_sum(lst, target):
    """O(n^3): three nested loops checking every triplet —
    n * n * n combinations in the worst case."""
    n = len(lst)
    count = 0
    for i in range(n):
        for j in range(n):
            for k in range(n):
                if lst[i] + lst[j] + lst[k] == target:
                    count += 1
    return count
```

**Why it's O(n³):** Each of the three loops independently ranges over all `n` elements, and they're nested, so the total number of inner-body executions is `n × n × n = n³`. Cubic algorithms are common in naive "check every combination of 3" problems (e.g., 3-sum, brute-force triangle counting) and get slow fast — at `n = 1,000` that's already a billion operations.

---

## 7. O(2ⁿ) — Exponential Time

Typical of naive recursive algorithms that branch into two (or more) recursive calls per level, without caching repeated work.

```python
def fib_naive(n):
    """O(2^n): each call spawns 2 more calls (except base cases),
    and the recursion tree has depth n — roughly 2^n total calls."""
    if n <= 1:
        return n
    return fib_naive(n - 1) + fib_naive(n - 2)


def all_subsets(items):
    """O(2^n): every item is either included or excluded,
    so there are 2^n possible subsets to generate."""
    if not items:
        return [[]]
    first, rest = items[0], items[1:]
    without_first = all_subsets(rest)
    with_first = [[first] + subset for subset in without_first]
    return with_first + without_first
```

**Why it's O(2ⁿ):** In `fib_naive`, every call (except the base cases) makes exactly 2 further recursive calls. This creates a binary recursion tree of depth `n`, and a binary tree of depth `n` has roughly `2ⁿ` nodes. In `all_subsets`, every one of the `n` items independently doubles the number of subsets to consider (include it or don't) — `2 × 2 × ... × 2` (n times) = `2ⁿ`.

---

## 8. O(n!) — Factorial Time

Typical of algorithms that generate **all permutations** (orderings) of the input.

```python
def all_permutations(items):
    """O(n!): there are n! distinct orderings of n items,
    and this generates every single one."""
    if len(items) <= 1:
        return [items]

    perms = []
    for i in range(len(items)):
        remaining = items[:i] + items[i + 1:]
        for p in all_permutations(remaining):
            perms.append([items[i]] + p)
    return perms
```

**Why it's O(n!):** For the first position there are `n` choices, for the second position `n-1` remaining choices, for the third `n-2`, and so on down to 1 — total combinations = `n × (n-1) × (n-2) × ... × 1 = n!`. This is the brute-force "try every ordering" pattern seen in naive solutions to the Traveling Salesman Problem or generating all permutations for a string.

---

## 9. Summary Table

| Complexity | Name | Example | n=10 ops (approx) |
|------------|------|---------|--------------------|
| O(1) | Constant | Array index / dict lookup | 1 |
| O(log n) | Logarithmic | Binary search | ~3 |
| O(n) | Linear | Single loop / linear scan | 10 |
| O(n log n) | Linearithmic | Merge sort, quicksort (avg) | ~33 |
| O(n²) | Quadratic | Nested loop, bubble sort | 100 |
| O(n³) | Cubic | Triple nested loop | 1,000 |
| O(2ⁿ) | Exponential | Naive Fibonacci, subset generation | 1,024 |
| O(n!) | Factorial | All permutations | 3,628,800 |

---

## 10. Hands-On Exercises

**Exercise 1:** Run `fib_naive(30)` and time it with `time.perf_counter()`. Then try `fib_naive(35)`. Notice how disproportionately slower it gets — that's exponential growth in action.

**Exercise 2:** Modify `has_duplicate_pair` to be O(n) instead of O(n²) using a `set` to track seen elements. Explain why the new version is linear.

**Exercise 3:** Write an O(n²) function that returns all pairs `(i, j)` from a list where `i < j`. Then determine: is there any way to make "finding all pairs" faster than O(n²)? Why or why not?

**Exercise 4:** For `all_permutations`, compute how many permutations exist for `n = 5, 8, 10`. At what point does this become impractical to compute?

**Exercise 5:** Classify each of these operations as O(1), O(n), or O(n²): (a) `len(my_list)`, (b) `x in my_list` (list, not set), (c) `x in my_set` (a Python `set`), (d) `my_list.sort()`.

---

## 11. Interview Q&A

**Q: Give an example of an O(n²) algorithm and explain why it's quadratic.**
Answer: Bubble sort — it has two nested loops, each ranging over (up to) `n` elements, so the total number of comparisons is proportional to `n × n = n²`. More generally, any time you have a loop nested inside another loop, both scanning a data structure of size `n`, the result is O(n²).

**Q: Why is `fib_naive(n)` O(2ⁿ) even though it doesn't have any explicit loops?**
Answer: Because each call to `fib_naive(n)` makes two further recursive calls (`fib_naive(n-1)` and `fib_naive(n-2)`), except at the base cases. This creates a binary tree of recursive calls with depth `n`. A binary tree of depth `n` has on the order of `2ⁿ` nodes, and each node corresponds to one function call, so the total number of calls — and thus the total work — grows exponentially with `n`.

**Q: What's the practical difference between O(n log n) and O(n²) for sorting?**
Answer: For small `n` the difference may be negligible, but as `n` grows they diverge dramatically. At `n = 1,000,000`, O(n log n) is roughly 20 million operations, while O(n²) is a trillion operations — the difference between sorting in under a second and sorting that never practically finishes. This is exactly why merge sort/quicksort/heapsort (O(n log n)) replaced bubble/insertion/selection sort (O(n²)) as general-purpose sorting algorithms.

**Q: When would you actually accept an O(2ⁿ) or O(n!) algorithm in production code?**
Answer: Only when `n` is guaranteed to be very small (e.g., generating all permutations of a 6-character password-cracking attempt space, or brute-forcing a config with at most 8 boolean flags). Beyond roughly `n = 20–25` for exponential, or `n = 10–12` for factorial, these algorithms become computationally infeasible even on fast hardware, so production code almost always needs a smarter (polynomial-time) approach or memoization/pruning.

**Q: Is `x in my_list` the same complexity as `x in my_set` in Python?**
Answer: No. `x in my_list` is O(n) because Python must scan the list element by element in the worst case. `x in my_set` (or a dict key check) is O(1) on average because sets/dicts are implemented as hash tables — the membership check computes a hash and jumps directly to the relevant bucket instead of scanning.

**Q: What does it mean for merge sort to be O(n log n) — where does the "log n" come from and where does the "n" come from?**
Answer: The "log n" comes from the number of times the list is recursively split in half until pieces of size 1 remain — a halving process, just like binary search, takes log₂(n) levels. The "n" comes from the fact that at every one of those levels, merging all the sublists back together touches every element exactly once, which is O(n) work per level. Multiplying levels by work-per-level gives O(n log n) total.
