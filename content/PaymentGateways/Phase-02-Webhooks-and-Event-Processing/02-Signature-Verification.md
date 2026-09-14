# Signature Verification

A webhook endpoint is a public URL — anyone who finds it can POST a JSON body that looks exactly like a real payment event. If your handler acts on whatever arrives without checking who really sent it, an attacker can fabricate a "payment.succeeded" event and get an order marked as paid for free. Signature verification is how you close that hole: it proves the request body actually came from the provider and wasn't altered in transit.

## 1. Why Verify Signatures

Providers sign every webhook payload with a secret that only you and the provider know (usually configured in your dashboard as a "webhook signing secret"). Alongside the request body, the provider sends a signature — a value computed from the body and the shared secret — in a request header. Your endpoint recomputes that same signature from the raw bytes it received and the secret it has on file, and compares the two. If they match, you know two things: the request body genuinely came from someone who holds the shared secret (presumably the provider), and the body wasn't modified after the provider signed it. If they don't match, the request should be rejected outright, before any business logic runs.

## 2. The General HMAC Verification Pattern

The mechanism providers use for this is HMAC (Hash-based Message Authentication Code) with SHA-256. The shape is the same across providers even though header names and exact encoding details differ:

```text
1. Provider computes: signature = HMAC-SHA256(secret, raw_request_body)
2. Provider sends the raw body + the signature in a header alongside it
3. Your endpoint reads the RAW body bytes (before any JSON parsing)
4. Your endpoint recomputes: expected = HMAC-SHA256(secret, raw_body_you_received)
5. Your endpoint compares `expected` to the signature the provider sent
6. Match -> process the event. No match -> reject with an error, do not process.
```

Here's a real, runnable Node.js implementation of the compute step, using `crypto.createHmac`:

```js
const crypto = require("crypto");

const secret = "whsec_test_shared_secret";
const rawBody = "{\n  \"id\": \"evt_1a2b3c\",\n  \"type\": \"payment.succeeded\",\n  \"amount\": 2000\n}";

function computeSignature(rawBody, secret) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

const computed = computeSignature(rawBody, secret);
console.log("Computed signature:", computed);
```

Actual output from running this with `node`:

```text
Computed signature: 4c10f5c4b4949e5f477acdf4d2416897cd266a0fddc5039c40644a9bf26e1285
```

That hex string is deterministic: the same `rawBody` and `secret` will always produce that exact 64-character SHA-256 hex digest, which is exactly why it works as a verification mechanism — anyone without the secret can't reproduce it, and any change to the body changes it completely.

## 3. Constant-Time Comparison (Avoiding Timing Attacks)

Once you've computed the expected signature, comparing it to the one the provider sent looks like it should just be `expected === received`. But a normal string comparison typically stops at the first mismatched character — meaning it can return slightly faster when the first character is wrong than when the first 30 characters are right and only the 31st is wrong. Measured over enough attempts, that timing difference is (in principle) enough for an attacker to guess a valid signature one character at a time, without ever knowing the secret. Node's `crypto.timingSafeEqual` compares two buffers in constant time regardless of where they first differ, closing that side channel.

```js
const crypto = require("crypto");

function verifySignature(rawBody, secret, receivedSignature) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(receivedSignature, "hex");
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
```

Note the length check before calling `timingSafeEqual` — that function throws if the two buffers aren't the same length, so mismatched lengths (e.g. a malformed header) have to be handled separately rather than passed straight in.

## Comparison

| Aspect | Plain `===` string comparison | `crypto.timingSafeEqual` |
|---|---|---|
| Comparison speed | Varies based on where the strings first differ | Constant time regardless of where they differ |
| Timing side-channel | Present — comparison time can leak information about how many leading characters are correct | Eliminated by design |
| Precondition | None | Both buffers must be equal length, or it throws — check lengths first |
| Appropriate for | Comparing non-secret values where timing leakage doesn't matter | Comparing secrets/signatures where timing leakage could be exploited |

## Common Mistakes

- Computing the HMAC over the *parsed and re-serialized* JSON body (e.g. `JSON.stringify(JSON.parse(rawBody))`) instead of the exact raw bytes received — whitespace, key ordering, and number formatting can change during parse/re-serialize, producing different bytes and therefore a different signature than the one the provider computed. Always read and hash the raw body before any JSON parsing touches it.
- Using plain `===` to compare the computed and received signatures instead of `crypto.timingSafeEqual`, leaving a timing side-channel open.
- Forgetting to reject the request (return an error status, stop processing) when signatures don't match, instead of just logging a warning and continuing anyway.
- Hardcoding or committing the webhook signing secret into source control instead of loading it from environment/secret storage — anyone with repo access could then forge valid signatures.
- Comparing signatures as raw strings without first converting both to buffers of matching encoding (e.g. comparing a hex string to a base64 string) — this fails even for a genuinely valid signature if the header's encoding isn't handled correctly.

