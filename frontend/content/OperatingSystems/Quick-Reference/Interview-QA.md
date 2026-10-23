# Operating Systems Interview Q&A

50 questions covering the full Operating Systems course, organized by topic.

---

## Processes & Threads (Q1–Q6)

**Q1. What is a process?**
Answer: A process is an instance of a program in execution. It consists of the program's code, a private address space (text, data, heap, stack segments), a program counter, CPU register values, open file descriptors, and OS-managed metadata like a process control block (PCB). The OS isolates each process's memory from others, so one process cannot directly read or corrupt another's memory. A single program can be run as multiple independent processes simultaneously, each with its own state.

---

**Q2. What is the difference between a process and a thread?**
Answer: A process is an independent unit of execution with its own isolated address space, while a thread is a lightweight unit of execution that lives inside a process and shares that process's address space, open files, and heap with other threads in the same process. Because threads share memory, creating a thread and switching between threads is cheaper than doing so for processes, but that shared memory also means a bug in one thread (e.g., corrupting a shared data structure) can affect the whole process, whereas a crashing process does not directly affect other processes. Inter-thread communication is direct (shared variables with synchronization), while inter-process communication requires explicit IPC mechanisms like pipes or sockets.

---

**Q3. What is a Process Control Block (PCB) and what does it store?**
Answer: The PCB is a kernel data structure that stores all information the OS needs to manage a process — process ID, process state (ready, running, waiting), program counter, CPU register values, CPU scheduling information (priority, queue pointers), memory management information (page tables, segment tables), accounting information (CPU time used), and I/O status (open file descriptors, allocated devices). During a context switch, the OS saves the current process's state into its PCB and loads the next process's state from its PCB, enabling the illusion of multiple processes running concurrently on limited CPU cores.

---

**Q4. What is a context switch and why is it expensive?**
Answer: A context switch is the act of saving the CPU state of a currently running process or thread and loading the saved state of another so it can resume execution. It is expensive because it involves saving/restoring registers and the program counter, updating memory management structures (like switching page tables for a process switch), and often invalidates CPU caches (L1/L2) and the TLB, causing subsequent memory accesses to be slower until the cache warms up again. Thread context switches within the same process are cheaper than process switches because the address space and page tables don't need to change.

---

**Q5. What are the different types of process states, and what are zombie and orphan processes?**
Answer: A process moves through New, Ready, Running, Waiting/Blocked, and Terminated states during its lifetime. A zombie process is one that has finished execution (called `exit()`) but still has an entry in the process table because its parent has not yet called `wait()` to read its exit status — it consumes no resources except a PCB slot but appears in `ps` output as `<defunct>`. An orphan process is one whose parent terminated before it did; orphans are automatically re-parented to `init`/`systemd` (PID 1), which periodically reaps them via `wait()`, preventing them from becoming permanent zombies.

---

**Q6. What is the difference between `fork()` and `exec()` in Unix/Linux?**
Answer: `fork()` creates a new child process that is an almost exact duplicate of the calling (parent) process — same code, data, and open file descriptors, but a new PID — and returns twice: 0 in the child and the child's PID in the parent. `exec()` (in its family of variants like `execve`) replaces the current process's memory image with a new program, keeping the same PID but discarding the old code and data. The classic Unix pattern to run a new program is `fork()` followed by `exec()` in the child: fork duplicates the process, and exec then loads the new program into that duplicated process, which is how shells launch commands.

---

## CPU Scheduling (Q7–Q14)

**Q7. What is the goal of a CPU scheduler and what metrics are used to evaluate it?**
Answer: The CPU scheduler decides which ready process gets the CPU next, aiming to maximize CPU utilization and throughput while minimizing waiting time, turnaround time, and response time, and ensuring fairness across processes. Turnaround time is the total time from submission to completion; waiting time is time spent in the ready queue; response time is the time from submission until the first response (important for interactive systems). Different scheduling algorithms optimize for different combinations of these — batch systems favor throughput, interactive systems favor response time.

