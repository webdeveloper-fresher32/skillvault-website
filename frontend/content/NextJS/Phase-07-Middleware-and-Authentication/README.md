# Phase 7: Middleware and Authentication

## What You'll Learn

How to run logic before a request reaches a specific route with Middleware, how to configure Auth.js for OAuth and credentials-based login, and how to layer coarse Middleware-level checks with fine-grained, data-specific authorization inside individual routes.

## Learning Objectives

- Write Middleware in `middleware.js` for pre-routing checks — redirects, rewrites, and matcher-based path targeting — understanding that it runs on the Edge runtime referenced in Phase 5, Lesson 3.
- Configure Auth.js for OAuth and Credentials-based login, understanding the difference between JWT and database session strategies and how the OAuth login flow actually works end to end.
- Layer coarse (Middleware-level) and fine-grained (component-level) route protection correctly, avoiding the mistake of trusting either one alone.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Middleware-Basics.md](01-Middleware-Basics.md) | What Middleware is; `middleware.js` and `config.matcher`; redirect vs rewrite vs next(); the Edge runtime it always runs on | 1 day |
| [02-Auth-Patterns-with-Auth-Js.md](02-Auth-Patterns-with-Auth-Js.md) | Why reach for Auth.js instead of hand-rolling auth; OAuth vs Credentials providers; the OAuth login flow; JWT vs database session strategies | 1 day |
| [03-Protecting-Routes-and-Sessions.md](03-Protecting-Routes-and-Sessions.md) | Layering a Middleware-level session check with a component-level, record-specific authorization check; why neither alone is sufficient | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 8: Styling and UI](../Phase-08-Styling-and-UI/README.md)
