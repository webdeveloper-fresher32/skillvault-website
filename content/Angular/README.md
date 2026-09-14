# Angular — Modern Frontend Development Course

Master Angular from the ground up, focusing heavily on **Modern Angular** (v17+) patterns: Standalone Components, Signals, new Control Flow (`@if`, `@for`), and Deferrable Views. This course is designed to take you from fundamentals to building highly performant, production-grade enterprise applications.

This course assumes a basic understanding of JavaScript/TypeScript and web development concepts. While we do a brief review of TypeScript and RxJS in Phase 01, you'll be hitting the ground running. 

---

## Course Structure

```text
Angular/
├── Phase-01-TypeScript-and-RxJS-Basics/ → Types, Interfaces, Generics, RxJS Observables, Subjects
├── Phase-02-Angular-CLI-and-Workspace/  → Setup, ng commands, workspace config
├── Phase-03-Components-and-Templates/   → Standalone components, interpolation, bindings, control flow
├── Phase-04-Directives-and-Pipes/       → Built-in directives, custom directives, custom pipes
├── Phase-05-Services-and-DI/            → Dependency Injection, Injectable, providers, hierarchical DI
├── Phase-06-Routing-and-Navigation/     → Router, route parameters, lazy loading, guards, resolvers
├── Phase-07-Forms/                      → Reactive Forms (primary), Template-driven forms, validation
├── Phase-08-HTTP-and-Interceptors/      → HttpClient, interceptors, error handling, retries
├── Phase-09-Signals-and-State/          → Signals API, computed, effect, State management overview
├── Phase-10-Advanced-Components/        → Content projection, ViewChild/ContentChild, lifecycle hooks
├── Phase-11-Testing/                    → Unit testing (Jasmine/Karma), e2e basics
├── Phase-12-Performance-and-Deployment/ → SSR, Hydration, Prerendering, ChangeDetectionStrategy, Build optimization
├── Quick-Reference/                     → Cheatsheet + 50 interview Q&A
└── Projects/                            → 6 hands-on projects: Recipe Card Gallery → Task Manager → Bookstore Catalog → E-commerce Storefront → Real-Time Dashboard → Production-Ready Blog Platform
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | TypeScript & RxJS Basics | Beginner | 2 days |
| 02 | Angular CLI & Workspace | Beginner | 1 day |
| 03 | Components & Templates | Beginner | 3 days |
| 04 | Directives & Pipes | Intermediate | 2 days |
| 05 | Services & DI | Intermediate | 2 days |
| 06 | Routing & Navigation | Intermediate | 3 days |
| 07 | Forms | Intermediate | 3 days |
| 08 | HTTP & Interceptors | Intermediate | 2 days |
| 09 | Signals & State | Advanced | 4 days |
| 10 | Advanced Components | Advanced | 3 days |
| 11 | Testing | Intermediate | 3 days |
| 12 | Performance & Deployment| Advanced | 3 days |

**Total estimated time: 4-6 weeks**

---

## Prerequisites

- Solid JavaScript fundamentals (ES6+ syntax, Promises, Closures)
- Basic understanding of HTML and CSS
- Node.js installed locally

## How to Use This Course

1. Work through Phases 01-09 sequentially. Signals (Phase 09) represent the new reactive paradigm in Angular, but understanding Components and Services (Phases 03 & 05) first is mandatory.
2. We focus on **Standalone Components** over `NgModules`. Traditional NgModules are mentioned briefly as you will see them in legacy codebases, but our primary focus is modern, boilerplate-free Angular.
3. Build the projects in `Projects/` folder yourself. Angular is a very structured framework, and building muscle memory with its CLI and structure is crucial.
4. Use `Quick-Reference/Angular-Cheatsheet.md` for syntax review, especially for the new control flow blocks (`@if`, `@for`).
