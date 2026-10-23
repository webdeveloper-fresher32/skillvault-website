# Two Pointers

## 1. Problem

Imagine you're given a sorted list of prices and asked: "do any two items add up to exactly $26?" The brute-force answer is to check every pair — for each item, scan every other item — which is O(n²). That's fine for 10 items, but painfully slow for 10 million.

The two-pointer technique is a way to exploit *order* (or a known structure) in the data so you only ever need a single pass, O(n), instead of checking every pair. It shows up constantly in interviews: pair-sum problems, removing duplicates from a sorted array, reversing a string in place, checking palindromes, merging two sorted arrays — all of these are variations of "walk through the data with two indices instead of one, moving them according to a rule instead of brute-forcing every combination."

## 2. Analogy

Picture two people meeting in the middle of a hallway lined with lockers, numbered in increasing order of "weight" from one end to the other. One person starts at the lightest locker, the other starts at the heaviest. If the two lockers' combined weight is too heavy, the heavy-end person steps inward (picks a lighter locker). If it's too light, the light-end person steps inward (picks a heavier locker). They keep adjusting, one step at a time, until they either meet in the middle or find the exact combined weight they were looking for.

That's opposite-direction two pointers: both pointers start at the two ends and walk *toward* each other, using the sorted order to decide which one moves.

There's a second flavor — same-direction two pointers — which is more like a slow-moving painter and a fast-moving inspector walking the same hallway in the same direction. The inspector (fast pointer) checks every locker; the painter (slow pointer) only moves forward and repaints a locker when the inspector finds something worth keeping. The painter never runs ahead of the inspector, and by the time the inspector reaches the end, everything up to the painter's position is exactly what should be kept.

## 3. Internal Flow

**Opposite-direction pointers** (classic use case: pair-sum on a sorted array):

1. Place `left` at index 0 and `right` at the last index.
2. Compute `arr[left] + arr[right]`.
3. If the sum equals the target, you found your pair — stop.
4. If the sum is *too small*, the only way to increase it (given the array is sorted ascending) is to move `left` rightward to a bigger value.
5. If the sum is *too large*, move `right` leftward to a smaller value.
6. Repeat until `left` and `right` cross (`left >= right`), which means no pair exists.

This works *only* because the array is sorted — sortedness is what tells you which pointer to move. Without that order, moving a pointer inward tells you nothing about whether the new sum is bigger or smaller.

**Same-direction pointers** (classic use case: remove duplicates from a sorted array in place):

1. `write` starts at index 0 (or 1) — it marks where the next "keep this value" write should go.
2. `read` scans from the start to the end of the array, one index at a time.
3. Whenever `read` finds a value that should be kept (e.g. it's different from `arr[write - 1]`, meaning it's not a duplicate), copy it to `arr[write]` and advance `write`.
4. `read` always moves forward every iteration; `write` only moves forward when it actually writes something, so `write <= read` at all times.
5. When `read` finishes, everything in `arr[0:write]` is the deduplicated (or filtered) result.

## 4. Example

Two-sum on a sorted array using opposite-direction pointers — find two indices whose values sum to a target:

```python
def two_sum_sorted(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:
        current_sum = arr[left] + arr[right]
        if current_sum == target:
            return (left, right)
        elif current_sum < target:
            left += 1
        else:
            right -= 1
    return None


arr = [2, 7, 11, 15, 18, 24]
target = 29
print(two_sum_sorted(arr, target))
```

Trace, printing the pointer positions and running sum at each step:

```
left=0 (val=2)  right=5 (val=24)  sum=26
left=1 (val=7)  right=5 (val=24)  sum=31
left=1 (val=7)  right=4 (val=18)  sum=25
left=2 (val=11)  right=4 (val=18)  sum=29
```

Output: `(2, 4)` — `arr[2] = 11` and `arr[4] = 18`, and `11 + 18 = 29`.

Walk through why each move happened: `2 + 24 = 26` is less than 29, so `left` moves right (from index 0 to 1) to try a bigger left value. `7 + 24 = 31` overshoots, so `right` moves left (from index 5 to 4). `7 + 18 = 25` undershoots again, so `left` moves right once more. `11 + 18 = 29` matches — done. Each pointer only ever moves in one direction, and together they scanned the array once: O(n) total instead of O(n²).

## 5. Compare

- Two pointers and **sliding window** (next lesson) are close cousins — a sliding window is really a same-direction two-pointer pattern where the region *between* the pointers is the thing you're tracking (a "window"), rather than the pointers themselves being the answer.
- Two pointers replace nested loops when the data is sorted (or can be sorted) and the problem is about finding a pair, partitioning, or comparing from both ends — if the data isn't sorted and sorting it would destroy needed information (e.g. you need original indices), a hashmap-based one-pass approach is often the better substitute for opposite-direction two pointers.
- Same-direction two pointers (the "write pointer" idea) generalizes directly into **04-In-Place-Array-Manipulation**, where it's used for removing elements and moving zeroes.

## 6. Common Mistakes

- Applying opposite-direction two pointers to an **unsorted array** without sorting first — the "move left if sum too small" logic is only valid because of sorted order; on unsorted data it gives wrong answers silently.
- Off-by-one on the loop boundary: using `while left <= right` when you meant `while left < right` (or vice versa) — for pair-sum, once `left == right` you'd be pairing an element with itself, which is usually wrong.
- Forgetting to **skip duplicate values** when a problem asks for unique pairs/triplets (e.g. 3Sum) — after finding a valid pair, you must advance past repeated values on both sides, or you'll return the same pair multiple times.
- Assuming two pointers always means "start at both ends" — same-direction (read/write) pointers are just as much "two pointers" and solve a different class of problems.
- Losing track of which pointer represents which invariant (e.g. confusing the "read" and "write" roles), causing values to be overwritten before they've been read.

## 7. Interview Angle

Two pointers is one of the first patterns interviewers check for because it signals you can avoid brute-force nested loops. Typical framing: "given a sorted array, find a pair/triplet that sums to X" (Two Sum II, 3Sum, 4Sum), "reverse a string/array in place," "check if a string is a palindrome," or "merge two sorted arrays without extra space." A very common follow-up: "what if the array isn't sorted?" — expect you to either sort first (O(n log n), acceptable if you then get O(n) two-pointer work) or switch to a hashmap-based approach. Another common follow-up: "what if you need all pairs/triplets, not just one?" which pushes you toward the duplicate-skipping variant (3Sum-style).

## 8. Memory Hook

"Sorted array, no match yet, sum too small push left, sum too big pull right — they meet in the middle or they don't meet at all."
