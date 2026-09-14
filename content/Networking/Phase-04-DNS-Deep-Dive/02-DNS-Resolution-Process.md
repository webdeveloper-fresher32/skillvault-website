# DNS Resolution Process — Step by Step

## Table of Contents
1. [The Full Journey of a DNS Lookup](#1-the-full-journey-of-a-dns-lookup)
2. [Sequence Diagram: Cold Cache Lookup](#2-sequence-diagram-cold-cache-lookup)
3. [The Cache Layers, One by One](#3-the-cache-layers-one-by-one)
4. [Recursive vs Iterative Queries](#4-recursive-vs-iterative-queries)
5. [Warm Cache: The Common Case](#5-warm-cache-the-common-case)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Full Journey of a DNS Lookup

When you type `www.example.com` into a browser, the system doesn't go straight to the internet. It checks a series of caches first, from fastest/closest to slowest/farthest, and only reaches out to the DNS hierarchy if nothing local has the answer.

```
Fastest, most local                                    Slowest, most authoritative
─────────────────────────────────────────────────────────────────────────────────▶
Browser cache → OS cache → Recursive resolver → Root server → TLD server → Authoritative server
```

Each stage is asked "do you know the IP for this name?" If yes, the answer is returned immediately (a **cache hit**) and everything downstream is skipped. If no, the request moves to the next stage.

---

## 2. Sequence Diagram: Cold Cache Lookup

This is the worst case — nothing is cached anywhere, so the full chain has to run:

```
 Browser          OS Resolver      Recursive Resolver     Root Server     TLD Server (.com)   Authoritative NS
   │                   │                    │                  │                │                    │
   │ 1. Need IP for     │                    │                  │                │                    │
   │ www.example.com    │                    │                  │                │                    │
   │───────────────────▶│                    │                  │                │                    │
   │                   │ 2. Check OS cache  │                  │                │                    │
   │                   │    (miss)           │                  │                │                    │
   │                   │───────────────────▶│                  │                │                    │
   │                   │                    │ 3. Check resolver│                │                    │
   │                   │                    │    cache (miss)  │                │                    │
   │                   │                    │                  │                │                    │
   │                   │                    │ 4. Query root ("where's .com?")   │                    │
   │                   │                    │─────────────────▶│                │                    │
   │                   │                    │ 5. "Ask the .com  │                │                    │
   │                   │                    │◀── TLD servers"───│                │                    │
   │                   │                    │                  │                │                    │
   │                   │                    │ 6. Query .com TLD ("where's       │                    │
   │                   │                    │    example.com?")                 │                    │
   │                   │                    │───────────────────────────────────▶│                    │
   │                   │                    │ 7. "Ask example.com's              │                    │
   │                   │                    │◀── authoritative NS"───────────────│                    │
   │                   │                    │                  │                │                    │
   │                   │                    │ 8. Query authoritative NS          │                    │
   │                   │                    │    ("what's the A record?")       │                    │
   │                   │                    │────────────────────────────────────────────────────────▶│
   │                   │                    │ 9. "93.184.216.34, TTL=3600"                             │
   │                   │                    │◀──────────────────────────────────────────────────────── │
   │                   │ 10. Cache + return │                  │                │                    │
   │                   │◀───────────────────│                  │                │                    │
   │ 11. Cache + return │                    │                  │                │                    │
   │◀───────────────────│                    │                  │                │                    │
   │                   │                    │                  │                │                    │
   │ 12. Open TCP connection to 93.184.216.34                                                          │
```

That entire chain typically completes in tens to low-hundreds of milliseconds — and usually only happens once per TTL period, because every layer caches the result (step 9's `TTL=3600` tells every cache along the way how long it's allowed to keep the answer).

---

## 3. The Cache Layers, One by One

| Layer | What it caches | Typical lifetime | Notes |
|-------|----------------|-------------------|-------|
| **Browser cache** | Recent DNS lookups made by the browser | Minutes (Chrome: ~60s–1min internal cache, varies) | Fastest possible answer — no process hop at all. Check via `chrome://net-internals/#dns` |
| **OS cache (stub resolver)** | Recent lookups made by any app on the machine | Depends on TTL and OS (`systemd-resolved`, `dnsmasq`, Windows DNS Client) | Shared across all applications on the device |
| **Recursive resolver** | Lookups from potentially thousands of users (ISP or public resolver like 8.8.8.8, 1.1.1.1) | Respects the TTL set by the authoritative server | Does the actual heavy lifting — walks the hierarchy on a cache miss |
| **Root server** | Nothing about individual domains — only knows TLD delegations | N/A (root zone itself changes rarely) | Answers "who manages this TLD" |
| **TLD server** | Only NS delegation records for domains under that TLD | N/A (delegation records, cached upstream) | Answers "who is authoritative for this domain" |
| **Authoritative server** | The actual source-of-truth records (A, MX, TXT, etc.) for a zone | N/A — it defines the TTL, it doesn't need to cache | The final answer originates here |

The recursive resolver is the workhorse: it's the only party in this chain that talks to *every* other layer, and it's also where most caching value comes from since it serves many downstream clients.

---

## 4. Recursive vs Iterative Queries

This distinction is about **who does the work of walking the hierarchy** — and it's one of the most commonly confused DNS concepts in interviews.

### Recursive Query (Client → Recursive Resolver)

The client asks a single question and expects a **complete final answer** — "give me the IP, I don't care how you get it."

```
Your computer  ──"what's the IP for example.com?"──▶  Recursive Resolver
Your computer  ◀────────────"93.184.216.34"───────────  Recursive Resolver

The resolver does ALL the work of walking root → TLD → authoritative.
The client makes exactly ONE request and gets ONE final answer.
```

### Iterative Query (Recursive Resolver → Root/TLD/Authoritative)

The resolver asks a server a question, and that server responds with either the final answer OR a referral to someone who might know better — "I don't know, but ask them."

```
Recursive Resolver ──"where's example.com?"──▶  Root Server
Recursive Resolver ◀── "I don't know, ask .com TLD servers" ──  Root Server

Recursive Resolver ──"where's example.com?"──▶  .com TLD Server
Recursive Resolver ◀── "I don't know, ask ns1.example.com" ──  .com TLD Server

Recursive Resolver ──"where's example.com?"──▶  Authoritative NS
Recursive Resolver ◀──────── "93.184.216.34" ────────  Authoritative NS

Each server gives a referral OR the final answer — never does the walking itself.
```

### Side-by-Side

| | Recursive Query | Iterative Query |
|---|---|---|
| Who asks | Client / stub resolver | Recursive resolver |
| Who answers | Recursive resolver | Root, TLD, or authoritative server |
| Response type | Always the final answer (or an error) | Either the final answer or a referral to another server |
| Who does the "walking" | The recursive resolver, on the client's behalf | The recursive resolver itself, by following referrals |
| Analogy | Asking a travel agent to book your entire trip | The travel agent calling each airline/hotel individually |

In short: **your device makes a recursive request**; **the recursive resolver makes iterative requests** on your behalf to root, TLD, and authoritative servers.

---

## 5. Warm Cache: The Common Case

In practice, the full cold-cache chain from Section 2 is rare. Most lookups hit a cache well before reaching the root:

```
Cold cache (first ever lookup):
  Browser(miss) → OS(miss) → Resolver(miss) → Root → TLD → Authoritative
  ~ full round trip, can be 50-200ms+

Warm cache (typical, TTL not expired):
  Browser(miss) → OS(miss) → Resolver(HIT) → done
  ~ single round trip to resolver, usually <20ms

Hot cache (very recent, same device):
  Browser(HIT) → done
  ~ 0ms, no network call at all
```

This is exactly why DNS as a whole is fast at scale despite its hierarchy having up to 4-5 hops: caching means the vast majority of lookups are answered long before reaching a root or TLD server.

---

## 6. Hands-On Exercises

**Exercise 1:** Run `dig example.com` and inspect the `ANSWER SECTION` — note the TTL value and the `Query time` reported at the bottom.

**Exercise 2:** Run the same `dig example.com` command twice in a row. Compare the `Query time` on the second run (this tells you whether your resolver had it cached).

**Exercise 3:** Run `dig +trace example.com` and count how many servers it contacts — label each response as coming from a root, TLD, or authoritative server.

**Exercise 4:** Run `dig example.com @8.8.8.8` to force your query through Google's public recursive resolver directly, bypassing your default one. Compare timing/results with `dig example.com @1.1.1.1` (Cloudflare).

**Exercise 5:** On macOS, flush your local DNS cache with `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`, then time a fresh lookup vs. a repeated one to observe caching effects firsthand.

---

## 7. Interview Q&A

**Q: Walk me through what happens, step by step, when a device looks up a domain name for the first time (cold cache).**
Answer: The browser checks its own cache (miss), then the OS checks its cache (miss), then the request goes to the configured recursive resolver, which also has no cached answer. The resolver queries a root server, which responds with a referral to the TLD server. It then queries the TLD server, which refers it to the domain's authoritative name server. Finally, it queries the authoritative server directly, which returns the actual record (e.g., an A record with an IP and a TTL). The resolver caches this answer and returns it back down through the OS and browser, which also cache it locally.

**Q: What is the difference between a recursive and an iterative DNS query?**
Answer: In a recursive query, the requester (typically a client's stub resolver) asks for a complete final answer and expects the server to do all the work of finding it. In an iterative query, the server being asked either returns the final answer or a referral pointing to another server that might know — it doesn't do the additional lookups itself. In practice, the client-to-resolver query is recursive, while the resolver-to-root/TLD/authoritative queries are iterative.

**Q: Why do we need multiple layers of caching (browser, OS, resolver) instead of just querying DNS servers every time?**
Answer: Because DNS records don't change often relative to how frequently they're looked up, caching dramatically cuts latency (skipping multiple network round trips) and reduces load on the global DNS infrastructure. Each layer serves increasingly larger populations of requests — the browser cache serves one tab, the OS cache serves one machine, and the recursive resolver's cache serves potentially thousands of users — so caching at each level compounds the efficiency gain.

**Q: What role does a recursive resolver play, and who typically operates one?**
Answer: The recursive resolver is the component that does the actual work of walking the DNS hierarchy on behalf of a client: querying root, TLD, and authoritative servers iteratively until it gets a final answer, then caching and returning it. ISPs operate recursive resolvers by default for their customers, but users can also configure public resolvers like Google's 8.8.8.8 or Cloudflare's 1.1.1.1 instead.

**Q: If a DNS record's TTL is 3600 seconds, what does that actually control in this resolution flow?**
Answer: It tells every caching layer (recursive resolver, OS, browser) how long, in seconds, they're allowed to reuse that answer before they must re-query the authoritative server. A shorter TTL means fresher data but more DNS traffic; a longer TTL means better performance/caching but slower propagation if the record changes. (Covered in depth in the caching/TTL lesson.)

**Q: In "what happens when you type google.com into a browser," where does DNS resolution fit relative to the rest of the process?**
Answer: DNS resolution is the very first network step — it must complete before the browser can do anything else, because it needs an IP address to open a TCP connection to. After DNS resolves the name to an IP, the browser proceeds to the TCP three-way handshake, then TLS negotiation (for HTTPS), then the actual HTTP request/response, and finally rendering. This full chain is walked in detail in this course's capstone phase.
