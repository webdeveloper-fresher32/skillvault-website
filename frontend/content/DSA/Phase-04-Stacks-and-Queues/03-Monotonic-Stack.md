# Monotonic Stack

## 1. Problem

Consider a stock-price problem: for every day, you want to know the next day on which the price will be *higher* than today's — the "next greater element." The brute-force answer is, for every day, scan forward until you find one: O(n²) in the worst case (imagine prices strictly decreasing every day — every single day scans almost to the end). For a dataset of even modest size, that's too slow, and it's exactly the kind of "obviously correct but obviously slow" solution interviewers expect you to improve on.

The insight that gets this down to O(n) is that most of that repeated forward-scanning is wasted work: once you know element `A` is smaller than some later element `B`, `A` is *permanently* irrelevant to every element that comes after `B`, because `B` will always answer "next greater" for them first (or something even bigger than `B` will). A **monotonic stack** captures exactly this insight — it keeps only the elements that are still "in the running" to be someone's next-greater-answer, discarding the rest the moment they're proven irrelevant.

## 2. Analogy

Picture a line of people of different heights waiting to get their photo taken, and the photographer wants a shot where each person can see the *next* taller person in front of them, but shorter people directly behind a tall person are hidden and don't matter. As people join the line one at a time from the back, imagine you're maintaining a "currently visible" list from front to back: any time a new, taller person joins, everyone shorter who was standing right in front of them becomes permanently blocked and gets removed from the visible list — the new tall person is what they'd have seen anyway (or nothing shorter still matters once someone taller has appeared). What remains in the visible list is always ordered by height, tallest-you'd-encounter-first — a monotonic sequence, maintained incrementally by discarding people who've become irrelevant instead of ever re-checking them.

## 3. Internal Flow

