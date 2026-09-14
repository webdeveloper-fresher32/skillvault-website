# Phase 07 — Cookies, Sessions, and Web Auth

## Why This Phase Exists

HTTP is stateless — every request is handled by the server as if it has never seen the client before. Yet every app you use "remembers" that you're logged in from one click to the next. That memory is bolted on top of HTTP using **cookies**, and this phase is about understanding exactly how that bolt-on works at the protocol level: the literal HTTP headers, the attributes that control cookie behavior, the request/response sequence of session-based auth, and the security holes (CSRF) that cookie-based auth opens up.

This phase deliberately stays at the **protocol level** — the raw `Set-Cookie` / `Cookie` headers, the wire format, the sequence of requests and responses. It does **not** re-teach how to implement login systems in code.

> **For applied implementation** (bcrypt password hashing, JWT signing/verification, `express-session` setup, RBAC middleware, OWASP checklist) — see [`../../NodeJS/Phase-07-Auth-and-Security/`](../../NodeJS/Phase-07-Auth-and-Security/). That phase covers the Express.js code; this phase covers the HTTP mechanics underneath it.

## What You'll Learn

| # | Lesson | Focus |
|---|--------|-------|
| 01 | [HTTP is Stateless — Why Cookies Exist](01-HTTP-is-Stateless-Why-Cookies-Exist.md) | The statelessness problem, cookies as the fix, raw `Set-Cookie`/`Cookie` exchange |
| 02 | [Cookie Attributes Explained](02-Cookie-Attributes-Explained.md) | `Domain`, `Path`, `Expires`/`Max-Age`, `Secure`, `HttpOnly`, `SameSite` |
| 03 | [Session-Based Auth at the Protocol Level](03-Session-Based-Auth-at-the-Protocol-Level.md) | Session ID lifecycle over HTTP, sequence diagram, contrast with JWT flow |
| 04 | [CSRF and Cookie Security](04-CSRF-and-Cookie-Security.md) | Why cookies are exploitable, `SameSite` and CSRF tokens, CORS vs CSRF |

## Prerequisites

- [Phase-05-HTTP-HTTPS-Fundamentals](../Phase-05-HTTP-HTTPS-Fundamentals/) — you should be comfortable reading raw HTTP request/response headers.
- Basic familiarity with what a browser does with a `Set-Cookie` header (this phase explains it from scratch, but prior exposure helps).

## How to Use This Phase

1. Read lessons 01 → 04 in order — each builds on the previous one (statelessness → cookie mechanics → session flow → attack surface).
2. Work through the **Hands-On Exercises** at the end of every lesson using `curl` or your browser's DevTools Network tab — you will literally see the headers described in the lesson.
3. Use the **Interview Q&A** sections as a self-test before moving to [Phase-08-Caching](../Phase-08-Caching/).
4. Whenever a lesson says "see the NodeJS course for implementation," follow that link if you want to see the corresponding code — it's optional for protocol understanding but essential for building a real login system.

## Time Estimate

~3-4 hours (reading + exercises).
