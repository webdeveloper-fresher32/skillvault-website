# Phase 3: Server and Client Components

## What You'll Learn

Go deeper than Phase 1's basic Server/Client split into exactly how far the `"use client"` boundary propagates, how to compose interactive wrappers around server-rendered content, and what data is actually allowed to cross from server to browser.

## Learning Objectives

- Reason correctly about the client boundary's propagation through a component's own imports
- Use the children-as-slot composition pattern to display Server Component content inside a Client Component
- Know what can and can't cross the Server-to-Client serialization boundary

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-The-RSC-Client-Boundary.md](01-The-RSC-Client-Boundary.md) | Exactly how `"use client"` propagates downward through a file's own imports, and why it isn't inherited upward | 1 day |
| [02-Composition-Patterns.md](02-Composition-Patterns.md) | The children-as-slot pattern for displaying Server Component content inside a Client Component | 1 day |
| [03-Serialization-and-Boundary-Rules.md](03-Serialization-and-Boundary-Rules.md) | What must be serializable to cross as a prop from a Server Component to a Client Component, and the Server Action exception | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 4: Data Fetching and Rendering Strategies](../Phase-04-Data-Fetching-and-Rendering-Strategies/README.md)
