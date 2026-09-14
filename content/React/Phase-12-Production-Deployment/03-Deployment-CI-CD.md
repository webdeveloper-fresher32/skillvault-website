# 03 — Deployment & CI/CD

> "A build that only works on your laptop isn't a product — it's a promise you haven't kept yet."

---

## Table of Contents

1. [The Problem: A Build Folder Is Not a Live App](#1-the-problem-a-build-folder-is-not-a-live-app)
2. [Static Hosting for CSR/SSG Apps](#2-static-hosting-for-csrssg-apps)
3. [Hosting an SSR/Next.js App](#3-hosting-an-ssrnextjs-app)
4. [CI/CD: The Concept](#4-cicd-the-concept)
5. [A Concrete GitHub Actions Workflow](#5-a-concrete-github-actions-workflow)
6. [Environment-Specific Configuration](#6-environment-specific-configuration)
7. [Preview Deployments](#7-preview-deployments)
8. [Static Hosting vs Server Hosting — Comparison](#8-static-hosting-vs-server-hosting--comparison)
9. [Common Mistakes](#9-common-mistakes)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Problem: A Build Folder Is Not a Live App

Let's start with something that trips up almost everyone the first time they ship a real project.

You've built your app. You ran the command. It worked:

```bash
npm run build
```

And now sitting in your project folder is a `dist/` directory (or `.next/` if you're on Next.js), full of optimized JS, CSS, and HTML.

Here's the question nobody asks out loud, because it feels almost too obvious: **now what?**

That folder is sitting on your laptop. Your friend in another city can't type a URL into their browser and see it. Your teammate reviewing your pull request can't click a link and try it. It's a pile of files, correctly built, going absolutely nowhere.

---

### "I'll just upload it somewhere"

Fine — so you drag the `dist/` folder onto some hosting provider's dashboard, or `scp` it to a server. It works. Users can visit it. Great.

Now you fix a bug. You run `npm run build` again. You... re-upload the whole folder again? By hand? Every single time?

Let's play that forward a few weeks:

```
Monday:    Fix bug → build → manually re-upload
Tuesday:   Add feature → build → manually re-upload
Wednesday: Forget to run tests before uploading → ship a broken build
Thursday:  Someone asks "wait, is the bug fix from Monday even live?"
Friday:    Nobody remembers what's currently deployed
```

Notice what actually broke here. It's not the build step — Vite and webpack do their job perfectly every time. It's everything *around* the build: getting it to a real URL, doing it the same way every time, and catching mistakes *before* they reach real users instead of after.

That's the gap this whole file is about closing.

---

### The three separate problems, named plainly

```text
Problem 1 — Hosting
  Where does the built app physically live so a URL resolves to it?

Problem 2 — Automation
  How do we deploy without a human manually copying files every time?

Problem 3 — Safety
  How do we make sure a broken build never becomes "problem 1's" problem?
```

Static hosting platforms solve Problem 1. CI/CD solves Problems 2 and 3, together, as one connected pipeline. Let's take them in order.

---

## 2. Static Hosting for CSR/SSG Apps

Here's a real-world analogy before the technical explanation.

Imagine you've written a book. If it's printed once, copies of it can sit on shelves in a thousand bookstores around the world. A customer in Tokyo and a customer in São Paulo can both walk in and buy a copy — nobody needs to call the original printing press each time. The book is *static*: printed once, distributed everywhere, read many times without any changes at read time.

That's exactly what a CSR (client-side-rendered) or SSG (static-site-generated) React app is, once built. `npm run build` produces a folder of HTML, CSS, and JS that never changes based on who's asking for it. Every visitor gets the identical files. There's no "computation" happening on the server for each request — the server (or CDN) is just handing out pre-printed copies.

---

### What a CDN actually does

CDN stands for **Content Delivery Network** — a network of servers spread across the globe, all holding copies of the same static files.

```text
                     ┌───────────────────────────┐
                     │   Your dist/ folder        │
                     │   (built once)              │
                     └─────────────┬─────────────┘
                                   │
                    copied to edge locations worldwide
                                   │
        ┌──────────────┬──────────┴───────────┬──────────────┐
        v              v                      v              v
   Edge: Tokyo    Edge: Frankfurt        Edge: São Paulo  Edge: Virginia
        │              │                      │              │
        v              v                      v              v
   User in Japan   User in Germany       User in Brazil   User in USA
   gets a fast     gets a fast           gets a fast      gets a fast
   local response  local response        local response   local response
```

Without a CDN, every single user in the world — no matter how far away — would have to make a round trip to one single server, say, in Virginia. A user in Tokyo would be waiting on packets to cross the Pacific and back for every request. With a CDN, that same user is served from an edge location physically close to them. The distance a request has to travel shrinks dramatically, and so does the load time.

**Platforms that do this well for React apps:** Vercel, Netlify, and Cloudflare Pages are the three you'll hear about constantly. All three follow roughly the same workflow:

```text
1. Connect your GitHub repository
2. Tell the platform your build command (npm run build) and output folder (dist/)
3. Push a commit
4. Platform builds your app and pushes the result to its CDN
5. Your app is live at a URL, globally distributed, automatically
```

You never manually upload a single file again. The platform watches your repository and rebuilds every time you push.

> **Memory hook:** "Print the book once — let bookstores everywhere stock a copy, instead of mailing one from a single warehouse."

---

## 3. Hosting an SSR/Next.js App

Now here's where it gets genuinely different, and it's worth slowing down on.

A CSR/SSG app's HTML is decided once, at build time, and never changes per visitor. But an SSR (server-side-rendered) Next.js app is different by design — remember from the previous file that SSR means the server builds the HTML **fresh, for every single request**, often pulling in data specific to that user or that moment (a logged-in user's dashboard, a product page with live stock counts, and so on).

That means a static file host — which only knows how to hand out pre-built files — literally cannot run SSR. There's no "file" to serve for a page that has to be computed at the moment of the request. You need something that can *execute code* on every request, not just serve bytes.

```text
Static hosting (CDN)                    SSR hosting (server runtime)
─────────────────────                   ─────────────────────────────
Request arrives                          Request arrives
     │                                        │
     v                                        v
Find the matching pre-built              Run your React server-rendering
HTML file on the edge                    code RIGHT NOW, using this
     │                                    request's data
     v                                        │
Return it as-is                               v
(same file, every time)                  Return freshly generated HTML
                                          (potentially different every time)
```

### So where does the "server" actually run?

This is the part people worry about unnecessarily. You do *not* need to rent a server, install Node.js on it, configure a reverse proxy, and babysit it for uptime. Platforms like Vercel (built by the same team behind Next.js) run your SSR code as **serverless functions**.

Here's the honest, accurate way to describe what that means: your per-request rendering logic gets packaged up and deployed as small, independent functions. When a request comes in, the platform spins up (or reuses) an instance of that function, runs it, returns the result, and you never provision, patch, or scale a server yourself. The platform handles all of that behind the scenes.

You still write ordinary Next.js code. You still `git push`. The platform figures out which parts of your app are static (and can go straight to the CDN) and which parts need per-request server execution (and get deployed as serverless functions) — you don't have to manually separate them.

> **Memory hook:** "Static hosting hands out photocopies. SSR hosting has a printer running fresh copies on demand — and the platform babysits the printer for you."

---

## 4. CI/CD: The Concept

Time for the analogy that makes this whole topic click.

Imagine a factory assembly line building phones. At the very end of the line, before a single phone is boxed and shipped, an automated inspection station checks it: does the screen light up, does the battery charge, are all the buttons responsive? If a phone fails any check, it's pulled off the line immediately — it never reaches a customer.

Crucially, this inspection isn't a person who *might* remember to check, or who might get tired and skip a step at 5pm on a Friday. It's an automated station that runs the exact same checks, in the exact same order, on absolutely every single phone, without fail.

That's CI/CD.

---

### Continuous Integration (CI)

**CI** means: every time someone pushes code (or opens a pull request), a machine automatically runs your checks — linting, tests, and the build itself — *before* that code is allowed to merge.

Think about what this replaces. Without CI, "did you run the tests before merging?" is a question you ask a human, and hope they answer honestly, and hope they didn't just forget. With CI, the question is answered automatically, every time, by a machine that doesn't forget and doesn't get tired.

```text
Developer pushes code / opens a PR
              │
              v
    CI automatically runs:
      - Linting   (code style, obvious mistakes)
      - Tests     (does the app actually work?)
      - Build     (does it even compile?)
              │
      ┌───────┴────────┐
      │                │
   ALL PASS          SOMETHING FAILS
      │                │
      v                v
  PR shows a        PR shows a red X —
  green checkmark   merging is blocked
  — safe to merge   (or at least strongly discouraged)
```

### Continuous Deployment (CD)

**CD** picks up right where CI leaves off: once the checks pass, automatically deploy the result — no human has to manually trigger it, remember the deploy command, or SSH into a server.

Put both together and you get a **pipeline** — one continuous flow from "I pushed code" to "it's live," with automated safety checks at every step:

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Full CI/CD Pipeline                          │
│                                                                   │
│   git push  ──────►  GitHub receives the commit / PR             │
│                              │                                   │
│                              v                                   │
│                    CI runs: lint → test → build                 │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    │                   │                         │
│                 ALL PASS           ANYTHING FAILS                │
│                    │                   │                         │
│                    v                   v                         │
│              CD deploys           Pipeline stops.                │
│                    │              Nothing gets deployed.         │
│           ┌────────┴────────┐    Author sees exactly which       │
│           │                 │    step failed and why.            │
│      Is this a PR?     Is this the                                │
│           │            main branch?                               │
│           v                 v                                     │
│    Deploy a UNIQUE     Deploy to                                  │
│    PREVIEW URL         PRODUCTION URL                              │
│    for this PR         (the real, live app)                       │
└──────────────────────────────────────────────────────────────────┘
```

Notice the branch at the bottom — this is the detail people often miss. A single pipeline definition produces *two different outcomes* depending on where the push came from: a throwaway preview URL for a branch/PR, or the real production URL for the main branch. Same checks, same automation, different destination. We'll come back to why the preview URL branch is such a big deal in Section 7.

---

## 5. A Concrete GitHub Actions Workflow

Let's stop talking in the abstract and look at an actual workflow. GitHub Actions is GitHub's built-in automation tool — you describe your pipeline in a YAML file, and GitHub runs it on GitHub's own servers ("runners") every time the conditions you specify are met.

This file would live at `.github/workflows/ci.yml` in your repository:

```yaml
name: CI

# Run this workflow on every push to main, and on every pull request
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      # Step 1: get the code onto the runner's machine
      - name: Checkout code
        uses: actions/checkout@v4

      # Step 2: install Node.js itself on the runner
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Step 3: install exactly what's in package-lock.json — reproducible installs
      - name: Install dependencies
        run: npm ci

      # Step 4: catch style issues and obvious mistakes early
      - name: Run linter
        run: npm run lint

      # Step 5: run the test suite
      - name: Run tests
        run: npm test

      # Step 6: make sure the app actually builds for production
      - name: Build
        run: npm run build
```

Walk through this top to bottom and notice how it mirrors the pipeline diagram exactly: checkout, install, lint, test, build. If any single step fails — say, `npm test` exits with a failing test — GitHub Actions stops right there. It never even attempts the build step, and it marks the whole workflow as failed on the PR.

Deployment platforms like Vercel and Netlify typically hook into this same flow. In many setups, you don't even need to write your own deploy step in this file — connecting your repo to Vercel/Netlify means *they* watch for pushes and handle checkout-build-deploy on their own infrastructure. But it's just as common to see an explicit deploy step added at the end of a workflow like this one, using the platform's official GitHub Action, once all the checks above have passed:

```yaml
      # Step 7 (only after everything above succeeds): deploy
      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: echo "Deploy step would trigger here, e.g. via the hosting platform's CLI/action"
```

The `if: github.ref == 'refs/heads/main'` condition is doing exactly what the pipeline diagram showed — only deploy to production when this run was triggered by the main branch, not by just any PR branch.

> **Memory hook:** "Checkout, install, lint, test, build — deploy only if every single one turns green."

---

## 6. Environment-Specific Configuration

If you've already covered environment variables earlier in this phase, you know the basic idea: your app needs different values depending on where it's running — a local API URL during development, a different one in production.

Deployment is where this stops being a "nice to have" and becomes something you must get right, because now there isn't just one environment anymore — there are (at minimum) three:

```text
Development        Staging                  Production
─────────────       ────────────              ─────────────
Runs on your        Runs on a deployed        Runs on the real,
own laptop           preview/staging URL       public production URL
                                                
API_URL points to    API_URL points to a       API_URL points to the
localhost:4000       staging backend with      real production backend
                      fake/test data
```

Each of those needs its own configuration values — different API URLs, different feature flags, maybe different analytics keys (you don't want your local development clicks polluting real production analytics).

Every major hosting platform lets you define environment variables *per environment* directly in its dashboard — one set of values for "Production," a different set for "Preview"/"Staging," and your `.env.local` file (never committed) covers development on your own machine. The key discipline is: the same codebase, same build command, runs unmodified in all three — only the environment variables change underneath it. You are never maintaining three different copies of your app; you're maintaining one app and three sets of configuration values.

---

## 7. Preview Deployments

This is, in practice, one of the most genuinely useful features in modern frontend workflows — and it directly follows from the CI/CD pipeline diagram in Section 4.

**Here's the situation it solves.** A teammate opens a pull request titled "Redesign checkout button." How do you review that? The old-fashioned way is: read the diff, imagine what the button looks like in your head, maybe pull the branch locally and run it yourself if you're diligent. That's slow, and it's easy to approve something that *reads* fine in a diff but looks or behaves wrong in the actual browser.

**Preview deployments fix this directly.** Platforms like Vercel and Netlify automatically build *every single pull request* and publish it to its own unique, temporary URL — something like `my-app-git-redesign-checkout-btn.vercel.app`. That URL shows up right there as a comment or a status check on the PR itself.

```text
PR opened: "Redesign checkout button"
              │
              v
   CI/CD pipeline runs (same lint/test/build as always)
              │
              v
   Build succeeds → a UNIQUE preview URL is generated
   just for this PR — separate from production, separate
   from every other open PR
              │
              v
   Reviewer clicks the URL right from the PR page
              │
              v
   Reviewer clicks the actual new checkout button,
   in a real running app, before approving anything
```

Why does this matter so much in practice? Because now the reviewer isn't reasoning about code changes in the abstract — they are clicking the actual button, on the actual page, exactly as a real user would experience it. A designer with zero interest in reading a diff can still open the preview link and say "the padding's off" or "yes, ship it." A product manager can try the new flow themselves before it ever reaches a real customer.

And it's not just for humans reviewing manually — automated end-to-end tests can also point at that same preview URL, testing the *actual deployed change*, not a local approximation of it.

The other underrated benefit: every PR gets its own isolated URL. Ten open PRs means ten separate, non-conflicting preview environments, all running simultaneously, none of them anywhere near your real production app or its real users.

> **Memory hook:** "Don't just describe the new coat of paint in a memo — hand everyone a key to walk through the actual freshly painted room."

---

## 8. Static Hosting vs Server Hosting — Comparison

| | Static Hosting (CSR/SSG) | Server/Serverless Hosting (SSR) |
|---|---|---|
| What's deployed | Pre-built HTML/CSS/JS files | Executable server-side rendering code |
| When HTML is generated | Once, at build time | Fresh, on every request |
| Where it runs | CDN edge locations, globally | Serverless functions (or a traditional server) |
| Personalization per request | Not natively (handled client-side after load) | Natively — can use request-specific data |
| Typical example platforms | Vercel, Netlify, Cloudflare Pages (static mode) | Vercel, Netlify (with SSR/Edge functions) |
| Cold-start concerns | None — files are just served | Possible, depending on the runtime/platform |
| Best fit | Marketing sites, docs, dashboards with client-fetched data | Pages needing fresh, per-request or personalized server-rendered HTML |

Worth noting: Vercel and Netlify both handle *either* case — the distinction isn't really "which platform," it's "which rendering strategy your app actually uses." A single Next.js project can even mix both: some pages statically generated, others server-rendered, deployed to the same platform, which automatically figures out which is which.

---

## 9. Common Mistakes

**Mistake 1 — CI runs different commands than you run locally.**

If you run `npm run test:watch` locally but your CI workflow runs a completely different test command (or skips linting that you always mean to run "later"), you get the classic "works on my machine" surprise: it passed for you, it fails — or worse, silently behaves differently — the moment it hits CI or production. The fix is boring but important: make your CI workflow run the *exact same* scripts defined in `package.json` that you'd run locally. `npm run lint`, `npm test`, `npm run build` — same commands, same order, everywhere.

**Mistake 2 — committing secrets directly into the repository.**

An API key pasted straight into a `.env` file that gets committed, or hardcoded into a config file "just for now," is now permanently in your git history — even if you delete it in a later commit, it's still recoverable by anyone who clones the repo. Secrets belong in your CI/CD platform's secret storage (GitHub Actions secrets, or your hosting platform's environment variable dashboard marked as sensitive), injected at build/deploy time, never checked into source control.

**Mistake 3 — deploying straight to production with no staging or preview step.**

Skipping straight from "merged to main" to "live for every user" means the first place you ever see your change running for real is in front of your actual customers. Preview deployments (Section 7) exist specifically to give you — and reviewers — a safe, real environment to catch problems *before* that jump.

**Mistake 4 — forgetting that client-bundled env vars are visible to anyone, at deploy time too.**

This is worth repeating at the deployment stage, not just when you first learn about env vars: any environment variable that gets bundled into your client-side JavaScript (in Vite, anything prefixed `VITE_`; in Next.js, anything prefixed `NEXT_PUBLIC_`) ends up sitting in plain text in the files your CDN serves to every visitor's browser. It doesn't matter how carefully you configured it in your hosting platform's "Production" environment settings — if it's a client-exposed variable, anyone can open dev tools, view the bundled source, and read it. Never put a real secret (a private API key, a database password) behind one of these prefixes. True secrets stay server-side only, used inside serverless functions or SSR code that never ships to the browser.

---

## 10. Hands-On Exercises

**Exercise 1 — Diagram your own pipeline**

Take an app you've built (or the sample app from earlier phases in this course). Sketch out, in your own ASCII diagram, what a full CI/CD pipeline for it would look like: which checks run on every push, and where the production and preview deploys would go. Be specific about the commands (`npm run lint`, `npm test`, etc.) rather than generic labels.

**Exercise 2 — Write a GitHub Actions workflow**

Write a `.github/workflows/ci.yml` file for a React + Vite project that: runs on every push and pull request targeting `main`, checks out the code, sets up Node 20, installs dependencies with `npm ci`, runs `npm run lint`, runs `npm test`, and runs `npm run build`. Do not include a deploy step yet.

**Exercise 3 — Add environment-specific configuration**

Extend the workflow from Exercise 2 so that the build step has access to a `VITE_API_URL` environment variable sourced from GitHub Actions secrets. Explain, in your own words, why this value would differ between a "staging" run and a "production" run, and where each value should actually be configured.

**Exercise 4 — Preview deployment walkthrough**

Write out, step by step, what happens from the moment a developer opens a pull request to the moment a reviewer is looking at a live, clickable preview of the change. Include the CI checks, the build, and the point at which the unique preview URL becomes available.

**Exercise 5 — Spot the mistakes**

Below is a (deliberately flawed) CI workflow. List every mistake in it, referencing the "Common Mistakes" section:

```yaml
name: CI
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm run build
      - name: Deploy
        run: curl -X POST https://api.example.com/deploy?key=sk_live_abc123xyz
```

**Exercise 6 — CSR/SSG vs SSR hosting decision**

You're building two apps: (a) a marketing landing page with no personalized content, and (b) a logged-in dashboard that must show each user's own live data on every page load. For each, decide whether static hosting or server/serverless hosting is the right fit, and justify it using what you learned in Sections 2 and 3.

---

## 11. Interview Q&A

**Q1: What's the difference between Continuous Integration and Continuous Deployment?**

A: Continuous Integration automatically runs checks — linting, tests, and the build — every time code is pushed or a pull request is opened, catching problems before they merge. Continuous Deployment picks up after CI passes and automatically deploys the result, without a human manually triggering it. Together they form a pipeline: push code, checks run automatically, and if everything passes, the app deploys automatically too.

---

**Q2: Why can't you host a Next.js app with SSR pages on a purely static hosting platform?**

A: Static hosting serves pre-built files that never change per request — there's no code execution happening when a user visits. SSR pages, by definition, generate their HTML fresh on every request, often using request-specific data. That requires a runtime that can execute code per request, which static file hosting doesn't provide. SSR needs a server or serverless function environment instead.

---

**Q3: What is a CDN, and why does it matter for a React app's load time?**

A: A CDN (Content Delivery Network) is a network of servers distributed globally that all hold copies of the same static files. Instead of every user's request traveling to one central server, it's served from an edge location physically close to that user, which significantly reduces load time, especially for users far from wherever the "origin" server would otherwise be.

---

**Q4: What are serverless functions, and how do they relate to hosting an SSR app?**

A: Serverless functions are small units of server-side code that a platform runs on demand, per request, without you provisioning or managing the underlying server. Platforms like Vercel deploy an SSR app's per-request rendering logic as serverless functions, so developers get the benefits of server-side execution (fresh HTML per request) without operating actual servers themselves.

---

**Q5: What is a preview deployment, and why is it valuable for a frontend team?**

A: A preview deployment is a unique, temporary URL automatically built and published for a specific pull request, showing exactly what the app looks like with that PR's changes applied. It's valuable because reviewers — including non-technical stakeholders — can click through and interact with the actual running change before it merges, rather than trying to mentally reconstruct behavior from a code diff.

---

**Q6: Describe a typical GitHub Actions CI workflow for a React app, step by step.**

A: Checkout the repository code, set up the correct Node.js version, install dependencies (typically with `npm ci` for reproducible installs), run the linter, run the test suite, then run the production build. If any step fails, the workflow stops and the pull request is marked failing; if all steps succeed, the workflow can proceed to a deploy step.

---

**Q7: Why should CI run the exact same commands you'd run locally?**

A: If CI runs different commands (or skips steps) compared to what a developer runs on their own machine, you get inconsistent results — code that "works" locally can fail or misbehave once it hits the pipeline or production, the classic "works on my machine" problem. Keeping CI's commands identical to the `package.json` scripts developers already use locally ensures the same checks are applied everywhere.

---

**Q8: Where should API keys and other secrets be stored for a CI/CD pipeline, and why not just commit them to the repo?**

A: Secrets should be stored in the CI/CD platform's dedicated secret storage (like GitHub Actions secrets) or the hosting platform's environment variable dashboard, and injected at build or deploy time. Committing them directly into the repository puts them permanently into git history — even deleting them in a later commit doesn't remove them from history, so anyone with repo access (now or in the future) could recover them.

---

**Q9: What's the risk of skipping a staging or preview step and deploying straight to production?**

A: The first environment where the change is actually observed running is production, in front of real users — meaning any bug, visual regression, or broken flow is discovered by customers instead of by the team. A staging or preview step gives a safe, realistic environment to catch issues before they reach the live app.

---

**Q10: Why are client-exposed environment variables (like `VITE_`- or `NEXT_PUBLIC_`-prefixed ones) not suitable for secrets, even after deployment?**

A: Any environment variable bundled into client-side JavaScript ends up shipped as plain text in the files served to every visitor's browser, regardless of how it was configured on the hosting platform's dashboard. Anyone can view the deployed source and read it. True secrets must stay server-side only — used inside serverless functions or server-rendering code that never gets sent to the browser.

---

**Q11: How does a single CI/CD pipeline definition produce both preview deployments and a production deployment?**

A: The same pipeline (checkout, install, lint, test, build) runs regardless of which branch triggered it, but the deploy step branches on the source: if the push came from a pull request/feature branch, it deploys to a unique preview URL; if it came from the main branch, it deploys to the production URL. The checks are identical either way — only the deployment destination differs.

---

**Q12: What's the practical difference between development, staging, and production environments in a deployment pipeline?**

A: Development runs locally on a developer's machine with local or mocked configuration. Staging (often realized via preview deployments) runs a deployed build against test/staging data and services, letting the team validate changes in a real hosted environment before they're customer-facing. Production is the live app real users interact with, using real data and real backend services. The same codebase and build process runs in all three; only the environment variables and configuration differ.

---

**Q13: Why is `npm ci` typically preferred over `npm install` inside a CI workflow?**

A: `npm ci` installs dependencies strictly according to `package-lock.json`, deleting and rebuilding `node_modules` from that exact lockfile rather than potentially resolving slightly different versions. This produces a reproducible install every time the pipeline runs, avoiding subtle "it worked yesterday but not today" dependency drift that `npm install` can introduce.

---

**Q14: A teammate says "why do we even need CI/CD, we can just deploy manually when we're ready?" How do you respond?**

A: Manual deployment relies on a human remembering every step correctly every time — running tests, running the linter, using the right build command — with no guarantee any of that actually happened before code reaches users. CI/CD makes those checks non-negotiable and automatic: every push gets linted, tested, and built the same way, and a failing check blocks deployment outright. It also removes the toil of manually re-uploading files after every change, and unlocks features like preview deployments that a manual process can't easily offer.

---

**Q15: In one sentence, what problem does CI/CD solve for a frontend team?**

A: CI/CD replaces manual, error-prone, easy-to-forget steps — running tests, building correctly, uploading files — with an automated pipeline that consistently checks every change before it merges and consistently deploys it once it's safe, catching mistakes before real users ever see them.

---

> **Memory hook:** "CI/CD is the assembly-line inspector — the same checks, run automatically, on every single thing that tries to ship."
