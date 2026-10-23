# OAuth2 Client-Credentials Flow

Every provider so far in this course has authenticated server-side API calls the same way: a static secret key (or key ID + key secret pair) sent directly on each request. PayPal breaks that pattern. Before your server can call any PayPal API, it first has to exchange its credentials for a short-lived access token, then attach that token — not the raw credentials — to every subsequent call. This lesson covers that extra hop and, more importantly, how to avoid re-doing it on every single request.

## 1. Why PayPal Uses OAuth2 (vs. Stripe/Razorpay's Static Keys, Phases 3-4)

Stripe's secret key (Phase 3) and Razorpay's key ID/key secret pair (Phase 4) are both used exactly as-is on every API call, for as long as the key exists — there's no separate "log in first" step, and no expiring token to track. PayPal's server-side integration instead uses OAuth2's **client-credentials grant**: your server presents its client ID and client secret once, to a dedicated OAuth token endpoint, and gets back a bearer access token that is only valid for a limited time. Every subsequent call to a PayPal API (creating an order, capturing a payment, verifying a webhook) then sends this bearer token in an `Authorization: Bearer <token>` header instead of sending the client secret directly.

This is a genuinely different shape from Phases 3-4, not just a naming difference — PayPal's client ID and secret are never attached directly to a payment-API call the way Stripe's or Razorpay's credentials are; they're only ever used to obtain (or refresh) the access token that stands in for them.

```text
Stripe / Razorpay (Phases 3-4):
  Your server --[secret key / key id+secret, every call]--> Provider API

PayPal (this lesson):
  Your server --[client id + secret, ONCE per token lifetime]--> OAuth token endpoint
  Your server <--[bearer access token + expiry]-------------------
  Your server --[Authorization: Bearer <token>, every call]------> PayPal API
```

## 2. The Client-Credentials Grant

