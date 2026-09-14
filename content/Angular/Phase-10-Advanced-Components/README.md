# Phase 10: Advanced Components

## What You'll Learn

Go deep on the component lifecycle and the tools Angular gives you to compose flexible, reusable components. You'll learn exactly when each lifecycle hook fires, how to accept arbitrary template content via content projection, and how a parent can reach into a child (or a component can reach into its own template) using ViewChild/ContentChild and the modern signal-based query functions.

## Learning Objectives

- Explain every component lifecycle hook, its execution order, and when to use it
- Use `ng-content` for single- and multi-slot content projection
- Pass templates as data with `ng-template` and `ngTemplateOutlet`
- Query child components and DOM elements with `@ViewChild`/`@ContentChild` and the signal-based `viewChild()`/`contentChild()` functions
- Build reusable structural components (cards, modals, tabs) that compose cleanly with projected content

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Lifecycle-Hooks.md](01-Lifecycle-Hooks.md) | Full component lifecycle, execution order, hook-by-hook use cases and pitfalls | 1 day |
| [02-Content-Projection.md](02-Content-Projection.md) | ng-content, multi-slot projection, ng-template, ngTemplateOutlet | 1 day |
| [03-ViewChild-and-ContentChild.md](03-ViewChild-and-ContentChild.md) | @ViewChild/@ContentChild, static vs dynamic, signal-based queries | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 11: Testing](../Phase-11-Testing/README.md)
