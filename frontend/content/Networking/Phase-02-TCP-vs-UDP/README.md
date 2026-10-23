# Phase 02 — TCP vs UDP

## Overview

Every network conversation your app has — an API call, a video stream, a DNS lookup — travels over one of two transport-layer protocols: TCP or UDP. This phase digs into how each one actually works under the hood: TCP's connection setup and teardown, its reliability and flow-control machinery, and UDP's stripped-down "just send it" design. You'll finish by writing real socket code in Python so the difference stops being theoretical and becomes something you've watched happen on your own machine.

This is one of the most heavily tested topics in backend and full-stack interviews — the 3-way handshake and "when would you use TCP vs UDP" come up constantly, so this phase treats them in depth.

## Lessons

| # | Lesson | What You'll Learn |
|---|--------|--------------------|
| 01 | [TCP Explained](01-TCP-Explained.md) | Connection-oriented delivery, the 3-way handshake, flow control, congestion control, 4-way termination |
| 02 | [UDP Explained](02-UDP-Explained.md) | Connectionless delivery, why UDP is faster, real use cases (DNS, streaming, gaming, VoIP) |
| 03 | [TCP vs UDP Comparison](03-TCP-vs-UDP-Comparison.md) | Head-to-head comparison table, worked "which protocol would you pick" scenarios |
| 04 | [Ports & Sockets Recap](../Phase-03-IP-Addressing-and-Subnetting/04-Ports-and-Sockets-Recap.md) | What a socket is, IP+port addressing, socket programming foundations |

## Time Estimate

**4–6 hours** (reading + hands-on exercises), spread over 2–3 sessions.

## Prerequisites

Phase 01 (Fundamentals and OSI/TCP-IP Models) — you should already know that TCP and UDP live at the Transport layer (Layer 4) and sit below application protocols like HTTP and DNS.

## What's Next

Phase 03 moves up to IP addressing and subnetting — how devices get identified and routed on a network in the first place.
