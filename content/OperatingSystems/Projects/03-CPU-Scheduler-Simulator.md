# Project 3 — CPU Scheduler Simulator

**Level:** Intermediate
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 03 – CPU Scheduling

---

## Requirements / What You're Building

A command-line simulator that takes a list of processes — each with an **arrival time** and a **burst time** (how much CPU time it needs) — and simulates three classic scheduling algorithms:

- **FCFS (First-Come, First-Served)** — non-preemptive, processes run in arrival order.
- **SJF (Shortest Job First)** — non-preemptive, among arrived processes always pick the one with the smallest remaining burst time.
- **Round Robin (RR)** — preemptive, each process gets a fixed time quantum before being rotated to the back of the ready queue.

For each algorithm the program prints an ASCII **Gantt chart** showing which process ran during which time interval, and computes:

- **Waiting time** per process = turnaround time − burst time
- **Turnaround time** per process = completion time − arrival time
- **Average waiting time** and **average turnaround time** across all processes

---

## Complete Runnable Python Code

Save this as `cpu_scheduler.py`.

```python
"""
CPU Scheduler Simulator
=========================
Simulates FCFS, SJF (non-preemptive), and Round Robin scheduling over a
list of processes (arrival_time, burst_time). Prints an ASCII Gantt chart
and computes average waiting time / turnaround time for each algorithm.

Run: python3 cpu_scheduler.py
"""

from dataclasses import dataclass, field
from copy import deepcopy


@dataclass
class Process:
    pid: str
    arrival_time: int
    burst_time: int
    remaining_time: int = field(init=False)
    completion_time: int = 0
    waiting_time: int = 0
    turnaround_time: int = 0

    def __post_init__(self):
        self.remaining_time = self.burst_time


# A (pid, start, end) tuple describing one slice of the Gantt chart.
GanttSlice = tuple


def fcfs(processes: list) -> tuple:
    """First-Come, First-Served: run processes strictly in arrival order."""
    procs = deepcopy(processes)
    procs.sort(key=lambda p: (p.arrival_time, p.pid))

    gantt: list = []
    clock = 0
    for p in procs:
        start = max(clock, p.arrival_time)
        end = start + p.burst_time
        gantt.append((p.pid, start, end))
        p.completion_time = end
        p.turnaround_time = p.completion_time - p.arrival_time
        p.waiting_time = p.turnaround_time - p.burst_time
        clock = end

    return procs, gantt


def sjf(processes: list) -> tuple:
    """Shortest Job First, non-preemptive: among arrived processes, always
    pick the one with the smallest burst time."""
    procs = deepcopy(processes)
    remaining = procs[:]
    gantt: list = []
    clock = 0
    completed = []

    while remaining:
        available = [p for p in remaining if p.arrival_time <= clock]
        if not available:
            # CPU idle until the next process arrives
            next_arrival = min(p.arrival_time for p in remaining)
            clock = next_arrival
            available = [p for p in remaining if p.arrival_time <= clock]

        # Shortest burst time first; tie-break by arrival time then pid
        chosen = min(available, key=lambda p: (p.burst_time, p.arrival_time, p.pid))
        start = clock
        end = start + chosen.burst_time
        gantt.append((chosen.pid, start, end))
        chosen.completion_time = end
        chosen.turnaround_time = chosen.completion_time - chosen.arrival_time
        chosen.waiting_time = chosen.turnaround_time - chosen.burst_time
        clock = end

        remaining.remove(chosen)
        completed.append(chosen)

    # Return processes in original pid order for readable output
    completed.sort(key=lambda p: p.pid)
    return completed, gantt


def round_robin(processes: list, quantum: int) -> tuple:
    """Preemptive Round Robin with the given time quantum."""
    procs = deepcopy(processes)
    procs.sort(key=lambda p: (p.arrival_time, p.pid))

    gantt: list = []
    clock = 0
    queue_: list = []
    not_yet_arrived = procs[:]
    completed_map = {}

    def admit_new_arrivals(up_to_time: int):
        nonlocal not_yet_arrived
        newly_arrived = [p for p in not_yet_arrived if p.arrival_time <= up_to_time]
        for p in newly_arrived:
            queue_.append(p)
        not_yet_arrived = [p for p in not_yet_arrived if p.arrival_time > up_to_time]

    # Prime the queue with anything arriving at time 0
    if not_yet_arrived:
        clock = min(p.arrival_time for p in not_yet_arrived)
    admit_new_arrivals(clock)

    while queue_ or not_yet_arrived:
        if not queue_:
            # CPU idle — jump to next arrival
            clock = min(p.arrival_time for p in not_yet_arrived)
            admit_new_arrivals(clock)
            continue

        current = queue_.pop(0)
        run_time = min(quantum, current.remaining_time)
        start = clock
        end = start + run_time
        gantt.append((current.pid, start, end))
        current.remaining_time -= run_time
        clock = end

        # Any processes that arrived *during* this slice join the queue
        # before the process we just ran gets re-queued (standard RR rule).
        admit_new_arrivals(clock)

        if current.remaining_time > 0:
            queue_.append(current)
        else:
            current.completion_time = clock
            current.turnaround_time = current.completion_time - current.arrival_time
            current.waiting_time = current.turnaround_time - current.burst_time
            completed_map[current.pid] = current

    completed = sorted(completed_map.values(), key=lambda p: p.pid)
    return completed, gantt


def merge_adjacent_slices(gantt: list) -> list:
    """Merge consecutive Gantt slices for the same pid (cosmetic only —
    doesn't change scheduling, just makes RR charts more readable when a
    process happens to run back-to-back)."""
    if not gantt:
        return gantt
    merged = [list(gantt[0])]
    for pid, start, end in gantt[1:]:
        if pid == merged[-1][0] and start == merged[-1][2]:
            merged[-1][2] = end
        else:
            merged.append([pid, start, end])
    return [tuple(x) for x in merged]


def print_gantt_chart(gantt: list):
    gantt = merge_adjacent_slices(gantt)
    top = "|"
    bottom = ""
    for pid, start, end in gantt:
        width = max(len(pid) + 2, len(str(end)) + 1, 5)
        top += f" {pid:^{width - 2}} |"
    print(top)

    marks = f"{gantt[0][1]}"
    cursor_len = len(marks)
    line = marks
    for pid, start, end in gantt:
        width = max(len(pid) + 2, len(str(end)) + 1, 5)
        segment_width = width + 1  # account for the leading space before '|'
        pad = segment_width - len(str(end))
        line += " " * max(pad, 1) + str(end)
    print(line)


def print_results_table(procs: list):
    header = f"{'PID':<6}{'Arrival':<10}{'Burst':<8}{'Completion':<12}{'Turnaround':<12}{'Waiting':<8}"
    print(header)
    print("-" * len(header))
    total_wait = 0
    total_turnaround = 0
    for p in procs:
        print(f"{p.pid:<6}{p.arrival_time:<10}{p.burst_time:<8}"
              f"{p.completion_time:<12}{p.turnaround_time:<12}{p.waiting_time:<8}")
        total_wait += p.waiting_time
        total_turnaround += p.turnaround_time

    n = len(procs)
    print("-" * len(header))
    print(f"Average Waiting Time:    {total_wait / n:.2f}")
    print(f"Average Turnaround Time: {total_turnaround / n:.2f}")


def run_algorithm(name: str, algo_fn, processes: list):
    print("=" * 70)
    print(f"{name}")
    print("=" * 70)
    procs, gantt = algo_fn(processes)
    print("Gantt Chart:")
    print_gantt_chart(gantt)
    print()
    print_results_table(procs)
    print()


if __name__ == "__main__":
    # Sample workload: (pid, arrival_time, burst_time)
    workload = [
        Process("P1", arrival_time=0, burst_time=5),
        Process("P2", arrival_time=1, burst_time=3),
        Process("P3", arrival_time=2, burst_time=8),
        Process("P4", arrival_time=3, burst_time=6),
        Process("P5", arrival_time=4, burst_time=2),
    ]

    run_algorithm("FCFS (First-Come, First-Served)", fcfs, workload)
    run_algorithm("SJF (Shortest Job First, non-preemptive)", sjf, workload)
    run_algorithm("Round Robin (quantum = 3)",
                  lambda procs: round_robin(procs, quantum=3), workload)
```

