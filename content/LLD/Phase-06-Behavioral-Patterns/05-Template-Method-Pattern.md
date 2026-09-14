# Template Method Pattern — Complete Guide

## Table of Contents
1. [The Problem Template Method Solves](#1-the-problem-template-method-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Template Method Solves

A data-processing pipeline always runs the same four steps in the same order: **parse → validate → transform → save**. But *how* each step is done differs by data source: a CSV importer parses differently than a JSON importer, though both validate/transform/save using mostly the same shape of logic. Copy-pasting the whole pipeline per importer duplicates the *skeleton* (the order of steps, error handling around them) every time.

```
Without Template Method:
  CSVImporter.run()
     rows = parse_csv(...)
     if not valid(rows): raise ...
     data = transform(rows)
     save(data)

  JSONImporter.run()
     rows = parse_json(...)      # duplicated skeleton
     if not valid(rows): raise ...
     data = transform(rows)
     save(data)
  # the four-step skeleton is copy-pasted into every importer
```

**Template Method Pattern**: define the skeleton of an algorithm in a base class method, deferring some steps to subclasses — subclasses can redefine certain steps without changing the algorithm's overall structure.

---

## 2. The Bad Example

```python
class CSVImporter:
    def run(self, source: str) -> None:
        print(f"Parsing CSV from {source}")
        rows = ["row1", "row2"]
        if not rows:
            raise ValueError("No data")
        print("Transforming rows")
        transformed = [r.upper() for r in rows]
        print(f"Saving {transformed}")


class JSONImporter:
    def run(self, source: str) -> None:
        print(f"Parsing JSON from {source}")   # duplicated structure
        rows = ["row1", "row2"]
        if not rows:
            raise ValueError("No data")
        print("Transforming rows")
        transformed = [r.upper() for r in rows]
        print(f"Saving {transformed}")
```

Problems:
- The validate/transform/save logic (and the *order* of the four steps) is duplicated across every importer — a bug fix to validation must be copy-pasted everywhere.
- No guarantee every importer follows the same step order — one importer could accidentally skip validation.
- Adding a cross-cutting concern (e.g. logging total time) means editing every importer's `run()`.

---

## 3. The Good Example

```
┌────────────────────────────┐
│   DataPipeline (abstract)  │
│ + run(source)  [template]  │  <- fixed skeleton, calls the hooks below in order
│ # parse(source)  [abstract]│
│ # validate(rows) [hook]    │  <- has a sensible default, overridable
│ # transform(rows)[abstract]│
│ # save(data)     [abstract]│
└────────────────────────────┘
              ▲
      ┌───────────────┬────────────────┐
┌──────────────┐ ┌───────────────┐
│ CSVPipeline   │ │ JSONPipeline  │
└──────────────┘ └───────────────┘
```

`run()` (the template method) is defined once in the base class and is `final` in spirit — subclasses only override the individual steps, never the order.

---

## 4. Real-World Tie-In

This is exactly how Django's class-based views work (`View.dispatch()` is the template; `get()`/`post()` are the hooks you override), how test frameworks structure `setUp() → test → tearDown()`, and how ETL frameworks define a fixed extract-transform-load skeleton with pluggable steps per data source.

---

## 5. Complete Runnable Code

```python
from abc import ABC, abstractmethod
from typing import Any


class DataPipeline(ABC):
    """Defines the fixed skeleton: parse -> validate -> transform -> save."""

    def run(self, source: str) -> None:
        """Template method -- the algorithm's skeleton. Not meant to be overridden."""
        print(f"=== Running pipeline for {source} ===")
        rows = self.parse(source)
        if not self.validate(rows):
            raise ValueError("Validation failed: no usable rows")
        transformed = self.transform(rows)
        self.save(transformed)
        print("=== Pipeline complete ===\n")

    @abstractmethod
    def parse(self, source: str) -> list[Any]:
        """Step 1: turn raw source into rows. Must be implemented per format."""
        raise NotImplementedError

    def validate(self, rows: list[Any]) -> bool:
        """Step 2: default validation (hook) -- subclasses may override."""
        return len(rows) > 0

    @abstractmethod
    def transform(self, rows: list[Any]) -> list[Any]:
        """Step 3: apply business transformation. Must be implemented per format."""
        raise NotImplementedError

    @abstractmethod
    def save(self, data: list[Any]) -> None:
        """Step 4: persist the data. Must be implemented per destination."""
        raise NotImplementedError


class CSVPipeline(DataPipeline):
    def parse(self, source: str) -> list[Any]:
        print(f"[CSV] Parsing rows from {source}")
        return ["alice,25", "bob,30"]

    def transform(self, rows: list[Any]) -> list[Any]:
        print("[CSV] Splitting comma-separated fields")
        return [row.split(",") for row in rows]

    def save(self, data: list[Any]) -> None:
        print(f"[CSV] Saving to database: {data}")


class JSONPipeline(DataPipeline):
    def parse(self, source: str) -> list[Any]:
        print(f"[JSON] Parsing JSON objects from {source}")
        return [{"name": "alice", "age": 25}, {"name": "bob", "age": 30}]

    def validate(self, rows: list[Any]) -> bool:
        # override the default hook: also require every row to have a "name" key
        return len(rows) > 0 and all("name" in row for row in rows)

    def transform(self, rows: list[Any]) -> list[Any]:
        print("[JSON] Normalizing keys to lowercase")
        return [{k.lower(): v for k, v in row.items()} for row in rows]

    def save(self, data: list[Any]) -> None:
        print(f"[JSON] Saving to document store: {data}")


if __name__ == "__main__":
    CSVPipeline().run("users.csv")
    JSONPipeline().run("users.json")
```

Expected output:
```
=== Running pipeline for users.csv ===
[CSV] Parsing rows from users.csv
[CSV] Splitting comma-separated fields
[CSV] Saving to database: [['alice', '25'], ['bob', '30']]
=== Pipeline complete ===

=== Running pipeline for users.json ===
[JSON] Parsing JSON objects from users.json
[JSON] Normalizing keys to lowercase
[JSON] Saving to document store: [{'name': 'alice', 'age': 25}, {'name': 'bob', 'age': 30}]
=== Pipeline complete ===
```

---

## 6. When to Use / Trade-offs

**Use Template Method when:**
- Several classes implement the same algorithm with the same overall structure, differing only in specific steps (data importers, report generators, test lifecycles, game AI turn sequences).
- You want to enforce a fixed order of steps and prevent subclasses from skipping or reordering them.
- You want optional steps with sensible defaults ("hooks") that most subclasses don't need to touch (`validate()` above).

**Trade-offs:**
- Relies on inheritance, which is more rigid than composition (Strategy) — a subclass is locked into the base class's skeleton; if two importers need genuinely different step *order*, Template Method is the wrong tool.
- Can lead to fragile base class issues: changing the base's `run()` affects every subclass; deep hierarchies get hard to trace ("which class actually defines `transform()` here?").
- Python has no true `final` keyword — nothing stops a subclass from overriding `run()` itself and breaking the skeleton; document this convention clearly (leading underscore, docstring) since Python can't enforce it at compile time.

| Aspect | Without Template Method | With Template Method |
|--------|-------------------|----------------|
| Step order guarantee | None — duplicated per class | Enforced once, in the base class |
| Adding a cross-cutting step (e.g. logging) | Edit every subclass | Edit the base class's `run()` once |
| Code reuse | Copy-paste | Shared skeleton + default hooks |

---

## 7. Interview Q&A

**Q: What problem does the Template Method pattern solve?**
Answer: It removes duplication of an algorithm's overall structure across multiple classes by defining the fixed sequence of steps once, in a base class method, and delegating the variable parts to abstract or overridable methods ("hooks") that subclasses implement. This guarantees every subclass follows the same step order while still allowing per-subclass customization.

**Q: What's the difference between an abstract step and a "hook" in Template Method?**
Answer: An abstract step (like `parse()`/`transform()`/`save()` above) has no default implementation — every subclass *must* override it. A hook (like `validate()`) has a sensible default implementation in the base class that subclasses *may* override if they need different behavior, but aren't required to.

**Q: How is Template Method different from Strategy?**
Answer: Both let you vary part of a behavior, but Template Method uses inheritance — the algorithm's skeleton lives in a base class and subclasses override specific steps (white-box reuse: subclasses see and depend on the base class's internals). Strategy uses composition — the whole algorithm is swapped out via an injected object implementing a common interface (black-box reuse: no inheritance relationship, more flexible, can be swapped at runtime). If you find yourself wanting to change the algorithm's structure at runtime rather than at class-definition time, prefer Strategy.

