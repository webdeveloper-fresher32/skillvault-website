# Interval Scheduling and Activity Selection

## 1. Problem

Given a list of activities, each with a start time and an end time, and a single shared resource (one room, one machine, one person) that can run only one activity at a time, pick the **largest possible subset of non-overlapping activities**. This is the classic **activity selection problem**: you're not trying to schedule everything — you're trying to maximize *how many* activities you can fit in, accepting that some will have to be dropped because they clash with others.

This shows up everywhere resources are scarce and requests are time-boxed: booking a single conference room against a day full of overlapping meeting requests, scheduling a CPU to run the maximum number of jobs from a queue of jobs with deadlines, or a single interviewer picking the most candidate slots out of a flood of overlapping availability windows. In every case, the "obvious" instinct — try to squeeze in the requests that seem most valuable first — turns out to be the wrong heuristic. What actually works is a specific, provably-optimal greedy rule, and the reason it works (the **greedy-choice property**) is worth understanding precisely, because the two "reasonable-looking" alternatives (sort by start time, sort by duration) both fail on ordinary inputs.

## 2. Analogy

Think of a single movie screen and a stack of film submissions, each with a start time and an end time. You want to screen as many *distinct* films as possible today, back to back, with no overlaps. Your best strategy: always show whichever available film **finishes soonest**. Why? Because finishing soonest is exactly the property that leaves the most daylight left over for everything after it — an early-ending film can never "block" more of the future than a later-ending one that started at the very same moment. Picking the film that started earliest, or the one that's shortest, doesn't get you this guarantee: an early starter can still run long and eat the whole afternoon, and a short film that starts late still wastes the screen time before it starts. Only "ends soonest among what's currently available" reliably maximizes the leftover screen time for future picks.

## 3. Internal Flow

**Step 1 — sort by end time.** Sort all activities in ascending order of their end time. This is the single most important decision in the whole algorithm — everything else follows mechanically once this ordering is fixed.

**Step 2 — walk the sorted list, greedily accepting.** Track `last_end`, the end time of the most recently *accepted* activity (initialized to negative infinity, since nothing has been accepted yet). For each activity in end-time order:
- If its `start >= last_end`, it doesn't conflict with anything already accepted — **accept it**, and update `last_end` to this activity's end time.
- Otherwise, its start falls before the last accepted activity has finished — **reject it**, and move on without touching `last_end`.

**Step 3 — return the accepted set.** A single linear pass after the sort; no backtracking, no reconsideration of earlier decisions.

**Why "sort by end time" is the greedy-choice property that works.** Call the activity with the earliest end time among all activities `a*`. Claim: there exists an optimal solution that includes `a*`. Proof sketch (exchange argument): take any optimal solution `S`. If `a*` isn't in `S`, let `f` be whichever activity in `S` finishes first. Because `a*` has the *globally* earliest end time, `end(a*) <= end(f)`. Since `f` doesn't conflict with anything else in `S` (S is a valid non-overlapping set) and `a*` ends no later than `f`, swapping `f` out for `a*` cannot introduce any new conflicts with the rest of `S` — every other activity in `S` that started at or after `end(f)` still starts at or after `end(a*)`, since `end(a*) <= end(f)`. So `S` with `f` replaced by `a*` is still a valid, equally-sized solution that now includes `a*`. This means picking the earliest-ending activity first is always *safe* — it never costs you anything compared to some optimal solution — and the same argument applies recursively to the remaining activities that start after `end(a*)`. That recursive safety, applied all the way down, is exactly what makes the greedy walk in Step 2 produce a provably maximum-size selection, with no need to ever backtrack or reconsider.

**Why start time and duration don't have this property.** Sorting by start time optimizes for "grab the resource as early as possible" — but an activity that starts earliest can still run arbitrarily long, blocking out everything else for a long stretch even though something short could have squeezed in and left room for two or three more later. Sorting by duration ("shortest job first") optimizes for "the individual item is cheap" — but a short activity can sit in the *middle* of the day and, purely due to *when* it happens to end, still block more total future opportunity than a slightly longer activity that happens to end sooner. Neither start time nor duration says anything about how much of the timeline is left over afterward; only end time does. That's the entire reason the greedy-choice property singles out end time and no other ordering.

## 4. Example

An `activity_selection` function that sorts by end time and greedily accepts non-conflicting activities, tracing every accept/reject decision against the running `last_end`.

```python
def activity_selection(intervals):
    # Greedy: sort by END time, always try the earliest-finishing option first
    sorted_intervals = sorted(intervals, key=lambda iv: iv[1])
    print(f"Sorted by end time: {sorted_intervals}\n")

    selected = []
    last_end = float('-inf')

    for start, end, name in sorted_intervals:
        if start >= last_end:
            selected.append((start, end, name))
            print(f"ACCEPT {name} ({start}-{end}): starts at/after last_end={last_end} -> new last_end={end}")
            last_end = end
        else:
            print(f"REJECT {name} ({start}-{end}): starts before last_end={last_end} -> conflicts")

    return selected


activities = [
    (1, 4, 'A'),
    (3, 5, 'B'),
    (0, 6, 'C'),
    (5, 7, 'D'),
    (3, 9, 'E'),
    (5, 9, 'F'),
    (6, 10, 'G'),
    (8, 11, 'H'),
    (8, 12, 'I'),
    (2, 14, 'J'),
    (12, 16, 'K'),
]

print(f"Input activities (start, end, name): {activities}\n")
result = activity_selection(activities)
print(f"\nSelected activities: {result}")
print(f"Count selected: {len(result)}")
```

