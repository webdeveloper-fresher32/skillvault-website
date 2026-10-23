# Aptitude Formula Cheatsheet

Dense, instant-reference formula list — organized by topic, not by chapter. Each formula has a one-line note on when/why it matters.

---

### Number Systems & HCF-LCM

| Formula/Rule | When to use |
|---|---|
| Divisible by 2: last digit 0,2,4,6,8 | Fastest check, no addition needed |
| Divisible by 3: digit sum divisible by 3 | Works for any size number |
| Divisible by 4: last 2 digits divisible by 4 | Only the last 2 digits matter |
| Divisible by 5: last digit 0 or 5 | Fastest check |
| Divisible by 6: divisible by both 2 AND 3 | Combine the 2-rule and 3-rule |
| Divisible by 7: double last digit, subtract from the rest, repeat if needed | Only rule needing repeated steps |
| Divisible by 8: last 3 digits divisible by 8 | Only the last 3 digits matter |
| Divisible by 9: digit sum divisible by 9 | Same digit sum as the 3-rule, stricter |
| Divisible by 10: last digit 0 | Fastest check |
| Divisible by 11: (sum of odd-position digits) − (sum of even-position digits, from the right) is 0 or a multiple of 11 | Position counting starts from the rightmost digit |
| Unit digit cycles — 0,1,5,6: cycle length 1 (always itself); 4,9: cycle length 2; 2,3,7,8: cycle length 4 | Find unit digit of aⁿ: take n mod cycle length, look up that position in the cycle (remainder 0 → use last entry) |
| HCF × LCM = product of the two numbers | Skip factorization — find one unknown (HCF, LCM, or a number) from the other two in one line |
| HCF (prime factorization) = product of common primes at their **lowest** power | Use when both numbers are small enough to factorize |
| LCM (prime factorization) = product of all primes involved at their **highest** power | Use when both numbers are small enough to factorize |
| HCF (division method): divide larger by smaller, then divisor by remainder, repeat till remainder 0; last non-zero divisor = HCF | Faster than factorization for large numbers |
| HCF of fractions = HCF(numerators) / LCM(denominators) | Fraction HCF/LCM questions |
| LCM of fractions = LCM(numerators) / HCF(denominators) | Fraction HCF/LCM questions |
| BODMAS: Brackets → Of → Division/Multiplication (left to right) → Addition/Subtraction (left to right) | Division/Multiplication are equal priority; so are Addition/Subtraction — don't force one before the other |
| Nested fractions: simplify innermost fraction first, work outward one layer at a time | Never cross-multiply the whole stack at once |
| Memorize fraction↔decimal: 1/2=0.5, 1/3=0.333, 1/4=0.25, 1/5=0.2, 1/6=0.1667, 1/7=0.142857, 1/8=0.125, 1/9=0.111, 1/11=0.0909, 1/12=0.0833 | Skip long division for common fractions |
| Approximation: round both percentage and base to convenient values first | Fast estimate when answer choices are far apart |

---

### Percentages & Profit-Loss

| Formula/Rule | When to use |
|---|---|
| % change = (New − Original)/Original × 100 | Positive = increase, negative = decrease |
| Successive % change: Net % = a + b + ab/100 (use negative values for decreases) | Replaces multiplying (1+a/100)(1+b/100) by hand — works for any combo of increase/decrease |
| "A is x% more than B" ⟹ B is less than A by x/(100+x) × 100% | The single most common percentage trap — x% more is NOT the mirror of x% less |
| Fraction↔% table: 1/2=50%, 1/3=33.33%, 1/4=25%, 1/5=20%, 1/6=16.67%, 1/7=14.29%, 1/8=12.5%, 1/9=11.11%, 1/10=10%...1/20=5% | Converts "find 33.33% of 240" into "1/3 of 240" instantly |
| Profit = SP − CP; Loss = CP − SP | Basic definitions |
| Profit% = Profit/CP × 100; Loss% = Loss/CP × 100 | **Always divide by CP, never SP** — the most common P&L error |
| SP = CP × (1 + Profit%/100) or CP × (1 − Loss%/100) | Reverse direction: CP + %  → SP |
| SP = MP × (1 − Discount%/100) | Discount is always applied to Marked Price, never CP |
| Successive discounts combine via Net% = a + b + ab/100 (both negative) | Same successive-change formula as percentages, applied to discounts |
| False weight profit% = Error / (True value − Error) × 100 | Dishonest dealer sells at "cost price" but shortchanges the measure |

