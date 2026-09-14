# Food Delivery System — Design Walkthrough

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities](#2-step-2-identify-entities)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Diagram](#8-class-diagram)
9. [Key Decisions](#9-key-decisions)
10. [Interview Follow-ups](#10-interview-follow-ups)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements (in scope)
- Customers can browse nearby restaurants and view a restaurant's menu.
- Customers can place an order containing one or more menu items from a **single**
  restaurant.
- The system assigns an available delivery partner to an accepted order.
- Customers (and the delivery partner) can track order status in real time.
- Customers pay for an order (single payment method per order, for this design).

### Out of Scope (state this explicitly in an interview)
- Multi-restaurant cart / split orders.
- Route optimization / GPS turn-by-turn navigation.
- Surge pricing, promotions, coupons.
- Restaurant onboarding / menu-management admin tools.

### Non-Functional Requirements
- Order status changes must be pushed to interested parties (customer app, delivery
  partner app) without polling — favors a **push/notify** design over pull.
- Delivery partner assignment must be swappable (nearest-first today, load-balanced or
  rating-based tomorrow) — favors a **pluggable strategy**.
- Reads (browsing restaurants/menus) vastly outnumber writes (placing orders) — not a
  hard requirement for the class design, but worth mentioning to show scale awareness.

---

## 2. Step 2: Identify Entities

Pulling the nouns out of the requirements:

| Entity | Represents |
|--------|-----------|
| `Restaurant` | A restaurant with a location and a menu |
| `Menu` | The collection of items a restaurant sells |
| `MenuItem` | A single dish — name, price, availability |
| `Customer` | The user placing the order |
| `Order` | A customer's order — items, status, restaurant, delivery partner |
| `OrderItem` | A menu item + quantity within an order |
| `DeliveryPartner` | A courier who can be assigned to deliver orders |
| `Payment` | A payment attempt/record tied to an order |
| `OrderStatus` | Enum: `PLACED`, `ACCEPTED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED` |

---

## 3. Step 3: Define Relationships

```
Restaurant "1" ────── "1" Menu               (composition — a Menu can't exist without its Restaurant)
Menu       "1" ────── "*" MenuItem           (composition)
Customer   "1" ────── "*" Order              (association)
Order      "1" ────── "*" OrderItem          (composition)
OrderItem  "*" ────── "1" MenuItem           (association — references, doesn't own)
Order      "1" ────── "1" Restaurant         (association)
Order      "0..1"───── "1" DeliveryPartner   (association — assigned after placement)
Order      "1" ────── "1" Payment            (composition)
Order      "1" ────── "*" OrderObserver      (observer — anyone watching status changes)
```

- **Composition** (`Menu` owns `MenuItem`s, `Order` owns `OrderItem`s): if the parent is
  deleted, the children have no independent existence.
- **Association** (`Order` references a `DeliveryPartner`): both can exist independently;
  an unassigned order is valid, and a delivery partner outlives any single order.

---

## 4. Step 4: Assign Responsibilities

| Class | Responsibilities |
|-------|-------------------|
| `Restaurant` | Own its `Menu`; report open/closed status |
| `Menu` | Add/remove `MenuItem`s; look up an item by ID |
| `MenuItem` | Hold name, price, availability flag |
| `Customer` | Place an `Order`; hold delivery address |
| `Order` | Own its `OrderItem`s and lifecycle (`OrderStatus`); notify observers on status change; compute total price |
| `DeliveryPartner` | Track own availability; accept/reject an assignment |
| `DeliveryAssignmentStrategy` | Decide *which* `DeliveryPartner` gets an `Order` (kept OUT of `Order` — see SOLID) |
| `Payment` | Record amount, method, and payment status for an `Order` |
| `PaymentGateway` (interface) | Abstract the actual charge call to an external processor |

Notice `Order` does **not** decide who delivers it, and does **not** know how payment is
actually processed — those are delegated, which is the seed for two design-pattern
decisions below.

---

## 5. Step 5: Apply SOLID

| Principle | Applied how |
|-----------|-------------|
| **SRP** | `Order` manages its own item list & status; it does NOT choose a delivery partner or talk to a payment processor — those live in `DeliveryAssignmentStrategy` and `PaymentGateway` |
| **OCP** | New delivery-assignment algorithms (nearest, rating-based, load-balanced) are added as new `DeliveryAssignmentStrategy` subclasses — `Order` code never changes |
| **LSP** | Any `DeliveryAssignmentStrategy` subclass must return a `DeliveryPartner` (or `None`) — never throw for "no partner found"; callers rely on this consistent contract |
| **ISP** | `PaymentGateway` exposes only `charge(amount, method) -> PaymentResult` — clients aren't forced to depend on refund/payout methods they don't use in this flow |
| **DIP** | `Order`/`OrderService` depend on the `PaymentGateway` interface and `DeliveryAssignmentStrategy` interface, not concrete `StripeGateway` or `NearestPartnerStrategy` classes |

---

## 6. Step 6: Apply Design Patterns

### Observer — Order Status Tracking

**Problem it solves:** multiple parties (customer app, delivery partner app, analytics
service, notification service) need to react when an order's status changes, without
`Order` knowing about any of them by name.

```python
from abc import ABC, abstractmethod
from enum import Enum, auto


class OrderStatus(Enum):
    PLACED = auto()
    ACCEPTED = auto()
    PREPARING = auto()
    OUT_FOR_DELIVERY = auto()
    DELIVERED = auto()
    CANCELLED = auto()


class OrderObserver(ABC):
    @abstractmethod
    def update(self, order: "Order") -> None: ...


class CustomerNotifier(OrderObserver):
    def update(self, order: "Order") -> None:
        print(f"[Customer app] order {order.id} is now {order.status.name}")


class DeliveryPartnerNotifier(OrderObserver):
    def update(self, order: "Order") -> None:
        if order.status == OrderStatus.OUT_FOR_DELIVERY:
            print(f"[Partner app] pickup ready for order {order.id}")


class Order:
    def __init__(self, order_id: str, restaurant: "Restaurant", customer: "Customer"):
        self.id = order_id
        self.restaurant = restaurant
        self.customer = customer
        self.items: list["OrderItem"] = []
        self.status = OrderStatus.PLACED
        self.delivery_partner: "DeliveryPartner | None" = None
        self._observers: list[OrderObserver] = []

    def add_observer(self, observer: OrderObserver) -> None:
        self._observers.append(observer)

    def _set_status(self, status: OrderStatus) -> None:
        self.status = status
        for observer in self._observers:
            observer.update(self)

    def accept(self) -> None:
        self._set_status(OrderStatus.ACCEPTED)

    def mark_out_for_delivery(self, partner: "DeliveryPartner") -> None:
        self.delivery_partner = partner
        self._set_status(OrderStatus.OUT_FOR_DELIVERY)

    def mark_delivered(self) -> None:
        self._set_status(OrderStatus.DELIVERED)

    def total(self) -> float:
        return sum(item.subtotal() for item in self.items)
```

### Strategy — Delivery Partner Assignment

**Problem it solves:** "how we pick a delivery partner" changes often (nearest-first at
launch, then rating-weighted, then load-balanced) — this must not require touching
`Order` or `OrderService` code each time.

```python
class DeliveryAssignmentStrategy(ABC):
    @abstractmethod
    def assign(self, order: "Order", available_partners: list["DeliveryPartner"]) -> "DeliveryPartner | None": ...


class NearestPartnerStrategy(DeliveryAssignmentStrategy):
    def assign(self, order, available_partners):
        if not available_partners:
            return None
        return min(
            available_partners,
            key=lambda p: p.distance_to(order.restaurant.location),
        )


class HighestRatedPartnerStrategy(DeliveryAssignmentStrategy):
    def assign(self, order, available_partners):
        candidates = [p for p in available_partners if p.distance_to(order.restaurant.location) <= 5.0]
        if not candidates:
            return None
        return max(candidates, key=lambda p: p.rating)


class OrderService:
    def __init__(self, assignment_strategy: DeliveryAssignmentStrategy):
        self._strategy = assignment_strategy   # injected — DIP

    def assign_delivery_partner(self, order: "Order", available_partners: list["DeliveryPartner"]) -> bool:
        partner = self._strategy.assign(order, available_partners)
        if partner is None:
            return False
        partner.mark_busy()
        order.mark_out_for_delivery(partner)
        return True
```

Swapping `NearestPartnerStrategy` for `HighestRatedPartnerStrategy` requires zero changes
to `Order`, `OrderService.assign_delivery_partner`'s caller, or `DeliveryPartner`.

---

## 7. Step 7: Explain Extensibility

| New requirement | How the design absorbs it |
|------------------|----------------------------|
| Add multi-restaurant cart (split order) | Introduce a `Cart` that groups multiple `Order`s per restaurant, one `Payment` at the cart level — `Order` itself is unchanged |
| Add coupons/discounts | Add a `DiscountStrategy` (Strategy pattern again) consulted inside `Order.total()` |
| Add group ordering | `Customer` becomes a role; introduce `OrderGroup` composing multiple `Customer` contributions — doesn't touch `Restaurant`/`Menu` |
| Add real-time GPS tracking | `DeliveryPartner` gains a `location` stream; a new `LocationObserver` subscribes the same way `CustomerNotifier` does — no change to the Observer machinery |
| Support multiple payment methods per order (split bill) | `Payment` becomes composed of multiple `PaymentAttempt`s; `PaymentGateway` interface is unaffected |

The Observer and Strategy seams are exactly where each of these changes plugs in — that's
the point of introducing them at step 6, not before.

---

## 8. Class Diagram

```
┌─────────────┐        ┌────────────┐        ┌────────────┐
│ Restaurant  │1──────1│    Menu    │1──────*│  MenuItem  │
└─────────────┘        └────────────┘        └────────────┘
       │1                                            ▲
       │                                             │ references
       │*                                            │
┌─────────────┐        ┌────────────┐        ┌───────┴────┐
│   Order     │1──────*│ OrderItem  │*──────1│            │
│-------------│        └────────────┘        └────────────┘
│ status      │
│ items       │1                   ┌───────────────────────┐
│ observers[] │───────────────────▶│  OrderObserver (ABC)   │
└─────────────┘  notifies          │  + update(order)       │
   │      │                        └───────────▲────────────┘
   │      │0..1                                │
   │      ▼                          ┌──────────┴──────────┐
   │  ┌────────────────┐             │CustomerNotifier      │
   │  │DeliveryPartner  │             │DeliveryPartnerNotifier│
   │  └────────────────┘             └───────────────────────┘
   │1
   ▼1
┌────────────┐        ┌───────────────────────┐
│  Payment   │───────▶│  PaymentGateway (ABC)  │
└────────────┘        │  + charge(amt, method) │
                       └────────────────────────┘

┌───────────────────────────────┐
│ DeliveryAssignmentStrategy(ABC)│
│ + assign(order, partners)      │
└───────────────▲────────────────┘
                 │
     ┌───────────┴────────────┐
     │ NearestPartnerStrategy  │
     │ HighestRatedPartnerStrategy │
     └─────────────────────────┘
```

---

## 9. Key Decisions

- **Why is `DeliveryAssignmentStrategy` a separate class instead of a method on `Order`?**
  Assignment logic changes independently of order lifecycle logic and needs to be
  swapped/tested in isolation (OCP + SRP).
- **Why Observer instead of `Order` calling `notify_customer()` and `notify_partner()`
  directly?** Adding a new listener (e.g., analytics) would otherwise require editing
  `Order` every time — Observer keeps `Order` closed for modification.
- **Why is `Payment` composed by `Order` rather than the other way around?** A payment has
  no meaning without an order; the order is the aggregate root here.
- **Why keep `PaymentGateway` as an interface?** In interviews and in production, the
  actual processor (Stripe, Razorpay, internal wallet) is an infrastructure detail that
  should never leak into domain logic (DIP).

---

## 10. Interview Follow-ups

- "What if the same delivery partner should be reused across nearby restaurants' orders
  for batching?" → Discuss a `BatchingAssignmentStrategy` that groups orders by pickup
  radius before assigning.
- "How do you prevent double-assignment of a delivery partner?" → Discuss making
  `DeliveryPartner.mark_busy()` atomic/checked before assignment, or using a lock/CAS in a
  concurrent version.
- "What happens if payment fails after the order is placed?" → Walk through `Order`
  transitioning to a `PAYMENT_FAILED` sub-state (or being cancelled), and that this should
  be a state transition, not a silent `Payment` field flip.
- "How would you support scheduled orders (deliver at 7pm)?" → Add a `scheduled_for`
  timestamp on `Order` and a separate dispatcher job that triggers assignment near that
  time, instead of immediately on placement.

---

## 11. Interview Q&A

**Q: Why use the Observer pattern for order status updates instead of having `Order` directly call each notifier?**
Answer: Direct calls would mean every time a new stakeholder needs order updates (analytics, SMS service, delivery partner app), you'd have to modify `Order`'s code — violating the Open/Closed Principle. With Observer, `Order` only knows about the generic `OrderObserver` interface; new observers register themselves without any change to `Order`.

**Q: Why is delivery partner assignment implemented as a Strategy rather than an `if/elif` chain inside `Order` or `OrderService`?**
Answer: Assignment algorithms change frequently in real systems (nearest-first, rating-weighted, load-balanced, batched) and each needs independent testing. An `if/elif` chain would force every new algorithm to touch existing, working code. The Strategy pattern isolates each algorithm behind a common interface, so `OrderService` stays unchanged when the business swaps strategies — this is OCP in practice.

**Q: How would you model the relationship between `Order` and `OrderItem` versus `OrderItem` and `MenuItem`?**
Answer: `Order` to `OrderItem` is composition — an `OrderItem` (quantity + snapshot price) has no meaning outside its order and is destroyed with it. `OrderItem` to `MenuItem` is association — the order item references a menu item (for name/price context) but doesn't own it; the menu item continues to exist in the restaurant's menu regardless of the order's fate.

**Q: Should `MenuItem` price changes retroactively affect past orders?**
Answer: No — this is a classic LLD trap. `OrderItem` should snapshot the price at order-placement time (store `price_at_order_time`), not hold a live reference that recomputes from the current `MenuItem.price`. Otherwise a price increase next month would silently change the total of a historical, already-paid order.

**Q: How do you keep `Order` from becoming a "god object" that knows about payment, delivery, and notifications?**
Answer: By delegating each concern to a focused collaborator: `PaymentGateway` for charging, `DeliveryAssignmentStrategy` for picking a courier, and `OrderObserver` implementations for notifications. `Order` retains only what's core to its own identity — its items, its status, and the state-transition rules between statuses. This keeps it aligned with SRP even as the surrounding system grows.

**Q: What would break if `DeliveryPartner` inherited from `Customer` because "both are users with a name and phone number"?**
Answer: This violates LSP and conflates unrelated behavior — a `DeliveryPartner` doesn't place orders and a `Customer` doesn't accept deliveries, so substituting one for the other would produce nonsensical or unsafe behavior. The shared fields (name, phone) belong in a common `User` base class or, more simply, in a `Contact` value object composed into both, rather than an inheritance relationship between the two roles.
