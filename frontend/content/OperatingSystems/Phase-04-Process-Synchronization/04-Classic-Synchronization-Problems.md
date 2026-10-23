# Classic Synchronization Problems — Complete Guide

## Table of Contents
1. [Why These Problems Matter](#1-why-these-problems-matter)
2. [Producer-Consumer (Bounded Buffer)](#2-producer-consumer-bounded-buffer)
3. [Dining Philosophers](#3-dining-philosophers)
4. [Readers-Writers](#4-readers-writers)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Why These Problems Matter

These three problems were formalized decades ago (Dijkstra, Courtois et al.) as minimal, precise examples that each expose a *different* class of concurrency bug. They show up constantly in interviews because they're small enough to reason about on a whiteboard but rich enough to reveal whether a candidate actually understands mutual exclusion, resource ordering, and reader/writer trade-offs — not just "add a lock and hope."

```
Producer-Consumer  →  illustrates: bounded buffer, flow control, blocking
Dining Philosophers →  illustrates: resource ordering, deadlock, circular wait
Readers-Writers     →  illustrates: read/write access trade-offs, starvation
```

---

## 2. Producer-Consumer (Bounded Buffer)

### The Concurrency Issue

Producers generate data faster or slower than consumers can process it, and they share a **fixed-size buffer**. Without coordination: producers can overwrite data in a full buffer, consumers can read garbage from an empty buffer, or two producers/consumers can corrupt the buffer by writing at the same time.

```
Producer(s) ──▶ [ bounded buffer, capacity N ] ──▶ Consumer(s)

Problems without synchronization:
  - Producer writes into a full buffer          → data loss / overwrite
  - Consumer reads from an empty buffer         → garbage / crash
  - Two threads mutate buffer index at once     → corrupted buffer state
```

### Python Solution Sketch

(Full runnable version with detailed explanation is in Lesson 03 — Semaphores. Sketch below for completeness.)

```python
import threading
from collections import deque

BUFFER_SIZE = 5
buffer = deque()

empty_slots = threading.Semaphore(BUFFER_SIZE)  # blocks producer when buffer full
full_slots = threading.Semaphore(0)             # blocks consumer when buffer empty
mutex = threading.Lock()                        # protects buffer mutation

def produce(item):
    empty_slots.acquire()
    with mutex:
        buffer.append(item)
    full_slots.release()

def consume():
    full_slots.acquire()
    with mutex:
        item = buffer.popleft()
    empty_slots.release()
    return item
```

The two semaphores encode "don't produce into a full buffer" and "don't consume from an empty buffer"; the mutex encodes "don't corrupt the buffer's internal state."

---

## 3. Dining Philosophers

### The Concurrency Issue

Five philosophers sit at a round table. Between each pair of adjacent philosophers is one fork — five forks total. Each philosopher needs **both** their left and right fork to eat. This problem illustrates **deadlock via circular resource acquisition**: if every philosopher picks up their left fork at the same time, all five forks are held, and every philosopher is stuck waiting forever for their right fork, which their neighbor is holding.

```
        Philosopher 0
     Fork4        Fork0
Philosopher 4              Philosopher 1
     Fork3        Fork1
        Philosopher 3   Philosopher 2 (Fork2 between 2 & 3)

Deadlock scenario: ALL 5 philosophers grab their LEFT fork simultaneously.
  P0 holds Fork0, wants Fork1 (held by P1, who wants Fork2)... circular wait.
  Nobody ever gets their second fork. Everyone starves. DEADLOCK.
```

### Python Solution Sketch

The standard fix: break the symmetry that causes circular waiting. The simplest approach is **resource ordering** — have philosophers always pick up the lower-numbered fork first.

```python
import threading

NUM_PHILOSOPHERS = 5
forks = [threading.Lock() for _ in range(NUM_PHILOSOPHERS)]

def philosopher(i):
    left = i
    right = (i + 1) % NUM_PHILOSOPHERS

    # Always acquire the lower-numbered fork first — breaks circular wait
    first, second = (left, right) if left < right else (right, left)

    for _ in range(3):   # eat 3 times
        with forks[first]:
            with forks[second]:
                print(f"Philosopher {i} is eating")
        print(f"Philosopher {i} is thinking")

threads = [threading.Thread(target=philosopher, args=(i,)) for i in range(NUM_PHILOSOPHERS)]
for t in threads:
    t.start()
for t in threads:
    t.join()
```

Because philosopher 4's "left" fork is fork 4 and "right" fork is fork 0 (wraps around), without the ordering fix philosopher 4 would try to grab fork 0 first while philosopher 0 tries to grab fork 0 too — but crucially, in the naive version everyone grabs "left" first, creating the circular chain. By forcing everyone to always request the lower-numbered fork first, at least one philosopher (philosopher 4, whose "first" fork becomes fork 0, not fork 4) breaks the symmetry, making the circular wait condition impossible.

Other valid fixes (worth knowing for interviews): limit the table to at most N-1 philosophers trying to eat at once (using a counting semaphore), or use a single global lock around "pick up both forks" (correct but reduces parallelism).

---

## 4. Readers-Writers

### The Concurrency Issue

A shared resource (e.g., a cache, a file, an in-memory data structure) has multiple **readers** and multiple **writers**. The rules:

```
- Any number of readers may read simultaneously (reads don't conflict)
- Only one writer may write at a time (writes conflict with everything)
- A writer and any readers must never operate at the same time
    (a reader could see a half-written, inconsistent value)
```

This problem illustrates the trade-off between **maximizing read concurrency** and **preventing writer starvation** (if readers keep arriving, a waiting writer could be blocked forever) or **reader starvation** (a naive writer-priority solution could starve readers instead). This exact trade-off is why real databases expose different isolation levels and lock types.

```
Readers:  R1 ──┐
          R2 ──┼──▶ shared resource   (many readers OK together)
          R3 ──┘

Writer:   W1 ────────▶ shared resource   (must be EXCLUSIVE — no readers, no other writers)
```

### Python Solution Sketch

A common "readers-preference" style solution: track an active reader count with a mutex-protected counter, and only the *first* reader locks out writers, only the *last* reader unlocks them.

```python
import threading

class ReadWriteLock:
    def __init__(self):
        self.read_count = 0
        self.read_count_lock = threading.Lock()   # protects read_count itself
        self.resource_lock = threading.Lock()      # held by writers, or by first reader

    def acquire_read(self):
        with self.read_count_lock:
            self.read_count += 1
            if self.read_count == 1:
                self.resource_lock.acquire()   # first reader blocks writers

    def release_read(self):
        with self.read_count_lock:
            self.read_count -= 1
            if self.read_count == 0:
                self.resource_lock.release()   # last reader unblocks writers

    def acquire_write(self):
        self.resource_lock.acquire()   # writer needs exclusive access

    def release_write(self):
        self.resource_lock.release()


rw_lock = ReadWriteLock()
shared_data = {"value": 0}

def reader(reader_id):
    rw_lock.acquire_read()
    try:
        print(f"Reader {reader_id} sees value = {shared_data['value']}")
    finally:
        rw_lock.release_read()

def writer(writer_id, new_value):
    rw_lock.acquire_write()
    try:
        shared_data["value"] = new_value
        print(f"Writer {writer_id} set value = {new_value}")
    finally:
        rw_lock.release_write()
```

Note this simple version favors readers — if readers keep arriving continuously, a writer can be starved indefinitely, waiting for `read_count` to drop to 0. Production-grade read-write locks (and most database engines) add a fairness mechanism, such as blocking new readers once a writer is waiting, to avoid writer starvation.

---

## 5. Hands-On Exercises

**Exercise 1:** Run the Dining Philosophers code with the lower-numbered-fork-first fix. Confirm all 5 philosophers finish eating 3 times each with no hang.

**Exercise 2:** Remove the fork ordering fix (make every philosopher always try `left` then `right`, without the min/max reordering) and run it several times in a loop. Try to reproduce a hang (it may not happen every run — that's expected of a race/deadlock condition).

**Exercise 3:** Run the `ReadWriteLock` example with 5 reader threads and 2 writer threads started at roughly the same time. Add small `time.sleep()` calls inside `reader()` and `writer()` to widen the window where races could occur, and confirm output never shows a writer and reader accessing `shared_data` in an interleaved, inconsistent way.

**Exercise 4:** Modify the `ReadWriteLock` class to print a warning if a writer has been waiting for more than a set number of reader acquisitions — this simulates detecting the writer-starvation problem described in Section 4.

**Exercise 5:** For each of the three classic problems, write one sentence naming the real-world system component it maps to (e.g., "Readers-Writers maps to a database's shared read-lock / exclusive write-lock system").

---

## 6. Interview Q&A

**Q: What concurrency issue does the Producer-Consumer problem illustrate?**
Answer: It illustrates the need for flow control on a bounded shared buffer — producers must not write to a full buffer and consumers must not read from an empty buffer — combined with mutual exclusion to protect the buffer's internal state from concurrent mutation. It's solved with two counting semaphores (for empty/full slot counts) plus a mutex.

**Q: What causes deadlock in the naive Dining Philosophers solution?**
Answer: If every philosopher simultaneously picks up their left fork first, all forks become held, and every philosopher then waits forever for their right fork — which is the left fork of their neighbor, who is also waiting. This is a circular wait: each thread holds one resource while waiting for another, forming a cycle with no way to break it.

**Q: How does resource ordering fix the Dining Philosophers deadlock?**
Answer: By requiring every philosopher to acquire the lower-numbered fork before the higher-numbered one (instead of always "left then right"), the circular chain is broken — at least one philosopher (the one whose neighbor wrap-around would otherwise create the cycle) ends up requesting forks in the opposite order, so a full circular wait can never form.

**Q: What's the core trade-off in the Readers-Writers problem?**
Answer: Multiple readers can safely read concurrently since reads don't conflict, but a writer needs fully exclusive access since writes conflict with everything (including other writes). The trade-off is between maximizing read throughput (letting readers pile in freely) and ensuring writers eventually get access — a readers-preference solution risks starving writers if readers keep arriving continuously.

**Q: In the Readers-Writers solution shown, why is `read_count` itself protected by a separate lock?**
Answer: `read_count` is shared, mutable state that multiple reader threads update concurrently (incrementing on entry, decrementing on exit). Without its own lock, incrementing/decrementing `read_count` would itself be a race condition — the exact lost-update problem from Lesson 1 — undermining the "first reader locks, last reader unlocks" logic that depends on an accurate count.

**Q: Name three real-world systems and map each to one of these three classic problems.**
Answer: Producer-Consumer maps to message queues / job queues (e.g., a task queue between a web server and background workers). Dining Philosophers maps to any system acquiring multiple locks/resources in variable order, like a database transaction locking multiple rows — the classic cause of database deadlocks. Readers-Writers maps to a database's or cache's shared/exclusive locking model, or Python's/Java's read-write lock implementations for a shared in-memory data structure.

**Q: Besides fork-ordering, what's another valid way to prevent deadlock in Dining Philosophers?**
Answer: Limit the number of philosophers allowed to attempt eating simultaneously to at most N-1 (using a counting semaphore initialized to N-1 out of N philosophers) — this guarantees at least one philosopher can always get both forks, breaking the possibility of all N holding one fork each simultaneously. A simpler but lower-concurrency fix is a single global lock around "pick up both forks."