---

### Averages & Alligation

| Formula/Rule | When to use |
|---|---|
| Average = Sum of values / Number of values | Basic definition |
| Average of first n natural numbers = (n+1)/2 | Skip summing 1 to n |
| Weighted average = (w₁x₁ + w₂x₂ + ...) / (w₁ + w₂ + ...) | Combining groups of different sizes (e.g., two classes) |
| Average speed (equal distances, two speeds) — see the TSD & Time-Work section below | Harmonic mean, NOT (x+y)/2; same formula, listed once to avoid repetition |
| Alligation ratio: Cheaper : Dearer = (D − M) : (M − C) | C = cheaper value, D = dearer value, M = target mean; cross-subtraction gives mixing ratio |

---

### Ratio & Partnership

| Formula/Rule | When to use |
|---|---|
| Simplify a ratio by dividing every term by their HCF | Always reduce before comparing/combining |
| Dividing total T in ratio a:b:c → each share = T × (that part)/(a+b+c) | Replaces "let parts be 2x, 3x..." algebra |
| Compounding two ratios a:b and b:c → scale each so the common term (b) becomes LCM of the two b-values, then read off a:b:c | Combine two given ratios sharing one term |
| Direct proportion: x₁/y₁ = x₂/y₂ (cross-multiply) | Both quantities move the same way |
| Inverse proportion: x₁y₁ = x₂y₂ (product constant) | One quantity moves opposite the other — classic case: Men × Days = constant work |
| Simple partnership (equal time): Share of A = Total profit × A's capital / Sum of all capitals | All partners invest for the same duration |
| Compound partnership (capital × time): ratio = C_A×T_A : C_B×T_B : ... | Partners invest different amounts for different durations — adjust time, not capital, for late joiners/early exits |
| Working-partner fee: pay fixed fee first, split the **remaining** profit by capital(×time) ratio, then add the fee back to the working partner | One partner also draws a fixed salary for managing the business |

---

### Time-Speed-Distance & Time-Work

| Formula/Rule | When to use |
|---|---|
| km/h → m/s: × 5/18; m/s → km/h: × 18/5 | Unit conversion, needed in nearly every TSD question |
| Relative speed: opposite directions → **sum** of speeds; same direction → **difference** of speeds | Two moving bodies (people, trains, boats) |
| Time to meet (opposite directions) = distance apart / sum of speeds | Two bodies starting apart, moving toward each other |
| Time to catch up (same direction) = gap / difference of speeds | One body chasing another |
| Average speed (equal-distance two legs) = 2ab/(a+b) | Harmonic mean — do NOT use simple average (a+b)/2 |
| Fixed distance: speed × time = constant (inverse relationship) | New time = distance ÷ new speed; never scale time by the same % as speed |
| Train crossing a pole/point: distance = train's own length | Speed used = train's own speed |
| Train crossing a platform/bridge (length L): distance = train length + L | Speed used = train's own speed |
| Two trains crossing, opposite directions: distance = sum of lengths, speed = sum of speeds | — |
| Two trains crossing, same direction (overtaking): distance = sum of lengths, speed = difference of speeds | — |
| Boats: Downstream speed = b + s; Upstream speed = b − s (b = still-water speed, s = stream speed) | — |
| Reverse: b = (d+u)/2; s = (d−u)/2 (d = downstream speed, u = upstream speed) | Given downstream/upstream speeds, find boat and stream speed |
| Rate of work = 1/n of the job per day, if the job takes n days alone | Converts "X can do a job in N days" into an addable rate |
| Combined time (two workers) = ab/(a+b), where a, b are solo days | Product-over-sum shortcut, same form as average speed |
| Wage ratio = Efficiency ratio = 1/(days A alone) : 1/(days B alone) | Split payment by work contributed, not by headcount or days worked |
| Pipes: inlet rate = +1/n; outlet rate = −1/m; net rate = sum of signed rates; net time = 1/(net rate) | Negative net rate means the tank drains overall — sanity check |

---

### Interest & Mixtures

