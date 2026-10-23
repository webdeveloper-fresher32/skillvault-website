# Simplification and BODMAS Tricks — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Simplification questions give you a messy expression full of brackets, fractions, and operators and ask for a single final number. They test whether you follow the correct order of operations under time pressure — and whether you can avoid slow decimal long-division by recognizing common fractions on sight. Nearly every quant section has a handful of these as warm-up marks, and they are pure speed points: nobody should lose them to arithmetic order mistakes.

**Plain-English example:** In `10 + 2 × (3 + 4)`, a rushed test-taker might compute left to right and get `12 × 7 = 84`. The correct order is brackets first (3+4=7), then multiplication (2×7=14), then addition (10+14=24). BODMAS is the rule that prevents this exact mistake.

---

## 2. Shortcut / Trick

### BODMAS order
Solve strictly in this order, left to right within each tier:
```
B — Brackets        ( ), { }, [ ]  — innermost first
O — Of               (means multiply, e.g. "half of 20")
D — Division
M — Multiplication
A — Addition
S — Subtraction
```
Division and multiplication are equal-priority — do them left to right as they appear, not "always divide before multiply." Same for addition and subtraction.

### Common fraction-to-decimal table (memorize — saves long division every time)

| Fraction | Decimal | Fraction | Decimal |
|---|---|---|---|
| 1/2 | 0.5 | 1/8 | 0.125 |
| 1/3 | 0.333... | 3/8 | 0.375 |
| 2/3 | 0.667... | 5/8 | 0.625 |
| 1/4 | 0.25 | 7/8 | 0.875 |
| 3/4 | 0.75 | 1/9 | 0.111... |
| 1/5 | 0.2 | 1/11 | 0.0909... |
| 1/6 | 0.1667... | 1/12 | 0.0833... |
| 1/7 | 0.142857... | 1/16 | 0.0625 |
| 1/20 | 0.05 | 1/25 | 0.04 |

### Nested (complex) fractions
Work strictly from the innermost fraction outward — simplify the deepest denominator first, then work back up one layer at a time. Never try to cross-multiply the whole stack at once.

### Approximation for exam-time estimation
Round percentages and numbers to the nearest convenient value first, estimate, then only refine if the answer choices are close together. E.g., "48.98% of 601" behaves almost exactly like "49% of 600."

---

## 3. Worked Examples

### (a) Simplify: 15 − 3 × (2 + 4) ÷ 9

1. Brackets: (2 + 4) = 6 → `15 − 3 × 6 ÷ 9`
2. Division/Multiplication, left to right: 3 × 6 = 18, then 18 ÷ 9 = 2 → `15 − 2`
3. Subtraction: 15 − 2 = **13**

### (b) Simplify: [1 + 1 / (2 + 1/3)] ÷ (1 − 1/4)

Work from the innermost fraction outward.

1. Innermost: 2 + 1/3 = 7/3
2. Next layer: 1 ÷ (7/3) = 3/7
3. Numerator of the whole expression: 1 + 3/7 = 10/7
4. Denominator of the whole expression: 1 − 1/4 = 3/4
5. Final division: (10/7) ÷ (3/4) = (10/7) × (4/3) = 40/21

**Answer = 40/21**

### (c) Approximate 48.98% of 601

Round 48.98% → 49% (≈ 50%), round 601 → 600.
Quick estimate: 49% of 600 = 0.49 × 600 = **294**
(Exact value: 0.4898 × 601 = 294.3698 — the approximation of 294 is well within rounding tolerance for a multiple-choice answer.)

---

## 4. Timed Practice Set

1. Simplify: 15 − 3 × (2 + 4) ÷ 9. (30 sec)
2. Simplify: (7 + 3) × 2 − 8 ÷ 4. (30 sec)
3. Convert 5/8 to a decimal. (20 sec)
4. Simplify: [1/2 + 1/3] ÷ (1/6). (45 sec)
5. Approximate 19.8% of 250. (30 sec)
6. Simplify: 2 + 1 / (1 + 1/2). (45 sec)
7. Write 0.375 as a fraction in lowest terms. (20 sec)
8. Simplify: 20 − [8 + (6 − 2)] ÷ 4. (45 sec)

### Answer Key

1. **13** — bracket: 2+4=6; 3×6=18, 18÷9=2; 15−2=13.
2. **18** — bracket: 7+3=10; 10×2=20; 8÷4=2; 20−2=18.
3. **0.625** — from the fraction-decimal table.
4. **5** — 1/2+1/3 = 5/6; (5/6) ÷ (1/6) = (5/6)×6 = 5.
5. **≈50** — 19.8% ≈ 20%; 20% of 250 = 50 (exact value 49.5).
6. **8/3** — 1+1/2 = 3/2; 1÷(3/2) = 2/3; 2 + 2/3 = 8/3.
7. **3/8** — 0.375 = 375/1000 = 3/8 in lowest terms.
8. **17** — bracket: 6−2=4; 8+4=12; 12÷4=3; 20−3=17.
