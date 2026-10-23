# Sliding Window

## 1. Problem

Suppose you're asked: "what's the longest stretch of text with no repeated character?" or "what's the maximum sum of any 5 consecutive numbers in this array?" The brute-force instinct is to check every possible sub-range — every start, every end — recomputing the answer from scratch each time. That's O(n²) or worse, and it wastes an enormous amount of repeated work, because most of the data in one sub-range overlaps with the data in the next.

The sliding window technique fixes this by recognizing that as you move from one sub-range to the next (say, shifting the range one position to the right), *almost all* of the data stays the same — only one element leaves and one element enters. Instead of recomputing everything, you update your running answer incrementally. This turns a huge class of "contiguous subarray/substring" problems from O(n²) into O(n).

## 2. Analogy

Imagine looking at a long parade through a camera viewfinder that can only show a limited-width frame at a time. You're asked to find the widest frame where every person in it is wearing a unique color.

- If the frame's width never changes, you're doing a **fixed-size window**: you slide the viewfinder one step at a time, and at each step you drop whoever is now behind the left edge and pick up whoever just entered the right edge.
- If the frame can grow or shrink, you're doing a **variable-size window**: you keep expanding the frame to the right for as long as the "everyone unique" rule holds. The moment someone duplicate enters, you shrink from the left — dropping people one at a time — until the rule holds again, then keep expanding.

In both cases, you never re-scan people who are still inside the frame; you only ever look at the person entering (right edge) and the person leaving (left edge).

## 3. Internal Flow

**Fixed-size window** (e.g. "maximum sum of any k consecutive elements"):

1. Compute the sum of the first `k` elements — this is your initial window.
2. Slide the window one position at a time: subtract the element leaving on the left, add the element entering on the right.
3. Track the best value seen across all window positions.
4. Stop when the right edge reaches the end of the array.

**Variable-size window** (e.g. "longest substring without repeating characters"):

1. Maintain a `left` and `right` boundary, both starting at 0, and some structure (a set or dict) representing what's currently *inside* the window.
2. Expand the window by moving `right` forward one step at a time, adding the new element to the tracking structure.
3. Check the window's **invariant** (the rule the window must satisfy — e.g. "no duplicate characters"). If the invariant is violated, shrink the window from the left — removing elements from the tracking structure and advancing `left` — until the invariant holds again.
4. After each expansion (and any resulting shrink), update the best answer using the current window's size (`right - left + 1`).
5. Stop when `right` reaches the end of the input.

The key discipline in both variants: never restart the scan from the beginning. The window's state is updated *incrementally* — one element added, zero or more elements removed — never recomputed from scratch.

## 4. Example

Longest substring without repeating characters, using a variable-size window with a set tracking the window's current contents:

```python
def longest_unique_substring(s):
    window = set()
    left = 0
    best_len = 0
    best_window = ""

    for right, ch in enumerate(s):
        while ch in window:
            window.remove(s[left])
            left += 1
        window.add(ch)
        current_len = right - left + 1
        if current_len > best_len:
            best_len = current_len
            best_window = s[left:right + 1]

    return best_len, best_window


s = "abcabcbb"
length, window = longest_unique_substring(s)
print("Longest unique substring:", window, "length:", length)
```

Trace of the window at each step (`right` is the newly added character, `window` is the current contents of `s[left:right+1]`):

```
right=0 char='a'  window='a'  len=1
right=1 char='b'  window='ab'  len=2
right=2 char='c'  window='abc'  len=3
right=3 char='a'  window='bca'  len=3
right=4 char='b'  window='cab'  len=3
right=5 char='c'  window='abc'  len=3
right=6 char='b'  window='cb'  len=2
right=7 char='b'  window='b'  len=1
Longest unique substring: abc length: 3
```

Watch what happens at `right=3`: the incoming character `'a'` is already in the window (`'abc'`), so the inner `while` loop shrinks from the left — removing `'a'` — until `'a'` is no longer in the window, then adds the new `'a'` back in, leaving the window as `'bca'`. That single shrink-then-expand step is the whole mechanism: the window never resets, it just adjusts its left edge exactly as far as needed to restore the invariant ("no duplicate characters").

## 5. Compare

- Sliding window is a specialization of **same-direction two pointers** (previous lesson): `left` and `right` never move backward, and the "window" between them is the thing being tracked, rather than the pointers themselves being the answer.
- Compared to **prefix sums** (next lesson), sliding window is the right tool when the window must satisfy a *dynamic* condition (like "no duplicates" or "sum ≤ k" with variable length) — prefix sums are better when you need arbitrary, non-contiguous-in-a-single-pass range queries, or when negative numbers make "shrink the window" ambiguous (a shrinking window doesn't reliably decrease the sum if negative numbers are involved).
- Fixed-size window is essentially a specialized, simpler case of variable-size window where the invariant is just "size == k" instead of a data-dependent rule.

## 6. Common Mistakes

- Forgetting to **shrink the window** when the invariant breaks — e.g. finding a duplicate character but forgetting the `while` loop to remove elements from the left, which silently produces wrong (too-large) answers.
- Recomputing the window's state from scratch every iteration (e.g. re-scanning `s[left:right+1]` for duplicates each time) instead of incrementally updating a set/dict/running sum — this quietly turns an O(n) algorithm into O(n²), which defeats the entire purpose of the technique.
- Using `if` instead of `while` when shrinking — a single shrink step might not be enough to restore the invariant (e.g. multiple duplicates could be trapped inside the window), so the shrink must loop until the condition is satisfied.
- Off-by-one when computing the window length — it's `right - left + 1`, not `right - left`, since both boundaries are inclusive indices.
- Applying the fixed-size window's "just slide one step" logic to a variable-size problem, or vice versa — mixing up which type of window a problem calls for leads to either an incomplete search or an invariant that's never actually checked.

## 7. Interview Angle

Sliding window is a top-tier interview pattern because it's the direct answer to "can you do better than O(n²)?" for almost any "longest/shortest/count of contiguous subarray/substring satisfying X" question. Typical framing: "longest substring without repeating characters," "minimum window substring containing all characters of T," "maximum sum of a subarray of size k," "longest subarray with sum ≤ k (non-negative numbers)." A common follow-up is "what if the array contains negative numbers?" — for sum-based variable windows, this often breaks the "shrink when the invariant is violated" logic, since shrinking doesn't monotonically decrease the sum, and you may need to pivot to prefix sums + hashmap instead.

## 8. Memory Hook

"Expand right to explore, shrink left to repair — never recompute what the window already knows."