Actual output:

```text
Input activities (start, end, name): [(1, 4, 'A'), (3, 5, 'B'), (0, 6, 'C'), (5, 7, 'D'), (3, 9, 'E'), (5, 9, 'F'), (6, 10, 'G'), (8, 11, 'H'), (8, 12, 'I'), (2, 14, 'J'), (12, 16, 'K')]

Sorted by end time: [(1, 4, 'A'), (3, 5, 'B'), (0, 6, 'C'), (5, 7, 'D'), (3, 9, 'E'), (5, 9, 'F'), (6, 10, 'G'), (8, 11, 'H'), (8, 12, 'I'), (2, 14, 'J'), (12, 16, 'K')]

ACCEPT A (1-4): starts at/after last_end=-inf -> new last_end=4
REJECT B (3-5): starts before last_end=4 -> conflicts
REJECT C (0-6): starts before last_end=4 -> conflicts
ACCEPT D (5-7): starts at/after last_end=4 -> new last_end=7
REJECT E (3-9): starts before last_end=7 -> conflicts
REJECT F (5-9): starts before last_end=7 -> conflicts
REJECT G (6-10): starts before last_end=7 -> conflicts
ACCEPT H (8-11): starts at/after last_end=7 -> new last_end=11
REJECT I (8-12): starts before last_end=11 -> conflicts
REJECT J (2-14): starts before last_end=11 -> conflicts
ACCEPT K (12-16): starts at/after last_end=11 -> new last_end=16

Selected activities: [(1, 4, 'A'), (5, 7, 'D'), (8, 11, 'H'), (12, 16, 'K')]
Count selected: 4
```

Note how `E`, `F`, and `G` are all rejected in a row purely because `last_end=7` (set by `D`) hasn't moved — the algorithm never reconsiders whether one of them might have been a "better" pick than `D`; the greedy-choice property guarantees it doesn't need to.

## 5. Compare

Running the same 11 activities through three different sort keys (`by end time`, `by start time`, `by duration`) makes the failure of the other two heuristics concrete rather than theoretical:

```text
By end time : ['A', 'D', 'H', 'K'] count = 4
By start time: ['C', 'G', 'K'] count = 3
By duration : ['B', 'D', 'H', 'K'] count = 4
```

`by start time` picks `C` (0-6) first because it starts earliest — but `C` is long and blocks out `A`, `B`, and `D` entirely, so the whole run only ever reaches 3 activities instead of the optimal 4.

`by duration` happens to tie the optimum on this particular input, so a second, smaller example is needed to see it actually lose: on `[(8, 13), (0, 5), (3, 8), (6, 8)]`, sorting by duration picks `(6, 8)` first (it's the shortest interval, duration 2) and then `(8, 13)`, for a count of **2** — but sorting by end time picks `(0, 5)`, `(6, 8)`, `(8, 13)`, for a count of **3**. The shortest activity, `(6, 8)`, happens to end later than `(3, 8)`, so choosing it "because it's short" throws away an end-time advantage that the greedy-by-end rule would never have given up.

The takeaway: "starts earliest" and "shortest" both sound like reasonable proxies for "leaves the most room for the future," but neither one *is* that property — only "ends earliest" is, which is exactly what the greedy-choice proof in Section 3 formalizes.

## 6. Common Mistakes

- **Sorting by start time instead of end time.** This feels natural ("do things in the order they arrive") but has no guarantee of maximizing count — an early-starting, long-running activity can block out several shorter, earlier-ending ones that would together have produced a bigger accepted set.
- **Sorting by duration ("shortest job first") instead of end time.** A short activity can still end later than a slightly longer one, and "ends later" is precisely the property that costs you future opportunities — duration is not a substitute for end time.
- **Forgetting to update `last_end` after accepting an activity.** If `last_end` isn't advanced to the newly accepted activity's end time, subsequent activities get checked against a stale (earlier) boundary and may be wrongly accepted even though they actually conflict with what was just chosen.
- **Using `start > last_end` instead of `start >= last_end`.** Whether back-to-back activities (one ending exactly when the next starts) count as "non-overlapping" is a real modeling decision — get the boundary condition wrong relative to the problem's stated definition and off-by-one errors creep into the accepted count.
- **Re-deriving the greedy rule from "maximize total time used" intuition.** Activity selection maximizes *count*, not total scheduled duration — a different (weighted) objective requires a different algorithm (weighted interval scheduling, typically solved with DP), and greedy-by-end-time does not solve that variant optimally.

## 7. Interview Angle

Interviewers use this problem to check whether a candidate can (a) recognize that sorting order is the crux of the whole solution, and (b) actually justify *why* end time is the right key, rather than just having memorized it. Expect a follow-up like "what if I sort by start time instead — does it still work?", where the expected answer is a counterexample like the one in Section 5, not just "no." A common escalation is the **weighted** variant (each activity has a value, maximize total value of non-overlapping activities), which breaks the simple greedy approach entirely and needs DP (binary search for the latest non-conflicting activity, plus a recurrence) — bringing this up unprompted signals a solid grasp of *why* the greedy works only for the unweighted count version. Another common variant is "minimum number of rooms/resources to run all activities" (interval partitioning), which is a related but distinct problem solved by a sweep over start/end events rather than this selection algorithm.

## 8. Memory Hook

**"End time first, always."** Sort by when things *finish*, not when they *start* or how *long* they take — because "finishes soonest" is the only property that guarantees the most room is left over for everything that comes after.
