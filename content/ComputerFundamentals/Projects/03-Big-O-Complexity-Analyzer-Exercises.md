# Project 3 — Big-O Complexity Analyzer Exercises

**Level:** Intermediate – Advanced
**Time estimate:** 45 – 60 minutes
**Phase prerequisite:** Phase 10 — Big-O Notation, Phase 11 — Time and Space Complexity Analysis

---

## Overview

This is a self-testing exercise set, not a reference sheet. Each exercise gives you a Python function. Your job — **before scrolling to the answer** — is to determine:

1. Its **time complexity** in Big-O terms
2. Its **space complexity** in Big-O terms
3. A one-sentence justification for both

Then check your reasoning against the provided answer. The exercises get progressively harder, moving from single loops to recursion, memoization, and amortized analysis — exactly the kind of progression a mid-level interview tends to follow.

**Do not skip ahead.** The value of this project is in the attempt, not the answer key.

---

## How to Use This

For each snippet:
- Read the code carefully, including what's being passed in (is `n` the length of the list? the value of an integer?).
- Write down your answer on paper or out loud before reading further.
- Compare against the answer and, critically, compare your *reasoning* — getting the right Big-O for the wrong reason won't hold up under interview follow-up questions.

---

## Exercise 1

```python
def find_max(numbers):
    current_max = numbers[0]
    for num in numbers:
        if num > current_max:
            current_max = num
    return current_max
```

<details>
<summary>Answer</summary>

**Time: O(n). Space: O(1).**

The function makes a single pass over the list, examining each element exactly once — no nested loops, no recursion. Time scales linearly with the length of `numbers`. Space is constant: only `current_max` is allocated regardless of input size, and the input list itself isn't counted as part of the function's *extra* space usage.
</details>

---

## Exercise 2

```python
def has_duplicate(numbers):
    for i in range(len(numbers)):
        for j in range(len(numbers)):
            if i != j and numbers[i] == numbers[j]:
                return True
    return False
```

<details>
<summary>Answer</summary>

**Time: O(n²). Space: O(1).**

Two nested loops, each running the full length of `numbers`, means for every element `i` you re-scan the entire list looking for a match — n × n = n² comparisons in the worst case (no duplicates found). Space stays constant — no additional data structures grow with input size.
</details>

---

## Exercise 3

```python
def binary_search(sorted_list, target):
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

<details>
<summary>Answer</summary>

**Time: O(log n). Space: O(1).**

Each iteration discards half of the remaining search space, so the number of iterations needed to shrink the range down to nothing is log2(n) — the classic halving pattern. Space is constant because only a few index variables (`low`, `high`, `mid`) are tracked; no new data structures are created, and this is the iterative (not recursive) version, so there's no call-stack growth either.
</details>

---

## Exercise 4

```python
def build_pairs(numbers):
    pairs = []
    for a in numbers:
        for b in numbers:
            pairs.append((a, b))
    return pairs
```

<details>
<summary>Answer</summary>

**Time: O(n²). Space: O(n²).**

Time is O(n²) from the nested loop, same reasoning as Exercise 2 — but this time note the *space* also grows quadratically, because the `pairs` list actually stores all n² generated tuples rather than just checking a condition. This exercise is designed to catch the common mistake of assuming a nested loop always implies O(1) space — you have to look at what's being accumulated, not just the loop structure.
</details>

---

## Exercise 5

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
```

<details>
<summary>Answer</summary>

**Time: O(2^n). Space: O(n).**

