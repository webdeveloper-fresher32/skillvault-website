# Two's Complement and Signed Numbers — Complete Guide

## Table of Contents
1. [The Problem: Representing Negative Numbers in Binary](#1-the-problem-representing-negative-numbers-in-binary)
2. [Naive Approach: Sign-and-Magnitude (and Why It Fails)](#2-naive-approach-sign-and-magnitude-and-why-it-fails)
3. [Two's Complement — The Actual Solution](#3-twos-complement--the-actual-solution)
4. [Worked Examples](#4-worked-examples)
5. [Why Two's Complement Works So Well](#5-why-twos-complement-works-so-well)
6. [Overflow](#6-overflow)
7. [Where This Shows Up in Real Code](#7-where-this-shows-up-in-real-code)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Representing Negative Numbers in Binary

Binary digits are just 0s and 1s — there's no `-` symbol available in the hardware. Yet programs constantly need negative numbers (temperatures, account balances, array offsets, differences). CPUs solve this by dedicating a fixed number of bits (e.g., 8, 32, 64) to represent both positive and negative numbers within that fixed width, using an encoding scheme called **two's complement**.

```
An 8-bit unsigned byte:  represents 0 to 255        (2⁸ = 256 values)
An 8-bit signed byte:    represents -128 to 127      (same 256 values, half negative)
```

Same bit pattern, same number of values — just a different *interpretation* of what those bit patterns mean.

---

## 2. Naive Approach: Sign-and-Magnitude (and Why It Fails)

The obvious first idea: reserve the leftmost (most significant) bit as a sign flag — 0 for positive, 1 for negative — and use the rest for the magnitude.

```
0 000 0101  =  +5   (sign bit 0 = positive, magnitude 101 = 5)
1 000 0101  =  -5   (sign bit 1 = negative, magnitude 101 = 5)
```

This seems intuitive, but it's a poor fit for hardware for two reasons:

1. **Two representations of zero**: `0000 0000` (+0) and `1000 0000` (-0) — wasteful and confusing for comparisons.
2. **Addition doesn't just work**: you can't add `+5` and `-5` using ordinary binary addition and get `0` — the circuit needs special-case logic to detect signs and subtract instead of add. That means separate, more complex circuitry for addition and subtraction.

Real hardware wants **one addition circuit that works for everything** — that's what two's complement gives us.

---

## 3. Two's Complement — The Actual Solution

**Definition**: To negate a number in two's complement, invert all the bits (this is called the *one's complement*) and then add 1.

```
Step 1: Start with +5 in 8 bits:      0000 0101
Step 2: Invert every bit (NOT):        1111 1010    <- one's complement
Step 3: Add 1:                       + 0000 0001
                                      -----------
                                        1111 1011    <- this is -5 in two's complement
```

Verify: `1111 1011` interpreted back:
- Leftmost bit is 1 → negative.
- To find the magnitude, reverse the process: invert bits (`0000 0100`) then add 1 (`0000 0101` = 5).
- So `1111 1011` = **-5**. Confirmed.

### The Key Insight: The Leftmost Bit Has Negative Weight

In two's complement, instead of memorizing "invert and add 1" every time, you can read the value directly if you treat the **most significant bit as a negative power of 2**:

```
8-bit two's complement place values:
 -128   64   32   16   8   4   2   1

1111 1011:
  -128 + 64 + 32 + 16 + 8 + 0 + 2 + 1
  = -128 + 123
  = -5
```

This single change — giving the leftmost bit a *negative* weight instead of a sign flag — is the entire trick. Everything else (addition, subtraction, comparison circuits) works exactly like unsigned binary addition, no special cases needed.

---

## 4. Worked Examples

### Example A: Encode -20 in 8 bits

```
Step 1: +20 in binary:        0001 0100
Step 2: Invert all bits:      1110 1011
Step 3: Add 1:               +0000 0001
                              ----------
                               1110 1100   =  -20 in 8-bit two's complement
```

### Example B: Decode 1111 0110

```
Leftmost bit = 1 → negative.
Invert:   0000 1001
Add 1:    0000 1010  = 10
So original value = -10.

Or directly with negative place values:
 -128  64  32  16   8   4   2   1
   1    1   1   1   0   1   1   0
 -128+64+32+16+0+4+2+0 = -10   ✓ matches
```

### Example C: Addition "just works" — no special subtraction circuit needed

```
   5  =  0000 0101
 + -3  =  1111 1101   (two's complement of 3)
 ---------------------
        1 0000 0010

Discard the overflow carry bit (9th bit, doesn't fit in 8 bits): 0000 0010 = 2
5 + (-3) = 2  ✓ Correct — ordinary binary addition handled the "subtraction" automatically.
```

```python
>>> # Python ints are arbitrary precision, but we can simulate fixed-width two's complement:
>>> def to_signed_8bit(n):
...     n = n & 0xFF                 # keep only the lowest 8 bits
...     return n - 256 if n & 0x80 else n   # if sign bit set, subtract 256
...
>>> to_signed_8bit(0b11111011)
-5
>>> to_signed_8bit(0b00010100)
20
```

---

## 5. Why Two's Complement Works So Well

| Property | Sign-and-magnitude | Two's complement |
|----------|--------------------|--------------------|
| Representations of zero | Two (+0, -0) | One (`0000 0000`) |
| Addition circuit | Needs sign-checking logic | Same adder circuit as unsigned |
| Subtraction | Needs a separate circuit | `a - b` = `a + (-b)`, same adder |
| Range (n bits) | -(2ⁿ⁻¹-1) to +(2ⁿ⁻¹-1) | -2ⁿ⁻¹ to +(2ⁿ⁻¹-1) — one extra negative value |

This is why virtually every CPU architecture (x86, ARM, RISC-V) uses two's complement for signed integers — it's simpler in hardware and has no redundant zero.

---

## 6. Overflow

Overflow happens when the true mathematical result of an operation doesn't fit in the fixed number of bits available.

```
8-bit signed range: -128 to 127

  127        =  0111 1111
+   1        =  0000 0001
  ----------------------
  1000 0000  =  -128 in two's complement interpretation!

This is signed integer overflow: 127 + 1 "wrapped around" to -128
instead of the mathematically correct 128 (which doesn't fit in 8 bits).
```

This is exactly the class of bug behind real historical incidents (e.g., games where a character's health wrapped from -1 to 255 due to unsigned overflow, or Y2K38 — the 32-bit Unix timestamp overflow in 2038).

```python
>>> to_signed_8bit(0b01111111)   # 127
127
>>> to_signed_8bit((0b01111111 + 1) & 0xFF)   # simulate 127 + 1 overflowing in 8 bits
-128
```

Most high-level languages (Python, JavaScript numbers) hide this by using arbitrary-precision or 64-bit floats, but statically-typed/low-level languages (C, Java `int`, Rust unless using checked arithmetic) can silently overflow — a real source of security bugs (integer overflow → buffer overflow).

---

## 7. Where This Shows Up in Real Code

- **Java/C `int` overflow**: `Integer.MAX_VALUE + 1` silently becomes `Integer.MIN_VALUE`.
- **Database columns**: choosing `TINYINT` vs `INT` vs `BIGINT` is choosing a bit-width, which determines both the value range and whether overflow is even possible.
- **Security**: integer overflow bugs have caused real vulnerabilities (e.g., allocating a buffer sized from an overflowed length calculation).
- **Bitwise NOT (`~`) in Lesson 01**: `~12` in an 8-bit context gives `-13` specifically because of two's complement — that's why `~x` equals `-(x + 1)` in two's complement systems.

---

## 8. Hands-On Exercises

1. By hand, encode `-7` as an 8-bit two's complement number using the invert-and-add-1 method. Verify using the `to_signed_8bit` Python helper above (encode by computing `(-7) & 0xFF` and decoding it back).
2. Decode the 8-bit pattern `1000 0001` to its signed decimal value by hand, then verify with Python.
3. Explain, using the negative-place-value trick (§3), why `1111 1111` equals `-1` in two's complement — do the arithmetic.
4. Simulate 8-bit signed overflow in Python: compute `(120 + 10) & 0xFF` and decode it with `to_signed_8bit`. Is the result what you'd mathematically expect from `120 + 10`? Why not?
5. Research (or reason from what you now know) why an 8-bit signed range is `-128 to 127` rather than the symmetric `-127 to 127` — connect it back to the "only one zero" property.

---

## 9. Interview Q&A

**Q: How does a computer represent negative numbers?**
Answer: Using two's complement — to negate a number, invert all its bits and add 1. Equivalently, in an n-bit two's complement number the most significant bit carries a negative weight (-2ⁿ⁻¹) instead of being a plain sign flag. This lets the same binary adder circuit handle both addition and subtraction with no special-case logic.

**Q: Why not just use a sign bit (sign-and-magnitude) instead of two's complement?**
Answer: Sign-and-magnitude has two representations of zero (+0 and -0), which wastes a bit pattern and complicates equality checks, and it requires separate hardware logic for addition versus subtraction because you can't just add the raw bit patterns of a positive and negative sign-and-magnitude number and get the right answer. Two's complement has exactly one zero and reuses the same adder circuit for both operations.

**Q: What is integer overflow, and give a real consequence of it?**
Answer: Integer overflow happens when an arithmetic result exceeds the range representable by the fixed bit-width of the integer type, causing it to "wrap around" (e.g., `127 + 1` becomes `-128` in an 8-bit signed integer). Real consequences include the historic "Y2K38 problem" (32-bit Unix timestamps overflowing in 2038), and security vulnerabilities where an overflowed length calculation leads to undersized buffer allocation and a buffer overflow.

**Q: What is the range of an n-bit signed two's complement integer, and why is it asymmetric?**
Answer: The range is `-2ⁿ⁻¹` to `2ⁿ⁻¹ - 1`. It's asymmetric because there is only one representation of zero (unlike sign-and-magnitude), which "frees up" one extra bit pattern on the negative side — so there's one more negative value than positive value.

**Q: What does the bitwise NOT operator (`~x`) actually compute?**
Answer: `~x` flips every bit of `x` (one's complement). In a two's complement system this is mathematically equivalent to `-(x + 1)` — e.g., `~12` is `-13` — because flipping all bits is step one of two's complement negation (invert then add 1), so `~x = -x - 1`.

**Q: Why do Python's integers not have the overflow bugs that C or Java integers do?**
Answer: Python's `int` type is arbitrary-precision — it dynamically grows the number of bits used to store a value as needed, rather than being fixed at a hardware width like 32 or 64 bits. C and Java `int`/`long` types map directly to fixed-width CPU registers, so arithmetic that exceeds that fixed width wraps around (or is undefined behavior in C) instead of automatically growing.
