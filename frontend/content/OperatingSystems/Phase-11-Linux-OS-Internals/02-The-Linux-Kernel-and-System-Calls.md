# The Linux Kernel and System Calls — Complete Guide

## Table of Contents
1. [What the Kernel Actually Does](#1-what-the-kernel-actually-does)
2. [User Space vs Kernel Space](#2-user-space-vs-kernel-space)
3. [What Is a System Call?](#3-what-is-a-system-call)
4. [End-to-End: How `read()` Works](#4-end-to-end-how-read-works)
5. [Common System Calls You Should Know](#5-common-system-calls-you-should-know)
6. [Observing Syscalls with `strace`](#6-observing-syscalls-with-strace)
7. [Kernel Space vs Library Calls](#7-kernel-space-vs-library-calls)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What the Kernel Actually Does

The kernel is the one piece of software that runs with full hardware privilege. Everything else — your browser, your Node.js server, your shell — runs as an unprivileged user-space process and must ask the kernel to do anything that touches shared hardware or shared state. The kernel's core responsibilities:

| Responsibility | What it means in practice |
|---|---|
| **Process management** | Creates processes (`fork`/`exec`), schedules which process/thread runs on which CPU core and for how long, handles process termination and cleanup |
| **Memory management** | Gives each process its own virtual address space, maps virtual pages to physical RAM, handles page faults, swaps memory to disk under pressure |
| **Device management** | Talks to disks, network cards, GPUs, keyboards via drivers; exposes a uniform interface (`/dev/*`, syscalls) so apps don't need to know hardware specifics |
| **File management** | Implements filesystems (ext4, xfs, etc.), tracks open file descriptors per process, enforces permissions |
| **Networking** | Implements the TCP/IP stack, manages sockets, routes packets |
| **Inter-process communication (IPC)** | Pipes, signals, shared memory, sockets — mechanisms for processes to talk to each other |
| **Security/isolation** | Enforces user/group permissions, namespaces (what containers are built on), resource limits (cgroups) |

Think of the kernel as the referee and resource manager that every process must go through to safely share one CPU, one set of RAM, and one set of devices among potentially thousands of competing processes.

---

## 2. User Space vs Kernel Space

Modern CPUs support at least two **privilege levels** (rings). Linux uses two:

```
┌───────────────────────────────────────────────────────────┐
│  USER SPACE (unprivileged, "Ring 3")                       │
│  Your app, browser, node process, bash, python...           │
│  Cannot directly touch hardware, other processes' memory,   │
│  or execute privileged CPU instructions.                    │
└───────────────────────────────────────────────────────────┘
                          │  system call (controlled entry point)
                          ▼
┌───────────────────────────────────────────────────────────┐
│  KERNEL SPACE (privileged, "Ring 0")                        │
│  The kernel — full hardware access, manages memory,          │
│  schedules CPU, talks to drivers.                            │
└───────────────────────────────────────────────────────────┘
```

This separation exists for **stability and security**: a buggy or malicious user-space program cannot corrupt kernel memory or another process's memory, because the CPU itself enforces the privilege boundary. The *only* sanctioned way to cross from user space into kernel space is a **system call**.

---

## 3. What Is a System Call?

A **system call (syscall)** is a well-defined request from a user-space program asking the kernel to perform a privileged operation on its behalf — read a file, send network data, allocate memory, create a process, etc.

```
Your code:                     What actually happens:
fd = open("file.txt")    ──▶   syscall: open()
n  = read(fd, buf, 100)  ──▶   syscall: read()
    write(1, "hi", 2)    ──▶   syscall: write()
    close(fd)            ──▶   syscall: close()
```

Every syscall is a controlled "trap" into the kernel: the CPU switches privilege level, the kernel runs a specific, validated handler for that exact request, then control returns to user space. Your program cannot jump into arbitrary kernel code — only into the specific entry points the kernel exposes.

---

## 4. End-to-End: How `read()` Works

Let's trace a concrete example: your Node.js/Python/Go program calls something like `fs.readFileSync()` or `file.read()`, which under the hood eventually calls the C library's `read()`.

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. YOUR APPLICATION CODE (user space)                              │
│    fs.readFileSync('/etc/hostname')                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. LANGUAGE RUNTIME / STANDARD LIBRARY (user space)                 │
│    Node's libuv, or Python's io module, calls glibc's read()       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. C LIBRARY WRAPPER — glibc read() (user space)                    │
│    Sets up syscall number (e.g. __NR_read = 0 on x86-64) and       │
│    arguments (fd, buffer pointer, count) in CPU registers,          │
│    then executes a special instruction: `syscall` (x86-64)          │
└──────────────────────────────────────────────────────────────────┘
                              │  CPU privilege switch: Ring 3 → Ring 0
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. SYSCALL ENTRY / DISPATCH (kernel space)                          │
│    Kernel's syscall handler looks up syscall number 0 in the        │
│    syscall table → dispatches to sys_read()                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. VFS LAYER (kernel space)                                         │
│    Virtual File System looks up the file descriptor → finds the     │
│    underlying inode/filesystem (ext4, etc.) and dispatches to its    │
│    read implementation                                               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. FILESYSTEM + BLOCK LAYER (kernel space)                          │
│    ext4 driver checks the page cache first — if the data is         │
│    already cached in RAM, copy it directly (fast path, no disk       │
│    I/O). If not, issue a request to the disk driver.                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. DEVICE DRIVER + HARDWARE (kernel space)                          │
│    Driver talks to the physical disk controller, disk returns       │
│    data via DMA (Direct Memory Access) or interrupt                  │
└──────────────────────────────────────────────────────────────────┘
                              │  data copied into the buffer you passed
                              ▼  CPU privilege switch: Ring 0 → Ring 3
┌──────────────────────────────────────────────────────────────────┐
│ 8. BACK IN YOUR APPLICATION (user space)                             │
│    read() returns the number of bytes read; your buffer now         │
│    contains the file's contents                                     │
└──────────────────────────────────────────────────────────────────┘
```

Key takeaways from this trace:
- **The privilege switch happens exactly twice** — once entering the kernel, once leaving. This is why syscalls are relatively expensive compared to a plain function call (hundreds of CPU cycles of overhead), which is why high-performance code tries to minimize syscall counts (e.g. buffered I/O, batching reads).
- **The page cache** means most reads of recently-accessed files never actually touch the disk — the kernel keeps frequently used file data cached in unused RAM.
- **Everything below the glibc wrapper is invisible to you as an app developer** — you just see `read()` return bytes. This is the abstraction the kernel provides.

---

## 5. Common System Calls You Should Know

| Syscall | Purpose |
|---|---|
| `fork()` | Creates a new process (a near-exact copy of the calling process) |
| `execve()` | Replaces the current process image with a new program |
| `wait()` / `waitpid()` | Parent blocks until a child process changes state (e.g. exits) |
| `open()` / `read()` / `write()` / `close()` | File I/O |
| `socket()` / `bind()` / `listen()` / `accept()` / `connect()` | Networking |
| `mmap()` | Maps a file or device into a process's memory, or allocates anonymous memory |
| `brk()` / `sbrk()` | Adjusts the size of a process's heap (older-style memory allocation) |
| `kill()` | Sends a signal to a process (see Lesson 03) |
| `exit()` / `exit_group()` | Terminates the calling process |
| `clone()` | Linux's generalized process/thread creation primitive (fork and thread creation both use this under the hood) |

`fork()` + `execve()` is the classic Unix pattern for running a new program: `fork()` duplicates the calling process, then the child calls `execve()` to replace itself with the new program's code. This is literally what your shell does every time you run a command.

---

## 6. Observing Syscalls with `strace`

`strace` (Linux) attaches to a process and prints every syscall it makes, its arguments, and its return value — it's the single best tool for answering "what is this program actually doing at the kernel boundary?"

```bash
# Trace a fresh command from start to finish
strace ls /tmp

# Trace only file-related syscalls
strace -e trace=open,openat,read,write ls /tmp

# Attach to an already-running process by PID
strace -p 12345

# Count syscalls and time spent in each (great for finding what's slow)
strace -c curl -s https://example.com > /dev/null
```

Example output for `open`:
```
openat(AT_FDCWD, "/etc/hostname", O_RDONLY) = 3
read(3, "my-machine\n", 131072)        = 11
close(3)                                = 0
```
You can literally see the file descriptor being opened (returns `3`), read from, and closed — the exact same lifecycle traced in Section 4.

On macOS, the equivalent tool is `dtruss` (needs `sudo`, built on DTrace) or `dtrace` itself, since `strace` isn't available.

---

## 7. Kernel Space vs Library Calls

A common interview trip-up: not every function call in your program is a syscall.

```
printf("hello")     → LIBRARY CALL, buffers output in user space,
                       eventually calls write() — ONE syscall for many printf()s
malloc(100)          → LIBRARY CALL, usually served from an already-allocated
                       heap arena in user space — no syscall most of the time
                       (only calls brk()/mmap() when the arena needs to grow)
strlen(s)            → Pure user-space computation, NEVER a syscall
read(fd, buf, n)     → Directly a syscall wrapper
```

Library calls run entirely in user space and *may* invoke a syscall internally, but many don't need to for every call. This is why `strace` (which shows only real syscalls) can show far fewer lines than the number of library function calls your program makes — buffering and caching absorb most of them.

---

## 8. Hands-On Exercises

**Exercise 1 (Linux):** Run `strace ls` and identify at least three syscalls related to reading directory entries and three related to writing output to your terminal.

**Exercise 2 (Linux):** Run `strace -c cat /etc/hostname` and read the summary table at the end — which syscall was called the most, and which took the most time?

**Exercise 3:** Write a one-line C-like mental model: in your own words, explain why `read()` from an already-cached file is much faster than the first `read()` of a cold file on disk.

**Exercise 4 (Linux):** Run `strace -f -e trace=execve bash -c 'ls; whoami'` and observe the `fork`+`execve` pattern — the shell forking a child and that child execing into `ls`, then again into `whoami`.

**Exercise 5:** Run `man 2 read` (Linux/macOS) to read the actual `read(2)` man page — note the syscall's exact signature and how it differs from your language's high-level file-reading API.

---

## 9. Interview Q&A

**Q: What is a system call and why do we need them?**
Answer: A system call is a controlled request from an unprivileged user-space program asking the privileged kernel to perform an operation it cannot do itself — like reading a file, allocating memory, or sending network data. We need them because the CPU enforces a privilege boundary (Ring 3 user space vs Ring 0 kernel space) for security and stability: user programs can't be trusted to directly manipulate hardware or other processes' memory, so they must go through the kernel's well-defined syscall interface instead.

**Q: Walk me through what happens when a program calls `read()`.**
Answer: The language runtime calls the C library's `read()` wrapper, which loads the syscall number and arguments into registers and executes a `syscall` CPU instruction, switching from user mode to kernel mode. The kernel's syscall dispatcher looks up the syscall number and calls `sys_read()`. This goes through the VFS layer to find the right filesystem driver, checks the page cache for already-cached data (fast path) or issues a request to the disk driver (slow path), copies the data into the user's buffer, then returns control to user space with the byte count.

**Q: Why are syscalls considered "expensive" compared to regular function calls?**
Answer: A syscall requires a full CPU privilege-level switch (user mode to kernel mode and back), which involves saving/restoring register state and often flushing certain CPU caches/pipelines — hundreds of CPU cycles of pure overhead versus a handful of cycles for an ordinary function call. This is why performance-sensitive code batches I/O (e.g. buffered writes, `readv`/`writev`) to minimize the number of syscalls rather than making one syscall per byte or per small chunk.

**Q: What's the difference between a library call and a system call? Give an example.**
Answer: A library call (e.g. `printf`, `malloc`, `strlen`) runs in user space and may or may not invoke a syscall internally. `strlen` never does — it's pure computation. `printf` buffers text in user space and typically triggers a single `write()` syscall only when the buffer is flushed, even if you called `printf` many times. A syscall like `read()` or `open()` always crosses into the kernel, no exceptions.

**Q: What does `strace` do and when would you use it?**
Answer: `strace` attaches to a running or new process on Linux and logs every system call it makes along with arguments and return values. You'd use it to debug "why is this process hanging/slow/failing" when you don't have (or don't trust) application-level logs — e.g. finding that a program is stuck in a `connect()` call to an unreachable host, or repeatedly failing an `open()` on a missing config file with a permissions error.

**Q: What is the kernel responsible for, at a high level?**
Answer: The kernel manages and arbitrates access to shared hardware resources on behalf of all processes: process scheduling and lifecycle (fork/exec/exit), memory management (virtual address spaces, page faults, swapping), device I/O via drivers, filesystem implementation, networking (the TCP/IP stack), inter-process communication, and security/isolation (permissions, namespaces, cgroups). User-space programs interact with all of this exclusively through system calls.
