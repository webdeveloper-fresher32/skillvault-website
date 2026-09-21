# Project 1 — Parking Lot System

**Difficulty:** Medium
**Patterns used:** Strategy (spot allocation), Enum (vehicle/spot types), Composition

---

## 1. Requirements

**Functional:**
- The parking lot has multiple floors. Each floor has parking spots of different sizes: `MOTORCYCLE`, `COMPACT`, `LARGE`.
- Vehicles are one of `MOTORCYCLE`, `CAR`, `TRUCK`. A vehicle can only park in a spot whose size can accommodate it (a motorcycle can use any spot, a car needs `COMPACT` or `LARGE`, a truck needs `LARGE`).
- On entry, the system finds an available spot, assigns it, and issues a `Ticket` with entry time.
- On exit, the system calculates the fee based on duration, frees the spot, and generates a `Payment`.
- The system should report real-time availability per floor/spot-size.

**Non-functional:**
- Spot allocation strategy should be swappable (nearest-first, first-available, etc.) without changing core parking logic.
- Thread-safety is out of scope for this exercise (noted as an extension).

---

## 2. Class Diagram

```
                       ┌───────────────────┐
                       │    ParkingLot     │
                       │───────────────────│
                       │ - floors: List     │
                       │ - active_tickets   │
                       │ - allocator        │──────────┐
                       │───────────────────│           │
                       │ + park_vehicle()   │           ▼
                       │ + unpark_vehicle() │   ┌──────────────────────┐
                       └─────────┬─────────┘   │ «interface»          │
                                 │ 1..*         │ SpotAllocationStrategy│
                                 ▼              │──────────────────────│
                       ┌───────────────────┐    │ + find_spot()        │
                       │      Floor        │    └──────────┬───────────┘
                       │───────────────────│               │ implements
                       │ - floor_number     │      ┌────────┴─────────┐
                       │ - spots: List      │      │ FirstAvailable   │
                       └─────────┬─────────┘      │ Strategy         │
                                 │ 1..*             └──────────────────┘
                                 ▼
                       ┌───────────────────┐        ┌───────────────┐
                       │   ParkingSpot     │◀──────▶│    Vehicle    │
                       │───────────────────│  1  0..1│───────────────│
                       │ - spot_id         │        │ - plate        │
                       │ - size: SpotSize  │        │ - type: VehicleType │
                       │ - vehicle         │        └───────────────┘
                       └───────────────────┘

                       ┌───────────────────┐        ┌───────────────┐
                       │      Ticket       │───────▶│    Payment    │
                       │───────────────────│  1   1 │───────────────│
                       │ - ticket_id        │        │ - amount       │
                       │ - entry_time       │        │ - paid_at      │
                       │ - spot, vehicle    │        └───────────────┘
                       └───────────────────┘
```

---

## 3. Full Implementation

