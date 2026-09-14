# Linear and Circular Seating Arrangement — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

**Seating arrangement** questions describe a set of people occupying seats — in a straight row, around a circular/rectangular table, or in a rectangular grid — and give you a scattered list of clues about who sits where relative to whom. The challenge isn't any single clue; it's combining several partial clues until only one arrangement survives. There are two seat layouts, and each has its own left/right rules:

- **Linear (row) arrangement.** People sit side by side. If everyone faces the *same* direction (say, all facing North), then "immediate right" and "immediate left" line up exactly with the row order you'd read left-to-right on paper. If some people face the *opposite* direction (say, one person faces South while the rest face North), their own left/right is **mirrored** relative to the row order — you must always use *that person's own* right/left hand, not the reader's.
- **Circular / rectangular table arrangement.** People sit around a table, usually all **facing the centre** or all **facing outward** (away from the centre). Facing the centre reverses left/right relative to a simple clockwise reading of the seats: the seat clockwise from a person (as you'd view the table from above) is that person's **left**, and the seat anticlockwise is their **right**. Facing outward flips this back: clockwise is **right**, anticlockwise is **left**. (Quick sanity check: stand at 12 o'clock on a clock face, facing the centre — i.e., facing toward 6 o'clock. Your right hand points toward 9 o'clock, which is the *anticlockwise* neighbor of 12. That confirms the rule.)

A second distinction that trips people up regardless of layout: **"immediately left/right"** pins down an exact adjacent seat, while **"somewhere to the left/right"** only tells you a person is *somewhere* in that general direction, with other people possibly in between. Never treat a "somewhere" clue as if it were an "immediately" clue — it eliminates possibilities but rarely fixes an exact seat by itself.

---

## 2. Shortcut / Trick

**Build an elimination grid (or slot diagram) before you touch a single clue — then fill it in over several passes, not in one pass.** Draw the seats as a row of boxes (linear) or a circle of dots (circular), and read every clue once just to note which type it is:

1. **First pass — absolute/anchor clues.** Fill in anything that pins a person to an exact seat with no ambiguity: "sits at the left end," "sits on the topmost/rightmost seat," "sits exactly in the middle." These are your fixed points.
2. **Second pass — immediate-neighbor clues.** Chain these off your anchors: "X sits immediately to the right of Y" locks two seats together the moment either X or Y's seat is known. Keep applying this pass repeatedly — one resolved pair often unlocks the next.
3. **Third pass — counting and "somewhere" clues.** Use these to narrow down what's left: "exactly two people sit to the left of Z" fixes Z's seat by counting inward from an end; "P sits somewhere to the left of Q, but not at the end" eliminates specific seats without fixing one outright — apply it against whatever seats remain empty.
4. **Last seat is always free.** Once every clue is used, whatever single seat/person remains unassigned is forced — that's often how the final piece falls into place, and it's a good uniqueness check: if two seats are still open after using every clue, you're either missing a clue or misreading one.

**For circular/rectangular tables, always fix the facing direction first and write out the right/left rule as a reminder before you place a single person.** Two one-line reminders to keep at hand:
- *Facing centre:* clockwise seat = **left**, anticlockwise seat = **right**.
- *Facing outward:* clockwise seat = **right**, anticlockwise seat = **left**.

If a puzzle mixes people who face the centre with people who face outward (or a row where one person faces the opposite way from everyone else), mark each person's facing direction on the diagram *before* interpreting any clue that mentions "their" left or right — a clue like "X sits to Y's immediate right" always means **Y's own right hand**, never the reader's right.

---

## 3. Worked Examples

### (a) Six people in a row, solved via elimination grid

Six friends — O, R, P, Q, N, M — sit in a row of six seats, all facing North. From the clues below, find the full left-to-right seating order.

- Clue 1: O sits at one of the two ends.
- Clue 2: Exactly two people sit to the left of R.
- Clue 3: P sits immediately to the right of R.
- Clue 4: Q sits at the other end (not O's end).
- Clue 5: N sits immediately to the left of Q.
- Clue 6: M sits immediately to the right of O.

Draw six empty seats and work pass by pass:

```
Seat:   1    2    3    4    5    6
       [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
```

**Pass 1 (counting clue):** Clue 2 says exactly two people sit to the left of R — that means R has exactly two seats to its left, so R must be the 3rd seat from the left. **R = seat 3.**

**Pass 2 (immediate-neighbor clue off R):** Clue 3 places P immediately to the right of R. **P = seat 4.**

**Pass 3 (the "other end" branch):** Clue 1 says O is at seat 1 or seat 6 — try both and see which one survives clue 5. Clue 5 needs Q to have a seat immediately to its left, so Q cannot be seat 1 (no seat to the left of seat 1). Clue 4 says Q is at the *other* end from O, so if O = seat 6, Q would have to be seat 1 — impossible by the previous sentence. That forces **O = seat 1** and **Q = seat 6**.

**Pass 4:** Clue 6 places M immediately to the right of O(1). **M = seat 2.** Clue 5 places N immediately to the left of Q(6). **N = seat 5.**

**Pass 5 (forced leftover):** All six people are now assigned except nothing remains unassigned — every seat and every person matches exactly once:

```
Seat:    1    2    3    4    5    6
        O    M    R    P    N    Q
```

**Final order (left to right): O, M, R, P, N, Q.** Notice how the "either end" ambiguity in clue 1 wasn't resolved until clue 5 ruled out one branch — that's the elimination method at work.

### (b) Circular table — facing the centre vs. facing outward

Six friends — A, B, C, D, E, F — sit around a circular table, **all facing the centre**. Use these clues to find the clockwise seating order:

- B is to the immediate right of A.
- C is to the immediate right of B.
- D is to the immediate right of C.
- E is to the immediate right of D.
- F is to the immediate left of A.

Since everyone faces the centre, remember the rule: **right = anticlockwise seat, left = clockwise seat.** Place A anywhere and work the chain:

- B is A's right → B sits **anticlockwise** of A.
- C is B's right → C sits anticlockwise of B, continuing the same rotation.
- Following this chain (D anticlockwise of C, E anticlockwise of D) keeps rotating the same way, so the anticlockwise order starting at A is A → B → C → D → E.
- F is A's left → F sits **clockwise** of A — which, going around the same circle, lands exactly where the chain would place F next after E anyway (the two clues agree, confirming the arrangement closes cleanly).

Reading the seats **clockwise** (the opposite of the anticlockwise chain above) gives: **A, F, E, D, C, B** (then back to A).

**Now contrast facing outward.** Suppose instead all six had been told to face *outward*, with the identical clues ("B is to the immediate right of A," and so on). The rule flips: **right = clockwise seat.** Re-running the exact same chain now rotates the *other* way, and the clockwise order comes out as the direct chain itself: **A, B, C, D, E, F** (then back to A) — the mirror image of the facing-centre answer. This is the key lesson: the same wording produces a mirrored seating plan depending purely on which way people face.

### (c) One person facing the opposite way

Five people — P, Q, D, R, S — sit in a row of five seats. All of them face North **except D, who faces South.**

- D sits at the exact middle seat.
- Q sits at the left end of the row.
- S sits at the right end of the row.
- From D's own perspective, P sits to D's immediate right.

**Fixed seats first:** Q = seat 1 (left end), S = seat 5 (right end), D = seat 3 (middle). That leaves seats 2 and 4 open for P and R.

**The reversed clue:** D faces South, so D's own right hand points **West** — which, in a row drawn left-to-right on paper, is the **lower-numbered (paper-left) side**, not the paper-right side. A solver who forgets D's facing and assumes "right" means paper-right would wrongly place P at seat 4. The correct reading: D's right = seat 2. So **P = seat 2**, and the only seat left, seat 4, goes to **R**.

```
Seat:     1     2     3     4     5
         Q     P     D     R     S
       (N)   (N)   (S)   (N)   (N)
```

**Final order: Q, P, D, R, S** (left to right). The takeaway: "immediate right/left of a person" always means *that person's own* hand, based on *their* facing direction — when everyone faces the same way this matches the page, but the instant one person is reversed, you must adjust for that person specifically.

---

## 4. Timed Practice Set

1. Six people — M, N, O, P, Q, R — sit in a row, all facing North. O sits at the left end. Only one person sits between O and R. P sits immediately to the right of R. Q sits at the right end. N sits immediately to the left of Q. Find the full left-to-right order. (50 sec)
2. Five friends — L, M, N, J, K — sit in a row, all facing South. L sits at the left end. J sits at the right end. From J's own perspective, K sits immediately to J's right. From L's own perspective, M sits immediately to L's left. Find the full left-to-right order. (55 sec)
3. Five friends — V, W, X, Y, Z — sit around a round table, all facing the centre. W is to the immediate right of V. X is to the immediate right of W. Y is to the immediate left of V. Who sits immediately to the right of Z? (55 sec)
4. Four friends — A, B, C, D — sit around a round table, all facing outward (away from the centre). B is to the immediate right of A. C is to the immediate right of B. Who sits immediately to the left of A? (40 sec)
5. Six people sit in a row, all facing North. Exactly three people sit to the right of C. D sits somewhere to the left of C but not at the left end. A sits immediately to the right of C. B sits at the left end. F sits immediately to the left of the right end. Find the full left-to-right order (the sixth person is E). (55 sec)
6. Four friends — A, B, C, D — sit at a rectangular table, one on each side, all facing the centre. B sits to the immediate right of A. C sits directly opposite A. Who sits immediately to the left of C? (45 sec)
7. Four people — E, F, G, H — sit in a row of four seats. E and G face North; F and H face South. F sits at the left end. From F's own perspective, G sits immediately to F's left. From G's own perspective, H sits immediately to G's right. Find the full left-to-right order, and state who sits at the right end. (60 sec)
8. Four friends — P, Q, R, S — sit around a round table. P and R face the centre; Q and S face outward. From P's own perspective, Q sits to P's immediate right. From Q's own perspective, R sits to Q's immediate left. Who sits immediately to the right of R (from R's own perspective)? (65 sec)

### Answer Key

1. **O, M, R, P, N, Q** — R is 3rd from the left (one person between O and R means R is 2 seats from O); P immediately right of R (seat 4); Q at the right end (seat 6), N immediately left of Q (seat 5); M is the only person left for the only open seat (seat 2).
2. **L, M, N, K, J** — L=1, J=5 fixed by the ends; J faces South so J's right = paper-left, giving K = seat 4; L faces South so L's left = paper-right, giving M = seat 2; the only remaining seat (3) goes to N.
3. **Y** — facing the centre, "right of X" = anticlockwise seat of X. Placing V, the chain gives clockwise order V, Y, Z, X, W; the seat immediately to the right (anticlockwise) of Z is Y.
4. **D** — facing outward, "right of X" = clockwise seat of X. Chain gives clockwise order A, B, C, D; A's left (anticlockwise) is D.
5. **B, D, C, A, F, E** — exactly 3 to the right of C means C is seat 3 (of 6); A immediately right of C gives seat 4; B at the left end gives seat 1; D somewhere left of C but not the end forces D into seat 2; F immediately left of the right end gives seat 5; the only remaining seat (6) goes to E.
6. **B** — facing the centre on a 4-seat table, "right of A" = anticlockwise seat, so B is anticlockwise of A; C opposite A is 2 seats away either direction, landing D in the last remaining seat; reading around, C's left (clockwise) seat is B.
7. **F, G, H, E; E is at the right end** — F(South) at seat 1; F's own left (paper-right, since South reverses it) places G at seat 2; G(North) own right (normal, paper-right) places H at seat 3; the only seat left (4) goes to E.
8. **S** — P(centre) at some seat; P's right (anticlockwise) places Q; Q(outward) own left (anticlockwise) places R; the last open seat goes to S; R faces the centre, so R's right (anticlockwise seat of R) is S.
