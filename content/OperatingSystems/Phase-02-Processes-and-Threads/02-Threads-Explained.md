# Threads Explained — Complete Guide

## Table of Contents
1. [What is a Thread?](#1-what-is-a-thread)
2. [Thread vs Process: Shared vs Isolated Memory](#2-thread-vs-process-shared-vs-isolated-memory)
3. [User Threads vs Kernel Threads](#3-user-threads-vs-kernel-threads)
4. [Multithreading: Benefits and Risks](#4-multithreading-benefits-and-risks)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. What is a Thread?

A **thread** is the smallest unit of CPU execution — a single sequential flow of instructions within a process. Every process has **at least one thread** (the main thread); a process can spawn additional threads that all run *within the same process*, doing work concurrently.

Think of a process as a **house**, and threads as **people living in it**. The people (threads) share the house's kitchen, living room, and address (the process's memory) — but each person still has their own personal to-do list and their own path through the house at any given moment (their own execution state).

```
Process "Web Server" (PID 500)
┌──────────────────────────────────────────────────────┐
│  Shared: code, global data, heap, open files, sockets │
│                                                        │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐        │
│  │ Thread 1   │   │ Thread 2   │   │ Thread 3   │        │
│  │ (handling  │   │ (handling  │   │ (handling  │        │
│  │  request A)│   │  request B)│   │  request C)│        │
│  │ own stack  │   │ own stack  │   │ own stack  │        │
│  │ own PC     │   │ own PC     │   │ own PC     │        │
│  │ own regs   │   │ own regs   │   │ own regs   │        │
│  └───────────┘   └───────────┘   └───────────┘        │
└──────────────────────────────────────────────────────┘
```

Each thread has its own:
- **Program counter** (where it currently is in the code)
- **Register set** (its own working values, saved on context switch)
- **Stack** (its own local variables and call frames)

But all threads in the same process **share**:
- Code segment (the instructions)
- Global/static data
- Heap (dynamically allocated memory)
- Open file descriptors and sockets

---

## 2. Thread vs Process: Shared vs Isolated Memory

This is the single most important distinction to internalize.

```
PROCESSES (isolated):
┌────────────────┐        ┌────────────────┐
│ Process A        │        │ Process B        │
│ own address space │        │ own address space │
│ ┌────┐            │        │ ┌────┐            │
│ │Heap │            │        │ │Heap │            │
│ └────┘            │        │ └────┘            │
└────────────────┘        └────────────────┘
   No shared memory by default. Must use IPC to communicate.

THREADS (shared):
┌───────────────────────────────────────────┐
│ Process A (single address space)            │
│  ┌────┐                                     │
│  │Heap │ ◀── shared by ALL threads below     │
│  └────┘                                     │
│  Thread 1 (own stack)  Thread 2 (own stack)  │
└───────────────────────────────────────────┘
   Threads read/write the SAME heap and globals directly — no IPC needed.
```

| Aspect | Process | Thread |
|--------|---------|--------|
| Memory | Own isolated address space | Shares address space with sibling threads |
| Communication | Needs IPC (pipes, sockets, shared memory) | Direct — read/write shared variables |
| Creation cost | Expensive (new address space, page tables, copy resources) | Cheap (just a new stack + register set) |
| Crash isolation | One process crashing doesn't affect another | One thread crashing (segfault) can take down the whole process |
| Context switch cost | Higher (must switch page tables/address space) | Lower (same address space, just swap registers/stack) |

This is *the* trade-off: threads are cheap and fast to communicate between, but that shared memory means bugs in one thread can corrupt data used by another — there's no OS-level safety net the way there is between processes.

---

## 3. User Threads vs Kernel Threads

Threads can be managed at two different levels, and this distinction shows up in interviews and in real runtime design (it's exactly why Node.js and Python behave the way they do).

### Kernel Threads

Threads that the **OS kernel itself** knows about, creates, schedules, and switches between. The kernel scheduler treats each kernel thread as a schedulable unit — it can run kernel threads from the same process on different CPU cores simultaneously (true parallelism).

### User Threads

Threads managed **entirely in user space** by a library or language runtime, with the kernel unaware that multiple threads even exist — the kernel just sees one single-threaded process. A user-space scheduler (part of the runtime) decides which user thread runs at any moment.

```
Kernel Threads (1:1 model):
┌─────────────────────────────┐
│   Kernel scheduler            │
│  ┌────┐  ┌────┐  ┌────┐      │
│  │ KT1 │  │ KT2 │  │ KT3 │      │  ◀── kernel sees & schedules each one
│  └────┘  └────┘  └────┘      │       can run on separate CPU cores
└─────────────────────────────┘

User Threads (N:1 model):
┌─────────────────────────────┐
│   Kernel scheduler             │
│         ┌────┐                │
│         │ 1 KT │  ◀── kernel sees only ONE thread
│         └──┬───┘                │
│    ┌───────┴────────┐          │
│  ┌────┐  ┌────┐  ┌────┐        │
│  │ UT1 │  │ UT2 │  │ UT3 │  ◀── user-space runtime multiplexes these
│  └────┘  └────┘  └────┘        │       cannot use multiple cores in parallel
└─────────────────────────────┘
```

| | User Threads | Kernel Threads |
|---|---|---|
| Managed by | Language runtime / library | OS kernel |
| Kernel visibility | Invisible to kernel (looks like 1 thread) | Fully visible, kernel schedules them |
| Creation/switch cost | Very cheap (no syscall needed) | More expensive (syscall + kernel scheduling) |
| True parallelism (multi-core) | No — limited by underlying kernel thread(s) | Yes — kernel can run them on separate cores |
| Blocking syscall behavior | One blocking call can block ALL user threads (in pure N:1 model) | Only that one kernel thread blocks |
| Real-world example | Python's threads under the GIL (concurrency, not parallelism, for CPU-bound work); Goroutines (M:N model) | Linux `pthread`, Java platform threads (mapped 1:1 to OS threads) |

Most modern systems (Linux `pthread`, Java) use a **1:1 model** — every user-visible thread maps directly to one kernel thread. Some hybrid systems use **M:N** — M user threads multiplexed over N kernel threads (Go's goroutines work this way).

---

## 4. Multithreading: Benefits and Risks

### Benefits

- **Responsiveness**: A GUI app can keep its UI thread responsive while a background thread does heavy work (e.g., loading a file).
- **Resource sharing without IPC overhead**: Threads share memory directly — no serialization, no pipes, no copying data between address spaces.
- **Cheaper than processes**: Creating a thread (new stack + registers) is far cheaper than creating a process (new address space, page tables, copied resources).
- **Parallelism on multi-core CPUs**: With true kernel threads, independent work can run simultaneously on separate cores, cutting wall-clock time for CPU-bound work.
- **Better utilization during I/O**: While one thread blocks on a network call, another thread can keep the CPU busy with other work.

### Risks

- **Race conditions**: Two threads reading/writing shared data at the same time without synchronization can produce corrupted or unpredictable results.
- **Deadlocks**: Threads waiting on each other's locks can freeze forever (covered in depth in Phase 05).
- **Harder debugging**: Bugs caused by thread timing (race conditions) are often non-deterministic — they may not reproduce reliably, making them notoriously hard to track down.
- **No crash isolation**: An unhandled exception or segfault in one thread can crash the entire process, taking down every other thread with it — unlike a crashing process, which doesn't affect its siblings.
- **Synchronization overhead**: Locks, semaphores, and mutexes needed to protect shared data add complexity and can themselves become a performance bottleneck (lock contention).

```
Race condition example — two threads incrementing a shared counter:

Shared variable: counter = 0

Thread A                     Thread B
--------                     --------
read counter (0)
                              read counter (0)
add 1 → 1
write counter = 1
                              add 1 → 1
                              write counter = 1

Expected result: counter == 2
Actual result:   counter == 1   ← lost update!
```

---

## 5. Hands-On Exercises

**Exercise 1:** Run this Python script and observe that both threads interleave their output — proving they run concurrently within one process:

```python
import threading
import time

def worker(name):
    for i in range(3):
        print(f"{name}: step {i}")
        time.sleep(0.1)

t1 = threading.Thread(target=worker, args=("Thread-A",))
t2 = threading.Thread(target=worker, args=("Thread-B",))
t1.start()
t2.start()
t1.join()
t2.join()
print("Both threads finished")
```

**Exercise 2:** Reproduce the race condition shown above. Run this WITHOUT a lock and note the final counter value is often wrong; then add a `threading.Lock()` and observe it's always correct:

```python
import threading

counter = 0
lock = threading.Lock()

def increment(use_lock):
    global counter
    for _ in range(100000):
        if use_lock:
            with lock:
                counter += 1
        else:
            counter += 1

threads = [threading.Thread(target=increment, args=(False,)) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print("Without lock, counter =", counter, "(expected 400000)")
```

**Exercise 3:** On Linux, run `ps -eLf | grep <your_process_name>` (or `cat /proc/<pid>/status | grep Threads`) to see how many kernel threads a running process (e.g., your browser or a Java app) actually has.

**Exercise 4:** Research (or recall) what Python's Global Interpreter Lock (GIL) is, and explain in your own words why `threading` in Python helps I/O-bound work but not CPU-bound work. Verify by timing a CPU-heavy loop (e.g., summing 10 million numbers) split across threads vs run in a single thread — notice threading gives little to no speedup.

**Exercise 5:** Sketch (on paper or in a text file) a diagram of a multithreaded web server handling 3 simultaneous requests — one thread per request, all sharing a single in-memory cache (a shared dictionary). Mark where a race condition could occur if two requests write to the cache at the same time.

---

## 6. Interview Q&A

**Q: What is a thread, and how is it different from a process?**
Answer: A thread is the smallest unit of CPU execution — a single flow of instructions with its own program counter, registers, and stack. A process is a container that owns memory and resources and has at least one thread inside it. The key difference: threads within the same process share the same address space (heap, globals, files), while separate processes have isolated address spaces.

**Q: Why are threads considered "lightweight" compared to processes?**
Answer: Creating a thread only requires allocating a new stack and register set within an existing address space — no new page tables, no copying of memory, no new file descriptor table. Creating a process requires the OS to set up an entirely new address space and duplicate/allocate a full set of resources, which is significantly more expensive in both time and memory.

**Q: What's the difference between a user thread and a kernel thread?**
Answer: A kernel thread is created, scheduled, and managed directly by the OS kernel — the kernel is aware of it and can run it on any CPU core, enabling true parallelism. A user thread is managed by a library/runtime in user space, invisible to the kernel; the kernel only sees the underlying process (or kernel thread) it runs on top of, so pure user threads can't achieve real multi-core parallelism on their own.

**Q: What is a race condition, and how do you prevent it?**
Answer: A race condition happens when two or more threads access shared data concurrently, and the final outcome depends on the unpredictable timing/order of their execution — e.g., both threads read a value before either writes it back, so one thread's update gets silently lost. It's prevented with synchronization primitives — locks/mutexes, semaphores, or atomic operations — that ensure only one thread can modify the shared data at a time.

**Q: Why can a bug in one thread crash the entire process, while a crashing process doesn't affect other processes?**
Answer: Threads share the same address space, so a null pointer dereference, buffer overflow, or unhandled fatal exception in one thread corrupts or kills the shared memory/process the OS considers as a single crashable unit — taking every thread with it. Processes have separate, OS-enforced isolated address spaces, so the kernel can terminate one process without touching another's memory.

**Q: What is the 1:1 threading model versus the N:1 (or M:N) model?**
Answer: In the 1:1 model, every user-space thread is mapped to exactly one kernel thread — the kernel schedules each one individually, enabling true parallelism (Linux pthreads, Java platform threads use this). In the N:1 model, many user threads are multiplexed onto a single kernel thread by a user-space scheduler — cheap to create but no real parallelism, and one blocking syscall can stall all of them. M:N is a hybrid, mapping many user threads onto a smaller pool of kernel threads (Go's goroutines).

**Q: When would you choose multithreading over multiprocessing, and vice versa?**
Answer: Choose multithreading when tasks need to share data frequently and communication overhead must be minimal — e.g., a web server handling many concurrent I/O-bound connections. Choose multiprocessing when tasks are CPU-bound and need true parallel execution unencumbered by a shared-memory bottleneck (or language limitation like Python's GIL), or when you need strong fault isolation between tasks so one crashing task doesn't take down the others.
