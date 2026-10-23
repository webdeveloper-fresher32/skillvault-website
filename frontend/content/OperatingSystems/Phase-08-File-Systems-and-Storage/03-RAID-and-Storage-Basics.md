# RAID and Storage Basics — HDD vs SSD, RAID 0/1/5/10

## Table of Contents
1. [HDD vs SSD — Mechanical vs Electronic Storage](#1-hdd-vs-ssd--mechanical-vs-electronic-storage)
2. [Why SSDs Are Faster](#2-why-ssds-are-faster)
3. [What is RAID and Why Use It?](#3-what-is-raid-and-why-use-it)
4. [RAID 0 — Striping](#4-raid-0--striping)
5. [RAID 1 — Mirroring](#5-raid-1--mirroring)
6. [RAID 5 — Striping with Distributed Parity](#6-raid-5--striping-with-distributed-parity)
7. [RAID 10 — Mirrored Stripes](#7-raid-10--mirrored-stripes)
8. [Choosing a RAID Level](#8-choosing-a-raid-level)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. HDD vs SSD — Mechanical vs Electronic Storage

### HDD (Hard Disk Drive)

A mechanical device: spinning magnetic platters + a moving read/write head (arm), similar to a record player.

```
┌───────────────────────────────────┐
│         HDD (side view)            │
│                                     │
│   ┌─────────────────────────┐      │
│   │      spinning platter    │◀── rotates at 5400-7200+ RPM
│   └─────────────────────────┘      │
│           ▲                        │
│           │ read/write head        │
│           │ (moves radially,       │
│           │  physically travels)   │
│                                     │
└───────────────────────────────────┘

To read data: (1) seek — move head to correct track (ms)
              (2) rotational latency — wait for platter to spin
                  the right sector under the head (ms)
              (3) transfer — actually read the bits (fast)
```

### SSD (Solid State Drive)

No moving parts — data is stored in NAND flash memory cells, addressed electronically.

```
┌───────────────────────────────────┐
│         SSD (internal)             │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ NAND │ │ NAND │ │ NAND │  ◀── flash memory chips,
│  │ chip │ │ chip │ │ chip │        accessed in parallel
│  └──────┘ └──────┘ └──────┘        │
│           ▲                        │
│           │ controller             │
│           │ (electronic addressing,│
│           │  no physical movement) │
└───────────────────────────────────┘

To read data: controller electronically addresses the cell — no seek,
              no rotational wait. Just electrical signaling delay.
```

| Property | HDD | SSD |
|----------|-----|-----|
| Storage medium | Magnetic platters | NAND flash cells |
| Moving parts | Yes (head, spindle motor) | None |
| Random read latency | ~5-10 ms | ~0.05-0.1 ms |
| Sequential throughput | ~100-200 MB/s | ~500 MB/s (SATA) to 7000 MB/s (NVMe) |
| Cost per GB | Lower | Higher (closing gap over time) |
| Failure mode | Mechanical wear, head crash | Limited write endurance (wears cells) |
| Power draw | Higher (spinning motor) | Lower |
| Best use case | Bulk/cold storage, backups, archival | OS drives, databases, latency-sensitive workloads |

---

## 2. Why SSDs Are Faster

Three structural reasons:

**1. No seek time or rotational latency.** An HDD's dominant cost is *mechanical* — physically moving a head and waiting for the disk to rotate to the right spot. An SSD has no head and nothing spins; the controller just addresses a memory cell electronically, similar in spirit to how RAM is addressed (though flash is slower than RAM and has its own quirks).

```
HDD random read:  [seek ~4-9ms] + [rotational latency ~2-4ms] + [transfer ~0.1ms]
                   ≈ 6-13ms total, dominated by mechanical movement

SSD random read:  [electronic addressing + transfer ~0.05-0.1ms]
                   ≈ 100x+ faster for random access patterns
```

**2. Massive internal parallelism.** An SSD is internally organized into many independent NAND flash chips/dies/planes, and the controller can read/write to many of them simultaneously. An HDD fundamentally has one head that can only be in one place at a time.

```
HDD: one head, one place at a time — requests are serialized physically.

SSD: controller
      ├──▶ NAND chip 1  (read in parallel)
      ├──▶ NAND chip 2  (read in parallel)
      ├──▶ NAND chip 3  (read in parallel)
      └──▶ NAND chip 4  (read in parallel)
     Many requests serviced concurrently → much higher IOPS
     (I/O Operations Per Second)
```

**3. No penalty for random access patterns.** On an HDD, random I/O (jumping between distant parts of the disk) is dramatically slower than sequential I/O because of repeated seeking. On an SSD, random and sequential reads perform much more similarly (though sequential is still somewhat faster due to how flash pages/blocks are organized), which is why SSDs transformed database and VM workloads that are naturally random-access-heavy.

**The trade-off:** SSDs have a finite number of program/erase cycles per cell (write endurance) — heavy sustained writes wear them out over time, which HDDs don't suffer from in the same way. SSD controllers mitigate this with wear-leveling (spreading writes evenly across cells) and over-provisioning, but it's the reason SSD lifespan is often measured in "total bytes written" (TBW) rather than just time.

---

## 3. What is RAID and Why Use It?

**RAID (Redundant Array of Independent/Inexpensive Disks)** combines multiple physical disks into one logical unit to achieve one or more of: better performance, redundancy (fault tolerance), or both. It is NOT a backup — RAID protects against a *disk failing*, not against accidental deletion, ransomware, or a bug corrupting data. Backups are still required.

```
Without RAID:
┌────────┐
│ Disk 1 │  ── holds everything. If it dies, everything is gone.
└────────┘

With RAID (conceptually):
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Disk 1 │ │ Disk 2 │ │ Disk 3 │ │ Disk 4 │  ── combined by a RAID
└────────┘ └────────┘ └────────┘ └────────┘     controller (hardware or
        \_______  ________/                     software) into ONE
                \/                               logical volume, with
        ┌────────────────┐                       rules about how data
        │ Logical Volume │                        is spread/duplicated.
        └────────────────┘
```

---

## 4. RAID 0 — Striping

Data is split into chunks ("stripes") and spread evenly across all disks. No redundancy at all.

```
File data: [A1][A2][A3][A4][A5][A6]

Disk 1: A1  A4
Disk 2: A2  A5
Disk 3: A3  A6

┌────────┐ ┌────────┐ ┌────────┐
│Disk 1  │ │Disk 2  │ │Disk 3  │
│  A1    │ │  A2    │ │  A3    │
│  A4    │ │  A5    │ │  A6    │
└────────┘ └────────┘ └────────┘
Reads/writes happen in PARALLEL across all 3 disks → speed multiplies (~3x)
```

- **Speed:** Excellent (reads/writes parallelized across all disks).
- **Redundancy:** None — if ANY one disk fails, ALL data is lost (since every file is split across disks).
- **Usable capacity:** 100% of total disk space (N disks × size = full usable capacity).
- **Use case:** Scratch space, video editing caches, temporary high-throughput workloads where data loss is acceptable/recoverable elsewhere.

---

## 5. RAID 1 — Mirroring

Every disk is an exact duplicate ("mirror") of every other disk in the array.

```
File data: [A1][A2][A3]

Disk 1: A1 A2 A3     (full copy)
Disk 2: A1 A2 A3     (identical full copy)

┌────────┐ ┌────────┐
│Disk 1  │ │Disk 2  │
│  A1    │ │  A1    │
│  A2    │ │  A2    │
│  A3    │ │  A3    │
└────────┘ └────────┘
Write A1 → written to BOTH disks. Read A1 → can be read from EITHER disk.
```

- **Speed:** Write speed = single disk speed (must write to all mirrors). Read speed can improve (can read from whichever mirror is free).
- **Redundancy:** Excellent — can survive a disk failure with zero data loss (up to N-1 disk failures in an N-way mirror).
- **Usable capacity:** 50% of total disk space (2 disks of 1TB each = 1TB usable, not 2TB).
- **Use case:** Critical data where downtime/loss is unacceptable — OS boot drives, small critical databases.

---

## 6. RAID 5 — Striping with Distributed Parity

Data is striped across disks (like RAID 0), but one extra "parity" block per stripe is computed and stored, rotated across different disks so no single disk is a bottleneck. Parity allows reconstruction of a failed disk's data.

```
3 data disks + parity, but parity ROTATES per stripe (not fixed to one disk):

           Disk 1    Disk 2    Disk 3    Disk 4
Stripe 1:   A1        A2        A3        Parity(A)
Stripe 2:   B1        B2        Parity(B) B3
Stripe 3:   C1        Parity(C) C2        C3
Stripe 4:  Parity(D)  D1        D2        D3

Parity = XOR of the data blocks in that stripe.
Example: A1=0110, A2=1010, A3=0011  →  Parity(A) = A1 XOR A2 XOR A3 = 1111

If Disk 2 fails, its data is reconstructed on the fly:
  A2 = A1 XOR A3 XOR Parity(A)   (any one missing value can be recovered
                                   from XOR of the other three)
```

- **Speed:** Good read speed (data striped across disks). Writes are slower than RAID 0 due to parity calculation overhead (the "RAID 5 write penalty" — a small write requires reading old data + old parity, then writing new data + new parity).
- **Redundancy:** Survives exactly **1** disk failure. A second simultaneous failure loses all data.
- **Usable capacity:** (N-1)/N of total — e.g., 4 disks of 1TB = 3TB usable (1TB "spent" on parity, though it's spread across all disks, not one dedicated disk).
- **Use case:** File servers, general-purpose storage needing a balance of capacity, redundancy, and cost — historically very popular, though large-capacity drives have made rebuild times (see below) a growing concern.

**Rebuild risk:** if a disk fails, replacing it and rebuilding requires reading ALL remaining disks to recompute the missing data — with today's multi-TB drives, this can take many hours, during which a second disk failure would be catastrophic (unrecoverable). This is a major reason RAID 6 (dual parity, tolerates 2 failures) and RAID 10 have grown more popular for large arrays.

---

## 7. RAID 10 — Mirrored Stripes

RAID 10 (aka RAID 1+0) combines mirroring and striping: disks are first mirrored in pairs, then those mirrored pairs are striped together.

```
4 disks = 2 mirrored pairs, striped across each other:

Mirror Pair 1          Mirror Pair 2
┌────────┐┌────────┐   ┌────────┐┌────────┐
│Disk 1  ││Disk 2  │   │Disk 3  ││Disk 4  │
│  A1    ││  A1    │   │  A2    ││  A2    │  ◀ striped: A1 on pair 1,
│  A3    ││  A3    │   │  A4    ││  A4    │     A2 on pair 2, etc.
└────────┘└────────┘   └────────┘└────────┘
   (mirror)                (mirror)
        \______________________/
              (striped together)
```

- **Speed:** Excellent — combines RAID 0's parallel read/write speed with RAID 1's redundancy.
- **Redundancy:** Can survive multiple disk failures, AS LONG AS both disks in the same mirrored pair don't fail simultaneously.
- **Usable capacity:** 50% of total (same as RAID 1 — every block is mirrored once).
- **Use case:** High-performance databases and workloads that need both speed AND redundancy and can afford the 50% capacity cost — commonly recommended for production database storage.

---

## 8. Choosing a RAID Level

| RAID | Min Disks | Redundancy | Usable Capacity | Read Speed | Write Speed | Typical Use |
|------|-----------|------------|------------------|------------|-------------|-------------|
| 0 | 2 | None | 100% | Excellent | Excellent | Scratch/temp data, non-critical speed |
| 1 | 2 | Survives 1 failure | 50% | Good | Moderate | Critical small volumes, OS drives |
| 5 | 3 | Survives 1 failure | (N-1)/N | Good | Moderate (parity overhead) | General file servers |
| 10 | 4 | Survives multiple (not same pair) | 50% | Excellent | Excellent | Production databases, high I/O |

Quick mental model: **RAID 0 = speed, no safety. RAID 1 = safety, no speed gain, costs half capacity. RAID 5 = balanced but slower writes + risky rebuilds. RAID 10 = speed + safety, but costs half capacity + more disks.**

---

## 9. Hands-On Exercises

**Exercise 1:** You have four 2TB disks. Calculate the usable capacity under RAID 0, RAID 1, RAID 5, and RAID 10. Which configuration gives the most usable space? Which gives the best fault tolerance?

**Exercise 2:** On your own machine (or via cloud provider docs — AWS EBS, GCP Persistent Disk), find whether your primary drive is SSD or HDD-backed, and note its advertised IOPS or throughput. Compare it to a spinning-disk-backed option if your provider offers one.

**Exercise 3:** Explain, using XOR arithmetic, how RAID 5 reconstructs data from a failed disk. Given three data blocks `A1=1100`, `A2=0101`, `A3=1010`, compute the parity block, then show how you'd recover `A2` if only `A1`, `A3`, and the parity block survive.

**Exercise 4:** A production team proposes RAID 5 for a 12-disk, 8TB-per-disk array used for a heavily-written database. Identify the specific risk with this design (hint: rebuild time under a disk failure) and propose an alternative RAID level, explaining the capacity trade-off.

**Exercise 5:** Write a short explanation (3-5 sentences) of why "RAID is not a backup," including at least two failure scenarios RAID does NOT protect against.

---

## 10. Interview Q&A

**Q: Why are SSDs faster than HDDs?**
Answer: SSDs have no moving parts, so they avoid the mechanical seek time and rotational latency that dominate HDD random-access latency. SSDs also have massive internal parallelism (multiple NAND chips accessed concurrently by the controller), giving much higher IOPS, and random access performs close to sequential access speed, unlike HDDs where random I/O is dramatically slower due to repeated physical head movement.

**Q: What's the difference between RAID 0 and RAID 1?**
Answer: RAID 0 stripes data across disks with zero redundancy — it maximizes speed and usable capacity (100%) but any single disk failure loses all data. RAID 1 mirrors data across disks — every disk holds a full copy, providing strong fault tolerance (can survive a disk failure with zero data loss) at the cost of halving usable capacity, with write speed capped at single-disk speed since every write must go to all mirrors.

**Q: How does RAID 5 achieve fault tolerance without mirroring every disk?**
Answer: RAID 5 stripes data across disks like RAID 0, but computes an extra parity block per stripe (typically via XOR of the data blocks) and rotates which physical disk holds the parity for each stripe. If one disk fails, its missing data can be reconstructed by XOR-ing the corresponding blocks on the remaining disks. This gives single-disk fault tolerance while only sacrificing 1/N of total capacity to parity, rather than 50% as with mirroring.

**Q: Why has RAID 5 become riskier as disk capacities have grown?**
Answer: Rebuilding a failed disk in RAID 5 requires reading every block on all remaining disks to recompute the lost data. With large multi-terabyte drives, this rebuild can take many hours, during which the array has zero redundancy — a second disk failure (or even an unrecoverable read error on a remaining disk) during that window causes total data loss. This has pushed many production systems toward RAID 6 (dual parity, survives 2 failures) or RAID 10 for large arrays.

**Q: When would you choose RAID 10 over RAID 5?**
Answer: RAID 10 is preferred when both write performance and fault tolerance matter more than maximizing usable capacity — e.g., production database storage with heavy random I/O. RAID 10 avoids RAID 5's parity write penalty (no need to read-modify-write parity blocks) and has much faster/safer rebuilds (only needs to copy from the failed disk's mirror partner, not recompute from the whole array), at the cost of 50% usable capacity versus RAID 5's (N-1)/N.

**Q: Is RAID a substitute for backups? Why or why not?**
Answer: No. RAID protects against physical disk failure by keeping redundant copies or parity, but it does not protect against accidental deletion, application bugs corrupting data, ransomware/malware, or a filesystem-level corruption — because those changes get replicated/mirrored to all disks just as faithfully as legitimate writes. Backups (ideally versioned and stored separately, e.g., offsite or in a different failure domain) are still required to recover from those scenarios.
