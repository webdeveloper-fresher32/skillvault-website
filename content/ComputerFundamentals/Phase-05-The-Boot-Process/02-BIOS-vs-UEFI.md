# BIOS vs UEFI

## Table of Contents
1. [Two Firmware Standards, One Job](#1-two-firmware-standards-one-job)
2. [BIOS](#2-bios)
3. [UEFI](#3-uefi)
4. [Key Differences at a Glance](#4-key-differences-at-a-glance)
5. [Why UEFI Replaced BIOS](#5-why-uefi-replaced-bios)
6. [Secure Boot](#6-secure-boot)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Two Firmware Standards, One Job

Both BIOS and UEFI are **firmware** — the first code that runs when you power on a computer (see [Lesson 01](01-What-Happens-When-You-Power-On-a-Computer.md)). They do the same fundamental job: run POST, then find and start a bootloader. UEFI is the modern replacement for BIOS, designed to fix BIOS's aging limitations.

```
BIOS  = Basic Input/Output System        (1975, IBM PC era, showing its age)
UEFI  = Unified Extensible Firmware Interface  (2005+, modern standard)
```

Almost every computer sold today ships with UEFI, usually running in a "legacy/BIOS compatibility mode" option for older OSes — but pure BIOS-only machines are effectively extinct in new hardware.

---

## 2. BIOS

BIOS is decades-old firmware with real constraints baked in from an era of 16-bit processors and tiny disks:

- Runs in **16-bit real mode** — severely limits addressable memory and requires trickery ("protected mode" switching) for the kernel to use full modern RAM
- Uses the **Master Boot Record (MBR)** partitioning scheme — max **4 primary partitions**, and a hard **2 TB disk size limit**
- Boot process relies on the firmware reading a fixed 512-byte boot sector — very little room for a smart or flexible boot menu
- No built-in networking, no built-in mouse support, no graphical interface — you navigate BIOS setup screens with arrow keys against plain text
- No native security verification of what it's booting — it'll happily boot anything with a valid MBR signature, including malware

---

## 3. UEFI

UEFI is a full pre-boot **environment**, not just a tiny firmware routine:

- Runs in **32-bit or 64-bit mode** natively, matching modern CPUs
- Uses the **GUID Partition Table (GPT)** — supports up to **128 partitions** and disk sizes up to **9.4 ZB** (effectively unlimited for today's hardware)
- Boot files are normal files (`.efi` executables) sitting in a dedicated EFI System Partition — the bootloader is just a file, easy to update or repair
- Supports networking and mouse input pre-boot; many UEFI setup screens are graphical
- Supports **Secure Boot** — cryptographic verification that the bootloader/kernel hasn't been tampered with
- Boots noticeably faster — capable of initializing hardware in parallel and skipping unnecessary legacy checks

---

## 4. Key Differences at a Glance

| Aspect | BIOS | UEFI |
|---|---|---|
| Era | 1975 (legacy) | 2005+ (modern standard) |
| CPU mode | 16-bit real mode | 32-bit / 64-bit |
| Partition scheme | MBR | GPT |
| Max partitions | 4 primary | 128 |
| Max disk size | 2 TB | ~9.4 ZB |
| Boot speed | Slower | Faster |
| Pre-boot UI | Text only | Graphical, mouse support |
| Networking pre-boot | No | Yes |
| Secure Boot | No | Yes |
| Boot file format | Raw 512-byte sector code | Standard `.efi` executable files |

---

## 5. Why UEFI Replaced BIOS

Three concrete pain points drove the industry-wide switch:

1. **Faster boot.** UEFI can initialize hardware in parallel and skip legacy compatibility checks that BIOS always performed, shaving real seconds off boot time — a big deal for both consumer laptops and data-center servers that reboot often.
2. **Larger disk support.** BIOS's MBR scheme physically cannot address a disk larger than 2 TB or have more than 4 primary partitions. As hard drives and SSDs grew past 2 TB, BIOS became a hard blocker — GPT (used by UEFI) removes that ceiling.
3. **Secure Boot.** BIOS has no concept of verifying what it boots — it just runs whatever bootloader it finds. This made pre-OS ("bootkit") malware possible. UEFI's Secure Boot closes that gap.

---

## 6. Secure Boot

Secure Boot is a UEFI feature that cryptographically verifies each stage of the boot chain before running it:

```
UEFI firmware (holds trusted public keys)
      │  verifies signature of →
      ▼
Bootloader (must be signed by a trusted key)
      │  verifies signature of →
      ▼
OS Kernel (must be signed by a trusted key)
      │
      ▼
Boot proceeds only if every signature checks out
```

If any stage's signature doesn't match a key UEFI trusts, Secure Boot halts the boot process rather than run potentially tampered-with code. This is why installing certain Linux distros or dual-booting sometimes requires you to either disable Secure Boot or enroll the distro's signing key — the firmware won't run an unsigned/untrusted bootloader by default.

---

## 7. Hands-On Exercises

**Exercise 1:** Reboot your computer and enter firmware setup (commonly `F2`, `F10`, `Del`, or `Esc` at startup — check your manufacturer). Look for whether it identifies itself as "BIOS," "UEFI," or "UEFI BIOS Utility," and note whether the interface is graphical or text-only.

**Exercise 2:** In that same firmware setup, find the Secure Boot setting (usually under a "Security" or "Boot" tab) and note whether it's enabled or disabled — do not change it unless you understand the consequences.

**Exercise 3:** On a Linux machine, run `ls /sys/firmware/efi` — if the directory exists, your system booted via UEFI; if it doesn't exist, it booted via legacy BIOS mode.

**Exercise 4:** On Windows, open Disk Management (or run `diskpart` then `list disk`) and check whether your system disk is partitioned as GPT or MBR — this tells you which firmware mode installed it.

**Exercise 5:** Research (no need to try it) what "CSM" (Compatibility Support Module) means in a UEFI firmware setup screen — it's the setting that lets UEFI firmware boot older BIOS-only operating systems.

---

## 8. Interview Q&A

**Q: What is the main difference between BIOS and UEFI?**
Answer: Both are firmware that run at power-on to perform hardware checks and locate a bootloader, but UEFI is the modern replacement for BIOS. UEFI runs in 32/64-bit mode, uses the GPT partitioning scheme (supporting far larger disks and more partitions than BIOS's MBR/2TB/4-partition limits), boots faster, supports a graphical pre-boot interface with networking, and adds Secure Boot for cryptographic verification of the boot chain.

**Q: Why couldn't BIOS support disks larger than 2 TB?**
Answer: BIOS uses the MBR (Master Boot Record) partitioning scheme, which stores partition sizes using 32-bit values in 512-byte sectors — that addressing scheme maxes out at 2 TB. UEFI uses GPT instead, which uses 64-bit values for addressing, supporting disks up to roughly 9.4 zettabytes.

**Q: What is Secure Boot and what problem does it solve?**
Answer: Secure Boot is a UEFI feature that cryptographically verifies the signature of each component in the boot chain — bootloader, then kernel — against keys trusted by the firmware, refusing to boot anything unsigned or tampered with. It solves the problem of pre-OS malware ("bootkits") that BIOS was vulnerable to, since BIOS boots whatever it finds with a valid MBR signature regardless of its origin or integrity.

**Q: If a system has UEFI firmware, can it still boot an old BIOS-only OS or bootloader?**
Answer: Yes, via a compatibility feature usually called CSM (Compatibility Support Module), which lets UEFI firmware emulate legacy BIOS behavior for older operating systems that don't understand UEFI/GPT. Most UEFI systems ship with CSM available but often disabled by default in favor of pure UEFI mode.

**Q: Does having UEFI automatically mean Secure Boot is protecting your system?**
Answer: No — UEFI makes Secure Boot possible, but it's a setting that can be enabled or disabled independently in firmware setup. A UEFI system with Secure Boot disabled has no more pre-boot integrity verification than a BIOS system; you have to explicitly confirm it's enabled to get that protection.

**Q: Why does installing Linux alongside Windows sometimes require disabling Secure Boot?**
Answer: Secure Boot only trusts bootloaders/kernels signed by keys the firmware recognizes (by default, typically Microsoft's). Many Linux distributions either aren't signed with a recognized key or require the user to manually enroll the distro's signing key into the firmware's trust store (MOK — Machine Owner Key) — until that's done, Secure Boot will refuse to boot the unsigned Linux bootloader.
