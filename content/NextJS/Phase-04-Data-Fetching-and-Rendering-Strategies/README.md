# Phase 4: Data Fetching and Rendering Strategies

## What You'll Learn

How Server Components fetch data and control caching, how to choose between SSR/SSG/ISR for a given page's freshness needs, and how Suspense streams slow content independently instead of blocking the whole page.

## Learning Objectives

- Use `fetch`'s caching options (`force-cache`, `no-store`, `revalidate`) correctly inside Server Components.
- Choose between SSR, SSG, and ISR for a given page based on its data freshness and server-load requirements.
- Use `<Suspense>` to stream slow content independently of the rest of a page, and understand how it relates to `loading.js`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Fetch-and-Caching-in-Server-Components.md](01-Fetch-and-Caching-in-Server-Components.md) | Fetching data directly in Server Components; `fetch`'s `cache` and `next.revalidate` options; the Data Cache lifecycle | 1 day |
| [02-SSR-vs-SSG-vs-ISR.md](02-SSR-vs-SSG-vs-ISR.md) | Static Site Generation, Server-Side Rendering, and Incremental Static Regeneration; `generateStaticParams`; stale-while-revalidate behavior | 1 day |
| [03-Streaming-with-Suspense.md](03-Streaming-with-Suspense.md) | Streaming slow Server Components with `<Suspense>`; how it relates to `loading.js`; boundary placement | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 5: Route Handlers and API Routes](../Phase-05-Route-Handlers-and-API-Routes/README.md)
