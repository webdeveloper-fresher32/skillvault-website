# Process Management with PM2 — Complete Guide

## Table of Contents
1. [Why You Need a Process Manager](#1-why-you-need-a-process-manager)
2. [PM2 Basics](#2-pm2-basics)
3. [Cluster Mode](#3-cluster-mode)
4. [Ecosystem File](#4-ecosystem-file)
5. [Zero-Downtime Reload](#5-zero-downtime-reload)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why You Need a Process Manager

Running `node server.js` directly has real problems in production:

```
Problem                          Consequence
-------------------------------  ---------------------------------------
Uncaught exception crashes app   Server goes down, no auto-restart
Server reboots                   App doesn't come back up
Only 1 CPU core used             Node is single-threaded — wastes cores
Deploying a new version          Requires stopping the process (downtime)
No centralized logs              Have to dig through stdout redirection
```

A process manager solves all of this: it keeps the app alive, restarts it on crash, uses all CPU cores, and manages logs — without changing the app's code.

**PM2** is the most widely used Node.js process manager in production.

```bash
npm install -g pm2
```

---

## 2. PM2 Basics

```bash
# Start an app
pm2 start server.js --name my-api

# List running processes
pm2 list

# View logs (tails stdout/stderr)
pm2 logs my-api

# Stop / restart / delete
pm2 stop my-api
pm2 restart my-api
pm2 delete my-api

# Monitor CPU/memory in real time
pm2 monit

# Persist process list across server reboots
pm2 save
pm2 startup     # generates + configures an OS-level init script
```

Example `pm2 list` output:

```
┌────┬───────────┬─────────┬─────────┬──────────┬────────┬──────┬──────────┐
│ id │ name      │ mode    │ status  │ cpu      │ memory │ pid  │ restarts │
├────┼───────────┼─────────┼─────────┼──────────┼────────┼──────┼──────────┤
│ 0  │ my-api    │ fork    │ online  │ 0%       │ 45.2mb │ 8891 │ 0        │
└────┴───────────┴─────────┴─────────┴──────────┴────────┴──────┴──────────┘
```

Key restart behavior: if the app crashes (uncaught exception, `process.exit(1)`), PM2 restarts it automatically. PM2 tracks `restarts` — a rapidly climbing number is a red flag worth investigating (crash loop).

```bash
# Auto-restart if memory exceeds a threshold (guards against leaks)
pm2 start server.js --name my-api --max-memory-restart 300M
```

---

## 3. Cluster Mode

By default Node uses a single thread/core. PM2's **cluster mode** forks multiple instances of your app across CPU cores and load-balances requests between them using Node's built-in `cluster` module under the hood — with zero code changes required.

```bash
# Fork mode (default) — single instance
pm2 start server.js --name my-api

# Cluster mode — one instance per CPU core
pm2 start server.js --name my-api -i max

# Or a specific number of instances
pm2 start server.js --name my-api -i 4
```

```
Single instance (fork mode):          Cluster mode (-i max, 4 cores):

   [ Node process ] ← all requests       [ PM2 master ]
      1 CPU core used                          │
                                    ┌───────────┼───────────┬───────────┐
                                    ▼           ▼           ▼           ▼
                                [Worker 1]  [Worker 2]  [Worker 3]  [Worker 4]
                                 core 0      core 1      core 2      core 3

                                All 4 workers share the SAME port (PM2 load-balances)
```

**Important caveat:** each worker is a separate Node process with its own memory. Anything held in-process memory (in-memory cache, session store, rate-limit counters) is **not shared** across workers. This is why stateless design + externalized state (Redis, DB) matters — see `06-Scaling-Node-Applications.md`.

---

## 4. Ecosystem File

Instead of long CLI flags, PM2 supports a config file (`ecosystem.config.js`) that declares one or more apps and their settings — checked into source control.

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'my-api',
      script: './server.js',
      instances: 'max',              // or a specific number, e.g. 4
      exec_mode: 'cluster',          // 'fork' or 'cluster'
      watch: false,                  // true in dev to restart on file change
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
```

```bash
# Start using the ecosystem file with the "production" env block
pm2 start ecosystem.config.js --env production

# Reload config changes
pm2 reload ecosystem.config.js --env production
```

Multiple apps (e.g., API + a background worker) can be declared in the same `apps` array and managed together with `pm2 start ecosystem.config.js`.

---

## 5. Zero-Downtime Reload

`pm2 restart` kills all instances and starts new ones — brief downtime. `pm2 reload` restarts instances **one at a time**, only after the new one is ready to accept connections — no dropped requests.

```bash
# Zero-downtime reload (cluster mode only)
pm2 reload my-api

# Zero-downtime reload using the ecosystem file
pm2 reload ecosystem.config.js --env production
```

```
pm2 restart (downtime):              pm2 reload (zero-downtime):

Worker 1: [stop][    ][start]        Worker 1: [stop][start]
Worker 2: [stop][    ][start]        Worker 2:        [stop][start]
Worker 3: [stop][    ][start]        Worker 3:               [stop][start]
Worker 4: [stop][    ][start]        Worker 4:                      [stop][start]
          └─ all down together ┘               └─ at least 3 always serving ┘
```

For zero-downtime reload to actually work correctly, your app must handle **graceful shutdown** — finish in-flight requests before exiting when it receives `SIGINT`:

```javascript
// server.js
const server = app.listen(config.port);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  console.log('Received shutdown signal, closing server gracefully...');
  server.close(() => {
    console.log('HTTP server closed. Exiting.');
    process.exit(0);
  });

  // force exit if it hangs (e.g., stuck DB connections)
  setTimeout(() => process.exit(1), 10000).unref();
}
```

Without this, a reload can kill a worker mid-request, dropping connections.

---

## 6. Hands-On Exercises

**Exercise 1:** Install PM2 globally, start a simple Express app with `pm2 start server.js --name demo`, then run `pm2 list`, `pm2 logs demo`, and `pm2 monit`.

**Exercise 2:** Deliberately crash the app (throw an uncaught error in a route) and observe PM2 auto-restart it. Check the `restarts` counter in `pm2 list`.

**Exercise 3:** Start the same app in cluster mode with `-i max`. Add a route that returns `process.pid`. Hit it repeatedly with curl and confirm different PIDs are returned across requests.

**Exercise 4:** Write an `ecosystem.config.js` with `env` and `env_production` blocks. Start with `pm2 start ecosystem.config.js --env production` and confirm `NODE_ENV`/`PORT` match the production block.

**Exercise 5:** Add graceful shutdown handling for `SIGINT`/`SIGTERM` to your app, then compare `pm2 restart` vs `pm2 reload` while sending continuous requests with a load tool — observe whether any requests fail during each.

---

## 7. Interview Q&A

**Q: Why use PM2 instead of just running `node server.js`?**
Answer: Running Node directly means any uncaught exception kills the process with no automatic restart, the app doesn't restart after a server reboot, and only one CPU core is used since Node is single-threaded. PM2 provides automatic restarts on crash, multi-core utilization via cluster mode, centralized log management, and zero-downtime reloads — all without changing application code.

**Q: What is PM2 cluster mode and how does it work?**
Answer: Cluster mode forks multiple instances of the app — typically one per CPU core — using Node's `cluster` module under the hood, with a master process load-balancing incoming connections across workers on the same port. It lets a single-threaded Node app utilize all available CPU cores, increasing throughput without code changes.

**Q: What's the difference between `pm2 restart` and `pm2 reload`?**
Answer: `pm2 restart` stops all instances and starts new ones — causing brief downtime since all workers are down simultaneously. `pm2 reload` (cluster mode only) restarts instances one at a time, keeping the rest online to serve traffic, achieving zero-downtime deploys — provided the app handles graceful shutdown properly.

**Q: What does an ecosystem file do and why use one instead of CLI flags?**
Answer: An `ecosystem.config.js` declares app name, script, instance count, execution mode, environment variables per deploy target, and log paths in one version-controlled file. It replaces long, error-prone CLI commands, supports multiple apps in one file, and lets you reload with a consistent, reproducible config (`pm2 reload ecosystem.config.js --env production`).

**Q: What's a pitfall of cluster mode regarding in-memory state?**
Answer: Each cluster worker is a separate OS process with its own memory space — nothing is automatically shared between them. In-memory caches, session stores, or rate-limiter counters kept in process memory will be inconsistent across workers, since a user's requests may land on different workers. The fix is to externalize shared state to Redis or a database so all workers see the same data.

**Q: How does PM2 achieve zero-downtime reloads, and what must the app do to support it correctly?**
Answer: PM2 reload restarts cluster workers sequentially, starting a replacement and waiting for it to be ready before stopping the old one, so at least some workers are always serving requests. For this to avoid dropped connections, the app must implement graceful shutdown — on `SIGINT`/`SIGTERM`, stop accepting new connections, finish in-flight requests, then exit, rather than terminating abruptly mid-request.
