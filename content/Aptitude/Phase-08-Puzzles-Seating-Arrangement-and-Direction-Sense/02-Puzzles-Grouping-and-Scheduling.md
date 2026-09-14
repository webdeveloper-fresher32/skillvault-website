# Puzzles, Grouping, and Scheduling — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Beyond seating, the same clue-combining skill shows up in three closely related puzzle families:

- **Box/floor puzzles.** A set of items (people, boxes, flats) is stacked or ordered along a single line with a clear "top-to-bottom" or "bottom-to-top" direction — a building with numbered floors, or boxes stacked one above another. Clues about "above/below," "immediately above/below," and "exactly N floors between" behave exactly like the "left/right" clues from seating, just along a vertical line instead of a horizontal row.
- **Scheduling puzzles.** Events, meetings, or exams are assigned to distinct points on a known ordered scale — days of the week, months of the year. The scale itself is fixed and memorized (Monday before Tuesday, January before February), so clues like "immediately after," "on the last day," or "two days before" pin things down the same way position clues do in a row.
- **Grouping puzzles.** People are sorted into two or more categories along one or more independent attributes at once — which team someone plays for *and* which subject they study, for instance. The extra wrinkle here is that you're filling in more than one attribute per person, and a count constraint ("exactly two people study Math") is often what forces the last few assignments.

All three are really the same underlying task as seating arrangement: a set of clues, each eliminating or fixing part of an assignment, that only converges to one full solution when combined correctly.

---

## 2. Shortcut / Trick

**Build a table with people/items as rows and every possible slot (floor, day, team, subject) as columns — mark each cell ✓ (confirmed), ✗ (ruled out), or leave it blank (undecided) as you process each clue.** This is the single method that handles all three puzzle types:

1. **Absolute clues first.** Anything naming an exact slot directly — "lives on the topmost floor," "meeting is on the last day of the week," "studies Math" — gets an immediate ✓ in that cell, and an automatic ✗ for that same person in every other slot of that category (and for every other person in that same slot, if only one occupant is allowed).
2. **Relative/immediate clues next, chained off the absolute ones.** "Immediately above X," "immediately after Y," "same team as Z" — the moment one side of the clue is fixed, apply it to fix the other side.
3. **Counting clues to break remaining ties.** "Exactly two floors between," "exactly three people study Science" — use these against whatever slots are still undecided; they usually narrow two or three remaining possibilities down to one.
4. **Forced leftovers close the puzzle.** Once every clue has been applied, whatever single person/slot pairing is left unassigned in a row or column is automatically forced — always do one final sweep to confirm every row and every column has exactly one ✓, which also double-checks you haven't left the puzzle under-constrained.

For grouping puzzles specifically, keep **one table per attribute** (one for team membership, one for subject) since a person's team and subject are usually determined by separate clue chains that only interact through the counting constraints.

---

## 3. Worked Examples

### (a) Floor puzzle — five people, five floors

Five friends — P, Q, R, S, T — live on five different floors of a building, floor 1 at the bottom up to floor 5 at the top. Find who lives on which floor.

- Q lives on the topmost floor.
- Only one person lives between P and Q.
- R lives on the floor immediately below T.
- S does not live on the ground floor.

**Absolute clue:** Q = floor 5.

**Counting clue off Q:** "Only one person lives between P and Q" means exactly one floor separates P from floor 5 — that floor is floor 4, so P must be at floor 3 (floors 3 and 5 have exactly floor 4 between them). **P = floor 3.**

**Remaining floors** for R, S, T: floors 1, 2, 4. **Relative clue:** R lives immediately below T, so R and T must occupy two *consecutive* floors from what's left. Checking the remaining set {1, 2, 4}: only 1 and 2 are consecutive (4 is isolated, two floors away from 2). So **R = floor 1, T = floor 2** (R below T).

**Forced leftover:** the only floor and person left are floor 4 and S. **S = floor 4** — which also satisfies the clue that S isn't on the ground floor, confirming the answer.

```
Floor 5:  Q
Floor 4:  S
Floor 3:  P
Floor 2:  T
Floor 1:  R
```

### (b) Day-of-the-week scheduling puzzle

Five subjects — Math, Physics, Chemistry, English, History — are scheduled one per day from Monday to Friday. Find the full schedule.

- History is scheduled on the last day of the week.
- Physics is scheduled the day immediately before History.
- Chemistry is scheduled on the first day of the week.
- Math is scheduled the day immediately before English.

**Absolute clues:** History = Friday, Chemistry = Monday.

**Relative clue off History:** Physics is immediately before Friday → Physics = Thursday.

**Remaining days:** Tuesday and Wednesday, for Math and English. **Relative clue:** Math is immediately before English — the only consecutive pair available in {Tuesday, Wednesday} is exactly that order, so Math = Tuesday, English = Wednesday.

**Final schedule:** Monday–Chemistry, Tuesday–Math, Wednesday–English, Thursday–Physics, Friday–History.

### (c) Grouping puzzle with two attributes

Four friends — P, Q, R, S — are grouped into two teams, Team A and Team B (two people each), and each studies one of two subjects, Math or Science (two people each). Find each person's team and subject.

