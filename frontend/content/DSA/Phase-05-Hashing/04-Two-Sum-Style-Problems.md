# Two-Sum-Style Problems

## 1. Problem

"Given a list of numbers, find two of them that add up to a target value" sounds simple, and the brute-force answer is obvious: try every pair. For each element, walk the rest of the list checking whether it plus some other element hits the target — two nested loops, O(n²) time. For small lists that's fine; for a list of a hundred thousand numbers, checking ten billion pairs is not fine. The question that turns this into a genuinely useful interview problem is: can you find the pair in a *single pass*, without ever comparing every element against every other element?

The trick is realizing you don't need to search for a *pair* — you need to search for one *complement*, and you can check "have I already seen this complement" in O(1) if you've been recording every number you've passed in a hash map as you go. This one-pass hashmap technique — store what you've seen, then check whether the current element's "missing half" is already stored — is the seed pattern for a whole family of sum-finding problems: three-sum (fix one element, then run a two-pointer sweep on the rest), four-sum, and subarray-sum-equals-k (where the hashmap tracks running prefix sums instead of raw values). All of them replace an extra nested loop with a hashmap lookup.

## 2. Analogy

Imagine you're at a party where the rule is "form a pair whose ages add up to exactly 30." Instead of asking every person to compare ages with every other person (an O(n²) mingling nightmare), you stand at the door with a notepad. As each guest arrives, you first check your notepad: "does anyone already here have the exact age that would pair with this new guest to make 30?" If yes, you've found your pair immediately — point them at each other. If no, you jot the new guest's age (and who they are) on the notepad and wait for the next arrival. By the time everyone's arrived, you've either found a pair the instant its second half walked in, or confirmed no such pair exists — and you never once asked two already-admitted guests to compare notes with each other.

## 3. Internal Flow

**Two-sum, one pass:**

1. Keep a hash map `seen` mapping *value → index* of every number processed so far.
2. For each number `num` at index `i`, compute `complement = target - num` — the value that would need to exist elsewhere in the list to make the pair sum to `target`.
3. Check `seen` for `complement`. If it's there, you've found your pair immediately: the stored index plus the current index `i`.
4. If not, record `num → i` in `seen` and move to the next element.

Because step 3 and step 4 are both O(1) hashmap operations, and each element is visited exactly once, this whole process is O(n) time and O(n) space (for the map) — a full pass replaced the inner loop of the brute-force approach entirely.

**Generalizing to three-sum:** fix one element (loop over index `i` from 0 to n-1), then solve "find two *other* elements that sum to `target - nums[i]`" on the remaining slice — but instead of nesting another hashmap-based two-sum inside that loop (which works but needs care with duplicates), the standard approach sorts the array once and uses a **two-pointer sweep** (one pointer just after `i`, one at the end) that walks inward, which naturally skips duplicate values and avoids reporting the same triplet twice. The "fix one element, reduce to a simpler sum problem on the rest" idea is the generalization; the *inner* solve swaps from hashmap-lookup (two-sum) to two-pointer-on-sorted-data (because three-sum needs to enumerate all valid duplicate-free triplets, not just report the first match).

**Generalizing to subarray-sum problems:** "does some contiguous subarray sum to k?" swaps raw values for **running prefix sums** stored in the hashmap. As you scan left to right accumulating a running total, you ask "have I seen a prefix sum equal to `current_prefix_sum - k` before?" — if yes, everything between that earlier point and now sums to exactly `k`. Same shape as two-sum (store something as you scan, look up its complement), just applied to prefix sums instead of raw elements — this is the same prefix-sum technique covered in Phase 2's [03-Prefix-Sums.md](../Phase-02-Arrays-and-Strings/03-Prefix-Sums.md), combined with a hashmap to make the "has this sum occurred before" lookup O(1) instead of O(n).

## 4. Example

Classic two-sum, returning indices in O(n), tracing the hashmap's contents at every step:

```python
def two_sum(nums, target):
    seen = {}   # value -> index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            print(f"index {i} num={num}: complement {complement} found at index {seen[complement]} -> return [{seen[complement]}, {i}]")
            return [seen[complement], i]
        seen[num] = i
        print(f"index {i} num={num}: complement {complement} not in seen -> seen={seen}")
    return []

nums = [2, 7, 11, 15]
target = 9
print("Input:", nums, "target:", target)
result = two_sum(nums, target)
print("Result:", result)

print()
nums2 = [3, 2, 4]
target2 = 6
print("Input:", nums2, "target:", target2)
result2 = two_sum(nums2, target2)
print("Result:", result2)

print()
nums3 = [3, 3]
target3 = 6
print("Input:", nums3, "target:", target3)
result3 = two_sum(nums3, target3)
print("Result:", result3)
```

Executed output:

```
Input: [2, 7, 11, 15] target: 9
index 0 num=2: complement 7 not in seen -> seen={2: 0}
index 1 num=7: complement 2 found at index 0 -> return [0, 1]
Result: [0, 1]

Input: [3, 2, 4] target: 6
index 0 num=3: complement 3 not in seen -> seen={3: 0}
index 1 num=2: complement 4 not in seen -> seen={3: 0, 2: 1}
index 2 num=4: complement 2 found at index 1 -> return [1, 2]
Result: [1, 2]

Input: [3, 3] target: 6
index 0 num=3: complement 3 not in seen -> seen={3: 0}
index 1 num=3: complement 3 found at index 0 -> return [0, 1]
Result: [0, 1]
```

The third case (`[3, 3]`, target `6`) is worth studying closely: at index 0, `seen` is still empty, so `3` (its own complement) is *not* found yet — it only gets recorded *after* the check. By the time index 1 arrives, `seen` correctly holds only index 0's entry, so the complement check at index 1 correctly finds index 0 rather than index 1 matching against itself. This ordering — check first, insert second — is exactly what prevents an element from pairing with itself.

## 5. Compare

Two-sum's hashmap approach (O(n) time, O(n) space) beats the brute-force nested-loop approach (O(n²) time, O(1) space) whenever n is large enough that the extra memory is worth it — which is almost always, outside of tightly memory-constrained environments. Three-sum can't use the *same* trick naively nested inside a loop without care, because it needs to enumerate *all* valid triplets while skipping duplicates, which is exactly what sorting plus a two-pointer sweep handles cleanly (O(n²) overall — one O(n) loop over the fixed element times an O(n) two-pointer sweep per iteration — versus O(n³) brute force). Subarray-sum-equals-k reuses the exact "store what I've seen, look up the complement" skeleton from two-sum, just swapped from raw values to running prefix sums — recognizing that these are the same underlying pattern, applied to a different quantity, is the actual skill this whole lesson (and phase) is building toward.

## 6. Common Mistakes

- **Checking the complement against the element itself before it's been excluded.** If you insert `num → i` into `seen` *before* checking for its complement, an element can incorrectly "pair with itself" when `target == 2 * num` (e.g. `nums = [3]`, `target = 6` would wrongly report a match against an index that doesn't exist, or against itself in a longer array). The fix, shown in the example above, is to check first, then insert — so `seen` only ever contains elements strictly *before* the current index.
- **Not handling duplicate values correctly when the problem requires distinct indices.** `[3, 3]` with `target = 6` should return `[0, 1]` (two *different* indices holding equal values), which the check-then-insert ordering handles correctly — but if you dedupe the input into a `set` before searching (losing index information, or losing the fact that a value occurred more than once), you'd wrongly conclude no valid pair exists.
- **Confusing "distinct indices" with "distinct values" requirements.** Two-sum variants sometimes ask for indices (duplicates of the same value at different positions are fine) and sometimes ask for distinct *value pairs* (avoiding reporting `(3, 3)` twice from two different index pairs) — three-sum in particular needs to actively skip over repeated values during the two-pointer sweep to avoid emitting duplicate triplets, which is not automatic and needs an explicit "skip if same as previous" check.
- **Forgetting that the prefix-sum hashmap for subarray-sum problems needs to be seeded with `{0: 1}` before scanning starts.** Without a zero-sum entry pre-loaded, a subarray that sums to `k` starting from index 0 is silently missed, because `current_prefix_sum - k == 0` would have nothing to match against.
- **Assuming a sorted-array two-pointer approach is a drop-in replacement for the hashmap approach on two-sum.** Two-pointer requires sorted input and, if the problem asks for original *indices* (not values), sorting destroys that information unless you carry the original indices along separately — the hashmap approach avoids this entirely by never needing to reorder the input.

## 7. Interview Angle

"Two Sum" is frequently the very first problem in an interview loop specifically because it's a clean litmus test for whether a candidate defaults to O(n²) brute force or immediately reaches for a hashmap to collapse the inner loop — stating the check-before-insert ordering unprompted (to avoid self-pairing) is a strong signal of real understanding versus memorized code. The near-universal follow-up is "now solve three-sum" — watch for candidates who try to nest a hashmap-based two-sum inside a loop without a plan for duplicate triplets; the expected pivot is "sort once, then fix one element and two-pointer the rest," explicitly trading the hashmap for two pointers at the inner level because triplet-uniqueness is easier to guarantee that way. A second common follow-up swaps the framing entirely to prefix sums ("subarray sum equals k"), testing whether you recognize it as the *same* store-and-check-complement pattern rather than a brand new problem requiring brand new machinery.

## 8. Memory Hook

**Two-sum = the door clerk with a notepad: check first, then jot it down — never let a guest pair with themselves.** Three-sum is "fix one guest, then two-pointer-sweep the rest of the sorted room." Subarray-sum-equals-k is the same notepad trick played on *running totals* instead of raw numbers. One pattern — store what you've seen, look up its complement — wearing three different costumes.
