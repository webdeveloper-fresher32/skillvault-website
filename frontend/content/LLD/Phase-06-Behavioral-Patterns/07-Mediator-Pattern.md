# 🧠 The Ultimate Guide to Mediator Pattern (LLD)

> **Core Philosophy:** *Define an object that encapsulates how a set of objects interact. Mediator promotes loose coupling by keeping objects from referring to each other explicitly, and it lets you vary their interaction independently.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [The Spaghetti Communication Mesh ($O(N^2)$ Problem)](#2-the-spaghetti-communication-mesh-on2-problem)
3. [The Core Architecture (The 4 Participants)](#3-the-core-architecture-the-4-participants)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Execution Flow: Star Topology Dispatch](#6-execution-flow-star-topology-dispatch)
7. [Side-by-Side Comparison: Direct Peer-to-Peer vs Mediator](#7-side-by-side-comparison-direct-peer-to-peer-vs-mediator)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: Airport Air Traffic Control (ATC) Tower ✈️ 🛬
Imagine an international airport with multiple commercial flights:
* Flight Boeing 777
* Flight Airbus A380
* Flight Cargo 747

Each plane needs to coordinate runway landings, takeoffs, and altitude holding patterns to prevent catastrophic mid-air collisions.

```
                          DIRECT PLANE-TO-PLANE MESH ❌
                               (Disaster waiting to happen!)
                                   Flight 777
                                  ▲    │    ▲
                                 ╱     │     ╲
                                ╱      │      ╲
                               ▼       ▼       ▼
                          Flight A380 ◄──────► Cargo 747
```

### The $O(N^2)$ Communication Nightmare
If airplanes talk directly to each other:
* Every airplane must maintain a radio connection to every other plane in the airspace.
* Adding 1 new aircraft requires connecting to all existing aircraft.
* Conflicting instructions: Who lands first if two planes negotiate at the same time?

---

## 2. The Spaghetti Communication Mesh ($O(N^2)$ Problem)

```
MESH TOPOLOGY (Without Mediator)         STAR TOPOLOGY (With Mediator)
        A ────── B                               A        B
       ╱ ╲      ╱ ╲                               ╲      ╱
      ╱   ╲    ╱   ╲                               ▼    ▼
     C ──── D ──── E                             [ ATC TOWER ]
                                                   ▲    ▲
                                                  ╱      ╲
                                                 C        D
  Connections = N(N - 1) / 2 = O(N²)          Connections = N = O(N)
```

By introducing an **Air Traffic Controller (ATC)**, planes never talk to each other directly. They report to the Tower, and the Tower coordinates the entire airspace!

---

## 3. The Core Architecture (The 4 Participants)

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│        <<interface>> AtcMediator     │       │       <<abstract>> Airplane          │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ + registerFlight(plane: Airplane)    │       │ # mediator : AtcMediator             │
│ + notifyLand(sender: Airplane)       │       │ - flightNumber : String              │
│ + notifyTakeoff(sender: Airplane)    │       ├──────────────────────────────────────┤
└──────────────────▲───────────────────┘       │ + requestLanding()                   │
                   │ implements                │ + receiveNotification(msg: String)   │
┌──────────────────┴───────────────────┐       └──────────────────▲───────────────────┘
│ Concrete Mediator (AirTrafficControl)│                          │ extends
│ - runwayOccupied : boolean           │                          │
│ - planesInAirspace : List<Airplane>  │       ┌──────────────────┴───────────────────┐
└──────────────────────────────────────┘       ▼                                      ▼
                                        ┌──────────────┐                       ┌──────────────┐
                                        │ BoeingFlight │                       │ AirbusFlight │
                                        └──────────────┘                       └──────────────┘
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: The Mediator Interface

```java
public interface AtcMediator {
    void registerFlight(Airplane plane);
    void requestLanding(Airplane sender);
    void requestTakeoff(Airplane sender);
}
```

---

### Step 2: The Colleague Base Class (Airplane)

```java
public abstract class Airplane {
    protected final AtcMediator mediator;
    protected final String flightCode;

    public Airplane(AtcMediator mediator, String flightCode) {
        this.mediator = mediator;
        this.flightCode = flightCode;
    }

    public String getFlightCode() { return flightCode; }

    public void requestLanding() {
        System.out.println("🛫 [" + flightCode + "]: Requesting landing clearance...");
        mediator.requestLanding(this);
    }

    public void requestTakeoff() {
        System.out.println("🛬 [" + flightCode + "]: Requesting takeoff clearance...");
        mediator.requestTakeoff(this);
    }

    public abstract void receiveNotice(String message);
}
```

---

### Step 3: Concrete Colleagues

```java
public class CommercialFlight extends Airplane {
    public CommercialFlight(AtcMediator mediator, String flightCode) {
        super(mediator, flightCode);
    }

    @Override
    public void receiveNotice(String message) {
        System.out.println("📢 Radio to [" + flightCode + "]: " + message);
    }
}
```

---

### Step 4: The Concrete Mediator (The Air Traffic Control Tower)

```java
import java.util.ArrayList;
import java.util.List;

public class AirportControlTower implements AtcMediator {
    private final List<Airplane> flights = new ArrayList<>();
    private boolean isRunwayFree = true;

    @Override
    public void registerFlight(Airplane plane) {
        flights.add(plane);
        System.out.println("📡 Radar: Flight " + plane.getFlightCode() + " entered airspace.");
    }

    @Override
    public void requestLanding(Airplane sender) {
        if (isRunwayFree) {
            isRunwayFree = false; // Lock runway
            sender.receiveNotice("CLEAR TO LAND on Runway 09L.");
            
            // Broadcast to other planes to hold patterns
            for (Airplane plane : flights) {
                if (plane != sender) {
                    plane.receiveNotice("ALERT: Runway occupied by " + sender.getFlightCode() + ". Maintain holding orbit.");
                }
            }
        } else {
            sender.receiveNotice("DENIED: Runway currently occupied. Enter 3000ft holding orbit!");
        }
    }

    @Override
    public void requestTakeoff(Airplane sender) {
        if (isRunwayFree) {
            sender.receiveNotice("CLEAR FOR TAKEOFF Runway 09R. Safe skies!");
        } else {
            sender.receiveNotice("HOLD SHORT: Runway is busy with an arriving aircraft.");
        }
    }

    public void vacateRunway(Airplane sender) {
        isRunwayFree = true;
        System.out.println("✅ Runway cleared by " + sender.getFlightCode() + "!");
    }
}
```

---

### Step 5: Client Usage

```java
public class Main {
    public static void main(String[] args) {
        AirportControlTower tower = new AirportControlTower();

        Airplane flight1 = new CommercialFlight(tower, "Emirates-EK202");
        Airplane flight2 = new CommercialFlight(tower, "Delta-DL404");

        tower.registerFlight(flight1);
        tower.registerFlight(flight2);

        System.out.println("\n--- Event 1: Emirates Requests Landing ---");
        flight1.requestLanding(); // Granted! Delta is notified to hold.

        System.out.println("\n--- Event 2: Delta Attempts Landing at Same Time ---");
        flight2.requestLanding(); // Denied by tower!

        System.out.println("\n--- Event 3: Emirates Finishes Taxiing ---");
        tower.vacateRunway(flight1);

        System.out.println("\n--- Event 4: Delta Re-attempts Landing ---");
        flight2.requestLanding(); // Now granted!
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│           <<interface>> AtcMediator          │
├──────────────────────────────────────────────┤
│ + registerFlight(plane: Airplane)            │
│ + requestLanding(sender: Airplane)           │
│ + requestTakeoff(sender: Airplane)           │
└──────────────────────▲───────────────────────┘
                       │ implements
┌──────────────────────┴───────────────────────┐       ┌──────────────────────────────────────┐
│             AirportControlTower              │       │        <<abstract>> Airplane         │
├──────────────────────────────────────────────┤       ├──────────────────────────────────────┤
│ - isRunwayFree : boolean                     │◄──────┤ # mediator : AtcMediator             │
│ - flights : List<Airplane>                   │HAS-A  │ - flightCode : String                │
├──────────────────────────────────────────────┤       ├──────────────────────────────────────┤
│ + requestLanding(sender)                     │       │ + requestLanding()                   │
└──────────────────────┬───────────────────────┘       │ + receiveNotice(msg: String)         │
                       │ coordinates                   └──────────────────▲───────────────────┘
                       ▼                                                  │ extends
               Airplane Colleague                      ┌──────────────────┴───────────────────┐
                                                       │           CommercialFlight           │
                                                       └──────────────────────────────────────┘
```

---

## 6. Execution Flow: Star Topology Dispatch

```
Flight1 (Emirates) calls requestLanding()
   │
   ├─► Delegates to mediator.requestLanding(this)
   │
AirportControlTower (Mediator)
   │
   ├─► Checks isRunwayFree == true
   ├─► Locks runway (isRunwayFree = false)
   ├─► Tells Emirates: "CLEAR TO LAND"
   │
   └─► Loops through colleagues:
          └─► Tells Delta: "HOLD ORBIT: Runway occupied!"
```

---

## 7. Side-by-Side Comparison: Direct Peer-to-Peer vs Mediator

| Metric | ❌ Direct Mesh Communication | ✅ With Mediator Pattern |
| :--- | :--- | :--- |
| **Complexity** | $O(N^2)$ exponential connection lines. | $O(N)$ clean star topology. |
| **Coupling** | Every class has hard references to 10 other classes. | Classes only know the single mediator interface. |
| **Reusability** | Impossible to reuse an airplane in a different airport. | Highly reusable; colleague classes have zero peer dependencies. |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* It's hard to change some of the classes because they are tightly coupled to a dozen of other classes.
* You can't reuse a component in a different program because it's too dependent on other components.
* Complex UI dialog forms with interdependent fields (changing dropdown X disables checkbox Y and validates textfield Z).

### ❌ When NOT to USE
* When you only have two or three components that communicate simply.
* Avoid letting the Mediator become a massive, omnipotent **God Object** that contains all application logic.

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* **Single Responsibility Principle:** Extracts communications between various components into a single place.
* **Open/Closed Principle:** Introduce new mediators without having to change the actual components.
* Reduces coupling between a set of colleagues.

### 🔴 Disadvantages
* Over time, a mediator can evolve into an unmaintainable **God Object**.

---

## 10. Real-World Everyday Examples

| Domain | Mediator | Colleagues Coordinated |
| :--- | :--- | :--- |
| 🪟 **UI Form Dialogs** | `RegistrationDialogMediator` | Submit Button, Password Field, Terms Checkbox |
| 💬 **Group Chat Rooms** | `ChatRoomServer` | Chat Users (Alice, Bob, Charlie) |
| ✈️ **Aviation** | `AirTrafficControlTower` | Passenger Jets, Cargo Planes, Helicopters |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Colleagues (Planes)} \xrightarrow{\text{communicate only through}} \text{Mediator (ATC Tower)} = \mathbf{Mediator\ Pattern}$$
