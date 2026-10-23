# Phase 9: Signals & State Management

## What You'll Learn

Master Angular's Signals API — the fine-grained reactivity model that powers modern Angular's change detection. Learn to model state with `signal()`, derive values with `computed()`, react to changes with `effect()`, and build simple, scalable state management patterns without reaching for a heavyweight library.

## Learning Objectives

- Create and update state with `signal()`, and understand how signal-based reactivity differs from Zone.js change detection
- Use `input()` and `model()` for signal-based component APIs, and know when to reach for signals vs RxJS Observables
- Derive computed state with `computed()` and run side effects with `effect()`, including cleanup and `untracked()`
- Recognize and avoid common signal pitfalls (infinite effect loops, over-computing, mutating objects in place)
- Build a signal-based store pattern inside an injectable service, and judge when NgRx or another RxJS-based library is actually justified

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Signals-Fundamentals.md](01-Signals-Fundamentals.md) | `signal()`, reading/writing/updating, signals vs Observables, `input()`/`model()` | 2 days |
| [02-Computed-and-Effects.md](02-Computed-and-Effects.md) | `computed()`, `effect()`, cleanup, `untracked()`, common pitfalls | 1 day |
| [03-State-Management-Overview.md](03-State-Management-Overview.md) | Signal-based store pattern, when to reach for NgRx | 1 day |

## Estimated Time

4 days

## Next Phase

→ [Phase 10: Advanced Components](../Phase-10-Advanced-Components/README.md)
