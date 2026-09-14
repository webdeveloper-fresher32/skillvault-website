# LCS and LIS

## 1. Problem

Two of the most frequently reused DP patterns in interviews both revolve around **subsequences** — not to be confused with substrings/subarrays, which must be contiguous. A subsequence is formed by deleting zero or more elements without changing the relative order of what remains; the elements don't need to be adjacent in the original sequence.

- **Longest Common Subsequence (LCS)**: given two sequences, find the length (or content) of the longest subsequence common to both. This models problems like diffing two versions of a file, or measuring similarity between two DNA strands.
- **Longest Increasing Subsequence (LIS)**: given one sequence, find the length of the longest subsequence that is strictly increasing. This models problems like "the longest run of improving values you could have picked out of a noisy series" (e.g., stock prices, box-stacking by size).

LCS is naturally a 2D DP problem (one dimension per sequence). LIS can be solved with an O(n²) DP (comparable in spirit to LCS) or with a cleverer O(n log n) approach using **patience sorting** — maintaining a "tails" array via binary search — which is the version most often expected in interviews once the O(n²) baseline is established.

## 2. Analogy

For LCS: imagine two people each reading their own to-do list aloud, in order, and you want to find the longest list of tasks that both people mentioned, in the same relative order — even if one person had extra tasks interleaved in between that the other didn't have. You're not looking for an identical contiguous block of tasks (that would be like finding a common *substring*); you're looking for the longest "thread" of matching tasks you can pick out of both lists while preserving each list's own internal order.

For LIS: imagine sorting a deck of cards using the "patience" solitaire technique — you deal cards one at a time onto piles, placing each card on the leftmost pile whose top card is greater than or equal to it (starting a new pile if no such pile exists). The number of piles you end up with equals the length of the longest increasing subsequence — each pile's top card represents "the smallest possible tail value for an increasing subsequence of this length so far," which is a very efficient thing to track because it lets you use binary search to decide, in O(log n), which pile a new card belongs to.

## 3. Internal Flow

**LCS.** Let `dp[i][j]` = the length of the LCS between the first `i` characters of string `a` and the first `j` characters of string `b`.

- If `a[i-1] == b[j-1]` (the characters at this position match): `dp[i][j] = dp[i-1][j-1] + 1` — extend the LCS found without these two characters by one.
- Otherwise: `dp[i][j] = max(dp[i-1][j], dp[i][j-1])` — the LCS either ignores this character of `a`, or ignores this character of `b`, whichever gives a longer result; no match means you cannot extend, so you fall back to the best of the two "drop one character" options.

Base case: `dp[0][j] = dp[i][0] = 0` (an empty prefix of either string has LCS length 0 with anything).

**LIS, O(n²) version (for context).** Let `dp[i]` = the length of the longest increasing subsequence ending exactly at index `i`. `dp[i] = 1 + max(dp[j] for j < i if nums[j] < nums[i])`, or `1` if no such `j` exists. The answer is `max(dp)`. This is O(n²) because for every `i` you scan all `j < i`.

**LIS, O(n log n) version (patience-sorting / binary search on tails).** Maintain an array `tails`, where `tails[k]` is the smallest possible tail value among all increasing subsequences of length `k+1` found so far (note: `tails` itself is **not** necessarily a real subsequence of the input — it's a proxy that only tracks the best possible tail value per length). For each new number `x`:

- Binary-search `tails` for the **leftmost position** where `x` could be inserted to keep `tails` sorted (`bisect.bisect_left`).
- If that position is at the end of `tails`, `x` extends the longest subsequence found so far by one — append it.
- Otherwise, `x` can replace the existing value at that position, since `x` is a smaller (or equal) tail for a subsequence of that same length — potentially enabling longer subsequences later.

The final length of `tails` is the LIS length. Using `bisect_left` (not `bisect_right`) is what enforces **strictly** increasing — it finds the leftmost slot where equal values would go, ensuring an equal value replaces rather than extends.

## 4. Example

LCS via the full 2D table, then LIS via the O(n log n) tails approach, tracing the tails array as it's built:

```python
import bisect


def lcs(a, b):
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    print("LCS DP table:")
    header = "    " + " ".join(f"{c:>2}" for c in ("", *b))
    print(header)
    for i, row in enumerate(dp):
        label = "" if i == 0 else a[i - 1]
        print(f"{label:>2}: " + " ".join(f"{v:>2}" for v in row))

    return dp[n][m]


a = "ABCBDAB"
b = "BDCABA"
print(f"a = {a!r}, b = {b!r}")
length = lcs(a, b)
print(f"LCS length: {length}\n")


def lis_length_nlogn(nums):
    tails = []
    for i, x in enumerate(nums):
        pos = bisect.bisect_left(tails, x)
        if pos == len(tails):
            tails.append(x)
        else:
            tails[pos] = x
        print(f"after processing nums[{i}]={x}: insertion pos={pos}, tails={tails}")
    return len(tails)


nums = [10, 9, 2, 5, 3, 7, 101, 18]
print(f"nums = {nums}")
result = lis_length_nlogn(nums)
print(f"LIS length: {result}")
```

Actual output:

```text
a = 'ABCBDAB', b = 'BDCABA'
LCS DP table:
        B  D  C  A  B  A
  :  0  0  0  0  0  0  0
 A:  0  0  0  0  1  1  1
 B:  0  1  1  1  1  2  2
 C:  0  1  1  2  2  2  2
 B:  0  1  1  2  2  3  3
 D:  0  1  2  2  2  3  3
 A:  0  1  2  2  3  3  4
 B:  0  1  2  2  3  4  4
LCS length: 4

nums = [10, 9, 2, 5, 3, 7, 101, 18]
after processing nums[0]=10: insertion pos=0, tails=[10]
after processing nums[1]=9: insertion pos=0, tails=[9]
after processing nums[2]=2: insertion pos=0, tails=[2]
after processing nums[3]=5: insertion pos=1, tails=[2, 5]
after processing nums[4]=3: insertion pos=1, tails=[2, 3]
after processing nums[5]=7: insertion pos=2, tails=[2, 3, 7]
after processing nums[6]=101: insertion pos=3, tails=[2, 3, 7, 101]
after processing nums[7]=18: insertion pos=3, tails=[2, 3, 7, 18]
LIS length: 4
```

For LCS: the table's final cell (`dp[7][6] = 4`) matches one actual common subsequence like `"BCBA"` or `"BDAB"` — both length 4, both preserving relative order in each original string without requiring contiguity. For LIS: watch `tails` evolve — `9` replaces `10` (a smaller possible tail for a length-1 subsequence), `2` replaces `9` (smaller still), then `5` extends to `[2, 5]`, `3` replaces `5` (smaller tail for length 2), `7` extends to `[2, 3, 7]`, `101` extends to `[2, 3, 7, 101]`, and `18` replaces `101` (smaller tail for length 4). The final `tails` array `[2, 3, 7, 18]` is **not** the actual LIS (it's a mix of positions from different points in time), but its **length**, `4`, correctly equals the real LIS length (e.g., the real subsequence `2, 3, 7, 101` or `2, 3, 7, 18`, both length 4).

