# Modular Arithmetic and Fast Exponentiation

## 1. Problem

Many competitive and interview problems ask for a count or a large computed value "modulo 10^9+7" (or some other prime). The reason isn't arbitrary: the true answer might genuinely be astronomically large (e.g. the number of ways to tile a board, or `2^n` for large `n`), too big to store or print exactly in a fixed-width integer, or even in reasonable time/memory at all. Taking every intermediate result modulo a fixed number `m` keeps every value bounded between `0` and `m-1`, while modular arithmetic's algebraic properties guarantee the *final* answer's remainder mod `m` is unaffected by *when* the mod is applied for `+`, `-`, and `×` — so it's always safe to reduce early and often. Separately, raising a number to a large power (`base^exp`) naively by multiplying `exp` times is too slow when `exp` is large; **fast exponentiation** (a divide-and-conquer trick) computes the same result in `O(log exp)` multiplications instead of `O(exp)`.

## 2. Analogy

Modular arithmetic is like a 12-hour clock: it doesn't matter whether you compute "9 o'clock + 40 hours" by adding all 40 hours one at a time or by reducing 40 mod 12 first and adding the leftover 4 — you land on the same hour either way. Taking `mod 10^9+7` after every operation is exactly "keep resetting the clock face instead of letting the hour count climb into the millions before you finally check what time it is" — the *final reading* is identical, but the intermediate numbers stay small and manageable throughout.

Fast exponentiation is like calculating compound growth by repeated doubling instead of repeated single-stepping: to compute `2^32`, instead of multiplying by 2 thirty-two times, square `2` to get `2^2`, square that to get `2^4`, square that to get `2^8`, and so on — five squarings reach `2^32`, because each squaring doubles the exponent covered so far, the same reason repeated halving of a sorted list (binary search) needs only `log n` steps instead of `n`.

## 3. Internal Flow

**Why mod 10^9+7.** It's a prime slightly larger than `10^9`, chosen because it fits comfortably in a standard 32-bit-adjacent range while still being large enough that the product of two values less than it (`< 10^9 * 10^9 = 10^18`) fits within a 64-bit integer in languages that have fixed-width integers — a practical engineering constraint from competitive programming judges, not a deep mathematical requirement. Its primality also matters for problems needing modular inverses (division under a modulus), though `+`, `-`, and `×` work correctly under *any* modulus.