| Formula/Rule | When to use |
|---|---|
| SI = P × R × T / 100 | Simple interest — flat, same every year |
| CI = P(1 + R/100)^T − P | Compound interest — interest on interest, grows each year |
| SI and CI are identical for year 1; they diverge from year 2 onward | Quick sanity check |
| CI − SI (2 years only) = P(R/100)² | Direct shortcut; only valid for exactly 2 years |
| P = (CI − SI) / (R/100)² | Reverse: given CI−SI difference and rate, find principal directly |
| Non-annual compounding: Amount = P(1 + R/100n)^(nT) | n = compounding periods/year (2 for half-yearly, 4 for quarterly); use rate R/n per period and nT total periods |
| Effective annual rate = [(1 + R/100n)^n − 1] × 100 | Always slightly higher than nominal R when n > 1 |
| Replacement/dilution: Final = Initial × (1 − removed/total)ⁿ | Repeated removal-and-replace of a liquid — a power, never a subtraction |

---

### Geometry & Mensuration

| Formula/Rule | When to use |
|---|---|
| Rectangle: Area = l×w, Perimeter = 2(l+w) | — |
| Square: Area = a², Perimeter = 4a | — |
| Circle: Area = πr², Circumference = 2πr | — |
| Triangle (base & height given): Area = ½ × base × height | Default when height is known/derivable |
| Cube: Volume = a³; Cuboid: Volume = l×w×h; Cylinder: Volume = πr²h | — |
| Path around a rectangular field = outer rectangle area − inner rectangle area | Compute as a difference of areas, not a direct path formula |
| Pythagoras: c² = a² + b² (c = hypotenuse) | Right triangles |
| Common Pythagorean triples: (3,4,5), (5,12,13), (6,8,10), (7,24,25), (8,15,17), (9,12,15), (9,40,41), (20,21,29) | Instant recall — skip square-root computation when sides match a multiple of these |
| Heron's formula: s = (a+b+c)/2, Area = √(s(s−a)(s−b)(s−c)) | Only when all 3 sides are given and no height is available |
| Sector Area = (θ/360) × πr²; Arc Length = (θ/360) × 2πr | θ = central angle in degrees — sector is just a fraction of the full circle |
| Cone: Volume = ⅓πr²h; CSA = πrl; TSA = πr(l+r), where l² = r²+h² | l = slant height |
| Sphere: Volume = 4/3 πr³; Surface Area = 4πr² | — |
| Cone vs. cylinder (same r, h): cone volume = ⅓ of cylinder's volume | Sanity check |
| Sphere vs. circumscribing cylinder (same r, h=2r): sphere volume = ⅔ of cylinder's volume | Sanity check |
| Use π = 22/7 when r is a multiple of 7 (or 14, 21, 3.5); otherwise use π = 3.14 | Keeps arithmetic clean |

---

### Permutations-Combinations & Probability

| Formula/Rule | When to use |
|---|---|
| nPr = n! / (n−r)! | Order matters (arrangement) |
| nCr = n! / (r!(n−r)!) = nPr / r! | Order doesn't matter (selection/grouping) |
| Order matters → P; order doesn't matter → C | Ask: does swapping two chosen items create a genuinely different outcome? |
| Factorial cancellation: nPr = top r descending factors of n (e.g., 10P3 = 10×9×8) | Never expand a full factorial by hand |
| nCr symmetry: nCr = nC(n−r) | If r > n/2, flip to the smaller complement for faster computation |
| Circular permutations of n distinct objects = (n−1)! | "Around a table/circle/ring" — not n! |
| Circular permutations with reflection symmetry (bracelet/garland) = (n−1)!/2 | Clockwise and counterclockwise arrangements considered identical |
| Arrangements with repeated items = n! / (p₁! × p₂! × ... × pₖ!) | pᵢ = count of each repeated item (e.g., letters of a word) |
| P(A) = favorable outcomes / total outcomes | Basic definition, 0 ≤ P(A) ≤ 1 |
| Addition rule: P(A∪B) = P(A) + P(B) − P(A∩B) | "OR" events; simplifies to P(A)+P(B) if mutually exclusive |
| Multiplication rule (independent): P(A∩B) = P(A) × P(B) | "AND" events where one doesn't affect the other (with replacement) |
| Multiplication rule (dependent): P(A∩B) = P(A) × P(B\|A) | One event changes the odds of the next (without replacement) |
| Complement: P(A) = 1 − P(not A) | Use whenever "not A" is easier to count than A directly |
| "At least one" → compute P(none) and subtract from 1 | Avoids adding up exactly-1, exactly-2, ... cases separately |
| Deck facts: 52 cards, 4 suits (13 each), 2 colors (26 each), 4 aces, 12 face cards | Memorize cold — no time to recall deck structure mid-problem |
| Without replacement = dependent; with replacement = independent | Fastest way to classify a card/ball-drawing problem |
| Dice sums are not equally likely (sum=7 has 6 ways, sum=2 or 12 has only 1) | Always count actual (die1, die2) pairs, don't assume uniform 1/11 |

