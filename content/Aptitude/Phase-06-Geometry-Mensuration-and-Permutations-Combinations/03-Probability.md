# Probability — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Probability measures how likely an event is, as a fraction between 0 (impossible) and 1 (certain):

$$P(A) = \frac{\text{Number of favorable outcomes}}{\text{Total number of possible outcomes}}$$

**Addition rule (for "OR"):** the probability that event A *or* event B happens is:

$$P(A \cup B) = P(A) + P(B) - P(A \cap B)$$

The last term subtracts the overlap so outcomes that satisfy *both* A and B aren't counted twice. If A and B can never happen together (mutually exclusive, e.g. "the die shows a 2" or "the die shows a 5"), P(A∩B) = 0 and the rule simplifies to just P(A) + P(B).

**Multiplication rule (for "AND"):** the probability that event A *and* event B both happen is:

- If A and B are **independent** (one doesn't affect the other — e.g., two separate coin tosses): P(A∩B) = P(A) × P(B).
- If A and B are **dependent** (the outcome of A changes the probability of B — e.g., drawing two cards from a deck *without* replacement): P(A∩B) = P(A) × P(B | A), where P(B|A) is B's probability *given that A already happened*.

**Complementary probability:** the probability of an event happening equals 1 minus the probability of it *not* happening:

$$P(A) = 1 - P(\text{not } A)$$

This is a shortcut, not a separate concept — it becomes powerful exactly when "not A" is much easier to count than A itself.

---

## 2. Shortcut / Trick

**"At least one" almost always means: use the complement.** Directly counting "at least one head in 3 tosses" means adding up the probabilities of exactly 1, exactly 2, and exactly 3 heads — three separate calculations. But "not at least one head" is just "zero heads" (all tails) — one clean calculation. Whenever you see "at least one," immediately compute P(none) and subtract from 1.

**Cards deck facts to memorize cold:** 52 cards total, 4 suits (13 each), 2 colors (26 each), 4 aces, 4 kings/queens/jacks, 12 face cards total. Having these memorized means you never have to pause to recall deck structure mid-problem.

**Without replacement = dependent, with replacement = independent.** This is the fastest way to classify a card/ball-drawing problem: if the item is put back before the next draw, the draws don't affect each other (multiply the same-denominator fractions); if it's not put back, the denominator (and possibly the numerator) shrinks for the next draw.

**Dice sums are not equally likely.** For two dice, the number of ways to make each sum ranges from 1 (sum=2 or 12) up to 6 (sum=7) — don't assume every sum from 2–12 has the same 1/11 probability; always count the actual (die1, die2) pairs.

---

## 3. Worked Examples

### (a) Probability of drawing 2 aces from a deck

Two cards are drawn one after another *without replacement* from a standard 52-card deck. Find the probability both are aces.

This is a dependent-events problem: after the first ace is drawn, only 3 aces remain among 51 cards.

$$P(\text{both aces}) = \frac{4}{52} \times \frac{3}{51} = \frac{12}{2652} = \frac{1}{221}$$

**Check (via combinations):** choosing 2 aces out of 4 possible aces, divided by choosing any 2 cards out of 52: 4C2 / 52C2 = 6 / 1326 = 1/221. Matches.

### (b) At least one head in 3 coin tosses (complement trick)

Three fair coins are tossed. Find the probability of getting at least one head.

Directly, "at least one head" covers exactly-1, exactly-2, and exactly-3 heads — tedious. Use the complement instead: "not at least one head" = "zero heads" = all three tosses are tails.

$$P(\text{all tails}) = \frac{1}{2} \times \frac{1}{2} \times \frac{1}{2} = \frac{1}{8}$$

$$P(\text{at least one head}) = 1 - \frac{1}{8} = \frac{7}{8}$$

**Check:** Out of 2³ = 8 equally likely outcomes (HHH, HHT, HTH, THH, HTT, THT, TTH, TTT), only TTT has zero heads — 1 out of 8 — so 7 out of 8 have at least one head. Matches.

### (c) Dependent vs. independent events

An urn has 4 aces mixed among the deck. Compare: what's the probability both cards drawn are aces (i) *without* replacement, and (ii) *with* replacement (card put back and deck reshuffled before the second draw)?

**(i) Without replacement (dependent):** same as Example (a) — the first draw changes what's left for the second.

$$P = \frac{4}{52} \times \frac{3}{51} = \frac{1}{221}$$

**(ii) With replacement (independent):** the deck resets before the second draw, so both draws see the same 4/52 odds, unaffected by each other.

$$P = \frac{4}{52} \times \frac{4}{52} = \frac{16}{2704} = \frac{1}{169}$$

**Check:** 1/169 > 1/221, which makes sense — without replacement, the first ace being removed makes the second ace slightly *harder* to draw (3 left out of 51, a lower ratio than 4 out of 52), so the dependent case has to be the smaller probability. Matches the direction expected.

---

## 4. Timed Practice Set

1. A single fair die is rolled once. Find the probability of getting a 4. (10 sec)
2. Two fair dice are rolled together. Find the probability that the sum is 7. (30 sec)
3. A card is drawn from a standard deck. Find the probability that it is a king or a heart. (40 sec)
4. Three fair coins are tossed. Find the probability of getting exactly 2 heads. (30 sec)
5. Two fair dice are rolled. Find the probability of getting at least one 6. (40 sec)
6. A fair coin is tossed and a fair die is rolled at the same time. Find the probability of getting a head and a 6. (20 sec)
7. An urn contains 5 red balls and 3 blue balls (8 total). Two balls are drawn one after another without replacement. Find the probability both are red. (40 sec)
8. Two fair dice are rolled. Find the probability that the sum is NOT 8. (40 sec)

### Answer Key

1. **1/6** — one favorable face (4) out of 6 equally likely faces.
2. **1/6** — sum=7 pairs: (1,6)(2,5)(3,4)(4,3)(5,2)(6,1) = 6 ways out of 36 total = 6/36 = 1/6.
3. **4/13** — addition rule: P(king)+P(heart)−P(king∩heart) = 4/52 + 13/52 − 1/52 = 16/52 = 4/13.
4. **3/8** — exactly-2-heads outcomes: HHT, HTH, THH = 3 out of 8 total = 3/8.
5. **11/36** — complement: P(no 6 on either die) = (5/6)×(5/6) = 25/36; P(at least one 6) = 1 − 25/36 = 11/36.
6. **1/12** — independent events: P(head) × P(6) = (1/2) × (1/6) = 1/12.
7. **5/14** — dependent events: (5/8) × (4/7) = 20/56 = 5/14.
8. **31/36** — sum=8 pairs: (2,6)(3,5)(4,4)(5,3)(6,2) = 5 ways; P(sum=8) = 5/36; complement = 1 − 5/36 = 31/36.
