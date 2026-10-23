# FCFS and SJF Scheduling — Complete Guide

## Table of Contents
1. [First-Come-First-Served (FCFS)](#1-first-come-first-served-fcfs)
2. [The Convoy Effect](#2-the-convoy-effect)
3. [Shortest-Job-First (SJF) — Non-Preemptive](#3-shortest-job-first-sjf--non-preemptive)
4. [Shortest-Remaining-Time-First (SRTF) — Preemptive SJF](#4-shortest-remaining-time-first-srtf--preemptive-sjf)
5. [FCFS vs SJF Comparison](#5-fcfs-vs-sjf-comparison)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. First-Come-First-Served (FCFS)

The simplest possible scheduling algorithm: processes run in the exact order they arrive in the ready queue. It's **non-preemptive** — once a process starts, it runs to completion.

### Worked Example

| Process | Arrival Time (AT) | Burst Time (BT) |
|---------|--------------------|--------------------|
| P1 | 0 | 5 |
| P2 | 1 | 3 |
| P3 | 2 | 8 |
| P4 | 3 | 6 |

Processes run strictly in arrival order: P1, P2, P3, P4.

```
Gantt Chart:
 ┌────────┬────────┬────────────────┬──────────────────┐
 │   P1   │   P2   │       P3       │        P4         │
 └────────┴────────┴────────────────┴──────────────────┘
 0        5        8               16                  22
```

### Computing the Metrics

| Process | AT | BT | CT | TAT (CT−AT) | WT (TAT−BT) |
|---------|----|----|----|-----|-----|
| P1 | 0 | 5 | 5 | 5 | 0 |
| P2 | 1 | 3 | 8 | 7 | 4 |
| P3 | 2 | 8 | 16 | 14 | 6 |
| P4 | 3 | 6 | 22 | 19 | 13 |

```
Average Waiting Time    = (0 + 4 + 6 + 13) / 4 = 23 / 4 = 5.75
Average Turnaround Time = (5 + 7 + 14 + 19) / 4 = 45 / 4 = 11.25
```

FCFS is trivial to implement (literally a FIFO queue) but has no concept of "fairness" toward short jobs — notice P4 waited 13 units just because it happened to land behind a long process P3.

---

## 2. The Convoy Effect

The **convoy effect** is what happens when a long CPU-bound process holds the CPU while several short processes queue up behind it — everyone's average waiting time balloons, even though the short jobs could've been finished almost instantly if scheduled first. FCFS is the textbook example of an algorithm that suffers from this.

### Worked Example — Same Set, FCFS vs SJF Order

| Process | AT | BT |
|---------|----|----|
| P1 | 0 | 24 |
| P2 | 0 | 3 |
| P3 | 0 | 3 |

**FCFS order (P1, P2, P3):**

```
 ┌────────────────────────┬─────┬─────┐
 │           P1            │ P2  │ P3  │
 └────────────────────────┴─────┴─────┘
 0                        24    27    30
```

| Process | CT | TAT | WT |
|---------|----|----|----|
| P1 | 24 | 24 | 0 |
| P2 | 27 | 27 | 24 |
| P3 | 30 | 30 | 27 |

```
Average Waiting Time = (0 + 24 + 27) / 3 = 51 / 3 = 17
```

P2 and P3 each only need 3 units of CPU time, but they're stuck behind P1's 24-unit burst — this is the convoy effect. In real systems this is exactly what happens when a CPU-bound batch job blocks a bunch of quick, I/O-bound interactive requests from ever reaching the CPU.

**Same set, reordered shortest-first (P2, P3, P1):**

```
 ┌─────┬─────┬────────────────────────┐
 │ P2  │ P3  │           P1            │
 └─────┴─────┴────────────────────────┘
 0     3     6                        30
```

| Process | CT | TAT | WT |
|---------|----|----|----|
| P2 | 3 | 3 | 0 |
| P3 | 6 | 6 | 3 |
| P1 | 30 | 30 | 6 |

```
Average Waiting Time = (0 + 3 + 6) / 3 = 9 / 3 = 3
```

Same processes, same total work, radically better average waiting time (3 vs 17) just by running short jobs first. This is exactly the motivation for SJF.

---

## 3. Shortest-Job-First (SJF) — Non-Preemptive

At every scheduling decision point, pick the process in the ready queue with the **smallest burst time**. Once chosen, it runs to completion (non-preemptive) — even if a shorter job arrives while it's running.

### Worked Example

| Process | AT | BT |
|---------|----|----|
| P1 | 0 | 6 |
| P2 | 1 | 8 |
| P3 | 2 | 7 |
| P4 | 3 | 3 |

**Step through the decisions:**
- `t=0`: Only P1 has arrived → run P1 (no choice yet).
- `t=6`: P1 finishes. P2(8), P3(7), P4(3) have all arrived → shortest is P4(3) → run P4.
- `t=9`: P4 finishes. Remaining: P2(8), P3(7) → shortest is P3(7) → run P3.
- `t=16`: P3 finishes. Only P2(8) left → run P2.

```
Gantt Chart:
 ┌────────────┬───────┬────────────────┬────────────────────────┐
 │     P1     │  P4   │       P3       │           P2            │
 └────────────┴───────┴────────────────┴────────────────────────┘
 0            6       9               16                        24
```

### Computing the Metrics

| Process | AT | BT | CT | TAT | WT |
|---------|----|----|----|-----|-----|
| P1 | 0 | 6 | 6 | 6 | 0 |
| P4 | 3 | 3 | 9 | 6 | 3 |
| P3 | 2 | 7 | 16 | 14 | 7 |
| P2 | 1 | 8 | 24 | 23 | 15 |

```
Average Waiting Time    = (0 + 3 + 7 + 15) / 4 = 25 / 4 = 6.25
Average Turnaround Time = (6 + 6 + 14 + 23) / 4 = 49 / 4 = 12.25
```

Note: SJF is **provably optimal** for minimizing average waiting time when all processes are available at t=0 — but it needs to know burst times in advance, which is impossible in general (the OS estimates it, e.g. via an exponentially-weighted average of past bursts). It can also **starve** long processes if short jobs keep arriving (see aging in `03-Priority-and-Round-Robin.md`).

---

## 4. Shortest-Remaining-Time-First (SRTF) — Preemptive SJF

The preemptive version of SJF: whenever a **new process arrives**, compare its burst time against the **remaining time** of the currently running process. If the new arrival is shorter, preempt immediately.

### Worked Example

| Process | AT | BT |
|---------|----|----|
| P1 | 0 | 8 |
| P2 | 1 | 4 |
| P3 | 2 | 9 |
| P4 | 3 | 5 |

**Step through the decisions (checking remaining time at every arrival):**
- `t=0`: only P1 (rem 8) → run P1.
- `t=1`: P2 arrives (rem 4). P1's remaining is 7. 4 < 7 → **preempt**, run P2.
- `t=2`: P3 arrives (rem 9). P2's remaining is 3. 9 > 3 → keep running P2.
- `t=3`: P4 arrives (rem 5). P2's remaining is 2. 5 > 2 → keep running P2.
- `t=5`: P2 finishes (ran 1→5, 4 units total). Candidates: P1(rem 7), P3(rem 9), P4(rem 5) → shortest is P4 → run P4.
- `t=10`: P4 finishes (ran 5→10). Candidates: P1(rem 7), P3(rem 9) → shortest is P1 → run P1.
- `t=17`: P1 finishes (ran 10→17). Only P3(rem 9) left → run P3.
- `t=26`: P3 finishes.

```
Gantt Chart:
 ┌──┬────────────┬────────────────────┬────────────────────┬────────────────────────┐
 │P1│     P2      │         P4          │          P1          │           P3            │
 └──┴────────────┴────────────────────┴────────────────────┴────────────────────────┘
 0  1            5                    10                    17                        26
```

### Computing the Metrics

| Process | AT | BT | CT | TAT (CT−AT) | WT (TAT−BT) |
|---------|----|----|----|-----|-----|
| P1 | 0 | 8 | 17 | 17 | 9 |
| P2 | 1 | 4 | 5 | 4 | 0 |
| P3 | 2 | 9 | 26 | 24 | 15 |
| P4 | 3 | 5 | 10 | 7 | 2 |

```
Average Waiting Time    = (9 + 0 + 15 + 2) / 4 = 26 / 4 = 6.5
Average Turnaround Time = (17 + 4 + 24 + 7) / 4 = 52 / 4 = 13
```

Notice P1 got preempted at t=1 after running just 1 unit, and had to wait all the way until t=10 to resume — this is the cost SRTF pays in fairness (and context-switch overhead) in exchange for better responsiveness for short jobs.

---

## 5. FCFS vs SJF Comparison

| | FCFS | SJF (non-preemptive) | SRTF (preemptive SJF) |
|---|---|---|---|
| Preemptive? | No | No | Yes |
| Needs burst time in advance? | No | Yes (estimated) | Yes (estimated) |
| Optimal for average waiting time? | No | Yes (among non-preemptive) | Yes (among all algorithms) |
| Suffers convoy effect? | Yes | No | No |
| Can starve processes? | No | Yes (long jobs) | Yes (long jobs, worse) |
| Implementation complexity | Trivial | Moderate | Higher (needs preemption + re-comparison on every arrival) |
| Best for | Simple batch systems | Batch systems where burst times are predictable | Systems needing fast response with some batch predictability |

---

## 6. Hands-On Exercises

**Exercise 1:** Given P1(AT=0,BT=4), P2(AT=1,BT=3), P3(AT=2,BT=1), P4(AT=3,BT=5), draw the FCFS Gantt chart and compute average waiting time and average turnaround time.

**Exercise 2:** Using the same process set from Exercise 1, schedule with non-preemptive SJF instead. Draw the Gantt chart and compute both averages. Compare against your FCFS answer — which is better and by how much?

**Exercise 3:** Given P1(AT=0,BT=10), P2(AT=2,BT=2), P3(AT=2,BT=2), P4(AT=2,BT=2), demonstrate the convoy effect: compute average waiting time under FCFS order (P1,P2,P3,P4) vs a shortest-first order.

**Exercise 4:** Given P1(AT=0,BT=7), P2(AT=2,BT=4), P3(AT=4,BT=1), P4(AT=5,BT=4), schedule using SRTF. Walk through each arrival event, decide whether to preempt, draw the Gantt chart, and compute average waiting time.

**Exercise 5:** Explain, without doing any math, why SRTF's average waiting time can never be worse than non-preemptive SJF's for the same process set.

---

## 7. Interview Q&A

**Q: What is FCFS scheduling and what is its biggest weakness?**
Answer: FCFS runs processes strictly in arrival order, non-preemptively. Its biggest weakness is the convoy effect: if a long CPU-bound process arrives before several short processes, all the short processes get stuck waiting behind it, dramatically increasing average waiting time even though the total work is unchanged.

**Q: What is the convoy effect and how does SJF solve it?**
Answer: The convoy effect occurs when short processes queue up behind one long-running process, inflating average waiting time. SJF solves it by always picking the shortest available job next, so short jobs finish quickly instead of being blocked — this is provably optimal for minimizing average waiting time when all jobs are available at the same time.

**Q: Why is SJF rarely used exactly as described in real operating systems?**
Answer: SJF requires knowing each process's burst time in advance, which is generally impossible — you don't know how long a process will run until it's done. Real systems approximate it by predicting future burst time from a process's recent history (e.g., an exponentially-weighted moving average of past CPU bursts), which is only ever an estimate, not a guarantee.

**Q: What's the difference between SJF and SRTF (Shortest Remaining Time First)?**
Answer: SJF is non-preemptive — once a job starts, it runs to completion even if a shorter job arrives. SRTF is the preemptive version: whenever a new process arrives, the scheduler compares its burst time to the *remaining* time of the currently running process, and preempts if the new one is shorter. SRTF gives better average waiting time than SJF but adds context-switch overhead and can be less predictable.

**Q: Can SJF or SRTF cause starvation? How?**
Answer: Yes. If short jobs keep arriving continuously, a long process can be perpetually pushed to the back of the queue and never get scheduled — it "starves." This is a fundamental risk of any algorithm that always favors one class of jobs (short ones) over another (long ones), and is the motivating problem behind aging, covered in the next lesson.

**Q: How do you compute waiting time and turnaround time from a Gantt chart?**
Answer: From the Gantt chart you read off each process's completion time (CT) — the point where its last segment ends. Turnaround time is `CT - AT` (arrival time). Waiting time is `TAT - BT` (burst time) — i.e., turnaround time minus the time actually spent executing. Averaging each across all processes gives average turnaround time and average waiting time.
