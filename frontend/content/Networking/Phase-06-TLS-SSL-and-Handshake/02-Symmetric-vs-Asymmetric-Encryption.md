# Symmetric vs Asymmetric Encryption — Complete Guide

## Table of Contents
1. [The Core Problem: Sharing a Secret](#1-the-core-problem-sharing-a-secret)
2. [Symmetric Encryption](#2-symmetric-encryption)
3. [Asymmetric Encryption](#3-asymmetric-encryption)
4. [Symmetric vs Asymmetric — Side by Side](#4-symmetric-vs-asymmetric--side-by-side)
5. [Why TLS Uses Both (Hybrid Encryption)](#5-why-tls-uses-both-hybrid-encryption)
6. [Hashing and MACs — The Third Ingredient](#6-hashing-and-macs--the-third-ingredient)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Core Problem: Sharing a Secret

Imagine you want to send a locked box to a friend, but you've never met to agree on a shared key.

```
Problem: You want to encrypt data so only the recipient can read it.
         But to decrypt with the SAME key, they need that key too.
         How do you give them the key without an eavesdropper stealing it?

This is the "key distribution problem" — and it's exactly why
cryptography developed two different families of algorithms.
```

---

## 2. Symmetric Encryption

**One key. Same key encrypts and decrypts.**

```
Plaintext ──[encrypt with KEY]──▶ Ciphertext ──[decrypt with SAME KEY]──▶ Plaintext

Example: AES-256

  Alice:  "Meet me at 5pm"  + secret key "k9x2..." → "8f3a9c..." (ciphertext)
  Bob:    "8f3a9c..."       + secret key "k9x2..." → "Meet me at 5pm"

Same key on both sides. If an attacker gets the key, they can decrypt everything.
```

**Common algorithms:** AES (Advanced Encryption Standard, 128/256-bit), ChaCha20.

**Strengths:**
- Very fast — designed to run efficiently even on modest CPUs.
- Small overhead — ideal for encrypting large amounts of data (a video stream, an API response body).

**Weakness:**
- Both parties must already share the same secret key. If you've never securely met, how do you exchange it in the first place? Sending the key itself over the network in plaintext defeats the purpose.

---

## 3. Asymmetric Encryption

**Two mathematically linked keys: a public key and a private key.** Data encrypted with one can only be decrypted with the other.

```
Key pair: (Public Key, Private Key) — mathematically related, but you
          cannot derive the private key from the public key (in practice).

Public key  → can be shared with anyone, even attackers. It's meant to be public.
Private key → never shared, stays secret on one machine.

Encryption direction:
  Plaintext ──[encrypt with PUBLIC key]──▶ Ciphertext
  Ciphertext ──[decrypt with PRIVATE key]──▶ Plaintext

Example: RSA / Elliptic Curve Cryptography (ECC)

  Bob publishes his public key to the world.
  Alice encrypts "Meet me at 5pm" using Bob's PUBLIC key → ciphertext.
  Alice sends ciphertext over the (insecure) internet.
  Only Bob's PRIVATE key can decrypt it — not even Alice can decrypt her own message again.
```

Asymmetric crypto also enables **digital signatures** (the reverse direction): a server signs data with its private key, and anyone can verify the signature using the public key — proving the data came from the holder of that private key without revealing it.

**Strengths:**
- Solves the key-distribution problem — the public key can be shared openly, no prior secret needed.
- Enables authentication via digital signatures (this is how certificates work — see Lesson 04).

**Weakness:**
- Computationally expensive — 100-1000x slower than symmetric encryption for the same amount of data. Using it to encrypt a large file or video stream would be painfully slow.

---

## 4. Symmetric vs Asymmetric — Side by Side

| Aspect | Symmetric | Asymmetric |
|--------|-----------|------------|
| Number of keys | 1 (shared secret) | 2 (public + private pair) |
| Speed | Very fast | 100-1000x slower |
| Key distribution problem | Yes — must securely share the key first | No — public key can be shared openly |
| Common algorithms | AES, ChaCha20 | RSA, ECC (ECDSA, ECDHE) |
| Typical use in TLS | Encrypting the actual application data | Key exchange + server authentication (signatures) |
| Key size (comparable security) | 256-bit (AES-256) | 2048-3072 bit RSA, or 256-bit ECC |
| Analogy | A single key that locks and unlocks the same padlock | A padlock (public) anyone can click shut, but only you have the key (private) to open it |

---

## 5. Why TLS Uses Both (Hybrid Encryption)

TLS is a **hybrid system** — it uses each type of encryption for what it's best at:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 — Handshake (uses ASYMMETRIC crypto)                   │
│  Goal: authenticate the server AND agree on a shared secret     │
│        without ever sending that secret in plaintext.           │
│                                                                   │
│  - Server proves its identity using its certificate's           │
│    public/private key pair (digital signature).                │
│  - Client and server use asymmetric key exchange (e.g. ECDHE)   │
│    to derive a shared symmetric session key — even an           │
│    eavesdropper watching the whole exchange cannot compute it.  │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 2 — Data transfer (uses SYMMETRIC crypto)                │
│  Goal: encrypt the actual HTTP request/response bodies fast.    │
│                                                                   │
│  - Both sides now hold the same symmetric session key           │
│    (e.g. an AES-256 key) derived during the handshake.          │
│  - All subsequent traffic is encrypted with fast symmetric      │
│    AES/ChaCha20 — no per-byte asymmetric-crypto overhead.       │
└─────────────────────────────────────────────────────────────────┘
```

**In one sentence:** *asymmetric encryption solves "how do we safely agree on a secret," and symmetric encryption solves "how do we encrypt gigabytes of data quickly once we have that secret."* Using asymmetric crypto for every byte of a Netflix stream or large API payload would be far too slow — TLS uses it only briefly, at the start, to bootstrap trust and a shared key.

---

## 6. Hashing and MACs — The Third Ingredient

TLS also relies on cryptographic **hash functions** (like SHA-256) which aren't encryption at all — they're one-way functions that turn data into a fixed-size fingerprint, used for integrity checks (detecting tampering) and as building blocks inside HMACs and digital signatures. You'll see these referenced again in the handshake in Lesson 03 (the "Finished" message uses a hash of the entire handshake transcript).

---

## 7. Hands-On Exercises

**Exercise 1:** Generate an RSA key pair locally: `openssl genrsa -out private.pem 2048` then extract the public key with `openssl rsa -in private.pem -pubout -out public.pem`. Open both files — note the public key is much shorter.

**Exercise 2:** Encrypt a small message with the public key and decrypt it with the private key: `echo "hello tls" > msg.txt && openssl pkeyutl -encrypt -pubin -inkey public.pem -in msg.txt -out enc.bin && openssl pkeyutl -decrypt -inkey private.pem -in enc.bin`.

**Exercise 3:** Time the difference: encrypt a 10MB file with AES (`openssl enc -aes-256-cbc -in bigfile -out enc.aes -pass pass:test`) versus attempting the same with RSA public-key encryption directly (it will fail or be impractical for anything beyond a tiny payload) — this demonstrates why RSA/asymmetric crypto isn't used for bulk data.

**Exercise 4:** Run `openssl speed aes-256-cbc rsa2048` and compare the reported operations-per-second for symmetric AES vs asymmetric RSA — the gap illustrates the performance difference directly.

**Exercise 5:** Inspect a real TLS connection's negotiated cipher suite with `openssl s_client -connect example.com:443 < /dev/null 2>/dev/null | grep -i "Cipher"` and identify which part is the key-exchange algorithm (e.g. ECDHE) and which part is the symmetric cipher (e.g. AES_256_GCM).

---

## 8. Interview Q&A

**Q: What's the difference between symmetric and asymmetric encryption?**
Answer: Symmetric encryption uses one shared key for both encryption and decryption — it's fast but requires both parties to already possess the same secret key. Asymmetric encryption uses a mathematically linked key pair (public + private) — data encrypted with the public key can only be decrypted with the private key. It solves the key-distribution problem but is far slower computationally.

**Q: Why doesn't TLS just use asymmetric encryption for everything, since it's more secure?**
Answer: It's not that asymmetric is "more secure" — it solves a different problem (key exchange and authentication). It's also 100-1000x slower than symmetric encryption. Encrypting an entire HTTP response or video stream with RSA/ECC would be impractically slow. TLS uses asymmetric crypto briefly during the handshake to safely establish a shared secret, then switches to fast symmetric encryption (AES/ChaCha20) for all the actual data.

**Q: What is a public/private key pair, and can you derive one from the other?**
Answer: It's a mathematically related pair of keys where data encrypted with one can only be decrypted with the other. The public key is meant to be shared openly; the private key must stay secret. In practice, deriving the private key from the public key is computationally infeasible with current technology (this hardness is what the security relies on — e.g., factoring large primes for RSA, or the discrete log problem for ECC).

**Q: Give an example of an asymmetric and a symmetric algorithm.**
Answer: Asymmetric: RSA and ECC (elliptic curve cryptography), commonly used as ECDHE for key exchange and ECDSA/RSA for signatures. Symmetric: AES (typically AES-128 or AES-256 in GCM mode) and ChaCha20, both used for encrypting the actual TLS record data.

**Q: What is a digital signature and how does it use asymmetric crypto?**
Answer: A digital signature is created by hashing a piece of data and encrypting that hash with the signer's private key. Anyone with the corresponding public key can decrypt the signature and compare it to their own hash of the data — if they match, it proves the data hasn't been altered and was signed by whoever holds the private key. This is how certificate authorities sign certificates and how TLS servers prove ownership of their certificate.

**Q: What does ECDHE stand for and what role does it play in TLS?**
Answer: Elliptic Curve Diffie-Hellman Ephemeral. It's a key-exchange algorithm (asymmetric-family math) that lets client and server derive the same shared symmetric secret over an insecure channel without ever transmitting the secret itself — and "ephemeral" means a fresh key pair is generated per session, which is what provides forward secrecy.

**Q: If someone intercepts all the TLS handshake traffic, can they compute the symmetric session key?**
Answer: No, if ephemeral Diffie-Hellman (ECDHE) is used, because the shared secret is derived from each side's private ephemeral value combined with the other's public ephemeral value — an eavesdropper only sees the public values, and solving for the private ones is computationally infeasible. This is what forward secrecy protects.
