# IPv4 Addressing — Complete Guide

## Table of Contents
1. [What is an IPv4 Address](#1-what-is-an-ipv4-address)
2. [32-Bit Structure and Dotted Decimal](#2-32-bit-structure-and-dotted-decimal)
3. [Public vs Private IP Ranges](#3-public-vs-private-ip-ranges)
4. [NAT — Network Address Translation](#4-nat--network-address-translation)
5. [Special/Reserved Addresses](#5-specialreserved-addresses)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is an IPv4 Address

An IPv4 address is a numeric label assigned to a device on a network so that other devices know where to send data — the network-layer equivalent of a postal address. Every packet carries a source and destination IPv4 address so routers know where it came from and where it's going.

```
Your laptop:      192.168.1.42
Google's server:  142.250.183.14

Packet travels: laptop → home router → ISP → internet backbone → Google
Every hop reads the destination IP to decide the next hop.
```

IPv4 addresses are 32 bits long, which gives a theoretical maximum of 2^32 = **4,294,967,296** unique addresses — a number that seemed enormous in 1981 and is now effectively exhausted (see Lesson 03 on IPv6).

---

## 2. 32-Bit Structure and Dotted Decimal

An IPv4 address is 32 bits, split into four 8-bit sections called **octets**. Each octet is written in decimal (0–255) and separated by dots — this is **dotted-decimal notation**.

```
Binary (32 bits):   11000000.10101000.00000001.00101010
Dotted decimal:         192   .   168  .    1   .   42

Each octet = 8 bits = range 0-255 (2^8 = 256 possible values)
```

### Why 0–255 per octet

```
8 bits: 0 0 0 0 0 0 0 0  →  minimum value = 0
        1 1 1 1 1 1 1 1  →  maximum value = 255
        (128+64+32+16+8+4+2+1 = 255)
```

### Converting binary to decimal (worked example)

```
Binary octet:   1 1 0 0 0 0 0 0
Bit weights:  128 64 32 16 8 4 2 1

  1×128 + 1×64 + 0×32 + 0×16 + 0×8 + 0×4 + 0×2 + 0×1
= 128 + 64
= 192

So 11000000 = 192 → first octet of 192.168.1.42
```

An IPv4 address has two conceptual parts once you apply a subnet mask (covered in Lesson 02):

```
192.168.1.42 / 255.255.255.0
└─ network portion ─┘└ host ┘
    192.168.1              .42
```

---

## 3. Public vs Private IP Ranges

Not every IP address is reachable from the internet. IANA (the body that allocates IP space) reserved three blocks specifically for **private, internal-only use** — defined in RFC 1918. Anyone can use these inside their own network without needing permission, because routers on the public internet are configured to never forward traffic for these ranges.

| Range | CIDR | Total Addresses | Typical Use |
|-------|------|-----------------|-------------|
| 10.0.0.0 – 10.255.255.255 | 10.0.0.0/8 | ~16.7 million | Large corporate networks, cloud VPCs (AWS/GCP) |
| 172.16.0.0 – 172.31.255.255 | 172.16.0.0/12 | ~1 million | Docker default bridge networks, medium orgs |
| 192.168.0.0 – 192.168.255.255 | 192.168.0.0/16 | ~65,000 | Home routers, small office LANs |

**Public IP addresses** are everything outside these ranges — globally unique, routable across the internet, assigned by ISPs or cloud providers, and require registration through regional registries (ARIN, RIPE, APNIC, etc.).

```
Private (only meaningful inside your LAN):
  192.168.1.10, 192.168.1.11, 192.168.1.12 ...  (your home devices)

Public (globally unique, reachable from anywhere):
  8.8.8.8         (Google DNS)
  142.250.183.14  (google.com)
  104.16.132.229  (cloudflare.com)
```

Because private ranges repeat across millions of unrelated networks (your neighbor's router also hands out 192.168.1.x), a device with only a private IP cannot be reached directly from the internet — it needs NAT.

---

## 4. NAT — Network Address Translation

Your home network might have a phone, laptop, smart TV, and game console — each with a private IP like `192.168.1.x`. Your ISP, however, gave your router only **one public IP address**. NAT is the technique that lets all those private-IP devices share that single public IP to reach the internet.

The router keeps a **translation table** mapping each internal (private IP, private port) pair to a unique (public IP, public port) pair, so return traffic knows which internal device to deliver to.

```
                         NAT TRANSLATION TABLE (on router)
                    ┌─────────────────────┬─────────────────────┐
                    │  Internal (LAN)     │  External (Internet) │
                    ├─────────────────────┼─────────────────────┤
                    │ 192.168.1.10:51000  │ 203.0.113.5:40001    │
                    │ 192.168.1.11:52200  │ 203.0.113.5:40002    │
                    │ 192.168.1.12:53010  │ 203.0.113.5:40003    │
                    └─────────────────────┴─────────────────────┘

  ┌──────────┐         ┌──────────────────────┐         ┌───────────────┐
  │ Laptop   │         │      Home Router     │         │  Web Server   │
  │192.168.1.│  LAN    │  LAN IP: 192.168.1.1 │ Internet│ 93.184.216.34 │
  │  10      │────────▶│  WAN IP: 203.0.113.5 │────────▶│               │
  └──────────┘         │  (public IP, given   │         └───────────────┘
                        │   by ISP)            │
  ┌──────────┐         │                       │
  │ Phone    │  LAN    │  Rewrites source IP:  │
  │192.168.1.│────────▶│  192.168.1.10:51000   │
  │  11      │         │      ↓ becomes ↓      │
  └──────────┘         │  203.0.113.5:40001    │
                        └──────────────────────┘

  Outbound: private IP:port → rewritten to → public IP:unique port
  Inbound:  router looks up the table → delivers back to correct device
```

### Step by step

1. Laptop (192.168.1.10) sends a request to a web server, source = `192.168.1.10:51000`.
2. Router replaces the source with its own public IP and a unique port: `203.0.113.5:40001`. It records this mapping in its NAT table.
3. The web server sees the request coming from `203.0.113.5:40001` and has no idea a private network exists behind it.
4. The server's response goes back to `203.0.113.5:40001`.
5. The router looks up `40001` in its NAT table, finds it maps to `192.168.1.10:51000`, and forwards the response to the laptop.

### Why NAT matters

- It let the internet keep working long after the ~4.3 billion IPv4 addresses ran out — millions of private devices share a handful of public IPs.
- It provides a side-effect of security: devices behind NAT aren't directly reachable from the internet unless the router is explicitly configured (port forwarding) to allow it.
- It's exactly what Docker does for containers, and what your Kubernetes cluster's pod networking often relies on at the node boundary.

---

## 5. Special/Reserved Addresses

| Address / Range | Meaning |
|---|---|
| `127.0.0.1` (127.0.0.0/8) | Loopback — refers to "this machine itself" |
| `0.0.0.0` | "This host" / any address (used as a listen-on-all-interfaces address) |
| `255.255.255.255` | Limited broadcast — send to every device on the local network |
| `169.254.0.0/16` | Link-local — auto-assigned when DHCP fails (APIPA) |

---

## 6. Hands-On Exercises

1. Run `ipconfig` (Windows) or `ifconfig`/`ip addr` (Mac/Linux) on your machine. Identify your private IP address and which RFC 1918 range it falls in.
2. Visit a "what is my IP" check via your router's admin page (usually `192.168.1.1` or `192.168.0.1`) and note the WAN/public IP it reports. Compare it to your device's private IP — explain why they differ.
3. Convert the binary address `11000000.10101000.00000000.00000001` to dotted decimal by hand, showing your bit-weight math for each octet.
4. List three devices on your home network (phone, laptop, TV) and sketch a NAT table like the one in this lesson, inventing plausible private IPs and ports for each.
5. Explain, in one paragraph, why two people in different houses can both have a device at `192.168.1.5` without any conflict.

---

## 7. Interview Q&A

**Q: What is the difference between a public and a private IP address?**
Answer: A public IP is globally unique and routable across the internet, assigned by an ISP or cloud provider. A private IP comes from one of the RFC 1918 reserved ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), is only meaningful within a local network, and is never routed on the public internet — routers are configured to drop traffic for these ranges at the boundary.

**Q: Why do we need NAT?**
Answer: IPv4 only has about 4.3 billion addresses, far fewer than the number of internet-connected devices. NAT lets many devices on a private network share a single public IP by translating (private IP, port) pairs to (public IP, unique port) pairs at the router, using a translation table to route return traffic back to the correct internal device.

**Q: How does a router know which internal device a response packet belongs to after NAT?**
Answer: The router maintains a NAT translation table that maps each internal (private IP, private port) to the external (public IP, public port) it assigned. When a response arrives at the public IP and port, the router looks up the table and forwards the packet to the matching internal device.

**Q: Can two devices on different home networks have the same private IP address?**
Answer: Yes. Private IP ranges are not globally unique — they're only unique within their own local network. Millions of home routers hand out 192.168.1.x to their own devices independently, with no conflict, because that address never leaves the local network unmodified.

**Q: What is a loopback address and what is it used for?**
Answer: 127.0.0.1 (and the whole 127.0.0.0/8 range) is the loopback address — it always refers to the local machine itself. It's used to test network software or connect to locally running services (e.g. a dev server at localhost:3000) without touching a physical network interface.

**Q: If IPv4 has 4.3 billion addresses, why do we say it's "exhausted"?**
Answer: Regional internet registries have allocated essentially all available public IPv4 blocks to ISPs and organizations. Growth in internet-connected devices (mobile, IoT) far outpaced the address space. NAT and private ranges extended IPv4's life significantly, but the long-term fix is IPv6, which has a vastly larger address space (covered in Lesson 03).
