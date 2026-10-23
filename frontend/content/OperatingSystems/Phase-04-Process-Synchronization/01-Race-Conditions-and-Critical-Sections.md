# Race Conditions and Critical Sections — Complete Guide

## Table of Contents
1. [What is a Race Condition?](#1-what-is-a-race-condition)
2. [A Concrete Broken Example](#2-a-concrete-broken-example)
3. [Why It Happens: The Interleaving](#3-why-it-happens-the-interleaving)
4. [Critical Sections](#4-critical-sections)
5. [Requirements for a Correct Solution](#5-requirements-for-a-correct-solution)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is a Race Condition?

A **race condition** happens when two or more threads access shared data at the same time, and the final result depends on the unpredictable order (the "race") in which their instructions get interleaved by the CPU scheduler.

```
Thread A and Thread B both want to update the SAME variable.

  Without coordination:
    "Whoever gets scheduled last wins, and it's different every run."

  The bug is invisible in code review because each line looks correct
  in isolation — it only breaks when you run it with real concurrency,
  and often only "sometimes" (a heisenbug).
```

Race conditions are dangerous precisely because they are **non-deterministic** — the same code can pass 999 times and silently corrupt data on the 1000th run, usually in production, under load, never on your laptop.

---

## 2. A Concrete Broken Example

Here's the textbook race condition: two threads incrementing a shared counter.

```python
import threading

counter = 0

def increment():
    global counter
    for _ in range(100_000):
        counter += 1   # looks atomic. it is NOT.

threads = [threading.Thread(target=increment) for _ in range(2)]

for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"Expected: 200000")
print(f"Actual:   {counter}")
```

Run this a few times. You will almost never see `200000`. A typical result looks like:

```
Expected: 200000
Actual:   138472
```

The number is different (and wrong) nearly every time you run it.

### Why `counter += 1` is not atomic

`counter += 1` looks like a single operation, but the Python interpreter (and the CPU underneath it) actually performs three separate steps:

```
counter += 1  compiles roughly to:

  1. READ   temp = counter        # load current value
  2. MODIFY temp = temp + 1       # add 1
  3. WRITE  counter = temp        # store it back
```

Any of these three steps can be interrupted by the OS scheduler switching to another thread.

---

## 3. Why It Happens: The Interleaving

Imagine `counter` starts at `10`, and both Thread A and Thread B run `counter += 1` at "the same time." A correct, non-interleaved execution would produce `12`. But the scheduler can interleave the three sub-steps like this:

```
Time  Thread A                 Thread B                 counter
----  -----------------------  -----------------------  -------
t0    READ  temp_A = counter                             10
t1                              READ  temp_B = counter    10
t2    MODIFY temp_A = 11                                  10
t3                              MODIFY temp_B = 11        10
t4    WRITE counter = temp_A                              11
t5                              WRITE counter = temp_B    11   <-- LOST UPDATE!
```

Both threads incremented, but the counter only went up by **1** instead of **2**. Thread A's update was silently overwritten by Thread B, because Thread B read the value *before* Thread A finished writing. This is called a **lost update** — the most common race condition pattern.

With 100,000 iterations across 2 threads, this lost-update pattern happens thousands of times, which is why the final count is far below 200,000.

---

## 4. Critical Sections

The block of code that touches shared data — the part that must NOT be executed by more than one thread at the same time — is called the **critical section**.

```
def increment():
    for _ in range(100_000):
        # ---- critical section starts ----
        counter += 1
        # ---- critical section ends ----
```

A program with shared, mutable state is typically structured like this:

```
┌────────────────────────────────────────────┐
│  entry section   → "may I enter?"           │
├────────────────────────────────────────────┤
│  critical section → touches shared data     │  ← only ONE thread at a time
├────────────────────────────────────────────┤
│  exit section    → "I'm done, release it"   │
├────────────────────────────────────────────┤
│  remainder section → unrelated work         │
└────────────────────────────────────────────┘
```

Synchronization is entirely about controlling entry into the critical section. If only one thread can be inside it at any given moment, the interleaving from Section 3 becomes impossible.

---

## 5. Requirements for a Correct Solution

Any correct solution to the critical section problem (mutex, semaphore, or otherwise) must satisfy three properties:

| Requirement | Meaning |
|-------------|---------|
| **Mutual Exclusion** | If one thread is inside the critical section, no other thread may be inside it at the same time. |
| **Progress** | If no thread is in the critical section and some threads want to enter, the decision of who goes next cannot be postponed forever — threads not in their remainder section must eventually be allowed to proceed. |
| **Bounded Waiting** | There must be a limit on how many times other threads are allowed to enter the critical section after a thread has requested entry and before that request is granted — no thread should starve forever. |

```
Mutual Exclusion  →  correctness (no data corruption)
Progress          →  liveness (system doesn't deadlock/stall)
Bounded Waiting   →  fairness (no thread starves indefinitely)
```

A solution that provides mutual exclusion but not bounded waiting is still "correct" in the sense that data won't corrupt, but a thread could theoretically wait forever while others repeatedly cut in line — a real problem in production systems under contention. Interviewers frequently ask you to name all three, not just mutual exclusion.

---

## 6. Hands-On Exercises

**Exercise 1:** Run the broken counter example above 5 times. Record the final `counter` value each time. Confirm it's different (and wrong) each run.

**Exercise 2:** Change the loop count from `100_000` to `10` and re-run several times. Does the race condition still show up? Why does a smaller iteration count make the bug harder to observe?

**Exercise 3:** Add a `time.sleep(0)` right after the `READ` step (hint: rewrite `counter += 1` as `temp = counter; time.sleep(0); counter = temp + 1`) to force more interleaving. Observe how much worse the final count gets.

**Exercise 4:** Identify the critical section in a login flow that does "check if username exists, then insert new user." Explain what race condition could occur if two identical signup requests arrive at the same time.

**Exercise 5:** Write down, in your own words, one real production incident (or a hypothetical one) that a lost-update race condition could cause in an e-commerce checkout ("stock count" or "order total") system.

---

## 7. Interview Q&A

**Q: What is a race condition?**
Answer: A race condition occurs when the correctness of a program depends on the relative timing or interleaving of multiple threads/processes accessing shared data. Because the OS scheduler can interleave instructions unpredictably, the outcome varies between runs, and can silently produce corrupted or incorrect results.

**Q: Why isn't `counter += 1` atomic, even though it looks like one line of code?**
Answer: It compiles down to at least three separate machine-level steps — read the current value into a register, add 1, and write the result back to memory. The thread can be preempted between any of these steps, allowing another thread to read a stale value, leading to a "lost update" where one thread's increment is overwritten.

**Q: What is a critical section?**
Answer: The critical section is the portion of code that accesses shared, mutable state and therefore must be executed by only one thread at a time to avoid race conditions. It's typically wrapped with an "entry section" (request access) and "exit section" (release access).

**Q: What three requirements must any solution to the critical section problem satisfy?**
Answer: Mutual exclusion (only one thread in the critical section at a time), progress (the system doesn't stall forever when threads want to enter and none currently is), and bounded waiting (a thread requesting entry is guaranteed to get in within a bounded number of other threads' turns — no starvation).

**Q: Why do race conditions often go unnoticed in testing but show up in production?**
Answer: Race conditions depend on precise timing and thread interleaving, which is rare with light load or single-threaded test runs. Under production load — more threads, more contention, more context switches — the "bad" interleaving becomes statistically likely, so the bug appears only under real concurrency, often intermittently (a "heisenbug").

**Q: What is a "lost update"?**
Answer: A lost update happens when two threads read the same shared value, both compute a new value based on that stale read, and then both write back — the second write overwrites the first, so one thread's update is silently lost even though both threads "successfully" ran.

**Q: Does adding more CPU cores make race conditions worse, better, or unrelated?**
Answer: More cores generally make race conditions more likely and more severe, because true parallel execution (not just interleaved single-core scheduling) increases the chance of two threads executing critical-section instructions at the exact same instant, in addition to the scheduler-driven interleaving that already exists on a single core.
