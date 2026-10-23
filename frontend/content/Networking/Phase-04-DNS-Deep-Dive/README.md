# Phase 04 — DNS Deep Dive

## Overview

DNS (Domain Name System) is the piece of internet infrastructure every full-stack engineer touches but rarely understands deeply — until a production DNS misconfiguration takes down a service, or an interviewer asks "what happens when you type google.com into a browser?" This phase builds a complete mental model of DNS: what it is, how resolution actually works step by step, the record types you'll configure in real projects (A, CNAME, MX, TXT...), and the caching/TTL behavior that causes some of the most confusing production incidents ("I changed the DNS record an hour ago, why is it still pointing to the old server?").

By the end of this phase you should be able to trace a DNS lookup from browser cache to authoritative server, explain the difference between recursive and iterative queries, pick the correct record type for a given scenario, and reason about propagation delay during a DNS cutover.

## Goals

- Understand DNS as a distributed, hierarchical naming system (not a single database).
- Trace the full resolution path for a domain lookup, including every cache layer involved.
- Know the difference between recursive and iterative DNS queries.
- Identify the purpose of each major DNS record type (A, AAAA, CNAME, MX, TXT, NS, SOA) and when to use it.
- Understand TTL, caching layers, and why DNS changes don't take effect instantly.
- Debug real DNS issues using `dig` and `nslookup`.

## Files in This Phase

| File | Topic |
|------|-------|
| `01-What-is-DNS.md` | DNS as the internet's phonebook, domain hierarchy (root → TLD → authoritative) |
| `02-DNS-Resolution-Process.md` | Full step-by-step resolution flow, recursive vs iterative queries |
| `03-DNS-Record-Types.md` | A, AAAA, CNAME, MX, TXT, NS, SOA records with real-world examples |
| `04-DNS-Caching-and-TTL.md` | Caching at every layer, TTL, propagation delay, common production issues |

## Prerequisites

- Phase 01–03 of this Networking course (IP addressing, TCP/IP basics, how packets travel).
- Comfortable with a terminal — this phase leans heavily on `dig` and `nslookup`.

## What's Next

Phase 12 (or the capstone phase of this course) builds on this material to answer the full "what happens when you type a URL into your browser and hit Enter" interview question, chaining DNS resolution into TCP handshake, TLS negotiation, HTTP request/response, and rendering.
