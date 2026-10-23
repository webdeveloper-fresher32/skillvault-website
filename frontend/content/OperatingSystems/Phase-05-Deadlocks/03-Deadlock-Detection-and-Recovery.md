# Deadlock Detection and Recovery — Complete Guide

## Table of Contents
1. [Why Detection Instead of Prevention?](#1-why-detection-instead-of-prevention)
2. [The Wait-For Graph](#2-the-wait-for-graph)
3. [Detection Algorithm for Single-Instance Resources](#3-detection-algorithm-for-single-instance-resources)
4. [Detection Algorithm for Multi-Instance Resources](#4-detection-algorithm-for-multi-instance-resources)
5. [Recovery Strategies](#5-recovery-strategies)
6. [When to Run Detection](#6-when-to-run-detection)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Detection Instead of Prevention?

Prevention and avoidance (Lesson 02) stop deadlocks from ever happening, at the cost of restricting how resources can be requested, or requiring advance knowledge of maximum needs. Many real systems instead take the opposite bet:

```
Detection & Recovery philosophy:
  "Let deadlocks happen. They should be rare. When one occurs,
   detect it, then recover by killing/rolling back something."

Trade-off:
  + No restrictions on how threads request resources.
  + No need to know resource needs in advance.
  - Requires periodically running a detection algorithm (overhead).
  - Recovery is destructive — something gets killed or rolled back.
```

This is exactly the model relational databases use: MySQL and PostgreSQL let transactions request locks freely, and if a deadlock forms, the database's own detector picks a "victim" transaction and aborts it (see Lesson 04 for the DB-specific tie-in).

---

## 2. The Wait-For Graph

A **wait-for graph (WFG)** is a simplified version of the resource allocation graph from Lesson 01 — it removes the resource nodes entirely and draws a direct edge between processes:

```
P → Q  means  "P is waiting for a resource currently held by Q"
```

You build a WFG from a resource allocation graph by collapsing each `P → R → Q` path (P requests R, R is assigned to Q) into a single edge `P → Q`.

### Example: converting a RAG to a WFG

```
Resource Allocation Graph:              Wait-For Graph:

   P1 ──requests──▶ R1                     P1 ──────▶ P2
   R1 ──assigned───▶ P2
   P2 ──requests──▶ R2
   R2 ──assigned───▶ P1                    P2 ──────▶ P1

Result: P1 → P2 → P1  is a cycle.        Same cycle, resource nodes removed.
```

**The rule: a cycle in the wait-for graph means deadlock exists** (assuming single-instance resources — see Section 4 for the multi-instance case). Detecting deadlock reduces to detecting a cycle in a directed graph, which is a well-known, efficient (O(V+E)) graph algorithm (e.g., DFS with a "currently on recursion stack" marker).

```
        ┌────────────┐
        │            │
        ▼            │
      ┌────┐        ┌────┐
      │ P1 │───────▶│ P2 │
      └────┘        └────┘
        ▲              │
        └──────────────┘

   Cycle: P1 → P2 → P1  →  DEADLOCK DETECTED
```

---

## 3. Detection Algorithm for Single-Instance Resources

When every resource type has exactly one instance (e.g., each is a plain mutex), detection is just cycle detection in the wait-for graph:

```
function has_cycle(wait_for_graph):
    visited = set()
    on_stack = set()

    function dfs(node):
        visited.add(node)
        on_stack.add(node)
        for neighbor in wait_for_graph[node]:
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in on_stack:
                return True   # back edge found -> cycle -> deadlock
        on_stack.remove(node)
        return False

    for node in wait_for_graph:
        if node not in visited:
            if dfs(node):
                return True
    return False
```

This is a textbook DFS cycle detection — if you ever revisit a node that is currently on the active recursion stack, you've found a cycle, and therefore a deadlock.

---

## 4. Detection Algorithm for Multi-Instance Resources

When resources have multiple instances (e.g., a pool of 5 identical DB connections), a cycle alone isn't proof of deadlock — another instance might still be free. The detection algorithm here is structurally identical to the Banker's Algorithm's Safety Algorithm from Lesson 02, but *without* the `Max`/`Need` bookkeeping — it only uses **current** allocation and requests:

```
Given:
  Available[j]      — free instances of resource j right now
  Allocation[i][j]  — instances of resource j currently held by process i
  Request[i][j]     — instances of resource j process i is currently
                       asking for (NOT max future need — just right now)

1. Work = Available (copy).  Finish[i] = false for every process i.
   (Optimization: if Allocation[i] is all zeros, set Finish[i] = true
    immediately — a process holding nothing can't be part of a deadlock.)

2. Find i where Finish[i] == false AND Request[i] <= Work.
   If none exists, go to step 4.

3. Work = Work + Allocation[i]      # pretend i finishes, frees its resources
   Finish[i] = true
   Go back to step 2.

4. If any Finish[i] == false, those processes ARE deadlocked.
   If all Finish[i] == true, there is NO deadlock right now.
```

This is exactly the same shape as the Banker's safety check — the difference is *when* you run it. Avoidance runs this proactively before granting any request (using declared maximums). Detection runs it periodically or reactively (using only current, actual requests) to find deadlocks that have already occurred.

---

## 5. Recovery Strategies

Once detection confirms a deadlock, the system must break it. There's no non-destructive option — some process/thread has to lose progress.

### Strategy 1: Process Termination

```
Option A: Abort ALL deadlocked processes.
  + Simple, guarantees the cycle is broken.
  - Wasteful — all their progress is lost, even processes that were
    almost done.

Option B: Abort ONE process at a time, re-run detection, repeat.
  + Less wasteful — you might only need to kill one process to
    break the cycle.
  - Slower (repeated detection runs), and you must choose WHICH
    process to kill each round.

Victim selection criteria (used by real DB engines too):
  - Lowest priority process
  - Process that has done the least work so far (least to lose)
  - Process holding the fewest resources
  - Process closest to completion is spared (most to lose if killed)
  - Number of resources it holds and how much more it still needs
```

### Strategy 2: Resource Preemption

Instead of killing an entire process, forcibly take a resource away from one of the deadlocked processes and give it to another, allowing that one to proceed.

```
Three sub-problems this raises:

1. Selecting a victim: which process loses its resource? (Same
   criteria as above — cost of losing progress vs. cost of resources held.)

2. Rollback: once you take a resource away, the victim process's
   state may now be invalid. You must roll it back to some earlier
   safe point (often: total rollback — abort and restart from scratch,
   because partial rollback requires the process to have checkpointed
   its own state, which is complex to support in general).

3. Starvation: if the same process is repeatedly picked as the
   victim every time detection runs, it may never make progress.
   Fix: include "number of times rolled back" as a factor in victim
   selection so the same process isn't picked forever.
```

### Comparing recovery strategies

| Strategy | Cost | Precision | Common in |
|----------|------|-----------|-----------|
| Kill all deadlocked processes | High (loses all their work) | Guaranteed to break deadlock | Rarely used in practice |
| Kill one process, re-check | Lower (only kills what's needed) | May require multiple rounds | OS-level, cluster schedulers |
| Preempt a resource + rollback | Depends on rollback cost | Fine-grained | Database transaction managers (see Lesson 04) |

---

## 6. When to Run Detection

Running the detection algorithm has a cost, so systems must decide *how often*:

```
Option 1: Every time a resource request can't be immediately granted.
  + Catches deadlocks the instant they form.
  - Expensive if requests that block are frequent.

Option 2: On a fixed timer (e.g., every N seconds).
  + Bounded, predictable overhead.
  - Deadlock may sit undetected for up to N seconds.

Option 3: When CPU utilization drops (a heuristic signal that
          something might be stuck/blocked).
  + Ties detection cost to a symptom.
  - Indirect — utilization can drop for other reasons too.
```

Real database engines (see Lesson 04) typically use a hybrid: a background thread runs cycle detection on the internal lock-wait graph every fixed interval (e.g., MySQL InnoDB's `innodb_deadlock_detect`), plus a `lock_wait_timeout` as a backstop in case detection itself is disabled or too slow.

---

## 7. Hands-On Exercises

**Exercise 1:** Take the wait-for graph example from Section 2 and extend it to 3 processes (P1 → P2 → P3 → P1). Implement the `has_cycle` DFS function from Section 3 in Python and confirm it returns `True` for this 3-cycle and `False` if you remove the `P3 → P1` edge.

**Exercise 2:** Using the multi-instance detection algorithm from Section 4, construct a numeric example (similar to Lesson 02's Banker's example) with `Available`, `Allocation`, and `Request` matrices where a cycle exists in the naive wait-for graph but the detection algorithm proves there is NO deadlock (because another instance is available). Show the step-by-step trace.

**Exercise 3:** Write a short (5-6 sentence) design note comparing "kill all deadlocked processes" vs "kill one and re-detect" for a hypothetical job-scheduling system running 500 concurrent batch jobs. Which would you pick, and why?

**Exercise 4:** Explain why "always pick the process with the lowest priority as the recovery victim" can lead to starvation, and propose one concrete fix.

**Exercise 5:** Implement the multi-instance detection algorithm from Section 4 as a Python function `detect_deadlock(available, allocation, request)` that returns a list of process indices that are deadlocked (empty list if none).

---

## 8. Interview Q&A

**Q: What is a wait-for graph and how is it derived from a resource allocation graph?**
Answer: A wait-for graph collapses each process-to-resource-to-process path in the resource allocation graph into a single direct edge between processes. If process P requests a resource held by process Q, you draw `P → Q`. Detecting deadlock then reduces to detecting a cycle in this simplified graph — for single-instance resources, a cycle is both necessary and sufficient proof of deadlock.

**Q: How would you detect a deadlock programmatically?**
Answer: For single-instance resources, run a cycle-detection DFS over the wait-for graph — if you revisit a node currently on the recursion stack, you've found a cycle and therefore a deadlock. For multi-instance resources, run an algorithm structurally identical to the Banker's Algorithm's safety check, but using current allocations and current requests (not declared maximums): repeatedly find a process whose current request can be satisfied by available resources, pretend it finishes and frees its resources, and repeat. Any process left un-finished at the end is deadlocked.

**Q: What recovery strategies exist once a deadlock is detected?**
Answer: Two broad categories: process termination (abort all deadlocked processes at once, or abort them one at a time with re-detection in between) and resource preemption (forcibly take a resource from one deadlocked process, roll that process back, and let others proceed). Termination is simpler but wastes more work; preemption is more surgical but requires the ability to safely roll a process back to a valid earlier state, which isn't always feasible.

**Q: How do you choose which process to terminate or preempt during recovery?**
Answer: Common criteria include: process priority (kill low-priority first), how much work/progress the process has already done (kill the one with least to lose), how many resources it currently holds and needs, and how close it is to completion (avoid killing near-finished processes). Real systems also track how many times a process has already been picked as a victim, to avoid starving the same process repeatedly.

**Q: Why might a system choose deadlock detection and recovery over prevention or avoidance?**
Answer: Detection and recovery place no restrictions on how threads request resources and require no advance knowledge of maximum resource needs, unlike prevention (which restricts request patterns) and avoidance (which needs declared maximums). The trade-off is accepting the overhead of periodically running a detection algorithm and the cost of destructive recovery (killing or rolling back a process) when a deadlock does occur. This model fits systems, like database engines, where deadlocks are expected to be rare but resource request patterns are too dynamic to prevent structurally.

**Q: Is a cycle in a wait-for graph always sufficient to declare a deadlock?**
Answer: Only when every resource involved has a single instance. If a resource type has multiple instances, a cycle indicates only a potential deadlock — you must run the full multi-instance detection algorithm (checking if remaining requests can still be satisfied from available instances) to confirm whether processes are actually stuck or whether the cycle can still be resolved because an instance is free elsewhere.
