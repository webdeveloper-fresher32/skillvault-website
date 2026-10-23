# Number and Letter Series — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

A series question gives you a sequence of numbers or letters that follow a hidden rule, and asks you to find the next term, a missing term, or the "odd one out" that breaks the rule. This is a pure pattern-recognition puzzle — there's no formula to memorize, only a short checklist of pattern types to test against the given sequence, in order, until one fits.

The common pattern types:

- **Arithmetic** — a constant amount is added (or subtracted) each step: 3, 7, 11, 15, 19 (+4 each time).
- **Geometric** — a constant ratio multiplies each step: 2, 6, 18, 54, 162 (×3 each time).
- **Alternating** — two different operations take turns, or the sequence is really two interleaved sub-sequences: 3, 6, 4, 8, 5, 10 (×2, then −2, then ×2, then −2 …).
- **Squares / cubes** — terms are perfect squares (1, 4, 9, 16, 25…) or perfect cubes (1, 8, 27, 64, 125…), sometimes with an offset (+1, −2, etc.).
- **Difference-of-differences (second-order)** — the first differences aren't constant, but the *differences between the differences* are: 2, 3, 5, 8, 12 has differences 1, 2, 3, 4 — those differences increase by 1 each time, so the next difference is 5 and the next term is 17.

**Letter series** are number series in disguise — convert each letter to its position in the alphabet (A=1, B=2, … Z=26), find the numeric pattern, then convert the answer back to a letter.

**Odd-one-out** questions give a set where every element but one obeys some rule (all primes, all perfect squares, all multiples of a number) — your job is to find the rule and spot the exception.

---

## 2. Shortcut / Trick

**Write the differences under the series first, always.** For any unfamiliar series, the fastest diagnostic is: subtract each term from the next and write the differences in a row underneath. If that row is constant → arithmetic. If that row itself has constant differences → second-order (quadratic-type) series. If the *ratios* (not differences) are constant → geometric.

**Suspect "alternating" the moment differences look erratic but repeat with a period.** If the difference row looks like 3, −1, 3, −1, 3, −1 (or the ratios alternate between two values, like ×3, −1, ×3, −1), split the series into what's really happening: two operations taking turns. Apply whichever operation comes next to get the answer — don't try to force a single constant rule onto it.

**For letter series, convert to numbers immediately — don't try to spot letter patterns in your head.** Write the alphabet position under each letter, find the numeric pattern (usually differences-of-differences, since simple +1/+2 patterns are considered too easy for this format), extract the next number, then convert back to a letter.

**For odd-one-out, test the "expensive" rule last.** Check the cheap, fast rules first — is it all even/odd, all multiples of a small number, an obvious perfect-square or perfect-cube list — before checking primality or anything requiring more calculation. Most odd-one-out sets are built around squares, cubes, or primes.

---

## 3. Worked Examples

### (a) Next term with an alternating +/× pattern

Find the next term: 2, 6, 5, 15, 14, 42, ?

Write out what happens step by step:
- 2 × 3 = 6
- 6 − 1 = 5
- 5 × 3 = 15
- 15 − 1 = 14
- 14 × 3 = 42
- 42 − 1 = **41**

The operations alternate ×3, −1, ×3, −1, ×3, −1 — the pattern repeats every two steps, and the sequence given (2, 6, 5, 15, 14, 42) matches it exactly at every step, confirming the rule. Continuing the alternation, the next operation after ×3 (giving 42) is −1, so the answer is **41**.

### (b) Letter series using position shifts

Find the next letter: B, D, G, K, P, ?

Convert to alphabet positions: B=2, D=4, G=7, K=11, P=16.

Write the difference row: 4−2=2, 7−4=3, 11−7=4, 16−11=5.

The differences themselves increase by 1 each time (2, 3, 4, 5), so the next difference is 6. Next position = 16 + 6 = 22.

Position 22 in the alphabet is **V**.

### (c) Find the odd one out

Which number doesn't belong: 8, 27, 64, 100, 125, 216?

Test the "cheap" rule first: are these perfect cubes? 2³=8, 3³=27, 4³=64, 5³=125, 6³=216 — five of the six numbers are perfect cubes of consecutive integers (2 through 6). **100** is not a perfect cube (it's 10², a perfect square instead) — it's the odd one out.

---

## 4. Timed Practice Set

1. Find the next term: 5, 10, 20, 40, ? (30 sec)
2. Find the next term: 1, 4, 9, 16, 25, ? (20 sec)
3. Find the next term: 2, 3, 5, 8, 12, ? (30 sec)
4. Find the next term: 4, 8, 6, 12, 10, 20, ? (30 sec)
5. Find the next letter: A, C, F, J, O, ? (40 sec)
6. Find the next letter: Z, X, U, Q, ? (40 sec)
7. Find the odd one out: 4, 9, 16, 25, 30, 36 (30 sec)
8. Find the odd one out: 2, 3, 5, 7, 9, 11 (20 sec)

### Answer Key

1. **80** — Geometric, ×2 each step: 5, 10, 20, 40, 80.
2. **36** — Perfect squares: 1², 2², 3², 4², 5², 6² = 36.
3. **17** — Difference row is 1, 2, 3, 4 (increasing by 1); next difference is 5, so 12 + 5 = 17.
4. **18** — Alternating ×2, −2: 4×2=8, 8−2=6, 6×2=12, 12−2=10, 10×2=20, 20−2=18.
5. **U** — Positions 1, 3, 6, 10, 15 (triangular numbers) have differences 2, 3, 4, 5; next difference 6 gives position 21 = U.
6. **L** — Positions 26, 24, 21, 17 have differences −2, −3, −4; next difference −5 gives position 12 = L.
7. **30** — The rest are perfect squares (2² through 6²); 30 is not a perfect square.
8. **9** — The rest are prime numbers; 9 = 3×3 is not prime.
