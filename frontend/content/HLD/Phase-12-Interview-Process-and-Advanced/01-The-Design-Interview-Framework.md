# The Design Interview Framework

Hand two candidates the exact same prompt — "design a notification service" — and give them the same 45 minutes. One spends the first 90 seconds silently drawing boxes, gets three different data models scratched out and abandoned, and runs out of time mid-sentence on the database schema. The other spends two minutes asking questions, two minutes doing arithmetic out loud, draws one architecture diagram they never fully redo, spends the bulk of the time on the two hardest sub-problems, and closes with "here's what breaks at 10x and how I'd monitor it." Both candidates know the same material. Only one of them passes.

The difference is a **framework** — a fixed sequence you run every time, regardless of the prompt, so you never have to decide *what to do next* while the clock is running. You've already learned every piece of content this framework organizes; this lesson is about the sequencing.

## The six steps

```
1. Clarify requirements + scale        (~10-15% of the time)
2. Back-of-envelope estimation          (~5-10%)
3. Propose high-level architecture       (~20-25%)
4. Deep-dive 1-2 components              (~35-40%)
5. Discuss trade-offs / 10x bottlenecks  (~10-15%)
6. Mention monitoring/failure handling   (remaining time, if any)
```

For a 45-minute slot, that's roughly: 5-6 min clarify, 3-4 min estimate, 10 min architecture, 16-18 min deep dive, 5-6 min trade-offs, and whatever's left (often 2-3 min) for monitoring. These aren't rigid stopwatch boundaries — they're a budget so you notice if you've spent 20 minutes on step 1 and panic-adjust instead of finding out at minute 40 that you never got to a deep dive.

## Step 1 — Clarify requirements and scale

