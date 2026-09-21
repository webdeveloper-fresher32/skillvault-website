# Elevator System — Design Walkthrough

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
- A building has **multiple elevators** serving **multiple floors**.
- A person on a floor can press an **external request**: up or down.
- A person inside an elevator can press an **internal request**: a target floor.
- A central **controller** decides which elevator services which external request.
- Each elevator door opens/closes at stops.

### Out of Scope
- Weight-limit/overload sensors.
- Fire/emergency override modes.
- Multiple elevator banks serving different floor ranges (express vs. local) — mention as
  a follow-up extension, not core scope.

### Non-Functional Requirements
- Requests must be served with **reasonable wait time** and **without starvation** — a
  request in one direction shouldn't be ignored indefinitely while the elevator keeps
  serving the opposite direction.
- The scheduling algorithm should be **swappable** — interviewers often ask you to compare
  naive FCFS against SCAN/LOOK, so the controller shouldn't hardcode one.

---

## 2. Step 2: Identify Entities

| Entity | Represents |
|--------|-----------|
| `Elevator` | A single car — current floor, direction, state, its own request queue |
| `ElevatorController` | Central dispatcher — receives all requests, assigns them to elevators |
| `Request` | A single request: either external (floor + direction) or internal (target floor) |
| `Floor` | A building floor with up/down call buttons |
| `Door` | An elevator's door — open/closed |
| `Direction` | Enum: `UP`, `DOWN`, `IDLE` |
| `ElevatorState` | The state pattern hook: `Idle`, `Moving`, `DoorOpen` |

---

## 3. Step 3: Define Relationships

```
ElevatorController "1" ────── "*" Elevator     (association — controller manages, doesn't own the cars)
Elevator           "1" ────── "1" Door         (composition)
Elevator           "1" ────── "*" Request      (composition — its own pending stop queue)
ElevatorController "1" ────── "*" Request      (association — incoming external requests before assignment)
Building           "1" ────── "*" Floor        (composition)
Floor              "1" ────── "2" Button       (composition — up button, down button)
Elevator           "1" ────── "1" ElevatorState (association — current state object, swapped at runtime)
```

---

## 4. Step 4: Assign Responsibilities

