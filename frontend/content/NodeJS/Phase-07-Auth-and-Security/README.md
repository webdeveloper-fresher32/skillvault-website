# Phase 07 — Auth and Security

## Overview

This phase covers how to prove who a user is (authentication) and what they're allowed to do (authorization), plus the baseline security hygiene every production Express app needs. You'll learn why plaintext passwords are never acceptable and how bcrypt fixes that, how JWTs work and how to build a token-based login flow with refresh tokens, how classic cookie-based sessions work and when they beat JWTs, how to build role-based access control middleware, and how to close the most common Node/Express security holes mapped to the OWASP Top 10.

## Files in This Phase

| File | Topic |
|------|-------|
| `01-Password-Hashing-with-Bcrypt.md` | Why never store plaintext passwords, hashing vs encryption, bcrypt salt rounds, full registration/login example |
| `02-JWT-Authentication.md` | JWT structure (header/payload/signature), signing/verifying, access vs refresh tokens, login + protected-route middleware |
| `03-Session-Based-Authentication.md` | Cookies, `express-session`, memory vs Redis session stores, session vs JWT trade-offs |
| `04-Authorization-and-RBAC.md` | Role-based access control middleware, admin vs user route example |
| `05-Security-Best-Practices-OWASP.md` | Helmet, CORS, rate limiting, injection prevention, XSS prevention, secrets management, OWASP Top 10 mapping |

## Prerequisites

- Phase 01–04: Node.js fundamentals, Express routing and middleware.
- Phase 06: Databases (storing and querying user records).

## What You Should Be Able to Do After This Phase

- Explain why passwords must be hashed (never encrypted or stored plain) and implement bcrypt hashing correctly.
- Explain JWT structure and implement a login flow with access + refresh tokens and protected-route middleware.
- Implement cookie-based sessions and articulate when sessions beat JWTs (and vice versa).
- Build role-based authorization middleware that restricts routes by user role.
- Identify and mitigate the most common Node/Express vulnerabilities (injection, XSS, missing rate limits, leaked secrets, misconfigured CORS).

---

Next: **Phase 08** — Error Handling and Validation.