---

## How to Run

```bash
python3 cpu_scheduler.py
```

No external dependencies — only `dataclasses` and `copy` from the standard library. Edit the `workload` list at the bottom to try your own arrival/burst combinations, or change the Round Robin `quantum` value.

---

## Sample Output

This is the actual, verified output of the script above run as-is (`python3 cpu_scheduler.py`):

```
======================================================================
FCFS (First-Come, First-Served)
======================================================================
Gantt Chart:
| P1  | P2  | P3  | P4  | P5  |
0     5     8    16    22    24

PID   Arrival   Burst   Completion  Turnaround  Waiting 
--------------------------------------------------------
P1    0         5       5           5           0       
P2    1         3       8           7           4       
P3    2         8       16          14          6       
P4    3         6       22          19          13      
P5    4         2       24          20          18      
--------------------------------------------------------
Average Waiting Time:    8.20
Average Turnaround Time: 13.00

======================================================================
SJF (Shortest Job First, non-preemptive)
======================================================================
Gantt Chart:
| P1  | P5  | P2  | P4  | P3  |
0     5     7    10    16    24

PID   Arrival   Burst   Completion  Turnaround  Waiting 
--------------------------------------------------------
P1    0         5       5           5           0       
P2    1         3       10          9           6       
P3    2         8       24          22          14      
P4    3         6       16          13          7       
P5    4         2       7           3           1       
--------------------------------------------------------
Average Waiting Time:    5.60
Average Turnaround Time: 10.40

======================================================================
Round Robin (quantum = 3)
======================================================================
Gantt Chart:
| P1  | P2  | P3  | P4  | P1  | P5  | P3  | P4  | P3  |
0     3     6     9    12    14    16    19    22    24

PID   Arrival   Burst   Completion  Turnaround  Waiting 
--------------------------------------------------------
P1    0         5       14          14          9       
P2    1         3       6           5           2       
P3    2         8       24          22          14      
P4    3         6       22          19          13      
P5    4         2       16          12          10      
--------------------------------------------------------
Average Waiting Time:    9.60
Average Turnaround Time: 14.40
```