| Class | Responsibilities |
|-------|-------------------|
| `ElevatorController` | Receive external requests; run the scheduling algorithm to pick an elevator; forward the request to that elevator's queue |
| `Elevator` | Track current floor, direction, door state; maintain its own sorted stop queue; move one floor per tick; open/close door at stops |
| `SchedulingStrategy` | Decide *which* elevator is best for a given external request (kept OUT of `ElevatorController`'s core loop — pluggable) |
| `ElevatorState` (and subclasses `IdleState`, `MovingState`, `DoorOpenState`) | Define what actions are valid in the current state and what the next state is |
| `Request` | Hold source floor, target floor (for internal), and direction (for external) |
| `Door` | Open/close, report state |

---

## 5. Step 5: Apply SOLID

| Principle | Applied how |
|-----------|-------------|
| **SRP** | `Elevator` manages its own motion and queue; it does NOT decide which elevator among many should take a new external request — that's `SchedulingStrategy`'s job via `ElevatorController` |
| **OCP** | New scheduling algorithms (FCFS, SCAN/LOOK, zone-based) are new `SchedulingStrategy` implementations — `ElevatorController.dispatch()` is unchanged |
| **LSP** | Every `ElevatorState` subclass implements `handle_request()` and `step()` with the same signatures; the `Elevator` context can hold any state object interchangeably without type-checking which one it has |
| **ISP** | `SchedulingStrategy` exposes one method, `select_elevator(request, elevators) -> Elevator` — callers aren't forced to depend on unrelated maintenance/diagnostics methods |
| **DIP** | `ElevatorController` depends on the `SchedulingStrategy` interface, injected at construction — not a concrete `ScanSchedulingStrategy` |

---

## 6. Step 6: Apply Design Patterns

### State — Elevator Lifecycle

**Problem it solves:** an elevator's valid actions depend entirely on what it's currently
doing — you can't open the door while moving, and you shouldn't accept a new internal
floor request while the door is open at the wrong floor. Without State, this becomes a
tangle of boolean flags (`is_moving`, `is_door_open`, ...) and nested `if`s.

```java
import java.util.*;
import java.util.concurrent.ConcurrentSkipListSet;

public enum Direction {
    UP,
    DOWN,
    IDLE
}

public interface ElevatorState {
    void step(Elevator elevator);
    void addRequest(Elevator elevator, int floor);
}

public class IdleState implements ElevatorState {
    @Override
    public void step(Elevator elevator) {
        // Nothing to do until a request arrives
    }

    @Override
    public void addRequest(Elevator elevator, int floor) {
        elevator.getStopQueue().add(floor);
        if (floor != elevator.getCurrentFloor()) {
            elevator.setDirection(floor > elevator.getCurrentFloor() ? Direction.UP : Direction.DOWN);
            elevator.setState(new MovingState());
        } else {
            elevator.setState(new DoorOpenState());
        }
    }
}

public class MovingState implements ElevatorState {
    @Override
    public void step(Elevator elevator) {
        int nextFloor = elevator.getCurrentFloor() + (elevator.getDirection() == Direction.UP ? 1 : -1);
        elevator.setCurrentFloor(nextFloor);
        if (elevator.getStopQueue().contains(nextFloor)) {
            elevator.setState(new DoorOpenState());
        }
    }

    @Override
    public void addRequest(Elevator elevator, int floor) {
        elevator.getStopQueue().add(floor); // just enqueue; scheduling decides execution
    }
}

public class DoorOpenState implements ElevatorState {
    @Override
    public void step(Elevator elevator) {
        elevator.getStopQueue().remove(elevator.getCurrentFloor());
        elevator.getDoor().close();
        if (!elevator.getStopQueue().isEmpty()) {
            int current = elevator.getCurrentFloor();
            int nextFloor = elevator.getStopQueue().stream()
                .min(Comparator.comparingInt(f -> Math.abs(f - current)))
                .orElse(current);
            elevator.setDirection(nextFloor > current ? Direction.UP : Direction.DOWN);
            elevator.setState(new MovingState());
        } else {
            elevator.setDirection(Direction.IDLE);
            elevator.setState(new IdleState());
        }
    }

    @Override
    public void addRequest(Elevator elevator, int floor) {
        elevator.getStopQueue().add(floor);
    }
}

public class Door {
    private boolean isOpen = false;

    public void open() {
        this.isOpen = true;
    }

    public void close() {
        this.isOpen = false;
    }

    public boolean isOpen() {
        return isOpen;
    }
}

public class Elevator {
    private final String id;
    private final int totalFloors;
    private int currentFloor = 0;
    private Direction direction = Direction.IDLE;
    private final Door door = new Door();
    private final Set<Integer> stopQueue = new TreeSet<>();
    private ElevatorState state = new IdleState();

    public Elevator(String id, int totalFloors) {
        this.id = id;
        this.totalFloors = totalFloors;
    }

    public synchronized void setState(ElevatorState state) {
        this.state = state;
        if (state instanceof DoorOpenState) {
            this.door.open();
        }
    }

    public synchronized void addRequest(int floor) {
        state.addRequest(this, floor);
    }

    public synchronized void step() {
        state.step(this);
    }

    public String getId() { return id; }
    public int getTotalFloors() { return totalFloors; }
    public int getCurrentFloor() { return currentFloor; }
    public void setCurrentFloor(int floor) { this.currentFloor = floor; }
    public Direction getDirection() { return direction; }
    public void setDirection(Direction direction) { this.direction = direction; }
    public Door getDoor() { return door; }
    public Set<Integer> getStopQueue() { return stopQueue; }
    public ElevatorState getState() { return state; }
}
```

### Strategy — Scheduling Algorithm

**Problem it solves:** which elevator should answer a new external "floor 7, going down"
request is a genuinely swappable policy question — naive FCFS is simple but wasteful; a
SCAN/LOOK-informed choice reduces total wait time.

```java
import java.util.*;

public record Request(int floor, Direction direction) {}

public interface SchedulingStrategy {
    Elevator selectElevator(Request request, List<Elevator> elevators);
}

/**
 * Naive: always assign to whichever elevator is currently idle first,
 * or the first elevator found if none are idle. Simple but ignores distance
 * entirely, so it can send a far, busy elevator while a near, idle one exists.
 */
public class FCFSSchedulingStrategy implements SchedulingStrategy {
    @Override
    public Elevator selectElevator(Request request, List<Elevator> elevators) {
        if (elevators == null || elevators.isEmpty()) {
            throw new IllegalArgumentException("Elevator list cannot be empty");
        }
        for (Elevator elevator : elevators) {
            if (elevator.getDirection() == Direction.IDLE) {
                return elevator;
            }
        }
        return elevators.get(0);
    }
}

/**
 * SCAN/LOOK-informed: prefer an elevator already moving toward the
 * request in the same direction (it can pick up the request 'on the way'),
 * falling back to the nearest idle elevator, falling back to nearest overall.
 */
public class LookSchedulingStrategy implements SchedulingStrategy {
    @Override
    public Elevator selectElevator(Request request, List<Elevator> elevators) {
        if (elevators == null || elevators.isEmpty()) {
            throw new IllegalArgumentException("Elevator list cannot be empty");
        }

        // 1. Same direction and on the way
        Optional<Elevator> sameDirectionCandidate = elevators.stream()
            .filter(e -> e.getDirection() == request.direction() && isOnTheWay(e, request))
            .min(Comparator.comparingInt(e -> Math.abs(e.getCurrentFloor() - request.floor())));

        if (sameDirectionCandidate.isPresent()) {
            return sameDirectionCandidate.get();
        }

        // 2. Idle elevators
        Optional<Elevator> idleCandidate = elevators.stream()
            .filter(e -> e.getDirection() == Direction.IDLE)
            .min(Comparator.comparingInt(e -> Math.abs(e.getCurrentFloor() - request.floor())));

        if (idleCandidate.isPresent()) {
            return idleCandidate.get();
        }

        // 3. Nearest overall
        return elevators.stream()
            .min(Comparator.comparingInt(e -> Math.abs(e.getCurrentFloor() - request.floor())))
            .orElse(elevators.get(0));
    }

    private boolean isOnTheWay(Elevator elevator, Request request) {
        if (elevator.getDirection() == Direction.UP) {
            return elevator.getCurrentFloor() <= request.floor();
        }
        if (elevator.getDirection() == Direction.DOWN) {
            return elevator.getCurrentFloor() >= request.floor();
        }
        return false;
    }
}

public class ElevatorController {
    private final List<Elevator> elevators;
    private final SchedulingStrategy strategy; // injected — swappable at runtime (DIP)

    public ElevatorController(List<Elevator> elevators, SchedulingStrategy strategy) {
        this.elevators = elevators;
        this.strategy = strategy;
    }

    public synchronized void dispatch(Request request) {
        Elevator chosen = strategy.selectElevator(request, elevators);
        chosen.addRequest(request.floor());
    }

    public synchronized void tick() {
        for (Elevator elevator : elevators) {
            elevator.step();
        }
    }

    public List<Elevator> getElevators() { return elevators; }
    public SchedulingStrategy getStrategy() { return strategy; }
}
```

### FCFS vs. SCAN/LOOK — Why It Matters

| Aspect | FCFS (naive) | SCAN/LOOK (direction-based) |
|--------|---------------|-------------------------------|
| Elevator selection | First idle car, or first car found | Car already heading toward the request in the right direction, preferred |
| Average wait time | Higher — can send a distant car while a nearer one is busy going the same way | Lower — "picks up on the way" |
| Starvation risk | Requests behind a busy queue can wait a long time | Still possible at extremes, but direction-aware ordering reduces it significantly |
| Implementation complexity | Very low | Moderate — needs direction + position awareness |
| Real-world analog | A dispatcher blindly cycling through a list | How real elevator banks and disk-arm schedulers actually work |

---

## 7. Step 7: Explain Extensibility

| New requirement | How the design absorbs it |
|------------------|----------------------------|
| Express elevators serving only floors 20–40 | `SchedulingStrategy` filters `elevators` by a `serviceable_floors` range before scoring — `Elevator`/`ElevatorController` core logic unchanged |
| Peak-hour "up-peak" mode (all elevators return to lobby) | A new `PeakModeSchedulingStrategy` — swapped in via the same `SchedulingStrategy` interface |
| Overload/weight sensor | `Elevator` gains a `reject_new_requests` flag checked in `add_request()`; `SchedulingStrategy` excludes such elevators |
| Emergency/fire override | Introduce an `EmergencyState` implementing `ElevatorState` that ignores all requests except "go to ground floor" — fits the existing State machine seam |
| Double-deck elevators | `Elevator` composes two `Door`/floor-offset pairs internally; `ElevatorController`/`SchedulingStrategy` contracts untouched |

---

## 8. Class Diagram

```
┌──────────────────────┐        ┌────────────┐
│  ElevatorController   │1──────*│  Elevator  │
│  + dispatch(request)  │        │ current_floor
│  + tick()              │        │ direction  │
└──────────┬─────────────┘        │ stop_queue │
           │                       └─────┬──────┘
           │ uses                        │1
           ▼                             ▼1
┌─────────────────────────┐        ┌───────────┐
│ SchedulingStrategy (ABC) │        │   Door    │
│ + select_elevator(...)   │        └───────────┘
└────────────▲──────────────┘
             │
   ┌─────────┴───────────┐
   │ FCFSSchedulingStrategy│
   │ LookSchedulingStrategy│
   └───────────────────────┘

┌──────────────────┐
│ ElevatorState(ABC)│
│ + step(elevator)   │
│ + add_request(...)│
└─────────▲──────────┘
          │
 ┌────────┼─────────┐
 │        │          │
IdleState MovingState DoorOpenState
```

---

## 9. Key Decisions

- **Why State pattern instead of an `is_moving` / `is_door_open` boolean pair on
  `Elevator`?** Booleans multiply combinatorially as states grow (what does
  `is_moving=True, is_door_open=True` even mean?) and every method needs to check both.
  State pattern makes illegal combinations unrepresentable — you're always in exactly one
  state object.
- **Why is scheduling a Strategy separate from `ElevatorController.dispatch()`?**
  Scheduling algorithms are frequently benchmarked/replaced in real systems and in
  interviews you're often explicitly asked to compare two — a hardcoded algorithm would
  require rewriting `dispatch()` itself each time.
- **Why does `stop_queue` use a `set[int]` rather than a `list`/`Queue`?** Multiple
  requests for the same floor (two people call "up" from floor 5) shouldn't produce
  duplicate stops; a set also makes "nearest stop" selection trivial with `min(...,
  key=...)`.
- **Why is `Door` its own class instead of a boolean on `Elevator`?** In a fuller design,
  `Door` would own its own timing/sensor logic (auto-close after N seconds, obstruction
  detection) — giving it its own class leaves room to grow without bloating `Elevator`.

---

## 10. Interview Follow-ups

- "How do you avoid starvation under LOOK scheduling?" → Discuss adding an aging factor:
  requests waiting beyond a threshold get priority-boosted so they're picked even if not
  strictly "on the way."
- "How would multiple controllers coordinate if elevators are grouped into banks?" →
  Each bank gets its own `ElevatorController` instance; a higher-level dispatcher routes
  a request to the correct bank based on floor range — composition, not new base classes.
- "What data structure would you use for `stop_queue` if you needed strict SCAN
  ordering (not just nearest-first)?" → Two sorted structures (or a single balanced
  structure) split by direction — floors-above sorted ascending, floors-below sorted
  descending — so the elevator "sweeps" rather than jumping to nearest ignoring direction.
