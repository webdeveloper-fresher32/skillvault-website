# Ratio and Proportion — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

A ratio is just a comparison of two (or more) quantities by division — 3:4 means "for every 3 units of the first thing, there are 4 units of the second." Ratios show up everywhere in aptitude tests: dividing money or profit among people, mixing two liquids, scaling a recipe, or comparing ages, speeds, and map distances. The test almost never asks you to *find* a ratio from scratch; it asks you to manipulate one — simplify it, combine two ratios that share a common term, or split a total quantity according to it — fast and without setting up algebra.

A proportion says two ratios are equal (a:b = c:d). Within proportion questions, the key distinction the test is checking is whether a relationship is **direct** (as one quantity goes up, the other goes up in the same proportion — e.g., more items bought, more money spent) or **inverse** (as one quantity goes up, the other goes down — e.g., more workers, fewer days needed for the same job). Mixing these up is the single biggest source of errors in this topic.

**Plain-English example:** A recipe for 4 people uses 2 cups of rice. That's a direct relationship — for 8 people you need double the rice, 4 cups. Now say a tank takes 6 hours to fill with 2 identical pumps running. That's inverse — add a 3rd pump and it fills faster, not slower, and definitely not in 9 hours (which is what naive direct scaling would wrongly suggest).

---

## 2. Shortcut / Trick

### Simplifying a ratio

Divide every term by their HCF (GCD). 18:24:30 → HCF is 6 → **3:4:5**. Always reduce ratios to lowest terms before comparing or combining them — it keeps the numbers small and the arithmetic fast.

### Dividing a quantity in a given ratio

If a total **T** is to be split in the ratio a : b : c, each person's share is:

$$\text{Share of a part} = T \times \frac{\text{that part}}{a+b+c}$$

i.e., find the sum of the parts once, then multiply the total by (individual part / sum of parts) for each share. This single formula replaces "let the parts be 2x, 3x, 4x..." algebra — you almost never need to introduce x.

### Compounding (combining) two ratios

If you're given a:b and b:c and asked for a:b:c, make the common term (b) equal in both by scaling each ratio up to the LCM of its two b-values, then read off the combined ratio directly:

$$a:b = a:b, \qquad b:c = b:c \;\;\Rightarrow\;\; a:b:c = (a \times k_1) : (b \times \text{LCM}) : (c \times k_2)$$

where you scale the first ratio so its b-term becomes the LCM of the two b-values, and scale the second ratio so its b-term also becomes that LCM.

### Direct vs. inverse proportion

- **Direct proportion** (both quantities move the same way): $\dfrac{x_1}{y_1} = \dfrac{x_2}{y_2}$ — cross-multiply to solve.
- **Inverse proportion** (one quantity moves opposite to the other — classic case: workers and days, or speed and time for a fixed distance): $x_1 y_1 = x_2 y_2$ — the *product* stays constant, not the ratio.

The men-days (or man-hours) family of questions is the most common inverse-proportion trap: **Men × Days = constant amount of work** (holding daily work-rate and hours/day fixed). More men always means fewer days, never more.

---

## 3. Worked Examples

### (a) Divide ₹4,500 among three people in the ratio 2 : 3 : 4

Sum of parts = 2 + 3 + 4 = 9.

- First share = 4500 × 2/9 = **₹1,000**
- Second share = 4500 × 3/9 = **₹1,500**
- Third share = 4500 × 4/9 = **₹2,000**

**Check:** 1000 + 1500 + 2000 = 4500. Matches.

### (b) If a : b = 3 : 4 and b : c = 5 : 6, find a : b : c

The common term is b, currently 4 in the first ratio and 5 in the second. LCM(4, 5) = 20.

- Scale a:b so b becomes 20: multiply by 5 → a:b = 15 : 20
- Scale b:c so b becomes 20: multiply by 4 → b:c = 20 : 24

Now both ratios share b = 20, so combine directly:

$$a:b:c = 15:20:24$$

**Check:** a:b = 15:20 = 3:4 ✓. b:c = 20:24 = 5:6 ✓. Both original ratios are preserved.

### (c) Inverse proportion — men and days

12 men can complete a piece of work in 15 days. How many days will 18 men take to complete the same work?

Since more men finish the same work faster, this is inverse proportion, so **men × days = constant**:

$$M_1 D_1 = M_2 D_2 \;\Rightarrow\; 12 \times 15 = 18 \times D_2 \;\Rightarrow\; D_2 = \frac{180}{18} = 10$$

**Check directly:** 12 men × 15 days = 180 "man-days" of work. 180 man-days ÷ 18 men = 10 days. Matches — and note the answer is *smaller* than 15, as it must be, since we added men.

---

## 4. Timed Practice Set

1. Simplify the ratio 45 : 60 : 75 to its lowest terms. (30 sec)
2. Divide ₹9,600 between two people in the ratio 5 : 3. (40 sec)
3. Divide ₹6,300 among three people in the ratio 3 : 4 : 7. (45 sec)
4. If a : b = 2 : 3 and b : c = 4 : 5, find a : b : c. (60 sec)
5. If x : y = 5 : 6 and y : z = 3 : 4, find x : y : z. (60 sec)
6. If 20 workers can build a wall in 18 days, how many days will 24 workers take? (45 sec)
7. A car covers a fixed distance in 6 hours at 60 km/h. How long will it take at 90 km/h? (45 sec)
8. If the cost of 8 identical pens is ₹120, find the cost of 20 such pens (direct proportion). (30 sec)

### Answer Key

1. **3 : 4 : 5** — HCF of 45, 60, 75 is 15; divide each term by 15.
2. **₹6,000 and ₹3,600** — sum of parts = 8; shares = 9600×5/8 = 6000 and 9600×3/8 = 3600.
3. **₹1,350, ₹1,800, ₹3,150** — sum of parts = 14; shares = 6300×3/14=1350, 6300×4/14=1800, 6300×7/14=3150.
4. **8 : 12 : 15** — LCM of b-values (3, 4) is 12; scale a:b by 4 → 8:12; scale b:c by 3 → 12:15.
5. **5 : 6 : 8** — LCM of b-values (6, 3) is 6; scale x:y by 1 → 5:6; scale y:z by 2 → 6:8.
6. **15 days** — inverse proportion, men×days constant: 20×18 = 24×D → D = 360/24 = 15.
7. **4 hours** — inverse proportion, speed×time constant: 60×6 = 90×T → T = 360/90 = 4.
8. **₹300** — direct proportion: 120/8 = 15 per pen; 20×15 = 300. (Or cross-multiply: 8/120 = 20/x → x = 300.)
