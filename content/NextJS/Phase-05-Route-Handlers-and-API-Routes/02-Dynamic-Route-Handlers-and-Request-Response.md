# Dynamic Route Handlers and Request/Response — Complete Guide

> "The path tells you who; the query string tells you how; the body tells you what — and a Route Handler has to read all three, separately, on purpose."

---

## Table of Contents

1. [The Problem: A Route Handler Needs More Than Just "Which URL"](#1-the-problem-a-route-handler-needs-more-than-just-which-url)
2. [The Shipping Clerk Analogy](#2-the-shipping-clerk-analogy)
3. [Dynamic Segments: Reading params](#3-dynamic-segments-reading-params)
4. [Reading Query Parameters](#4-reading-query-parameters)
5. [Reading the Request Body](#5-reading-the-request-body)
6. [Diagram: A POST /api/users Request, Start to Finish](#6-diagram-a-post-apiusers-request-start-to-finish)
7. [Code Walkthrough: Validating a Body and Shaping a Response](#7-code-walkthrough-validating-a-body-and-shaping-a-response)
8. [Comparing params, Query String, and Body](#8-comparing-params-query-string-and-body)
9. [Common Mistakes](#9-common-mistakes)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Problem: A Route Handler Needs More Than Just "Which URL"

Lesson 1's handler took no input at all. Real endpoints need three different channels of caller-supplied data: which resource (`/api/users/42`), optional filters (`?role=admin`), and — for writes — an actual payload that doesn't fit in a URL at all.

```text
/api/users/42            → path segment  → "which resource"
/api/users?role=admin    → query string  → "how / which subset"
POST body: {"name":"Alice"} → request body → "what data"
```

Each channel needs its own code to read it — a handler that only knows one is only equipped for one narrow shape of request.

---

## 2. The Shipping Clerk Analogy

A shipping clerk reads the address label (fixed, structural — like a path segment), checks the packing slip taped alongside it for handling instructions ("fragile," "expedite" — like a query string), then opens the box for the actual contents (the payload — like a request body).

```text
Address label  → where it's headed         → path param   → /api/users/42
Packing slip   → extra handling instructions → query string → ?role=admin
Box contents   → the actual shipment         → request body → { name, email }
```

Nothing here is inferred by glancing at one channel — the clerk, like the handler, checks all three separately and deliberately.

---

## 3. Dynamic Segments: Reading params

A bracketed folder segment — `app/api/users/[id]/route.js` — captures a variable path piece. Next.js invokes the handler with a second argument containing `params`.

```js
// app/api/users/[id]/route.js

export async function GET(request, { params }) {
  const { id } = await params;
  return Response.json({ id, name: `User ${id}` });
}
```

```text
{ params }
  ↳ Second argument to the handler function.

await params
  ↳ In recent Next.js versions params is a Promise that must be
    awaited before its fields are readable — the same treatment
    given to page-level params. This has changed across versions,
    so verify it against your installed version's docs; this lesson
    treats params as awaited consistently throughout.
```

---

## 4. Reading Query Parameters

Query parameters — everything after `?` — are not part of `params`; they live on the request's URL and are read separately.

```js
// app/api/users/route.js

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const active = searchParams.get('active');

  return Response.json({ filters: { role, active } });
}
```

```text
new URL(request.url).searchParams
  ↳ Standard Web API — works with any plain Request.

request.nextUrl.searchParams
  ↳ Next.js convenience equivalent, available because Next.js
    wraps the request as a NextRequest.

searchParams.get('role')
  ↳ Returns the string value, or null if absent — no automatic
    type coercion. "active=true" arrives as the string "true",
    not a boolean.
```

---

## 5. Reading the Request Body

A body — sent with `POST`, `PUT`, `PATCH` — is read via an async method on the `Request` object.

```js
// app/api/users/route.js

export async function POST(request) {
  const body = await request.json();
  return Response.json({ received: body }, { status: 201 });
}
```

```text
await request.json()
  ↳ Async because reading a body is I/O — the full payload may
    not have arrived yet when the handler starts running.

Can only be called ONCE per request
  ↳ The body is a stream; once consumed by .json() (or .text(),
    .formData()), there's nothing left to read a second time.
```

---

## 6. Diagram: A POST /api/users Request, Start to Finish

```text
Client sends: POST /api/users?source=signup-form
Body: { "name": "Alice", "email": "alice@example.com" }
        │
        ▼
Next.js matches app/api/users/route.js, invokes POST(request)
        │
        ▼
Read query string:
new URL(request.url).searchParams.get('source')  →  "signup-form"
        │
        ▼
Read body:
await request.json()  →  { name: "Alice", email: "alice@example.com" }
        │
        ▼
Validate body shape (Section 7)
        │
        ├── Invalid ──► NextResponse.json({ error: '...' }, { status: 400 })
        │
        └── Valid   ──► create the user
                    ──► NextResponse.json(createdUser, { status: 201 })
```

Every stop — matching the URL, reading the query string, reading the body, shaping the response — is a distinct, deliberate step; none of it happens automatically.

---

## 7. Code Walkthrough: Validating a Body and Shaping a Response

Validation as a small, pure function — plain data in, plain result out, no `Request`/`Response` dependency, so it's testable directly:

```js
// lib/validateNewUser.js

export function validateNewUser(body) {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { valid: false, error: '"name" is required and must be a non-empty string.' };
  }
  if (typeof body.email !== 'string' || !body.email.includes('@')) {
    return { valid: false, error: '"email" is required and must look like an email address.' };
  }
  return { valid: true };
}
```

The handler becomes a thin wrapper: read the request, delegate to the pure function, shape the response.

```js
// app/api/users/route.js
import { NextResponse } from 'next/server';
import { validateNewUser } from '@/lib/validateNewUser';

export async function POST(request) {
  const body = await request.json();
  const result = validateNewUser(body);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const createdUser = { id: Date.now(), name: body.name, email: body.email };
  return NextResponse.json(createdUser, { status: 201 });
}
```

```text
NextResponse.json(data, init)
  ↳ Equivalent Next.js wrapper around Response.json — same
    (data, init) shape. init.status sets the code, init.headers
    adds/overrides headers.
```

---

## 8. Comparing params, Query String, and Body

| Channel | Where it lives | How it's read | Typical use |
|---|---|---|---|
| `params` | Bracketed path segments (`[id]`) | Second handler arg, then (recent versions) `await params` | Identifying a specific resource |
| Query string | Everything after `?` | `new URL(request.url).searchParams` or `request.nextUrl.searchParams` | Optional filters, sorting, pagination |
| Body | Payload with `POST`/`PUT`/`PATCH` | `await request.json()` (or `.text()`/`.formData()`) | Data being created or updated |

Reach for a path param when the value identifies *which* resource — the URL is meaningless without it (`/api/users/42` needs the `42`). Reach for a query parameter for optional, orthogonal information that narrows a request without changing its target — filters, sort order, pagination. Reach for the body when substantial new or updated data is the actual payload. Mixing these up — a filter stuffed into `params`, a resource ID stuffed into the body — still "works" but produces an API that's confusing to any client trying to use it predictably.

---

## 9. Common Mistakes

- **Assuming `params` is synchronously destructurable.** In recent Next.js versions it needs `await` before fields are accessible — verify against your installed version rather than copying old code that skips the await.
- **Calling `request.json()` on a `GET` (or any bodyless request).** There's nothing valid to parse — it throws.
- **Reading query parameters off `params`.** `params` only holds bracketed path values; `?role=admin` never shows up there — use `searchParams` instead.
- **Calling `request.json()` twice on the same request.** The body is a stream consumed on first read; a second call fails.

---

## 10. Hands-On Exercises

**Exercise 1:** Create `app/api/users/[id]/route.js` with a `GET` reading `params.id` (awaited, per Section 3), returning `Response.json({ id, name: 'User ' + id })`. Visit `/api/users/42` and confirm the response reflects `42`.

**Exercise 2:** Create `app/api/users/route.js` with a `GET` reading a `role` query parameter via `new URL(request.url).searchParams`. Visit `/api/users?role=admin` and `/api/users` (no query string) and confirm the second returns `null` for the missing parameter.

**Exercise 3:** In the same file, add a `POST` using the `validateNewUser` function from Section 7 (as its own module). Send a valid body and confirm a `201`; send one missing `email` and confirm a `400` with the expected error message.

**Exercise 4:** Write three or four direct calls to `validateNewUser` with different sample inputs (valid, missing name, missing email, non-object), logging the return value with no HTTP request involved at all.

**Exercise 5:** Extend the `POST /api/users` handler to also read a `source` query parameter (as in Section 6's diagram) and include it in the created user object returned in the response.

---

## 11. Interview Q&A

**Q: How does a dynamic Route Handler receive the value of a bracketed path segment like `[id]`?**
As the second argument to its exported HTTP method function, shaped `{ params }`. In recent Next.js versions, `params` is a Promise that must be awaited before its fields (like `params.id`) can be accessed — a detail worth confirming against your specific installed version, since this has changed across releases.

**Q: What's the difference between reading `params` and reading the query string in a Route Handler?**
`params` captures values from bracketed segments that are part of the URL's path structure itself (like the `42` in `/api/users/42`) and is passed directly to the handler. The query string is separate, optional key-value data after a `?`, read explicitly via `new URL(request.url).searchParams` (or `request.nextUrl.searchParams`) — it's never included in `params`.

**Q: Why does `request.json()` need to be awaited?**
Because reading a body is I/O — the full body may not have arrived when the handler starts executing, so the runtime waits for the complete payload before parsing it. It can also only be read once; the body is a stream consumed on first read.

**Q: Why extract validation logic like `validateNewUser` into its own plain function instead of writing it inline?**
A plain function that takes data in and returns data out has no dependency on `Request`/`Response`, so it can be called and checked directly with sample inputs — no server, no real HTTP request needed. Keeping the handler a thin wrapper — read, delegate, shape the response — keeps the business logic easy to reason about and reuse.

**Q: What happens if you call `request.json()` on a request that has no body, like a typical `GET`?**
It throws — there's no valid JSON content to parse from an empty or missing body. Body-reading methods should only be called on requests expected to carry a payload, typically `POST`, `PUT`, or `PATCH`.