---

**Q8. What is the difference between preemptive and non-preemptive scheduling?**
Answer: In non-preemptive scheduling, once a process is given the CPU, it keeps it until it voluntarily releases it (via completion or blocking on I/O) — the scheduler cannot forcibly take the CPU away, as in FCFS or non-preemptive SJF. In preemptive scheduling, the OS can forcibly suspend a running process to give the CPU to another, typically triggered by a timer interrupt or the arrival of a higher-priority process — examples include Round Robin, SRTF, and preemptive priority scheduling. Preemptive scheduling gives better responsiveness for interactive and real-time systems but introduces overhead from more frequent context switches and requires careful synchronization to avoid race conditions.

---

**Q9. Explain FCFS scheduling and its main drawback.**
Answer: First-Come-First-Served scheduling executes processes strictly in the order they arrive in the ready queue, using a simple FIFO structure. It is non-preemptive and trivial to implement, but its major drawback is the "convoy effect": if a long CPU-bound process is at the front of the queue, all shorter processes behind it must wait, dragging down average waiting time even though those shorter jobs could have finished quickly if scheduled first. This makes FCFS a poor choice for interactive or time-sensitive workloads.

---

**Q10. What is Shortest Job First (SJF) scheduling and how does it differ from SRTF?**
Answer: SJF selects the ready process with the smallest total CPU burst time to run next; it is provably optimal for minimizing average waiting time among non-preemptive algorithms, but requires predicting burst times in advance (often estimated via exponential averaging of past bursts), and can starve long processes if short ones keep arriving. SRTF (Shortest Remaining Time First) is the preemptive variant: if a new process arrives with a burst time shorter than the remaining time of the currently running process, the scheduler preempts the current process in favor of the new arrival, further reducing average waiting time at the cost of more context switches.

---

**Q11. How does Round Robin scheduling work, and what is the effect of time quantum size?**
Answer: Round Robin assigns each process a fixed time slice (quantum) and cycles through the ready queue, preempting a process when its quantum expires and moving it to the back of the queue. It's designed for time-sharing systems since every process gets regular CPU access, ensuring good response time. The time quantum size is critical: too large and Round Robin degenerates into FCFS-like behavior with poor responsiveness; too small and the overhead of frequent context switches dominates useful work, hurting throughput. A common guideline is choosing a quantum where roughly 80% of CPU bursts complete within one quantum.

---

**Q12. What is priority scheduling and how is starvation avoided?**
Answer: Priority scheduling assigns each process a priority number and always runs the highest-priority ready process next (can be preemptive or non-preemptive). Its main weakness is starvation: a low-priority process may never run if higher-priority processes keep arriving. This is solved with aging — gradually increasing the priority of processes that have waited a long time in the ready queue, ensuring that even the lowest-priority process eventually becomes the highest priority and gets scheduled.

---

**Q13. What is a Multilevel Feedback Queue and why is it considered the most general scheduling algorithm?**
Answer: A Multilevel Feedback Queue (MLFQ) maintains several queues with different priority levels and different time quantum sizes, and dynamically moves processes between queues based on their observed behavior: a CPU-bound process that uses its full time quantum gets demoted to a lower-priority (longer-quantum) queue, while an I/O-bound process that yields quickly stays at a higher-priority (shorter-quantum) queue for responsiveness. Aging is used to promote long-waiting processes back up, preventing starvation. It's considered the most general algorithm because its parameters (number of queues, quantum per queue, promotion/demotion rules) can be tuned to approximate almost any other scheduling policy.

---

**Q14. What is the difference between CPU-bound and I/O-bound processes, and why does the scheduler care?**
Answer: A CPU-bound process spends most of its time doing computation and issues few I/O requests (e.g., video encoding, scientific computation), while an I/O-bound process spends most of its time waiting on I/O operations like disk or network and issues frequent, short CPU bursts (e.g., a web server or text editor). A good scheduler distinguishes between them to maximize overall system utilization: it should prioritize I/O-bound processes so they can quickly issue their next I/O request and keep the I/O subsystem busy, while giving CPU-bound processes larger time slices since they need the CPU for longer stretches — mixing both types well keeps both CPU and I/O devices busy concurrently.

