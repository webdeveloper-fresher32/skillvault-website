# Phase 6: Server Actions and Forms

## What You'll Learn

How to write and call Server Actions as the direct, function-call replacement for hand-built mutation endpoints, how to wire them into forms that keep working even without client-side JavaScript, and how to give users immediate pending and optimistic feedback while a Server Action's server round trip is still in flight.

## Learning Objectives

- Write Server Actions with `"use server"` and call them directly from Server and Client Components, understanding how a function reference crosses the server/client boundary without shipping executable code to the browser.
- Build forms wired to Server Actions via `<form action={...}>` that submit correctly whether or not JavaScript has loaded, and read submitted values through `FormData`.
- Add pending and optimistic UI state with `useFormStatus`, `useOptimistic`, and `useActionState`, and correctly handle the failure/rollback path an optimistic update introduces.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Server-Actions-Basics.md](01-Server-Actions-Basics.md) | What a Server Action is; how a function reference crosses the Server-to-Client boundary; comparing a Server Action to a Route Handler | 1 day |
| [02-Forms-and-Progressive-Enhancement.md](02-Forms-and-Progressive-Enhancement.md) | Why `<form action={serverAction}>` still works without JavaScript; reading fields via `formData.get`; traditional forms vs Server-Action-powered forms | 1 day |
| [03-Optimistic-UI-and-Pending-State.md](03-Optimistic-UI-and-Pending-State.md) | `useFormStatus` pending state; `useOptimistic` optimistic updates and rollback; `useActionState` for combined result/pending tracking | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 7: Middleware and Authentication](../Phase-07-Middleware-and-Authentication/README.md)