```java
/**
 * Parking Lot — single-file runnable LLD reference implementation in Java.
 * Run directly with: java ParkingLotDemo.java
 */

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

enum VehicleType {
    MOTORCYCLE,
    CAR,
    TRUCK
}

enum SpotSize {
    MOTORCYCLE(0),
    COMPACT(1),
    LARGE(2);

    private final int rank;
    SpotSize(int rank) { this.rank = rank; }
    public int getRank() { return rank; }

    public static SpotSize minSpotFor(VehicleType type) {
        return switch (type) {
            case MOTORCYCLE -> MOTORCYCLE;
            case CAR -> COMPACT;
            case TRUCK -> LARGE;
        };
    }

    public boolean canFit(VehicleType type) {
        return this.rank >= minSpotFor(type).getRank();
    }
}

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

record Vehicle(String plate, VehicleType type) {}

class ParkingSpot {
    private final String spotId;
    private final SpotSize size;
    private Vehicle vehicle;

    public ParkingSpot(String spotId, SpotSize size) {
        this.spotId = spotId;
        this.size = size;
    }

    public synchronized boolean isFree() {
        return vehicle == null;
    }

    public synchronized void assign(Vehicle vehicle) {
        if (!isFree()) {
            throw new IllegalStateException("Spot " + spotId + " is already occupied");
        }
        this.vehicle = vehicle;
    }

    public synchronized void vacate() {
        this.vehicle = null;
    }

    public String getSpotId() { return spotId; }
    public SpotSize getSize() { return size; }
    public Vehicle getVehicle() { return vehicle; }

    @Override
    public String toString() {
        String state = (vehicle != null) ? vehicle.plate() : "empty";
        return "Spot(" + spotId + ", " + size + ", " + state + ")";
    }
}

class Floor {
    private final int floorNumber;
    private final List<ParkingSpot> spots;

    public Floor(int floorNumber, List<ParkingSpot> spots) {
        this.floorNumber = floorNumber;
        this.spots = spots;
    }

    public List<ParkingSpot> availableSpots(VehicleType vehicleType) {
        return spots.stream()
            .filter(s -> s.isFree() && s.getSize().canFit(vehicleType))
            .collect(Collectors.toList());
    }

    public Map<SpotSize, Long> availabilitySummary() {
        Map<SpotSize, Long> summary = new EnumMap<>(SpotSize.class);
        for (SpotSize size : SpotSize.values()) {
            summary.put(size, 0L);
        }
        for (ParkingSpot s : spots) {
            if (s.isFree()) {
                summary.put(s.getSize(), summary.get(s.getSize()) + 1);
            }
        }
        return summary;
    }

    public int getFloorNumber() { return floorNumber; }
    public List<ParkingSpot> getSpots() { return Collections.unmodifiableList(spots); }
}

record Payment(double amount, LocalDateTime paidAt) {
    public Payment(double amount) {
        this(amount, LocalDateTime.now());
    }
}

class Ticket {
    private final String ticketId;
    private final Vehicle vehicle;
    private final ParkingSpot spot;
    private final LocalDateTime entryTime;
    private LocalDateTime exitTime;
    private Payment payment;

    public Ticket(String ticketId, Vehicle vehicle, ParkingSpot spot, LocalDateTime entryTime) {
        this.ticketId = ticketId;
        this.vehicle = vehicle;
        this.spot = spot;
        this.entryTime = entryTime;
    }

    public String getTicketId() { return ticketId; }
    public Vehicle getVehicle() { return vehicle; }
    public ParkingSpot getSpot() { return spot; }
    public LocalDateTime getEntryTime() { return entryTime; }
    public LocalDateTime getExitTime() { return exitTime; }
    public void setExitTime(LocalDateTime exitTime) { this.exitTime = exitTime; }
    public Payment getPayment() { return payment; }
    public void setPayment(Payment payment) { this.payment = payment; }
}

// ---------------------------------------------------------------------------
// Strategy: spot allocation
// ---------------------------------------------------------------------------

interface SpotAllocationStrategy {
    Optional<ParkingSpot> findSpot(List<Floor> floors, VehicleType vehicleType);
}

class FirstAvailableStrategy implements SpotAllocationStrategy {
    @Override
    public Optional<ParkingSpot> findSpot(List<Floor> floors, VehicleType vehicleType) {
        List<Floor> sortedFloors = new ArrayList<>(floors);
        sortedFloors.sort(Comparator.comparingInt(Floor::getFloorNumber));

        for (Floor floor : sortedFloors) {
            List<ParkingSpot> candidates = floor.availableSpots(vehicleType);
            if (!candidates.isEmpty()) {
                // Prefer tightest-fitting spot to save larger spots for vehicles that need them
                candidates.sort(Comparator.comparingInt(s -> s.getSize().getRank()));
                return Optional.of(candidates.get(0));
            }
        }
        return Optional.empty();
    }
}

// ---------------------------------------------------------------------------
// Rate calculation & ParkingLot Facade
// ---------------------------------------------------------------------------

class FeeCalculator {
    private static final Map<SpotSize, Double> HOURLY_RATE = Map.of(
        SpotSize.MOTORCYCLE, 1.0,
        SpotSize.COMPACT, 2.0,
        SpotSize.LARGE, 3.5
    );

    public static double calculateFee(ParkingSpot spot, LocalDateTime entryTime, LocalDateTime exitTime) {
        Duration duration = Duration.between(entryTime, exitTime);
        long seconds = Math.max(0, duration.getSeconds());
        long hours = Math.max(1, (seconds + 3599) / 3600); // ceil to next hour, min 1
        double rate = HOURLY_RATE.getOrDefault(spot.getSize(), 2.0);
        return Math.round(hours * rate * 100.0) / 100.0;
    }
}

class ParkingLot {
    private final List<Floor> floors;
    private final SpotAllocationStrategy allocator;
    private final Map<String, Ticket> activeTickets = new ConcurrentHashMap<>();
    private final AtomicInteger ticketCounter = new AtomicInteger(1);

    public ParkingLot(List<Floor> floors, SpotAllocationStrategy allocator) {
        this.floors = floors;
        this.allocator = allocator != null ? allocator : new FirstAvailableStrategy();
    }

    public ParkingLot(List<Floor> floors) {
        this(floors, new FirstAvailableStrategy());
    }

    public synchronized Ticket parkVehicle(Vehicle vehicle, LocalDateTime entryTime) {
        ParkingSpot spot = allocator.findSpot(floors, vehicle.type())
            .orElseThrow(() -> new IllegalStateException("No available spot for " + vehicle.type()));

        spot.assign(vehicle);
        String ticketId = String.format("T-%04d", ticketCounter.getAndIncrement());
        Ticket ticket = new Ticket(ticketId, vehicle, spot, entryTime != null ? entryTime : LocalDateTime.now());
        activeTickets.put(ticket.getTicketId(), ticket);
        return ticket;
    }

    public Ticket parkVehicle(Vehicle vehicle) {
        return parkVehicle(vehicle, LocalDateTime.now());
    }

    public synchronized Payment unparkVehicle(String ticketId, LocalDateTime exitTime) {
        Ticket ticket = activeTickets.get(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("Unknown or already-closed ticket: " + ticketId);
        }

        LocalDateTime actualExit = exitTime != null ? exitTime : LocalDateTime.now();
        ticket.setExitTime(actualExit);
        double fee = FeeCalculator.calculateFee(ticket.getSpot(), ticket.getEntryTime(), actualExit);
        Payment payment = new Payment(fee);
        ticket.setPayment(payment);

        ticket.getSpot().vacate();
        activeTickets.remove(ticketId);
        return payment;
    }

    public Payment unparkVehicle(String ticketId) {
        return unparkVehicle(ticketId, LocalDateTime.now());
    }

    public void displayAvailability() {
        for (Floor floor : floors) {
            Map<SpotSize, Long> summary = floor.availabilitySummary();
            String readable = summary.entrySet().stream()
                .map(e -> e.getKey().name() + ": " + e.getValue())
                .collect(Collectors.joining(", "));
            System.out.println("  Floor " + floor.getFloorNumber() + " -> " + readable);
        }
    }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

public class ParkingLotDemo {
    public static ParkingLot buildSampleLot() {
        Floor floor1 = new Floor(1, List.of(
            new ParkingSpot("F1-M1", SpotSize.MOTORCYCLE),
            new ParkingSpot("F1-C1", SpotSize.COMPACT),
            new ParkingSpot("F1-C2", SpotSize.COMPACT),
            new ParkingSpot("F1-L1", SpotSize.LARGE)
        ));
        Floor floor2 = new Floor(2, List.of(
            new ParkingSpot("F2-C1", SpotSize.COMPACT),
            new ParkingSpot("F2-L1", SpotSize.LARGE),
            new ParkingSpot("F2-L2", SpotSize.LARGE)
        ));
        return new ParkingLot(List.of(floor1, floor2), new FirstAvailableStrategy());
    }

    public static void main(String[] args) {
        ParkingLot lot = buildSampleLot();

        System.out.println("Initial availability:");
        lot.displayAvailability();

        Vehicle bike = new Vehicle("MH-01-AA-1111", VehicleType.MOTORCYCLE);
        Vehicle car = new Vehicle("MH-01-BB-2222", VehicleType.CAR);
        Vehicle truck = new Vehicle("MH-01-CC-3333", VehicleType.TRUCK);

        Ticket t1 = lot.parkVehicle(bike);
        Ticket t2 = lot.parkVehicle(car);
        Ticket t3 = lot.parkVehicle(truck);

        System.out.println("
Issued tickets: " + t1.getTicketId() + " (" + t1.getSpot().getSpotId() + "), "
            + t2.getTicketId() + " (" + t2.getSpot().getSpotId() + "), "
            + t3.getTicketId() + " (" + t3.getSpot().getSpotId() + ")");

        System.out.println("
Availability after parking 3 vehicles:");
        lot.displayAvailability();

        // Simulate the car staying for 2.5 hours
        LocalDateTime exitTime = t2.getEntryTime().plusHours(2).plusMinutes(30);
        Payment payment = lot.unparkVehicle(t2.getTicketId(), exitTime);
        System.out.printf("
%s exited. Fee charged: $%.2f
", car.plate(), payment.amount());

        System.out.println("
Availability after car exits:");
        lot.displayAvailability();
    }
}
```

