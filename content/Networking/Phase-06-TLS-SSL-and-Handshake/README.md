# Phase 06 — TLS/SSL and the Handshake

## Why This Phase Matters

Every HTTPS request you've ever made was secured by TLS. It's one of the most commonly asked topics in networking and backend interviews for a reason: it touches cryptography, PKI, performance (RTTs), and real production debugging (expired certs, cipher mismatches, `SSL_ERROR` messages). A 3-years-experience engineer is expected to explain the handshake on a whiteboard, not just know "the lock icon means it's secure."

This phase builds from the history and guarantees of TLS, through the two encryption approaches it combines, to the exact handshake sequence, and finally to how certificates and Certificate Authorities establish trust.

## What You'll Learn

| # | Lesson | Core Question Answered |
|---|--------|------------------------|
| 01 | [SSL vs TLS](01-SSL-vs-TLS.md) | What's the difference, and what does TLS actually guarantee? |
| 02 | [Symmetric vs Asymmetric Encryption](02-Symmetric-vs-Asymmetric-Encryption.md) | Why does TLS use two different kinds of encryption? |
| 03 | [The TLS Handshake Step-by-Step](03-The-TLS-Handshake-Step-by-Step.md) | What exactly happens before your browser shows the padlock? |
| 04 | [Certificates and Certificate Authorities](04-Certificates-and-Certificate-Authorities.md) | How does a browser know it's really talking to your bank? |

## Prerequisites

- Phase 02 (TCP vs UDP) — TLS rides on top of a TCP connection (or QUIC for HTTP/3).
- Phase 05 (HTTP/HTTPS Fundamentals) — helpful context for why HTTPS = HTTP + TLS.

## How to Use This Phase

1. Read each lesson in order — encryption concepts in Lesson 02 are required to understand the handshake in Lesson 03.
2. Run every `openssl` command in the Hands-On Exercises. Seeing a real certificate chain printed to your terminal makes the concepts concrete.
3. Answer the Interview Q&A out loud, as if in a live interview, before checking your answer against the written one.

## Time Estimate

3–4 hours, including hands-on exercises.

---

**Next Phase:** [Phase 07 — Cookies, Sessions and Web Auth](../Phase-07-Cookies-Sessions-and-Web-Auth/README.md)
