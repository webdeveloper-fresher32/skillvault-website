# Trains and Boats & Streams — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Trains and boats questions are just time-speed-distance in disguise, with one extra wrinkle each. For a train, the "distance" it must cover to fully cross something is not the distance between two points on the ground — it's the train's own **length** plus whatever it's crossing, because the train isn't a single point: the front must reach the far end *and* the tail must clear the near end. For boats, the "speed" isn't fixed — a flowing stream adds to the boat's speed when moving with it and subtracts when moving against it, so the boat has two different ground speeds depending on direction.

Both topics ultimately reduce to relative speed and combined length, concepts you've already seen: crossing another moving train is exactly the "two bodies moving toward/away from each other" idea, and boats upstream/downstream is exactly "speed changes depending on a helping or opposing current."

**Plain-English example:** A 100 m train crossing a signal pole only has to cover its own 100 m (the pole is a single point). The same train crossing a 200 m platform has to cover 100 + 200 = 300 m, because the tail of the train must clear the far end of the platform. Similarly, a boat that rows at 10 km/h in still water moves at 10+2 = 12 km/h with a 2 km/h current pushing it, but only 10−2 = 8 km/h fighting that same current on the way back.

---

## 2. Shortcut / Trick

### Trains — what "crossing" means

| Crossing... | Distance to cover | Speed to use |
|---|---|---|
| A pole / a person standing still (a point object) | Length of the train | Train's own speed |
| A platform / a bridge (length L) | Train length + L | Train's own speed |
| Another train, moving **opposite** directions | Sum of both train lengths | Sum of both speeds |
| Another train, moving **same** direction (overtaking) | Sum of both train lengths | Difference of both speeds |

$$\text{Time to cross} = \frac{\text{distance to cover}}{\text{speed to use (as per table above)}}$$

Always convert speeds to the same unit as the lengths before dividing — lengths are almost always in meters and speeds are usually given in km/h, so convert km/h → m/s (×5/18) first.

### Boats and streams

Let **b** = boat's speed in still water, **s** = speed of the stream (current).

$$\text{Downstream speed} = b + s \qquad \text{Upstream speed} = b - s$$

**Reverse formulas** (given downstream speed *d* and upstream speed *u*, find b and s):

$$b = \frac{d+u}{2} \qquad s = \frac{d-u}{2}$$

These reverse formulas fall straight out of solving the two equations d = b+s and u = b−s simultaneously — adding them gives d+u = 2b, subtracting gives d−u = 2s. Memorize them directly so you never have to redo the algebra under time pressure.

---

## 3. Worked Examples

### (a) A train crossing a platform

A train 150 m long crosses a platform 350 m long at a speed of 72 km/h. Find the time taken.

Convert speed: 72 km/h × 5/18 = 20 m/s. Distance to cover = train length + platform length = 150 + 350 = 500 m.

$$\text{Time} = \frac{500}{20} = 25 \text{ seconds}$$

**Check:** At 20 m/s for 25 s, the train travels 500 m — exactly its own length plus the platform, so both the front clears the far end and the tail clears the near end. Matches.

### (b) Two trains crossing each other, opposite directions

A train 120 m long running at 54 km/h and another train 180 m long running at 36 km/h are moving toward each other on parallel tracks. Find the time they take to cross each other.

Convert speeds: 54 × 5/18 = 15 m/s, 36 × 5/18 = 10 m/s. Opposite directions → relative speed = sum = 15 + 10 = 25 m/s. Distance to cover = sum of lengths = 120 + 180 = 300 m.

$$\text{Time} = \frac{300}{25} = 12 \text{ seconds}$$

**Check:** In 12 s, the first train covers 15×12 = 180 m and the second covers 10×12 = 120 m; total ground covered between them = 300 m, matching the combined length needed for both to fully clear each other. Matches.

### (c) Boat's speed in still water, given upstream/downstream times

A boat covers a certain distance downstream in 2 hours and returns the same distance upstream in 3 hours. If the distance each way is 24 km, find the boat's speed in still water and the speed of the stream.

Downstream speed = 24/2 = 12 km/h. Upstream speed = 24/3 = 8 km/h.

$$b = \frac{12+8}{2} = 10 \text{ km/h} \qquad s = \frac{12-8}{2} = 2 \text{ km/h}$$

**Check:** Downstream = b+s = 10+2 = 12 km/h ✓ (matches 24/2). Upstream = b−s = 10−2 = 8 km/h ✓ (matches 24/3). Both match.

---

## 4. Timed Practice Set

1. A train 200 m long crosses a signal pole in 10 seconds. Find its speed in km/h. (30 sec)
2. A train 180 m long running at 54 km/h crosses a platform in 20 seconds. Find the length of the platform. (45 sec)
3. Two trains, 110 m and 90 m long, run on parallel tracks in the same direction at 60 km/h and 42 km/h. Find the time the faster train takes to completely pass the slower one. (60 sec)
4. Two trains 100 m and 140 m long run toward each other at 45 km/h and 63 km/h. Find the time they take to cross each other. (60 sec)
5. A boat's speed in still water is 15 km/h and the stream flows at 3 km/h. Find the downstream and upstream speeds. (30 sec)
6. A boat covers 32 km downstream in 4 hours and the same distance upstream in 8 hours. Find the boat's speed in still water and the stream's speed. (60 sec)
7. A man rows downstream at 14 km/h and upstream at 6 km/h. Find his speed in still water and the speed of the current. (30 sec)
8. A train crosses a platform 300 m long in 25 seconds and a signal pole in 10 seconds. Find the length of the train. (60 sec)

### Answer Key

1. **72 km/h** — speed = 200 m / 10 s = 20 m/s; 20 × 18/5 = 72 km/h.
2. **120 m** — speed = 54×5/18 = 15 m/s; distance covered = 15×20 = 300 m; platform = 300−180 = 120 m.
3. **40 seconds** — same direction, relative speed = 60−42 = 18 km/h = 18×5/18 = 5 m/s; combined length = 110+90 = 200 m; time = 200/5 = 40.
4. **8 seconds** — opposite directions, relative speed = 45+63 = 108 km/h = 108×5/18 = 30 m/s; combined length = 100+140 = 240 m; time = 240/30 = 8 seconds.
5. **Downstream 18 km/h, upstream 12 km/h** — 15+3=18, 15−3=12.
6. **Boat 6 km/h, stream 2 km/h** — downstream speed = 32/4 = 8 km/h; upstream speed = 32/8 = 4 km/h; b=(8+4)/2=6, s=(8−4)/2=2.
7. **Boat 10 km/h, current 4 km/h** — b=(14+6)/2=10, s=(14−6)/2=4.
8. **Train length = 200 m** — speed = train length / 10 (crossing pole); crossing platform: (length+300)/25 = length/10 → cross-multiply: 10(length+300) = 25×length → 10×length+3000 = 25×length → 3000 = 15×length → length = 200 m.
