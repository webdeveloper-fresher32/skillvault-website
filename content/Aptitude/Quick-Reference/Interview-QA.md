# Aptitude Interview Q&A

50 commonly-missed trick questions covering the full Aptitude course, organized by section. Each entry gives the correct answer and explains *why* the trap exists — not just the formula, but the specific reasoning mistake that produces the wrong "obvious" answer.

---

## Quantitative Aptitude (Q1–Q25)

### Q1. What is the unit digit of 3^100?

**Answer:** **1.** The unit digit of powers of 3 cycles every 4 steps: 3, 9, 7, 1, 3, 9, 7, 1, … To find the unit digit of 3^100, divide the exponent 100 by the cycle length 4, giving a remainder of 0. The trap is assuming a remainder of 0 means "position 0" and defaulting to the *first* entry in the cycle (3) — a remainder of 0 always means the exponent lands exactly on the *last* entry of the cycle, which here is 1.

---

### Q2. Is 1,234,321 divisible by 11 — without doing long division?

**Answer:** **Yes.** The divisibility-by-11 rule: take the alternating sum of digits from the right. From the right, the digits are 1, 2, 3, 4, 3, 2, 1. Sum of odd positions (1st, 3rd, 5th, 7th) = 1+3+3+1 = 8. Sum of even positions (2nd, 4th, 6th) = 2+4+2 = 8. The difference is 0, which qualifies as "divisible by 11." The trap is assuming a rule like this only works for small or "obvious" numbers, and reaching for long division instead — the digit-sum shortcut confirms it instantly (1,234,321 ÷ 11 = 112,211 exactly).

---

### Q3. The HCF of two numbers is 12 and their LCM is 600. If one number is 300, what is the other?

**Answer:** **24.** HCF × LCM = product of the two numbers (this identity holds only for exactly two numbers, never for three or more). So the other number = (12 × 600) ÷ 300 = 7200 ÷ 300 = 24. The trap is trying to extend this identity to sets of three or more numbers, where it silently breaks down — for three numbers, HCF × LCM ≠ the product of all three in general.

---

### Q4. Simplify: 8 ÷ 2 × (3 + 1).

**Answer:** **16.** Brackets first: 3 + 1 = 4. Division and multiplication share equal priority and are then done strictly left to right: 8 ÷ 2 = 4, then 4 × 4 = 16. The trap is assuming multiplication should happen before division simply because it "looks like" it groups with the bracket, giving 8 ÷ (2 × 4) = 8 ÷ 8 = 1 — but BODMAS never lets multiplication jump ahead of a division that appears earlier in the same left-to-right pass.

---

### Q5. Simplify the nested fraction: 1 ÷ (1 + 1 ÷ (1 + 1/2)).

**Answer:** **3/5.** Work from the innermost fraction outward: 1 + 1/2 = 3/2. Next layer: 1 + 1 ÷ (3/2) = 1 + 2/3 = 5/3. Outer layer: 1 ÷ (5/3) = 3/5. The trap is trying to cross-multiply the entire stacked expression in one move instead of collapsing it one layer at a time, which almost always produces the wrong denominator.

---

### Q6. A quantity is increased by 20% and then decreased by 20%. What is the net percentage change?

**Answer:** **A net decrease of 4%, not zero.** Successive percentage change: Net% = a + b + ab/100 = 20 + (−20) + (20 × −20)/100 = 0 − 4 = −4%. The trap is assuming a +20% followed by a −20% cancels out to no change — it doesn't, because the second percentage is applied to a *larger* base (the already-increased value) than the first one started from, so the absolute decrease outweighs the absolute increase.

---

### Q7. A's salary is 25% more than B's. By what percentage is B's salary less than A's?

**Answer:** **20%, not 25%.** Use B is less than A by x/(100+x) × 100, with x = 25: 25/125 × 100 = 20%. The trap is assuming the relationship is symmetric — "25% more" going one way should be "25% less" coming back — but it isn't, because "25% more" is a percentage of B (the smaller number), while "less than A" must be a percentage of A (the larger number), a different base entirely.

---

### Q8. A shopkeeper buys an item for ₹800 and sells it for ₹960. What is the profit percentage?

