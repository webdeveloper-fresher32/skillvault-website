# Bit Manipulation Basics

## 1. Problem

Every integer is, underneath, a sequence of binary digits (bits). Most of the time that representation is invisible — code just adds and compares numbers — but a specific family of problems is dramatically easier (and faster) to solve by operating directly on those bits: checking whether a number is even, counting how many "on" switches a permission flag represents, finding the one element that doesn't have a pair in an otherwise-paired array, or packing many small yes/no facts into a single machine word instead of an array of booleans. The five bitwise operators (`&`, `|`, `^`, `~`, and the shifts `<<`/`>>`) are the vocabulary for this, and a handful of idioms built from them — testing a bit, setting a bit, clearing a bit, toggling a bit, and dropping the lowest set bit — cover the overwhelming majority of interview questions in this space.

## 2. Analogy

Think of an integer as a row of light switches on a wall panel, one switch per bit, numbered from the right starting at 0. "Is switch 3 on?" is checking a bit. "Turn switch 3 on, leave the rest alone" is setting a bit. "Turn switch 3 off, leave the rest alone" is clearing a bit. "Flip whichever state switch 3 is currently in" is toggling a bit. AND is "both switches must be on for the result switch to be on," OR is "either switch on turns the result on," and XOR is "the result switch is on exactly when the two input switches disagree." None of this requires opening the panel and rewiring it — each operation touches only the switches it needs to, which is exactly why bitwise tricks are fast: they're O(1) hardware-level operations, not loops.

## 3. Internal Flow

**The five operators.** Given integers `a` and `b`, bit by bit:
- `a & b` (AND): result bit is 1 only where both `a` and `b` have a 1.
- `a | b` (OR): result bit is 1 where at least one of `a`, `b` has a 1.
- `a ^ b` (XOR): result bit is 1 where exactly one of `a`, `b` has a 1 (they differ).
- `~a` (NOT): flips every bit of `a`. In Python, integers are arbitrary-precision and signed via an implicit infinite two's-complement representation, so `~a` evaluates to `-a - 1` (e.g. `~5 == -6`), which reads differently from a fixed-width language.
- `a << k` / `a >> k` (shifts): shift every bit of `a` left/right by `k` positions. `a << k` is equivalent to `a * 2**k`; `a >> k` (for non-negative `a`) is equivalent to `a // 2**k`.

**The core idioms**, with bit 0 defined as the least significant (rightmost) bit:
- **Check bit `i`**: `(n >> i) & 1` or equivalently `n & (1 << i) != 0` — shift the bit of interest down to position 0 and mask everything else off, or build a mask with only bit `i` set and AND it in.
- **Set bit `i`** (force it to 1): `n | (1 << i)` — OR in a mask that has a 1 only at position `i`; OR-ing with 0 elsewhere leaves those bits untouched.
- **Clear bit `i`** (force it to 0): `n & ~(1 << i)` — AND with a mask that's 0 only at position `i` and 1 everywhere else, so every other bit passes through unchanged and bit `i` is forced off.
- **Toggle bit `i`**: `n ^ (1 << i)` — XOR-ing a bit with 1 flips it, XOR-ing a bit with 0 leaves it, so this flips exactly bit `i`.
- **Drop the lowest set bit**: `n & (n - 1)`. Subtracting 1 from `n` flips the lowest set bit to 0 and flips every bit below it (which were all 0) to 1; ANDing that back with the original `n` keeps every higher bit identical, zeroes the lowest set bit, and zeroes out all the now-mismatched lower bits — net effect: exactly one bit (the lowest set one) disappears. Repeating this until `n` reaches 0 counts set bits in exactly as many iterations as there are set bits, rather than looping over every bit position.
- **XOR to find the unique element**: XOR is commutative, associative, and `x ^ x == 0`, `x ^ 0 == x`. So XOR-ing an entire array where every value appears exactly twice except one cancels every paired value down to 0, leaving only the unpaired value.

## 4. Example

```python
def count_set_bits(n):
    count = 0
    steps = []
    while n:
        steps.append(bin(n))
        n = n & (n - 1)
        count += 1
    return count, steps

n = 45  # 0b101101
count, steps = count_set_bits(n)
print(f"n = {n} = {bin(n)}")
print("Steps (n after each n & (n-1)):", steps)
print(f"Set bit count: {count}")

def single_number(nums):
    result = 0
    for num in nums:
        result ^= num
    return result

nums = [4, 1, 2, 1, 2]
print(f"\nnums = {nums}")
print(f"Single (non-duplicated) number: {single_number(nums)}")
```

