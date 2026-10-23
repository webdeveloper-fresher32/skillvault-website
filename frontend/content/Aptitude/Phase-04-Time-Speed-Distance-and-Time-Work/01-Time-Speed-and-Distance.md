# Time, Speed, and Distance — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Speed is just the rate at which distance is covered: **speed = distance ÷ time**. Rearranged, the same relationship gives you distance = speed × time, or time = distance ÷ speed — one formula, three faces, and every question in this topic is really asking you to pick the right face. The test mostly checks two things: can you handle unit conversions cleanly (km/h vs. m/s), and can you correctly combine speeds when two bodies are moving relative to each other or relative to the ground.

The trickiest conceptual trap is the difference between **average speed** and the **average of speeds**. If a journey is covered in two equal-distance legs at speeds a and b, the average speed for the whole trip is **not** (a+b)/2. Average speed is always *total distance ÷ total time* — and because the slower leg eats up more time, it drags the true average down below the simple arithmetic mean.

**Plain-English example:** You drive 60 km to a friend's house at 60 km/h (takes 1 hour) and drive the same 60 km back at 30 km/h (takes 2 hours). Total distance = 120 km, total time = 3 hours, so average speed = 40 km/h — not 45 km/h, which is what naively averaging 60 and 30 would give.

---

## 2. Shortcut / Trick

### Unit conversion: km/h ↔ m/s

$$\text{km/h} \to \text{m/s}: \text{multiply by } \frac{5}{18} \qquad \text{m/s} \to \text{km/h}: \text{multiply by } \frac{18}{5}$$

This comes straight from 1 km = 1000 m and 1 hour = 3600 s, so 1 km/h = 1000/3600 m/s = 5/18 m/s. Memorize the fraction, not a derivation — you need this instantly, every single question.

### Relative speed (two moving bodies)

- **Moving toward each other** (opposite directions, converging): relative speed = **sum** of the two speeds. Time to meet = (distance between them) ÷ (sum of speeds).
- **Moving away from each other** (opposite directions, diverging): relative speed = **sum** of the two speeds. The gap grows at this combined rate.
- **Moving in the same direction** (one chasing the other): relative speed = **difference** of the two speeds. This is the rate at which the faster one closes the gap on (or opens a lead over) the slower one.

Rule of thumb: opposite directions → add speeds; same direction → subtract speeds.

### Average speed for equal-distance legs

$$\text{Average speed} = \frac{2ab}{a+b} \quad \text{(harmonic mean of the two speeds, for two equal-distance legs)}$$

Use the plain distance/time definition if the legs are *not* equal distances or there are more than two legs — the 2ab/(a+b) shortcut only applies to the classic "same distance, two speeds" setup.

### Speed changed, time changes inversely (fixed distance)

If distance is fixed, speed and time are inversely proportional: $s_1 t_1 = s_2 t_2 = \text{distance}$. So if speed increases, new time = distance ÷ new speed — never assume the time changes by the same percentage as the speed (it doesn't, because the relationship is inverse, not linear).

---

## 3. Worked Examples

### (a) Convert 72 km/h to m/s

$$72 \times \frac{5}{18} = \frac{360}{18} = 20 \text{ m/s}$$

**Check (reverse conversion):** 20 m/s × 18/5 = 360/5 = 72 km/h. Matches.

### (b) Two cyclists, 105 km apart, moving toward each other

Cyclist A rides at 20 km/h, cyclist B rides at 15 km/h, starting at the same time from two points 105 km apart, moving toward each other. When do they meet?

Since they move toward each other, relative speed = sum = 20 + 15 = 35 km/h.

$$\text{Time to meet} = \frac{105}{35} = 3 \text{ hours}$$

**Check:** In 3 hours, A covers 20×3 = 60 km and B covers 15×3 = 45 km. 60 + 45 = 105 km — exactly the starting gap. Matches.

**Variant — same direction:** If instead B started 105 km ahead of A and both moved in the *same* direction (A chasing B) at the same speeds, A would gain on B at the *difference* of speeds, 20 − 15 = 5 km/h, taking 105/5 = 21 hours to catch up.

### (c) A car's speed is increased; find the new time

A car covers 300 km in 5 hours. If its speed is increased by 15 km/h, how long does it now take to cover the same 300 km?

Original speed = 300/5 = 60 km/h. New speed = 60 + 15 = 75 km/h.

$$\text{New time} = \frac{300}{75} = 4 \text{ hours}$$

**Check:** 75 km/h × 4 hours = 300 km. Matches — and the time dropped by exactly 1 hour, not by 15/60 = 25% of the original time (5 × 0.75 = 3.75 ≠ 4), confirming the inverse (not linear) relationship between speed and time for a fixed distance.

---

## 4. Timed Practice Set

1. Convert 90 km/h to m/s. (20 sec)
2. Convert 25 m/s to km/h. (20 sec)
3. Two towns are 220 km apart. A bus leaves each town at the same time, traveling toward the other at 50 km/h and 60 km/h respectively. After how many hours do they meet? (45 sec)
4. A cheetah runs at 30 m/s and a gazelle 500 m ahead runs at 20 m/s in the same direction. How long does the cheetah take to catch the gazelle? (45 sec)
5. A man travels the first half of a journey at 40 km/h and the second half (equal distance) at 60 km/h. Find his average speed for the whole journey. (45 sec)
6. A train covers 180 km in 3 hours. If its speed is reduced by 10 km/h, find the new time for the same distance. (40 sec)
7. Two friends start from the same point at the same time, walking in opposite directions at 6 km/h and 4 km/h. How far apart are they after 2.5 hours? (30 sec)
8. A scooter covers a distance in 4 hours at 45 km/h. What speed is needed to cover the same distance in 3 hours? (40 sec)

### Answer Key

1. **25 m/s** — 90 × 5/18 = 25.
2. **90 km/h** — 25 × 18/5 = 90.
3. **2 hours** — moving toward each other, relative speed = 50+60 = 110 km/h; time = 220/110 = 2.
4. **50 seconds** — same direction, relative speed = 30−20 = 10 m/s; time = 500/10 = 50 s.
5. **48 km/h** — equal-distance legs, average speed = 2ab/(a+b) = 2×40×60/(40+60) = 4800/100 = 48.
6. **3.6 hours** — original speed = 180/3 = 60 km/h; new speed = 50 km/h; new time = 180/50 = 3.6.
7. **25 km** — opposite directions, relative speed = 6+4 = 10 km/h; distance = 10×2.5 = 25.
8. **60 km/h** — distance = 45×4 = 180 km; new speed = 180/3 = 60.
