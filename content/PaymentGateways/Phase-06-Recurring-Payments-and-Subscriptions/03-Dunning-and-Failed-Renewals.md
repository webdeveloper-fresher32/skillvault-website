# Dunning and Failed Renewals

A renewal charge failing isn't necessarily the end of a subscription — cards expire, banks decline transient-looking charges, insufficient funds resolve themselves a few days later. Dunning is the practice of retrying a failed recurring charge on a backoff schedule before giving up, and it's a job split between the provider's built-in retry logic and your own application logic — relying on only one side leaves gaps.

## 1. Why Renewals Fail

Unlike a one-off checkout failure, nobody is present when a renewal charge runs — it fires automatically on the provider's billing schedule, with no customer watching a screen to fix a typo or try a different card. Common causes include an expired card on file, a temporarily insufficient balance, a bank's fraud system flagging an unattended recurring charge, or the card having been reissued (new number) after a reported loss or a standard reissue cycle. Some of these are transient and resolve on their own within days; others require the customer to actively update their payment method. A dunning strategy exists precisely because you can't tell which kind of failure you're looking at from the decline alone, so the sane default is: retry a few times on a schedule, and only treat it as final once retries are exhausted.

```text
Renewal charge attempted automatically (no customer present)
        |
        v
Charge fails (expired card / insufficient funds / issuer decline / etc.)
        |
        v
Is this transient (may resolve itself) or permanent (needs customer action)?
        |
        +--> Unknown at this point --> retry on a backoff schedule instead of guessing
```

## 2. Provider Built-In Retry Logic (Conceptual, Heavily Hedged)

