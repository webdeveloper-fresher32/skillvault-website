# Threading vs Multiprocessing in Python

## Table of Contents
1. [The Core Decision Rule](#1-the-core-decision-rule)
2. [Threading: Complete I/O-Bound Example](#2-threading-complete-io-bound-example)
3. [Multiprocessing: Complete CPU-Bound Example](#3-multiprocessing-complete-cpu-bound-example)
4. [Overhead Comparison](#4-overhead-comparison)
5. [concurrent.futures — One Interface for Both](#5-concurrentfutures--one-interface-for-both)
6. [Shared State: Threads vs Processes](#6-shared-state-threads-vs-processes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Core Decision Rule

```
                    ┌─────────────────────────┐
                    │   What is the task      │
                    │   mostly doing?         │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                    ▼
      WAITING on something                 COMPUTING (CPU busy)
      (network, disk, DB, sleep)           (loops, math, parsing)
              │                                    │
              ▼                                    ▼
      ┌───────────────┐                    ┌───────────────────┐
      │   THREADING    │                    │  MULTIPROCESSING   │
      │ (or asyncio)   │                    │                     │
      │ GIL released   │                    │ Separate GIL per   │
      │ during I/O wait│                    │ process = true     │
      │ → overlap works│                    │ parallel CPU use   │
      └───────────────┘                    └───────────────────┘
```

| | Threading | Multiprocessing |
|---|---|---|
| Best for | I/O-bound (network calls, file I/O, DB queries) | CPU-bound (image processing, number crunching, parsing) |
| Parallelism | Concurrent, not parallel (GIL) — but I/O overlaps | True parallel execution across cores |
| Memory | Shared address space (same process) | Separate memory per process (must serialize to share) |
| Startup cost | Cheap (~sub-millisecond) | Expensive (new interpreter per process, tens of ms) |
| Communication | Shared variables + locks | `Queue`, `Pipe`, or shared memory (`multiprocessing.shared_memory`) |
| Crash isolation | One thread crashing can take down the process | One process crashing doesn't affect siblings |

---

## 2. Threading: Complete I/O-Bound Example

This simulates 5 "network calls" (via `time.sleep`, which releases the GIL just like a real socket call would) — once sequentially, once with threads.

```python
"""
threading_io_bound.py

Run with: python3 threading_io_bound.py

Simulates 5 slow I/O operations (e.g., API calls) — shows threading
DOES give real speedup here because time.sleep() releases the GIL,
just like real network/disk I/O does.
"""
import threading
import time


def fetch_url(url: str, results: list, index: int) -> None:
    """Simulate a network request that takes ~1 second."""
    time.sleep(1)  # stand-in for a real requests.get(url) call
    results[index] = f"data from {url}"


urls = [
    "https://api.example.com/users",
    "https://api.example.com/orders",
    "https://api.example.com/products",
    "https://api.example.com/reviews",
    "https://api.example.com/inventory",
]

# --- 1. Sequential baseline ---
results = [None] * len(urls)
start = time.perf_counter()
for i, url in enumerate(urls):
    fetch_url(url, results, i)
sequential_time = time.perf_counter() - start
print(f"Sequential: {sequential_time:.2f}s for {len(urls)} requests")

# --- 2. Threaded version ---
results = [None] * len(urls)
start = time.perf_counter()
threads = []
for i, url in enumerate(urls):
    t = threading.Thread(target=fetch_url, args=(url, results, i))
    threads.append(t)
    t.start()

for t in threads:
    t.join()
threaded_time = time.perf_counter() - start
print(f"Threaded:   {threaded_time:.2f}s for {len(urls)} requests")
print(f"\nSpeedup: {sequential_time / threaded_time:.2f}x")
```

**Typical output:**
```
Sequential: 5.02s for 5 requests
Threaded:   1.01s for 5 requests

Speedup: 4.97x
```

Nearly a 5x speedup with 5 threads — because each thread spends 99% of its time *waiting* (GIL released), not computing. This is the textbook case where threading shines despite the GIL.

---

## 3. Multiprocessing: Complete CPU-Bound Example

A realistic CPU-bound task: checking a list of large numbers for primality.

```python
"""
multiprocessing_cpu_bound.py

Run with: python3 multiprocessing_cpu_bound.py

Checks a list of large numbers for primality — a genuinely CPU-heavy
task. Compares sequential vs multiprocessing.Pool.
"""
import time
from multiprocessing import Pool, cpu_count


def is_prime(n: int) -> bool:
    if n < 2:
        return False
    for i in range(2, int(n ** 0.5) + 1):
        if n % i == 0:
            return False
    return True


NUMBERS = [112272535095293, 112582705942171, 112272535095293,
           115280098190773, 115797848077099, 1099726899285419] * 2


if __name__ == "__main__":
    # --- 1. Sequential baseline ---
    start = time.perf_counter()
    results_seq = [is_prime(n) for n in NUMBERS]
    sequential_time = time.perf_counter() - start
    print(f"Sequential: {sequential_time:.2f}s")

    # --- 2. Multiprocessing Pool — distributes work across cores ---
    start = time.perf_counter()
    with Pool(processes=cpu_count()) as pool:
        results_mp = pool.map(is_prime, NUMBERS)
    mp_time = time.perf_counter() - start
    print(f"Multiprocessing ({cpu_count()} processes): {mp_time:.2f}s")

    print(f"\nSpeedup: {sequential_time / mp_time:.2f}x")
    assert results_seq == results_mp  # sanity check: same answers
```

**Typical output on an 8-core machine:**
```
Sequential: 4.31s
Multiprocessing (8 processes): 0.71s

Speedup: 6.07x
```

`Pool.map` splits `NUMBERS` across worker processes automatically — each number's primality check runs on a separate core, in a separate interpreter with its own GIL, so they truly overlap.

---

## 4. Overhead Comparison

Startup cost matters when tasks are short-lived — spawning too eagerly can cost more than it saves.

```python
"""
overhead_comparison.py

Run with: python3 overhead_comparison.py

Measures the raw cost of starting a thread vs a process,
doing (almost) nothing in the target function.
"""
import threading
import multiprocessing
import time


def noop():
    pass


N = 100

if __name__ == "__main__":
    # Thread startup overhead
    start = time.perf_counter()
    for _ in range(N):
        t = threading.Thread(target=noop)
        t.start()
        t.join()
    thread_overhead = time.perf_counter() - start
    print(f"{N} threads started+joined: {thread_overhead:.3f}s "
          f"({thread_overhead / N * 1000:.2f}ms each)")

    # Process startup overhead
    start = time.perf_counter()
    for _ in range(N):
        p = multiprocessing.Process(target=noop)
        p.start()
        p.join()
    process_overhead = time.perf_counter() - start
    print(f"{N} processes started+joined: {process_overhead:.3f}s "
          f"({process_overhead / N * 1000:.2f}ms each)")

    print(f"\nProcesses are ~{process_overhead / thread_overhead:.0f}x "
          f"more expensive to start than threads")
```

**Typical output:**
```
100 threads started+joined: 0.021s (0.21ms each)
100 processes started+joined: 2.840s (28.40ms each)

Processes are ~135x more expensive to start than threads
```

This is why long-lived worker pools (`ThreadPoolExecutor` / `ProcessPoolExecutor`, or `multiprocessing.Pool`) reuse workers instead of spawning a new thread/process per task — pay the startup cost once, not per unit of work.

---

## 5. concurrent.futures — One Interface for Both

`concurrent.futures` gives you the **same API** — submit tasks, get back `Future` objects — whether you're using threads or processes underneath. Swapping `ThreadPoolExecutor` for `ProcessPoolExecutor` is often a one-line change.

```python
"""
concurrent_futures_demo.py

Run with: python3 concurrent_futures_demo.py

Same code shape, two different executors — pick based on
whether the task is I/O-bound or CPU-bound.
"""
import time
import math
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed


def io_task(n: int) -> str:
    time.sleep(0.5)  # simulate network/disk wait
    return f"I/O task {n} done"


def cpu_task(n: int) -> float:
    return math.factorial(n)  # simulate CPU-heavy work


if __name__ == "__main__":
    # --- I/O-bound: ThreadPoolExecutor ---
    print("Running I/O-bound tasks with ThreadPoolExecutor...")
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(io_task, i) for i in range(5)]
        for future in as_completed(futures):
            print(" ", future.result())
    print(f"Took {time.perf_counter() - start:.2f}s\n")

    # --- CPU-bound: ProcessPoolExecutor ---
    print("Running CPU-bound tasks with ProcessPoolExecutor...")
    start = time.perf_counter()
    with ProcessPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(cpu_task, 100_000) for _ in range(4)]
        for future in as_completed(futures):
            result = future.result()
            print(f"  factorial computed, digits: {len(str(result))}")
    print(f"Took {time.perf_counter() - start:.2f}s")
```

**Key API points:**
- `executor.submit(fn, *args)` returns a `Future` immediately (non-blocking).
- `future.result()` blocks until that specific task finishes and returns its value (re-raises any exception the task raised).
- `as_completed(futures)` yields futures as they finish, not in submission order — useful for "process results as they arrive."
- `executor.map(fn, iterable)` is a simpler alternative to `submit` + `as_completed` when you don't need per-task control and want results in input order.
- Both executors support the same `with ... as executor:` context manager, which calls `shutdown(wait=True)` automatically — no leaked threads/processes.

This is the interface most production code should reach for first — it hides the raw `threading.Thread` / `multiprocessing.Process` bookkeeping (starting, joining, exception propagation) that Sections 2 and 3 did by hand.

---

## 6. Shared State: Threads vs Processes

```
Threading — same process, same memory:

  Process
  ┌─────────────────────────────────────────┐
  │  shared_list = []          ◀── all threads see the SAME object
  │                                          │
  │  Thread A ──▶ shared_list.append(1)      │
  │  Thread B ──▶ shared_list.append(2)      │
  │  (need a Lock to avoid race conditions   │
  │   on compound operations)                │
  └─────────────────────────────────────────┘

Multiprocessing — separate processes, separate memory:

  Process 1                    Process 2
  ┌─────────────┐              ┌─────────────┐
  │ my_list = []│              │ my_list = []│   ◀── DIFFERENT objects,
  └──────┬──────┘              └──────┬──────┘       different memory
         │                            │
         └──────────┬─────────────────┘
                     ▼
           multiprocessing.Queue()
           (data is pickled, sent through
            an OS pipe, unpickled on the
            other side — no shared memory
            by default)
```

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:          # without this lock, counter += 1 is NOT atomic
            counter += 1    # (read, add, write — a classic race condition)

threads = [threading.Thread(target=increment) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)  # 400000, guaranteed correct ONLY because of the lock
```

For multiprocessing, use `multiprocessing.Queue`, `multiprocessing.Pipe`, or `multiprocessing.Value`/`Array` (backed by shared memory) to pass data between processes — plain Python objects are NOT shared automatically because each process has its own memory space.

---

## 7. Hands-On Exercises

**Exercise 1:** Take `threading_io_bound.py` and increase the number of simulated URLs to 20. Does the speedup keep scaling linearly with more threads? At what point would you expect diminishing returns (hint: think about `ThreadPoolExecutor(max_workers=N)` and what happens if N is smaller than the number of tasks)?

**Exercise 2:** Rewrite `multiprocessing_cpu_bound.py` to use `ProcessPoolExecutor` from `concurrent.futures` instead of `multiprocessing.Pool`. Confirm you get equivalent results and similar timing.

**Exercise 3:** In the shared-counter example in Section 6, remove the `with lock:` line and run it several times. Do you always get 400000? Explain what a race condition looks like in the output, and why removing the lock breaks the `counter += 1` operation even though it looks like one line.

**Exercise 4:** Write a small script using `multiprocessing.Queue` where a "producer" process pushes 10 numbers onto the queue and a "consumer" process pops and prints them. This demonstrates that processes must explicitly communicate — they don't share the queue by default reference, they share it via `multiprocessing`'s IPC machinery.

**Exercise 5:** Using `concurrent.futures`, write a hybrid pipeline: use a `ThreadPoolExecutor` to "download" (simulate with `time.sleep`) 5 fake files concurrently, then feed the results into a `ProcessPoolExecutor` that does CPU-heavy "processing" (e.g., `hashlib.sha256` in a tight loop) on each downloaded result. This mirrors a common real-world pattern: I/O-bound fetch stage feeding a CPU-bound compute stage.

---

## 8. Interview Q&A

**Q: When would you choose threading over multiprocessing in Python, and vice versa?**
Answer: Choose threading when the task is I/O-bound — waiting on network calls, disk reads, or database queries — because the GIL is released during blocking I/O, so threads genuinely overlap their waiting time, and threads are cheap to create. Choose multiprocessing when the task is CPU-bound — heavy computation, parsing, image/video processing — because each process gets its own interpreter and GIL, enabling true parallel execution across CPU cores, at the cost of higher memory use and slower startup.

**Q: Why is starting a process so much more expensive than starting a thread?**
Answer: A thread shares the parent process's memory space, loaded code, and open file descriptors — the OS just needs to allocate a stack and schedule it, which is cheap (sub-millisecond). A process needs its own memory space; depending on the start method (`fork`, `spawn`, `forkserver`), it may need to copy or reinitialize a full Python interpreter, re-import modules, and set up separate OS-level resources — often 10-100x more expensive than a thread.

**Q: How do you share data between two processes if they don't share memory?**
Answer: Through explicit inter-process communication mechanisms: `multiprocessing.Queue` or `Pipe` (data is pickled, sent through an OS-level pipe, and unpickled on the receiving end), or shared-memory constructs like `multiprocessing.Value`, `Array`, or `shared_memory.SharedMemory` for cases where copying/pickling overhead is unacceptable.

**Q: What does `concurrent.futures` give you that raw `threading`/`multiprocessing` doesn't?**
Answer: A unified, higher-level API — `ThreadPoolExecutor` and `ProcessPoolExecutor` both expose `submit()`, `map()`, and `Future` objects with `.result()`. It handles worker pool lifecycle (reusing workers instead of spawning per task), exception propagation (an exception raised in a worker is re-raised when you call `.result()`), and lets you swap between threads and processes by changing one class name, without rewriting your task-dispatch logic.

**Q: Why does `counter += 1` need a lock even in a single Python statement?**
Answer: `counter += 1` isn't atomic at the bytecode level — it compiles to separate "load counter," "add 1," "store counter" steps. Even though the GIL prevents two threads' bytecode from executing at the *exact* same instant, the GIL can switch to another thread *between* those bytecode steps, so two threads can interleave a read-before-write and lose an update. A `threading.Lock` (or `multiprocessing.Lock` for processes) ensures the whole read-modify-write sequence completes without interruption.

**Q: If a task has both an I/O-bound fetch phase and a CPU-bound processing phase, what's a sensible design?**
Answer: Use a `ThreadPoolExecutor` (or `asyncio`) for the fetch/I/O phase to overlap network waits, then hand the fetched data to a `ProcessPoolExecutor` for the CPU-heavy processing phase so it runs in parallel across cores. This two-stage pipeline uses the right tool for each phase's bottleneck instead of forcing one concurrency model to handle both.
