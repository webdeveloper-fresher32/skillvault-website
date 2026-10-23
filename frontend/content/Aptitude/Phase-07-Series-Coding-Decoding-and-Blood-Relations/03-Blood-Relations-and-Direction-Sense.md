# Blood Relations and Direction Sense — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

**Blood relations** questions describe a chain of family connections in a sentence ("A is B's father, B is C's sister…") and ask how two people at opposite ends of the chain are related. The difficulty isn't the vocabulary — it's holding several links in your head at once without a diagram. Useful vocabulary shortcuts:

- Mother's/father's brother = **maternal/paternal uncle**; mother's/father's sister = **maternal/paternal aunt**.
- Uncle's or aunt's child = **cousin** (never "brother/sister," even if same age).
- Son's wife = **daughter-in-law**; daughter's husband = **son-in-law**.
- Spouse's sibling = **brother-in-law / sister-in-law**; sibling's spouse = also **brother-in-law / sister-in-law**.
- Brother's or sister's son = **nephew**; brother's or sister's daughter = **niece**.
- Father's father / mother's father = **grandfather** (paternal / maternal); their spouses = **grandmother**.
- Skip one more generation (grandfather's father, etc.) = **great-grandfather**, and their grandchild is a **great-grandson/great-granddaughter**.

**Direction sense** questions describe someone walking in a start direction, taking a series of left/right turns with given distances, and ask for the net (straight-line) distance and/or direction from the starting point. Because turns are always 90°, the total displacement usually decomposes into a simple rectangle or right triangle, so the final distance is found either by directly cancelling opposite movements or by Pythagoras' theorem on the two perpendicular net components.

---

## 2. Shortcut / Trick

**For blood relations, draw the family tree as you read — don't try to hold it in your head.** Use a simple top-down sketch: each generation on its own row, an `=` between spouses, a `|` down to their children, and mark gender with (M)/(F) as you go. Process the sentence one clause at a time, adding one link to the diagram per clause, before trying to answer the question. Almost all errors in this topic come from skipping the diagram and trying to chain 3+ relations mentally.

**Watch for the "only child/only son/only daughter" clue — it's there to pin down exactly one person, and the whole puzzle depends on it.** When a sentence says "my grandfather's only son," it's telling you there's exactly one person who fits, so you can substitute a concrete person (often the speaker's own parent) into the diagram instead of leaving it ambiguous.

**For direction sense, track net movement as two running totals: North-South and East-West — don't try to picture the whole path.** Assign North/East as positive, South/West as negative. Add up all North/South distances into one number and all East/West distances into another; whatever remains is the net displacement along each axis. If both axes end up non-zero, the straight-line distance from start is `√(North-South total)² + (East-West total)²` — a direct application of Pythagoras' theorem, since the two axes are perpendicular.

**Fix the starting facing direction and turn systematically: facing North, right → East, left → West; facing East, right → South, left → North; facing South, right → West, left → East; facing West, right → North, left → South.** Update "current facing direction" after every turn before applying the next move — most mistakes come from turning the wrong way partway through a multi-turn path.

---

## 3. Worked Examples

### (a) Multi-generation blood relation puzzle solved via diagram

A is the mother of B. B is the father of C. D is the son of C. E is the sister of D. How is E related to A?

Build the diagram generation by generation:

```
Gen 1:        A (F)
              |
Gen 2:        B (M)
              |
Gen 3:        C
              |
Gen 4:     D (M) — E (F)   (D and E are siblings, children of C)
```

Read the chain from E upward: E's parent is C, C's parent is B, B's parent is A. That's three generations up from E to A — a grandparent's parent relationship, i.e., **great-grandparent**.

Since A is female (given as "mother"), and E is female (given as "sister" of D), E is A's **great-granddaughter**.

### (b) "Who is the woman in the photograph" style question

Pointing to a woman in a photograph, a man said, "She is the daughter of my mother's only brother." How is the woman related to the man?

Break the clause down from the inside out:
- "my mother's only brother" = the man's **maternal uncle** (his mother has exactly one brother, so this pins down one specific person).
- "daughter of [maternal uncle]" = the maternal uncle's daughter.

An uncle's daughter is, by definition, a **cousin** — never a sister, since she comes from a different parent's sibling, not from the man's own parents.

The woman is the man's **cousin**.

### (c) Direction sense — net distance using Pythagoras

A man starts from point P and walks 6 km North. He then turns right and walks 8 km. How far is he from the starting point P, and in what direction (roughly)?

Track position with P at the origin (0, 0), North = +y, East = +x:
- Walk 6 km North: position becomes (0, 6).
- Facing North, a right turn means now facing **East**. Walk 8 km East: position becomes (8, 6).

Net displacement from P is 8 km East and 6 km North — two perpendicular components, so the straight-line distance is:

$$\sqrt{8^2 + 6^2} = \sqrt{64 + 36} = \sqrt{100} = 10 \text{ km}$$

He is **10 km** from P, in a direction roughly **North-East** (since his net position is east and north of the start — the classic 6-8-10 right triangle).

---

## 4. Timed Practice Set

1. Pointing to a man, a woman said, "His mother is the only daughter of my mother." How is the woman related to the man? (40 sec)
2. A is the brother of B. B is the sister of C. C is the father of D. How is A related to D? (40 sec)
3. Introducing a man, a woman said, "He is the son of my husband's sister." How is the man related to the woman? (30 sec)
4. P is Q's father. Q is R's brother. R is S's mother. How is P related to S? (40 sec)
5. A man walks 5 km East, then turns left and walks 5 km, then turns left again and walks 5 km. How far is he from his starting point, and in which direction? (45 sec)
6. A man walks 10 km North, then 10 km East, then 10 km South. How far is he from the starting point, and in which direction? (45 sec)
7. A man starts walking 3 km West, then turns right and walks 4 km. How far is he from the starting point? (40 sec)
8. A man walks 6 km South, then turns left and walks 8 km, then turns left again and walks 6 km. How far and in which direction is he from the starting point? (50 sec)

### Answer Key

1. **Mother** — "The only daughter of my mother" (with no sisters) can only be the woman herself, so "his mother" = the woman; she is the man's mother.
2. **Uncle** — A, B, and C are siblings (A brother of B, B sister of C); C is D's father, so A, C's brother, is D's uncle.
3. **Nephew** — Husband's sister = the woman's sister-in-law; the sister-in-law's son is the woman's nephew.
4. **(Maternal) Grandfather** — Q and R are siblings (Q brother of R), so P, Q's father, is also R's father; R is S's mother, so P is S's maternal grandfather.
5. **5 km, North** — East 5 (5,0) → turn left, North 5 (5,5) → turn left, West 5 (0,5); net position (0,5), i.e., 5 km North of start.
6. **10 km, East** — North 10 (0,10) → East 10 (10,10) → South 10 (10,0); net position (10,0), i.e., 10 km East of start.
7. **5 km** — West 3 (−3,0) → turn right (facing West, right turn → North), North 4 (−3,4); distance = √(3²+4²) = √25 = 5 km.
8. **8 km, East** — South 6 (0,−6) → turn left (facing South, left → East), East 8 (8,−6) → turn left (facing East, left → North), North 6 (8,0); net position (8,0), i.e., 8 km East of start.
