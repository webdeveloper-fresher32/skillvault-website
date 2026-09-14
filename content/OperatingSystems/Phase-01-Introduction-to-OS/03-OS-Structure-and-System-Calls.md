# OS Structure and System Calls — Complete Guide

## Table of Contents
1. [Why User Code Can't Touch Hardware Directly](#1-why-user-code-cant-touch-hardware-directly)
2. [User Mode vs Kernel Mode](#2-user-mode-vs-kernel-mode)
3. [The System Call Mechanism, Step by Step](#3-the-system-call-mechanism-step-by-step)
4. [Worked Example: Python's `open()` Under the Hood](#4-worked-example-pythons-open-under-the-hood)
5. [System Call vs Library Function](#5-system-call-vs-library-function)
6. [Categories of System Calls](#6-categories-of-system-calls)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why User Code Can't Touch Hardware Directly

Recall from Lesson 01: user-space programs are deliberately restricted so a bug or malicious app in one program can't corrupt another program's memory or crash the whole machine. But applications obviously *need* to read files, allocate memory, and talk to the network — so there must be a safe, controlled doorway between the two worlds. That doorway is the **system call**.

```
Your program wants to:  "read this file"
                              │
                              ▼
             It cannot just reach into the disk controller.
             It must ASK the kernel to do it, via a syscall.
```

---

## 2. User Mode vs Kernel Mode

Modern CPUs implement at least two privilege levels, often called **rings** (x86 has rings 0-3; OSes typically only use ring 0 and ring 3):

```
┌─────────────────────────────────────────────┐
│  Ring 3 — USER MODE                          │
│  Restricted instruction set                  │
│  Cannot access hardware directly              │
│  Cannot access kernel memory                  │
│  Runs: your applications                       │
└───────────────────┬───────────────────────────┘
                     │  trap / syscall instruction
                     ▼
┌─────────────────────────────────────────────┐
│  Ring 0 — KERNEL MODE                        │
│  Full instruction set                        │
│  Full hardware access                          │
│  Full memory access                            │
│  Runs: OS kernel code                          │
└─────────────────────────────────────────────┘
```

A CPU register (a flag) tracks which mode the currently executing instruction stream is in. The CPU checks this flag before executing privileged instructions and refuses to execute them if the flag says "user mode" — this is enforced in hardware, not just convention, so it can't be bypassed by clever user-space code.

| | User Mode | Kernel Mode |
|---|-----------|--------------|
| **Who runs here** | Application code | OS kernel code |
| **Hardware access** | None (indirect only) | Full |
| **Memory access** | Only its own process's memory | All memory |
| **Privileged instructions** (e.g. halt CPU, modify page tables) | Forbidden — CPU raises a fault | Allowed |
| **Crash impact** | Kills that one process | Can crash the entire machine |

---

## 3. The System Call Mechanism, Step by Step

Here's what happens, in order, when a user program invokes a system call (e.g., to read a file):

```
 USER MODE                              KERNEL MODE
┌───────────────────┐
│ 1. App calls a     │
│    library wrapper │
│    e.g. read()      │
├───────────────────┤
│ 2. Wrapper loads    │
│    syscall number   │
│    + args into      │
│    registers        │
├───────────────────┤
│ 3. Executes a       │
│    special trap     │
│    instruction       │
│    (e.g. syscall,   │──────┐
│    int 0x80, svc)   │      │  CPU switches privilege level,
└───────────────────┘      │  jumps to a fixed kernel entry point
                             ▼
                    ┌───────────────────────┐
                    │ 4. Kernel's syscall     │
                    │    dispatcher reads     │
                    │    the syscall number   │
                    │    and looks it up in   │
                    │    a syscall table       │
                    ├───────────────────────┤
                    │ 5. Kernel runs the       │
                    │    actual handler        │
                    │    (e.g. sys_read),      │
                    │    touching hardware/    │
                    │    kernel data as needed │
                    ├───────────────────────┤
                    │ 6. Kernel places return  │
                    │    value in a register   │
                    │    and executes a        │
                    │    "return from trap"     │
                    │    instruction            │──────┐
                    └───────────────────────┘      │  CPU switches privilege
                                                      │  level back, resumes user code
┌───────────────────┐                               ▼
│ 7. Library wrapper  │◀─────────────────────────────
│    returns the      │
│    result to your   │
│    application code  │
└───────────────────┘
```

Key terms:
- **Trap / software interrupt**: a deliberate CPU instruction that forces a controlled jump into kernel mode (as opposed to a hardware interrupt, which is triggered externally, e.g. by a keypress).
- **Syscall table**: an array inside the kernel mapping syscall numbers to their handler functions — this is why you pass a *number*, not a function pointer, across the boundary (user code cannot be trusted to hand the kernel an arbitrary address to jump to).
- **Context switch overhead**: this mode transition isn't free — it involves saving/restoring registers and a full pipeline flush on some CPUs, which is why syscalls are dramatically slower than a plain function call and why performance-sensitive code tries to minimize syscall frequency (e.g., buffered I/O batches many small writes into one syscall).

---

## 4. Worked Example: Python's `open()` Under the Hood

Let's trace a single, familiar line of code all the way down to the kernel and back.

```python
# your_script.py
f = open("data.txt", "r")
data = f.read()
f.close()
```

```
Layer                          What happens
──────────────────────────────────────────────────────────────────────
1. Python code                 open("data.txt", "r")

2. CPython interpreter         Calls io.open(), which eventually calls
                                the C-level function os.open() /
                                the libc wrapper

3. C standard library (libc)   fopen() (or open()) prepares:
                                  - syscall number for `open` (e.g. 2 on
                                    x86-64 Linux)
                                  - arguments: pathname pointer, flags
                                    (O_RDONLY), mode
                                Executes the `syscall` CPU instruction

4. CPU                         Switches from user mode (ring 3) to
                                kernel mode (ring 0), jumps to the
                                kernel's syscall entry point

5. Linux kernel                Dispatcher looks up syscall #2 in the
                                syscall table -> calls sys_open()
                                  - Resolves the path, walks the
                                    filesystem's directory structures
                                  - Checks permissions (can this user
                                    read this file?)
                                  - Allocates a file descriptor (an
                                    integer, e.g. 3) in this process's
                                    open-file table
                                  - Returns the fd

6. CPU                         Switches back to user mode (ring 3),
                                resumes libc code with the fd in a
                                register

7. libc / CPython               Wraps the raw fd (3) into a Python
                                file object `f`

8. Your code                    f now behaves like a normal object;
                                f.read() will trigger a `read` syscall
                                the same way, and f.close() a `close`
                                syscall
```

The entire round trip (steps 3-6) might take on the order of microseconds, but it happens far more often than developers usually realize — every file read, every `print()` flush, every network packet sent involves this same dance.

---

## 5. System Call vs Library Function

A common interview confusion: is `printf()` a system call? No — it's a **library function** that *internally* makes a system call. This distinction matters:

| | Library Function | System Call |
|---|-------------------|--------------|
| **Example** | `printf()`, `fopen()`, `malloc()` | `write()`, `open()`, `brk()`/`mmap()` |
| **Runs in** | User mode (your process) | Kernel mode |
| **Cost** | Cheap (a normal function call) | Expensive (mode switch) |
| **Can be avoided/inlined?** | Yes, often | No — it's the actual privilege boundary |
| **Portability** | Same API can wrap different syscalls per OS | OS-specific, numbered differently per kernel |

```
printf("hello\n")
   │
   ▼ (library function, user mode)
Buffers the string in memory (no syscall yet — buffered I/O)
   │
   ▼ (buffer full OR newline flush OR fflush() called)
write(1, buffer, len)   ◀── THIS is the actual system call
```

This is exactly why `malloc()` doesn't make a syscall every time you allocate memory — it manages a heap arena in user space and only calls `brk()`/`mmap()` (real syscalls) occasionally to grow that arena. We'll cover this heap-growth mechanism more in Lesson 04.

---

## 6. Categories of System Calls

| Category | Purpose | Examples (POSIX/Linux naming) |
|----------|---------|-------------------------------|
| **Process control** | Create, terminate, wait for processes | `fork()`, `execve()`, `exit()`, `wait()` |
| **File management** | Open, read, write, close files | `open()`, `read()`, `write()`, `close()`, `lseek()` |
| **Device management** | Request/release devices, I/O control | `ioctl()`, `read()`/`write()` on device files |
| **Information maintenance** | Get/set system data | `getpid()`, `time()`, `uname()` |
| **Communication** | IPC, networking | `pipe()`, `socket()`, `send()`, `recv()`, `shmget()` |
| **Memory management** | Grow/shrink process address space | `brk()`, `mmap()`, `munmap()` |

---

## 7. Hands-On Exercises

**Exercise 1:** On Linux, run `strace -c ls /` and read the summary table at the end — identify which syscall was called the most times and guess why (`ls` needs to read directory entries).

**Exercise 2:** Write a tiny C program that calls `write(1, "hi\n", 3)` directly (using `<unistd.h>`) instead of `printf`. Compile and run it, then explain in a sentence why this skips libc's buffering layer.

**Exercise 3:** Run `strace python3 -c "open('/tmp/test.txt','w').write('hi')"` (or `dtruss` on macOS) and find the exact `open`/`openat` and `write` syscall lines in the output, noting the arguments and return values.

**Exercise 4:** Look up (via `man syscalls` on Linux, or online) the syscall number for `read` on x86-64 Linux, and for `open`. Write down both numbers.

**Exercise 5:** Explain in 2-3 sentences why buffered I/O (like `printf` or Python's default file buffering) reduces the number of actual syscalls made, and why that matters for performance.

---

## 8. Interview Q&A

**Q: What is a system call and why is it necessary?**
Answer: A system call is a defined, controlled interface that lets a user-mode program request a privileged operation (file I/O, memory allocation, process creation, networking) from the kernel. It's necessary because user-mode code is deliberately barred by the CPU from directly executing privileged instructions or touching kernel/hardware resources — the syscall is the only sanctioned doorway across that boundary.

**Q: Walk through what happens, step by step, when a program makes a system call.**
Answer: The program (usually via a library wrapper) loads a syscall number and arguments into registers, then executes a special trap instruction. This forces the CPU to switch from user mode to kernel mode and jump to a fixed kernel entry point. The kernel's dispatcher looks up the syscall number in a syscall table, runs the corresponding handler (which does the actual privileged work), places a return value in a register, and executes a "return from trap" instruction that switches the CPU back to user mode, resuming the calling program.

**Q: What is the difference between a system call and a library function like `printf()`?**
Answer: A library function runs entirely in user mode and may or may not trigger a system call internally. `printf()` is a library function that buffers output in user-space memory and only issues an actual `write()` system call when the buffer fills, a newline triggers a flush, or `fflush()` is called. System calls always involve a mode switch into the kernel and are far more expensive than a plain user-mode function call.

**Q: Why do CPUs enforce user mode vs kernel mode in hardware rather than just trusting software?**
Answer: If privilege enforcement were purely a software convention, any buggy or malicious program could bypass it and directly manipulate hardware or other processes' memory, defeating the entire purpose of process isolation. By enforcing it via a hardware privilege flag, the CPU itself refuses to execute privileged instructions or honor out-of-bounds memory accesses from user-mode code, making the isolation robust even against adversarial code.

**Q: Concretely, what happens when a Python program calls `open("file.txt")`?**
Answer: CPython's `open()` eventually calls into the C library's `open()`, which loads the syscall number for `open` and the filename/flags into registers, then executes a trap instruction. The CPU switches to kernel mode, the kernel resolves the path, checks permissions, allocates a file descriptor in the process's open-file table, and returns that integer descriptor. The CPU switches back to user mode, and Python wraps the descriptor in a file object that the rest of your code interacts with.

**Q: Why are system calls considered expensive compared to regular function calls?**
Answer: A regular function call just pushes a return address and jumps — cheap, stays in the same privilege level and address space context. A system call forces a mode switch (user to kernel and back), which typically requires saving and restoring registers, validating arguments, and on many CPUs can trigger pipeline flushes or cache effects — overhead a plain function call never incurs. This is why performance-sensitive code batches work to minimize syscall frequency (e.g., buffered I/O).
