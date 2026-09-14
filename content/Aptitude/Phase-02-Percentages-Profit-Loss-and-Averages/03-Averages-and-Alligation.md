# Averages and Alligation — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

An average summarizes a group of numbers with one representative value: add everything up and divide by the count. Aptitude tests rarely stop at that plain definition, though — they layer it into three recurring shapes: **weighted averages** (combining groups of different sizes, like two classes with different average scores), **average speed** (which is *not* the simple average of two speeds when the distances are equal — it's a harmonic-mean situation), and **alligation** (a fast, visual way to find the mixing ratio of two ingredients — sugar and water, milk and water, two grades of tea — to hit a target average).

These three ideas are really the same skill (a weighted balance point between two or more values) applied to different dressed-up scenarios. Once you see averages, average speed, and alligation as one family, you stop re-deriving formulas from scratch under time pressure.

**Plain-English example:** If a class of 30 students averages 70 marks and another class of 20 students averages 60 marks, the combined average is *not* 65 (the simple average of 70 and 60) — the bigger class pulls the answer closer to 70. It works out to 66, because you have to weight by how many students are in each group.

---

## 2. Shortcut / Trick

### Simple average

$$\text{Average} = \frac{\text{Sum of values}}{\text{Number of values}}$$

Shortcut for the average of the first n natural numbers (1, 2, 3, ..., n):

$$\text{Average} = \frac{n+1}{2}$$

### Weighted average

$$\text{Weighted average} = \frac{w_1 x_1 + w_2 x_2 + \dots}{w_1 + w_2 + \dots}$$

### Average speed (equal distances, two different speeds)

If a distance is covered at speed x one way and speed y on the return (same distance both ways), the average speed for the whole trip is the **harmonic mean**, not the simple average:

$$\text{Average speed} = \frac{2xy}{x+y}$$

(Simple average (x+y)/2 is only correct when equal *time*, not equal distance, is spent at each speed — a common trap.)

### Alligation rule (mixture problems)

To mix a cheaper ingredient (value C) with a dearer ingredient (value D) to get a mixture averaging M, the ratio of quantities needed is found by cross-subtraction:

```
   Cheaper (C)          Dearer (D)
          \                /
           \              /
              Mean (M)
           /              \
          /                \
   (D − M)              (M − C)
```

$$\text{Quantity of Cheaper} : \text{Quantity of Dearer} = (D - M) : (M - C)$$

This works for concentrations (% acid, % fat), prices (₹/kg), or any other single blended attribute.

---

## 3. Worked Examples

### (a) Average of the first 50 natural numbers

$$\text{Average} = \frac{n+1}{2} = \frac{50+1}{2} = \frac{51}{2} = \textbf{25.5}$$

### (b) Mix solution A (40% acid) with solution B (15% acid) to get a mixture that is 25% acid. Find the ratio A : B.

Cheaper = 15 (B), Dearer = 40 (A), Mean = 25.

Ratio (Cheaper : Dearer) = (D − M) : (M − C) = (40 − 25) : (25 − 15) = 15 : 10 = 3 : 2

So **B : A = 3 : 2**, i.e., **A : B = 2 : 3**.

**Check directly:** with A = 2 parts, B = 3 parts: (40×2 + 15×3)/(2+3) = (80+45)/5 = 125/5 = 25%. Matches.

### (c) A car travels one way at 40 km/h and returns over the same distance at 60 km/h. Find the average speed for the round trip.

$$\text{Average speed} = \frac{2xy}{x+y} = \frac{2 \times 40 \times 60}{40+60} = \frac{4800}{100} = \textbf{48 km/h}$$

**Note:** the simple average (40+60)/2 = 50 km/h is *wrong* here — the car spends more time at the slower speed (since distance is equal, not time), which pulls the true average speed down to 48 km/h.

---

## 4. Timed Practice Set

1. Find the average of 12, 15, 18, 21, 24. (20 sec)
2. Find the average of the first 40 natural numbers. (20 sec)
3. A car covers a distance at 50 km/h one way and returns over the same distance at 70 km/h. Find the average speed for the whole trip. (30 sec)
4. In what ratio should tea worth ₹80/kg be mixed with tea worth ₹100/kg to get a mixture worth ₹92/kg? (45 sec)
5. A class of 30 students has an average score of 70, and another class of 20 students has an average score of 60. Find the combined average. (45 sec)
6. A man covers a certain distance at 30 km/h and returns over the same distance at 20 km/h. Find his average speed for the trip. (30 sec)
7. In what ratio must rice at ₹50/kg be mixed with rice at ₹70/kg to get a mixture worth ₹65/kg? (45 sec)
8. The average of 5 numbers is 27. If one number is excluded, the average of the remaining 4 numbers becomes 25. Find the excluded number. (45 sec)

### Answer Key

1. **18** — sum = 12+15+18+21+24 = 90; 90/5 = 18.
2. **20.5** — (n+1)/2 = 41/2 = 20.5.
3. **58.33 km/h** — 2×50×70/(50+70) = 7000/120 ≈ 58.33.
4. **2 : 3 (80/kg : 100/kg)** — ratio Cheaper:Dearer = (100−92):(92−80) = 8:12 = 2:3. Check: (80×2+100×3)/5 = 460/5 = 92. Matches.
5. **66** — (30×70 + 20×60)/50 = (2100+1200)/50 = 3300/50 = 66.
6. **24 km/h** — 2×30×20/(30+20) = 1200/50 = 24.
7. **1 : 3 (50/kg : 70/kg)** — ratio Cheaper:Dearer = (70−65):(65−50) = 5:15 = 1:3. Check: (50×1+70×3)/4 = 260/4 = 65. Matches.
8. **35** — sum of 5 numbers = 27×5 = 135; sum of remaining 4 = 25×4 = 100; excluded number = 135−100 = 35.
