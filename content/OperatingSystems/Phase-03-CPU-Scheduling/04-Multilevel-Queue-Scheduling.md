# Multilevel Queue Scheduling — Complete Guide

## Table of Contents
1. [Why One Algorithm Isn't Enough](#1-why-one-algorithm-isnt-enough)
2. [Multilevel Queue (MLQ) Scheduling](#2-multilevel-queue-mlq-scheduling)
3. [The Weakness of Fixed Queues](#3-the-weakness-of-fixed-queues)
4. [Multilevel Feedback Queue (MLFQ) Scheduling](#4-multilevel-feedback-queue-mlfq-scheduling)
5. [Worked MLFQ Walkthrough](#5-worked-mlfq-walkthrough)
6. [MLQ vs MLFQ Comparison](#6-mlq-vs-mlfq-comparison)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why One Algorithm Isn't Enough

Real systems run wildly different kinds of processes at once: a text editor waiting on keystrokes, a video encoder chewing through CPU nonstop, a background backup job, and a kernel task that must run instantly when triggered. No single algorithm from the previous lessons is great for all of them simultaneously:

```
Interactive process (needs fast response):  Round Robin with small quantum ✓
Batch/CPU-bound process (needs throughput):  FCFS or long quantum ✓
System/kernel process (needs priority):      Priority scheduling ✓

One process type ≠ one best algorithm for everyone.
```

Multilevel Queue scheduling solves this by **not choosing just one algorithm** — instead, it partitions processes into categories, and lets each category use whichever algorithm fits it best.

---

## 2. Multilevel Queue (MLQ) Scheduling

The ready queue is split into several **separate queues**, each with its own scheduling algorithm, and each queue is assigned a priority relative to the others. A process is assigned to exactly one queue for its entire lifetime — usually based on process type (system, interactive, batch).

```
                    ┌─────────────────────────────────┐
  Highest priority  │  Queue 1: System processes        │  → Priority / FCFS
                    │  [kernel tasks]                    │
                    └─────────────────────────────────┘
                    ┌─────────────────────────────────┐
                    │  Queue 2: Interactive processes    │  → Round Robin (q=8)
                    │  [shell, editor, UI apps]          │
                    └─────────────────────────────────┘
                    ┌─────────────────────────────────┐
  Lowest priority   │  Queue 3: Batch processes           │  → FCFS
                    │  [backups, report generation]      │
                    └─────────────────────────────────┘
```

### How Queues Are Scheduled Relative to Each Other

Two common approaches:

1. **Strict priority between queues** — Queue 1 must be completely empty before Queue 2 ever runs, and Queue 2 must be empty before Queue 3 runs. Risk: lower queues can starve entirely if the top queue is always busy.
2. **Time-slicing between queues** — each queue gets a percentage of CPU time regardless of the others, e.g., Queue 1 gets 50% of CPU time, Queue 2 gets 30%, Queue 3 gets 20%. This guarantees every queue makes *some* progress.

```
Strict priority:              Time-sliced between queues:
Q1 ████████████ (all of it)   Q1 ████████ (50%)
Q2 (only if Q1 empty)         Q2 █████ (30%)
Q3 (only if Q1,Q2 empty)      Q3 ███ (20%)
```

---

## 3. The Weakness of Fixed Queues

MLQ's biggest flaw: a process is assigned to a queue **once, permanently**, usually based on its type. This is rigid and doesn't adapt:

```
Problem 1: Misclassification
  A process might behave differently than expected —
  e.g., an "interactive" process that turns out to be CPU-heavy
  clogs the interactive queue for everyone else.

Problem 2: No promotion/demotion
  A batch process stuck in the low-priority queue has no way to
  "prove" it deserves better treatment, even if it starts behaving
  more interactively (e.g., frequent short bursts).

Problem 3: Starvation of lower queues
  Under strict priority, if Queue 1 (system) is always busy,
  Queue 3 (batch) may never run at all.
```

This rigidity is exactly what Multilevel Feedback Queue scheduling was designed to fix.

---

## 4. Multilevel Feedback Queue (MLFQ) Scheduling

MLFQ keeps the idea of multiple queues with different priorities, but adds one crucial capability: **processes can move between queues** based on their observed behavior. This is why it's called "feedback" — the scheduler adjusts its decisions based on how a process actually behaves, not just its type at admission.

### Core Rules (a common textbook formulation)

```
Rule 1: New processes start in the topmost (highest-priority) queue.

Rule 2: If a process uses its ENTIRE time quantum without finishing or
        blocking, it's demoted to the next lower-priority queue
        (it's probably CPU-bound — treat it more like batch work).

Rule 3: If a process gives up the CPU before its quantum expires
        (e.g., it blocks on I/O), it stays at the same level
        (it's probably interactive — reward that behavior).

Rule 4 (optional but common): After a process waits too long
        without running, promote it back up a level — this is
        aging, applied across queues to prevent starvation.
```

```
                    ┌───────────────────────────┐
  Highest priority  │  Queue 0 (quantum = 8)      │──uses full quantum──┐
                    └───────────────────────────┘                     │
                                  ▲                                    ▼
                        (aging promotes it back up)      ┌───────────────────────────┐
                                  │                        │  Queue 1 (quantum = 16)     │──uses full quantum──┐
                                  │                        └───────────────────────────┘                     │
                                  │                                                                            ▼
                                  │                                                              ┌───────────────────────────┐
                                  └──────────────────────────────────────────────────────────────│  Queue 2 (FCFS, no limit)   │
                                                                                                   └───────────────────────────┘
```

This design self-corrects: interactive processes (short bursts, frequent I/O blocking) naturally stay near the top and get fast response times. CPU-bound processes sink to the bottom where they get long, uninterrupted time slices — good for throughput, and they don't hog the top queue's fast response times meant for interactive work.

---

## 5. Worked MLFQ Walkthrough

Three queues: **Q0** (quantum=4, highest priority), **Q1** (quantum=8), **Q2** (FCFS, lowest priority).

| Process | AT | BT | Behavior |
|---------|----|----|----|
| P1 | 0 | 20 | Pure CPU-bound, never blocks |
| P2 | 2 | 3 | Short interactive burst |

**Step through:**
- `t=0`: P1 arrives, placed in Q0. Runs for `min(4,20)=4` units (t=0–4). Uses its **entire quantum without finishing** → demoted to Q1.
- `t=2`: (while P1 was running) P2 arrives, placed in Q0 (new processes always start at Q0).
- `t=4`: Q0 has P2 waiting (higher priority queue than P1's new home in Q1) → run P2. P2 needs only 3 units, finishes at t=7, **before** using its full quantum of 4 → it would've stayed in Q0 if it needed to run again (it doesn't, it's done).
- `t=7`: Q0 empty, Q1 has P1 (remaining 16) → run P1 for `min(8,16)=8` units (t=7–15). Uses full quantum again → demoted to Q2.
- `t=15`: Q2 (FCFS, no quantum limit) → P1 runs to completion: remaining 8 units, t=15–23.

```
Gantt Chart:
 ┌────────────┬─────────┬────────────────────────┬────────────────────────┐
 │  P1 (Q0)    │ P2 (Q0)  │        P1 (Q1)           │        P1 (Q2)           │
 └────────────┴─────────┴────────────────────────┴────────────────────────┘
 0            4         7                        15                       23
```

| Process | AT | BT | CT | TAT | WT |
|---------|----|----|----|-----|-----|
| P2 | 2 | 3 | 7 | 5 | 2 |
| P1 | 0 | 20 | 23 | 23 | 3 |

P2 (the short, interactive-style job) got a fast turnaround (5) despite arriving after P1, because MLFQ's feedback mechanism demoted the CPU-hog P1 out of the way. This is the entire point of MLFQ: it approximates "run short jobs first" **without needing to know burst times in advance** — the queue level is inferred from observed behavior.

---

## 6. MLQ vs MLFQ Comparison

| | Multilevel Queue (MLQ) | Multilevel Feedback Queue (MLFQ) |
|---|---|---|
| Queue assignment | Fixed at process creation | Dynamic — changes based on behavior |
| Adapts to changing process behavior | No | Yes |
| Risk of starvation | High (lower queues can starve) | Lower (aging promotes long-waiting processes) |
| Complexity | Simpler | More complex (needs demotion/promotion rules) |
| Approximates SJF without knowing burst times | No | Yes, effectively |
| Real-world usage | Older Unix systems, simple partitioned systems | Windows NT/CFS-adjacent designs, historical Linux `O(1)` scheduler concepts |

---

## 7. Hands-On Exercises

**Exercise 1:** Design a 3-queue MLQ setup for a system running system daemons, a web server handling requests, and nightly log-rotation jobs. Assign each to a queue, pick an algorithm per queue, and justify your choices.

**Exercise 2:** Explain, in your own words, why strict priority between queues in MLQ can cause starvation, and describe the alternative that avoids it.

**Exercise 3:** Given Q0 (quantum=2), Q1 (quantum=4), Q2 (FCFS), trace a CPU-bound process with burst time=10 through the queues using Rule 2 (demotion on quantum exhaustion). List which queue it's in during each segment and the segment's length.

**Exercise 4:** Explain why MLFQ is described as "approximating SJF without knowing burst times in advance." What observable signal does it use instead of the true burst time?

**Exercise 5:** A process has been waiting in Q2 (lowest queue) for a long time while higher queues stay busy. Describe the specific MLFQ rule that prevents it from starving forever, and explain how you'd tune its parameters (e.g., how often to check, how much to promote).

---

## 8. Interview Q&A

**Q: What is Multilevel Queue scheduling and why would a system use it instead of a single algorithm?**
Answer: MLQ partitions the ready queue into several separate queues (e.g., system, interactive, batch), each with its own scheduling algorithm suited to that category of work, and a priority ordering between queues. It exists because no single algorithm serves every kind of workload well — interactive processes want fast response (Round Robin), batch jobs want throughput (FCFS), and system tasks want guaranteed priority.

**Q: What is the main weakness of Multilevel Queue scheduling?**
Answer: A process is permanently assigned to one queue, usually at creation time, with no way to move between queues. This is rigid: it can't adapt if a process's actual behavior differs from its classification, and under strict inter-queue priority, lower-priority queues can starve completely if higher-priority queues stay busy.

**Q: How does Multilevel Feedback Queue (MLFQ) improve on plain Multilevel Queue scheduling?**
Answer: MLFQ allows processes to move between queues based on observed behavior instead of a fixed, permanent assignment. A process that uses its full time quantum without finishing (likely CPU-bound) gets demoted to a lower-priority queue with longer time slices; a process that blocks before its quantum expires (likely interactive) stays at its current level. This lets the scheduler adapt dynamically and approximates favoring short/interactive jobs without needing to know burst times in advance.

**Q: How does MLFQ prevent starvation of processes stuck in low-priority queues?**
Answer: Through aging applied across queue levels — a process that has waited too long without getting CPU time is periodically promoted back up to a higher-priority queue, guaranteeing it eventually gets scheduled regardless of how busy the top queues are.

**Q: What signal does MLFQ use to decide if a process is "interactive" vs "CPU-bound," given it doesn't know burst times in advance?**
Answer: It uses observed runtime behavior: if a process voluntarily gives up the CPU before its time quantum expires (typically because it's blocking on I/O), it's treated as interactive and stays at its current priority level. If it consumes its entire quantum without finishing, it's treated as CPU-bound and demoted to a lower, longer-quantum queue. This behavioral signal substitutes for knowing the true burst time ahead of time.

**Q: Give a real-world scenario where MLQ/MLFQ-style scheduling would clearly beat a single flat algorithm like FCFS or Round Robin.**
Answer: A shared server running a mix of a live web API (needs sub-millisecond response), interactive SSH sessions, and a nightly batch export job. A single Round Robin queue would give the batch job the same priority treatment as live API requests, hurting latency; a single FCFS queue risks the convoy effect if the batch job runs first. An MLFQ-style setup naturally keeps the low-latency API and SSH sessions in high-priority queues (since they block frequently and use short bursts) while the batch job sinks to a low-priority, high-throughput queue — without anyone having to manually classify every process.
