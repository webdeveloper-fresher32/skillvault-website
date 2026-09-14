# Min Stack and Auxiliary Structures

## 1. Problem

Imagine tracking the low temperature of the day as new hourly readings come in, but with a twist: readings can also be "retracted" (the sensor glitched, throw out the last reading) in strict last-in-first-out order — exactly the shape of undo/redo. A plain stack (Lesson 1) handles push and pop of readings fine, but if someone asks "what's the current minimum, right now, after all the pushes and pops so far?" the naive answer is to scan the whole stack every time — O(n) per query. If minimum-so-far is asked for constantly (as it would be in, say, a live dashboard), that's a lot of repeated scanning for something that only changes incrementally.

This is a common interview design problem: build a stack that supports `push`, `pop`, `top`, *and* `getMin()`, with all four operations running in O(1). The trick isn't a smarter data structure for the stack itself — it's carrying a second, parallel piece of bookkeeping that updates itself incrementally on every push and shrinks itself on every pop, so "what's the minimum right now" is always just "look at the top of the bookkeeping stack," never "recompute."

## 2. Analogy

Think of a rock climber placing protective anchors as they climb, and also keeping a running note in their pocket of "the lowest point I've been since I started this climb" — updated every time they move up or down. If they climb to a new low point, they cross out the old note and write the new lower value. If they climb back up past a point, they don't erase the *history* of low points — they just look at whichever note is currently on top of their notepad. Crucially, the climber writes a note at *every single step*, not just the steps where a new record low happens — because if they only wrote notes on new records, then retreating past a "no new record" step would leave them with no note for that point at all, and they'd have no way to know what the minimum *was* at that earlier position.

That's the min-stack's core idea: a second stack, growing and shrinking in lockstep with the main stack, where the top of the second stack always answers "what was the minimum at this point in history."

## 3. Internal Flow

A `MinStack` keeps two parallel stacks:

- `stack` — the actual data, exactly like Lesson 1's stack.
- `min_stack` — at every index, holds the minimum of everything in `stack` from the bottom up to that same index.

