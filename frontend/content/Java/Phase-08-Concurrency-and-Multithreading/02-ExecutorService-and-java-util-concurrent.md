# 02 — ExecutorService and java.util.concurrent

> A comprehensive reference covering thread pools via `ExecutorService`, submitting tasks and retrieving results with `Future`, and the key `java.util.concurrent` building blocks — `ConcurrentHashMap`, `AtomicInteger`, and `CountDownLatch` — that make concurrent code safer and easier to manage than raw threads.

---

## Table of Contents

1. [The Problem: Managing Raw Threads Doesn't Scale](#1-the-problem-managing-raw-threads-doesnt-scale)
2. [The Analogy: Hiring a New Employee for Every Task](#2-the-analogy-hiring-a-new-employee-for-every-task)
3. [ExecutorService and Thread Pools](#3-executorservice-and-thread-pools)
4. [Submitting Tasks and Getting Results with Future](#4-submitting-tasks-and-getting-results-with-future)
5. [Key java.util.concurrent Building Blocks](#5-key-javautilconcurrent-building-blocks)
6. [Revisiting the Race Condition: AtomicInteger](#6-revisiting-the-race-condition-atomicinteger)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Managing Raw Threads Doesn't Scale

Lesson 1 created threads directly with `new Thread(...)`. That works for a handful of threads in a small example, but it breaks down fast in a real application:

- **Creating a thread has real overhead.** Every `new Thread(...)` followed by `.start()` asks the operating system to allocate a new native thread, with its own stack (Phase 9 covers the stack in depth) and scheduling overhead. Spinning up thousands of short-lived threads — one per incoming request, say — wastes resources on setup and teardown instead of doing actual work.
- **Nothing manages how many run at once.** If a burst of 10,000 tasks each spawns its own raw thread with no limit, you can overwhelm the CPU and the OS's thread-scheduling capacity, actually making the program *slower* than doing less work concurrently would have been.
- **Collecting results is manual and awkward.** A `Runnable`'s `run()` method returns nothing. If a background task computes a value you actually need back, you're left inventing your own way to hand that result back to whoever's waiting for it.

What's missing is something that manages a pool of reusable threads, hands out work from a queue, and gives you a clean way to get a result back once a task finishes.

---

## 2. The Analogy: Hiring a New Employee for Every Task

**Real-world analogy:** using a raw `Thread` for every task is like hiring and personally training a brand-new employee to handle one single task, then firing them the moment it's done — over and over, for every task that comes in. All that hiring and training overhead is paid again and again, even for trivial jobs.

An `ExecutorService`-backed thread pool is a standing team of employees who stay employed. New tasks arrive in a shared queue, and whichever employee finishes their current task next simply picks up the next one from the queue. No one gets hired or fired per task — the team size stays fixed (or bounded), and someone else (the pool) manages the roster and the queue for you.

---

## 3. ExecutorService and Thread Pools

`ExecutorService` is an interface representing a pool of worker threads that can run submitted tasks. The most common way to get one is through the `Executors` factory class:

```java
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

ExecutorService executor = Executors.newFixedThreadPool(3);
```

`Executors.newFixedThreadPool(3)` creates a pool with exactly 3 worker threads. Any number of tasks can be submitted to it; at most 3 run at the same time, and the rest wait in an internal queue until a worker thread is free. This decouples "how many tasks exist" from "how many threads actually run at once" — you can safely submit thousands of tasks to a pool of 3 threads without spawning thousands of OS threads.

When you're done submitting work, you must call `executor.shutdown()`. This tells the pool to stop accepting new tasks and to let its worker threads exit once all already-submitted tasks finish. Without calling `shutdown()`, the pool's threads keep running indefinitely, waiting for more work that never comes — and a JVM will not exit on its own while such threads are still alive.

---

## 4. Submitting Tasks and Getting Results with Future

Where a `Runnable`'s `run()` method returns nothing, `Callable<T>` is a similar functional interface whose single method, `call()`, *does* return a value (and is allowed to throw a checked exception). Submitting a `Callable<T>` to an `ExecutorService` via `.submit(...)` immediately returns a `Future<T>` — a placeholder representing a result that may not exist yet, because the task might still be running. Calling `.get()` on that `Future` blocks the calling thread until the task finishes, then returns its result.

```java
import java.util.concurrent.*;
import java.util.ArrayList;
import java.util.List;

public class ExecutorDemo {
    public static void main(String[] args) throws InterruptedException, ExecutionException {
        ExecutorService executor = Executors.newFixedThreadPool(3);
        List<Future<Integer>> futures = new ArrayList<>();

        for (int i = 1; i <= 5; i++) {
            int n = i; // captured by the lambda below; must be effectively final
            Callable<Integer> task = () -> n * n;
            futures.add(executor.submit(task));
        }

        for (Future<Integer> future : futures) {
            System.out.println(future.get());
        }

        executor.shutdown();
    }
}
```

This submits 5 tasks (each computing a square) to a pool of 3 threads. The tasks themselves may execute in any order and across different worker threads — but because each `Future` in the `futures` list corresponds to exactly the task it was returned from, printing `future.get()` for each one in the order they were added to the list prints `1`, `4`, `9`, `16`, `25`, in that exact order, regardless of which worker thread actually computed which value. `.get()` throws a checked `ExecutionException` if the task itself threw an exception, and `InterruptedException` if the waiting thread is interrupted — both must be declared or caught, as covered in Phase 5.

---

## 5. Key java.util.concurrent Building Blocks

Beyond `ExecutorService`, the `java.util.concurrent` package provides ready-made, thread-safe alternatives to writing your own `synchronized` logic by hand:

- **`ConcurrentHashMap`** — a thread-safe implementation of the `Map` interface (Phase 4). Multiple threads can read and write to it concurrently without external `synchronized` blocks and without the risk of corrupting its internal structure, which a plain `HashMap` does not guarantee under concurrent modification.
- **`AtomicInteger`** — a wrapper around an `int` that supports atomic operations like `incrementAndGet()`, meaning the read-modify-write sequence happens as a single, uninterruptible hardware-level operation, with no possibility of another thread's operation interleaving partway through. Covered in detail in the next section.
- **`CountDownLatch`** — a synchronization tool that lets one or more threads wait until a set number of operations happening on *other* threads have completed. It's initialized with a count (e.g. `new CountDownLatch(3)`); each worker calls `.countDown()` when it finishes its part, and any thread that calls `.await()` blocks until the count reaches zero.

```java
import java.util.concurrent.CountDownLatch;

public class LatchDemo {
    public static void main(String[] args) throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(3);

        for (int i = 1; i <= 3; i++) {
            int workerId = i;
            new Thread(() -> {
                System.out.println("Worker " + workerId + " finished");
                latch.countDown();
            }).start();
        }

        latch.await(); // main blocks here until all 3 workers have called countDown()
        System.out.println("All workers finished — proceeding");
    }
}
```

Here, `main` starts 3 worker threads and then calls `latch.await()`, which blocks until all three workers have each called `latch.countDown()` once. Only then does `"All workers finished — proceeding"` print — guaranteeing it always prints after all three `"Worker N finished"` lines, regardless of how the three worker threads happen to be scheduled relative to each other.

---

## 6. Revisiting the Race Condition: AtomicInteger

Lesson 1 fixed the shared-counter race condition with a `synchronized` block. `AtomicInteger` offers a different, often more efficient fix for the exact same problem, using lock-free atomic operations instead of blocking synchronization:

```java
import java.util.concurrent.atomic.AtomicInteger;

public class AtomicCounterDemo {
    private static final AtomicInteger counter = new AtomicInteger(0);

    public static void main(String[] args) throws InterruptedException {
        Runnable incrementTask = () -> {
            for (int i = 0; i < 100_000; i++) {
                counter.incrementAndGet();
            }
        };

        Thread t1 = new Thread(incrementTask);
        Thread t2 = new Thread(incrementTask);

        t1.start();
        t2.start();

        t1.join();
        t2.join();

        System.out.println("Final count: " + counter.get());
    }
}
```

This produces exactly `200000` on every run, just like the `synchronized` version — but `incrementAndGet()` never makes a thread wait for a lock. Instead, it relies on a CPU-level atomic instruction (conceptually, "compare and swap": read the current value, compute the new value, and write it back only if no other thread changed it in between, retrying automatically if they did). The net effect is the same correctness guarantee as `synchronized`, achieved without ever blocking a thread — which is why `AtomicInteger` and its relatives (`AtomicLong`, `AtomicBoolean`, `AtomicReference`) are often the preferred fix for simple cases like a single shared counter, while `synchronized` remains necessary for coordinating more complex multi-step operations across shared state.

| | `synchronized` | `AtomicInteger` |
|---|---|---|
| Mechanism | Intrinsic lock — one thread at a time enters the block | Lock-free atomic CPU operation |
| Threads ever blocked waiting? | Yes | No |
| Good for | Coordinating multiple related operations on shared state | A single simple value (counter, flag, reference) updated independently |
| Result on the race-condition demo | Correct (`200000`), with some threads waiting | Correct (`200000`), with no thread ever blocked |

**Common mistakes:**
- Forgetting to call `.shutdown()` on an `ExecutorService`, leaving its worker threads alive indefinitely and preventing the JVM from exiting even after `main` has otherwise finished.
- Calling `.get()` on a `Future` immediately after `.submit()`, before doing any other useful work — this blocks the calling thread right away, defeating the purpose of submitting the task concurrently in the first place. It's usually better to submit all tasks first, do other work if there is any, and only call `.get()` once you actually need each result.

**Interview angle:** "Why use an `ExecutorService` instead of raw `Thread` objects, and what's the difference between `synchronized` and `AtomicInteger`?" tests whether you understand *why* thread pools exist (avoiding the overhead and lack of control of unmanaged raw threads) rather than just how to call their methods. A strong answer also distinguishes blocking coordination (`synchronized`, useful for multi-step shared-state logic) from lock-free atomic operations (`AtomicInteger`, ideal for simple independent counters/flags) — showing you'd pick the lighter-weight tool when it's sufficient, rather than reaching for `synchronized` by default.

---

## 7. Hands-On Exercises

### Exercise 1 — Build a fixed thread pool and collect results

Write a program that submits 6 `Callable<Integer>` tasks (each just returning its own index cubed) to a fixed thread pool of size 2. Collect all 6 `Future` objects in a `List`, then print each result in submission order. Confirm the printed results are `1, 8, 27, 64, 125, 216` regardless of how the pool happens to schedule the underlying tasks. Remember to call `.shutdown()`.

### Exercise 2 — Reproduce and fix the counter race with AtomicInteger

Take the unsynchronized counter demo from Lesson 1, Section 5. Replace the plain `int counter` with an `AtomicInteger`, and change `counter++` to `counter.incrementAndGet()`. Run it 5 times and confirm the final count is exactly `200000` every time, with no `synchronized` block anywhere in your code.

### Exercise 3 — Use a CountDownLatch to wait for setup

Write a program that starts 3 "worker" threads, each simulating a slow startup step (e.g. `Thread.sleep(200)` then printing a message) before calling `.countDown()` on a shared `CountDownLatch` initialized to 3. Have `main` call `.await()` on the latch and only print `"All systems ready"` after it returns. Confirm the "ready" message never prints before all three worker messages, no matter how you vary the sleep durations.

---

## 8. Interview Q&A

### Q1. Why use an `ExecutorService` instead of creating `Thread` objects directly?

**Answer:** Creating a raw thread for every task has real overhead (native thread allocation, its own stack, OS scheduling) and gives you no control over how many run concurrently. An `ExecutorService`-backed thread pool reuses a fixed (or bounded) set of worker threads that pull tasks from a shared queue, avoiding per-task thread creation overhead and letting you cap concurrency, while also giving you `Future` objects to retrieve results cleanly.

---

### Q2. What is a `Future`, and what does calling `.get()` on it do?

**Answer:** A `Future<T>` is a placeholder for a result that a submitted `Callable<T>` task will eventually produce, returned immediately by `ExecutorService.submit(...)` even though the task may still be running. Calling `.get()` blocks the calling thread until the task completes, then returns its result (or throws `ExecutionException` if the task itself threw, or `InterruptedException` if the waiting thread was interrupted).

---

### Q3. Why is it important to call `.shutdown()` on an `ExecutorService`?

**Answer:** An `ExecutorService`'s worker threads keep running indefinitely, waiting for more submitted tasks, until `.shutdown()` is called to tell the pool to stop accepting new work and let its threads exit once existing tasks finish. Forgetting to call it leaves those threads alive, which can prevent the JVM from exiting even after the rest of the program has finished.

---

### Q4. How does `AtomicInteger` fix the same race condition that `synchronized` fixes, without using locks?

**Answer:** `AtomicInteger` methods like `incrementAndGet()` use a CPU-level atomic operation (conceptually a compare-and-swap: read the value, compute the new value, and write it back only if nothing else changed it in between, retrying if it did) instead of a lock. This guarantees the same correctness as `synchronized` — no lost updates — without ever making a thread block and wait for another thread to release a lock.

---

### Q5. What does `CountDownLatch` let you do that plain `Thread.join()` doesn't as naturally?

**Answer:** `CountDownLatch` lets any number of threads signal completion of a piece of work via `.countDown()`, while one or more separate threads wait for all of them via `.await()` — useful when the waiting thread didn't necessarily create the worker threads itself (so it may not have direct `Thread` references to call `.join()` on), or when you want threads to wait for a count of *events* rather than for specific `Thread` objects to terminate.

---

> 🧠 **Memory hook:** "A raw `Thread` per task is hiring and firing an employee for every single job; an `ExecutorService` is a standing team pulling from a shared task queue — and `AtomicInteger` gets the same correct headcount as `synchronized`, just without ever making anyone wait in line."
