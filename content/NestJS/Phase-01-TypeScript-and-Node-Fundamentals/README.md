# Phase 1: TypeScript & Node Fundamentals

## What You'll Learn

The TypeScript and Node.js machinery that NestJS is built on top of, before you touch a single Nest decorator. NestJS's dependency injection container looks like magic the first time you see `@Injectable()` and `@Controller()` make classes wire themselves together — this phase demystifies that by showing you decorators are just functions, metadata is just data stored on a class via `reflect-metadata`, and the "framework" is really a very disciplined use of ordinary JavaScript features. It also recaps the Node.js/Express fundamentals Nest sits on (event loop, HTTP cycle, middleware, routing) and the async patterns — Promises and RxJS Observables — that show up constantly in Nest's request pipeline (interceptors, in particular, return Observables, not Promises). Finishing this phase means nothing in later phases will feel like "magic you have to trust."

## Learning Objectives

- Explain what a TypeScript decorator actually is at runtime (a function invoked at class-definition time)
- Distinguish class, method, property, and parameter decorators and know when each fires
- Use `reflect-metadata`'s `Reflect.defineMetadata` / `Reflect.getMetadata` to attach and read metadata on classes and members
- Explain the role of the `experimentalDecorators` and `emitDecoratorMetadata` tsconfig flags
- Build a custom decorator + a reflection-based reader, mirroring (at a toy scale) how Nest's DI container discovers injectable dependencies
- Recap the Node.js event loop and the HTTP request/response cycle in the context of a web server
- Explain what Express actually does (middleware chain, router matching) and why Nest sits on top of it (or Fastify) instead of replacing it
- Recap Promises/async-await and explain why NestJS interceptors are built around RxJS Observables instead
- Use core RxJS operators (`map`, `tap`, `catchError`) and convert an Observable to a Promise with `lastValueFrom`

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Decorators-and-Metadata-Reflection.md](01-Decorators-and-Metadata-Reflection.md) | Decorators and Metadata Reflection — the mechanism behind Nest's "magic" | 1 day |
| [02-Node-and-Express-Fundamentals-Recap.md](02-Node-and-Express-Fundamentals-Recap.md) | Node & Express Fundamentals Recap — the HTTP layer Nest sits on | 6 hours |
| [03-Async-Patterns-and-RxJS-Primer.md](03-Async-Patterns-and-RxJS-Primer.md) | Async Patterns and RxJS Primer — Promises, Observables, and why Nest uses both | 6 hours |

## Estimated Time

2 days

## Next Phase

→ [Phase 2: Nest CLI and Project Structure](../Phase-02-Nest-CLI-and-Project-Structure/README.md)