## 5. Compare

- **LCS vs LIS**: LCS compares **two** sequences (2D state); LIS analyzes **one** sequence (1D state, though the O(n log n) version uses an auxiliary array that isn't itself a DP table in the traditional sense).
- **Subsequence vs substring/subarray**: LCS and LIS both operate on subsequences (order preserved, contiguity not required) — the analogous *contiguous* problems (longest common **substring**, longest increasing **subarray/run**) use entirely different recurrences (typically resetting to zero on a mismatch, rather than falling back to `max(dp[i-1][j], dp[i][j-1])`) — conflating the two families is one of the most common DP mistakes.
- **O(n²) LIS vs O(n log n) LIS**: the O(n²) version directly tracks "the LIS ending at each index" (interpretable, easy to reconstruct the actual subsequence from); the O(n log n) version only tracks the minimal tail per length (harder to reconstruct the actual subsequence without extra bookkeeping, but asymptotically faster) — a classic clarity-vs-performance tradeoff worth naming explicitly in an interview.

## 6. Common Mistakes

- **Confusing subsequence with substring/subarray.** Using the LCS recurrence's fallback (`max(dp[i-1][j], dp[i][j-1])`) on a problem that actually asks for the longest common **substring** produces a wrong answer, because substring problems must reset the running length to 0 on any mismatch rather than falling back to a non-contiguous best-so-far.
- **Misapplying `bisect` direction in the O(n log n) LIS approach.** Using `bisect_right` instead of `bisect_left` changes the algorithm's behavior on duplicate/equal values — for a **strictly** increasing subsequence, `bisect_left` is required so that an equal value replaces an existing tail rather than being treated as extending the sequence.
- **Forgetting the base case row/column in LCS's 2D table.** Omitting the explicit `dp[0][j] = dp[i][0] = 0` initialization (or mis-sizing the table as `n x m` instead of `(n+1) x (m+1)`) causes an index error or an off-by-one wrong answer, since every real character comparison needs to reference "zero characters consumed so far" as a valid state.
- **Treating the O(n log n) `tails` array as the actual LIS.** `tails` is a bookkeeping structure whose *length* is correct but whose *contents* are not a real subsequence of the input — attempting to read off "the LIS" directly from `tails` (rather than its length) gives a wrong or nonsensical sequence.
- **Assuming LCS length implies a unique common subsequence.** Multiple different subsequences can tie for the same maximum LCS length (as seen with `"BCBA"` and `"BDAB"` above) — code that assumes there's exactly one and tries to reconstruct "the" LCS via a single backtracking path may find *a* valid answer but shouldn't claim it's the only one.

## 7. Interview Angle

LCS and LIS are both extremely common because they anchor entire families of variants: LCS underlies edit distance, diff tools, and shortest common supersequence; LIS underlies problems like "minimum number of trains to sort a sequence" (patience sorting's original application) and box-stacking. A typical interview arc for LIS starts with the O(n²) DP (to demonstrate the recurrence is understood), followed by "can you do better than O(n²)?" — the expected answer is the O(n log n) tails/binary-search approach, and being able to explain *why* the tails array's length equals the LIS length (even though its contents aren't a real subsequence) is a strong signal of genuine understanding rather than memorization. For LCS, a common follow-up is "can you reconstruct the actual subsequence, not just its length?" which requires walking back through the filled table from `dp[n][m]`, following whichever direction (diagonal on a match, or whichever of up/left was larger on a mismatch) produced each cell's value.

## 8. Memory Hook

**"LCS diagonally extends on a match, falls back on a miss; LIS keeps the smallest possible tail per length."** For LCS, a character match always means "look diagonally back and add one" — a mismatch always means "take the better of dropping one character from either side." For LIS's fast version, remember that `tails` is a scoreboard of "cheapest possible ending value" per subsequence length, not the subsequence itself — its length is the real answer.
