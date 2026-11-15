# Stripe Billing & Payments: Senior Interview Battle Cards

> **Module**: Phase 03 — Interview Battle Cards | **Lesson**: 01  
> **Target Roles**: Senior / Staff Backend Engineer, FinTech Engineer, Tech Lead

---

## Battle Card 1: Preventing Dual Payments (Network Storms & Concurrency)

### Interviewer Prompt:
> *"How do you guarantee that a user is never double-charged if their browser disconnects during payment processing or they rapidly click 'Pay Now' five times?"*

### Senior Answer:
"We implement a **4-tier defense model**:
1. **Client-Generated Idempotency Keys**: The frontend generates a unique UUID `Idempotency-Key` at checkout initiation. If the client experiences a network timeout and retries, the backend reuses that key with Stripe (`stripe.checkout.sessions.create(..., { idempotencyKey })`). Stripe guarantees cached response replay for 24 hours without initiating a second financial charge.
2. **Redis Distributed Mutex (`SET NX EX`)**: At the gateway level, we acquire a short-lived distributed lock `lock:checkout:user:<id>` with a 15-second TTL. Rapid duplicate button clicks hit a 409 Conflict immediately.
3. **Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)**: When mutating account credits or recording invoices, we wrap the mutation in a PostgreSQL transaction with row-level locks, serializing balance updates.
4. **Database-Level Unique Constraints**: Every Stripe transaction ID and webhook event ID is recorded in our database with a strict `UNIQUE` constraint, turning any race condition into an atomic database rollback."

---

## Battle Card 2: The Distributed 2PC Dilemma & Webhook Reliability

### Interviewer Prompt:
> *"Why can't you just activate a customer's subscription synchronously when the user returns to the `/success` redirect URL?"*

### Senior Answer:
"Because the redirect URL is purely client-side and fundamentally untrusted.
1. The user's browser could crash, experience a battery outage, or close the tab before the redirect completes. If we rely on the redirect, the customer is billed by Stripe but never granted their SaaS features.
2. A malicious actor could manually navigate to `/billing/success?session_id=fake_id` to trick the server into provisioning free access.
3. Stripe and our database form a **Distributed Two-Phase Commit (2PC) problem**. Stripe's ledger is the single source of financial truth. Therefore, account provisioning **must be event-driven via cryptographically signed webhooks** (`checkout.session.completed`). The return URL is only used for UI polling or optimistic loading; authoritative provisioning occurs via BullMQ processing of verified webhooks."

---

## Battle Card 3: Out-of-Order Webhook Race Conditions

### Interviewer Prompt:
> *"What happens if a customer upgrades from Basic to Pro, and 10 seconds later upgrades from Pro to Enterprise, but the webhooks arrive in reverse order?"*

### Senior Answer:
"If processed naively, the older 'Pro' webhook would overwrite the 'Enterprise' state, corrupting the customer's entitlements.
We solve this using **Monotonic Event Timestamp Verification**:
- Stripe events contain a monotonically increasing unix timestamp `created`.
- In our `subscriptions` table, we track `last_event_created_at`.
- Inside our webhook worker's PostgreSQL transaction (`SELECT FOR UPDATE`), we compare `event.created` against `subscription.last_event_created_at`.
- If the incoming event is older than the latest processed event, we discard it as stale and log an idempotent audit entry."

---

## Battle Card 4: Mid-Cycle Subscription Proration

### Interviewer Prompt:
> *"How do you calculate proration when a customer upgrades midway through a billing cycle?"*

### Senior Answer:
"We calculate the exact unused time on the existing tier and deduct it from the cost of the new tier:
$$\text{Credit} = \text{Old Plan Price} \times \left(\frac{\text{Remaining Seconds}}{\text{Total Cycle Seconds}}\right)$$
$$\text{Charge} = \text{New Plan Price} \times \left(\frac{\text{Remaining Seconds}}{\text{Total Cycle Seconds}}\right)$$
$$\text{Net Immediate Charge} = \text{Charge} - \text{Credit}$$

In code, we pass `proration_behavior: 'create_prorations'` to `stripe.subscriptions.update()`. Stripe automatically creates unbilled invoice items, applies any account balance, and generates an immediate invoice for the net difference."

---

## Battle Card 5: Smart Retries, Dunning & Payment Failure Grace Periods

### Interviewer Prompt:
> *"If an automatic recurring subscription payment fails at 2:00 AM, do you immediately revoke the customer's account access?"*

### Senior Answer:
"Never immediately revoke access upon initial failure. That causes severe involuntary churn.
1. When `invoice.payment_failed` arrives, the subscription enters the `past_due` state.
2. We grant a **7–14 day grace period**: core features remain accessible, but a persistent non-intrusive warning banner appears in the dashboard.
3. We leverage **Stripe Smart Retries**, which uses machine learning to retry card charges at optimal times (e.g., when funds are most likely available based on global banking behaviors).
4. If all retry attempts are exhausted, Stripe emits `customer.subscription.deleted` or marks the subscription `unpaid`. Only at this point do we lock paid features, while preserving user project data so they can easily reactivate."
