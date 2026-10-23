# Syllogisms and Venn Diagrams — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

A **syllogism** question gives you two (occasionally more) statements about categories of things — "All A are B," "No A is B," and so on — and then asks which of several proposed conclusions **necessarily** follows from those statements alone. Nothing from outside the statements is allowed in: no real-world knowledge, no "that seems likely," no filling in gaps with common sense. A conclusion counts as **following** only if it is true in *every single diagram* you can draw that satisfies the statements. If even one valid diagram makes the conclusion false, it does **not** follow — even if it "feels" true.

Every classical statement is one of exactly four types:

| Type | Form | Meaning | Diagram (Venn) picture |
|------|------|---------|--------------------------|
| **A** — universal affirmative | "All A are B" | Every member of A is also in B | Circle A drawn entirely inside circle B |
| **E** — universal negative | "No A is B" | A and B share no members at all | Circle A and circle B drawn completely separate, not touching |
| **I** — particular affirmative | "Some A are B" | At least one member is in both A and B (at least one — could be all) | Circle A and circle B overlap by *some* amount — the exact amount is not fixed |
| **O** — particular negative | "Some A are not B" | At least one member of A is definitely outside B | Circle A has a part sticking outside circle B — that part is not fixed in size, only guaranteed to exist |

Two things trip people up constantly:

- **"Some" means "at least one," not "some but not all."** "Some A are B" is still true even in the extreme case where *all* A are B (as long as at least one A is a B). So "Some A are B" never *rules out* "All A are B" — it's compatible with it. This matters because "Some" statements are drawn as a *family* of possible diagrams, not one fixed picture — the overlap could be a small sliver, or it could swallow one whole circle.
- **A conclusion must survive every valid diagram, not just the "obvious" one.** When a statement type allows more than one diagram (which "Some" and "Some...not" statements always do), you must mentally check the conclusion against each alternative before declaring it "follows." This is where most wrong answers come from — people draw the single most natural-looking diagram, get a conclusion that looks right, and stop, without checking whether a different, equally valid diagram breaks it.

---

## 2. Shortcut / Trick

**Draw every combination of circles that is consistent with both statements — not just the first one that comes to mind — then check each proposed conclusion against all of them.** A conclusion is valid only if it holds in *every* diagram in that set.

A fast, reliable process:

1. **Identify the common (middle) term** — the category that appears in both statements, linking them together (e.g., if statement 1 talks about "pens and pencils" and statement 2 talks about "pencils and erasers," the middle term is "pencils").
2. **Draw the two statements as a chain around that middle term.** Universal statements (A, E) pin down the relationship tightly — often only **one** diagram is possible. Particular statements (I, O) leave room for **multiple** diagrams — draw at least two clearly different ones (e.g., a small overlap vs. a near-total overlap) before deciding anything.
3. **Test each conclusion against every diagram you drew.** If a conclusion is true in all of them → it follows. If it's false in even one valid diagram → it does not follow, no matter how "likely" it looks.
4. **Watch the middle term's role.** A conclusion connecting the two *outer* terms (the ones that are each in only one statement) can only be forced when the middle term is pinned down tightly enough by at least one universal (A/E) statement. Two "Some" statements sharing a middle term almost never force a definite conclusion — this is the single most common trap in syllogism sets (the classic **"undistributed middle" fallacy**: the middle term is never fully accounted for in either statement, so the overlap that makes each premise true doesn't have to be the *same* overlap).
5. **Apply the complementary-pair rule when neither offered conclusion alone follows.** Two conclusions form a genuine **complementary pair** when, taken together, they cover every possible state of the world between two terms with no gap and no overlap — meaning at least one of the two *must* be true, even though neither is individually guaranteed. The two standard pairs used in these questions:
   - **A-type vs. O-type** on the same subject-predicate order: "All X are Y" and "Some X are not Y" — for any X and Y, either every X is a Y, or at least one X isn't; there's no third option.
   - **I-type vs. E-type** on the same subject-predicate order: "Some X are Y" and "No X is Y" — either X and Y overlap somewhere, or they don't overlap at all; again, no third option.

   When two offered conclusions match one of these two pairs exactly (same two terms, same order), and neither follows on its own, the answer is **"Either conclusion I or conclusion II follows."** If the two conclusions don't form one of these exact pairs, don't apply the rule — mismatched pairs (e.g., an A-type and an E-type, or terms in reversed order) are not complementary and are just both false.

