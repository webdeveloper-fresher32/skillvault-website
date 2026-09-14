# Subnetting Basics — Complete Guide

## Table of Contents
1. [What is a Subnet and Why Subdivide Networks](#1-what-is-a-subnet-and-why-subdivide-networks)
2. [CIDR Notation Explained](#2-cidr-notation-explained)
3. [Subnet Masks](#3-subnet-masks)
4. [Worked Example: 192.168.1.0/24](#4-worked-example-1921681024)
5. [Worked Example: 192.168.1.0/26](#5-worked-example-192168106)
6. [More Worked Examples](#6-more-worked-examples)
7. [Quick-Reference CIDR Table](#7-quick-reference-cidr-table)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a Subnet and Why Subdivide Networks

A **subnet** (sub-network) is a smaller network carved out of a larger IP address block. Instead of putting every device in an organization on one giant flat network, engineers split the address space into smaller, purpose-built segments.

Why bother?

```
Without subnetting:                 With subnetting:
  One flat network of 65,000 IPs      192.168.0.0/24  → Engineering (254 hosts)
  - broadcast storms affect everyone  192.168.1.0/24  → Sales (254 hosts)
  - one team's traffic floods all     192.168.2.0/26  → Guest WiFi (62 hosts)
  - no isolation between teams        192.168.2.64/28 → IoT devices (14 hosts)
  - security = all-or-nothing         192.168.2.128/25→ Servers (126 hosts)
```

Reasons to subnet:
- **Reduce broadcast traffic** — broadcasts stay within a subnet, not the whole organization.
- **Security and isolation** — put guest WiFi, IoT devices, and production servers on separate subnets with firewall rules between them.
- **Efficient address allocation** — don't waste a /24 (254 hosts) on a subnet that only needs 10 devices.
- **Organizational structure** — map subnets to departments, environments (dev/staging/prod), or cloud availability zones (this is exactly how AWS VPC subnets work).

---

## 2. CIDR Notation Explained

**CIDR** (Classless Inter-Domain Routing) notation expresses an IP address plus how many bits are reserved for the **network portion**, written as a suffix after a slash.

```
192.168.1.0/24
└────┬────┘ └┬┘
  base IP    number of bits that identify the NETWORK
             (remaining 32-24 = 8 bits identify HOSTS)
```

The `/24` means: "the first 24 bits of this 32-bit address are fixed (the network), the remaining 8 bits vary (the hosts)."

```
/24 breakdown:
  11000000.10101000.00000001.00000000
  └────────network (24 bits)────────┘└host (8 bits)┘
     192   .   168   .    1   .        0

Fixed:    192.168.1.___   ← network stays the same for every device here
Variable: ___.___.___.0-255  ← host portion, up to 256 combinations
```

A smaller number after the slash = fewer network bits = more host bits = a **bigger** network. A larger number = more network bits = fewer host bits = a **smaller** network. This is the opposite of what people expect at first — /8 is huge, /30 is tiny.

---

## 3. Subnet Masks

A CIDR prefix and a subnet mask express the exact same thing in two different formats.

```
CIDR:         /24
Subnet mask:  255.255.255.0

Binary mask:  11111111.11111111.11111111.00000000
              └──── 24 ones ────┘└─ 8 zeros ─┘

1 bits = network portion (fixed)
0 bits = host portion (variable, assignable to devices)
```

| CIDR | Subnet Mask | Network Bits | Host Bits |
|------|-------------|--------------|-----------|
| /8   | 255.0.0.0   | 8  | 24 |
| /16  | 255.255.0.0 | 16 | 16 |
| /24  | 255.255.255.0 | 24 | 8 |
| /26  | 255.255.255.192 | 26 | 6 |
| /30  | 255.255.255.252 | 30 | 2 |

---

## 4. Worked Example: 192.168.1.0/24

Given: **192.168.1.0/24**

**Step 1 — Host bits:** 32 - 24 = 8 host bits → 2^8 = 256 total addresses in this block.

**Step 2 — Network address:** the network address is the block's base with all host bits set to 0 — that's simply the given address here: `192.168.1.0`.

**Step 3 — Broadcast address:** the last address in the block, with all host bits set to 1:
```
192.168.1.  00000000   ← network address (host bits = all 0)
192.168.1.  11111111   ← broadcast address (host bits = all 1) = 192.168.1.255
```

**Step 4 — Usable host range:** every address between network and broadcast, excluding both endpoints (network address identifies the network itself; broadcast address is reserved for broadcasting to all hosts):
```
192.168.1.1  through  192.168.1.254
```

| Field | Value |
|---|---|
| Network Address | 192.168.1.0 |
| Broadcast Address | 192.168.1.255 |
| Usable Host Range | 192.168.1.1 – 192.168.1.254 |
| Total Addresses | 256 |
| Usable Hosts | 254 (256 - network - broadcast) |

---

## 5. Worked Example: 192.168.1.0/26

Given: **192.168.1.0/26**

**Step 1 — Host bits:** 32 - 26 = 6 host bits → 2^6 = 64 total addresses per block.

**Step 2 — Block size:** each /26 block spans 64 addresses, so /24's 256 addresses split into 256/64 = **4 subnets**:
```
Subnet 1: 192.168.1.0    – 192.168.1.63
Subnet 2: 192.168.1.64   – 192.168.1.127
Subnet 3: 192.168.1.128  – 192.168.1.191
Subnet 4: 192.168.1.192  – 192.168.1.255
```

**Step 3 — For the first block (192.168.1.0/26):**
```
Network address:    192.168.1.0     (host bits all 0)
Broadcast address:  192.168.1.63    (host bits all 1 → 0+63)
Usable host range:  192.168.1.1  –  192.168.1.62
```

| Field | Value |
|---|---|
| Network Address | 192.168.1.0 |
| Broadcast Address | 192.168.1.63 |
| Usable Host Range | 192.168.1.1 – 192.168.1.62 |
| Total Addresses | 64 |
| Usable Hosts | 62 |

**For the second block (192.168.1.64/26):**

| Field | Value |
|---|---|
| Network Address | 192.168.1.64 |
| Broadcast Address | 192.168.1.127 |
| Usable Host Range | 192.168.1.65 – 192.168.1.126 |
| Usable Hosts | 62 |

---

## 6. More Worked Examples

### 10.0.0.0/28

```
Host bits: 32 - 28 = 4  →  2^4 = 16 addresses per block

Network address:    10.0.0.0
Broadcast address:  10.0.0.15
Usable host range:  10.0.0.1 – 10.0.0.14   (14 usable hosts)
```

### 172.16.5.0/25

```
Host bits: 32 - 25 = 7  →  2^7 = 128 addresses per block

Network address:    172.16.5.0
Broadcast address:  172.16.5.127
Usable host range:  172.16.5.1 – 172.16.5.126   (126 usable hosts)
```

### 192.168.10.128/30 (common for point-to-point router links)

```
Host bits: 32 - 30 = 2  →  2^2 = 4 addresses per block

Network address:    192.168.10.128
Broadcast address:  192.168.10.131
Usable host range:  192.168.10.129 – 192.168.10.130   (2 usable hosts)
```

---

## 7. Quick-Reference CIDR Table

| CIDR | Subnet Mask | Total Addresses | Usable Hosts | Common Use |
|------|-------------|------------------|--------------|------------|
| /24 | 255.255.255.0 | 256 | 254 | Standard LAN, small office |
| /25 | 255.255.255.128 | 128 | 126 | Splitting a /24 in half |
| /26 | 255.255.255.192 | 64 | 62 | Department subnet |
| /27 | 255.255.255.224 | 32 | 30 | Small team subnet |
| /28 | 255.255.255.240 | 16 | 14 | Small VLAN, guest network |
| /29 | 255.255.255.248 | 8 | 6 | Tiny subnet, few servers |
| /30 | 255.255.255.252 | 4 | 2 | Point-to-point router link |

**Formula to remember:** for any `/n`, host bits = `32 - n`, total addresses = `2^(32-n)`, usable hosts = `2^(32-n) - 2` (subtracting network and broadcast addresses).

---

## 8. Hands-On Exercises

1. For `10.0.0.0/16`, calculate the network address, broadcast address, and usable host range.
2. For `192.168.5.64/27`, calculate the network address, broadcast address, and usable host range.
3. Your company needs a subnet for 100 servers with room to grow to 120. Which CIDR prefix (/24, /25, or /26) is the smallest block that fits, and why?
4. Split `192.168.100.0/24` into 8 equal subnets. What CIDR prefix does each subnet get, and what is the network address of the 3rd subnet?
5. Given the subnet mask `255.255.255.240`, write it as a CIDR prefix and state how many usable hosts it supports.

---

## 9. Interview Q&A

**Q: What is CIDR notation and what does the number after the slash mean?**
Answer: CIDR notation writes an IP block as `address/n`, where `n` is the number of bits (out of 32) reserved for the network portion. The remaining `32-n` bits identify hosts within that network. A smaller `n` means more host bits and a bigger network; a larger `n` means fewer host bits and a smaller network.

**Q: How do you calculate the number of usable hosts in a CIDR block?**
Answer: Host bits = 32 - CIDR prefix. Total addresses = 2^(host bits). Usable hosts = total addresses - 2, because the first address in the block is reserved as the network address and the last is reserved as the broadcast address.

**Q: How do you find the broadcast address for a given network?**
Answer: Set all host bits (the bits not covered by the CIDR prefix) to 1 while keeping the network bits fixed. For example, for 192.168.1.0/24, the network bits are the first 24 (192.168.1), and setting the remaining 8 host bits to all 1s gives 192.168.1.255.

**Q: Why do we subnet a network instead of using one large flat network?**
Answer: Subnetting reduces broadcast traffic (broadcasts stay within a subnet), improves security by isolating groups of devices (e.g. guest WiFi from internal servers) with firewall rules between subnets, and allocates address space efficiently by sizing each subnet to its actual need instead of wasting a large block on a small group.

**Q: What's the difference between a network address and a subnet mask?**
Answer: The network address is a specific IP value (the "base" of a block, with all host bits zeroed) — it identifies the subnet itself. The subnet mask is a pattern of 1s and 0s that tells you which bits of any address in that block belong to the network vs. the host — it's the tool used to compute the network address, broadcast address, and host range.

**Q: If you're given 192.168.1.0/24 and need 4 equal-sized subnets, what CIDR prefix do you use for each, and what are their network addresses?**
Answer: Splitting a /24 into 4 equal parts borrows 2 more bits (2^2 = 4), giving /26 subnets of 64 addresses each: 192.168.1.0/26, 192.168.1.64/26, 192.168.1.128/26, and 192.168.1.192/26.