- P is on Team A.
- Q is on the same team as P.
- R is not on the same team as P.
- Exactly two people study Math, and P is one of them.
- Q studies Science.
- S does not study Math.

**Team table first.** P = Team A. Q is on the same team as P, so Q = Team A too — and since each team holds exactly two people, **Team A is now full: {P, Q}**. That leaves **Team B = {R, S}** automatically (confirmed, not contradicted, by the clue that R isn't on P's team).

**Subject table next.** Exactly two people study Math, and P is one — **P = Math**. Q studies Science directly — **Q = Science**. S does not study Math, and with only two subjects available, **S = Science**. That leaves exactly one Math slot unfilled out of the required two (P is the only Math person confirmed so far), and only R remains without a subject — so **R = Math**, completing the Math pair {P, R} and the Science pair {Q, S}.

**Final:** P — Team A, Math. Q — Team A, Science. R — Team B, Math. S — Team B, Science.

---

## 4. Timed Practice Set

1. Five friends — J, K, L, M, N — live on five floors of a building (1 = bottom, 5 = top). M lives on the topmost floor. J lives exactly in the middle floor. Exactly two floors lie between L and K. L lives below K. Find the full floor arrangement (the fifth person is N, in the one remaining floor). (55 sec)
2. Six departments — HR, IT, Sales, Finance, Marketing, Legal — each hold a meeting on a different day from Monday to Saturday. Sales' meeting is on the last day of the week. Marketing's meeting is the day immediately before Sales'. HR's meeting is on the third day of the week. IT's meeting is immediately after HR's. Legal's meeting is on the first day of the week. Finance's meeting is immediately after Legal's. Find the full schedule. (50 sec)
3. Four friends — W, X, Y, Z — live in two cities, Delhi and Pune (two each), and each has one hobby, Reading or Painting (two each). W lives in Delhi. X lives in the same city as W. W's hobby is Painting. Z's hobby is the same as W's. Find each person's city and hobby. (50 sec)
4. Six boxes are stacked one above another, positions 1 (bottom) to 6 (top), each a different color: Red, Blue, Green, Yellow, White, Black. The Yellow box is at the very top. The Blue box is immediately below the Yellow box. Exactly one box lies between the Red box and the Blue box. The White box is immediately above the Red box. The Green box is at the very bottom. Find the full stacking order (the remaining color is Black, in the one remaining position). (55 sec)
5. Five events — Launch, Review, Audit, Training, Meeting — are each scheduled in a different month from January to May. Review happens in the last of the five months. Meeting happens immediately before Review. Launch happens exactly in the middle month. Training happens immediately before Launch. Find the full schedule (the remaining event is Audit, in the one remaining month). (45 sec)
6. Six students — A, B, C, D, E, F — are split into two teams, Team 1 and Team 2 (three each), and each studies one of two subjects, Math or Science (three each). A and B are on the same team. C is on the same team as A. D is not on the same team as A. A studies Math. B studies Science. C studies Science. Exactly three people study Math, and D is one of them. E studies the same subject as D. Find each person's team and subject (F takes whichever team and subject are left). (65 sec)

### Answer Key

1. **Floor 5 M, Floor 4 K, Floor 3 J, Floor 2 N, Floor 1 L** — M=5 (top), J=3 (middle); among the remaining floors {1,2,4}, the only pair with exactly two floors between them is (1,4), and "L below K" fixes L=1, K=4; the one remaining floor (2) goes to N.
2. **Mon Legal, Tue Finance, Wed HR, Thu IT, Fri Marketing, Sat Sales** — Legal=Mon and Sales=Sat are absolute; Finance immediately after Legal gives Tue; HR on the third day gives Wed; IT immediately after HR gives Thu; Marketing immediately before Sales gives Fri.
3. **W: Delhi, Painting; X: Delhi, Reading; Y: Pune, Reading; Z: Pune, Painting** — W and X share Delhi (filling both Delhi slots), leaving Y and Z in Pune; W and Z share Painting (filling both Painting slots), leaving X and Y with Reading.
4. **1 Green, 2 Black, 3 Red, 4 White, 5 Blue, 6 Yellow** — Yellow=6 and Green=1 are absolute; Blue immediately below Yellow gives 5; exactly one box between Red and Blue(5) forces Red=3 (the only valid position within the stack); White immediately above Red gives 4; the one remaining position (2) goes to Black.
5. **Jan Audit, Feb Training, Mar Launch, Apr Meeting, May Review** — Review=May and Launch=Mar (middle of 5) are absolute; Meeting immediately before Review gives Apr; Training immediately before Launch gives Feb; the one remaining month (Jan) goes to Audit.
6. **Team 1: A (Math), B (Science), C (Science); Team 2: D (Math), E (Math), F (Science)** — A, B, C share Team 1 (filling all three slots), leaving D, E, F in Team 2; A=Math and D=Math give 2 of the required 3 Math slots, E shares D's subject giving the 3rd Math slot, leaving F as the only remaining person, which must be Science to keep the count at three each.