Executed output:

```
n = 45 = 0b101101
Steps (n after each n & (n-1)): ['0b101101', '0b101100', '0b101000', '0b100000']
Set bit count: 4

nums = [4, 1, 2, 1, 2]
Single (non-duplicated) number: 4
```

Tracing `count_set_bits(45)`: `45 = 0b101101` has bits set at positions 0, 2, 3, 5. Each `n & (n-1)` strips exactly the lowest set bit: `0b101101 -> 0b101100` (dropped bit 0), `-> 0b101000` (dropped bit 2), `-> 0b100000` (dropped bit 3), and one more (not printed, since the loop stops when `n` becomes 0) drops bit 5, landing on `0`. Four iterations, four set bits — matching `bin(45).count('1')` exactly, but without scanning every one of the (in principle unbounded, in practice ~6) bit positions individually.

For `single_number`, XOR-ing `[4, 1, 2, 1, 2]` left to right: `4^1=5`, `5^2=7`, `7^1=6`, `6^2=4`. The two `1`s cancel each other (`1^1=0`) and the two `2`s cancel each other, leaving only `4` — the element without a pair.

## 5. Compare

| Idiom | Expression | Typical use |
|---|---|---|
| Check bit `i` | `(n >> i) & 1` | Reading one flag out of a packed integer |
| Set bit `i` | `n \| (1 << i)` | Turning on one permission/flag |
| Clear bit `i` | `n & ~(1 << i)` | Turning off one permission/flag |
| Toggle bit `i` | `n ^ (1 << i)` | Flipping a single switch state |
| Drop lowest set bit | `n & (n - 1)` | Counting set bits in O(popcount(n)) instead of O(bit-width) |
| Find the unpaired element | XOR of the whole array | O(n) time, O(1) space vs. a hash-set approach's O(n) space |

Against the "obvious" alternatives — a Python `set()` to find the unpaired element, or a loop checking `n % 2` and `n //= 2` to count bits — the bitwise versions are asymptotically similar in the worst case (`n & (n-1)` is still up to O(bit-width) iterations for a number with every bit set) but constant-factor faster, use O(1) auxiliary space instead of a hash set, and are the expected vocabulary in interviews where "bit manipulation" is explicitly the topic being tested.

## 6. Common Mistakes

- Forgetting that Python integers are arbitrary-precision: there's no fixed-width overflow or wraparound like in C/Java (a 32-bit int overflowing back to negative), so bit tricks that lean on a *known* word size (e.g. "the sign bit is bit 31") need an explicit mask like `n & 0xFFFFFFFF` in Python to behave the way they would in a fixed-width language — otherwise `~n` silently becomes a large negative number instead of a wraparound positive one.
- Off-by-one in bit-index math: bit 0 is the least significant (rightmost) bit, not bit 1 — `1 << 0` is `1` (only the first bit), and a common bug is writing `1 << i` when the intent was "the `i`-th bit from 1," which is actually `1 << (i - 1)`.
- Confusing `n & (n - 1)` (drops the lowest set bit) with `n & -n` (isolates the lowest set bit) — they solve related but different problems and are easy to swap by mistake.
- Using `~n` expecting a fixed-width bitwise complement (e.g. all 1s becoming all 0s) when Python's `~n` is really `-n - 1` over an unbounded signed representation.
- Building a bitmask with `1 << i` where `i` is itself derived from a wrong base (e.g. 1-indexed input) without adjusting — silently tests or sets the wrong bit entirely.

## 7. Interview Angle

Bit manipulation questions are popular precisely because they have a small, well-known idiom set — interviewers are typically checking whether you know `n & (n-1)` for popcount, XOR-cancellation for "find the unique/missing element," and the check/set/clear/toggle idioms, rather than expecting you to derive them from scratch under pressure. Being able to state *why* an idiom works (not just recite it) — e.g. explaining the two's-complement reasoning behind `n & (n-1)` — is usually what separates a "knows the trick" answer from a "understands bits" answer, and interviewers will often follow up with a fixed-width variant ("what if this were a 32-bit unsigned integer in Java?") specifically to see if the arbitrary-precision assumption trips you up.

## 8. Memory Hook

"**A**ND needs **both**, **O**R needs **either**, **X**OR needs **odd-one-out**" — and "`n & (n-1)` **knocks off the last light still on**," one lowest set bit per call, which is the single idiom worth memorizing cold since it underlies popcount, power-of-two checks (`n & (n-1) == 0`), and more advanced bitmask techniques covered next.
