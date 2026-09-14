# Certificates and Certificate Authorities (CAs) — Complete Guide

## Table of Contents
1. [The Problem of Trust](#1-the-problem-of-trust)
2. [What is a Digital Certificate?](#2-what-is-a-digital-certificate)
3. [Certificate Authorities (CAs) and the Chain of Trust](#3-certificate-authorities-cas-and-the-chain-of-trust)
4. [What Happens When a Certificate Expires?](#4-what-happens-when-a-certificate-expires)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. The Problem of Trust

In the TLS handshake, the server sends its Public Key to the client. The client uses this key to encrypt the Pre-Master Secret.

But how does the client know that the Public Key actually belongs to `mybank.com`?

If an attacker intercepts the connection (a Man-in-the-Middle attack), they could easily send *their own* Public Key to the client. The client would unknowingly encrypt the secret using the attacker's key, allowing the attacker to decrypt the traffic, read the passwords, and then forward the traffic to the real bank.

```
Without identity proof:
Client ──▶ "Attacker-in-the-middle" (presents fake public key) ──▶ Real Server
              │
              └─ decrypts everything, forwards to real server, victim never knows
```

To prevent this, we need a way to mathematically prove identity. We need **Digital Certificates**.

---

## 2. What is a Digital Certificate?

A Digital Certificate is an electronic document that binds a Public Key to a specific identity (like a domain name).

You can think of it as a digital passport. When a server presents its certificate, it contains:
1. **Subject:** The domain name this certificate was issued for (e.g., `example.com`).
2. **Public Key:** The server's public key.
3. **Issuer:** The entity that verified and signed this certificate.
4. **Expiration Date:** Certificates are only valid for a limited time (usually 90 days to 1 year).
5. **Digital Signature:** A cryptographic hash of all the above data, encrypted by the Issuer's private key.

```
┌───────────────────────────────────┐
│ Digital Certificate                │
│  Subject: example.com              │
│  Public Key: 04:AB:F2:...          │
│  Issuer: Let's Encrypt             │
│  Valid: 2026-06-01 → 2026-08-30    │
│  Signature: [signed by Issuer's    │
│              private key]          │
└───────────────────────────────────┘
```

---

## 3. Certificate Authorities (CAs) and the Chain of Trust

The system only works if we trust the entity that issued the certificate. These trusted entities are called **Certificate Authorities (CAs)**.

Examples of well-known CAs include Let's Encrypt, DigiCert, GlobalSign, and Cloudflare.

### The Chain of Trust

How does your computer know to trust Let's Encrypt?

Every operating system (Windows, macOS, Linux) and some browsers (Firefox) come pre-installed with a list of **Root Certificates** belonging to the major CAs. These root certificates are implicitly trusted by your device.

```
Root CA (pre-installed, self-signed, implicitly trusted)
   │
   │ signs
   ▼
Intermediate CA (e.g., "GTS CA 1C3")
   │
   │ signs
   ▼
Leaf / Server Certificate (example.com)
```

When `example.com` wants a certificate, the flow works like this:
1. The owner of `example.com` proves to the CA (e.g., Let's Encrypt) that they control the domain (usually by placing a specific file on the server or adding a DNS record).
2. The CA takes `example.com`'s public key, adds the domain name, and creates the certificate document.
3. The CA **signs** the certificate using its own Private Key.
4. When you visit `example.com`, the server sends you its signed certificate.
5. Your browser checks the signature on the certificate using the CA's pre-installed Root Public Key.

Because only the CA's private key could have created that signature, the browser mathematically verifies that the CA issued it. If the browser trusts the CA, it trusts the certificate, and therefore trusts the server's public key.

If any part of the certificate is altered (e.g., an attacker changes the public key inside it), the signature verification will fail, and the browser will show a massive red warning page.

---

## 4. What Happens When a Certificate Expires?

Certificates are deliberately given short lifespans. If a server's private key is stolen, the attacker can impersonate the server. By forcing certificates to expire (Let's Encrypt certificates expire every 90 days), the window of opportunity for an attacker using a stolen key is minimized.

When a certificate expires, browsers will completely reject the connection with an `ERR_CERT_DATE_INVALID` error.
Because this breaks websites instantly, managing certificate renewal is a critical operational task. Modern systems automate this entirely using protocols like ACME (the protocol Let's Encrypt uses to auto-renew certs before they expire).

---

## 5. Hands-On Exercises

**Exercise 1:** Inspect the certificate chain of any website using `openssl s_client -connect google.com:443 -showcerts`. Identify the **Server Certificate** (issued to `*.google.com`), the **Intermediate Certificate** (a CA like GTS CA 1C3), and note how the chain lets your browser follow the signatures up to a pre-installed Root CA that it trusts.

**Exercise 2:** In your browser, click the padlock icon on any HTTPS site and view the certificate details. Identify the Subject, Issuer, validity dates, and Subject Alternative Names (SANs).

**Exercise 3:** Run `openssl x509 -in cert.pem -noout -text` on a downloaded or self-signed certificate file and identify each field described in Section 2 (Subject, Public Key, Issuer, Expiration, Signature).

**Exercise 4:** Generate a self-signed certificate with `openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365`, then load a local server with it in your browser and observe the "Not Secure" / untrusted warning — explain why the browser rejects it despite the certificate being technically valid.

**Exercise 5:** Look up how a Let's Encrypt ACME HTTP-01 challenge works by running `certbot certonly --standalone -d yourdomain.com` (or reading its logs/dry-run output with `--dry-run`) and identify the exact file path Certbot serves to prove domain ownership.

---

## 6. Interview Q&A

**Q: If an attacker intercepts my HTTPS request and presents their own certificate, what happens?**
Answer: The browser will check the digital signature on the attacker's certificate. Since the attacker is not a trusted Certificate Authority, they cannot sign the certificate with a trusted Root Private Key. The browser will see that the signature is invalid (or signed by an untrusted, self-signed root) and will block the connection, displaying a security warning to the user.

**Q: What is a wildcard certificate?**
Answer: A standard certificate is valid for exactly one domain (e.g., `api.example.com`). A wildcard certificate is valid for a domain and all of its first-level subdomains (e.g., `*.example.com`). This is convenient because you don't need to issue a new certificate every time you spin up a new subdomain, but it's slightly riskier because if the wildcard private key is compromised, the attacker can impersonate *any* subdomain.

**Q: How does a CA actually verify that I own a domain before giving me a certificate?**
Answer: The CA gives you a challenge. For HTTP-01 challenges, they give you a random token and ask you to serve it at `http://yourdomain.com/.well-known/acme-challenge/`. For DNS-01 challenges, they ask you to add a specific TXT record to your domain's DNS settings. The CA then makes a request to verify the token exists. If it does, they know you have administrative control over the server or the DNS, and they issue the certificate.

**Q: What is the purpose of an Intermediate Certificate — why don't CAs just sign server certificates directly with their Root key?**
Answer: The Root CA's private key is extremely sensitive — if it's ever compromised, every certificate ever issued by that CA becomes untrustworthy, and it must be pulled from every device on Earth. To limit exposure, the Root key is kept offline in cold storage and used only once to sign a small number of Intermediate certificates. Those intermediates, which are more exposed since they sign certificates day-to-day, do the actual work of signing leaf certificates. If an intermediate is ever compromised, only it needs to be revoked, not the root.

**Q: What is certificate revocation, and how does a browser know a certificate has been revoked before its expiration date?**
Answer: Revocation handles cases where a certificate needs to be invalidated early — for example, if the private key is stolen. Browsers check revocation status via a Certificate Revocation List (CRL, a downloadable list of revoked certificate serial numbers) or OCSP (Online Certificate Status Protocol, a live query to the CA asking "is this certificate still valid?"). Because both approaches have privacy and performance downsides, many modern browsers instead use OCSP Stapling, where the server itself periodically fetches a signed, timestamped OCSP response from the CA and attaches ("staples") it to the TLS handshake, so the client doesn't need to make a separate network call.

**Q: Why do modern CAs like Let's Encrypt issue certificates with such short (90-day) lifespans instead of the multi-year certificates common in the past?**
Answer: A shorter lifespan reduces the damage window if a private key is compromised or a certificate is mis-issued — an attacker with a stolen key can only abuse it until the certificate naturally expires, rather than for years. Short lifespans also force automation: because manually renewing a certificate every 90 days at scale is impractical, they push the industry toward protocols like ACME that fully automate issuance and renewal, which in turn reduces the number of outages caused by forgotten manual renewals.
