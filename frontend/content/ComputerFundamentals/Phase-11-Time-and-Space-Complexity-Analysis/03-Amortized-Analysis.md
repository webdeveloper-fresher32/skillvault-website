# Amortized Analysis — Complete Guide

## Table of Contents
1. [What Amortized Analysis Answers](#1-what-amortized-analysis-answers)
2. [The Classic Example: Python List Append](#2-the-classic-example-python-list-append)
3. [Why Resizing Happens](#3-why-resizing-happens)
4. [The Doubling Strategy — Worked Math](#4-the-doubling-strategy--worked-math)
5. [Demonstrating It in Python](#5-demonstrating-it-in-python)
6. [Amortized vs Worst-Case vs Average-Case](#6-amortized-vs-worst-case-vs-average-case)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What Amortized Analysis Answers

Some operations are usually cheap but **occasionally expensive**. If you looked only at the worst single operation, you might conclude the whole operation is slow — but that would be misleading if the expensive case is rare enough that its cost gets "spread out" over many cheap operations.

**Amortized analysis** answers: *"What is the average cost per operation, over a long sequence of operations, even though some individual operations are much more expensive than others?"*

```
┌────────────────────────────────────────────────────────────┐
│ Worst-case analysis:    "What's the cost of the SINGLE     │
│                          worst operation?"                 │
│                                                              │
│ Amortized analysis:     "What's the AVERAGE cost per       │
│                          operation, across a whole          │
│                          sequence, accounting for how       │
│                          rarely the expensive case occurs?" │
└────────────────────────────────────────────────────────────┘
```

This is not the same as "average case" (which is about probability over random inputs). Amortized analysis makes no assumption about randomness — it's a guarantee that holds for *any* sequence of operations, because it mathematically proves the expensive operations are infrequent enough to not matter in the long run.

---

## 2. The Classic Example: Python List Append

`list.append(x)` in Python is described as **O(1) amortized**, even though, occasionally, a single call to `append` triggers a full resize that is O(n). Here's the apparent contradiction:

```python
lst = []
for i in range(1_000_000):
    lst.append(i)   # each call is described as O(1)... but sometimes
                     # Python has to allocate a bigger array and copy
                     # every existing element into it — that's O(n)!
```

**How can both be true?** Python's list is backed by a dynamically-sized array. Most `append` calls just place the new item in an already-allocated empty slot at the end — genuinely O(1). But when the underlying array is full, Python must:

1. Allocate a new, **larger** array (typically ~1.125x to 2x the old size, depending on Python version).
2. Copy every existing element from the old array into the new one — O(n).
3. Then place the new item — O(1).

So a small number of `append` calls are expensive (O(n)), while the vast majority are cheap (O(1)). Amortized analysis proves that when you average the *total* cost of `n` appends across all `n` calls, the average per-call cost is still O(1) — hence "O(1) amortized."

---

## 3. Why Resizing Happens

An array (contiguous block of memory) has a **fixed capacity** once allocated — you cannot simply "extend" it in place if the neighboring memory is already used by something else. So when a list's backing array is full and you try to add one more item, the interpreter has no choice but to:

- Find a new, bigger block of memory.
- Copy everything over.
- Free the old block.

The key design decision that makes `append` amortized O(1) is that Python **doesn't grow the array by a fixed amount each time (e.g., +1 slot)** — that would make every single append trigger a resize, giving O(n) *per* append, or O(n²) total for n appends. Instead, Python grows the array **multiplicatively** (roughly doubling), which is what makes the math work out favorably.

---

## 4. The Doubling Strategy — Worked Math

Imagine a simplified version where the array capacity exactly **doubles** every time it fills up (starting at capacity 1). Let's track the cost of appending `n = 16` items:

```
Append #   Action                          Cost (copies made)
1          capacity 0→1, append            0 copies (first item)
2          capacity 1→2, copy 1, append    1 copy
3          capacity 2→4, copy 2, append    2 copies
4          (fits in capacity 4)            0 copies
5          capacity 4→8, copy 4, append    4 copies
6,7,8      (fit in capacity 8)             0 copies each
9          capacity 8→16, copy 8, append   8 copies
10..16     (fit in capacity 16)            0 copies each

Total copies made across 16 appends: 1 + 2 + 4 + 8 = 15
Total appends: 16
```

Notice the pattern: the total number of copy operations is `1 + 2 + 4 + 8 + ... + n/2`, which is a geometric series that sums to **less than `2n`** (specifically, `n - 1` for powers of 2). Even though a handful of individual appends cost O(n) each, the **total** cost across all `n` appends is bounded by O(2n) = O(n).

```
Total cost of n appends = O(n)  (not O(n²))
Amortized cost per append = Total cost / n = O(n) / n = O(1)
```

That's the entire proof: because the array capacity grows **geometrically** (multiplying, not adding a constant), the expensive resize operations become exponentially rarer as `n` grows, and their total cost across the whole sequence never exceeds a constant multiple of `n`. Dividing that total by `n` operations gives a constant — O(1) amortized per operation.

**This is why the growth factor matters.** If Python instead grew the array by a fixed +1 each time (linear growth), you'd resize on *every single append*, copying on average `n/2` elements each time — total cost `O(1 + 2 + 3 + ... + n) = O(n²)`, giving O(n) amortized per append instead of O(1). The doubling (geometric) strategy is what makes the difference.

---

## 5. Demonstrating It in Python

```python
import sys
import time

lst = []
prev_capacity = sys.getsizeof(lst)
print(f"{'count':>8} {'size (bytes)':>15} {'resized?':>10}")

for i in range(20):
    lst.append(i)
    current_capacity = sys.getsizeof(lst)
    resized = "YES" if current_capacity != prev_capacity else ""
    print(f"{i + 1:>8} {current_capacity:>15} {resized:>10}")
    prev_capacity = current_capacity
```

Running this prints something like (exact byte sizes vary by Python version, but the *pattern* — resizes happening less and less often — is consistent):

```
   count    size (bytes)   resized?
       1              88        YES
       2             120        YES
       3             120
       4             152        YES
       5             184        YES
       6             216        YES
       7             248        YES
       8             248
       9             304        YES
      10             304
      ...
```

You can see resizes happen frequently at first (small list) and become progressively rarer as the list grows — exactly the geometric-growth pattern from section 4. This is also directly measurable with timing:

```python
import time

def time_n_appends(n):
    lst = []
    start = time.perf_counter()
    for i in range(n):
        lst.append(i)
    elapsed = time.perf_counter() - start
    return elapsed, elapsed / n  # total time, time per append


for n in (100_000, 1_000_000, 10_000_000):
    total, per_op = time_n_appends(n)
    print(f"n={n:>10}: total={total:.4f}s, per-append={per_op * 1e9:.1f}ns")
```

The "per-append" time stays roughly flat (not growing with `n`) across these runs — direct empirical evidence of O(1) amortized behavior, despite the underlying resizing.

---

## 6. Amortized vs Worst-Case vs Average-Case

| Term | What it measures |
|------|-------------------|
| **Worst-case** | The cost of the single most expensive operation, full stop. For one `append` call that happens to trigger a resize, that's O(n). |
| **Average-case** | The expected cost assuming some probability distribution over inputs. Requires assumptions about randomness. |
| **Amortized** | The average cost per operation over a worst-case *sequence* of operations, with a mathematical guarantee — no randomness assumed. |

It's entirely correct to say all three of these about `list.append`:
- Worst-case cost of a *single* append: **O(n)** (on the rare occasion it triggers a resize).
- Amortized cost per append, over any sequence of n appends: **O(1)**.

Both statements are true simultaneously — they're answering different questions. Interviewers who ask "what's the complexity of append?" are almost always looking for "O(1) amortized," but a strong answer acknowledges the O(n) worst-case for that rare resizing call too.

---

## 7. Hands-On Exercises

**Exercise 1:** Run the `sys.getsizeof` demonstration from section 5 with more iterations (e.g., 200) and note where resizes occur. Are the gaps between resizes growing?

**Exercise 2:** Using the doubling-math approach from section 4, calculate the total number of copy operations for `n = 32` appends starting from capacity 1, and confirm the total is less than `2n`.

**Exercise 3:** Implement a simplified `DynamicArray` class in Python (using a fixed-size list as the backing array) that manually doubles its capacity and copies elements when full. Add a counter for total "copy operations" performed and verify empirically that total copies stay under `2n` for `n` appends.

**Exercise 4:** Explain why `list.insert(0, x)` (inserting at the front) is O(n) — not O(1) amortized — even though `append` (inserting at the end) is O(1) amortized.

**Exercise 5:** Run the timing code from section 5 for `n = 1,000,000` and `n = 10,000,000`. Confirm that the per-append time (`elapsed / n`) stays roughly constant rather than growing — the empirical signature of amortized O(1).

---

## 8. Interview Q&A

**Q: What does "amortized O(1)" mean for Python's list `append`?**
Answer: It means that while any single `append` call can occasionally cost O(n) (when it triggers a resize of the underlying array), the total cost of performing n append operations in sequence is O(n), not O(n²). Dividing that total cost by the number of operations gives an average — "amortized" — cost of O(1) per append, even though not every individual call is O(1).

**Q: Why does doubling the array's capacity (instead of growing it by a fixed amount) make `append` amortized O(1)?**
Answer: With doubling, resizes become exponentially rarer as the list grows — you resize at sizes 1, 2, 4, 8, 16, and so on, so the total number of elements copied across all resizes up to size n is bounded by roughly 2n (a geometric series). If instead you grew by a fixed increment (e.g., +1 each time), you'd resize on every single append, copying on average n/2 elements each time, giving a total cost of O(n²) and an amortized cost of O(n) per append — much worse.

**Q: Is amortized analysis the same as average-case analysis?**
Answer: No. Average-case analysis assumes some probability distribution over possible inputs and computes an expected cost. Amortized analysis makes no assumption about randomness at all — it's a mathematical guarantee about the total cost of any sequence of operations, worst-case sequence included. Amortized O(1) for append holds no matter what values you append or in what order; it only depends on the number of operations.

**Q: Give another real-world example of amortized analysis besides dynamic array resizing.**
Answer: Hash table resizing follows the same pattern — as more keys are inserted, the table occasionally needs to be resized and all existing keys rehashed into a bigger table, an O(n) operation, but this happens rarely enough (with geometric growth) that insertion is still O(1) amortized. Another example: a "banker's queue" implemented with two stacks, where occasionally reversing one stack into another is O(n), but amortized over many enqueue/dequeue operations the cost per operation is O(1).

**Q: If I need a strict, non-amortized real-time guarantee (e.g., in a hard real-time system), is Python's list `append` still a good choice?**
Answer: Not necessarily — amortized O(1) guarantees good average throughput over many calls, but any individual call could still spike to O(n) when a resize is triggered, which could be a problem if you need every single operation to complete within a strict, predictable time bound. In such systems, a pre-allocated fixed-capacity array (avoiding any resize) is safer, since it guarantees true worst-case O(1) for every append rather than just an amortized bound.

**Q: Is it accurate to say `list.append` is "always O(1)"?**
Answer: It's accurate to say it's O(1) amortized, but not strictly accurate to say every single call is O(1) — occasionally an individual call is O(n) due to resizing. A precise answer distinguishes between the worst-case cost of one operation (O(n), rare) and the amortized cost per operation across a sequence (O(1)), since both are true and interviewers often want to see you can articulate that distinction.
