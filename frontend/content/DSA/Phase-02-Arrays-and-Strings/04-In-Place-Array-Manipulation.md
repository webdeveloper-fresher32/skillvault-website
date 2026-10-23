# In-Place Array Manipulation

## 1. Problem

Suppose you're asked to remove all the zeroes cluttering an array of sensor readings, pushing them to the end while keeping every non-zero reading in its original relative order — and you're told: no extra array, no `O(n)` additional memory, modify the input directly. It's a small ask on paper, but it's surprisingly easy to get wrong: naive approaches either use extra space (defeating the point), or mutate the array while iterating over it in a way that skips elements or shifts indices unexpectedly.

In-place array manipulation is a family of techniques for rearranging, filtering, or compacting an array's contents using only the array itself as storage — no auxiliary list, no extra buffer. The workhorse pattern behind almost all of these problems is the **write pointer**: a second index that lags behind the main loop and marks exactly where the next "keep this" value belongs.

## 2. Analogy

Picture sorting recycling on a conveyor belt with your own two hands. One hand (the "read" hand) picks up every item coming down the belt, one at a time, in order. The other hand (the "write" hand) only places an item back onto the belt when it's something you want to keep — and it always places it at the *very next open slot*, which might be several positions behind where the read hand currently is.

Crucially, you never need a second conveyor belt. You're reusing the same belt's empty slots (created because you're not putting *everything* back) to store the compacted, filtered result. By the time the read hand reaches the end, everything from the start of the belt up to the write hand's current position is exactly the filtered result you wanted — nothing more was needed.

## 3. Internal Flow

The write-pointer pattern, generalized:

1. Initialize `write = 0` — this marks the next position where a "keep" value should be placed.
2. Loop `read` from `0` to the end of the array.
3. At each `read` position, decide: does this value belong in the final result (e.g. is it non-zero? is it not a duplicate of the previous kept value? does it not match the value to remove?).
4. If yes: place the value at index `write` (this might be a plain assignment or a swap, depending on the problem), then advance `write` by 1.
5. If no: do nothing to `write` — just let `read` move on. The value at `read` will effectively get overwritten (or skipped) later.
6. `read` always advances every iteration. `write` only advances when something is kept, so `write <= read` is an invariant that holds for the entire pass.
7. When the loop finishes, `arr[0:write]` holds the compacted result, in original relative order, using zero extra space.

Whether you assign or swap at step 4 usually depends on what happens to the "leftover" positions: if the problem wants the discarded values collected at the end in some form (like moving zeroes to the end, rather than just discarding them entirely), you swap instead of overwrite — that way the discarded value doesn't just vanish, it gets relocated to wherever `read` currently is.

## 4. Example

Move all zeroes to the end of the array while preserving the relative order of non-zero elements, using the write-pointer technique with swaps:

```python
def move_zeroes(nums):
    write = 0  # next slot that should hold a non-zero value
    for read in range(len(nums)):
        if nums[read] != 0:
            nums[write], nums[read] = nums[read], nums[write]
            write += 1
    return nums


arr = [0, 1, 0, 3, 12, 0, 5]
print("start:", arr)
result = move_zeroes(arr)
print("final:", result)
```

Trace of the array state after each step of the loop:

```
start: [0, 1, 0, 3, 12, 0, 5]
read=0  (zero, skip)  ->  [0, 1, 0, 3, 12, 0, 5]
read=1  write=0  ->  [1, 0, 0, 3, 12, 0, 5]
read=2  (zero, skip)  ->  [1, 0, 0, 3, 12, 0, 5]
read=3  write=1  ->  [1, 3, 0, 0, 12, 0, 5]
read=4  write=2  ->  [1, 3, 12, 0, 0, 0, 5]
read=5  (zero, skip)  ->  [1, 3, 12, 0, 0, 0, 5]
read=6  write=3  ->  [1, 3, 12, 5, 0, 0, 0]
final: [1, 3, 12, 5, 0, 0, 0]
```

Notice at `read=1`, `nums[read] = 1` is non-zero, so it swaps with `nums[write] = nums[0] = 0`. Since `write == read` at that point, the swap looks like a no-op in the printed array, but `write` still advances to 1. The interesting swaps happen from `read=3` onward, where `write` has fallen behind `read`: swapping `nums[3]=3` into `nums[1]` pushes the zero that was sitting at index 1 further down the array, toward where the zeroes are accumulating. By the end, `write=4` means indices `0..3` hold the four non-zero values in original order (`1, 3, 12, 5`), and indices `4..6` hold the three zeroes — exactly the required result, with zero extra space used.

## 5. Compare

- This is the **same-direction two-pointer** pattern from lesson 1, specialized: `read` and `write` are literally the "inspector" and "painter" from that analogy, applied to compaction/filtering instead of pair-finding.
- Compared to **sliding window**, the write pointer doesn't track a *range* that expands and shrinks — it tracks a single boundary that only ever moves forward, marking "everything before this index is finalized."
- This technique is the standard answer to "modify the array in place" follow-ups on problems like "remove element," "remove duplicates from sorted array," "move zeroes," and "partition array around a pivot" (the same idea underlies the partition step of quicksort).

## 6. Common Mistakes

- Using `list.remove()`, `del arr[i]`, or slicing (`arr = arr[:i] + arr[i+1:]`) inside a loop to "delete" elements — these operations shift every subsequent element's index, which breaks O(1)-space in-place guarantees and causes the loop to skip elements or process the wrong index on the next iteration.
- Iterating and mutating the same list by index without accounting for `write` lagging behind `read` — e.g. writing to `nums[read]` when you should be writing to `nums[write]`, silently overwriting data that hasn't been read yet.
- Forgetting that `write` should **only** advance when a value is actually kept — advancing it unconditionally every iteration turns the write pointer into just a second copy of `read`, and the compaction never happens.
- Assuming the "leftover" slots (indices from `write` to the end, after the pass) contain the original values — depending on whether you used assignment or swap, those slots may already have been overwritten by earlier swaps and need explicit handling (e.g. explicitly zeroing them out) if the problem needs them in a specific state.
- Confusing "remove all occurrences of a value" (order doesn't need to be preserved, so swap-from-the-end tricks are viable) with "preserve relative order" problems (which require the sequential write-pointer scan shown above) — these two problem shapes have different optimal in-place strategies.

## 7. Interview Angle

In-place manipulation questions test whether you can satisfy a space constraint without reaching for `O(n)` auxiliary structures out of habit. Typical framing: "remove element" (LeetCode 27), "remove duplicates from sorted array" (LeetCode 26/80), "move zeroes" (LeetCode 283), "sort colors / Dutch national flag" (three-way partitioning, a variant with two write pointers). A very common follow-up: "can you minimize the number of writes?" (useful when writes are expensive, e.g. flash memory) — which pushes you to only swap/write when strictly necessary, rather than writing to every position unconditionally. Another follow-up: "what if the array isn't sorted, for the remove-duplicates variant?" — the write-pointer approach generalizes as long as "duplicate" is redefined using a set instead of just comparing to the previous element.

## 8. Memory Hook

"Read scans everything, write only steps when there's something worth keeping — write can never get ahead of read."
