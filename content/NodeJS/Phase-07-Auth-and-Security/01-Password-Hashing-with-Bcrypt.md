# Password Hashing with Bcrypt — Complete Guide

## Table of Contents
1. [Why Never Store Plaintext Passwords](#1-why-never-store-plaintext-passwords)
2. [Hashing vs Encryption](#2-hashing-vs-encryption)
3. [How Bcrypt Works](#3-how-bcrypt-works)
4. [Salt Rounds — Choosing a Cost Factor](#4-salt-rounds--choosing-a-cost-factor)
5. [Complete Registration/Login Example](#5-complete-registrationlogin-example)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Never Store Plaintext Passwords

```
Plaintext storage:
  users table: { email: "a@x.com", password: "hunter2" }

  Database breach → every user's real password is exposed.
  Most users reuse passwords → attacker now has access to their
  email, bank, and other accounts too.
```

If your database is ever leaked (breach, misconfigured backup, disgruntled employee with read access), plaintext passwords hand attackers working credentials immediately — no cracking required. Because people reuse passwords across sites, one leak from your app can compromise accounts on completely unrelated services. This is why storing plaintext (or even reversibly-encrypted) passwords is considered professional negligence and violates virtually every security standard (OWASP, PCI-DSS, SOC 2).

The fix: never store the password itself. Store a **one-way hash** of it. Even if the database leaks, the attacker only gets hashes, not usable credentials.

---

## 2. Hashing vs Encryption

These are often confused but solve different problems.

| | Hashing | Encryption |
|---|---------|------------|
| Direction | One-way — cannot be reversed | Two-way — can be decrypted with a key |
| Purpose | Verify data without knowing the original | Protect data you need to read back later |
| Use for passwords? | Yes — you never need the original password back | No — if you can decrypt it, so can an attacker who steals the key |
| Use for credit card numbers? | No — you need the real number for processing | Yes |
| Example algorithms | bcrypt, scrypt, Argon2 | AES-256, RSA |

For passwords, you never need to see the original value again — you only ever need to check "does this input match what was stored?" That's exactly what a one-way hash is for. Encryption would be strictly worse here: it introduces a decryption key that, if compromised, hands over every plaintext password at once.

Bcrypt (and scrypt, Argon2) are **deliberately slow** hash functions — this is a feature, not a bug. Fast hashes like MD5 or plain SHA-256 let an attacker try billions of password guesses per second on stolen hashes (brute force / rainbow tables). Bcrypt makes each guess expensive, so brute-forcing becomes impractical.

---

## 3. How Bcrypt Works

```
bcrypt.hash("myPassword123", saltRounds)
        │
        ├─ 1. Generate a random salt (unique per password)
        ├─ 2. Combine salt + password
        ├─ 3. Run through the Blowfish-based hashing algorithm,
        │      repeated 2^saltRounds times
        └─ 4. Output a single string containing:
               algorithm version + cost factor + salt + hash

Example output:
  $2b$10$N9qo8uLOickgx2ZMRZoMy.MrqUULmqXVfHnGRr3zM7RgOOKcVoju.
   │  │   │                    │
   │  │   │                    └─ 31-char hash
   │  │   └─ 22-char salt (base64)
   │  └─ cost factor (10 = 2^10 = 1024 rounds)
   └─ bcrypt version identifier
```

The salt is stored **inside** the output string itself, so you don't need a separate column for it. Every password gets a different random salt — this means two users with the identical password `password123` produce completely different hashes, which defeats precomputed rainbow-table attacks.

To verify a password at login, bcrypt re-extracts the salt from the stored hash, re-runs the same computation on the candidate password, and compares the results — it never "decrypts" anything.

---

## 4. Salt Rounds — Choosing a Cost Factor

The salt rounds (cost factor) controls how many times the hashing algorithm iterates. Each +1 doubles the work.

| Rounds | Approx. time per hash | Use case |
|--------|----------------------|----------|
| 8 | ~25ms | Too weak for production |
| 10 | ~100ms | Good default for most apps |
| 12 | ~300ms | Higher-security apps (banking, admin panels) |
| 14+ | ~1.3s+ | Rarely needed — hurts login UX and server throughput |

**Rule of thumb:** use 10–12. Higher rounds mean better resistance to brute force but slower login/registration requests and more CPU load per request — since this runs synchronously per login attempt, excessive rounds can become a DoS vector on a busy server. Re-evaluate every few years as hardware gets faster; what's "slow enough" today won't be in a decade.

---

## 5. Complete Registration/Login Example

```bash
npm install express bcrypt jsonwebtoken
```

```javascript
// db.js — in-memory "database" for this example
const users = []; // [{ id, email, passwordHash }]
let nextId = 1;

module.exports = {
  findByEmail: (email) => users.find((u) => u.email === email),
  createUser: (email, passwordHash) => {
    const user = { id: nextId++, email, passwordHash };
    users.push(user);
    return user;
  },
};
```

```javascript
// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
app.use(express.json());

const SALT_ROUNDS = 10;

// ---- Registration ----
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  if (db.findByEmail(email)) {
    return res.status(409).json({ error: 'email already registered' });
  }

  try {
    // bcrypt.hash generates a salt internally and returns the combined string
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = db.createUser(email, passwordHash);

    // never send the hash (or password) back to the client
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'registration failed' });
  }
});

// ---- Login ----
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.findByEmail(email);

  // Same error for "no such user" and "wrong password" — don't leak
  // which one it was, or attackers can enumerate valid emails.
  const genericError = { error: 'invalid email or password' };

  if (!user) {
    return res.status(401).json(genericError);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json(genericError);
  }

  // In a real app: issue a JWT or create a session here (see 02/03).
  res.json({ message: 'login successful', userId: user.id });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

```
Test with curl:

curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"correcthorse123"}'

curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"correcthorse123"}'
```

---

## 6. Common Mistakes

```
❌ Storing password with a fast hash: crypto.createHash('sha256')...
   → crackable at billions of guesses/sec on commodity GPUs

❌ Rolling your own salt: bcrypt.hash(password + mySalt, rounds)
   → bcrypt already salts internally; don't double up incorrectly

❌ Returning different errors for "user not found" vs "wrong password"
   → lets attackers enumerate which emails are registered

❌ Comparing hashes with === instead of bcrypt.compare()
   → bcrypt.compare handles salt extraction; manual comparison breaks it

❌ Logging the plaintext password anywhere (console.log(req.body))
   → ends up in log files, defeating the whole point of hashing
```

---

## 7. Hands-On Exercises

**Exercise 1:** Build the registration/login example above. Register the same password (`"password123"`) for two different emails and print both hashes — verify they're different strings despite the identical password.

**Exercise 2:** Write a small script that hashes the same password with `saltRounds` of 8, 10, and 12, and times each call with `console.time`/`console.timeEnd`. Observe how the time roughly doubles per round.

**Exercise 3:** Add a `/change-password` route that requires the user to supply their current password, verifies it with `bcrypt.compare`, and only then hashes and stores the new one.

**Exercise 4:** Modify the login route to return the exact same response body and status code whether the email doesn't exist or the password is wrong — verify with curl that both cases are indistinguishable from the outside.

---

## 8. Interview Q&A

**Q: Why shouldn't you encrypt passwords instead of hashing them?**
Answer: Encryption is reversible — anyone with the decryption key (including an attacker who steals it from your server) can recover every plaintext password at once. Hashing is one-way; you never need the original password back, only the ability to check whether a submitted password matches. A leaked hash database doesn't hand over usable credentials the way a leaked encryption key would.

**Q: Why is bcrypt preferred over a fast hash like SHA-256 for passwords?**
Answer: SHA-256 is designed to be fast, which is exactly wrong for passwords — it lets attackers brute-force billions of guesses per second against leaked hashes using GPUs. Bcrypt is deliberately slow and tunable via its cost factor (salt rounds), so each guess is computationally expensive, making brute-forcing impractical even after a breach.

**Q: What is a salt and why does bcrypt use one automatically?**
Answer: A salt is random data mixed into the password before hashing so that identical passwords produce different hashes. Without it, attackers could precompute hash tables (rainbow tables) for common passwords and instantly reverse any match. Bcrypt generates a unique salt per call to `bcrypt.hash()` and stores it inside the resulting hash string, so you don't need a separate salt column.

**Q: How do you choose the number of salt rounds?**
Answer: Each increment doubles the computation time. 10–12 is the typical production range — enough to resist brute force while keeping login latency (~100–300ms) acceptable. Because it directly affects CPU cost per login/registration request, going much higher can create a DoS risk on high-traffic endpoints.

**Q: Why should login return the same error for "user not found" and "wrong password"?**
Answer: Returning different messages lets attackers enumerate which emails are registered in your system (a "user enumeration" vulnerability), which they can then target with credential-stuffing or targeted phishing. A single generic message ("invalid email or password") for both cases prevents that leak.

**Q: What does bcrypt.compare() do internally?**
Answer: It extracts the salt and cost factor embedded in the stored hash string, re-runs the same bcrypt algorithm on the candidate password using that same salt and cost factor, and does a constant-time comparison of the result against the stored hash. You should always use `bcrypt.compare()` rather than manually hashing and comparing strings with `===`.