*(Maps to: Phase 01, Lessons 01-02 — you're establishing the request lifecycle and actors before anything else.)*

Every "design X" prompt is deliberately underspecified. "Design a notification service" could mean push notifications only, or push + email + SMS; for 10,000 users or 500 million; with strict delivery guarantees or best-effort. Don't guess — ask.

Split your questions into **functional** and **non-functional**:

```
Functional (what does it do?)
  - Which channels? (push, email, SMS, in-app)
  - Who triggers a notification — another service, a scheduled job, a user action?
  - Do users have preferences (opt out of a channel, quiet hours)?

Non-functional (how well does it need to do it?)
  - Scale: how many notifications per day? Peak vs average?
  - Latency: does "real-time" matter here, or is a few seconds fine?
  - Consistency/availability: is it okay to occasionally double-send, or
    occasionally miss one, in exchange for higher availability?
  - Durability: if the service crashes mid-send, can we lose that
    notification, or must it eventually be delivered?
```

If the interviewer says "assume whatever's reasonable," state your assumption out loud and move on — don't stall waiting for permission. "I'll assume push + email, 50 million users, best-effort delivery with a retry, and that a few seconds of delay is acceptable" is a complete, defensible scoping statement in one sentence.

## Step 2 — Back-of-envelope estimation

*(Maps to: Phase 01, Lesson 03 — the estimation method taught there is exactly what you run here.)*

Turn the scale you just established into numbers: requests/sec, storage/year, bandwidth. Show the arithmetic, not just a final number — interviewers are watching *how* you estimate, not whether you memorized the right constant.

```
50M users, average 3 notifications/day
  = 150M notifications/day
  = 150,000,000 / 86,400 ≈ 1,740 notifications/sec average
  = peak (assume 5x average at a launch/sale event) ≈ 8,700/sec peak

Each notification record ≈ 0.5 KB (user_id, channel, payload, status, timestamps)
  150M/day × 0.5 KB ≈ 75 GB/day ≈ ~27 TB/year if every notification is retained
```

That last number is itself a design signal — 27 TB/year of what's mostly write-once, rarely-read audit data is a strong hint you don't want it sitting in your primary transactional database forever (tie forward to a retention policy or cold storage, if you have time later).

## Step 3 — Propose a high-level architecture

*(Maps to: Phases 02-09 — monolith/microservices boundaries, load balancer, database choice, cache, queue, gateway/auth all get assembled here.)*

Draw the boxes. State the pieces by name — not "a service," but "an API Gateway in front of a Notification Service, backed by Postgres for user preferences and a queue for fan-out" — and say **why** each piece is there, in one clause each.

```
Client → API Gateway → Notification Service → Queue → Channel Workers
                              │                          (Push / Email / SMS)
                              ▼
                        Preferences DB (Postgres)
```

State your assumptions as you draw: "I'm putting this behind a queue because sending is slow and shouldn't block whatever triggered the notification (Phase 07); I'm keeping preferences in Postgres because it's small, relational, and read far more than written (Phase 05)." You are narrating decisions you already understand from earlier phases — this step is where that knowledge becomes visible to the interviewer.

## Step 4 — Deep-dive on 1-2 components

*(Maps to: Phases 10-11's "Deep dive" section format — pick the hardest 1-2 sub-problems, exactly as each case study does.)*

You cannot deep-dive everything in the time remaining, and trying to is the single most common way candidates run out of the clock. Pick based on **interviewer signal** — what they lean into, what they ask a follow-up about — and if they give no signal, pick the part that's genuinely hardest, not the part you happen to have memorized best.

For a notification service, the two hard sub-problems are usually: fan-out to multiple channels with independent failure/retry per channel, and deduplication (the same event must not fire the same notification twice if the trigger service retries). Go deep on the mechanism — a queue-per-channel design, an idempotency key derived from the triggering event, exponential backoff with a dead-letter queue after N retries — rather than staying at the box-diagram level you already covered in Step 3.

## Step 5 — Discuss trade-offs and 10x bottlenecks

*(Maps to: Phase 03 (scaling), Phase 05 (sharding/replication), Phase 09 (CAP) — this is where you show you know what breaks and why.)*

Every design has a breaking point. State 2-3 concretely, tied to a number: "at 10x scale, the single Postgres instance holding preferences is fine — it's small and read-heavy, a read replica handles it (Phase 05). The queue and channel workers are the actual bottleneck — at 87,000 notifications/sec peak we'd need to shard the queue by channel and add workers horizontally (Phase 03), and we'd need to decide whether occasional duplicate sends are acceptable under partition (Phase 09's CAP trade-off) or whether we pay the latency cost of stronger dedup guarantees."

This step is also where you handle "what if X changes" follow-ups gracefully — you're already primed to talk about specific failure points instead of being caught flat-footed.

## Step 6 — Mention monitoring and failure handling

*(Maps to: Phase 09, Lesson 01 — the monitoring/observability content.)*

If time remains, close with what you'd watch in production: delivery success rate per channel, queue depth (a backing-up queue is your earliest signal of trouble), and retry/dead-letter counts. One sentence is enough — "I'd alert on delivery success rate dropping and on queue depth growing unbounded, since those are the two symptoms that show up before users notice anything." You rarely have more than a minute or two for this in practice; that's fine — mentioning it unprompted still lands better than not mentioning it at all.

## Common failure modes

| Failure mode | What it looks like | Fix |
|---|---|---|
| **Jumping to a solution before clarifying** | Candidate starts drawing microservices for "design a notification service" without asking scale or channels | Force yourself through Step 1 even for prompts you've seen before — the *specific* scale and constraints change what "correct" looks like |
| **Skipping estimation entirely** | Goes straight from requirements to architecture | Even a rough, 60-second estimate anchors every later decision (single DB vs sharded, in-memory vs distributed cache) in a real number instead of a vibe |
| **Over-engineering the diagram** | 15 boxes and 4 databases before any deep dive | Keep Step 3 to the pieces you can name and justify in one clause each; save nuance for Step 4 |
| **No time left for a deep dive** | Candidate is still polishing the box diagram at minute 30 | Budget the time (see the step breakdown above) and self-interrupt: "I'll move on to the two hardest parts now and come back to this diagram if there's time" |
| **Refusing to commit to a trade-off** | "It depends" with no follow-through when asked to pick a consistency model | Interviewers expect you to state a default and defend it ("I'd choose availability here because a missed notification is recoverable, but I'd flag that a payment system in the same architecture would choose the opposite") |

## Interview Q&A

**Q: How should you allocate 45 minutes across these six steps?**
A: Roughly 10-15% clarifying requirements, 5-10% estimation, 20-25% high-level architecture, 35-40% on 1-2 deep dives, 10-15% on trade-offs/bottlenecks, and whatever's left on monitoring. The largest single chunk should always be the deep dive — that's what differentiates a candidate who understands the hard part of the system from one who only knows how to draw a box diagram.

**Q: What's the single most common way candidates run out of time in a system design interview?**
A: Spending too long polishing the high-level architecture diagram — redrawing boxes, second-guessing which database to use, adding components nobody asked about — and leaving too little time for a deep dive. The box diagram should be "good enough and clearly justified," not perfect; the deep dive is where the interview is actually won.

**Q: The interviewer says "assume whatever scale you think is reasonable." What should you do?**
A: State a specific, reasonable assumption out loud and move forward immediately — don't stall waiting for the interviewer to give you a number. "I'll assume 50 million daily active users and a peak-to-average ratio of about 5x" is a complete answer; silence or repeatedly asking "well, what do you think?" wastes time and signals indecision rather than caution.

**Q: How do you decide which 1-2 components to deep-dive on when the interviewer gives no explicit signal?**
A: Pick the sub-problem that's genuinely hardest for *this specific system* — the part where a naive design breaks first. For a notification service that's fan-out/dedup, not the CRUD-shaped preferences API; for a URL shortener it's short-code generation and the read-heavy cache strategy, not the redirect endpoint itself. If you're unsure, you can also ask: "There are a couple of interesting parts here — would you rather I go deep on delivery fan-out or on deduplication?"

**Q: An interviewer pushes back hard on a decision you made ("why not use Kafka instead of a task queue here?"). How should you respond?**
A: Treat it as a chance to show trade-off reasoning, not a signal you were wrong. Restate your original reasoning briefly, name the alternative's actual advantage, and say concretely when you'd switch: "A task queue fits because each notification has exactly one consumer and doesn't need replay; Kafka would make sense if multiple independent services needed to react to the same 'notification sent' event, which isn't the case here — though if we added an analytics pipeline that wanted the same event stream, that's exactly when I'd introduce it." Defending a reasonable choice with clear conditions is stronger than capitulating or being defensive.
