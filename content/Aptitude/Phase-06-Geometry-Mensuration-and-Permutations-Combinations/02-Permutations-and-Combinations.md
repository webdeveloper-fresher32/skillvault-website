# Permutations and Combinations — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Both permutations and combinations count the number of ways to select items from a group — the entire question is whether **order matters**.

**Permutation (nPr):** the number of ways to arrange r items chosen from n distinct items, where *order matters* (ABC is different from BCA).

$$nPr = \frac{n!}{(n-r)!}$$

**Combination (nCr):** the number of ways to choose r items from n distinct items, where *order does not matter* (the group {A,B,C} is the same regardless of the order you picked them in).

$$nCr = \frac{n!}{r!(n-r)!} = \frac{nPr}{r!}$$

Notice nCr is just nPr with the r! "order" duplicates divided out — every group of r items can be arranged in r! different orders, and combinations don't care about those orders, so you strip them out.

**Plain-English test:** "In how many ways can a president and secretary be picked from 5 people?" — order matters (president ≠ secretary), so it's a permutation, 5P2. "In how many ways can a committee of 2 be picked from 5 people?" — order doesn't matter (just a group of 2), so it's a combination, 5C2.

**Circular permutations:** arranging n distinct people around a circular table is different from arranging them in a line, because a circle has no fixed starting point — rotating everyone by one seat gives the "same" arrangement. So instead of n! (linear), fix one person's seat as a reference and arrange the rest:

$$\text{Circular permutations of } n \text{ distinct objects} = (n-1)!$$

(If clockwise and counterclockwise arrangements are considered identical — e.g., beads on a bracelet, flowers in a garland — divide by 2 again: (n-1)!/2.)

**Permutations with repetition:** if you're arranging n items where some items are identical (e.g., letters of a word with repeated letters), plain n! overcounts, because swapping two identical items produces an arrangement that looks the same but n! counted it as different. Divide out the repeats:

$$\text{Arrangements} = \frac{n!}{p_1! \, p_2! \, \cdots \, p_k!}$$

where p₁, p₂, … are the counts of each repeated item.

---

## 2. Shortcut / Trick

**Order matters → P. Order doesn't matter → C.** Before writing any formula, ask: if I swap two selected items, do I get a genuinely different outcome (a different arrangement, a different assignment of roles)? If yes → permutation. If the swap changes nothing (it's still "the same group") → combination.

**Factorial cancellation** — never expand a full factorial like 10! by hand. nPr = n!/(n-r)! is really just "the top r factors of n!, counting down": 10P3 = 10×9×8 (three descending terms, stop after r terms). This avoids computing 10! or 7! at all.

**nCr symmetry** — nCr = nC(n-r). Choosing 3 items to include from 10 is the same count as choosing 7 items to *exclude*. If r is more than half of n, flip it: 10C8 = 10C2, which is much faster to compute by hand.

**Circular permutation reflex** — see "around a table," "in a circle," "in a ring" → immediately think (n-1)!, not n!. This is the single most common trap in this topic.

---

## 3. Worked Examples

### (a) Arrange the letters of a word with repeated letters

How many distinct arrangements are there of the letters of the word "BANANA"?

BANANA has 6 letters total: B(1), A(3), N(2).

$$\text{Arrangements} = \frac{6!}{3! \times 2!} = \frac{720}{6 \times 2} = \frac{720}{12} = 60$$

**Check:** If all 6 letters were distinct, there'd be 6! = 720 arrangements. But the 3 A's can be internally shuffled 3! = 6 ways without changing the word, and the 2 N's can be shuffled 2! = 2 ways — so we divide by both: 720/(6×2) = 60.

### (b) Choose a committee (nCr)

In how many ways can a committee of 3 people be chosen from a group of 8 people?

Order doesn't matter (it's just a group of 3), so use nCr:

$$8C3 = \frac{8!}{3! \times 5!} = \frac{8 \times 7 \times 6}{3 \times 2 \times 1} = \frac{336}{6} = 56$$

**Check:** Using the descending-factor shortcut, 8C3 keeps only the top 3 factors of 8! over 3!: (8×7×6)/(3×2×1) = 336/6 = 56.

### (c) Circular arrangement of n people

In how many ways can 6 people be seated around a circular table?

$$\text{Circular permutations} = (6-1)! = 5! = 120$$

**Check:** Fix one person's seat (say, Person A always sits at the "top") to remove the rotational duplicates — the remaining 5 people can then be arranged in the other 5 seats in 5! = 120 ways, exactly matching the formula.

---

## 4. Timed Practice Set

1. In how many ways can 4 books be selected and arranged (order matters) from a shelf of 7 different books? (30 sec)
2. In how many ways can 4 books be chosen (order doesn't matter) from a shelf of 10 different books? (30 sec)
3. Find the number of distinct arrangements of the letters of the word "APPLE." (30 sec)
4. In how many ways can 8 people be seated around a circular table? (20 sec)
5. In how many ways can 6 identical-looking beads be arranged on a bracelet (where clockwise and counterclockwise arrangements are considered the same)? (30 sec)
6. A committee of 5 is to be formed from 5 men and 4 women, consisting of exactly 3 men and 2 women. In how many ways can this be done? (45 sec)
7. How many 3-letter "words" (no letter repeated) can be formed from 6 distinct letters? (20 sec)
8. Find the number of distinct arrangements of the letters of the word "MISSISSIPPI." (60 sec)

### Answer Key

1. **840** — 7P4 = 7×6×5×4 = 840 (order matters: which book goes in which position).
2. **210** — 10C4 = (10×9×8×7)/(4×3×2×1) = 5040/24 = 210.
3. **60** — APPLE has 5 letters with P repeated twice: 5!/2! = 120/2 = 60.
4. **5040** — Circular permutations = (8−1)! = 7! = 5040.
5. **60** — Bracelet (reflection = same): (6−1)!/2 = 120/2 = 60.
6. **60** — Choose 3 men from 5 and 2 women from 4 independently, then multiply: 5C3 × 4C2 = 10 × 6 = 60.
7. **120** — 6P3 = 6×5×4 = 120 (order matters, letters not repeated).
8. **34650** — MISSISSIPPI has 11 letters: M(1), I(4), S(4), P(2). Arrangements = 11!/(4!×4!×2!) = 39916800/1152 = 34650.