---

## 3. Worked Examples

### (a) Two-statement syllogism solved via Venn overlap

**Statements:**
1. All books are pens.
2. No pen is a pencil.

**Conclusions:**
- I. No book is a pencil.
- II. Some books are not pencils.

**Diagram:** Statement 1 is an A-type — draw circle "Books" completely inside circle "Pens." Statement 2 is an E-type — draw circle "Pencils" completely separate from (not touching) circle "Pens." Since Books sits entirely inside Pens, and Pens has zero overlap with Pencils, Books automatically has zero overlap with Pencils too. Both statements are universal, so this is the **only** diagram possible — there's no alternative way to draw it.

**Checking conclusion I:** "No book is a pencil" — true in the one and only diagram, since Books and Pencils don't touch at all. **Follows.**

**Checking conclusion II:** "Some books are not pencils" — since no book is a pencil at all, then *every* book is "not a pencil." Statement 1 ("All books are pens") presupposes that the category "books" actually has members in it (otherwise the statement would be a strange thing to assert). Given that books exist, and none of them are pencils, at least one book is "not a pencil" — so this conclusion is also true. **Follows.**

**Answer: Both conclusions follow.** This is the clean case where two universal statements pin down a single diagram, so the derived conclusions are airtight.

### (b) "Some" statement with multiple possible diagrams

**Statements:**
1. Some pens are pencils.
2. Some pencils are erasers.

**Conclusion:**
- Some pens are erasers.

**Diagram — try more than one.** The middle term is "pencils," and it appears in *both* statements only as part of a "Some" relationship — it is never fully pinned down (never universally quantified) in either sentence. That's the warning sign.

- **Diagram 1:** Draw circle Pencils. Let the Pens circle overlap the *left* half of Pencils. Let the Erasers circle overlap the *right* half of Pencils, not touching the Pens overlap at all. Both statements are satisfied ("some pens are pencils" — yes, the left overlap; "some pencils are erasers" — yes, the right overlap) — but Pens and Erasers never touch. Here, "Some pens are erasers" is **false**.
- **Diagram 2:** Now let the Pens overlap and the Erasers overlap both sit on the *same* left portion of Pencils, so Pens and Erasers do share some members. Here, "Some pens are erasers" is **true**.

Both diagrams are fully consistent with the two statements — nothing in the wording rules either one out. Since the conclusion is true in one valid diagram and false in another, it is **not guaranteed**.

**Answer: The conclusion does not follow.** This is the "undistributed middle" trap: two "Some" statements sharing a middle term almost never force a definite link between the outer terms, no matter how natural the chain "pens → pencils → erasers" feels.

### (c) Complementary pair rule (either/or conclusion)

**Statement:**
- Some doctors are fools.

**Conclusions:**
- I. All doctors are fools.
- II. Some doctors are not fools.

**Diagram — multiple possible.** "Some doctors are fools" only guarantees overlap between the Doctors and Fools circles; it doesn't say how much.

- **Diagram 1:** Draw the Doctors circle entirely inside the Fools circle (full overlap — every doctor happens to be a fool). This satisfies "Some doctors are fools" (trivially — "some" includes "all"). In this diagram, conclusion I is **true** and conclusion II is **false**.
- **Diagram 2:** Draw only a partial overlap — part of Doctors inside Fools, part sticking out. This also satisfies "Some doctors are fools." In this diagram, conclusion I is **false** and conclusion II is **true**.

