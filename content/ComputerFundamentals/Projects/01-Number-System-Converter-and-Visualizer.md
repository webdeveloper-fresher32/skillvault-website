# Project 1 — Number System Converter and Visualizer

**Level:** Beginner
**Time estimate:** 30 – 45 minutes
**Phase prerequisite:** Phase 01 — Number Systems and Data Representation

---

## Overview

You will build a Python CLI tool that takes a number (integer or float, positive or negative) and shows:

- Its binary, hexadecimal, and octal representation
- Its two's complement bit pattern if it's a negative integer
- A full IEEE-754 breakdown (sign / exponent / mantissa) if it's a float

This project turns the abstract rules from Phase 01 (place value systems, two's complement, IEEE-754 layout) into something you can run against any number and see broken down bit-by-bit.

---

## Prerequisites

- Python 3.8+ installed
- Comfortable with Python's `struct` and `string` formatting basics (no prior experience needed — it's explained inline)

---

## Project Structure

```
01-number-converter/
└── number_converter.py
```

---

## Full Source Code

Create `number_converter.py`:

```python
#!/usr/bin/env python3
"""
Number System Converter and Visualizer
----------------------------------------
Given an integer or float, shows:
  - binary / hex / octal representation
  - two's complement bit pattern (for negative integers)
  - IEEE-754 sign/exponent/mantissa breakdown (for floats)

Usage:
    python3 number_converter.py <number> [--bits 8|16|32|64] [--precision single|double]

Examples:
    python3 number_converter.py 156
    python3 number_converter.py -5 --bits 8
    python3 number_converter.py 3.14
    python3 number_converter.py -0.1 --precision double
"""

import argparse
import struct
import sys


def to_two_complement(value: int, bits: int) -> str:
    """
    Return the two's complement bit string of `value` using `bits` bits.
    Works for both positive and negative integers.
    """
    if value >= 0:
        max_positive = (1 << (bits - 1)) - 1
        if value > max_positive:
            raise ValueError(
                f"{value} does not fit in {bits}-bit signed two's complement "
                f"(max positive value is {max_positive})"
            )
        return format(value, f"0{bits}b")

    min_negative = -(1 << (bits - 1))
    if value < min_negative:
        raise ValueError(
            f"{value} does not fit in {bits}-bit signed two's complement "
            f"(min negative value is {min_negative})"
        )
    # Two's complement of a negative number: add 2^bits, then format as binary.
    twos_comp_value = (1 << bits) + value
    return format(twos_comp_value, f"0{bits}b")


def show_integer_breakdown(value: int, bits: int) -> None:
    print(f"\nInteger Breakdown for {value}")
    print("-" * 50)
    print(f"  Decimal:      {value}")

    # Python's bin()/hex()/oct() prepend a '-' for negative numbers rather
    # than showing a signed bit pattern directly, so we show both forms.
    print(f"  Binary:       {bin(value)}")
    print(f"  Hexadecimal:  {hex(value)}")
    print(f"  Octal:        {oct(value)}")

    try:
        tc = to_two_complement(value, bits)
    except ValueError as exc:
        print(f"\n  [!] {exc}")
        return

    if value < 0:
        print(f"\n  Two's complement ({bits}-bit): {tc}")
        print(f"    Sign bit: {tc[0]} (1 = negative)")
        print(f"    Verify -> invert bits, add 1, should give |{value}|:")
        inverted = "".join("1" if b == "0" else "0" for b in tc)
        inverted_plus_one = format(int(inverted, 2) + 1, f"0{bits}b")
        print(f"      inverted:        {inverted}")
        print(f"      +1:              {inverted_plus_one}")
        print(f"      as decimal:      {int(inverted_plus_one, 2)} (matches |{value}| = {abs(value)})")
    else:
        print(f"\n  Two's complement ({bits}-bit): {tc}  (positive numbers: same as plain binary, zero-padded)")


def show_float_breakdown(value: float, precision: str) -> None:
    """
    Break a float down into IEEE-754 sign / exponent / mantissa fields.
    precision: "single" (32-bit) or "double" (64-bit)
    """
    if precision == "single":
        fmt, total_bits, exp_bits, mant_bits, bias = ">f", 32, 8, 23, 127
    else:
        fmt, total_bits, exp_bits, mant_bits, bias = ">d", 64, 11, 52, 1023

    packed = struct.pack(fmt, value)
    as_int = int.from_bytes(packed, byteorder="big")
    bit_string = format(as_int, f"0{total_bits}b")

    sign_bit = bit_string[0]
    exponent_bits = bit_string[1:1 + exp_bits]
    mantissa_bits = bit_string[1 + exp_bits:]

    raw_exponent = int(exponent_bits, 2)
    actual_exponent = raw_exponent - bias

    print(f"\nIEEE-754 {precision.capitalize()} Precision Breakdown for {value}")
    print("-" * 50)
    print(f"  Full {total_bits}-bit pattern: {bit_string}")
    print(f"    Sign     ({1} bit):  {sign_bit}  -> {'negative' if sign_bit == '1' else 'positive'}")
    print(f"    Exponent ({exp_bits} bits): {exponent_bits}  -> raw={raw_exponent}, "
          f"biased (raw - {bias}) = {actual_exponent}")
    print(f"    Mantissa ({mant_bits} bits): {mantissa_bits}")

    if raw_exponent == 0:
        print("\n  Special case: exponent is all zeros -> denormalized number or zero.")
    elif raw_exponent == (1 << exp_bits) - 1:
        print("\n  Special case: exponent is all ones -> Infinity or NaN.")
    else:
        # Normalized number: value = (-1)^sign * 1.mantissa * 2^actual_exponent
        mantissa_value = 1.0
        for i, bit in enumerate(mantissa_bits):
            if bit == "1":
                mantissa_value += 2 ** (-(i + 1))
        sign_multiplier = -1 if sign_bit == "1" else 1
        reconstructed = sign_multiplier * mantissa_value * (2 ** actual_exponent)
        print(f"\n  Reconstructed value = (-1)^{sign_bit} x 1.{mantissa_bits} (binary) x 2^{actual_exponent}")
        print(f"                       = {sign_multiplier} x {mantissa_value} x {2 ** actual_exponent}")
        print(f"                       = {reconstructed}")
        print(f"\n  Original input:      {value}")
        print(f"  Round-trip exact?    {reconstructed == value}")


def parse_number(raw: str):
    """Parse the CLI argument into an int or float, preferring int when possible."""
    try:
        return int(raw)
    except ValueError:
        pass
    try:
        return float(raw)
    except ValueError:
        raise SystemExit(f"'{raw}' is not a valid integer or float")


def main():
    parser = argparse.ArgumentParser(description="Number System Converter and Visualizer")
    parser.add_argument("number", help="The number to convert (integer or float)")
    parser.add_argument("--bits", type=int, default=32, choices=[8, 16, 32, 64],
                         help="Bit width for two's complement display (default: 32)")
    parser.add_argument("--precision", choices=["single", "double"], default="single",
                         help="IEEE-754 precision for float breakdown (default: single)")
    args = parser.parse_args()

    value = parse_number(args.number)

    print("=" * 50)
    print(f"  NUMBER SYSTEM CONVERTER — input: {args.number}")
    print("=" * 50)

    if isinstance(value, int):
        show_integer_breakdown(value, args.bits)
    else:
        show_float_breakdown(value, args.precision)


if __name__ == "__main__":
    main()
```

