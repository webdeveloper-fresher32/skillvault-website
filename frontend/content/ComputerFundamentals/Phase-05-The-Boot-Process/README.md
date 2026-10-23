# Phase 05: The Boot Process

## What You'll Learn

Every application you've ever run started only because a computer went through a very specific, very old sequence of steps between "power button pressed" and "OS ready for you to log in." This phase gives you the plain-English version of that sequence — enough to answer "walk me through what happens when you turn on a computer" confidently in an interview, and enough to understand *why* your laptop takes those first few seconds before it even starts loading an operating system.

This is a **foundational, conceptual** treatment aimed at a full-stack engineer, not a systems programmer. It covers the general power-on → firmware → bootloader → kernel chain that applies across PCs, laptops, and servers.

## Learning Objectives

- Describe the full boot sequence from pressing the power button to reaching a login screen
- Explain what POST (Power-On Self-Test) checks and why it exists
- Explain the role of firmware (BIOS/UEFI) and how it hands off control to a bootloader
- Explain what a bootloader does and how it loads the OS kernel into memory
- Compare BIOS and UEFI and explain why the industry moved to UEFI

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-What-Happens-When-You-Power-On-a-Computer.md](01-What-Happens-When-You-Power-On-a-Computer.md) | POST, firmware, bootloader, kernel load — the full chain | 1 day |
| [02-BIOS-vs-UEFI.md](02-BIOS-vs-UEFI.md) | BIOS vs UEFI, Secure Boot, why UEFI won | 0.5 day |

## Estimated Time

1.5 days

## Prerequisites

- Phase 02 (Computer Architecture Basics) — helps to know what CPU, RAM, and storage are before tracing what happens to them at boot
- Phase 03 (CPU Registers and Cache) — useful but not required

## Cross-Reference

- This phase intentionally stays at the "what happens and why" level for a generalist interview. For a **deep, Linux-specific** treatment of the boot process — including GRUB stages, initramfs, and the handoff to `systemd`/`init` — see **[../../OperatingSystems/Phase-11-Linux-OS-Internals/](../../03-OS/Phase-11-Linux-OS-Internals)**, specifically `01-The-Linux-Boot-Process.md`.

## Next Phase

[Phase 06: Kernel and OS Role](../Phase-06-Kernel-and-OS-Role/) — once the kernel is loaded into memory, what does it actually do?
