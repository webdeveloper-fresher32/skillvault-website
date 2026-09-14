# Mixtures and Mensuration Basics — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

**Mixtures (replacement/dilution)** problems describe a container of some quantity — usually a liquid like milk — from which a fixed amount is repeatedly removed and replaced with another liquid (usually water). Each time this happens, you're not just diluting once: you're diluting a mixture that was *already* diluted last time, so the fraction remaining shrinks multiplicatively, not by simple subtraction.

**Mensuration** here means the small set of area/perimeter/volume formulas that actually show up in aptitude papers — plain rectangles, squares, circles, triangles, cubes, cuboids, and cylinders. (Full 3D geometry, cones, spheres, frustums, and combined solids are covered separately in Phase 6.)

**Plain-English example (mixture):** A jar has 10 liters of pure milk. You pour out 2 liters (so 8 remain) and top it back up to 10 liters with water. Now the jar is 80% milk. If you repeat the *exact same* operation — pour out 2 liters of the current (already-diluted) mixture and top up with water again — the milk content doesn't drop by another 20 percentage points. It drops by another 20% of what's *currently* there, because the 2 liters you remove the second time is only 80% milk, not pure milk.

---

## 2. Shortcut / Trick

### Replacement / dilution formula

If a container holds quantity `total`, and each time `removed` units are taken out and replaced with the other liquid, then after `n` such operations, the amount of the *original* liquid remaining is:

$$\text{Final} = \text{Initial} \times \left(1 - \frac{\text{removed}}{\text{total}}\right)^n$$

Each operation multiplies the remaining original liquid by the same fixed fraction (1 − removed/total) — that's why it's a power, not a subtraction. Never compute "n × (fraction removed once)"; that only works for n = 1.

### Mensuration formulas actually tested

**Area & perimeter (2D):**

| Shape | Area | Perimeter / Circumference |
|---|---|---|
| Rectangle | l × w | 2(l + w) |
| Square | a² | 4a |
| Circle | πr² | 2πr |
| Triangle | ½ × base × height | sum of 3 sides |

Aptitude papers almost always give a triangle's base and height directly, so ½ × base × height is the default. If only the three side lengths are given (no height), that's a Heron's-formula case — covered separately in Phase 6, not needed here.

**Volume (3D):**

| Solid | Volume |
|---|---|
| Cube | a³ |
| Cuboid | l × w × h |
| Cylinder | πr²h |

**Path/border around a shape:** when a uniform-width path runs around (outside) or is built inside a rectangular field, compute it as a *difference of two areas* — outer rectangle minus inner rectangle (or vice versa) — rather than trying to find a direct formula for the path's own area.

---

## 3. Worked Examples

### (a) Milk-water replacement done n times

A container has 40 liters of pure milk. 4 liters are removed and replaced with water; this operation is repeated a total of 3 times. How much pure milk remains?

Fraction removed each time = 4/40 = 1/10, so the remaining fraction each time = 1 − 1/10 = 9/10.

$$\text{Final milk} = 40 \times \left(\frac{9}{10}\right)^3 = 40 \times \frac{729}{1000} = \frac{29160}{1000} = 29.16 \text{ liters}$$

**Check (step by step):** After operation 1: 40×0.9 = 36 L. After operation 2: 36×0.9 = 32.4 L. After operation 3: 32.4×0.9 = 29.16 L. Matches the direct power calculation.

### (b) Area of a path around a rectangular field

A rectangular field is 20 m long and 15 m wide. A path of uniform width 2 m is built all around the *outside* of the field. Find the area of the path.

Outer rectangle dimensions = (20 + 2×2) by (15 + 2×2) = 24 m by 19 m, since the path adds its width on *both* sides of each dimension.

$$\text{Outer area} = 24 \times 19 = 456 \text{ m}^2 \qquad \text{Field area} = 20 \times 15 = 300 \text{ m}^2$$

$$\text{Path area} = 456 - 300 = 156 \text{ m}^2$$

**Check:** The path can be split into two long strips (top + bottom, each 24 × 2 = 48, total 96) and two short strips (left + right, each 15 × 2 = 30, total 60): 96 + 60 = 156. Matches.

### (c) Volume of a cylinder given radius and height

Find the volume of a cylinder with radius 7 cm and height 10 cm. (Use π = 22/7.)

$$\text{Volume} = \pi r^2 h = \frac{22}{7} \times 7^2 \times 10 = \frac{22}{7} \times 49 \times 10 = 22 \times 7 \times 10 = 1540 \text{ cm}^3$$

**Check:** r = 7 was chosen deliberately so 7² / 7 = 7 cancels the denominator cleanly — 22 × 7 × 10 = 1540. Re-multiplying: 22×70 = 1540. Matches.

---

## 4. Timed Practice Set

1. A vessel contains 20 liters of pure milk. 2 liters are removed and replaced with water; this is done twice in total. How much pure milk remains? (45 sec)
2. A cistern holds 81 liters of pure liquid. After how many operations of removing 27 liters and replacing with water does the pure liquid drop to 24 liters? (40 sec)
3. Find the area and perimeter of a rectangle 12 m long and 8 m wide. (20 sec)
4. Find the area of a circle of radius 14 cm. (Use π = 22/7.) (30 sec)
5. A square field has a perimeter of 64 m. Find its area. (30 sec)
6. A rectangular garden 30 m by 20 m has a path of width 3 m built all around the outside. Find the area of the path. (45 sec)
7. Find the volume of a cuboid with length 5 m, width 4 m, and height 3 m. (20 sec)
8. Find the volume of a cube whose edge is 6 cm. (20 sec)

### Answer Key

1. **16.2 liters** — remaining fraction per step = 1 − 2/20 = 9/10; Final = 20×(9/10)² = 20×0.81 = 16.2.
2. **Remaining fraction is 24/81 = 8/27 = (2/3)³** — since 1 − 27/81 = 2/3 per operation, and (2/3)³ = 8/27 matches 24/81 exactly, so 3 operations.
3. **Area = 96 m², Perimeter = 40 m** — Area = 12×8 = 96; Perimeter = 2(12+8) = 40.
4. **616 cm²** — Area = (22/7)×14² = (22/7)×196 = 22×28 = 616.
5. **256 m²** — side = 64/4 = 16; Area = 16² = 256.
6. **336 m²** — outer dimensions = (30+2×3)×(20+2×3) = 36×26 = 936; field area = 30×20 = 600; path area = 936 − 600 = 336.
7. **60 m³** — Volume = 5×4×3 = 60.
8. **216 cm³** — Volume = 6³ = 216.
