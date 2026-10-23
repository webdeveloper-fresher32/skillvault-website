# JWT Authentication — Complete Guide

## Table of Contents
1. [What is a JWT?](#1-what-is-a-jwt)
2. [Anatomy: Header, Payload, Signature](#2-anatomy-header-payload-signature)
3. [Signing and Verifying Tokens](#3-signing-and-verifying-tokens)
4. [Access Tokens vs Refresh Tokens](#4-access-tokens-vs-refresh-tokens)
5. [Complete Login + Protected Route Example](#5-complete-login--protected-route-example)
6. [Where to Store Tokens on the Client](#6-where-to-store-tokens-on-the-client)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is a JWT?

A **JSON Web Token (JWT)** is a compact, self-contained, URL-safe string that carries claims (data) about a user, digitally signed so the server can verify it hasn't been tampered with.

```
Traditional session:
  Client → Server: "here's my session ID"
  Server → Database: "look up session ID, who is this?"
  (server must store session state)

JWT:
  Client → Server: "here's a signed token proving who I am"
  Server: verify signature, trust the claims inside — no DB lookup needed
  (server stores nothing — "stateless" auth)
```

JWTs are ideal for APIs consumed by mobile apps, SPAs, and microservices where you don't want every request hitting a shared session store. The trade-off: since the server doesn't track issued tokens, revoking a single token before it expires is hard (see Section 4).

---

## 2. Anatomy: Header, Payload, Signature

A JWT is three base64url-encoded parts joined by dots: `header.payload.signature`.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.
eyJ1c2VySWQiOjQyLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2OTk5OTk5OTl9
.
4f8h2K9s...signature...

         HEADER              .          PAYLOAD             .    SIGNATURE
```

| Part | Contents | Example (decoded) |
|------|----------|--------------------|
| **Header** | Algorithm + token type | `{ "alg": "HS256", "typ": "JWT" }` |
| **Payload** | Claims — the actual data | `{ "userId": 42, "role": "admin", "iat": 1699999999, "exp": 1700003599 }` |
| **Signature** | HMAC/RSA signature of `header + payload` using a secret/private key | Verifies the token wasn't modified |

```
signature = HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secretKey
)
```

**Critical point:** the header and payload are only *encoded*, not encrypted — anyone can decode and read them (try pasting a JWT into jwt.io). Never put secrets (passwords, credit card numbers) in the payload. The signature only guarantees the token **hasn't been altered**; it does not hide the data.

Common payload claims:

| Claim | Meaning |
|-------|---------|
| `iat` | Issued-at timestamp |
| `exp` | Expiration timestamp |
| `sub` | Subject (typically the user ID) |
| custom (`userId`, `role`, ...) | App-specific data you choose to include |

---

## 3. Signing and Verifying Tokens

```bash
npm install jsonwebtoken
```

```javascript
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET; // never hardcode this — see Phase-07-05

// --- Signing (creating a token) ---
const token = jwt.sign(
  { userId: 42, role: 'admin' },   // payload
  SECRET,                          // secret key used to compute the signature
  { expiresIn: '15m' }             // adds an `exp` claim automatically
);

// --- Verifying (checking a token) ---
try {
  const decoded = jwt.verify(token, SECRET);
  console.log(decoded); // { userId: 42, role: 'admin', iat: ..., exp: ... }
} catch (err) {
  // err.name === 'TokenExpiredError' or 'JsonWebTokenError' (bad signature)
  console.log('Invalid or expired token');
}
```

`jwt.verify` recomputes the signature from the header/payload using the secret and compares it to the token's signature. If anyone modifies the payload (e.g., changing `role: "user"` to `role: "admin"`) without knowing the secret, the recomputed signature won't match and verification fails.

---

## 4. Access Tokens vs Refresh Tokens

A single long-lived token is risky — if stolen, it's valid until it expires with no way to revoke it. The standard pattern uses two tokens with different lifetimes:

```
Login
  │
  ▼
Server issues:
  ┌─────────────────────┐    ┌──────────────────────────┐
  │  Access Token        │    │  Refresh Token             │
  │  short-lived (~15m)  │    │  long-lived (~7-30 days)   │
  │  sent on every request│   │  stored securely, used only │
  │  in Authorization hdr│    │  to get new access tokens   │
  └─────────────────────┘    └──────────────────────────┘

Access token expires (after 15 min)
  │
  ▼
Client calls POST /refresh-token with the refresh token
  │
  ▼
Server verifies refresh token → issues a new access token
  (refresh tokens are typically stored server-side/in DB so they
   CAN be revoked — e.g., on logout or password change)
```

| Token | Lifetime | Sent on | Purpose | Revocable? |
|-------|----------|---------|---------|------------|
| Access token | Minutes | Every API request (`Authorization: Bearer <token>`) | Prove identity for that request | Not directly (expires quickly instead) |
| Refresh token | Days/weeks | Only to the `/refresh-token` endpoint | Get a new access token without re-login | Yes — server tracks/stores it and can invalidate |

This limits the blast radius of a stolen access token (it dies in minutes) while keeping the login experience convenient (users don't re-enter credentials every 15 minutes).

---

## 5. Complete Login + Protected Route Example

```javascript
// server.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

// fake user store — password is "password123" hashed with bcrypt
const users = [{ id: 1, email: 'jane@example.com', passwordHash: '$2b$10$abc...', role: 'admin' }];

// in-memory store of valid refresh tokens (use Redis/DB in production)
let validRefreshTokens = new Set();

function generateAccessToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(user) {
  const token = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
  validRefreshTokens.add(token);
  return token;
}

// ---- Login ----
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  res.json({
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  });
});

// ---- Refresh ----
app.post('/refresh-token', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken || !validRefreshTokens.has(refreshToken)) {
    return res.status(401).json({ error: 'invalid refresh token' });
  }

  jwt.verify(refreshToken, REFRESH_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'refresh token expired' });

    const user = users.find((u) => u.id === payload.userId);
    res.json({ accessToken: generateAccessToken(user) });
  });
});

