# Recurrence Relations and the Master Theorem

## 1. Problem

You've written a recursive algorithm — say, merge sort — and now you need its time complexity. Unlike a simple loop, you can't just "count iterations," because the function calls itself, and each call spawns more calls. You need a way to express "the time to solve a problem of size n" in terms of "the time to solve smaller problems," and then a way to *solve* that expression to get a clean answer like O(n log n). Doing this from first principles (expanding the recursion tree by hand) works but is slow and error-prone — the Master Theorem is a shortcut formula that solves an entire common family of these expressions instantly, once you learn to recognize the pattern.

This matters for interviews because almost every divide-and-conquer algorithm (merge sort, quicksort, binary search, and many tree/graph algorithms) has its complexity justified this way — being able to say "this recurrence is T(n) = 2T(n/2) + O(n), which by the Master Theorem is O(n log n)" is a strong, precise signal that you understand *why* the algorithm is fast, not just that you memorized the answer.

## 2. Analogy

Think of a recurrence relation like a company's org chart for a task: "to complete this project, I split it into 2 sub-projects of half the size, hand them to 2 managers, and then spend some time myself combining their results." The **recurrence** `T(n) = 2T(n/2) + O(n)` is exactly that sentence in math: solving a problem of size n costs (2 sub-problems of size n/2) + (O(n) work to combine them, e.g., merging two sorted halves).

The Master Theorem is like a rule of thumb for "who does more total work across the whole org chart — the workers at the bottom (leaves), or the managers doing combination work at each level?" If the combining work grows slower than the branching/sub-problem work, the leaves dominate. If it grows faster, the top-level combining work dominates. If they grow at the same rate, every level contributes equally, and you multiply by the number of levels.

## 3. Internal Flow

A recurrence for a recursive algorithm has the general form:

```
T(n) = a * T(n / b) + f(n)
```

where:
- `a` = number of recursive subproblems the function creates,
- `n / b` = the size of each subproblem (input shrinks by a factor of `b` each call),
- `f(n)` = the work done *outside* the recursive calls at this level (splitting the input and/or combining results).

The **Master Theorem** compares `f(n)` against `n^(log_b a)` (this quantity is "how much total work the leaves of the recursion tree would do if there were no combining work at all") and gives three cases:

1. **Case 1 — leaves dominate:** if `f(n)` grows *slower* than `n^(log_b a)` (polynomially slower), the total time is dominated by the sheer number of base-case leaves: `T(n) = Θ(n^(log_b a))`.
2. **Case 2 — balanced:** if `f(n)` grows at *the same rate* as `n^(log_b a)`, every level of the recursion tree contributes roughly equal work, and you multiply by the number of levels (which is `log n`): `T(n) = Θ(n^(log_b a) · log n)`.
3. **Case 3 — combining work dominates:** if `f(n)` grows *faster* than `n^(log_b a)` (polynomially faster), and a technical "regularity condition" holds, the top-level combining work dominates: `T(n) = Θ(f(n))`.

Step-by-step, to apply it:

1. Write the recurrence in the `T(n) = a·T(n/b) + f(n)` form.
2. Compute `n^(log_b a)`.
3. Compare `f(n)` to that quantity — is it asymptotically smaller, equal, or larger?
4. Pick the matching case and read off the answer.

**When it doesn't apply:** the Master Theorem *only* covers recurrences where the input shrinks by a constant *factor* (`n/b`) at each step, and where the number of subproblems `a` is constant. A recurrence like `T(n) = T(n-1) + O(n)` (input shrinks by a constant *amount*, not a factor — as in naive recursive algorithms that peel off one element at a time) is not covered by the Master Theorem at all; you must solve it directly (usually by expanding the sum: `T(n) = O(n) + O(n-1) + ... + O(1) = O(n²)`).

## 4. Example

**Merge sort:** at each level, the array is split into 2 halves (`a = 2`, `b = 2`), and merging the two sorted halves back together takes O(n) work (`f(n) = O(n)`):

```
T(n) = 2*T(n/2) + O(n)
```

- `n^(log_b a) = n^(log_2 2) = n^1 = n`
- Compare `f(n) = n` against `n^1 = n` → they grow at the *same rate* → Case 2 (balanced).
- Result: `T(n) = Θ(n * log n)` → **O(n log n)**.

**Binary search:** at each step, the problem is split into halves but only *one* half is ever explored (`a = 1`, `b = 2`), and the work outside the recursive call is just a constant-time comparison (`f(n) = O(1)`):

```
T(n) = 1*T(n/2) + O(1)
```

- `n^(log_b a) = n^(log_2 1) = n^0 = 1`
- Compare `f(n) = O(1)` against `n^0 = 1` → they grow at the *same rate* → Case 2 (balanced).
- Result: `T(n) = Θ(1 * log n)` → **O(log n)**.

Side by side, here's the difference made concrete in Python — counting actual "unit operations" (merge steps vs comparisons) as each algorithm runs, to sanity-check the derived formulas:

```python
import math

def merge_sort_ops(n):
    """Return the number of element-touches merge sort performs, by recursion."""
    if n <= 1:
        return 0
    left_ops = merge_sort_ops(n // 2)
    right_ops = merge_sort_ops(n - n // 2)
    merge_ops = n  # merging two halves touches every element once
    return left_ops + right_ops + merge_ops


def binary_search_ops(n):
    """Return the number of comparisons binary search performs in the worst case."""
    if n <= 1:
        return 1
    return 1 + binary_search_ops(n // 2)


for n in [8, 64, 1024, 1_000_000]:
    ms_ops = merge_sort_ops(n)
    bs_ops = binary_search_ops(n)
    predicted_ms = n * math.log2(n) if n > 1 else 0
    predicted_bs = math.log2(n) if n > 1 else 0
    print(f"n={n:>9}  merge_sort_ops={ms_ops:>9} (~n log n = {predicted_ms:>9.0f})  "
          f"binary_search_ops={bs_ops:>2} (~log n = {predicted_bs:>4.1f})")
```

Output:

```
n=        8  merge_sort_ops=       24 (~n log n =        24)  binary_search_ops= 4 (~log n =  3.0)
n=       64  merge_sort_ops=      384 (~n log n =       384)  binary_search_ops= 7 (~log n =  6.0)
n=     1024  merge_sort_ops=    10240 (~n log n =     10240)  binary_search_ops=11 (~log n = 10.0)
n=  1000000  merge_sort_ops= 19951424 (~n log n =  19931569)  binary_search_ops=20 (~log n = 19.9)
```

For every power of 2 (`n = 8, 64, 1024`), `merge_sort_ops` lands *exactly* on the predicted `n log n` — because each of the `log n` merge levels touches all `n` elements once, so total touches are precisely `n * log2(n)` when `n` divides evenly at every level. At `n = 1,000,000` (not a power of 2), the recursive `n // 2` / `n - n // 2` split introduces uneven halves, so the measured count (19,951,424) comes in just under 0.1% above the idealized prediction (19,931,569) instead of matching exactly — still the same `Θ(n log n)` shape, just with the small constant-factor wobble Big-O allows for non-power-of-2 inputs. `binary_search_ops` consistently comes out to `⌊log2 n⌋ + 1` (4, 7, 11, 20 for the four sizes above) — one more than the raw `log2 n` prediction, because the recursion counts the final base-case comparison itself — confirming the Case 2 (balanced) Master Theorem result derived above.

## 5. Compare

- This lesson formalizes what **03-Recursion-Basics** showed informally with `fib(n)`: recursive time complexity comes from *how many subproblems* you create and *how the input shrinks*, not just "it calls itself."
- The `n^(log_b a)` calculation and the `log n` factor in Case 2 both rely on logarithm rules and geometric-series summation, covered next in **05-Math-Prerequisites-for-DSA**.
- The "when it doesn't apply" case (`T(n) = T(n-1) + O(n)`, giving O(n²)) is exactly the shape of a naive algorithm that peels off one element per call — contrast this with merge sort's `T(n/2)` shrinkage to see concretely why *halving* the input is so much more powerful than *decrementing* it.

## 6. Common Mistakes

- **Applying the Master Theorem to recurrences with a non-constant number of subproblems or non-factor shrinkage.** `T(n) = T(n-1) + O(n)` is *not* eligible — the input shrinks by a fixed amount (1), not a fixed factor. Plugging it into the Master Theorem's formula anyway gives nonsense.
- **Miscomparing f(n) against n^(log_b a) when they're asymptotically close (the Case 2 boundary).** For example, `f(n) = n log n` vs `n^(log_b a) = n` are *not* the same rate (the log factor matters) — this pushes you into Case 3, not Case 2. Sloppily treating "close" as "equal" leads to wrong answers right at this boundary.
- **Forgetting to check the regularity condition for Case 3.** Case 3 technically requires `a·f(n/b) ≤ c·f(n)` for some `c < 1` — most textbook problems satisfy this automatically, but it's worth knowing it exists rather than blindly applying Case 3 whenever `f(n)` merely "looks bigger."
- **Confusing `a` (number of subproblems) with the branching seen in the code superficially.** E.g., a function that makes 2 recursive calls but where one immediately returns due to a guard clause doesn't have `a = 2` in the meaningful sense — always double check what actually executes.
- **Solving for the wrong variable in `n^(log_b a)`** — mixing up `a` and `b` (e.g., computing `n^(log_a b)` instead) is an easy arithmetic slip that produces a completely different, wrong exponent.

## 7. Interview Angle

Recurrence relations come up whenever you propose a divide-and-conquer solution. Typical framings:

- "Write the recurrence for your algorithm, and solve it." — a direct test of the full pipeline: form the recurrence, then apply the Master Theorem or expand it by hand.
- "Why is merge sort O(n log n) but this other recursive approach is O(n²)?" — tests whether you can spot the difference between balanced splitting (`T(n/2)`) and unbalanced/decrementing splitting (`T(n-1)`).
- "Does the Master Theorem apply here?" — often asked as a trap when the candidate proposes a recurrence like `T(n) = T(n-1) + T(n-2) + O(1)` (naive Fibonacci) — the correct answer is "no, the Master Theorem doesn't cover this shape; it needs separate analysis (and here the answer is exponential)."
- Common variation: "What if we split into 3 parts instead of 2?" — tests whether you can recompute `n^(log_b a)` with different `a`/`b` values on the fly.

## 8. Memory Hook

**Compare f(n) — the "glue work" — against n^(log_b a) — the "leaf work": leaves win, it's a tie, or glue wins. And the Master Theorem only ever applies when the input shrinks by a *factor*, never when it shrinks by a fixed *amount*.**
