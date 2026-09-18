# RPO, RTO, and Restore Testing — Complete Guide

> "Your insurance excess is how much you have already agreed to lose and the claims queue is how long you will be without a car — both numbers exist whether or not anyone read them before the crash."

---

## Table of Contents

1. [The Problem: A Backup Nobody Has Ever Restored](#1-the-problem-a-backup-nobody-has-ever-restored)
2. [The Insurance Policy Analogy](#2-the-insurance-policy-analogy)
3. [The Mechanism: RPO and RTO as Two Independent Clocks](#3-the-mechanism-rpo-and-rto-as-two-independent-clocks)
4. [Diagram: Where RPO and RTO Sit Around an Incident](#4-diagram-where-rpo-and-rto-sit-around-an-incident)
5. [Code Walkthrough: Three Businesses and Three Configurations](#5-code-walkthrough-three-businesses-and-three-configurations)
6. [Comparing a Stated RTO to a Measured One](#6-comparing-a-stated-rto-to-a-measured-one)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: A Backup Nobody Has Ever Restored

Lesson 2 produced base backups and an archived log. That is machinery, not a guarantee. A guarantee is a number someone has agreed to and someone else has measured, and the gap between the two is where most real outages get their length.

### What the Runbook Says and What Happens

```text
RUNBOOK   Nightly backups to object storage. Restore time ~30 min.
ACTUAL RESTORE, starting from the 02:14 alert on a Sunday
  02:31  find which bucket holds the backups          (+17 min)
  02:48  discover the archive credentials expired     (+17 min)
  03:20  1.2 TB download over a 400 Mbit link         (+32 min)
  04:55  restore completes, engine refuses to start   (+95 min)
           ↳ backup taken on 15.4, target host runs 14.9
  06:02  a 14.9 host provisioned and the restore rerun
         total: 3h 48m against a stated 30 minutes
```

### What's Missing

Every line above is a failure that only appears during a restore, and none of them are database bugs. What is missing is a stated tolerance — how much data may be lost, how long the service may be down — and a rehearsal that measures the real system against it, rather than a sentence in a document that has never been executed.

---

## 2. The Insurance Policy Analogy

Two numbers on a car insurance policy decide what a crash costs you, and neither is the premium. The excess is the amount you have already agreed to absorb yourself. The claims-and-repair queue is how many days you are without a car. Both were fixed the day you signed, and almost nobody looks them up until the morning of the crash.

### Excess vs Claims Queue

```text
The excess       → money you have pre-agreed to lose. A lower excess
                   costs a higher premium, every month, forever
The claims queue → days without a car. A courtesy car costs extra and
                   buys nothing except a shorter gap
The crash        → the one moment both numbers become concrete, and
                   the one moment neither can be renegotiated
```

### Mapping the Analogy to RPO and RTO

The excess is RPO: data you have pre-agreed to lose, and driving it toward zero costs more on every single transaction, forever. The claims queue is RTO: how long you are down, shortened only by paying for standby capacity you hope never to use. The crash is the incident, and like the excess, neither number can be changed once it starts.

---

## 3. The Mechanism: RPO and RTO as Two Independent Clocks

They are constantly confused because both are measured in minutes and both appear in the same sentence. They point in opposite directions from the same instant and are bought with entirely different money.

### RPO and RTO Defined Precisely

```text
RPO — Recovery Point Objective. The maximum acceptable gap between
  the last recoverable state and the failure. Measured BACKWARD.
    ↳ RPO = 5 minutes means: after any failure, we accept losing up
      to 5 minutes of committed transactions.
RTO — Recovery Time Objective. The maximum acceptable interval from
  the failure to service being usable. Measured FORWARD.
    ↳ RTO = 30 minutes means: 30 minutes after any failure, the
      application is serving traffic — on whatever data it has.
```

### What Each Number Actually Buys

```text
RPO is bought with write-path cost:
  log archive interval   60s archive → up to 60s of loss on host death
  replication mode       async → replica lag is your floor for RPO
                         sync  → RPO 0 for host loss, +1 RTT per commit
  commit durability      the fsync decision from Lesson 1, Section 7
RTO is bought with standby capacity and rehearsal:
  restore source         local disk (minutes) vs object storage (hours)
  standby topology       cold restore vs warm replica vs auto-failover
  automation             a scripted failover beats a runbook by an hour
  drill frequency        the only thing that makes the number honest
```

### Retention Offsite and Immutability

```text
Retention  keep enough history that a fault found late is still
           recoverable — silent corruption noticed on day 20 needs a
           backup older than 20 days, not just last night's
Offsite    a backup in the same account, region or rack as the
           database shares that thing's failure modes
Immutable  write-once storage with a lock period, so credentials
           stolen by ransomware cannot delete or encrypt the copies
```

---

## 4. Diagram: Where RPO and RTO Sit Around an Incident

One timeline makes the opposite directions obvious, and shows why improving one does nothing for the other.

### An Incident on a Timeline

```text
   ←────── RPO window ──────→│←────────── RTO window ──────────→
 ──●─────────●─────────●─────✖───────────●──────────●─────────→
  02:00    14:00     14:30  14:47      15:10      16:02
  base     log seg   last   PRIMARY    restore    service
  backup   archived  durable DIES      begins     restored
  RPO = 14:47 − 14:30 = 17 min of committed writes lost, because the
        log segment covering 14:30–14:47 never left the dying host
  RTO = 16:02 − 14:47 = 75 min of downtime, of which 23 min was just
        noticing and deciding
```

### Reading the Diagram

Shrinking the left window means shipping the log more often or replicating synchronously — a cost paid on every commit for years. Shrinking the right window means paying for a warm standby and automating the failover — a cost paid in idle capacity. Nothing you do on one side moves the other: a perfect RPO of zero on a system that takes six hours to restore is still a six-hour outage, and a two-minute automated failover to a replica that lags by an hour still loses an hour of orders.

---

## 5. Code Walkthrough: Three Businesses and Three Configurations

The numbers are only meaningful when derived from what an hour of loss actually costs the business, so three genuinely different businesses land in three different places.

### Three Tolerances Stated as Money

```yaml
card_payment_processor:
  lost_transaction: "unrecoverable — money already moved externally"
  hour_of_downtime: "$400,000 plus regulatory reporting"
  objectives: {rpo: 0s, rto: 60s}
retail_analytics_warehouse:
  lost_transaction: "rebuildable — source events are still in Kafka"
  hour_of_downtime: "$0 — dashboards are read the next morning"
  objectives: {rpo: 24h, rto: 8h}
multiplayer_game_leaderboard:
  lost_transaction: "annoyed players, no financial loss"
  hour_of_downtime: "$9,000 in churn and refunds"
  objectives: {rpo: 5m, rto: 15m}
```

### The Configurations Those Numbers Force

```yaml
card_payment_processor:          # RPO 0s / RTO 60s
  replication: synchronous, 3 replicas — 2 in-region, 1 cross-region
  log_archive: continuous streaming, not segment-at-a-time
  failover: automatic, health-checked, no human in the path
  cost: +2-4ms on every commit, forever, plus 3x hardware
retail_analytics_warehouse:      # RPO 24h / RTO 8h
  replication: none
  backups: nightly logical dump + weekly full physical to object storage
  failover: rebuild from source events; restore is the fallback
  cost: object storage only
multiplayer_game_leaderboard:    # RPO 5m / RTO 15m
  replication: asynchronous, one replica, lag alarm at 60s
  log_archive: every 60s to a different region
  failover: scripted promotion, one human approval
  cost: 2x hardware, no added commit latency
```

### Why Everyone Cannot Just Buy RPO Zero

```text
Synchronous replication makes every commit wait for a network round
trip plus a remote fsync — typically 2-4ms in-region.
  ↳ at 5,000 commits/sec that is real throughput, and cross-region
    sync turns 2ms into 60ms, which most OLTP workloads cannot
    absorb at all. The warehouse above would pay that on every load
    for a system whose users would not notice a full day of loss.
```

---

## 6. Comparing a Stated RTO to a Measured One

A stated RTO is an estimate written by someone who was not holding a stopwatch. A measured RTO is what a drill produced. They are rarely close, and only one of them is a commitment.

### Stated vs Measured

| | Stated RTO | Measured RTO |
|---|---|---|
| Source | An estimate in a runbook | A timed restore into a scratch environment |
| Includes detection and decision time | Almost never | Yes, if the drill starts from the alert |
| Includes finding credentials and buckets | No | Yes — often the largest single block |
| Detects version drift | No | Yes — the backup fails to start on the target host |
| Detects a corrupt or partial backup | No | Yes — the only way, short of a real incident |
| What it is worth | A hypothesis | A number fit for a contract |

### Takeaway

A backup that has never been restored is a hypothesis about a file's contents. The drill is what converts it into a fact, and it routinely finds problems no monitoring catches: expired archive credentials, a base backup silently missing a tablespace, a log segment gap from Lesson 2's retention mistake, a restore host with less disk than the database needs. Run it quarterly, from the alert to a verified row count, with a stopwatch, and record the number that comes out rather than the one in the document.

---

## 7. Common Mistakes

- **Treating a successful backup job as a verified backup.** A green job means bytes were written, not that they are restorable. Checksum verification is better, a scripted restore into a scratch environment that runs a real query is the actual test, and everything short of that is inference.
- **Setting RPO and RTO by intuition rather than from cost.** "As low as possible" is not a target; it is a blank cheque against write latency and idle hardware. The honest derivation is what one hour of downtime and one hour of lost writes cost this specific business, which is how the warehouse in Section 5 legitimately lands on a 24-hour RPO and the payment processor legitimately does not.
- **Keeping backups in the same account or region as the database.** A backup that shares a blast radius with the thing it protects — same cloud account, same region, same credentials — is protected against disk failure and nothing else. Ransomware and a compromised deploy key both delete the primary and the backups in one action, which is exactly what immutable, lock-period storage prevents.
- **Measuring restore time from the start of the restore command.** RTO starts at the failure, not when someone finally types `restore`. Detection, paging, deciding, and finding the credentials were 23 of the 75 minutes in Section 4's diagram, and they are invisible to any drill that begins after the decision has already been made.

---

## 8. Hands-On Exercises

**Exercise 1:** Write down, for a system you actually work on, what one hour of downtime and one hour of lost writes cost in money. Derive an RPO and RTO from those two numbers, then compare them against how the system is configured today and list every gap.

**Exercise 2:** Run a full restore drill against the backup from Lesson 2 into a clean container, starting the stopwatch at a simulated alert rather than at the restore command. Record every step and its duration in a table, then compare the total against your stated RTO.

**Exercise 3:** Set up asynchronous replication between two local instances and measure replication lag under a heavy write load. That lag, at its peak, is your real RPO for a primary loss — compare it with the number you assumed.

**Exercise 4:** Switch the same pair to synchronous replication and measure commit latency and throughput before and after. Quantify exactly what buying RPO zero costs per commit on your hardware.

**Exercise 5:** Reproduce the third mistake in Section 7. Take a backup, then simulate a compromised credential by deleting both the database and its backups with a single set of keys. Repeat with the backup copied to storage under a separate credential with a write-once lock period, and confirm the second copy survives.

---

## 9. Interview Q&A

**Q: What is the difference between RPO and RTO?**
They point in opposite directions from the same instant. RPO is measured backward from the failure — the maximum gap between the last recoverable state and the moment things broke, so it is the amount of committed data you have agreed in advance to lose. RTO is measured forward — how long until the service is usable again. They are also bought with different money: RPO comes out of write-path latency through synchronous replication or a tighter log archive interval, RTO comes out of standby capacity and automation.

**Q: How would you translate an RPO of five minutes into concrete configuration?**
Five minutes is the ceiling on how stale the most recent durable off-host copy may be, so the log archive interval has to be well under that — a minute is typical, leaving headroom for a slow upload. It also means an asynchronous replica is acceptable, but replica lag becomes the number that has to be alarmed on, because peak lag under load is the real RPO, not the average. Synchronous replication is not required at five minutes, and paying its per-commit round trip would be over-buying.

**Q: Why is a backup that has never been restored not really a backup?**
Because the only thing a successful backup job proves is that bytes were written. Everything that actually breaks a restore is invisible until you try one: expired archive credentials, a version mismatch between the backup and the restore host, a missing tablespace, a gap in the archived log from an over-eager retention rule, a restore host with less disk than the database. A quarterly drill that runs from the alert to a verified row count with a stopwatch is what turns the hypothesis into a number you can commit to.

**Q: A team says their RTO is 30 minutes but a real incident took four hours. Where does that gap usually come from?**
Almost always from the parts nobody timed. The stated number is an estimate of the restore command itself, while the real clock starts at the failure and includes detection, paging, deciding to fail over, locating the right backup, and finding credentials that may have rotated. Then the restore hits physical constraints nobody modelled, like downloading a terabyte over a link that makes that alone take half an hour. Drills that start from the alert rather than from the restore command are what surface all of it.

**Q: Why do backups need to be offsite and immutable if they are already replicated?**
Replication and offsite backups protect against different things. Replicas share the failure domain for anything logical — a bad `DELETE` replicates in milliseconds — and if the backups sit in the same cloud account under the same credentials, then one compromised key or one ransomware event takes the primary and every copy in a single action. Write-once storage with a lock period means the copy cannot be deleted or encrypted even by someone holding valid credentials, and a different region or account means the backup does not share a blast radius with the thing it exists to recover.
