# GCD, LCM, and the Sieve of Eratosthenes

## 1. Problem

Two recurring number-theory needs show up across a huge range of problems: (1) reducing fractions, finding a common "step size," or determining how two quantities relate — which needs the **greatest common divisor (GCD)** and, from it, the **least common multiple (LCM)**; and (2) quickly identifying which numbers up to some bound `n` are prime — needed for problems about factorization, prime-counting, or anything built on primality. Computing GCD by brute-force trial division, or testing each number up to `n` for primality independently, both work but are needlessly slow when `n` is large. Euclid's algorithm and the Sieve of Eratosthenes are the standard fast alternatives for each.

## 2. Analogy

**GCD via Euclid's algorithm** is like the classic technique for finding the largest square tile that evenly tiles a rectangular floor of size `a x b` without cutting any tile: repeatedly cut off the largest square possible from the current rectangle (size `min(a,b) x min(a,b)`), and recurse on the leftover strip. The leftover strip after cutting `b`-sized squares from an `a x b` rectangle is exactly `a mod b` wide — which is precisely why `gcd(a, b) = gcd(b, a mod b)` works: the tile size that fits the original rectangle perfectly is the same size that fits the leftover strip perfectly, and the process terminates the moment there's no leftover strip at all (remainder 0).

**The Sieve of Eratosthenes** is like crossing out multiples on a printed hundred-chart with a pencil: start at 2, and cross out every second number (4, 6, 8, ...) since they're all divisible by 2; move to the next number *not yet crossed out* (3), and cross out every third number (6, 9, 12, ...); the next surviving number (5) gets the same treatment, and so on. Whatever numbers survive the entire pass — never crossed out by any smaller number — are exactly the primes, because a composite number always has *some* prime factor smaller than or equal to its square root that will have crossed it out along the way.

## 3. Internal Flow

**Euclid's GCD**, recursively: `gcd(a, b) = a` if `b == 0`, else `gcd(b, a % b)`. Each recursive call replaces the pair `(a, b)` with the strictly smaller pair `(b, a % b)`, and this terminates because `a % b < b` always — the second element strictly shrinks every call, guaranteeing termination in `O(log(min(a,b)))` steps (proven via Fibonacci-number worst-case analysis, since consecutive Fibonacci numbers are the slowest-shrinking case for Euclid's algorithm).

**LCM from GCD.** The identity `gcd(a,b) * lcm(a,b) = a * b` rearranges to `lcm(a,b) = (a * b) // gcd(a,b)`. In practice this is written as `(a // gcd(a,b)) * b` — dividing by the GCD *before* multiplying by `b`, not after — because `a // gcd(a,b)` is guaranteed to divide evenly (GCD divides `a` by definition) and this ordering keeps the largest intermediate value smaller than computing the raw product `a * b` first.

**Sieve of Eratosthenes.** Build a boolean array `is_prime[0..n]`, all initialized `True` except indices 0 and 1 (neither prime). For each `p` from 2 up to `sqrt(n)`: if `is_prime[p]` is still `True`, mark every multiple of `p` starting from `p*p` (not `2*p`) as composite — `p*p, p*p+p, p*p+2p, ...` up to `n`. Starting from `p*p` rather than `2*p` is safe because any smaller multiple of `p` (like `2p`, `3p`, ..., up to `(p-1)*p`) already has a prime factor smaller than `p` and was therefore already marked composite by that smaller prime in an earlier iteration. After the full pass, whatever indices remain `True` are exactly the primes up to `n`. The outer loop only needs to run up to `sqrt(n)` because any composite number `<= n` must have at least one prime factor `<= sqrt(n)` (if both factors of a composite were `> sqrt(n)`, their product would exceed `n`).

## 4. Example

```python
def gcd(a, b):
    print(f"gcd({a}, {b})")
    if b == 0:
        return a
    return gcd(b, a % b)

def lcm(a, b):
    return (a // gcd(a, b)) * b

print("Euclid's GCD trace for gcd(48, 18):")
result = gcd(48, 18)
print(f"gcd(48, 18) = {result}")
print(f"lcm(48, 18) = {lcm(48, 18)}")

def sieve_of_eratosthenes(n):
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    marked_by = {}

    for p in range(2, int(n ** 0.5) + 1):
        if is_prime[p]:
            for multiple in range(p * p, n + 1, p):
                if is_prime[multiple]:
                    marked_by[multiple] = p
                is_prime[multiple] = False

    primes = [i for i in range(2, n + 1) if is_prime[i]]
    return primes, marked_by

n = 30
primes, marked_by = sieve_of_eratosthenes(n)
print(f"\nPrimes up to {n}: {primes}")
print("Composite numbers and the prime that first marked them:")
for num in sorted(marked_by):
    print(f"  {num} marked composite by {marked_by[num]}")
```

Executed output:

```
Euclid's GCD trace for gcd(48, 18):
gcd(48, 18)
gcd(18, 12)
gcd(12, 6)
gcd(6, 0)
gcd(48, 18) = 6
gcd(48, 18)
gcd(18, 12)
gcd(12, 6)
gcd(6, 0)
lcm(48, 18) = 144

Primes up to 30: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
Composite numbers and the prime that first marked them:
  4 marked composite by 2
  6 marked composite by 2
  8 marked composite by 2
  9 marked composite by 3
  10 marked composite by 2
  12 marked composite by 2
  14 marked composite by 2
  15 marked composite by 3
  16 marked composite by 2
  18 marked composite by 2
  20 marked composite by 2
  21 marked composite by 3
  22 marked composite by 2
  24 marked composite by 2
  25 marked composite by 5
  26 marked composite by 2
  27 marked composite by 3
  28 marked composite by 2
  30 marked composite by 2
```

Tracing `gcd(48, 18)`: `48 % 18 = 12`, so `gcd(48,18) -> gcd(18,12)`; then `18 % 12 = 6`, so `-> gcd(12,6)`; then `12 % 6 = 0`, so `-> gcd(6,0)`, which returns `6` immediately since the second argument is 0. Four calls total, terminating fast even though `48` and `18` aren't small. The trace repeats identically right after because `lcm(48, 18)` calls `gcd(48, 18)` again internally (the same `print` inside `gcd` fires a second time) before computing `(48 // 6) * 18 = 8 * 18 = 144` — matching the printed `lcm(48, 18) = 144`.

Tracing the sieve for `n = 30`: `p = 2` marks `4, 6, 8, ..., 30` starting from `2*2=4` (all shown as "marked by 2" above); `p = 3` marks starting from `3*3=9`, i.e. `9, 12, 15, ...` — note `6` was already marked by `2` and is correctly *not* re-attributed to 3, since the code only records `marked_by[multiple] = p` the first time a number is caught; `p = 5` marks starting from `5*5=25`, i.e. just `25` within range (its only other multiple, `10, 15, 20`, were already caught by 2 or 3). The outer loop stops after `p=5` since `int(30**0.5)+1 = 6`, and the surviving unmarked numbers, `[2, 3, 5, 7, 11, 13, 17, 19, 23, 29]`, are exactly the primes up to 30.

## 5. Compare

| Task | Naive approach | Faster approach | Why faster |
|---|---|---|---|
| GCD of `a, b` | Trial division checking every `d` up to `min(a,b)` — O(min(a,b)) | Euclid's algorithm — O(log(min(a,b))) | Each step reduces the pair by taking a remainder, not by decrementing by 1 |
| LCM of `a, b` | Enumerate multiples of `a` until one is divisible by `b` | `(a // gcd(a,b)) * b` | Direct formula, reuses the already-fast GCD |
| Primality up to `n` | Test each number individually via trial division — O(n·sqrt(n)) total | Sieve of Eratosthenes — O(n log log n) | Marks composites in bulk per prime rather than re-testing each number from scratch |

The sieve wins specifically when *all* primes up to `n` are needed at once; for testing a single large number's primality in isolation, trial division up to `sqrt(n)` (or a probabilistic test for very large numbers) is more appropriate than building a whole sieve array.

## 6. Common Mistakes

- Computing `a * b` before dividing by `gcd(a,b)` when computing LCM — on very large numbers this risks overflow in fixed-width languages; the fix, `(a // gcd(a,b)) * b`, divides first so the intermediate product stays smaller. Python's integers don't overflow, but this is still good practice for keeping numbers manageable and for writing overflow-safe code by habit.
- Starting the sieve's marking loop from `2 * p` instead of `p * p` — this is not a correctness bug (both give the right final answer), but it's a missed optimization, since every multiple of `p` below `p*p` is guaranteed to already have been marked by a smaller prime factor.
- Forgetting to initialize `is_prime[0]` and `is_prime[1]` to `False` explicitly — neither 0 nor 1 is prime, but a naive "all True" initialization will misreport them if the exclusion is skipped.
- Running the sieve's outer loop all the way to `n` instead of stopping at `sqrt(n)` — not wrong, just unnecessary extra iterations, since no composite `<= n` can have its smallest prime factor above `sqrt(n)`.
- Assuming `gcd(a, b)` requires `a >= b` — Euclid's algorithm self-corrects on the first call regardless of order (`gcd(b, a % b)` when `a < b` just becomes `gcd(b, a)` on the next step since `a % b == a` when `a < b`), so no pre-sorting is needed.

## 7. Interview Angle

GCD/LCM and the sieve are common not because they're hard, but because they're prerequisites baked into harder problems (simplifying fractions, finding a repeating cycle length, factorization-based problems) — an interviewer expects them recalled instantly and correctly, without re-deriving Euclid's algorithm live. Being asked to state the sieve's complexity (`O(n log log n)`) and explain *why* the `log log n` factor appears (each prime's inner loop runs `n/p` times, and the sum of `1/p` over primes grows like `log log n`) is a common depth-check follow-up.

## 8. Memory Hook

"**GCD shrinks by remainder, not by one**" — Euclid's algorithm is fast because `a % b` is a big jump down, not a decrement. And for the sieve: "**start crossing out at p squared, not two p**" — anything smaller was already some other prime's job.
