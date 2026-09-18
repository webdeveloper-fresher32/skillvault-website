# 01 — Transactions with MULTI/EXEC

> A comprehensive reference covering how Redis groups multiple commands into one atomic unit with `MULTI`/`EXEC`, how `WATCH` adds optimistic locking, and why Redis transactions behave very differently from a SQL transaction's rollback guarantees.

---

## Table of Contents

1. [The Problem: Commands That Must Happen Together](#1-the-problem-commands-that-must-happen-together)
2. [The Analogy: One Order, Rung Up as a Whole](#2-the-analogy-one-order-rung-up-as-a-whole)
3. [Internal Flow: MULTI, EXEC, DISCARD, and WATCH](#3-internal-flow-multi-exec-discard-and-watch)
4. [Code Example: Transferring Balance Between Two Users](#4-code-example-transferring-balance-between-two-users)
5. [Code Example: Optimistic Locking with WATCH](#5-code-example-optimistic-locking-with-watch)
6. [Redis Transactions vs SQL Transactions](#6-redis-transactions-vs-sql-transactions)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Commands That Must Happen Together

Some operations aren't really one command — they're several commands that only make sense as a single, indivisible unit. Consider moving 50 points from Alice's balance to Bob's: that's a `DECRBY` on Alice's key and an `INCRBY` on Bob's key. If another client's commands could sneak in *between* those two — reading Alice's balance after it's been debited but before Bob's has been credited, say — the system would briefly show an inconsistent, incorrect state. Worse, if the process crashed between the two commands, the points would simply vanish: taken from Alice, never given to Bob.

Redis is single-threaded for command execution (Phase 1), which already guarantees that *individual* commands never interleave with each other mid-execution. But that guarantee doesn't extend across multiple separate commands sent back-to-back — between your `DECRBY` and your `INCRBY`, some other client's command can still run. The core problem: **how do you make several commands execute as one uninterruptible unit, with zero other client commands interleaved in the middle?**

---

## 2. The Analogy: One Order, Rung Up as a Whole

**Real-world analogy:** picture a counter at a coffee shop. You want to order a coffee, a pastry, and a bagel — three items — but you want them rung up together, as one transaction, at one moment. Compare that to a chaotic version of the same counter where each item you ask for gets processed the instant you say it, with other customers' items potentially getting rung up in between your own three items. You might get charged for your coffee, then someone else's sandwich gets processed, then your pastry — the totals could get confused, and if the register jammed after your coffee but before your bagel, you'd walk away with only part of your order and only part of your bill.

**Queuing the whole order and ringing it up as one indivisible unit is exactly what `MULTI`/`EXEC` does with Redis commands.** You tell Redis "everything I'm about to say is part of one transaction," queue up each command, and then say "now run all of it, back to back, with nobody else's commands allowed to interleave."

---

## 3. Internal Flow: MULTI, EXEC, DISCARD, and WATCH

Four commands make up the transaction toolkit:

- **`MULTI`** — marks the start of a transaction on the current connection. Every command sent after `MULTI` is **queued**, not executed immediately. Redis replies `QUEUED` to each one to confirm it was accepted into the queue (a syntax error in a queued command is caught here — more on that in Common Mistakes).
- **`EXEC`** — runs every queued command, in order, as a single atomic unit. No other client's command can execute in between any two of the queued commands. `EXEC` returns an array of results, one per queued command, in the order they were queued.
- **`DISCARD`** — cancels a queued transaction before `EXEC` is called. The queue is thrown away and nothing runs.
- **`WATCH key [key ...]`** — used *before* `MULTI`, this tells Redis "watch these keys for changes." If any watched key is modified by another client between the `WATCH` and the `EXEC`, the entire transaction is aborted — `EXEC` returns `nil` and none of the queued commands run at all. This gives you **optimistic locking**: instead of holding a lock the whole time, you optimistically prepare a transaction and let Redis check right before committing whether your assumptions were invalidated by someone else.

The typical flow for a "read, decide, write" transaction that needs to be safe against concurrent modification is: `WATCH` the key(s) you're about to base a decision on, read their current values, decide what to write, then `MULTI` + queue the writes + `EXEC`. If nothing you watched changed in the meantime, `EXEC` runs your writes atomically. If something changed, `EXEC` aborts and your application code notices the `nil` and can retry the whole flow.

---

## 4. Code Example: Transferring Balance Between Two Users

Using `redis-cli`, first make sure both balances exist:

```
127.0.0.1:6379> SET balance:alice 100
OK
127.0.0.1:6379> SET balance:bob 20
OK
```

Now transfer 50 points from Alice to Bob as one atomic transaction:

```
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> DECRBY balance:alice 50
QUEUED
127.0.0.1:6379> INCRBY balance:bob 50
QUEUED
127.0.0.1:6379> EXEC
1) (integer) 50
2) (integer) 70
```

Notice each queued command replied `QUEUED` immediately — Redis isn't running them yet, just confirming they were accepted into the transaction. `EXEC` then runs both commands back to back and returns their results as an array, in the same order they were queued: Alice's new balance (`50`) and Bob's new balance (`70`). No other client's command could have executed between the `DECRBY` and the `INCRBY` — the whole two-command unit ran as one atomic block.

The same thing from Python with `redis-py`, using its built-in pipeline object in transactional mode (the default):

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

with r.pipeline() as pipe:
    pipe.multi()
    pipe.decrby("balance:alice", 50)
    pipe.incrby("balance:bob", 50)
    results = pipe.execute()  # [50, 70] if the balances above were already at 50/70

print(results)  # e.g. [0, 120] depending on starting values
```

`r.pipeline()` returns a pipeline object; `pipe.multi()` explicitly marks it as a transaction (`redis-py`'s pipeline defaults to transactional behavior even without this call, but calling it makes the intent explicit); `pipe.execute()` sends `MULTI`, all queued commands, and `EXEC` together, then returns a Python list of the results in order — mirroring the array `EXEC` returns in `redis-cli`.

---

## 5. Code Example: Optimistic Locking with WATCH

Suppose you want to double Alice's balance, but only if nobody else changes it in the meantime. Here's the flow in `redis-cli`, played out across two separate sessions to simulate a race:

**Session A:**
```
127.0.0.1:6379> WATCH balance:alice
OK
127.0.0.1:6379> GET balance:alice
"50"
```

At this point, Session A has read `50` and is about to queue up a transaction to set the balance to `100` (double it). But before it calls `MULTI`/`EXEC`, imagine **Session B** runs concurrently:

**Session B:**
```
127.0.0.1:6379> SET balance:alice 999
OK
```

Now Session A proceeds, unaware that the value it based its calculation on is stale:

**Session A (continued):**
```
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> SET balance:alice 100
QUEUED
127.0.0.1:6379> EXEC
(nil)
```

`EXEC` returns `(nil)` — the transaction was aborted, and `SET balance:alice 100` never ran, because `balance:alice` (a watched key) was modified by Session B between the `WATCH` and the `EXEC`. Alice's balance remains `999`, not the stale `100` Session A would have incorrectly written. The application-level pattern is: on seeing `nil` from `EXEC`, retry the whole read-decide-write flow from the top with fresh data.

In `redis-py`, this same optimistic-locking pattern is commonly wrapped using `pipe.watch(key)` followed by a manual retry loop, since a `WatchError` is raised if the watched key changes before `execute()`:

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

with r.pipeline() as pipe:
    while True:
        try:
            pipe.watch("balance:alice")
            current = int(pipe.get("balance:alice"))
            pipe.multi()
            pipe.set("balance:alice", current * 2)
            pipe.execute()
            break  # succeeded
        except redis.WatchError:
            continue  # balance:alice changed underneath us — retry with fresh data
```

---

## 6. Redis Transactions vs SQL Transactions

| | **Redis `MULTI`/`EXEC`** | **SQL Transaction (`BEGIN`/`COMMIT`)** |
|---|---|---|
| **Atomicity of the whole batch** | Yes — no other client's commands interleave during `EXEC` | Yes |
| **Rollback if one command fails at runtime** | No — the rest of the queued commands still execute | Yes — the whole transaction rolls back on error by default |
| **Isolation mechanism** | Optimistic, via `WATCH` (check-before-commit) | Typically lock-based or MVCC, configurable isolation levels |
| **Queued command syntax errors** | Caught at queue time — `EXEC` refuses to run *any* command if one was malformed | Caught at parse/prepare time |
| **Nested transactions** | Not supported | Supported via savepoints in some databases |

---

## 7. Common Mistakes

- **Assuming `MULTI`/`EXEC` gives you rollback-on-error like a SQL transaction — it doesn't.** If one queued command fails at *runtime* (for example, running `INCR` on a key that holds a non-numeric string), Redis still executes every other queued command in the transaction. The failing command's result in the `EXEC` array will be an error object, but nothing before or after it is rolled back. This is the single most common misunderstanding newcomers bring from SQL experience.
- Confusing a queue-time error (a malformed command, like an unknown command name) with a runtime error: a queue-time error causes Redis to refuse to run `EXEC` at all and it returns an error immediately, while a runtime error (like the `INCR` example above) still lets every other queued command run.
- Forgetting that `WATCH` is per-connection and only useful *before* `MULTI` — calling `WATCH` after `MULTI` has already started queuing commands is a protocol error.
- Not handling the `nil` (or `WatchError` in `redis-py`) that `EXEC` can return when a watched key changed — silently treating `nil` as "success" instead of retrying leads to lost updates.

**Interview angle:** "Does Redis support transactions, and are they ACID?" is a favorite trick question. The honest answer is nuanced: `MULTI`/`EXEC` gives you **atomicity** (all-or-nothing execution as a batch, with no interleaving) and a form of **isolation** via `WATCH`, but it explicitly does *not* give you rollback-on-runtime-error the way a SQL transaction does — a failing command inside the batch doesn't undo the others. Being able to state that distinction clearly, with the `INCR`-on-a-string example, is what separates a candidate who's actually used Redis transactions from one who's just memorized the command names.

---

## 8. Hands-On Exercises

### Exercise 1 — Transfer with a deliberate runtime error

Set up `balance:alice` as a String (`"100"`) and `balance:carol` as a non-numeric String (`"not-a-number"`). Run a `MULTI`/`EXEC` transaction that queues `DECRBY balance:alice 10` followed by `INCRBY balance:carol 10`. Observe that the first command succeeds and the second returns an error in the `EXEC` array — and that Alice's balance was still decremented even though the "transfer" as a whole didn't logically complete. Write one sentence on why this proves Redis transactions aren't rollback-safe.

### Exercise 2 — Simulate a WATCH race with two terminals

Open two `redis-cli` sessions. In the first, run `WATCH` on a key and read its value, but don't call `MULTI` yet. In the second session, modify that same key. Back in the first session, run `MULTI`, queue a `SET`, and call `EXEC`. Confirm it returns `nil` and the key's value reflects the second session's write, not yours.

### Exercise 3 — Implement optimistic locking in Python

Using `redis-py`, write a small script that reads an integer counter key, watches it, and increments it by 5 inside a `MULTI`/`EXEC` block wrapped in a `WatchError` retry loop (as shown above). Run two copies of the script back to back against the same key and confirm the final value reflects both increments correctly rather than one overwriting the other.

---

## 9. Interview Q&A

### Q1. What do `MULTI` and `EXEC` do in Redis?

**Answer:** `MULTI` marks the start of a transaction and causes every subsequent command on that connection to be queued rather than executed immediately (each queued command gets a `QUEUED` reply). `EXEC` then runs every queued command as one atomic, uninterruptible unit, returning an array of results in the same order the commands were queued.

---

### Q2. Are Redis transactions ACID like a SQL database's transactions?

**Answer:** Partially. They provide atomicity (the whole batch executes with no other client's commands interleaved) and, when combined with `WATCH`, a form of isolation. But they do not provide rollback on runtime failure — if one queued command errors when it actually runs, the rest of the queued commands still execute; nothing is undone.

---

### Q3. What is `WATCH` used for, and what happens if a watched key changes?

**Answer:** `WATCH` is called before `MULTI` to mark one or more keys for optimistic locking. If any watched key is modified by another client between the `WATCH` call and the eventual `EXEC`, the whole transaction is aborted — `EXEC` returns `nil` and none of the queued commands run. The application is expected to detect this and retry the read-decide-write flow with fresh data.

---

### Q4. What's the difference between a queue-time error and a runtime error inside a Redis transaction?

**Answer:** A queue-time error (such as sending a malformed or unknown command) is caught immediately when the command is queued, and Redis will refuse to execute the transaction at all when `EXEC` is called. A runtime error (such as calling `INCR` on a key holding a non-numeric string) isn't detected until the command actually executes during `EXEC` — in that case, the erroring command's slot in the result array holds an error, but every other queued command still runs normally.

---

### Q5. Why would you use `DISCARD` instead of just not calling `EXEC`?

**Answer:** Once `MULTI` has been issued on a connection, that connection stays in the "queuing" state for every subsequent command until either `EXEC` or `DISCARD` is called — you can't simply walk away from it and issue normal commands. `DISCARD` explicitly clears the queued commands and returns the connection to normal command-execution mode without running anything.

---

> 🧠 **Memory hook:** "MULTI queues the order, EXEC rings it all up at once — but if one item on the receipt is wrong, the rest still get charged; nothing rolls back. WATCH is the cashier double-checking the price hasn't changed before hitting total."
