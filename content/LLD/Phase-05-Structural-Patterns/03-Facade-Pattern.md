# Facade Pattern — Complete Guide

## Table of Contents
1. [The Problem Facade Solves](#1-the-problem-facade-solves)
2. [What is the Facade Pattern?](#2-what-is-the-facade-pattern)
3. [Bad Example: Client Talks to Every Subsystem](#3-bad-example-client-talks-to-every-subsystem)
4. [Good Example: OrderFacade](#4-good-example-orderfacade)
5. [Facade vs Encapsulation](#5-facade-vs-encapsulation)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem Facade Solves

Real systems are built from many subsystems, each with its own multi-step API: check inventory, reserve stock, charge payment, handle failure/refund, book shipping, send confirmation. A client (say, a checkout API endpoint) that has to know and correctly sequence all of that is fragile and hard to reuse.

```
Client (checkout endpoint) must know:
  1. InventoryService.check_stock(...)
  2. InventoryService.reserve(...)
  3. PaymentService.charge(...)
  4. if payment fails -> InventoryService.release(...)
  5. ShippingService.schedule_pickup(...)
  6. NotificationService.send_confirmation(...)

Every new client (web checkout, mobile app, admin "place order on behalf of customer"
tool, batch reorder script) has to reimplement this exact sequence correctly.
```

Miss a step (forget to release inventory on payment failure) in just one of those clients, and you get stock leaks or double-charges. That's what Facade prevents.

---

## 2. What is the Facade Pattern?

Facade provides a unified, simplified interface to a set of interfaces in a subsystem. It doesn't add new functionality — it defines a higher-level entry point that internally coordinates the subsystem correctly, so most clients never need to touch the subsystem classes directly.

```
┌───────────┐        ┌─────────────────────┐
│  Client   │───────▶│     OrderFacade     │
└───────────┘        │  place_order(...)   │
                      └──────────┬──────────┘
                                 │ coordinates
        ┌────────────┬──────────┼───────────┬──────────────┐
        ▼            ▼          ▼           ▼              ▼
 ┌─────────────┐┌──────────┐┌─────────┐┌───────────┐┌────────────────┐
 │ Inventory   ││ Payment  ││Shipping ││Notification││ (subsystems —   │
 │ Service     ││ Service  ││Service  ││ Service    ││ still callable   │
 └─────────────┘└──────────┘└─────────┘└───────────┘│ directly if      │
                                                       │ needed)          │
                                                       └────────────────┘
```

The subsystem classes still exist and are still usable on their own for power users/advanced flows — Facade adds a simple front door, it doesn't lock the back doors.

---

## 3. Bad Example: Client Talks to Every Subsystem

```python
class InventoryService:
    def check_stock(self, sku: str, qty: int) -> bool:
        print(f"[Inventory] Checking stock for {sku} x{qty}")
        return True

    def reserve(self, sku: str, qty: int) -> None:
        print(f"[Inventory] Reserved {sku} x{qty}")

    def release(self, sku: str, qty: int) -> None:
        print(f"[Inventory] Released {sku} x{qty}")


class PaymentService:
    def charge(self, customer_id: str, amount: float) -> bool:
        print(f"[Payment] Charging {customer_id} ${amount:.2f}")
        return True


class ShippingService:
    def schedule_pickup(self, sku: str, address: str) -> str:
        print(f"[Shipping] Scheduling pickup for {sku} to {address}")
        return "TRACK123"


class NotificationService:
    def send_confirmation(self, customer_id: str, tracking_id: str) -> None:
        print(f"[Notification] Confirmation sent to {customer_id}, tracking {tracking_id}")


# Every client has to get this orchestration exactly right, every time.
def checkout_endpoint(customer_id: str, sku: str, qty: int, amount: float, address: str) -> None:
    inventory = InventoryService()
    payment = PaymentService()
    shipping = ShippingService()
    notifier = NotificationService()

    if not inventory.check_stock(sku, qty):
        raise RuntimeError("Out of stock")
    inventory.reserve(sku, qty)

    if not payment.charge(customer_id, amount):
        inventory.release(sku, qty)  # easy to forget this line!
        raise RuntimeError("Payment failed")

    tracking_id = shipping.schedule_pickup(sku, address)
    notifier.send_confirmation(customer_id, tracking_id)
```

**Why this is painful:**
- Every new entry point (mobile app, admin tool, batch script) must re-implement the exact same 6-step sequence, including the easy-to-forget compensating action (`release` on payment failure).
- Business logic (the correct order of operations) is duplicated across clients instead of owned in one place.
- Changing the sequence (e.g., adding a fraud check step) means hunting down and editing every client.

---

## 4. Good Example: OrderFacade

```python
from dataclasses import dataclass


class InventoryService:
    def check_stock(self, sku: str, qty: int) -> bool:
        print(f"[Inventory] Checking stock for {sku} x{qty}")
        return True

    def reserve(self, sku: str, qty: int) -> None:
        print(f"[Inventory] Reserved {sku} x{qty}")

    def release(self, sku: str, qty: int) -> None:
        print(f"[Inventory] Released {sku} x{qty}")


class PaymentService:
    def charge(self, customer_id: str, amount: float) -> bool:
        print(f"[Payment] Charging {customer_id} ${amount:.2f}")
        return True


class ShippingService:
    def schedule_pickup(self, sku: str, address: str) -> str:
        print(f"[Shipping] Scheduling pickup for {sku} to {address}")
        return "TRACK123"


class NotificationService:
    def send_confirmation(self, customer_id: str, tracking_id: str) -> None:
        print(f"[Notification] Confirmation sent to {customer_id}, tracking {tracking_id}")


@dataclass
class OrderRequest:
    customer_id: str
    sku: str
    qty: int
    amount: float
    address: str


class OrderFacade:
    """Single simplified entry point that hides Inventory + Payment + Shipping + Notification."""

    def __init__(self) -> None:
        self._inventory = InventoryService()
        self._payment = PaymentService()
        self._shipping = ShippingService()
        self._notifier = NotificationService()

    def place_order(self, request: OrderRequest) -> str:
        if not self._inventory.check_stock(request.sku, request.qty):
            raise RuntimeError("Out of stock")
        self._inventory.reserve(request.sku, request.qty)

        if not self._payment.charge(request.customer_id, request.amount):
            self._inventory.release(request.sku, request.qty)  # correctness lives HERE, once
            raise RuntimeError("Payment failed")

        tracking_id = self._shipping.schedule_pickup(request.sku, request.address)
        self._notifier.send_confirmation(request.customer_id, tracking_id)
        return tracking_id


if __name__ == "__main__":
    facade = OrderFacade()
    tracking = facade.place_order(
        OrderRequest(customer_id="cust_1", sku="SKU-42", qty=2, amount=59.98, address="221B Baker St")
    )
    print(f"Order placed. Tracking: {tracking}")
```

```
Output:
[Inventory] Checking stock for SKU-42 x2
[Inventory] Reserved SKU-42 x2
[Payment] Charging cust_1 $59.98
[Shipping] Scheduling pickup for SKU-42 to 221B Baker St
[Notification] Confirmation sent to cust_1, tracking TRACK123
Order placed. Tracking: TRACK123
```

Every client — web, mobile, admin, batch — now calls `OrderFacade().place_order(request)` and gets the correct sequence for free. Power users who need fine-grained control can still import and call `InventoryService`/`PaymentService` directly; the facade doesn't remove that option.

---

## 5. Facade vs Encapsulation

Facade is sometimes dismissed as "just encapsulation," but it's a specific application of it at the **subsystem boundary**:

| | Encapsulation (general OOP) | Facade (pattern) |
|---|---|---|
| Scope | Hides internal state/logic of a *single* class | Hides interaction between *multiple* classes/subsystems |
| Goal | Protect invariants of one object | Simplify the entry point to a whole subsystem for external clients |
| What's hidden | Fields, helper methods | Existence and coordination of several collaborating services |

---

## 6. When to Use / Trade-offs

**Use Facade when:**
- A subsystem is complex, and most clients only need a common, simple sequence of operations from it.
- You want to decouple client code from a subsystem's internals so the subsystem can evolve independently.
- You're layering a system (e.g., presentation layer should not talk directly to five different service classes).

**Trade-offs:**
- A facade can become a "god object" if it accumulates too much orchestration logic and unrelated responsibilities — keep it thin, delegate all real work to subsystem classes.
- It can hide power/flexibility: if advanced clients need fine-grained control over individual subsystem steps, make sure the subsystem classes remain accessible directly (don't force everyone through the facade).
- Adds one more layer to trace through when debugging — usually a worthwhile trade for the correctness guarantee it buys.

---

## 7. Hands-On Exercises

**Exercise 1:** Add a `FraudCheckService.is_suspicious(customer_id, amount) -> bool` subsystem and wire it into `OrderFacade.place_order` as a step before charging payment — reject with a clear error if suspicious.

**Exercise 2:** Add a `cancel_order(tracking_id, sku, qty, customer_id, amount) -> None` method to `OrderFacade` that reverses shipping, refunds payment, and releases inventory in the correct order.

**Exercise 3:** Write a `ReportingFacade` that hides three subsystems — `SalesService`, `InventoryService`, `CustomerService` — behind one method `generate_monthly_summary(month: str) -> dict`.

---

## 8. Interview Q&A

**Q: What problem does the Facade pattern solve?**
Answer: It provides one simplified entry point to a subsystem made of multiple classes with a multi-step, easy-to-get-wrong interaction sequence. Instead of every client re-implementing that sequence (and risking bugs like forgetting a compensating action), the facade owns the correct orchestration once, and clients call a single high-level method.

**Q: Give a real example of Facade in an e-commerce system.**
Answer: An `OrderFacade.place_order(request)` that internally coordinates `InventoryService` (check/reserve/release stock), `PaymentService` (charge), `ShippingService` (schedule pickup), and `NotificationService` (send confirmation) in the correct order, including rollback logic like releasing reserved inventory if payment fails. Callers (web checkout, mobile app, admin tools) only ever call `place_order` and never need to know these four services exist.

**Q: Does Facade prevent clients from accessing the subsystem classes directly?**
Answer: No — Facade is an added convenience layer, not an access restriction. Subsystem classes typically remain public and can still be used directly by clients that need fine-grained control (e.g., an internal ops dashboard that needs to call `InventoryService.reserve` alone). The facade just gives most callers a simpler default path.

**Q: How is Facade different from Adapter?**
Answer: Adapter's job is compatibility — translating one existing interface into another interface a client already expects, usually for a single class. Facade's job is simplicity — creating a brand-new, simpler interface over multiple classes/subsystems, without necessarily translating anything (the facade's method signatures don't have to mirror any existing interface). Adapter is about "make this fit"; Facade is about "make this easy."

**Q: When could a Facade become an anti-pattern?**
Answer: When it grows into a "god object" — accumulating unrelated business logic, becoming a dumping ground that every feature routes through, or when it starts hiding too much and blocks legitimate advanced use cases that need direct subsystem access. A healthy facade stays thin: it only sequences calls to subsystem classes and contains minimal logic of its own.

**Q: Implement a minimal Facade from scratch over a `LightsSystem`, `ThermostatSystem`, and `SecuritySystem` for a smart-home "leave_home()" and "arrive_home()" use case.**
Answer:
```python
class LightsSystem:
    def turn_off_all(self) -> None:
        print("Lights off")

    def turn_on_entryway(self) -> None:
        print("Entryway light on")


class ThermostatSystem:
    def set_eco_mode(self) -> None:
        print("Thermostat: eco mode")

    def set_comfort_mode(self) -> None:
        print("Thermostat: comfort mode")


class SecuritySystem:
    def arm(self) -> None:
        print("Security armed")

    def disarm(self) -> None:
        print("Security disarmed")


class SmartHomeFacade:
    def __init__(self) -> None:
        self._lights = LightsSystem()
        self._thermostat = ThermostatSystem()
        self._security = SecuritySystem()

    def leave_home(self) -> None:
        self._lights.turn_off_all()
        self._thermostat.set_eco_mode()
        self._security.arm()

    def arrive_home(self) -> None:
        self._security.disarm()
        self._lights.turn_on_entryway()
        self._thermostat.set_comfort_mode()


home = SmartHomeFacade()
home.leave_home()
home.arrive_home()
```
