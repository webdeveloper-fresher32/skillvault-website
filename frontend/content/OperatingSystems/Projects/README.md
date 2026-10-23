# Operating Systems Projects

Hands-on Python simulations that turn OS theory into something you run, watch, and break. Every project uses only the Python standard library — no `pip install` required. Copy the code into a `.py` file and run it with `python3`.

These projects are deliberately built as **simulations**, not toy demos — they use real `threading`, `queue`, and `Lock` primitives so the coordination problems (races, deadlocks, starvation, fragmentation) are genuinely happening, not just narrated in comments.

---

## Project List

| # | Project | Level | Concepts |
|---|---------|-------|----------|
| 01 | [Producer-Consumer Simulation](01-Producer-Consumer-Simulation.md) | Beginner | Threads, bounded buffer, `Condition`/`Queue`, mutual exclusion |
| 02 | [Dining Philosophers Simulation](02-Dining-Philosophers-Simulation.md) | Intermediate | Deadlock, resource ordering, arbitrator pattern, `Lock` |
| 03 | [CPU Scheduler Simulator](03-CPU-Scheduler-Simulator.md) | Intermediate | FCFS, SJF, Round Robin, Gantt charts, waiting/turnaround time |
| 04 | [Simple Memory Allocator](04-Simple-Memory-Allocator.md) | Advanced | First-fit, best-fit, worst-fit, external fragmentation |

---

## How to Work Through These

1. Read the "Requirements" section of each project first — try sketching your own approach before reading the code.
2. Copy-paste the full code into a local file and run it. Read the sample output side-by-side with what your run actually produced.
3. Read "Design Notes" — this is where the OS theory (from the matching course phase) is tied back to the specific lines of code.
4. Attempt at least one item from "Possible Extensions" per project — this is where the real learning happens.

| Project | Related Course Phase |
|---------|----------------------|
| Producer-Consumer | Phase-04-Process-Synchronization |
| Dining Philosophers | Phase-04-Process-Synchronization, Phase-05-Deadlocks |
| CPU Scheduler Simulator | Phase-03-CPU-Scheduling |
| Simple Memory Allocator | Phase-06-Memory-Management |

---

## Requirements

- Python 3.8+ (no external packages)
- A terminal