**Answer:** **20%.** Profit% is always Profit ÷ CP × 100 = 160 ÷ 800 × 100 = 20%. The trap is dividing by the selling price instead — 160 ÷ 960 × 100 = 16.67% — which looks like a plausible answer but uses the wrong base entirely. Profit and loss percentages are always measured against the cost price, never the selling price.

---

### Q9. A shop applies two successive discounts of 10% and then 20% on a ₹1,000 item. What is the final price, and is this the same as one flat 30% discount?

**Answer:** **₹720 — not the same as a flat 30% discount (which would give ₹700).** Successive discounts combine the same way successive percentage changes do: Net% = −10 + −20 + (−10 × −20)/100 = −30 + 2 = −28%. So the effective discount is only 28%, giving a final price of ₹1,000 × 0.72 = ₹720. The trap is assuming successive discounts simply add up — two "negative" percentage changes partially offset each other in the combination formula, so the true discount is always slightly *less* than the sum of the two individual discounts (28% here, not 30%), meaning the customer actually pays more than naive addition would suggest.

---

### Q10. A dishonest dealer claims to sell at cost price but uses a 900g weight for every 1kg he charges for. What is his profit percentage?

**Answer:** **11.11%, not 10%.** False-weight profit% = Error ÷ (True value − Error) × 100 = 100 ÷ (1000 − 100) × 100 = 100/900 × 100 = 11.11%. The trap is assuming the profit% equals the shortfall percentage (100g out of 1000g = 10%) — but the dealer's actual *cost* for what he delivers is based on the smaller (900g) quantity, not the full 1000g, so the correct base for the percentage is the reduced true value, not the original.

---

### Q11. A man travels from town A to town B at 40 km/h and returns the same distance at 60 km/h. What is his average speed for the entire trip?

**Answer:** **48 km/h, not 50 km/h.** For two equal-distance legs, average speed is the harmonic mean: 2 × 40 × 60 / (40 + 60) = 4800/100 = 48 km/h. The trap is taking the simple arithmetic mean (40+60)/2 = 50 km/h — that's only valid when equal *time* is spent at each speed, not equal *distance*. Since he travels slower on the way there, he spends more time at 40 km/h than at 60 km/h, pulling the true average below the midpoint.

---

### Q12. Class A has 30 students with an average score of 70. Class B has 20 students with an average score of 80. What is the combined average score?

**Answer:** **74, not 75.** Weighted average = (30×70 + 20×80) / (30+20) = (2100+1600)/50 = 3700/50 = 74. The trap is taking the simple average of the two class averages, (70+80)/2 = 75, which silently assumes both classes have the same number of students — since Class A (with the lower average) is larger, it pulls the true combined average below the naive midpoint.

---

### Q13. In what ratio should a shopkeeper mix rice worth ₹20/kg and rice worth ₹30/kg to get a mixture worth ₹27/kg?

**Answer:** **3 : 7 (cheaper : dearer).** The alligation cross-rule: Cheaper : Dearer = (Dearer − Mean) : (Mean − Cheaper) = (30−27) : (27−20) = 3 : 7. The trap is subtracting on the "same side" instead of crossing — pairing the cheaper price with its *own* difference (27−20=7) and the dearer price with its own difference (30−27=3) gives the inverted ratio 7:3. The correct rule always cross-subtracts: the cheaper item's share is proportional to the *dearer* side's gap to the mean, and vice versa.

---

### Q14. A invests ₹5,000 for the full 12 months. B invests ₹6,000 but joins the business only for the last 6 months. In what ratio should they split the profit?

**Answer:** **5 : 3.** Compound partnership uses capital × time, not capital alone: A = 5000×12 = 60,000; B = 6000×6 = 36,000. Ratio = 60,000 : 36,000 = 5 : 3. The trap is using the raw capital ratio (5000:6000 = 5:6) and ignoring that B's money was only at work for half the year — a late joiner's capital must always be scaled down by the fraction of time it was actually invested.

---

### Q15. A and B start a business with capitals ₹40,000 and ₹60,000. A also manages the business and takes 10% of the total profit as a fixed salary first, and the remaining profit is split by the capital ratio. If the total profit is ₹22,000, what is A's total share?

