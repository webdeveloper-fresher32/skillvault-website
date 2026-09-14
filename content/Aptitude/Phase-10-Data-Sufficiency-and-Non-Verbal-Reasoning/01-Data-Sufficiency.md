# Data Sufficiency — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

A **data sufficiency (DS)** question gives you a question (usually asking for a specific value, or a yes/no fact), followed by two numbered statements — **Statement I** and **Statement II**. You are **not** asked to solve the question. You are asked only to judge whether the information in each statement, alone or combined, is *enough* to arrive at one definite answer. If a statement lets you pin down a single, unambiguous answer, it is **sufficient**. If it leaves more than one possible answer on the table, it is **not sufficient** — no matter how "close" it gets you.

Almost every DS question in competitive exams uses the same five answer options:

| Option | Meaning |
|--------|---------|
| **(A)** | Statement I **alone** is sufficient, but Statement II alone is **not** sufficient |
| **(B)** | Statement II **alone** is sufficient, but Statement I alone is **not** sufficient |
| **(C)** | **Either** statement I alone or statement II alone is sufficient (each one, independently, pins down a definite answer) |
| **(D)** | Statement I and II **together** are **not** sufficient (the question cannot be answered even using both) |
| **(E)** | Statement I and II **together** are sufficient, but **neither** statement alone is sufficient |

The single most important discipline in DS, and the one nearly everyone violates the first few times, is this:

> **Evaluate Statement I in complete isolation — as if Statement II did not exist at all.** Then, separately, evaluate Statement II in complete isolation — as if Statement I did not exist at all, and forgetting anything you learned while looking at Statement I. Only *after* both solo evaluations are done should you consider combining them.

The failure mode is **information leakage**: you read Statement I, form a mental picture of the scenario, and then — without realizing it — carry a fact or an assumption from that picture into your reading of Statement II. This makes Statement II look more sufficient (or less sufficient) than it actually is on its own. For example, if Statement I tells you "the number is even" and Statement II says "the number is either 12 or 14," it is tempting to think Statement II is now sufficient because "well, we already know it's even, so combined with evenness..." — but Statement II **alone**, with no memory of Statement I, still leaves two possible values (12 or 14) and is **not** sufficient by itself. The leak silently smuggled in help that Statement II was never entitled to.

A related trap is stopping as soon as you find *one* value that fits a statement and declaring it sufficient. Sufficiency requires that **only one** answer is possible — you must actively look for a *second*, different value that also satisfies the statement before concluding it's unique.

---

## 2. Shortcut / Trick

Run a fixed four-pass procedure every time, in this exact order:

1. **Read the question only.** Identify precisely what needs to be found (a specific number, a yes/no fact, a comparison). Do not look at either statement yet.
2. **Pass 1 — Statement I alone.** Cover Statement II mentally (or physically, with your hand/finger if needed). Using only the question and Statement I, ask: "Can I narrow this down to exactly one answer?" Try to find a second valid value that contradicts your first answer — if you can, it's not sufficient. Record the verdict: sufficient or not.
3. **Pass 2 — Statement II alone.** Now do the same with Statement II only, actively suppressing anything you concluded in Pass 1. Record the verdict.
4. **Decide using the verdicts:**
   - Only I sufficient → **(A)**
   - Only II sufficient → **(B)**
   - Both I and II are independently sufficient (whether or not they happen to produce the same value) → **(C)**
   - Neither alone is sufficient → proceed to **Pass 3: combine both statements** and check if together they now pin down one answer. If yes → **(E)**. If even combined it's still ambiguous → **(D)**.

Two shortcuts inside this procedure:

- **Never combine early.** If you find yourself reaching for Statement II's number while still reasoning about Statement I, stop — that's the leak. Finish Pass 1 completely, write down its verdict, and only then start Pass 2 fresh.
- **"Each is independently sufficient" does not require the two statements to agree with each other.** Option (C) — "either" — only asks whether *each statement, taken alone*, forces a unique answer to the question. It is entirely possible (and is a deliberately set trap) for Statement I alone to force one value and Statement II alone to force a *different* value. That mismatch does not create a sixth "contradiction" option — you simply judge each statement's self-sufficiency on its own terms and mark (C).

---

## 3. Worked Examples

### (a) Statement I alone suffices

**Question:** What is the perimeter of a rectangle?

- **Statement I:** The length of the rectangle is 12 cm, and the length is 3 cm more than the breadth.
- **Statement II:** The area of the rectangle is 108 cm².

**Pass 1 — Statement I alone:** Length = 12. Length is 3 more than breadth, so breadth = 12 − 3 = 9. Both dimensions are now fixed numbers, so perimeter = 2(12 + 9) = 42 cm — exactly one answer. **Sufficient.**