## Hands-On Exercises

1. **Verify the original payload.** Save the `verifySignature` function above, plus the `computeSignature`/`rawBody`/`secret` from section 2, into one file. Compute `computed` from the original `rawBody`, then call `verifySignature(rawBody, secret, computed)` and confirm it logs `true`.
2. **Reject a tampered payload.** Using the same script, create a second body string with the `amount` field changed (e.g. `99999999` instead of `2000`), and call `verifySignature(tamperedBody, secret, computed)` — using the *original* signature against the *tampered* body. Confirm it logs `false`.
3. **Run both and compare.** Run the full script below with `node` and confirm your output matches:

   ```js
   const crypto = require("crypto");

   const secret = "whsec_test_shared_secret";
   const rawBody = "{\n  \"id\": \"evt_1a2b3c\",\n  \"type\": \"payment.succeeded\",\n  \"amount\": 2000\n}";

   function computeSignature(rawBody, secret) {
     return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
   }

   function verifySignature(rawBody, secret, receivedSignature) {
     const expected = computeSignature(rawBody, secret);
     const expectedBuf = Buffer.from(expected, "hex");
     const receivedBuf = Buffer.from(receivedSignature, "hex");
     if (expectedBuf.length !== receivedBuf.length) {
       return false;
     }
     return crypto.timingSafeEqual(expectedBuf, receivedBuf);
   }

   const computed = computeSignature(rawBody, secret);
   console.log("Computed signature:", computed);
   console.log("Verify original payload with correct signature:", verifySignature(rawBody, secret, computed));

   const tamperedBody = "{\n  \"id\": \"evt_1a2b3c\",\n  \"type\": \"payment.succeeded\",\n  \"amount\": 99999999\n}";
   console.log("Verify TAMPERED payload with original signature:", verifySignature(tamperedBody, secret, computed));

   const reserialized = JSON.stringify(JSON.parse(rawBody));
   console.log("Raw body === re-serialized body (bytes identical)?", rawBody === reserialized);
   console.log("Verify re-serialized payload with original signature:", verifySignature(reserialized, secret, computed));
   ```

   Actual output from running this with `node`:

   ```text
   Computed signature: 4c10f5c4b4949e5f477acdf4d2416897cd266a0fddc5039c40644a9bf26e1285
   Verify original payload with correct signature: true
   Verify TAMPERED payload with original signature: false
   Raw body === re-serialized body (bytes identical)? false
   Verify re-serialized payload with original signature: false
   ```

4. **Prove the parse/re-serialize bug.** Using the last two lines of output from exercise 3, explain in your own words why `rawBody === reserialized` is `false` even though they represent "the same" JSON data — and why that byte-level difference is exactly what breaks signature verification if you hash the wrong one.
5. **Wrong-length header.** Call `verifySignature(rawBody, secret, "abcd")` (a signature far shorter than a real one) and confirm your length check prevents `crypto.timingSafeEqual` from throwing — it should return `false` cleanly instead of crashing.

## Interview Q&A

**Q: What does verifying a webhook signature actually prove?**
A: That the request body was signed by someone holding the shared secret (presumably the provider) and that the body wasn't altered after signing — it does not, by itself, prove anything about network-level identity like source IP.

**Q: Why must you hash the raw request body instead of the parsed-and-re-serialized JSON?**
A: Because parsing and re-serializing can change whitespace, key order, or number formatting, producing different bytes than what the provider originally signed — hashing those different bytes yields a different signature, so a genuinely valid webhook would incorrectly fail verification.

**Q: Why use `crypto.timingSafeEqual` instead of `===` to compare signatures?**
A: `===` on strings can return faster when an early character mismatches than when only a late character mismatches, creating a timing side-channel that could in principle let an attacker infer the correct signature byte by byte; `timingSafeEqual` takes constant time regardless of where the difference is.

**Q: What should happen to the request if signature verification fails?**
A: It should be rejected immediately with an error response, and no business logic (crediting an order, sending confirmation, etc.) should run — the event is treated as untrusted.

**Q: Is a matching signature enough to guarantee the event hasn't been replayed from an earlier legitimate delivery?**
A: No — signature verification only proves authenticity and integrity of the body, not freshness or uniqueness. Preventing double-processing of a legitimately re-delivered event is a separate concern, handled by deduplicating on the event's unique ID (covered in the next lesson).
