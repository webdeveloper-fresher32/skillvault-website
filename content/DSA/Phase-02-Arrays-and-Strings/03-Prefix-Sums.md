# Prefix Sums

## 1. Problem

Imagine a dashboard that needs to answer "what were total sales between day 10 and day 40?" — and then, moments later, "what about between day 5 and day 90?" — hundreds of times per minute, across a year's worth of daily sales data. Recomputing the sum by adding up every element in the range, every single time, is O(n) per query. With enough queries, that adds up fast.

Prefix sums solve this by doing a small amount of upfront work — building one array of *running totals* — so that any range-sum query afterward costs O(1), no matter how large the range is. It's the array-analysis equivalent of "do the addition once, then just subtract."

A closely related and extremely common interview variant asks a subtly different question: "how many contiguous subarrays sum to exactly k?" This can't be answered with a single prefix array lookup alone, but it's solved beautifully by combining prefix sums with a hashmap — the "prefix-sum-difference trick."

## 2. Analogy

Think of a car's odometer. If someone asks "how far did you drive between mile marker 100 and mile marker 250 of your trip?", you don't need to remember the length of every individual road segment in between — you just need two odometer readings: the total distance at marker 250, minus the total distance at marker 100. The odometer already did the cumulative work for you as you drove; querying a range afterward is just one subtraction.

The prefix sum array *is* the odometer readings, recorded at every mile marker. Building it costs one pass through the whole trip; answering "distance between any two markers" afterward costs nothing more than pulling two numbers off the dashboard and subtracting.

## 3. Internal Flow

**Building and querying a prefix sum array:**

1. Create a `prefix` array one element longer than the input, with `prefix[0] = 0` (the sum of "the first zero elements").
2. For each index `i` in the original array, set `prefix[i + 1] = prefix[i] + arr[i]` — so `prefix[i]` always holds the sum of the first `i` elements (indices `0` through `i - 1`).
3. To answer "what's the sum of `arr[i..j]` inclusive?", compute `prefix[j + 1] - prefix[i]` — this subtracts off everything before index `i`, leaving exactly the sum from `i` to `j`.
4. Every query after the initial O(n) build is O(1).

**Subarray sum equals k, using prefix sums + a hashmap:**

The key insight: if `prefix[j+1] - prefix[i] = k` for some `i < j+1`, then the subarray from `i` to `j` sums to `k`. Rearranged: `prefix[i] = prefix[j+1] - k`. So as you scan the array computing a running prefix sum, at each position you ask: "have I seen a prefix sum equal to `current_running_sum - k` before?" If yes, each time you saw it marks the start of a valid subarray ending here.

1. Initialize a hashmap `seen = {0: 1}` — this accounts for a subarray that starts at index 0 and itself sums to exactly `k` (its "prefix before the subarray" is 0, so it must be pre-seeded).
2. Walk through the array, maintaining `running_sum`.
3. At each step, compute `needed = running_sum - k`. If `needed` is in `seen`, add `seen[needed]` to your count — this many earlier prefixes would make a subarray ending here sum to exactly `k`.
4. Record the current `running_sum` in `seen` (incrementing its count).
5. Continue to the end; the accumulated count is the answer.

## 4. Example

**Range sum queries** using a prefix sum array:

```python
def build_prefix_sums(arr):
    prefix = [0] * (len(arr) + 1)
    for i, val in enumerate(arr):
        prefix[i + 1] = prefix[i] + val
    return prefix


def range_sum(prefix, i, j):
    return prefix[j + 1] - prefix[i]


arr = [4, 2, -1, 7, 3, 5]
prefix = build_prefix_sums(arr)
print("arr:   ", arr)
print("prefix:", prefix)

queries = [(0, 2), (1, 4), (3, 5), (0, 5)]
for i, j in queries:
    print(f"sum(arr[{i}..{j}]) = {range_sum(prefix, i, j)}")
```

Output:

```
arr:    [4, 2, -1, 7, 3, 5]
prefix: [0, 4, 6, 5, 12, 15, 20]
sum(arr[0..2]) = 5
sum(arr[1..4]) = 11
sum(arr[3..5]) = 15
sum(arr[0..5]) = 20
```

Notice `prefix[0] = 0` (sum of zero elements), `prefix[1] = 4` (sum of just `arr[0]`), `prefix[2] = 6` (`4 + 2`), and so on. `sum(arr[0..2])` — meaning indices 0, 1, 2 — is `prefix[3] - prefix[0] = 5 - 0 = 5`, matching `4 + 2 + (-1) = 5`.

**Subarray sum equals k**, using prefix sums + hashmap:

```python
def subarray_sum_equals_k(arr, k):
    count = 0
    running_sum = 0
    seen = {0: 1}  # empty prefix has sum 0, seen once

    for num in arr:
        running_sum += num
        needed = running_sum - k
        if needed in seen:
            count += seen[needed]
        seen[running_sum] = seen.get(running_sum, 0) + 1
        print(f"num={num:>3}  running_sum={running_sum:>3}  needed={needed:>3}  "
              f"count_so_far={count}  seen={dict(seen)}")

    return count


arr2 = [3, 4, 7, 2, -3, 1, 4, 2]
k = 7
result = subarray_sum_equals_k(arr2, k)
print("Number of subarrays summing to", k, "=", result)
```

Output:

```
num=  3  running_sum=  3  needed= -4  count_so_far=0  seen={0: 1, 3: 1}
num=  4  running_sum=  7  needed=  0  count_so_far=1  seen={0: 1, 3: 1, 7: 1}
num=  7  running_sum= 14  needed=  7  count_so_far=2  seen={0: 1, 3: 1, 7: 1, 14: 1}
num=  2  running_sum= 16  needed=  9  count_so_far=2  seen={0: 1, 3: 1, 7: 1, 14: 1, 16: 1}
num= -3  running_sum= 13  needed=  6  count_so_far=2  seen={0: 1, 3: 1, 7: 1, 14: 1, 16: 1, 13: 1}
num=  1  running_sum= 14  needed=  7  count_so_far=3  seen={0: 1, 3: 1, 7: 1, 14: 2, 16: 1, 13: 1}
num=  4  running_sum= 18  needed= 11  count_so_far=3  seen={0: 1, 3: 1, 7: 1, 14: 2, 16: 1, 13: 1, 18: 1}
num=  2  running_sum= 20  needed= 13  count_so_far=4  seen={0: 1, 3: 1, 7: 1, 14: 2, 16: 1, 13: 1, 18: 1, 20: 1}
Number of subarrays summing to 7 = 4
```

Look at `num=4` (second element): `running_sum` becomes 7, `needed = 7 - 7 = 0`, and `0` is in `seen` (from the initial seed) — that's the subarray `[3, 4]` itself summing to 7, so `count` becomes 1. Later, at `num=1` (sixth element), `running_sum = 14` again, `needed = 7`, and `seen[7] = 1` at that point — that match corresponds to the subarray `[7]` alone (from index 2 to index 2), since `prefix` at the end (14) minus `prefix` right after the first `7` (7) equals 7.

## 5. Compare

- Prefix sums answer **static** range queries (the array doesn't change between queries) in O(1) after an O(n) build — this is a fundamentally different trade-off from **sliding window**, which is built for *dynamic*, data-dependent window conditions (like "no duplicates") rather than plain range sums.
- When negative numbers are involved and you need "does some contiguous subarray sum to k," prefix sums + hashmap is usually the right tool, precisely because sliding window's "shrink when too big" logic breaks down when adding an element can *decrease* the sum.
- Prefix sums are a one-dimensional case of a broader idea (2D prefix sums / prefix XOR / prefix product) that generalizes to grids and other associative operations — same core trick, same "precompute cumulative, then subtract" pattern.

## 6. Common Mistakes

- Off-by-one confusion between 0-indexed and 1-indexed prefix arrays: `prefix[i]` should represent the sum of the **first `i` elements** (indices `0` to `i-1`), not the sum "up to and including index `i`" — mixing these two conventions is the single most common bug in prefix-sum code.
- Forgetting to seed the hashmap with `{0: 1}` in the subarray-sum-equals-k pattern — without it, subarrays that start at index 0 and sum exactly to `k` are silently undercounted.
- Computing `range_sum(i, j)` as `prefix[j] - prefix[i]` instead of `prefix[j + 1] - prefix[i]` when using the 0-indexed-prefix-of-length-n+1 convention — this excludes `arr[j]` from the sum.
- Building the prefix array but then re-summing ranges manually anyway (defeating the point) instead of using the subtraction formula.
- Applying the sliding-window "shrink from the left" logic to subarray-sum-equals-k when the array has negative numbers — this pattern requires prefix sums + hashmap specifically because sliding window's monotonic assumption doesn't hold.

## 7. Interview Angle

Prefix sums show up whenever a problem mentions "multiple range-sum queries" (build once, query many) or "subarray/substring sum equals k" (especially when negative numbers rule out sliding window). Typical framing: "range sum query — immutable array," "subarray sum equals k," "continuous subarray sum" (divisibility variants using prefix sum mod k), "product of array except self" (a prefix/suffix product variant of the same idea). A common follow-up: "what if the array is mutable and gets updated between queries?" — that pushes you toward a Fenwick tree / segment tree, since a plain prefix array would need an O(n) rebuild per update.

## 8. Memory Hook

"Sum of a range is just two odometer readings subtracted — build the odometer once, read it forever."
