# At-Least-Once Delivery and Idempotent Handlers

Signature verification tells you a webhook is genuine. It doesn't tell you it's the first time you've seen it — providers can and do deliver the same event more than once, and a handler that isn't built to expect that will double-credit orders, send duplicate emails, or double-fulfill purchases.

## 1. At-Least-Once Delivery

Payment providers generally guarantee "at-least-once" delivery for webhooks: if your endpoint doesn't acknowledge an event (for example, it times out, returns an error, or your server is briefly down), the provider will retry sending that same event later. This is a deliberate design choice — it's far safer for the provider to occasionally send a duplicate than to silently drop an event because your server had a bad moment. The tradeoff is that "at least once" is not "exactly once": your handler is guaranteed to see every event, but it may see some of them more than once, and it has to be correct either way.

```text
Provider sends event evt_001
        |
        v
Your endpoint is slow / crashes / network blip before responding 2xx
        |
        v
Provider considers delivery unconfirmed -> retries evt_001 later
        |
        v
Your endpoint now receives evt_001 A SECOND TIME
```

## 2. Making Handlers Idempotent (Dedup by Event ID)

Every webhook event carries a unique event ID. The fix for at-least-once delivery is to record which event IDs you've already processed, and skip any event whose ID you've seen before — this is what makes a handler idempotent (running it twice on the same input has the same effect as running it once). The dedup store needs to survive process restarts in production (a database table or a cache like Redis), but the logic is easiest to see with a plain in-memory `Set`:

```js
function makeHandler() {
  const processedEventIds = new Set();
  let processedCount = 0;

  function handleWebhookEvent(eventId, eventType) {
    if (processedEventIds.has(eventId)) {
      console.log(`[handler] Event ${eventId} (${eventType}) already processed - SKIPPING (no double-processing)`);
      return;
    }
    processedEventIds.add(eventId);
    processedCount++;
    console.log(`[handler] Event ${eventId} (${eventType}) is new - PROCESSING (e.g. credit order, send email)`);
  }

  return { handleWebhookEvent, getProcessedCount: () => processedCount };
}
```

Running it with the same event ID fed in twice:

```js
const demo1 = makeHandler();
demo1.handleWebhookEvent("evt_001", "payment.succeeded");
demo1.handleWebhookEvent("evt_001", "payment.succeeded"); // redelivered by provider
console.log("Distinct events processed in demo 1:", demo1.getProcessedCount());
```

Actual output from running this with `node`:

```text
[handler] Event evt_001 (payment.succeeded) is new - PROCESSING (e.g. credit order, send email)
[handler] Event evt_001 (payment.succeeded) already processed - SKIPPING (no double-processing)
Distinct events processed in demo 1: 1
```

The second call with the identical event ID is skipped — the order gets credited exactly once, no matter how many times the provider redelivers that event.

## 3. Returning 2xx Quickly (and Processing Async)

The dedup check has to run fast, and so does everything else before your handler responds. If your handler does slow work synchronously — calling a third-party email API, running a heavy database transaction, waiting on another service — before it sends back a 2xx response, the provider's request can time out waiting. From the provider's point of view, a timeout looks identical to a failure, so it retries the same event, which is exactly the "redelivery" scenario the dedup logic above has to handle anyway. The standard pattern is: verify the signature, check for a duplicate event ID, record the event ID and hand the actual work off to a background job/queue, then return 2xx immediately — keeping the synchronous part of the handler as small as possible.

```text
Webhook arrives
      |
      v
Verify signature  -----> invalid? reject, do not process
      |
      v
Check event ID against dedup store  -----> already seen? return 2xx, skip work
      |
      v
Record event ID as processed
      |
      v
Enqueue the actual work (send email, update order, etc.)
      |
      v
Return 2xx  <-- this happens fast, before the enqueued work necessarily finishes
```

## Comparison

| Approach | Double-processing on redelivery? | Risk of provider timeout/retry storm |
|---|---|---|
| No dedup, synchronous slow work before responding | Yes — every redelivery re-runs the full handler, including the slow work | High — slow work delays the response, increasing odds of a timeout-triggered retry |
| Dedup by event ID, synchronous slow work before responding | No — duplicates are skipped | Still high for the first delivery of each event, since the slow work still blocks the response |
| Dedup by event ID, work handed off to a background job before responding | No — duplicates are skipped | Low — the handler responds quickly regardless of how long the actual work takes |

## Common Mistakes