Each call to `fibonacci(n)` spawns two more recursive calls, and this branching happens down to a depth of `n` — the classic exponential recursion tree, with roughly 2^n total calls in the worst case (it's actually closer to O(1.618^n), the golden ratio, but O(2^n) is the standard upper-bound answer expected in interviews). Space is O(n), *not* O(2^n) — despite the exponential number of calls, only one root-to-leaf path exists on the call stack at any given moment, so the maximum stack depth is n.
</details>

---

## Exercise 6

```python
def fibonacci_memo(n, cache=None):
    if cache is None:
        cache = {}
    if n <= 1:
        return n
    if n in cache:
        return cache[n]
    cache[n] = fibonacci_memo(n - 1, cache) + fibonacci_memo(n - 2, cache)
    return cache[n]
```

<details>
<summary>Answer</summary>

**Time: O(n). Space: O(n).**

Memoization (caching previously computed results in a dictionary) collapses the exponential recursion tree from Exercise 5 into a linear number of *unique* calls — each value of `n` is computed exactly once, and every subsequent request for it is an O(1) dictionary lookup. Space is O(n) for the cache dictionary itself, plus O(n) for the recursion stack depth — both linear, so the overall space is O(n). This exercise demonstrates the single biggest lever in complexity analysis: trading space for time.
</details>

---

## Exercise 7

```python
def concat_strings(words):
    result = ""
    for word in words:
        result += word
    return result
```

<details>
<summary>Answer</summary>

**Time: O(n²). Space: O(n).**

This is a common interview "gotcha." Python strings are immutable, so `result += word` doesn't append in place — it creates a *brand new* string object every iteration, copying all of `result`'s existing characters plus the new word. If the total length of all words combined is n, the total work across all iterations is 1 + 2 + 3 + ... + n = O(n²), not O(n). Space is O(n) for the final string (each intermediate string is garbage collected after the next concatenation, so peak space, not cumulative, is what's counted). The fix is `"".join(words)`, which is O(n) because Python's `join` pre-calculates the total length and allocates the result buffer once.
</details>

---

## Exercise 8

```python
def append_n_items(n):
    result = []
    for i in range(n):
        result.append(i)
    return result
```

<details>
<summary>Answer</summary>

**Time: O(n) amortized. Space: O(n).**

This looks similar to Exercise 7 but behaves completely differently because Python lists (unlike strings) are *mutable* and use dynamic array resizing. Most `append` calls are O(1) — they just write into pre-allocated extra capacity. Occasionally, when capacity is exhausted, Python allocates a larger underlying array (growing geometrically, not by a fixed amount) and copies existing elements over — an O(n) operation, but one that happens exponentially less often as n grows. Averaged (amortized) across all n appends, the total cost is O(n), i.e., O(1) per operation — this is the canonical example of amortized analysis from Phase 11. Space is O(n) for the final list.
</details>

---

## Exercise 9

```python
def matrix_multiply(a, b, n):
    result = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            for k in range(n):
                result[i][j] += a[i][k] * b[k][j]
    return result
```

<details>
<summary>Answer</summary>

**Time: O(n³). Space: O(n²).**

Three nested loops, each iterating n times independently, multiply together: n × n × n = n³ — the standard "naive" matrix multiplication complexity (faster algorithms like Strassen's exist at roughly O(n^2.807), but they're well outside interview scope unless specifically asked). Space is O(n²) for the `result` matrix, which has n rows of n elements each — the temporary loop variables (`i`, `j`, `k`) are O(1) and don't change this.
</details>

---

## Exercise 10

```python
def find_pair_with_sum(numbers, target):
    seen = set()
    for num in numbers:
        complement = target - num
        if complement in seen:
            return (complement, num)
        seen.add(num)
    return None
```

<details>
<summary>Answer</summary>

**Time: O(n). Space: O(n).**

This is the classic "two-sum" pattern, and it's the answer to "how do you avoid the O(n²) nested-loop version" (checking every pair directly, like Exercise 2's structure, would be O(n²)). By trading space for time — maintaining a `seen` set as you go — each element requires only a single O(1) average-case set lookup and a single O(1) average-case insertion, for O(n) total across the whole pass. Space is O(n) because, in the worst case (no pair found until the very end, or none at all), `seen` grows to hold every element in `numbers`. This exercise reinforces the same space-for-time trade-off as Exercise 6's memoization, applied to a different problem shape.
</details>

---

## Self-Check Summary Table

Once you've worked through all ten, use this table to confirm your answers at a glance:

| # | Function | Time | Space | Key Concept |
|---|----------|------|-------|-------------|
| 1 | `find_max` | O(n) | O(1) | Single pass |
| 2 | `has_duplicate` | O(n²) | O(1) | Nested loop, no extra storage |
| 3 | `binary_search` | O(log n) | O(1) | Halving search space |
| 4 | `build_pairs` | O(n²) | O(n²) | Nested loop *with* accumulation |
| 5 | `fibonacci` (naive) | O(2^n) | O(n) | Exponential branching, linear stack depth |
| 6 | `fibonacci_memo` | O(n) | O(n) | Memoization collapses recursion tree |
| 7 | `concat_strings` (`+=`) | O(n²) | O(n) | Immutable string reallocation |
| 8 | `append_n_items` | O(n) amortized | O(n) | Dynamic array geometric growth |
| 9 | `matrix_multiply` | O(n³) | O(n²) | Triple nested loop |
| 10 | `find_pair_with_sum` | O(n) | O(n) | Hash set space-for-time trade-off |

---

## Stretch Goals

1. Rewrite Exercise 7 using `"".join(words)` and use `time.perf_counter()` to benchmark both versions against a list of 50,000 short strings — observe the real-world gap between O(n) and O(n²).
2. Rewrite Exercise 5 (naive Fibonacci) using Python's `functools.lru_cache` decorator instead of a manual cache dictionary, and confirm it produces the same O(n) time complexity as Exercise 6.
3. Write your own Exercise 11: a snippet whose time complexity is O(n log n) (hint: think about what a call to `sorted()` inside a loop does to the overall complexity).
4. For Exercise 9, look up Strassen's algorithm and explain in one paragraph why its better asymptotic complexity doesn't always mean it's faster in practice for typical matrix sizes.
