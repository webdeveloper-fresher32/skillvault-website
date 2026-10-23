# What is a Deadlock — Complete Guide

## Table of Contents
1. [The Problem in Plain English](#1-the-problem-in-plain-english)
2. [The 4 Necessary Conditions](#2-the-4-necessary-conditions)
3. [A Real Deadlock in Python](#3-a-real-deadlock-in-python)
4. [Resource Allocation Graphs](#4-resource-allocation-graphs)
5. [Deadlock vs Starvation vs Livelock](#5-deadlock-vs-starvation-vs-livelock)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem in Plain English

A **deadlock** is a situation where two or more threads/processes are each waiting for a resource held by another member of the same group, and none of them can ever proceed.

```
Thread A holds Lock 1, wants Lock 2
Thread B holds Lock 2, wants Lock 1

A: "I'll give up Lock 1 once I get Lock 2"
B: "I'll give up Lock 2 once I get Lock 1"

Both wait forever. Nobody moves. This is a deadlock.
```

Classic real-world analogy — two cars facing each other on a single-lane bridge, each waiting for the other to reverse first. Neither will, so both sit there forever.

In software this shows up as: a web request that never returns, a database transaction that hangs until a timeout, or a service that looks "stuck" but isn't crashed — it's just waiting on something that will never happen.

---

## 2. The 4 Necessary Conditions

A deadlock can only happen if **all four** of these conditions hold *simultaneously*. This is known as the **Coffman conditions** (1971). Remove any one of them and deadlock becomes impossible — this is the entire basis of prevention strategies in Lesson 02.

| # | Condition | Meaning |
|---|-----------|---------|
| 1 | **Mutual Exclusion** | At least one resource is held in a non-shareable mode — only one thread can use it at a time. |
| 2 | **Hold and Wait** | A thread holds at least one resource while simultaneously waiting to acquire additional resources held by others. |
| 3 | **No Preemption** | A resource can only be released voluntarily by the thread holding it — the OS/runtime cannot forcibly take it back. |
| 4 | **Circular Wait** | There exists a cycle of threads T1 → T2 → ... → Tn → T1, where each thread is waiting for a resource held by the next. |

### Walking through them with locks

```
1. Mutual Exclusion:  A mutex, by definition, can only be held by one thread. ✓ always true for locks.
2. Hold and Wait:      Thread A acquires Lock 1, then — while still holding it — tries to acquire Lock 2.
3. No Preemption:      The OS cannot yank Lock 1 away from Thread A to give it to someone else.
4. Circular Wait:      Thread A wants Lock 2 (held by B); Thread B wants Lock 1 (held by A). A cycle.
```

Note condition 4 (circular wait) is actually a *consequence* that becomes possible once 1–3 hold and the lock acquisition order is inconsistent across threads. That's why "always acquire locks in the same order" (Lesson 04) is such an effective fix — it directly prevents circular wait without touching the other three conditions.

---

## 3. A Real Deadlock in Python

Below is a complete, runnable program that reliably deadlocks two threads by acquiring two locks in **opposite order**.

```python
"""
deadlock_demo.py

Demonstrates a classic two-lock deadlock:
  Thread A: acquires lock_1, then tries to acquire lock_2
  Thread B: acquires lock_2, then tries to acquire lock_1

Run it: python3 deadlock_demo.py
Expect: the program prints the first two "acquired" lines and then
        hangs forever (Ctrl+C to kill it). That hang IS the deadlock.
"""

import threading
import time

lock_1 = threading.Lock()
lock_2 = threading.Lock()


def thread_a():
    print("[Thread A] trying to acquire lock_1")
    with lock_1:
        print("[Thread A] acquired lock_1")
        time.sleep(0.5)  # gives Thread B time to grab lock_2 first

        print("[Thread A] trying to acquire lock_2")
        with lock_2:  # BLOCKS here forever — B already holds lock_2 and wants lock_1
            print("[Thread A] acquired lock_2")


def thread_b():
    print("[Thread B] trying to acquire lock_2")
    with lock_2:
        print("[Thread B] acquired lock_2")
        time.sleep(0.5)  # gives Thread A time to grab lock_1 first

        print("[Thread B] trying to acquire lock_1")
        with lock_1:  # BLOCKS here forever — A already holds lock_1 and wants lock_2
            print("[Thread B] acquired lock_1")


if __name__ == "__main__":
    t1 = threading.Thread(target=thread_a)
    t2 = threading.Thread(target=thread_b)

    t1.start()
    t2.start()

    t1.join()  # never returns
    t2.join()  # never reached

    print("Both threads finished — this line never prints")
```

### What happens, step by step

```
Time  Thread A                          Thread B
----  --------------------------------  --------------------------------
t0    acquires lock_1                   acquires lock_2
t1    sleeps 0.5s                       sleeps 0.5s
t2    tries to acquire lock_2 → BLOCKS  tries to acquire lock_1 → BLOCKS
t3    ... waiting forever ...           ... waiting forever ...
```

All 4 Coffman conditions are present:
1. **Mutual exclusion** — each `threading.Lock()` can only be held by one thread.
2. **Hold and wait** — A holds `lock_1` while waiting for `lock_2`; B holds `lock_2` while waiting for `lock_1`.
3. **No preemption** — Python's `threading` module has no mechanism to forcibly strip a lock from a thread.
4. **Circular wait** — A → waits on B → waits on A. A cycle of exactly length 2.

This program never terminates; you must interrupt it manually (`Ctrl+C`). Lesson 04 shows the fix (consistent lock ordering) for this exact example.

---

## 4. Resource Allocation Graphs

A **Resource Allocation Graph (RAG)** is the standard way operating systems textbooks (and interviewers) visualize who holds what and who's waiting for what.

**Notation:**
- Circles = processes/threads (`P1`, `P2`, ...)
- Squares = resources (`R1`, `R2`, ...)
- `P → R` arrow = process P is **requesting** resource R (a "request edge")
- `R → P` arrow = resource R is **currently assigned to** process P (an "assignment edge")

### No deadlock — no cycle

```
   P1 ──assigned──▶ (holds R1)      R1 ── assigned to ──▶ P1
   P1 ──requests──▶ R2               R2 is free, nobody holds it

        R1                R2
        │                 ▲
   assigned to        (free, no
        │              one holds it)
        ▼
       P1 ────requests────▶ R2

   No cycle → system can eventually grant R2 to P1. No deadlock.
```

### Deadlock — a cycle exists

This is the RAG for the exact Python example above (`lock_1` = R1, `lock_2` = R2, threads A and B):

```
        ┌────────────────────────────┐
        │                            │
        ▼                            │
   ┌─────────┐  assigned to    ┌─────────┐
   │   R1    │ ───────────────▶│   P_A   │
   │ (lock_1)│                 │ (Thread │
   └─────────┘                 │    A)   │
        ▲                      └─────────┘
        │ requests                   │
        │                            │ requests
   ┌─────────┐                       ▼
   │   P_B   │◀──────assigned to─────┐
   │ (Thread │                 ┌─────────┐
   │    B)   │                 │   R2    │
   └─────────┘                 │ (lock_2)│
                                └─────────┘

Cycle:  R1 → P_A → R2 → P_B → R1
```

Simplified as a pure wait-for cycle between the two threads:

```
   ┌────────▶ P_A ────────┐
   │        (holds R1,     │
   │         wants R2)     ▼
   P_B                    (waiting on B)
   (holds R2,               │
    wants R1)  ◀────────────┘

   P_A waits for P_B, P_B waits for P_A → CYCLE → DEADLOCK
```

**Key rule for single-instance resources** (like a mutex, where only one thread can hold it): a cycle in the RAG is **necessary and sufficient** for deadlock. If every resource has only one instance, "cycle exists" ⟺ "deadlock exists." (For resources with multiple instances — e.g., a pool of 5 DB connections — a cycle is necessary but not always sufficient; you'd need to check if the cycle actually starves out all requests. This is covered further in Lesson 03.)

---

## 5. Deadlock vs Starvation vs Livelock

Interviewers love probing whether you can tell these apart:

| Term | Description | Threads making progress? |
|------|-------------|---------------------------|
| **Deadlock** | Threads are blocked waiting on each other in a cycle — permanently frozen. | No — total freeze. |
| **Starvation** | A thread never gets scheduled/granted a resource because others keep jumping the queue (e.g., unfair lock, priority scheduling always favoring others). | Other threads progress; the starved one never does. |
| **Livelock** | Threads are actively running (not blocked) but keep changing state in response to each other without making real progress — e.g., two people repeatedly stepping aside for each other in a hallway. | Yes, but no useful work happens. |

---

## 6. Hands-On Exercises

**Exercise 1:** Run `deadlock_demo.py` from Section 3 exactly as written. Confirm it hangs after printing 4 lines. Use `Ctrl+C` to stop it, and identify which two lines never printed.

**Exercise 2:** Modify `deadlock_demo.py` to add a third lock (`lock_3`) and a third thread (`thread_c`) such that `A → wants lock_2`, `B → wants lock_3`, `C → wants lock_1` (a 3-way circular wait). Draw the resource allocation graph for your new version on paper before running it.

**Exercise 3:** Remove the `time.sleep(0.5)` calls from both `thread_a` and `thread_b`. Run the program 10 times in a row. Does it deadlock every time? Explain in a sentence why the sleep makes the deadlock reliable versus just "possible."

**Exercise 4:** Using the RAG notation from Section 4, draw the graph for a scenario with 2 processes and 2 resources where **no** deadlock occurs, even though both processes want both resources (hint: think about acquisition order).

**Exercise 5:** In your own words (3-4 sentences), explain why removing just the "hold and wait" condition would have prevented the deadlock in `deadlock_demo.py`, without changing mutual exclusion, preemption, or circular wait at all.

---

## 7. Interview Q&A

**Q: What are the four necessary conditions for a deadlock?**
Answer: Mutual exclusion (a resource can only be held by one thread at a time), hold and wait (a thread holds one resource while waiting for another), no preemption (resources can't be forcibly taken away — only released voluntarily), and circular wait (a cycle of threads each waiting on the next). All four must hold simultaneously for a deadlock to occur; breaking any single one makes deadlock impossible.

**Q: Can you write code that demonstrates a real deadlock?**
Answer: Yes — the classic example is two threads acquiring two locks in opposite order: Thread A acquires `lock_1` then tries `lock_2`; Thread B acquires `lock_2` then tries `lock_1`. If both threads get their first lock before either tries for the second, they block on each other forever. Adding a small `sleep()` between acquisitions makes this reliably reproducible instead of just occasionally possible.

**Q: What is a resource allocation graph and how do you use it to detect deadlock?**
Answer: A RAG models processes as circles and resources as squares, with request edges (process → resource) and assignment edges (resource → process). For resources with a single instance each, a cycle in the graph is both necessary and sufficient proof of deadlock. For resources with multiple instances, a cycle is necessary but not always sufficient — you have to verify no instance can be freed to break the cycle.

**Q: What is the difference between deadlock and starvation?**
Answer: In a deadlock, all involved threads are permanently blocked — nobody makes progress. In starvation, other threads continue to make progress, but one specific thread is perpetually denied the resource it needs (e.g., due to unfair scheduling always favoring others). Deadlock is a total system freeze for the affected threads; starvation is an unfairness problem where the system as a whole keeps moving.

**Q: Why does acquiring locks in different orders across threads cause deadlocks?**
Answer: If thread A always locks resources in order [1, 2] and thread B always locks in order [2, 1], there's a window where A holds 1 and wants 2, while B holds 2 and wants 1 — a circular wait. If every thread acquired locks in the same global order (e.g., always lock the lower-numbered resource first), this cycle becomes structurally impossible, because whichever thread gets the first lock in the order will always be able to get the second one without competing with a thread that already holds it.

**Q: Is a cycle in the resource allocation graph always a deadlock?**
Answer: Only when each resource type has exactly one instance. With single-instance resources, cycle ⟺ deadlock. With multi-instance resources (e.g., a connection pool of 5), a cycle indicates a *potential* deadlock but not a guaranteed one — it's possible another instance of the resource is available and can be granted, breaking the cycle without external intervention. Full detection algorithms (Lesson 03) account for this using an "unmarked/reducible" node analysis.
