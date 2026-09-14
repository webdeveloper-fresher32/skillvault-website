# Operating Systems Cheatsheet

Dense, single-page, last-minute interview reference.

---

### Process States

```
        admit          dispatch
  New ---------> Ready ----------> Running
                  ^                   |  |
                  |                   |  | exit
          (I/O or |       interrupt   |  v
        event done)|<------------------  Terminated
                  |                   |
                  |    I/O or event   |
                  +------------------ v
                            Waiting
```

- **New** → process is being created.
- **Ready** → loaded in memory, waiting for CPU.
- **Running** → instructions being executed by CPU.
- **Waiting/Blocked** → waiting on I/O or an event.
- **Terminated** → execution finished, resources being reclaimed.

---

### Process vs Thread

| Aspect | Process | Thread |
|---|---|---|
| Definition | Independent program in execution | Lightweight unit of execution within a process |
| Memory | Separate address space | Shares address space with parent process |
| Creation cost | Expensive (fork/exec) | Cheap |
| Context switch | Slower (full memory map swap) | Faster (registers + stack only) |
| Communication | IPC (pipes, sockets, shared memory) | Direct via shared memory (needs sync) |
| Failure isolation | One process crash doesn't kill others | One thread crash can crash whole process |
| Example | Separate `node` server instances | Worker threads within one Node process |

---

### Mutex vs Semaphore

| Aspect | Mutex | Semaphore |
|---|---|---|
| Purpose | Mutual exclusion (lock) | Signaling / resource counting |
| Ownership | Owned by the locking thread; only owner can unlock | No ownership; any thread can signal/wait |
| Value | Binary (locked/unlocked) | Integer counter (binary or counting) |
| Use case | Protect a critical section | Limit concurrent access to N resources |
| Operations | `lock()` / `unlock()` | `wait()`/`P()` (decrement), `signal()`/`V()` (increment) |

---

### CPU Scheduling Algorithms

| Algorithm | One-liner |
|---|---|
| FCFS (First Come First Served) | Runs processes strictly in arrival order; non-preemptive, causes convoy effect |
| SJF (Shortest Job First) | Picks the process with the smallest burst time next; minimizes average waiting time but needs burst-time prediction |
| SRTF (Shortest Remaining Time First) | Preemptive version of SJF; switches to a new arrival if its remaining time is shorter |
| Priority Scheduling | Runs the highest-priority process first; can starve low-priority processes without aging |
| Round Robin | Each process gets a fixed time quantum in circular order; fair, good for time-sharing systems |
| Multilevel Queue | Processes are permanently split into queues (e.g., system, interactive, batch) each with its own scheduling algorithm |
| Multilevel Feedback Queue | Like multilevel queue, but processes move between queues based on behavior and aging, avoiding starvation |

---

### Deadlock — 4 Necessary Conditions (Coffman Conditions)

1. **Mutual Exclusion** — at least one resource is held in a non-shareable mode.
2. **Hold and Wait** — a process holds a resource while waiting for another.
3. **No Preemption** — a resource can only be released voluntarily by the process holding it.
4. **Circular Wait** — a cycle of processes each waiting for a resource held by the next.

All four must hold simultaneously for deadlock to occur — breaking any one prevents it.

---

### Page Replacement Algorithms

| Algorithm | One-liner |
|---|---|
| FIFO | Evicts the oldest page loaded into memory, regardless of usage; simple but suffers Belady's anomaly |
| LRU (Least Recently Used) | Evicts the page not used for the longest time; approximates optimal well in practice |
| Optimal (MIN/Belady's) | Evicts the page that will not be used for the longest time in the future; theoretical best, needs future knowledge |

---

### Paging vs Segmentation

| Aspect | Paging | Segmentation |
|---|---|---|
| Division | Fixed-size blocks (pages) | Variable-size logical units (segments) |
| Basis | Physical, transparent to programmer | Logical (code, stack, heap, data) |
| Fragmentation | Internal fragmentation | External fragmentation |
| Address | Page number + offset | Segment number + offset |
| Mapping | Page table | Segment table |

---

### Virtual Memory — Key Terms

- **Virtual address space** — the process's private, contiguous view of memory, mapped by the MMU to physical frames.
- **Page fault** — access to a page not currently in physical memory; triggers OS to fetch it from disk.
- **Thrashing** — system spends more time paging than executing due to insufficient physical memory.
- **Demand paging** — pages are loaded into memory only when accessed, not all upfront.
- **Copy-on-write (COW)** — child and parent share pages until either writes, then the page is duplicated.
- **TLB (Translation Lookaside Buffer)** — cache of recent virtual-to-physical address translations to speed up lookups.
- **Working set** — the set of pages a process actively uses in a given time window.

---

### Disk Scheduling Algorithms

| Algorithm | One-liner |
|---|---|
| FCFS | Services requests in arrival order; simple but can cause long seek times |
| SSTF (Shortest Seek Time First) | Services the request closest to current head position; can starve far-away requests |
| SCAN (Elevator) | Head moves in one direction servicing requests, reverses at the end, like an elevator |
| C-SCAN | Head moves in one direction only, jumps back to start once it reaches the end, giving uniform wait time |
| LOOK / C-LOOK | Like SCAN/C-SCAN but reverses/jumps as soon as no more requests exist in the current direction, not at the physical end |

---

### Linux Troubleshooting Quick Table

| Task | Command |
|---|---|
| Find what's using a port | `lsof -i :8080` or `sudo netstat -tulpn \| grep 8080` |
| Kill a process by PID | `kill -9 <pid>` |
| Kill a process by name | `pkill -9 <name>` |
| Find a process | `ps aux \| grep <name>` |
| Check memory usage | `free -h` |
| Check disk usage | `df -h` |
| Check directory size | `du -sh <dir>` |
| View live resource usage | `top` or `htop` |
| View system logs (systemd) | `journalctl -xe` |
| Tail a log file live | `tail -f /var/log/syslog` |
| Check CPU/load average | `uptime` |
| List open files by process | `lsof -p <pid>` |
| Check network connections | `ss -tulpn` |
| Check running services | `systemctl status <service>` |
| Check disk I/O | `iostat -x 1` |
