# Geometry and Mensuration — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Phase 5 covered the *basic* mensuration set — rectangle, square, circle, triangle (given base and height), cube, cuboid, cylinder. This lesson picks up where that left off, with the harder shapes and the harder version of the triangle problem: right triangles (Pythagoras), triangles where only the three sides are known (Heron's formula), circular sectors (a "slice" of a circle), and the two curved 3D solids that show up constantly in aptitude papers — the cone and the sphere.

**Pythagoras' theorem:** in a right-angled triangle, the square of the hypotenuse (the side opposite the right angle) equals the sum of the squares of the other two sides:

$$c^2 = a^2 + b^2$$

**Heron's formula:** when a triangle's three side lengths (a, b, c) are given but *not* its height, you can't use ½×base×height directly. Instead, compute the semi-perimeter s = (a+b+c)/2, then:

$$\text{Area} = \sqrt{s(s-a)(s-b)(s-c)}$$

**Circle sector:** a sector is the pie-slice-shaped region between two radii and the arc they cut off. If the angle at the center is θ (in degrees) and the radius is r, the sector is simply that fraction of the whole circle:

$$\text{Sector Area} = \frac{\theta}{360} \times \pi r^2 \qquad \text{Arc Length} = \frac{\theta}{360} \times 2\pi r$$

**Cone:** a cone with base radius r, height h, and slant height l (the distance from the apex to the edge of the base, with l² = r² + h²) has:

$$\text{Volume} = \frac{1}{3}\pi r^2 h \qquad \text{Curved Surface Area (CSA)} = \pi r l \qquad \text{Total Surface Area (TSA)} = \pi r (l + r)$$

**Sphere:** a sphere of radius r has:

$$\text{Volume} = \frac{4}{3}\pi r^3 \qquad \text{Surface Area} = 4\pi r^2$$

---

## 2. Shortcut / Trick

**Pythagorean triples** — memorize the common ones so you never need to compute square roots under time pressure: (3,4,5), (5,12,13), (6,8,10), (7,24,25), (8,15,17), (9,12,15), (9,40,41), (20,21,29). If two of a right triangle's sides match a multiple of one of these, the third side is instant recall, not arithmetic.

**Heron's formula only when you must** — if the height is given (or derivable in one step, e.g. an isosceles triangle where you can drop a perpendicular and use Pythagoras), just use ½×base×height; it's faster. Reach for Heron's formula only when all three sides are given and no height is obvious.

**Sector area is a fraction, not a new formula** — don't memorize a separate sector formula. Just remember "sector = (angle/360) × full circle," and reuse whatever circle formula (area or circumference) you already know.

**Cone and sphere volume ratio trick** — a cone and a cylinder with the same base radius and height: the cone's volume is always exactly ⅓ of the cylinder's. A sphere and a cylinder that exactly circumscribes it (same radius, height = 2r): the sphere's volume is exactly ⅔ of that cylinder's. These ratios let you sanity-check an answer instantly.

**Pick π = 22/7 when r is a multiple of 7** (or 14, 21, 3.5, etc.) — the 7 in the denominator cancels cleanly and the arithmetic becomes pure multiplication. If r isn't a multiple of 7, the question usually expects π = 3.14 instead.

---

## 3. Worked Examples

### (a) Area of a triangle via Heron's formula

Find the area of a triangle whose sides are 13 cm, 14 cm, and 15 cm.

Semi-perimeter: s = (13+14+15)/2 = 42/2 = 21.

$$\text{Area} = \sqrt{21(21-13)(21-14)(21-15)} = \sqrt{21 \times 8 \times 7 \times 6} = \sqrt{7056} = 84 \text{ cm}^2$$

**Check:** 21×8 = 168, 7×6 = 42, 168×42 = 7056, and 84² = 7056. Matches.

### (b) Sector area given angle

Find the area of a sector of radius 21 cm with a central angle of 60°. (Use π = 22/7.)

$$\text{Sector Area} = \frac{60}{360} \times \frac{22}{7} \times 21^2 = \frac{1}{6} \times \frac{22}{7} \times 441 = \frac{1}{6} \times 22 \times 63 = \frac{1386}{6} = 231 \text{ cm}^2$$

**Check:** Full circle area = (22/7)×441 = 22×63 = 1386 cm². A 60° sector is exactly 1/6 of the circle (since 360/60 = 6), and 1386/6 = 231. Matches.

### (c) Volume of a cone

Find the volume of a cone with base radius 3.5 cm and height 12 cm. (Use π = 22/7.)

$$\text{Volume} = \frac{1}{3} \times \frac{22}{7} \times (3.5)^2 \times 12 = \frac{1}{3} \times \frac{22}{7} \times 12.25 \times 12$$

$$\frac{22}{7} \times 12.25 = \frac{22 \times 12.25}{7} = \frac{269.5}{7} = 38.5 \qquad 38.5 \times 12 = 462 \qquad \frac{462}{3} = 154 \text{ cm}^3$$

**Check:** A cylinder of the same radius and height would have volume πr²h = 38.5×12 = 462 cm³; the cone is exactly ⅓ of that, 462/3 = 154. Matches the cone-vs-cylinder ratio rule.

---

## 4. Timed Practice Set

1. A right triangle has legs of 9 cm and 12 cm. Find the hypotenuse. (20 sec)
2. Find the area of a triangle with sides 5 cm, 6 cm, and 7 cm, using Heron's formula. (60 sec)
3. Find the area of a sector of radius 14 cm with a central angle of 90°. (Use π = 22/7.) (40 sec)
4. Find the arc length of the same sector — radius 14 cm, central angle 90°. (Use π = 22/7.) (30 sec)
5. Find the volume of a cone with base radius 7 cm and height 24 cm. (Use π = 22/7.) (45 sec)
6. Find the curved surface area of a cone with base radius 7 cm and slant height 25 cm. (Use π = 22/7.) (30 sec)
7. Find the volume of a sphere of radius 7 cm. (Use π = 22/7.) (45 sec)
8. Find the surface area of a sphere of radius 7 cm. (Use π = 22/7.) (30 sec)

### Answer Key

1. **15 cm** — 9² + 12² = 81 + 144 = 225 = 15² (this is the (3,4,5) triple scaled by 3).
2. **6√6 cm² ≈ 14.7 cm²** — s = (5+6+7)/2 = 9; Area = √(9×4×3×2) = √216 = 6√6.
3. **154 cm²** — Sector Area = (90/360)×(22/7)×14² = (1/4)×(22/7)×196 = (1/4)×616 = 154.
4. **22 cm** — Arc Length = (90/360)×2×(22/7)×14 = (1/4)×2×22×2 = (1/4)×88 = 22.
5. **1232 cm³** — Volume = (1/3)×(22/7)×7²×24 = (1/3)×22×7×24 = 1232.
6. **550 cm²** — CSA = πrl = (22/7)×7×25 = 22×25 = 550.
7. **1437.33 cm³ (= 4312/3 cm³)** — Volume = (4/3)×(22/7)×7³ = (4/3)×22×49 = 4312/3.
8. **616 cm²** — Surface Area = 4πr² = 4×(22/7)×49 = 4×22×7 = 616.
