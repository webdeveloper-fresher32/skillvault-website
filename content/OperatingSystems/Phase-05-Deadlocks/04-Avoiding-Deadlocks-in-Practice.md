# Avoiding Deadlocks in Practice — Complete Guide

## Table of Contents
1. [Rule 1: Consistent Global Lock Ordering](#1-rule-1-consistent-global-lock-ordering)
2. [Fixing the Lesson-1 Deadlock](#2-fixing-the-lesson-1-deadlock)
3. [Rule 2: Timeouts on Lock Acquisition](#3-rule-2-timeouts-on-lock-acquisition)
4. [Rule 3: Avoid Nested Locks Where Possible](#4-rule-3-avoid-nested-locks-where-possible)
5. [How Database Deadlock Detection Works](#5-how-database-deadlock-detection-works)
6. [A Practical Checklist](#6-a-practical-checklist)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Rule 1: Consistent Global Lock Ordering

This is, by far, the single most effective and most widely used deadlock-avoidance technique in real production code. The rule is simple:

```
Assign every lock in your system a fixed, stable identity (an ID, a
memory address, a name — anything with a total order).

RULE: Whenever a thread needs to hold more than one lock at a time,
      it must acquire them in ascending order of that identity —
      NEVER in any other order, anywhere in the codebase.
```

Why this works: recall from Lesson 01 that a deadlock via circular wait requires at least two threads to be waiting on each other in a cycle. If every thread acquires locks in the same fixed order, it becomes mathematically impossible to form that cycle — whichever thread acquires the *lowest*-ordered lock in the group it needs is guaranteed to be able to acquire all the others too, because no other thread can be holding a higher lock while waiting for that lower one (that would violate the ordering rule for the other thread too).

---

## 2. Fixing the Lesson-1 Deadlock

Recall the deadlocking program from Lesson 01: two threads acquire `lock_1` and `lock_2` in opposite order. Here is the exact same program, fixed with consistent lock ordering — no other logic changes.

```python
"""
deadlock_fixed.py

Fix for the deadlock in Lesson 01's deadlock_demo.py.
The only change: BOTH threads now acquire lock_1 before lock_2,
regardless of which "direction" the work conceptually flows.

Run it: python3 deadlock_fixed.py
Expect: it completes cleanly, every time, no hang.
"""

import threading
import time

lock_1 = threading.Lock()
lock_2 = threading.Lock()


def thread_a():
    print("[Thread A] trying to acquire lock_1")
    with lock_1:
        print("[Thread A] acquired lock_1")
        time.sleep(0.5)

        print("[Thread A] trying to acquire lock_2")
        with lock_2:
            print("[Thread A] acquired lock_2")
    print("[Thread A] done")


def thread_b():
    # BEFORE (deadlocked): acquired lock_2 first, then lock_1.
    # AFTER (fixed): acquire lock_1 first too, matching the global order.
    print("[Thread B] trying to acquire lock_1")
    with lock_1:
        print("[Thread B] acquired lock_1")
        time.sleep(0.5)

        print("[Thread B] trying to acquire lock_2")
        with lock_2:
            print("[Thread B] acquired lock_2")
    print("[Thread B] done")


if __name__ == "__main__":
    t1 = threading.Thread(target=thread_a)
    t2 = threading.Thread(target=thread_b)

    t1.start()
    t2.start()

    t1.join()
    t2.join()

    print("Both threads finished successfully — no deadlock")
```

Notice this trades away *some* concurrency: Thread B now waits for `lock_1` even though its "natural" first step was to touch what used to be `lock_2`. This is the general cost of lock-ordering — a small serialization tax in exchange for a structural deadlock guarantee.

### A general-purpose helper: acquire-by-order for arbitrary lock sets

When the set of locks a piece of code needs isn't known statically (e.g., "lock these two specific bank account objects, whichever they are"), sort them by a stable ID before acquiring:

```python
"""
ordered_lock_acquire.py

General pattern: when you need to lock two (or more) objects whose
identities are only known at runtime (e.g., transferring money between
two arbitrary Account objects), sort by a stable unique ID and acquire
in that order. This generalizes the "fixed order" rule beyond
hardcoded lock_1/lock_2 examples.
"""

import threading


class Account:
    _next_id = 0

    def __init__(self, balance):
        self.id = Account._next_id
        Account._next_id += 1
        self.balance = balance
        self.lock = threading.Lock()


def transfer(from_acc: Account, to_acc: Account, amount: int):
    # Always acquire the lower-ID account's lock first, regardless of
    # which account is conceptually the "source" of the transfer.
    first, second = sorted([from_acc, to_acc], key=lambda a: a.id)

    with first.lock:
        with second.lock:
            if from_acc.balance < amount:
                raise ValueError("insufficient funds")
            from_acc.balance -= amount
            to_acc.balance += amount


if __name__ == "__main__":
    a = Account(100)
    b = Account(50)

    # Two threads transferring in opposite directions simultaneously —
    # this is exactly the shape that deadlocks without ordered acquisition.
    t1 = threading.Thread(target=transfer, args=(a, b, 30))
    t2 = threading.Thread(target=transfer, args=(b, a, 10))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    print(f"Account A balance: {a.balance}")  # 100 - 30 + 10 = 80
    print(f"Account B balance: {b.balance}")  # 50 + 30 - 10 = 70
```

This pattern — sort by a stable key, then acquire in that order — is the idiomatic way to apply "consistent global ordering" when the specific locks involved vary at runtime (a very common interview follow-up to the basic two-lock example).

---

## 3. Rule 2: Timeouts on Lock Acquisition

Lock ordering prevents deadlock structurally, but it requires disciplined code across an entire system — realistically, large codebases sometimes slip. A defense-in-depth backstop is to **never wait for a lock forever**:

```python
import threading

lock_1 = threading.Lock()
lock_2 = threading.Lock()


def thread_a_with_timeout():
    if lock_1.acquire(timeout=2):
        try:
            print("[Thread A] acquired lock_1")
            if lock_2.acquire(timeout=2):
                try:
                    print("[Thread A] acquired lock_2")
                finally:
                    lock_2.release()
            else:
                print("[Thread A] timed out waiting for lock_2 — backing off")
                # Recovery: release what we hold, wait a random backoff, retry.
        finally:
            lock_1.release()
    else:
        print("[Thread A] timed out waiting for lock_1")
```

```
Why timeouts help:
  Instead of hanging forever, a thread that can't get a lock within
  a bounded time gives up, releases whatever it already holds, and
  retries (often after a small random backoff, to avoid two threads
  retrying in lockstep and deadlocking again immediately).

Why timeouts are a backstop, not a primary strategy:
  - A "successful" timeout still wastes the work done before it.
  - Retrying doesn't guarantee eventual success under high contention
    (livelock risk if backoff isn't randomized).
  - It converts a silent permanent hang into a detectable, logged
    event — which is a huge operational win even if it's not elegant.
```

---

## 4. Rule 3: Avoid Nested Locks Where Possible

The simplest way to make circular wait impossible is to never hold one lock while trying to acquire another in the first place:

```
Nested locking (risk of deadlock):
    with lock_a:
        with lock_b:
            do_work()

Alternatives that avoid nesting entirely:

1. Single coarser-grained lock:
     with combined_lock:     # one lock guards both pieces of state
         do_work()
   Trade-off: less concurrency (bigger critical section), but zero
   risk of lock-ordering bugs between lock_a and lock_b.

2. Copy-then-lock-once:
     Read what you need from object A without holding any lock
     (if reads are safe/atomic or protected by their own short lock),
     release it, THEN acquire lock_b alone to do the actual mutation.
   Trade-off: requires careful reasoning about consistency —
   the data you read might be stale by the time you use it.

3. Lock-free / immutable data structures:
     Use atomic compare-and-swap operations or immutable snapshots
     instead of locks entirely for simple counters/flags.
   Trade-off: only works for specific data structures/operations;
   doesn't generalize to arbitrary critical sections.
```

Practical guidance: nested locks are sometimes unavoidable (e.g., the bank transfer example in Section 2 genuinely needs two accounts locked at once). When you can't avoid nesting, ordering (Rule 1) is your primary defense and timeouts (Rule 2) are your backstop. When you *can* avoid nesting — by redesigning the critical section to touch only one lock at a time — that's strictly safer than any nested-locking discipline, because there's no ordering rule to accidentally violate.

---

## 5. How Database Deadlock Detection Works

Everything covered in this phase applies directly to database transactions, not just in-process threads. When two transactions each hold a row lock the other needs, that's the exact same circular-wait deadlock from Lesson 01 — just scoped to database rows instead of `threading.Lock()` objects.

```
Transaction 1: UPDATE accounts SET balance = balance - 10 WHERE id = 1;
                (holds row lock on id=1)
               UPDATE accounts SET balance = balance + 10 WHERE id = 2;
                (blocks — waiting for row lock on id=2)

Transaction 2: UPDATE accounts SET balance = balance - 5 WHERE id = 2;
                (holds row lock on id=2)
               UPDATE accounts SET balance = balance + 5 WHERE id = 1;
                (blocks — waiting for row lock on id=1)

Same shape as the Python deadlock: T1 waits for T2, T2 waits for T1.
```

Most production relational databases don't rely on the application to always lock rows in a perfectly consistent order (application code frequently can't guarantee this — different code paths update rows in whatever order the business logic dictates). Instead, they implement **detection and recovery** (Lesson 03) internally:

```
Typical flow (this is the general model — engine-specific detail lives
in the sibling MySQL and MongoDB courses in this repo):

1. The database engine maintains an internal wait-for graph of which
   transactions are waiting on locks held by which other transactions.
2. A background thread (or the lock manager itself, inline, on each
   new wait) periodically checks this graph for cycles.
3. If a cycle is found, the engine picks a "victim" transaction —
   often the one that has done the least work / holds the fewest
   locks / is cheapest to roll back — and aborts it, releasing its
   locks so the other transaction(s) can proceed.
4. The aborted transaction's application code receives a deadlock
   error and is expected to retry the whole transaction.
```

This is exactly the multi-instance detection + termination recovery model from Lesson 03, applied to row-level locks instead of generic resources.

**For engine-specific detail:**
- MySQL/InnoDB's actual lock types, isolation levels, and its `innodb_deadlock_detect` / `innodb_lock_wait_timeout` settings are covered in `../../Databases/MySQL/Phase-09-Transactions/03-Locking.md` and `../../Databases/MySQL/Phase-09-Transactions/02-Transactions-Isolation.md`.
- MongoDB's multi-document transaction locking and how it handles write conflicts/deadlocks across documents is covered in `../../Databases/MongoDB/Phase-07-Transactions/02-Multi-Document-Transactions.md`.

The core lesson to carry from OS theory into application code: **whenever your application issues multiple UPDATE/DELETE statements inside one transaction that touch rows also touched by other transactions, always access those rows in the same order across every code path** (e.g., always update the lower `id` first) — this is the exact same "consistent global ordering" rule from Section 1, just applied at the database row level instead of the in-process lock level. It won't make the database's own detector unnecessary (other transactions and other services may still not follow your ordering), but it meaningfully reduces how often your own code contributes to deadlocks.

---

## 6. A Practical Checklist

Use this when reviewing any code that touches more than one lock/resource:

```
[ ] Does this code path acquire more than one lock at a time?
[ ] If yes — is there a documented, enforced global order for these locks?
[ ] Are locks acquired via a sorted-key helper when the specific
    locks involved vary at runtime (e.g., transferring between two
    arbitrary accounts)?
[ ] Does any lock acquisition lack a timeout, risking an infinite hang
    if ordering is ever violated by a bug?
[ ] Could this critical section be redesigned to hold only one lock
    at a time (avoiding nesting entirely)?
[ ] If this is a database transaction touching multiple rows — does
    every code path in the system update those rows in the same order?
[ ] Is there monitoring/alerting for lock-wait-timeout or deadlock
    errors in production, so these aren't silent?
```

---

## 7. Hands-On Exercises

**Exercise 1:** Run `deadlock_fixed.py` from Section 2 ten times in a row. Confirm it always completes. Then intentionally break it again by swapping the lock acquisition order back in just `thread_b`, and confirm it hangs — this proves the fix, not luck, was responsible for success.

**Exercise 2:** Run `ordered_lock_acquire.py` from Section 2 with 4 accounts and 6 threads doing random transfers between random pairs of accounts (each transfer between two randomly chosen distinct accounts, amount 1-20). Run it 20 times. Confirm it never hangs and that the sum of all account balances stays constant before and after.

**Exercise 3:** Modify `deadlock_demo.py` from Lesson 01 to add `timeout=1` to both `acquire()` calls (you'll need to switch from the `with lock:` syntax to explicit `lock.acquire(timeout=1)` / `lock.release()`). Confirm that instead of hanging forever, both threads now time out and print a message. Explain why this is "safer" but not actually a fix for the underlying issue.

**Exercise 4:** Read `../../Databases/MySQL/Phase-09-Transactions/03-Locking.md` in this repo. Write 3-4 sentences comparing what you find there to the wait-for graph + termination model from Lesson 03 — specifically, how does MySQL decide which transaction to roll back?

**Exercise 5:** Take a nested-locking critical section (you can use the bank transfer example) and redesign it using the "single coarser-grained lock" alternative from Section 4. Write the code, then write 2-3 sentences on what concurrency you gave up by doing so.

---

## 8. Interview Q&A

**Q: What's the single most effective technique to prevent deadlocks in application code, and why?**
Answer: Consistent global lock ordering — always acquire multiple locks in the same fixed order across every code path in the system (e.g., by sorting locks by a stable unique ID before acquiring). It works because circular wait — a necessary condition for deadlock — requires at least two threads to be acquiring shared locks in different orders; if every thread follows the same order, that circular dependency becomes structurally impossible to form.

**Q: How would you fix a deadlock caused by two threads locking two shared resources in opposite order?**
Answer: Make both threads acquire the locks in the same order. If the specific locks involved are static (always the same two named locks), simply reorder the code so both threads lock, say, lock_1 before lock_2. If the locks involved vary at runtime (e.g., locking two arbitrary bank accounts), sort the objects being locked by a stable key (like an account ID) and always acquire in that sorted order, regardless of which object is conceptually the "source" or "destination."

**Q: Why would you add a timeout to a lock acquisition even if you've already enforced lock ordering?**
Answer: Lock ordering prevents deadlock only if it's followed everywhere, consistently, forever — in a large codebase with many contributors, that discipline can slip. A timeout is defense-in-depth: if a thread can't acquire a lock within a bounded time, it gives up, releases what it holds, and retries (ideally with randomized backoff) rather than hanging forever. It converts a silent permanent freeze into a detectable, loggable, recoverable event, even though it doesn't structurally prevent the underlying bug.

**Q: How do relational databases like MySQL handle deadlocks between transactions?**
Answer: The database engine maintains an internal wait-for graph tracking which transactions are waiting on locks held by other transactions, and periodically (or on each new lock wait) checks it for cycles. When a cycle — a deadlock — is found, the engine picks a "victim" transaction, typically the one that's done the least work or holds the fewest locks, and aborts/rolls it back, releasing its locks so the remaining transaction(s) can proceed. The aborted transaction's application code gets a deadlock error and is expected to retry. This is the same detection-and-recovery model used generically in OS-level deadlock handling, applied to row/table locks.

**Q: What's the downside of avoiding nested locks by using one large coarse-grained lock instead of several fine-grained ones?**
Answer: A single coarse-grained lock eliminates any risk of lock-ordering bugs, since there's only one lock to acquire. But it serializes access to a much larger critical section than necessary — threads that only needed to touch one of the two pieces of state now block on the other's activity too, reducing overall concurrency and throughput. It's a valid trade-off when correctness matters more than throughput, or when the critical sections are small/fast anyway.

**Q: Besides lock ordering and timeouts, what other technique reduces deadlock risk in nested-lock scenarios?**
Answer: Avoiding nesting altogether — redesigning the critical section so a thread only ever holds one lock at a time, for example by reading needed data under a short-lived lock, releasing it, then acquiring a second lock separately to perform the mutation (accepting some risk of using slightly stale data), or by using lock-free/atomic operations (like compare-and-swap) for simple shared state such as counters or flags, which removes the need for a traditional lock entirely for that specific operation.