---

### Series & Coding-Decoding Shortcuts

| Formula/Rule | When to use |
|---|---|
| Write the difference row under a series first, always | Constant differences → arithmetic; differences-of-differences constant → second-order/quadratic; constant ratios → geometric |
| Erratic-but-periodic differences → suspect alternating operations | Split into two operations taking turns rather than forcing one rule |
| Letter series → convert each letter to its alphabet position (A=1...Z=26), solve as a number series, convert back | Never spot letter patterns directly in your head |
| Odd-one-out: check cheap rules first (even/odd, small multiples, squares/cubes) before expensive ones (primality) | Most odd-one-out sets are built around squares, cubes, or primes |
| Letter-shift coding: convert both letters of an example pair to positions, confirm a uniform shift, then apply the same shift (or its reverse to decode) | Caesar-cipher style coding |
| Number coding: build the letter→digit map from the overlapping letters in the given examples — never assume true A=1...Z=26 positions | Codes are usually arbitrary, must be derived from data given |
| Coded sentences: find the one real word common to both sentences; the one code-word common to both coded outputs is its code | Only works when comparing two examples that share exactly one real word |

---

### Data Sufficiency — Answer Option Meanings

| Option | Meaning |
|---|---|
| **(A)** | Statement I **alone** is sufficient, but Statement II alone is **not** sufficient |
| **(B)** | Statement II **alone** is sufficient, but Statement I alone is **not** sufficient |
| **(C)** | **Either** statement alone is sufficient (each one, independently, pins down a definite answer — they need not agree with each other) |
| **(D)** | Statement I and II **together** are **not** sufficient |
| **(E)** | Statement I and II **together** are sufficient, but **neither** statement alone is sufficient |
| Evaluate Statement I in complete isolation, then Statement II in complete isolation (forgetting Statement I) — only combine after both solo passes | Prevents "information leakage" between statements |

---

### Logical Reasoning Quick Rules

| Formula/Rule | When to use |
|---|---|
| Blood relations: draw the family tree as you read — generation rows, `=` between spouses, `|` down to children, mark (M)/(F) | Don't hold 3+ chained relations in your head |
| "Only son/only daughter/only child" clue pins down exactly one person | Substitute a concrete person into the diagram instead of leaving it ambiguous |
| Uncle's/aunt's child = cousin, never brother/sister | Common vocabulary trap even when same age |
| Direction sense: track two running totals — North-South and East-West, not the whole path | Add all N/S distances into one number, all E/W into another |
| Net distance from start = √(North-South total)² + (East-West total)² | Apply only when both axis totals are non-zero (Pythagoras) |
| Turn table: facing N, right→E/left→W; facing E, right→S/left→N; facing S, right→W/left→E; facing W, right→N/left→S | Update current facing after every turn before applying the next move |
| Circular seating facing centre: clockwise seat = left, anticlockwise seat = right | Sanity check: stand at 12 o'clock facing centre — right hand points to 9 o'clock (anticlockwise) |
| Circular seating facing outward: clockwise seat = right, anticlockwise seat = left | Flips the facing-centre rule |
| Linear row, one person facing opposite way: use THAT person's own left/right, not the reader's | "Immediate right of X" always means X's own hand |
| "Immediately left/right" = exact adjacent seat; "somewhere to the left/right" = general direction only, others may sit between | Never treat a "somewhere" clue as if it fixed an exact seat |
| Seating solve order: (1) absolute/anchor clues, (2) immediate-neighbor clues chained off anchors, (3) counting/"somewhere" clues, (4) last seat is forced | Two seats still open after all clues = missing/misread a clue |
| Syllogism types: A = "All A are B" (A inside B), E = "No A is B" (disjoint), I = "Some A are B" (some overlap, could be all), O = "Some A are not B" (A has a part outside B) | "Some" means "at least one," compatible with "all" |
| A conclusion follows only if true in EVERY valid diagram consistent with the statements, not just the first/obvious one | Draw multiple diagrams for any "Some"/"Some...not" statement before deciding |
| Undistributed middle trap: two "Some" statements sharing a middle term almost never force a conclusion between the outer terms | Classic syllogism fallacy — the overlap satisfying each premise need not be the same overlap |
| Complementary-pair rule: A-type vs O-type (same subject-predicate order), or I-type vs E-type (same order) → "Either conclusion I or II follows" | Apply only when the two conclusions match one of these exact pairs, same terms, same order |
| Conclusion questions: ask "does this add new info/opinion beyond what the statement forces?" | Over-generalizing ("all," "none," "always") or injecting value judgments ("happy," "good") = does not follow |
| Assumption negation test: flip the proposed assumption to its opposite — if the statement falls apart/becomes pointless, it IS an implicit assumption; if the statement still holds up, it is NOT | The single fastest assumption-question check |
| Strong argument = directly addresses the specific issue + grounded in a real/verifiable consequence or cause | Vague slogans applicable to any debate ("violates freedom") are weak |
| Course of action: must target the actual cause AND be proportionate in scale | "Investigate/review/advisory" usually sensible; "ban entirely/shut down indefinitely" usually disproportionate unless statement describes matching-scale emergency |