**Answer:** **₹10,120.** Salary to A = 10% of 22,000 = ₹2,200. Remaining profit = ₹19,800, split in the capital ratio 40,000:60,000 = 2:3, so A's cut of that = 2/5 × 19,800 = ₹7,920. A's total = 2,200 + 7,920 = ₹10,120. The trap is splitting the *entire* ₹22,000 by the capital ratio (2/5 × 22,000 = ₹8,800) and forgetting the working-partner's salary entirely — the fixed fee must be deducted first, and only the remainder is shared by capital ratio, with the salary added back afterward.

---

### Q16. Two trains, 150m and 100m long, run in opposite directions at 54 km/h and 36 km/h. How long do they take to completely cross each other?

**Answer:** **10 seconds.** Convert speeds to m/s: 54 × 5/18 = 15 m/s, 36 × 5/18 = 10 m/s. Opposite directions → relative speed = sum = 25 m/s. Distance to cover = sum of both lengths = 250m. Time = 250/25 = 10s. The trap is using only one train's length (forgetting that "crossing" means the *back* of one train clears the *front* of the other, so both lengths must be added) or using the *difference* of speeds instead of the sum, which is the rule for trains moving in the same direction, not opposite ones.

---

### Q17. A can finish a job in 12 days, B in 18 days. They work together for 4 days, and then A leaves. How many more days will B alone need to finish the remaining work?

**Answer:** **8 more days.** Combined rate = 1/12 + 1/18 = 3/36 + 2/36 = 5/36 per day. In 4 days they complete 4 × 5/36 = 20/36 = 5/9 of the job. Remaining work = 4/9. At B's solo rate of 1/18 per day, time needed = (4/9) ÷ (1/18) = (4/9) × 18 = 8 days. The trap is forgetting to first compute the *fraction of work remaining* after the joint phase, and instead dividing B's total solo time (18 days) by some rough guess of "days left" — the remaining-work fraction must always be computed explicitly before switching to a single worker's rate.

---

### Q18. A pipe can fill a tank in 6 hours; another pipe can empty the same full tank in 8 hours. If both pipes are opened together, how long will it take to fill the tank?

**Answer:** **24 hours.** Net rate = inlet rate − outlet rate = 1/6 − 1/8 = 4/24 − 3/24 = 1/24 per hour, so the tank fills in 24 hours. The trap is adding the two times (6+8=14) or forgetting the outlet's rate must be *subtracted*, not added, since it works against the inlet — if the outlet rate had been faster than the inlet's, the net rate would go negative and the tank would drain instead of fill, which is always a good sanity check.

---

### Q19. What is the difference between compound interest (CI) and simple interest (SI) on ₹8,000 at 10% p.a. for 3 years?

**Answer:** **₹248.** SI = 8000×10×3/100 = ₹2,400. CI = 8000×(1.1)³ − 8000 = 8000×1.331 − 8000 = 10,648 − 8,000 = ₹2,648. Difference = 2,648 − 2,400 = ₹248. The trap is reaching for the fast shortcut CI−SI = P(R/100)² = 8000×0.01 = ₹80 — but that direct formula is valid **only for exactly 2 years**; applying it to a 3-year (or longer) period gives a badly wrong answer, and the full CI and SI must be computed and subtracted separately instead.

---

### Q20. A vessel contains 40 litres of milk. 8 litres are removed and replaced with water; this same process (remove 8 litres of the mixture, replace with water) is repeated once more. How much pure milk remains?

**Answer:** **25.6 litres.** The repeated-dilution formula: Final = Initial × (1 − removed/total)ⁿ = 40 × (1 − 8/40)² = 40 × (0.8)² = 40 × 0.64 = 25.6 litres. The trap is treating this as simple subtraction — "8 litres removed twice = 16 litres of milk gone, so 24 litres remain" — but after the first removal-and-replace, the vessel's contents are no longer pure milk; the *second* removal takes out a mix of milk and water, so plain subtraction always overstates how much milk is actually lost. It's a multiplicative (power) process, never a subtractive one.

---

### Q21. In how many ways can 6 people be seated around a circular table?

**Answer:** **120, not 720.** Circular permutations of n distinct objects = (n−1)! = 5! = 120. The trap is applying the straight-line formula n! = 720 — but around a circular table, an arrangement rotated to a new set of physical seats (everyone shifted one place clockwise) is considered the *same* arrangement, since only relative order to one's neighbors matters, not which absolute chair anyone occupies. Fixing one person's position removes the rotational duplicates, leaving (n−1)! distinct arrangements.

