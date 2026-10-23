# Number Systems and Divisibility — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Every aptitude test — bank PO, CAT, placement drives — opens with number system questions because they can be solved in seconds *if* you know the rule, or eat two minutes if you try to actually divide the number out. The two skills tested over and over are: (a) can you tell if a number is divisible by 2, 3, 4, 5, 6, 7, 8, 9, 10, or 11 without doing long division, and (b) can you find the last digit ("unit digit") of a huge power like 7^95 without expanding it.

Numbers are also classified for these tests: a **prime** number has exactly two factors (1 and itself — 2, 3, 5, 7, 11, 13...); a **composite** number has more than two factors (4, 6, 8, 9...); 1 is neither prime nor composite. A **rational** number can be written as p/q with q ≠ 0 (this includes all integers, fractions, and terminating/repeating decimals). Place value matters too: banks ask things like "what does the digit 7 represent in 47,258" — the answer is 7 × 1,000 = 7,000, i.e., its place value, not its face value (which is just 7).

**Plain-English example:** Asked "is 34,914,111 divisible by 3?", nobody expects you to divide. You add the digits (3+4+9+1+4+1+1+1 = 24), see that 24 is divisible by 3, and answer "yes" in under 5 seconds. That is the entire game of this lesson.

---

## 2. Shortcut / Trick

### Divisibility rules

| Divisible by | Rule | Example |
|---|---|---|
| **2** | Last digit is 0, 2, 4, 6, or 8 | 348 → last digit 8 → yes |
| **3** | Sum of digits divisible by 3 | 4131 → 4+1+3+1=9 → yes |
| **4** | Last 2 digits divisible by 4 | 71,316 → 16 ÷ 4 = 4 → yes |
| **5** | Last digit is 0 or 5 | 1235 → yes |
| **6** | Divisible by both 2 AND 3 | 342 → even, digit-sum 9 (÷3) → yes |
| **7** | Double the last digit, subtract from the rest; result divisible by 7 (repeat if needed) | 203 → 20 − (2×3)=14 → 14÷7 → yes |
| **8** | Last 3 digits divisible by 8 | 12,104 → 104 ÷ 8 = 13 → yes |
| **9** | Sum of digits divisible by 9 | 4131 → 4+1+3+1=9 → yes |
| **10** | Last digit is 0 | 2,340 → yes |
| **11** | (Sum of digits at odd places) − (sum of digits at even places, counting from the right) is 0 or a multiple of 11 | see worked example (b) |

### Unit digit (cyclicity) shortcut

The last digit of a^n only depends on the last digit of the base and repeats in a cycle. Memorize these cycles (length shown in brackets):

| Base's unit digit | Cycle of unit digits | Cycle length |
|---|---|---|
| 0, 1, 5, 6 | always itself | 1 |
| 4 | 4, 6 | 2 |
| 9 | 9, 1 | 2 |
| 2 | 2, 4, 8, 6 | 4 |
| 3 | 3, 9, 7, 1 | 4 |
| 7 | 7, 9, 3, 1 | 4 |
| 8 | 8, 4, 2, 6 | 4 |

**Rule:** to find the unit digit of a^n, take n mod (cycle length). If the remainder is r, the answer is the r-th entry in the cycle; if r = 0, use the last entry in the cycle (i.e., the cycle length itself).

---

## 3. Worked Examples

### (a) Find the unit digit of 7^95

7's cycle is (7, 9, 3, 1), length 4.
95 ÷ 4 = 23 remainder **3**.
Remainder 3 → 3rd entry in the cycle → **3**.

**Unit digit of 7^95 = 3**

### (b) Is 45,678 divisible by 11?

Write the digits and number their positions from the right:
```
Digit:     4   5   6   7   8
Position:  5   4   3   2   1
```
- Odd positions (1, 3, 5): 8 + 6 + 4 = 18
- Even positions (2, 4): 7 + 5 = 12
- Difference: 18 − 12 = 6

6 is not 0 or a multiple of 11, so **45,678 is NOT divisible by 11**.

### (c) Count numbers divisible by 3 between 1 and 500

Numbers divisible by 3 up to 500 are 3, 6, 9, ..., up to the largest multiple ≤ 500.
Count = ⌊500 ÷ 3⌋ = ⌊166.67⌋ = **166**.

(Check: 3 × 166 = 498, which is ≤ 500, and 3 × 167 = 501, which is > 500 — confirms 166.)

---

## 4. Timed Practice Set

1. Find the unit digit of 3^58. (30 sec)
2. Find the unit digit of 8^123. (30 sec)
3. Is 68,502 divisible by 9? (30 sec)
4. Is 913,462 divisible by 11? (45 sec)
5. How many numbers between 1 and 300 are divisible by 7? (45 sec)
6. Find the unit digit of 12^34 × 13^2. (45 sec)
7. Is 7,777,779 divisible by 3? (30 sec)
8. Find the unit digit of 9^99. (45 sec)

### Answer Key

1. **9** — 3's cycle (3,9,7,1); 58 mod 4 = 2 → 2nd entry = 9.
2. **2** — 8's cycle (8,4,2,6); 123 mod 4 = 3 → 3rd entry = 2.
3. **No** — digit sum = 6+8+5+0+2 = 21; 21 is divisible by 3 but not by 9.
4. **Yes** — odd-position sum (from right) = 2+4+1 = 7, even-position sum = 6+3+9 = 18, difference = 11, a multiple of 11.
5. **42** — ⌊300 ÷ 7⌋ = 42 (7 × 42 = 294 ≤ 300).
6. **6** — unit digit of 12^34 behaves like 2's cycle (2,4,8,6); 34 mod 4 = 2 → 4. Unit digit of 13^2 behaves like 3's cycle; exponent 2 → 9. 4 × 9 = 36 → unit digit 6.
7. **Yes** — digit sum = 7×6 + 9 = 51, divisible by 3.
8. **9** — 9's cycle (9,1); 99 is odd → 1st entry = 9.
