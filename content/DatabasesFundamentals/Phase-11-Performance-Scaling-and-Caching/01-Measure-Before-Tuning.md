# Measure Before Tuning — Complete Guide

> "A triage nurse doesn't treat whoever is complaining loudest — she takes everyone's temperature first, writes the numbers on the chart, and only then decides who gets the bed."

---

## Table of Contents

1. [The Problem: Tuning by Folklore](#1-the-problem-tuning-by-folklore)
2. [The Triage Nurse Analogy](#2-the-triage-nurse-analogy)
3. [The Mechanism: Percentiles and the Shape of Latency](#3-the-mechanism-percentiles-and-the-shape-of-latency)
4. [Diagram: Where the Mean Hides in a Latency Histogram](#4-diagram-where-the-mean-hides-in-a-latency-histogram)
5. [Code Walkthrough: Capturing a Baseline](#5-code-walkthrough-capturing-a-baseline)
6. [Comparing a Naive Benchmark to an Honest One](#6-comparing-a-naive-benchmark-to-an-honest-one)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Tuning by Folklore

A performance complaint arrives as a feeling — "the dashboard is slow" — and the usual response is a round of changes that each sounded plausible to somebody. None of them were measured before or after, so nobody can say which one helped, which one hurt, and whether anything changed at all.

### A Typical Tuning Session

```text
Ticket: "The orders dashboard feels slow."

Shipped the same afternoon:
  - added an index on orders(customer_id)
  - raised the connection pool from 20 to 200
  - put a 60-second cache in front of the endpoint, +8 GB buffer pool

Reopened two days later: "still slow." Recorded before any of
it: nothing.
  ↳ No number to compare against, so no way to tell which change
    helped, which hurt, or whether it was the database at all.
```

### What's Missing

Every one of those changes might be correct. The problem is that they were applied as a bundle, without a single recorded number, to a symptom described in adjectives. What's missing is a baseline: a small set of numbers captured before touching anything, so the same numbers afterwards mean something.

---

## 2. The Triage Nurse Analogy

In an emergency department the loudest patient is not reliably the sickest one. The nurse takes temperature, pulse and blood pressure from everyone who walks in, writes them on a chart, and treats in order of what the chart says. The chart also makes the next reading meaningful: a temperature of 38.5 only matters because 37.0 was written down an hour earlier.

### Complaints vs Charts

```text
Complaint  → "it hurts", "it's slow" — real, but not comparable,
              not rankable, impossible to re-measure later
Chart      → 38.5 C at 14:00, 37.9 C at 15:00 — taken the same way
              each time, so the second answers "did it work?"
```

### Mapping the Analogy to Database Tuning

The chart is your baseline: p95 latency of the five busiest queries, buffer cache hit rate, lock wait time, replication lag, connections in use. Take the readings first, keep them, then change exactly one thing and read again. Ranking by chart rather than by volume is what stops you optimising the query somebody complained about instead of the query that is actually consuming the machine.

---

## 3. The Mechanism: Percentiles and the Shape of Latency

Latency is the time a single operation takes. Throughput is how many operations complete per second. They are different numbers, they are measured in different units, and improving one can make the other worse.

### Latency Is Not Throughput

```text
Latency    → duration of ONE operation           (ms)
Throughput → operations completed per unit time  (queries/sec)

Batching 50 inserts into one statement:
  throughput ↑ (more rows/sec), latency ↑ (a row waits for its batch)
    ↳ "We improved performance" is meaningless until you say which
      of the two moved, and which you traded away.
```

### Percentiles and Why the Mean Lies

Sort every request duration in the window, smallest to largest. The p50 is the value halfway along, p95 is 95% of the way along, p99.9 is at the 999th thousandth. The mean is not a position in that list at all — it is a total divided by a count, and one enormous value drags it anywhere.

```text
Endpoint A: 1000 requests, every one at 100 ms
Endpoint B:  990 requests at 20 ms + 10 requests at 8020 ms

mean(A) = 100 ms   p50(A) = 100 ms   p99(A) =  100 ms
mean(B) = 100 ms   p50(B) =  20 ms   p99(B) = 8020 ms
  ↳ Identical means. B has ten users watching an eight-second
    spinner; A has none. The mean cannot tell them apart.
```

### Tail Latency and Fan-Out

The tail is what a user experiences, because a single page rarely makes a single query. If a page issues twenty independent backend calls and each has a p99 of 500 ms, the chance that *none* of the twenty lands in its own slow tail is small.

```text
P(all 20 calls are fast) = 0.99 ^ 20 ≈ 0.82
  ↳ ~18% of page loads contain at least one p99-slow call.
    A "1-in-100" query becomes a 1-in-6 page.
```

---

## 4. Diagram: Where the Mean Hides in a Latency Histogram

### One Endpoint's Latency Distribution

```text
 requests
    │        ████
    │       ██████
    │      ████████
    │     ██████████                                         ▌
    └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴──────┴──▶ ms
        10   20   30   40   50   60  ...            1200   8000
             ▲         ▲                              ▲       ▲
            p50       p90                            p99    p99.9
                       ▲
                     mean — in the empty gap between bulk and tail
```

### Reading the Diagram

Almost all traffic is in the 10-60 ms bulk, so p50 and p90 describe the common case honestly. The rare 1200 ms and 8000 ms requests are a separate population — cold cache, lock wait, a plan that fell back to a scan — and only p99 and p99.9 see them at all. The mean lands between the two groups, in a region where no actual request lives, which is precisely why it is the worst single number to report.

---

## 5. Code Walkthrough: Capturing a Baseline

A baseline is a small file, taken at a known time, under known load. Seven readings cover most database investigations.

### The Readings Worth Taking

```text
Query latency distribution → p50/p95/p99 per statement shape
Slow query log             → statements over a threshold, with counts
Buffer cache hit rate      → reads served from memory vs from disk
Lock waits                 → time blocked, and on which objects
Replication lag            → seconds/bytes a replica is behind
Connections                → in use vs configured maximum
Disk I/O saturation        → utilisation and queue depth; near-100%
                             means the disk, not the query, is the cap
```

### A Baseline Snapshot

Statement-level statistics come from a per-engine view: `pg_stat_statements` in PostgreSQL, `performance_schema.events_statements_summary_by_digest` in MySQL. The shape of the query is the same everywhere — rank by total time, not by worst single call.

```sql
-- Rank statement shapes by TOTAL time consumed, not by slowest call.
-- A 5 ms query run 200,000 times outranks a 2-second report run twice.
SELECT query_text,
       calls, total_exec_ms,
       total_exec_ms / calls AS mean_ms,
       total_exec_ms / SUM(total_exec_ms) OVER () * 100 AS pct_of_total
FROM statement_stats
ORDER BY total_exec_ms DESC
LIMIT 20;
```

```bash
# Snapshot the chart to a timestamped directory, before any change.
STAMP=$(date -u +%Y%m%dT%H%M%SZ); mkdir -p baselines/$STAMP
psql -f rank_statements.sql > baselines/$STAMP/statements.txt
iostat -x 5 12              > baselines/$STAMP/iostat.txt
# Change ONE thing, wait a comparable window, snapshot again.
```

### Amdahl's Law on the Change You Chose

Amdahl's law says the speedup available from optimising a component is capped by the fraction of total time that component accounts for. Applied to tuning: the ceiling is set before you start.

```text
Request budget, measured: 400 ms total
   query execution      40 ms   (10%)
   template rendering  120 ms   (30%)
   external HTTP call  240 ms   (60%)

query 10x faster    →  40 ms becomes 4 ms   → 364 ms → 1.10x
HTTP call 2x faster → 240 ms becomes 120 ms → 280 ms → 1.43x
  ↳ Even an infinitely fast database caps this request at 1.11x.
```

---

## 6. Comparing a Naive Benchmark to an Honest One

Most benchmarks that produce encouraging numbers produce them by accident, because the setup removed the conditions that made production slow in the first place.

### Naive Benchmark vs Honest Benchmark

| | Naive | Honest |
|---|---|---|
| Data volume | 1,000 seed rows | Production-scale row counts, so indexes and plans behave as they will |
| Concurrency | One client in a loop | Realistic concurrent clients, so lock waits and pool queueing appear |
| Cache state | Whatever was left warm from the last run | Stated explicitly — cold and warm measured separately |
| Query mix | The one statement being tuned | The real ratio of reads, writes and reports |
| Reported number | Mean of a single run | p50, p95, p99 and throughput, over repeated runs |

### Takeaway

An honest benchmark is one where you can name, in advance, the conditions under which the result would fail to hold. If the answer is "none", the benchmark is measuring the harness rather than the system. Warm-versus-cold is the single most common way encouraging numbers get manufactured: the second run of a query reads from the buffer cache that the first run filled, and reporting only the second run turns a disk-bound query into a memory-bound one on paper.

---

## 7. Common Mistakes

- **Reporting the mean and calling it "typical".** The mean is a total divided by a count, and a handful of multi-second requests move it far away from anything a user experienced. Report p50 for the common case and p95/p99 for the case that generates the complaints; if only one number can be shown, make it p95.
- **Benchmarking on a laptop-sized dataset.** With a thousand rows every plan looks fine, because a full scan of a thousand rows is fast regardless of indexing. Plan choice changes with cardinality (Phase 7), so a benchmark on toy data measures a different query plan than the one production runs.
- **Optimising the query that somebody complained about.** Rank by total time consumed, not by worst single execution: a 5 ms statement executed 200,000 times an hour costs the server far more than a 2-second report run twice a day, and only the ranking makes that visible.
- **Changing several things at once.** If an index, a pool size and a cache all shipped together, and latency improved, you have learned nothing transferable — and if one of the three made things worse, its damage is hidden inside the net improvement.

---

## 8. Hands-On Exercises

**Exercise 1:** Take a baseline snapshot of a database you have access to: rank statement shapes by total execution time, record buffer cache hit rate, current connection count and replication lag if a replica exists. Write the output to a timestamped directory and commit it. This directory is the "before" for every later exercise.

**Exercise 2:** Collect at least 1,000 timings for one endpoint or query into a plain text file, one duration per line, then compute p50, p95, p99 and the mean by sorting the file and indexing into it. Confirm by hand that p99 is the 990th value of 1,000 and that the mean does not equal any of the percentiles.

**Exercise 3:** Reproduce the two-endpoint case from Section 3: build one list of 1,000 values all equal to 100, and one of 990 twenties plus ten 8020s. Verify both means are 100 ms, then write one sentence explaining which endpoint you would rather own and why the mean cannot express it.

**Exercise 4:** Deliberately construct a dishonest benchmark, the mistake from Section 6. Run a query once on a cold cache and record the time, then run it nine more times and report only the mean of runs 2-10. Restart the database, re-run, and quantify how much of the "improvement" was purely the warm buffer cache.

**Exercise 5:** Measure the time split of one real request across database, application and any external call. Apply Amdahl's law to compute the best possible whole-request speedup if the database portion dropped to zero, then decide from that number alone whether database tuning is the right work to do next.

---

## 9. Interview Q&A

**Q: Why is average latency a poor way to describe performance?**
The average is a sum divided by a count, so it is not the experience of any particular user and a small number of very slow requests pull it far from the common case. Two endpoints can have identical 100 ms means while one serves everyone in 100 ms and the other serves most people in 20 ms and a handful in eight seconds. Percentiles fix this because each one is an actual position in the sorted list of real durations: p50 describes the typical request, p99 describes the request that generates the support ticket.

**Q: What is tail latency and why does it matter more than it looks?**
Tail latency is the slow end of the distribution — p99, p99.9 — and it matters because pages fan out into many backend calls. If a page makes twenty independent calls each with a p99 of 500 ms, the probability that all twenty avoid their tail is roughly 0.99 to the twentieth power, about 82%, so nearly one page load in six contains a slow call. A one-in-a-hundred query becomes a one-in-six user experience, which is why the tail is what users actually feel.

**Q: What would you measure on a database before changing anything?**
Query latency percentiles per statement shape, the slow query log, buffer cache hit rate, lock wait time, replication lag, connections in use against the configured maximum, and disk I/O utilisation. I would rank statements by total time consumed rather than by slowest single execution, because a fast query run hundreds of thousands of times usually costs more than a slow report run twice. All of it goes into a timestamped snapshot so the same readings after a change are comparable.

**Q: What makes a benchmark meaningless?**
Toy data volume, single-threaded load, an unstated cache state, and reporting only means from a single run. Small datasets change which plan the optimiser picks, single-threaded runs hide lock contention and pool queueing entirely, and a warm cache turns a disk-bound query into a memory-bound one so the second run looks ten times better than the first. An honest benchmark states data volume, concurrency level and cache state, runs repeatedly, and reports percentiles alongside throughput.

**Q: How does Amdahl's law apply to database tuning?**
It caps the speedup you can get from any component at the fraction of total time that component consumes. If a 400 ms request spends 40 ms in the database, then making the database infinitely fast still leaves 360 ms, which is at best a 1.11x improvement no matter how much work goes into it. Measuring the split first is what tells you the ceiling before you spend a week under it, and it is usually the thing that redirects effort to the external call or the rendering step where the real time is going.
