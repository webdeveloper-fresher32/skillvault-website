# Interface Segregation Principle (ISP) — Complete Guide

## Table of Contents
1. [What is ISP?](#1-what-is-isp)
2. [The Bad Example — A Fat Worker Interface](#2-the-bad-example--a-fat-worker-interface)
3. [The Good Example — Role Interfaces](#3-the-good-example--role-interfaces)
4. [A Second Example — Multi-Function Printer](#4-a-second-example--multi-function-printer)
5. [Why This Matters in Practice](#5-why-this-matters-in-practice)
6. [Common Misconceptions](#6-common-misconceptions)
7. [Interview-Style Exercise](#7-interview-style-exercise)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is ISP?

> **Clients should not be forced to depend on methods (interfaces) they do not use.**

Instead of one large, general-purpose interface, prefer several small, focused ones ("role interfaces"). A class then implements only the interfaces that describe capabilities it actually has, and client code depends only on the narrow interface it actually needs.

```
┌───────────────────────────────────────────────────────────┐
│  ISP in one picture                                          │
│                                                                │
│  Bad:  ┌─────────────────────┐                                │
│        │   Worker (fat)      │                                │
│        │  work()             │◄── every implementer forced    │
│        │  eat()              │    to implement ALL methods,   │
│        │  sleep()            │    even ones that make no      │
│        │  attend_meeting()   │    sense for it (e.g. a Robot   │
│        └─────────────────────┘    forced to implement eat())  │
│                                                                │
│  Good: Workable   Eatable   Sleepable   Meetable               │
│        (small, focused role interfaces — implement only        │
│         what applies to you)                                   │
└───────────────────────────────────────────────────────────┘
```

ISP is essentially SRP applied to interfaces: a "fat" interface bundles unrelated capabilities the same way a "god class" bundles unrelated responsibilities.

---

## 2. The Bad Example — A Fat Worker Interface

```python
from abc import ABC, abstractmethod


class Worker(ABC):
    """
    Smell: this interface bundles capabilities that not every
    kind of 'worker' actually has. A HumanWorker has all four,
    but a RobotWorker doesn't eat, sleep, or attend meetings —
    yet it's FORCED to provide (fake) implementations for them
    just to satisfy the interface.
    """

    @abstractmethod
    def work(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def eat(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def sleep(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def attend_meeting(self) -> str:
        raise NotImplementedError


class HumanWorker(Worker):
    def work(self) -> str:
        return "Writing code"

    def eat(self) -> str:
        return "Eating lunch"

    def sleep(self) -> str:
        return "Sleeping at night"

    def attend_meeting(self) -> str:
        return "Attending standup"


class RobotWorker(Worker):
    def work(self) -> str:
        return "Welding parts"

    def eat(self) -> str:
        # Forced to implement something meaningless.
        raise NotImplementedError("Robots don't eat")

    def sleep(self) -> str:
        raise NotImplementedError("Robots don't sleep")

    def attend_meeting(self) -> str:
        raise NotImplementedError("Robots don't attend meetings")


def start_lunch_break(worker: Worker) -> None:
    print(worker.eat())  # 💥 crashes for RobotWorker


workers = [HumanWorker(), RobotWorker()]
for w in workers:
    start_lunch_break(w)
```

### What Breaks / Why It's a Smell

| Problem | Consequence |
|---------|-------------|
| `RobotWorker` is forced to implement methods it has no real behavior for | Fake implementations that throw, log a no-op, or silently do nothing |
| Any code that depends on `Worker` risks calling a method a given implementer doesn't really support | Runtime crashes similar to LSP violations |
| Adding a new unrelated capability (e.g., `file_expense_report()`) forces every implementer, even ones that don't do that, to change | Interface bloat cascades to every implementing class |
| Client code that only needs `work()` still transitively depends on the entire fat interface | Tight coupling — the client is fragile to changes in methods it never even calls |

---

## 3. The Good Example — Role Interfaces

```python
from abc import ABC, abstractmethod
from typing import List


class Workable(ABC):
    @abstractmethod
    def work(self) -> str:
        raise NotImplementedError


class Eatable(ABC):
    @abstractmethod
    def eat(self) -> str:
        raise NotImplementedError


class Sleepable(ABC):
    @abstractmethod
    def sleep(self) -> str:
        raise NotImplementedError


class Meetable(ABC):
    @abstractmethod
    def attend_meeting(self) -> str:
        raise NotImplementedError


class HumanWorker(Workable, Eatable, Sleepable, Meetable):
    """A human genuinely has all four capabilities — implements all four."""

    def work(self) -> str:
        return "Writing code"

    def eat(self) -> str:
        return "Eating lunch"

    def sleep(self) -> str:
        return "Sleeping at night"

    def attend_meeting(self) -> str:
        return "Attending standup"


class RobotWorker(Workable):
    """A robot only implements the capability it actually has: work()."""

    def work(self) -> str:
        return "Welding parts"


def start_lunch_break(worker: Eatable) -> None:
    """Type signature itself guarantees every argument CAN eat."""
    print(worker.eat())


def run_daily_shift(worker: Workable) -> None:
    print(worker.work())


human = HumanWorker()
robot = RobotWorker()

run_daily_shift(human)   # ✅
run_daily_shift(robot)   # ✅
start_lunch_break(human)  # ✅
# start_lunch_break(robot)  # ❌ caught at type-check time —
#                                RobotWorker isn't Eatable, and that's correct!
```

### Why This Is Better

- `RobotWorker` is never forced to fake `eat()`, `sleep()`, or `attend_meeting()`.
- `start_lunch_break` can only ever be called with something that genuinely can eat — the type system enforces correctness instead of relying on runtime checks or exceptions.
- Adding a new role (e.g., `Trainable` for workers who attend training) only affects the classes that actually implement it — no cascading changes.

---

## 4. A Second Example — Multi-Function Printer

Another classic ISP scenario interviewers use:

```python
from abc import ABC, abstractmethod


# Bad: one fat interface
class MultiFunctionDevice(ABC):
    @abstractmethod
    def print_doc(self, doc: str) -> None: ...
    @abstractmethod
    def scan(self, doc: str) -> None: ...
    @abstractmethod
    def fax(self, doc: str) -> None: ...


class BasicPrinter(MultiFunctionDevice):
    def print_doc(self, doc: str) -> None:
        print(f"Printing: {doc}")

    def scan(self, doc: str) -> None:
        raise NotImplementedError("This printer can't scan")  # forced, fake

    def fax(self, doc: str) -> None:
        raise NotImplementedError("This printer can't fax")  # forced, fake


# Good: segregated role interfaces
class Printer(ABC):
    @abstractmethod
    def print_doc(self, doc: str) -> None: ...


class Scanner(ABC):
    @abstractmethod
    def scan(self, doc: str) -> None: ...


class Fax(ABC):
    @abstractmethod
    def fax(self, doc: str) -> None: ...


class BasicPrinter(Printer):
    def print_doc(self, doc: str) -> None:
        print(f"Printing: {doc}")


class AllInOnePrinter(Printer, Scanner, Fax):
    def print_doc(self, doc: str) -> None:
        print(f"Printing: {doc}")

    def scan(self, doc: str) -> None:
        print(f"Scanning: {doc}")

    def fax(self, doc: str) -> None:
        print(f"Faxing: {doc}")
```

---

## 5. Why This Matters in Practice

```
Fat interface:               Segregated interfaces:
Worker                       Workable  Eatable  Sleepable  Meetable
 ├─ work()                    │         │         │          │
 ├─ eat()      ◄── every      RobotWorker implements ONLY Workable
 ├─ sleep()        implementer HumanWorker implements ALL FOUR
 └─ attend_meeting()          
     forced to implement      Client code depends only on the
     ALL FOUR, even fakely    narrow interface it actually needs
```

ISP keeps coupling low: a client depending on `Eatable` is unaffected if `Meetable` gains a new method, because it never depended on `Meetable` in the first place. In large codebases this is the difference between a one-line, isolated change and a company-wide recompile/retest of every class that happened to implement the fat interface.

---

## 6. Common Misconceptions

- **"ISP means every interface should have exactly one method."** Not required — an interface can have several methods as long as they're all part of one cohesive role (e.g., `Eatable` could have both `eat()` and `is_hungry()`).
- **"ISP and SRP are the same thing."** They're closely related but apply to different things: SRP is about a *class's* reasons to change; ISP is about *interfaces* not forcing unrelated methods onto every implementer. A class can honor SRP internally while still depending on a bloated interface designed by someone else.
- **"Multiple inheritance in Python is dangerous, so role interfaces are impractical."** ABCs with only abstract methods (mixins with no state) are exactly the safe use case for Python's multiple inheritance — this is idiomatic and avoids the diamond-problem pitfalls of stateful multiple inheritance.

---

## 7. Interview-Style Exercise

**Prompt:** "Here's a `Vehicle` interface forcing every vehicle to support flying and swimming. Refactor it to follow ISP."

```python
from abc import ABC, abstractmethod


class Vehicle(ABC):
    @abstractmethod
    def drive(self) -> str: ...
    @abstractmethod
    def fly(self) -> str: ...
    @abstractmethod
    def swim(self) -> str: ...


class Car(Vehicle):
    def drive(self) -> str:
        return "Driving on the road"

    def fly(self) -> str:
        raise NotImplementedError("Cars can't fly")

    def swim(self) -> str:
        raise NotImplementedError("Cars can't swim")
```

**Refactored Answer:**

```python
from abc import ABC, abstractmethod


class Drivable(ABC):
    @abstractmethod
    def drive(self) -> str: ...


class Flyable(ABC):
    @abstractmethod
    def fly(self) -> str: ...


class Swimmable(ABC):
    @abstractmethod
    def swim(self) -> str: ...


class Car(Drivable):
    def drive(self) -> str:
        return "Driving on the road"


class FlyingCar(Drivable, Flyable):
    def drive(self) -> str:
        return "Driving on the road"

    def fly(self) -> str:
        return "Flying above traffic"


class AmphibiousCar(Drivable, Swimmable):
    def drive(self) -> str:
        return "Driving on the road"

    def swim(self) -> str:
        return "Cruising through water"


def take_road_trip(vehicle: Drivable) -> None:
    print(vehicle.drive())


take_road_trip(Car())          # ✅
take_road_trip(FlyingCar())    # ✅
```

Talking point: "each vehicle now only implements the capability roles it genuinely has — `Car` never has to fake `fly()` or `swim()`, and code depending on `Drivable` works with any of them uniformly."

---

## 8. Interview Q&A

**Q: What is the Interface Segregation Principle?**
Answer: ISP states that no client should be forced to depend on methods it doesn't use. Rather than one large general-purpose interface, you design several small, focused "role" interfaces, and each class implements only the ones that describe capabilities it genuinely has. This keeps implementers honest (no fake/no-op methods) and keeps clients loosely coupled to only the behavior they actually call.

**Q: What's a real-world sign that an interface violates ISP?**
Answer: When implementing classes have methods that raise `NotImplementedError`, log "not supported," or silently do nothing just to satisfy the interface contract. Another sign: a client class only ever calls one or two methods from a much larger interface — that's a sign the interface should be split so the client can depend on just the narrow slice it needs.

**Q: How is ISP different from the Single Responsibility Principle?**
Answer: SRP is about a class having a single reason to change — it's a statement about class cohesion. ISP is about interfaces not bundling unrelated capabilities that force implementers to support things they don't need — it's a statement about how contracts are shaped for clients and implementers. They're complementary: a fat interface with unrelated methods often exists because the underlying responsibilities weren't separated in the first place (an SRP issue reflected in the interface).

**Q: How does Python's multiple inheritance help implement ISP safely?**
Answer: Python allows a class to inherit from multiple ABCs, so a class like `HumanWorker(Workable, Eatable, Sleepable, Meetable)` can compose exactly the role interfaces it needs. Since these ABCs are typically stateless mixins (only abstract methods, no shared instance state), Python's MRO (method resolution order) handles this cleanly without the classic diamond-inheritance ambiguity that stateful multiple inheritance can cause.

**Q: Can ISP violations cause LSP violations?**
Answer: Yes, they often go together. If `RobotWorker` is forced to implement `eat()` from a fat `Worker` interface, it typically does so by raising an exception — which is also an LSP violation because `RobotWorker` no longer honors the base `Worker` contract's implied guarantee that `eat()` works. Segregating the interface (ISP) removes the need for the fake implementation, which also fixes the LSP violation.

**Q: Does ISP mean you should always split interfaces into the smallest possible pieces?**
Answer: No — split based on *cohesive roles that clients actually use differently*, not indiscriminately down to one method per interface. If two methods are always used together by every client and always implemented together by every class, keeping them in the same interface is fine and arguably clearer. The test is: "does any implementer or client need only a subset of these methods?" If yes, split; if no, don't over-fragment.
