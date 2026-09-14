# Memento Pattern — Complete Guide

## Table of Contents
1. [The Problem Memento Solves](#1-the-problem-memento-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Memento Solves

A text editor needs undo: every edit should be revertible to the document's prior state. The naive approach exposes all of `Document`'s internal fields publicly so an external `UndoManager` can copy and later restore them — but that breaks encapsulation (any code can now mutate the document's internals directly) and couples the undo manager tightly to the document's exact field layout.

```
Without Memento:
  class UndoManager:
      def save(self, doc):
          # has to reach into doc's private fields directly
          self.saved_text = doc._text
          self.saved_cursor = doc._cursor_position

      def restore(self, doc):
          doc._text = self.saved_text          # reaching into internals
          doc._cursor_position = self.saved_cursor
  # UndoManager and Document are tightly coupled to the same private fields
  # any change to Document's internal layout breaks UndoManager too
```

**Memento Pattern**: without violating encapsulation, capture and externalize an object's internal state so it can be restored later. The originator creates a memento containing a snapshot of its own state; only the originator itself can read/write that snapshot's internals — outside code (the caretaker) just stores and passes mementos around opaquely.

---

## 2. The Bad Example

```python
class Document:
    def __init__(self) -> None:
        self.text = ""          # public -- anyone can read/write directly
        self.cursor_position = 0


class UndoManager:
    def __init__(self) -> None:
        self.saved_text = ""
        self.saved_cursor = 0

    def save(self, doc: Document) -> None:
        self.saved_text = doc.text
        self.saved_cursor = doc.cursor_position

    def restore(self, doc: Document) -> None:
        doc.text = self.saved_text
        doc.cursor_position = self.saved_cursor
```

Problems:
- `Document`'s fields must be public (or `UndoManager` must use private-field access hacks) — encapsulation is broken.
- Only supports a single saved snapshot — no history stack for multi-level undo.
- Every field added to `Document` requires a matching change inside `UndoManager` — tight coupling to internal layout.

---

## 3. The Good Example

```
┌────────────────┐  creates  ┌────────────┐
│   Document      │─────────▶│  Memento    │  <- opaque snapshot, only Document
│  (Originator)   │           │ (immutable) │     can read its contents
│ + save() -> Memento         └────────────┘
│ + restore(Memento)                ▲
└────────────────┘                 │ stored opaquely, never inspected
         ▲                          │
         │                 ┌──────────────────┐
         └─────────────────│  UndoHistory      │
                            │  (Caretaker)      │
                            │ - stack[Memento]  │
                            └──────────────────┘
```

`Document` (originator) creates and restores from `Memento` objects. `UndoHistory` (caretaker) only stores mementos on a stack — it never looks inside them. Encapsulation is preserved because only `Document` knows the memento's internal shape.

---

## 4. Real-World Tie-In

This is exactly how text editor / IDE undo-redo history works, how database systems implement savepoints/rollback, and how form wizards let a user go "back" to a prior step without losing what they'd filled in — each step's `Memento` captures the form state at that point.

---

## 5. Complete Runnable Code

```python
from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class DocumentMemento:
    """Opaque snapshot. Caretaker stores this but never reads/modifies its fields."""

    _text: str
    _cursor_position: int


class Document:
    """Originator: creates mementos of itself and restores its own state from them."""

    def __init__(self) -> None:
        self._text = ""
        self._cursor_position = 0

    def type(self, text: str) -> None:
        self._text += text
        self._cursor_position = len(self._text)

    def save(self) -> DocumentMemento:
        """Create a snapshot of current state."""
        return DocumentMemento(self._text, self._cursor_position)

    def restore(self, memento: DocumentMemento) -> None:
        """Restore state from a previously saved snapshot."""
        self._text = memento._text
        self._cursor_position = memento._cursor_position

    def __str__(self) -> str:
        return f"'{self._text}' (cursor at {self._cursor_position})"


class UndoHistory:
    """Caretaker: manages a stack of mementos without inspecting their contents."""

    def __init__(self) -> None:
        self._history: list[DocumentMemento] = []

    def backup(self, memento: DocumentMemento) -> None:
        self._history.append(memento)

    def undo(self) -> DocumentMemento | None:
        if not self._history:
            return None
        return self._history.pop()


if __name__ == "__main__":
    doc = Document()
    history = UndoHistory()

    doc.type("Hello")
    history.backup(doc.save())   # checkpoint after "Hello"

    doc.type(", World")
    history.backup(doc.save())   # checkpoint after "Hello, World"

    doc.type("!!!")
    print(f"Current: {doc}")     # 'Hello, World!!!'

    memento = history.undo()
    if memento:
        doc.restore(memento)
    print(f"After 1 undo: {doc}")  # back to 'Hello, World'

    memento = history.undo()
    if memento:
        doc.restore(memento)
    print(f"After 2 undos: {doc}")  # back to 'Hello'
```

Expected output:
```
Current: 'Hello, World!!!' (cursor at 16)
After 1 undo: 'Hello, World' (cursor at 12)
After 2 undos: 'Hello' (cursor at 5)
```

---

## 6. When to Use / Trade-offs

**Use Memento when:**
- You need undo/redo, checkpoints, or rollback, and you want to preserve encapsulation — the object being snapshotted should control the shape of its own snapshot.
- You want to decouple "who stores history" (caretaker) from "who knows how to snapshot/restore" (originator).

**Trade-offs:**
- Storing full-state snapshots for every change can be memory-expensive for large objects (a big document's every keystroke) — mitigate with incremental/diff-based mementos, snapshotting only periodically, or capping history size.
- Combines naturally with Command (Lesson 03): each `Command.execute()` can take a memento before acting, and `undo()` simply restores it — often simpler than each command manually reversing its own effect.
- In Python, "true" encapsulation of the memento's internals from the caretaker is by convention (leading underscore, or a nested class) rather than enforced by the language — unlike Java/C++, there's no private access modifier the caretaker is truly locked out of.

| Aspect | Without Memento | With Memento |
|--------|-------------------|----------------|
| Encapsulation | Broken -- internals exposed to undo manager | Preserved -- only originator reads/writes its own memento |
| Multi-level undo | Requires ad-hoc extra fields per level | Natural -- caretaker just uses a stack of mementos |
| Coupling to originator's internal layout | Tight -- caretaker mirrors originator's fields | Loose -- caretaker only stores an opaque object |

---

## 7. Interview Q&A

**Q: What problem does the Memento pattern solve?**
Answer: It lets you capture and externalize an object's internal state so it can be restored later (for undo, rollback, checkpoints) without exposing that object's internal structure to the code responsible for storing the history. The object itself (the originator) creates and restores from mementos; the caretaker that stores those mementos treats them as opaque and never reads or writes their contents directly.

**Q: What are the three roles in the Memento pattern?**
Answer: **Originator** — the object whose state needs saving/restoring; it creates mementos of itself and can restore itself from one. **Memento** — an immutable snapshot object; only the originator understands its internal shape. **Caretaker** — holds onto mementos (often in a stack for multi-level undo) but never inspects or modifies their contents, just passes them back to the originator when a restore is needed.

**Q: How does Memento preserve encapsulation compared to just exposing getters/setters for every field?**
Answer: If you exposed public getters/setters for every field so an external `UndoManager` could copy them out and back in, any other code could also call those setters and corrupt state arbitrarily, and the undo manager becomes tightly coupled to the exact field list. With Memento, the snapshot's creation and restoration logic lives inside the originator itself (`save()`/`restore()`), so the memento's internal shape can change freely as long as those two methods stay in sync — external code (the caretaker) never needs to know or care what's inside.

**Q: Implement the Memento pattern from scratch for a simple game character whose health/position needs to be checkpointed and restored (e.g. after death, respawn from last checkpoint).**
Answer:
```python
from dataclasses import dataclass


@dataclass(frozen=True)
class CharacterMemento:
    _health: int
    _x: int
    _y: int


class Character:
    def __init__(self) -> None:
        self.health = 100
        self.x = 0
        self.y = 0

    def take_damage(self, amount: int) -> None:
        self.health -= amount

    def move(self, dx: int, dy: int) -> None:
        self.x += dx
        self.y += dy

    def checkpoint(self) -> CharacterMemento:
        return CharacterMemento(self.health, self.x, self.y)

    def respawn(self, memento: CharacterMemento) -> None:
        self.health = memento._health
        self.x = memento._x
        self.y = memento._y


class CheckpointManager:
    def __init__(self) -> None:
        self._checkpoints: list[CharacterMemento] = []

    def save(self, memento: CharacterMemento) -> None:
        self._checkpoints.append(memento)

    def last(self) -> CharacterMemento:
        return self._checkpoints[-1]


hero = Character()
manager = CheckpointManager()
hero.move(5, 5)
manager.save(hero.checkpoint())     # checkpoint at (5,5), health 100

hero.take_damage(90)
hero.move(20, 20)
print(hero.health, hero.x, hero.y)  # 10 25 25 -- near death, far from checkpoint

hero.respawn(manager.last())
print(hero.health, hero.x, hero.y)  # 100 5 5 -- restored
```

**Q: How does Memento relate to Command's undo functionality?**
Answer: They combine naturally: a `Command`'s `execute()` can call `originator.save()` to capture a memento *before* mutating state, and its `undo()` simply calls `originator.restore(memento)`. This is often simpler and less error-prone than requiring every command to manually compute how to reverse its own specific effect, especially when the state touched is complex (undoing "delete 5 characters" is easier via "restore prior text" than by re-deriving the deleted characters).

**Q: What's a practical concern with using Memento for something like a large document editor?**
Answer: Storing a full deep copy of the entire document on every keystroke is memory-prohibitive. Real editors mitigate this by: (1) snapshotting only at meaningful boundaries (e.g. after a pause in typing, or per discrete operation like "paste" or "delete word") rather than every character; (2) storing incremental diffs/deltas instead of full copies and replaying/reversing them; (3) capping the undo history size (e.g. last 100 operations) and discarding older mementos.
