# Phase 11: Linux OS Internals

## What You'll Learn

Take the OS theory from Phases 01–10 (processes, scheduling, memory, file systems) and ground it in a real, running Linux system. This phase answers the "how does this actually work on my machine" questions that interviewers love to ask a full-stack engineer: how does Linux boot, what happens when your code calls `read()`, how do signals really work, and — critically — how do you *diagnose* a misbehaving process or server in production.

> **Note:** This phase is about Linux **concepts and internals** — the kernel, syscalls, boot sequence, process/signal semantics. If you want to get better at writing Bash scripts or using command-line tools day-to-day, see the dedicated **[ShellScripting](../ShellScripting/)** course. The two are complementary: this phase explains *why* commands like `kill`, `ps`, and `lsof` behave the way they do; ShellScripting teaches you to script with them fluently.

## Learning Objectives

- Trace the Linux boot process from power-on to a login shell
- Explain what the kernel does and how a system call crosses the user/kernel boundary
- Understand the process hierarchy, PID/PPID relationships, and how signals are delivered and handled
- Distinguish zombie processes from orphan processes and know how each is cleaned up
- Build a practical "operational troubleshooting playbook" — the commands you reach for when something is slow, stuck, or eating resources

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-The-Linux-Boot-Process.md](01-The-Linux-Boot-Process.md) | BIOS/UEFI → bootloader → kernel → init/systemd → login shell | 1 day |
| [02-The-Linux-Kernel-and-System-Calls.md](02-The-Linux-Kernel-and-System-Calls.md) | Kernel responsibilities, syscall lifecycle, `strace` | 1 day |
| [03-Processes-and-Signals-in-Linux.md](03-Processes-and-Signals-in-Linux.md) | Process tree, PID/PPID, signals, zombie vs orphan | 1 day |
| [04-Linux-Process-and-Resource-Inspection.md](04-Linux-Process-and-Resource-Inspection.md) | Troubleshooting playbook — ports, runaway processes, logs, memory/disk | 1 day |

## Estimated Time

4 days

## Prerequisites

- Phase 02 (Processes and Threads) and Phase 03 (CPU Scheduling) — this phase applies that theory to real Linux behavior
- A terminal on macOS or Linux to run the hands-on exercises (macOS is Unix-like and shares most concepts; notes are added where Linux-only tools differ)

## Cross-Reference

- Command-line fluency, Bash scripting, `grep`/`sed`/`awk`, automation → **[ShellScripting course](../ShellScripting/)**
- File system concepts referenced here (inodes, mounts) → [Phase 08: File Systems and Storage](../Phase-08-File-Systems-and-Storage/)

## Next Phase

→ [Phase 12: Interview Prep and Advanced](../Phase-12-Interview-Prep-and-Advanced/README.md)
