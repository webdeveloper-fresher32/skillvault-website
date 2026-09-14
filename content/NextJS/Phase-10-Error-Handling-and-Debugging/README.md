# Phase 10: Error Handling and Debugging

In this phase, we explore how to handle runtime errors and exceptions gracefully in a Next.js application, ensuring a robust user experience even when things go wrong. 

Next.js provides specialised conventions (`error.js`, `global-error.js`, `not-found.js`) built on top of React Error Boundaries to catch errors in specific route segments and display fallback UI without crashing the entire application.

## Learning Objectives

By the end of this phase, you will understand:
- How `error.js` works and how it isolates errors to specific route segments.
- How to implement and trigger `not-found.js` for 404 pages.
- The role of `global-error.js` in handling root layout errors.
- Best practices for debugging Next.js applications locally and in production.

## Files in this Phase

1. `01-Error-Boundaries-and-error-js.md`: Exploring the `error.js` convention and React Error Boundaries.
2. `02-Not-Found-and-Global-Error.md`: Handling 404s and root-level application errors.
3. `03-Debugging-Nextjs-Apps.md`: Tools and techniques for debugging Server and Client Components.
