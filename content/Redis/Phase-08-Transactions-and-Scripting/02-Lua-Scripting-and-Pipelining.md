# 02 — Lua Scripting and Pipelining

> A comprehensive reference covering server-side Lua scripting with `EVAL`/`EVALSHA` for atomic conditional logic, and pipelining as a separate, distinct optimization for reducing network round-trips.

---

## Table of Contents

1. [The Problem: Conditional Logic That MULTI/EXEC Can't Express](#1-the-problem-conditional-logic-that-multiexec-cant-express)
2. [The Analogy: A Shopping List vs Real Decision-Making Authority](#2-the-analogy-a-shopping-list-vs-real-decision-making-authority)
3. [Internal Flow: EVAL, KEYS/ARGV, and EVALSHA](#3-internal-flow-eval-keysargv-and-evalsha)
4. [Code Example: A Conditional Balance Deduction in Lua](#4-code-example-a-conditional-balance-deduction-in-lua)
5. [Internal Flow: Pipelining as a Separate Optimization](#5-internal-flow-pipelining-as-a-separate-optimization)
6. [Code Example: Pipelining with redis-py](#6-code-example-pipelining-with-redis-py)
7. [Transactions vs Lua Scripting vs Pipelining](#7-transactions-vs-lua-scripting-vs-pipelining)
8. [Common Mistakes](#8-common-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Conditional Logic That MULTI/EXEC Can't Express

`MULTI`/`EXEC` (Phase 8, lesson 1) atomically runs a batch of commands — but the batch has to be decided *in advance*, before any of it runs. You queue up commands blindly; there's no way to say "read this value, and depending on what it is, run a different command." By the time you'd want to branch on a value, `MULTI`/`EXEC` has already committed to whatever was queued.

That's a real limitation for a common class of operation: **"only decrement this balance if it has sufficient funds."** You can't safely do this as a plain `GET` followed by a conditional `DECRBY` in application code, because another client's command could run in between your `GET` and your `DECRBY` — the classic **check-then-act race condition**. You could reach for `WATCH`-based optimistic locking, but that requires a retry loop and multiple round-trips for what is conceptually a simple, single atomic decision. The core problem: **how do you run conditional, branching logic against Redis data as one atomic, uninterruptible unit, without multiple round-trips or retry loops?**

---

## 2. The Analogy: A Shopping List vs Real Decision-Making Authority

**Real-world analogy:** `MULTI`/`EXEC` is like handing someone a pre-written shopping list to execute exactly as written — "buy milk, buy eggs, buy bread" — with no room for them to adapt if something on the list turns out to be unavailable. **Lua scripting is like giving that same person actual decision-making authority**: "if we're out of milk, get oat milk instead; if the bread is stale, skip it entirely." Crucially, this decision-making still happens as one uninterrupted trip to the store — nobody else's shopping list gets mixed in with theirs while they're deciding — it's just that *what* they do is no longer fixed in advance.

That's exactly what a Lua script running inside Redis gives you: real conditional logic (`if`/`else`, reading a value and branching on it), executed entirely on the Redis server as a single atomic, uninterruptible unit — because Redis's single-threaded event loop (Phase 1) runs the whole script start-to-finish before touching any other client's command.

---

## 3. Internal Flow: EVAL, KEYS/ARGV, and EVALSHA

- **`EVAL script numkeys key [key ...] arg [arg ...]`** — sends a Lua script to Redis and runs it immediately, atomically, on the server. `numkeys` tells Redis how many of the following arguments are key names (available inside the script as the `KEYS` table, 1-indexed: `KEYS[1]`, `KEYS[2]`, ...); everything after that is a plain argument (available as the `ARGV` table: `ARGV[1]`, `ARGV[2]`, ...).
- **Why `KEYS`/`ARGV` instead of string-concatenating values into the script body** — passing key names and values as separate parameters, rather than building the Lua source string by hand with the actual key/value baked in, avoids Lua-injection-style bugs (a value containing characters that would break the script's syntax) and lets Redis Cluster (Phase 7) correctly identify which keys a script touches for routing purposes.
- **`redis.call(...)`** — inside a Lua script, this is how you invoke Redis commands (e.g. `redis.call('GET', KEYS[1])`). It raises a Lua error if the command itself errors. A sibling function, `redis.pcall(...)`, does the same but returns an error table instead of raising, letting the script handle the error itself.
- **`EVALSHA sha1 numkeys key [key ...] arg [arg ...]`** — runs a script by its SHA1 hash instead of sending the full script body again. Redis caches every script it has ever run (or that was explicitly loaded via `SCRIPT LOAD`) in a server-side script cache, keyed by that hash. This avoids re-transmitting a potentially large script's source text on every single call — you send the hash once you know it, not the whole script.
- **`SCRIPT LOAD script`** — explicitly loads a script into the cache and returns its SHA1 hash without running it, useful for "warm up the cache at application startup" so the very first real call can use `EVALSHA` immediately.

---

## 4. Code Example: A Conditional Balance Deduction in Lua

First, make sure the balance exists:

```
127.0.0.1:6379> SET balance:alice 100
OK
```

Now run a Lua script via `EVAL` that only deducts an amount if the balance is sufficient — otherwise it deducts nothing and reports failure, all as one atomic operation:

```
127.0.0.1:6379> EVAL "local current = tonumber(redis.call('GET', KEYS[1])) local amount = tonumber(ARGV[1]) if current >= amount then redis.call('DECRBY', KEYS[1], amount) return 1 else return 0 end" 1 balance:alice 30
(integer) 1
127.0.0.1:6379> GET balance:alice
"70"
```

Walking through it: `1` is `numkeys` (one key follows), `balance:alice` becomes `KEYS[1]`, and `30` becomes `ARGV[1]`. The script reads the current balance, converts both values from Lua strings to numbers with `tonumber` (Redis always passes `KEYS`/`ARGV` values into Lua as strings), compares them, and only calls `DECRBY` if there are sufficient funds — returning `1` for success or `0` for insufficient funds. Because the whole script runs as one atomic unit on the single-threaded server, there is no window where another client's command could read the balance between the check and the deduction.

Trying it again with an amount larger than the remaining balance shows the "insufficient funds" path, with no deduction happening:

```
127.0.0.1:6379> EVAL "local current = tonumber(redis.call('GET', KEYS[1])) local amount = tonumber(ARGV[1]) if current >= amount then redis.call('DECRBY', KEYS[1], amount) return 1 else return 0 end" 1 balance:alice 999
(integer) 0
127.0.0.1:6379> GET balance:alice
"70"
```

Now load that same script once and call it repeatedly by hash instead of resending the source:

```
127.0.0.1:6379> SCRIPT LOAD "local current = tonumber(redis.call('GET', KEYS[1])) local amount = tonumber(ARGV[1]) if current >= amount then redis.call('DECRBY', KEYS[1], amount) return 1 else return 0 end"
"a1b2c3d4e5f6..."
127.0.0.1:6379> EVALSHA a1b2c3d4e5f6... 1 balance:alice 20
(integer) 1
```

(The actual hash Redis returns will be a real 40-character SHA1 digest of the script text — shown abbreviated here since the exact value depends on the exact script string.) In `redis-py`, the same pattern is wrapped by `Script` objects: `decrement_script = r.register_script(lua_source)`, then calling `decrement_script(keys=["balance:alice"], args=[20])` — `redis-py` handles caching the script and automatically falls back from `EVALSHA` to `EVAL` if the server reports the script isn't cached (a `NOSCRIPT` error, which can happen after a Redis restart clears the script cache).

---

## 5. Internal Flow: Pipelining as a Separate Optimization

Pipelining solves a completely different problem from transactions and scripting: **network round-trip latency**, not atomicity. Every Redis command normally means one round-trip — the client sends a command, waits for the reply, then sends the next one. If you need to run 100 independent commands, that's 100 sequential round-trips, and each round-trip pays the full network latency cost even though Redis itself might execute each command in microseconds.

Pipelining batches multiple commands into a single network write, sent all at once without waiting for each individual reply in between, and then reads back all the replies together once they've all arrived. This has **no atomicity guarantee whatsoever** — other clients' commands can and do interleave with a pipelined batch's commands on the server, exactly as if each command had been sent one at a time. Pipelining is purely about not paying for round-trip latency N times when you don't need to wait between each of N independent commands.

---

## 6. Code Example: Pipelining with redis-py

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# transaction=False: pure pipelining, no MULTI/EXEC wrapping, no atomicity —
# just batching commands into fewer network round-trips.
pipe = r.pipeline(transaction=False)
pipe.set("page:views", 0)
pipe.incr("page:views")
pipe.incr("page:views")
pipe.incr("page:views")
pipe.get("page:views")

results = pipe.execute()
print(results)  # [True, 1, 2, 3, '3']
```

`pipe.execute()` sends all five queued commands in a single batch and returns a Python list of their results **in the same order they were queued** — `True` for the `SET`'s `OK` reply, `1`/`2`/`3` for each successive `INCR`, and the final string `'3'` for the `GET`. Note the `transaction=False` argument: by default, `redis-py`'s `pipeline()` wraps the batch in `MULTI`/`EXEC` (making it an actual transaction, as shown in lesson 1 of this phase); passing `transaction=False` gives you pure pipelining — just the network-batching benefit, with commands from other clients free to interleave with these on the server, exactly as if pipelining hadn't been used at all.

---

## 7. Transactions vs Lua Scripting vs Pipelining

| | **`MULTI`/`EXEC`** | **Lua Scripting (`EVAL`)** | **Pipelining** |
|---|---|---|---|
| **Atomicity** | Yes — batch runs with no interleaving | Yes — whole script runs with no interleaving | No — purely a network optimization |
| **Conditional/branching logic** | No — commands are queued blindly, no reading-and-deciding mid-batch | Yes — full `if`/`else` logic, can read a value and branch on it | No — just batches independent commands |
| **Reduces network round-trips** | Somewhat (one round-trip for the whole batch) | Yes (one round-trip for the whole script) | Yes — this is its entire purpose |
| **Purpose** | Atomic batch of pre-decided commands | Atomic batch with conditional logic decided server-side | Latency reduction for independent commands |

---

## 8. Common Mistakes

- **Writing a Lua script with unbounded loops or expensive operations.** Because a script runs atomically and Redis is single-threaded, a slow script blocks every other client for its entire duration — there's no way for Redis to time-slice in the middle of a running script. A script that's supposed to be a quick atomic check-and-set can turn into a multi-second outage for every other connected client if it accidentally loops over a huge dataset.
- **Confusing pipelining's latency benefit with the atomicity that only `MULTI`/`EXEC` or Lua scripting actually provide.** Pipelining looks superficially similar (multiple commands sent together) but offers zero isolation from other clients' commands — assuming a pipelined batch is "safe" from interleaving the way a transaction is, is a common and dangerous mistake.
- Forgetting that `KEYS`/`ARGV` values arrive inside Lua as strings, and skipping `tonumber(...)` before doing arithmetic on them — Lua will error or silently produce wrong results comparing a string to a number.
- Assuming `EVALSHA` always works without a fallback — if the Redis server was restarted (clearing its script cache) and a client calls `EVALSHA` for a script it never explicitly re-loaded, Redis replies with a `NOSCRIPT` error; well-behaved clients (like `redis-py`'s `register_script` wrapper) catch this and automatically resend the full script via `EVAL`.

**Interview angle:** "When would you reach for a Lua script instead of `MULTI`/`EXEC`, and when would you reach for pipelining instead of either?" is a good way for interviewers to check whether a candidate actually understands the *purpose* of each tool rather than just the command names. The clean distinction to state: `MULTI`/`EXEC` is for atomically running a fixed, pre-decided batch of commands; Lua scripting is for atomically running logic that needs to branch on data it reads *during* the batch; pipelining has no atomicity at all and exists purely to cut down round-trip latency for commands that don't depend on each other.

---

## 9. Hands-On Exercises

### Exercise 1 — Write and call a conditional Lua script

Using `redis-cli`, set `inventory:widgets` to `5`. Write an `EVAL` script that decrements `inventory:widgets` by an amount passed via `ARGV[1]`, but only if the current inventory is greater than or equal to that amount — returning `1` on success and `0` if there isn't enough stock. Test it once with a valid amount and once with an amount larger than the stock, confirming the inventory value only changes in the first case.

### Exercise 2 — Cache a script and call it by hash

Load the script from Exercise 1 with `SCRIPT LOAD`, note the SHA1 hash it returns, and call it several times using `EVALSHA` instead of `EVAL`. Then run `SCRIPT FLUSH` (which clears Redis's script cache) and try the same `EVALSHA` call again — observe the `NOSCRIPT` error, and explain in one sentence why a real application needs a fallback for this case.

### Exercise 3 — Compare timing: individual commands vs a pipeline

In Python with `redis-py`, write two versions of a loop that runs 1,000 `INCR` calls against the same key: one issuing each `INCR` as a separate call, and one batching all 1,000 into a single `pipeline(transaction=False)` before calling `.execute()` once. Time both with Python's `time` module and compare — note that the *total work* Redis does is identical in both cases, so any speed difference comes purely from round-trip count, not from Redis executing commands any faster.

---

## 10. Interview Q&A

### Q1. Why would you use a Lua script instead of `MULTI`/`EXEC`?

**Answer:** `MULTI`/`EXEC` queues commands blindly with no ability to read a value and branch on it mid-batch. A Lua script runs full conditional logic (`if`/`else`, reading a value with `redis.call` and deciding what to do next) entirely atomically on the server, which is exactly what's needed for operations like "only decrement this balance if there are sufficient funds."

---

### Q2. What are `KEYS` and `ARGV` inside a Redis Lua script, and why use them instead of building the script string with values baked in?

**Answer:** `KEYS` and `ARGV` are Lua tables that Redis populates from the arguments passed to `EVAL`/`EVALSHA` — `KEYS` holds the key names (as declared by the `numkeys` count) and `ARGV` holds any additional plain values. Passing values this way, rather than concatenating them directly into the Lua source string, avoids injection-style bugs from unexpected characters in the values and lets Redis Cluster correctly identify which keys a script touches for routing.

---

### Q3. What does `EVALSHA` do, and what happens if the script isn't cached on the server?

**Answer:** `EVALSHA` runs a previously-seen script by its SHA1 hash instead of resending the full script body, saving network bandwidth on repeated calls. If the server doesn't have that hash cached (for example, after a restart cleared the script cache), it returns a `NOSCRIPT` error; a client needs to fall back to sending the full script via `EVAL` in that case — `redis-py`'s `register_script` helper does this automatically.

---

### Q4. What's the difference between pipelining and a transaction, and can you combine them?

**Answer:** Pipelining is purely a network optimization — batching multiple commands into one round-trip with zero atomicity, meaning other clients' commands can interleave with them exactly as if they'd been sent individually. A transaction (`MULTI`/`EXEC`) guarantees no interleaving. They can be combined: `redis-py`'s `pipeline()` defaults to `transaction=True`, meaning it both batches the network round-trip *and* wraps the batch in `MULTI`/`EXEC` for atomicity, while `transaction=False` gives you pipelining's latency benefit without any atomicity.

---

### Q5. Why is it dangerous to write a Lua script with an unbounded loop?

**Answer:** Redis executes an entire Lua script as one atomic, uninterruptible unit on its single command-execution thread. If the script loops over a large or unbounded amount of data, it blocks every other client's commands for the script's entire running time — there's no way for Redis to pause a script mid-execution to service another client, so a slow script effectively causes a full outage until it finishes.

---

> 🧠 **Memory hook:** "MULTI/EXEC hands over a fixed shopping list; a Lua script hands over real decision-making authority — both still happen as one uninterrupted trip. Pipelining isn't a trip at all — it's just mailing all your requests in one envelope instead of one letter at a time; nobody promised nothing else gets processed in between."
