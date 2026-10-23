# Binary and Hexadecimal — Complete Guide

## Table of Contents
1. [Why Computers Use Binary](#1-why-computers-use-binary)
2. [Binary Basics](#2-binary-basics)
3. [Decimal to Binary and Back](#3-decimal-to-binary-and-back)
4. [Hexadecimal — Binary's Shorthand](#4-hexadecimal--binarys-shorthand)
5. [Bitwise Operations](#5-bitwise-operations)
6. [Bit Shifts](#6-bit-shifts)
7. [Where This Shows Up in Real Code](#7-where-this-shows-up-in-real-code)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Computers Use Binary

A transistor — the fundamental building block of a CPU — is essentially a tiny electrical switch. It's reliable at distinguishing two states: **on** (current flowing, "high" voltage) and **off** (no current, "low" voltage).

```
Voltage:  ~5V  ────────────  "1" (on)
Voltage:  ~0V  ────────────  "0" (off)
```

Building a reliable component that distinguishes 10 different voltage levels (for decimal) is far harder and noisier than one that distinguishes 2. So every modern computer represents all data — numbers, text, images, video, code itself — using **binary** (base 2): sequences of 0s and 1s.

```
1 binary digit         = 1 bit
8 bits                 = 1 byte
4 bits                 = 1 nibble (half a byte — convenient for hex, see §4)
1,024 bytes            = 1 kilobyte (KiB)
1,024 kilobytes        = 1 megabyte (MiB)
```

---

## 2. Binary Basics

Just like decimal (base 10) uses powers of 10, binary (base 2) uses powers of 2. Each position in a binary number represents a power of 2, read right to left starting at 2⁰.

```
Decimal:  1 0 0 0
          |  |  |  |
        10³ 10² 10¹ 10⁰   → 1×1000 + 0×100 + 0×10 + 0×1 = 1000

Binary:   1 0 1 1
          |  |  |  |
         2³ 2² 2¹ 2⁰    → 1×8 + 0×4 + 1×2 + 1×1 = 11
```

An 8-bit byte can represent 2⁸ = 256 distinct values: `00000000` (0) through `11111111` (255) when unsigned.

---

## 3. Decimal to Binary and Back

### Binary → Decimal (easy direction: multiply and add)

```
Binary: 1 0 1 1 0 1
Position weights (right to left): 32 16 8 4 2 1

  1    0    1    1    0    1
 32    16   8    4    2    1
 ×1   ×0   ×1   ×1   ×0   ×1
 32 +  0 +  8 +  4 +  0 +  1  =  45
```

So `101101₂ = 45₁₀`.

### Decimal → Binary (divide by 2, collect remainders bottom-up)

Convert 45 to binary:

```
45 ÷ 2 = 22 remainder 1   ┐
22 ÷ 2 = 11 remainder 0   │
11 ÷ 2 =  5 remainder 1   │  read remainders
 5 ÷ 2 =  2 remainder 1   │  bottom → top
 2 ÷ 2 =  1 remainder 0   │
 1 ÷ 2 =  0 remainder 1   ┘

Result (bottom to top): 1 0 1 1 0 1  = 101101₂
```

Verify with Python:

```python
>>> bin(45)
'0b101101'
>>> int('101101', 2)
45
```

---

## 4. Hexadecimal — Binary's Shorthand

Writing long binary strings is error-prone for humans (`11111111 00000000 10101010`). Hexadecimal (base 16) fixes this because **1 hex digit exactly represents 4 bits (1 nibble)** — there's no remainder or overlap, unlike decimal.

```
Binary (4 bits) → Hex digit
0000 = 0     0100 = 4     1000 = 8     1100 = C
0001 = 1     0101 = 5     1001 = 9     1101 = D
0010 = 2     0110 = 6     1010 = A     1110 = E
0011 = 3     0111 = 7     1011 = B     1111 = F
```

Because a byte is 8 bits = two nibbles, **every byte maps to exactly 2 hex digits**:

```
Binary byte:  1111 0000
Hex:           F    0    → 0xF0

Binary byte:  1010 1100
Hex:           A    C    → 0xAC (172 in decimal)
```

This is why hex shows up everywhere bytes need to be read by humans:

| Use case | Example | Why hex |
|----------|---------|---------|
| Memory addresses | `0x7ffee3a1c9d8` | Compact, byte-aligned |
| CSS colors | `#FF5733` (R=FF, G=57, B=33) | Each pair = exactly 1 byte of a color channel |
| MAC addresses | `3C:22:FB:4A:9B:01` | Each pair = exactly 1 byte |
| SHA/MD5 hashes | `d41d8cd98f00b204e9800998ecf8427e` | Compact fixed-width byte dump |
| Debuggers/hex editors | Byte-level memory dumps | 2 hex chars per byte, no rounding |

### Converting decimal ↔ hex directly

```python
>>> hex(172)
'0xac'
>>> int('ac', 16)
172
>>> int('0xFF5733', 16)
16733491
```

Manual decimal → hex (divide by 16, collect remainders, like binary but ÷16):

```
172 ÷ 16 = 10 remainder 12 (C)   ┐  read bottom → top
 10 ÷ 16 =  0 remainder 10 (A)   ┘

Result: A C  →  0xAC
```

---

## 5. Bitwise Operations

Bitwise operators act on individual bits of a number. They are the foundation of feature flags, permission bitmasks, network subnet masks, and low-level optimizations.

### Truth Tables

**AND (`&`)** — result bit is 1 only if *both* input bits are 1. Used to **mask/check** bits.

| A | B | A AND B |
|---|---|---------|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 1 |

**OR (`|`)** — result bit is 1 if *at least one* input bit is 1. Used to **set** bits.

| A | B | A OR B |
|---|---|--------|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 1 |

**XOR (`^`)** — result bit is 1 if the input bits *differ*. Used to **toggle** bits, and in checksums/simple encryption.

| A | B | A XOR B |
|---|---|---------|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 0 |

**NOT (`~`)** — flips every bit (0 → 1, 1 → 0). Used to build masks (see §6).

| A | NOT A |
|---|-------|
| 0 | 1 |
| 1 | 0 |

### Worked Example

```
  A = 12   = 0000 1100
  B = 10   = 0000 1010
  -------------------
  A & B    = 0000 1000  = 8    (bits set in BOTH)
  A | B    = 0000 1110  = 14   (bits set in EITHER)
  A ^ B    = 0000 0110  = 6    (bits that DIFFER)
  ~A       = 1111 0011  = -13  (two's complement, see Lesson 02)
```

```python
>>> a, b = 12, 10
>>> bin(a & b), bin(a | b), bin(a ^ b)
('0b1000', '0b1110', '0b110')
>>> a & b, a | b, a ^ b
(8, 14, 6)
```

### Real Use: Permission Flags

```python
READ    = 0b100  # 4
WRITE   = 0b010  # 2
EXECUTE = 0b001  # 1

permissions = READ | WRITE          # grant read + write = 0b110 = 6

has_write   = bool(permissions & WRITE)    # check: is WRITE set?  -> True
permissions = permissions & ~WRITE         # revoke write         -> 0b100
permissions = permissions ^ EXECUTE        # toggle execute on    -> 0b101
```

This exact pattern is how Unix file permissions (`chmod 755`), HTTP method flags, and React/Redux feature flags are often implemented under the hood.

---

## 6. Bit Shifts

Shifting moves every bit left or right by N positions — equivalent to multiplying/dividing by 2 per shift.

```
Left shift (<<)  fills with 0s on the right — multiplies by 2 per shift
  0000 0011 (3)  << 2   =  0000 1100 (12)     [3 × 2² = 12]

Right shift (>>) drops bits off the right — divides by 2 per shift (floor)
  0000 1100 (12) >> 2   =  0000 0011 (3)      [12 ÷ 2² = 3]
```

```python
>>> 3 << 2
12
>>> 12 >> 2
3
>>> 1 << 10        # common idiom: 2^10 = 1024
1024
```

Shifting is used to build masks (`1 << n` isolates bit `n`), pack multiple small values into one integer (e.g., RGBA into a 32-bit int), and as a fast multiply/divide by powers of two.

---

## 7. Where This Shows Up in Real Code

- **CSS/design**: `#FF5733` — hex byte pairs for RGB.
- **Networking**: subnet masks (`255.255.255.0`) are bitwise AND operations against an IP address.
- **Git**: commit SHAs are hex-encoded SHA-1/SHA-256 hashes.
- **JavaScript**: `2 ** 31 - 1` and bitwise quirks (`~~x` for fast `Math.floor` on positive numbers) rely on 32-bit integer bitwise semantics.
- **Database indexes / feature flags**: bitmask columns storing many booleans in one integer column.

---

## 8. Hands-On Exercises

1. Convert `01011010` (binary) to decimal and to hex by hand, then verify with `int('01011010', 2)` and `hex(...)` in Python.
2. Convert the decimal number `500` to binary and to hexadecimal by hand, then verify with `bin(500)` and `hex(500)`.
3. Write a Python function `has_flag(value, flag)` that uses `&` to check whether a bit is set, and test it against a permissions bitmask like the READ/WRITE/EXECUTE example above.
4. Given the CSS color `#3498DB`, extract the individual R, G, and B decimal values using string slicing and `int(x, 16)`.
5. Predict the output of `5 ^ 5`, `5 ^ 0`, and `13 << 1` on paper, then verify in a Python REPL. Explain in one sentence why `x ^ x` is always 0.

---

## 9. Interview Q&A

**Q: Why do computers use binary instead of decimal?**
Answer: Computer hardware is built from transistors, which reliably distinguish two electrical states (on/off, high/low voltage). Building hardware that reliably distinguishes ten distinct voltage levels for decimal would be far more complex, expensive, and error-prone (noise-sensitive) than a robust two-state system. Binary maps directly and reliably onto the physical behavior of transistors.

**Q: Why is hexadecimal used instead of, say, octal or decimal, when working with bytes?**
Answer: A byte is 8 bits, and a hex digit represents exactly 4 bits (a nibble). So one byte maps cleanly to exactly two hex digits with no remainder — e.g., `0xFF` = 1 byte, `0xFFFF` = 2 bytes. Decimal doesn't align with binary/byte boundaries at all, and octal (3 bits per digit) doesn't evenly divide an 8-bit byte, so it requires awkward digit groupings. Hex is simply the most human-readable shorthand for binary.

**Q: What's the difference between `&` (AND) and `&&` in most C-family languages?**
Answer: `&` is a bitwise operator — it operates on individual bits of the operands and returns a number. `&&` is a logical operator — it operates on boolean truthiness of the whole expressions and short-circuits (skips evaluating the right side if the left side is already `false`). Confusing the two is a classic bug source, e.g. `if (a & b)` vs `if (a && b)`.

**Q: How would you use bitwise operations to store multiple boolean flags efficiently?**
Answer: Assign each flag a unique power-of-two bit position (1, 2, 4, 8, ...). Combine flags into a single integer using `|` (OR). Check a flag with `&` against the flag's bit. Remove a flag with `& ~flag`. Toggle a flag with `^`. This packs many booleans into a single integer column/variable instead of many separate boolean fields — commonly used in Unix permissions, HTTP methods, and database flag columns.

**Q: What does left-shifting a number by `n` do mathematically, and where might it overflow?**
Answer: `x << n` is equivalent to `x * 2^n`. It overflows when the resulting value's bit pattern no longer fits in the fixed width of the integer type (e.g., shifting a 32-bit signed int left until it overflows into the sign bit), producing undefined or wrapped behavior in languages like C/Java, unlike Python which has arbitrary-precision integers.

**Q: Convert 0x2F to binary and decimal without a calculator — walk through your reasoning.**
Answer: Split the hex digit into its 4-bit binary equivalent: `2 = 0010`, `F = 1111`, so `0x2F = 0010 1111` in binary. To get decimal, sum the powers of 2 where bits are 1: `32 + 8 + 4 + 2 + 1 = 47`. So `0x2F = 47₁₀ = 00101111₂`.