---

### Q22. A coin is tossed 3 times. What is the probability of getting at least one head?

**Answer:** **7/8.** Use the complement: P(at least one head) = 1 − P(no heads at all) = 1 − (1/2)³ = 1 − 1/8 = 7/8. The trap is trying to add up the probabilities of "exactly one head," "exactly two heads," and "exactly three heads" separately (error-prone and slow), or worse, naively adding 1/2 three times to get 3/2 — an impossible probability greater than 1. "At least one" almost always means: find P(none) and subtract from 1.

---

### Q23. Two fair dice are thrown together. What is the probability that the sum of the two faces is 7?

**Answer:** **1/6.** There are 36 equally likely ordered outcomes (die 1, die 2). The pairs summing to 7 are (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) — 6 favorable outcomes. P = 6/36 = 1/6. The trap is assuming all sums from 2 to 12 are equally likely, so P(sum=7) = 1/11 — but sums are not uniformly distributed; a sum of 7 has 6 ways to occur while a sum of 2 or 12 has only 1 way each. Every dice-sum question requires counting actual (die1, die2) pairs, never assuming a flat distribution over possible sums.

---

### Q24. In how many ways can a committee of 3 people be selected from a group of 6 people?

**Answer:** **20, using ⁶C₃ = 20.** Since a committee has no internal ordering — being picked 1st, 2nd, or 3rd doesn't create a different committee — this is a combination, not a permutation: ⁶C₃ = 6!/(3!×3!) = 20. The trap is reaching for ⁶P₃ = 6×5×4 = 120 instead, which counts every different *order* of the same 3 people as a separate outcome — the wrong tool whenever the question is about *selecting* a group rather than *arranging* people into distinct roles.

---

### Q25. A cone and a cylinder have the same base radius and the same height. If the cylinder's volume is 300 cm³, what is the cone's volume?

**Answer:** **100 cm³.** For the same radius and height, a cone's volume is always exactly ⅓ of the corresponding cylinder's volume: 300 ÷ 3 = 100 cm³. The trap is assuming the two solids are somehow equal in volume (since they share the same "footprint"), or forgetting the ⅓ factor entirely and guessing a value close to 300 — the cone's tapering shape genuinely holds only a third of what the full cylinder holds, and this ratio is worth memorizing cold as a sanity check on any cone-volume calculation.

---

## Logical Reasoning (Q26–Q40)

### Q26. Find the next term: 3, 7, 13, 21, 31, ?

**Answer:** **43.** The first differences are 4, 6, 8, 10 — not constant, but themselves increasing by 2 each time (a second-order/quadratic series). The next difference is 12, so 31 + 12 = 43. The trap is stopping after checking for a *constant* difference, concluding "no simple pattern," and guessing — the fix taught throughout the series lessons is to always write a difference row first, and if that row isn't constant, check whether *it* has a constant difference before giving up.

---

### Q27. Find the next letter in the series: C, F, J, O, ?

**Answer:** **U.** Convert to alphabet positions: C=3, F=6, J=10, O=15. The difference row is 3, 4, 5 — increasing by 1 each step, so the next difference is 6, giving position 15+6=21, which is U. The trap is assuming a constant shift of +3 (as the first jump suggests) and guessing R (position 18) — but the gaps are themselves growing, so extrapolating the *first* gap forward without checking the second and third gaps locks in the wrong rule.

---

### Q28. Find the odd one out: 2, 3, 5, 7, 11, 15.

**Answer:** **15.** Testing the cheap rules first (even/odd, small multiples) fails to cleanly separate these six numbers, so the next check is primality: 2, 3, 5, 7, and 11 are all prime, while 15 = 3 × 5 is composite. The trap is expecting the "obvious" rule (like all-odd, which 2 already breaks) to apply and second-guessing the actual answer — odd-one-out sets built around primes deliberately include 2 (the only even prime) precisely to break a lazy even/odd shortcut, forcing the more expensive primality check.

---

### Q29. In a certain code, PLANET is written as 427193 and TRAIN is written as 36781. What is the code for ANT?

