# Project 2 — Dining Philosophers Simulation

**Level:** Intermediate
**Time estimate:** 45 – 60 minutes
**Phase prerequisite:** Phase 04 – Process Synchronization, Phase 05 – Deadlocks

---

## Requirements / What You're Building

Five philosophers sit around a circular table. Between each pair of philosophers is one fork (5 forks total). Each philosopher alternates between **thinking** and **eating**. To eat, a philosopher needs **both** the fork to their left and the fork to their right. Forks are shared, exclusive resources (modeled with `threading.Lock`).

The classic pitfall: if every philosopher simultaneously picks up their left fork first, all five forks are held and every philosopher waits forever for their right fork — **deadlock** (this is the textbook example of all four Coffman conditions holding at once: mutual exclusion, hold-and-wait, no preemption, circular wait).

You will build:

1. **A naive version** that reliably deadlocks (with a watchdog that detects and reports the deadlock so the program doesn't hang forever).
2. **A fixed version** using **resource ordering** (the classic fix: break circular wait by always picking up the lower-numbered fork first) — plus notes on the waiter/arbitrator alternative.

---

## Complete Runnable Python Code

Save this as `dining_philosophers.py`.

```python
"""
Dining Philosophers Simulation
================================
Part 1: A naive version that deadlocks (each philosopher grabs left fork
         first, then right fork) — with a watchdog timer to detect and
         report the deadlock instead of hanging forever.
Part 2: A fixed version using resource ordering (always acquire the
         lower-numbered fork first) to break the circular-wait condition.

Run: python3 dining_philosophers.py
"""

import threading
import time
import random

NUM_PHILOSOPHERS = 5
MEALS_PER_PHILOSOPHER = 3
NAMES = ["Aristotle", "Kant", "Nietzsche", "Descartes", "Socrates"]


# ---------------------------------------------------------------------------
# Part 1: Naive version — WILL deadlock
# ---------------------------------------------------------------------------

def naive_philosopher(idx: int, forks: list, deadlock_event: threading.Event,
                       done_event: threading.Event):
    left = forks[idx]
    right = forks[(idx + 1) % NUM_PHILOSOPHERS]
    name = NAMES[idx]

    print(f"[Naive] {name} sits down (left=fork{idx}, right=fork{(idx + 1) % NUM_PHILOSOPHERS}).")
    time.sleep(0.05)  # small delay so all philosophers reach for left fork ~together

    print(f"[Naive] {name} picks up LEFT fork {idx}.")
    left.acquire()

    time.sleep(0.2)  # widen the window so the deadlock reliably happens

    print(f"[Naive] {name} wants RIGHT fork {(idx + 1) % NUM_PHILOSOPHERS}...")
    right.acquire()  # <-- everyone blocks here forever: classic circular wait

    # Unreachable in the deadlocking run, but included for completeness.
    print(f"[Naive] {name} is eating.")
    time.sleep(0.1)
    right.release()
    left.release()
    done_event.set()


def run_naive_demo():
    print("=" * 70)
    print("PART 1: Naive dining philosophers (expected to DEADLOCK)")
    print("=" * 70)

    forks = [threading.Lock() for _ in range(NUM_PHILOSOPHERS)]
    deadlock_event = threading.Event()
    done_events = [threading.Event() for _ in range(NUM_PHILOSOPHERS)]

    threads = [
        threading.Thread(
            target=naive_philosopher,
            args=(i, forks, deadlock_event, done_events[i]),
            daemon=True,  # daemon so the process can exit even if they hang forever
        )
        for i in range(NUM_PHILOSOPHERS)
    ]

    for t in threads:
        t.start()

    # Watchdog: if not everyone finishes within a short timeout, it's a deadlock.
    timeout_seconds = 2.0
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if all(e.is_set() for e in done_events):
            break
        time.sleep(0.05)

    if all(e.is_set() for e in done_events):
        print("Unexpected: naive version finished without deadlocking.\n")
    else:
        stuck = [NAMES[i] for i, e in enumerate(done_events) if not e.is_set()]
        print(f"\n*** DEADLOCK DETECTED *** after {timeout_seconds}s timeout.")
        print(f"Philosophers still stuck holding one fork, waiting on another: {stuck}")
        print("Each philosopher holds their LEFT fork and waits forever for their")
        print("RIGHT fork, which their neighbor is holding — circular wait.\n")


# ---------------------------------------------------------------------------
# Part 2: Fixed version — resource ordering (always acquire lower index first)
# ---------------------------------------------------------------------------

def ordered_philosopher(idx: int, forks: list, meal_counts: dict, lock: threading.Lock):
    name = NAMES[idx]
    left_idx = idx
    right_idx = (idx + 1) % NUM_PHILOSOPHERS

    # The fix: always acquire the LOWER-numbered fork first, regardless of
    # which side it's physically on. This breaks circular wait because at
    # least one philosopher (the one between fork N-1 and fork 0) picks up
    # forks in the opposite physical order from everyone else.
    first, second = (left_idx, right_idx) if left_idx < right_idx else (right_idx, left_idx)

    for meal in range(MEALS_PER_PHILOSOPHER):
        print(f"[Fixed] {name} is thinking...")
        time.sleep(random.uniform(0.02, 0.08))

        forks[first].acquire()
        forks[second].acquire()
        try:
            print(f"[Fixed] {name} is eating (meal {meal + 1}/{MEALS_PER_PHILOSOPHER}).")
            time.sleep(random.uniform(0.05, 0.1))
            with lock:
                meal_counts[name] += 1
        finally:
            forks[second].release()
            forks[first].release()

    print(f"[Fixed] {name} is done eating for the day.")


def run_fixed_demo():
    print("=" * 70)
    print("PART 2: Fixed dining philosophers (resource ordering — no deadlock)")
    print("=" * 70)

    forks = [threading.Lock() for _ in range(NUM_PHILOSOPHERS)]
    meal_counts = {name: 0 for name in NAMES}
    lock = threading.Lock()

    threads = [
        threading.Thread(target=ordered_philosopher, args=(i, forks, meal_counts, lock))
        for i in range(NUM_PHILOSOPHERS)
    ]

    start = time.time()
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)  # generous timeout; should never be hit if fix works

    elapsed = time.time() - start
    print(f"\nAll philosophers finished in {elapsed:.2f}s. Meals eaten:")
    for name, count in meal_counts.items():
        print(f"  {name}: {count} meals")

    assert all(c == MEALS_PER_PHILOSOPHER for c in meal_counts.values()), \
        "Not everyone finished — something is wrong!"
    print("No deadlock occurred. Every philosopher ate the expected number of meals.\n")


if __name__ == "__main__":
    run_naive_demo()
    run_fixed_demo()
```

---

## How to Run

```bash
python3 dining_philosophers.py
```

Part 1 intentionally hangs for about 2 seconds while all 5 philosophers deadlock, then the watchdog reports it and the program moves on (threads are daemonized so they don't block process exit). Part 2 completes cleanly with no hang.

---

## Sample Output

```
======================================================================
PART 1: Naive dining philosophers (expected to DEADLOCK)
======================================================================
[Naive] Aristotle sits down (left=fork0, right=fork1).
[Naive] Kant sits down (left=fork1, right=fork2).
[Naive] Nietzsche sits down (left=fork2, right=fork3).
[Naive] Descartes sits down (left=fork3, right=fork4).
[Naive] Socrates sits down (left=fork4, right=fork0).
[Naive] Aristotle picks up LEFT fork 0.
[Naive] Kant picks up LEFT fork 1.
[Naive] Nietzsche picks up LEFT fork 2.
[Naive] Descartes picks up LEFT fork 3.
[Naive] Socrates picks up LEFT fork 4.
[Naive] Aristotle wants RIGHT fork 1...
[Naive] Kant wants RIGHT fork 2...
[Naive] Nietzsche wants RIGHT fork 3...
[Naive] Descartes wants RIGHT fork 4...
[Naive] Socrates wants RIGHT fork 0...

*** DEADLOCK DETECTED *** after 2.0s timeout.
Philosophers still stuck holding one fork, waiting on another: ['Aristotle', 'Kant', 'Nietzsche', 'Descartes', 'Socrates']
Each philosopher holds their LEFT fork and waits forever for their
RIGHT fork, which their neighbor is holding — circular wait.

======================================================================
PART 2: Fixed dining philosophers (resource ordering — no deadlock)
======================================================================
[Fixed] Aristotle is thinking...
[Fixed] Kant is thinking...
...
[Fixed] Socrates is done eating for the day.

All philosophers finished in 1.34s. Meals eaten:
  Aristotle: 3 meals
  Kant: 3 meals
  Nietzsche: 3 meals
  Descartes: 3 meals
  Socrates: 3 meals
No deadlock occurred. Every philosopher ate the expected number of meals.
```

---

## Design Notes

- **Why the naive version reliably deadlocks:** the `time.sleep(0.05)` before acquiring the left fork synchronizes all 5 threads so they reach "pick up left fork" at roughly the same time, and the `time.sleep(0.2)` after acquiring the left fork widens the window so every philosopher has grabbed their left fork *before* any of them tries for the right one. This deterministically recreates the textbook circular-wait scenario instead of leaving it to chance.
- **The four Coffman conditions all hold in Part 1:**
  - *Mutual exclusion* — a fork (Lock) can only be held by one philosopher.
  - *Hold and wait* — each philosopher holds their left fork while waiting for the right.
  - *No preemption* — a fork can't be forcibly taken from a philosopher.
  - *Circular wait* — philosopher `i` waits on philosopher `(i+1) % 5`, forming a cycle.
- **The fix (resource ordering) breaks circular wait**, not the other three conditions. By making every philosopher acquire the *lower-numbered* fork first, the philosopher sitting between fork 4 and fork 0 is forced to reach for fork 0 first instead of fork 4 — breaking the cycle. This is the same technique used in real systems to avoid lock-ordering deadlocks (e.g., always locking database rows in primary-key order).
- **Alternative fix — the waiter/arbitrator pattern:** introduce a single `threading.Semaphore(NUM_PHILOSOPHERS - 1)` that a philosopher must acquire before attempting to pick up *any* fork. This guarantees at most 4 of the 5 philosophers can be holding a fork at once, which makes circular wait impossible (there's always at least one philosopher who can get both forks). This is not implemented above but is a good extension exercise (see below).
- **`try`/`finally` for fork release** in the fixed version ensures a fork is always released even if something raises an exception mid-meal — the same discipline you'd want around any real-world mutex/lock usage.

---

## Possible Extensions

1. Implement the **waiter/arbitrator** alternative described above (a counting semaphore capping concurrent fork-seekers at `N-1`) and verify it also avoids deadlock.
2. Add a **timeout-based fork acquisition** (`lock.acquire(timeout=...)`) to the naive version: if a philosopher can't get the right fork within a timeout, they release their left fork and retry — this is deadlock *avoidance via backoff* rather than resource ordering.
3. Track and print how much time each philosopher spent thinking vs. waiting vs. eating, to explore starvation (does resource ordering ever let one philosopher eat far less than others?).
4. Scale up to 20 philosophers and confirm the fixed version still avoids deadlock — trace through why resource ordering scales.
5. Visualize fork state at any point in time (which philosopher holds which fork) by printing a snapshot every N milliseconds from a separate monitor thread.
