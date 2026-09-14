# Phase 5: Route Handlers and API Routes

## What You'll Learn

How to build server endpoints that return raw data instead of rendered pages, how to read a request's path params, query string, and body precisely, and how to choose between the Node.js and Edge runtimes for a given Route Handler.

## Learning Objectives

- Write basic and dynamic Route Handlers using the `route.js` HTTP-method export convention.
- Correctly read a request's path params, query string, and JSON body, and shape a precise `Response`/`NextResponse`.
- Choose between the Node.js runtime and the Edge runtime for a given Route Handler based on its dependencies and latency needs.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Route-Handler-Basics.md](01-Route-Handler-Basics.md) | What a Route Handler is; the `route.js` HTTP-method export convention; why `page.js` and `route.js` can't coexist in one segment | 1 day |
| [02-Dynamic-Route-Handlers-and-Request-Response.md](02-Dynamic-Route-Handlers-and-Request-Response.md) | Dynamic segments and `params`; reading query parameters; reading and validating a JSON body; shaping a response | 1 day |
| [03-Node-vs-Edge-Runtime.md](03-Node-vs-Edge-Runtime.md) | The `runtime` export; what the Edge runtime restricts; choosing Node.js vs Edge for a given handler | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 6: Server Actions and Forms](../Phase-06-Server-Actions-and-Forms/README.md)