---

## Synchronization (Q15–Q22)

**Q15. What is a race condition and how does it occur?**
Answer: A race condition occurs when multiple threads or processes access shared data concurrently, and the final outcome depends on the non-deterministic timing/order of their execution. A classic example is two threads both executing `counter++`, which is not atomic — it involves a read, an increment, and a write. If both threads read the same initial value before either writes back, one increment is lost, leaving the counter with an incorrect final value. Race conditions are notoriously hard to debug because they may not manifest consistently, only appearing under specific timing/load conditions.

---

**Q16. What is a critical section, and what three conditions must a solution satisfy?**
Answer: A critical section is a segment of code that accesses shared resources and must not be executed by more than one thread/process at a time. A correct solution to the critical-section problem must satisfy: (1) Mutual Exclusion — only one process can be in its critical section at a time; (2) Progress — if no process is in its critical section, one of the processes waiting to enter must be able to do so without indefinite postponement, and this decision cannot be delayed indefinitely by processes not interested in entering; (3) Bounded Waiting — there must be a limit on how many times other processes are allowed to enter their critical sections after a process has requested entry, before that request is granted, preventing starvation.

---

**Q17. What is a mutex and how does it work?**
Answer: A mutex (mutual exclusion lock) is a synchronization primitive that allows only one thread to hold it at a time, ensuring exclusive access to a critical section. A thread calls `lock()` before entering the critical section; if another thread already holds the lock, the calling thread blocks until it's released via `unlock()`. Mutexes have ownership semantics — typically only the thread that locked the mutex is allowed to unlock it, and most implementations will error or behave undefined if a different thread tries to unlock it. They're the simplest tool for protecting shared data like a counter, list, or cache from concurrent modification.

---

**Q18. What is a semaphore, and what is the difference between binary and counting semaphores?**
Answer: A semaphore is an integer variable manipulated only through two atomic operations: `wait()`/`P()`, which decrements the value and blocks if the result would be negative, and `signal()`/`V()`, which increments the value and wakes a waiting thread if any. A binary semaphore has a value restricted to 0 or 1 and behaves similarly to a mutex for enforcing mutual exclusion. A counting semaphore can hold any non-negative integer and is used to control access to a pool of N identical resources (e.g., limiting a connection pool to 10 concurrent connections) — unlike a mutex, a semaphore has no ownership, so any thread can call signal, making it suitable for signaling between threads, not just locking.

---

**Q19. What is the difference between a mutex and a semaphore?**
Answer: A mutex is specifically for mutual exclusion — only the thread that locked it can unlock it, and it's a binary lock/unlock construct tied to protecting one critical section. A semaphore is a more general signaling mechanism with an integer count and no ownership requirement — any thread can increment (signal) it, even one that never decremented (waited on) it, making semaphores useful for coordinating between producer and consumer threads or limiting concurrent access to a resource pool of size N. In short: use a mutex to protect a single shared resource from concurrent access by the same protecting thread; use a semaphore to manage access to multiple instances of a resource or to signal events between threads.

---

**Q20. What is a deadlock in the context of synchronization primitives, and give an example.**
Answer: A synchronization deadlock occurs when two or more threads are each waiting for a lock held by another, so none can proceed. The classic example is two threads that need both Lock A and Lock B: Thread 1 acquires Lock A then tries to acquire Lock B, while Thread 2 acquires Lock B then tries to acquire Lock A — if this happens simultaneously, Thread 1 waits forever for B (held by Thread 2) and Thread 2 waits forever for A (held by Thread 1). The standard prevention technique is lock ordering: always acquire locks in the same global order across all threads, which breaks the circular-wait condition necessary for deadlock.

---

