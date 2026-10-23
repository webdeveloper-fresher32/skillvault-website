# Analyzing Code for Big-O — Complete Guide

## Table of Contents
1. [The General Method](#1-the-general-method)
2. [Walkthrough: Single Loop](#2-walkthrough-single-loop)
3. [Walkthrough: Loop with an Early Break](#3-walkthrough-loop-with-an-early-break)
4. [Walkthrough: Nested Loops (Dependent Ranges)](#4-walkthrough-nested-loops-dependent-ranges)
5. [Walkthrough: Sequential (Non-Nested) Loops](#5-walkthrough-sequential-non-nested-loops)
6. [Walkthrough: Recursive Function](#6-walkthrough-recursive-function)
7. [Walkthrough: Recursion with Branching](#7-walkthrough-recursion-with-branching)
8. [Common Mistakes](#8-common-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The General Method

When analyzing any piece of code for Big-O, follow this process:

1. **Identify the input(s) and what `n` represents** (usually the length of a list, or a numeric value itself).
2. **Find the loops/recursive calls** and determine how many times each one runs *in the worst case*.
3. **Multiply** the complexities of nested structures; **add** the complexities of sequential (back-to-back) structures.
4. **Keep only the dominant term** and drop constants (per lesson 01).
5. **Sanity-check against worst case** — don't be fooled by a "lucky" input that finishes early.

---

## 2. Walkthrough: Single Loop

```python
def sum_all(lst):
    total = 0
    for x in lst:          # runs n times, where n = len(lst)
        total += x          # O(1) work per iteration
    return total
```

**Step-by-step:**
- `n = len(lst)`.
- The loop body (`total += x`) is O(1) and runs once per element.
- Total = `n × O(1) = O(n)`.

**Result: O(n).**

---

## 3. Walkthrough: Loop with an Early Break

```python
def contains_negative(lst):
    for x in lst:
        if x < 0:
            return True     # exits early if a negative is found
    return False
```

**Step-by-step:**
- Best case: the very first element is negative → loop runs once → O(1).
- Worst case: there is no negative number anywhere in the list (or the negative is the very last element) → the loop runs all `n` times before returning `False` (or finding it at the end).
- Since Big-O conventionally reports **worst case**, the early `break`/`return` does not change the complexity classification.

**Result: O(n)** — *not* O(1), despite the early exit, because the worst case still scans everything.

---

## 4. Walkthrough: Nested Loops (Dependent Ranges)

```python
def count_pairs(lst):
    n = len(lst)
    count = 0
    for i in range(n):
        for j in range(i + 1, n):   # inner loop range shrinks as i grows
            count += 1
    return count
```

**Step-by-step:**
- The outer loop runs `n` times (`i` from 0 to n-1).
- The inner loop's range depends on `i`: it runs `n - i - 1` times.
- Total iterations = `(n-1) + (n-2) + ... + 1 + 0 = n(n-1)/2`.
- Expand: `n(n-1)/2 = (n² - n) / 2`. The dominant term is `n²`; drop the `-n` and the `/2` constant.

**Result: O(n²).** Even though the inner loop shrinks each time (it's not a full `n × n` in a naive sense), the *sum* of a shrinking triangular pattern is still proportional to `n²` — this is a classic case where the complexity isn't obvious just from "the inner loop doesn't always run n times."

---

## 5. Walkthrough: Sequential (Non-Nested) Loops

```python
def process(lst):
    n = len(lst)

    total = 0
    for x in lst:            # O(n)
        total += x

    doubled = []
    for x in lst:            # O(n) — separate, NOT nested inside the first
        doubled.append(x * 2)

    return total, doubled
```

**Step-by-step:**
- These two loops are **sequential**, not nested — the second loop starts only after the first finishes.
- Sequential complexities **add**, not multiply: `O(n) + O(n) = O(2n)`.
- Drop the constant: `O(2n) → O(n)`.

**Result: O(n).** A common mistake is to see "two loops over the same list" and assume O(n²) — that's only true if one loop is *nested inside* the other, not when they run one after another.

---

## 6. Walkthrough: Recursive Function

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

**Step-by-step:**
- Each call does O(1) work (one multiplication) and makes exactly **one** recursive call, with `n` shrinking by 1 each time.
- The recursion depth is `n` (calls: `factorial(n) → factorial(n-1) → ... → factorial(1)`).
- Total work = `n calls × O(1) per call = O(n)`.

**Result: O(n) time.** (Space is also O(n) due to the call stack — covered in Phase 11.)

---

## 7. Walkthrough: Recursion with Branching

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)   # TWO recursive calls per invocation
```

**Step-by-step:**
- Unlike `factorial`, this makes **two** recursive calls per invocation (except base cases).
- Draw the recursion tree: `fib(n)` branches into `fib(n-1)` and `fib(n-2)`, each of which branches again, and so on, down to depth `n`.
- A binary tree of depth `n` has roughly `2ⁿ` total nodes/calls.

**Result: O(2ⁿ).** The mistake here would be applying the same reasoning as `factorial` ("it recurses n times, so O(n)") — but counting *depth* is not the same as counting *total calls* when there's branching. You must count every node in the recursion tree, not just the longest path through it.

---

## 8. Common Mistakes

### Mistake 1: "It has a `break`, so it must be O(1) or fast."
As shown in section 3, Big-O is a **worst-case** measure. A `break` only helps if you can prove the loop *always* exits early for every possible input — otherwise the worst case (nothing found, or found at the very end) still dominates.

### Mistake 2: "Two loops over the same list = O(n²)."
Only true if one loop is **nested inside** the other. Two *sequential* loops (one after the other) add up to O(n) + O(n) = O(n), not O(n) × O(n). Always check indentation/nesting, not just "how many loops are in the function."

### Mistake 3: "Recursion depth = total time complexity."
As shown in section 7, a recursive function that branches into multiple recursive calls per invocation does much more total work than its depth suggests. Depth tells you about **space** (stack frames), not necessarily **time** — for time, you need to count every call in the recursion tree.

### Mistake 4: Ignoring what happens *inside* the loop body.
```python
def bad_analysis_example(lst):
    for x in lst:              # runs n times
        if x in lst:           # `in` on a list is itself O(n)!
            print(x)
```
A quick glance might say "one loop → O(n)." But `x in lst` on a **list** is itself an O(n) scan, executed `n` times → O(n²) overall. Always check whether operations *inside* a loop (membership tests, slicing, string concatenation, sorting) carry their own hidden cost.

### Mistake 5: Confusing "loop runs fewer than n times" with O(1) or a lower complexity class.
As in section 4, a shrinking inner loop (`n-1`, then `n-2`, then `n-3`, ...) still sums to O(n²) overall — it "feels" less than a full n×n loop, but the growth rate is identical once you drop constants.

---

## 9. Hands-On Exercises

**Exercise 1:** Determine the Big-O of this function and explain your reasoning step by step:
```python
def mystery_a(lst):
    n = len(lst)
    for i in range(n):
        for j in range(n):
            for k in range(n):
                pass
```

**Exercise 2:** Determine the Big-O of this function. Watch for the hidden cost inside the loop:
```python
def mystery_b(lst):
    result = []
    for x in lst:
        if x not in result:
            result.append(x)
    return result
```

**Exercise 3:** This function has an early `return`. State its Big-O and justify using worst-case reasoning:
```python
def find_first_match(lst, predicate):
    for x in lst:
        if predicate(x):
            return x
    return None
```

**Exercise 4:** Draw (on paper or in a comment) the recursion tree for `fib(4)` from section 7. Count the total number of calls made and compare it to `2⁴ = 16`.

**Exercise 5:** Rewrite `mystery_b` from Exercise 2 so it runs in O(n) instead, and explain what changed.

---

## 10. Interview Q&A

**Q: If a loop has a `break` statement, does that automatically make it faster than O(n) in Big-O terms?**
Answer: No. Big-O describes worst-case behavior by convention. Unless you can prove the break condition is guaranteed to trigger early for every possible input, the worst case (the condition never triggers, or triggers only at the last element) still requires scanning up to `n` elements, so the complexity remains O(n).

**Q: Are two separate, non-nested loops over the same input O(n) or O(n²)?**
Answer: O(n). Sequential (back-to-back) operations have their complexities added, not multiplied: O(n) + O(n) simplifies to O(2n), which drops to O(n) after removing the constant. O(n²) would only apply if one loop were nested inside the other.

**Q: How do you determine the time complexity of a recursive function that makes multiple recursive calls per invocation, like naive Fibonacci?**
Answer: You can't just look at the recursion depth — you need to count the total number of calls in the entire recursion tree. For a function like `fib(n) = fib(n-1) + fib(n-2)`, each call branches into two more, forming a binary tree of depth `n` with roughly `2ⁿ` total nodes/calls, giving O(2ⁿ) time — even though the depth (and thus stack space) is only O(n).

**Q: What's a common way that a seemingly O(n) loop is actually O(n²)?**
Answer: When the loop body contains an operation that is itself O(n), such as `x in a_list` (linear scan), `list.insert(0, x)` (shifting elements), or naive string concatenation inside a loop. Running an O(n) operation `n` times gives O(n²) overall, even though there's only one visible `for` loop in the code.

**Q: For nested loops where the inner loop's range depends on the outer loop's counter (like `for j in range(i, n)`), how do you determine the overall complexity?**
Answer: Sum the number of inner-loop iterations across all outer-loop iterations. This typically forms an arithmetic series like `n + (n-1) + (n-2) + ... + 1`, which equals `n(n+1)/2`. Since this simplifies to a dominant term of `n²` (after dropping the constant and lower-order term), the overall complexity is still O(n²), even though the inner loop doesn't always run the full `n` times.

**Q: Why is it important to think about worst-case input, not just "typical" input, when analyzing Big-O?**
Answer: Because production systems need reliability guarantees, and typical/average inputs can vary wildly and aren't always predictable or adversarial-resistant. Worst-case analysis gives a guarantee that performance will never exceed a certain bound regardless of input, which is essential for capacity planning, SLAs, and avoiding surprise slowdowns when real-world data doesn't match test data.
