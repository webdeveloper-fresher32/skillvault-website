# HCF and LCM — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

HCF (Highest Common Factor, also called GCD) is the largest number that divides two or more numbers exactly. LCM (Lowest Common Multiple) is the smallest number that is a multiple of two or more numbers. These show up constantly in word problems: "two bells ring every 12 and 18 minutes — when do they ring together again?" is an LCM question; "cut the longest possible equal-length rope pieces from ropes of 84m and 120m" is an HCF question.

The two ideas are opposites in flavor — HCF shrinks toward the shared factors, LCM grows to cover all factors — but they are linked by one identity that examiners love to exploit: **for any two numbers, HCF × LCM = product of the two numbers.** That single relationship lets you skip an entire factorization step in many questions.

**Plain-English example:** You have 84 pens and 120 pencils and want to make identical gift bags using all of them with nothing left over — the largest number of bags you can make is HCF(84, 120).

---

## 2. Shortcut / Trick

### Method 1: Prime factorization
- HCF = product of the **common** prime factors, each raised to the **lowest** power it appears with.
- LCM = product of **all** prime factors involved, each raised to the **highest** power it appears with.

### Method 2: Division method (faster for HCF of large numbers)
Divide the larger number by the smaller; then divide the previous divisor by the remainder; repeat until remainder is 0. The last non-zero divisor is the HCF.

### The golden shortcut
For any two numbers **a** and **b**:
```
HCF(a, b) × LCM(a, b) = a × b
```
So if you know HCF, LCM, and one number, the other number = (HCF × LCM) ÷ known number. This is a very common exam trap — don't factorize when this formula gets you there in one line.

### HCF/LCM of fractions
```
HCF of fractions = HCF(numerators) / LCM(denominators)
LCM of fractions = LCM(numerators) / HCF(denominators)
```

---

## 3. Worked Examples

### (a) Find HCF(84, 120)

84 = 2² × 3 × 7
120 = 2³ × 3 × 5

Common primes with lowest powers: 2² and 3.
HCF = 2² × 3 = **12**

### (b) Find LCM of 12, 15, 20

12 = 2² × 3
15 = 3 × 5
20 = 2² × 5

All primes with highest powers: 2², 3, 5.
LCM = 2² × 3 × 5 = **60**

### (c) Two numbers have HCF 12 and LCM 336. One number is 84. Find the other.

Using HCF × LCM = product of the numbers:
```
Other number = (HCF × LCM) ÷ known number
             = (12 × 336) ÷ 84
             = 4032 ÷ 84
             = 48
```
**Check:** 84 = 12 × 7, 48 = 12 × 4, and 7, 4 are co-prime, so LCM = 12 × 7 × 4 = 336. ✓

**The other number is 48.**

---

## 4. Timed Practice Set

1. Find the HCF of 36 and 60. (30 sec)
2. Find the LCM of 18 and 24. (30 sec)
3. Find the HCF of 48, 180, and 240. (45 sec)
4. Find the LCM of 15, 25, and 40. (45 sec)
5. Two numbers have HCF 6 and LCM 108. If one number is 18, find the other. (45 sec)
6. Find the HCF of the fractions 2/3, 4/9, 6/27. (45 sec)
7. Find the LCM of the fractions 1/2, 3/4, 5/6. (45 sec)
8. The product of two numbers is 2028 and their HCF is 13. Find their LCM. (30 sec)

### Answer Key

1. **12** — 36 = 2²×3², 60 = 2²×3×5; common lowest powers = 2²×3 = 12.
2. **72** — 18 = 2×3², 24 = 2³×3; highest powers = 2³×3² = 72.
3. **12** — 48=2⁴×3, 180=2²×3²×5, 240=2⁴×3×5; common lowest powers = 2²×3 = 12.
4. **600** — 15=3×5, 25=5², 40=2³×5; highest powers = 2³×3×5² = 600.
5. **36** — other = (HCF × LCM) ÷ known = (6 × 108) ÷ 18 = 648 ÷ 18 = 36.
6. **2/27** — HCF(numerators 2,4,6) = 2; LCM(denominators 3,9,27) = 27; HCF = 2/27.
7. **15/2** — LCM(numerators 1,3,5) = 15; HCF(denominators 2,4,6) = 2; LCM = 15/2.
8. **156** — LCM = product ÷ HCF = 2028 ÷ 13 = 156.
