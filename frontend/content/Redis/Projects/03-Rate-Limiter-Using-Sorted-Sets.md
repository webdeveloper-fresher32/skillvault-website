# Project 03 — Rate Limiter Using Sorted Sets

## Goal

Implement a sliding-window rate limiter — e.g. "a user may make at most 10 requests in any rolling 60-second window" — using a Sorted Set per user, without any external scheduler or cleanup job.

## What You'll Build

A Python function `is_allowed(user_id)` that records the current request's timestamp into a per-user Sorted Set, trims out anything older than the window, counts what's left, and returns whether the request should be allowed or rejected.

## Phases Required

- Phase 2 — Core Data Structures (Sorted Sets: `ZADD`, `ZCARD`, `ZREMRANGEBYSCORE`)

## Requirements

- Each user's request history lives in its own Sorted Set keyed by something like `ratelimit:<user_id>`, where the score is a timestamp and the member uniquely identifies that specific request.
- On every call to `is_allowed(user_id)`:
  - Remove entries older than the sliding window (e.g. older than 60 seconds ago) before counting.
  - Count how many entries remain in the window.
  - If the count is below the limit (e.g. 10), record this request (add it to the Sorted Set) and allow it.
  - If the count is at or above the limit, reject the request without adding a new entry.
- The rate-limiting Sorted Set must not grow forever — old entries outside the window must actually be removed, not just ignored during counting.
- Demonstrate the limiter correctly allowing up to the limit within a window, then rejecting further requests, then allowing requests again once the oldest ones age out of the window.

## Suggested Approach

1. Pick a window size and limit for testing (e.g. 5 requests per 10 seconds is easier to observe manually than 10 per 60 seconds) and a key naming scheme like `ratelimit:<user_id>`.
2. On each request, compute the current Unix timestamp (or a higher-resolution equivalent) to use as the Sorted Set score, and use something unique as the member — a plain timestamp string is usually enough as long as you account for the unlikely case of two requests landing on the exact same timestamp.
3. Before counting, use `ZREMRANGEBYSCORE` to drop every entry whose score is older than `now - window_seconds` — this is what keeps the Sorted Set from growing unbounded, since expired entries are purged on every call rather than relying on a background job or key TTL.
4. Count the remaining entries (`ZCARD` on the key) to decide whether this request is under the limit.
5. If under the limit, add the new request's timestamp with `ZADD` and allow it; if at or over the limit, reject it without adding anything, so a burst of rejected requests doesn't itself count against future windows.
6. Test by firing more requests than the limit in a tight loop, confirming the excess ones are rejected, then waiting past the window and confirming requests are allowed again.

## Stretch Goals

- Set a TTL on the rate-limit key itself (slightly longer than the window) so a user who stops making requests entirely doesn't leave a lingering, empty-but-present key forever.
- Wrap the "trim, count, conditionally add" sequence in a Lua script (forward-referencing Phase 8) to make the whole check-and-record operation atomic against concurrent requests from the same user.
- Extend the limiter to support multiple simultaneous windows per user (e.g. 10/minute AND 1000/day) using separate Sorted Set keys.

## Evaluation Checklist

- [ ] Requests within the limit inside a window are allowed, and each allowed request adds exactly one new Sorted Set entry.
- [ ] Once the limit is reached inside the current window, further requests are rejected and do not add new entries.
- [ ] After enough time passes for the oldest entries to age out of the window, new requests are allowed again.
- [ ] The Sorted Set for an active user does not grow without bound — old entries are visibly removed by `ZREMRANGEBYSCORE`, not just ignored.
- [ ] The logic correctly distinguishes "allowed" vs "rejected" outcomes across at least one full allow → reject → allow-again cycle.
