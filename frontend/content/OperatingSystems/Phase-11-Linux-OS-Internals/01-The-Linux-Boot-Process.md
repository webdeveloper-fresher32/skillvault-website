# The Linux Boot Process — Complete Guide

## Table of Contents
1. [Why This Matters](#1-why-this-matters)
2. [The Big Picture](#2-the-big-picture)
3. [Stage 1: Power-On and Firmware (BIOS/UEFI)](#3-stage-1-power-on-and-firmware-biosuefi)
4. [Stage 2: The Bootloader (GRUB)](#4-stage-2-the-bootloader-grub)
5. [Stage 3: Kernel Initialization](#5-stage-3-kernel-initialization)
6. [Stage 4: init / systemd Takes Over](#6-stage-4-init--systemd-takes-over)
7. [Stage 5: Reaching a Login Shell](#7-stage-5-reaching-a-login-shell)
8. [BIOS vs UEFI](#8-bios-vs-uefi)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why This Matters

You don't boot a server every day, but interviewers ask about boot sequence because it tests whether you understand layers of abstraction — firmware, bootloader, kernel, userspace — and it comes up for real when:
- A cloud VM won't come up and you need to read boot logs (`journalctl -b`, serial console output)
- A container "boots" too (a stripped-down version: no BIOS/GRUB, but it still has an init process as PID 1)
- You're debugging why a systemd service starts too early or too late relative to networking

---

## 2. The Big Picture

```
 [Power Button]
       │
       ▼
┌─────────────────┐
│ 1. Firmware      │  BIOS or UEFI — hardware self-test, finds a boot device
│    (BIOS/UEFI)   │
└─────────────────┘
       │  loads first-stage bootloader from disk (MBR or EFI partition)
       ▼
┌─────────────────┐
│ 2. Bootloader    │  GRUB — shows boot menu, loads the Linux kernel + initramfs
│    (GRUB)        │  into memory
└─────────────────┘
       │  hands control to the kernel
       ▼
┌─────────────────┐
│ 3. Kernel Init   │  kernel decompresses itself, initializes CPU/memory/drivers,
│                  │  mounts a temporary root filesystem (initramfs), finds and
│                  │  mounts the REAL root filesystem
└─────────────────┘
       │  kernel starts the first userspace process, PID 1
       ▼
┌─────────────────┐
│ 4. init/systemd  │  PID 1 — starts all other services in dependency order
│    (PID 1)       │  (networking, logging, cron, SSH, your app...)
└─────────────────┘
       │  systemd reaches "default target" (multi-user / graphical)
       ▼
┌─────────────────┐
│ 5. Login Shell   │  getty/systemd-logind presents a login prompt (console or
│                  │  SSH) → you authenticate → your shell (bash/zsh) starts
└─────────────────┘
```

Every stage exists to hand off control to the next, more capable layer. Firmware barely knows what a disk partition is; by the last stage you have a fully multitasking OS with networking, users, and services running.

---

## 3. Stage 1: Power-On and Firmware (BIOS/UEFI)

When you press power:

1. The CPU starts executing instructions from a fixed, hard-wired memory address — this code lives in firmware chips on the motherboard, not on your disk.
2. This is **BIOS** (legacy) or **UEFI** (modern) firmware.
3. It runs **POST** (Power-On Self-Test) — checks CPU, RAM, keyboard, storage controllers are present and functional.
4. It initializes just enough hardware to find a **boot device** (disk, SSD, network in some cases).
5. It reads the very first sector(s) of the boot device and executes what it finds there — this is the bootloader's first stage.

```
BIOS: reads Master Boot Record (MBR) — first 512 bytes of disk
UEFI: reads a file from the EFI System Partition (a small FAT32 partition), e.g. /EFI/ubuntu/grubx64.efi
```

Firmware's only job: find something bootable and jump to it. It has no concept of "Linux," "filesystems," or "processes" yet.

---

## 4. Stage 2: The Bootloader (GRUB)

**GRUB** (GRand Unified Bootloader) is the most common Linux bootloader. Its job:

1. Present a menu (the screen you sometimes see with arrow-key OS/kernel choices).
2. Locate the selected **kernel image** (`/boot/vmlinuz-*`) and an **initramfs** (initial RAM filesystem, `/boot/initrd.img-*`) on disk.
3. Load both into memory.
4. Pass control to the kernel, along with **kernel parameters** (e.g. which partition is root, `quiet`, `single` for single-user mode).

```
GRUB config essentially says:
  linux   /boot/vmlinuz-6.5.0-generic root=UUID=xxxx ro quiet splash
  initrd  /boot/initrd.img-6.5.0-generic
```

Why an **initramfs**? The kernel needs drivers to even see the real root disk (e.g. RAID, LVM, encrypted volumes, NVMe). The initramfs is a small, temporary filesystem loaded entirely into RAM containing just enough drivers and tools to find and mount the real root filesystem. Once that's mounted, the kernel discards the initramfs and switches over (`switch_root`).

---

## 5. Stage 3: Kernel Initialization

Once GRUB hands off:

1. The kernel decompresses itself into memory and starts executing.
2. It initializes core subsystems: CPU (multi-core setup), memory management (paging), interrupt handling.
3. It initializes device drivers — for disks, network cards, USB, etc. (many are compiled as modules and loaded from the initramfs).
4. It mounts the initramfs as a temporary root (`/`).
5. Using drivers now available, it locates and mounts the **real root filesystem** (from the `root=` kernel parameter).
6. It performs `switch_root` — pivots from the temporary initramfs root to the real root filesystem.
7. Finally, the kernel starts **PID 1** — the first and only process it ever directly creates. Every other process on the system is a descendant of PID 1.

```
Kernel process creation model:
  kernel (not a process itself)
     │
     └── creates PID 1 (init / systemd)
              │
              └── PID 1 forks/execs everything else, directly or indirectly
```

This is why `ps -ef` on any Linux box always shows PID 1 at the top of the tree — see Lesson 03 for the full process hierarchy.

---

## 6. Stage 4: init / systemd Takes Over

PID 1 is traditionally called **init**. Modern distros (Ubuntu, RHEL/CentOS, Debian, Fedora, Arch) use **systemd** as PID 1.

systemd's job:
- Read **unit files** (`.service`, `.socket`, `.mount`, `.target`) describing what should run and in what order/dependency graph.
- Start services in parallel where possible (unlike old sequential SysV init scripts), respecting `After=`/`Requires=` dependencies.
- Reach a **target** — a named collection of units, roughly equivalent to old "runlevels":

```
systemd targets (roughly map to old SysV runlevels):
  poweroff.target     (0)  — shutdown
  rescue.target       (1)  — single-user/maintenance mode
  multi-user.target   (3)  — full multi-user, no GUI (typical servers)
  graphical.target    (5)  — multi-user + GUI (typical desktops)
  reboot.target       (6)  — reboot
```

Typical services started on the way to `multi-user.target`: udev (device management), networking, DNS resolution, logging (`systemd-journald`), cron, SSH daemon, and finally your own application services if they're registered as systemd units.

```bash
# See what target you're at
systemctl get-default

# See the boot-order dependency chain that led to the current state
systemctl list-dependencies multi-user.target
```

---

## 7. Stage 5: Reaching a Login Shell

Once the target's services are up:

- On a physical/virtual console: `getty` (or systemd's `systemd-logind` equivalent, `agetty`) presents a login prompt.
- Over the network: `sshd` (started as one of the services above) listens for SSH connections.
- You type your username/password (or present an SSH key) → **PAM** (Pluggable Authentication Modules) validates you.
- On success, a **login shell** is started — typically `bash` or `zsh` — running as your user, with PID 1 (or sshd, or your terminal emulator) as an ancestor.

```
systemd (PID 1)
   └── sshd (listening)
          └── sshd: your-user [priv]        (per-connection)
                 └── bash (your login shell)   ← you land here
                        └── whatever you run next (vim, node, python, ...)
```

At this point the boot process is complete: you have a running kernel, all core services up, and an interactive shell. Everything from here on is "just" processes forking, execing, and exiting — covered in Lesson 03.

---

## 8. BIOS vs UEFI

| Aspect | BIOS (legacy) | UEFI (modern) |
|--------|---------------|----------------|
| Boot record | MBR (512 bytes, max 4 primary partitions) | GPT (GUID Partition Table, many partitions) |
| Boot code location | First disk sector | Files on an EFI System Partition (FAT32) |
| Max disk size supported | ~2TB | Essentially unlimited |
| Boot speed | Slower, 16-bit real mode initially | Faster, native 32/64-bit |
| Secure Boot | Not supported | Supported (verifies bootloader signature) |
| Pre-boot interface | Text menu | Graphical menu possible, mouse support |

Most cloud VMs and modern laptops use UEFI today; BIOS is legacy but the conceptual stages (firmware → bootloader → kernel → init) are identical.

---

## 9. Hands-On Exercises

**Exercise 1:** Run `systemctl get-default` to see your current boot target, then `systemctl list-dependencies multi-user.target | head -30` to see the top-level services your system boots into.

**Exercise 2:** Run `journalctl -b` (Linux only) to view the log of the current boot, from kernel messages onward. Search it with `journalctl -b | grep -i error` for any boot-time errors.

**Exercise 3:** Run `systemd-analyze` (Linux only) to see total boot time, and `systemd-analyze blame` to see which services took the longest to start.

**Exercise 4:** Run `ls -la /boot` (Linux) and identify the kernel image (`vmlinuz-*`) and initramfs (`initrd.img-*`) files. Check their sizes — why is the kernel image compressed?

**Exercise 5:** Run `ps -ef | head -5` (or `ps -eo pid,ppid,comm | head -5` on macOS) and confirm PID 1 is `systemd` (Linux) or `launchd` (macOS's PID-1 equivalent). Note: macOS doesn't use GRUB/BIOS boot stages the same way, but the "PID 1 starts everything else" concept still holds.

---

## 10. Interview Q&A

**Q: Walk me through what happens when you power on a Linux machine.**
Answer: Firmware (BIOS/UEFI) runs POST, finds a boot device, and loads the first-stage bootloader (GRUB). GRUB loads the Linux kernel and an initramfs into memory and hands off control. The kernel initializes hardware/drivers, mounts the initramfs, uses it to find and mount the real root filesystem, then switches root and starts PID 1 (init/systemd). systemd starts all other services per its unit dependency graph, reaching a target like `multi-user.target`. Finally getty/sshd present a login prompt, and after authentication a login shell starts.

**Q: What is the difference between BIOS and UEFI?**
Answer: BIOS is legacy 16-bit firmware that reads a 512-byte Master Boot Record from disk and supports at most 4 primary partitions and ~2TB disks. UEFI is modern firmware that reads bootloader files from a FAT32 EFI System Partition, supports GPT partitioning (essentially unlimited partitions/disk size), boots faster, and supports Secure Boot to verify the bootloader's signature before executing it.

**Q: What is an initramfs and why is it needed?**
Answer: initramfs is a small, temporary root filesystem loaded entirely into RAM by the bootloader alongside the kernel. The kernel needs it because, at boot time, it may not yet have the drivers loaded to access the real root filesystem (e.g. it's on a RAID array, LVM volume, encrypted disk, or NVMe device). initramfs contains just enough drivers/tools to detect and mount the real root filesystem, after which the kernel performs `switch_root` and discards the initramfs.

**Q: What is PID 1 and why is it special?**
Answer: PID 1 is the first userspace process the kernel creates directly during boot — traditionally `init`, now usually `systemd` on modern distros. It's special because every other process on the system is a descendant of PID 1 (created via fork/exec chains), and it has an additional OS responsibility: it adopts orphaned processes when their original parent dies, becoming their new parent so they can be properly reaped when they exit (see Lesson 03).

**Q: What's the difference between systemd targets and old SysV runlevels?**
Answer: SysV runlevels (0–6) were numbered states with sequential shell-script-based startup (`/etc/rc.d/`), started one service at a time. systemd targets (`multi-user.target`, `graphical.target`, etc.) are named collections of "units" with an explicit dependency graph, allowing systemd to start independent services in parallel, which is a major reason systemd boots faster than legacy SysV init.

**Q: How would you debug a server that's stuck or slow during boot?**
Answer: On the console, watch for where boot output stalls. After boot, use `journalctl -b` to review the full boot log, `systemd-analyze` for total boot time, and `systemd-analyze blame` to rank services by startup duration — this quickly reveals a hung or slow-starting service (e.g. one waiting on a network timeout).
