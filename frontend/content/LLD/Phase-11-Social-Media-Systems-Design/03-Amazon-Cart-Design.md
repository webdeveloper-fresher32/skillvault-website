# Amazon Cart Design — Complete Guide

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Class Diagram](#7-class-diagram)
8. [Python Implementation](#8-python-implementation)
9. [Key Decisions](#9-key-decisions)
10. [Step 7: Extensibility](#10-step-7-extensibility)
11. [Interview Follow-ups](#11-interview-follow-ups)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements

- Users can add/remove products to/from a cart, and change quantities.
- The cart supports applying discounts and coupon codes (percentage off, flat amount off, buy-one-get-one).
- Checkout must verify inventory availability before confirming an order.
- Checkout creates an `Order` from the cart contents and processes payment.
- Multiple discounts may need to be evaluated, but the business wants to swap/add discount rules **without touching cart or checkout code**.

### Non-Functional Requirements (state these out loud)

- Inventory check and payment must happen atomically enough that we don't oversell a product that just went out of stock between "add to cart" and "checkout" — call out that true atomicity needs a DB transaction/lock, which is out of scope for the domain model but worth mentioning.
- Discount rules change frequently (marketing runs new promos) — this is the strongest signal in the prompt that discounts should be **pluggable**, not hard-coded.
- Out of scope: payment gateway integration details, tax calculation engines, fraud checks — call these out as separate subsystems.

### Assumptions to state

- A `Cart` belongs to exactly one `User` and holds `CartItem`s (product + quantity), not raw `Product` objects, since quantity must be tracked per line.
- Coupons and automatic discounts are modeled the same way (as `DiscountStrategy`) — a coupon is just a discount strategy gated behind a code.

---

## 2. Step 2: Identify Entities/Classes

| Class | Kind | Responsibility |
|---|---|---|
| `Product` | Core entity | SKU, name, price, category |
| `CartItem` | Core entity | Product + quantity — one line in the cart |
| `Cart` | Orchestrator | Holds `CartItem`s for a user; computes subtotal/total |
| `DiscountStrategy` | Interface (Strategy pattern) | Computes a discount amount given a cart |
| `PercentageDiscount`, `FlatDiscount`, `BuyOneGetOneDiscount` | Concrete strategies | Specific discount rules |
| `Coupon` | Value entity | Code + wraps a `DiscountStrategy` + validity window |
| `Inventory` | Orchestrator | Tracks stock per product; reserves/releases stock |
| `Order` | Core entity | Snapshot of cart items + final price at checkout time |
| `Payment` | Orchestrator | Charges the user for the order total |
| `User` | Core entity | Identity; owns one active `Cart` |

---

## 3. Step 3: Define Relationships

```
User          "owns"                Cart              1 -------- 1
Cart          "contains"            CartItem          1 -------- N   (composition)
CartItem      "references"          Product           N -------- 1   (association)
Cart          "applies"             DiscountStrategy  1 -------- N   (Strategy pattern, composition of behavior)
Coupon        "wraps"               DiscountStrategy  1 -------- 1
Inventory     "tracks stock for"    Product           1 -------- N
Order         "snapshots"           CartItem          1 -------- N   (copied at checkout, not shared)
Order         "paid via"            Payment           1 -------- 1
```

- `Order` **copies** `CartItem` data at checkout time rather than referencing the live `Cart` — prices/discounts must be frozen at the moment of purchase, immune to later price changes or the cart being cleared.
- `Cart` holds a **list of active `DiscountStrategy` objects** rather than a single hard-coded discount calculation — this is what makes discounts pluggable.

---

## 4. Step 4: Assign Responsibilities

- **`Product`** — pure data (price, name, SKU). No business logic.
- **`CartItem`** — quantity + product reference; computes its own line subtotal (`quantity * product.price`).
- **`Cart`** — owns the list of `CartItem`s and the list of applied `DiscountStrategy`/`Coupon`s; computes `subtotal()` and `total()` (subtotal minus discounts). Does **not** know how any individual discount is calculated — it just asks each strategy "how much do you take off?"
- **`DiscountStrategy` implementations** — each knows only its own discount math; no awareness of `Cart` internals beyond what's passed in.
- **`Inventory`** — the single source of truth for stock; owns `check_availability()` and `reserve()`/`release()`. `Cart` never mutates stock directly.
- **`Order`** — an immutable-after-creation snapshot; owns `order_id`, line items (copied), final total, and status (`PLACED`, `SHIPPED`, etc.).
- **`Payment`** — owns charging logic; decoupled from `Order` creation so payment failures don't leave a "half-created" order (checkout orchestrates: reserve inventory → charge payment → create order, rolling back on failure).

---

## 5. Step 5: Apply SOLID

| Principle | Application |
|---|---|
| **SRP** | `Cart` manages line items and totals; `Inventory` manages stock; `Payment` manages charging; `DiscountStrategy` implementations manage discount math. No single class does all four. |
| **OCP** | Marketing wants a new "spend $100 get 15% off" rule next quarter — add a new `DiscountStrategy` subclass. `Cart.total()` and `Checkout` code are untouched. |
| **LSP** | Any `DiscountStrategy` can be substituted into `Cart.apply_discount()` — all honor `calculate_discount(cart) -> Decimal` with the same contract (never negative, never exceeds subtotal). |
| **ISP** | `DiscountStrategy` exposes one method. `Inventory`'s interface (`check_availability`, `reserve`, `release`) is narrow and specific to stock — a discount class is never forced to depend on it. |
| **DIP** | `Cart` depends on the abstract `DiscountStrategy`, not on concrete `PercentageDiscount`/`FlatDiscount` classes. `Checkout` depends on abstract `Inventory` and `Payment` interfaces, so either can be swapped (e.g., a mock `Payment` for testing) without touching checkout logic. |

---

## 6. Step 6: Apply Design Patterns

### Strategy Pattern — Discount Rules

**Problem it solves:** the business needs to apply different, frequently-changing discount rules (percentage off, flat amount off, BOGO, coupon-gated versions of any of these) to a cart. Hard-coding `if discount_type == "percentage": ... elif discount_type == "flat": ...` inside `Cart` means every new promotion requires editing and re-testing `Cart` itself — high risk, since `Cart` is one of the most central, most-tested classes in the system.

**Solution:** define a `DiscountStrategy` interface with one method, `calculate_discount(cart) -> Decimal`. Each discount rule is its own class implementing that interface. `Cart` holds a list of active strategies and sums their results — it has zero knowledge of how any individual discount is computed. A `Coupon` is modeled as a named/validity-windowed wrapper around a `DiscountStrategy`, so coupon codes and automatic promotions share the exact same calculation machinery.

---

## 7. Class Diagram

```
┌────────────┐      N        1 ┌────────────┐
│  CartItem   │───references────▶│   Product   │
│─────────────│                  │─────────────│
│ -product     │                  │ -sku         │
│ -quantity     │                  │ -name        │
│ +subtotal()   │                  │ -price       │
└────────────┘                  └────────────┘
      ▲ N
      │ composition
      │ 1
┌──────────────────────────────────────┐
│                 Cart                  │
│──────────────────────────────────────│
│ -items: List[CartItem]                │
│ -discounts: List[DiscountStrategy]    │
│──────────────────────────────────────│
│ +add_item(product, qty)               │
│ +remove_item(product)                 │
│ +apply_discount(strategy)             │
│ +subtotal() -> Decimal                │
│ +total() -> Decimal                   │
└──────────────────┬─────────────────────┘
                    │ uses (Strategy)
                    ▼
        ┌────────────────────────────┐
        │  DiscountStrategy (ABC)     │
        │─────────────────────────── │
        │ +calculate_discount(cart)   │
        └─────────────▲────────────────┘
                       │ implements
        ┌──────────────┼───────────────────────┐
┌──────────────────┐ ┌────────────────┐ ┌────────────────────────┐
│PercentageDiscount │ │ FlatDiscount    │ │ BuyOneGetOneDiscount     │
└──────────────────┘ └────────────────┘ └────────────────────────┘

┌───────────────────┐        wraps       ┌───────────────────────┐
│      Coupon         │───────────────────▶│   DiscountStrategy      │
│───────────────────  │                    └───────────────────────┘
│ -code                │
│ -valid_from/-valid_to│
│ +is_valid()           │
└───────────────────────┘

┌───────────────────┐         ┌───────────────────────┐
│     Inventory        │        │         Order            │
│───────────────────  │        │───────────────────────  │
│ -stock: Dict[sku,int]│        │ -order_id                │
│───────────────────  │        │ -items: List[CartItem]  (copied, frozen)
│ +check_availability()│        │ -total: Decimal          │
│ +reserve()            │        │ -status                  │
│ +release()            │        │───────────────────────  │
└───────────────────────┘        │ +mark_paid()              │
                                  └───────────┬───────────────┘
                                              │ 1:1
                                              ▼
                                     ┌───────────────────┐
                                     │      Payment         │
                                     │───────────────────  │
                                     │ +charge(amount)       │
                                     └───────────────────────┘
```

---

## 8. Java Implementation

```java
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public record Product(String sku, String name, BigDecimal price, String category) {
    public Product(String sku, String name, BigDecimal price) {
        this(sku, name, price, "general");
    }
}

public class CartItem {
    private final Product product;
    private int quantity;

    public CartItem(Product product, int quantity) {
        this.product = product;
        this.quantity = quantity;
    }

    public Product getProduct() { return product; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public BigDecimal getSubtotal() {
        return product.price().multiply(BigDecimal.valueOf(quantity));
    }
}

// ---- Strategy pattern ----
public interface DiscountStrategy {
    BigDecimal calculateDiscount(Cart cart);
}

public class PercentageDiscount implements DiscountStrategy {
    private final BigDecimal percent; // e.g. new BigDecimal("10") for 10%

    public PercentageDiscount(BigDecimal percent) {
        this.percent = percent;
    }

    @Override
    public BigDecimal calculateDiscount(Cart cart) {
        return cart.subtotal()
            .multiply(percent)
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }
}

public class FlatDiscount implements DiscountStrategy {
    private final BigDecimal amount;

    public FlatDiscount(BigDecimal amount) {
        this.amount = amount;
    }

    @Override
    public BigDecimal calculateDiscount(Cart cart) {
        // never discount below zero
        return amount.min(cart.subtotal());
    }
}

public class BuyOneGetOneDiscount implements DiscountStrategy {
    private final String productSku;

    public BuyOneGetOneDiscount(String productSku) {
        this.productSku = productSku;
    }

    @Override
    public BigDecimal calculateDiscount(Cart cart) {
        for (CartItem item : cart.getItems()) {
            if (item.getProduct().sku().equals(productSku)) {
                int freeUnits = item.getQuantity() / 2;
                return item.getProduct().price().multiply(BigDecimal.valueOf(freeUnits));
            }
        }
        return BigDecimal.ZERO;
    }
}

/** A named, validity-windowed wrapper around a DiscountStrategy. */
public class Coupon {
    private final String code;
    private final DiscountStrategy strategy;

    public Coupon(String code, DiscountStrategy strategy) {
        this.code = code;
        this.strategy = strategy;
    }

    public String getCode() { return code; }
    public DiscountStrategy getStrategy() { return strategy; }

    public BigDecimal calculateDiscount(Cart cart) {
        return strategy.calculateDiscount(cart);
    }
}

public class Cart {
    private final String ownerId;
    private final List<CartItem> items = new CopyOnWriteArrayList<>();
    private final List<DiscountStrategy> discounts = new CopyOnWriteArrayList<>();

    public Cart(String ownerId) {
        this.ownerId = ownerId;
    }

    public synchronized void addItem(Product product, int quantity) {
        for (CartItem item : items) {
            if (item.getProduct().sku().equals(product.sku())) {
                item.setQuantity(item.getQuantity() + quantity);
                return;
            }
        }
        items.add(new CartItem(product, quantity));
    }

    public synchronized void removeItem(Product product) {
        items.removeIf(item -> item.getProduct().sku().equals(product.sku()));
    }

    public void applyDiscount(DiscountStrategy strategy) {
        discounts.add(strategy);
    }

    public void applyCoupon(Coupon coupon) {
        applyDiscount(coupon.getStrategy());
    }

    public BigDecimal subtotal() {
        return items.stream()
            .map(CartItem::getSubtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal total() {
        BigDecimal sub = subtotal();
        BigDecimal totalDiscount = discounts.stream()
            .map(d -> d.calculateDiscount(this))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sub.subtract(totalDiscount).max(BigDecimal.ZERO);
    }

    public String getOwnerId() { return ownerId; }
    public List<CartItem> getItems() { return Collections.unmodifiableList(items); }
}

public class Inventory {
    private final Map<String, Integer> stock = new ConcurrentHashMap<>();

    public void setStock(Product product, int quantity) {
        stock.put(product.sku(), quantity);
    }

    public boolean checkAvailability(Product product, int quantity) {
        return stock.getOrDefault(product.sku(), 0) >= quantity;
    }

    public synchronized void reserve(Product product, int quantity) {
        if (!checkAvailability(product, quantity)) {
            throw new IllegalStateException("Insufficient stock for " + product.name());
        }
        stock.put(product.sku(), stock.get(product.sku()) - quantity);
    }

    public synchronized void release(Product product, int quantity) {
        stock.put(product.sku(), stock.getOrDefault(product.sku(), 0) + quantity);
    }
}

public enum OrderStatus {
    PLACED,
    PAID,
    FAILED
}

/** Snapshot of cart items + total, frozen at checkout time. */
public class Order {
    private final String orderId;
    private final List<CartItem> items;
    private final BigDecimal total;
    private OrderStatus status;

    public Order(Cart cart) {
        this.orderId = UUID.randomUUID().toString();
        // copy, not reference — later cart mutations must not affect this order
        List<CartItem> snapshot = new ArrayList<>();
        for (CartItem item : cart.getItems()) {
            snapshot.add(new CartItem(item.getProduct(), item.getQuantity()));
        }
        this.items = Collections.unmodifiableList(snapshot);
        this.total = cart.total();
        this.status = OrderStatus.PLACED;
    }

    public void markPaid() {
        this.status = OrderStatus.PAID;
    }

    public void markFailed() {
        this.status = OrderStatus.FAILED;
    }

    public String getOrderId() { return orderId; }
    public List<CartItem> getItems() { return items; }
    public BigDecimal getTotal() { return total; }
    public OrderStatus getStatus() { return status; }
}

public class Payment {
    public boolean charge(BigDecimal amount) {
        // placeholder for real gateway integration (Stripe, Razorpay, etc.)
        System.out.println("Charging $" + amount);
        return true;
    }
}

/**
 * Orchestrates: reserve inventory -> charge payment -> create order,
 * rolling back inventory reservation if payment fails.
 */
public class Checkout {
    private final Inventory inventory;
    private final Payment payment;

    public Checkout(Inventory inventory, Payment payment) {
        this.inventory = inventory;
        this.payment = payment;
    }

    public synchronized Order checkout(Cart cart) {
        for (CartItem item : cart.getItems()) {
            if (!inventory.checkAvailability(item.getProduct(), item.getQuantity())) {
                throw new IllegalStateException(item.getProduct().name() + " is out of stock");
            }
        }

        for (CartItem item : cart.getItems()) {
            inventory.reserve(item.getProduct(), item.getQuantity());
        }

        Order order = new Order(cart);
        if (payment.charge(order.getTotal())) {
            order.markPaid();
        } else {
            // roll back reservation on payment failure
            for (CartItem item : cart.getItems()) {
                inventory.release(item.getProduct(), item.getQuantity());
            }
            order.markFailed();
        }

        return order;
    }
}
```

---

## 9. Key Decisions

**Strategy pattern for discounts, not a discount `type` enum with branching math.** The requirements explicitly call out that discount rules change often (new promos, coupon codes). An enum + `if/elif` inside `Cart.total()` would mean every new promotion type requires editing and re-testing the cart's core pricing logic — the highest-risk class to touch. Modeling each rule as a `DiscountStrategy` means `Cart` just sums whatever strategies are attached, and a new promotion is a brand-new class with zero blast radius on existing pricing.

**`Coupon` wraps a `DiscountStrategy` rather than being its own discount hierarchy.** A coupon is really just "a discount, gated by a code and a validity window." Rather than duplicating percentage/flat/BOGO math inside `Coupon` subclasses, `Coupon` composes an existing `DiscountStrategy` — this avoids parallel class hierarchies for "automatic discounts" vs. "coupon discounts" that do the same math twice.

**`Order` copies `CartItem`s instead of referencing the live `Cart`.** If `Order` held a reference to the cart, clearing the cart after checkout (a normal UX flow) would silently empty a placed order's line items, and a price change to a `Product` after purchase would retroactively alter historical order totals. Snapshotting at checkout time is the only way to guarantee a placed order stays accurate forever.

**Checkout is a distinct orchestrator, not a method on `Cart`.** Checkout involves cross-cutting coordination — inventory reservation, payment charging, rollback on failure — that doesn't belong to a single entity. Keeping it as its own `Checkout` class (depending on `Inventory` and `Payment` abstractions) keeps `Cart` focused purely on line-item and pricing concerns (SRP), and makes the multi-step transaction easy to reason about and test in isolation.

---

## 10. Step 7: Extensibility

- **Stacking rules (e.g., only one coupon allowed, but unlimited automatic discounts):** add a `max_stack` policy check inside `Cart.apply_coupon()` — `DiscountStrategy` implementations themselves need no changes.
- **Tiered/loyalty discounts (bigger discount for loyal customers):** add a `LoyaltyDiscount(DiscountStrategy)` that takes a `User` and looks up their tier — fits directly into the existing `_discounts` list with no changes to `Cart.total()`.
- **Tax calculation:** introduce a `TaxStrategy` interface mirroring `DiscountStrategy` (Strategy pattern reused for a different variability), applied after discounts in `Cart.total()` or in `Checkout`.
- **Multiple payment methods (credit card, wallet, gift card):** make `Payment` an abstract interface with `CreditCardPayment`, `WalletPayment` implementations; `Checkout` depends only on the abstract `Payment.charge()` — swapping payment methods requires no change to checkout orchestration.

---

## 11. Interview Follow-ups

- "How do you prevent overselling when two users check out the last unit of a product simultaneously?" — Discuss that `Inventory.reserve()` needs to be atomic (a DB-level `UPDATE ... WHERE stock >= qty` or a distributed lock) since the in-memory version here is not thread-safe.
- "What happens if payment succeeds but creating the order record fails (e.g., DB crash)?" — Discuss idempotency keys on the payment charge and a reconciliation/retry job — a real system needs the ability to detect "charged but no order" states.
- "How would you support saving a cart across sessions/devices?" — Persist `Cart` keyed by `user_id` in a database rather than in-memory; note the domain model doesn't change, only where `Cart` state lives.
- "How do you handle a coupon that's valid only for first-time customers?" — Add an eligibility check (a small `is_eligible(user)` method) on `Coupon`, separate from the discount *amount* calculation — keeps eligibility rules from polluting `DiscountStrategy` math.

---

## 12. Interview Q&A

**Q: Why use the Strategy pattern for discounts instead of a `discount_type` field with a switch statement?**
Answer: Discount rules change frequently in a real e-commerce system (new promotions, seasonal coupons), and a switch statement inside `Cart` would force every new rule to modify and re-test the cart's core pricing logic — the highest-traffic, highest-risk code path. The Strategy pattern isolates each rule's math into its own class implementing `calculate_discount(cart)`; `Cart` just sums whatever strategies are attached, so adding a promotion is a new class with no changes to existing, tested code — this is the Open/Closed Principle in action.

**Q: Why does `Coupon` wrap a `DiscountStrategy` instead of having its own separate discount-calculation hierarchy?**
Answer: A coupon is conceptually "a discount rule plus a code and validity window" — not a fundamentally different kind of discount math. Composing an existing `DiscountStrategy` inside `Coupon` avoids duplicating percentage/flat/BOGO calculation logic in two parallel hierarchies, and it means any future discount type automatically works both as an automatic promotion and as a coupon-gated one.

**Q: Why does `Order` copy the cart's line items instead of holding a reference to the `Cart`?**
Answer: A placed order must remain accurate forever, independent of what happens to the cart or product prices afterward. If `Order` referenced the live `Cart`, clearing the cart post-checkout (normal UX) would empty the order's items, and future price changes on a `Product` would retroactively change historical order totals. Snapshotting `CartItem`s at checkout time freezes the order's contents and total permanently.

**Q: Why is `Checkout` a separate class instead of a `checkout()` method on `Cart`?**
Answer: Checkout requires coordinating multiple subsystems — verifying and reserving inventory, charging payment, creating the order, and rolling back on failure. Bundling that orchestration into `Cart` would violate SRP by mixing "manage my line items and pricing" with "coordinate a multi-step transaction across services." A separate `Checkout` class depending on abstract `Inventory` and `Payment` interfaces keeps `Cart` focused and makes the transaction logic independently testable (e.g., with a mock `Payment`).

**Q: How would you add "buy 3, get the cheapest one free" without breaking existing discount code?**
Answer: Add a new `DiscountStrategy` subclass (e.g., `BuyThreeCheapestFreeDiscount`) implementing `calculate_discount(cart)` with its own logic for finding the cheapest item among qualifying quantities. Because `Cart` only depends on the abstract `DiscountStrategy` interface and iterates over a list of them, this new rule plugs in via `cart.apply_discount(...)` with zero changes to `Cart`, `Order`, or `Checkout`.

**Q: What's the risk if `Inventory.reserve()` and `Payment.charge()` aren't coordinated carefully in `Checkout`?**
Answer: If inventory is reserved but payment fails and isn't rolled back, stock is permanently and incorrectly locked away ("phantom" reservations) even though no sale occurred. If payment is charged before checking inventory, a customer could be charged for an out-of-stock item. The design here checks availability first, reserves inventory, then charges — and explicitly releases the reservation if the charge fails — to avoid both failure modes.
