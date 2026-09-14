# Staff-Level Extensions

A mid-level system design interview usually stops at "handle 50 million users, single region, tolerate a node failing." A staff-level loop keeps going: "now a whole AWS region goes dark for six hours — what happens to your users?" or "you've been asked to plan capacity for 10x the user base you just designed for — what actually needs to change, versus what just scales by adding more of the same box?" These questions aren't testing new distributed-systems trivia — they're testing whether your mental model extends past the boundary of a single, healthy datacenter. This lesson covers the three extensions that come up most: multi-region architecture, disaster recovery, and capacity planning at real scale.

None of this needs implementation-level depth in an interview. You need the *shape* of the answer and the vocabulary to sound like you've thought about it before, not a from-scratch derivation.

## Multi-region architecture

Everything in Phases 01-11 implicitly assumed one region — one set of servers, one database, one physical location (or a small blast radius of availability zones within it). A staff-level push extends that to: "what if that entire region is unavailable?"

There are two standard shapes:

```
ACTIVE-PASSIVE                          ACTIVE-ACTIVE
                                        
Region A (active)                       Region A (active)      Region B (active)
  ┌──────────┐                            ┌──────────┐            ┌──────────┐
  │ App + DB │  ── serves all traffic      │ App + DB │◄──sync───►│ App + DB │
  └──────────┘                            └──────────┘            └──────────┘
       │ replicates                       both serve real traffic simultaneously
       ▼
Region B (passive/standby)
  ┌──────────┐
  │ App + DB │  ── idle, ready to take over
  └──────────┘
```

**Active-passive:** one region serves all live traffic; a second region has an up-to-date (or near-up-to-date) replica of the data, sitting idle, ready to be promoted if the primary region fails. Simpler to reason about — there's only ever one writer — but the standby region's compute capacity is essentially paid for and unused most of the time, and failover (promoting the standby, repointing DNS) takes real time, during which the system is down or degraded.

**Active-active:** multiple regions serve live traffic simultaneously, typically routed by geography (a European user hits the EU region, a US user hits the US region) for lower latency as a side benefit. This uses standby capacity productively, but it reintroduces the hard problem from Phase 09 — now you have multiple writers to reconcile, which means real conflict-resolution or consensus machinery, not just "replicate and hope." Active-active is usually reserved for systems that can tolerate eventual consistency across regions (a social feed) rather than systems needing strict global consistency (a bank ledger) unless significant engineering goes into cross-region consensus.

The pragmatic answer in most interviews: **start active-passive**, since most systems don't actually need the complexity of active-active, and only propose active-active when the prompt specifically demands low latency for geographically distributed users *and* the data model already tolerates eventual consistency (e.g., the case studies in Phase 10 — a social feed being a few seconds stale across regions is fine; Phase 11's Payment Gateway is not).

## Disaster recovery: RPO and RTO

"What's your disaster recovery plan?" is really two separate numbers dressed up as one question:

- **RPO (Recovery Point Objective)** — how much data can you afford to lose, measured in time. If your database replicates to a standby every 5 minutes and the primary dies right before a replication cycle, you lose up to 5 minutes of writes. That 5 minutes is your RPO.
- **RTO (Recovery Time Objective)** — how long can the system be down before it's back up. If promoting your standby region and repointing traffic takes 20 minutes end-to-end, your RTO is 20 minutes.

```
Timeline of a regional outage:

  ...normal operation...  ──X── OUTAGE ──────────────── RECOVERED
                            ▲                ▲
                       last successful    system fully
                       replication         back online

        |◄── RPO ──►|                |◄──────── RTO ─────────►|
        (data lost:            (time system was
         writes since           unavailable)
         last replication)
```

