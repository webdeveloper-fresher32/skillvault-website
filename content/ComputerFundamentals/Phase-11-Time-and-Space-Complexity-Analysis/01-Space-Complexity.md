# Space Complexity — Complete Guide

## Table of Contents
1. [What Space Complexity Measures](#1-what-space-complexity-measures)
2. [Input Space vs Auxiliary Space vs Total Space](#2-input-space-vs-auxiliary-space-vs-total-space)
3. [Example: In-Place vs New-Array-Returning](#3-example-in-place-vs-new-array-returning)
4. [Recursive Call Stack Space](#4-recursive-call-stack-space)
5. [Common Space Complexity Classes](#5-common-space-complexity-classes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What Space Complexity Measures

Space complexity describes how much **memory** an algorithm needs, as a function of input size `n` — using the exact same Big-O notation as time complexity. Just as O(n) time means "work scales linearly with input," O(n) space means "the memory used scales linearly with input."

```
┌───────────────────────────────────────────────────────────┐
│ Time complexity:  how does RUNTIME grow with n?           │
│ Space complexity: how does MEMORY USE grow with n?        │
│                                                            │
│ Both are expressed with the same notation: O(1), O(n), etc│
└───────────────────────────────────────────────────────────┘
```

Interviewers ask about space complexity because memory is a real, finite resource — an algorithm that's fast but needs gigabytes of RAM per request won't survive in production any more than one that's slow.

---

## 2. Input Space vs Auxiliary Space vs Total Space

This distinction trips people up constantly, so it's worth being precise:

| Term | Definition |
|------|-----------|
| **Input space** | Memory taken up by the input itself (e.g., the list you were given). |
| **Auxiliary space** | *Extra* memory the algorithm allocates beyond the input — new lists, hash maps, recursion stack frames. |
| **Total space** | Input space + auxiliary space. |

**When interviewers ask "what's the space complexity?", they almost always mean auxiliary space** — how much *additional* memory your algorithm needs, not counting the input you were handed (since you didn't choose to allocate that). This is why an "in-place" sorting algorithm is described as O(1) space, even though the array itself obviously takes up O(n) memory — that O(n) is input space, not auxiliary space.

---

## 3. Example: In-Place vs New-Array-Returning

```python
def double_in_place(lst):
    """O(1) auxiliary space: modifies the existing list, allocates
    no new data structure that scales with n."""
    for i in range(len(lst)):
        lst[i] *= 2
    return lst


def double_new_list(lst):
    """O(n) auxiliary space: builds a brand-new list of the same
    size as the input, which is extra memory beyond the input."""
    result = []
    for x in lst:
        result.append(x * 2)
    return result
```

**Why `double_in_place` is O(1) auxiliary space:** It only uses a fixed number of extra variables (`i`), regardless of how large `lst` is. The list itself is mutated in place — no new n-sized structure is created.

**Why `double_new_list` is O(n) auxiliary space:** `result` grows to hold `n` elements — a brand new list proportional in size to the input. Even though the *time* complexity of both functions is O(n) (each does one pass over the list), their *space* complexity differs: O(1) vs O(n).

This is the classic tradeoff interviewers probe with "can you do this without allocating a new array?" — it's testing whether you understand this exact distinction.

```python
def reverse_in_place(lst):
    """O(1) auxiliary space: swaps elements within the existing list."""
    left, right = 0, len(lst) - 1
    while left < right:
        lst[left], lst[right] = lst[right], lst[left]
        left += 1
        right -= 1
    return lst


def reverse_new_list(lst):
    """O(n) auxiliary space: creates a full new list."""
    return lst[::-1]
```

Both reverse correctly and both run in O(n) time, but `reverse_in_place` needs only O(1) extra memory, while `reverse_new_list` needs O(n) extra memory for the new sliced list.

---

## 4. Recursive Call Stack Space

Every function call — recursive or not — pushes a **stack frame** onto the call stack, holding local variables and the return address. This frame stays in memory until the function returns. For recursive functions, this means **recursion depth directly translates into auxiliary space**.

```python
def sum_recursive(lst, index=0):
    """Time: O(n) — one call per element.
    Space: O(n) — auxiliary space, because there are n stack frames
    alive simultaneously at the deepest point of recursion."""
    if index == len(lst):
        return 0
    return lst[index] + sum_recursive(lst, index + 1)
```

```
Call stack at the deepest point (lst = [1, 2, 3, 4]):

  sum_recursive(lst, 4)   ← base case, returns 0
  sum_recursive(lst, 3)   ← waiting on the call above
  sum_recursive(lst, 2)   ← waiting on the call above
  sum_recursive(lst, 1)   ← waiting on the call above
  sum_recursive(lst, 0)   ← waiting on the call above (bottom of stack)

  4 frames alive at once = O(n) auxiliary space (n = len(lst))
```

Compare this to the iterative version:

```python
def sum_iterative(lst):
    """Time: O(n). Space: O(1) auxiliary — only a
    constant number of variables regardless of list size."""
    total = 0
    for x in lst:
        total += x
    return total
```

`sum_iterative` never has more than one stack frame and a couple of variables (`total`, loop variable) alive at once — O(1) auxiliary space — while `sum_recursive` needs a new stack frame for every element, giving O(n) auxiliary space. This is precisely why deep recursion in Python raises `RecursionError` (default recursion limit ~1000) while an equivalent loop handles millions of elements without issue.

**Rule of thumb:** the space complexity contributed by recursion is O(maximum recursion depth), not O(number of calls). A function that recurses to depth `n` but happens to make multiple calls per level (like naive Fibonacci) still only needs O(n) stack space at any given moment — the exponential blowup in *time* complexity doesn't translate to exponential *space*, because completed branches pop off the stack before siblings run. Fibonacci's recursion tree is deep only to `n`, so its stack space is O(n) even though its time is O(2ⁿ).

---

## 5. Common Space Complexity Classes

| Space complexity | Meaning | Example |
|-------------------|---------|---------|
| O(1) | Fixed number of variables, no growth with n | In-place swap, iterative sum |
| O(log n) | Extra space grows logarithmically | Recursive binary search (recursion depth ~log n) |
| O(n) | Extra space grows linearly | New list of size n, recursion depth n |
| O(n²) | Extra space grows quadratically | 2D matrix of size n×n, e.g., dynamic programming grid |

---

## 6. Hands-On Exercises

**Exercise 1:** Classify the auxiliary space complexity of a function that takes a string and returns a new string with all characters uppercased using `s.upper()`.

**Exercise 2:** Rewrite `sum_recursive` from section 4 as a tail-recursive-style function that passes an accumulator (`sum_recursive(lst, index, accumulator)`). Does this change its space complexity? Why or why not (consider that Python doesn't optimize tail calls).

**Exercise 3:** Write a function that removes duplicates from a list (a) using a new list and a `set`, and (b) in-place by sorting first and overwriting. State the time and space complexity of each.

**Exercise 4:** For a recursive binary search implementation, explain why its auxiliary space is O(log n) rather than O(n) (compare to the iterative `while`-loop version from Phase 10).

**Exercise 5:** A function builds a 2D grid of size `n × n` to solve a dynamic programming problem. What is its space complexity, and can you think of a way to reduce it to O(n) if only the previous row is ever needed?

---

## 7. Interview Q&A

**Q: What's the difference between auxiliary space and total space complexity?**
Answer: Total space includes the memory taken by the input itself plus any extra memory the algorithm allocates. Auxiliary space refers only to the extra memory used beyond the input — new data structures, recursion stack frames, etc. When someone asks "what's the space complexity of this algorithm?" in an interview, they almost always mean auxiliary space, since the input's memory footprint isn't something the algorithm controls.

**Q: Why is an in-place sort like quicksort often described as O(1) or O(log n) space, when it obviously operates on an O(n)-sized array?**
Answer: Because that O(n) is input space, not auxiliary space — the array already existed before the algorithm ran. "In-place" specifically means the algorithm doesn't allocate additional data structures proportional to n; it only uses a constant number of extra variables (or, for quicksort, O(log n) auxiliary space for the recursive call stack in the average case).

**Q: How does recursion affect space complexity?**
Answer: Every recursive call adds a stack frame that stays in memory until that call returns, so the auxiliary space contributed by recursion is proportional to the maximum recursion depth at any point in time — not the total number of calls made. A function recursing to depth n needs O(n) stack space, regardless of whether it makes one or many recursive calls per level.

**Q: If I convert a recursive function to an iterative one, does that always reduce space complexity?**
Answer: Often, but not always. Converting recursion to iteration typically eliminates the O(depth) call-stack space, reducing it to O(1) if no other data structure is needed — as with `sum_recursive` → `sum_iterative`. However, if the iterative version needs an explicit stack or queue to replicate the recursive traversal order (e.g., iterative tree traversal), that data structure can still cost O(n) space, so the savings aren't automatic.

**Q: What is the space complexity of a function that returns a brand-new list transformed from the input, versus one that mutates the input in place?**
Answer: The new-list version is O(n) auxiliary space, since it allocates a fresh structure that scales with input size. The in-place version is O(1) auxiliary space, since it reuses the existing input's memory and only needs a constant number of extra variables (like loop indices or a temp swap variable).
