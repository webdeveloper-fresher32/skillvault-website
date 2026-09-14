# Mediator Pattern — Complete Guide

## Table of Contents
1. [The Problem Mediator Solves](#1-the-problem-mediator-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Mediator Solves

In a chat room, every `User` could hold direct references to every other `User` and call `other_user.receive(message)` on each one. With 3 users this is manageable; with 30 users, every `User` class ends up holding a list of 29 peers, and adding a "muted users" or "moderator" feature means touching every single `User` object's logic. This is the classic **many-to-many spaghetti** problem — N objects each referencing N-1 others.

```
Without Mediator:
  UserA.send("hi") -> UserA loops over [UserB, UserC, UserD, ...] and calls .receive()
  UserB.send("hi") -> UserB loops over [UserA, UserC, UserD, ...] and calls .receive()
  # every user object needs a reference to every other user object
  # adding a moderation rule means editing the send logic in EVERY user
```

**Mediator Pattern**: define an object that encapsulates how a set of objects interact, so those objects don't reference each other directly — they only talk to the mediator, which centralizes and controls the communication.

---

## 2. The Bad Example

```python
class User:
    def __init__(self, name: str) -> None:
        self.name = name
        self.peers: list["User"] = []  # every user must know every other user

    def send(self, message: str) -> None:
        print(f"{self.name} sends: {message}")
        for peer in self.peers:
            peer.receive(self.name, message)

    def receive(self, sender: str, message: str) -> None:
        print(f"{self.name} received from {sender}: {message}")


alice, bob, carol = User("Alice"), User("Bob"), User("Carol")
alice.peers = [bob, carol]
bob.peers = [alice, carol]
carol.peers = [alice, bob]
# manually wiring N*(N-1) relationships -- doesn't scale, and logic like
# "muted users don't receive messages" would need to be added to every User
```

Problems:
- O(N²) relationships to wire manually — adding a new user means updating everyone else's `peers` list.
- Cross-cutting rules (muting, logging, rate-limiting) must be duplicated inside every `User`.
- Users are tightly coupled to each other's concrete class and `receive()` signature.

---

## 3. The Good Example

```
┌─────────────────────┐        ┌───────────┐
│    «interface»      │◆──────│   User     │
│    ChatMediator       │ used  │(Colleague) │
│ + send(msg, from)     │  by   └───────────┘
│ + add_user(user)       │            ▲
└─────────────────────┘            │ (implements same base)
          ▲                   ┌────┴─────┬─────────┐
┌───────────────────┐   Alice     Bob      Carol
│   ChatRoom         │
│ (ConcreteMediator) │
└───────────────────┘
```

Every `User` only holds a reference to the `ChatMediator` interface, never to other users. `ChatRoom` centralizes routing, muting, logging — one place to change behavior.

---

## 4. Real-World Tie-In

This is how an air-traffic-control tower coordinates planes (pilots never talk directly to each other — everything routes through the tower, which enforces separation rules), and how UI frameworks coordinate widgets (a dialog box's "mediator" enables/disables the Submit button based on multiple field validations, instead of every field widget knowing about every other widget).

---

## 5. Complete Runnable Code

```python
from abc import ABC, abstractmethod


class ChatMediator(ABC):
    @abstractmethod
    def send(self, message: str, sender: "User") -> None:
        raise NotImplementedError

    @abstractmethod
    def add_user(self, user: "User") -> None:
        raise NotImplementedError


class User(ABC):
    """Colleague: only knows the mediator, never other users directly."""

    def __init__(self, name: str, mediator: ChatMediator) -> None:
        self.name = name
        self.mediator = mediator
        mediator.add_user(self)

    def send(self, message: str) -> None:
        print(f"{self.name} sends: {message}")
        self.mediator.send(message, self)

    @abstractmethod
    def receive(self, sender_name: str, message: str) -> None:
        raise NotImplementedError


class ChatRoom(ChatMediator):
    """Concrete mediator: centralizes routing, muting, logging."""

    def __init__(self) -> None:
        self._users: list[User] = []
        self._muted: set[str] = set()

    def add_user(self, user: User) -> None:
        self._users.append(user)

    def mute(self, name: str) -> None:
        self._muted.add(name)

    def send(self, message: str, sender: User) -> None:
        if sender.name in self._muted:
            print(f"[ChatRoom] {sender.name} is muted -- message blocked")
            return
        for user in self._users:
            if user is not sender:
                user.receive(sender.name, message)


class ChatUser(User):
    def receive(self, sender_name: str, message: str) -> None:
        print(f"  {self.name} received from {sender_name}: {message}")


if __name__ == "__main__":
    chat_room = ChatRoom()
    alice = ChatUser("Alice", chat_room)
    bob = ChatUser("Bob", chat_room)
    carol = ChatUser("Carol", chat_room)

    alice.send("Hey everyone!")
    chat_room.mute("Bob")
    bob.send("Can anyone hear me?")  # blocked centrally, no User code changes needed
```

Expected output:
```
Alice sends: Hey everyone!
  Bob received from Alice: Hey everyone!
  Carol received from Alice: Hey everyone!
Bob sends: Can anyone hear me?
[ChatRoom] Bob is muted -- message blocked
```

---

## 6. When to Use / Trade-offs

**Use Mediator when:**
- Many objects need to communicate in complex ways, and direct references between them create a tangled, hard-to-change web (chat systems, air-traffic control, form/dialog widget coordination, matchmaking lobbies).
- You want to centralize a cross-cutting interaction rule (muting, rate limiting, logging, validation across multiple fields) in one place instead of duplicating it across every participant.

**Trade-offs:**
- The mediator itself can become a "god object" that knows too much and grows unmanageably complex if it absorbs too much business logic — keep it focused on *coordination*, not business rules.
- Adds an extra indirection hop for every interaction, which can slightly complicate debugging ("who actually sent this message?" requires looking at the mediator's routing logic).
- For a small, fixed, stable set of collaborators (2-3 objects with simple interaction), direct references may be simpler than introducing a mediator.

| Aspect | Without Mediator | With Mediator |
|--------|-------------------|----------------|
| Relationships to wire | O(N²) direct references | O(N) — each object only knows the mediator |
| Adding a cross-cutting rule (e.g. mute) | Edit every participant | Edit the mediator once |
| Coupling | Objects coupled to each other's concrete classes | Objects coupled only to the mediator interface |

---

## 7. Interview Q&A

**Q: What problem does the Mediator pattern solve?**
Answer: It reduces chaotic many-to-many coupling between a set of collaborating objects by introducing a central object (the mediator) that all of them talk to instead of each other. Objects only need a reference to the mediator interface, not to every peer, which turns O(N²) relationships into O(N) and centralizes cross-cutting coordination logic in one place.

**Q: How is Mediator different from Observer?**
Answer: Observer is one-directional and one-to-many: a subject notifies its observers when *its own* state changes, and observers don't talk back through the subject. Mediator is about *many-to-many* coordination between peers of roughly equal standing (all `User`s can send and receive) — the mediator actively routes, filters, and can transform interactions between them, not just broadcast a single subject's state change. In practice a Mediator implementation often uses Observer internally (colleagues could "subscribe" to the mediator), but the intents differ: Observer = notify dependents of a change; Mediator = decouple peers that need to collaborate.

**Q: Doesn't the Mediator just become a god object with all the complexity moved into it?**
Answer: It can, if you're not careful — that's the main risk/criticism of this pattern. The mitigation is to keep the mediator focused purely on *coordination and routing* (who talks to whom, under what constraints) and keep actual business logic inside the colleague objects themselves. If the mediator starts implementing domain logic that belongs to a `User` or a `Plane`, it's grown beyond its intended scope and should be split up (e.g. extract a separate `ModerationPolicy` object the mediator delegates to).

**Q: Implement the Mediator pattern from scratch for an air-traffic-control tower that lets planes request landing and prevents two planes from landing on the same runway simultaneously.**
Answer:
```python
from abc import ABC, abstractmethod


class ControlTower(ABC):
    @abstractmethod
    def request_landing(self, plane: "Plane") -> bool: ...
    @abstractmethod
    def notify_landed(self, plane: "Plane") -> None: ...


class Plane:
    def __init__(self, callsign: str, tower: ControlTower) -> None:
        self.callsign = callsign
        self.tower = tower

    def request_landing(self) -> None:
        if self.tower.request_landing(self):
            print(f"{self.callsign}: cleared to land")
            self.tower.notify_landed(self)
        else:
            print(f"{self.callsign}: holding pattern, runway busy")


class AirTrafficControlTower(ControlTower):
    def __init__(self) -> None:
        self._runway_occupied = False

    def request_landing(self, plane: Plane) -> bool:
        if self._runway_occupied:
            return False
        self._runway_occupied = True
        return True

    def notify_landed(self, plane: Plane) -> None:
        print(f"[Tower] {plane.callsign} has landed, freeing runway")
        self._runway_occupied = False


tower = AirTrafficControlTower()
plane_a, plane_b = Plane("AI101", tower), Plane("BA202", tower)
plane_a.request_landing()
plane_b.request_landing()  # will succeed since plane_a already freed the runway in notify_landed
```

**Q: Can Mediator and Facade be confused? What's the distinction?**
Answer: Both introduce an intermediary object, but Facade (Phase 05) provides a *simplified one-way interface* over a subsystem the client doesn't need to know the internals of — it doesn't add new communication behavior, just hides complexity. Mediator centralizes *bidirectional collaboration* between peer objects that would otherwise need to know about each other — it actively participates in and controls the interaction, not just simplifying access to it.

**Q: What's a downside of introducing Mediator too early?**
Answer: If there are only two or three collaborators with a simple, stable interaction, adding a mediator interface plus a concrete mediator class is unnecessary indirection — direct method calls are simpler to read and trace. Mediator earns its complexity once you have many collaborators or interaction rules that would otherwise be duplicated across every participant.
