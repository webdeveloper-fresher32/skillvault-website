# Phase 9: Caching and Performance

## What You'll Learn

How Next.js caches at four distinct layers simultaneously, how to trigger immediate cache invalidation right after a mutation instead of waiting on a timer, and how to control a route segment's rendering behavior and a component's client bundle size as two separate performance levers.

## Learning Objectives

- Name and reason about all four caching layers — Request Memoization, Data Cache, Full Route Cache, and Router Cache — including their scope, lifetime, and what actually clears each one.
- Use `revalidatePath` and `revalidateTag` for event-driven, on-demand invalidation right after a mutation, distinct from time-based `revalidate: N` (Phase 4).
- Use route segment config (`export const dynamic`, `export const revalidate`) and `next/dynamic` appropriately, understanding that one is a server-side rendering/caching concern and the other is a client-side bundle-size concern.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-The-Four-Caching-Layers.md](01-The-Four-Caching-Layers.md) | Request Memoization, Data Cache, Full Route Cache, Router Cache; tracing one page load through all four; debugging the right layer | 1 day |
| [02-Revalidation-Path-and-Tag.md](02-Revalidation-Path-and-Tag.md) | `revalidatePath` vs `revalidateTag` vs time-based `revalidate: N`; calling them from a Server Action right after a mutation | 1 day |
| [03-Route-Segment-Config-and-Bundle-Optimization.md](03-Route-Segment-Config-and-Bundle-Optimization.md) | `export const dynamic`/`revalidate` segment-wide overrides; `next/dynamic` for client bundle size; why these are separate concerns | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 10: Metadata, SEO, and Error Handling](../../../../04-SYSTEMS-INFRASTRUCTURE/04-Developer-Tools/Git/Phase-01-Git-Core-Architecture-and-Plumbing/README.md)
