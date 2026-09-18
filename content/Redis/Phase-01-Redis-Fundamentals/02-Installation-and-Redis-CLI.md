# 02 — Installation and Redis CLI

> A comprehensive reference covering how to get a Redis server running locally, how to connect to it interactively with `redis-cli`, and the essential commands to confirm it's working.

---

## Table of Contents

1. [The Problem: You Need a Server and a Way to Poke at It](#1-the-problem-you-need-a-server-and-a-way-to-poke-at-it)
2. [The Analogy: A REPL for a Database](#2-the-analogy-a-repl-for-a-database)
3. [Installing and Starting Redis](#3-installing-and-starting-redis)
4. [Your First redis-cli Session](#4-your-first-redis-cli-session)
5. [Essential redis-cli Flags and Commands](#5-essential-redis-cli-flags-and-commands)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: You Need a Server and a Way to Poke at It

Phase 01 explained *what* Redis is conceptually. Before writing a single line of application code against it, you need two things that have nothing to do with any programming language: a **running Redis server process** to connect to, and an **interactive way to send it commands** so you can experiment, verify behavior, and debug — the same way you'd never write your first Python program without first opening a Python interpreter to try things out.

Skipping straight to application code without this step means every mistake — a typo in a command, a misunderstanding of what a command returns — gets debugged through a slower, clunkier feedback loop (write code, run it, read a stack trace, repeat) instead of getting instant, direct feedback at a prompt.

---

## 2. The Analogy: A REPL for a Database

**Real-world analogy:** think of how you first learned Python. You almost certainly didn't write a `.py` file and run it as your very first step — you opened a terminal, typed `python`, and got an interactive prompt (`>>>`) where you could type `2 + 2` and instantly see `4`. That immediate, exploratory feedback loop is a REPL (Read-Eval-Print Loop).

**`redis-cli` is that same REPL, but for Redis.** Instead of typing Python expressions, you type Redis commands — `SET`, `GET`, `INCR` — and see exactly what Redis returns, instantly, with no application code in between. Just like you'd use the Python REPL to sanity-check a piece of syntax before committing it to a script, you use `redis-cli` to sanity-check how a Redis command actually behaves before you wire it into an application.

---

## 3. Installing and Starting Redis

There are two common paths to a running Redis server:

**Option A — Docker (recommended, zero-friction path).** If you have Docker installed, you don't need to install Redis on your machine at all — you run it in a container:

```bash
docker run -d --name redis-local -p 6379:6379 redis
```

Breaking this down:
- `-d` — run the container in the background (detached mode) instead of tying up your terminal.
- `--name redis-local` — give the container a friendly name so you can refer to it later (`docker stop redis-local`, etc.).
- `-p 6379:6379` — map port 6379 on your machine to port 6379 inside the container. `6379` is Redis's default port.
- `redis` — the official Redis image, pulled from Docker Hub if you don't already have it locally.

**Option B — Native install.** On macOS with Homebrew: `brew install redis` then `redis-server` to start it in the foreground (or `brew services start redis` to run it as a background service). On Debian/Ubuntu: `sudo apt install redis-server`, which typically starts and enables the service automatically. Either way, once installed, running `redis-server` directly starts the process listening on port 6379 by default.

Whichever path you choose, you now have a Redis server process listening for connections on `localhost:6379`.

---

## 4. Your First redis-cli Session

With a Redis server running, connect to it with:

```bash
redis-cli
```

This drops you into an interactive prompt, `127.0.0.1:6379>`. From here, try the classic first command — `PING` — to confirm the connection is alive:

```
127.0.0.1:6379> PING
PONG
```

`PONG` is Redis's literal, fixed response to `PING` — this is the "is anyone home?" health check, and it's the very first thing worth running against any Redis connection, in `redis-cli` or in application code.

Now the basics — set a value, read it back, and delete it:

```
127.0.0.1:6379> SET foo bar
OK
127.0.0.1:6379> GET foo
"bar"
127.0.0.1:6379> DEL foo
(integer) 1
127.0.0.1:6379> GET foo
(nil)
```

Walking through exactly what each response means:
- `SET foo bar` returns `OK` — a simple status reply confirming the write succeeded.
- `GET foo` returns `"bar"` — the CLI wraps string replies in quotes for readability; the underlying value is just the bytes `bar`.
- `DEL foo` returns `(integer) 1` — `DEL` returns the *count of keys actually deleted*, not a boolean. If you `DEL` a key that doesn't exist, it returns `(integer) 0`, not an error.
- `GET foo` after deletion returns `(nil)` — Redis's way of saying "this key does not exist," shown as `(nil)` in the CLI (this becomes Python `None` when using `redis-py`, covered in the next lesson).

---

## 5. Essential redis-cli Flags and Commands

| Command / Flag | What it does |
|---|---|
| `redis-cli` | Connect interactively to `localhost:6379` (defaults). |
| `redis-cli -h <host> -p <port>` | Connect to a specific host/port instead of the local default. |
| `redis-cli PING` | Run a single command non-interactively and exit — useful in scripts/health checks. |
| `redis-cli MONITOR` | Stream every command Redis receives from *any* client, live, as it happens — invaluable for debugging what your application is actually sending, but adds overhead, so avoid leaving it running against production traffic. |
| `redis-cli --scan` | Iterate over all keys in the keyspace without blocking the server, using `SCAN` under the hood — the safe alternative to running `KEYS *` (which can block the single-threaded event loop on a large dataset). |
| `redis-cli --no-raw` | Force raw command replies to always show their type annotations (e.g. `(integer)`, `(nil)`) even when piping output — useful when scripting against CLI output. |

---

## 6. Common Mistakes

- **Assuming a fresh Redis install is password-protected.** By default, `redis-server` with no configuration accepts commands from any client that can reach it on the network, with no authentication at all. This is fine for local experimentation on your own machine, but it is a genuine, commonly-exploited security risk if that same unconfigured instance is ever exposed to a public network or the internet — never run a default-configured Redis instance reachable outside `localhost` or a trusted private network. Phase 12 covers `requirepass`, `AUTH`, and ACLs in depth.
- **Confusing `(nil)` with an empty string.** `GET` on a missing key returns `(nil)`, not `""` — these are different things, and code that doesn't distinguish them can silently misbehave.
- **Running `KEYS *` on a large dataset** out of habit from other tools, not realizing it blocks the single-threaded event loop while it scans every key — `--scan` (or the `SCAN` command directly) is the safe, non-blocking alternative.

**Interview angle:** "How would you quickly verify a Redis instance is reachable and working?" is a common practical/hands-on question. The expected answer is `redis-cli PING` (or `redis-cli -h <host> -p <port> PING` for a remote instance) expecting `PONG` back — interviewers are checking that you actually know the tool, not just the concept, and that you know a fresh instance has no password by default (a frequent security follow-up question).

---

## 7. Hands-On Exercises

### Exercise 1 — Start Redis and run the basics

Start a Redis server using either Docker or a native install (Section 3). Open `redis-cli` and run, in order: `PING`, `SET greeting hello`, `GET greeting`, `DEL greeting`, `GET greeting`. Write down the exact output of each command and confirm it matches what Section 4 describes.

### Exercise 2 — Explore `--scan`

Create five keys with `SET key1 a`, `SET key2 b`, ... `SET key5 e`. Then run `redis-cli --scan` and confirm it lists all five. Compare this conceptually to what `KEYS *` would do on a dataset with millions of keys instead of five — why is `--scan` (backed by `SCAN`) the safer choice at scale?

### Exercise 3 — Watch commands live with MONITOR

Open two terminal windows. In the first, run `redis-cli MONITOR`. In the second, run a few commands via a second `redis-cli` session (`SET`, `GET`, `INCR somecounter`). Observe how every command shows up in the `MONITOR` window in real time, along with a timestamp and the connecting client's address.

---

## 8. Interview Q&A

### Q1. How do you check whether a Redis server is up and reachable?

**Answer:** Run `redis-cli PING` (adding `-h <host> -p <port>` for a remote instance) — a healthy Redis server responds with `PONG`. This is the standard, minimal health check, both interactively and in scripts.

---

### Q2. What does `DEL` return, and why does that matter?

**Answer:** `DEL` returns an integer — the count of keys that were actually deleted, not a boolean success/failure flag. Deleting a key that doesn't exist returns `0`, not an error, which matters if application code checks the return value to decide whether something was actually removed.

---

### Q3. What's the difference between `KEYS *` and `SCAN`/`--scan`?

**Answer:** `KEYS *` returns every matching key in one blocking operation, which can freeze the single-threaded event loop for other clients if the keyspace is large. `SCAN` (and the CLI's `--scan` flag) iterates the keyspace incrementally in small batches, without blocking, making it the safe choice on any non-trivial production dataset.

---

### Q4. Is a freshly installed Redis instance secure by default?

**Answer:** No — by default there is no password (`requirepass` is unset) and no ACL restrictions, so any client that can reach the port can run any command. This is acceptable for local development but must never be exposed to an untrusted network as-is; Phase 12 covers `requirepass`, `AUTH`, and fine-grained ACLs for securing a real deployment.

---

### Q5. What does `redis-cli MONITOR` do, and when would you avoid using it?

**Answer:** `MONITOR` streams every command received by the server from all connected clients in real time, which is extremely useful for debugging what an application is actually sending. It should be avoided against a busy production instance for extended periods, since it adds overhead to every command processed while it's attached.

---

> 🧠 **Memory hook:** "`redis-cli` is to Redis what the `python` prompt is to Python — don't write a script before you've played at the prompt first."