**Pass 2 — Statement II alone** (forgetting Statement I entirely): Area = length × breadth = 108. This equation alone has infinitely many valid (length, breadth) pairs — (108, 1), (54, 2), (36, 3), (12, 9), and so on — each giving a different perimeter. No unique perimeter can be pinned down. **Not sufficient.**

**Answer: (A).** Statement I alone is sufficient; Statement II alone is not.

### (b) Neither alone suffices, but together they do

**Question:** What is Ravi's current age?

- **Statement I:** Ravi is 5 years younger than his brother Sanjay.
- **Statement II:** Sanjay's age, 5 years from now, will be 30 years.

**Pass 1 — Statement I alone:** This only fixes the *gap* between Ravi and Sanjay's ages (5 years) — it says nothing about either person's actual age. Ravi could be 15 (with Sanjay 20), or 40 (with Sanjay 45), or any other pair with a 5-year gap. **Not sufficient.**

**Pass 2 — Statement II alone** (forgetting Statement I): Sanjay's age in 5 years is 30, so Sanjay's current age is 25. But this statement says nothing about Ravi at all. **Not sufficient.**

**Pass 3 — Combine:** From Statement II, Sanjay's current age = 25. From Statement I, Ravi = Sanjay − 5 = 25 − 5 = 20. Together, both facts are pinned down and the combination gives exactly one value. **Sufficient together.**

**Answer: (E).** Neither statement alone is sufficient; together they are.

### (c) Each statement alone gives a different — but independently valid — answer (the "either" trap)

**Question:** How many students are there in the class?

- **Statement I:** When the students are arranged in rows of 8, exactly 4 remain in an incomplete last row, and there are exactly 6 completely full rows before it.
- **Statement II:** The number of students is a two-digit number between 60 and 70 whose digits add up to 8.

**Pass 1 — Statement I alone:** 6 full rows of 8 gives 6 × 8 = 48, plus the 4 left over = 52. This is one specific, uniquely determined number. Checking for a second possibility: the statement fixes both the row count (6, "exactly") and the remainder (4, "exactly"), so no other value satisfies it. **Sufficient — the answer under Statement I alone is 52.**

**Pass 2 — Statement II alone** (forgetting Statement I and the number 52 entirely): Two-digit numbers strictly between 60 and 70 are 61 through 69. Checking digit sums: 61→7, 62→8, 63→9, 64→10, 65→11, 66→12, 67→13, 68→14, 69→15. Only **62** has a digit sum of 8. This is a unique value. **Sufficient — the answer under Statement II alone is 62.**

**The trap:** 52 ≠ 62. A test-taker who notices this mismatch often panics and assumes something is wrong — that the statements "contradict" each other, so the question must be flawed or the answer must be (D). This is incorrect reasoning. **Sufficiency is judged per statement, not by cross-checking the two statements' answers against each other.** Statement I, entirely on its own, pins down one number. Statement II, entirely on its own, pins down one (different) number. Both are independently sufficient to answer the question "how many students are there?" — just using different information. There is no option for "the statements disagree"; you simply report that each one, alone, is enough.

**Answer: (C).** Either statement I alone or statement II alone is sufficient.

### (d) Even together, still not sufficient (the trickiest case)

**Question:** Is x greater than y?

- **Statement I:** x is greater than 5.
- **Statement II:** y is greater than 3.

**Pass 1 — Statement I alone:** x > 5 says nothing about y at all — x could be 6 and y could be anything. **Not sufficient.**

**Pass 2 — Statement II alone** (forgetting Statement I entirely): y > 3 says nothing about x at all. **Not sufficient.**

**Pass 3 — Combine:** Together, x > 5 and y > 3. It is tempting to assume that combining two statements must eventually settle the question — but check for a second, different pair before concluding anything. Take x = 6 and y = 100: both conditions hold (6 > 5, 100 > 3), and here x < y, so the answer to "is x > y?" would be **No**. Now take x = 100 and y = 4: both conditions hold again (100 > 5, 4 > 3), and here x > y, so the answer would be **Yes**. Two pairs, both fully consistent with *both* statements combined, give opposite answers to the question. No amount of combining removes this ambiguity. **Not sufficient even together.**

**Answer: (D).** Statement I and II together are not sufficient. This is the case learners most often mis-mark, because there's a strong instinct to believe that "using everything we're given" must produce an answer — it does not. Always hunt for a second combined case that flips the answer before settling on (E).

---

## 4. Timed Practice Set

