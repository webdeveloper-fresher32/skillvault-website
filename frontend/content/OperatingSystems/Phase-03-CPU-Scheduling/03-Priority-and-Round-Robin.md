# Priority and Round Robin Scheduling — Complete Guide

## Table of Contents
1. [Priority Scheduling](#1-priority-scheduling)
2. [Starvation and Aging](#2-starvation-and-aging)
3. [Round Robin Scheduling](#3-round-robin-scheduling)
4. [Choosing the Time Quantum](#4-choosing-the-time-quantum)
5. [Priority vs Round Robin Comparison](#5-priority-vs-round-robin-comparison)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Priority Scheduling

Each process is assigned a **priority number**, and the scheduler always picks the process with the highest priority from the ready queue. By convention (used throughout this lesson, and in Linux's `nice` values), **lower number = higher priority**.

Priority scheduling can be **non-preemptive** (a running process finishes its burst even if a higher-priority process arrives) or **preemptive** (a higher-priority arrival interrupts the current process immediately). We'll work a non-preemptive example here.

### Worked Example (Non-Preemptive)

| Process | AT | BT | Priority (1 = highest) |
|---------|----|----|------|
| P1 | 0 | 4 | 2 |
| P2 | 1 | 3 | 1 |
| P3 | 2 | 1 | 4 |
| P4 | 3 | 5 | 3 |

**Step through the decisions:**
- `t=0`: only P1 has arrived → run P1 (no choice).
- `t=4`: P2, P3, P4 have all arrived. Priorities: P2=1, P4=3, P3=4 → highest priority is P2 → run P2.
- `t=7`: Remaining: P3(priority 4), P4(priority 3) → P4 has higher priority → run P4.
- `t=12`: Only P3 left → run P3.

```
Gantt Chart:
 ┌────────────┬───────────────────┬────────────────────────────┬──────┐
 │     P1     │        P2          │             P4               │  P3  │
 └────────────┴───────────────────┴────────────────────────────┴──────┘
 0            4                   7                            12     13
```

### Computing the Metrics

| Process | AT | BT | Priority | CT | TAT | WT |
|---------|----|----|----|----|-----|-----|
| P1 | 0 | 4 | 2 | 4 | 4 | 0 |
| P2 | 1 | 3 | 1 | 7 | 6 | 3 |
| P4 | 3 | 5 | 3 | 12 | 9 | 4 |
| P3 | 2 | 1 | 4 | 13 | 11 | 10 |

```
Average Waiting Time    = (0 + 3 + 4 + 10) / 4 = 17 / 4 = 4.25
Average Turnaround Time = (4 + 6 + 9 + 11) / 4 = 30 / 4 = 7.5
```

Look closely at P3: it has a tiny burst time (1 unit) but the **lowest priority**, so it waited 10 units — longer than everyone else — despite being the cheapest job to finish. This is the seed of the starvation problem below.

---

## 2. Starvation and Aging

### The Problem: Starvation

If low-priority processes keep getting passed over in favor of higher-priority arrivals, they can wait **indefinitely** — this is called **starvation**. A steady stream of high-priority processes can keep a low-priority process out of the CPU forever, not just for a long time.

```
Ready queue keeps receiving high-priority processes:

  t=0:  [P_low(pri=9)]
  t=1:  [P_low(pri=9), P_new1(pri=2)]      ← P_new1 jumps ahead
  t=2:  [P_low(pri=9), P_new2(pri=3)]      ← P_new2 also jumps ahead
  t=3:  [P_low(pri=9), P_new3(pri=1)]      ← keeps happening...

  P_low never becomes the highest-priority process in the queue → never runs.
```

### The Fix: Aging

**Aging** gradually increases the priority of a process the longer it waits, guaranteeing it will eventually become the highest-priority process in the queue and get scheduled.

```
Aging in action (lower number = higher priority, priority improves as number decreases):

  Process P_low starts at priority 9.
  Every 1000ms it waits without running, priority decreases by 1 (i.e., improves):

  t=0ms:     priority = 9
  t=1000ms:  priority = 8   (waited too long, bumped up)
  t=2000ms:  priority = 7
  ...
  t=8000ms:  priority = 1   (now higher priority than almost everything)

  Eventually P_low's priority beats every newly-arriving process → it finally runs.
```

Aging is the standard fix used in virtually every production priority scheduler, including how Linux's older O(1) scheduler and various priority-based real-time schedulers avoid starving low-priority tasks.

---

## 3. Round Robin Scheduling

Round Robin (RR) is designed specifically for **time-sharing, interactive** systems. Each process gets a fixed slice of CPU time called a **time quantum** (or time slice). If a process doesn't finish within its quantum, it's preempted and moved to the back of the ready queue; the next process in line runs.

### Worked Example — Time Quantum = 4

| Process | AT | BT |
|---------|----|----|
| P1 | 0 | 5 |
| P2 | 1 | 4 |
| P3 | 2 | 2 |
| P4 | 3 | 1 |

**Step through the ready queue (FIFO), applying quantum = 4:**
- `t=0`: Queue = `[P1]`. Run P1 for `min(4, 5) = 4` units → t=0 to 4. P1 has 1 unit remaining.
  - While P1 ran, P2 (t=1), P3 (t=2), P4 (t=3) arrived — added to queue in arrival order.
- `t=4`: P1 not finished → moved to back of queue. Queue = `[P2, P3, P4, P1(rem 1)]`.
- Run P2 for `min(4, 4) = 4` units → t=4 to 8. P2 finishes exactly (no remainder).
- `t=8`: Queue = `[P3, P4, P1(rem 1)]`. Run P3 for `min(4, 2) = 2` units → t=8 to 10. P3 finishes.
- `t=10`: Queue = `[P4, P1(rem 1)]`. Run P4 for `min(4, 1) = 1` unit → t=10 to 11. P4 finishes.
- `t=11`: Queue = `[P1(rem 1)]`. Run P1 for `min(4, 1) = 1` unit → t=11 to 12. P1 finishes.

```
Gantt Chart:
 ┌────────────────┬────────────────────┬─────────┬─────┬─────┐
 │       P1         │         P2          │   P3    │ P4  │ P1  │
 └────────────────┴────────────────────┴─────────┴─────┴─────┘
 0                4                    8        10    11    12
```

### Computing the Metrics

| Process | AT | BT | CT | TAT | WT |
|---------|----|----|----|-----|-----|
| P1 | 0 | 5 | 12 | 12 | 7 |
| P2 | 1 | 4 | 8 | 7 | 3 |
| P3 | 2 | 2 | 10 | 8 | 6 |
| P4 | 3 | 1 | 11 | 8 | 7 |

```
Average Waiting Time    = (7 + 3 + 6 + 7) / 4 = 23 / 4 = 5.75
Average Turnaround Time = (12 + 7 + 8 + 8) / 4 = 35 / 4 = 8.75
```

Notice how RR distributes CPU access fairly — P4, despite arriving last, gets its 1-unit burst done relatively quickly because everyone only holds the CPU briefly before yielding.

---

## 4. Choosing the Time Quantum

The time quantum size is the single biggest tuning knob in Round Robin, and it's a direct trade-off against context-switch overhead (from `01-Scheduling-Fundamentals.md`).

```
Quantum too small (e.g., q=1):
  ├─┤├─┤├─┤├─┤├─┤├─┤├─┤├─┤├─┤├─┤   → tons of context switches
  Great response time, but overhead can dominate — system spends more
  time switching than doing work ("thrashing" on scheduling itself).

Quantum too large (e.g., q=1000):
  ├──────────────────────────────┤   → behaves almost like FCFS
  Low overhead, but poor response time — RR degenerates back toward
  the convoy-effect problem it was designed to avoid.

Rule of thumb: 80% of CPU bursts should be shorter than the time quantum.
Typical real-world values: ~10-100ms.
```

---

## 5. Priority vs Round Robin Comparison

| | Priority Scheduling | Round Robin |
|---|---|---|
| Basis for decision | Explicit priority value | Arrival order + fixed time slice |
| Preemptive? | Can be either | Always preemptive (by the timer) |
| Fairness | Can starve low-priority processes | Fair by design — everyone gets a turn |
| Needs aging to avoid starvation? | Yes | No (inherently starvation-free) |
| Best for | Systems with real notion of task importance (OS kernel tasks, real-time) | Time-sharing / interactive systems |
| Response time for short jobs | Depends entirely on priority assignment | Bounded — at most `(n-1) × quantum` wait per round |

---

## 6. Hands-On Exercises

**Exercise 1:** Given P1(AT=0,BT=6,Pri=3), P2(AT=1,BT=2,Pri=1), P3(AT=2,BT=4,Pri=4), P4(AT=3,BT=3,Pri=2), schedule non-preemptive priority scheduling. Draw the Gantt chart and compute average waiting time.

**Exercise 2:** Using the same process set as Exercise 1, identify which process would be most at risk of starvation and explain why, referencing its priority value and burst time.

**Exercise 3:** Given P1(AT=0,BT=10), P2(AT=1,BT=3), P3(AT=2,BT=5), schedule with Round Robin using quantum=3. Draw the full Gantt chart (including re-queued remainders) and compute average waiting time and turnaround time.

**Exercise 4:** Re-solve Exercise 3 with quantum=1 and again with quantum=10. Compare the resulting average waiting times and explain, using the context-switch-overhead concept, why neither extreme is ideal in practice.

**Exercise 5:** Design a simple aging rule (in plain English or pseudocode) for a priority scheduler where priority values range from 1 (highest) to 10 (lowest), such that no process can wait more than 5000ms without its priority improving.

---

## 7. Interview Q&A

**Q: What is starvation in the context of scheduling, and which algorithms are prone to it?**
Answer: Starvation is when a process waits indefinitely because it never becomes the "best" choice under the scheduler's policy. Priority scheduling is the classic example — a steady stream of higher-priority arrivals can keep a low-priority process waiting forever. SJF/SRTF can also starve long processes if short jobs keep arriving. Round Robin is starvation-free by design because every process gets a guaranteed turn.

**Q: What is aging and how does it prevent starvation?**
Answer: Aging is a technique where a waiting process's priority is gradually increased the longer it stays in the ready queue. Eventually its priority becomes high enough that it's guaranteed to be selected, no matter how many higher-priority processes keep arriving. It's the standard fix applied to priority schedulers in real operating systems.

**Q: How does Round Robin work, and why is it well-suited to interactive systems?**
Answer: Round Robin gives each process a fixed time quantum; if it doesn't finish within that slice, it's preempted and sent to the back of the ready queue, and the next process runs. Because every process gets CPU time within one "round" (bounded by `number_of_processes × quantum`), no process waits arbitrarily long — this bounded response time is exactly what interactive systems need, since users expect the system to feel responsive even under load.

**Q: What happens if the Round Robin time quantum is too small or too large?**
Answer: Too small, and context-switch overhead dominates — the system spends more time saving/restoring process state than doing actual work, hurting throughput. Too large, and Round Robin starts behaving like FCFS — a long process can monopolize the CPU for a long stretch, reintroducing poor response time. A good rule of thumb is sizing the quantum so most CPU bursts complete within one or two quanta.

**Q: In priority scheduling, what's the difference between preemptive and non-preemptive variants?**
Answer: In non-preemptive priority scheduling, once a process starts running it finishes its full burst even if a higher-priority process arrives in the meantime. In preemptive priority scheduling, the arrival of a higher-priority process immediately interrupts the currently running one. Preemptive gives better response time for high-priority work but adds context-switch overhead and complexity.

**Q: Why is Round Robin considered "fair" compared to priority scheduling?**
Answer: Round Robin treats every process identically regardless of its nature — everyone gets the same-size time slice in the same rotating order, so no process can be indefinitely denied the CPU. Priority scheduling, by contrast, explicitly favors some processes over others, which is powerful when priority reflects real importance, but can be unfair (and cause starvation) without a mechanism like aging.