(Exact numbers depend on the workload and quantum you use — re-run with your own values and verify by hand for one or two processes.)

---

## Design Notes

- **FCFS** is the simplest but has the highest average waiting time here because a long job (P3, burst 8) arriving early blocks everyone behind it — this is the **convoy effect**.
- **SJF** minimizes average waiting time *for a fixed set of already-known burst times* (it's provably optimal for that criterion), but it can starve long jobs indefinitely if short jobs keep arriving — not shown in this small example, but worth exploring as an extension.
- **Round Robin** trades average waiting time for **fairness and responsiveness** — no process waits more than `(n-1) * quantum` time units before getting *some* CPU time, which matters for interactive systems even though its average metrics are often worse than SJF.
- **Quantum size is a tradeoff**: too large and RR degenerates toward FCFS (each process mostly finishes within one slice); too small and the overhead of context switching (not modeled numerically here, but real in production OSes) dominates. Try `quantum=1` and `quantum=20` to see both extremes.
- **Idle time handling**: both SJF and Round Robin explicitly jump the clock forward when no process has arrived yet (`available` is empty / `queue_` is empty) — this models the CPU going idle, which a naive implementation often forgets and gets wrong for workloads where processes arrive with gaps.

---

## Possible Extensions

1. Implement **Priority Scheduling** (non-preemptive and preemptive) and add it to the comparison.
2. Implement **Preemptive SJF (Shortest Remaining Time First)** and compare it against non-preemptive SJF on a workload with staggered arrivals.
3. Add a **multilevel feedback queue** (processes that use their full quantum get demoted to a lower-priority queue with a larger quantum).
4. Generate a random workload of 20+ processes and compute average metrics — plot/compare algorithms without visualizing (just print a summary comparison table across all algorithms).
5. Add **context-switch overhead** (e.g., 1 time unit lost every time the CPU switches processes in Round Robin) and see how it changes the average turnaround time as quantum shrinks.