**Answer:** **713.** Lining up the letters with their digits: P=4, L=2, A=7, N=1, E=9, T=3 (from PLANET), and T=3, R=6, A=7, I=8, N=1 (from TRAIN) — the overlapping letters A, N, and T give consistent digits across both words, confirming the map. So A=7, N=1, T=3, giving ANT = 713. The trap is assuming the code follows true alphabetical position (A=1, N=14, T=20) instead of deriving the letter-to-digit map purely from the overlapping letters in the examples given — these codes are arbitrary and must never be assumed to match real alphabet order.

---

### Q30. If "CATS CHASE MICE" is coded as "PIL SIM TOB" and "MICE EAT CHEESE" is coded as "TOB NIM ROP", what is the code for MICE?

**Answer:** **TOB.** The only real word common to both sentences is "MICE"; the only code-word common to both coded outputs — comparing {PIL, SIM, TOB} against {TOB, NIM, ROP} — is "TOB". Since there is exactly one shared real word and exactly one shared code-word, they must correspond. The trap is trying to match words position-by-position (assuming the 1st word of each sentence maps to the 1st code-word), which fails here since the sentences are scrambled in unrelated word order — this method only ever works by finding the single common word and single common code, never by position.

---

### Q31. Pointing to a man, a woman said, "His wife is the only daughter of my father." How is the woman related to the man?

**Answer:** **She is his wife.** "The only daughter of my father" describes exactly one person — the woman herself (assuming she has no sisters). So the sentence reduces to "his wife is [the woman]," meaning the woman is his wife. The trap is over-complicating a chain that actually loops back to the speaker — many solvers instinctively hunt for an external relation (sister-in-law, cousin, etc.) and never check whether the description simply points to the speaker herself, which is exactly the case here.

---

### Q32. Introducing a boy, a man said, "He is the son of my mother's only son." How is the boy related to the man?

**Answer:** **The boy is the man's own son.** "My mother's only son" means the man's mother has exactly one son — and since the man himself is a son of his mother, he must *be* that only son (there's no room for a different brother). So "the son of my mother's only son" reduces to "the son of myself" — the man's own son. The trap is reading "mother's son" as automatically meaning "my brother" and answering "nephew" — but the word "only" is the load-bearing clue here: it rules out a separate sibling and forces the only-son slot to be filled by the speaker himself.

---

### Q33. A man walks 4 km North, then 3 km East, then 4 km South. How far is he from his starting point, and in which direction?

**Answer:** **3 km, due East.** Tracking net position: North 4 → (0,4); East 3 → (3,4); South 4 → (3,0). The North and South components (4 km each) exactly cancel out, leaving only the 3 km East component. The trap is reflexively reaching for Pythagoras' theorem the moment two perpendicular legs appear in the problem — but Pythagoras only applies when *both* axes end with a non-zero net value; here the North-South axis nets to exactly zero, so the answer is simply the untouched East-West distance, no square root required.

---

### Q34. Six people sit in a row. Statement: "Q sits somewhere to the left of P." Does this mean Q sits *immediately* to the left of P?

**Answer:** **No.** "Somewhere to the left" only guarantees Q is positioned in the general left direction relative to P — it says nothing about adjacency, and any number of other people could be seated between them. The trap is treating a "somewhere" clue as if it were as strong as an "immediately to the left/right" clue — the two phrasings look similar but carry very different amounts of information; "somewhere" clues only ever eliminate possibilities, they almost never fix an exact seat by themselves.

---

### Q35. Five friends sit around a round table, all facing **outward** (away from the centre). If B sits to the immediate right of A, is B positioned clockwise or anticlockwise from A (as viewed from above)?

**Answer:** **Clockwise.** When people face outward, the rule flips relative to the more familiar "facing the centre" case: facing outward, right = clockwise (and left = anticlockwise). The trap is defaulting to the facing-the-centre rule (right = anticlockwise) out of habit, since most seating puzzles default to people facing inward — but the instant a puzzle specifies "facing outward," every left/right clue must be reinterpreted with the flipped rule, or the entire resulting arrangement comes out mirrored.

---

### Q36. Statements: "Some managers are leaders. Some leaders are visionaries." Conclusion: "Some managers are visionaries." Does this follow?

