# 01 — Threads and Race Conditions

> A comprehensive reference covering why a program needs more than one thread, how to actually create and start one, the critical difference between `.start()` and `.run()`, and how unsynchronized access to shared data produces real, reproducible race conditions.

---

## Table of Contents

1. [The Problem: One Thread Doing Everything](#1-the-problem-one-thread-doing-everything)
2. [The Analogy: One Cashier vs Several Checkout Lanes](#2-the-analogy-one-cashier-vs-several-checkout-lanes)
3. [Creating a Thread with Runnable](#3-creating-a-thread-with-runnable)
4. [start() vs run(): The Difference That Actually Matters](#4-start-vs-run-the-difference-that-actually-matters)
5. [Race Conditions: Two Threads, One Counter](#5-race-conditions-two-threads-one-counter)
6. [Fixing It with synchronized](#6-fixing-it-with-synchronized)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: One Thread Doing Everything

Every Java program starts with exactly one thread of execution — the one running your `main` method. As long as that single thread only does fast, CPU-bound work, that's fine. But two very common situations expose the limits of staying single-threaded:

- **Wasted CPU cores.** Modern machines have multiple CPU cores sitting idle while a single-threaded program plods through work one instruction at a time on just one of them.
- **Blocking on slow operations.** If your one thread makes a network call or reads a large file, the *entire program* freezes until that operation finishes — nothing else can happen in the meantime, even if there's unrelated work that could have proceeded.

Sometimes you genuinely need multiple things happening at the same time: handling several client requests at once, running a background computation while a UI stays responsive, or splitting a large computation across cores to finish faster. That requires more than one thread — and the moment you have more than one thread, you also inherit a brand-new problem: what happens when two threads try to touch the *same* piece of data at the *same* time?

---

## 2. The Analogy: One Cashier vs Several Checkout Lanes

**Real-world analogy:** a single-threaded program is one cashier serving an entire line of customers, one at a time, start to finish, before moving to the next. It's simple and predictable, but slow when the line gets long.

Multithreading is opening several checkout lanes at once. Customers get served in parallel, and the store moves through the line far faster overall. But now there's a new risk: if two cashiers both reach for the *same last item* on a shared shelf at the same instant — one to ring it up, one to restock a count — without any rule about who goes first, you can end up with the shelf's inventory count being wrong, even though each cashier individually did everything correctly. Nothing crashed; the two actions just collided in a way neither cashier could see happening.

That's exactly what a **race condition** is: two threads acting on shared data at the same time, without any coordination, producing a wrong result that neither thread individually caused.

---

## 3. Creating a Thread with Runnable

The most common way to define "a task that should run on its own thread" is to implement the `Runnable` interface — a **functional interface** (an interface with exactly one abstract method) whose single method is `run()`, containing the code you want executed. You then hand a `Runnable` to a `Thread` object, which is the actual handle Java gives you to a real operating-system-backed thread.

```java
class PrintTask implements Runnable {
    @Override
    public void run() {
        for (int i = 1; i <= 3; i++) {
            System.out.println(Thread.currentThread().getName() + ": " + i);
        }
    }
}

public class ThreadDemo {
    public static void main(String[] args) {
        Thread worker = new Thread(new PrintTask(), "Worker");
        worker.start();
        System.out.println("main: doing other things while Worker runs");
    }
}
```

`Thread.currentThread().getName()` returns the name of whichever thread is executing that line — useful for seeing which thread printed what. `worker.start()` tells the JVM to spin up an actual new operating system thread and run `PrintTask`'s `run()` method on it, concurrently with the `main` thread. Because both threads now run independently, the exact interleaving of `"Worker: 1"`, `"Worker: 2"`, `"Worker: 3"`, and `"main: doing other things..."` in the console isn't fixed — it can vary between runs, though each thread's own lines always print in order relative to each other.

---

## 4. start() vs run(): The Difference That Actually Matters

This is the single most important distinction in this lesson, and the one beginners trip over most often:

- **`thread.start()`** asks the JVM to create a genuinely new thread of execution and run the `Runnable`'s `run()` method *on that new thread*, concurrently with whatever called `start()`.
- **`thread.run()`** is just an ordinary method call. Calling `run()` directly does **not** create a new thread at all — it executes `run()`'s code synchronously, on whichever thread made the call (often just `main`), exactly like calling any other method.

```java
class PrintTask implements Runnable {
    @Override
    public void run() {
        System.out.println(Thread.currentThread().getName() + " is running the task");
    }
}

public class StartVsRun {
    public static void main(String[] args) throws InterruptedException {
        Thread a = new Thread(new PrintTask(), "A");
        a.run();     // no new thread — this runs on "main"

        Thread b = new Thread(new PrintTask(), "B");
        b.start();   // spawns a real new thread named "B"
        b.join();    // wait here until thread B finishes before continuing
    }
}
```

`a.run()` prints `main is running the task` — because it's just a normal method call executing on the `main` thread; the `Thread` object named `"A"` was never actually started. `b.start()` prints `B is running the task` — this time on a genuinely separate thread. `b.join()` is a call that makes the calling thread (`main`) pause and wait until thread `b` finishes before proceeding — without it, `main` could reach the end of the program before `b` even gets a chance to print.

| | `.start()` | `.run()` |
|---|---|---|
| Creates a new thread? | Yes | No |
| Runs concurrently with the caller? | Yes | No — runs synchronously, blocking the caller until it finishes |
| Can be called more than once on the same `Thread` object? | No — throws `IllegalThreadStateException` on a second call | Yes — it's just an ordinary method call |
| `Thread.currentThread().getName()` inside `run()` | The new thread's name | The *caller's* thread name |

---

## 5. Race Conditions: Two Threads, One Counter

Now for the problem this lesson is really about. Suppose two threads both increment the *same* shared counter, a large number of times each, with no coordination between them:

```java
public class RaceConditionDemo {
    private static int counter = 0;

    public static void main(String[] args) throws InterruptedException {
        Runnable incrementTask = () -> {
            for (int i = 0; i < 100_000; i++) {
                counter++;
            }
        };

        Thread t1 = new Thread(incrementTask);
        Thread t2 = new Thread(incrementTask);

        t1.start();
        t2.start();

        t1.join();
        t2.join();

        System.out.println("Final count: " + counter);
    }
}
```

Each thread runs `counter++` 100,000 times, so you'd expect the final printed value to be exactly `200000`. Run this program, and it typically prints something *less* than `200000` — and the exact number varies from run to run. Nothing crashes, no exception is thrown; the program just quietly produces a wrong answer.

**Why this happens:** `counter++` looks like one operation, but it's actually three separate steps at the bytecode level: (1) **read** the current value of `counter`, (2) **increment** that value by one, (3) **write** the new value back to `counter`. Because the two threads share the same `counter` variable but are not coordinated, their read-increment-write sequences can interleave. For example: both threads read `counter` when it's `500` at nearly the same instant, both compute `501`, and both write `501` back — one of the two increments is silently lost. Multiply that kind of collision by hundreds of thousands of increments running concurrently, and the final count ends up short of the expected `200000` by some unpredictable amount.

---

## 6. Fixing It with synchronized

The classic fix is the `synchronized` keyword, which uses Java's built-in **intrinsic lock** (every object has one) to ensure that only one thread at a time can execute a given block of code guarded by that lock. A second thread that tries to enter a `synchronized` block already held by another thread simply waits until the first thread exits it.

```java
public class SynchronizedCounterDemo {
    private static int counter = 0;
    private static final Object lock = new Object();

    public static void main(String[] args) throws InterruptedException {
        Runnable incrementTask = () -> {
            for (int i = 0; i < 100_000; i++) {
                synchronized (lock) {
                    counter++;
                }
            }
        };

        Thread t1 = new Thread(incrementTask);
        Thread t2 = new Thread(incrementTask);

        t1.start();
        t2.start();

        t1.join();
        t2.join();

        System.out.println("Final count: " + counter);
    }
}
```

With the increment wrapped in `synchronized (lock) { counter++; }`, only one thread can be in the middle of a read-increment-write sequence at any given moment — the other thread is forced to wait its turn at the `synchronized` block's boundary. This program reliably prints exactly `200000` on every run, because the three-step increment can no longer be interrupted partway through by the other thread. The tradeoff is that `synchronized` introduces waiting: threads that would otherwise run freely now sometimes block on each other, which is the price of correctness.

**Common mistakes:**
- Calling `.run()` instead of `.start()` and being confused about why "the thread" didn't actually run concurrently — it never became a separate thread at all; the code just executed synchronously on the caller.
- Assuming a race condition is rare or unlikely to matter in practice just because it doesn't reproduce on every single run — race conditions are timing-dependent, so a program can appear to "work fine" for months in testing and then fail intermittently in production under different timing and load.

**Interview angle:** "What's the difference between `start()` and `run()`, and what is a race condition?" is a near-guaranteed early screening question for any Java role touching concurrency. Interviewers want to hear the precise mechanical distinction (new thread vs. ordinary synchronous call), a correct explanation of *why* an unsynchronized shared counter produces a wrong result (the read-increment-write sequence isn't atomic), and that you know `synchronized` fixes it by only ever letting one thread execute the guarded block at a time — not a vague "threads can be unpredictable" hand-wave.

---

## 7. Hands-On Exercises

### Exercise 1 — Prove `.run()` doesn't create a thread

Write a small program with a `Runnable` whose `run()` method prints `Thread.currentThread().getName()` in a loop five times, with a short pause between prints (you can use `Thread.sleep(100)` inside the loop, wrapped in a try/catch for `InterruptedException`). Call `.run()` directly on a `Thread` object and observe that your `main` method's own print statements never interleave with it — everything happens strictly in order, because no second thread ever existed.

### Exercise 2 — Reproduce the race condition yourself

Type in the unsynchronized counter example from Section 5 exactly as written, and run it 5 times in a row, noting the final printed count each time. Confirm that (a) it is not always the same number, and (b) it is never larger than `200000`. Then explain in your own words, using the read-increment-write breakdown from Section 5, why the count can only ever come out equal to or less than the expected value, never more.

### Exercise 3 — Fix it and verify

Add the `synchronized` fix from Section 6 to your Exercise 2 program. Run it 5 times in a row and confirm the final count is exactly `200000` every single time.

---

## 8. Interview Q&A

### Q1. What is the difference between calling `thread.start()` and `thread.run()`?

**Answer:** `start()` asks the JVM to create a new, genuinely concurrent thread of execution and run the task's `run()` method on it. `run()` called directly is just an ordinary method invocation — it executes synchronously on whatever thread called it, with no new thread created at all.

---

### Q2. What is a race condition? Give a concrete example.

**Answer:** A race condition occurs when two or more threads access shared, mutable data at the same time without coordination, and the final outcome depends on the unpredictable timing of their operations. A classic example is two threads both executing `counter++` on a shared `int` — because the increment is really a read, increment, and write happening as three separate steps, the two threads' steps can interleave and cause one thread's increment to be silently overwritten by the other's, producing a final count lower than expected.

---

### Q3. Why isn't `counter++` atomic, and why does that matter for concurrency?

**Answer:** `counter++` compiles down to reading the current value, adding one to it, and writing the result back — three distinct steps, not one indivisible operation. If two threads interleave those steps on the same variable, one thread's write can be overwritten by the other before it ever gets used, causing an increment to be lost even though both threads executed `counter++` the correct number of times.

---

### Q4. How does `synchronized` fix a race condition like the shared counter example?

**Answer:** `synchronized` uses an object's intrinsic lock to ensure only one thread can execute a given block of code guarded by that lock at any moment. Wrapping `counter++` in a `synchronized` block guarded by a shared lock object means one thread must fully complete its read-increment-write sequence before another thread guarded by the same lock is allowed to start its own, eliminating the interleaving that caused lost updates.

---

### Q5. If a race condition doesn't show up in testing, does that mean the code is safe?

**Answer:** No. Race conditions are timing-dependent — whether they actually produce a visibly wrong result depends on how threads happen to be scheduled, which can vary based on CPU load, thread count, JVM version, and pure chance. Code with an unsynchronized shared mutable variable accessed by multiple threads is unsafe regardless of whether a given test run happened to expose the bug.

---

> 🧠 **Memory hook:** "`start()` opens a new checkout lane; `run()` just makes the same cashier ring up one more item themselves — and two cashiers reaching for the same shelf count without a rule about who goes first is exactly what a race condition is."
