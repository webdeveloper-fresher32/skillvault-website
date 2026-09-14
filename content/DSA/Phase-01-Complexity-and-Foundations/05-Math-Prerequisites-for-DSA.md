# Math Prerequisites for DSA

## 1. Problem

Complexity analysis and algorithm design lean on a small toolkit of math that shows up over and over: logarithms (why binary search is O(log n), why balanced trees have O(log n) height), summations (why a nested loop is O(n²) instead of O(n)), and combinatorics (why generating all subsets is O(2ⁿ), why counting arrangements matters for backtracking). If these tools are rusty, you'll be able to *recognize* named complexity classes but unable to *derive* a new one from scratch when a problem doesn't match a textbook example — which is exactly what interviews test.

This lesson isn't about being a mathematician; it's about having three or four formulas so automatic that you can use them mid-interview to justify a complexity claim on the spot, the same way you'd use basic arithmetic without thinking about it.

## 2. Analogy

Think of these formulas as a mechanic's core wrench set — you don't need every tool in the shop, just the handful that fit the bolts you see on almost every job. Logarithms are the wrench for "how many times can I halve this?" questions. Summation formulas are the wrench for "I have a loop whose work changes every iteration — what's the total?" questions. Combinatorics is the wrench for "how many ways can I arrange or choose these things?" questions, which shows up whenever you're counting the *size of a search space* (critical for backtracking and DP later in this course).

## 3. Internal Flow

**Logarithm rules used in complexity analysis:**

- `log(a * b) = log(a) + log(b)` — turns multiplication inside a log into addition, useful for simplifying expressions like `log(n²) = 2 log(n)`.
- `log(a / b) = log(a) - log(b)`.
- `log_b(x) = log_k(x) / log_k(b)` (change of base) — this is *why* the base of a logarithm doesn't matter for Big-O: converting from base 2 to base 10 (or any base) only multiplies by a constant factor (`1 / log_k(b)`), and Big-O ignores constant factors. So `O(log₂ n)` and `O(log₁₀ n)` are the *same* complexity class, always written simply as `O(log n)`.

**Summation formulas used to derive complexities:**

- **Sum of the first n integers:** `1 + 2 + 3 + ... + n = n(n+1)/2`, which is `Θ(n²)`. This is the formula behind any nested loop where the inner loop's range depends on the outer loop's counter (like `for j in range(i)`).
- **Sum of a geometric series:** `1 + r + r² + ... + r^(k-1) = (r^k - 1)/(r - 1)` for `r ≠ 1`. When `r = 2`, this sum is `2^k - 1` — this is exactly the formula that showed the dynamic array's resize costs (`1 + 2 + 4 + 8 + ... `) sum to roughly `2n`, giving O(1) amortized append cost (see **02-Time-and-Space-Complexity-Analysis**).

**Basic combinatorics needed for later backtracking/DP phases:**

- **nPr (permutations)** — the number of ways to *arrange* r items out of n, where order matters: `nPr = n! / (n-r)!`. This is why generating all orderings of n items (the traveling-salesman-style brute force) is O(n!) — you're computing `nPn = n!`.
- **nCr (combinations)** — the number of ways to *choose* r items out of n, where order does **not** matter: `nCr = n! / (r! * (n-r)!)`. This is why generating all subsets of size r out of n items has `nCr` possibilities, and why generating *all* subsets (any size) of n items is `2ⁿ` (the sum of `nCr` for every r from 0 to n).

## 4. Example

Let's derive, step by step with real algebra, the total operation count of this nested loop:

```python
def count_pairs(n):
    """for i in range(n): for j in range(i, n): ... (does O(1) work per iteration)"""
    count = 0
    for i in range(n):
        for j in range(i, n):
            count += 1  # one "unit operation"
    return count

for n in [5, 10, 100]:
    print(f"n={n:>4}  measured={count_pairs(n):>6}  n(n+1)/2={n*(n+1)//2:>6}")
```

Output:

```
n=   5  measured=    15  n(n+1)/2=    15
n=  10  measured=    55  n(n+1)/2=    55
n= 100  measured=  5050  n(n+1)/2=  5050
```

Here's the derivation that predicts this exactly:

1. When `i = 0`, the inner loop runs `range(0, n)` → `n` iterations.
2. When `i = 1`, the inner loop runs `range(1, n)` → `n - 1` iterations.
3. When `i = 2`, the inner loop runs `range(2, n)` → `n - 2` iterations.
4. ...continuing until `i = n - 1`, the inner loop runs `range(n-1, n)` → `1` iteration.
5. Total iterations = `n + (n-1) + (n-2) + ... + 1` = the sum of the first `n` integers, written in reverse order.
6. By the summation formula, `1 + 2 + ... + n = n(n+1)/2`.
7. So `count_pairs(n)` performs exactly `n(n+1)/2` unit operations — which is `Θ(n²)` (the `n(n+1)/2` simplifies to `n²/2 + n/2`, and Big-O drops the lower-order `n/2` term and the constant factor `1/2`, leaving `O(n²)`).

The measured output matches `n(n+1)/2` exactly for every `n` tested, confirming the algebra.

## 5. Compare

- The summation formula here is the *exact* tool used informally in **02-Time-and-Space-Complexity-Analysis** to explain why `for j in range(i)` nested in `for i in range(n)` is O(n²) total, not O(n) per call — this lesson supplies the algebra that lesson only asserted.
- The change-of-base rule here formalizes the claim from **01-Big-O-Big-Theta-Big-Omega** that "the base of a logarithm doesn't matter for Big-O" — this lesson shows *why*, and also flags exactly where that claim stops being safe to use (see Common Mistakes below).
- The geometric series formula here is the same one that proved amortized O(1) `append` cost in **02-Time-and-Space-Complexity-Analysis**.
- Combinatorics (nCr, nPr) previewed here becomes essential once the course reaches its Backtracking and Dynamic Programming phases, where counting the size of a search space (subsets, permutations, subsequences) determines whether a brute-force approach is even feasible.

## 6. Common Mistakes

- **Assuming log base doesn't matter for Big-O, and then misapplying that inside exact (non-asymptotic) calculations.** It's true that `O(log₂ n) = O(log₁₀ n) = O(log n)` for asymptotic purposes — but if a question asks for an *exact* number (e.g., "exactly how many comparisons does binary search do on 1,000,000 elements?"), you must use the correct base (`log₂` for binary search, since it halves the search space) — swapping in `log₁₀` there would give a wrong exact answer, even though both are "O(log n)".
- **Misapplying the summation formula's bounds.** Using `n(n+1)/2` when the loop actually runs from `0` to `n-1` (sum `= n(n-1)/2`) versus `1` to `n` (sum `= n(n+1)/2`) — an off-by-one in which formula variant applies, common enough to always double check with a small `n` by hand.
- **Confusing nPr and nCr.** Using the permutation formula when order doesn't matter (overcounting by a factor of `r!`), or vice versa — always ask explicitly "does swapping two chosen items count as a different result?" before picking the formula.
- **Forgetting that `2ⁿ` (all subsets) and `n!` (all permutations) are different, both very large, complexity classes** — mixing them up when estimating whether a brute-force approach is feasible for a given `n` (e.g., `2^20` ≈ 1 million is often fine; `20!` is astronomically larger and never fine).
- **Trying to apply exact algebraic summation formulas to recurrences instead of straight loops.** Sums of arithmetic/geometric series work directly on loop-based iteration counts; recursive call counts need the recurrence-relation tools from the previous lesson instead.

## 7. Interview Angle

Math prerequisites rarely get asked about directly and explicitly — instead, they surface as the justification you're expected to give on the fly:

- "Can you prove that's O(n²)?" after you've stated a complexity for a nested loop — the expected answer is exactly the sum-of-first-n-integers derivation shown above, not just "trust me."
- "How many subsets/subsequences are there?" in a backtracking problem — expects an instant `2ⁿ` (or `nCr` for fixed-size subsets) without hesitation, since this determines whether brute force is viable before you even design the algorithm.
- "Does the base of the logarithm matter here?" — tests whether you know it doesn't matter for Big-O but *does* matter if asked for an exact operation count.
- Common variation: "Given n choices at each of k steps, how many total possibilities are there?" — tests basic multiplicative counting (`n^k`), a close cousin of the combinatorics covered here, frequently seen in backtracking template problems.

## 8. Memory Hook

**Log rules turn multiplication into addition and hide the base behind a constant; sum of first n integers is "n(n+1)/2, the classic triangle number"; and whenever you're counting "how many ways," ask first whether order matters — that single question chooses between nPr and nCr.**