**Q21. What is a monitor, and how does it relate to condition variables?**
Answer: A monitor is a higher-level synchronization construct that bundles shared data, the procedures that operate on it, and an implicit lock into a single abstraction, guaranteeing that only one thread can execute any of the monitor's procedures at a time — many modern languages implement this via `synchronized` methods (Java) or classes with built-in locking. Condition variables are used within monitors to let a thread that cannot proceed (e.g., a consumer finding an empty queue) release the monitor's lock and sleep until another thread signals that the condition has changed (e.g., a producer adding an item), via `wait()`/`notify()` semantics — this avoids busy-waiting while still enforcing mutual exclusion around the shared state.

---

**Q22. What is the classic Producer-Consumer problem and how is it typically solved?**
Answer: The Producer-Consumer problem involves producer threads generating data into a shared, bounded buffer and consumer threads removing data from it, requiring synchronization so producers don't write to a full buffer and consumers don't read from an empty one, while also preventing simultaneous access corrupting the buffer's internal state. It's typically solved using two counting semaphores — `empty` (initialized to buffer size, tracking free slots) and `full` (initialized to 0, tracking filled slots) — plus a mutex to protect the buffer's internal pointers during insert/remove. Producers wait on `empty`, lock the mutex, insert, unlock, then signal `full`; consumers do the mirror image, waiting on `full` and signaling `empty`.

---

## Deadlocks (Q23–Q28)

**Q23. What are the four necessary conditions for deadlock?**
Answer: Deadlock can only occur if all four Coffman conditions hold simultaneously: (1) Mutual Exclusion — resources are held in a non-shareable mode; (2) Hold and Wait — a process holds at least one resource while waiting to acquire additional resources held by others; (3) No Preemption — resources cannot be forcibly taken away from a process; they must be released voluntarily; (4) Circular Wait — a set of processes {P1, P2, ..., Pn} exists such that P1 waits for a resource held by P2, P2 waits for one held by P3, and so on, with Pn waiting for one held by P1. Preventing deadlock means ensuring at least one of these conditions can never hold.

---

