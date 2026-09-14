# SSL vs TLS — Complete Guide

## Table of Contents
1. [A Brief History](#1-a-brief-history)
2. [SSL is Dead — Why We Still Say "SSL Certificate"](#2-ssl-is-dead--why-we-still-say-ssl-certificate)
3. [TLS Versions](#3-tls-versions)
4. [TLS 1.2 vs TLS 1.3](#4-tls-12-vs-tls-13)
5. [What TLS Actually Provides](#5-what-tls-actually-provides)
6. [Where TLS Sits in the Stack](#6-where-tls-sits-in-the-stack)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. A Brief History

```
1995  SSL 2.0   (Netscape)         — broken, deprecated
1996  SSL 3.0   (Netscape)         — broken (POODLE attack, 2014), deprecated
1999  TLS 1.0   (IETF takes over)  — basically "SSL 3.1", deprecated 2021
2006  TLS 1.1                      — deprecated 2021
2008  TLS 1.2                      — still widely used today
2018  TLS 1.3                      — modern standard, faster + more secure
```

SSL (Secure Sockets Layer) was invented by Netscape in the mid-1990s to secure web traffic. When the IETF (Internet Engineering Task Force) took over standardizing the protocol in 1999, they renamed it TLS (Transport Layer Security) — partly for legal reasons (Netscape trademark) and partly to mark it as a proper open standard rather than one vendor's product.

**TLS is SSL's successor.** Every version of SSL (2.0 and 3.0) is now formally deprecated and considered insecure. Modern "SSL" is a misnomer — what's actually running is TLS.

---

## 2. SSL is Dead — Why We Still Say "SSL Certificate"

You'll still hear "SSL certificate," "SSL/TLS," and see products called "SSL termination" everywhere. This is purely **legacy terminology** — the industry never rebranded consistently. In practice:

- **"SSL certificate"** = an X.509 certificate used to establish a TLS connection (there's no such thing as an "SSL" certificate anymore — it's just habit).
- **"Enable SSL on this server"** = enable TLS on this server.
- No production system running today should be negotiating actual SSL 2.0/3.0 — browsers and modern servers refuse to.

```
What people say:        What's actually happening:
"SSL certificate"   →   TLS certificate (X.509)
"SSL handshake"     →   TLS handshake
"SSL termination"   →   TLS termination (decrypting TLS at a load balancer)
```

---

## 3. TLS Versions

| Version | Year | Status |
|---------|------|--------|
| SSL 2.0 | 1995 | Broken, banned by browsers |
| SSL 3.0 | 1996 | Broken (POODLE), banned by browsers |
| TLS 1.0 | 1999 | Deprecated (2021), disabled by major browsers |
| TLS 1.1 | 2006 | Deprecated (2021), disabled by major browsers |
| TLS 1.2 | 2008 | Supported everywhere, still very common |
| TLS 1.3 | 2018 | Modern default, faster and more secure |

Modern servers (and compliance standards like PCI-DSS) require **TLS 1.2 minimum**, with TLS 1.3 preferred wherever supported.

---

## 4. TLS 1.2 vs TLS 1.3

| Aspect | TLS 1.2 | TLS 1.3 |
|--------|---------|---------|
| Handshake round trips | 2-RTT | 1-RTT (0-RTT possible on resumption) |
| Cipher negotiation | Many legacy ciphers allowed (including weak ones like RC4, CBC-mode with issues) | Only a small curated list of strong AEAD ciphers |
| Key exchange | RSA key exchange or (EC)DHE | (EC)DHE only — always forward secrecy |
| Renegotiation | Allowed mid-session (was a source of attacks) | Removed entirely |
| Handshake encryption | Most of the handshake is in plaintext | Handshake encrypted after ServerHello |
| Speed | Slower due to extra round trip | Faster — fewer round trips = lower latency |
| Forward secrecy | Optional (depends on cipher) | Mandatory |

**Forward secrecy** means that even if a server's private key is stolen in the future, past recorded traffic can't be decrypted, because each session used a unique, ephemeral key that isn't derivable from the long-term private key.

The single biggest practical difference: **TLS 1.3 cuts one round trip off the handshake**, which matters a lot for mobile clients and high-latency connections — see Lesson 03 for the exact sequence diagrams.

---

## 5. What TLS Actually Provides

TLS gives you three security guarantees over an otherwise plaintext TCP connection:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CONFIDENTIALITY                                          │
│    Data is encrypted — an eavesdropper on the network       │
│    (coffee shop wifi, ISP, man-in-the-middle) sees only     │
│    ciphertext, not your password or credit card number.     │
├─────────────────────────────────────────────────────────────┤
│ 2. INTEGRITY                                                 │
│    Data can't be silently modified in transit. Each         │
│    message includes a MAC (Message Authentication Code) —   │
│    if a single bit is tampered with, the connection fails.  │
├─────────────────────────────────────────────────────────────┤
│ 3. AUTHENTICATION                                             │
│    You know you're actually talking to the real server      │
│    (e.g. the real bank.com), not an impostor, because the   │
│    server presents a certificate signed by a trusted CA.    │
└─────────────────────────────────────────────────────────────┘
```

What TLS does **NOT** provide:
- It doesn't protect data once it's decrypted at either endpoint (server-side logs, XSS on the client, etc.).
- It doesn't guarantee the server itself is trustworthy or bug-free — only that you're talking to the entity that holds the certificate's private key.
- It doesn't hide *that* a connection happened, or metadata like the destination IP/domain (SNI can leak the hostname unless encrypted with ECH).

---

## 6. Where TLS Sits in the Stack

```
┌───────────────────────────┐
│   Application (HTTP)      │  ← your API calls, GET/POST
├───────────────────────────┤
│   TLS                     │  ← encryption, integrity, auth happens HERE
├───────────────────────────┤
│   TCP                     │  ← reliable byte stream
├───────────────────────────┤
│   IP                      │  ← routing
└───────────────────────────┘

HTTPS = HTTP running inside a TLS-encrypted TCP connection
```

TLS doesn't care what's inside it — HTTP, SMTP, gRPC, and countless other protocols can all be wrapped in TLS.

---

## 7. Hands-On Exercises

**Exercise 1:** Run `openssl s_client -connect google.com:443 -tls1_2` then separately with `-tls1_3`. Both should succeed. Now try `openssl s_client -connect google.com:443 -ssl3` — it should fail, proving SSL 3.0 is disabled.

**Exercise 2:** Run `curl -v https://example.com 2>&1 | grep -i "TLS"` and identify which TLS version curl negotiated with the server.

**Exercise 3:** Run `openssl ciphers -v | head -20` and look at the list of supported cipher suites on your machine. Note which ones mention "GCM" or "CHACHA20" (modern AEAD ciphers) vs older ones.

**Exercise 4:** Visit any HTTPS site in your browser, open DevTools → Security tab (Chrome) or click the padlock (Firefox/Safari), and find which TLS version and cipher suite was negotiated for that page.

**Exercise 5:** Try connecting to a site known to still support only older TLS (or set up a local test with `openssl s_server`) and observe the connection failure message when your client refuses to downgrade.

---

## 8. Interview Q&A

**Q: What is the difference between SSL and TLS?**
Answer: TLS is the successor to SSL. SSL (versions 2.0 and 3.0) was created by Netscape in the 1990s and is now fully deprecated due to known vulnerabilities (e.g., POODLE). TLS (Transport Layer Security) is the IETF standard that replaced it starting in 1999. In practice, "SSL certificate" and "SSL handshake" are legacy terms — what's actually running today is TLS, typically 1.2 or 1.3.

**Q: What are the three main security guarantees TLS provides?**
Answer: Confidentiality (data is encrypted so eavesdroppers can't read it), integrity (data can't be tampered with in transit without detection, via MACs), and authentication (the client can verify the server's identity via its certificate, and optionally vice versa with mutual TLS).

**Q: What's the main difference between TLS 1.2 and TLS 1.3?**
Answer: TLS 1.3 reduces the handshake to one round trip (down from two in TLS 1.2), removes support for weak/legacy ciphers, mandates forward secrecy via ephemeral key exchange, and encrypts more of the handshake itself. The practical benefit is lower connection latency and a smaller attack surface.

**Q: What is forward secrecy and why does it matter?**
Answer: Forward secrecy means each session uses a unique ephemeral key derived via Diffie-Hellman, not directly from the server's long-term private key. If the server's private key is later compromised, an attacker still can't decrypt previously recorded traffic, because that traffic's session key can't be reconstructed. TLS 1.3 makes this mandatory.

**Q: Does TLS protect data after it reaches the server?**
Answer: No. TLS only protects data in transit between the two TLS endpoints. Once the server decrypts the request, the data is plaintext in server memory, logs, and databases — protecting it further is the application's responsibility (e.g., encryption at rest, careful logging).

**Q: Can TLS run over UDP?**
Answer: Not classic TLS, which assumes a reliable, ordered stream (TCP). But DTLS (Datagram TLS) provides TLS-equivalent security over UDP, and QUIC (which HTTP/3 runs on) integrates TLS 1.3 directly into its own transport built on UDP.

**Q: Why do interviewers ask about TLS versions specifically?**
Answer: Because production incidents often trace back to TLS version/cipher mismatches (e.g., an old client can't connect to a server that disabled TLS 1.0/1.1), and understanding version differences signals whether a candidate has actually debugged HTTPS issues rather than just knowing "HTTPS is HTTP but secure."