---

### Verbal Ability Quick Rules

| Formula/Rule | When to use |
|---|---|
| SVA: delete the middle prepositional phrase/clause, check agreement on what's left | "The list of items **is** long" — subject is "list," not "items" |
| Collective nouns (team, committee, jury, family, audience) acting as ONE unit take a singular verb | "The committee **has** submitted the report" |
| Tense consistency: find the anchor tense from the first main verb, keep every other verb in that same time-frame | "She was cooking when the phone **rang**," not "rings" |
| a/an rule: governed by sound, not spelling | "an hour" (silent h, vowel sound); "a university"/"a one-rupee coin" (consonant "y"/"w" sound despite vowel spelling) |
| Fixed prepositions: different **from**, married **to**, good **at**, depend **on**, arrived **at** (a point/building) vs arrived **in** (a city/country) | Memorize as vocabulary facts, don't translate literally from feel |
| Parallelism: every item in a list joined by and/or/"not only...but also" must share the same grammatical form (all nouns, all gerunds, or all infinitives) | "reading, writing, and **to swim**" breaks the pattern the first two items set |
| Underline-and-scan checkpoint order: SVA → tense consistency → redundancy → misplaced modifier → faulty comparison | Only mark "No error" after actively failing all five checks |
| Redundancy classics: "return back," "each and every," "past history," "repeat again," "free gift" | Delete the suspected word — if meaning doesn't change, it's redundant |
| Misplaced modifier check: cover the introductory modifying phrase, read only what's left, ask if the phrase logically describes that remaining subject | "Walking along the beach, the sunset looked beautiful" — a sunset can't walk |
| Faulty comparison check: mentally insert "that of" / "those of" between the compared items | "Price of gold higher than silver" → "...than **that of** silver" |
| Root-word technique: break unfamiliar words into prefix + root + suffix, assign rough meanings, combine | "mal-" (bad) + "-dict-" (say) → MALEDICTION guessable as "curse" even if never seen before |
| Confusable pairs: affect(v.)/effect(n.), complement(completes)/compliment(praise), stationary(not moving)/stationery(paper), continual(repeated w/ gaps)/continuous(uninterrupted), eminent(distinguished)/imminent(about to happen) | Exams build wrong options from the similar-sounding twin |
| Antonym trap: check "same direction or opposite direction?" for every option, not just "does this feel connected?" | Near-synonyms (e.g., "thrifty"/"careful" for "frugal") are the most common wrong-answer bait, not true opposites |
| Idiom questions: if a literal word-by-word reading is nonsensical, recall the fixed meaning as a whole unit | "Spill the beans" = reveal a secret; "bite the bullet" = face something unpleasant head-on |
| RC question types: main idea (from opening/closing sentences, skim pass only), detail (locate exact keyword sentence), inference (one logical step beyond two stated facts, never a direct restatement), tone (from word choice/adjectives, not literal content) | Classify the question type before searching the passage — it tells you where to look |
| RC time split: ~20% of allotted time on the skim pass, remaining ~80% split across questions by count | Skim pass turns later searches into "jump to paragraph 2" instead of re-reading everything |
| Finding one value that fits is not enough — actively hunt for a second, different value before declaring a statement sufficient | Applies to solo statements AND to combined statements (before marking E vs D) |
