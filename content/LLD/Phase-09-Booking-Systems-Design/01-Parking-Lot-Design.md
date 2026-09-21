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

## 9. Java Skeleton

```java
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

public enum VehicleType {
    MOTORCYCLE, CAR, TRUCK
}

public abstract class Vehicle {
    private final String licensePlate;

    public Vehicle(String licensePlate) {
        this.licensePlate = Objects.requireNonNull(licensePlate);
    }

    public String getLicensePlate() { return licensePlate; }
    public abstract VehicleType getVehicleType();
}

public class Motorcycle extends Vehicle {
    public Motorcycle(String licensePlate) { super(licensePlate); }
    @Override public VehicleType getVehicleType() { return VehicleType.MOTORCYCLE; }
}

public class Car extends Vehicle {
    public Car(String licensePlate) { super(licensePlate); }
    @Override public VehicleType getVehicleType() { return VehicleType.CAR; }
}

public class Truck extends Vehicle {
    public Truck(String licensePlate) { super(licensePlate); }
    @Override public VehicleType getVehicleType() { return VehicleType.TRUCK; }
}

public abstract class ParkingSpot {
    private final String spotId;
    private boolean isFree = true;
    private final ReentrantLock spotLock = new ReentrantLock();

    public ParkingSpot(String spotId) {
        this.spotId = spotId;
    }

    public abstract boolean canFit(Vehicle vehicle);

    public boolean occupy() {
        spotLock.lock();
        try {
            if (!isFree) return false;
            this.isFree = false;
            return true;
        } finally {
            spotLock.unlock();
        }
    }

    public void vacate() {
        spotLock.lock();
        try {
            this.isFree = true;
        } finally {
            spotLock.unlock();
        }
    }

    public String getSpotId() { return spotId; }
    public boolean isFree() { return isFree; }
}

public class MotorcycleSpot extends ParkingSpot {
    public MotorcycleSpot(String spotId) { super(spotId); }
    @Override public boolean canFit(Vehicle vehicle) {
        return vehicle.getVehicleType() == VehicleType.MOTORCYCLE;
    }
}

public class CompactSpot extends ParkingSpot {
    public CompactSpot(String spotId) { super(spotId); }
    @Override public boolean canFit(Vehicle vehicle) {
        return vehicle.getVehicleType() == VehicleType.MOTORCYCLE || vehicle.getVehicleType() == VehicleType.CAR;
    }
}

public class LargeSpot extends ParkingSpot {
    public LargeSpot(String spotId) { super(spotId); }
    @Override public boolean canFit(Vehicle vehicle) {
        return true; // Large fits Motorcycle, Car, or Truck
    }
}

public class ElectricSpot extends CompactSpot {
    public ElectricSpot(String spotId) { super(spotId); }
    public void startCharging() { System.out.println("EV charging started on spot " + getSpotId()); }
    public void stopCharging() { System.out.println("EV charging stopped on spot " + getSpotId()); }
}

public class Floor {
    private final int level;
    private final List<ParkingSpot> spots;

    public Floor(int level, List<ParkingSpot> spots) {
        this.level = level;
        this.spots = new ArrayList<>(spots);
    }

    public List<ParkingSpot> freeSpotsFor(Vehicle vehicle) {
        return spots.stream().filter(s -> s.isFree() && s.canFit(vehicle)).toList();
    }

    public int getLevel() { return level; }
    public List<ParkingSpot> getSpots() { return Collections.unmodifiableList(spots); }
}

// --- Strategy: Allocation ---

public interface SpotAllocationStrategy {
    Optional<ParkingSpot> findSpot(List<Floor> floors, Vehicle vehicle);
}

public class NearestSpotStrategy implements SpotAllocationStrategy {
    @Override
    public Optional<ParkingSpot> findSpot(List<Floor> floors, Vehicle vehicle) {
        for (Floor floor : floors) {
            List<ParkingSpot> candidates = floor.freeSpotsFor(vehicle);
            if (!candidates.isEmpty()) {
                return Optional.of(candidates.get(0));
            }
        }
        return Optional.empty();
    }
}

public class BestFitStrategy implements SpotAllocationStrategy {
    @Override
    public Optional<ParkingSpot> findSpot(List<Floor> floors, Vehicle vehicle) {
        return floors.stream()
            .flatMap(f -> f.freeSpotsFor(vehicle).stream())
            .min(Comparator.comparingInt(this::getSpotRank));
    }

    private int getSpotRank(ParkingSpot spot) {
        if (spot instanceof MotorcycleSpot) return 0;
        if (spot instanceof CompactSpot) return 1;
        return 2; // LargeSpot
    }
}

// --- Strategy: Pricing ---

public interface PricingStrategy {
    double calculateFee(VehicleType type, double durationHours);
}

public class HourlyPricingStrategy implements PricingStrategy {
    private final Map<VehicleType, Double> rates = Map.of(
        VehicleType.MOTORCYCLE, 10.0,
        VehicleType.CAR, 20.0,
        VehicleType.TRUCK, 30.0
    );

    @Override
    public double calculateFee(VehicleType type, double durationHours) {
        long hours = (long) Math.ceil(durationHours);
        return rates.getOrDefault(type, 20.0) * Math.max(1, hours);
    }
}

public record Payment(double amount, String method, String status) {}

public class Ticket {
    private final String ticketId;
    private final Vehicle vehicle;
    private final ParkingSpot spot;
    private final Instant entryTime;
    private Payment payment;

    public Ticket(Vehicle vehicle, ParkingSpot spot) {
        this.ticketId = UUID.randomUUID().toString();
        this.vehicle = vehicle;
        this.spot = spot;
        this.entryTime = Instant.now();
    }

    public double durationHours(Instant exitTime) {
        long seconds = Duration.between(entryTime, exitTime).getSeconds();
        return Math.max(0.1, seconds / 3600.0);
    }

    public String getTicketId() { return ticketId; }
    public Vehicle getVehicle() { return vehicle; }
    public ParkingSpot getSpot() { return spot; }
    public void setPayment(Payment payment) { this.payment = payment; }
    public Payment getPayment() { return payment; }
}

public class ParkingLot {
    private final List<Floor> floors;
    private final SpotAllocationStrategy allocationStrategy;
    private final PricingStrategy pricingStrategy;
    private final Map<String, Ticket> activeTickets = new ConcurrentHashMap<>();
    private final ReentrantLock lotLock = new ReentrantLock();

    public ParkingLot(List<Floor> floors, SpotAllocationStrategy allocation, PricingStrategy pricing) {
        this.floors = new ArrayList<>(floors);
        this.allocationStrategy = allocation;
        this.pricingStrategy = pricing;
    }

    public Ticket parkVehicle(Vehicle vehicle) {
        lotLock.lock();
        try {
            ParkingSpot spot = allocationStrategy.findSpot(floors, vehicle)
                .orElseThrow(() -> new IllegalStateException("Parking lot full for vehicle type: " + vehicle.getVehicleType()));

            if (!spot.occupy()) {
                throw new IllegalStateException("Failed to occupy spot");
            }

            Ticket ticket = new Ticket(vehicle, spot);
            activeTickets.put(ticket.getTicketId(), ticket);
            return ticket;
        } finally {
            lotLock.unlock();
        }
    }

    public Payment unparkVehicle(String ticketId, String paymentMethod) {
        Ticket ticket = activeTickets.remove(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("Invalid ticket ID");
        }

        double duration = ticket.durationHours(Instant.now());
        double fee = pricingStrategy.calculateFee(ticket.getVehicle().getVehicleType(), duration);
        Payment payment = new Payment(fee, paymentMethod, "PAID");
        ticket.setPayment(payment);
        ticket.getSpot().vacate();
        return payment;
    }
}

public class EntryPanel {
    private final ParkingLot lot;
    public EntryPanel(ParkingLot lot) { this.lot = lot; }
    public Ticket issueTicket(Vehicle vehicle) { return lot.parkVehicle(vehicle); }
}

public class ExitPanel {
    private final ParkingLot lot;
    public ExitPanel(ParkingLot lot) { this.lot = lot; }
    public Payment processExit(String ticketId, String paymentMethod) {
        return lot.unparkVehicle(ticketId, paymentMethod);
    }
}
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