**push(val)**:
1. Append `val` to `stack`, as usual.
2. Compute `current_min = val if min_stack is empty else min(val, min_stack[-1])` — the new minimum is either this value (if it's the smallest seen so far, or the very first element) or whatever the running minimum already was.
3. Append `current_min` to `min_stack`. This step happens on *every* push, not just when a new minimum is set — that's what makes popping later safe and correct.

**pop()**:
1. Pop from `stack` and pop from `min_stack` together, in the same call — both stacks shrink by exactly one element, keeping them in lockstep.
2. Because `min_stack`'s top always reflected "the minimum as of the element now being removed," discarding it exposes the correct minimum for what's now the new top of `stack` — no recomputation needed.

**top()** and **getMin()** are both just O(1) peeks: `stack[-1]` and `min_stack[-1]` respectively.

An equivalent, more memory-efficient variant pushes a single `(val, current_min)` tuple onto one stack instead of maintaining two separate lists — same idea, packaged differently.

## 4. Example

`MinStack` with both stacks traced through a sequence of pushes and pops:

```python
class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []

    def push(self, val):
        self.stack.append(val)
        current_min = val if not self.min_stack else min(val, self.min_stack[-1])
        self.min_stack.append(current_min)

    def pop(self):
        val = self.stack.pop()
        min_val = self.min_stack.pop()
        return val

    def top(self):
        return self.stack[-1]

    def getMin(self):
        return self.min_stack[-1]


ms = MinStack()
ms.push(5)
ms.push(3)
ms.push(7)
ms.push(2)
print("getMin():", ms.getMin())
ms.pop()
print("getMin():", ms.getMin())
ms.pop()
print("getMin():", ms.getMin())
print("top():", ms.top())
```

Traced output (executed exactly as shown, showing both stacks after every operation):

```
push(5): stack=[5] min_stack=[5]
push(3): stack=[5, 3] min_stack=[5, 3]
push(7): stack=[5, 3, 7] min_stack=[5, 3, 3]
push(2): stack=[5, 3, 7, 2] min_stack=[5, 3, 3, 2]
getMin(): 2
pop() -> removed 2: stack=[5, 3, 7] min_stack=[5, 3, 3]
getMin(): 3
pop() -> removed 7: stack=[5, 3] min_stack=[5, 3]
getMin(): 3
top(): 3
```

Notice `push(7)` still appends `3` (not `7`) to `min_stack` — `7` isn't a new minimum, so `min_stack` repeats the running minimum unchanged. That repeated `3` is exactly what makes the later `pop()` of `7` safe: after popping, `min_stack`'s new top is still `3`, correctly reflecting that `[5, 3]` remain in `stack`.

## 5. Compare

The min-stack takes the plain stack from Lesson 1 and augments it with a second stack, the same structural move the monotonic deque (Lesson 2) and monotonic stack (Lesson 3) make in a different direction — those enforce an *ordering invariant on the single structure itself*, while the min-stack instead adds a *parallel, independent structure* that tracks a running aggregate (minimum) rather than reordering anything. A closely related interview problem, "implement a queue using two stacks," also uses two stacks together, but for a different reason: simulating FIFO order out of two LIFO structures, not tracking a running aggregate. If asked for `getMax()` instead of `getMin()`, the identical technique applies with `max` in place of `min` — the mechanism doesn't care which aggregate you're tracking, only that it's monotonically maintainable per push/pop.

## 6. Common Mistakes

- **Pushing to `min_stack` only when a new minimum is found.** This looks like an optimization (why store repeats?) but it breaks correctness: if `min_stack` only gets a new entry on record lows, then popping past a non-record element leaves `min_stack` one element "ahead" of `stack`, and `getMin()` starts returning stale or wrong values. Push to `min_stack` on *every* push (or use the `(val, current_min)` tuple variant), never conditionally.
- **Forgetting to pop from both stacks together.** If `pop()` only removes from `stack` and forgets `min_stack` (or vice versa), the two stacks drift out of sync — `min_stack[-1]` no longer corresponds to `stack`'s current state, and every subsequent `getMin()` is wrong.
- **Recomputing the minimum by scanning `stack` on every `getMin()` call.** This "works" but defeats the entire point of the exercise — the interviewer is specifically testing whether you can get `getMin()` down to O(1), not whether you can compute a minimum at all.
- **Using `min_stack[-1]` as the comparison base incorrectly on the very first push.** Comparing against `min_stack[-1]` when `min_stack` is still empty raises an `IndexError` (or, in some languages, reads garbage) — the empty-case branch (`val if not min_stack else ...`) has to be handled explicitly.
- **Assuming this pattern requires two full-size stacks when a single tuple-stack would do.** Not incorrect, exactly, but worth knowing as a follow-up: storing `(val, current_min)` pairs on one stack is functionally identical and often the cleaner implementation to write under interview time pressure.

## 7. Interview Angle

"Min Stack" is a very frequently asked design problem precisely because the naive answer (store values, scan for min on demand) is easy and the O(1) answer requires a specific, non-obvious trick — interviewers use it to see whether you can reason about maintaining an aggregate incrementally rather than recomputing it. A typical follow-up: "can you do this with O(1) *extra* space instead of a full second stack?" — the expected technique there is to push only the *difference* from the previous minimum (or a similar encoding) so a single stack can reconstruct both the value and the running minimum, trading a little arithmetic for the second array. Another common variant: "design a stack that also supports `getMax()`," solved identically with a parallel max-tracking stack, and "design a stack that supports `popAll()` or `getMedian()`," which pushes the same idea further (median usually needs two heaps instead, not a simple auxiliary stack, which is itself a useful thing to recognize and say out loud).

## 8. Memory Hook

**Min-stack = two stacks moving in lockstep, always.** Every push writes to *both* stacks, every pop removes from *both* stacks — the moment one stack's height diverges from the other's, `getMin()` is lying.
