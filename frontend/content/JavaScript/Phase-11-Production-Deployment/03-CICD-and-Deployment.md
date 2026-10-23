# CI/CD and Deployment — Complete Guide

## Table of Contents
1. [What CI/CD Means](#1-what-cicd-means)
2. [GitHub Actions Workflow Example](#2-github-actions-workflow-example)
3. [Deployment Target: Vercel](#3-deployment-target-vercel)
4. [Deployment Target: Render](#4-deployment-target-render)
5. [Deployment Target: PM2 on a VPS](#5-deployment-target-pm2-on-a-vps)
6. [Health Checks](#6-health-checks)
7. [Zero-Downtime Deployment](#7-zero-downtime-deployment)
8. [Production Best-Practices Checklist](#8-production-best-practices-checklist)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What CI/CD Means

**Continuous Integration (CI)** means every code change is automatically built, linted, and tested the moment it's pushed — catching problems before they merge, instead of relying on someone remembering to run tests manually. **Continuous Deployment/Delivery (CD)** extends this by automatically deploying code that passes CI, either straight to production (Continuous Deployment) or to a staging environment awaiting manual approval (Continuous Delivery).

```
Developer pushes code
        │
        ▼
┌───────────────────┐
│   CI Pipeline      │
│  1. Install deps   │
│  2. Lint            │
│  3. Run tests       │      any step fails → pipeline stops,
│  4. Build            │      developer notified, nothing deploys
└─────────┬──────────┘
          │ all steps pass
          ▼
┌───────────────────┐
│   CD Pipeline      │
│  Deploy to staging  │──▶ (optional manual approval gate)
│  Deploy to prod      │
│  Run health check     │
└───────────────────┘
```

This replaces a slow, error-prone manual release process ("did someone remember to run the tests? did we forget to set an env var on the new server?") with a repeatable, automated pipeline that behaves identically every time.

---

## 2. GitHub Actions Workflow Example

GitHub Actions defines CI/CD pipelines as YAML files in `.github/workflows/`, triggered by events like a push or pull request.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]   # test against multiple Node versions

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: "npm"                # caches node_modules between runs for speed

      - name: Install dependencies
        run: npm ci                   # like npm install, but strict/reproducible from package-lock.json

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test -- --coverage
        env:
          NODE_ENV: test
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}   # pulled from GitHub repo secrets, never hardcoded

      - name: Build
        run: npm run build

  deploy:
    needs: test                       # only runs if the `test` job succeeds
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          curl -X POST "$DEPLOY_HOOK_URL"
        env:
          DEPLOY_HOOK_URL: ${{ secrets.DEPLOY_HOOK_URL }}
```

### Field-by-Field Breakdown

```
on: push / pull_request
  ↳ Defines the trigger. Runs on every push to main, and every PR
    targeting main — catching problems before merge, not just after.

strategy.matrix
  ↳ Runs the entire job once per listed Node version — catches
    version-specific bugs before they reach a real deployment.

npm ci  (not npm install)
  ↳ Installs EXACTLY what's in package-lock.json, failing if it's
    out of sync with package.json — guarantees reproducible builds,
    unlike npm install which can silently update the lockfile.

secrets.TEST_DATABASE_URL
  ↳ Secrets are configured in the repo's Settings → Secrets, never
    committed to the YAML file or source code — this is how
    credentials reach CI without ever touching version control.

needs: test
  ↳ The deploy job only runs if the test job completes successfully —
    this is the actual gate that prevents broken code from shipping.

if: github.ref == 'refs/heads/main'
  ↳ Restricts deployment to pushes on main specifically — a PR from
    a feature branch runs tests but never triggers a deploy.
```

---

## 3. Deployment Target: Vercel

Vercel is optimized for frontend frameworks and serverless functions — deploying a Node.js API typically means writing it as serverless functions rather than a long-running Express server.

```js
// api/hello.js — a Vercel serverless function; the file path IS the route
export default function handler(req, res) {
  res.status(200).json({ message: "Hello from a serverless function" });
}
```

```
Deployment flow:
  1. Connect a GitHub repo to a Vercel project (one-time setup)
  2. Every push to main → Vercel automatically builds and deploys to production
  3. Every push to a branch / PR → Vercel deploys a unique "preview" URL,
     letting you review changes live before merging
  4. Environment variables set in the Vercel dashboard, injected at build/runtime
```

**Best fit:** frontend apps (Next.js, React, Vue) with light backend needs expressed as serverless functions; automatic preview deployments per PR are a standout feature for review workflows. **Less suited to:** long-running processes, WebSocket servers, or apps needing a persistent in-memory state between requests, since serverless functions are stateless and can spin down between invocations.

---

## 4. Deployment Target: Render

Render runs traditional long-lived Node processes (unlike Vercel's serverless model), making it a closer fit for a standard Express app that needs a persistent connection pool, WebSockets, or background workers.

```yaml
# render.yaml — defines the service declaratively (Render also supports UI-based setup)
services:
  - type: web
    name: orders-api
    env: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: orders-db
          property: connectionString
    healthCheckPath: /health
```

```
Deployment flow:
  1. Connect a GitHub repo, define build/start commands (or a render.yaml)
  2. Every push to the configured branch triggers a new build + deploy
  3. Render runs a health check against the configured path before
     routing traffic to the new instance (see Section 6)
  4. Managed Postgres/Redis add-ons available directly in the same platform
```

**Best fit:** standard Express/Node APIs, background workers, apps needing persistent connections or WebSockets, small teams wanting managed infrastructure without operating servers directly.

---

## 5. Deployment Target: PM2 on a VPS

Running Node directly on a VPS (a plain Linux server you provision yourself — DigitalOcean, Linode, an EC2 instance) gives full control but requires you to handle process management, restarts on crash, and zero-downtime reloads yourself. PM2 is the standard tool for this.

```bash
# Install PM2 globally on the server
npm install -g pm2

# Start the app under PM2's process management
pm2 start index.js --name orders-api

# Or with a config file for more control
pm2 start ecosystem.config.js
```

```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "orders-api",
    script: "./index.js",
    instances: "max",        // one process per CPU core, using Node's cluster module internally
    exec_mode: "cluster",     // enables load-balanced clustering across instances
    env: {
      NODE_ENV: "production",
      PORT: 3000,
    },
    max_memory_restart: "500M", // auto-restart if a single instance exceeds this memory
  }],
};
```

```bash
# Everyday PM2 operations
pm2 list                 # show all managed processes and their status
pm2 logs orders-api       # stream logs from the app
pm2 restart orders-api    # restart (brief downtime unless in cluster mode — see Section 7)
pm2 reload orders-api     # zero-downtime reload in cluster mode
pm2 stop orders-api
pm2 delete orders-api

# Persist the process list across server reboots
pm2 save
pm2 startup               # generates and configures an OS-level startup script
```

**Best fit:** teams wanting full infrastructure control, cost-sensitive setups running many services on one box, or environments where platform-as-a-service pricing/limits don't fit. **Trade-off:** you're now responsible for OS updates, security patching, SSL certificates (commonly via nginx as a reverse proxy + Let's Encrypt), and monitoring — all of which Vercel/Render handle for you.

---

## 6. Health Checks

A health check is an endpoint the deployment platform (or a load balancer, or Kubernetes) polls to determine whether an instance is ready to receive traffic — critical for automated deployments and for automatically removing an unhealthy instance from rotation.

```js
// A meaningful health check verifies actual dependencies, not just "the process is alive"
app.get("/health", async (req, res) => {
  const checks = {
    server: "ok",
    database: "unknown",
  };

  try {
    await db.query("SELECT 1"); // a cheap query that confirms real connectivity
    checks.database = "ok";
  } catch {
    checks.database = "unreachable";
  }

  const healthy = Object.values(checks).every(status => status === "ok");
  res.status(healthy ? 200 : 503).json(checks);
});

// A lighter "liveness" check — is the process itself responsive at all,
// distinct from "readiness" (is it ready to serve real traffic)
app.get("/health/live", (req, res) => res.sendStatus(200));
```

```
Liveness vs Readiness (a distinction borrowed from Kubernetes, but the
concept applies to any deployment platform's health checking):

  Liveness:  "Is this process still running and not deadlocked?"
             Failing → the platform should RESTART this instance.

  Readiness: "Is this instance ready to receive real user traffic?"
             Failing → the platform should STOP ROUTING to this instance
             temporarily (e.g. database still connecting at startup),
             WITHOUT necessarily restarting it.
```

A health check that only returns `200 OK` unconditionally (without checking real dependencies) gives a false sense of safety — the platform will happily route traffic to an instance whose database connection is actually down.

---

## 7. Zero-Downtime Deployment

Naively stopping the old process and starting the new one causes a gap where no process is listening — every in-flight request during that gap fails. Zero-downtime deployment avoids this gap entirely.

```
Naive deploy (has downtime):
  [old process running] ──▶ STOP ──▶ (nothing listening — requests fail) ──▶ START ──▶ [new process running]

Rolling / zero-downtime deploy:
  [old process running]
  [old process running] + [new process starting up]
  [old process running] + [new process ready, added to rotation]
  [old process draining, no new requests] + [new process serving all new traffic]
  [old process finishes in-flight requests, then exits] + [new process running]
                            ↑ at every point in time, AT LEAST ONE process is serving traffic
```

Key mechanisms that make this possible:

```
1. Start the new instance BEFORE stopping the old one (not after).
2. Only route traffic to the new instance once its readiness health
   check passes — never send traffic to a not-yet-ready process.
3. Signal the old instance to stop accepting NEW connections, but let
   it finish any in-flight requests ("graceful shutdown"/"draining")
   rather than killing it immediately.
4. Only fully terminate the old instance after it's done draining
   (or after a maximum grace period timeout).
```

```js
// Graceful shutdown in a plain Node/Express app — listens for the
// termination signal a process manager sends before killing a process
const server = app.listen(port);

process.on("SIGTERM", () => {
  console.log("SIGTERM received: closing HTTP server gracefully");
  server.close(() => {
    console.log("All in-flight requests finished, exiting");
    process.exit(0);
  });

  // safety net — force exit if graceful shutdown takes too long
  setTimeout(() => process.exit(1), 10_000).unref();
});
```

PM2's `reload` (cluster mode), and platform-managed rolling deploys on Render/Vercel/Kubernetes, all implement this same pattern under the hood — starting new instances, health-checking them, and only then draining and retiring old ones.

---

## 8. Production Best-Practices Checklist

```
Configuration & Secrets
  [ ] No secrets committed to source control; .env is gitignored
  [ ] All required environment variables validated at startup (fail fast)
  [ ] NODE_ENV correctly set to "production" in production

Reliability
  [ ] Process manager (PM2, platform equivalent) restarts on crash
  [ ] Graceful shutdown handling (SIGTERM) drains in-flight requests
  [ ] Health check endpoint verifies real dependencies, not just liveness
  [ ] Database connections use a pool with sane min/max size, not one
      connection per request

Security
  [ ] Passwords hashed with bcrypt (or equivalent), never stored plainly
  [ ] All SQL queries parameterized — no string concatenation
  [ ] helmet (or equivalent) sets secure HTTP headers
  [ ] CORS configured to an explicit allow-list, not a wildcard, in production
  [ ] Rate limiting on authentication and other sensitive endpoints
  [ ] Dependencies regularly audited (npm audit) and kept up to date

Observability
  [ ] Structured (JSON) logging in place, with appropriate log levels
  [ ] Errors captured with enough context to debug without reproducing locally
  [ ] Uncaught exceptions / unhandled rejections logged before the
      process exits, not silently swallowed

Performance
  [ ] No synchronous/blocking calls (readFileSync, etc.) in request handlers
  [ ] Response compression enabled where appropriate
  [ ] Database queries indexed appropriately for their access patterns

CI/CD
  [ ] Tests run automatically on every push/PR before merge is allowed
  [ ] Deployment only happens after tests pass
  [ ] Deploys are zero-downtime (rolling, not stop-then-start)
  [ ] Rollback plan exists (can you redeploy the previous version quickly?)
```

---

## 9. Hands-On Exercises

**Exercise 1:** Write a `.github/workflows/ci.yml` for a small Express + Jest project that runs on every push and pull request, installs dependencies with `npm ci`, runs `npm run lint` and `npm test`, and uses a matrix to test against both Node 18 and Node 20. Intentionally break a test, push, and confirm the workflow fails and is clearly visible in the GitHub Actions tab.

**Exercise 2:** Add a `deploy` job to the workflow from Exercise 1 that only runs `needs: test` and only `if: github.ref == 'refs/heads/main'`. Use a placeholder `run: echo "Deploying..."` step (no real infrastructure needed) and verify via the Actions log that it only triggers on pushes to `main`, not on pull requests from a feature branch.

**Exercise 3:** Implement the `/health` endpoint from Section 6 in a small Express app connected to a real (or mocked) database — have it return `200` with `{"server":"ok","database":"ok"}` when the database is reachable, and `503` with `"database":"unreachable"` when it isn't (simulate this by stopping the database or pointing to a wrong connection string).

**Exercise 4:** Deploy a small Express app to Render (or a similar PaaS) using a `render.yaml` (or the platform's dashboard), configuring the health check path from Exercise 3, environment variables, and confirm that a push to your connected branch triggers an automatic redeploy.

**Exercise 5:** Set up PM2 locally (no real VPS needed) with an `ecosystem.config.js` running your app in `cluster` mode with 2 instances. Use `pm2 reload <name>` while sending continuous requests from another terminal (a simple loop with `curl` in a `while true` shell loop) and confirm no requests fail during the reload — then repeat using `pm2 restart <name>` instead and observe the difference in behavior (some dropped requests due to the brief full stop).

---

## 10. Interview Q&A

**Q: What is the difference between Continuous Integration and Continuous Deployment, and why would a team choose Continuous Delivery instead of full Continuous Deployment?**
Answer: Continuous Integration means every code change is automatically built and tested the moment it's pushed, catching integration problems and regressions early rather than relying on manual verification. Continuous Deployment extends this by automatically shipping every change that passes CI straight to production with no human step in between, while Continuous Delivery stops one step short — the change is automatically built, tested, and packaged as release-ready, but a human explicitly approves the final push to production. Teams often choose Continuous Delivery over full Continuous Deployment when they want an extra layer of judgment before user-facing changes go live — for regulatory reasons, coordinated release timing, or simply because full automated deployment requires a very high level of trust in the test suite's coverage that not every team has yet earned.

**Q: Why does `npm ci` matter more than `npm install` inside a CI pipeline?**
Answer: `npm install` can modify `package-lock.json` if the lockfile and `package.json` are slightly out of sync — for example, resolving a dependency to a newer compatible version than what's currently locked — which means two different CI runs against the "same" codebase could theoretically install slightly different dependency versions. `npm ci` instead installs exactly what's specified in `package-lock.json` and fails outright if the lockfile doesn't perfectly match `package.json`, guaranteeing that every CI run, and every deployment, installs the identical dependency tree that was tested — this reproducibility is essential for trusting that "tests passed in CI" actually reflects what will run in production, rather than a slightly different set of dependency versions.

**Q: What's the difference between a liveness check and a readiness check, and why does conflating them cause production problems?**
Answer: A liveness check answers "is this process still running and responsive at all," and failing it should trigger a restart of the instance, since the process is presumed to be stuck or crashed. A readiness check answers a narrower question — "is this specific instance currently able to serve real traffic" — which can be false even while the process itself is perfectly alive, such as during startup while a database connection is still being established, or during a transient downstream outage; failing readiness should simply remove the instance from active traffic routing, without necessarily restarting it. Conflating the two — using a single endpoint that only checks "is the process alive" as if it also meant "is the process ready" — can cause a platform to route real user traffic to an instance that's alive but not actually able to serve requests correctly (e.g. because its database connection hasn't finished initializing), producing user-facing errors that a proper readiness check would have prevented.

**Q: Walk through what happens during a zero-downtime deployment, and what would go wrong if you simply stopped the old process and then started the new one.**
Answer: In a naive stop-then-start deploy, there is a window of time — however brief — where no process is listening on the port at all, during which every incoming request fails outright, and any in-flight request being processed by the old process at the moment of shutdown is abruptly cut off with no response. A zero-downtime deployment avoids this by starting the new instance first and only routing traffic to it once its readiness health check passes, ensuring at least one healthy instance is always available; the old instance is then told to stop accepting new connections but allowed to finish any requests already in progress (a "graceful shutdown," typically triggered by a `SIGTERM` signal that the app listens for and handles by closing the server only after in-flight work completes), and only fully terminated once draining is complete or a maximum grace period elapses. The net effect is that at every single point in time during the deployment, at least one instance is fully able to serve traffic, so no request is ever dropped due to the deployment itself.

**Q: How would you decide between deploying a Node.js API to Vercel, Render, or a VPS managed with PM2?**
Answer: The decision mostly comes down to the app's runtime model and how much infrastructure control versus convenience the team wants. Vercel is built around a serverless model — great for frontend-heavy apps or lightweight API routes expressed as individual functions, with excellent automatic preview deployments per pull request, but a poor fit for a traditional long-running Express server that needs persistent state, WebSockets, or a long-lived connection pool, since serverless functions are stateless and can spin down between invocations. Render runs traditional long-lived Node processes with managed builds, deploys, and health-check-gated rollouts, making it a much closer match for a standard Express API needing persistent connections, while still offloading infrastructure management (OS patching, SSL, scaling) to the platform. A VPS with PM2 gives full control and is often the most cost-effective option at scale or for running several services on one box, but shifts responsibility for OS security patching, SSL certificate management, load balancing, and zero-downtime reload configuration entirely onto the team — the right choice for teams with the operational capacity (or the specific need) to manage that themselves.