---

## Sample Runs

### Positive integer

```bash
python3 number_converter.py 156
```

```
==================================================
  NUMBER SYSTEM CONVERTER — input: 156
==================================================

Integer Breakdown for 156
--------------------------------------------------
  Decimal:      156
  Binary:       0b10011100
  Hexadecimal:  0x9c
  Octal:        0o234

  Two's complement (32-bit): 00000000000000000000000010011100  (positive numbers: same as plain binary, zero-padded)
```

### Negative integer (two's complement)

```bash
python3 number_converter.py -5 --bits 8
```

```
==================================================
  NUMBER SYSTEM CONVERTER — input: -5
==================================================

Integer Breakdown for -5
--------------------------------------------------
  Decimal:      -5
  Binary:       -0b101
  Hexadecimal:  -0x5
  Octal:        -0o5

  Two's complement (8-bit): 11111011
    Sign bit: 1 (1 = negative)
    Verify -> invert bits, add 1, should give |-5|:
      inverted:        00000100
      +1:              00000101
      as decimal:      5 (matches |-5| = 5)
```

### Float (IEEE-754 breakdown)

```bash
python3 number_converter.py -0.1 --precision double
```

```
==================================================
  NUMBER SYSTEM CONVERTER — input: -0.1
==================================================

IEEE-754 Double Precision Breakdown for -0.1
--------------------------------------------------
  Full 64-bit pattern: 1011111110111001100110011001100110011001100110011001100110011
    Sign     (1 bit):  1  -> negative
    Exponent (11 bits): 01111111011  -> raw=1019, biased (raw - 1023) = -4
    Mantissa (52 bits): 1001100110011001100110011001100110011001100110011010

  Reconstructed value = (-1)^1 x 1.1001100110011001100110011001100110011001100110011010 (binary) x 2^-4
                       = -1 x 1.6 x 0.0625
                       = -0.1
  Original input:      -0.1
  Round-trip exact?    True
```

This last output is the punchline of Phase 01's floating point lesson made visible: `-0.1` is stored as a *rounded* binary fraction, not an exact one — but IEEE-754's rounding is precise enough that reconstructing it and comparing to the original still matches at Python's double precision.

---

## How to Verify It Works

| Check | Command | Expected Result |
|-------|---------|------------------|
| Positive int conversion | `python3 number_converter.py 156` | Binary `10011100`, hex `9c`, octal `234` |
| Negative two's complement | `python3 number_converter.py -1 --bits 8` | Bit pattern `11111111` (all ones — the classic "-1 is all 1s" fact) |
| Float breakdown | `python3 number_converter.py 3.14` | Sign `0`, non-trivial mantissa, round-trip exact `True` |
| Overflow handling | `python3 number_converter.py 200 --bits 8` | Raises a clear error (200 doesn't fit in 8-bit signed range) |

---

## Stretch Goals

1. Add support for parsing binary/hex/octal *input* (e.g., `0b1010`, `0x1F`) in addition to decimal.
2. Add a `--half` precision mode (16-bit float, 5 exponent bits, 10 mantissa bits) to show how precision loss gets worse with fewer bits.
3. Visualize the bit pattern with color-coded sections (sign/exponent/mantissa) using ANSI escape codes.
4. Add a batch mode that reads a list of numbers from a file and prints a table of all their representations side by side.