**Q: Implement the Template Method pattern from scratch for making different hot beverages (tea vs coffee) that share a boil-water/pour-into-cup skeleton.**
Answer:
```python
from abc import ABC, abstractmethod


class BeverageMaker(ABC):
    def prepare(self) -> None:
        self.boil_water()
        self.add_main_ingredient()
        self.pour_into_cup()
        if self.wants_condiments():
            self.add_condiments()

    def boil_water(self) -> None:
        print("Boiling water")

    def pour_into_cup(self) -> None:
        print("Pouring into cup")

    @abstractmethod
    def add_main_ingredient(self) -> None: ...

    @abstractmethod
    def add_condiments(self) -> None: ...

    def wants_condiments(self) -> bool:
        return True  # default hook


class Tea(BeverageMaker):
    def add_main_ingredient(self) -> None:
        print("Steeping tea bag")

    def add_condiments(self) -> None:
        print("Adding lemon")


class BlackCoffee(BeverageMaker):
    def add_main_ingredient(self) -> None:
        print("Brewing coffee grounds")

    def add_condiments(self) -> None:
        print("Adding condiments")  # never called

    def wants_condiments(self) -> bool:
        return False  # override the hook


Tea().prepare()
BlackCoffee().prepare()
```

**Q: Why can't Python truly prevent a subclass from overriding the template method itself?**
Answer: Python has no access-control keyword equivalent to Java's `final`. By convention, you signal "do not override" via naming (a docstring, or prefixing with a single underscore to hint at internal use) and code review discipline, but nothing stops a subclass from redefining `run()`. Some codebases enforce this with a metaclass or `__init_subclass__` check that raises if a subclass redefines the template method, though this is uncommon in practice.

**Q: Where have you seen Template Method in a framework you've used?**
Answer: Django class-based views: `View.as_view()` -> `dispatch()` is the template method that looks up `self.get`/`self.post`/etc. based on the HTTP verb and calls the matching hook you define on your subclass. Python's `unittest.TestCase` also applies it: the runner always calls `setUp() -> test_method() -> tearDown()` in that fixed order, and you only override the parts relevant to your test.