- "How do internal requests (button pressed inside the car) interact with the state
  machine?" → They call the same `elevator.add_request(floor)` entry point as external
  ones; the `ElevatorState.add_request()` implementation doesn't care about the source,
  only the target floor — one seam, two callers.

---

## 11. Interview Q&A

**Q: Why use the State design pattern for an elevator instead of a status enum with if/else checks scattered through `Elevator`'s methods?**
Answer: With a plain enum, every method that behaves differently per state needs its own `if status == MOVING: ... elif status == DOOR_OPEN: ...` block, and it's easy to forget a case as states grow. The State pattern moves each state's behavior into its own class implementing a common interface (`step()`, `add_request()`), so `Elevator` just delegates to `self._state`. Adding a new state (like `EmergencyState`) means writing one new class, not hunting through every method of `Elevator` to add a branch.

**Q: Walk through the difference between FCFS and SCAN/LOOK scheduling and why it matters for average wait time.**
Answer: FCFS assigns the first idle (or first available) elevator regardless of position or direction, which can send a distant elevator across the building while a nearer one, already moving the right way, is ignored. SCAN/LOOK-style scheduling actively prefers an elevator that's already traveling toward the request in the matching direction, effectively letting it "pick up along the way." This mirrors disk-arm scheduling and measurably reduces average wait time, at the cost of a slightly more complex `select_elevator()` implementation that needs to reason about each elevator's current direction and position.

