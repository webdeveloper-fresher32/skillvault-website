# Thrashing — Complete Guide

## Table of Contents
1. [What is Thrashing?](#1-what-is-thrashing)
2. [Why Thrashing Happens](#2-why-thrashing-happens)
3. [The Working Set Model](#3-the-working-set-model)
4. [How the OS Detects Thrashing](#4-how-the-os-detects-thrashing)
5. [How the OS Mitigates Thrashing](#5-how-the-os-mitigates-thrashing)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is Thrashing?

Thrashing is the state where a system spends **more time paging (swapping pages in and out of RAM) than doing actual useful work.** CPU utilization collapses even though every process is "runnable" — they're just all stuck waiting on disk I/O to bring their pages back into memory.

```
Normal operation:
  CPU: [=========work=========] [==work==] [=work=]
  Disk I/O for paging: [.]              [.]

Thrashing:
  CPU: [w][................wait for disk...............][w][......wait......]
  Disk I/O for paging: [########################################]

  Almost all wall-clock time is spent waiting on page-ins,
  almost none is spent executing instructions.
```

### The Counter-Intuitive Curve

You'd expect: more processes running (higher "multiprogramming degree") → more CPU utilization, since there's always something ready to run when one process blocks on I/O. That holds — up to a point.

```
CPU
Utilization
   │
   │              ___----____
   │           /''            ''--_
   │         /                      \
   │       /                          \
   │     /                              \___  ← thrashing:
   │   /                                     \    utilization
   │ /                                        \_  collapses
   │/                                            \___________
   └──────────────────────────────────────────────────────────▶
        Degree of Multiprogramming (number of active processes)

   Left side: adding processes helps (more overlap of CPU and I/O)
   Right side: adding processes hurts (everyone is fighting over
               too few frames, everyone keeps faulting)
```

Past the peak, adding one more process doesn't add capacity — it just gives every existing process fewer frames, causing all of them to fault more often, which causes more disk I/O, which starves the CPU further, which the OS often "solves" by adding yet more processes to keep the CPU busy — making the problem worse. This is the thrashing death spiral.

---

## 2. Why Thrashing Happens

Thrashing has one root cause: **too many processes competing for too few physical frames**, so each process gets fewer frames than it actually needs to run without constantly faulting.

```
System has: 100 frames total

Process A needs ~40 frames to run without heavy faulting (its "working set")
Process B needs ~40 frames
Process C needs ~40 frames
Process D needs ~40 frames

100 frames ÷ 4 processes = 25 frames each

Each process only gets 25 frames but NEEDS 40.
→ Every process constantly faults for the pages it can't hold.
→ Every fault triggers a disk read.
→ CPU sits idle waiting on disk, so the OS scheduler brings in
  MORE processes to "keep it busy" — which shrinks everyone's
  frame allocation even further. Thrashing intensifies.
```

Common real-world triggers:
- Running too many memory-heavy applications/containers simultaneously on a machine with limited RAM.
- Over-provisioning virtual machines or containers on a host without enough physical memory (a classic cloud/Kubernetes "noisy neighbor" scenario).
- A single process with a memory leak slowly consuming frames that other processes need.
- Setting the degree of multiprogramming too high in an attempt to "keep the CPU busy."

---

## 3. The Working Set Model

The **working set** of a process at a given time is the set of pages it has referenced during the most recent window of time, Δ (delta). It's an empirical approximation of "the pages this process needs right now to run efficiently."

```
Process's page reference stream (most recent on the right):

... 3 1 4 1 5 9 2 6 | 2 3 9 1 5 3 2 6
                      └──── Δ = last 8 references ────┘

Working Set (Δ=8) at this instant = { 2, 3, 9, 1, 5, 6 }
  (the distinct pages touched within the last Δ references)

Working Set Size (WSS) = 6 pages, in this example
```

- If **Δ is too small**, the working set will miss pages the process is about to reuse, understating its real memory need.
- If **Δ is too large**, the working set will include pages from an old phase of execution the process no longer needs, overstating its real memory need.

### Using the Working Set for Frame Allocation

The OS estimates each process's working set size, sums them up, and compares against total available frames:

```
Total physical frames available:  D = 200

Process A working set size:  WSS_A = 40
Process B working set size:  WSS_B = 50
Process C working set size:  WSS_C = 60
Process D working set size:  WSS_D = 70
                                    -----
Sum of working sets:                220

220 > 200  →  NOT enough frames for everyone's working set
           →  System is heading toward (or already in) thrashing
           →  OS should suspend one process (e.g., swap out D entirely)
              rather than let all four starve simultaneously
```

If `Sum(WSS) ≤ D`, the system can comfortably keep every process's working set resident and thrashing should not occur. If `Sum(WSS) > D`, something has to give — and it's better for the OS to fully suspend one process (so the rest can run smoothly) than to let all processes limp along, faulting constantly.

---

## 4. How the OS Detects Thrashing

Operating systems don't measure "thrashing" directly as a single flag — they infer it from proxy signals:

```
┌──────────────────────────────────────────────────────────────┐
│ Signal 1: Page fault rate                                     │
│   OS tracks page faults per second, per process (and system-  │
│   wide). A sudden, sustained spike in fault rate, especially  │
│   combined with low CPU utilization, is the classic symptom.  │
├──────────────────────────────────────────────────────────────┤
│ Signal 2: CPU utilization vs multiprogramming degree           │
│   If CPU utilization is DROPPING while more processes are      │
│   being admitted, the OS is on the wrong side of the curve     │
│   from Section 1 — a strong thrashing indicator.                │
├──────────────────────────────────────────────────────────────┤
│ Signal 3: Working set vs available frames                      │
│   If Sum(working set sizes) exceeds total frames available,    │
│   thrashing is likely imminent even before it visibly starts.   │
├──────────────────────────────────────────────────────────────┤
│ Signal 4: Disk I/O queue length / paging device utilization    │
│   The swap device being saturated with reads/writes while the  │
│   CPU sits mostly idle is a direct symptom.                     │
└──────────────────────────────────────────────────────────────┘
```

On Linux, you can observe these signals directly: `vmstat 1` shows `si`/`so` (swap in/out) columns — sustained non-zero values under load indicate paging pressure; high values alongside a mostly-idle `id` (CPU idle) column strongly suggest thrashing. The kernel's OOM killer and `PSI` (Pressure Stall Information, `/proc/pressure/memory`) are modern tools built specifically to detect this kind of memory pressure.

---

## 5. How the OS Mitigates Thrashing

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Reduce the degree of multiprogramming                       │
│    Suspend (swap out entirely) one or more processes so the    │
│    remaining processes each get enough frames for their        │
│    working set. Counter-intuitive but effective: doing LESS    │
│    at once gets more total work done.                           │
├──────────────────────────────────────────────────────────────┤
│ 2. Working-set-based admission control                          │
│    Before admitting a new process (or resuming a suspended      │
│    one), check whether Sum(working sets) + new process's WSS    │
│    still fits within available frames. If not, don't admit it.  │
├──────────────────────────────────────────────────────────────┤
│ 3. Local (per-process) rather than global replacement            │
│    Restrict a process to evicting only its OWN pages, not        │
│    pages belonging to other processes. Prevents one memory-      │
│    hungry process from starving everyone else of frames.         │
├──────────────────────────────────────────────────────────────┤
│ 4. Increase physical RAM / reduce memory footprint                │
│    The direct fix: add more RAM, or reduce how much memory        │
│    each process/container is allowed to claim (e.g., container    │
│    memory limits, closing unnecessary applications).               │
├──────────────────────────────────────────────────────────────┤
│ 5. OOM killer as a last resort (Linux)                            │
│    If memory pressure becomes severe, the kernel's Out-Of-Memory  │
│    killer sacrifices a process (chosen by a heuristic "badness"   │
│    score) to free enough memory for the system to keep functioning.│
└──────────────────────────────────────────────────────────────┘
```

The key trade-off engineers should internalize: thrashing is fixed by giving fewer processes more memory each, not by giving more processes a slice each. It feels wrong to reduce concurrency to increase throughput, but past the thrashing point, that's exactly what works.

---

## 6. Hands-On Exercises

**Exercise 1:** On a Linux machine or VM, run `vmstat 1` in one terminal. In another, deliberately allocate memory beyond available RAM (e.g., a small script that keeps allocating and touching large arrays) and observe the `si`/`so` (swap in/out) columns and the `id` (idle CPU) column as memory pressure rises.

**Exercise 2:** Given a system with 240 total frames and four processes with working set sizes 50, 60, 70, and 80, determine whether the system can run all four without thrashing. If not, which process(es) would you suspend, and what would the new total be?

**Exercise 3:** Explain, using the working set model, why setting Δ (the working-set window) too small could cause the OS to *underestimate* memory needs and inadvertently trigger thrashing by over-admitting processes.

**Exercise 4:** Look up Linux's Pressure Stall Information (`cat /proc/pressure/memory` on a Linux system, if available). Explain what the `avg10`, `avg60`, and `avg300` fields represent and how they'd help detect a thrashing trend before it becomes severe.

**Exercise 5:** Explain in your own words why local (per-process) page replacement helps prevent thrashing compared to global page replacement, where any process can evict any other process's pages.

---

## 7. Interview Q&A

**Q: What is thrashing?**
Answer: Thrashing is a state where a system spends most of its time servicing page faults (swapping pages between RAM and disk) rather than executing useful instructions. CPU utilization drops sharply even though processes are technically "runnable," because they're perpetually blocked waiting for their pages to be paged back in.

**Q: What causes thrashing?**
Answer: Too many processes competing for too few physical frames. When the sum of what each process actually needs resident in RAM (its working set) exceeds total available frames, every process gets fewer frames than it needs, causing constant page faults, disk I/O, and CPU starvation — which can spiral if the OS responds by admitting even more processes.

**Q: What is the working set model, and how does it relate to thrashing?**
Answer: The working set of a process is the set of distinct pages it has referenced within a recent time window (Δ). It approximates the process's actual current memory requirement. The OS can sum the working set sizes of all active processes and compare that to total available frames — if the sum exceeds capacity, the system is at risk of thrashing, and the OS should reduce the number of concurrently running processes rather than let all of them starve.

**Q: How does an OS detect thrashing is occurring?**
Answer: Primarily by monitoring proxy signals: a spike in page-fault rate combined with falling CPU utilization, working-set sums exceeding available frames, and heavy paging-device (swap) I/O while the CPU sits idle. On Linux, tools like `vmstat` (si/so columns) and Pressure Stall Information (`/proc/pressure/memory`) surface these signals directly.

**Q: How does an OS mitigate or recover from thrashing?**
Answer: The main lever is reducing the degree of multiprogramming — suspending one or more processes entirely so the remaining ones get enough frames for their working sets, which counter-intuitively increases total throughput. Other mitigations include working-set-based admission control (don't start new processes if there isn't room), local rather than global page replacement (so one process can't steal frames from another), adding more physical RAM, and — as a last resort on Linux — the OOM killer terminating a process to relieve pressure.

**Q: Why does adding more processes sometimes decrease CPU utilization instead of increasing it?**
Answer: Up to a point, more processes improve CPU utilization because there's always another process ready to run while others wait on I/O. But once the combined memory demand of all processes exceeds available frames, each process's share shrinks below what it needs, causing constant page faults. The CPU then spends almost all its time waiting for paging I/O to complete rather than executing instructions, so utilization collapses even as the number of "runnable" processes increases — this is the thrashing region of the multiprogramming-vs-utilization curve.
