# Auth Patterns with Auth.js — Complete Guide

> "A professionally-installed door lock system, not a lock built from scratch in the garage."

---

## Table of Contents

1. [The Problem: Authentication Is Easy to Get Wrong](#1-the-problem-authentication-is-easy-to-get-wrong)
2. [The Professionally-Installed Lock Analogy](#2-the-professionally-installed-lock-analogy)
3. [The Mechanism: Providers, Sessions, and a Catch-All Route Handler](#3-the-mechanism-providers-sessions-and-a-catch-all-route-handler)
4. [Diagram: The OAuth Login Flow, Start to Finish](#4-diagram-the-oauth-login-flow-start-to-finish)
5. [Code Walkthrough: A Conceptual Auth.js Config](#5-code-walkthrough-a-conceptual-authjs-config)
6. [Comparing JWT Sessions and Database Sessions](#6-comparing-jwt-sessions-and-database-sessions)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Authentication Is Easy to Get Wrong

Hand-rolling authentication means correctly implementing password hashing, session token generation and storage, one or more OAuth provider integrations, and CSRF protection — each one a place a subtle mistake becomes a real security hole.

### The Hand-Rolled Auth Checklist

```text
Hand-rolled auth checklist:
  ☐ Password hashing with a suitable algorithm and salt
  ☐ Session tokens: generation, storage, expiry, rotation
  ☐ OAuth handshake per provider (GitHub, Google, ...)
  ☐ CSRF protection on every state-changing request
  ☐ Secure cookie flags, correct SameSite behavior
  ↳ Any one item done wrong is a real vulnerability, not a
    cosmetic bug — and this list has to be maintained forever.
```

### Why This Isn't a One-App Problem

None of these problems are unique to any one app — they're the same problems every app with logins has already solved, repeatedly, which is exactly what a maintained auth library exists to absorb.

---

## 2. The Professionally-Installed Lock Analogy

A homeowner could, in principle, design and machine their own door lock from raw materials. Almost nobody does — they buy a lock built and tested by people who do nothing else, and have it installed correctly.

### Custom-Built vs Professionally-Installed

```text
Custom lock from scratch → every flaw in the design or the
                            installation is a flaw only this one
                            door has — nobody else has stress-tested it

Professionally-installed  → the lock's design has been tested across
lock system                thousands of installations; the homeowner
                            configures it (which keys, which doors)
                            rather than inventing the mechanism itself
```

### Mapping the Analogy to Auth.js

Auth.js (NextAuth) plays that role for a Next.js app: the mechanism — password handling, session issuance, OAuth handshakes — is already built and widely used; the app configures which providers and which session strategy it wants.

---

## 3. The Mechanism: Providers, Sessions, and a Catch-All Route Handler

Auth.js exposes a configurable auth handler wired into a Route Handler, typically at `app/api/auth/[...nextauth]/route.js`, plus helpers Server Components use to read the current session.

### Session Strategies and Providers

```text
Session strategy → how a logged-in state is tracked between requests
  JWT              → a signed token, entirely self-contained
  Database         → a session record stored server-side, referenced
                     by an opaque ID in the cookie

Providers → who verifies "yes, this is really this person"
  OAuth provider     → GitHub, Google, etc. — the provider itself
                       confirms identity, Auth.js handles the handshake
  Credentials provider → your own username/password form, verified
                       against your own user store
```

### The Catch-All Route Handler

```js
// app/api/auth/[...nextauth]/route.js — illustrative shape
import { handlers } from '@/auth'; // see Section 5

export const { GET, POST } = handlers;
```

The `[...nextauth]` catch-all segment (Phase 2's catch-all dynamic route pattern) lets a single Route Handler answer every path Auth.js needs — sign-in, callback, sign-out — without hand-writing one route per step.

---

## 4. Diagram: The OAuth Login Flow, Start to Finish

### The Flow, Step by Step

```text
User clicks "Sign in with GitHub"
        │
        ▼
Browser redirected to GitHub's own login/consent page
        │
        ▼
User approves → GitHub redirects back to Auth.js's
callback route, carrying a one-time authorization code
        │
        ▼
Auth.js exchanges that code with GitHub's servers for
real access tokens (this exchange happens server-side)
        │
        ▼
Auth.js creates a session (JWT or database-backed,
Section 6) representing this now-authenticated user
        │
        ▼
A session cookie is set on the response
        │
        ▼
Every subsequent request from this browser carries that
cookie; Server Components read it to know who's logged in
```

### Why Credentials Never Touch Your App

The user's own credentials for the OAuth provider (their GitHub password) never pass through the Next.js app at all — only GitHub itself ever sees them, which is one of the concrete security benefits of leaning on an OAuth provider rather than a Credentials provider wherever it's a viable option.

---

## 5. Code Walkthrough: A Conceptual Auth.js Config

The following captures the *shape* of an Auth.js configuration — the real, current API for App Router integration should be checked against Auth.js's own documentation, since its exact exports and conventions have changed across major versions.

### An Illustrative Config Shape

```js
// auth.js — illustrative shape only; verify against your installed
// Auth.js version before treating any exact export name as fixed
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  session: {
    strategy: 'jwt', // or 'database', Section 6
  },
});
```

### Reading the Config's Pieces

```text
providers: [...]     → one or more ways a user can prove who they are
session.strategy     → 'jwt' or 'database' (Section 6)
handlers             → wired into the catch-all Route Handler, Section 3
auth()                → called from Server Components to read the
                        current session (used throughout Lesson 3)
```

Treat this as a starting shape to adapt, not a copy-pasteable final answer — a real project needs a live Auth.js install and its current setup instructions to get the exact wiring right.

---

## 6. Comparing JWT Sessions and Database Sessions

Both strategies represent "this browser is logged in as this user," but they store that fact in different places with different tradeoffs.

### JWT vs Database Sessions

| | JWT Session Strategy | Database Session Strategy |
|---|---|---|
| Where session state lives | Entirely inside the signed token itself, stored in the cookie | A session record in your own database; the cookie holds only an opaque reference ID |
| Revocable before expiry | Difficult — the token is self-contained and valid until it expires, since nothing server-side is checked per request | Yes — deleting the database record invalidates the session immediately |
| Server lookup per request | None needed — the token itself is verified | A database read is needed to confirm the session record still exists |
| Typical use | Simpler deployments, no extra database round trip per request | Apps needing to forcibly revoke sessions (a "log out all devices" feature, a banned account) |

### Takeaway

A JWT session avoids a database round trip on every request, at the cost of not being instantly revocable — a stolen JWT stays valid until it naturally expires. A database session pays a lookup cost per request in exchange for the ability to kill a session immediately, which matters for anything needing a hard, instant logout. Neither is a wrong default; the choice comes down to whether instant revocation is a real requirement for the app.

---

## 7. Common Mistakes

- **Hand-rolling a custom auth system instead of reaching for a maintained library.** Password hashing, CSRF protection, and OAuth handshakes are solved problems with sharp edges — re-deriving them from scratch reintroduces bugs a maintained library like Auth.js has already had exercised across many real deployments.
- **Misconfiguring the callback URL registered with an OAuth provider.** Every OAuth provider requires the exact callback URL Auth.js will redirect back to be registered in advance; a mismatch (wrong domain, wrong path, `http` vs `https`) causes the provider to reject the redirect outright, usually with an unhelpful error on the provider's own side.
- **Treating this lesson's config shape as a fixed, permanent API.** Auth.js's exact exports and App Router conventions have changed across major versions — always cross-check against the currently installed version's own documentation before wiring a real project to it.

---

## 8. Hands-On Exercises

**Exercise 1:** Sketch (in comments, no install required yet) an `auth.js` config with a single `GitHub` provider and `session.strategy: 'jwt'`, matching Section 5's shape.

**Exercise 2:** Write out, in your own words, each step of Section 4's OAuth diagram for a hypothetical "Sign in with Google" button, substituting Google for GitHub at each step.

**Exercise 3:** Write a one-paragraph justification for choosing a database session strategy over JWT for an app that needs an admin "force log out this user right now" feature — cite Section 6's revocability tradeoff directly.

**Exercise 4:** List three concrete things that would go wrong for each unchecked item on Section 1's hand-rolled-auth checklist if the corresponding maintained-library feature were simply skipped.

**Exercise 5:** Write a one-paragraph explanation of why the `[...nextauth]` catch-all segment (Section 3) is a natural fit here, connecting it back to Phase 2's catch-all dynamic route pattern.

---

## 9. Interview Q&A

**Q: Why reach for a library like Auth.js instead of writing authentication by hand?**
Hand-rolled authentication has to correctly solve password hashing, session token management, OAuth handshakes per provider, and CSRF protection — each a place a subtle implementation mistake becomes a real security vulnerability. A maintained library like Auth.js has already had these exact problems solved and exercised across a large number of real deployments, which a from-scratch implementation hasn't had the chance to be.

**Q: What is a "provider" in Auth.js, and what are the two broad kinds?**
A provider is a way a user proves who they are. An OAuth provider (GitHub, Google, etc.) delegates that proof to a third party — the user's actual credentials never pass through the app itself. A Credentials provider verifies a username/password pair the app collects directly, against the app's own user store, putting the full weight of credential handling back on the app.

**Q: Walk through what happens after a user clicks "Sign in with GitHub."**
The browser is redirected to GitHub's own login/consent page. After the user approves, GitHub redirects back to Auth.js's callback route carrying a one-time authorization code. Auth.js exchanges that code with GitHub's servers for real access tokens server-side, creates a session (JWT or database-backed), and sets a session cookie on the response — every later request from that browser carries the cookie, which is what subsequent session reads rely on.

**Q: What's the practical tradeoff between a JWT session and a database session?**
A JWT session is self-contained — no database lookup needed to verify it — but it can't be revoked before it naturally expires, since nothing server-side is consulted per request. A database session requires a lookup on each request but can be invalidated instantly by deleting its record, which matters for features like forcibly logging out a compromised account.

**Q: What's a common real-world OAuth setup mistake, and what does it look like when it happens?**
Registering the wrong callback URL with the OAuth provider — a mismatched domain, path, or protocol (`http` vs `https`) from what Auth.js will actually redirect back to. When it happens, the provider itself rejects the redirect, usually surfacing an error on the provider's own consent or callback page rather than inside the Next.js app, which can make it confusing to debug without checking the registered URL first.
