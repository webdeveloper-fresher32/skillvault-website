# Kadane's Algorithm

## 1. Problem

Imagine you have a daily log of profit and loss for a business over several months — some days are gains, some are losses. You're asked: "what's the best possible contiguous stretch of days, in terms of total profit?" You can't just sum everything (losses would drag the total down), and checking every possible stretch of consecutive days is O(n²) — for every possible start day, sum forward to every possible end day.

Kadane's algorithm answers "maximum sum of a contiguous subarray" in a single O(n) pass, using one deceptively simple insight: at every position, you only need to know one thing — the best sum of a subarray *ending exactly here*. If you know that at every index, the overall answer is just the largest of those values.

## 2. Analogy

Think of it like tracking your net worth day by day, but with a twist: every so often you're allowed to declare bankruptcy and start over from zero if your net worth has gone deeply negative, because dragging around a negative balance only makes future gains look worse than if you'd started fresh from that point.

At each day, you ask: "is it better to keep carrying my current running balance forward (adding today's gain/loss to it), or would I be strictly better off abandoning that balance and starting fresh from just today's number?" If the running balance is negative, starting fresh always wins, because a negative balance can only drag down whatever comes next. You make that choice every single day, and separately, you keep a running record of the *best* balance you've ever had on any given day, even if it's not your balance *today*.

## 3. Internal Flow

Kadane's algorithm tracks two separate quantities, and the distinction between them is the entire algorithm:

- **`current_sum`** — "the best sum of a subarray ending exactly at the current index." This can go up or down as you move forward, and it resets when it stops helping.
- **`max_sum`** — "the best sum of any subarray anywhere so far." This is monotonically non-decreasing; it only updates when `current_sum` produces something better than anything seen before.

Step by step:

1. Initialize both `current_sum` and `max_sum` to the first element of the array.
2. For each subsequent element `num`, decide: is it better to extend the existing subarray (`current_sum + num`) or to start a brand-new subarray right here (`num` alone)? Take whichever is larger: `current_sum = max(num, current_sum + num)`.
3. Update `max_sum = max(max_sum, current_sum)` — regardless of whether `current_sum` grew or reset, check whether it's now the best subarray seen so far.
4. Repeat until the end of the array; `max_sum` is the answer.

The key insight in step 2: `current_sum + num < num` exactly when `current_sum < 0`. In other words, "reset to start fresh at the current element" is only ever the right move when the running sum has gone negative — a negative running sum can never help a future subarray, it can only hurt it. This is why the common shorthand "reset current_sum to 0 when it goes negative" works for the *value comparison*, but the actual comparison being made is always `max(num, current_sum + num)`, which handles negative numbers in the array correctly too.

## 4. Example

```python
def max_subarray(nums):
    current_sum = nums[0]
    max_sum = nums[0]

    for i in range(1, len(nums)):
        num = nums[i]
        current_sum = max(num, current_sum + num)
        max_sum = max(max_sum, current_sum)

    return max_sum


arr = [-2, 1, -3, 4, -1, 2, 1, -5, 4]
print("Max subarray sum:", max_subarray(arr))

all_negative = [-8, -3, -6, -2, -5, -4]
print("All-negative case, max subarray sum:", max_subarray(all_negative))
```

Trace for `[-2, 1, -3, 4, -1, 2, 1, -5, 4]`, printing `current_sum` and `max_sum` at each index:

```
i=0  num= -2  current_sum= -2  max_sum= -2
i=1  num=  1  current_sum=  1  max_sum=  1
i=2  num= -3  current_sum= -2  max_sum=  1
i=3  num=  4  current_sum=  4  max_sum=  4
i=4  num= -1  current_sum=  3  max_sum=  4
i=5  num=  2  current_sum=  5  max_sum=  5
i=6  num=  1  current_sum=  6  max_sum=  6
i=7  num= -5  current_sum=  1  max_sum=  6
i=8  num=  4  current_sum=  5  max_sum=  6
Max subarray sum: 6
```

Trace for the all-negative array `[-8, -3, -6, -2, -5, -4]`:

```
i=0  num= -8  current_sum= -8  max_sum= -8
i=1  num= -3  current_sum= -3  max_sum= -3
i=2  num= -6  current_sum= -6  max_sum= -3
i=3  num= -2  current_sum= -2  max_sum= -2
i=4  num= -5  current_sum= -5  max_sum= -2
i=5  num= -4  current_sum= -4  max_sum= -2
All-negative case, max subarray sum: -2
```

In the first trace, look at `i=2`: `current_sum` was 1, adding `-3` gives `-2`, but starting fresh at `-3` alone would give `-3` — so `max(-3, -2) = -2` keeps the existing run rather than resetting, because `-2` is still better than abandoning everything. Then at `i=3`, `current_sum + 4 = 2`, but starting fresh at `4` alone is better, so `current_sum` becomes `4` — that's the "reset" happening, chosen purely because `4 > 2`, not because of any special-cased "if negative, reset to 0" rule. In the second trace, since every number is negative, `current_sum` never benefits from extending (each extension only adds more negativity), so the algorithm correctly settles on `-2`, the single least-negative element, rather than incorrectly returning `0` (which would imply an "empty subarray" that the problem doesn't actually allow).

## 5. Compare

- Kadane's is a **prefix-sum** idea in disguise: `current_sum` at index `i` is really tracking `prefix[i+1] - min_prefix_seen_so_far`, just computed incrementally instead of via an explicit prefix array — the two techniques are solving closely related problems (maximum subarray sum vs. general range sums) with a similar "track a running total" backbone.
- Unlike **sliding window**, Kadane's never explicitly shrinks a window from the left; "resetting" `current_sum` is really "abandoning the old window origin and starting a new one at the current index" — there's no explicit left pointer to move, because you never need to know *where* the current best subarray started, only its sum.
- Kadane's is the 1D ancestor of **maximum subarray in a 2D matrix** (which applies Kadane's algorithm to compressed row sums), and it's structurally the simplest example of a "running best decision" dynamic programming pattern: `current_sum` at each index depends only on `current_sum` at the previous index, which is the defining shape of DP problems covered later in this course.

## 6. Common Mistakes

- Forgetting to handle **all-negative arrays** — some implementations naively reset `current_sum` to `0` whenever it goes negative and initialize `max_sum` to `0`, which incorrectly returns `0` for an all-negative array instead of the correct answer (the largest, i.e. least-negative, single element).
- Resetting `current_sum` to `0` **unconditionally** whenever it goes negative, rather than comparing `max(num, current_sum + num)` — these give the same result when `num` itself is non-negative, but diverge and become subtly wrong once you consider what "starting fresh" actually means at a negative `num`.
- Initializing `max_sum` to `0` instead of `nums[0]` — this silently masks the correct answer whenever every valid subarray sum is negative.
- Confusing "maximum subarray sum" with "maximum subsequence sum" — Kadane's specifically requires **contiguity**; skipping elements (as a subsequence would allow) is a different problem entirely (and trivially solved by summing all positive numbers).
- Forgetting that the algorithm tracks the *sum*, not the subarray's start/end indices — if a problem asks you to also return the actual subarray boundaries, you need to additionally track the index where the current run started and update it whenever a reset happens.

## 7. Interview Angle

Kadane's algorithm is the canonical "maximum subarray" problem (LeetCode 53) and is often the first genuinely DP-flavored problem candidates encounter, even though it's usually taught alongside arrays rather than explicitly as DP. Typical framing: "maximum subarray sum," "maximum product subarray" (a trickier variant requiring you to also track the minimum running product, because a negative number can flip a very negative product into the new maximum), "best time to buy and sell stock" (a disguised version — the max profit is the max subarray sum of day-to-day price differences), "maximum sum circular subarray" (requires combining Kadane's with the total-sum-minus-minimum-subarray trick). A common follow-up: "what if the array is circular (wraps around)?" — solved by computing both the normal Kadane's max and, separately, `total_sum - min_subarray_sum`, then taking the larger (with a special case if all elements are negative).

## 8. Memory Hook

"At every step ask: extend or restart? — current_sum is the best ending here, max_sum is the best ever seen; a negative current_sum can only poison what comes next."
