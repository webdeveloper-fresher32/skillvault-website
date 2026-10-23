# Protecting Routes and Sessions — Complete Guide

> "A nightclub's bouncer at the door, and a separate coat-check confirming your ticket stub before you're let into the VIP room — belt-and-suspenders, not either-or."

---

## Table of Contents

1. [The Problem: Configured Auth Isn't the Same as Enforced Auth](#1-the-problem-configured-auth-isnt-the-same-as-enforced-auth)
2. [The Bouncer and the Coat-Check Analogy](#2-the-bouncer-and-the-coat-check-analogy)
3. [The Mechanism: Layered Protection, Coarse to Fine](#3-the-mechanism-layered-protection-coarse-to-fine)
4. [Diagram: A Request Passing Through Both Layers](#4-diagram-a-request-passing-through-both-layers)
5. [Code Walkthrough: Record-Level Authorization](#5-code-walkthrough-record-level-authorization)
6. [Comparing Middleware-Level and Component-Level Checks](#6-comparing-middleware-level-and-component-level-checks)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Configured Auth Isn't the Same as Enforced Auth

Lesson 2 wired up Auth.js so users can log in — but a working login flow only proves *identity*. It doesn't by itself stop an unauthenticated visitor from reaching a protected page, or stop a logged-in user from viewing someone else's private data.

### Configured Doesn't Mean Enforced

```text
Auth.js is configured  ≠  every protected page actually checks a session
Login works            ≠  every record's owner is actually verified
```

### The Two Gaps to Close

Two separate gaps have to be closed: keeping unauthenticated requests out of protected routes at all, and — once a request is known to belong to a real logged-in user — confirming that specific user is allowed to see this specific piece of data.

---

## 2. The Bouncer and the Coat-Check Analogy

A nightclub posts a bouncer at the front door checking that everyone entering has a valid ticket at all. Further inside, a separate coat-check attendant at the VIP room confirms your stub matches *that specific room* before letting you through.

### Two Checkpoints, Two Jobs

```text
Bouncer at the door   → coarse check: "does this person have any
                         valid ticket at all?" (Middleware, Lesson 1)

Coat-check at the     → fine-grained check: "does THIS ticket stub
VIP room                 match THIS specific room?" (per-page/
                         per-Route-Handler check, Section 3)
```

### Neither Checkpoint Alone Is Enough

Neither check replaces the other. The bouncer alone would let any ticket-holder wander into the VIP room; the coat-check alone, with no bouncer, would mean anyone off the street reaches the coat-check line in the first place. Route protection needs both.

---

## 3. The Mechanism: Layered Protection, Coarse to Fine

Middleware (Lesson 1) checks for a valid session cookie and redirects unauthenticated requests to `/login` before rendering ever starts — fast, and blind to which specific record is involved.

### The Coarse Layer: Middleware

```js
// middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const hasSession = request.cookies.has('authjs.session-token');

  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/documents/:path*'],
};
```

The exact cookie name is version-specific — `authjs.session-token` in newer Auth.js major versions, `next-auth.session-token` in older ones — so verify it against whatever version is actually installed rather than hardcoding it from memory.

Once a request clears that gate, the Server Component or Route Handler it reaches performs its own, separate check — reading the actual session and deciding whether *this* user may see *this* resource:

### The Fine-Grained Layer: The Component

```js
// app/documents/[id]/page.js
import { auth } from '@/auth'; // Lesson 2, Section 5
import { getDocument } from '@/lib/documents';
import { canUserAccessResource } from '@/lib/authorization'; // Section 5

export default async function DocumentPage({ params }) {
  const session = await auth();
  const { id } = await params; // params is a Promise — Phase 2, Section 6
  const document = await getDocument(id);

  if (!canUserAccessResource(session.user, document)) {
    return <p>You don&apos;t have access to this document.</p>;
  }

  return <article>{document.body}</article>;
}
```

### What Each Layer Actually Proves

Middleware's cookie check only proves *some* logged-in user is making this request — `canUserAccessResource` is what actually confirms it's the *right* user for this specific document.

---

## 4. Diagram: A Request Passing Through Both Layers

### The Layered Request Flow

```text
Request → GET /documents/42
        │
        ▼
Middleware: does a session cookie exist at all?
        │
   ┌────┴────┐
   No         Yes
   │           │
   ▼           ▼
Redirect    Request reaches the Server Component
to /login   (rendering begins)
                │
                ▼
        Server Component calls auth() to read
        the actual session/user (Lesson 2)
                │
                ▼
        Server Component fetches document #42
                │
                ▼
        canUserAccessResource(user, document)?
                │
           ┌────┴────┐
           No          Yes
           │            │
           ▼            ▼
    "No access"    Document renders
       message       normally
```

### Reading the Diagram

The bouncer-level check (top) only ever answers "is there a session at all." Every decision below it that depends on *which* document, *which* user, and whether they match, happens only after Middleware has already let the request through.

---

## 5. Code Walkthrough: Record-Level Authorization

`canUserAccessResource` is plain, testable logic — no framework, database, or network call required to exercise it directly:

### The Authorization Function

```js
// lib/authorization.js — pure logic, testable in isolation

export function canUserAccessResource(user, resource) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return resource.ownerId === user.id;
}
```

### Test Cases: Owner Match, Mismatch, Admin Override

```text
Test case: owner matches
  canUserAccessResource({ id: 'u1', role: 'member' }, { ownerId: 'u1' })
  → true

Test case: owner mismatches
  canUserAccessResource({ id: 'u1', role: 'member' }, { ownerId: 'u2' })
  → false

Test case: admin override
  canUserAccessResource({ id: 'u9', role: 'admin' }, { ownerId: 'u2' })
  → true
```

Because this function takes plain objects and returns a boolean, it can be tested directly with hand-built `user` and `resource` values — no Middleware, no live session, no database required to confirm its logic is correct.

---

## 6. Comparing Middleware-Level and Component-Level Checks

Both checks matter, but they answer different questions at different points in the request lifecycle.

### Middleware-Level vs Component-Level Check

| | Middleware-Level Check | Component-Level Check |
|---|---|---|
| Question answered | "Does this request have a session at all?" | "Is *this* user allowed to see *this* specific resource?" |
| Granularity | Coarse — path-based, blind to any specific record | Fine-grained — aware of the actual resource being requested |
| Needs database access | No — a cookie's mere presence is enough | Usually yes — to fetch the resource and compare ownership/role |
| Where it belongs | `middleware.js`, gating entire route patterns | Inside the specific Server Component or Route Handler serving that resource |

### Takeaway

The Middleware check is cheap and broad precisely because it doesn't look at any specific data — it can run before rendering even starts. The component-level check is more expensive precisely because it has to look at real data — the resource itself, and who owns it — which only the component actually fetching that resource can meaningfully evaluate. Neither layer can substitute for the other without either letting unauthorized requests reach rendering, or paying a database lookup for every single request regardless of path.

---

## 7. Common Mistakes

- **Relying only on Middleware's coarse session check and assuming that alone means "authorized."** A valid session cookie proves someone is logged in — it says nothing about whether that specific user should see this specific record. Skipping the component-level check in Section 3 lets any logged-in user potentially view any other user's data.
- **Trusting a client-side-only "hide the button if not admin" check as real security.** Hiding a UI element in the browser doesn't stop a user from calling the underlying Route Handler or Server Action directly — the actual authorization decision has to happen server-side, inside the handler itself, exactly as Section 3's `canUserAccessResource` does.
- **Doing the fine-grained check in Middleware instead of the component.** Middleware runs on the Edge runtime before rendering starts and is meant to stay lightweight (Lesson 1) — record-specific authorization usually needs a database read the component is already doing anyway, which is the natural place for it to live.

---

## 8. Hands-On Exercises

**Exercise 1:** Write `lib/authorization.js` with `canUserAccessResource(user, resource)` exactly as in Section 5. Write three plain function calls (owner match, owner mismatch, admin override) and confirm each returns the expected boolean.

**Exercise 2:** Create `middleware.js` guarding `/documents/:path*` with a session-cookie check and `config.matcher`, matching Section 3.

**Exercise 3:** Create `app/documents/[id]/page.js` that calls `auth()` (conceptually, per Lesson 2) to get the current user, fetches a document by the `id` obtained from `await params` (Section 3), and renders "You don't have access to this document." when `canUserAccessResource` returns `false`.

**Exercise 4:** Simulate two users — one who owns a given document and one who doesn't — and write down, for each, what `middleware.js` allows through versus what the page component ultimately renders. Confirm the mismatch case is blocked only by Section 3's component-level check, not by Middleware.

**Exercise 5:** Write a one-paragraph explanation of why a "hide the delete button if the user isn't the owner" client-side check is not sufficient protection on its own, connecting it to the second common mistake in Section 7.

---

## 9. Interview Q&A

**Q: Why isn't having Auth.js configured enough to actually protect a route?**
Configuring Auth.js provides a working login flow that establishes *identity*, but it doesn't by itself stop an unauthenticated request from reaching a protected page, nor stop an authenticated user from viewing another user's private data. Both gaps — keeping unauthenticated requests out entirely, and confirming a specific authenticated user is authorized for a specific resource — need to be explicitly checked, at Middleware level and at component level respectively.

**Q: What's the difference in what a Middleware session check and a component-level authorization check each confirm?**
A Middleware check answers a coarse question — does this request carry a valid session cookie at all — and can redirect unauthenticated requests before rendering ever starts, without needing any database access. A component-level check answers a fine-grained question — is this specific logged-in user allowed to see this specific resource — which typically requires fetching the resource and comparing it against the actual session user, something only the component serving that resource can meaningfully do.

**Q: Why do both layers matter instead of just one?**
Middleware alone would let any logged-in user through to any route it guards, including resources they don't own, since it never looks at specific records. A component-level check alone, with no Middleware gate, means every request — even ones with no session at all — reaches all the way to rendering before being rejected, which is both slower and provides no single, consolidated place to enforce "must be logged in." Together, Middleware filters out the clearly unauthorized cases cheaply and early, while the component handles the cases that actually depend on specific data.

**Q: Why is a client-side "hide the button if not admin" check not real security?**
Hiding a UI element only changes what's rendered in the browser — it does nothing to stop a user from calling the underlying Route Handler or Server Action directly, bypassing the UI entirely, since the browser's JavaScript is fully within the user's control. The actual authorization decision has to be enforced server-side, inside the handler or component itself, exactly like the record-level check this lesson builds.

**Q: Where does record-level authorization logic like `canUserAccessResource` belong, and why not put it in Middleware?**
It belongs inside the Server Component or Route Handler actually serving the resource, because that's where the resource has already been fetched and its ownership is known. Middleware runs on the Edge runtime ahead of every matched request and is meant to stay fast and lightweight; pulling record-specific database lookups into Middleware would slow down every request it guards, for a check that the component is positioned to do anyway as part of fetching the data it needs to render.
