# Mutex and Locks — Complete Guide

## Table of Contents
1. [What is a Mutex?](#1-what-is-a-mutex)
2. [Fixing the Broken Counter](#2-fixing-the-broken-counter)
3. [How a Lock Enforces Mutual Exclusion](#3-how-a-lock-enforces-mutual-exclusion)
4. [Lock Patterns: `with` vs Manual Acquire/Release](#4-lock-patterns-with-vs-manual-acquirerelease)
5. [Deadlock Risk Preview](#5-deadlock-risk-preview)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is a Mutex?

A **mutex** (short for "mutual exclusion") is a locking primitive that allows at most one thread to hold it at any given time. Think of it as a single key to a single-occupancy room: whoever holds the key can enter and do their work; everyone else waits outside until the key is returned.

```
Mutex = a lock with exactly two states: LOCKED / UNLOCKED

  lock.acquire()   →  if UNLOCKED: become LOCKED, proceed
                    →  if LOCKED:  block (wait) until it becomes UNLOCKED

  lock.release()   →  become UNLOCKED, wake up one waiting thread (if any)
```

A mutex directly satisfies the **mutual exclusion** requirement from Lesson 1: by wrapping the critical section with `acquire()`/`release()`, you guarantee only one thread executes that code at a time.

---

## 2. Fixing the Broken Counter

Recall the broken counter from Lesson 1:

```python
import threading

counter = 0

def increment():
    global counter
    for _ in range(100_000):
        counter += 1   # RACE CONDITION

threads = [threading.Thread(target=increment) for _ in range(2)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(counter)  # unpredictable, usually < 200000
```

Here is the fixed version using `threading.Lock`:

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        lock.acquire()
        try:
            counter += 1   # now safely inside the critical section
        finally:
            lock.release()

threads = [threading.Thread(target=increment) for _ in range(2)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"Expected: 200000")
print(f"Actual:   {counter}")
```

Run this and you will get exactly `200000` every single time. The `try/finally` ensures the lock is always released even if an exception occurs inside the critical section — never let a lock leak.

A cleaner, idiomatic Python version uses the lock as a context manager, which handles acquire/release (including on exceptions) automatically:

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:               # acquire on entry, release on exit — always
            counter += 1

threads = [threading.Thread(target=increment) for _ in range(2)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(counter)  # 200000, every time
```

---

## 3. How a Lock Enforces Mutual Exclusion

Re-running the interleaving diagram from Lesson 1, but now with a lock guarding the critical section:

```
Time  Thread A                        Thread B                     counter  lock
----  ------------------------------  ---------------------------  -------  ----
t0    acquire() → succeeds (LOCKED)                                  10     LOCKED
t1                                     acquire() → BLOCKS (waits)     10     LOCKED
t2    READ temp_A = counter                                          10     LOCKED
t3    MODIFY temp_A = 11                                             10     LOCKED
t4    WRITE counter = 11                                             11     LOCKED
t5    release() → (UNLOCKED)                                         11   UNLOCKED
t6                                     acquire() → succeeds (LOCKED)  11     LOCKED
t7                                     READ temp_B = counter          11     LOCKED
t8                                     MODIFY temp_B = 12             11     LOCKED
t9                                     WRITE counter = 12             12     LOCKED
t10                                    release() → (UNLOCKED)         12   UNLOCKED
```

Thread B is physically prevented from entering the critical section while Thread A holds the lock — it blocks at `acquire()` instead of racing ahead. The three-step read-modify-write sequence can no longer be interrupted by another thread touching the same variable, so no lost updates occur.

---

## 4. Lock Patterns: `with` vs Manual Acquire/Release

| Pattern | Code | When to use |
|---------|------|-------------|
| Manual | `lock.acquire()` ... `lock.release()` | Rarely — easy to forget `release()`, especially on exceptions |
| Manual + try/finally | `lock.acquire(); try: ...; finally: lock.release()` | When you need fine-grained control over exactly when the lock is released |
| Context manager | `with lock: ...` | Default choice — Pythonic, exception-safe, less code |

Always prefer `with lock:` unless you have a specific reason not to. A forgotten `release()` call is one of the most common concurrency bugs — it causes every other thread waiting on that lock to block forever.

---

## 5. Deadlock Risk Preview

Locks solve races, but they introduce a new hazard: if a thread needs **two locks** to do its job, and two threads acquire them in opposite order, both can end up waiting for each other forever.

```
Thread A:                         Thread B:
  lock1.acquire()   [holds lock1]   lock2.acquire()   [holds lock2]
  lock2.acquire()   ← BLOCKS,       lock1.acquire()   ← BLOCKS,
    waiting for B to release lock2    waiting for A to release lock1

Neither thread can proceed. Neither thread will ever release its lock.
This is a DEADLOCK.
```

```python
import threading

lock1 = threading.Lock()
lock2 = threading.Lock()

def task_a():
    with lock1:
        with lock2:   # thread A wants lock2 while holding lock1
            pass

def task_b():
    with lock2:
        with lock1:   # thread B wants lock1 while holding lock2 — DANGER
            pass
```

This is only a preview — Phase 05 (Deadlocks) covers the full theory: the four necessary conditions for deadlock, detection, prevention, and avoidance strategies (like always acquiring locks in a consistent global order to break this exact pattern).

---

## 6. Hands-On Exercises

**Exercise 1:** Run the fixed counter code from Section 2 ten times. Confirm the output is `200000` every single time, unlike the broken version.

**Exercise 2:** Remove the `with lock:` from the fixed version but keep the lock object defined. Confirm the race condition returns. This proves the fix comes from actually using the lock, not merely creating it.

**Exercise 3:** Modify the fixed example to use 4 threads instead of 2, each doing 50,000 increments. Confirm the total is still correct (200,000).

**Exercise 4:** Write a small program that reproduces the deadlock in Section 5 (two locks, two threads, opposite acquisition order). Run it and observe that it hangs — then fix it by making both threads acquire `lock1` before `lock2`.

**Exercise 5:** Research and note the difference between `threading.Lock` and `threading.RLock` (reentrant lock) in Python's documentation-style behavior: what happens if a thread tries to acquire a plain `Lock` it already holds?

---

## 7. Interview Q&A

**Q: What is a mutex and what problem does it solve?**
Answer: A mutex is a synchronization primitive that allows only one thread to hold it at a time. It solves the mutual exclusion requirement of the critical section problem — by requiring threads to acquire the mutex before entering a critical section and release it after, only one thread can execute that section at once, preventing race conditions like lost updates.

**Q: Why is `with lock:` preferred over manual `acquire()`/`release()` calls in Python?**
Answer: `with lock:` guarantees the lock is released even if an exception is raised inside the block, because it uses the context manager protocol (`__enter__`/`__exit__`). Manual acquire/release without try/finally risks leaving the lock held forever if an exception occurs between acquire and release, which would block every other thread waiting on it.

**Q: What happens if a thread calls `lock.acquire()` on a lock it already holds (a plain `threading.Lock`)?**
Answer: It deadlocks itself — a plain `Lock` is not reentrant, so a second `acquire()` call by the same thread blocks forever waiting for the lock to be released, but it never will be since the same thread is the one holding it and is now stuck waiting. `threading.RLock` (reentrant lock) is designed to allow this by tracking an owning thread and a hold count.

**Q: What's the performance cost of using a lock, and why not just lock everything?**
Answer: Acquiring/releasing a lock has overhead (context switches, potential kernel calls when contended) and, more importantly, serializes execution of the protected section — no parallelism there. Over-locking (locking more code than necessary, or locking data that's never actually shared) reduces concurrency for no correctness benefit and can turn multi-threaded code into effectively single-threaded code.

**Q: How does a lock actually prevent the interleaving that causes a lost update?**
Answer: The lock forces any thread trying to enter the critical section (via `acquire()`) to block until the current holder calls `release()`. This means the entire read-modify-write sequence of one thread completes before another thread can even start executing the critical section, eliminating the possibility of two threads reading the same stale value.

**Q: What is a deadlock, briefly, and how do locks introduce that risk?**
Answer: A deadlock is when two or more threads are each waiting for a resource the other holds, so none of them can proceed. It's introduced by locks when a thread needs multiple locks: if two threads acquire the same two locks in different orders, each can end up holding one lock while waiting for the other, and neither will release what it holds.

**Q: Name one concrete strategy to prevent the two-lock deadlock shown in this lesson.**
Answer: Always acquire locks in a consistent global order across all threads (e.g., always lock1 before lock2, everywhere in the codebase). If every thread requests locks in the same order, circular waiting cannot form, which eliminates deadlock for this pattern.
