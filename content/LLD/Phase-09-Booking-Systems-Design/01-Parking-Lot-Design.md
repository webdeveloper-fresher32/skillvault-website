# Parking Lot Design — Complete Guide

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Diagram](#8-class-diagram)
9. [Python Skeleton](#9-python-skeleton)
10. [Key Decisions](#10-key-decisions)
11. [Interview Follow-ups](#11-interview-follow-ups)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements
- The parking lot has **multiple floors**, each with **multiple spots**.
- Spots come in different **types/sizes**: Motorcycle, Compact (car), Large (SUV/truck), and optionally Electric-Vehicle (EV) charging spots.
- A vehicle **entering** the lot takes a ticket at an **Entry Panel**; the ticket records entry time and assigned spot.
- A vehicle **exiting** pays at an **Exit Panel**; the fee is computed from duration and vehicle type, then the spot is freed.
- The system should say **"lot full"** when no compatible spot is available for a vehicle type.

### Non-Functional / Clarifying Questions to Ask
- Can a motorcycle park in a compact/large spot if no motorcycle spot is free? *(Assume: yes — a vehicle can use any spot ≥ its required size, but a spot fits only vehicles ≤ its size.)*
- Multiple entry/exit panels operating concurrently — do we need thread-safety on spot allocation? *(Assume: yes, single lot, multiple panels — must not double-assign a spot.)*
- Payment methods — cash, card, UPI? *(Assume: pluggable, decided later via Strategy.)*
- Is pricing flat-rate or time-based, and does it vary by floor/vehicle type? *(Assume: time-based, varies by vehicle type.)*

State these assumptions out loud before designing — this is the single most-checked interview behavior.

---

## 2. Step 2: Identify Entities/Classes

| Class | Kind | Responsibility |
|-------|------|-----------------|
| `ParkingLot` | Manager (Singleton) | Owns floors, coordinates entry/exit, top-level facade |
| `Floor` | Domain | Owns a collection of spots on one level |
| `ParkingSpot` (abstract) | Domain | Represents one physical spot; knows its type and occupancy |
| `MotorcycleSpot`, `CompactSpot`, `LargeSpot`, `ElectricSpot` | Domain | Concrete spot types |
| `Vehicle` (abstract) | Domain | Base for `Motorcycle`, `Car`, `Truck`; knows its `VehicleType` |
| `Ticket` | Domain (value-ish) | Entry time, vehicle, assigned spot reference |
| `Payment` | Domain | Amount, method, status |
| `EntryPanel` | Service | Issues tickets, requests spot allocation |
| `ExitPanel` | Service | Computes fee, processes payment, frees spot |
| `SpotAllocationStrategy` (interface) | Strategy | Decides *which* free spot to assign |
| `PricingStrategy` (interface) | Strategy | Decides fee given ticket duration & vehicle type |

---

## 3. Step 3: Define Relationships

```
ParkingLot   1 ────── * Floor            (composition — floors don't exist without the lot)
Floor        1 ────── * ParkingSpot      (composition)
ParkingSpot  1 ────── 0..1 Vehicle       (association — occupancy, transient)
ParkingLot   1 ────── * EntryPanel       (composition)
ParkingLot   1 ────── * ExitPanel        (composition)
Ticket       1 ────── 1 Vehicle          (association)
Ticket       1 ────── 1 ParkingSpot      (association)
Ticket       1 ────── 0..1 Payment       (association, set on exit)
ParkingLot   1 ────── 1 SpotAllocationStrategy  (dependency, injected)
ParkingLot   1 ────── 1 PricingStrategy         (dependency, injected)
```

`ParkingSpot` is abstract and subclassed per size rather than holding a `size` enum only, because behavior (e.g., "can this vehicle fit?") is cleanly polymorphic and each subtype could later gain unique behavior (e.g., `ElectricSpot.start_charging()`).

---

## 4. Step 4: Assign Responsibilities

- **`ParkingSpot`**: knows if it's free, occupy/vacate itself, whether a given vehicle fits. Does NOT know about pricing or tickets.
- **`Floor`**: finds free spots of a requested type on itself. Does NOT decide the overall allocation policy (delegates to strategy).
- **`ParkingLot`**: facade — `park_vehicle()`, `unpark_vehicle()`. Delegates spot search to `SpotAllocationStrategy`, fee calc to `PricingStrategy`. Holds the lock for allocation.
- **`EntryPanel` / `ExitPanel`**: thin — just call into `ParkingLot`. They exist because a real lot has physical entry/exit points, and separating them keeps `ParkingLot` free of "which panel called me" logic.
- **`Ticket`**: pure data holder plus `duration()` helper.
- **`Payment`**: pure data holder (amount, method, status) — actual gateway integration is out of scope, mocked as a strategy.

---

## 5. Step 5: Apply SOLID

| Principle | Applied How |
|-----------|-------------|
| **SRP** | `ParkingLot` orchestrates; `Floor` manages spot lookup; `ParkingSpot` manages occupancy; pricing/allocation are separate strategy classes. No class does two jobs. |
| **OCP** | Adding `ElectricSpot` or a new `SpotAllocationStrategy` (e.g., "nearest to elevator") requires zero changes to `ParkingLot` — just a new subclass/strategy. |
| **LSP** | Any `ParkingSpot` subclass can be used wherever `ParkingSpot` is expected — `can_fit(vehicle)` and `occupy()/vacate()` behave consistently across subtypes. |
| **ISP** | `SpotAllocationStrategy` and `PricingStrategy` are small, single-method interfaces — no class is forced to implement methods it doesn't need. |
| **DIP** | `ParkingLot` depends on the `SpotAllocationStrategy` and `PricingStrategy` *abstractions*, injected at construction — not concrete implementations. |

---

## 6. Step 6: Apply Design Patterns

- **Strategy** — `SpotAllocationStrategy` (nearest-to-entry vs best-fit vs least-fragmentation) and `PricingStrategy` (flat vs tiered vs weekday/weekend). This is the centerpiece pattern for this problem.
- **Singleton** — `ParkingLot` itself is typically a single instance per physical lot (careful: mention that Singleton is debatable/testability-hostile in interviews — an acceptable alternative is a single injected instance managed by the caller).
- **Factory Method** — `VehicleFactory`/`SpotFactory` to construct the right subtype from a type code, keeping `if/elif` chains out of client code.
- **Observer** (optional extension) — notify a `DisplayBoard` of available-spot-count changes without `ParkingLot` knowing about the display.

---

## 7. Step 7: Explain Extensibility

1. **New vehicle type (e.g., Bus)** — add `Bus(Vehicle)` and `BusSpot(ParkingSpot)`; register in `SpotFactory`. No existing class is modified — pure OCP.
2. **EV charging spots** — `ElectricSpot(ParkingSpot)` adds `start_charging()`/`stop_charging()` and a charging surcharge in a dedicated `EVPricingStrategy`. Allocation strategy gets an optional `requires_charging` filter — `ParkingLot.park_vehicle()` signature doesn't change (passes an options object).
3. **Multiple lots / a chain of lots** — introduce a `ParkingLotManager` that routes to the nearest lot with capacity; each `ParkingLot` remains unchanged, proving the design was properly encapsulated.
4. **Dynamic/surge pricing** — swap `PricingStrategy` implementation at runtime (e.g., `SurgePricingStrategy` during peak hours) with zero change to `ExitPanel`.

---

## 8. Class Diagram

```
                         ┌────────────────────┐
                         │     ParkingLot      │
                         ├────────────────────┤
                         │ - floors: List[Floor]│
                         │ - allocation_strategy│
                         │ - pricing_strategy   │
                         ├────────────────────┤
                         │ + park_vehicle()     │
                         │ + unpark_vehicle()   │
                         └─────────┬───────────┘
                                   │ 1..*
                                   ▼
                         ┌────────────────────┐
                         │       Floor         │
                         ├────────────────────┤
                         │ - spots: List[Spot] │
                         ├────────────────────┤
                         │ + free_spots(type)  │
                         └─────────┬───────────┘
                                   │ 1..*
                                   ▼
                         ┌────────────────────┐
                         │   ParkingSpot (ABC)  │
                         ├────────────────────┤
                         │ - spot_id, is_free   │
                         ├────────────────────┤
                         │ + can_fit(vehicle)   │
                         │ + occupy() / vacate()│
                         └─────────┬───────────┘
                     ┌─────────────┼─────────────┬───────────────┐
                     ▼             ▼             ▼               ▼
           MotorcycleSpot   CompactSpot     LargeSpot      ElectricSpot

    ┌───────────────┐        ┌───────────────┐       ┌──────────────────────┐
    │    Vehicle    │        │    Ticket     │       │ «interface»           │
    │    (ABC)      │◀───────│ - vehicle     │       │ SpotAllocationStrategy│
    ├───────────────┤        │ - spot        │       ├──────────────────────┤
    │ + vehicle_type│        │ - entry_time  │       │ + find_spot(floors,  │
    └───────┬───────┘        │ - payment     │       │     vehicle)          │
      ┌─────┼─────┐          └───────────────┘       └──────────────────────┘
      ▼     ▼     ▼                                    ▲            ▲
 Motorcycle Car  Truck                         NearestSpotStrategy BestFitStrategy

    ┌──────────────┐         ┌──────────────────┐
    │   Payment    │         │ «interface»       │
    ├──────────────┤         │ PricingStrategy   │
    │ - amount     │         ├──────────────────┤
    │ - method     │         │ + calculate_fee() │
    │ - status     │         └──────────────────┘
    └──────────────┘
```

---

## 9. Python Skeleton

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from threading import Lock
from typing import List, Optional
import uuid


class VehicleType(Enum):
    MOTORCYCLE = auto()
    CAR = auto()
    TRUCK = auto()


class Vehicle(ABC):
    def __init__(self, license_plate: str):
        self.license_plate = license_plate

    @property
    @abstractmethod
    def vehicle_type(self) -> VehicleType: ...


class Motorcycle(Vehicle):
    vehicle_type = VehicleType.MOTORCYCLE


class Car(Vehicle):
    vehicle_type = VehicleType.CAR


class Truck(Vehicle):
    vehicle_type = VehicleType.TRUCK


class ParkingSpot(ABC):
    def __init__(self, spot_id: str):
        self.spot_id = spot_id
        self.is_free = True
        self._lock = Lock()

    @abstractmethod
    def can_fit(self, vehicle: Vehicle) -> bool: ...

    def occupy(self) -> bool:
        """Atomically claim this spot. Returns False if already taken."""
        with self._lock:
            if not self.is_free:
                return False
            self.is_free = False
            return True

    def vacate(self) -> None:
        with self._lock:
            self.is_free = True


class MotorcycleSpot(ParkingSpot):
    def can_fit(self, vehicle: Vehicle) -> bool:
        return vehicle.vehicle_type == VehicleType.MOTORCYCLE


class CompactSpot(ParkingSpot):
    def can_fit(self, vehicle: Vehicle) -> bool:
        return vehicle.vehicle_type in (VehicleType.MOTORCYCLE, VehicleType.CAR)


class LargeSpot(ParkingSpot):
    def can_fit(self, vehicle: Vehicle) -> bool:
        return True  # a large spot fits anything


class ElectricSpot(CompactSpot):
    def start_charging(self) -> None: ...
    def stop_charging(self) -> None: ...


class Floor:
    def __init__(self, level: int, spots: List[ParkingSpot]):
        self.level = level
        self.spots = spots

    def free_spots_for(self, vehicle: Vehicle) -> List[ParkingSpot]:
        return [s for s in self.spots if s.is_free and s.can_fit(vehicle)]


# --- Strategy: allocation ---
class SpotAllocationStrategy(ABC):
    @abstractmethod
    def find_spot(self, floors: List[Floor], vehicle: Vehicle) -> Optional[ParkingSpot]: ...


class NearestSpotStrategy(SpotAllocationStrategy):
    """Picks the first free, fitting spot scanning floors in order (closest to entry)."""
    def find_spot(self, floors: List[Floor], vehicle: Vehicle) -> Optional[ParkingSpot]:
        for floor in floors:
            candidates = floor.free_spots_for(vehicle)
            if candidates:
                return candidates[0]
        return None


class BestFitStrategy(SpotAllocationStrategy):
    """Picks the smallest spot that still fits the vehicle, to conserve large spots."""
    SIZE_RANK = {MotorcycleSpot: 0, CompactSpot: 1, ElectricSpot: 1, LargeSpot: 2}

    def find_spot(self, floors: List[Floor], vehicle: Vehicle) -> Optional[ParkingSpot]:
        all_candidates = [s for f in floors for s in f.free_spots_for(vehicle)]
        if not all_candidates:
            return None
        return min(all_candidates, key=lambda s: self.SIZE_RANK.get(type(s), 99))


# --- Strategy: pricing ---
class PricingStrategy(ABC):
    @abstractmethod
    def calculate_fee(self, vehicle_type: VehicleType, duration_hours: float) -> float: ...


class HourlyPricingStrategy(PricingStrategy):
    RATES = {VehicleType.MOTORCYCLE: 10, VehicleType.CAR: 20, VehicleType.TRUCK: 30}

    def calculate_fee(self, vehicle_type: VehicleType, duration_hours: float) -> float:
        import math
        return self.RATES[vehicle_type] * math.ceil(duration_hours)


@dataclass
class Payment:
    amount: float
    method: str
    status: str = "PENDING"


@dataclass
class Ticket:
    ticket_id: str
    vehicle: Vehicle
    spot: ParkingSpot
    entry_time: datetime
    payment: Optional[Payment] = None

    def duration_hours(self, exit_time: datetime) -> float:
        return (exit_time - self.entry_time).total_seconds() / 3600


class ParkingLot:
    def __init__(self, floors: List[Floor],
                 allocation_strategy: SpotAllocationStrategy,
                 pricing_strategy: PricingStrategy):
        self.floors = floors
        self.allocation_strategy = allocation_strategy
        self.pricing_strategy = pricing_strategy
        self._active_tickets = {}
        self._lock = Lock()

    def park_vehicle(self, vehicle: Vehicle) -> Ticket:
        with self._lock:
            spot = self.allocation_strategy.find_spot(self.floors, vehicle)
            if spot is None or not spot.occupy():
                raise RuntimeError("Parking lot full for this vehicle type")
            ticket = Ticket(
                ticket_id=str(uuid.uuid4()),
                vehicle=vehicle,
                spot=spot,
                entry_time=datetime.now(),
            )
            self._active_tickets[ticket.ticket_id] = ticket
            return ticket

    def unpark_vehicle(self, ticket_id: str, payment_method: str) -> Payment:
        ticket = self._active_tickets.pop(ticket_id)
        duration = ticket.duration_hours(datetime.now())
        fee = self.pricing_strategy.calculate_fee(ticket.vehicle.vehicle_type, duration)
        payment = Payment(amount=fee, method=payment_method, status="PAID")
        ticket.payment = payment
        ticket.spot.vacate()
        return payment


class EntryPanel:
    def __init__(self, lot: ParkingLot):
        self.lot = lot

    def issue_ticket(self, vehicle: Vehicle) -> Ticket:
        return self.lot.park_vehicle(vehicle)


class ExitPanel:
    def __init__(self, lot: ParkingLot):
        self.lot = lot

    def process_exit(self, ticket_id: str, payment_method: str) -> Payment:
        return self.lot.unpark_vehicle(ticket_id, payment_method)
```

---

## 10. Key Decisions

- **`occupy()` uses a per-spot lock, not a lot-wide lock for the whole flow** — reduces contention: two entry panels assigning different spots don't block each other, only the allocation search + claim needs coordination.
- **`ParkingSpot` is a class hierarchy, not an enum + generic class** — because behavior (fit rules, EV charging) diverges by type; an enum would push all that logic into `if` chains inside `ParkingLot`.
- **Allocation and pricing are injected strategies**, not hardcoded — the interviewer will almost always ask "what if allocation policy changes" and this answers it for free.
- **`Ticket` and `Payment` are simple dataclasses** — no behavior beyond a duration helper; keeps them safely serializable and free of side effects.

---

## 11. Interview Follow-ups

- **How do you handle a full parking lot?** `find_spot()` returns `None` when no floor has a fitting free spot; `park_vehicle()` raises (or returns a `Result`/`Optional` in a non-exception style) and the entry panel displays "Lot Full" — optionally publish an event so a `DisplayBoard` (Observer) shows real-time availability so cars don't queue at a full entry.
- **How would you support EV charging spots?** Model as `ElectricSpot(CompactSpot)` with `start_charging()/stop_charging()`; extend the vehicle-parking request with an optional `needs_charging` flag; `SpotAllocationStrategy` filters for `ElectricSpot` when the flag is set; add a `EVPricingStrategy` decorator that adds a per-kWh surcharge on top of the base hourly rate.
- **How would you scale to multiple parking lots across a city?** Add a `ParkingLotManager`/`ParkingLotLocator` layer that indexes lots geographically and queries each lot's available-spot count (cached, periodically refreshed) rather than making cross-lot calls synchronous.
- **How do you avoid two cars getting assigned the same spot under concurrency?** `ParkingSpot.occupy()` is atomic (lock-guarded compare-and-set on `is_free`); even if two threads pick the same spot from a slightly stale free-list, only one `occupy()` call succeeds — the other retries allocation.
- **How would you support reservations (book a spot in advance)?** Add a `Reservation` entity with a `reserved_until` timestamp; `free_spots_for()` also excludes spots with an active, non-expired reservation; on arrival, `park_vehicle()` checks for a matching reservation first before running the normal allocation strategy.

---

## 12. Interview Q&A

**Q: Why make `ParkingSpot` an abstract class hierarchy instead of one class with a `spot_type` field?**
Answer: Behavior differs per type — `can_fit()` rules and (for EV spots) charging operations are naturally polymorphic. A single class with a `spot_type` enum pushes that logic into conditionals scattered across the codebase, violating OCP: adding a new spot type would mean editing existing `if/elif` blocks instead of adding a new subclass.

**Q: Why use the Strategy pattern for spot allocation instead of hardcoding "nearest spot" logic in `ParkingLot`?**
Answer: Allocation policy is a classic point of interview follow-up variation ("what if we want best-fit instead of nearest?"). Extracting it as `SpotAllocationStrategy` means `ParkingLot` never changes when the policy changes — new strategies are added, old code is untouched, satisfying Open/Closed.

**Q: How do you prevent two vehicles from being assigned the same spot concurrently?**
Answer: `ParkingSpot.occupy()` performs an atomic check-and-set under a per-spot lock. Even if two threads read the spot as free at the same instant, only one `occupy()` call can flip `is_free` from `True` to `False`; the loser gets `False` back and must re-run allocation. This is cheaper than a single global lock across the whole `park_vehicle()` call.

**Q: Why is `ParkingLot` often modeled as a Singleton, and is that a good idea?**
Answer: A physical parking lot naturally maps to one logical instance in the app, so Singleton is intuitive. In interviews it's fine to mention it, but flag the trade-off: Singletons introduce global state, hurt unit-testability, and hide dependencies. A safer alternative is a single instance created once by the composition root and passed via dependency injection everywhere it's needed.

**Q: How would you compute the parking fee, and where should that logic live?**
Answer: In a `PricingStrategy` interface with a `calculate_fee(vehicle_type, duration_hours)` method, injected into `ParkingLot`/`ExitPanel`. This keeps fee logic swappable (flat-rate, tiered, weekday/weekend, surge) without touching `ExitPanel`'s control flow — it just calls the strategy.

**Q: What's the difference in responsibility between `Floor` and `ParkingLot`?**
Answer: `Floor` is a pure container that answers "which of my spots are free and fit this vehicle" — a local query. `ParkingLot` is the orchestrator: it owns all floors, delegates the actual spot search to a `SpotAllocationStrategy` (which may scan multiple floors), and coordinates ticket issuance and fee calculation. Keeping `Floor` dumb avoids duplicating allocation policy logic per floor.