Neither conclusion is true in *every* diagram, so neither follows by itself. But look at the pattern: conclusion I is an A-type statement ("All doctors are fools") and conclusion II is an O-type statement ("Some doctors are not fools"), both about doctors and fools in the same order. As the shortcut rule states, an A-type and an O-type conclusion on the same two terms are a **complementary pair** — for the category of doctors, either every single doctor is a fool, or at least one isn't. There's no third possibility. Since the original statement confirms doctors and fools do overlap at all (ruling out "no doctor is a fool"), exactly one of I or II must be true — we just don't know which.

**Answer: Either conclusion I or conclusion II follows.**

---

## 4. Timed Practice Set

1. Statements: All roses are flowers. All flowers are plants. Conclusions: I. All roses are plants. II. Some plants are roses. (50 sec)
2. Statements: Some actors are singers. Some singers are dancers. Conclusions: I. Some actors are dancers. II. No actor is a dancer. (55 sec)
3. Statements: No mobile is a laptop. All laptops are computers. Conclusions: I. No computer is a mobile. II. Some computers are not mobiles. (60 sec)
4. Statements: All pencils are pens. Some pens are inks. Conclusions: I. Some pencils are inks. II. Some inks are pencils. (55 sec)
5. Statements: Some books are novels. All novels are stories. Conclusions: I. Some books are stories. II. Some stories are books. (55 sec)
6. Statements: All windows are doors. Some doors are walls. Conclusions: I. Some windows are walls. II. All doors are windows. (55 sec)
7. Statements: All keys are locks. No lock is a chain. Conclusions: I. No key is a chain. II. All chains are locks. (50 sec)
8. Statements: All tigers are animals. Some animals are wild. Conclusions: I. Some tigers are wild. II. Some wild things are not tigers. (65 sec)

### Answer Key

1. **Both I and II follow.** Roses ⊆ Flowers ⊆ Plants forces Roses ⊆ Plants (only one diagram, since both statements are universal), giving I; since roses exist and are all plants, "some plants are roses" also holds, giving II.
2. **Either I or II follows.** Neither conclusion is individually guaranteed — the middle term "singers" is undistributed in both "Some" statements, so a diagram exists where the actor-overlap and dancer-overlap sit on different parts of "singers" (I false, II true) and another where they coincide (I true, II false). But I ("Some actors are dancers") and II ("No actor is a dancer") are an I-type/E-type complementary pair on the same terms — for any two categories, either they overlap somewhere or they don't overlap at all, with no third option — so exactly one of the two must be true.
3. **Only II follows.** No mobile is laptop + All laptops are computers forces every laptop (which exists, and is a computer) to be a non-mobile — giving "some computers are not mobiles" (II). "No computer is a mobile" (I) doesn't follow because non-laptop computers are free to overlap with mobiles in some valid diagrams.
4. **Neither follows.** The middle term "pens" is never fully pinned down (it's the undistributed predicate of the A-statement and the undistributed subject of the I-statement), so diagrams exist where the pencil-overlap-with-pens and the ink-overlap-with-pens sit on different parts of "pens," breaking both conclusions.
5. **Both I and II follow.** Some books are novels (overlap exists) + All novels are stories (novels ⊆ stories) forces that overlap to also lie inside stories, so "some books are stories" (I) is forced regardless of diagram; "some" statements always convert, so "some stories are books" (II) follows too.
6. **Neither follows.** Middle term "doors" is undistributed in both statements (predicate of the A-statement, subject of the I-statement), so the wall-overlap with doors can sit entirely outside the window-subset of doors in a valid diagram, breaking I; II is simply the unsupported converse of "All windows are doors" and is false in the diagram where doors include non-window members (which the statement allows).
7. **Only I follows.** All keys are locks (keys ⊆ locks) + No lock is chain (locks and chains disjoint) forces keys and chains disjoint in the only possible diagram, giving "no key is a chain" (I). "All chains are locks" (II) is an unsupported converse-type claim with no support from either statement.
8. **Neither follows.** Middle term "animals" is undistributed in both statements, so a valid diagram can have the wild-overlap of animals sit entirely outside tigers (breaking I), and a separate valid diagram can have the wild-overlap coincide exactly with the tiger-subset of animals, making every wild thing a tiger and breaking II — since a diagram exists that breaks each conclusion, neither is guaranteed.