**Answer:** **No, it does not follow.** The middle term "leaders" is never fully pinned down (universally quantified) in either statement — both are "Some" statements. A valid diagram can be drawn where the managers-overlap and the visionaries-overlap sit on entirely different, non-intersecting parts of the "leaders" circle, making the conclusion false while both original statements stay true. The trap is following the "chain" intuitively (managers → leaders → visionaries feels like it should link up) without checking whether an alternative, equally valid diagram breaks it — this is the classic **undistributed middle** fallacy, and it appears whenever two "Some" statements share a middle term.

---

### Q37. Statement: "Some students are athletes." Conclusions: I. "All students are athletes." II. "Some students are not athletes." Which conclusion(s) follow?

**Answer:** **Either conclusion I or conclusion II follows.** Neither is individually guaranteed on its own — a diagram where all students happen to be athletes makes I true and II false, while a diagram with only partial overlap makes I false and II true. But I (an A-type statement) and II (an O-type statement) form a genuine complementary pair on the same two terms in the same order: for any two categories, either every student is an athlete, or at least one isn't — there's no third possibility. The trap is marking "neither follows" the moment individual verification fails for both, without checking whether the two conclusions form one of the two standard complementary pairs (A-vs-O or I-vs-E), which forces "either...or" as the answer instead.

---

### Q38. What is the two-digit number X? Statement I: The sum of its digits is 9, and the tens digit is exactly twice the units digit. Statement II: X is between 40 and 50, and is a multiple of 9.

**Answer:** **(C) — Either statement alone is sufficient.** Statement I alone: tens = 2×units and tens+units=9, so 3×units=9, units=3, tens=6, giving X=63 — a single, unique value. Sufficient. Statement II alone (evaluated with no memory of Statement I): two-digit multiples of 9 strictly between 40 and 50 are just 45 — again a single, unique value. Sufficient. The trap is noticing that 63 ≠ 45 and concluding the statements "contradict" each other, so the answer must be (D) — but sufficiency is judged per statement in isolation, not by cross-checking whether the two answers agree; each statement independently pins down one definite (if different) value, which is exactly what option (C) describes.

---

### Q39. Is p greater than q? Statement I: p is greater than 20. Statement II: q is greater than 15.

**Answer:** **(D) — Not sufficient, even combined.** Statement I alone says nothing about q; Statement II alone says nothing about p — neither is sufficient by itself. Combined: try p=21, q=100 (both conditions hold, and p<q, answer "No"); then try p=100, q=16 (both conditions hold again, and p>q, answer "Yes"). Two cases fully consistent with both statements together produce opposite answers. The trap is assuming that combining two statements must eventually settle a comparison question — it's tempting to stop at "together we know more" and mark (E), but you must actively hunt for a second combined case that flips the answer before concluding the statements are sufficient; here that second case always exists, so the honest answer is (D).

---

### Q40. A figure shows an arrow pointing to the top-right corner of a square (↗), with a dot at the bottom-left corner. What does its mirror image across a **horizontal** mirror line look like?

**Answer:** **An arrow pointing to the bottom-right corner (↘), with the dot at the top-left corner.** A horizontal mirror swaps only up and down, leaving left and right untouched — so the arrow's top component becomes bottom (while staying on the right), and the dot's bottom component becomes top (while staying on the left). The trap is applying the far more commonly-tested vertical-mirror rule (swap left-right, keep top-bottom) out of habit — the instant the axis is specified as horizontal instead of vertical, the swapped dimension flips, and answer options built assuming the wrong axis will look deceptively plausible.

---

## Verbal Ability (Q41–Q50)

### Q41. Choose the correct verb: "The quality of the products ___ excellent." (is / are)

**Answer:** **is.** Deleting the prepositional phrase "of the products" leaves the true subject: "The quality... is excellent." "Quality" is singular, even though the plural noun "products" sits directly next to the verb and pulls the eye toward a plural agreement. The trap is letting the noun physically closest to the verb dictate agreement instead of identifying the real subject first.

---

### Q42. Choose the correct verb: "The jury ___ reached its verdict." (has / have)

**Answer:** **has.** "Jury" is a collective noun; when it acts as a single decision-making unit (reaching one shared verdict), it takes a singular verb. The trap is assuming any noun referring to a group of people automatically needs a plural verb — collective nouns like jury, team, committee, and family take singular verbs specifically when the group acts together as one block, not as separate individuals doing different things.