1. Question: What is the two-digit number N? Statement I: The sum of the digits of N is 11, and the tens digit is one more than the units digit. Statement II: N is a multiple of 7. (60 sec)
2. Question: Is x greater than 50? Statement I: x is a multiple of 15. Statement II: x is a multiple of 20 and less than 100. (55 sec)
3. Question: What is the speed of a train (in km/h)? Statement I: The train covers a distance of 300 km in 5 hours. Statement II: The train's speed is 15 km/h more than the speed of a car that covers 180 km in 4 hours. (60 sec)
4. Question: What is the present age of Meena? Statement I: Five years ago, Meena's age was three times her daughter's age at that time. Statement II: Meena's daughter is currently 15 years old. (65 sec)
5. Question: How many pens did Anil buy? Statement I: Anil spent a total of ₹240 buying pens at ₹15 each, with no amount left over. Statement II: Anil bought a number of pens that is a two-digit multiple of 4, lying between 10 and 20. (60 sec)
6. Question: Was the total marks scored by Priya above 90 (out of 100)? Statement I: Priya scored 18 out of 20 in every one of 5 sections. Statement II: Priya's overall percentage was 90%. (60 sec)
7. Question: How many chocolates did Aditi buy? Statement I: Aditi spent a total of ₹150 buying chocolates, and the price per chocolate was a two-digit number of rupees. Statement II: Aditi spent ₹180 buying chocolates at ₹12 each, with no amount left over. (60 sec)
8. Question: Is the weight of Box A greater than the weight of Box B? Statement I: The weight of Box A is more than 10 kg. Statement II: The weight of Box B is more than 7 kg. (55 sec)

### Answer Key

1. **(A).** Statement I alone: tens digit = units digit + 1, and digits sum to 11 → units + (units + 1) = 11 → units = 5, tens = 6 → N = 65, a single unique value — sufficient alone. Statement II alone (forgetting Statement I): two-digit multiples of 7 are 14, 21, 28, ..., 98 — many values — not sufficient alone. Only Statement I is sufficient.
2. **(E).** Statement I alone: multiples of 15 (15, 30, 45, 60, 75, ...) include values both below and above 50 — not sufficient. Statement II alone (forgetting Statement I): multiples of 20 under 100 are 20, 40, 60, 80 — some below 50, some above — not sufficient. Combined: x must be a multiple of both 15 and 20 (i.e., a multiple of their LCM, 60) and less than 100 — only 60 qualifies, and 60 > 50, giving a definite "Yes." Sufficient only when combined.
3. **(C).** Statement I alone: speed = 300 km ÷ 5 h = 60 km/h, a single unique value — sufficient alone. Statement II alone (forgetting Statement I entirely): car speed = 180 km ÷ 4 h = 45 km/h, so train speed = 45 + 15 = 60 km/h, also a single unique value — sufficient alone. Both statements independently pin down a definite speed (and here they happen to agree, though that agreement isn't required for "either" to apply).
4. **(E).** Statement I alone: "three times her daughter's age" 5 years ago fixes only the *ratio* of their ages at that time, not the actual ages — not sufficient. Statement II alone (forgetting Statement I): daughter is currently 15 — says nothing about Meena — not sufficient. Combined: 5 years ago, daughter's age = 15 − 5 = 10, so Meena's age 5 years ago = 3 × 10 = 30, so Meena's current age = 30 + 5 = 35 — a unique value once combined. Sufficient together only.
5. **(A).** Statement I alone: 240 ÷ 15 = 16 pens exactly, a single unique value — sufficient alone. Statement II alone (forgetting Statement I): two-digit multiples of 4 between 10 and 20 are 12 and 16 — two candidates, not a unique value — not sufficient alone. Only Statement I is sufficient.
6. **(C).** Statement I alone: 18/20 in every one of 5 sections means total = 18 × 5 = 90 out of 20 × 5 = 100, so total marks = 90 — not above 90, a definite "No," which counts as sufficient (the question is answered, just answered negatively). Statement II alone (forgetting Statement I): "90% overall" on the stated total of 100 also gives exactly 90 marks — again a definite "No" — equally sufficient on its own. Both statements independently give a definite verdict.
7. **(B).** Statement I alone: two-digit (10–99) divisors of ₹150 are 10, 15, 25, 30, 50, and 75 — six different possible prices, each giving a different chocolate count (15, 10, 6, 5, 3, 2) — not a unique value, not sufficient. Statement II alone (forgetting Statement I entirely): 180 ÷ 12 = 15 chocolates exactly, a single unique value — sufficient alone. Only Statement II is sufficient.
8. **(D).** Statement I alone: Box A > 10 kg says nothing about Box B — not sufficient. Statement II alone (forgetting Statement I): Box B > 7 kg says nothing about Box A — not sufficient. Combined: check for two consistent cases with different answers. A = 11 kg, B = 50 kg satisfies both statements (11 > 10, 50 > 7) and gives A < B ("No"). A = 50 kg, B = 8 kg also satisfies both statements (50 > 10, 8 > 7) and gives A > B ("Yes"). Two cases consistent with both statements together give opposite answers — not sufficient even combined.
