# Phase 03 — CPU Scheduling

## Why This Phase Matters

Every OS interview for a backend/full-stack role eventually asks some version of: "How does the CPU decide which process runs next?" This phase builds that answer from first principles — starting with *why* scheduling exists at all, then walking through every classic algorithm with fully worked Gantt charts, and finishing with how a real production kernel (Linux CFS) actually does it today.

By the end of this phase you'll be able to compute waiting time, turnaround time, and response time by hand for any process set, explain trade-offs between algorithms, and connect that theory to why your Node.js event loop and your OS process scheduler are two completely different (but related) things.

---

## What's Inside

| File | Topic |
|------|-------|
| `01-Scheduling-Fundamentals.md` | Why scheduling exists, scheduling criteria, preemptive vs non-preemptive |
| `02-FCFS-and-SJF.md` | First-Come-First-Served and Shortest-Job-First, worked examples, convoy effect |
| `03-Priority-and-Round-Robin.md` | Priority scheduling, starvation/aging, Round Robin with time quantum |
| `04-Multilevel-Queue-Scheduling.md` | Multilevel queue and multilevel feedback queue scheduling |
| `05-Scheduling-in-Real-Systems.md` | Linux CFS conceptually, Node.js/Python process scheduling in practice |

---

## Learning Path

```
01-Scheduling-Fundamentals
        │
        ▼
02-FCFS-and-SJF  ──────────►  03-Priority-and-Round-Robin
        │                              │
        └──────────────┬───────────────┘
                        ▼
          04-Multilevel-Queue-Scheduling
                        │
                        ▼
          05-Scheduling-in-Real-Systems
```

Work through the files in order — each algorithm builds on scheduling criteria introduced in `01`, and the worked Gantt-chart examples in `02` and `03` use the same notation throughout.

---

## Prerequisites

- Phase 02 (Processes and Threads) — you should already know what a process is, what "burst time" means, and the difference between CPU-bound and I/O-bound processes.

## Time Estimate

4–6 hours (including working through every Gantt-chart example by hand).

## Difficulty

Intermediate — this is one of the most heavily-tested OS topics in interviews, so budget real time for the hands-on exercises, not just reading.
