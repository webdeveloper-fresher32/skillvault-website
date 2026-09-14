# Floating-Point Representation — Complete Guide

## Table of Contents
1. [The Problem: Representing Fractions in Binary](#1-the-problem-representing-fractions-in-binary)
2. [IEEE-754: The Standard Every Language Uses](#2-ieee-754-the-standard-every-language-uses)
3. [Worked Example: Encoding 0.15625](#3-worked-example-encoding-015625)
4. [Why 0.1 + 0.2 != 0.3](#4-why-01--02--03)
5. [Special Values](#5-special-values)
6. [How to Actually Handle Money and Precision-Sensitive Math](#6-how-to-actually-handle-money-and-precision-sensitive-math)
7. [Where This Shows Up in Real Code](#7-where-this-shows-up-in-real-code)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Representing Fractions in Binary

Just like `1/3` can't be written exactly in decimal (`0.3333...` repeats forever), many simple decimal fractions **can't be written exactly in binary** either. `0.1` in decimal is one of them:

```
0.1 (decimal) in binary =  0.0001100110011001100110011... (repeats forever)
```

A computer only has a finite number of bits to store a number, so this infinitely repeating binary fraction must be **truncated/rounded** to fit — meaning the value stored is *approximately* 0.1, not exactly 0.1. This single fact is the root cause of nearly all "floating point weirdness" bugs.

---

## 2. IEEE-754: The Standard Every Language Uses

Almost every language (Python `float`, JavaScript `number`, Java `double`, C `double`) uses the **IEEE-754** standard to represent non-integer numbers. It's essentially binary scientific notation. A 64-bit "double precision" float splits its 64 bits into three fields:

```
 Bit:   63        62 ─────────────── 52   51 ─────────────────────────────── 0
       ┌───┬─────────────────────────┬──────────────────────────────────────┐
       │ S │      Exponent (11 bits)  │          Mantissa / Fraction (52 bits) │
       └───┴─────────────────────────┴──────────────────────────────────────┘
        1 bit         11 bits                        52 bits

  S         = sign (0 = positive, 1 = negative)
  Exponent  = power of 2 the number is scaled by (stored with a "bias" of 1023)
  Mantissa  = the significant digits ("precision") of the number
```

The value is reconstructed as:

```
value = (-1)^S  ×  1.mantissa (binary)  ×  2^(exponent - 1023)
```

This is exactly like decimal scientific notation (`6.022 × 10²³`) but in base 2: a sign, a normalized fractional part ("1.xxxx"), and a power-of-2 exponent to shift the decimal (binary) point.

A 32-bit "single precision" float uses the same idea with fewer bits: 1 sign + 8 exponent + 23 mantissa.

---

## 3. Worked Example: Encoding 0.15625

`0.15625` was chosen deliberately because it *is* exactly representable in binary (it's `5/32`), so we can trace the full encoding without approximation.

**Step 1 — Convert to binary:**
```
0.15625 × 2 = 0.3125   -> 0
0.3125  × 2 = 0.625    -> 0
0.625   × 2 = 1.25     -> 1
0.25    × 2 = 0.5      -> 0
0.5     × 2 = 1.0      -> 1  (remainder is now 0, stop)

0.15625 (decimal) = 0.00101 (binary)
```

**Step 2 — Normalize to `1.xxxx × 2^n` form (like moving a decimal point):**
```
0.00101 = 1.01 × 2^-3
```

**Step 3 — Fill in the IEEE-754 fields:**
```
Sign     = 0                          (positive)
Exponent = -3 + 1023 (bias) = 1020    = 01111111100 (11 bits)
Mantissa = 01 followed by zeros to fill 52 bits (the leading "1." is implicit, not stored)
```

```python
>>> import struct
>>> struct.pack('>d', 0.15625).hex()   # dump the raw 64-bit IEEE-754 representation
'3fc4000000000000'
>>> struct.unpack('>d', bytes.fromhex('3fc4000000000000'))[0]
0.15625
```

---

## 4. Why 0.1 + 0.2 != 0.3

Since `0.1` and `0.2` cannot be represented exactly in binary (per §1), each is stored as the *closest possible* 64-bit approximation. Adding two approximations compounds the tiny error, and the result doesn't exactly match the (also approximate) stored representation of `0.3`.

```python
>>> 0.1 + 0.2
0.30000000000000004
>>> 0.1 + 0.2 == 0.3
False
>>> "%.20f" % 0.1
'0.10000000000000000555'
>>> "%.20f" % 0.2
'0.20000000000000001110'
>>> "%.20f" % 0.3
'0.29999999999999998890'
>>> "%.20f" % (0.1 + 0.2)
'0.30000000000000004441'
```

Notice that even `0.1` alone is not stored as exactly `0.1` — it's stored as `0.1000000000000000055511151231257827021181583404541015625` in full binary precision. This is not a Python bug — it happens identically in JavaScript, Java, C, Go, and virtually every language using IEEE-754.

```js
// JavaScript console — identical behavior, same IEEE-754 standard
0.1 + 0.2  // 0.30000000000000004
```

---

## 5. Special Values

IEEE-754 reserves special bit patterns for cases that don't fit ordinary numbers:

| Value | Meaning | Example that produces it |
|-------|---------|---------------------------|
| `+Infinity` / `-Infinity` | Overflow beyond the largest representable number | `1.0 / 0.0` (float division) |
| `NaN` (Not a Number) | Undefined result | `0.0 / 0.0`, `float('inf') - float('inf')` |
| `-0.0` | Negative zero (yes, it's distinct from `0.0` in bit pattern) | `-1.0 * 0.0` |

```python
>>> float('inf'), float('-inf'), float('nan')
(inf, -inf, nan)
>>> float('nan') == float('nan')
False   # NaN is never equal to anything, including itself — a famous gotcha
```

---

## 6. How to Actually Handle Money and Precision-Sensitive Math

Because of the above, floating-point types must **never** be used to represent money or anywhere exact decimal precision is required. Standard mitigations:

1. **Epsilon comparison** instead of exact equality:
   ```python
   >>> abs((0.1 + 0.2) - 0.3) < 1e-9
   True
   ```
2. **Integer cents** — store `$19.99` as the integer `1999` (cents), do all math in integers, divide by 100 only for display.
3. **Fixed-point/decimal types** — Python's `decimal.Decimal`, Java's `BigDecimal`, SQL's `DECIMAL(10,2)` — these represent numbers in base 10 internally instead of base 2, so decimal fractions like `0.1` are exact.
   ```python
   >>> from decimal import Decimal
   >>> Decimal('0.1') + Decimal('0.2')
   Decimal('0.3')
   ```

---

## 7. Where This Shows Up in Real Code

- **Financial software bugs**: using `float`/`double` for currency and seeing totals off by a cent after many additions.
- **Test assertions**: `assert result == 0.3` failing intermittently in unit tests — should use an epsilon/tolerance-based assertion instead.
- **JSON**: JSON numbers are commonly parsed into IEEE-754 doubles, so very large integers (beyond 2^53) can silently lose precision when round-tripped through `JSON.parse`/`JSON.stringify` in JavaScript.
- **Database schema design**: choosing `FLOAT`/`DOUBLE` vs `DECIMAL`/`NUMERIC` column types for financial data.

---

## 8. Hands-On Exercises

1. Run `0.1 + 0.2` in a Python REPL and in a browser JavaScript console. Confirm they produce the identical "wrong" value, and explain why that's expected rather than a bug in either language.
2. Convert the decimal fraction `0.625` to binary by hand using the doubling method shown in §3, and verify it terminates cleanly (hint: it should, since `0.625 = 5/8`).
3. Write a Python function `float_equals(a, b, epsilon=1e-9)` that safely compares two floats, and use it to confirm `float_equals(0.1 + 0.2, 0.3)` returns `True`.
4. Use `decimal.Decimal` in Python to compute `Decimal('19.99') * 3` and compare the result to the plain-float version `19.99 * 3`. Note any difference.
5. Explain in your own words why `float('nan') == float('nan')` evaluates to `False`, and what the correct way to check for NaN is (`math.isnan(x)`).

---

## 9. Interview Q&A

**Q: Why does `0.1 + 0.2` not equal `0.3` in most programming languages?**
Answer: Both `0.1` and `0.2` cannot be represented exactly in binary floating point (IEEE-754) — they're infinitely repeating binary fractions, so they get rounded to the closest representable 64-bit value. Adding those two slightly-off approximations produces a result that doesn't exactly match the (also approximate) stored value of `0.3`, giving `0.30000000000000004`. This is a property of binary floating-point representation, not a language-specific bug.

**Q: What are the three components of an IEEE-754 floating-point number?**
Answer: A sign bit (positive/negative), an exponent field (a power of 2 the value is scaled by, stored with a bias), and a mantissa/fraction field (the significant digits of the number). The value equals sign × 1.mantissa × 2^(exponent - bias), similar to base-2 scientific notation.

**Q: How should you store and calculate monetary values in software, and why?**
Answer: Never use plain `float`/`double` for money because binary floating point can't represent most decimal fractions exactly, leading to rounding errors that compound over many operations. Instead, either store amounts as integer cents (all math in integers, divide by 100 only for display) or use a base-10 fixed-point/decimal type (Python `Decimal`, Java `BigDecimal`, SQL `DECIMAL`), which represents decimal fractions exactly.

**Q: How do you correctly compare two floating-point numbers for equality?**
Answer: Never use `==` directly on floats derived from computation, since rounding error means mathematically equal values may differ in their last bits. Instead, compare whether the absolute difference is smaller than a small tolerance/epsilon value, e.g. `abs(a - b) < 1e-9`, adjusting the epsilon to the precision needs of the domain.

**Q: What is `NaN` and what's the one property that makes it uniquely tricky?**
Answer: `NaN` ("Not a Number") is a special IEEE-754 bit pattern representing an undefined result of an operation, such as `0.0 / 0.0`. Its unique trickiness is that it is never equal to anything, including itself — `NaN == NaN` is `False` — so checking for it requires a dedicated function like `math.isnan(x)` or `Number.isNaN(x)` rather than an equality comparison.

**Q: Why can very large integers lose precision when passed through JSON in JavaScript?**
Answer: JavaScript represents all numbers, including integers, as IEEE-754 doubles, which can only represent integers exactly up to 2^53 (about 9 quadrillion) — beyond that, integers start silently rounding to the nearest representable double. This is why large IDs (e.g., 64-bit database IDs or Twitter/Discord snowflake IDs) are often sent as JSON strings instead of JSON numbers.
