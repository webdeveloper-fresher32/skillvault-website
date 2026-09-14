# DNS Record Types — Complete Guide

## Table of Contents
1. [What a DNS Record Actually Is](#1-what-a-dns-record-actually-is)
2. [A and AAAA Records](#2-a-and-aaaa-records)
3. [CNAME Records](#3-cname-records)
4. [MX Records](#4-mx-records)
5. [TXT Records](#5-txt-records)
6. [NS and SOA Records](#6-ns-and-soa-records)
7. [A Real Zone File, End to End](#7-a-real-zone-file-end-to-end)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What a DNS Record Actually Is

Every domain's authoritative name server (Lesson 01) stores a set of **records** in a **zone file** — a plain-text database describing everything about that domain: which IP addresses it points to, which mail servers handle its email, and more. Each record follows a common shape:

```
<name>   <TTL>   <class>   <type>   <value>

Example:
www.example.com.   3600   IN   A   93.184.216.34
     │               │      │    │        │
     │               │      │    │        └── the actual value (IP, hostname, text...)
     │               │      │    └── record TYPE (what kind of data this is)
     │               │      └── class (almost always "IN" = Internet)
     │               └── TTL in seconds (how long caches may keep this answer)
     └── the name this record applies to
```

Different **record types** exist because a domain needs to answer many different questions, not just "what's your IP?" — "where does email for this domain go?", "who else is allowed to send email as this domain?", "is there another name that's just an alias for this one?" Each record type answers one specific kind of question.

---

## 2. A and AAAA Records

**A records** map a hostname to an **IPv4** address. **AAAA records** ("quad-A") do the same for an **IPv6** address. These are the most fundamental record type — the one DNS resolution ultimately terminates at for most name lookups.

```
example.com.       3600   IN   A      93.184.216.34
example.com.       3600   IN   AAAA   2606:2800:220:1:248:1893:25c8:1946
www.example.com.   3600   IN   A      93.184.216.34
```

```
┌──────────────────────────────────────────────────────┐
│  A record     → name  →  IPv4 address (32-bit)         │
│  AAAA record  → name  →  IPv6 address (128-bit)         │
│                                                          │
│  A modern client typically requests BOTH (A and AAAA)   │
│  and prefers IPv6 if available (this is "happy eyeballs")│
└──────────────────────────────────────────────────────┘
```

**When to use it:** Any time a hostname needs to point directly at a server's IP address — a website's root domain, an API server, a mail server's own hostname. This is the record type you'll create constantly when deploying a new server or load balancer with a static IP.

---

## 3. CNAME Records

A **CNAME** (Canonical Name) record makes one hostname an **alias** for another hostname, rather than pointing directly at an IP. The resolver, upon finding a CNAME, restarts its lookup using the new name.

```
blog.example.com.   3600   IN   CNAME   ghs.googlehosted.com.
shop.example.com.   3600   IN   CNAME   shops.myshopify.com.
```

```
Resolving blog.example.com:

  1. Query blog.example.com  → answer: CNAME ghs.googlehosted.com.
  2. Query ghs.googlehosted.com → answer: A 142.250.x.x
  3. Final IP: 142.250.x.x

The client transparently follows the chain — one extra lookup hop.
```

**When to use it:** Pointing a subdomain at a third-party service whose IP address might change without notice (e.g., a CDN, a SaaS platform like Shopify, GitHub Pages, or a load balancer's DNS name in AWS). Instead of hardcoding an IP that could change, you alias to *their* hostname and let them manage the underlying IP.

**Important restriction:** A CNAME cannot coexist with other records at the same name (e.g., you can't have both a CNAME and an MX record at `example.com`), and a **root/apex domain** (`example.com`, no subdomain) traditionally cannot use a CNAME at all — this is why cloud providers offer "ALIAS" or "ANAME" records as a workaround for pointing an apex domain at another hostname.

---

## 4. MX Records

An **MX** (Mail Exchange) record specifies which mail server(s) are responsible for receiving email on behalf of a domain, each with a **priority** value.

```
example.com.   3600   IN   MX   10   mail1.example.com.
example.com.   3600   IN   MX   20   mail2.example.com.
```

```
┌────────────────────────────────────────────────────────┐
│  Lower priority number = tried FIRST                     │
│                                                            │
│  Someone emails you@example.com:                          │
│    1. Sender's mail server looks up MX records for        │
│       example.com                                          │
│    2. Tries mail1.example.com (priority 10) first          │
│    3. Falls back to mail2.example.com (priority 20)        │
│       only if mail1 is unreachable                          │
└────────────────────────────────────────────────────────┘
```

**When to use it:** Any domain that sends or receives email needs MX records pointing at its mail infrastructure — whether self-hosted or a provider like Google Workspace (`aspmx.l.google.com`) or Microsoft 365. Note that the MX value is always a **hostname**, which itself must resolve via an A/AAAA record — MX records never point directly at an IP.

---

## 5. TXT Records

A **TXT** record stores arbitrary text data attached to a domain name. Originally a free-form catch-all, in practice it's now used almost entirely for machine-readable verification and email-security policies.

```
example.com.            3600   IN   TXT   "v=spf1 include:_spf.google.com ~all"
example.com.            3600   IN   TXT   "google-site-verification=abc123XYZ"
_dmarc.example.com.     3600   IN   TXT   "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"
```

| Common Use | Example | Purpose |
|---|---|---|
| **Domain verification** | `google-site-verification=...` | Proves you control the domain (e.g., before enabling Google Workspace or Search Console) |
| **SPF (Sender Policy Framework)** | `v=spf1 include:_spf.google.com ~all` | Lists which mail servers are authorized to send email *as* this domain — helps receivers reject spoofed email |
| **DMARC** | `v=DMARC1; p=quarantine; ...` (on `_dmarc.example.com`) | Tells receiving mail servers what to do with email that fails SPF/DKIM checks (reject, quarantine, or allow) |
| **DKIM public key** | `v=DKIM1; k=rsa; p=MIGfMA0...` (on `selector._domainkey.example.com`) | Publishes a public key so receivers can verify a cryptographic signature on outgoing email |

**When to use it:** Proving domain ownership to a third-party platform, or configuring anti-spoofing email security (SPF/DKIM/DMARC) — nearly every "connect your custom domain" flow on a SaaS platform asks you to add a TXT record at some point.

---

## 6. NS and SOA Records

### NS (Name Server) Records

An **NS** record delegates a zone (a domain or subdomain) to a specific set of authoritative name servers — this is the literal mechanism behind the delegation chain from Lesson 01.

```
example.com.   86400   IN   NS   ns1.dnsprovider.com.
example.com.   86400   IN   NS   ns2.dnsprovider.com.
```

**When to use it:** You rarely hand-write these yourself — they're usually configured automatically when you set your domain's name servers at your registrar (e.g., pointing GoDaddy's registration at Cloudflare's or Route 53's name servers), or when delegating a subdomain to a different DNS provider entirely.

### SOA (Start of Authority) Record

Every zone has exactly one **SOA** record — it defines administrative metadata about the zone itself, not about any individual host.

```
example.com.   3600   IN   SOA   ns1.dnsprovider.com. admin.example.com. (
                                  2024031501   ; serial number
                                  7200         ; refresh (secondary re-check interval)
                                  3600         ; retry (if refresh fails)
                                  1209600      ; expire (secondary gives up)
                                  3600 )       ; minimum/negative-cache TTL
```

| Field | Meaning |
|---|---|
| Primary name server | The main authoritative server for this zone |
| Responsible email | Zone admin's email (with `@` replaced by `.`) |
| Serial number | Incremented on every zone change — secondary servers use this to detect updates |
| Refresh / Retry / Expire | Timing controls for secondary (backup) name servers syncing from the primary |
| Minimum TTL | How long resolvers may cache a **negative** answer (e.g., "this record doesn't exist") |

**When to use it:** You almost never hand-edit an SOA record directly — your DNS provider manages it — but understanding it matters for debugging (e.g., a stale serial number means secondary name servers haven't picked up your latest change yet).

---

## 7. A Real Zone File, End to End

Putting it all together — a simplified but realistic zone file for `example.com`:

```
$TTL 3600
example.com.            IN  SOA   ns1.dnsprovider.com. admin.example.com. (
                                   2024031501 7200 3600 1209600 3600 )

example.com.            IN  NS    ns1.dnsprovider.com.
example.com.            IN  NS    ns2.dnsprovider.com.

example.com.            IN  A     93.184.216.34
example.com.            IN  AAAA  2606:2800:220:1:248:1893:25c8:1946
www.example.com.        IN  CNAME example.com.
blog.example.com.       IN  CNAME ghs.googlehosted.com.

example.com.            IN  MX    10 mail1.example.com.
example.com.            IN  MX    20 mail2.example.com.
mail1.example.com.      IN  A     93.184.216.50
mail2.example.com.      IN  A     93.184.216.51

example.com.            IN  TXT   "v=spf1 include:_spf.google.com ~all"
_dmarc.example.com.     IN  TXT   "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"
```

Reading this top to bottom: this zone is authoritative on two name servers (NS), the root domain and its mail servers have IP addresses (A/AAAA), `www` is just an alias for the root (CNAME), `blog` is aliased out to a third party, mail is routed with a primary/backup priority (MX), and SPF/DMARC (TXT) protect against email spoofing.

---

## 8. Hands-On Exercises

**Exercise 1:** Run `dig example.com A`, `dig example.com AAAA`, `dig example.com MX`, and `dig example.com TXT` against a real domain you use daily. Record the actual values returned for each.

**Exercise 2:** Run `dig example.com NS` and `dig example.com SOA` — identify the primary name server, serial number, and refresh interval from the SOA output.

**Exercise 3:** Run `dig www.google.com` and `dig www.github.com` — check whether either uses a CNAME (look for a `CNAME` line in the `ANSWER SECTION` before any `A` record appears).

**Exercise 4:** Find the SPF record for a domain you use (`dig yourdomain.com TXT`) and identify which mail providers it authorizes to send email on that domain's behalf.

**Exercise 5:** Write a zone file snippet (in the notation from Section 7) for a fictional domain `myapp.dev` that: points the root domain at IP `203.0.113.10`, aliases `www` to the root, routes mail through a single MX at priority 10, and includes an SPF TXT record authorizing `_spf.mailprovider.com`.

---

## 9. Interview Q&A

**Q: What's the difference between an A record and a CNAME record?**
Answer: An A record maps a hostname directly to an IPv4 address. A CNAME record maps a hostname to *another hostname* (an alias), which the resolver then looks up again to eventually reach an A (or AAAA) record. CNAMEs are useful when the underlying IP might change and you want to delegate control of that IP to whoever owns the target hostname (e.g., a CDN or SaaS provider) — but a CNAME can't be used at a zone's apex/root domain or coexist with other record types at the same name.

**Q: Why can't you put a CNAME record at the root/apex of a domain (e.g., example.com itself)?**
Answer: DNS specifications require other records to coexist at the zone apex — at minimum the SOA and NS records that make the zone authoritative — and a CNAME is not allowed to share a name with any other record type. Since every zone must have SOA/NS records at its apex, a CNAME can't also live there. Providers work around this with proprietary "ALIAS" or "ANAME" records that behave like a CNAME but are resolved server-side by the DNS provider, not the client.

**Q: What is an MX record and how does priority work?**
Answer: An MX record tells other mail servers which host(s) are responsible for receiving email for a domain, each tagged with a priority number. Mail senders try the lowest-numbered (highest-priority) server first and fall back to higher-numbered servers only if lower-priority ones are unreachable, providing redundancy for mail delivery.

**Q: What are TXT records commonly used for in production systems?**
Answer: TXT records hold arbitrary text but are used almost universally today for two things: domain ownership verification (e.g., proving control of a domain to Google Search Console or a SaaS platform before enabling a custom domain), and email security policies — SPF (which servers may send mail as this domain), DKIM (a public key for verifying signed email), and DMARC (what to do with email that fails those checks).

**Q: What is the purpose of the SOA record, and what does the serial number do?**
Answer: The SOA (Start of Authority) record holds administrative metadata for an entire zone — the primary name server, admin contact, and timing values used by secondary/backup name servers to know when and how often to sync from the primary. The serial number is incremented every time the zone changes; secondary servers compare it to their own cached copy to detect that a re-sync (zone transfer) is needed.

**Q: If you wanted to move your website to a new server, which record would you update, and what else would you need to consider?**
Answer: You'd update the A (and/or AAAA) record for the domain to point at the new server's IP address. Beyond just updating the record, you'd need to account for DNS caching and TTL — the change won't take effect for clients with a cached answer until their cached TTL expires, so a low TTL set in advance of the cutover minimizes how long clients see the old server (covered in depth in the next lesson).
