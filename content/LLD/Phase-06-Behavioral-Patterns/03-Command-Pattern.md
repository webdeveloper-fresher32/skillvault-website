# Command Pattern — Complete Guide

## Table of Contents
1. [The Problem Command Solves](#1-the-problem-command-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Command Solves

In a restaurant, a `Waiter` takes orders from customers and hands them to the `Chef`. If the `Waiter` calls `chef.cook_pasta()`, `chef.cook_pizza()` directly, the waiter class must know every dish method on `Chef`, can't queue orders, can't undo an order ("customer changed their mind"), and can't log a history of what was ordered.

```
Without Command:
  Waiter.take_order(dish_name)
     if dish_name == "pasta": chef.cook_pasta()
     elif dish_name == "pizza": chef.cook_pizza()
     # can't queue multiple orders and fire them later
     # can't undo/cancel an order
     # can't log "what got ordered, in what order"
```

**Command Pattern**: encapsulate a request (and everything needed to execute it) as a standalone object, so requests can be queued, logged, parameterized, and undone — decoupling the object that invokes an action (`Waiter`) from the object that performs it (`Chef`).

---

## 2. The Bad Example

```python
class Chef:
    def cook_pasta(self) -> None:
        print("Chef cooking pasta")

    def cook_pizza(self) -> None:
        print("Chef cooking pizza")


class Waiter:
    def __init__(self, chef: Chef) -> None:
        self.chef = chef

    def take_order(self, dish_name: str) -> None:
        if dish_name == "pasta":
            self.chef.cook_pasta()
        elif dish_name == "pizza":
            self.chef.cook_pizza()
        else:
            raise ValueError(f"Unknown dish: {dish_name}")
        # no queueing, no undo, no order history
```

Problems:
- `Waiter` is coupled to every method name on `Chef`.
- Orders execute immediately — no way to batch a table's orders and fire them together.
- No undo ("cancel my pasta order") and no audit trail of what was ordered when.

---

## 3. The Good Example

```
┌─────────┐        ┌──────────────────┐        ┌───────┐
│ Waiter  │──────▶│  «interface»      │        │ Chef  │
│(Invoker)│ holds │      Command       │        │(Recvr)│
└─────────┘        │ + execute()        │        └───────┘
                    │ + undo()           │            ▲
                    └──────────────────┘            │
                              ▲                       │ calls
              ┌───────────────┼───────────────┐       │
      ┌────────────────┐ ┌────────────────┐   └───────┘
      │  CookPastaOrder │ │ CookPizzaOrder │
      └────────────────┘ └────────────────┘
```

`Waiter` (invoker) only knows the `Command` interface. Each concrete `Command` knows which `Chef` (receiver) method to call. Commands can be stacked into an order queue and undone.

---

## 4. Real-World Tie-In

This is exactly how GUI toolkits implement undo/redo (every button click is a `Command`), how job queues work (a `Command` is serialized, queued, and executed by a worker later), and how a remote control maps buttons to actions (`LightOnCommand`, `LightOffCommand`).

---

## 5. Complete Runnable Code

```python
from abc import ABC, abstractmethod


class Command(ABC):
    @abstractmethod
    def execute(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def undo(self) -> None:
        raise NotImplementedError


class Chef:
    """Receiver: knows how to actually perform the work."""

    def cook(self, dish: str) -> None:
        print(f"[Chef] Cooking {dish}")

    def cancel(self, dish: str) -> None:
        print(f"[Chef] Cancelling {dish}, discarding ingredients")


class CookDishCommand(Command):
    def __init__(self, chef: Chef, dish: str) -> None:
        self.chef = chef
        self.dish = dish

    def execute(self) -> None:
        self.chef.cook(self.dish)

    def undo(self) -> None:
        self.chef.cancel(self.dish)


class Waiter:
    """Invoker: holds a queue of commands and an undo stack -- knows nothing about Chef."""

    def __init__(self) -> None:
        self._order_queue: list[Command] = []
        self._history: list[Command] = []

    def add_to_order(self, command: Command) -> None:
        self._order_queue.append(command)

    def send_order_to_kitchen(self) -> None:
        print("--- Sending order to kitchen ---")
        for command in self._order_queue:
            command.execute()
            self._history.append(command)
        self._order_queue.clear()

    def undo_last(self) -> None:
        if not self._history:
            print("Nothing to undo")
            return
        last_command = self._history.pop()
        last_command.undo()


if __name__ == "__main__":
    chef = Chef()
    waiter = Waiter()

    waiter.add_to_order(CookDishCommand(chef, "Margherita Pizza"))
    waiter.add_to_order(CookDishCommand(chef, "Carbonara Pasta"))
    waiter.send_order_to_kitchen()

    waiter.undo_last()  # cancels the last dish sent (Carbonara Pasta)
```

Expected output:
```
--- Sending order to kitchen ---
[Chef] Cooking Margherita Pizza
[Chef] Cooking Carbonara Pasta
[Chef] Cancelling Carbonara Pasta, discarding ingredients
```

---

## 6. When to Use / Trade-offs

**Use Command when:**
- You need to queue, log, delay, or replay operations (job queues, macro recording, transactional workflows).
- You need undo/redo functionality.
- You want to decouple the object that invokes an operation from the object(s) that know how to perform it.

**Trade-offs:**
- Adds a class per distinct operation — can be a lot of boilerplate for simple apps.
- Undo can be genuinely hard to implement correctly for commands with side effects on external systems (e.g. "undo an email that was already sent") — sometimes you need compensating actions rather than true undo.
- If commands carry a lot of receiver state, consider combining with Memento (Lesson 09) to snapshot state before executing, for a simpler undo.

| Aspect | Without Command | With Command |
|--------|-------------------|----------------|
| Queueing operations | Not supported without ad-hoc lists of tuples | Native — `list[Command]` |
| Undo/redo | Requires special-casing every action | `command.undo()` uniformly |
| Decoupling invoker/receiver | Invoker calls receiver methods directly | Invoker only knows `Command` interface |

---

## 7. Interview Q&A

**Q: What problem does the Command pattern solve?**
Answer: It turns a request into a first-class object, decoupling the sender of a request (invoker) from the object that knows how to fulfill it (receiver). Because the request is now an object, it can be queued, logged, passed around, executed later, and undone — none of which is possible if the invoker just calls receiver methods directly.

**Q: What are the four roles in the Command pattern?**
Answer: **Command** (interface with `execute()`/`undo()`), **ConcreteCommand** (binds a receiver + action, e.g. `CookDishCommand`), **Receiver** (the object that does the actual work, e.g. `Chef`), and **Invoker** (holds and triggers commands without knowing what they do, e.g. `Waiter`). Optionally a **Client** wires receivers to commands and hands them to the invoker.

**Q: How does Command enable undo/redo?**
Answer: Every executed command is pushed onto a history stack. `undo()` pops the most recent command and calls its own `undo()` method, which reverses the effect (or restores prior state, often via a Memento). Redo is implemented with a second stack: undone commands move to a "redo stack" and get re-executed if the user redoes.

**Q: Implement the Command pattern from scratch for a remote control with `on()`/`off()` buttons and a single-level undo.**
Answer:
```python
from abc import ABC, abstractmethod


class Command(ABC):
    @abstractmethod
    def execute(self) -> None: ...
    @abstractmethod
    def undo(self) -> None: ...


class Light:
    def __init__(self, name: str) -> None:
        self.name = name
        self.is_on = False

    def turn_on(self) -> None:
        self.is_on = True
        print(f"{self.name} light: ON")

    def turn_off(self) -> None:
        self.is_on = False
        print(f"{self.name} light: OFF")


class LightOnCommand(Command):
    def __init__(self, light: Light) -> None:
        self.light = light

    def execute(self) -> None:
        self.light.turn_on()

    def undo(self) -> None:
        self.light.turn_off()


class LightOffCommand(Command):
    def __init__(self, light: Light) -> None:
        self.light = light

    def execute(self) -> None:
        self.light.turn_off()

    def undo(self) -> None:
        self.light.turn_on()


class RemoteControl:
    def __init__(self) -> None:
        self._last_command: Command | None = None

    def press_button(self, command: Command) -> None:
        command.execute()
        self._last_command = command

    def press_undo(self) -> None:
        if self._last_command:
            self._last_command.undo()


light = Light("Living Room")
remote = RemoteControl()
remote.press_button(LightOnCommand(light))
remote.press_undo()  # turns it back off
```

**Q: How is Command different from Strategy?**
Answer: Both encapsulate "behavior" in an object, but Strategy is about choosing *which algorithm* solves a problem (interchangeable, usually stateless, executed immediately by the caller). Command is about capturing *a request* — including the receiver, arguments, and often the ability to undo/queue/log it — decoupling when and by whom it's executed from when it was created.

**Q: When would you avoid the Command pattern?**
Answer: For simple, one-off, immediately-executed actions with no need for queueing, logging, undo, or decoupling — just call the method directly. Introducing a `Command` class per action for a small CRUD app adds indirection with no payoff.
