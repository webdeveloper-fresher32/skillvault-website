# Common OS Interview Scenarios — Complete Guide

## Table of Contents
1. [How to Approach Scenario Questions](#1-how-to-approach-scenario-questions)
2. [Scenario 1: The Server Is Running Out of Memory](#2-scenario-1-the-server-is-running-out-of-memory)
3. [Scenario 2: A Node App's Event Loop Is Blocked](#3-scenario-2-a-node-apps-event-loop-is-blocked)
4. [Scenario 3: Two Threads Deadlock in Production](#4-scenario-3-two-threads-deadlock-in-production)
5. [Scenario 4: CPU Is Pegged at 100% and Nobody Knows Why](#5-scenario-4-cpu-is-pegged-at-100-and-nobody-knows-why)
6. [Scenario 5: Requests Are Slow but CPU/Memory Look Fine](#6-scenario-5-requests-are-slow-but-cpumemory-look-fine)
7. [Interview Q&A](#7-interview-qa)

---

## 1. How to Approach Scenario Questions

Scenario questions test whether you can *diagnose*, not whether you can recite. Interviewers care about your process more than your final answer. A strong structure to narrate out loud:

1. **Clarify** — what does "out of memory" or "slow" actually mean here? Get numbers (memory usage %, latency, error rate).
2. **Form a hypothesis space** — list the 3-4 most likely causes before touching a single tool.
3. **Gather evidence** — name the specific command/tool you'd run and what output would confirm/deny each hypothesis.
4. **Narrow down** — explain how the evidence rules hypotheses in or out.
5. **Fix + prevent recurrence** — the immediate mitigation, then the root-cause fix, then how you'd catch it earlier next time (monitoring/alerting).

Every scenario below follows this shape.

---

## 2. Scenario 1: The Server Is Running Out of Memory

**The question:** "Your production server's memory usage keeps climbing and it eventually gets OOM-killed. How do you debug it?"

### Clarify
- Is memory climbing steadily over hours/days (suggests a leak) or spiking suddenly (suggests a large request/batch job)?
- Is it one process or system-wide? Check with `free -h` and `top`/`htop` first to separate "one runaway process" from "the whole box is just genuinely under-provisioned."

### Hypothesis space
1. **Memory leak in application code** — objects/references never released (e.g., a Node.js closure holding onto request data, an unbounded in-memory cache/array that grows forever, event listeners never removed).
2. **Unbounded queue/buffer** — a producer outpacing a consumer, backlog held entirely in memory.
3. **Too many concurrent connections/threads** — each holding its own buffers, no connection/concurrency cap in place.
4. **Fragmentation** — memory is technically free but scattered into pieces too small to satisfy new allocations (more common in long-running native processes; less common but still relevant to know).
5. **Genuinely undersized instance** — the workload legitimately needs more RAM than provisioned; not a bug, a capacity issue.

### Gather evidence
```bash
free -h                      # overall memory / swap usage
top -o %MEM                  # which process is consuming memory
ps aux --sort=-%mem | head   # same, sorted view
cat /proc/<pid>/status       # VmRSS (resident memory) for a specific process over time
```
For a Node.js process specifically:
```bash
node --inspect server.js     # attach Chrome DevTools, take heap snapshots
process.memoryUsage()        # log heapUsed/heapTotal/rss periodically
```
Take a heap snapshot, let the process run for a while under load, take a second snapshot, and diff them — objects whose count keeps growing between snapshots and are never garbage collected are your leak.

### Narrow down
- If RSS grows linearly with request count and never drops after GC → leak in the app (closures, caches, listeners).
- If memory spikes correlate with specific batch jobs or large payloads → not a leak, a sizing/streaming problem (e.g., loading an entire file into memory instead of streaming it).
- If `free -h` shows swap usage climbing → the machine itself is out of physical RAM, and even correct code will thrash.

### Fix and prevent recurrence
- Immediate: restart the process (buys time), scale horizontally if it's a capacity issue.
- Root cause: fix the leak (clear caches with TTL/max-size limits, remove listeners on cleanup, use `WeakMap`/`WeakRef` where appropriate, stream large payloads instead of buffering).
- Prevent recurrence: add memory alerts at 70-80% thresholds (not just at OOM), add heap snapshot capture on threshold breach, load-test with a memory profiler before shipping features that hold state.

---

## 3. Scenario 2: A Node App's Event Loop Is Blocked

**The question:** "Users report the app is unresponsive for a few seconds at a time. What's happening at the OS level, and how do you fix it?"

### Clarify
- Is it periodic (every N seconds/minutes, suggesting a scheduled job or GC pause) or triggered by specific user actions (suggesting a specific expensive endpoint)?

### What's actually happening at the OS level
Node.js runs JavaScript on a single thread, backed by libuv's event loop. The event loop is just a single OS thread doing this in a tight cycle:

```
while (true) {
  run_expired_timers();
  process_pending_I_O_callbacks();
  run_setImmediate_callbacks();
  handle_close_callbacks();
  // if nothing to do, block on epoll/kqueue waiting for I/O
}
```

If any single callback in this loop runs a long synchronous computation (a large `JSON.parse`, a synchronous regex on a huge string, a tight CPU-bound loop, `fs.readFileSync` on a big file), the OS thread executing the event loop is simply busy doing that computation — it cannot process any other timer, I/O callback, or incoming request until that function returns control. From the OS's point of view, nothing has crashed: it's one thread on one CPU core, fully utilized doing exactly what you told it to do. The "hang" is a symptom of cooperative scheduling within a single thread, not an OS-level failure.

### Hypothesis space
1. A synchronous CPU-bound operation on the hot path (JSON parsing/stringifying a large payload, regex backtracking, cryptographic hashing, image/data processing done inline).
2. A synchronous file/DB call (`readFileSync`, a misconfigured "sync" driver call) blocking on I/O instead of yielding.
3. Garbage collection pause (V8's major GC is a stop-the-world pause on the same thread — a symptom, not a cause, of memory pressure).
4. An infinite or accidentally quadratic loop.

### Gather evidence
```bash
node --prof server.js                 # V8 CPU profiler
node --prof-process isolate-*.log     # generate a readable report
```
Or in production, use `clinic.js`/`0x` flame graphs, or simply log `Date.now()` timestamps around suspected hot code paths. `perf top` at the OS level will also show a single node process pegging one core during the hang.

### Narrow down
- Flame graph shows one function consuming almost all CPU time during the stall window → that's your blocking call.
- If GC frequency/duration correlates with the stalls (visible via `--trace-gc`) → it's memory pressure causing long GC pauses, loop back to Scenario 1's leak-hunting approach.

### Fix and prevent recurrence
- Move CPU-bound work off the main thread: `worker_threads`, a separate microservice, or a queue + background worker.
- Replace sync I/O calls with their async equivalents.
- Chunk large synchronous operations (process an array in batches via `setImmediate` between chunks) if moving to a worker thread isn't feasible.
- Add event-loop-lag monitoring (e.g., measure the delay of a `setImmediate` callback) so you get alerted before users notice.

---

## 4. Scenario 3: Two Threads Deadlock in Production

**The question:** "Two threads in your service have deadlocked and it's stuck. How do you diagnose it?"

### Clarify
- Confirm it's actually a deadlock (both threads permanently blocked) versus a livelock (both threads actively running but making no progress) or just extreme slowness — the symptoms look similar from outside (requests time out) but the diagnosis differs.

### Recall the four necessary conditions (Coffman conditions)
A true deadlock requires all four simultaneously: mutual exclusion, hold-and-wait, no preemption, circular wait. Diagnosing means finding evidence of a **circular wait** specifically — that's the condition you can directly observe in a thread dump.

### Gather evidence
For a JVM-based service:
```bash
jstack <pid> > threaddump.txt
```
`jstack` output literally prints `"Found one Java-level deadlock"` with the two thread stacks and which lock each holds vs. waits for, when a classic lock-ordering deadlock exists.

For a native/C/C++ process on Linux:
```bash
gdb -p <pid>
(gdb) thread apply all bt     # backtrace of every thread — look for two threads each blocked in a lock/mutex wait, referencing the other's lock
```
For general triage regardless of language: check `top`/`htop` — the two threads will show 0% CPU (they're blocked, not spinning) while the process itself stops making progress; this is the key signal that separates deadlock (threads asleep) from an infinite loop or livelock (threads at 100% CPU, doing no useful work).

### Narrow down
- Thread A's stack shows it's blocked trying to acquire Lock 2, while already holding Lock 1.
- Thread B's stack shows it's blocked trying to acquire Lock 1, while already holding Lock 2.
- That circular hold-and-wait pattern, confirmed from two independent thread stacks, is the smoking gun for deadlock.

```
Thread A: holds Lock1 → waiting for Lock2
Thread B: holds Lock2 → waiting for Lock1
=> circular wait => deadlock
```

### Fix and prevent recurrence
- Immediate: restart the affected process/pod (deadlocks don't resolve on their own).
- Root cause: enforce a **global lock ordering** — every code path that needs both Lock1 and Lock2 must always acquire them in the same order (e.g., always Lock1 before Lock2), which breaks the circular-wait condition permanently.
- Alternative fixes: use `tryLock()` with a timeout instead of a blocking acquire, so a thread backs off and retries instead of waiting forever; or restructure the code to avoid holding two locks at once entirely.
- Prevent recurrence: add deadlock detection to health checks (a periodic thread dump analysis, or the JVM's built-in deadlock detection via JMX), and add this exact scenario to code review checklists whenever a change introduces a second lock into an existing locked code path.

---

## 5. Scenario 4: CPU Is Pegged at 100% and Nobody Knows Why

**The question:** "CPU usage on a server is pinned at 100% and throughput has cratered. Walk through your diagnosis."

### Hypothesis space
1. Legitimate high load (traffic spike) — not a bug, a capacity/scaling issue.
2. A runaway/infinite loop in application code.
3. Excessive context switching from too many threads/processes competing for too few cores.
4. A busy-wait/spin-lock being used instead of a blocking wait, burning CPU while "waiting."
5. Thrashing — the OS is spending most of its cycles on page faults/swapping rather than useful work (this is really a memory problem manifesting as CPU symptoms — see Scenario 1).

### Gather evidence
```bash
top                 # is it one process, or system-wide?
mpstat -P ALL 1     # per-core breakdown — one core pegged suggests single-threaded hot loop
vmstat 1            # check 'r' (runnable queue length) and 'si/so' (swap in/out — high values = thrashing)
perf top            # which function is burning CPU cycles, live
```

### Narrow down
- One core at 100%, others idle, single process → single-threaded CPU-bound hot path (same category as Scenario 2's blocking-call problem, but sustained rather than momentary).
- All cores near 100%, high run queue in `vmstat` → genuine load exceeding capacity, or too many runnable threads for available cores (context-switch overhead itself starts eating CPU).
- High `si/so` in `vmstat` alongside high CPU → thrashing, redirect the investigation to memory pressure.

### Fix and prevent recurrence
- Profile (`perf top`, flame graphs) to find and fix the hot function, or scale horizontally if it's genuine load.
- Replace busy-waits with proper blocking primitives (condition variables, `epoll`/event-driven I/O) so idle threads don't burn CPU.
- Add CPU-based autoscaling and per-core monitoring (not just aggregate CPU%) so single-threaded bottlenecks are visible even on multi-core boxes.

---

## 6. Scenario 5: Requests Are Slow but CPU/Memory Look Fine

**The question:** "Latency has doubled but CPU and memory dashboards look normal. What else could it be?"

This one is included because it's the scenario most likely to catch someone who only knows to check CPU/memory. The answer: I/O and concurrency limits are invisible on a CPU/memory dashboard.

### Hypothesis space
1. **Disk I/O wait** — the CPU looks idle because threads are blocked waiting on disk, not because there's no work to do. Check `iostat -x 1` for high `%util` or `await`.
2. **Network saturation / high latency to a downstream dependency** (DB, external API) — the service is fast, its dependency isn't.
3. **Exhausted connection pool** — every worker is blocked waiting for a free DB connection (a semaphore with all permits checked out), so requests queue even though no single resource is "maxed" on the dashboard.
4. **Too many open file descriptors** approaching the `ulimit`, causing new connections to fail/retry.
5. **Lock contention** — many threads serialized behind one mutex, so total CPU usage stays low (only one thread is ever actively running) even though users experience high latency.

### Gather evidence
```bash
iostat -x 1                 # disk wait time
ss -s                       # socket summary — check for many connections in a wait state
lsof -p <pid> | wc -l       # open file descriptor count vs. ulimit -n
```
Application-level: log connection pool wait time as its own metric, separate from query execution time — this single metric usually reveals pool exhaustion immediately.

### Fix and prevent recurrence
- Size connection pools and thread pools based on measured downstream latency and load-test results, not guesses.
- Add explicit metrics for "time spent waiting for a resource" (pool checkout time, lock wait time) — these are invisible in CPU/memory graphs but are usually exactly where the latency is hiding.
- Set and monitor `ulimit -n` alongside actual open file descriptor counts for high-connection-count services.

---

## 7. Interview Q&A

**Q: A production Node.js process's memory keeps climbing until it's OOM-killed. What's your first diagnostic step?**
Answer: Confirm whether the growth is linear/unbounded (a leak) versus workload-correlated spikes (a sizing problem), using `free -h`/`ps aux --sort=-%mem` over time. Then take two heap snapshots under load, separated by time, and diff them — objects whose retained count keeps growing between snapshots and are never collected point to the specific leak (unbounded caches, un-removed event listeners, closures retaining request-scoped data).

**Q: Why can a single blocking function call make an entire Node.js server unresponsive?**
Answer: Node.js runs JavaScript on one thread executing a single event loop. A long synchronous operation (large JSON parsing, a synchronous file read, a CPU-bound loop) occupies that one thread completely, so no other timer, I/O callback, or incoming request can be processed until it returns — the OS isn't failing, it's a single thread doing exactly what it was told, just serially instead of concurrently.

**Q: What's the difference between a deadlock and a livelock, and how would you tell them apart in production?**
Answer: In a deadlock, threads are blocked and asleep, permanently waiting on each other's locks — they show 0% CPU usage while stuck. In a livelock, threads are actively running (often repeatedly backing off and retrying) but still make no real progress — they show high CPU usage. Checking `top`/`htop` for CPU usage on the stuck threads is the fastest way to distinguish the two before diving into a thread dump.

**Q: How do you fix a deadlock caused by two threads acquiring the same two locks in opposite order?**
Answer: Enforce a global, consistent lock ordering across the codebase — any code path needing both locks must always acquire them in the same order — which eliminates the circular-wait condition that deadlock requires. A secondary fix is to use timed lock attempts (`tryLock` with a timeout) instead of blocking indefinitely, so a thread backs off and retries rather than waiting forever.

**Q: Latency is up but CPU and memory dashboards both look normal — what do you check next?**
Answer: CPU/memory dashboards miss I/O wait and concurrency-limit exhaustion. Check disk I/O wait (`iostat -x`), whether a downstream dependency (DB, external API) has gotten slower, and whether a connection or thread pool is fully checked out — the latter causes requests to queue invisibly since no single resource looks "maxed" on a standard dashboard. Logging pool-wait-time as its own metric, separate from execution time, is usually the fastest way to surface this.