**The rules, per operator** (with `m` the modulus):
- **Addition**: `(a + b) mod m == ((a mod m) + (b mod m)) mod m`.
- **Multiplication**: `(a * b) mod m == ((a mod m) * (b mod m)) mod m`.
- **Subtraction**: `(a - b) mod m == ((a mod m) - (b mod m)) mod m`, **but** the right-hand side can come out negative in languages (including Python, for user-derived expressions with negative operands) where subtraction of a larger mod-reduced value from a smaller one under the modulus doesn't self-correct — the safe form is `((a - b) % m + m) % m`, which shifts any negative remainder back into the `[0, m)` range. Python's built-in `%` operator actually already returns a non-negative result whenever the modulus `m` is positive (unlike C or Java, where `%` can return a negative result for a negative dividend), but writing the defensive `+ m) % m` form is still standard practice, both for portability of the reasoning to other languages and as a habit that doesn't rely on remembering Python's specific convention.
- **Division** is *not* a plain arithmetic operation under a modulus — it requires the modular inverse of the divisor (computed via Fermat's Little Theorem when `m` is prime: `a^-1 mod m == a^(m-2) mod m`), which is why fast exponentiation (below) is often needed even in problems that are "really" about division.

**Fast exponentiation (divide-and-conquer).** To compute `base^exp mod m`: if `exp == 0`, the answer is `1`. Otherwise, recursively compute `half = fast_pow(base, exp // 2, m)`, then:
- if `exp` is even, `base^exp = half * half`, so the answer is `(half * half) mod m`.
- if `exp` is odd, `base^exp = half * half * base`, so the answer is `(half * half mod m) * base mod m`.

Each recursive call halves `exp`, giving `O(log exp)` multiplications total instead of the `O(exp)` of multiplying by `base` one step at a time. Python's built-in three-argument `pow(base, exp, mod)` implements exactly this idea (in C, highly optimized) and is the practical, idiomatic way to do this in real code — the manual version exists to understand *why* it's fast and to reimplement the idea in languages or contexts without a built-in three-argument `pow`.

## 4. Example

```python
MOD = 10 ** 9 + 7

def fast_pow(base, exp, mod=MOD):
    base %= mod
    if exp == 0:
        return 1
    half = fast_pow(base, exp // 2, mod)
    half_squared = (half * half) % mod
    if exp % 2 == 0:
        return half_squared
    else:
        return (half_squared * base) % mod

base, exp = 7, 20
manual_result = fast_pow(base, exp, MOD)
builtin_result = pow(base, exp, MOD)

print(f"fast_pow({base}, {exp}, mod={MOD}) = {manual_result}")
print(f"pow({base}, {exp}, {MOD})        = {builtin_result}")
print(f"Results agree: {manual_result == builtin_result}")

# Show naive (no-mod-until-end) growth vs modded growth
a, b, m = 999999937, 999999937, MOD
naive = a * b  # huge intermediate
modded = (a % m) * (b % m) % m
print(f"\nNaive a*b has {len(str(naive))} digits: {naive}")
print(f"Modded (a%m)*(b%m)%m = {modded}")
print(f"naive % m == modded: {naive % m == modded}")

# Negative-result handling under a modulus
x, y = 3, 10
neg = (x - y) % m  # Python's % already returns non-negative for positive m
neg_defensive = ((x - y) % m + m) % m
print(f"\n(3 - 10) % {m} in Python = {neg}  (Python's % is already non-negative here)")
print(f"((x - y) % m + m) % m       = {neg_defensive}  (defensive form, same result in Python)")
```

Executed output:

```
fast_pow(7, 20, mod=1000000007) = 739066146
pow(7, 20, 1000000007)        = 739066146
Results agree: True

Naive a*b has 18 digits: 999999874000003969
Modded (a%m)*(b%m)%m = 4900
naive % m == modded: True

(3 - 10) % 1000000007 in Python = 1000000000  (Python's % is already non-negative here)
((x - y) % m + m) % m       = 1000000000  (defensive form, same result in Python)
```

Tracing `fast_pow(7, 20)`: `exp=20` is even, so it needs `half = fast_pow(7, 10)`; `10` is even, needs `half = fast_pow(7, 5)`; `5` is odd, needs `half = fast_pow(7, 2)`; `2` is even, needs `half = fast_pow(7, 1)`; `1` is odd, needs `half = fast_pow(7, 0) = 1`, so `fast_pow(7,1) = (1*1 mod m) * 7 mod m = 7`. Unwinding: `fast_pow(7,2) = 7*7 = 49`; `fast_pow(7,5) = (49*49 mod m) * 7 mod m = 2401 * 7 = 16807`; `fast_pow(7,10) = 16807*16807 mod m = 282475249`; `fast_pow(7,20) = 282475249*282475249 mod m = 739066146` — matching both the manual result and Python's built-in `pow`, confirming the divide-and-conquer logic is correct. Only about `log2(20) ≈ 5` levels of recursion were needed, versus 20 sequential multiplications for the naive approach.

The naive `a * b` (both operands just under `10^9`) produces an 18-digit intermediate — nowhere near unmanageable in Python, but exactly the kind of blowup that overflows a fixed-width 32-bit or even 64-bit integer in other languages after a few chained multiplications; reducing each operand mod `m` first (`(a % m) * (b % m) % m`) gives the identical final remainder (`4900 == naive % m`) while the intermediate product stays under `m^2 ≈ 10^18` instead of growing further with every additional multiplication in a longer chain.

## 5. Compare

| Approach | Time | Notes |
|---|---|---|
| Naive repeated multiplication (`base^exp`) | O(exp) | Multiplies by `base` one step at a time; intractable for `exp` in the millions/billions |
| Manual fast exponentiation (divide-and-conquer) | O(log exp) | Demonstrates the mechanism; useful when a language lacks a built-in modular power |
| Python's `pow(base, exp, mod)` | O(log exp) | Same algorithm, implemented in C — the practical default in real code |
| Applying `% mod` only at the very end | O(exp) time *and* unbounded intermediate size | Defeats the entire purpose of working under a modulus — the huge intermediate value is exactly what modular reduction is meant to avoid |

## 6. Common Mistakes

- Forgetting to apply the modulus after every multiplication (only applying it once at the end) — this lets intermediate values grow to their full, unreduced size, which in Python is merely slow and memory-heavy but in a fixed-width language causes silent overflow and an incorrect final answer.
- Not handling negative intermediate results correctly after a subtraction under a modulus — the defensive form `((x - y) % m + m) % m` guards against this uniformly; relying on the host language's specific `%` convention (as Python's happens to already be non-negative for a positive modulus) is a fragile habit that breaks when porting the same logic to a language like C or Java where `%` can return negative results.
- Attempting to "divide" under a modulus with plain `/ ` or `//` instead of multiplying by the modular inverse — division isn't a native operation under a modulus and silently produces a wrong (often non-integer-truncated or simply incorrect) result.
- Using a non-prime modulus while relying on Fermat's Little Theorem for modular inverses — that theorem specifically requires `m` to be prime; a composite modulus needs the extended Euclidean algorithm instead.
- Recomputing `fast_pow` from scratch inside a loop over many bases/exponents when Python's built-in `pow(base, exp, mod)` (already O(log exp) and implemented in C) would be both simpler and faster in practice — the manual version is for understanding the mechanism, not for reaching for by default in real code.

## 7. Interview Angle

"Compute X mod 10^9+7" is one of the most common phrasings in combinatorics/DP interview and contest problems specifically because it forces the candidate to reduce intermediate values throughout the computation, not just format the final answer — interviewers will often probe whether a candidate applies the modulus inside a DP transition's every addition/multiplication or only remembers it as an afterthought. Fast exponentiation itself is a frequent standalone question (implement `pow(base, exp, mod)` from scratch) specifically to test whether a candidate recognizes the divide-and-conquer halving trick, since the naive loop-based version is an easy but suboptimal fallback that most candidates will write first.

## 8. Memory Hook

"**Mod early, mod often** — never let a number outgrow the clock face before checking the time." And for fast exponentiation: "**square to double the exponent covered**" — the same halving idea as binary search, just applied to how many multiplications a power needs instead of how many elements a search needs to check.
