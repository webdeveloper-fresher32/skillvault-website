# OS Rapid-Fire Interview Q&A

## How to Use This Lesson

This is the final drilling lesson before an interview. Cover the answers with your hand (or a piece of paper) and try to answer each question out loud in under 30 seconds before revealing the answer. If you stumble on any, jump back to the relevant phase of this course for a deeper refresher — the phase is noted where helpful.

---

**Q1: What is the difference between a process and a thread?**
Answer: A process is an independent execution unit with its own memory address space, file descriptors, and resources — isolated from other processes. A thread is a lightweight unit of execution within a process, sharing that process's memory and resources with other threads in the same process. Creating a thread is cheaper than creating a process, and threads communicate via shared memory (fast, but requires synchronization); processes communicate via IPC mechanisms (slower, but isolated/safer).

**Q2: What is the difference between a mutex and a semaphore?**
Answer: A mutex is a binary lock (locked/unlocked) owned by the thread that locked it — only that thread can unlock it, and it enforces mutual exclusion for a single critical section. A semaphore is a counter that allows up to N threads to access a resource concurrently, can be signaled by any thread (not just the one that waited), and is used for both mutual exclusion (binary semaphore) and resource counting (counting semaphore).

**Q3: What are the four necessary conditions for deadlock?**
Answer: Mutual exclusion (a resource can only be held by one thread at a time), hold-and-wait (a thread holds a resource while waiting for another), no preemption (a resource can't be forcibly taken from a thread), and circular wait (a cycle of threads each waiting on a resource held by the next). All four must hold simultaneously for a deadlock to occur — breaking any single one prevents it.

**Q4: How do you prevent deadlock in practice?**
Answer: The most common technique is enforcing a global lock ordering — always acquire multiple locks in the same, agreed-upon order across the entire codebase — which eliminates circular wait. Other techniques: use `tryLock()` with timeouts instead of blocking indefinitely (breaks hold-and-wait by backing off), or use a single coarser lock instead of multiple fine-grained ones where practical.

**Q5: What is the difference between paging and segmentation?**
Answer: Paging divides memory into fixed-size blocks (pages/frames), which eliminates external fragmentation but can cause internal fragmentation (wasted space inside the last page). Segmentation divides memory into variable-size, logically meaningful units (code segment, stack segment, heap segment), which maps naturally to program structure but reintroduces external fragmentation since segments are variable-sized.

**Q6: What is internal fragmentation vs external fragmentation?**
Answer: Internal fragmentation is wasted space *inside* an allocated block — e.g., a process needs 18KB but is given a 20KB page, wasting 2KB inside its own allocation. External fragmentation is wasted space *between* allocated blocks — free memory exists in total, but it's scattered in pieces too small individually to satisfy a new request, even though the sum would be enough.

**Q7: What is virtual memory and why does it exist?**
Answer: Virtual memory gives each process the illusion of a large, contiguous, private address space, independent of how much physical RAM actually exists or where it's located. It enables process isolation (one process can't read/corrupt another's memory), lets total program size exceed physical RAM (via disk-backed swap), and simplifies programming (no need to manually manage physical memory addresses).

**Q8: What is a page fault?**
Answer: A page fault occurs when a process accesses a virtual memory page that isn't currently mapped to physical RAM. The OS pauses the process, locates the page (on disk if swapped out, or allocates a new frame for it), loads it into RAM, updates the page table, and resumes the process. Frequent page faults under memory pressure cause thrashing.

**Q9: What is thrashing?**
Answer: Thrashing is when a system spends most of its time paging data in and out of memory rather than executing actual instructions, because the working set of active processes exceeds available physical RAM. Throughput collapses even though the CPU appears "busy," because nearly all that busyness is page-fault handling overhead, not useful work.

**Q10: Name three page replacement algorithms and how they differ.**
Answer: FIFO (evict the oldest-loaded page, simple but can perform poorly), LRU — Least Recently Used (evict the page unused for the longest time, generally good performance but costlier to track precisely), and Optimal/Belady's algorithm (evict the page that won't be used for the longest time in the future — theoretically best, but requires knowing the future, so it's used only as a theoretical benchmark, not implemented in practice).

**Q11: What is Belady's Anomaly?**
Answer: A counterintuitive phenomenon where increasing the number of available page frames actually *increases* the number of page faults under certain page replacement algorithms (notably FIFO). It demonstrates that "more memory always means better performance" isn't universally true and is why algorithms like LRU (which don't exhibit this anomaly) are generally preferred.

**Q12: What is a race condition?**
Answer: A race condition occurs when the correctness of a program depends on the relative timing or interleaving of multiple threads/processes accessing shared data, and that timing isn't guaranteed. Without proper synchronization, two threads reading-modifying-writing the same variable can interleave in a way that loses an update (e.g., two threads incrementing a shared counter can both read the same stale value).

**Q13: What is a critical section?**
Answer: A critical section is the part of code that accesses a shared resource and must not be executed by more than one thread/process at the same time. A correct solution to the critical section problem must guarantee mutual exclusion, progress (no indefinite postponement when the section is free), and bounded waiting (a limit on how long a thread waits before its turn).

