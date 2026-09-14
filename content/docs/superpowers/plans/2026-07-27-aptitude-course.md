# Aptitude Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete `Aptitude/` course in SkillVault — 12 phases (6 Quant, 4 Logical Reasoning, 2 Verbal), each with a phase README and numbered lessons; a `Projects/` folder of 5 timed mock tests; a `Quick-Reference/` folder (cheatsheet + 50 interview Q&A); and a course-level README — matching the structural conventions of Docker/Kubernetes/MongoDB/MySQL/HLD.

**Architecture:** This is a pure-content repo (no build system, no tests, per `CLAUDE.md`). There is no TDD loop here — "verification" means checking each file's structure (required headings present, TOC anchors resolve, links to sibling files are correct) rather than running a test suite. Each task produces one phase (or one top-level folder) fully populated and committed independently, so the course is buildable and reviewable phase-by-phase.

**Tech Stack:** GitHub-flavored Markdown only.

**Lesson format (applies to every lesson file in Phases 1–12):**
```markdown
# <Topic> — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept
(what the topic is, when it shows up in an exam, 1-2 short paragraphs + one plain-English example)

## 2. Shortcut / Trick
(the fast-solve method used under time pressure, not the textbook derivation; show the formula/rule clearly)

## 3. Worked Examples
(2-3 fully solved problems applying the shortcut, step by step)

## 4. Timed Practice Set
(6-10 practice questions, each tagged with a suggested time e.g. "(45 sec)", followed by an "### Answer Key" section with answers and one-line solutions)
```

