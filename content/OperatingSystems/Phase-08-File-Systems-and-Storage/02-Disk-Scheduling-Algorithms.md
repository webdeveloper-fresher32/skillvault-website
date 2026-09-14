# Disk Scheduling Algorithms — FCFS, SSTF, SCAN, C-SCAN

## Table of Contents
1. [Why Disk Scheduling Matters](#1-why-disk-scheduling-matters)
2. [FCFS (First-Come First-Served)](#2-fcfs-first-come-first-served)
3. [SSTF (Shortest Seek Time First)](#3-sstf-shortest-seek-time-first)
4. [SCAN (Elevator Algorithm)](#4-scan-elevator-algorithm)
5. [C-SCAN (Circular SCAN)](#5-c-scan-circular-scan)
6. [Side-by-Side Comparison](#6-side-by-side-comparison)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Disk Scheduling Matters

On a mechanical **HDD**, data lives on spinning platters, and a physical read/write head must move across cylinders (tracks) to reach the requested data. This head movement — called **seeking** — is the slowest part of a disk operation (milliseconds, versus nanoseconds for the actual electronic read).

```
HDD platter (top-down view), head moves radially:

  cylinder:  0    20   40   60   80   100  120  140  160  180  200
             │────│────│────│────│────│────│────│────│────│────│
                              ▲
                          read/write
                             head

If requests arrive for cylinders 20, 180, 60, 150 — in what ORDER should
the head visit them to minimize total travel distance?
```

If the OS has multiple pending disk I/O requests queued up (common under load — many processes reading/writing at once), it must choose the **order** to service them. Choosing well can cut total seek time dramatically. This is **disk scheduling**.

**Convention used in all examples below:** distances are measured in cylinder numbers, and "seek time" is simplified to be the number of cylinders traveled (you can assume 1 cylinder = 1 unit of time, or multiply by a constant like 0.1ms/cylinder if a problem specifies it).

---

## 2. FCFS (First-Come First-Served)

Service requests strictly in the order they arrived — simplest possible policy, no reordering.

**Example:** Head starts at cylinder **50**. Request queue (in arrival order): `98, 183, 37, 122, 14, 124, 65, 67`

```
Path:  50 → 98 → 183 → 37 → 122 → 14 → 124 → 65 → 67

Visual (cylinder axis 0-199):
0        14   37  50        65 67    98        122 124        183      199
│        │    │   │         │  │     │         │   │           │        │
                  START
                  50 ──────────────────▶ 98 (48)
                                          98 ─────────────────────────▶183 (85)
                                                                       183◀───37 (146)
                                                                            37──▶122 (85)
                                                                                 122◀──14(108)
                                                                                      14──▶124(110)
                                                                                           124◀65(59)
                                                                                              65▶67(2)
```

| Move | From | To | Distance |
|------|------|----|----|
| 1 | 50 | 98 | 48 |
| 2 | 98 | 183 | 85 |
| 3 | 183 | 37 | 146 |
| 4 | 37 | 122 | 85 |
| 5 | 122 | 14 | 108 |
| 6 | 14 | 124 | 110 |
| 7 | 124 | 65 | 59 |
| 8 | 65 | 67 | 2 |
| **Total** | | | **643** |

FCFS is fair (no starvation) but the head thrashes back and forth wildly (50→183→37→122→14...) — terrible average seek time.

---

## 3. SSTF (Shortest Seek Time First)

Always service whichever pending request is **closest** to the head's current position (like a greedy nearest-neighbor algorithm).

**Same queue:** start at 50, requests `98, 183, 37, 122, 14, 124, 65, 67`

```
Step-by-step (pick nearest remaining request each time):

Start=50.  Remaining: {98,183,37,122,14,124,65,67}
  Nearest to 50 → 65 (dist 15)? or 37(dist13)? Let's compute distances:
  |98-50|=48, |183-50|=133, |37-50|=13, |122-50|=72, |14-50|=36, |124-50|=74, |65-50|=15, |67-50|=17
  Closest = 37 (dist 13)   → move to 37

Start=37.  Remaining: {98,183,122,14,124,65,67}
  |98-37|=61,|183-37|=146,|122-37|=85,|14-37|=23,|124-37|=87,|65-37|=28,|67-37|=30
  Closest = 14 (dist 23)   → move to 14

Start=14.  Remaining: {98,183,122,124,65,67}
  |98-14|=84,|183-14|=169,|122-14|=108,|124-14|=110,|65-14|=51,|67-14|=53
  Closest = 65 (dist 51)   → move to 65

Start=65.  Remaining: {98,183,122,124,67}
  Closest = 67 (dist 2)    → move to 67

Start=67.  Remaining: {98,183,122,124}
  Closest = 98 (dist 31)   → move to 98

Start=98.  Remaining: {183,122,124}
  Closest = 122 (dist 24)  → move to 122

Start=122. Remaining: {183,124}
  Closest = 124 (dist 2)   → move to 124

Start=124. Remaining: {183}
  Closest = 183 (dist 59)  → move to 183
```

| Move | From | To | Distance |
|------|------|----|----|
| 1 | 50 | 37 | 13 |
| 2 | 37 | 14 | 23 |
| 3 | 14 | 65 | 51 |
| 4 | 65 | 67 | 2 |
| 5 | 67 | 98 | 31 |
| 6 | 98 | 122 | 24 |
| 7 | 122 | 124 | 2 |
| 8 | 124 | 183 | 59 |
| **Total** | | | **205** |

SSTF drastically cuts total seek distance (205 vs FCFS's 643) but can cause **starvation** — a request far from the "hot zone" of activity can be delayed indefinitely if closer requests keep arriving.

---

## 4. SCAN (Elevator Algorithm)

The head moves in one direction, servicing every request in its path, until it hits the end of the disk — then reverses direction. Behaves like an elevator: it doesn't reverse just because a closer request appears behind it; it commits to a direction.

**Same queue:** start at 50, moving **toward higher cylinders** first (disk range 0–199), requests `98, 183, 37, 122, 14, 124, 65, 67`

```
Sort requests: 14, 37, 65, 67, 98, 122, 124, 183

Moving UP from 50, service in increasing order until reaching disk end (199):
50 → 65 → 67 → 98 → 122 → 124 → 183 → 199 (end of disk, even though no request there —
                                             classic SCAN goes all the way to the boundary)
Then reverse, moving DOWN, service remaining requests:
199 → 37 → 14
```

```
Visual:
0   14      37       50 65 67   98      122 124              183   199
│   │       │        │  │  │    │       │   │                 │     │
              ◀────── START, head moves RIGHT first ──────▶
```

| Move | From | To | Distance |
|------|------|----|----|
| 1 | 50 | 65 | 15 |
| 2 | 65 | 67 | 2 |
| 3 | 67 | 98 | 31 |
| 4 | 98 | 122 | 24 |
| 5 | 122 | 124 | 2 |
| 6 | 124 | 183 | 59 |
| 7 | 183 | 199 | 16 |  *(travel to disk end, standard SCAN)*
| 8 | 199 | 37 | 162 |
| 9 | 37 | 14 | 23 |
| **Total** | | | **334** |

*(Note: some textbook variants of SCAN stop at the last request instead of going all the way to the physical end of the disk — if you stop at 183 instead of going to 199, total = 318. Always clarify which convention a problem wants. The "goes to the edge" version is the classic definition since a real head can't know there's no request beyond it without checking.)*

SCAN avoids SSTF's starvation problem (every request eventually gets serviced within one sweep) and gives more uniform wait times than FCFS.

---

## 5. C-SCAN (Circular SCAN)

Like SCAN, but instead of reversing direction at the end, the head jumps back to the **beginning** of the disk and starts scanning upward again — treating the disk as circular. This makes wait times more *uniform* because the head always moves in the same direction relative to newly arriving requests.

**Same queue:** start at 50, moving up, disk range 0–199, requests `98, 183, 37, 122, 14, 124, 65, 67`

```
Moving UP from 50, service in order, go to disk end (199):
50 → 65 → 67 → 98 → 122 → 124 → 183 → 199
Then JUMP to 0 (no seek time typically counted for the jump itself, or counted
as a full traversal depending on convention — we'll count the jump distance
explicitly here since it's physically a seek to cylinder 0):
199 → 0
Then continue UP servicing remaining requests:
0 → 14 → 37
```

```
Visual:
0   14      37       50 65 67   98      122 124              183   199
│   │       │        │  │  │    │       │   │                 │     │
└──────────────────────────────────────────────────────────────────┘
      jump back to 0 after reaching 199, then continue upward
```

| Move | From | To | Distance |
|------|------|----|----|
| 1 | 50 | 65 | 15 |
| 2 | 65 | 67 | 2 |
| 3 | 67 | 98 | 31 |
| 4 | 98 | 122 | 24 |
| 5 | 122 | 124 | 2 |
| 6 | 124 | 183 | 59 |
| 7 | 183 | 199 | 16 |
| 8 | 199 | 0 | 199 | *(circular jump back to start)*
| 9 | 0 | 14 | 14 |
| 10 | 14 | 37 | 23 |
| **Total** | | | **385** |

*(The jump 199→0 is a real physical seek across the whole disk and is usually counted in full — some simplified problems assume the return trip is "free"/instant, which would give total = 186. State your assumption when solving these in an interview.)*

C-SCAN only services requests in one direction, which means **more total head movement** than SCAN in a single pass, but it produces a much more **uniform/predictable wait time** for all requests — no request has to wait through two passes' worth of variance like it might in plain SCAN.

---

## 6. Side-by-Side Comparison

| Algorithm | Total Seek (this example) | Starvation Risk | Fairness/Uniformity | Complexity |
|-----------|---------------------------|-----------------|----------------------|------------|
| FCFS | 643 | None | Poor (wildly variable wait) | Trivial |
| SSTF | 205 | High (far requests can starve) | Poor | Simple |
| SCAN | 334 | None | Good | Moderate |
| C-SCAN | 385 (or 186 if jump is free) | None | Best (most uniform) | Moderate |

**General takeaways:**
- FCFS is simple and fair in *arrival order* but bad for performance — never used when throughput matters.
- SSTF minimizes seek time greedily but can starve requests at the edges of the disk under sustained load.
- SCAN and C-SCAN balance throughput and fairness — these (and their refinements like LOOK/C-LOOK, which don't travel all the way to the physical disk edge if there's no request there) are what real-world disk schedulers historically used.
- **On modern SSDs, none of this matters** — there's no mechanical seek, so the OS/drive typically just uses simpler queuing (e.g., NVMe's parallel command queues) instead of elevator algorithms. Disk scheduling algorithms are primarily an HDD-era concept, but interviewers still expect you to know them since many systems still run on HDDs (bulk/archival storage) and the concepts (batching, ordering for locality) reappear elsewhere (e.g., database query planners ordering disk reads).

---

## 7. Hands-On Exercises

**Exercise 1:** Given head start = 100, disk range 0-199, requests `[55, 58, 39, 18, 90, 160, 150, 38, 184]`, compute total seek distance under FCFS. Show each move and its distance in a table like the ones above.

**Exercise 2:** Using the same queue and start position from Exercise 1, compute total seek distance under SSTF. At each step, list the remaining requests and their distances from the current head position before picking the minimum.

**Exercise 3:** Using the same queue, compute total seek distance under SCAN, moving toward 0 first (i.e., the head moves DOWN before reversing). Compare the result to moving UP first — do you get a different total?

**Exercise 4:** Explain in your own words why C-SCAN typically has a higher total seek distance than SCAN, but is still preferred in some production disk schedulers. What is being optimized when uniformity is preferred over raw total distance?

**Exercise 5 (research/reasoning):** Look up (or reason from first principles) what LOOK and C-LOOK are, and how they differ from SCAN and C-SCAN (hint: they don't travel all the way to the disk's physical edge — only to the last request in that direction). Rework Exercise 3's numbers using LOOK instead of SCAN.

---

## 8. Interview Q&A

**Q: Why does disk scheduling matter for HDDs but barely matter for SSDs?**
Answer: HDDs have a physical read/write head that must mechanically move across spinning platters to reach data — this "seek time" is milliseconds and dominates I/O latency, so the order requests are serviced in has a huge performance impact. SSDs have no moving parts; any location can be accessed electronically in roughly constant time (with some caveats around wear-leveling and internal parallelism), so classic seek-minimizing algorithms like SCAN/SSTF are largely irrelevant for SSDs — the OS/driver focuses instead on maximizing parallel command queue depth (e.g., NVMe).

**Q: What's the main weakness of SSTF despite it minimizing seek time?**
Answer: SSTF can cause starvation — if requests keep arriving near the head's current position, a request sitting far away (e.g., near one edge of the disk) can be repeatedly skipped in favor of closer ones and wait indefinitely. It optimizes for average seek time at the expense of fairness/worst-case latency.

**Q: How does SCAN avoid the starvation problem that SSTF has?**
Answer: SCAN moves the head in one direction, servicing every request in its path, until it reaches the end of the disk, then reverses. Because it doesn't jump around based on proximity, every pending request is guaranteed to be serviced within, at most, one full sweep of the disk — no request can be perpetually skipped.

**Q: What's the difference between SCAN and C-SCAN?**
Answer: SCAN sweeps back and forth (bidirectional) — after reaching one end it reverses and sweeps back, servicing requests along the way in both directions. C-SCAN only services requests while moving in one direction; upon reaching the end, it jumps back to the start without servicing anything on the return trip, then sweeps in the same direction again. C-SCAN sacrifices some total seek distance for much more uniform wait times, since every request experiences roughly the same worst-case wait (one direction of sweep) rather than SCAN's variable wait depending on which direction the head happens to be moving when a request arrives.

**Q: If you were designing a disk scheduler for a busy database server on spinning disks, which algorithm would you pick and why?**
Answer: Likely SCAN or a LOOK/C-LOOK variant — they give good average throughput (unlike FCFS) while avoiding SSTF's starvation risk, and provide reasonably predictable latency (important for database workloads with SLA requirements). C-SCAN/C-LOOK would be preferred if uniform, predictable latency per request matters more than raw throughput, since it avoids the direction-dependent wait time variance of plain SCAN.

**Q: Does disk scheduling theory still matter if most production systems today use SSDs or cloud block storage?**
Answer: The specific algorithms matter less directly (SSDs have no seek penalty), but the underlying concepts — batching, request reordering for locality, avoiding starvation, throughput vs. fairness trade-offs — reappear throughout systems design: database query/IO schedulers, network packet schedulers, and even OS process schedulers use analogous ideas. Also, spinning disks are still common in bulk/archival/cold storage tiers, so the algorithms aren't purely academic.
