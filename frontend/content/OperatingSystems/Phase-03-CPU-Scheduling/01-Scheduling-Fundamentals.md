# Scheduling Fundamentals — Complete Guide

## Table of Contents
1. [Why Scheduling Exists](#1-why-scheduling-exists)
2. [The CPU Scheduler's Job](#2-the-cpu-schedulers-job)
3. [Scheduling Criteria](#3-scheduling-criteria)
4. [Preemptive vs Non-Preemptive Scheduling](#4-preemptive-vs-non-preemptive-scheduling)
5. [Dispatcher and Context Switch](#5-dispatcher-and-context-switch)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Scheduling Exists

A computer typically has far fewer CPU cores than it has runnable processes. Your laptop might have 8 cores but run 300+ processes. CPU scheduling is the mechanism the OS uses to decide **which process gets the CPU next, and for how long**.

```
Without scheduling:
  1 CPU core, 5 processes wanting to run
  → Only one can run "for real" → someone has to decide the order
  → No decision = first process grabs the CPU and never lets go
  → Every other process starves forever

With scheduling:
  OS scheduler picks process order based on a policy
  → P1 runs a bit → P2 runs a bit → P3 runs a bit → ...
  → Illusion of "everything running at once" (time-sharing)
```

This matters even more once you remember most processes aren't 100% CPU-bound — they spend time waiting on disk, network, or user input. A good scheduler keeps the CPU busy with *someone* useful instead of sitting idle while one process waits on I/O.

```
CPU-bound process:   [-----CPU-----][-----CPU-----][-----CPU-----]
I/O-bound process:   [CPU][------I/O wait------][CPU][----I/O----]

Goal: while I/O-bound process waits on disk, let CPU-bound process use the CPU.
      Never leave the CPU idle if there's runnable work.
```

---

## 2. The CPU Scheduler's Job

The **short-term scheduler** (a.k.a. CPU scheduler) picks one process from the **ready queue** (processes in memory, ready to run, just waiting for CPU) and hands it to the CPU.

```
                     ┌─────────────────┐
   New process ─────▶│   Ready Queue   │
                     │  [P1][P2][P3]   │
                     └────────┬────────┘
                              │ scheduler picks one
                              ▼
                     ┌─────────────────┐
                     │   CPU (running)  │
                     └────────┬────────┘
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              I/O wait   Preempted   Terminates
              (back to    (back to    (exits)
               ready       ready
               queue        queue
               later)       now)
```

This runs constantly and must be **fast** — it's invoked on every context switch, potentially thousands of times per second.

---

## 3. Scheduling Criteria

Different algorithms optimize for different things. These are the metrics you use to judge and compare them — and the ones interviewers expect you to define precisely.

| Metric | Definition | Formula |
|--------|-----------|---------|
| **Arrival Time (AT)** | When the process enters the ready queue | given |
| **Burst Time (BT)** | Total CPU time the process needs | given |
| **Completion Time (CT)** | When the process finishes execution | observed from Gantt chart |
| **Turnaround Time (TAT)** | Total time from arrival to completion | `CT - AT` |
| **Waiting Time (WT)** | Time spent in ready queue, not running | `TAT - BT` |
| **Response Time (RT)** | Time from arrival to *first* time it gets the CPU | `(first time on CPU) - AT` |
| **Throughput** | Number of processes completed per unit time | `count / total time` |
| **CPU Utilization** | % of time CPU is doing useful work (not idle) | `busy time / total time` |

### Why these specific metrics?

- **Turnaround time** matters to a batch job — "how long until my whole report is generated?"
- **Waiting time** is the part of turnaround time that's pure overhead — the process wasn't running, it was just sitting in line.
- **Response time** matters for interactive systems — you don't care how long your entire shell session takes, you care how fast the terminal echoes your keystroke.
- **Throughput** matters to the system operator — how many jobs can this machine chew through per hour?
- **CPU utilization** is the "don't waste the hardware" metric.

```
Timeline for one process:

  arrival        first run       completion
     │               │                │
     ▼               ▼                ▼
─────●───(wait)───────●====(CPU burst)====●──────▶ time
     │◄── Response ───►│
     │◄──────────── Turnaround Time ─────────────►│
     │◄─────── Waiting Time ────────►│◄─ Burst ──►│
```

A well-designed scheduler usually trades one metric against another — minimizing average waiting time can hurt response time for long jobs, and vice versa. There is no algorithm that wins on every metric simultaneously; that trade-off is the entire reason multiple scheduling algorithms exist.

---

## 4. Preemptive vs Non-Preemptive Scheduling

### Non-Preemptive (Cooperative)

Once a process gets the CPU, it keeps it until it **voluntarily** gives it up — either it finishes, or it blocks on I/O.

```
Non-preemptive:
  P1 starts running ────────────────────────────▶ P1 finishes (or blocks on I/O)
  Nobody can interrupt P1, even if P2 (higher priority) arrives mid-way.

Timeline:
  |----------- P1 (burst=10) -----------|-- P2 --|
  0                                     10        13
  Even if P2 arrives at t=2, it must wait until t=10.
```

**Examples:** FCFS, non-preemptive SJF, non-preemptive Priority scheduling.

**Pros:** Simple to implement, no overhead from interrupting processes, no risk of race conditions mid-execution.
**Cons:** A single long process can block everything else — bad for interactive/real-time systems.

### Preemptive

The scheduler can **forcibly** take the CPU away from a running process — usually because a timer interrupt fired, or a higher-priority process just became ready.

```
Preemptive:
  P1 starts running, but is interrupted when P2 (higher priority) arrives.

Timeline:
  |-- P1 --|------ P2 ------|-- P1 (resumed) --|
  0        2                 6                  9
  P1 ran 0-2, got preempted at t=2 when P2 arrived, resumed at t=6.
```

**Examples:** Round Robin, preemptive SJF (a.k.a. Shortest Remaining Time First), preemptive Priority scheduling, Linux CFS.

**Pros:** Better response time, fairer sharing of the CPU, essential for interactive and real-time systems.
**Cons:** Context-switch overhead, need synchronization (locks) to protect shared data structures because a process can be interrupted at any point — this is precisely where race conditions come from (covered in Phase 04).

| | Preemptive | Non-Preemptive |
|---|---|---|
| CPU can be taken away mid-burst | Yes | No |
| Response time | Better | Worse (for short jobs stuck behind long ones) |
| Overhead | Higher (context switches) | Lower |
| Needs synchronization primitives | Yes | Less critical |
| Real-world use | Modern OS (Linux, Windows) | Old batch systems, some embedded RTOS |

---

## 5. Dispatcher and Context Switch

The **dispatcher** is the module that actually gives control of the CPU to the process the scheduler picked. It does three things:

1. **Context switch** — save the current process's CPU state (registers, program counter, stack pointer) into its Process Control Block (PCB), and load the next process's saved state.
2. **Switch to user mode** — if it was in kernel mode.
3. **Jump** to the correct location in the new process's code to resume it.

```
Context switch cost is pure overhead — no useful work happens during it.

  Process A running ──▶ [SAVE A's state] ──▶ [LOAD B's state] ──▶ Process B running
                          "dispatch latency" (a few microseconds, but adds up)

If you switch too often (tiny time quantum), overhead dominates.
If you switch too rarely (huge time quantum), response time suffers.
```

This is exactly why the choice of time quantum in Round Robin (Phase 03-03) is a real engineering trade-off, not an arbitrary number.

---

## 6. Hands-On Exercises

**Exercise 1:** A process arrives at t=0, first gets the CPU at t=5, and completes at t=12 with a burst time of 7. Compute its waiting time, turnaround time, and response time.

**Exercise 2:** Explain in your own words why minimizing average waiting time and minimizing average response time can conflict for the same process set. Give a concrete two-process example.

**Exercise 3:** List three real-world scenarios where non-preemptive scheduling would be acceptable, and three where it would be unacceptable. Justify each.

**Exercise 4:** A system completes 120 processes in 60 seconds. Compute throughput. If the CPU was idle for 6 of those 60 seconds, compute CPU utilization.

**Exercise 5:** Explain why a context switch is "pure overhead" and describe two ways an OS designer could reduce the total time lost to context switching without hurting responsiveness.

---

## 7. Interview Q&A

**Q: What is the difference between waiting time and turnaround time?**
Answer: Turnaround time is the total time from when a process arrives to when it completes (`CT - AT`) — it includes both waiting and actual execution. Waiting time is only the portion of turnaround time spent sitting in the ready queue, not running (`TAT - BT`). Every process's turnaround time equals its waiting time plus its burst time.

**Q: What is response time and why does it matter separately from turnaround time?**
Answer: Response time is how long a process waits before it gets the CPU for the *first* time (`first CPU time - AT`). It matters for interactive systems: a user typing in a terminal cares about instant feedback (response time), not how long the entire background compilation job takes (turnaround time). A system can have great average turnaround time but terrible response time if it services one process at a time to completion.

**Q: What's the difference between preemptive and non-preemptive scheduling?**
Answer: In non-preemptive scheduling, once a process gets the CPU it keeps it until it finishes or voluntarily blocks (e.g., on I/O) — nothing can interrupt it. In preemptive scheduling, the OS can forcibly take the CPU away, typically via a timer interrupt or when a higher-priority process arrives. Preemptive scheduling gives better responsiveness but adds context-switch overhead and requires synchronization to protect shared state.

**Q: Why can't a scheduler optimize for every criterion (throughput, waiting time, response time) simultaneously?**
Answer: These metrics pull in different directions. Minimizing average waiting time favors running short jobs first, which can starve long jobs and hurt their turnaround time. Maximizing throughput favors keeping the CPU always busy with whatever job is cheapest to run, which may not be fair. Minimizing response time favors frequent context switches (small time slices), which reduces throughput because of switching overhead. Every scheduling algorithm is a specific trade-off among these goals for a specific workload type (batch vs interactive vs real-time).

**Q: What does the dispatcher do, and why is context-switch time considered overhead?**
Answer: The dispatcher is the component that performs the actual mechanics of switching the CPU from one process to another: saving the outgoing process's register state into its PCB, loading the incoming process's saved state, and jumping to its instruction pointer. This is called overhead because no useful application work happens during a context switch — it's pure bookkeeping cost. If the scheduler switches processes too frequently, this cost can dominate and reduce effective throughput.

**Q: Give an example of when non-preemptive scheduling is actually the right choice.**
Answer: Non-preemptive scheduling is fine for batch systems processing jobs where responsiveness doesn't matter — e.g., an overnight ETL/report-generation pipeline where jobs run to completion one after another. It's also used in some simple embedded/real-time systems where the job set is small, well-understood, and cooperative, because it avoids the overhead and complexity of context switches and synchronization.