Phase README format (matches `Docker/Phase-01-Fundamentals/README.md`):
```markdown
# Phase N: <Phase Title>

## What You'll Learn
(1-2 sentences)

## Learning Objectives
- ...

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Xxx.md](01-Xxx.md) | ... | ... |

## Estimated Time
(N days)

## Next Phase
→ [Phase N+1: <Title>](../Phase-NN-<Title>/README.md)
```
(Phase 12's "Next Phase" line instead reads `→ [Projects](../Projects/README.md)`.)

---

### Task 1: Phase 01 — Number Systems and Simplification

**Files:**
- Create: `Aptitude/Phase-01-Number-Systems-and-Simplification/README.md`
- Create: `Aptitude/Phase-01-Number-Systems-and-Simplification/01-Number-Systems-and-Divisibility.md`
- Create: `Aptitude/Phase-01-Number-Systems-and-Simplification/02-HCF-LCM.md`
- Create: `Aptitude/Phase-01-Number-Systems-and-Simplification/03-Simplification-and-BODMAS-Tricks.md`

- [ ] **Step 1: Write the 3 lesson files**
  - `01-Number-Systems-and-Divisibility.md`: divisibility rules for 2,3,4,5,6,7,8,9,10,11; classification of numbers (prime, composite, rational); place value; unit digit shortcuts (cyclicity of last digit for powers). Worked examples: (a) find unit digit of 7^95, (b) is 45,678 divisible by 11 (alternating sum rule), (c) count numbers divisible by 3 between 1 and 500. Practice set: 8 questions on divisibility/unit digit, tagged 30-45 sec each, with answer key.
  - `02-HCF-LCM.md`: HCF/LCM by prime factorization and division method; HCF×LCM = product of two numbers; LCM/HCF of fractions. Worked examples: (a) HCF(84,120), (b) LCM of 12,15,20, (c) two numbers with HCF 12 and LCM 336, one number is 84, find the other (= HCF×LCM/84 = 48). Practice set: 8 questions, answer key.
  - `03-Simplification-and-BODMAS-Tricks.md`: BODMAS order, fraction-to-decimal shortcuts for common fractions (1/8=0.125 etc table), simplifying nested fractions fast, approximation techniques for exam-time estimation. Worked examples: (a) simplify a BODMAS expression with brackets, (b) simplify a complex fraction, (c) approximate 48.98% of 601. Practice set: 8 questions, answer key.
  - Each lesson follows the Lesson Format template above exactly (TOC + 4 numbered sections).

- [ ] **Step 2: Write the phase README.md**
  Use the Phase README format above. Title: "Phase 1: Number Systems and Simplification". Learning Objectives: apply divisibility rules and unit-digit shortcuts; compute HCF/LCM by both methods and use the product relationship; simplify BODMAS and fraction expressions at exam speed. Topics table lists all 3 files with time estimates (1 day each). Estimated Time: 3 days. Next Phase links to `../Phase-02-Percentages-Profit-Loss-and-Averages/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' Aptitude/Phase-01-Number-Systems-and-Simplification/0*.md` — expect 4 per lesson file (Concept, Shortcut, Worked Examples, Timed Practice Set... actually TOC + 4 sections, so 4 `## ` headers per lesson).
  Run: `grep -L 'Answer Key' Aptitude/Phase-01-Number-Systems-and-Simplification/0*.md` — expect no output (every lesson has an answer key).

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-01-Number-Systems-and-Simplification
  git commit -m "Add Aptitude Phase 1: Number Systems and Simplification"
  ```

---

### Task 2: Phase 02 — Percentages, Profit & Loss, and Averages

**Files:**
- Create: `Aptitude/Phase-02-Percentages-Profit-Loss-and-Averages/README.md`
- Create: `Aptitude/Phase-02-Percentages-Profit-Loss-and-Averages/01-Percentages.md`
- Create: `Aptitude/Phase-02-Percentages-Profit-Loss-and-Averages/02-Profit-and-Loss.md`
- Create: `Aptitude/Phase-02-Percentages-Profit-Loss-and-Averages/03-Averages-and-Alligation.md`

- [ ] **Step 1: Write the 3 lesson files**
  - `01-Percentages.md`: percentage-to-fraction conversion table (1/2..1/20), percentage change formulas, successive percentage change shortcut (a + b + ab/100). Worked examples: (a) price increases 20% then decreases 20%, net change, (b) successive discount 10% and 15% on ₹2000, (c) if A's income is 25% more than B's, B's income is what % less than A's (reverse percentage trick). Practice set: 8 questions, answer key.
  - `02-Profit-and-Loss.md`: CP/SP/profit%/loss% formulas, marked price and discount relationship, false weight trick (profit% = error/(true value - error) × 100). Worked examples: (a) find SP given CP and profit%, (b) two successive discounts equivalent single discount, (c) dishonest dealer using 900g weight for 1kg, find profit%. Practice set: 8 questions, answer key.
  - `03-Averages-and-Alligation.md`: simple average, weighted average, average speed formula (2xy/(x+y)) for equal distances, alligation rule for mixtures. Worked examples: (a) average of first n natural numbers shortcut, (b) mixing two solutions of different concentrations using alligation, (c) average speed for a round trip at different speeds. Practice set: 8 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 2: Percentages, Profit & Loss, and Averages". Objectives: convert between percentages/fractions instantly; solve profit-loss and discount chains; apply alligation for mixture and average-speed problems. Topics table with 3 files, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-03-Ratio-Proportion-and-Partnership/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-02-Percentages-Profit-Loss-and-Averages/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-02-Percentages-Profit-Loss-and-Averages
  git commit -m "Add Aptitude Phase 2: Percentages, Profit and Loss, and Averages"
  ```

---

### Task 3: Phase 03 — Ratio, Proportion, and Partnership

**Files:**
- Create: `Aptitude/Phase-03-Ratio-Proportion-and-Partnership/README.md`
- Create: `Aptitude/Phase-03-Ratio-Proportion-and-Partnership/01-Ratio-and-Proportion.md`
- Create: `Aptitude/Phase-03-Ratio-Proportion-and-Partnership/02-Partnership-and-Sharing.md`

- [ ] **Step 1: Write the 2 lesson files**
  - `01-Ratio-and-Proportion.md`: simplifying ratios, compounded ratio, direct/inverse proportion, dividing a quantity in a given ratio shortcut (total × part/sum-of-parts). Worked examples: (a) divide ₹4500 in ratio 2:3:4, (b) if a:b = 3:4 and b:c = 5:6, find a:b:c (compounding), (c) inverse proportion — men/days problem. Practice set: 8 questions, answer key.
  - `02-Partnership-and-Sharing.md`: simple partnership (profit split by capital ratio), compound partnership (capital × time), working-partner adjustments. Worked examples: (a) two partners invest different capital for the whole year, split profit, (b) capital×time weighted split when one partner joins later, (c) partner also gets a fixed management fee before profit split. Practice set: 6 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 3: Ratio, Proportion, and Partnership". Objectives: manipulate and compound ratios fast; distinguish direct vs inverse proportion; solve partnership profit-sharing including capital×time weighting. Topics table, 1 day each (2 days total). Estimated Time: 2 days. Next Phase → `../Phase-04-Time-Speed-Distance-and-Time-Work/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-03-Ratio-Proportion-and-Partnership/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-03-Ratio-Proportion-and-Partnership
  git commit -m "Add Aptitude Phase 3: Ratio, Proportion, and Partnership"
  ```

---

### Task 4: Phase 04 — Time-Speed-Distance and Time-Work

**Files:**
- Create: `Aptitude/Phase-04-Time-Speed-Distance-and-Time-Work/README.md`
- Create: `Aptitude/Phase-04-Time-Speed-Distance-and-Time-Work/01-Time-Speed-and-Distance.md`
- Create: `Aptitude/Phase-04-Time-Speed-Distance-and-Time-Work/02-Trains-and-Boats-Streams.md`
- Create: `Aptitude/Phase-04-Time-Speed-Distance-and-Time-Work/03-Time-and-Work.md`

- [ ] **Step 1: Write the 3 lesson files**
  - `01-Time-Speed-and-Distance.md`: speed=distance/time, km/h↔m/s conversion (×5/18, ×18/5), average speed vs average of speeds. Worked examples: (a) convert 72 km/h to m/s, (b) two objects moving toward/away, relative speed, (c) a car covers a distance in given time, speed increased by x, new time. Practice set: 8 questions, answer key.
  - `02-Trains-and-Boats-Streams.md`: train crossing pole/platform/another train (relative speed + combined length), boats upstream/downstream speed (b+s, b-s) and the reverse formulas (b=(u+d)/2, s=(d-u)/2). Worked examples: (a) train crossing a platform, (b) two trains crossing each other moving opposite directions, (c) boat's speed in still water given up/downstream times. Practice set: 8 questions, answer key.
  - `03-Time-and-Work.md`: work = rate × time, 1/n work-per-day trick, combined work rates, work-and-wages proportional split, pipes and cisterns (inlet positive rate, outlet negative rate). Worked examples: (a) A and B together vs alone, (b) pipe fills and another empties simultaneously, (c) work and wages split by individual efficiency. Practice set: 8 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 4: Time-Speed-Distance and Time-Work". Objectives: convert units and apply relative speed instantly; solve train/boat-stream problems; convert work problems into rate-per-day and combine them. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-05-Simple-Compound-Interest-and-Mixtures/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-04-Time-Speed-Distance-and-Time-Work/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-04-Time-Speed-Distance-and-Time-Work
  git commit -m "Add Aptitude Phase 4: Time-Speed-Distance and Time-Work"
  ```

---

### Task 5: Phase 05 — Simple/Compound Interest and Mixtures

**Files:**
- Create: `Aptitude/Phase-05-Simple-Compound-Interest-and-Mixtures/README.md`
- Create: `Aptitude/Phase-05-Simple-Compound-Interest-and-Mixtures/01-Simple-and-Compound-Interest.md`
- Create: `Aptitude/Phase-05-Simple-Compound-Interest-and-Mixtures/02-Mixtures-and-Mensuration-Basics.md`

- [ ] **Step 1: Write the 2 lesson files**
  - `01-Simple-and-Compound-Interest.md`: SI=PRT/100, CI=P(1+r/100)^t − P, CI-SI difference for 2 years shortcut (P(r/100)^2), effective annual rate for half-yearly/quarterly compounding. Worked examples: (a) find CI on a sum for 2 years, (b) difference between CI and SI given, find the sum, (c) compound interest compounded half-yearly. Practice set: 8 questions, answer key.
  - `02-Mixtures-and-Mensuration-Basics.md`: replacement/dilution formula (final = initial×(1 − removed/total)^n), area/perimeter of rectangle/square/circle/triangle, volume of cube/cuboid/cylinder — the subset actually tested in aptitude rounds (not full geometry, that's Phase 6). Worked examples: (a) milk-water replacement done n times, (b) area of a path around a rectangular field, (c) volume of a cylinder given radius and height. Practice set: 8 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 5: Simple/Compound Interest and Mixtures". Objectives: compute SI/CI and use the CI-SI shortcut; apply the mixture-replacement formula; compute basic area/perimeter/volume under time pressure. Topics table, 1 day each (2 days). Estimated Time: 2 days. Next Phase → `../Phase-06-Geometry-Mensuration-and-Permutations-Combinations/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-05-Simple-Compound-Interest-and-Mixtures/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-05-Simple-Compound-Interest-and-Mixtures
  git commit -m "Add Aptitude Phase 5: Simple/Compound Interest and Mixtures"
  ```

---

### Task 6: Phase 06 — Geometry, Mensuration, and Permutations-Combinations

**Files:**
- Create: `Aptitude/Phase-06-Geometry-Mensuration-and-Permutations-Combinations/README.md`
- Create: `Aptitude/Phase-06-Geometry-Mensuration-and-Permutations-Combinations/01-Geometry-and-Mensuration.md`
- Create: `Aptitude/Phase-06-Geometry-Mensuration-and-Permutations-Combinations/02-Permutations-and-Combinations.md`
- Create: `Aptitude/Phase-06-Geometry-Mensuration-and-Permutations-Combinations/03-Probability.md`

- [ ] **Step 1: Write the 3 lesson files**
  - `01-Geometry-and-Mensuration.md`: triangle properties (Pythagoras, area = ½bh, Heron's formula), circle (area, circumference, sector area), cone/sphere volume and surface area. Worked examples: (a) area of a triangle via Heron's formula, (b) sector area given angle, (c) volume of a cone. Practice set: 8 questions, answer key.
  - `02-Permutations-and-Combinations.md`: nPr vs nCr and when to use each, factorial shortcuts, circular permutations ((n-1)!), permutations with repetition. Worked examples: (a) arrange letters of a word with repeated letters, (b) choose a committee (nCr), (c) circular arrangement of n people. Practice set: 8 questions, answer key.
  - `03-Probability.md`: basic probability = favorable/total, addition and multiplication rules, probability with cards/dice/coins, complementary probability shortcut (1 − P(not A)). Worked examples: (a) probability of drawing 2 aces from a deck, (b) at least one head in 3 coin tosses (complement trick), (c) dependent vs independent events. Practice set: 8 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 6: Geometry, Mensuration, and Permutations & Combinations". Objectives: apply core geometry/mensuration formulas fast; distinguish permutation vs combination problems; apply the complement trick in probability. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-07-Series-Coding-Decoding-and-Blood-Relations/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-06-Geometry-Mensuration-and-Permutations-Combinations/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-06-Geometry-Mensuration-and-Permutations-Combinations
  git commit -m "Add Aptitude Phase 6: Geometry, Mensuration, and Permutations-Combinations"
  ```

---

### Task 7: Phase 07 — Series, Coding-Decoding, and Blood Relations

**Files:**
- Create: `Aptitude/Phase-07-Series-Coding-Decoding-and-Blood-Relations/README.md`
- Create: `Aptitude/Phase-07-Series-Coding-Decoding-and-Blood-Relations/01-Number-and-Letter-Series.md`
- Create: `Aptitude/Phase-07-Series-Coding-Decoding-and-Blood-Relations/02-Coding-Decoding.md`
- Create: `Aptitude/Phase-07-Series-Coding-Decoding-and-Blood-Relations/03-Blood-Relations-and-Direction-Sense.md`

- [ ] **Step 1: Write the 3 lesson files**
  - `01-Number-and-Letter-Series.md`: identifying pattern type (arithmetic, geometric, alternating, squares/cubes, difference-of-differences), letter series via alphabet position numbers. Worked examples: (a) find next term in a series with alternating +/× pattern, (b) letter series using position shifts, (c) find the odd one out in a number set. Practice set: 8 questions, answer key.
  - `02-Coding-Decoding.md`: letter-shift coding, number coding, substitution coding, decode-then-recode approach. Worked examples: (a) if CAT is coded as DBU (shift+1), decode a given word, (b) number-to-letter substitution code, (c) coded sentence — decode a specific word from two coded sentence pairs. Practice set: 8 questions, answer key.
  - `03-Blood-Relations-and-Direction-Sense.md`: family tree notation and shortcuts (mother's brother = maternal uncle etc.), drawing a quick relation diagram, direction sense (start facing a direction, series of turns, net displacement using Pythagoras). Worked examples: (a) multi-generation blood relation puzzle solved via diagram, (b) "who is the woman in the photograph" style question, (c) direction sense problem computing net distance from start point. Practice set: 8 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 7: Series, Coding-Decoding, and Blood Relations". Objectives: spot number/letter series patterns quickly; decode letter/number substitution codes; solve blood-relation and direction-sense puzzles by diagramming. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-08-Puzzles-Seating-Arrangement-and-Direction-Sense/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-07-Series-Coding-Decoding-and-Blood-Relations/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-07-Series-Coding-Decoding-and-Blood-Relations
  git commit -m "Add Aptitude Phase 7: Series, Coding-Decoding, and Blood Relations"
  ```

---

### Task 8: Phase 08 — Puzzles, Seating Arrangement, and Direction Sense

**Files:**
- Create: `Aptitude/Phase-08-Puzzles-Seating-Arrangement-and-Direction-Sense/README.md`
- Create: `Aptitude/Phase-08-Puzzles-Seating-Arrangement-and-Direction-Sense/01-Linear-and-Circular-Seating-Arrangement.md`
- Create: `Aptitude/Phase-08-Puzzles-Seating-Arrangement-and-Direction-Sense/02-Puzzles-Grouping-and-Scheduling.md`

Note: despite the phase title including "Direction Sense", that lesson lives in Phase 7 (Task 7) to avoid duplication — this phase's title is inherited as-is from the spec but its two lessons are seating/puzzle-focused.

- [ ] **Step 1: Write the 2 lesson files**
  - `01-Linear-and-Circular-Seating-Arrangement.md`: setting up a slot diagram, linear arrangement (facing same/opposite directions), circular/rectangular table arrangement, handling "immediately left/right" vs "somewhere left/right" clues. Worked examples: (a) 6 people in a row solved via elimination grid, (b) circular table facing center vs facing outward, (c) arrangement with one clue reversed (facing away). Practice set: 8 questions, answer key.
  - `02-Puzzles-Grouping-and-Scheduling.md`: box/floor puzzles, scheduling puzzles (days of week/months), grouping puzzles (who belongs to which team), the elimination-table method for multi-clue puzzles. Worked examples: (a) floor puzzle with 5 people on 5 floors, (b) day-of-week scheduling puzzle, (c) grouping puzzle with two attributes (subject + team). Practice set: 6 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 8: Puzzles, Seating Arrangement, and Direction Sense". Objectives: build and fill an elimination grid for seating puzzles; distinguish linear vs circular arrangement rules; solve scheduling/grouping puzzles with the same elimination method. Topics table, 1 day + 2 days respectively. Estimated Time: 3 days. Next Phase → `../Phase-09-Syllogisms-and-Logical-Deduction/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-08-Puzzles-Seating-Arrangement-and-Direction-Sense/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-08-Puzzles-Seating-Arrangement-and-Direction-Sense
  git commit -m "Add Aptitude Phase 8: Puzzles, Seating Arrangement, and Direction Sense"
  ```

---

### Task 9: Phase 09 — Syllogisms and Logical Deduction

**Files:**
- Create: `Aptitude/Phase-09-Syllogisms-and-Logical-Deduction/README.md`
- Create: `Aptitude/Phase-09-Syllogisms-and-Logical-Deduction/01-Syllogisms-and-Venn-Diagrams.md`
- Create: `Aptitude/Phase-09-Syllogisms-and-Logical-Deduction/02-Statement-Conclusion-and-Assumptions.md`

- [ ] **Step 1: Write the 2 lesson files**
  - `01-Syllogisms-and-Venn-Diagrams.md`: the 4 statement types (All A are B, No A is B, Some A are B, Some A are not B), Venn diagram method for combining two statements, possibility cases. Worked examples: (a) two-statement syllogism solved via Venn overlap, (b) "some" statement with multiple possible diagrams, (c) complementary pair rule (either/or conclusion). Practice set: 8 questions, answer key.
  - `02-Statement-Conclusion-and-Assumptions.md`: distinguishing a valid conclusion from an assumption, implicit vs explicit assumptions, strong/weak argument evaluation. Worked examples: (a) statement + 2 conclusions, determine which follows, (b) statement + assumption, determine if implicit, (c) course-of-action question. Practice set: 6 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 9: Syllogisms and Logical Deduction". Objectives: solve syllogisms with Venn diagrams instead of memorized rules; separate conclusions from assumptions; evaluate course-of-action and strong/weak argument questions. Topics table, 1 day + 1 day. Estimated Time: 2 days. Next Phase → `../Phase-10-Data-Sufficiency-and-Non-Verbal-Reasoning/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-09-Syllogisms-and-Logical-Deduction/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-09-Syllogisms-and-Logical-Deduction
  git commit -m "Add Aptitude Phase 9: Syllogisms and Logical Deduction"
  ```

---

### Task 10: Phase 10 — Data Sufficiency and Non-Verbal Reasoning

**Files:**
- Create: `Aptitude/Phase-10-Data-Sufficiency-and-Non-Verbal-Reasoning/README.md`
- Create: `Aptitude/Phase-10-Data-Sufficiency-and-Non-Verbal-Reasoning/01-Data-Sufficiency.md`
- Create: `Aptitude/Phase-10-Data-Sufficiency-and-Non-Verbal-Reasoning/02-Non-Verbal-Reasoning.md`

- [ ] **Step 1: Write the 2 lesson files**
  - `01-Data-Sufficiency.md`: the standard 5-option answer format (statement I alone / II alone / either / both together / neither), the discipline of checking each statement independently before combining. Worked examples: (a) a quant question where statement I alone suffices, (b) neither statement alone suffices but together they do, (c) a question where each statement alone gives a different but valid answer (trap: correct answer is "either"). Practice set: 6 questions, answer key.
  - `02-Non-Verbal-Reasoning.md`: series of figures (rotation, mirror, shape addition/counting), figure classification (odd one out), embedded figures — described in text/ASCII-diagram form since this course is text-only. Worked examples: (a) describe a rotating-shape series and identify the next figure, (b) mirror-image reasoning, (c) counting shapes/lines in a figure description. Practice set: 6 questions, answer key. Note at the top of the file: figures are described in words/ASCII since this is a text-based course; recommend supplementing with a visual question bank for full practice.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 10: Data Sufficiency and Non-Verbal Reasoning". Objectives: apply the 5-option data-sufficiency discipline without shortcuts that skip statement independence; reason about figure series/mirror/counting problems. Topics table, 1 day each. Estimated Time: 2 days. Next Phase → `../Phase-11-Grammar-and-Sentence-Correction/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-10-Data-Sufficiency-and-Non-Verbal-Reasoning/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-10-Data-Sufficiency-and-Non-Verbal-Reasoning
  git commit -m "Add Aptitude Phase 10: Data Sufficiency and Non-Verbal Reasoning"
  ```

---

### Task 11: Phase 11 — Grammar and Sentence Correction

**Files:**
- Create: `Aptitude/Phase-11-Grammar-and-Sentence-Correction/README.md`
- Create: `Aptitude/Phase-11-Grammar-and-Sentence-Correction/01-Common-Grammar-Rules.md`
- Create: `Aptitude/Phase-11-Grammar-and-Sentence-Correction/02-Sentence-Correction-and-Error-Spotting.md`

- [ ] **Step 1: Write the 2 lesson files**
  - `01-Common-Grammar-Rules.md`: subject-verb agreement, tense consistency, articles (a/an/the), prepositions commonly tested, parallelism. Worked examples: (a) subject-verb agreement with collective nouns, (b) correct preposition usage in a sentence, (c) parallelism error in a list. Practice set: 8 questions, answer key.
  - `02-Sentence-Correction-and-Error-Spotting.md`: the underline-and-scan method for error-spotting questions, common trap categories (redundancy, misplaced modifiers, faulty comparison), sentence-correction elimination strategy. Worked examples: (a) spot the error in an underlined sentence, (b) faulty comparison correction, (c) redundancy elimination. Practice set: 8 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 11: Grammar and Sentence Correction". Objectives: apply core grammar rules under time pressure; use the scan method for error-spotting; eliminate wrong options systematically in sentence correction. Topics table, 1 day each. Estimated Time: 2 days. Next Phase → `../Phase-12-Reading-Comprehension-and-Vocabulary/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-11-Grammar-and-Sentence-Correction/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-11-Grammar-and-Sentence-Correction
  git commit -m "Add Aptitude Phase 11: Grammar and Sentence Correction"
  ```

---

### Task 12: Phase 12 — Reading Comprehension and Vocabulary

**Files:**
- Create: `Aptitude/Phase-12-Reading-Comprehension-and-Vocabulary/README.md`
- Create: `Aptitude/Phase-12-Reading-Comprehension-and-Vocabulary/01-Reading-Comprehension-Strategy.md`
- Create: `Aptitude/Phase-12-Reading-Comprehension-and-Vocabulary/02-Vocabulary-Synonyms-Antonyms-and-Idioms.md`

- [ ] **Step 1: Write the 2 lesson files**
  - `01-Reading-Comprehension-Strategy.md`: skim-first vs read-first strategy, question-type classification (main idea, inference, detail, tone), time budgeting per passage. Worked examples: (a) a short passage (150-200 words) with a main-idea question solved via the skim strategy, (b) an inference question showing why literal reading fails, (c) a tone/attitude question. Practice set: one full passage + 5 questions, answer key.
  - `02-Vocabulary-Synonyms-Antonyms-and-Idioms.md`: root-word technique for guessing unfamiliar words, common confusable word pairs, frequently-tested idioms/phrases with meaning. Worked examples: (a) synonym question solved via root-word elimination, (b) antonym trap (choosing a near-synonym by mistake), (c) idiom meaning-in-context question. Practice set: 8 questions, answer key.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 12: Reading Comprehension and Vocabulary". Objectives: apply a time-boxed RC strategy instead of full careful reading; classify RC question types; use root-word technique for vocabulary under time pressure. Topics table, 1 day each. Estimated Time: 2 days. Next Phase → `../Projects/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -L 'Answer Key' Aptitude/Phase-12-Reading-Comprehension-and-Vocabulary/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Phase-12-Reading-Comprehension-and-Vocabulary
  git commit -m "Add Aptitude Phase 12: Reading Comprehension and Vocabulary"
  ```

---

### Task 13: Projects/ — Full-Length Mock Tests

**Files:**
- Create: `Aptitude/Projects/README.md`
- Create: `Aptitude/Projects/01-Mock-Test-1.md`
- Create: `Aptitude/Projects/02-Mock-Test-2.md`
- Create: `Aptitude/Projects/03-Mock-Test-3.md`
- Create: `Aptitude/Projects/04-Mock-Test-4.md`
- Create: `Aptitude/Projects/05-Mock-Test-5.md`

- [ ] **Step 1: Write `README.md`**
  Explain: each mock test has 30 questions in the same proportion as the phase weighting (15 Quant, 10 Logical Reasoning, 5 Verbal), a suggested total time limit of 30 minutes (1 min/question average, mirrors real exam pacing), and an answer key at the end of the file. Recommend attempting Mock Test 1 after Phase 6, Test 2 after Phase 8, Test 3 after Phase 10, Tests 4-5 after Phase 12 as a full-syllabus check. List all 5 tests in a table (File | Covers | Time).

- [ ] **Step 2: Write `01-Mock-Test-1.md` through `05-Mock-Test-5.md`**
  Each file: a header stating "30 Questions · 30 Minutes", then `## Section A: Quantitative Aptitude (Q1-15)`, `## Section B: Logical Reasoning (Q16-25)`, `## Section C: Verbal Ability (Q26-30)`, each question numbered and drawing on the topics from the phases already written (e.g. Mock Test 1 draws only from Phases 1-6 topics since it's meant to be attempted after Phase 6; Mock Tests 4-5 may draw from any phase). End each file with `## Answer Key` listing the answer and a one-line solution note for every question.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## Section' Aptitude/Projects/0*-Mock-Test-*.md` — expect 3 per file.
  Run: `grep -L 'Answer Key' Aptitude/Projects/0*-Mock-Test-*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Projects
  git commit -m "Add Aptitude Projects: 5 full-length mock tests"
  ```

---

### Task 14: Quick-Reference/ — Cheatsheet and Interview Q&A

**Files:**
- Create: `Aptitude/Quick-Reference/Formula-Cheatsheet.md`
- Create: `Aptitude/Quick-Reference/Interview-QA.md`

- [ ] **Step 1: Write `Formula-Cheatsheet.md`**
  Follow the dense, topic-organized table style of `Git/Git-Cheatsheet.md` (not chapter-by-chapter). Sections: Number Systems & HCF-LCM, Percentages & Profit-Loss, Averages & Alligation, Ratio & Partnership, Time-Speed-Distance & Time-Work, Interest, Geometry & Mensuration, Permutations-Combinations & Probability, Series & Coding-Decoding shortcuts, Data Sufficiency answer-option meanings. Each section is a `| Formula/Rule | When to use |` table pulling directly from the "Shortcut/Trick" sections already written in Phases 1-6 and 7 (coding-decoding).

- [ ] **Step 2: Write `Interview-QA.md`**
  50 commonly-missed or trick aptitude questions with explanations, following the 50-question convention used in other courses (e.g. `Java/Quick-Reference/`). Organize into 3 groups: Q1-25 Quant, Q26-40 Logical Reasoning, Q41-50 Verbal. Each entry: question, correct answer, and a 1-3 sentence explanation of the trap/why the shortcut applies.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^Q' Aptitude/Quick-Reference/Interview-QA.md` — expect 50 (or equivalent numbered-question count matching the file's actual numbering scheme).

- [ ] **Step 4: Commit**
  ```bash
  git add Aptitude/Quick-Reference
  git commit -m "Add Aptitude Quick-Reference: formula cheatsheet and interview Q&A"
  ```

---

### Task 15: Course-level README.md

**Files:**
- Create: `Aptitude/README.md`

- [ ] **Step 1: Write the course README**
  Sections: `## Overview` (what this course covers: the first-round aptitude exam used in campus/off-campus tech hiring, general-purpose across service-based and product-style rounds); `## Course Structure` (the same tree from the spec, Phase-01 through Phase-12 + Projects + Quick-Reference); `## Learning Path` table with columns `Phase | Topic | Difficulty | Time`, one row per phase (Phases 1-6 difficulty Easy-Medium, 7-10 Medium, 11-12 Easy-Medium) plus a final row for the mock tests; `## Total Estimated Time` (sum of all phase estimates: 3+3+2+3+2+3+3+3+2+2+2+2 = 30 days, plus mock test days); link to `Phase-01-Number-Systems-and-Simplification/README.md` to start.

- [ ] **Step 2: Verify all internal links resolve**
  Run: `grep -oE '\]\([^)]+\.md[^)]*\)' Aptitude/README.md` and manually confirm each referenced path exists via `ls`.

- [ ] **Step 3: Commit**
  ```bash
  git add Aptitude/README.md
  git commit -m "Add Aptitude course README"
  ```

---

## Self-Review Notes

- **Spec coverage:** All spec sections covered — 6 Quant phases (Tasks 1-6), 4 Logical Reasoning phases (Tasks 7-10), 2 Verbal phases (Tasks 11-12), Projects/ mock tests (Task 13), Quick-Reference/ (Task 14), course README (Task 15). DI and coding-aptitude explicitly excluded per spec — no task introduces them.
- **Naming consistency:** Phase directory names match the spec exactly. Lesson topics were split across 2-4 files per phase per the spec's "2-4 numbered lesson files" bound.
- **Cross-references:** Each phase's "Next Phase" link was checked against the next task's directory name; Phase 12 correctly points to `Projects/README.md` instead of a Phase 13 that doesn't exist.
