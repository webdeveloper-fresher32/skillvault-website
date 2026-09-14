# 02 — Security, ACLs, and When to Use Managed Redis

> A comprehensive reference covering password protection with `requirepass`, fine-grained access control with Redis ACLs, network/TLS hardening, and the tradeoffs between running Redis yourself and paying for a managed offering.

---

## Table of Contents

1. [The Problem: A Fresh Install Has No Lock on the Door](#1-the-problem-a-fresh-install-has-no-lock-on-the-door)
2. [The Analogy: A House With No Front-Door Lock](#2-the-analogy-a-house-with-no-front-door-lock)
3. [Internal Flow: Passwords, ACLs, TLS, and Network Binding](#3-internal-flow-passwords-acls-tls-and-network-binding)
4. [Self-Managed vs Managed Redis](#4-self-managed-vs-managed-redis)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. The Problem: A Fresh Install Has No Lock on the Door

A freshly installed Redis instance, out of the box, has **no password set**. If it's reachable on the network — even accidentally, because a firewall rule was misconfigured or a cloud security group was left too open — anyone who can reach it on port 6379 can run any command against it: read every key, delete every key, or in the worst documented real-world cases, use Redis's own configuration commands to write a file to disk in a location that gets the attacker code execution on the host.

This isn't a hypothetical. Internet-wide scans for unprotected Redis instances are a routine part of how opportunistic attackers operate, precisely because "no password by default" is such a common misconfiguration. The core question this lesson answers: **what do you actually need to configure before a Redis instance is safe to expose beyond `localhost` — and once it's protected, how do you decide whether to run it yourself at all?**

---

## 2. The Analogy: A House With No Front-Door Lock

**Real-world analogy:** a house with no lock on the front door is completely fine as long as it's just you, in a private room, with nobody else around. The moment that same house is reachable from a public street — the moment *anyone* passing by could just walk in — the lack of a lock stops being a quirk and becomes a real liability.

A Redis instance bound only to `localhost` on your own laptop during development is the private room — nobody else can reach it. The same instance, deployed to a server reachable from a broader network with no password and no access controls, is the house with the door wide open on a public street. Nothing about Redis itself changed; what changed is who can reach the door.

---

## 3. Internal Flow: Passwords, ACLs, TLS, and Network Binding

Redis offers several independent layers of protection, each closing a different gap:

- **`requirepass` / `AUTH`** — the most basic layer: set a single shared password in `redis.conf` (or via `CONFIG SET requirepass <password>`), after which every client must run `AUTH <password>` before running other commands. This protects against anyone without the password, but it's all-or-nothing — every client that knows the password can run every command.
- **Redis ACLs (`ACL SETUSER`)** — fine-grained, per-user permissions layered on top of (or instead of) a single shared password: which commands a user may run, and which key *patterns* they may touch, so a given application only gets exactly the access it needs.
- **TLS** — encrypts traffic between clients and Redis in transit, so a password (or the data itself) isn't sent as plain text over a network that might be observable to others.
- **Network binding** — configuring Redis to `bind` only to trusted network interfaces (e.g. a private internal network) rather than every interface, so it's never reachable from the public internet in the first place, regardless of what authentication is configured.

These layers are complementary, not alternatives — a production deployment typically uses several together: bind to a private network, require TLS, and use ACLs for per-application permissions rather than one shared password everyone knows.

```bash
redis-cli ACL SETUSER readonly-app on >somepassword ~cached:* -@all +get +mget
```

Reading this rule left to right, as Redis ACL rules are applied in sequence: `on` enables the user (a newly created user is disabled by default), `>somepassword` sets their password, `~cached:*` restricts them to keys matching the `cached:*` pattern, `-@all` first strips *all* command permissions (an explicit "start from nothing" reset), and `+get +mget` then grants back exactly the two commands this user needs. The order matters here: putting `-@all` *before* the `+get +mget` grants means the final permission set is "only `GET` and `MGET`" — if `-@all` were applied last, it would wipe out the grants that came before it.

Once created, you can inspect the result:

```bash
redis-cli ACL LIST
```

```
1) "user default on nopass sanitize-payload ~* &* +@all"
2) "user readonly-app on #<password-hash> sanitize-payload ~cached:* resetchannels -@all +get +mget"
```

And a client authenticated as that user can confirm its own identity with:

```bash
redis-cli --user readonly-app --pass somepassword ACL WHOAMI
```

```
"readonly-app"
```

That user can now run `GET cached:homepage` or `MGET cached:a cached:b` successfully, but attempting `SET cached:homepage "x"` or any command against a key outside the `cached:*` pattern is rejected with a `NOPERM` error — exactly the restricted, least-privilege access an application reading from a cache actually needs, with no ability to write, delete, or touch unrelated keys even if the application code has a bug or is compromised.

---

## 4. Self-Managed vs Managed Redis

Once you've replicated data for availability (Phase 6), sharded it for scale (Phase 7), and locked it down with ACLs and TLS, a legitimate question follows: should *you* be the one operating all of this?

Running Redis yourself means owning: patching for security vulnerabilities, monitoring (Lesson 1 of this phase), configuring and testing failover (Phase 6's Sentinel), managing resharding operations (Phase 7), and being the one paged at 3am if any of it breaks. A managed offering (such as a cloud provider's managed Redis service, or Redis's own commercial Enterprise/Cloud offerings) takes on that operational burden in exchange for a recurring cost — patching, failover, and often scaling become the vendor's problem instead of yours.

There's no universally correct answer; it's a genuine tradeoff:

- **Favor self-managed** when you have the operational expertise in-house already, need configuration control a managed service doesn't expose, or are running at a scale/cost profile where the markup on a managed service is prohibitive.
- **Favor managed** when the team is small, Redis isn't the core differentiator of the product, or the cost of an on-call engineer debugging a failed resharding operation at 3am clearly outweighs the price premium of paying someone else to have already solved that problem.

This ties directly back to the operational complexity introduced in Phase 6 (replication/Sentinel) and Phase 7 (Cluster): the more of that machinery your deployment needs, the more attractive a managed offering typically becomes, simply because there's more that can go wrong for someone to be on call for.

**Common mistakes:**
- Leaving `requirepass` unset (or ACLs unconfigured) on any Redis instance reachable from outside `localhost` — this is the single most common real-world Redis security incident, and it's entirely preventable with one configuration line.
- Granting a service account far broader ACL permissions than it actually needs "just in case it needs more later" — this defeats the purpose of least-privilege access and turns one compromised application into full access to every key in the instance.

**Interview angle:** "How would you secure a Redis instance before deploying it to production?" is a common systems-design/security-adjacent interview question. Interviewers want to hear a layered answer — `requirepass`/`AUTH` as a baseline, ACLs for per-application least privilege, TLS for data in transit, and network binding so the instance isn't reachable from untrusted networks in the first place — rather than a single silver-bullet answer, plus an awareness that unprotected Redis instances are a real, commonly-exploited class of misconfiguration, not a theoretical risk.

---

## 5. Hands-On Exercises

### Exercise 1 — Set a password and confirm AUTH is required

Against a local Redis instance, run `redis-cli CONFIG SET requirepass "testpass123"`. Try running `redis-cli GET somekey` without authenticating and observe the `NOAUTH` error. Then run `redis-cli -a testpass123 GET somekey` (or `AUTH testpass123` inside an interactive session) and confirm commands succeed.

### Exercise 2 — Create a restricted ACL user and verify its limits

Create a user restricted to a single key pattern and a small set of read-only commands, following the `ACL SETUSER` example above. Confirm with `ACL WHOAMI` that you're authenticated as that user, then attempt both an allowed command (`GET` on a matching key) and a disallowed one (`SET`, or `GET` on a non-matching key) and observe the `NOPERM` error in the second case.

### Exercise 3 — Write a security checklist

Write a short checklist (5-7 items) you'd walk through before deploying any Redis instance to a production environment reachable beyond `localhost`. Cover at minimum: authentication, per-application permissions, encryption in transit, and network reachability.

---

## 6. Interview Q&A

### Q1. Does a fresh Redis installation have a password by default?

**Answer:** No — a freshly installed Redis instance has no password set at all, meaning anyone who can reach it on the network can run any command. This is a well-known, commonly-exploited misconfiguration, which is why setting `requirepass` (or configuring ACLs) is one of the first things to do before exposing any Redis instance beyond `localhost`.

---

### Q2. What's the difference between `requirepass` and Redis ACLs?

**Answer:** `requirepass` sets a single shared password — anyone who knows it can run any command against any key. Redis ACLs (`ACL SETUSER`) go further, letting you create individual users with their own passwords, restricted to specific commands (or command categories) and specific key patterns, enabling least-privilege access per application rather than one all-or-nothing shared secret.

---

### Q3. In an `ACL SETUSER` rule, why does the order of `-@all` and `+get +mget` matter?

**Answer:** ACL rules are applied in sequence, left to right, with each rule modifying the user's current permission state. `-@all` strips all command permissions; if it comes before `+get +mget`, the final state is "only GET and MGET allowed." If `-@all` were placed after those grants instead, it would strip them right back out, leaving the user with no runnable commands at all.

---

### Q4. What does TLS add on top of `requirepass`/ACLs for Redis security?

**Answer:** `requirepass` and ACLs control *who* is allowed to run *which* commands, but by default that traffic — including the password itself — travels as plain text over the network. TLS encrypts the connection between client and server, so the password and the data being read or written can't be read by anyone observing the network traffic in between.

---

### Q5. When would you choose a managed Redis offering over running it yourself?

**Answer:** Managed Redis makes the most sense when the operational burden of patching, monitoring, and failover (Phase 6) or resharding (Phase 7) outweighs the cost premium of paying a vendor to handle it — typically for smaller teams, or when Redis isn't the core differentiator of the product. Self-managed makes more sense with in-house operational expertise, a need for configuration control a managed service doesn't expose, or a scale where the managed markup becomes cost-prohibitive.

---

> 🧠 **Memory hook:** "No `requirepass` is a house with the front door wide open — lock it, then decide whether you actually want to be the one on call for the whole house."