---

### Q43. Choose the correct verb: "They were watching a movie when the lights ___ out." (go / went)

**Answer:** **went.** The sentence is anchored in the past tense ("were watching"), so every other verb describing an event within that same time-frame must also stay in the past — "went," not "go." The trap is defaulting to the simple present for the second clause because it feels like a standalone, immediate event ("the lights go out" sounds vivid) — but tense consistency requires checking the sentence's overall anchor tense first, not judging each verb in isolation.

---

### Q44. Choose the correct article: "She is ___ honest woman." (a / an)

**Answer:** **an.** Article choice depends on the sound that follows, not the spelling — "honest" begins with a silent "h," so the word is actually pronounced starting with the vowel sound "on-est," requiring "an." The trap is looking at the first *letter* ("h," a consonant) and reflexively choosing "a" — the rule only ever cares about what you actually hear at the start of the next word.

---

### Q45. Find the parallelism error: "Her hobbies include painting, dancing, and to sing."

**Answer:** **"...painting, dancing, and singing."** The first two items in the list are gerunds ("-ing" forms); the third breaks the pattern by switching to an infinitive ("to sing"). The trap is that "to sing" is a perfectly grammatical phrase in isolation — the error only becomes visible when checking it *against the form the earlier list items already established*, which is exactly why parallelism errors are easy to miss on a quick read.

---

### Q46. Find the faulty comparison: "The population of India is greater than China."

**Answer:** **"...greater than that of China."** The sentence compares "the population of India" (a quantity) directly to "China" (a country) — two different kinds of things. Mentally inserting "that of" before China restores a like-for-like comparison: population to population. The trap is that the sentence reads smoothly and the intended meaning is obvious from context, which is precisely why faulty comparisons slip past a fast read — the fix is to explicitly check that both sides of "than" name the same category of thing, not just skim for overall sense.

---

### Q47. Find and correct the redundancy: "Please repeat that again for me."

**Answer:** **"Please repeat that for me."** "Repeat" already means "say again," so adding "again" restates the same idea a second time with no new information. The trap is that redundant phrases like this ("repeat again," "return back," "each and every," "past history") sound like normal, even emphatic, spoken English — testing by deleting the suspected word and checking whether the sentence's meaning changes at all is the fast, reliable check (here it doesn't change, confirming "again" was extra).

---

### Q48. Choose the word most nearly OPPOSITE in meaning to ABUNDANT: (A) Plentiful (B) Scarce (C) Ample (D) Copious

**Answer:** **(B) Scarce.** "Abundant" means existing in large quantities; "scarce" (in short supply) is the direct opposite. The trap is that (A) Plentiful, (C) Ample, and (D) Copious are all near-*synonyms* of "abundant" — words related to the same topic (quantity) that a rushed reader might pick because they "feel connected" to the given word, without checking whether they point in the same direction or the opposite one. Antonym questions routinely plant synonyms as distractors precisely to catch this shortcut.

---

### Q49. Fill in the blank: "The professor is ___ in the field of quantum physics, having received numerous international awards." (A) Imminent (B) Eminent (C) Immanent (D) Emanate

**Answer:** **(B) Eminent** — meaning distinguished or well-known in one's field, which fits a career of international awards. The trap is confusing this with the similar-sounding (A) "Imminent," which means "about to happen" and makes no sense describing an established, decades-long reputation — these two words are among the most commonly confused sound-alike pairs in vocabulary sections precisely because they differ by only one letter but mean entirely unrelated things.

---

### Q50. Passage excerpt: "Although the startup secured record funding this year, it also laid off 15% of its staff and paused its international expansion plans." What can be inferred about the company?

**Answer:** **Despite the strong funding, the company appears cautious about its near-term growth prospects.** Neither fact alone (record funding, or layoffs-plus-paused-expansion) gives this conclusion — it requires combining both stated facts: strong financial backing paired with a pullback in headcount and expansion signals deliberate caution, not simple financial distress or unqualified success. The trap is picking an option that merely restates one of the two facts directly (e.g., "the company is struggling financially," which the record funding actually contradicts) instead of the option that logically combines both facts into a conclusion one step beyond either sentence alone — exactly the literal-reading trap inference questions are built to catch.