- Not deduplicating by the event's unique ID at all — treating "a POST arrived at my webhook URL" as automatically meaning "a new event happened," which causes a routine redelivery to double-credit an order or send a second confirmation email.
- Doing slow synchronous work (calling external APIs, heavy DB writes, sending emails) inside the handler *before* returning the 2xx response — if this pushes the response past the provider's timeout, the provider treats it as a failed delivery and retries, creating exactly the redelivery scenario the handler now has to survive.
- Storing the dedup set only in memory in production — an in-memory `Set` is fine for demonstrating the concept, but it's wiped on every restart/deploy, so a real handler needs a persistent store (database table, Redis, etc.) so that redeliveries after a restart are still caught.
- Deduplicating by something other than the event ID (e.g. by order ID or by the raw payload's hash) — two genuinely different events for the same order (a `payment.succeeded` followed by a `refund.issued`) must both be processed, so the dedup key has to be the event's own unique ID, not something coarser.
- Marking an event ID as "processed" only *after* the slow work finishes, instead of right after the dedup check — if the process crashes mid-work, the event ID was never recorded, so the inevitable redelivery re-does the same work from scratch (and may partially double it, depending on what "the work" is).

## Hands-On Exercises

1. **Run the dedup snippet as-is.** Save the `makeHandler` function and the demo-1 code above into one file, run it with `node`, and confirm you get the two lines of output shown in section 2 — the first call processes, the second is skipped, and `getProcessedCount()` returns `1`.
2. **Feed 3 events, one ID repeats.** Extend the file with:

   ```js
   const demo2 = makeHandler();
   demo2.handleWebhookEvent("evt_101", "payment.succeeded");
   demo2.handleWebhookEvent("evt_102", "refund.issued");
   demo2.handleWebhookEvent("evt_101", "payment.succeeded"); // redelivery of evt_101
   console.log("Distinct events processed in demo 2:", demo2.getProcessedCount());
   ```

   Run it with `node` and confirm only 2 are processed. Actual output from running this:

   ```text
   [handler] Event evt_101 (payment.succeeded) is new - PROCESSING (e.g. credit order, send email)
   [handler] Event evt_102 (refund.issued) is new - PROCESSING (e.g. credit order, send email)
   [handler] Event evt_101 (payment.succeeded) already processed - SKIPPING (no double-processing)
   Distinct events processed in demo 2: 2
   ```

3. **Paper exercise: spot the broken handler.** Below are three handler descriptions. For each, decide whether a redelivered webhook would cause double-processing, and why.
   - **Handler A:** Verifies the signature, checks the event ID against a persistent dedup table, records the ID, enqueues the work, returns 2xx.
   - **Handler B:** Verifies the signature, directly calls the "credit order" function and sends the confirmation email inline, then returns 2xx. No event-ID tracking anywhere.
   - **Handler C:** Verifies the signature, checks the event ID against an in-memory `Set` only (no database/cache), records the ID, does the work inline, returns 2xx.

   (Handler A is safe. Handler B double-processes on every redelivery, since nothing is deduplicated. Handler C is safe *until the process restarts* — after a restart the in-memory set is empty, so a redelivery that arrives post-restart is treated as new and double-processed.)
4. **Break it on purpose.** Modify the `handleWebhookEvent` function to add the event ID to `processedEventIds` only *after* a `console.log` that simulates "doing the work," then feed it the same event ID twice with a thrown error injected between the log and the `add` call on the first call (wrap the "work" line in a `try/catch` that rethrows). Observe that if the process were to crash at that exact point in real life, the event ID was never recorded — reproducing the "crash mid-work" bug described in Common Mistakes.
5. **Timeout scenario.** Write out (as pseudocode, not runnable code) a handler that calls a slow email-sending API synchronously before returning 2xx, and explain what you'd expect to observe if that email API takes longer than the provider's delivery timeout — specifically, what request your endpoint would receive next, and why.

## Interview Q&A

**Q: What does "at-least-once delivery" mean, and why do providers design webhooks this way?**
A: It means your endpoint is guaranteed to eventually receive every event, but may receive some of them more than once — providers prefer an occasional duplicate over silently dropping an event when your server has a bad moment (timeout, crash, deploy).

**Q: How do you make a webhook handler idempotent?**
A: Track the unique event ID of every event you've successfully processed (in a persistent store), and check incoming events against that store before doing any work — if the ID has been seen before, skip processing and just acknowledge the request.

**Q: Why shouldn't a webhook handler do slow work synchronously before responding?**
A: Because the provider is waiting for an acknowledgment within some time window; if slow work (API calls, heavy DB writes) delays the response past that window, the provider treats it as a failed delivery and retries — which just recreates the redelivery scenario the handler already has to handle, and can cause repeated retries under load.

**Q: Why dedup by event ID instead of by something like order ID?**
A: Because multiple distinct, legitimate events can share the same order ID (e.g. a payment-succeeded event followed later by a refund event for the same order) — deduplicating on order ID would incorrectly suppress the second, genuinely different event. The event ID uniquely identifies one specific occurrence.

**Q: If you dedup using an in-memory `Set`, what breaks in production?**
A: The set is wiped on every process restart or deploy, so any event redelivered after a restart looks "new" to the handler and gets processed again — production dedup needs a persistent store that survives restarts.