A monotonic stack is a normal stack (Lesson 1's push/pop mechanics) with one added rule enforced on every push: **before pushing the new element, pop everything on top of the stack that violates the desired order** (decreasing for "next greater element," increasing for "next smaller element"). Each element is pushed exactly once and popped at most once, so the total work across the whole array is O(n) even though it "looks like" a nested loop.

For **next greater element** (find, for every index, the value of the next element to its right that's strictly greater — or `-1` if none exists), maintain a stack of *indices* whose corresponding values are strictly decreasing from bottom to top:

1. For the current index `i` with value `num`, while the stack is non-empty and the value at the index on top of the stack is `<` `num`: pop that index — `num` is its "next greater element," so record the answer for it now, since it will never be found again more cheaply.
2. After popping everything that's now resolved, push the current index `i` onto the stack — it becomes the new "waiting for a bigger neighbor" candidate.
3. Any indices still on the stack once the array is fully scanned never found a next-greater element, so their answer is `-1`.

Indices are stored (not raw values) so that the *position* being resolved is known when a pop happens — the algorithm needs to write `result[popped_index] = num`, which is impossible if all you have is the popped value.

## 4. Example

Next greater element, tracing every push and pop:

```python
def next_greater_elements(nums):
    n = len(nums)
    result = [-1] * n
    stack = []  # indices, values at these indices form a decreasing sequence
    for i, num in enumerate(nums):
        while stack and nums[stack[-1]] < num:
            popped_idx = stack.pop()
            result[popped_idx] = num
        stack.append(i)
    return result

nums = [2, 1, 2, 4, 3]
print(next_greater_elements(nums))
```

Traced output (executed exactly as shown):

```
Input: [2, 1, 2, 4, 3]
i=0 num=2: push -> stack(idx)=[0] stack(val)=[2]
i=1 num=1: push -> stack(idx)=[0, 1] stack(val)=[2, 1]
i=2 num=2: pops index 1 (val 1) -> result[1]=2, stack(idx)=[0]
i=2 num=2: push -> stack(idx)=[0, 2] stack(val)=[2, 2]
i=3 num=4: pops index 2 (val 2) -> result[2]=4, stack(idx)=[0]
i=3 num=4: pops index 0 (val 2) -> result[0]=4, stack(idx)=[]
i=3 num=4: push -> stack(idx)=[3] stack(val)=[4]
i=4 num=3: push -> stack(idx)=[3, 4] stack(val)=[4, 3]
Result: [4, 2, 4, -1, -1]
```

Notice at `i=2` (`num=2`): the stack's top is index 0, also holding value `2`. Because the pop condition uses strict `<` (`nums[stack[-1]] < num`, i.e. `2 < 2` is `False`), index 0 is **not** popped yet — equal values don't count as "greater," so index 0 stays on the stack, waiting for something strictly bigger. It only gets popped two steps later, at `i=3`, when `4` finally beats it. This is exactly the strict-vs-non-strict comparison distinction called out below.

## 5. Compare

A monotonic stack is a plain stack (Lesson 1) with an invariant enforced on every push, the same way a monotonic *deque* (Lesson 2) is a plain deque with an invariant enforced — the difference is a monotonic stack only ever discards from one end because every element's "relevance window" is unbounded to the right (nothing ever expires due to distance), whereas a monotonic deque also expires elements from the front once they fall outside a fixed window size. Where the min-stack (next lesson) augments a stack with a *second* stack to answer a different query (running minimum), a monotonic stack needs no second structure — the ordering invariant lives entirely in the one stack it maintains.

## 6. Common Mistakes

- **Pushing values instead of indices when the answer needs positions.** If the problem asks "what is the next greater *value*" and every value is unique, storing bare values can work — but the moment duplicates exist, or the question asks for a *distance* or *index* rather than a value, you need the index on the stack so you know exactly which array position to write the answer for.
- **Using the wrong comparison direction (`>` vs `>=`, or `<` vs `<=`) for duplicates.** Whether the pop condition is strict (`<`) or non-strict (`<=`) changes what happens with equal values, as shown at `i=2` in the trace above — get this backwards and "next greater or equal" silently becomes "next strictly greater" (or vice versa), which usually only breaks on inputs with duplicate values, making the bug easy to miss in testing.
- **Popping in the wrong direction relative to the desired monotonic order.** "Next greater element" needs a decreasing stack (pop while top `<` current); "next smaller element" needs an increasing stack (pop while top `>` current). Mixing these up produces a stack that's monotonic in the wrong direction and answers a completely different question.
- **Forgetting elements left on the stack at the end never found a match.** Any index still on the stack after the loop finishes never satisfied the condition — leaving `result` uninitialized (rather than pre-filled with `-1` or similar) for those indices is a common off-by-omission bug.
- **Re-deriving the invariant on every push instead of maintaining it incrementally.** Some learners re-scan the stack from scratch to "check" the order on every insertion, silently turning the algorithm back into O(n²) and defeating the entire point of the pattern.

## 7. Interview Angle

"Next Greater Element" (and its mirror, "Next Smaller Element") is the canonical monotonic-stack problem and is often the first signal an interviewer uses to see whether you reach for this pattern at all — the giveaway phrase is usually "for each element, find the next/previous element that is greater/smaller." Common variations: "daily temperatures" (how many days until a warmer day — same pattern, but the answer is a *distance* rather than a value, reinforcing why indices matter), "largest rectangle in histogram" (a harder variant using a monotonic increasing stack of indices to find, for each bar, how far it can extend left and right), and "trapping rain water" (solvable with a monotonic stack, though the two-pointer approach is usually cleaner). A typical follow-up once you produce the O(n) solution: "prove it's actually O(n) even though there's a nested loop" — the expected answer is the amortized argument that each element is pushed once and popped at most once, so total pushes + pops is bounded by 2n.

## 8. Memory Hook

**Monotonic stack = pop the losers before you let the winner in.** Every push first evicts whoever the new element beats — index in, value resolved, done — and the direction of the eviction condition (increasing vs decreasing) is the entire difference between "next greater" and "next smaller."
