# The TLS Handshake Step-by-Step — Complete Guide

## Table of Contents
1. [What is a Handshake?](#1-what-is-a-handshake)
2. [The TLS 1.2 Handshake (The Classic Flow)](#2-the-tls-12-handshake-the-classic-flow)
3. [TLS 1.3: The 1-RTT Optimization](#3-tls-13-the-1-rtt-optimization)
4. [0-RTT (Resumption)](#4-0-rtt-resumption)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. What is a Handshake?

Before any encrypted HTTP data can be sent, the client and server must agree on how to encrypt it. The **TLS Handshake** is the negotiation process where they agree on the encryption rules and securely exchange the necessary keys.

This handshake happens *after* the TCP 3-way handshake is complete.

```
TCP 3-Way Handshake  →  TLS Handshake  →  Encrypted HTTP Data
   (SYN/SYN-ACK/ACK)     (this lesson)      (application layer)
```

---

## 2. The TLS 1.2 Handshake (The Classic Flow)

TLS 1.2 requires **2 Round Trips (RTT)** before the first byte of application data (HTTP) can be sent.

Here is the step-by-step sequence of messages exchanged:

```
Client                                              Server
  │──── 1. ClientHello ─────────────────────────────▶│   RTT 1
  │◀─── 2. ServerHello ────────────────────────────── │
  │◀─── 3. Certificate ─────────────────────────────  │
  │◀─── 4. ServerKeyExchange / ServerHelloDone ─────  │   RTT 2
  │──── 5. ClientKeyExchange ────────────────────────▶│
  │──── 6. ChangeCipherSpec / Finished ──────────────▶│
  │◀─── 7. ChangeCipherSpec / Finished ─────────────  │
  │═══════════ Encrypted Application Data ═══════════│
```

### Round Trip 1: Negotiation

1. **ClientHello (Client → Server)**
   The client initiates the handshake. It says:
   *"Hi, I want to connect securely. I support TLS 1.2. Here is a list of cipher suites (encryption algorithms) I know how to use. Also, here is a random string of bytes (Client Random)."*

2. **ServerHello (Server → Client)**
   The server responds. It says:
   *"Hello. I've chosen this specific cipher suite from your list. Here is my own random string of bytes (Server Random)."*

### Round Trip 2: Authentication and Key Exchange

3. **Certificate (Server → Client)**
   The server immediately follows up with its digital certificate. It says:
   *"Here is my ID card proving I am `example.com`. It contains my Public Key."*

4. **ServerKeyExchange / ServerHelloDone (Server → Client)**
   The server sends any additional mathematical parameters needed for the key exchange (e.g., Diffie-Hellman parameters), and signals that its part of the negotiation is done.

5. **ClientKeyExchange (Client → Server)**
   The client verifies the server's certificate. If it's valid, the client generates a third random string called the **Pre-Master Secret**. It encrypts this Pre-Master Secret using the server's Public Key (from the certificate) and sends it to the server.
   *Because it's encrypted with the public key, only the server's Private Key can decrypt it.*

6. **ChangeCipherSpec / Finished (Client → Server)**
   The client says: *"From now on, everything I send will be encrypted. I'm done with the handshake."*

   **The Master Secret is Born:** Both the client and the server now have the `Client Random`, the `Server Random`, and the `Pre-Master Secret`. They independently run these three values through a mathematical function to generate identical **Symmetric Session Keys** (The Master Secret).

7. **ChangeCipherSpec / Finished (Server → Client)**
   The server decrypts the Pre-Master Secret, computes the Session Keys, and replies: *"Understood. From now on, everything I send will be encrypted too. I'm done."*

### Secure Communication Begins

At this point, the handshake is complete. The client and server throw away the asymmetric keys and use the generated Symmetric Session Keys to encrypt all subsequent HTTP traffic.

---

## 3. TLS 1.3: The 1-RTT Optimization

TLS 1.2 was secure, but taking 2 full round trips *before* sending HTTP data added significant latency, especially on mobile networks or long geographic distances.

TLS 1.3 optimizes this down to **1 Round Trip (1-RTT)** by combining negotiation and key exchange into the very first step.

```
Client                                              Server
  │──── ClientHello + Key Share ────────────────────▶│   RTT 1
  │◀─── ServerHello + Certificate + Finished ───────  │
  │──── Finished ────────────────────────────────────▶│
  │═══════════ Encrypted Application Data ═══════════│
```

**How TLS 1.3 works:**
1. **ClientHello + Key Share:** The client guesses what encryption the server will want and sends its `ClientHello` *along with* the mathematical parameters (key share) needed to start generating the session keys immediately.
2. **ServerHello + Certificate + Finished:** The server accepts the parameters, sends its certificate, and provides its half of the key share.
3. **Application Data:** The client verifies the certificate, computes the final keys, and immediately sends the first encrypted HTTP request.

By making an educated guess in step 1, TLS 1.3 cuts the handshake time in half.

---

## 4. 0-RTT (Resumption)

If a client has connected to a server recently, they can agree to remember the keys from their last session.
In TLS 1.3, this enables **0-RTT Resumption**. The client can send encrypted HTTP data in its very first packet (along with the `ClientHello`), completely eliminating the handshake latency for returning visitors.

```
Client                                              Server
  │──── ClientHello + Early Data (0-RTT) ───────────▶│   0 extra RTTs
  │◀─── ServerHello + Finished + Response ──────────  │   before data
```

Note: 0-RTT data is not forward-secret and is vulnerable to replay attacks, so servers typically only allow it for idempotent requests (e.g., `GET`), not for actions like submitting a payment.

---

## 5. Hands-On Exercises

**Exercise 1:** Run `openssl s_client -connect example.com:443` and read the output. Identify the negotiated protocol version, the cipher suite chosen, and locate the server's certificate chain in the printed output.

**Exercise 2:** Compare the handshake latency of TLS 1.2 vs TLS 1.3 against the same server using `openssl s_client -tls1_2 -connect example.com:443` and `openssl s_client -tls1_3 -connect example.com:443`, timing each with the `time` command.

**Exercise 3:** Capture a TLS handshake in Wireshark (filter: `tls.handshake`) while visiting a site in your browser. Identify the `Client Hello`, `Server Hello`, `Certificate`, and `Finished` messages in the packet list.

**Exercise 4:** Check whether a server you control (or a public one) supports TLS 1.3 0-RTT by inspecting `openssl s_client -connect host:443 -tls1_3 -sess_out session.pem` followed by a resumed connection using `-sess_in session.pem -early_data <file>`.

**Exercise 5:** Use SSL Labs (`ssllabs.com/ssltest`) on a domain of your choice and identify which TLS versions and cipher suites it advertises, and whether Forward Secrecy is supported.

---

## 6. Interview Q&A

**Q: Walk me through what happens after the TCP handshake when connecting to an HTTPS site.**
Answer: Start by outlining the ClientHello (proposing ciphers), ServerHello (choosing a cipher and sending the certificate). Emphasize that the client verifies the certificate, extracts the public key, and uses it to securely transmit a secret (or key exchange parameters). Both sides use this secret to generate identical symmetric keys. Finally, they switch to using those symmetric keys for the actual HTTP traffic.

**Q: Why do we generate a Symmetric Session Key? Why not just encrypt all HTTP traffic using the server's Public/Private keys?**
Answer: Asymmetric encryption (RSA) is computationally very expensive and slow. Symmetric encryption (AES) is extremely fast. The TLS handshake uses the slow asymmetric encryption solely to safely transmit a shared secret. Once that secret is shared, they use it to generate symmetric keys for fast, bulk encryption of the actual data.

**Q: What is Forward Secrecy?**
Answer: Historically, if an attacker recorded years of encrypted traffic and eventually stole the server's private key, they could decrypt the Pre-Master Secret and read all past traffic. **Perfect Forward Secrecy (PFS)** uses ephemeral key exchange algorithms (like Diffie-Hellman). New, unique session keys are generated for every single session, and they are never transmitted over the wire. Even if the server's long-term private key is compromised, past traffic cannot be decrypted. TLS 1.3 mandates Forward Secrecy by removing support for older, non-PFS cipher suites.

**Q: How does TLS 1.3 manage to complete the handshake in 1-RTT instead of 2?**
Answer: In TLS 1.2, the client waits to see which cipher suite and key exchange parameters the server picks before it can compute its half of the key exchange, requiring a second round trip. TLS 1.3 collapses this by having the client optimistically send its key share alongside the ClientHello, guessing the key exchange group the server will support (almost always correct in practice). The server can then immediately respond with its own key share, certificate, and Finished message in a single reply, letting the client send encrypted application data after just one round trip.

**Q: What are the security trade-offs of using 0-RTT resumption?**
Answer: 0-RTT lets a returning client send encrypted application data in its very first packet, using resumed keys from a prior session — eliminating handshake latency entirely. The trade-off is that this early data lacks forward secrecy for that specific payload and, more importantly, is vulnerable to replay attacks: an attacker who captures the first packet can resend it and the server may process it again. Because of this, servers typically restrict 0-RTT to idempotent operations like GET requests and avoid using it for state-changing actions like payments or account changes.

**Q: What is the difference between the Pre-Master Secret and the Master Secret in TLS 1.2?**
Answer: The Pre-Master Secret is a random value generated by the client and securely transmitted to the server (encrypted with the server's public key, or derived via Diffie-Hellman). The Master Secret is derived by both sides independently by combining the Pre-Master Secret with the Client Random and Server Random values exchanged earlier in the handshake, through a pseudorandom function. The Master Secret — not the Pre-Master Secret directly — is what's actually used to derive the symmetric session keys used for encrypting application data.
