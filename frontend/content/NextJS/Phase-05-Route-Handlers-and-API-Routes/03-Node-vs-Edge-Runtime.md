# Node.js vs Edge Runtime — Complete Guide

> "Same recipe, two different kitchens — one has every appliance you've ever heard of, the other fits in a van and shows up closer to the customer."

---

## Table of Contents

1. [The Problem: Route Handlers Don't All Run in the Same Place](#1-the-problem-route-handlers-dont-all-run-in-the-same-place)
2. [The Full Kitchen and the Camping Stove Analogy](#2-the-full-kitchen-and-the-camping-stove-analogy)
3. [The Mechanism: The runtime Export](#3-the-mechanism-the-runtime-export)
4. [What the Edge Runtime Restricts](#4-what-the-edge-runtime-restricts)
5. [Diagram: Deployment Topology, Node vs Edge](#5-diagram-deployment-topology-node-vs-edge)
6. [Code Walkthrough: A Working Edge Handler and One That Isn't](#6-code-walkthrough-a-working-edge-handler-and-one-that-isnt)
7. [Comparing Node.js Runtime and Edge Runtime](#7-comparing-nodejs-runtime-and-edge-runtime)
8. [Common Mistakes](#8-common-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Route Handlers Don't All Run in the Same Place

Lessons 1 and 2 wrote handlers as if "the server" were one uniform place with the full Node.js standard library always available. Next.js actually offers a Route Handler (and Middleware, Phase 7) a choice between two different JavaScript execution environments — and code written assuming one can fail outright in the other.

```text
Works locally → deploys → throws immediately
  ↳ A database driver, a Node-specific crypto library, anything
    reaching into fs or other native Node modules simply isn't
    available in the environment it ended up running in.
```

---

## 2. The Full Kitchen and the Camping Stove Analogy

The **Node.js runtime** is a fully-equipped kitchen — every appliance installed and plumbed in, built in a smaller number of well-resourced locations. The **Edge runtime** is a compact camping stove, deployed by the truckload to dozens of locations close to the customer — fewer tools, but nearly everywhere at once.

```text
Node.js runtime → full kitchen     → complete toolset, fewer locations
Edge runtime    → camping stove    → focused toolset, deployed everywhere, closer to the customer
```

Neither is "better" in the absolute — the right choice depends entirely on what the recipe (the handler's code) actually needs.

---

## 3. The Mechanism: The runtime Export

```js
// app/api/example/route.js
export const runtime = 'nodejs'; // the default if omitted
```

```js
// app/api/example/route.js
export const runtime = 'edge';
```

```text
runtime omitted entirely → 'nodejs' (default) — full Node.js API surface,
                            npm packages depending on Node-specific modules work
runtime = 'edge'          → restricted, distributed Edge runtime

Per-file setting
  ↳ Different Route Handlers in the same app can make different choices.
```

---

## 4. What the Edge Runtime Restricts

```text
Edge runtime HAS:
  fetch, Request, Response, URL, Web Crypto (crypto.subtle)

Edge runtime does NOT have:
  fs (filesystem access)
  native TCP / database socket connections
  arbitrary native Node addons
```

A small, standardized set of Web APIs is exactly what lets Edge be deployed compactly, in large numbers, close to end users, without carrying the full weight of a Node.js installation everywhere. A package that internally calls `fs`, opens a raw database socket, or otherwise assumes full Node.js fails outright the moment it executes in an Edge handler — the API it's reaching for genuinely does not exist there.

---

## 5. Diagram: Deployment Topology, Node vs Edge

```text
Node.js runtime deployment
        │
        ▼
A smaller number of full server regions
(each fully capable, but a request may
travel farther to reach the nearest one)


Edge runtime deployment
        │
        ▼
Many distributed edge locations, spread
geographically close to end users
(each more limited in capability, but a
request typically reaches one nearby,
often with lower network latency)
```

Fewer, fully-capable Node.js locations versus many, more restricted Edge locations closer to wherever requests come from. Neither topology wins in every case — a Node.js region near a user isn't meaningfully slower than an Edge location would be — but Edge's advantage compounds specifically for globally distributed traffic, where "nearest available location" varies request to request.

---

## 6. Code Walkthrough: A Working Edge Handler and One That Isn't

A handler needing only `fetch` and Web Crypto is a natural fit for Edge:

```js
// app/api/hash/route.js
export const runtime = 'edge';

export async function POST(request) {
  const { text } = await request.json();
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return Response.json({ hash: hashHex });
}
```

```text
Request/Response, TextEncoder, crypto.subtle
  ↳ All standard Web APIs — present in Edge, no Node dependency at all.
```

Contrast with a handler needing a Node-only database driver:

```js
// app/api/orders/route.js
export const runtime = 'nodejs'; // required — the driver below needs full Node.js

import { Pool } from 'pg'; // a Node-only PostgreSQL driver

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  const { rows } = await pool.query('SELECT * FROM orders LIMIT 10');
  return Response.json(rows);
}
```

`pg` opens raw TCP connections internally — functionality Edge's restricted surface doesn't provide. Setting `runtime = 'edge'` here, despite looking like a harmless one-line change, breaks it outright the moment it tries to connect, because the networking primitive `pg` depends on isn't available there.

---

## 7. Comparing Node.js Runtime and Edge Runtime

| Aspect | Node.js Runtime | Edge Runtime |
|---|---|---|
| API surface | Full Node.js standard library, plus any npm package | Restricted to Web-standard APIs (`fetch`, `Request`/`Response`, Web Crypto) |
| Cold start latency | Typically higher — fuller environment to initialize | Typically lower — lightweight, purpose-built |
| Geographic distribution | Fewer, centralized full server regions | Many distributed locations, closer to end users |
| Typical use | Database drivers, filesystem access, heavy Node-dependent libraries | Lightweight logic close to the user: transforms, auth checks, geolocation redirects |
| Default if `runtime` omitted | Yes | No — must be explicitly opted into |

Default to Node.js unless a handler has a concrete reason to want Edge — a genuinely latency-sensitive endpoint serving globally distributed traffic, whose logic only touches standard Web APIs with no Node-only dependency anywhere in its call chain. The moment a handler needs a database driver, filesystem access, or any other Node built-in, that decision is already made — it stays on Node.js regardless of how appealing Edge's latency sounds.

---

## 8. Common Mistakes

- **Setting `runtime = 'edge'` on a handler that imports a Node-only package.** The most common failure mode here — a database driver, `fs`, or any Node-specific package fails outright under Edge. Check what a handler's dependencies actually require before opting into Edge.
- **Assuming Edge is "always faster" and defaulting everything to it.** Edge's latency advantage comes from geographic distribution and a lighter cold start — it doesn't make restricted-but-necessary Node functionality suddenly available.
- **Forgetting `runtime` is per-file, not app-wide.** Different Route Handlers in the same project can make different choices — mixing them deliberately, per handler, is normal.
- **Not verifying version-specific defaults before relying on them.** Exactly which APIs are available under Edge has evolved across Next.js releases — double check against your installed version's current docs rather than committing it to memory as permanently fixed.

---

## 9. Hands-On Exercises

**Exercise 1:** Create `app/api/hash/route.js` exactly as in Section 6, with `runtime = 'edge'`, accepting a `text` field in a POST body and returning its SHA-256 hash via Web Crypto. Confirm the returned hash against a hash computed with an independent tool.

**Exercise 2:** Create `app/api/info/route.js` with no `runtime` export (defaulting to `nodejs`), importing Node's built-in `os` module and returning `Response.json({ platform: os.platform() })`. Confirm it works, then add `export const runtime = 'edge';` to the same file and observe the resulting error.

**Exercise 3:** Time several requests to the Edge `/api/hash` handler versus the Node `/api/info` handler using your browser's network tab, and write one sentence on why a local test may not fully reflect Section 5's geographic-distribution advantage.

**Exercise 4:** Pick the dynamic `app/api/users/[id]/route.js` GET handler and write a one-paragraph justification for whether it's a reasonable candidate for Edge as written, based on what it actually imports and does.

**Exercise 5:** Write a one-paragraph recommendation for which runtime you'd choose for each of: a handler checking a request's geolocation header and returning a redirect suggestion; a handler querying a full relational database for a paginated report; a handler hashing a password using Web Crypto before storing it — justifying each choice using Section 7's table.

---

## 10. Interview Q&A

**Q: What's the core difference between the Node.js runtime and the Edge runtime in Next.js?**
The Node.js runtime provides the full Node.js API surface, including Node-specific modules and any npm package built around them, typically running in a smaller number of centralized server locations. The Edge runtime is restricted to standard Web APIs (`fetch`, `Request`/`Response`, Web Crypto) and excludes most Node built-ins, but runs in many geographically distributed locations, generally with a faster cold start.

**Q: How does a Route Handler select which runtime it uses?**
By exporting a `runtime` constant set to `'nodejs'` or `'edge'`. `'nodejs'` is the default if omitted; setting it to `'edge'` opts that specific file into the restricted, distributed Edge runtime. This is a per-file choice, not an app-wide setting.

**Q: Why would a Route Handler that works fine locally suddenly fail after being deployed with `runtime = 'edge'`?**
Most commonly because it imports a package depending on Node-specific functionality — a database driver opening raw TCP sockets, `fs` filesystem access, or another Node built-in — none of which exists in Edge's restricted surface. The fix is removing that dependency in favor of an Edge-compatible alternative, or setting `runtime = 'nodejs'` on that handler instead.

**Q: Is the Edge runtime always the faster choice?**
Not universally. Its advantage comes from being deployed to many locations close to end users and from a lighter cold start, particularly benefiting globally distributed traffic. It doesn't make restricted Node functionality available, and for a handler already running near its users under Node, or one that genuinely needs full Node APIs, forcing it onto Edge adds constraints without necessarily improving performance.

**Q: What kind of Route Handler logic is a good fit for the Edge runtime?**
Lightweight logic needing only standard Web APIs — reading headers, outbound `fetch` calls, simple data transforms, hashing via Web Crypto, geolocation-based redirects — especially where being served close to the requester matters. Anything requiring a Node-only database driver, filesystem access, or other Node-specific built-ins should stay on the Node.js runtime.