// ---- Logout (revoke refresh token) ----
app.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  validRefreshTokens.delete(refreshToken);
  res.status(204).send();
});

// ---- Auth middleware ----
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']; // "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'access token required' });

  jwt.verify(token, ACCESS_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'invalid or expired access token' });
    req.user = payload; // { userId, role, iat, exp }
    next();
  });
}

// ---- Protected route ----
app.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: `Hello user ${req.user.userId}`, role: req.user.role });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

```
Test flow with curl:

1. curl -X POST http://localhost:3000/login \
     -H "Content-Type: application/json" \
     -d '{"email":"jane@example.com","password":"password123"}'
   → { accessToken: "...", refreshToken: "..." }

2. curl http://localhost:3000/profile \
     -H "Authorization: Bearer <accessToken>"
   → { message: "Hello user 1", role: "admin" }

3. curl -X POST http://localhost:3000/refresh-token \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"<refreshToken>"}'
   → { accessToken: "<new access token>" }
```

---

## 6. Where to Store Tokens on the Client

| Storage | XSS-safe? | CSRF-safe? | Notes |
|---------|-----------|------------|-------|
| `localStorage` | No — any injected script can read it | Yes | Common but risky if the app has any XSS hole |
| Memory (JS variable, e.g. React state) | Yes | Yes | Lost on page refresh; often paired with a refresh flow |
| `httpOnly` cookie | Yes — JS cannot read it | No — vulnerable unless mitigated with `SameSite`/CSRF tokens | Best of both when combined with `SameSite=strict` |

There's no single "correct" answer — it's a trade-off. Many production apps store the access token in memory and the refresh token in an `httpOnly`, `SameSite=strict` cookie.

---

## 7. Hands-On Exercises

**Exercise 1:** Build the login/refresh/logout/profile example above. Log in, call `/profile` with the access token, then wait until it expires (set `expiresIn: '10s'` for testing) and observe the 403.

**Exercise 2:** Decode a JWT by hand: split it on `.`, base64url-decode the first two parts with `Buffer.from(part, 'base64url').toString()`, and print the header and payload as JSON.

**Exercise 3:** Tamper with a token — decode the payload, change `role` from `"user"` to `"admin"`, re-encode it, and swap it into the token (keep the original signature). Send it to `/profile` and confirm `jwt.verify` rejects it.

**Exercise 4:** Add role-based restriction to a new `/admin` route using `req.user.role` from the decoded token (combine with Phase-07-04's RBAC middleware).

**Exercise 5:** Implement logout properly by removing the refresh token from `validRefreshTokens`, then confirm `/refresh-token` fails afterward even though the token hasn't expired yet.

---

## 8. Interview Q&A

**Q: What are the three parts of a JWT and what is each for?**
Answer: Header (algorithm and token type, e.g. `HS256`/`JWT`), Payload (the claims — user data like `userId`, `role`, `exp`), and Signature (a cryptographic signature over the header+payload computed with a secret key). The signature lets the server verify the token wasn't tampered with; it does not encrypt the payload.

**Q: Is the data inside a JWT encrypted?**
Answer: No. The header and payload are only base64url-**encoded**, which is trivially reversible — anyone can decode and read them without any key. Only the signature is cryptographic, and it proves integrity (not tampered with), not confidentiality. Never put sensitive data like passwords in a JWT payload.

**Q: Why use both an access token and a refresh token instead of one long-lived token?**
Answer: A single long-lived token that leaks stays valid — potentially for weeks — with no way to revoke it, since JWTs are stateless by design. Splitting into a short-lived access token (minutes) limits how long a stolen token is useful, while a longer-lived refresh token, which the server tracks and can revoke, lets the client silently get new access tokens without forcing the user to log in again.

**Q: How does the server verify a JWT hasn't been tampered with?**
Answer: `jwt.verify()` recomputes the signature from the token's header and payload using the server's secret (or public key for asymmetric algorithms) and compares it to the signature embedded in the token. If anyone altered the payload without knowing the secret, the recomputed signature won't match and verification throws.

**Q: How would you revoke a JWT before it expires?**
Answer: JWTs are stateless, so there's no built-in revocation. Common approaches: keep an allowlist/denylist (e.g., Redis) of valid or revoked token IDs that middleware checks in addition to signature verification, keep access token lifetimes very short so revocation is rarely needed, or track and revoke only the refresh tokens (as in the example above) so no new access tokens can be minted even though existing ones expire naturally within minutes.

**Q: Where should you store a JWT on the client, and why does it matter?**
Answer: `localStorage` is readable by any JavaScript running on the page, so an XSS vulnerability anywhere in the app can steal the token. An `httpOnly` cookie can't be read by JavaScript at all, closing that hole, but cookies are automatically sent with requests, which opens CSRF risk unless mitigated with `SameSite=strict` or anti-CSRF tokens. Keeping the token only in memory avoids both but is lost on page refresh. The choice is a trade-off, usually decided per threat model.
