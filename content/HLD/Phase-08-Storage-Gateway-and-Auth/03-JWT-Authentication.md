# JWT Authentication

Think back to Phase 03 Lesson 02: the moment you scale horizontally, a server can't remember "who's logged in" in its own local memory, because the next request might land on a completely different machine. JWT (JSON Web Token) authentication is the standard answer to that exact problem — it moves the proof of "who you are" into the request itself, instead of into any one server's memory.

## The Flow

```
1. Login
   User ──"email + password"──▶ Backend
                                    │
                                    │ verify credentials against DB
                                    │ generate a signed JWT
                                    ▼
   User ◀──────── JWT Token ───────┘

2. Every future request
   User ──"GET /feed" + JWT in header──▶ Backend
                                            │
                                            │ verify JWT signature
                                            │ (no DB lookup needed!)
                                            ▼
                                         200 OK
```

The token itself carries the user's identity, signed in a way the server can verify without storing anything about the session anywhere. Whichever backend instance receives the request — Server 1, Server 2, Server 47 — can independently verify the same token, because verification only needs the shared secret key, not a lookup in some central session store.

## Generating a Token

The roadmap's exact pattern, using PyJWT:

```python
import jwt

SECRET_KEY = "super-secret-key-stored-in-env-vars"

token = jwt.encode(
    {"user_id": 1},
    SECRET_KEY,
    algorithm="HS256"
)
```

`jwt.encode` takes a payload (a dict — here just `user_id`, but often also `email`, `role`, and an expiry), a secret key, and a signing algorithm, and returns a compact, URL-safe string made of three base64-encoded parts separated by dots: `header.payload.signature`.

Decoding (and verifying) it on a later request:

```python
from fastapi import Depends, HTTPException, Header
import jwt

def get_current_user(authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["user_id"]

@app.get("/feed")
def get_feed(user_id: int = Depends(get_current_user)):
    return {"feed": build_feed_for(user_id)}
```

Notice there's no `SELECT * FROM sessions WHERE token = ...` anywhere in this flow. The server proves the token is genuine using math (verifying the signature with `SECRET_KEY`), not by remembering it issued that token in the first place.

## Why This Is "Stateless" Authentication

This is the direct payoff of Phase 03 Lesson 02's argument. Compare the two approaches:

```
Server-side sessions (stateful)          JWT (stateless)
────────────────────────────────         ──────────────────────────────
Login → server stores                    Login → server signs a token
{session_id: user_id} in memory          containing user_id, hands it
or a shared store                        to the client

Every request → server looks             Every request → server verifies
up session_id against that store         the signature, reads user_id
                                          directly out of the token

Breaks across servers unless the         Works identically on any server
session store is externalized            that has the shared SECRET_KEY
(Redis, per Phase 03/06)
```

JWTs don't eliminate the need for a shared store entirely (see the eventual need to check a revocation list, below) — but for the common case, any backend instance can authenticate any request with zero coordination, which is exactly what horizontal scaling needs.

## Token Expiry and Refresh Tokens

A JWT that never expires is a permanent credential — if it leaks, it leaks forever. In practice, tokens carry a short expiry:

```python
import datetime

token = jwt.encode(
    {
        "user_id": 1,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    },
    SECRET_KEY,
    algorithm="HS256",
)
```

A 15-minute expiry limits the damage of a leaked token, but logging in again every 15 minutes would be unusable. The standard fix is a **refresh token**: a longer-lived, more carefully guarded token issued alongside the short-lived **access token**. When the access token expires, the client silently exchanges the refresh token for a fresh access token — no password re-entry needed — and the refresh token itself is revocable server-side (e.g. stored in the DB or Redis) since it's used far less often, so checking it costs little.

```
Access token:  short-lived (minutes), sent on every request, stateless-verified
Refresh token: long-lived (days/weeks), sent only to get a new access token,
               checked against a server-side store so it CAN be revoked
```

This is the common middle ground: most requests stay fully stateless and fast, while the system retains a way to revoke access (e.g. on logout, or a suspected compromise) without waiting for every outstanding access token to simply expire.

## Interview Q&A

**Q: Walk me through what happens from login to an authenticated request, using JWTs.**
Answer: The user submits credentials to a login endpoint; the server verifies them against the database, then generates a signed JWT containing the user's identity (and typically an expiry) and returns it to the client. On every subsequent request, the client attaches the JWT (usually in an `Authorization: Bearer <token>` header), and the server verifies the token's signature using its secret key — if valid, it trusts the identity embedded in the token without any further database lookup.

**Q: Why is JWT authentication described as "stateless," and why does that matter for scaling?**
Answer: It's stateless because the server doesn't need to store any session data to authenticate a request — everything needed (the user's identity, signed so it can't be tampered with) travels inside the token itself. This matters directly for horizontal scaling (Phase 03): any backend instance that shares the same secret key can independently verify any token, so requests can be load-balanced across any server without needing a shared session store or sticky sessions.

**Q: What stops a user from tampering with a JWT to claim they're a different user_id?**
Answer: The signature. The token's payload is signed with a secret key known only to the server (or, for asymmetric algorithms, verified with a public key while only the server holds the private signing key). Changing the payload without re-signing it correctly invalidates the signature, so `jwt.decode` will raise an error on verification — the payload itself is only base64-encoded, not encrypted, so it shouldn't contain secrets, but it can't be silently modified without detection.

**Q: If JWTs are stateless, how do you log a user out or revoke access before the token naturally expires?**
Answer: A pure stateless JWT can't be individually revoked before its expiry, which is exactly why access tokens are kept short-lived (minutes). For actual revocation, systems maintain a small server-side store (a blocklist of revoked token IDs, or a revocable refresh token record) that's checked either on refresh or via a lightweight lookup — trading a little bit of statelessness back for the ability to forcibly end a session.

**Q: What's the difference between an access token and a refresh token?**
Answer: The access token is short-lived and sent with every request; it's verified statelessly and is the thing that actually authenticates API calls. The refresh token is longer-lived, sent only to a dedicated endpoint to obtain a new access token when the old one expires, and is checked against a server-side store so it can be revoked — this gives you the performance of stateless verification for most traffic while still retaining a practical way to end a session early.
