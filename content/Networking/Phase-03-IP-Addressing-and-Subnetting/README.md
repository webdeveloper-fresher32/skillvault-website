# Phase 03 — IP Addressing and Subnetting

## Overview

Every device on a network needs an address, and every organization needs a way to carve up its address space so networks don't collide or waste capacity. This phase covers how IPv4 addresses are structured, why private and public IP ranges exist, how NAT lets millions of home devices share one public IP, how subnetting and CIDR notation let engineers split networks into right-sized chunks, why the world is migrating to IPv6, and how ports/sockets let multiple services share a single IP address.

By the end of this phase you should be able to read any IP address and CIDR block and immediately state its network address, broadcast address, and usable host range — a skill that shows up constantly in interviews and in real infrastructure work (VPC subnet design, Docker networks, Kubernetes CIDRs, firewall rules).

## Lessons

| # | Lesson | What You'll Learn |
|---|--------|--------------------|
| 01 | [IPv4 Addressing](01-IPv4-Addressing.md) | 32-bit address structure, dotted decimal, public vs private ranges, NAT |
| 02 | [Subnetting Basics](02-Subnetting-Basics.md) | What a subnet is, CIDR notation, worked network/broadcast/host-range examples |
| 03 | [IPv6 Overview](03-IPv6-Overview.md) | Why IPv6 exists, address format, IPv4 vs IPv6 comparison |
| 04 | [Ports and Sockets Recap](04-Ports-and-Sockets-Recap.md) | Well-known ports, ephemeral ports, how a socket is identified |

## Time Estimate

**5–7 hours** (reading + hands-on exercises), spread over 2–3 sessions.

## Prerequisites

Phase 01 (Fundamentals and OSI/TCP-IP Models) and Phase 02 (TCP vs UDP) — this phase assumes you already understand layers, packets, and the transport layer.

## What's Next

Phase 04 moves up the stack into DNS — how human-readable domain names are resolved into the IP addresses this phase teaches you to read.
