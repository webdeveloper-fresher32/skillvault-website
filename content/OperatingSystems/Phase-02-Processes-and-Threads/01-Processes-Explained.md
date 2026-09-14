# Processes Explained — Complete Guide

## Table of Contents
1. [What is a Process?](#1-what-is-a-process)
2. [The Process Control Block (PCB)](#2-the-process-control-block-pcb)
3. [Process States](#3-process-states)
4. [Process Creation: fork() and exec()](#4-process-creation-fork-and-exec)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. What is a Process?

A **process** is a program in execution. A program on disk is just static instructions and data — inert, like a recipe sitting in a cookbook. The moment the OS loads it, allocates memory, and starts running its instructions, it becomes a process — an active, running entity with its own state.

```
Program (on disk)             Process (in memory, running)
┌───────────────────┐         ┌────────────────────────────┐
│ myapp.exe / a.out  │  run   │ PID: 4821                  │
│ - instructions      │ ────▶  │ - memory (code+data+heap+  │
│ - static data       │        │   stack)                   │
│ (passive, on disk)  │        │ - registers, program counter│
└───────────────────┘         │ - open file handles         │
                                │ - CPU time consumed         │
                                │ (active, in RAM)            │
                                └────────────────────────────┘
```

Key idea: **one program can become many processes.** Open three terminal windows, each running `bash` — that's the same program, three separate, independent processes, each with its own memory and its own PID (Process ID).

### What a Process Owns

Each process gets an isolated bundle of resources from the OS:

| Resource | Description |
|----------|-------------|
| **Address space** | Its own private virtual memory — code, global data, heap, stack |
| **PID** | A unique identifier the kernel uses to track it |
| **File descriptors** | Table of open files, sockets, pipes |
| **CPU registers** | Program counter, stack pointer, general-purpose registers (saved/restored on context switch) |
| **Security context** | User/group ID, permissions |

Because each process has its **own address space**, one process cannot directly read or corrupt another process's memory — this isolation is why a crashing Chrome tab (its own process) doesn't take down your entire browser.

---

## 2. The Process Control Block (PCB)

The kernel needs a way to keep track of every process on the system — what it's doing, what it owns, and where to resume it if it gets paused. That bookkeeping structure is the **Process Control Block (PCB)**, sometimes called a **task_struct** in Linux.

Think of the PCB as a process's "ID card + status report" that lives in kernel memory. There's exactly one PCB per process, and the kernel maintains a list/table of all of them.

```
┌─────────────────────────────────────────────┐
│              Process Control Block           │
├─────────────────────────────────────────────┤
│ Process ID (PID)             : 4821          │
│ Process State                : RUNNING       │
│ Program Counter              : 0x00401A2C    │
│ CPU Registers (saved values) : [snapshot]    │
│ CPU Scheduling Info          : priority, ...  │
│ Memory Management Info       : page tables,  │
│                                base/limit regs│
│ Accounting Info              : CPU time used,  │
│                                start time      │
│ I/O Status Info              : open files,    │
│                                pending I/O     │
│ Parent PID / Child PIDs      : 3011 / [4830]  │
└─────────────────────────────────────────────┘
```

### Why the PCB Matters

Every time the OS switches from running one process to running another (a **context switch** — covered in Lesson 03), it must:
1. Save the currently running process's CPU state (registers, program counter) **into its PCB**.
2. Load the next process's saved state **from its PCB** back into the CPU.

Without the PCB, the OS would have no way to "remember where a process left off." The PCB is what makes it possible to pause a process and resume it later as if nothing happened.

---

## 3. Process States

At any moment, a process is in exactly one of a small number of states. The kernel updates the `state` field in the PCB as the process moves through its life.

| State | Meaning |
|-------|---------|
| **New** | Process is being created (OS is setting up its PCB and memory) |
| **Ready** | Process is loaded into memory and waiting for the CPU to be assigned to it |
| **Running** | Process instructions are actively executing on a CPU core |
| **Waiting (Blocked)** | Process is paused, waiting for an event — I/O completion, a lock, a signal |
| **Terminated (Exit)** | Process has finished execution (or was killed); OS is cleaning up its resources |

### ASCII State Diagram

```
                         ┌─────────┐
                admitted │   NEW   │
              ┌─────────▶│         │
              │          └────┬────┘
              │               │ admitted (memory allocated, PCB created)
              │               ▼
              │          ┌─────────┐   scheduler dispatch    ┌──────────┐
              │          │  READY  │ ───────────────────────▶│ RUNNING  │
              │          │         │◀─────────────────────── │          │
              │          └────┬────┘   interrupt / time-slice └────┬─────┘
              │               │              expired               │
              │               │                                    │
              │   I/O or event│                     I/O or event   │
              │   completes   │                     requested      │
              │               │                                    ▼
              │          ┌────┴────────────────────────────▶┌──────────┐
              │          │                                   │ WAITING  │
              │          │                                   │(BLOCKED) │
              │          └───────────────────────────────────└──────────┘
              │                                                    │
              │                                              exit()/kill │
              │                                                    ▼
              │                                              ┌──────────┐
              └──────────────────────────────────────────────│TERMINATED│
                                                               └──────────┘
```

### Reading the Diagram

- **New → Ready**: OS finishes setting up the process (memory, PCB) and admits it into the ready queue.
- **Ready → Running**: The scheduler picks this process (dispatch) and gives it the CPU.
- **Running → Ready**: The process's time slice expires, or a higher-priority process preempts it — it's paused but not blocked, so it goes back to Ready.
- **Running → Waiting**: The process requests I/O (e.g., reads a file, waits on a network socket) or waits on a lock/semaphore — it can't proceed until that event happens.
- **Waiting → Ready**: The event the process was waiting for completes (I/O finishes, lock is released) — it's ready to run again, but not running yet (must wait its turn for the CPU).
- **Running → Terminated**: The process finishes normally (`exit()`) or is killed (signal, crash).

A process can cycle through Ready ↔ Running ↔ Waiting many times over its life before it finally terminates.

---

## 4. Process Creation: fork() and exec()

On Unix-like systems (Linux, macOS), new processes are created with a two-step pattern: **fork()** then (often) **exec()**.

### fork() — Clone the Current Process

`fork()` creates a **new process (the child)** that is an almost exact copy of the calling process (the parent) — same code, same memory contents (via copy-on-write), same open file descriptors — but with a **new PID**.

```
Before fork():
┌────────────────────┐
│ Parent Process       │
│ PID: 100             │
└────────────────────┘

After fork():
┌────────────────────┐      ┌────────────────────┐
│ Parent Process       │      │ Child Process        │
│ PID: 100              │      │ PID: 101             │
│ fork() returns 101    │      │ fork() returns 0     │
└────────────────────┘      └────────────────────┘

Both processes continue executing from the SAME point right after fork() —
they just take different return values, which is how code tells them apart.
```

Key detail: `fork()` returns **twice** — once in the parent (returning the child's PID) and once in the child (returning `0`). This is the classic "returns twice" interview gotcha.

### exec() — Replace the Process Image

`fork()` alone just duplicates the *same* program. To run a **different** program in the child, you call one of the `exec()` family (`execve`, `execvp`, etc.), which **replaces** the calling process's memory image (code, data, stack) with a new program — same PID, entirely new content.

```
Child process (PID 101, still running a copy of the shell)
        │
        │  exec("/bin/ls", ...)
        ▼
Child process (PID 101, now running `ls` — old shell memory is gone)
```

### The Classic Combo: fork() + exec()

This is exactly how your shell runs commands. When you type `ls` in bash:

```
bash (PID 100)
   │
   │ fork()
   ▼
bash creates child (PID 101) — identical copy of bash
   │
   │ child calls exec("/bin/ls")
   ▼
child (PID 101) is now running `ls`, not bash
   │
   │ ls finishes, terminates
   ▼
bash (PID 100) wait()s for child, then shows the next prompt
```

This fork-then-exec pattern is why `ls` runs as a **separate process** from your shell — if `ls` crashes, your shell survives.

> **Note for Windows:** Windows doesn't have `fork()`/`exec()` — it uses a single `CreateProcess()` call that does the equivalent of both in one step. `fork()`/`exec()` is Unix/Linux/macOS-specific, but the *concept* (spawn a new process, load a program image into it) applies everywhere.

---

## 5. Hands-On Exercises

**Exercise 1:** On Linux/macOS, run `ps -ef | head -20` in a terminal. Identify the PID and PPID (parent PID) columns. Find `init`/`launchd` (PID 1) — every process ultimately traces back to it.

**Exercise 2:** Run this Python script and observe the output — notice `fork()` returns twice:

```python
import os

pid = os.fork()

if pid == 0:
    print(f"I am the CHILD process, my PID is {os.getpid()}")
else:
    print(f"I am the PARENT process, my child's PID is {pid}, my own PID is {os.getpid()}")
```

Run it a few times. Notice the child and parent print in a non-deterministic order — the OS scheduler decides who runs first.

**Exercise 3:** Extend the script above: after `fork()`, have the child call `os.execvp("ls", ["ls", "-l"])` while the parent calls `os.wait()` to wait for the child, then prints "child finished". This reproduces the shell's fork+exec+wait pattern.

**Exercise 4:** While a long-running command is executing (e.g., `sleep 60 &`), run `cat /proc/<pid>/status` (Linux) and find the `State:` line. Watch it change between `S` (sleeping/waiting) and `R` (running) as you probe it repeatedly.

**Exercise 5:** Open Activity Monitor (macOS) or Task Manager (Windows) or `htop` (Linux). Sort by PID and find a process tree — identify a parent and its child processes (e.g., your browser and its renderer processes).

---

## 6. Interview Q&A

**Q: What is a process?**
Answer: A process is a program in execution — an active entity with its own allocated memory (code, data, heap, stack), a unique PID, open file handles, and CPU state. A program on disk is passive; it becomes a process once the OS loads and runs it. Multiple processes can run from the same program.

**Q: What is a Process Control Block (PCB) and why does the OS need it?**
Answer: The PCB is a kernel data structure — one per process — that stores everything the OS needs to manage that process: PID, current state, saved CPU registers/program counter, scheduling priority, memory management info (page tables), accounting data, and open file info. The OS needs it to pause and resume processes correctly during context switches — without it, the OS couldn't remember where a process left off.

**Q: What are the five main process states, and what triggers each transition?**
Answer: New (being created) → Ready (loaded, waiting for CPU) → Running (executing on CPU) → Waiting/Blocked (paused for I/O or an event) → Terminated (finished or killed). Ready→Running is triggered by scheduler dispatch; Running→Ready by time-slice expiry or preemption; Running→Waiting by an I/O/event request; Waiting→Ready when that event completes; Running→Terminated by exit or a kill signal.

**Q: What's the difference between fork() and exec()?**
Answer: `fork()` creates a new process (the child) that is a copy of the calling process — same code and memory, new PID; it returns twice (child PID in the parent, 0 in the child). `exec()` replaces the calling process's memory image with a different program, keeping the same PID. They're often combined: fork a child, then exec a new program in it — this is how shells launch commands.

**Q: Why does fork() "return twice"?**
Answer: Because after `fork()` succeeds, there are now two processes running the exact same code, both resuming execution immediately after the `fork()` call. The kernel makes `fork()` return different values in each: the child's PID in the parent, and `0` in the child, so application code can tell which one it's running in and branch accordingly.

**Q: Can two processes share the same memory space?**
Answer: Not by default — each process gets its own isolated virtual address space, which is why processes are considered "heavyweight" and safe from each other (one crashing doesn't corrupt another). If processes need to share memory intentionally, they must explicitly set up a shared memory segment via IPC (covered in Lesson 04).

**Q: What happens to a process's resources when it terminates but its parent hasn't called wait() yet?**
Answer: It becomes a **zombie process** — the process has finished executing and released most resources, but its PCB/exit status remains in the process table until the parent calls `wait()`/`waitpid()` to read the exit code. If the parent never calls wait(), zombies accumulate (though a reboot or the parent's own exit — reparenting to init — eventually cleans them up).

**Q: What's the difference between a process being "ready" and "waiting"?**
Answer: Ready means the process could run right now — it has everything it needs, it's just waiting for the scheduler to give it CPU time. Waiting (blocked) means the process cannot run even if given the CPU, because it's stuck waiting for an external event like I/O completion, a lock, or a signal.