**Q: How does your design prevent an elevator from accepting an internal floor request while its door is open at the wrong floor?**
Answer: The current `ElevatorState` object gates what `add_request()` does — in `DoorOpenState`, a new request is simply queued (`stop_queue.add(floor)`) rather than acted on immediately; motion only resumes when `step()` transitions the elevator out of `DoorOpenState` into `MovingState` after the door closes. Because state transitions are centralized in each state class's `step()`/`add_request()`, there's no code path where the elevator both has its door open and is simultaneously moving.

**Q: Why is `SchedulingStrategy` injected into `ElevatorController` rather than being a static method or hardcoded logic?**
Answer: Dependency injection here means `ElevatorController` depends on the `SchedulingStrategy` abstraction (DIP), not a specific algorithm. This lets you swap `FCFSSchedulingStrategy` for `LookSchedulingStrategy` — or a future zone-based or peak-hour strategy — without modifying `ElevatorController.dispatch()`, and it makes each algorithm independently unit-testable by passing a controlled list of elevators and asserting which one gets chosen.

**Q: How would you extend this design to support "express" elevators that only serve floors 20 through 40?**
Answer: Give each `Elevator` a `serviceable_floors: range` attribute. The `SchedulingStrategy.select_elevator()` implementation filters the candidate `elevators` list down to those whose `serviceable_floors` contains `request.floor` before scoring them by direction/distance. No change is needed to `Elevator`'s internal state machine or to `ElevatorController.dispatch()` — the filtering is entirely inside the pluggable strategy, which is exactly the seam step 6 was designed to provide.

**Q: What's the risk of using a `list` for `Elevator.stop_queue` instead of a `set`, and why might even a `set` be insufficient for a strict SCAN implementation?**
Answer: A `list` can accumulate duplicate floor entries if multiple people request the same floor, and checking "is floor X already queued" is O(n) instead of O(1). A `set` fixes both, and works fine for a "nearest stop" heuristic like the one shown. However, a strict SCAN implementation needs ordered sweeps in each direction (all floors above, ascending; all floors below, descending) — for that, two sorted structures split by direction (or a balanced BST/sorted list) are more appropriate than a single unordered `set`, since you need to always serve the next floor in sweep order, not just the nearest one.
