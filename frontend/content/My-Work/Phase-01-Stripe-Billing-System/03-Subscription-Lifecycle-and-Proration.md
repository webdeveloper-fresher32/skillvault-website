# Subscription State Machine, Upgrades, Downgrades & Proration

> **Module**: Phase 01 — Stripe Billing System | **Lesson**: 03  
> **Tech Stack**: Stripe Billing API, Proration Math, Customer Portal, Webhook Handlers

---

## 1. The Subscription Lifecycle State Machine

A production SaaS subscription is not a binary `active` or `inactive` flag. Stripe defines a 7-stage state machine that your application must mirror:

![SaaS Subscription Lifecycle State Machine](/images/my-work/02-subscription-state-machine.png)

### Critical State Definitions:
1. **`incomplete`**: The initial invoice failed to pay (e.g. 3D Secure verification required). If not resolved within 23 hours, it transitions to `incomplete_expired`.
2. **`trialing`**: User has full access to the tier without being billed until `trial_end`.
3. **`active`**: Paid and in good standing.
4. **`past_due`**: Renewal payment failed. The user is in a **grace period** (typically 7–14 days) while Stripe's Smart Retries engine executes machine-learning powered retry attempts.
5. **`unpaid`**: All retries exhausted. Features should be locked, but data preserved.
6. **`canceled`**: Subscription terminated.

---

## 2. Proration Mathematics & Mid-Cycle Tier Transitions

When a customer changes plans midway through a billing cycle (e.g., upgrading from \$19/mo Basic to \$49/mo Pro on Day 15 of a 30-day month), billing them full price is unfair, and letting them upgrade for free creates an exploit.

### The Mathematical Formula:
$$\text{Proration Credit} = \text{Current Plan Price} \times \frac{\text{Remaining Seconds in Cycle}}{\text{Total Seconds in Cycle}}$$

$$\text{Proration Debit} = \text{New Plan Price} \times \frac{\text{Remaining Seconds in Cycle}}{\text{Total Seconds in Cycle}}$$

$$\text{Net Amount Due Immediately} = \text{Proration Debit} - \text{Proration Credit}$$

### Concrete Example:
- **Billing Period**: March 1 to March 31 (30 days total).
- **Current Plan**: Basic (\$19/mo).
- **Upgrade Date**: March 16 (15 days remaining: exactly 50% of the period).
- **New Plan**: Pro (\$49/mo).
- **Calculation**:
  $$\text{Unused Basic Time Credit} = \$19.00 \times 0.50 = \$9.50$$
  $$\text{New Pro Time Charge} = \$49.00 \times 0.50 = \$24.50$$
  $$\text{Net Upgrade Charge} = \$24.50 - \$9.50 = \$15.00$$

### Stripe API Implementation with Proration Control

```typescript
// src/services/subscriptionService.ts
export async function updateSubscriptionPlan(
  stripeSubscriptionId: string,
  newPriceId: string,
  immediateProration: boolean = true
) {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Update subscription items with proration behavior
  const updatedSubscription = await stripe.subscriptions.update(
    stripeSubscriptionId,
    {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: immediateProration ? 'create_prorations' : 'none',
      payment_behavior: 'pending_if_incomplete', // Handles 3DS challenge if extra payment needed
    }
  );

  return updatedSubscription;
}
```

---

## 3. Stripe Customer Portal Integration

Rather than building complex custom UIs for credit card updates, billing address changes, and invoice PDF downloads, enterprise SaaS apps integrate the **Stripe Customer Portal**:

```typescript
// src/controllers/billingController.ts
export async function createPortalSession(req: Request, res: Response) {
  const userId = req.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.stripeCustomerId) {
    return res.status(400).json({ error: 'No active billing customer found' });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.APP_URL}/settings/billing`,
  });

  return res.json({ url: portalSession.url });
}
```

This offloads PCI compliance, 3D Secure workflows, PDF invoice receipts, and self-serve subscription cancellation directly to Stripe's secure infrastructure.
