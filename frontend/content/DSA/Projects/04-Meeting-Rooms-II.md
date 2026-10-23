# Meeting Rooms II

## Problem Statement

Given an array of meeting time intervals `intervals[i] = [start_i, end_i]`, find the **minimum number of conference rooms required** so that no two overlapping meetings share a room.

Example: `[[0,30],[5,10],[15,20]]` → `2`. The meeting `[0,30]` overlaps both `[5,10]` and `[15,20]`, so at least one extra room is needed for those two — but `[5,10]` and `[15,20]` don't overlap each other, so they can share that second room across time. `[[7,10],[2,4]]` → `1`, since the two meetings don't overlap at all.

## Approach Discussion

The instinct to sort by start time comes from **greedy interval scheduling** (`DSA/Phase-10-Greedy-and-Backtracking/01-Interval-Scheduling-and-Activity-Selection.md`): process meetings in the order they begin, and make the locally-optimal choice at each step — reuse an existing room if possible, only allocate a new one if forced to. The greedy choice here is provably safe because processing in start-time order means, by the time a meeting begins, every room's "current" meeting is the one most likely to have already finished (rooms are freed in a predictable order relative to processing order).

The part greedy alone doesn't solve is: *which* room to check for reuse, efficiently. Naively, you'd scan every currently-occupied room's end time to find one that's already finished — that's O(k) per meeting where `k` is the number of rooms in use. What's actually needed is always "the room whose meeting ends soonest" — because if even the earliest-ending room hasn't freed up yet, no other occupied room has either. "Repeatedly retrieve the minimum" in O(log k) is exactly what a **min-heap** provides (`DSA/Phase-07-Heaps-and-Priority-Queues/01-Heap-Operations-and-Heapify.md`): push each room's end time onto the heap, and the top of the heap is always the earliest-ending (soonest-to-free) room.

So the combined algorithm: sort meetings by start time (greedy ordering), then for each meeting, peek the min-heap of end times — if the smallest end time is `<=` the current meeting's start time, that room is free, pop it (reuse), and push the new meeting's end time; otherwise no room is free, so push the new end time as a brand-new room without popping. The heap's final size at the end is the answer — it's the maximum number of rooms that were ever simultaneously occupied.

## Solution

```python
import heapq


def min_meeting_rooms(intervals):
    if not intervals:
        return 0

    intervals.sort(key=lambda pair: pair[0])
    end_times_heap = []  # min-heap of currently-in-use rooms' end times

    for start, end in intervals:
        if end_times_heap and end_times_heap[0] <= start:
            heapq.heappop(end_times_heap)
        heapq.heappush(end_times_heap, end)

    return len(end_times_heap)


if __name__ == "__main__":
    print(min_meeting_rooms([[0, 30], [5, 10], [15, 20]]))  # expect 2
    print(min_meeting_rooms([[7, 10], [2, 4]]))              # expect 1
    print(min_meeting_rooms([[1, 5], [5, 10], [4, 8]]))      # expect 2
```

**Actual output when run:**

```
2
1
2
```

The first case matches the classic LeetCode 253 example (2 rooms needed). The second case has two fully disjoint meetings, needing only 1 room. The third case shows a boundary detail: `[1,5]` and `[5,10]` touch at `t=5` and are treated as non-overlapping (a room freed at `5` can host a meeting starting at `5`), but `[4,8]` genuinely overlaps both, forcing a second room.

## Complexity

- **Time**: O(n log n) — sorting the intervals is O(n log n), and each of the `n` meetings does at most one heap push and one heap pop, each O(log n).
- **Space**: O(n) — the heap holds at most one end time per currently-active room, bounded by `n` in the worst case (all meetings overlap).
