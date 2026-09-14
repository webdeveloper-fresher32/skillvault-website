# Project 04 — Multithreaded Task Processor

## Goal

Build a small batch task processor that submits independent units of simulated work to a thread pool, collects each result safely, and aggregates a shared value across threads without a race condition — practicing the `ExecutorService`/`Future` and thread-safety techniques from Phase 8.

## What You'll Build

A program that generates a batch of "tasks" (each simulating work with `Thread.sleep` and returning a computed value), submits them to an `ExecutorService`-backed fixed thread pool, collects each task's result via `Future`, and separately maintains a shared, thread-safe counter of how many tasks have completed successfully.

## Phases Required

- Phase 8 — Concurrency and Multithreading

## Requirements

- Model each unit of work as a `Callable<Integer>` (not a plain `Runnable`) so each task can return a real result, per Phase 8 Lesson 2.
- Submit at least 10 tasks to an `Executors.newFixedThreadPool(n)` pool with `n` smaller than the number of tasks, so you can observe tasks queuing and reusing worker threads rather than one thread per task.
- Collect every task's `Future<Integer>` in a list, in submission order, and retrieve every result with `.get()` only after all tasks have been submitted — not immediately after each individual `.submit()` call.
- Maintain a shared `AtomicInteger` counter that every task increments (via `incrementAndGet()`) exactly once, immediately before it returns its result, and print the final count after all tasks complete.
- Call `executor.shutdown()` after all results have been retrieved, and confirm (e.g. by checking `executor.isShutdown()`, or simply that the program exits cleanly) that no lingering threads keep the JVM alive.
- Handle the checked exceptions `.get()` can throw (`InterruptedException`, `ExecutionException`) — don't swallow them with an empty `catch`.

## Suggested Approach

1. Write a single task-generating method or lambda that simulates work with a short `Thread.sleep(...)` and returns a deterministic, checkable value (e.g. its own index squared, so you can verify correctness afterward, similar to the course's `n * n` example).
2. Create the fixed thread pool, choosing a pool size clearly smaller than your task count (e.g. pool of 3 for 10 tasks) so pooling/reuse is actually observable.
3. Submit all tasks in a loop, storing each returned `Future<Integer>` in a `List<Future<Integer>>` in the same order they were submitted.
4. In a second loop (after all submissions are done), call `.get()` on each `Future` in order and print the results, confirming they match your expected values regardless of which worker thread actually computed them.
5. Add the shared `AtomicInteger` counter, incremented inside each task, and print its final value — it must equal your total task count every single run.
6. Call `.shutdown()` once everything is retrieved, and re-run the whole program several times to confirm the final `AtomicInteger` count is always correct (demonstrating the absence of a race condition, unlike an unsynchronized shared `int` would show).

## Stretch Goals

- Add a second, deliberately unsynchronized `int` counter incremented alongside the `AtomicInteger` one, run the program several times, and observe (and explain in a comment) how its final value can come out lower than expected due to a genuine race condition — then remove it once you've made your point.
- Use a `CountDownLatch` to have a separate "reporter" thread print "All tasks finished" only once every task's `countDown()` call has happened, independently of the `Future`-based result collection.
- Replace the shared counter's synchronization mechanism with a `synchronized` block instead of `AtomicInteger`, and compare the two approaches in a short comment, per the course's `synchronized` vs `AtomicInteger` comparison table.

## Evaluation Checklist

- [ ] Tasks are modeled as `Callable<Integer>`, not `Runnable`, and each returns a real, verifiable value.
- [ ] Results are printed in submission order and match the expected computed values on every run.
- [ ] The shared `AtomicInteger` counter's final value equals the total task count on every run, with no synchronization bugs.
- [ ] `.get()` is called only after all tasks are submitted, not immediately after each submission.
- [ ] `executor.shutdown()` is called, and the program exits cleanly without hanging.
- [ ] `InterruptedException` and `ExecutionException` are both handled explicitly, not caught generically or ignored.