**Q14: What is priority inversion?**
Answer: Priority inversion happens when a low-priority thread holds a lock that a high-priority thread needs, and a medium-priority thread (needing no lock) preempts the low-priority thread, indirectly blocking the high-priority thread indefinitely. It's fixed with priority inheritance — temporarily boosting the lock-holding thread's priority to that of the highest-priority thread waiting on it.

**Q15: What is context switching, and why is it not free?**
Answer: A context switch is the OS saving the complete state (registers, program counter, stack pointer, memory mappings) of the currently running process/thread and restoring that of another, so the CPU can switch what it's executing. It has real overhead: the save/restore itself takes CPU cycles, and switching often invalidates CPU cache/TLB contents, causing subsequent memory accesses to be slower until the cache "warms up" again for the new context.

**Q16: What is the difference between preemptive and non-preemptive scheduling?**
Answer: In preemptive scheduling, the OS can forcibly take the CPU away from a running process (e.g., when a higher-priority process arrives, or a time slice expires) — this enables fair time-sharing but adds context-switch overhead. In non-preemptive scheduling, a process keeps the CPU until it voluntarily yields (finishes or blocks on I/O) — simpler, but a single long-running process can starve everything else.

**Q17: What is a zombie process, and what causes it?**
Answer: A zombie is a process that has finished executing but still has an entry in the process table because its parent hasn't yet called `wait()` to read its exit status. It consumes a process table slot but no other resources. It's caused by a parent process that never calls `wait()`/`waitpid()` on a terminated child; if the parent itself dies, the zombie is "adopted" by `init`/`systemd`, which reaps it.

**Q18: What is an orphan process?**
Answer: An orphan is a process whose parent has terminated while the child is still running. It gets re-parented to the `init`/`systemd` process (PID 1), which takes over responsibility for eventually reaping it when it finishes. Unlike a zombie, an orphan is still actively running — it just has a new parent.

**Q19: What is the difference between concurrency and parallelism?**
Answer: Concurrency is about *structure* — dealing with multiple tasks that are in progress at overlapping times, potentially by interleaving them on a single core (e.g., an event loop). Parallelism is about *execution* — actually running multiple tasks at the exact same instant, which requires multiple cores/CPUs. A single-core machine can be concurrent but never truly parallel.

**Q20: What is a monitor, and how does it relate to condition variables?**
Answer: A monitor is a high-level synchronization construct that bundles a mutex with the shared data it protects and the procedures that operate on it, ensuring only one thread executes inside the monitor at a time. Condition variables are used inside monitors to let a thread release the lock and sleep until some condition becomes true (e.g., "queue is not empty"), then be woken by another thread via `signal`/`notify` — avoiding busy-waiting.

**Q21: What is the producer-consumer problem, and what does it require to solve correctly?**
Answer: It's the challenge of coordinating a producer thread adding items to a shared bounded buffer and a consumer thread removing them, without the producer overflowing a full buffer or the consumer reading from an empty one. A correct solution needs mutual exclusion around buffer access (a mutex) plus a way for threads to block/wake efficiently instead of busy-waiting (condition variables or semaphores for "buffer full" and "buffer empty" states).

**Q22: What's the difference between a hard link and a symbolic (soft) link in a file system?**
Answer: A hard link is a second directory entry pointing to the exact same inode (same underlying data) as the original file — deleting the original doesn't remove the data as long as a hard link remains, and hard links can't span file systems or point to directories. A symbolic link is a separate small file containing a *path* to the target — it breaks if the target is moved/deleted (a "dangling link"), but it can point across file systems and to directories.

**Q23: What is the difference between a system call and a library function call?**
Answer: A system call crosses the boundary from user mode to kernel mode, asking the OS kernel to perform a privileged operation (reading a file, allocating memory, creating a process) — it involves a mode switch and is relatively expensive. A regular library function call executes entirely in user mode without kernel involvement, and is much cheaper — though many library functions (like `malloc` or `fread`) internally call system calls under the hood when they actually need kernel services.

**Q24: What is copy-on-write, and where is it used?**
Answer: Copy-on-write (COW) is an optimization where, instead of immediately duplicating data when it's "copied," both copies initially share the same physical memory pages marked read-only; only when either side actually writes to a page does the OS make a private copy of just that page. It's the mechanism that makes `fork()` cheap — a child process initially shares its parent's entire address space, and pages are duplicated lazily only as they're modified.

**Q25: Why does an SSD change some traditional OS assumptions around I/O scheduling and disk algorithms?**
Answer: Classic disk scheduling algorithms (SCAN/elevator, C-SCAN) exist to minimize seek time by reordering requests to match the physical movement of an HDD's read/write head — a cost that doesn't exist on SSDs, which have no moving parts and near-uniform random access latency. On SSDs, OS-level concerns shift instead to write amplification, wear leveling, and trim/garbage collection, since flash cells wear out after a limited number of write cycles and can't be overwritten in place the way magnetic disk sectors can.