Concrete example: a Payment Gateway (Phase 11) wants an RPO close to zero — losing even seconds of committed payment writes is unacceptable — which pushes towards synchronous cross-region replication for critical writes, at a real latency cost, or accepting that failover to the standby means a manual reconciliation step against an external source of truth (the payment processor) rather than trusting the replica blindly. A Notification Service (this phase's mock interview) can tolerate a much looser RPO — losing a few minutes of queued notifications during a regional failover is an acceptable, recoverable loss, not a business-critical one.

Naming a target RPO/RTO and explaining what architecture achieves it is the concrete, staff-level way to answer "what's your DR plan" — much stronger than a vague "we'd have backups."

## Capacity planning at 10x

A mid-level candidate is usually asked to design for a stated scale. A staff-level follow-up is: "you did all that — now the company just signed a huge partnership and you need to support 10x the users in six months. Walk me through what changes." The skill being tested is distinguishing between things that scale by **adding more of the same** and things that need an actual architecture change.

```
Scales by "add more of the same"        Needs an architecture change
────────────────────────────────        ─────────────────────────────
- Stateless API servers                 - A single-writer primary database
  (just add more instances behind         nearing its write-throughput
  the load balancer)                      ceiling → needs sharding
- Cache nodes (add more, or shard        - A single message queue/broker
  the keyspace across more instances)      instance saturating → needs
- Background worker pools                  partitioning across brokers
                                          - A monolith where one specific
                                            module dominates load → extract
                                            it into its own service
```

The concrete exercise: re-run the back-of-envelope estimation from Phase 01 Lesson 03 at 10x the numbers, and check each component in your architecture against its known ceiling. A stateless API tier behind a load balancer just needs more boxes — cheap, low-risk, no design change. A single Postgres primary handling writes, on the other hand, has a real ceiling; at 10x write volume you're now having the sharding conversation from Phase 05 Lesson 03, not just provisioning a bigger instance. Naming *which* components fall into which bucket, with numbers, is what makes this answer land as staff-level rather than a generic "we'd scale it up."

## Interview Q&A

**Q: The interviewer asks "how would you make this system disaster-resilient?" — what's a strong opening move?**
A: Don't jump straight to "multi-region." First state what RPO and RTO the system actually needs — how much data loss and downtime is tolerable for this specific use case — since that determines the whole shape of the answer. A system that can tolerate a 1-hour RTO and 15-minute RPO needs far less than one requiring near-zero data loss and instant failover; naming the target first shows you're sizing the solution to the requirement rather than reaching for the most impressive-sounding architecture.

**Q: When would you actually recommend active-active over active-passive, given that active-active is more complex?**
A: When two things are both true: users are geographically distributed enough that serving them from a single region adds meaningful latency, and the data model already tolerates eventual consistency across regions (a social feed, a content catalog) rather than requiring a single global source of truth (a financial ledger, inventory with strict no-oversell guarantees). If either condition doesn't hold, active-passive is simpler and usually the right default.

**Q: How is capacity planning for 10x growth different from just re-running your original estimation with bigger numbers?**
A: The arithmetic is the same, but the goal is different — you're not just producing a bigger number, you're identifying which specific components hit a real ceiling at that number versus which ones scale by adding more identical instances. A load-balanced stateless API tier doesn't need a redesign at 10x; a single-writer database or a single message broker instance often does. The valuable part of the answer is naming which bucket each component falls into, not the multiplication itself.

**Q: What's a concrete example of an RPO/RTO trade-off you'd make differently for two different systems in this course?**
A: A Payment Gateway (Phase 11) needs an RPO close to zero, since losing even seconds of committed payment writes is unacceptable — that pushes towards synchronous cross-region replication for critical writes despite the latency cost. A Notification Service can tolerate an RPO of several minutes, since losing a handful of queued notifications during a regional failover is a recoverable, low-stakes loss — that lets it use much cheaper asynchronous replication instead.

**Q: If an interviewer asks a staff-level extension question and you're not fully sure of the answer, what should you do?**
A: Reason from the same framework you already used for the base design rather than freezing. State the relevant trade-off dimension out loud (data loss tolerance for DR, write-throughput ceiling for capacity planning), commit to a reasonable default, and explicitly flag what you'd want to confirm with the team or measure in production before finalizing it. Staff-level questions are often intentionally open-ended — showing structured reasoning under uncertainty is usually scored higher than guessing at a "correct" answer that doesn't exist.
