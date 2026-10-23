# Context Switching — Complete Guide

## Table of Contents
1. [What is a Context Switch?](#1-what-is-a-context-switch)
2. [What Gets Saved and Restored](#2-what-gets-saved-and-restored)
3. [Step-by-Step Sequence](#3-step-by-step-sequence)
4. [Why Context Switches Are Expensive](#4-why-context-switches-are-expensive)
5. [What Triggers a Context Switch](#5-what-triggers-a-context-switch)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is a Context Switch?

A **context switch** is the mechanism the OS uses to stop running one process/thread and start running another on the same CPU core. Since a CPU core can only execute one instruction stream at a time, the illusion of "multiple programs running simultaneously" on a machine with fewer cores than processes is created by rapidly switching between them — often dozens or hundreds of times per second.

```
Single CPU core over time:

Time: 0ms      10ms      20ms      30ms      40ms
      │─────────│─────────│─────────│─────────│
      │ Process │ Process │ Process │ Process │
      │    A    │    B    │    A    │    C    │
      └─────────┴─────────┴─────────┴─────────┘
              ▲         ▲         ▲
        context    context    context
        switch     switch     switch

To a human, A, B, and C appear to run "at the same time" —
in reality the CPU is rapidly time-slicing between them.
```

The "context" being switched is everything that describes exactly where a process/thread was in its execution — its **CPU state** — so it can be paused and resumed with zero visible disruption to that program's logic.

---

## 2. What Gets Saved and Restored

When the OS decides to switch away from the currently running process, it must preserve a complete snapshot of its execution state into that process's **PCB** (see Lesson 01) before loading the next process's saved state from its own PCB.

| Saved/Restored Item | Why it's needed |
|----------------------|------------------|
| **Program Counter (PC)** | So the process resumes at the exact next instruction, not from the start |
| **CPU registers** (general-purpose, stack pointer, etc.) | Holds the process's in-flight computation values |
| **Process state** | Updated in the PCB (e.g., Running → Ready) |
| **Memory management info** | Page table pointers / MMU registers so the new process addresses its own memory correctly |
| **Scheduling info** | Priority, time-slice remaining, etc., updated for scheduling decisions |
| **Open file / I/O state** | Kept associated with the PCB so file operations resume correctly |

Note: for a **thread** context switch within the same process, memory management info (page tables) does **not** need to change — since sibling threads share the same address space, this makes thread context switches noticeably cheaper than process context switches.

---

## 3. Step-by-Step Sequence

```
STATE: Process A is RUNNING on the CPU. Process B is READY, waiting in the queue.

Step 1: Interrupt or system call occurs
        (timer interrupt, I/O request, higher-priority process ready, etc.)
                    │
                    ▼
Step 2: CPU traps into kernel mode
        (hardware forces a switch from user mode to kernel mode)
                    │
                    ▼
Step 3: Kernel saves Process A's context into A's PCB
        - program counter
        - CPU registers
        - stack pointer
        - update A's state: RUNNING → READY (or WAITING)
                    │
                    ▼
Step 4: Scheduler selects the next process to run
        - runs the scheduling algorithm (Phase 03) to pick Process B
                    │
                    ▼
Step 5: Kernel loads Process B's context from B's PCB
        - restore B's program counter
        - restore B's CPU registers
        - restore B's stack pointer
        - switch memory mappings (page tables) to B's address space
        - update B's state: READY → RUNNING
                    │
                    ▼
Step 6: CPU resumes execution of Process B
        exactly where B left off last time it ran
```

```
Timeline view:

Process A running ──▶ [SAVE A's context]──▶[scheduler picks B]──▶[LOAD B's context]──▶ Process B running
                        └──────────────── this whole gap = pure overhead, no useful work done ────────────────┘
```

---

## 4. Why Context Switches Are Expensive

A context switch does **zero useful application work** — it's pure bookkeeping overhead the OS pays so it can multitask. Several factors compound the cost:

1. **Direct CPU cost**: Saving/restoring registers and the program counter takes CPU cycles that produce no application progress.
2. **Kernel mode transition**: Switching from user mode to kernel mode and back has its own fixed overhead (mode switch, trap handling).
3. **Memory management overhead (process switches)**: Switching page tables/address spaces invalidates the **TLB (Translation Lookaside Buffer)** — a CPU cache that speeds up virtual-to-physical address translation. After a switch, the CPU has to slowly re-populate the TLB and CPU caches (L1/L2) with the new process's data, causing a burst of slower memory accesses (**cache pollution/cold cache** effect).
4. **Scheduler overhead**: The scheduling algorithm itself takes some time to run and decide who's next.

```
Cost comparison (approximate, illustrative — varies by hardware/OS):

Thread-to-thread switch (same process):     ~1-2 microseconds
Process-to-process switch (different addr.  ~5-20+ microseconds
  space, full TLB/cache flush):

Why the difference? Thread switches skip the page table swap and
suffer less TLB/cache invalidation since the address space is unchanged.
```

This is precisely why an OS or application design that minimizes unnecessary context switches (e.g., using thread pools instead of spawning excess threads/processes, or using async I/O instead of blocking + switching) tends to perform better under load.

---

## 5. What Triggers a Context Switch

| Trigger | Description |
|---------|-------------|
| **Timer interrupt (time-slice expiry)** | In preemptive multitasking, the OS gets a periodic timer interrupt; if the running process has used its allotted time slice, the scheduler preempts it |
| **I/O request** | The running process calls a blocking operation (file read, network call) — it moves to Waiting, and the CPU switches to another Ready process instead of idling |
| **I/O completion / interrupt** | A device signals completion (e.g., disk read finished) — the waiting process becomes Ready, and if it has higher priority, the scheduler may switch to it immediately |
| **System call that blocks** | E.g., waiting on a lock, semaphore, or `sleep()` — voluntarily yields the CPU |
| **Higher-priority process becomes ready** | In a priority-preemptive scheduler, a newly-ready higher-priority process can immediately preempt the current one |
| **Process termination** | The running process exits — the CPU must switch to whatever's next in the Ready queue |
| **Explicit yield** | A process/thread voluntarily calls something like `sched_yield()` to give up its remaining time slice |

---

## 6. Hands-On Exercises

**Exercise 1:** On Linux, run `vmstat 1` for 10 seconds and look at the `cs` column — that's the number of context switches per second on your system, live.

**Exercise 2:** Run `cat /proc/<pid>/status | grep ctxt` (Linux) for a busy process (e.g., your browser) to see `voluntary_ctxt_switches` (e.g., blocked on I/O) vs `nonvoluntary_ctxt_switches` (e.g., preempted by the scheduler) counts.

**Exercise 3:** Write a small Python script that spawns 20 threads, each looping and calling `time.sleep(0.001)` repeatedly for a few seconds. While it runs, watch `vmstat 1`'s `cs` column spike compared to when the script isn't running — that's context switch overhead from all those threads waking/sleeping.

**Exercise 4:** Compare timing: write a CPU-bound loop (summing numbers) run as (a) a single thread doing all the work vs (b) split across many more threads than CPU cores (e.g., 50 threads on a 4-core machine). Time both. Explain why (b) can be slower — think about context switch overhead per unit of useful work.

**Exercise 5:** Draw (on paper) the 6-step context switch sequence from Section 3 for a concrete scenario: Process A is running and calls `read()` on a slow network socket, and Process B (already in the Ready queue) gets the CPU next. Label each step with what's saved/restored.

---

## 7. Interview Q&A

**Q: What is a context switch?**
Answer: A context switch is when the OS saves the complete CPU state (registers, program counter, memory mappings) of the currently running process/thread into its PCB, then loads the saved state of a different process/thread from its PCB, so that process resumes execution exactly where it left off. It's how a CPU with few cores creates the illusion of running many programs simultaneously.

**Q: What specifically gets saved and restored during a context switch?**
Answer: The program counter, CPU registers (including the stack pointer), the process's state field in its PCB, and for process (not thread) switches, the memory management info — page table pointers/MMU registers — so the new process addresses its own memory space correctly. Scheduling metadata like priority and remaining time slice are also updated.

**Q: Why are context switches considered pure overhead?**
Answer: Because the CPU cycles spent saving and restoring state don't advance either process's actual computation — no application logic runs during the switch itself. On top of the direct save/restore cost, process switches also invalidate the TLB and CPU caches, forcing a slow "cache warm-up" period afterward where memory accesses are slower than normal, further eating into useful throughput.

**Q: Why is a thread context switch cheaper than a process context switch?**
Answer: Threads within the same process share one address space, so switching between them doesn't require swapping page tables or flushing the TLB/CPU cache — only registers, program counter, and stack pointer need to change. Process switches additionally swap the entire memory mapping, which is far more expensive due to TLB invalidation and cold caches.

**Q: What events can trigger a context switch?**
Answer: A timer interrupt signaling time-slice expiry, a process blocking on I/O or a lock, an I/O completion interrupt waking a higher-priority process, a process voluntarily yielding the CPU, or a process terminating. Broadly: preemption (forced by the scheduler/timer) or voluntary yielding (the process itself can't proceed and gives up the CPU).

**Q: What is the TLB and why does it matter for context switching?**
Answer: The TLB (Translation Lookaside Buffer) is a small, fast CPU cache that stores recent virtual-to-physical memory address translations, avoiding a slow page-table walk on every memory access. Switching to a different process's address space invalidates most of the TLB (its entries belong to the old process), so the new process suffers a burst of slower memory accesses until the TLB "warms up" again with its own translations.

**Q: How would you reduce context switch overhead in a high-throughput system?**
Answer: Use thread pools instead of creating a thread per task (fewer threads to schedule and switch between), prefer asynchronous/non-blocking I/O over spawning threads that block and get switched out, pin CPU-heavy threads to specific cores (CPU affinity) to preserve cache locality, and avoid over-provisioning far more runnable threads than available CPU cores.
