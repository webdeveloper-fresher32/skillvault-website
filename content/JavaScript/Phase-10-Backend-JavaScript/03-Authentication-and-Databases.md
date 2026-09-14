# Authentication and Databases — Complete Guide

## Table of Contents
1. [Why Passwords Must Be Hashed, Never Stored Plainly](#1-why-passwords-must-be-hashed-never-stored-plainly)
2. [Password Hashing with bcrypt](#2-password-hashing-with-bcrypt)
3. [JWT Authentication — Signing and Verifying](#3-jwt-authentication--signing-and-verifying)
4. [Middleware to Protect Routes](#4-middleware-to-protect-routes)
5. [Refresh Tokens](#5-refresh-tokens)
6. [MongoDB with Mongoose](#6-mongodb-with-mongoose)
7. [SQL with pg / mysql2 and Parameterized Queries](#7-sql-with-pg--mysql2-and-parameterized-queries)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Passwords Must Be Hashed, Never Stored Plainly

Storing a user's password as plain text means anyone with database access — an attacker who breaches your database, a malicious insider, or a careless backup left exposed — instantly has every user's real password, which many people reuse across other accounts. **Hashing** turns a password into a one-way, fixed-length string that cannot practically be reversed back into the original password.

```
Plain text (never do this):
  users table: { email: "a@x.com", password: "hunter2" }
  → a database breach = every password leaked in cleartext

Hashed (correct):
  users table: { email: "a@x.com", passwordHash: "$2b$10$N9qo8uLOickgx2Zm..." }
  → a database breach reveals only hashes; original password is not recoverable
  → login compares a NEW hash of the submitted password against the stored hash
```

A plain cryptographic hash (like SHA-256) alone is not enough — it's *fast* by design, which means an attacker with a stolen hash database can try billions of guesses per second (a "brute-force" or "dictionary" attack), and identical passwords always produce identical hashes, letting attackers use precomputed "rainbow tables." This is why password hashing uses algorithms specifically designed to be **slow** and **salted**.

---

## 2. Password Hashing with bcrypt

bcrypt is purpose-built for password hashing: it's deliberately slow (configurable via a "cost factor"/"rounds"), and it automatically generates and embeds a random **salt** — extra random data mixed into each password before hashing — so that two users with the identical password get completely different hashes.

```js
import bcrypt from "bcrypt";

// --- Hashing a password during signup ---
async function hashPassword(plainPassword) {
  const saltRounds = 10; // cost factor — higher = slower = more resistant to brute force
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  return hash;
  // e.g. "$2b$10$N9qo8uLOickgx2ZMRZoMy.Mrq4kZBAZC.WPeE1Slkf3lWxwWtQNMi"
  //        ^algo ^rounds ^-------- salt --------^------- hash --------^
  //        the salt is stored INSIDE the hash string itself — no separate column needed
}

// --- Verifying a password during login ---
async function verifyPassword(plainPassword, storedHash) {
  return bcrypt.compare(plainPassword, storedHash); // returns true/false
  // bcrypt extracts the salt from storedHash, re-hashes plainPassword with
  // that same salt, and compares the result — never decrypts anything
}

// Full signup/login flow
async function signup(email, plainPassword) {
  const passwordHash = await hashPassword(plainPassword);
  await db.users.insert({ email, passwordHash }); // store the hash, never the plain password
}

async function login(email, plainPassword) {
  const user = await db.users.findByEmail(email);
  if (!user) return null; // don't reveal whether the email exists (see note below)

  const isValid = await verifyPassword(plainPassword, user.passwordHash);
  if (!isValid) return null;

  return user;
}
```

### Key Points

```
- Never log, return in API responses, or transmit passwordHash to the client.
- Return the SAME generic error ("Invalid email or password") whether the
  email doesn't exist or the password is wrong — distinguishing the two
  lets attackers enumerate valid registered emails.
- bcrypt has a 72-byte input limit — extremely long passwords are silently
  truncated; this is rarely a practical issue but worth knowing.
- Cost factor 10-12 is a common default in 2026 — higher costs slow down
  both attackers AND your own server, so it's a deliberate trade-off,
  periodically increased as hardware gets faster.
```

---

## 3. JWT Authentication — Signing and Verifying

A JSON Web Token (JWT) is a compact, self-contained, cryptographically signed string that encodes claims (like `userId`, `role`, expiration) about an authenticated user. The server signs it once at login; on every subsequent request, the server can verify it without a database lookup or server-side session storage.

```
JWT structure:  header.payload.signature

eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MiJ9.4Ftn8V3KayY...
└──────┬───────────┘ └─────────┬──────────┘└────┬─────┘
     header               payload              signature
  {"alg":"HS256"}    {"userId":"42",...}   HMAC-SHA256(header + "." + payload, SECRET)

The signature proves the payload hasn't been tampered with — anyone can
DECODE (base64) the payload and read it, but only someone with the
server's secret key can produce a signature that verifies correctly.
JWTs are NOT encrypted — never put sensitive data (passwords, full
credit card numbers) directly in the payload.
```

```js
import jwt from "jsonwebtoken";

// --- Signing a token at login ---
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role }, // payload/claims
    process.env.JWT_SECRET,                                   // signing secret — keep out of source control
    { expiresIn: "15m" }                                       // short-lived access tokens are safer
  );
}

// --- Verifying a token on protected requests ---
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET); // returns decoded payload if valid
  } catch (err) {
    // TokenExpiredError, JsonWebTokenError, etc.
    return null;
  }
}

// --- Full login route ---
app.post("/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = generateAccessToken(user);
  res.json({ accessToken });
}));
```

---

## 4. Middleware to Protect Routes

```js
// Extracts and verifies the JWT from the Authorization header,
// attaching the decoded user info to req.user for downstream handlers.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization; // "Bearer <token>"
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication token required" });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = payload; // now available to every handler after this middleware
  next();
}

// Role-based authorization — layered on top of authentication
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Usage
app.get("/profile", requireAuth, (req, res) => {
  res.json({ userId: req.user.userId, email: req.user.email });
});

app.delete("/admin/users/:id", requireAuth, requireRole("admin"), (req, res) => {
  // only reached if the token is valid AND req.user.role === "admin"
  res.json({ deleted: req.params.id });
});
```

---

## 5. Refresh Tokens

Short-lived access tokens (minutes) limit the damage if one is stolen, but forcing users to log in again every 15 minutes is a poor experience. The **refresh token** pattern solves this: a long-lived, more carefully guarded token that can be exchanged for new access tokens without re-entering credentials.

```
Login:
  Client ──── email + password ────▶ Server
  Client ◀─── accessToken (15m) + refreshToken (7d) ──── Server
                                      (refreshToken stored in httpOnly cookie
                                       or securely on the client; accessToken
                                       used in Authorization header per request)

Access token expires:
  Client ──── refreshToken ────▶ Server: POST /auth/refresh
  Server verifies refreshToken (checks against a stored/allow-listed
    version so it can be REVOKED, unlike a stateless access token)
  Client ◀─── new accessToken ──── Server

Logout / revoke:
  Server deletes the refreshToken record from the database —
  it can no longer be used to mint new access tokens, even though
  any still-valid access tokens continue working until they naturally expire.
```

```js
function generateRefreshToken(user) {
  return jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

app.post("/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token server-side so it can be individually revoked later
  await db.refreshTokens.insert({ userId: user.id, token: refreshToken });

  res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: true, sameSite: "strict" });
  res.json({ accessToken });
}));

app.post("/auth/refresh", asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ error: "Refresh token required" });

  const stored = await db.refreshTokens.findByToken(token);
  if (!stored) return res.status(401).json({ error: "Refresh token revoked or invalid" });

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await db.users.findById(payload.userId);
    res.json({ accessToken: generateAccessToken(user) });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}));

app.post("/auth/logout", asyncHandler(async (req, res) => {
  await db.refreshTokens.delete(req.cookies.refreshToken); // revoke server-side
  res.clearCookie("refreshToken");
  res.sendStatus(204);
}));
```

---

## 6. MongoDB with Mongoose

Mongoose is an ODM (Object-Document Mapper) for MongoDB that adds schema definition, validation, and a query API on top of the native MongoDB driver.

```js
import mongoose from "mongoose";

// --- Connection ---
await mongoose.connect(process.env.MONGO_URI); // e.g. "mongodb://localhost:27017/myapp"

// --- Schema and Model ---
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// --- Create ---
const user = await User.create({ email: "alice@example.com", passwordHash });

// --- Read ---
const found = await User.findOne({ email: "alice@example.com" });
const all = await User.find({ role: "user" }).limit(20).sort({ createdAt: -1 });
const byId = await User.findById(userId);

// --- Update ---
await User.findByIdAndUpdate(userId, { role: "admin" }, { new: true }); // returns updated doc
await User.updateMany({ role: "user" }, { $set: { verified: true } });

// --- Delete ---
await User.findByIdAndDelete(userId);

// --- Validation errors are thrown automatically ---
try {
  await User.create({ email: "not-an-email-format-check-happens-in-schema" }); // missing passwordHash
} catch (err) {
  if (err.name === "ValidationError") {
    console.log(Object.values(err.errors).map(e => e.message));
  }
}
```

Mongoose schemas give you validation (`required`, `enum`, custom validators), default values, and middleware hooks (`pre("save")` for things like automatically hashing a password before it's persisted) — all missing from the raw native MongoDB driver, which just deals in plain JS objects.

---

## 7. SQL with pg / mysql2 and Parameterized Queries

For relational databases, `pg` (PostgreSQL) and `mysql2` (MySQL) are the standard Node drivers. The single most important security rule with SQL is: **never build a query by concatenating user input into a string.**

```js
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ❌ SQL INJECTION VULNERABILITY — never do this
async function findUserUnsafe(email) {
  const result = await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
  return result.rows[0];
  // If email = "' OR '1'='1", the query becomes:
  //   SELECT * FROM users WHERE email = '' OR '1'='1'
  // which returns EVERY row in the table — a classic injection attack.
}

// ✅ Parameterized query — the driver sends the value SEPARATELY from
// the query structure, so it can NEVER be interpreted as SQL syntax
async function findUserByEmail(email) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1", // $1, $2... are pg's placeholder syntax
    [email]
  );
  return result.rows[0];
}

// Insert with parameters
async function createUser(email, passwordHash) {
  const result = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
    [email, passwordHash]
  );
  return result.rows[0];
}

// Update with parameters
await pool.query("UPDATE users SET role = $1 WHERE id = $2", ["admin", userId]);
```

```js
// mysql2 uses `?` placeholders instead of $1/$2, otherwise the same principle
import mysql from "mysql2/promise";
const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute(
  "SELECT * FROM users WHERE email = ?", // placeholder
  [email]                                  // value supplied separately — safe from injection
);
```

### Why Parameterized Queries Prevent Injection

```
String concatenation:
  User input becomes PART OF the SQL text itself before the database
  ever parses it — the database cannot tell "data" from "code."

Parameterized query:
  The query STRUCTURE ("SELECT ... WHERE email = $1") is sent to the
  database and compiled/parsed FIRST. The value is sent SEPARATELY and
  substituted into the already-parsed query plan afterward — it is
  always treated as a literal value, never as executable SQL syntax,
  no matter what characters it contains.
```

---

## 8. Hands-On Exercises

**Exercise 1:** Build a signup/login flow using Express, bcrypt, and an in-memory array as your "database": `POST /auth/signup` hashes the password and stores `{ email, passwordHash }`; `POST /auth/login` verifies with `bcrypt.compare` and returns a JWT access token on success. Confirm that submitting the correct password succeeds and a wrong password (or non-existent email) both return the same generic 401 error message.

**Exercise 2:** Add a `requireAuth` middleware and a `GET /profile` route that only returns data if a valid `Authorization: Bearer <token>` header is present. Test three cases with `curl`: no header (expect 401), a garbage token string (expect 401), and a valid token from Exercise 1's login response (expect 200 with profile data).

**Exercise 3:** Implement the full refresh-token flow from Section 5 — signing both an access token (short expiry) and refresh token (long expiry) at login, storing the refresh token server-side, exposing `POST /auth/refresh` to mint a new access token, and `POST /auth/logout` to revoke it. Manually expire an access token by signing one with `expiresIn: "5s"`, wait past expiry, confirm a protected route now returns 401, then use the refresh endpoint to get a new one.

**Exercise 4:** Set up a local MongoDB instance (or Atlas free tier) and define a Mongoose `User` schema with `email` (unique, required), `passwordHash`, and `role` (enum of `user`/`admin`, default `user`). Wire up the signup/login routes from Exercise 1 to persist to MongoDB instead of an in-memory array, and add a `pre("save")` hook that hashes a plaintext `password` virtual field into `passwordHash` automatically before saving.

**Exercise 5:** Set up a local PostgreSQL database with a `users` table (`id`, `email`, `password_hash`, `created_at`). Rewrite the signup/login persistence layer using `pg` with fully parameterized queries. Then, as a deliberate learning exercise, write one intentionally vulnerable query using string concatenation, and demonstrate (in a safe local test) how passing `email = "' OR '1'='1"` behaves differently between the vulnerable and parameterized versions.

---

## 9. Interview Q&A

**Q: Why is bcrypt preferred over a fast hash like SHA-256 for storing passwords?**
Answer: SHA-256 is a general-purpose cryptographic hash designed to be extremely fast, which is exactly the wrong property for password storage — a fast hash lets an attacker who steals the password database try billions of guesses per second on commodity hardware (or even faster with GPUs), making brute-force and dictionary attacks highly practical. bcrypt is specifically designed to be slow, with a configurable "cost factor" that can be tuned upward as hardware gets faster, and it automatically generates and embeds a unique random salt per password, so identical passwords never produce identical hashes and precomputed rainbow-table attacks become useless. The deliberate slowness that makes bcrypt "worse" for raw throughput is precisely what makes it appropriate for password hashing, where you want each guess to be as expensive as possible for an attacker while still being fast enough for one legitimate login.

**Q: What does it mean that a JWT is signed but not encrypted, and why does that matter for what you put in the payload?**
Answer: A JWT's payload is only base64-encoded, not encrypted — anyone who intercepts or is handed the token can trivially decode the payload and read its contents as plain JSON, even without knowing the server's secret key. The signature exists purely to let the server verify the payload hasn't been tampered with since it was issued: only someone possessing the signing secret can produce a signature that will validate against a given payload, so an attacker could read the claims but couldn't forge a new token with modified claims (like changing `role: "user"` to `role: "admin"`) without the server rejecting it as invalid. This means JWT payloads must never contain sensitive information like passwords, raw credit card numbers, or anything an attacker shouldn't be able to simply read by decoding the token.

**Q: Why use both a short-lived access token and a longer-lived refresh token instead of just one long-lived token?**
Answer: A single long-lived token is a bigger liability if it's ever stolen — it would remain valid and usable for a long time, and because JWTs are stateless (verified by signature alone, not looked up in a database), there's typically no way to revoke an individual stolen token before it naturally expires. Splitting into two tokens limits the blast radius: the access token is short-lived (minutes), so a stolen access token becomes useless quickly on its own, while the refresh token is longer-lived but is checked against a server-side record on every use, meaning it can be explicitly revoked (e.g. on logout, or if compromise is suspected) by simply deleting that record — something a purely stateless access token can't support. This gives you the performance benefit of stateless access-token verification on most requests, while retaining a revocation mechanism through the less-frequently-used refresh flow.

**Q: How exactly does a parameterized SQL query prevent SQL injection, compared to string concatenation?**
Answer: With string concatenation, user input is spliced directly into the SQL text before the database ever sees it, so if the input contains SQL syntax (like `' OR '1'='1`), the database has no way to distinguish it from legitimate query structure — it just sees one string of SQL and executes whatever that string says, including any injected logic. A parameterized query instead sends the query's structure (with placeholders like `$1` or `?`) to the database to be parsed and compiled first, and sends the actual values in a completely separate channel; the database substitutes those values into the already-fixed query plan as literal data, never as SQL syntax to be interpreted, so no matter what characters the input contains, it can only ever be treated as a value, never as executable code.

**Q: What's the practical difference between using Mongoose versus the native MongoDB driver, and when might you choose the native driver instead?**
Answer: The native MongoDB driver works directly with plain JavaScript objects and gives you full control with no imposed structure, but that also means you're responsible for validation, defaults, and any consistency rules yourself, and typos in field names fail silently since there's no schema to catch them. Mongoose layers a schema on top, giving you declarative validation (required fields, enums, custom validators), default values, type casting, and lifecycle hooks (like automatically hashing a password in a `pre("save")` hook) — at the cost of some performance overhead and a layer of abstraction that occasionally makes advanced/aggregation-heavy queries more awkward to express than they would be with raw driver calls. Teams often choose the native driver directly when they need maximum performance for high-throughput or highly dynamic-schema workloads, or when they're already comfortable enforcing validation at the application layer some other way; Mongoose is preferred when a team wants the guardrails and productivity of schema-driven models, especially in fast-moving application development where consistency across many similar documents matters.
