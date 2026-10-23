# What Happens When You Power On a Computer

## Table of Contents
1. [The Big Picture](#1-the-big-picture)
2. [Step 1: Power-On Self-Test (POST)](#2-step-1-power-on-self-test-post)
3. [Step 2: Firmware Takes Over (BIOS/UEFI)](#3-step-2-firmware-takes-over-biosuefi)
4. [Step 3: The Bootloader](#4-step-3-the-bootloader)
5. [Step 4: Loading the Kernel](#5-step-4-loading-the-kernel)
6. [Step 5: OS Initialization to Login](#6-step-5-os-initialization-to-login)
7. [Full Sequence Diagram](#7-full-sequence-diagram)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Big Picture

When you press the power button, the machine has **no operating system running yet** — there's no process manager, no file system driver, nothing. Everything that happens in the first few seconds exists to solve one bootstrapping problem: *how do you get a fully-featured OS running when nothing is running at all?*

The answer is a chain of increasingly capable programs, each one loading and handing off control to the next, more sophisticated one:

```
Power button → Hardware check → Firmware → Bootloader → OS Kernel → Login screen
   (dumb)         (dumber)      (simple)    (simple)     (full OS)    (ready!)
```

Each stage only needs to know how to do one thing: find and start the next stage.

---

## 2. Step 1: Power-On Self-Test (POST)

The instant power hits the motherboard, the CPU is hardwired to start executing instructions from a fixed, known memory address. Those instructions live in a small chip of **firmware** (BIOS or UEFI — covered in the next lesson) that survives power-off, unlike RAM.

The very first thing this firmware code does is run **POST — Power-On Self-Test**:

- Checks the CPU is responding
- Checks RAM is present and passes a basic read/write test
- Checks a keyboard/input device is attached
- Checks a graphics adapter is present
- Detects attached storage devices (SSD, HDD, USB)

If POST fails, the machine typically can't even display an error on screen (since the graphics card itself might be the problem) — this is why POST failures are communicated via a sequence of **beep codes** from the motherboard speaker, or blinking LED patterns on modern laptops.

If POST succeeds, you'll usually see the manufacturer's logo (Dell, Lenovo, Apple, etc.) — that's your visual cue that hardware checks passed and firmware is proceeding.

---

## 3. Step 2: Firmware Takes Over (BIOS/UEFI)

Once hardware is confirmed sane, the firmware (BIOS or UEFI) needs to find something to boot. It looks at a configured **boot order** — a priority list of devices to check (internal SSD first, then USB, then network, etc.) — and looks for a valid **bootloader** on each device in turn.

"Valid" means the firmware finds a recognizable marker:
- **BIOS** looks for the Master Boot Record (MBR) — the first 512 bytes of a disk, ending in a specific signature (`0x55AA`).
- **UEFI** looks for an EFI System Partition (ESP) containing a `.efi` bootloader executable, referenced via GPT partitioning.

The firmware's job ends the moment it finds and jumps execution to that bootloader. From here on, firmware gets out of the way (mostly).

---

## 4. Step 3: The Bootloader

The bootloader is a small, purpose-built program with exactly one job: **find, load, and start the OS kernel.**

Common bootloaders:
- **GRUB** (GRand Unified Bootloader) — most Linux distros
- **Windows Boot Manager** — Windows
- **Boot ROM / iBoot** — Apple devices

The bootloader typically:
1. Presents a menu if multiple OSes/kernel versions are installed (you've seen this if you dual-boot, or the GRUB menu on a Linux server)
2. Locates the kernel image file on disk
3. Loads any initial supporting files (e.g., an initial RAM disk with drivers needed before the real file system is mounted)
4. Loads the kernel into RAM and transfers CPU control to it

This is the last "dumb" stage of the chain — everything after this point is the actual operating system running.

---

## 5. Step 4: Loading the Kernel

The kernel is the core of the operating system (full detail in [Phase 06](../Phase-06-Kernel-and-OS-Role/)). Once the bootloader hands control to it, the kernel:

- Initializes itself in memory
- Detects and initializes hardware devices, loading the appropriate drivers
- Sets up core OS subsystems: memory management, process scheduling, file system access
- Mounts the root file system (so it can start reading normal files from disk)
- Starts the very first user-space process — on Linux this is historically `init` (PID 1), or `systemd` on most modern distros

At this point, the "operating system" as a coherent, running thing truly exists for the first time in the boot sequence.

---

## 6. Step 5: OS Initialization to Login

The first process (`systemd`/`init` on Linux, similar concepts on Windows/macOS) reads its configuration and starts everything the OS needs to be usable:

- Background services (networking, logging, hardware daemons)
- The display/graphics subsystem
- Eventually, the login manager — the screen where you type your password

Once the login manager is on screen and accepting input, the boot process is officially complete. Everything after this (opening a browser, running your app) is normal OS operation, not booting.

---

## 7. Full Sequence Diagram

```
 ┌────────────────┐
 │  Power Button   │
 │     Pressed     │
 └────────┬────────┘
          │  electricity reaches motherboard
          ▼
 ┌─────────────────────────┐
 │   CPU starts executing   │
 │  from fixed firmware      │
 │  address (hardwired)      │
 └────────┬─────────────────┘
          ▼
 ┌─────────────────────────┐
 │   POST                    │
 │  (Power-On Self-Test)     │
 │  - CPU ok?                │
 │  - RAM ok?                │
 │  - Keyboard/GPU present?  │
 └────────┬─────────────────┘
          │  pass ──▶ manufacturer logo shown
          │  fail ──▶ beep codes / blink codes, halt
          ▼
 ┌─────────────────────────┐
 │  Firmware (BIOS/UEFI)     │
 │  - checks boot order      │
 │  - finds bootloader on    │
 │    disk (MBR or ESP)      │
 └────────┬─────────────────┘
          │  jumps execution to bootloader
          ▼
 ┌─────────────────────────┐
 │  Bootloader (GRUB, etc.)  │
 │  - shows OS menu (if any) │
 │  - locates kernel image   │
 │  - loads kernel into RAM  │
 └────────┬─────────────────┘
          │  hands off CPU control
          ▼
 ┌─────────────────────────┐
 │  OS Kernel                │
 │  - init memory mgmt       │
 │  - detect hardware/drivers│
 │  - mount root filesystem  │
 │  - start PID 1 (init/     │
 │    systemd)                │
 └────────┬─────────────────┘
          ▼
 ┌─────────────────────────┐
 │  Init system starts       │
 │  services (network, etc.) │
 └────────┬─────────────────┘
          ▼
 ┌─────────────────────────┐
 │   Login Screen             │
 │   Ready for user input     │
 └─────────────────────────┘
```

---

## 8. Hands-On Exercises

**Exercise 1:** Restart your computer and time (roughly, with a phone stopwatch) how long you see the manufacturer logo (POST) versus how long it takes from logo to login screen (firmware + bootloader + kernel init). Which phase takes longer on your machine?

**Exercise 2:** On a Linux machine or VM, run `sudo dmesg | less` right after boot and scroll through the very first lines — you'll see the kernel logging hardware detection messages from Step 4 in real time.

**Exercise 3:** If you have access to a Linux system with GRUB, reboot and hold the key that opens the GRUB menu (often `Shift` or `Esc`). Look at the boot options listed — these are exactly the choices the bootloader is presenting in Step 3.

**Exercise 4:** Look up your own laptop's beep/blink codes for POST failures (search "[your laptop model] POST beep codes" in your manufacturer's support docs) — no need to trigger one, just understand what the codes mean.

**Exercise 5:** On macOS or Windows, find the "boot order" or "startup disk" setting in System Settings — this is the user-facing configuration for the boot order the firmware reads in Step 2.

---

## 9. Interview Q&A

**Q: Walk me through what happens when you press the power button on a computer.**
Answer: Power reaches the motherboard, and the CPU begins executing firmware code from a fixed address. That firmware runs POST (Power-On Self-Test) to check the CPU, RAM, and basic devices. If POST passes, firmware (BIOS or UEFI) checks a configured boot order and finds a bootloader on a storage device. The bootloader locates the OS kernel, loads it into RAM, and transfers control to it. The kernel initializes memory management, detects hardware, mounts the root file system, and starts the first user-space process (init/systemd), which starts remaining services and eventually presents the login screen.

**Q: What is POST and why does it exist?**
Answer: POST (Power-On Self-Test) is a firmware-run diagnostic that checks that critical hardware — CPU, RAM, keyboard, graphics — is present and functioning before the system attempts to boot an OS. It exists because booting an OS on broken hardware would fail in confusing, hard-to-diagnose ways; POST fails fast and reports the problem via beep/blink codes even when the display itself might be the broken component.

**Q: What's the difference between firmware and a bootloader?**
Answer: Firmware (BIOS/UEFI) is built into a chip on the motherboard, is hardware-specific, and its only job regarding booting is to run POST and locate/start a bootloader. The bootloader is a separate, OS-specific program stored on disk (e.g., GRUB) whose job is to locate the OS kernel, load it into memory, and hand off execution to it. Firmware knows about hardware; the bootloader knows about the OS.

**Q: Why can't the CPU just load the OS kernel directly, skipping the bootloader?**
Answer: Right after power-on, the CPU can only execute a tiny, fixed firmware routine — it has no concept of file systems, partitions, or where a full kernel image lives on disk. The bootloader exists as an intermediate, minimal program capable of understanding just enough of the disk's structure (partition table, file system) to locate and load the much larger, more complex kernel. It's a deliberate "small program helps load bigger program" chain.

**Q: What happens immediately after the kernel is loaded into memory?**
Answer: The kernel initializes its own core subsystems — memory management, hardware/device detection and driver loading, and process scheduling — then mounts the root file system so it can access normal files. It then starts the first user-space process (`init` or `systemd` on Linux), which is responsible for starting all remaining background services and eventually presenting the login screen.

**Q: Why do POST failures use beep codes instead of an on-screen message?**
Answer: POST runs before the OS and before the graphics subsystem is confirmed working — if the fault is in RAM or the GPU itself, the machine may be physically incapable of displaying anything. Beep codes (or blinking LED patterns on laptops without speakers) are a hardware-level signal that doesn't depend on the very components that might be failing.
