# Interprocess Communication (IPC) — Complete Guide

## Table of Contents
1. [Why IPC is Needed](#1-why-ipc-is-needed)
2. [Pipes](#2-pipes)
3. [Message Queues](#3-message-queues)
4. [Shared Memory](#4-shared-memory)
5. [Sockets](#5-sockets)
6. [Choosing the Right Mechanism](#6-choosing-the-right-mechanism)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why IPC is Needed

As established in Lesson 01, each process has its own **isolated address space** — that isolation is a safety feature, but it also means processes can't just read each other's variables the way threads can. If two separate processes need to cooperate — share data, coordinate work, or send results to each other — they need an OS-provided channel to do it. That's **Interprocess Communication (IPC)**.

```
Process A                         Process B
┌────────────┐                  ┌────────────┐
│ address     │   ✗ direct read │ address     │
│ space A     │   ✗ direct write │ space B     │
└────────────┘                  └────────────┘
      │                                │
      └──────── IPC mechanism ─────────┘
        (pipe / queue / shared memory / socket)
```

Common IPC mechanisms — each with different trade-offs in speed, complexity, and use case: **pipes, message queues, shared memory, and sockets**.

---

## 2. Pipes

A **pipe** is a unidirectional (one-way) byte stream connecting two related processes, typically a parent and its child. Think of it as a temporary in-memory "tube" — one process writes bytes in one end, the other reads them out the other end, in order (FIFO).

```
Process A (writer)                Process B (reader)
   write("hello") ──▶ [ kernel buffer: pipe ] ──▶ read() returns "hello"

   Classic shell example:  ls -l | grep "txt"
   ls writes its output into the pipe; grep reads from it.
```

- **Anonymous pipes**: exist only between related processes (e.g., parent/child via `fork()`); disappear once both ends close. This is exactly what the shell's `|` operator uses.
- **Named pipes (FIFOs)**: have a name/path in the filesystem, so *unrelated* processes can open and use them too.

| Trade-off | Detail |
|-----------|--------|
| Speed | Fast — pure in-kernel memory buffer, no disk I/O |
| Simplicity | Very simple API (`read`/`write`, feels like a file) |
| Direction | Unidirectional (need two pipes for bidirectional communication) |
| Relationship | Anonymous pipes require a common ancestor process; named pipes don't |
| Data format | Raw byte stream — no built-in message boundaries |

---

## 3. Message Queues

A **message queue** is a kernel-managed queue of discrete, structured messages that processes can send to and receive from, without needing to be related or connected at the same time.

```
Process A                    Message Queue                Process B
                            (kernel-managed)
  send({type:1, data:"job1"}) ──▶ [msg1][msg2][msg3] ──▶ receive() → gets msg1
  send({type:2, data:"job2"}) ──▶                      (can filter by message type)
```

Unlike a pipe's raw byte stream, messages have **boundaries** — a receiver gets one complete message at a time, not an arbitrary chunk of bytes. Many implementations also support **message type/priority filtering**, so a receiver can selectively pull only the messages it cares about.

| Trade-off | Detail |
|-----------|--------|
| Speed | Fast (in-kernel), though generally a bit more overhead than raw pipes due to message framing |
| Structure | Preserves message boundaries — no manual parsing of a byte stream needed |
| Decoupling | Sender and receiver don't need to be running at the same time (queue persists messages) |
| Ordering/filtering | Supports priority or type-based selective reads (not just strict FIFO) |
| Use case | Task/job queues, decoupled producer-consumer systems |

---

## 4. Shared Memory

**Shared memory** maps the *same* physical memory region into the address spaces of two or more processes, so they can read/write it directly — like threads sharing memory within a process, but explicitly opted-into by separate processes.

```
Process A address space         Process B address space
┌─────────────┐                ┌─────────────┐
│  private mem │                │  private mem │
│              │                │              │
│  ┌─────────┐ │                │ ┌─────────┐  │
│  │ shared   │◀┼────────────────┼▶│ shared   │  │  ← SAME physical memory,
│  │ segment  │ │                │ │ segment  │  │     mapped into both
│  └─────────┘ │                │ └─────────┘  │
└─────────────┘                └─────────────┘

Process A writes to the shared segment → Process B sees the change
immediately, with NO kernel involvement in the data transfer itself.
```

This is by far the **fastest** IPC mechanism because, once set up, reading/writing shared memory involves **zero kernel calls or data copying** — it's just normal memory access. The catch: because multiple processes can write to it simultaneously, you must handle synchronization yourself (typically with a semaphore, also provided by the OS) to avoid race conditions — the exact same problem threads face with shared memory (Lesson 02).

| Trade-off | Detail |
|-----------|--------|
| Speed | Fastest — no copying, no kernel mediation for actual data access |
| Complexity | Highest — must manually synchronize access (semaphores/mutexes) to avoid race conditions |
| Setup cost | Some upfront kernel calls to create/attach the shared segment |
| Use case | High-throughput scenarios: shared caches, large data buffers passed between cooperating processes |

---

## 5. Sockets

A **socket** is a communication endpoint that can connect processes across a network — or on the same machine — using standard networking APIs (TCP/UDP, or Unix domain sockets for local-only communication). Sockets are the only IPC mechanism in this list that naturally extends beyond a single machine.

```
Process A (machine 1)                          Process B (machine 2)
┌──────────┐   TCP/IP over the network        ┌──────────┐
│  socket   │ ───────────────────────────────▶ │  socket   │
└──────────┘ ◀─────────────────────────────── └──────────┘

Same API works locally too, via Unix domain sockets:
Process A (localhost) ──── Unix domain socket ──── Process B (localhost)
   (skips the network stack — faster than TCP for same-machine IPC)
```

| Trade-off | Detail |
|-----------|--------|
| Speed | Slower than shared memory/pipes for local IPC (protocol overhead), but the only option across machines |
| Scope | Works both locally and across a network — the most flexible |
| Complexity | Moderate — need to manage connections, serialization of data |
| Use case | Client-server systems, microservices, anything that might need to scale beyond one machine |

---

## 6. Choosing the Right Mechanism

| Need | Best Fit |
|------|----------|
| Simple one-way stream between parent and child (e.g., shell pipelines) | Pipe |
| Discrete structured messages, sender/receiver not always both alive, job queues | Message Queue |
| Maximum throughput, large data, both processes always on the same machine | Shared Memory (+ semaphore) |
| Communication might cross machine boundaries, or building a client-server system | Socket |
| Local-only, but want socket-style API without network overhead | Unix domain socket |

```
Speed intuition (same-machine, roughly fastest → slowest):

Shared Memory  >  Pipes / Message Queues  >  Unix Domain Sockets  >  TCP Sockets (loopback)  >  TCP Sockets (network)
```

---

## 7. Hands-On Exercises

**Exercise 1:** In a terminal, run `ls -l | wc -l` and explain, in your own words, exactly which IPC mechanism connects `ls` and `wc`, and what's flowing through it.

**Exercise 2:** Write a Python script using `os.pipe()`, `os.fork()`, and `os.write`/`os.read` to send a string from a parent process to a child process:

```python
import os

read_fd, write_fd = os.pipe()
pid = os.fork()

if pid == 0:  # child: reader
    os.close(write_fd)
    r = os.fdopen(read_fd)
    print("Child received:", r.read())
else:  # parent: writer
    os.close(read_fd)
    w = os.fdopen(write_fd, 'w')
    w.write("hello from parent")
    w.close()
    os.wait()
```

**Exercise 3:** Use Python's `multiprocessing.Queue` to send 5 numbers from a producer process to a consumer process, and have the consumer print their sum. Note how this hides the underlying message-queue mechanics behind a simple API.

**Exercise 4:** Use Python's `multiprocessing.shared_memory.SharedMemory` (or `multiprocessing.Value`/`Array`) to create an integer shared between a parent and a child process; have the child increment it 100,000 times without a lock, then with a `multiprocessing.Lock()`, and compare results — same race condition risk as Lesson 02's threading exercise, but now across processes.

**Exercise 5:** Write two tiny Python scripts using the `socket` module: one that listens on `localhost:9999` and echoes back anything it receives, and another that connects and sends a message. Run the listener first, then the sender, and observe the echoed reply.

---

## 8. Interview Q&A

**Q: Why do processes need IPC while threads don't (as much)?**
Answer: Threads within the same process already share the same address space, so they can directly read/write shared variables. Processes have isolated address spaces by design (for safety and stability), so they need OS-provided channels — IPC mechanisms — to exchange data or coordinate, since neither can simply reach into the other's memory.

**Q: What's the difference between a pipe and a message queue?**
Answer: A pipe is a raw, unidirectional byte stream with no built-in message boundaries — the reader just gets whatever bytes are available. A message queue preserves discrete message boundaries, lets the sender and receiver run at different times (the queue persists messages), and often supports filtering by message type or priority — not just strict FIFO byte-streaming.

**Q: Why is shared memory the fastest IPC mechanism?**
Answer: Because after the initial setup, reading and writing shared memory is just a normal memory access — no kernel call, no data copying between address spaces. Every other IPC mechanism (pipes, queues, sockets) requires the kernel to copy data from the sender's buffer into a kernel buffer and then into the receiver's buffer, which costs CPU time and context switches.

**Q: What's the main risk of using shared memory, and how is it addressed?**
Answer: Since multiple processes can read/write the same memory concurrently, it's vulnerable to race conditions — the exact same class of bug threads face when sharing memory. It's addressed with synchronization primitives, typically OS-provided semaphores or mutexes, that processes use to coordinate safe access to the shared region.

**Q: When would you use a socket instead of a pipe or shared memory for IPC on the same machine?**
Answer: When there's a chance the communicating processes might one day run on different machines, or when building toward a client-server/microservices architecture where the communication protocol needs to be networkable from day one. Unix domain sockets give a socket-style API with lower overhead than a real network socket while staying local-only.

**Q: What's the difference between an anonymous pipe and a named pipe (FIFO)?**
Answer: An anonymous pipe only exists between processes with a common ancestor (typically parent and child via fork()) and disappears once both ends are closed — it has no filesystem presence. A named pipe (FIFO) has a path in the filesystem, so any two processes that know that path can open and communicate through it, even if they're unrelated.

**Q: If you needed to pass a large video file's worth of data between two processes on the same machine as fast as possible, which IPC mechanism would you choose and why?**
Answer: Shared memory — because it avoids the repeated kernel-mediated copying that pipes, message queues, and sockets all require. For large payloads, that copying overhead dominates; shared memory lets both processes access the same physical bytes directly, at the cost of needing to manually synchronize access with a semaphore.
