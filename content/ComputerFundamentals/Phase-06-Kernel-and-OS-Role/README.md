# Phase 06: Kernel and OS Role

## What You'll Learn

The boot process (Phase 05) ends with the kernel loaded into memory and running. This phase answers the natural next question: what *is* the kernel, and what does it actually do all day? You'll learn the kernel's core responsibilities at a foundational level, and the single most important architectural idea in all of operating systems — the split between **user space** and **kernel space**, and why your application code is not allowed to touch hardware directly.

This is a deliberately **short, high-level** phase. It exists to give a full-stack engineer just enough OS vocabulary to reason about performance, security, and system calls in interviews — it is not a substitute for a real OS course.

## Learning Objectives

- Describe the kernel's role as the mediator between hardware and applications
- List the kernel's core responsibilities: process management, memory management, device management, file systems
- Explain the user space / kernel space privilege boundary and why it exists
- Explain what a system call is and trace a simple example (a file read) across that boundary

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-What-the-Kernel-Actually-Does.md](01-What-the-Kernel-Actually-Does.md) | The kernel's core responsibilities, briefly | 0.5 day |
| [02-User-Space-vs-Kernel-Space.md](02-User-Space-vs-Kernel-Space.md) | The privilege boundary and system calls | 0.5 day |

## Estimated Time

1 day

## Prerequisites

- Phase 05 (The Boot Process) — the kernel has to be loaded before it can do anything
- Phase 02 (Computer Architecture Basics)

## Cross-Reference

- This phase is intentionally brief. For the **full, in-depth Operating Systems curriculum** — process/thread management, CPU scheduling, synchronization, deadlocks, memory management, virtual memory, file systems, I/O, and a dedicated Linux internals phase — see the sibling **[../../OperatingSystems/](../../OperatingSystems/)** course, in particular [Phase-11-Linux-OS-Internals](../../OperatingSystems/Phase-11-Linux-OS-Internals/) for kernel/syscall internals on a real Linux system.

## Next Phase

[Phase 07: Compilers vs Interpreters](../Phase-07-Compilers-vs-Interpreters/)