The client-credentials grant is a standard OAuth2 flow (not PayPal-specific in concept — it's the same grant type used by plenty of machine-to-machine APIs) for exactly this case: two systems that already trust each other via a shared secret, with no end user involved. Your server sends an HTTP POST to PayPal's OAuth token endpoint, authenticating with **HTTP Basic Auth using the client ID as the username and the client secret as the password**, and a body indicating `grant_type=client_credentials`. PayPal responds with a JSON body containing an `access_token`, a `token_type` of `Bearer`, and an `expires_in` value (a number of seconds the token remains valid for).

```js
// ILLUSTRATIVE ONLY — representative of the shape of the token-fetch call, not
// asserted as exact live field/endpoint details. Requires live PayPal sandbox/live
// client id + secret to actually execute. Syntax-checked with `node --check` only.
const https = require("https");

async function fetchAccessToken(clientId, clientSecret) {
  // Illustrative: PayPal's OAuth token endpoint, authenticated with Basic Auth
  // over client id + secret, requesting the client-credentials grant.
  const response = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  // data.access_token, data.token_type ("Bearer"), data.expires_in (seconds)
  return data;
}

module.exports = { fetchAccessToken };
```

The exact token endpoint path, and the exact `expires_in` value PayPal returns, can change or vary between sandbox and live environments — always confirm both against current PayPal documentation before wiring up production code. As a general rule of thumb, treat the token as valid for **typically several hours**, not minutes and not days, but read whatever `expires_in` the response actually returns rather than hardcoding an assumed duration.

## 3. Token Caching and Expiry Handling

Because the token lasts on the order of hours rather than being a one-request-only credential, fetching a brand-new token before every single API call is both wasteful and adds an avoidable network round-trip (and possible failure point) to every request. The fix is to cache the token in memory alongside the timestamp it expires at, and only fetch a new one when the cached one is at or near that expiry.

The token-fetch call itself needs live credentials (illustrative above), but the caching *decision* — "is my cached token still good, or do I need a new one?" — is pure logic with no network dependency, so it's fully self-contained and testable with mock timestamps:

```js
// token-cache.js — SELF-CONTAINED, no network calls, no live credentials needed.
// This models the caching decision only; fetchAccessToken() above is swapped in
// for getFreshTokenFromPayPal() in a real integration.

function createTokenCache() {
  let cachedToken = null;
  let expiresAt = 0; // ms since epoch

  return {
    getToken(now, getFreshTokenFromPayPal) {
      // Refresh a little early (30s safety margin) rather than exactly at expiry,
      // so a request that starts just before expiry doesn't get a token that dies
      // mid-flight.
      const SAFETY_MARGIN_MS = 30 * 1000;

      if (cachedToken && now < expiresAt - SAFETY_MARGIN_MS) {
        return { token: cachedToken, source: "cache", expiresAt };
      }

      const fresh = getFreshTokenFromPayPal();
      cachedToken = fresh.access_token;
      expiresAt = now + fresh.expires_in_ms;
      return { token: cachedToken, source: "network", expiresAt };
    },
  };
}

module.exports = { createTokenCache };
```

## Comparison

| Aspect | Stripe (Phase 3) | Razorpay (Phase 4) | PayPal (this lesson) |
|---|---|---|---|
| Credential sent on each API call | Static secret key, directly | Static key ID + key secret, directly | Bearer access token (NOT the client secret directly) |
| Separate "log in" step required | No | No | Yes — client-credentials grant against an OAuth token endpoint |
| Credential expiry | Key doesn't expire (rotated manually if compromised) | Key doesn't expire (rotated manually if compromised) | Access token expires after a limited duration (typically several hours) and must be refreshed |
| Caching concern | None — same key used indefinitely | None — same key used indefinitely | Must cache the token and refresh before/at expiry, or every call pays a token-fetch round-trip |
| Failure mode unique to this model | N/A | N/A | A request can fail because the cached token expired mid-use, not just because credentials are wrong |

## Common Mistakes

- Calling the OAuth token endpoint fresh on every single API request instead of caching the token until it's near expiry — this adds an unnecessary network round-trip (and a new failure point) to every call, and can also mean uploading your client secret over the network far more often than necessary.
- Caching the token but never checking its expiry at all — treating an access token as if it behaves like Stripe's or Razorpay's non-expiring keys, and only discovering the mistake when calls start failing after the token dies partway through the day.
- Not building in a safety margin before the token's real expiry — refreshing at the exact expiry timestamp instead of slightly before it risks a request starting with a token that expires mid-flight, especially under a burst of concurrent requests.
- Hardcoding an assumed `expires_in` value instead of reading it from the token response — PayPal's actual expiry duration should always be read from the response, not assumed, since it can vary or change over time.

## Hands-On Exercises

All three exercises below use the self-contained `token-cache.js` module from section 3 — no live PayPal credentials are needed. Save it to a file and drive it with mock timestamps and a mock "fetch fresh token" function, as shown.

1. **Scenario A — cold start (no cached token yet).** Call `getToken` with no prior cache and confirm it fetches a fresh token (`source: "network"`).
2. **Scenario B — cached token still well within its lifetime.** Call `getToken` again shortly after Scenario A, well before expiry, and confirm it reuses the cache (`source: "cache"`) instead of fetching again.
3. **Scenario C — cached token past its safety margin.** Advance the mock clock to within the 30-second safety margin of the cached token's expiry (or past it) and call `getToken` again — confirm it fetches a fresh token (`source: "network"`) instead of reusing the stale one.

Run the full script below (with `token-cache.js` from section 3 saved alongside it) using `node run-scenarios.js`:

```js
const { createTokenCache } = require("./token-cache");

let fetchCallCount = 0;
function mockFetchFreshToken() {
  fetchCallCount += 1;
  return {
    access_token: "mock_token_" + fetchCallCount,
    expires_in_ms: 9 * 60 * 60 * 1000, // 9 hours, mock
  };
}

const cache = createTokenCache();

console.log("--- Scenario A: cold start (no cached token yet) ---");
const t0 = 1_000_000_000_000; // arbitrary mock "now" in ms
const resultA = cache.getToken(t0, mockFetchFreshToken);
console.log(resultA);

console.log("\n--- Scenario B: cached token still well within its lifetime ---");
const t1 = t0 + 5 * 60 * 1000; // 5 minutes later
const resultB = cache.getToken(t1, mockFetchFreshToken);
console.log(resultB);

console.log("\n--- Scenario C: cached token past its safety margin (near/at expiry) ---");
const t2 = resultA.expiresAt - 10 * 1000; // 10 seconds before real expiry, inside the 30s margin
const resultC = cache.getToken(t2, mockFetchFreshToken);
console.log(resultC);

console.log("\nTotal network fetches performed:", fetchCallCount);
```

Actual output from running this with `node`:

```text
--- Scenario A: cold start (no cached token yet) ---
{ token: 'mock_token_1', source: 'network', expiresAt: 1000032400000 }

--- Scenario B: cached token still well within its lifetime ---
{ token: 'mock_token_1', source: 'cache', expiresAt: 1000032400000 }

--- Scenario C: cached token past its safety margin (near/at expiry) ---
{ token: 'mock_token_2', source: 'network', expiresAt: 1000064790000 }

Total network fetches performed: 2
```

Scenario A fetches fresh (no cache yet, `fetchCallCount` goes to 1). Scenario B, 5 minutes later, reuses the same cached token — no new fetch. Scenario C, run at a mock timestamp 10 seconds before the cached token's real expiry (inside the 30-second safety margin), correctly triggers a second fetch (`fetchCallCount` goes to 2) rather than handing out a token that's about to die.

## Interview Q&A

**Q: Why does PayPal require an OAuth2 token exchange when Stripe and Razorpay don't?**
A: PayPal's server-side APIs authenticate calls with a short-lived bearer access token rather than a long-lived static key sent directly on every request; the client-credentials grant is how your server exchanges its client ID and secret for that token, which Stripe's and Razorpay's static-key models simply don't require.

**Q: What does the client-credentials grant actually send, and how is it authenticated?**
A: An HTTP POST to PayPal's OAuth token endpoint, authenticated via HTTP Basic Auth using the client ID as the username and the client secret as the password, with a `grant_type=client_credentials` body — it returns an access token, its type (`Bearer`), and how long it's valid for (`expires_in`).

**Q: Why shouldn't you fetch a new access token on every API call?**
A: The token remains valid for an extended period (typically several hours), so fetching a new one every call wastes a network round-trip and adds an avoidable failure point on every single request — caching the token until it's near expiry avoids both.

**Q: Why build in a safety margin before the token's actual expiry, instead of refreshing exactly at expiry?**
A: A request that begins using the cached token just before its exact expiry could have the token die mid-flight; refreshing slightly early (e.g. 30 seconds before expiry) avoids handing out a token that's about to become invalid.

**Q: In the caching logic from section 3, what determines whether `getToken` reuses the cache or fetches a new token?**
A: Whether the current time (`now`) is still earlier than `expiresAt` minus the safety margin — if so, the cached token is reused; if `now` is at or past that threshold, a fresh token is fetched and the cache is updated.
