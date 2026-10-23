# Route Handler Basics — Complete Guide

> "A page renders a room for the visitor to sit in; a Route Handler just hands them a package and lets them leave."

---

## Table of Contents

1. [The Problem: Not Every Request Wants HTML Back](#1-the-problem-not-every-request-wants-html-back)
2. [The Service Counter Analogy](#2-the-service-counter-analogy)
3. [The Mechanism: route.js and HTTP-Named Exports](#3-the-mechanism-routejs-and-http-named-exports)
4. [Diagram: How a Request Reaches a Route Handler](#4-diagram-how-a-request-reaches-a-route-handler)
5. [Code Walkthrough: A Minimal GET Handler](#5-code-walkthrough-a-minimal-get-handler)
6. [Route Handlers Are Not Server Components](#6-route-handlers-are-not-server-components)
7. [Comparing page.js and route.js](#7-comparing-pagejs-and-routejs)
8. [Common Mistakes](#8-common-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Not Every Request Wants HTML Back

Every page built through Phase 4 answers a browser with rendered HTML. But a mobile app polling for notifications, a webhook from a payment provider, or your own "Delete" button all want a raw response back — not a `<div>`. A Server Component can't produce that; its contract is "return JSX," full stop.

```text
Browser  → wants HTML         → page.js handles this
Mobile app → wants JSON       → page.js CANNOT handle this
Webhook  → wants a status code → page.js CANNOT handle this
```

Next.js's answer is the **Route Handler**: an endpoint inside `app/` that returns a raw `Response` instead of a rendered page.

---

## 2. The Service Counter Analogy

A restaurant's dining room plates a meal and serves it in place — that's a page, rendered HTML ready to look at. The to-go counter hands over a sealed container with no plating at all — that's a Route Handler, raw contents for the caller to open wherever they're actually going.

```text
Dining room  → table, server, plated meal    → page.js  → rendered HTML
To-go counter → sealed container, no plating → route.js → raw Response (JSON, file, redirect...)
```

Same kitchen, same building, two different kinds of orders — one is consumed on the spot, the other is packaged for someone else to unwrap.

---

## 3. The Mechanism: route.js and HTTP-Named Exports

A Route Handler is a file named `route.js` (or `route.ts`) inside a folder under `app/`. Instead of a default-exported component, it exports named functions matching HTTP methods.

```js
// app/api/hello/route.js
export async function GET(request) { /* ... */ }
export async function POST(request) { /* ... */ }
export async function DELETE(request) { /* ... */ }
```

```text
Supported method exports: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
  ↳ Next.js matches the incoming HTTP method to the export of the same name.
  ↳ Each function receives a Web `Request` and must return a `Response` (or `NextResponse`).
```

The folder path still determines the URL, exactly like `page.js`. Because of that shared URL, **a single folder segment cannot contain both a `page.js` and a `route.js`** — Next.js refuses to build if both exist at the same level, since there'd be no unambiguous answer for what an incoming request should get back.

---

## 4. Diagram: How a Request Reaches a Route Handler

```text
GET request arrives for /api/hello
        │
        ▼
Next.js looks for app/api/hello/route.js
        │
        ▼
Found — file exports a function named GET
        │
        ▼
Next.js invokes GET(request)
        │
        ▼
GET(request) returns Response.json({...})
        │
        ▼
That Response is sent back as-is — no HTML rendering step at all
```

No Server/Client Component tree, no hydration. The return value of the handler *is* the final HTTP response, byte for byte.

---

## 5. Code Walkthrough: A Minimal GET Handler

```js
// app/api/hello/route.js

export async function GET() {
  return Response.json({ message: 'hello' });
}
```

```text
GET() with no arguments
  ↳ No params, no query string needed here — the simplest possible handler.

Response.json({ message: 'hello' })
  ↳ 200 status, Content-Type: application/json — set automatically.

No default export
  ↳ Unlike every page.js so far — a Route Handler is identified purely
    by its named HTTP-method exports.
```

Multiple methods can live in the same file; each fires only for its own method.

```js
// app/api/hello/route.js

export async function GET() {
  return Response.json({ message: 'hello' });
}

export async function POST() {
  return Response.json({ message: 'received' }, { status: 201 });
}
```

A request with a method that has no matching export (e.g. `DELETE` here) gets Next.js's default `405 Method Not Allowed` automatically — no extra code required.

---

## 6. Route Handlers Are Not Server Components

A Route Handler isn't on either side of Phase 3's Server/Client boundary — it never returns JSX and never joins the React component tree.

```text
Server Component        → (props) => JSX → rendered to HTML
Route Handler           → (Request) => Response → sent as-is, no rendering step

Server-to-Client prop serialization rules (Phase 3)?
  ↳ Do not apply here — there's no Client Component on the other end
    waiting to receive props. The caller is raw HTTP: fetch, curl,
    a mobile app, a webhook sender — it parses the Response itself.
```

---

## 7. Comparing page.js and route.js

| Aspect | `page.js` | `route.js` |
|---|---|---|
| Returns | JSX, eventually rendered to HTML | A `Response` (JSON, text, redirect, etc.) |
| Typical caller | A browser navigating to a URL | Mobile app, webhook, `fetch` call |
| Default export required? | Yes | No — named HTTP-method exports |
| Coexist in same folder segment? | No | No |
| Rendering pipeline involved? | Yes — Server/Client tree, hydration | No — return value is the final response |

Reach for `page.js` when a human will look at it in a browser tab; reach for `route.js` whenever the caller isn't a browser tab, or a browser-side script wants raw data instead of a new page. If a single URL genuinely needs both, that means two separate paths — a `page.js` in one segment, a `route.js` under a different one (often `app/api/...`) — not one file trying to do both jobs.

---

## 8. Common Mistakes

- **`page.js` and `route.js` in the same folder segment.** Both compete to answer the same URL in incompatible ways — Next.js treats it as a build error. Fix: move API logic to its own segment, commonly `app/api/...`.
- **Assuming `GET` always runs fresh, with zero caching.** Caching behavior for plain `GET` Route Handlers has shifted across Next.js versions — verify against your installed version's docs rather than assuming "always fresh" or "always cached."
- **Forgetting to return a `Response`.** Returning `undefined`, a plain object, or nothing produces no valid HTTP response — every exported method function must construct and return a `Response` (or `NextResponse`).
- **Expecting layout inheritance.** A Route Handler isn't part of the layout tree — it doesn't render inside any parent `layout.js`.

---

## 9. Hands-On Exercises

**Exercise 1:** Create `app/api/hello/route.js` with a `GET` returning `Response.json({ message: 'hello' })`. Visit `/api/hello` in a browser tab and confirm you see raw JSON, not a rendered page.

**Exercise 2:** Add a `POST` export returning `Response.json({ message: 'received' }, { status: 201 })`. Send a POST via `curl` or `fetch('/api/hello', { method: 'POST' })` from the browser console and confirm the `201` and body.

**Exercise 3:** Send a `DELETE` to `/api/hello` (no `DELETE` export exists) and record the status code Next.js returns automatically.

**Exercise 4:** Create `app/api/status/route.js` with only a `GET` exporting `Response.json({ ok: true, timestamp: Date.now() })`. Confirm it responds independently of `/api/hello`.

**Exercise 5:** Add a trivial `app/api/status/page.js` alongside the existing `route.js` from Exercise 4. Run your build and record the exact error Next.js produces.

---

## 10. Interview Q&A

**Q: What is a Route Handler in the Next.js App Router?**
A Route Handler is a `route.js` (or `route.ts`) file inside `app/` that exports functions named after HTTP methods (`GET`, `POST`, etc.), each receiving a `Request` and returning a `Response`. It lets a URL respond with raw data — JSON, a redirect, a file, plain text — something a Server Component's default-exported-JSX contract cannot do.

**Q: Can a folder have both a `page.js` and a `route.js` at the same segment level?**
No. Both are keyed to the exact same URL, and Next.js has no unambiguous way to decide whether an incoming request should get a rendered page or a raw Route Handler response, so having both in one segment is a build error.

**Q: Is a Route Handler a Server Component or a Client Component?**
Neither. It never returns JSX and never joins the React component tree, so Phase 3's Server/Client boundary rules — including prop serialization — don't apply. It's a separate execution path whose only job is to compute and return a `Response`.

**Q: What does a Route Handler's exported `GET` function need to return?**
A standard Web `Response` — or `NextResponse`, a Next.js convenience wrapper — such as one produced by `Response.json({...})`. Returning a plain object, `undefined`, or nothing does not produce a valid HTTP response.

**Q: Why use a Route Handler instead of just fetching data inside a Server Component?**
A Server Component's data fetching only feeds its own rendered output — it isn't reachable as an independent HTTP endpoint by an external caller. A Route Handler is needed whenever something other than your own page-rendering pipeline needs to talk to your app over HTTP: a mobile client, a webhook receiver, a third-party integration, or your own client-side `fetch` calls wanting raw JSON instead of a page reload.
