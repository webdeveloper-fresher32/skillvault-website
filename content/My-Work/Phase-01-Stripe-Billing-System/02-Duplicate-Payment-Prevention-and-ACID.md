# Duplicate Payment Prevention, Idempotency & ACID Locking

> **Module**: Phase 01 — Stripe Billing System | **Lesson**: 02  
> **Tech Stack**: PostgreSQL (Prisma), Redis (Redlock/SET NX), Stripe Idempotency Keys, Node.js

---

## 1. The 4 Duplicate Payment Failure Vectors

Duplicate payments destroy user trust and generate massive chargeback fees (\$15–\$25 per dispute). In distributed SaaS payment architectures, duplicates occur through 4 distinct failure vectors:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Vector 1: Client Rapid Double-Click Race Condition                     │
│   User double-clicks "Subscribe", sending 2 identical HTTP POSTs       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Vector 2: Network Timeout & Retry Storms                               │
│   Payment succeeded at Stripe, but client experienced TCP timeout      │
│   Client retries payment without idempotency, causing double charge    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Vector 3: Concurrent Webhook Redelivery                                │
│   Stripe sends identical webhook across multiple regional endpoints    │
│   Simultaneous worker threads try to grant credits twice               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Vector 4: Database Race Conditions (Missing Pessimistic Locks)         │
│   Two concurrent requests read balance = $10, both approve purchase    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 4-Tier Production Defense Model

### Tier 1: Client-Generated Idempotency Keys (`uuidv4`)
When initiating a charge or checkout session, the client generates a unique UUID `Idempotency-Key` and attaches it to the request header. If the network drops and the client retries, the backend reuses this key when invoking the Stripe API:

```typescript
// src/services/billingService.ts
export async function createSubscriptionCheckout(
  userId: string,
  priceId: string,
  clientRequestId: string
) {
  // Pass the clientRequestId as the Stripe Idempotency Key
  const session = await stripe.checkout.sessions.create(
    {
      customer: user.stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/billing/canceled`,
    },
    {
      idempotencyKey: `checkout_${userId}_${clientRequestId}`, // Stripe caches this for 24h
    }
  );
  return session;
}
```

### Tier 2: Redis Distributed Mutex (`SET key NX EX`)
To prevent two identical requests from processing concurrently across load-balanced Node.js instances:

```typescript
// Acquire distributed lock with a 15-second TTL
const lockKey = `lock:payment:user:${userId}`;
const acquired = await redis.set(lockKey, 'locked', 'EX', 15, 'NX');

if (!acquired) {
  throw new AppError(
    'A payment transaction is already in progress for this account. Please wait.',
    409
  );
}

try {
  // Execute payment workflow
} finally {
  await redis.del(lockKey);
}
```

### Tier 3: PostgreSQL Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)
Inside database transactions where subscription state or account credits are modified, optimistic locking is vulnerable to concurrent overwrite. We acquire a row-level lock:

```typescript
await prisma.$transaction(async (tx) => {
  // Lock the user record against concurrent balance/subscription modifications
  const [lockedUser] = await tx.$queryRaw<Array<{ id: string; credits: number }>>`
    SELECT id, credits 
    FROM users 
    WHERE id = ${userId}::uuid 
    FOR UPDATE
  `;

  if (lockedUser.credits < requiredCredits) {
    throw new AppError('Insufficient credits', 400);
  }

  // Deduct credits and insert transaction
  await tx.user.update({
    where: { id: userId },
    data: { credits: { decrement: requiredCredits } }
  });
});
```

### Tier 4: Database Unique Constraints
Every webhook event processed is recorded in an `audit_events` table with a database-level unique constraint on `stripe_event_id`:

```sql
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

If Stripe delivers the same webhook concurrently to two worker pods, pod A inserts the row and succeeds; pod B immediately aborts on the PostgreSQL unique violation error:
$$\text{duplicate key value violates unique constraint "uq_stripe_event_id"}$$
This guarantees mathematical execution idempotency at the database engine level.
