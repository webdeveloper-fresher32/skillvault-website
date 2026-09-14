# Mock Interview Approach

## 1. Problem

Knowing every technique in Phases 1–13 cold doesn't automatically translate into a good interview performance, because a technical interview isn't graded solely on "did the final code work." It's graded on a process: did you understand the problem correctly before writing code, did you consider the obvious approach and its cost before jumping to a clever one, did you communicate your reasoning as you went, and did you verify your own work before declaring victory. Candidates who silently think for two minutes and then produce correct code in silence routinely score lower than candidates who narrate an imperfect but visible thought process, because the interviewer — who cannot see inside your head — has nothing to evaluate except what you say and write. The mock interview approach is a repeatable loop that forces the invisible parts of problem-solving to become visible and gradeable.

## 2. Analogy

Think of the difference between a surgeon who operates in total silence versus one who narrates during a teaching operation: "I'm making the incision here because the artery runs beneath this landmark; now I'm checking for bleeding before I close." Both surgeons might produce the same successful outcome, but only the second one lets an observer (or a resident under supervision) confirm that the good outcome came from sound judgement rather than luck — and only the second one gives the observer a chance to say "wait, check that first" before a mistake becomes irreversible. An interview is graded like the teaching operation, not the solo one: the interviewer is the observer, and your narration is the only evidence they have that your process, not just your final answer, is sound.

## 3. Internal Flow

The standard loop, run in order, every time:

1. **Clarify constraints and edge cases.** Before touching the approach, pin down: input size bounds (does it change the acceptable complexity?), whether inputs can be empty, negative, contain duplicates, or be unsorted, and what the expected output format is for ambiguous cases (e.g., ties, no valid answer). This step exists because a technically correct solution to a misunderstood problem is still a wrong answer, and clarifying is the cheapest way to avoid that.
2. **State a brute-force approach and its complexity, out loud, before optimizing.** Even if the brute force is obviously not the final answer, saying "the naive approach is to check every pair, which is O(n²) time and O(1) space" establishes a working baseline, proves you can reason about complexity, and gives the interviewer an anchor to see how much better the optimized version is.
3. **Identify the bottleneck and optimize.** Ask specifically what the brute force wastes (repeated work? unnecessary comparisons? no use of a data structure that would give O(1) lookups?) and connect that bottleneck to a technique from the pattern-recognition framework (`DSA/Phase-14-Interview-Strategy/01-Pattern-Recognition-Framework.md`). State the new approach and its improved complexity before coding it.
4. **Code the optimized approach**, narrating major decisions as you write (variable meaning, loop invariant, why a particular data structure) rather than typing in silence.
5. **Trace the code on a small example by hand** — literally step through the interviewer's example (or one you construct) line by line, updating variables on paper/whiteboard/comments, to catch off-by-one and logic errors before declaring the solution done.
6. **Restate the final time and space complexity**, and mention any remaining edge cases or trade-offs (e.g., "this assumes the array fits in memory; a streaming variant would need X").

Narrating this loop matters as much as getting to the right code, because the interviewer's job is to assess how you'd behave on a real ambiguous production problem where there's no answer key — the loop is the demonstration of that behavior in miniature.

## 4. Example

A short transcript-style walkthrough for: *"Given an array of integers, find two numbers that add up to a target."*

> **Candidate:** "Before I start, a couple of clarifying questions — can the array contain duplicate values, and is it guaranteed there's exactly one valid pair, or could there be zero or multiple?"
> **Interviewer:** "Assume exactly one valid pair exists, and duplicates are possible."
> **Candidate:** "Got it. The brute-force approach is to check every pair of indices with a nested loop, compare their sum to the target, and return the first match — that's O(n²) time and O(1) extra space. I think we can do better than that."
> **Candidate:** "The bottleneck in the brute force is that for each element, I'm re-scanning the whole array looking for its complement. If I instead keep a hash map of values I've already seen mapped to their index, I can check for the complement of the current element in O(1) as I go, which brings this down to O(n) time and O(n) space — this is the same idea as `DSA/Phase-05-Hashing/04-Two-Sum-Style-Problems.md`."
> **Candidate:** *(writes code)* "I'm iterating once, and for each number, computing `target - num` and checking if it's already a key in the map before inserting the current number — that ordering matters so I don't match an element with itself."
> **Candidate:** "Let me trace this on `[2, 7, 11, 15]` with target `9`: at `2`, complement `7` isn't in the map yet, so I insert `2 → 0`. At `7`, complement `2` *is* in the map at index 0, so I return `(0, 1)` — that's correct."
> **Candidate:** "Final complexity: O(n) time, O(n) space for the hash map, versus O(n²) time and O(1) space for the brute force — a clear win here since n could be large."

This transcript shows every step of the loop present and visible: clarify, brute force + complexity, bottleneck + optimize + complexity, code with narration, trace, final complexity restatement.

## 5. Compare

| Interview style | What the interviewer sees | Typical outcome |
|---|---|---|
| Silent thinking, then correct code appears | Only the end result; no insight into process | Risky — a small bug or edge case miss looks like "doesn't understand the problem," even if the candidate does |
| Full narrated loop (clarify → brute force → optimize → code → trace → complexity) | Every decision point, including dead ends and course corrections | Strongest signal — even an imperfect final answer usually scores partial credit |
| Jump straight to "optimal" approach with no brute force stated | Interviewer can't tell if the jump was reasoned or memorized | Weak if a follow-up ("why not the naive approach?") can't be answered cleanly |
| Narrate constantly but never actually reach working code | Process visible, but no verified deliverable | Better than silence, but still needs to converge — see `DSA/Phase-14-Interview-Strategy/03-Time-Management-and-Problem-Approach.md` for budgeting this |

## 6. Common Mistakes

- Jumping straight to coding without stating a plan first — this loses partial credit if the approach turns out wrong, and wastes coding time on an approach that a 30-second sanity check would have redirected.
- Skipping the brute-force statement entirely because it feels "too obvious to say" — the interviewer needs to hear it to judge how much the optimization actually improves things, and to have a fallback plan on record if the optimized version runs out of time.
- Not testing the solution against the interviewer's own example before declaring it done — many bugs (off-by-one, wrong comparison operator, unhandled empty input) are caught in seconds by an actual trace and missed entirely by "eyeballing" the code.
- Going silent while thinking, even briefly, for more than a few seconds — silence reads as being stuck, not as being thoughtful, unless you explicitly say "give me a moment to think about the edge cases here."
- Treating clarifying questions as a formality to rush through rather than genuinely using the answers to shape the approach (e.g., asking about duplicates, then writing code that doesn't actually handle them).

## 7. Interview Angle

The mock interview loop exists because real interviews are, almost without exception, evaluating *process* over *output* — an interviewer who has seen hundreds of candidates solve the same question can tell within the first two minutes whether a candidate has a repeatable method or is improvising, and the repeatable method reads as far more hire-able even when the improvised approach happens to reach correct code faster. Practicing this loop out loud (literally speaking to an empty room, a friend, or a rubber duck) before the interview matters because narrating technical reasoning under pressure is itself a skill that atrophies without rehearsal — knowing the loop intellectually is not the same as being able to execute it fluently while also thinking about pointers and edge cases.

## 8. Memory Hook

"**Clarify, Brute, Optimize, Code, Trace, Recap**" — CBOCTR, the six beats of every answer, in that order, said out loud. If you're ever unsure what to say next in an interview, you're always at one of these six beats — say where you are and what you're doing there.
