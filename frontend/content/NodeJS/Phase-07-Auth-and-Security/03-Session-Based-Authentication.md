# Session-Based Authentication — Complete Guide

## Table of Contents
1. [How Cookie-Based Sessions Work](#1-how-cookie-based-sessions-work)
2. [Setting Up express-session](#2-setting-up-express-session)
3. [Complete Login/Logout Example](#3-complete-loginlogout-example)
4. [Session Store Options: Memory vs Redis](#4-session-store-options-memory-vs-redis)
5. [Session vs JWT Trade-Off Table](#5-session-vs-jwt-trade-off-table)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. How Cookie-Based Sessions Work

Unlike JWTs (stateless — the token itself carries the data), sessions are **stateful** — the server stores session data and only gives the client an opaque ID pointing at it.

```
1. User logs in with email/password
        │
        ▼
2. Server creates a session record:
     sessionStore["s:Xk29fA..."] = { userId: 42, role: "admin" }
        │
        ▼
3. Server sends the client a cookie:
     Set-Cookie: connect.sid=s%3AXk29fA...; HttpOnly; Secure; SameSite=Strict
        │
        ▼
4. On every subsequent request, browser automatically sends the cookie back
        │
        ▼
5. Server looks up the session ID in the store, retrieves { userId: 42, role: "admin" }
     → req.session.userId is now available
```

The cookie itself contains no user data — just a random, unguessable ID. All actual session data lives server-side in the session store. This means sessions can be **instantly revoked** (just delete the record from the store) — a key advantage over JWTs.

---

## 2. Setting Up express-session

```bash
npm install express-session
```

```javascript
const express = require('express');
const session = require('express-session');

const app = express();
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET, // signs the session ID cookie
    resave: false,             // don't re-save session if nothing changed
    saveUninitialized: false,  // don't create a session until something is stored
    cookie: {
      httpOnly: true,          // JS on the page can't read the cookie
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'strict',      // don't send cookie on cross-site requests
      maxAge: 1000 * 60 * 60,  // 1 hour
    },
  })
);
```

| Option | Meaning |
|--------|---------|
| `secret` | Used to sign the session ID cookie so it can't be forged |
| `resave` | If `false`, avoids unnecessary writes to the store on every request |
| `saveUninitialized` | If `false`, avoids creating empty sessions for anonymous visitors |
| `cookie.httpOnly` | Blocks JavaScript access — mitigates XSS token theft |
| `cookie.secure` | Cookie only sent over HTTPS |
| `cookie.sameSite` | Mitigates CSRF by restricting cross-site cookie sending |

---

## 3. Complete Login/Logout Example

```javascript
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 },
  })
);

const users = [{ id: 1, email: 'jane@example.com', passwordHash: '$2b$10$abc...', role: 'admin' }];

// ---- Login ----
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  // Storing data on req.session persists it in the session store
  req.session.userId = user.id;
  req.session.role = user.role;

  res.json({ message: 'logged in' });
});

// ---- Auth middleware ----
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'not authenticated' });
  }
  next();
}

// ---- Protected route ----
app.get('/profile', requireLogin, (req, res) => {
  res.json({ userId: req.session.userId, role: req.session.role });
});

// ---- Logout ----
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'logout failed' });
    res.clearCookie('connect.sid');
    res.json({ message: 'logged out' });
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

```
Test with curl (note -c/-b to persist cookies across requests):

curl -c cookies.txt -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"password123"}'

curl -b cookies.txt http://localhost:3000/profile

curl -b cookies.txt -X POST http://localhost:3000/logout
```

---

## 4. Session Store Options: Memory vs Redis

By default, `express-session` uses `MemoryStore` — fine for local development, unsuitable for production.

```
MemoryStore (default):
  Sessions live in the Node process's RAM.

  Problem 1 — restarts: every deploy/crash wipes all logged-in users.
  Problem 2 — scaling: with multiple server instances behind a load
              balancer, a user's session created on Server A is
              invisible to Server B → random logouts.

Redis-backed store:
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ Server A │   │ Server B │   │ Server C │
  └────┬─────┘   └────┬─────┘   └────┬─────┘
       │              │              │
       └──────────────┼──────────────┘
                       ▼
                 ┌───────────┐
                 │   Redis   │  ← shared session store
                 └───────────┘
  Any server can read any user's session → works with load balancing
  and survives individual server restarts.
```

```bash
npm install connect-redis redis
```

```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 },
  })
);
```

| Store | Persists across restarts? | Works across multiple servers? | Use for |
|-------|---------------------------|--------------------------------|---------|
| `MemoryStore` (default) | No | No | Local development only |
| Redis (`connect-redis`) | Yes | Yes | Production, any multi-instance deployment |
| Database (e.g. `connect-mongo`) | Yes | Yes | Production without a Redis dependency, at the cost of slower reads |

---

## 5. Session vs JWT Trade-Off Table

| Aspect | Session (cookie + server store) | JWT |
|--------|----------------------------------|-----|
| State | Stateful — server stores session data | Stateless — all data lives in the token |
| Storage needed | Yes — server-side store (memory/Redis/DB) | No — server just verifies a signature |
| Revocation | Instant — delete the session record | Hard — token is valid until it expires unless you maintain a denylist |
| Scaling across servers | Requires a shared store (e.g., Redis) | Works naturally — any server with the secret can verify |
| Good fit for | Traditional server-rendered web apps, single-domain apps | APIs, mobile apps, microservices, cross-domain clients |
| Client storage | Browser cookie (automatic) | Client must manually attach `Authorization` header (or use cookies) |
| CSRF risk | Higher (cookies sent automatically) — mitigate with `SameSite`/CSRF tokens | Lower if stored outside cookies (e.g., in memory) |
| XSS risk | Low if `httpOnly` cookie used | Higher if stored in `localStorage`; low if `httpOnly` cookie used |
| Payload visibility | Opaque ID only — data never leaves the server | Payload is readable (base64) by anyone with the token |
| Typical lifetime | Minutes to hours, sliding expiration common | Short-lived access token + separate refresh token |

**Rule of thumb:** if you control both client and server and they share a domain (a classic server-rendered app or a SPA served from the same origin as the API), sessions are simpler and give you free revocation. If you're building an API consumed by mobile apps, third-party clients, or multiple microservices, JWTs avoid the need for a shared session store.

---

## 6. Hands-On Exercises

**Exercise 1:** Build the login/logout example above using `MemoryStore`. Log in, call `/profile`, restart the server, and observe that `/profile` now returns 401 even with the old cookie.

**Exercise 2:** Add Redis as the session store using `connect-redis`. Run two instances of the app on different ports behind a simple round-robin (or just hit each manually) and confirm a session created via one instance is recognized by the other.

**Exercise 3:** Inspect the `Set-Cookie` header from the login response in your browser's dev tools or with `curl -v`. Identify the `HttpOnly`, `SameSite`, and `Max-Age` attributes.

**Exercise 4:** Implement "logout everywhere" — store an array of session IDs per user, and on a `/logout-all` route, destroy every session belonging to that user from the store.

---

## 7. Interview Q&A

**Q: What's the fundamental difference between session-based auth and JWT-based auth?**
Answer: Sessions are stateful — the server stores the actual session data and gives the client only an opaque ID via a cookie; every request requires a store lookup. JWTs are stateless — the token itself carries the signed claims, so the server verifies a signature instead of doing a database/store lookup. This single difference drives almost every other trade-off between them (revocation, scaling, storage).

**Q: Why can't you use the default MemoryStore in production?**
Answer: MemoryStore keeps sessions in the Node process's own RAM. It's wiped on every restart or crash, logging out every user, and it isn't shared across multiple server instances, so a load-balanced deployment would randomly "forget" users depending on which instance handled the login versus the follow-up request. A shared external store like Redis solves both problems.

**Q: How do you revoke a session immediately (e.g., forced logout)?**
Answer: Because session data lives server-side, you just delete that session's record from the store (e.g., `req.session.destroy()` for the current user, or directly removing a key from Redis for another user/device). The client's cookie becomes useless immediately since the server no longer has matching data for that session ID. This is fundamentally easier than revoking a JWT.

**Q: Why is `httpOnly` important on the session cookie?**
Answer: `httpOnly` prevents JavaScript running on the page (including injected scripts from an XSS vulnerability) from reading the cookie via `document.cookie`. Since the cookie is the only thing identifying the session, blocking script access to it closes off one of the most common ways session hijacking happens.

**Q: When would you choose sessions over JWTs for a new project?**
Answer: When the client and server share the same origin/domain — a classic server-rendered app or a same-origin SPA — sessions are simpler to reason about and give you free, instant revocation. JWTs earn their complexity when you need statelessness: multiple services verifying tokens independently, mobile clients, or APIs consumed by third parties where you don't want a shared session store as a single point of failure.

**Q: What risk does session-based auth have that JWT-in-memory doesn't, and how do you mitigate it?**
Answer: Because cookies are sent automatically by the browser on every request to the matching domain, sessions are more exposed to CSRF (a malicious site tricking the browser into making authenticated requests). This is mitigated with the `SameSite=Strict` or `SameSite=Lax` cookie attribute and, for state-changing requests, an additional CSRF token that must be explicitly included by legitimate client-side code.