**Expected output (abridged, entry times use `datetime.now()` so exact timestamps vary):**

```
Initial availability:
  Floor 1 -> MOTORCYCLE: 1, COMPACT: 2, LARGE: 1
  Floor 2 -> MOTORCYCLE: 0, COMPACT: 1, LARGE: 2

Issued tickets: T-0001 (F1-M1), T-0002 (F1-C1), T-0003 (F1-L1)

Availability after parking 3 vehicles:
  Floor 1 -> MOTORCYCLE: 0, COMPACT: 1, LARGE: 0
  Floor 2 -> MOTORCYCLE: 0, COMPACT: 1, LARGE: 2

MH-01-BB-2222 exited. Fee charged: $6.00

Availability after car exits:
  Floor 1 -> MOTORCYCLE: 0, COMPACT: 2, LARGE: 0
  Floor 2 -> MOTORCYCLE: 0, COMPACT: 1, LARGE: 2
```

---

## 4. Design Decisions

- **Strategy pattern for allocation:** `SpotAllocationStrategy` is an ABC so the actual "which spot do I give this vehicle" algorithm (first-available, nearest-to-entrance, load-balanced-across-floors) is decoupled from `ParkingLot`. Swapping strategies is a one-line change (`ParkingLot(floors, allocator=NearestExitStrategy())`), with zero changes to `park_vehicle`/`unpark_vehicle`.
- **Enums for vehicle/spot types:** `VehicleType` and `SpotSize` are enums rather than strings to get compile-time-ish safety (no typos like `"compact "`), exhaustive `match`/dict lookups, and clear intent. The `SPOT_SIZE_RANK` mapping turns "can this spot fit this vehicle" into a simple integer comparison instead of a long if/elif chain.
- **Composition over inheritance:** `ParkingLot` *has* `Floor`s which *have* `ParkingSpot`s — no inheritance hierarchy needed since a floor isn't a "kind of" spot. This mirrors the real-world containment relationship and keeps each class small and testable in isolation.
- **Ticket as the source of truth for a session:** `ParkingLot` tracks `active_tickets` keyed by ID rather than scanning spots to find "which vehicle is where" — this makes `unpark_vehicle` O(1) instead of O(spots).

---

## 5. Possible Extensions

- **Multiple entry/exit gates:** Add an `EntryPanel`/`ExitPanel` class per physical gate; each calls into the same shared `ParkingLot`, and allocation strategy could favor spots nearest to the gate the vehicle entered from.
- **EV charging spots:** Add `SpotFeature` (e.g., `EV_CHARGING`) as a set attribute on `ParkingSpot` rather than a new `SpotSize`, and let the allocator take an optional `required_features` filter.
- **Monthly passes / subscriptions:** Add a `Subscription` entity linked to a vehicle plate; on entry, check for an active subscription before falling back to per-visit ticketing, and skip fee calculation in `unpark_vehicle` for subscribed vehicles.
- **Concurrency:** Wrap `assign`/`vacate` with a per-spot lock (or use an atomic "claim" compare-and-swap) so two simultaneous entries can't be allocated the same spot in a multi-threaded/multi-process deployment.
