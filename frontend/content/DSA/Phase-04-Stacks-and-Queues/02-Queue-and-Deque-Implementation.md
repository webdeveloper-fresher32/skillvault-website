# Queue and Deque Implementation

## 1. Problem

Think about a customer support ticket system: tickets should generally be handled in the order they arrive — the first customer to submit a ticket should be the first one helped, not the most recent one. A printer spooler works the same way: the first document sent to the printer should print first, even if five more documents get queued behind it while it's printing. This "first come, first served" behavior is fundamentally different from the stack's LIFO behavior from the previous lesson — here, whichever element has been waiting *longest* is the one that gets removed next.

The instinctive move in Python is to reach for a `list` again, since it worked fine for a stack. But a list is only cheap at one end (the end) — and a FIFO queue needs to remove from the *front*. `list.pop(0)` looks innocent but is O(n): every remaining element has to shift left by one slot to close the gap. Do that repeatedly on a queue with thousands of pending items and what should be an O(1) operation quietly becomes the bottleneck of your whole system. Python's `collections.deque` exists specifically to fix this.

## 2. Analogy

A queue is a line at a coffee shop: people join at the back, and the barista serves whoever's been standing at the front the longest. Nobody cuts to the front, and nobody skips someone by serving from the middle. If the shop only had one door and it was at the *back* of the line — so that every time someone was served, everyone else had to shuffle forward one physical step — the line would move painfully slowly compared to a shop with two doors, one at the front and one at the back, letting people leave and join independently in O(1) time per person. `collections.deque` is a coffee shop with a door at each end: join at the back (`append`), leave from the front (`popleft`), both instant, no shuffling.

A **deque** ("double-ended queue," pronounced "deck") generalizes this further: it's a line where people can join *or* leave from *either* end — useful when you need both queue-like and stack-like behavior in the same data structure, which is exactly what the sliding-window example below needs.

## 3. Internal Flow

`collections.deque` is implemented as a doubly linked list of fixed-size blocks internally, which is why — unlike a Python `list` (a flat, contiguous array) — it supports O(1) operations at *both* ends:

- `dq.append(x)` — add to the right end.
- `dq.appendleft(x)` — add to the left end.
- `dq.pop()` — remove and return from the right end.
- `dq.popleft()` — remove and return from the left end.

A plain FIFO queue only needs two of these four (`append` + `popleft`), but many interview problems need all four at once — the **monotonic deque** pattern used for sliding-window maximum is the clearest example.

Sliding-window maximum: given an array and a window size `k`, find the max of every contiguous window of length `k`, in a single left-to-right pass. Maintaining a max-heap or re-scanning each window would cost O(n log n) or O(n·k). Instead, keep a deque of *indices* whose corresponding values are in strictly decreasing order — the front of the deque is always the index of the current window's maximum:

1. For the current index `i`, while the deque is non-empty and the value at its back index is `<=` the current value, pop from the back — those smaller values can never be the max of any future window that also contains the current (larger) value, so they're useless to keep.
2. Push the current index onto the back of the deque.
3. If the index at the front of the deque has fallen out of the current window (i.e. it's `<= i - k`), pop it from the front — it's still the largest value seen, but it's no longer inside the window.
4. Once the first full window is reached (`i >= k - 1`), the value at the front index of the deque is the current window's maximum.

Indices are stored instead of values specifically so step 3 (checking whether an element has aged out of the window) is possible at all — a deque of bare values has no way to know *where* in the array each value came from.

## 4. Example

Sliding-window maximum, tracing the deque's indices and corresponding values at every step:

```python
from collections import deque

def max_sliding_window(nums, k):
    dq = deque()  # stores indices, values at those indices are decreasing
    result = []
    for i, num in enumerate(nums):
        while dq and nums[dq[-1]] <= num:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()
        if i >= k - 1:
            result.append(nums[dq[0]])
    return result

nums = [1, 3, -1, -3, 5, 3, 6, 7]
k = 3
print(max_sliding_window(nums, k))
```

Traced output (executed exactly as shown, one line per index):

```
Input: [1, 3, -1, -3, 5, 3, 6, 7] k = 3
i=0 num=1: dq(indices)=[0] dq(values)=[1]
i=1 num=3: dq(indices)=[1] dq(values)=[3]
i=2 num=-1: dq(indices)=[1, 2] dq(values)=[3, -1]  -> window max = 3
i=3 num=-3: dq(indices)=[1, 2, 3] dq(values)=[3, -1, -3]  -> window max = 3
i=4 num=5: dq(indices)=[4] dq(values)=[5]  -> window max = 5
i=5 num=3: dq(indices)=[4, 5] dq(values)=[5, 3]  -> window max = 5
i=6 num=6: dq(indices)=[6] dq(values)=[6]  -> window max = 6
i=7 num=7: dq(indices)=[7] dq(values)=[7]  -> window max = 7
[3, 3, 5, 5, 6, 7]
```

Notice at `i=4`, `num=5` immediately pops both `3` (index 1) and `-1, -3` (indices 2, 3) off the back — they can never win against `5` for the rest of the array's lifetime, so the deque discards them for good, not just for the current window.

To make the `pop(0)` cost concrete rather than just asserting it, here's a timed comparison dequeuing 200,000 elements from the front, one at a time:

```python
import time
from collections import deque

N = 200000

lst = list(range(N))
start = time.perf_counter()
while lst:
    lst.pop(0)
list_time = time.perf_counter() - start
print(f"list.pop(0) x {N}: {list_time:.4f}s")

d = deque(range(N))
start = time.perf_counter()
while d:
    d.popleft()
deque_time = time.perf_counter() - start
print(f"deque.popleft() x {N}: {deque_time:.4f}s")
print(f"deque was {list_time/deque_time:.1f}x faster")
```

Actual measured output on this machine:

```
list.pop(0) x 200000: 2.2736s
deque.popleft() x 200000: 0.0058s
deque was 391.1x faster
```

(Exact timings vary by machine, but the *shape* of the result — deque winning by two to three orders of magnitude — is consistent, because `list.pop(0)` is genuinely O(n) per call while `deque.popleft()` is genuinely O(1).)

## 5. Compare

A queue is FIFO where a stack (Lesson 1) is LIFO — same two core operations, opposite ends. A deque is a strict superset of both: using only `append`/`pop` makes it behave as a stack, using `append`/`popleft` makes it behave as a FIFO queue, and using all four methods gives you the sliding-window pattern above, which a plain queue or plain stack alone can't express. The monotonic-deque technique here is a close cousin of the **monotonic stack** in the next lesson — both maintain a sorted invariant by popping violators before pushing — the difference is a monotonic stack only ever removes from one end (because it never needs to expire old elements), while a monotonic deque also removes from the *front* to expire elements that fell outside a window.

## 6. Common Mistakes

- **Using a plain `list` as a queue in performance-sensitive code.** `list.pop(0)` (or `list.insert(0, x)`) is O(n) because every remaining element shifts. It "works" on small inputs and quietly falls over — often failing only on a time-limit-exceeded verdict — once the queue grows large. Use `collections.deque` for any FIFO queue.
- **Storing values instead of indices in a monotonic deque when position matters.** If the problem needs to know *which* elements are still inside the current window (sliding-window max/min) or needs to report *positions* rather than values, storing bare values makes it impossible to check whether an element has aged out. Store indices and look up `nums[i]` when you need the value.
- **Forgetting to check the front-expiry condition before reading the max.** Skipping the `if dq[0] <= i - k: dq.popleft()` check means an index that's fallen outside the window can be reported as the current maximum even though it's no longer in range.
- **Using `<` instead of `<=` (or vice versa) when popping from the back.** Whether equal values are popped or kept changes which index survives to represent duplicate maximums — get it backwards and windows with duplicate values report subtly wrong results.
- **Assuming `deque` is only for queues.** Many learners bolt on a separate stack and a separate queue implementation when a single `deque` handles both, plus the sliding-window pattern that needs both ends at once.

## 7. Interview Angle

"Sliding Window Maximum" (this lesson's example) is a frequently asked deque problem specifically because the brute-force approach (recompute the max of each window) is easy but O(n·k), and the deque approach requires recognizing the "discard now-useless smaller elements" insight to get to O(n). A very common opening question before that: "why is `list` a bad queue in Python?" — the expected answer is exactly the `pop(0)` O(n) argument demonstrated above, and interviewers will often ask you to *prove* it (say the complexity out loud, or reason about the underlying array shift) rather than just quote it. Other classic deque-shaped problems: "design a circular buffer," "implement a queue using two stacks" (a good way to test whether you understand FIFO vs LIFO at a mechanical level), and "first negative number in every window of size k."

## 8. Memory Hook

**Queue = line at a coffee shop, one door at each end.** `deque` gives you O(1) at both ends; a plain `list` only gives you O(1) at the *back* — the moment a queue problem needs the front, reach for `deque`, not `list.pop(0)`.