**Q24. What is the difference between deadlock prevention and deadlock avoidance?**
Answer: Deadlock prevention works by structurally ensuring at least one of the four necessary conditions can never occur — e.g., enforcing a global lock-acquisition order to eliminate circular wait, or requiring processes to request all needed resources upfront to eliminate hold-and-wait. Deadlock avoidance, in contrast, allows the conditions to potentially hold but uses runtime information (like the Banker's Algorithm) to only grant resource requests that keep the system in a "safe state" — one where there's still a sequence in which all processes can complete — rejecting or delaying requests that would lead to an unsafe state. Prevention is more restrictive but simpler; avoidance is more flexible but requires advance knowledge of maximum resource needs.

---

**Q25. What is the Banker's Algorithm?**
Answer: The Banker's Algorithm is a deadlock-avoidance algorithm that treats resource allocation like a banker extending credit: before granting a resource request, it simulates the allocation and checks if the resulting state is "safe" — meaning there exists at least one order in which all currently active processes could finish using only the resources currently available plus what gets released as each finishes. It requires each process to declare its maximum possible resource need in advance. If granting a request would leave the system in an unsafe state (no such completion order exists), the request is denied or deferred, even if resources are currently available, trading some resource utilization for a deadlock-free guarantee.

---

**Q26. How is deadlock detected and recovered from, if it isn't prevented or avoided?**
Answer: Deadlock detection works by periodically building a resource-allocation graph (or wait-for graph) and checking for cycles — a cycle among processes waiting for resources held by each other indicates deadlock (with single-instance resources, a cycle is sufficient; with multiple instances, a more general algorithm similar to Banker's is needed to confirm no safe sequence exists). Once detected, recovery options include: process termination (kill one or more deadlocked processes, ideally the ones with the least invested work), or resource preemption (forcibly take a resource from one process and give it to another, then roll that process back to a safe checkpoint). Both approaches have costs — lost work or added complexity in checkpoint/rollback — so many production systems simply avoid heavy resource-locking patterns rather than implement full detection.

---

**Q27. What is a livelock, and how does it differ from deadlock?**
Answer: In a deadlock, involved processes are blocked and make no progress at all. In a livelock, processes are not blocked — they are actively executing and changing state in response to each other, but none of them make actual forward progress, similar to two people repeatedly stepping side to side trying to avoid each other in a hallway. A common cause is poorly designed retry/backoff logic where two threads each detect potential deadlock and back off, then retry at the same moment, colliding again indefinitely. Livelocks are often harder to detect than deadlocks because CPU utilization looks normal or even high, masking the lack of progress.

---

**Q28. Give a practical, real-world example of how deadlock can occur in application code and how to prevent it.**
Answer: A common real-world case is database row-locking: Transaction A locks Row 1 then tries to update Row 2, while Transaction B locks Row 2 then tries to update Row 1 — each transaction waits on a lock held by the other, and most databases will detect this and abort one transaction with a deadlock error. The application-level fix is to always acquire locks (or perform updates) in a consistent order across all code paths — e.g., always lock rows in ascending primary-key order — which eliminates the circular-wait condition. Additionally, keeping transactions short and using appropriate isolation levels reduces both the likelihood and blast radius of such deadlocks.

---

## Memory Management (Q29–Q34)

**Q29. What is the difference between logical (virtual) address and physical address?**
Answer: A logical (or virtual) address is the address generated by the CPU during program execution, as seen by the running process — it's what the program's pointers and instructions reference. A physical address is the actual location in RAM hardware. The Memory Management Unit (MMU) translates logical addresses to physical addresses at runtime using page tables or segment tables, so a process can be given a contiguous, predictable view of memory (0 to max) even though its actual data may be scattered across non-contiguous physical frames, and can even be partially swapped out to disk.

---

**Q30. What is paging and how does it eliminate external fragmentation?**
Answer: Paging divides a process's logical address space into fixed-size blocks called pages, and physical memory into equal-sized blocks called frames. Any page can be mapped to any free frame, so a process's memory doesn't need to occupy contiguous physical memory — the page table records the page-to-frame mapping for each process. Because pages and frames are the same fixed size, allocating memory to a process is just finding any N free frames, regardless of their physical location, which completely eliminates external fragmentation (though it introduces internal fragmentation from the last, partially-used page).

---

**Q31. What is segmentation, and how does it differ from paging?**
Answer: Segmentation divides a process's address space into variable-sized logical units called segments, corresponding to meaningful program divisions like code, stack, heap, and data — each segment has a base and limit in a segment table. Unlike paging, which is a physical/transparent division invisible to the programmer, segmentation reflects the logical structure of the program. Because segments are variable-sized, allocating them in physical memory can leave unusable gaps between segments — external fragmentation — whereas paging's fixed-size blocks avoid that but cause internal fragmentation instead. Many real systems (like x86) historically combined both: segmentation for logical structure, paging within each segment for physical allocation.

---

**Q32. What is the difference between internal and external fragmentation?**
Answer: Internal fragmentation occurs when a fixed-size allocation unit (like a page or frame) is larger than what a process actually needs, wasting the unused space within that allocated block — e.g., a process needing 4.1 KB but being given two 4 KB pages wastes almost 4 KB inside the second page. External fragmentation occurs when free memory is split into many small, non-contiguous chunks scattered throughout physical memory, such that even though total free memory is sufficient, no single contiguous block is large enough to satisfy a new allocation request — common in variable-sized allocation schemes like segmentation or contiguous memory allocation. Paging trades external fragmentation for a small amount of internal fragmentation; compaction or slab allocators are common techniques to combat external fragmentation.

---

**Q33. What is a page table, and what is a multi-level page table used for?**
Answer: A page table is a per-process data structure maintained by the OS that maps virtual page numbers to physical frame numbers, consulted by the MMU on every memory access (accelerated by the TLB cache). A single-level page table for a large address space (e.g., 32-bit or 64-bit) would itself require enormous contiguous memory just to store all possible page entries, most of which are unused. A multi-level (hierarchical) page table splits the virtual address into multiple indices that traverse a tree of smaller page tables, so page-table memory is only allocated for regions of the address space that are actually in use, dramatically saving memory at the cost of extra lookup levels (usually mitigated by the TLB).

---

**Q34. What is memory fragmentation and how do systems mitigate it over time?**
Answer: Fragmentation is the gradual waste of usable memory as it becomes divided into unusable segments through repeated allocation and deallocation cycles, reducing effective capacity even when total free space seems adequate. Systems mitigate it through techniques such as paging (fixed-size units eliminate external fragmentation), compaction (relocating allocated blocks to consolidate free space, common in older contiguous-allocation systems), slab allocation (pre-allocating fixed-size object pools in the kernel to avoid fragmentation for common allocation sizes), and buddy allocation (splitting/merging power-of-two blocks to balance fast allocation with fragmentation control). Modern OS memory allocators for user-space (like glibc's malloc or jemalloc) use similar strategies to minimize fragmentation for long-running processes.

---

## Virtual Memory (Q35–Q40)

**Q35. What is virtual memory and why is it useful?**
Answer: Virtual memory is an abstraction that gives each process the illusion of a large, contiguous, private address space, independent of how much physical RAM is actually installed and independent of other processes' memory layouts. It's implemented by mapping virtual addresses to physical frames via page tables, with pages that aren't currently needed potentially stored on disk (swap/page file). This allows the total memory demanded by all running processes to exceed physical RAM, enables memory protection between processes (each has its own address space), simplifies program loading (no need to fit entirely in RAM at once), and enables features like memory-mapped files and copy-on-write.

---

**Q36. What is a page fault, and what happens when one occurs?**
Answer: A page fault is a hardware trap that occurs when a process accesses a virtual page that is marked "not present" in its page table — either because it hasn't been loaded from disk yet, or was swapped out. When it occurs, the CPU traps into the OS's page-fault handler, which determines whether the access is valid; if valid, it locates a free physical frame (evicting a page via the replacement algorithm if none is free), reads the required page's data from disk (the backing store) into that frame, updates the page table entry to point to the new frame and mark it present, and then resumes the faulting instruction. This entire process is transparent to the application, though it introduces significant latency (disk I/O) compared to normal memory access.

---

**Q37. What is thrashing, and how can it be detected and mitigated?**
Answer: Thrashing occurs when a system is so overcommitted on physical memory relative to the demands of its running processes that it spends most of its time servicing page faults (swapping pages in and out) rather than executing actual instructions — CPU utilization paradoxically drops even as the system appears extremely busy, because processes are constantly blocked waiting on disk I/O. It can be detected by monitoring the page-fault rate relative to CPU utilization — a low CPU utilization combined with a high page-fault rate is the signature symptom. Mitigation includes reducing the degree of multiprogramming (fewer processes running concurrently), increasing physical RAM, or using the working-set model to ensure each process is only granted running privileges when enough of its "working set" of pages can fit in memory simultaneously.

---

**Q38. Compare FIFO and LRU page replacement algorithms.**
Answer: FIFO (First-In-First-Out) evicts whichever page has been resident in memory the longest, regardless of how recently or frequently it's been used — it's simple to implement with just a queue, but can suffer from Belady's Anomaly, where increasing the number of available frames can paradoxically increase the number of page faults. LRU (Least Recently Used) evicts the page that hasn't been accessed for the longest time, based on the heuristic that recently used pages are likely to be used again soon (temporal locality) — it generally performs much closer to the theoretical optimal algorithm than FIFO, but is more expensive to implement exactly (requiring tracking of access order via counters, stacks, or linked lists), so real systems often use approximations like the clock/second-chance algorithm.

---

**Q39. What is the Optimal (Belady's) page replacement algorithm, and why is it not used in practice?**
Answer: The Optimal algorithm evicts the page that will not be used again for the longest period of time in the future, guaranteeing the theoretical minimum number of page faults for any fixed sequence of memory references — it serves as a benchmark to evaluate how close other algorithms (like LRU) come to ideal behavior. It is not usable in practice because it requires perfect knowledge of future memory access patterns, which is impossible to know in a real, running system; it can only be computed retroactively, e.g., in simulations or trace-driven analysis, or approximated using access prediction heuristics.

---

**Q40. What is copy-on-write (COW), and where is it used?**
Answer: Copy-on-write is an optimization where, instead of immediately duplicating memory when it's "copied," both the original and the copy initially point to the same physical pages, marked read-only. Only when either side attempts to write to a shared page does the OS trap the write, allocate a new physical page, copy the data, and remap that process's page table entry to the new private copy — deferring the actual copy cost until it's truly needed. The classic use case is `fork()` in Unix: instead of duplicating a parent process's entire address space immediately (expensive, and often wasted if the child immediately calls `exec()`), the child initially shares all pages with the parent via COW, and pages are copied individually only if and when either process modifies them.

---

## File Systems & Disk Scheduling (Q41–Q44)

**Q41. What is an inode, and what information does it store?**
Answer: An inode (index node) is a data structure used by Unix-like file systems to store all metadata about a file except its name — including file type, permissions, owner UID/GID, size, timestamps (created, modified, accessed), link count, and pointers to the data blocks on disk that hold the actual file content (direct blocks, plus indirect/double-indirect blocks for larger files). The filename itself lives in a directory entry that simply maps a name to an inode number, which is why multiple filenames (hard links) can point to the same inode/file, and why renaming a file doesn't change its inode or invalidate open file handles.

---

**Q42. What is the difference between a hard link and a symbolic (soft) link?**
Answer: A hard link is a directory entry that points directly to a file's inode, meaning the linked filename and the original filename are indistinguishable — both reference the same underlying data and inode, share the same inode number, and the file's data isn't deleted until the last hard link (and any open file handles) to it is removed. A symbolic link is a separate small file that contains a path string pointing to another file or directory; it has its own distinct inode, can cross filesystem boundaries (unlike hard links, which are typically limited to the same filesystem), and breaks ("dangling link") if the target is deleted or moved, since it merely stores a path rather than referencing the inode directly.

---

**Q43. Explain the SCAN and C-SCAN disk scheduling algorithms.**
Answer: SCAN (the "elevator algorithm") moves the disk head in one direction, servicing every pending request along the way, until it reaches the end of the disk, then reverses direction and services requests on the way back — similar to how an elevator services floor requests. C-SCAN (Circular SCAN) also moves in one direction servicing requests, but upon reaching the end, it immediately jumps back to the beginning of the disk without servicing requests on the return trip, then starts scanning forward again — this gives more uniform wait times across all requests because it doesn't unfairly favor requests near the middle of the disk (which SCAN services twice as often as requests near the edges).

---

**Q44. Why does disk scheduling matter less on modern SSDs than on traditional HDDs?**
Answer: Disk scheduling algorithms like SCAN, C-SCAN, and SSTF were designed to minimize the mechanical seek time and rotational latency inherent in spinning HDDs, where the physical position of the read/write head relative to requested data dramatically affects access speed. SSDs have no moving parts — any block can be accessed in roughly constant time regardless of its logical or physical position (though there are still some minor variations due to internal flash translation layers and wear leveling) — so seek-time-minimizing algorithms provide little to no benefit. Modern OS I/O schedulers often detect SSDs and use simpler algorithms (like a basic FIFO/noop scheduler) to avoid unnecessary CPU overhead from reordering that wouldn't meaningfully help access latency.

---

## I/O Models (Q45–Q47)

**Q45. What is the difference between blocking and non-blocking I/O?**
Answer: In blocking I/O, when a process issues an I/O call (like `read()`), the calling thread is suspended and does no other work until the operation completes and data is available, at which point it resumes with the result. In non-blocking I/O, the I/O call returns immediately, either with the requested data if it's already available, or with an error/status code (like `EWOULDBLOCK`) indicating the operation would have blocked, letting the calling thread continue doing other work and check back later (polling) — this requires the application to actively manage retrying the operation, typically in a loop or event-driven structure.

---

**Q46. What is the difference between synchronous and asynchronous I/O, and how does it relate to blocking vs non-blocking?**
Answer: Synchronous vs asynchronous describes who performs the I/O operation and notification: in synchronous I/O, the calling thread itself is responsible for performing the actual read/write operation (even if it's non-blocking and polls repeatedly). In asynchronous I/O, the OS performs the operation entirely in the background and notifies the application (via a callback, signal, or completion event) once fully done, without the calling thread needing to poll or wait at all. Blocking/non-blocking describes whether a single I/O call itself waits for completion. These are often combined: e.g., non-blocking sockets combined with an event loop (like in Node.js or `epoll`/`select`) simulate asynchronous behavior in user space, while true async I/O (like Linux's `io_uring` or Windows IOCP) offloads the entire operation to the kernel/hardware.

---

**Q47. What are `select`, `poll`, and `epoll`, and why was `epoll` introduced?**
Answer: `select` and `poll` are system calls that let a single thread monitor multiple file descriptors for readiness (readable/writable) without spawning a thread per connection, but both require passing the entire set of watched file descriptors to the kernel on every call and linearly scanning them for status, which becomes increasingly expensive — O(n) per call — as the number of connections grows into the thousands. `epoll` (Linux-specific) was introduced to address this scalability problem: it lets the kernel maintain a persistent, registered set of watched file descriptors across calls, and returns only the subset of descriptors that actually became ready, making it O(1) relative to the number of ready events rather than the total number of watched descriptors — this is the mechanism underlying high-performance event loops like those in Nginx, Node.js's libuv, and Redis.

---

## Linux & Practical (Q48–Q50)

**Q48. How would you find and kill a process that's occupying a specific port on Linux?**
Answer: First identify the process using `lsof -i :8080` (or `sudo netstat -tulpn | grep 8080`), which shows the PID and process name bound to that port. Once you have the PID, you can gracefully stop it with `kill <pid>` (sends SIGTERM, allowing cleanup) or forcefully terminate it with `kill -9 <pid>` (sends SIGKILL, immediate termination with no cleanup) if it's unresponsive. Alternatively, `fuser -k 8080/tcp` combines identification and killing into one command. Graceful termination (SIGTERM) should always be preferred first since it lets the application close file handles, flush buffers, and shut down connections cleanly.

---

**Q49. How would you diagnose a Linux server that's running out of memory?**
Answer: Start with `free -h` to see total, used, free, and available memory along with swap usage — heavy swap usage combined with low free memory is a strong signal of memory pressure. Use `top` or `htop` sorted by memory (`Shift+M` in top) to identify the top memory-consuming processes, and `ps aux --sort=-%mem | head` for a scriptable equivalent. For deeper investigation of a specific process, `cat /proc/<pid>/status` or `smem` can break down its actual resident memory (RSS) vs shared memory. Check `dmesg | grep -i "out of memory"` or `journalctl -k | grep -i oom` to see if the kernel's OOM killer has already terminated processes, which would explain unexpected process deaths. Long-term, tools like `vmstat 1` help observe trends in memory and swap usage over time to catch slow leaks.

---

**Q50. What Linux commands would you use to check CPU load and identify which process is causing high CPU usage?**
Answer: `uptime` gives a quick view of the load average over the last 1, 5, and 15 minutes — a load average consistently higher than the number of CPU cores indicates the system is CPU-saturated. `top` or `htop` (sorted by CPU with `Shift+P`) shows real-time per-process CPU usage; `ps aux --sort=-%cpu | head` gives a scriptable, one-time snapshot of the top CPU consumers. For a specific suspicious process, `pidstat -p <pid> 1` shows per-thread CPU breakdown over time, and tools like `perf top` can profile which functions within a process are consuming the most CPU cycles at the kernel/application level, useful for pinpointing hot loops or inefficient code paths in production.
