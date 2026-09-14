# JavaScript Course — Design Spec

## Purpose

Add a new "JavaScript" course to SkillVault, matching the existing course structure (Docker, Kubernetes, MongoDB, MySQL, HLD). Audience: a full-stack developer who already knows some React, wants deep, interview-ready mastery of **pure JavaScript** — language fundamentals through Node.js backend depth. No frontend framework content (React/Vue/Angular/Next.js are explicitly out of scope) and no TypeScript (already covered by the existing TypeScript Deep-Dive Cheat Sheet).

## Structure

```
JavaScript/
├── Phase-01-Fundamentals/
├── Phase-02-Core-JavaScript/
├── Phase-03-Advanced-JavaScript/
├── Phase-04-DOM-Manipulation/
├── Phase-05-Asynchronous-JavaScript/
├── Phase-06-Object-Oriented-JavaScript/
├── Phase-07-Modern-JavaScript-ES6/
├── Phase-08-Browser-APIs/
├── Phase-09-Data-Structures-Algorithms/
├── Phase-10-Backend-JavaScript/
├── Phase-11-Production-Deployment/
├── Projects/
├── Quick-Reference/
└── README.md
```

11 phases (not 12 — no frontend-framework phase is included, per explicit user request).

## Phase Contents

1. **Fundamentals** — variables (`let`/`const`/`var`), data types, operators, conditionals, loops, functions, scope, template literals.
2. **Core JavaScript** — arrays, objects, string methods, array methods (`map`/`filter`/`reduce`/`find`/`forEach`), destructuring, spread/rest, default parameters.
3. **Advanced JavaScript** — execution context, call stack, hoisting, closures, lexical scope, `this`, arrow functions, callbacks, higher-order functions, recursion, IIFE, ES6 modules.
4. **DOM Manipulation** — selecting elements, styling, event listeners, forms, DOM traversal, creating/removing elements.
5. **Asynchronous JavaScript** — callbacks, Promises, async/await, Fetch API, error handling, JSON, event loop (microtask/macrotask queues).
6. **Object-Oriented JavaScript** — constructors, classes, inheritance, encapsulation, polymorphism, prototypes, prototype chain.
7. **Modern JavaScript (ES6+)** — optional chaining, nullish coalescing, Sets, Maps, generators, iterators (let/const/arrow/template literals/modules covered in earlier phases, referenced not repeated).
8. **Browser APIs** — localStorage/sessionStorage, cookies, geolocation, clipboard, drag & drop, Web Workers.
9. **Data Structures & Algorithms in JS** — arrays/strings, linked lists, stacks, queues, hash maps, trees, graphs, sorting, searching, recursion — implemented in plain JS.
10. **Backend JavaScript** — Node.js core (modules, fs, process), Express.js, REST APIs, JWT authentication, MongoDB driver basics, SQL basics, environment variables.
11. **Production & Deployment** — testing (Jest/Mocha basics), debugging, logging, environment config, CI/CD basics, deployment (Vercel/Render/PM2), best practices checklist.

Each phase folder: `README.md` (phase summary) + numbered lesson files (`01-Topic.md`, `02-Topic.md`, ...), 3 files per phase as the established convention, except where a phase's topic list naturally splits into more/fewer files (matching how other courses vary slightly).

## Projects/ (6, beginner → advanced)

1. To-Do List / Student Record System (DOM + core JS)
2. Weather App (Fetch API, async/await)
3. GitHub Profile Finder (Fetch API, DOM, error handling)
4. Notes App with Node/Express backend (Phase 10 applied)
5. Task Manager — full-stack with MongoDB (Phase 10 applied)
6. Blog CMS — full-stack capstone combining auth, REST API, DOM frontend, deployment (Phase 10 + 11 applied)

## Quick-Reference/

- `JavaScript-Cheatsheet.md` — syntax and API quick lookup across all phases.
- `Interview-QA.md` — 50 interview questions covering closures, hoisting, event loop, promises/async-await, `this`, prototypes, DOM, array methods, ES6+, modules, OOP (per user's stated interview-focus list).

## Top-level README.md

Course overview, course-structure diagram, learning-path table (Phase | Topic | Difficulty | Time), prerequisites, total estimated time — mirrors the Kubernetes README format exactly.

## Out of Scope

- Frontend frameworks (React, Next.js, Vue, Angular) — user already knows React; deep framework study is left to future, separate courses.
- TypeScript — covered by the existing TypeScript Deep-Dive Cheat Sheet elsewhere in the repo.
- LeetCode-style exhaustive DSA problem sets — Phase 9 covers concepts + canonical JS implementations, not a full problem bank (user has a separate DSA-prep workspace).
