# Project 02 — Session Store

## Goal

Build a session store where each logged-in user's session data lives in a Redis Hash, the session's TTL resets every time the user is active, and logging out immediately and completely removes the session.

## What You'll Build

A small Python module simulating a "login" (creates a session Hash with fields like `user_id`, `login_time`, `last_seen`), a "touch" operation (updates `last_seen` and resets the session's TTL, simulating activity on every request), and a "logout" operation that deletes the session key outright.

## Phases Required

- Phase 2 — Core Data Structures
- Phase 3 — Keys, Expiration and Eviction

## Requirements

- A `create_session(user_id)` function that generates a session ID (e.g. a random token or UUID), stores session fields in a Hash keyed by `session:<session_id>` using `HSET`, and sets an initial TTL on that key.
- A `touch_session(session_id)` function that updates a `last_seen` field in the Hash and resets the key's TTL back to the full value — simulating "the user just made a request, so keep the session alive."
- A `get_session(session_id)` function that returns the full session Hash via `HGETALL`, or indicates clearly that the session doesn't exist (expired or never created).
- A `logout(session_id)` function that deletes the session key immediately, regardless of remaining TTL.
- Sessions that are never touched must expire on their own after the configured TTL — no manual cleanup process.

## Suggested Approach

1. Decide on a key naming convention for sessions (e.g. `session:<session_id>`) and a set of Hash fields to store (`user_id`, `login_time`, `last_seen`), consistent with the colon-delimited naming convention from Phase 3.
2. Implement `create_session` using `HSET` to write the fields, then a separate `EXPIRE` call to set the initial TTL — note that `HSET` itself doesn't accept a TTL argument, unlike `SET ... EX`.
3. Implement `touch_session` by updating the `last_seen` field with `HSET` and then re-issuing `EXPIRE` with the full TTL value again, so an active session's clock keeps resetting instead of counting down toward expiration.
4. Implement `get_session` with `HGETALL`, and explicitly handle the case where the key doesn't exist (an empty Hash/empty dict back from Redis) as "not logged in," not as an error.
5. Implement `logout` with a plain `DEL`, and confirm a subsequent `get_session` call for that same ID correctly reports no session.
6. Write a short test sequence: create a session, touch it a few times with the TTL checked in between, let one session sit untouched until it expires, and log out of another one explicitly — confirm all three end states independently.

## Stretch Goals

- Add a "list all active sessions for a user" feature using a Set that tracks session IDs per `user_id`, updated on create/logout.
- Add a maximum session lifetime independent of activity (e.g. force logout after 24 hours even if constantly touched), by tracking `login_time` and checking elapsed time in `touch_session` before resetting the TTL.
- Simulate concurrent "requests" touching the same session from multiple threads or async tasks and confirm the TTL still behaves correctly.

## Evaluation Checklist

- [ ] A freshly created session appears in Redis as a Hash with all expected fields (`HGETALL` shows them).
- [ ] The session's TTL is visibly set (via `TTL`) immediately after creation.
- [ ] Touching a session updates `last_seen` and resets its TTL back to the full duration.
- [ ] A session left untouched past its TTL disappears on its own — `get_session` for it returns "not found," not stale data.
- [ ] Calling `logout` removes the session immediately, even if its TTL had plenty of time left.
