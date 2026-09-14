# Prototype Pattern — Complete Guide

## Table of Contents
1. [Motivation](#1-motivation)
2. [Bad Example: Rebuilding From Scratch](#2-bad-example-rebuilding-from-scratch)
3. [Shallow Copy vs Deep Copy Pitfalls](#3-shallow-copy-vs-deep-copy-pitfalls)
4. [Good Example: Cloning a Game Character](#4-good-example-cloning-a-game-character)
5. [Real Example: Document Template Cloning](#5-real-example-document-template-cloning)
6. [How It Works](#6-how-it-works)
7. [When to Use / Trade-offs](#7-when-to-use--trade-offs)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Motivation

Sometimes constructing a new object from scratch is expensive (loading config from disk, running expensive setup) or simply tedious (an object with dozens of already-configured fields), when what you actually want is "a copy of this existing object, with one or two fields tweaked." The Prototype pattern solves this by cloning an existing instance instead of rebuilding one from raw parameters.

```
Without Prototype:                       With Prototype:
Enemy(hp=100, attack=15, defense=10,     goblin = base_goblin_prototype.clone()
      sprite=load_sprite("goblin.png"),  goblin.name = "Elite Goblin"
      loot_table=build_loot_table(...),  goblin.hp = 150
      ai_behavior=load_ai("aggressive"))
      ↑ expensive / repetitive to rebuild every time
```

---

## 2. Bad Example: Rebuilding From Scratch

```python
class GameCharacter:
    def __init__(
        self,
        name: str,
        hp: int,
        attack: int,
        defense: int,
        inventory: list[str],
        skills: dict[str, int],
    ) -> None:
        self.name = name
        self.hp = hp
        self.attack = attack
        self.defense = defense
        self.inventory = inventory
        self.skills = skills


base_goblin_inventory = ["rusty dagger", "torn cloth"]
base_goblin_skills = {"bite": 5, "scratch": 3}

# To spawn 3 goblins, every field is re-specified from scratch every time —
# tedious, and any accidental field mismatch creates an inconsistent enemy.
goblin_1 = GameCharacter("Goblin", 30, 5, 2, list(base_goblin_inventory), dict(base_goblin_skills))
goblin_2 = GameCharacter("Goblin", 30, 5, 2, list(base_goblin_inventory), dict(base_goblin_skills))
goblin_3 = GameCharacter("Goblin", 31, 5, 2, list(base_goblin_inventory), dict(base_goblin_skills))
# ↑ typo: 31 instead of 30 — easy to introduce when copy-pasting constructor calls
```

Beyond the tedium, imagine `GameCharacter` construction also loaded a sprite from disk or computed a pathfinding grid — every spawn would repeat that expensive work, when 99% of the object is identical to a "template" goblin.

---

## 3. Shallow Copy vs Deep Copy Pitfalls

Python's `copy` module provides two levels of copying, and confusing them is the single most common Prototype-related bug:

```python
import copy


class Character:
    def __init__(self, name: str, inventory: list[str]) -> None:
        self.name = name
        self.inventory = inventory  # a mutable list


original = Character("Hero", ["sword", "shield"])

# --- Shallow copy: copies the object, but NOT nested mutable objects ---
shallow = copy.copy(original)
shallow.name = "Hero Clone"        # fine — strings are immutable, no sharing issue
shallow.inventory.append("bow")    # DANGER: mutates the SAME list as `original`!

print(original.inventory)  # ['sword', 'shield', 'bow']  <- unexpected!
print(shallow.inventory)   # ['sword', 'shield', 'bow']

# --- Deep copy: recursively copies nested mutable objects too ---
original2 = Character("Hero", ["sword", "shield"])
deep = copy.deepcopy(original2)
deep.inventory.append("bow")

print(original2.inventory)  # ['sword', 'shield']  <- untouched, correct
print(deep.inventory)       # ['sword', 'shield', 'bow']
```

```
Shallow copy:                          Deep copy:
original.inventory ──┐                 original.inventory ──▶ [list A]
                      ├──▶ [list A]     clone.inventory    ──▶ [list B] (separate copy)
clone.inventory    ──┘     (SHARED!)
```

**Rule of thumb:** if the object contains any mutable nested structures (lists, dicts, sets, or other objects), `copy.copy()` (shallow) will leave them shared between original and clone — mutating one mutates both. Use `copy.deepcopy()` when clones need to be fully independent.

### Custom `__deepcopy__` for Fine-Grained Control

Sometimes you want *most* fields deep-copied but a few shared on purpose (e.g., a reference to a shared, expensive-to-duplicate asset like a loaded texture). Override `__deepcopy__` for that:

```python
class Sprite:
    """Expensive, effectively-immutable shared resource — never needs cloning."""
    def __init__(self, path: str) -> None:
        self.path = path
        print(f"Loading sprite from disk: {path}")  # simulate expensive I/O


class Enemy:
    def __init__(self, name: str, hp: int, sprite: Sprite, buffs: list[str]) -> None:
        self.name = name
        self.hp = hp
        self.sprite = sprite      # shared, should NOT be deep-copied
        self.buffs = buffs        # per-instance, SHOULD be deep-copied

    def __deepcopy__(self, memo: dict) -> "Enemy":
        new_enemy = Enemy(
            name=self.name,
            hp=self.hp,
            sprite=self.sprite,                       # intentionally shared
            buffs=copy.deepcopy(self.buffs, memo),    # independently copied
        )
        return new_enemy


shared_sprite = Sprite("goblin.png")  # loaded from disk ONCE
goblin_template = Enemy("Goblin", 30, shared_sprite, ["poison_resist"])

goblin_clone = copy.deepcopy(goblin_template)
goblin_clone.buffs.append("berserk")

print(goblin_template.buffs)              # ['poison_resist'] — untouched
print(goblin_clone.buffs)                 # ['poison_resist', 'berserk']
print(goblin_clone.sprite is goblin_template.sprite)  # True — sprite correctly shared, not reloaded
```

---

## 4. Good Example: Cloning a Game Character

```python
from __future__ import annotations
import copy


class GameCharacter:
    def __init__(
        self,
        name: str,
        hp: int,
        attack: int,
        defense: int,
        inventory: list[str],
        skills: dict[str, int],
    ) -> None:
        self.name = name
        self.hp = hp
        self.attack = attack
        self.defense = defense
        self.inventory = inventory
        self.skills = skills

    def clone(self, **overrides: object) -> "GameCharacter":
        """Prototype method: deep-copy self, then apply any field overrides."""
        new_character = copy.deepcopy(self)
        for field, value in overrides.items():
            setattr(new_character, field, value)
        return new_character

    def __repr__(self) -> str:
        return f"GameCharacter(name={self.name!r}, hp={self.hp}, inventory={self.inventory})"


# Build ONE expensive/well-configured template, then clone it cheaply.
goblin_template = GameCharacter(
    name="Goblin",
    hp=30,
    attack=5,
    defense=2,
    inventory=["rusty dagger", "torn cloth"],
    skills={"bite": 5, "scratch": 3},
)

goblin_1 = goblin_template.clone()
goblin_2 = goblin_template.clone()
elite_goblin = goblin_template.clone(name="Elite Goblin", hp=80, attack=12)

goblin_1.inventory.append("gold coin")  # mutating the clone...

print(goblin_template.inventory)  # ['rusty dagger', 'torn cloth']  — template untouched
print(goblin_1.inventory)         # ['rusty dagger', 'torn cloth', 'gold coin']
print(elite_goblin)               # GameCharacter(name='Elite Goblin', hp=80, ...)
```

Because `clone()` uses `copy.deepcopy`, `goblin_1`, `goblin_2`, and `elite_goblin` all have fully independent `inventory` lists and `skills` dicts — mutating one never leaks into another or into the template.

---

## 5. Real Example: Document Template Cloning

```python
import copy
from dataclasses import dataclass, field


@dataclass
class Section:
    heading: str
    body: str


@dataclass
class DocumentTemplate:
    title: str
    sections: list[Section] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)

    def clone(self) -> "DocumentTemplate":
        return copy.deepcopy(self)


# A pre-built "Invoice" template with boilerplate sections.
invoice_template = DocumentTemplate(
    title="Invoice",
    sections=[
        Section("Billing Info", "[Company Name]\n[Address]"),
        Section("Terms", "Payment due within 30 days."),
    ],
    metadata={"category": "finance", "version": "1.0"},
)

# Every new invoice starts as an independent clone of the template.
invoice_for_acme = invoice_template.clone()
invoice_for_acme.title = "Invoice — Acme Corp"
invoice_for_acme.sections[0].body = "Acme Corp\n123 Main St"

# The original template is completely unaffected.
print(invoice_template.sections[0].body)   # "[Company Name]\n[Address]"
print(invoice_for_acme.sections[0].body)   # "Acme Corp\n123 Main St"
```

This mirrors real systems like Google Docs "Use template," Notion page templates, and CMS content types — a template object is authored once and cloned per use, never mutated in place.

---

## 6. How It Works

```
Prototype interface: clone() -> Self

┌───────────────────┐   .clone()   ┌───────────────────┐
│ goblin_template    │ ───────────▶│  goblin_1 (deep    │
│ hp=30, inv=[...]   │              │  copy, independent)│
└───────────────────┘               └───────────────────┘
        │  .clone(name="Elite", hp=80)
        ▼
┌───────────────────┐
│  elite_goblin      │  (deep copy + field overrides applied after copying)
└───────────────────┘
```

`clone()` typically wraps `copy.deepcopy(self)` and then applies any requested overrides — this keeps the pattern's implementation a one-liner while giving full control over which nested objects are independent (default: everything) versus intentionally shared (override `__deepcopy__` for those, as with the `Sprite` example above).

---

## 7. When to Use / Trade-offs

| Use Prototype when | Trade-offs / caveats |
|---|---|
| Object construction is expensive (I/O, computation) and most new instances start from a similar baseline | Deep copying can itself be expensive for very large object graphs — profile before assuming it's "cheap" |
| You want to spawn many similar objects from a well-configured template ("enemy templates", "document templates") | Easy to introduce shallow-copy bugs (shared mutable state) if you forget `deepcopy` or don't override `__deepcopy__` correctly |
| Some fields should be shared across clones (e.g., a large shared read-only asset) while others must be independent | Requires care to distinguish "shared by design" (like `Sprite`) from "shared by bug" (like a shallow-copied `inventory` list) |
| You want to avoid subclass explosion from a factory that would otherwise need one class per configuration variant | Cloning preserves the *runtime* state of the prototype, including any accidental mutations already present in it — a "dirty" prototype produces dirty clones |

---

## 8. Interview Q&A

**Q: What problem does the Prototype pattern solve?**
Answer: It avoids the cost and repetition of constructing new objects from raw parameters when a new instance is mostly identical to an already-existing, well-configured object. Instead of rebuilding from scratch, you clone an existing "prototype" instance and optionally tweak a few fields — useful when construction is expensive (I/O, computed state) or when many similar instances need to be spawned from a common template.

**Q: Implement a Prototype pattern from scratch for a GameCharacter class.**
Answer: Add a `clone(self, **overrides) -> GameCharacter` method that calls `copy.deepcopy(self)` to produce a fully independent copy, then loops over `overrides.items()` calling `setattr(new_obj, field, value)` to apply any requested field changes before returning. Usage: `elite = goblin_template.clone(name="Elite Goblin", hp=80)` — this returns a new, independent object without re-specifying every unchanged field.

**Q: What is the difference between `copy.copy()` and `copy.deepcopy()`, and why does it matter for Prototype?**
Answer: `copy.copy()` (shallow copy) creates a new top-level object but keeps references to the *same* nested mutable objects (lists, dicts, other objects) as the original — mutating a nested field on the clone mutates the original too. `copy.deepcopy()` recursively copies nested mutable objects as well, so the clone is fully independent. Prototype almost always wants `deepcopy` by default, because the entire point is to produce an independent instance; using shallow copy by mistake reintroduces subtle shared-state bugs.

**Q: When would you override `__deepcopy__` instead of relying on the default `copy.deepcopy()` behavior?**
Answer: When some fields should be intentionally shared across all clones rather than duplicated — typically large, expensive-to-load, effectively-immutable shared resources (a loaded texture/sprite, a shared config object, a DB connection). Overriding `__deepcopy__` lets you deep-copy the per-instance mutable fields (like a `buffs` list) while passing the shared resource through by reference, avoiding both the correctness bug of unwanted sharing and the performance cost of needlessly re-copying a large shared object.

**Q: How is Prototype different from Factory Method for creating similar objects?**
Answer: Factory Method builds a new object from parameters via a constructor call, based on a type key — every call constructs from scratch. Prototype builds a new object by copying an existing, already-configured instance and optionally overriding a few fields — it never re-runs the original construction logic. Prototype is preferable when construction is expensive or when you want new instances to inherit arbitrary already-set state from a live object rather than from a fixed set of constructor parameters.

**Q: What's a real-world Python example where you'd reach for Prototype instead of just re-instantiating a class?**
Answer: Cloning a preconfigured object like a `requests.Session` with pre-set headers/auth/cookies for use in a new thread (`copy.deepcopy(session)`), spawning game/simulation entities from template objects (as shown with `GameCharacter`), or duplicating a document/config template (a "New from template" feature) where the template holds nested structures (sections, metadata) that must not be shared between generated documents.