Stripe, Razorpay, and PayPal all offer some form of built-in retry behavior for failed recurring charges, and all three let you configure aspects of it (how many attempts, roughly how they're spaced, and what happens when retries are exhausted) through account or subscription-level settings. Do not treat any specific number of retries or number of days between them as a fixed, permanent fact for any of these providers in this lesson — retry schedules are configurable, differ by plan/account settings, and are exactly the kind of detail providers adjust over time. If you need the current specifics for an integration, check that provider's current billing/subscription docs at implementation time rather than relying on anything memorized from a course or blog post.

What's safe to assert conceptually, without pinning down numbers:

- All three providers will make more than one attempt at a failed renewal charge before giving up, rather than failing permanently on the very first decline.
- All three eventually emit a webhook event signaling "retries exhausted, this subscription is now considered failed/past the retry window" — this is the terminal signal your app must react to (see section 3).
- All three let the retry behavior be configured to some degree (e.g. how aggressive the schedule is, or what status the subscription lands in once retries stop) — the specific configuration surface and its current defaults should be verified against each provider's current docs, not assumed.

## 3. App-Level Dunning Emails and Grace Periods

Relying solely on the provider's built-in retries is not enough, for two reasons: first, the provider's retries are silent from the customer's point of view unless you also notify them — a card silently getting retried for a week with no email telling the customer why is a poor experience and doesn't give them a chance to fix it proactively. Second, your app needs its own definition of "terminal" that's independent of the provider's retry mechanics — when the provider's "retries exhausted" webhook fires, your app has to actually do something (revoke access, or better, start a grace period) rather than just logging the event.

A reasonable app-level dunning flow layered on top of the provider's retries:

```text
Renewal fails (first attempt)
        |
        v
Send customer an email: "Your payment failed, please update your card"
        |
        v
Provider retries on its own schedule (Section 2) — app can also send reminder emails
        |
        v
Provider's "retries exhausted" webhook fires
        |
        v
Start an app-level grace period (e.g. a few extra days with access still on,
clearly communicated as a final warning) instead of hard-canceling immediately
        |
        v
Grace period ends with no successful payment --> now hard-cancel / revoke access
```

The example function below models a simple exponential-ish backoff schedule an application might configure for its *own* reminder emails (or as a mental model for reasoning about a provider's retry cadence) — the specific offsets (1, 3, and 7 days) are illustrative numbers for this exercise, not any provider's actual current default schedule.

```js
function computeRetrySchedule(failureDate, offsetDaysList) {
  const failure = new Date(failureDate);
  if (Number.isNaN(failure.getTime())) {
    throw new Error(`Invalid failureDate: ${failureDate}`);
  }

  return offsetDaysList.map((offsetDays) => {
    const retryDate = new Date(failure);
    retryDate.setUTCDate(retryDate.getUTCDate() + offsetDays);
    return {
      offsetDays,
      retryDate: retryDate.toISOString().slice(0, 10),
    };
  });
}

// Example schedule an app MIGHT configure: retry at 1, 3, and 7 days after failure.
// This is an illustrative example, not any specific provider's actual default schedule.
const EXAMPLE_RETRY_OFFSETS = [1, 3, 7];

const failureDate = "2026-08-01";
const schedule = computeRetrySchedule(failureDate, EXAMPLE_RETRY_OFFSETS);

console.log(`Failure date: ${failureDate}`);
console.log("Computed retry schedule:");
console.log(schedule);

console.log("\nIf all retries fail, subscription moves to terminal handling after:", schedule[schedule.length - 1].retryDate);
```

Actual output from running this with `node`:

```text
Failure date: 2026-08-01
Computed retry schedule:
[
  { offsetDays: 1, retryDate: '2026-08-02' },
  { offsetDays: 3, retryDate: '2026-08-04' },
  { offsetDays: 7, retryDate: '2026-08-08' }
]

If all retries fail, subscription moves to terminal handling after: 2026-08-08
```

Checking this by hand against a calendar: a failure on August 1st plus 1 day is August 2nd, plus 3 days is August 4th, plus 7 days is August 8th — all three computed dates match simple calendar addition, and the "terminal handling" line correctly points at the last (7-day) entry in the schedule array.

## Comparison

| Aspect | Stripe | Razorpay | PayPal |
|---|---|---|---|
| Built-in retry mechanism for failed renewals | Typically present and configurable at the account/product level — verify current specifics in Stripe's docs | Typically present for subscriptions, configurable — verify current specifics in Razorpay's docs | Typically present for subscriptions, configurable — verify current specifics in PayPal's docs |
| Exact number of retry attempts / spacing | Not asserted here — configurable and can change; check current docs | Not asserted here — configurable and can change; check current docs | Not asserted here — configurable and can change; check current docs |
| Terminal "retries exhausted" signal | Emitted as a webhook event your app must handle | Emitted as a webhook event your app must handle | Emitted as a webhook event your app must handle |
| App-level responsibility regardless of provider | Send customer notifications during the retry window; handle the terminal event; run an app-level grace period before hard-canceling | Same | Same |

## Common Mistakes

- Relying entirely on the provider's built-in retries and never handling the "retries exhausted" webhook at all — this leaves a subscription silently sitting in a failed/past-due-forever state on the provider's side while your app still believes the customer has access, because nothing ever told your app to actually revoke it.
- Hard-canceling access the instant the first renewal charge fails, instead of waiting through the retry window (and an app-level grace period) — this punishes customers whose card will resolve on its own within days, or who just need a day or two to update an expired card, and directly contradicts Lesson 1's point that `past_due` is not the same as `canceled`.
- Not sending the customer any notification during the retry window — silent retries followed by an abrupt cancellation gives the customer no chance to fix the problem before losing access, even though the whole point of a retry window is to give them that chance.
- Assuming a specific retry schedule (a specific number of attempts, spaced a specific number of days apart) is a fixed fact about a given provider and hardcoding logic against it — these schedules are configurable and can change, and code that assumes a specific cadence can silently become wrong when account settings or provider defaults change.
- Treating the grace period as optional or skipping straight to hard cancellation the moment retries end — a short, clearly communicated grace period (with continued reminder emails) meaningfully reduces avoidable churn compared to canceling the instant the provider gives up.

## Hands-On Exercises

1. **Run the retry-schedule function as shown.** Save `computeRetrySchedule` and the demo code from section 3 into one file and run it with `node`. Confirm your output matches what's shown above.
2. **Verify the computed dates by hand.** Without running code, work out what date is 1, 3, and 7 days after `2026-08-01`, then compare your hand-computed dates against the function's actual output. Confirm they match.
3. **Try a schedule that crosses a month boundary.** Call `computeRetrySchedule("2026-08-28", [1, 3, 7])` and run it with `node`. By hand, confirm that the 7-day offset correctly rolls over into September (`2026-08-28` + 7 days = `2026-09-04`), and check the function's actual output agrees with your hand calculation.
4. **Wire the schedule into Lesson 1's state machine.** Using Lesson 1's `transition` function and `TRANSITIONS` map, model a subscription that goes `active` → (`renewal_payment_failed`) → `past_due`, then compute a 3-entry retry schedule for the failure date, then apply `retry_payment_succeeded` to bring it back to `active`. Confirm the subscription's `history` array reflects all these steps in order (this exercise deliberately combines Lesson 1's code with this lesson's — trace through both files together).
5. **Design a grace period on paper.** Using the flow diagram in section 3, write out (as pseudocode, not runnable code) what your app should do differently for a subscription in its grace period versus a subscription that has already been hard-canceled — specifically, what should the customer be able to see/do in each state, and what event transitions a grace-period subscription into hard-canceled.

## Interview Q&A

**Q: What is dunning, in the context of recurring payments?**
A: The process of retrying a failed recurring charge on a backoff schedule — instead of canceling on the first failure — before eventually giving up and canceling if none of the retries succeed.

**Q: Why shouldn't an app rely solely on the provider's built-in retry logic?**
A: Because the provider's retries are silent to the customer unless the app also sends notifications, and because the app needs to react to the "retries exhausted" terminal event itself (to revoke access or start a grace period) — a provider retrying quietly in the background with no app-level handling of the terminal event leaves the app's own state out of sync with reality.

**Q: Why shouldn't you assert a specific number of retry attempts or a specific number of days between them as a fixed fact about any given provider?**
A: Because these schedules are configurable (per account or per plan) and providers can change their defaults over time — treating a specific cadence as permanent risks writing logic that's simply wrong whenever the actual configuration differs from what was assumed.

**Q: What's the practical benefit of an app-level grace period after the provider's retries are exhausted, instead of canceling immediately?**
A: It gives the customer a final, clearly communicated window to update their payment method before losing access, which reduces avoidable churn compared to an abrupt hard-cancellation the instant the provider's retries end.

**Q: How does this lesson's dunning flow relate to Lesson 1's `past_due` state?**
A: `past_due` is the state a subscription enters the moment a renewal fails, and it stays in that state throughout the provider's retry window; this lesson's dunning flow is what happens *during* that `past_due` period (app-level notifications, tracking the retry schedule) and what happens right after it (starting a grace period before the eventual terminal cancellation), rather than a separate mechanism.
