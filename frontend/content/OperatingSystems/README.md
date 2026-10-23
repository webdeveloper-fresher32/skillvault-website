# Operating Systems — Complete Learning Course

Master the operating systems concepts that back-end and full-stack engineers are expected to know for interviews and for reasoning about real production systems — processes, threads, scheduling, synchronization, memory, file systems, I/O, and Linux internals.

This course is written for engineers who already ship code (APIs, databases, containers) but have never formally studied — or have forgotten — the CS fundamentals that interviewers at mid-to-senior level probe for: "explain what happens when you run a program," "how does a mutex actually work," "why does my process get OOM-killed," "what's the difference between a process and a thread."

---

## Course Structure

```
OperatingSystems/
├── Phase-01-Introduction-to-OS/          → What an OS is, kernel vs user space, system calls
├── Phase-02-Processes-and-Threads/       → Process lifecycle, PCB, threads, context switching
├── Phase-03-CPU-Scheduling/              → FCFS, SJF, Round Robin, priority, multilevel queues
├── Phase-04-Process-Synchronization/     → Race conditions, locks, semaphores, monitors
├── Phase-05-Deadlocks/                   → Conditions, prevention, avoidance, detection/recovery
├── Phase-06-Memory-Management/           → Partitioning, paging, segmentation, allocation
├── Phase-07-Virtual-Memory/              → Demand paging, page replacement, thrashing, TLB
├── Phase-08-File-Systems-and-Storage/    → File systems, inodes, journaling, RAID
├── Phase-09-IO-Systems/                  → I/O hardware, interrupts, DMA, disk scheduling
├── Phase-10-Concurrency-in-Practice/     → Real-world concurrency: async I/O, thread pools, GIL
├── Phase-11-Linux-OS-Internals/          → Linux process model, cgroups, namespaces, /proc
├── Phase-12-Interview-Prep-and-Advanced/ → System design tie-ins, curated interview questions
├── Quick-Reference/                      → Cheatsheet + 50 interview Q&A
└── Projects/                             → Beginner → Advanced hands-on Python simulations
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Introduction to OS | Beginner | 2 days |
| 02 | Processes and Threads | Beginner | 3 days |
| 03 | CPU Scheduling | Beginner | 3 days |
| 04 | Process Synchronization | Intermediate | 4 days |
| 05 | Deadlocks | Intermediate | 3 days |
| 06 | Memory Management | Intermediate | 3 days |
| 07 | Virtual Memory | Intermediate | 4 days |
| 08 | File Systems and Storage | Intermediate | 3 days |
| 09 | I/O Systems | Intermediate | 2 days |
| 10 | Concurrency in Practice | Advanced | 4 days |
| 11 | Linux OS Internals | Advanced | 4 days |
| 12 | Interview Prep and Advanced | Advanced | 3 days |

**Total estimated time: 7-9 weeks**

---

## Prerequisites

- Comfort writing code in at least one language (examples in this course use Python)
- Basic command-line familiarity (you should have used a terminal before)
- No prior formal OS coursework required — this course builds concepts from first principles
- Helpful but not required: some exposure to Linux, Docker, or backend services in production (you will recognize a lot of "why does this happen" moments)

---

## How to Use This Course

You already know how to build features — this course fills in *why the machine behaves the way it does underneath your code*. A few notes on approach:

1. **Don't skip the "why" before the "how."** Each phase README explains the problem the OS is solving before introducing the mechanism (e.g., why we need scheduling before how Round Robin works). Interviewers care more about the "why" than memorized definitions.
2. **Connect concepts to things you've already debugged.** A slow API under load, a container getting OOM-killed, a flaky test with a race condition, a deadlocked database transaction — these are OS concepts wearing a backend costume. As you read each phase, ask "where have I seen this in production?"
3. **Do the projects, not just the reading.** The `Projects/` folder has runnable Python simulations (producer-consumer, dining philosophers, CPU schedulers, memory allocators) — these turn abstract terms like "race condition" or "external fragmentation" into something you've watched happen and fixed yourself.
4. **Use Linux as your lab.** Phase 11 leans on real commands (`ps`, `top`, `/proc`, `strace`, cgroups). Run them on a real machine or container as you go — reading about `/proc/[pid]/status` is not the same as opening it.
5. **Finish with Phase 12 for interview reps.** It consolidates the whole course into the shape interviewers actually ask about: tradeoffs, "explain X to me," and system-design-adjacent questions (e.g., "how would a connection pool exhaust threads").

---

## Projects

| Project | Level | Description |
|---------|-------|-------------|
| Producer-Consumer Simulation | Beginner | Threads + bounded queue coordinating safely |
| Dining Philosophers Simulation | Intermediate | Naive deadlocking version vs. a fixed version |
| CPU Scheduler Simulator | Intermediate | FCFS, SJF, and Round Robin with Gantt charts and metrics |
| Simple Memory Allocator | Advanced | First-fit / best-fit / worst-fit allocation and fragmentation |

---

## Quick Reference

See `Quick-Reference/` for a condensed cheatsheet of terms, formulas (waiting time, turnaround time, page fault rate), and 50 interview questions with model answers spanning all 12 phases.
