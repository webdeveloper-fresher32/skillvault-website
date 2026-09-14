# Phase 01 — Node.js Fundamentals

## What This Phase Covers

This phase builds the foundation you need before touching Express or any backend framework. You'll learn what Node.js actually is (and isn't), how its runtime differs from the browser JavaScript you already know from React, how to manage packages with npm, how modules work (both the old CommonJS way and the modern ESM way), and the built-in globals every Node script has access to.

If you're coming from Python + React, think of this phase as: "everything Django/Flask assumed a web server already gave you, plus everything `npm install` does that `pip install` also does — but explained from the Node side."

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | [01-What-is-Nodejs.md](./01-What-is-Nodejs.md) | What Node.js is, the V8 engine, JS on the server, Node vs browser environment, single-threaded model |
| 02 | [02-Installation-and-npm-Basics.md](./02-Installation-and-npm-Basics.md) | Installing Node, `node`/`npm`/`npx`, `package.json`, `npm install`/scripts, semver, dependencies vs devDependencies, `node_modules`, lockfiles |
| 03 | [03-Modules-CommonJS-and-ESM.md](./03-Modules-CommonJS-and-ESM.md) | `require`/`module.exports` vs `import`/`export`, CommonJS resolution algorithm, CJS/ESM interop, `"type": "module"` |
| 04 | [04-Global-Objects-and-Process.md](./04-Global-Objects-and-Process.md) | `global`, `process` (`argv`, `env`, `exit`), `__dirname`/`__filename`, `Buffer` basics |
| 05 | [05-NPM-Ecosystem-and-Semantic-Versioning.md](./05-NPM-Ecosystem-and-Semantic-Versioning.md) | npm registry, publishing basics, semver ranges (`^`, `~`), lockfiles, npm vs yarn vs pnpm |

## Estimated Time

**4–6 hours** total (roughly 1 hour per lesson, plus exercises). If you already know JavaScript well from React, you can move quickly through lessons 1 and 3; budget more time for lesson 5 if semver ranges are new to you.

## Prerequisites

- Working knowledge of JavaScript (variables, functions, arrays/objects, `async`/`await`).
- A terminal and a code editor. No prior Node.js experience required.

## What You Should Be Able to Do After This Phase

- Explain what Node.js is to a non-technical person and to an interviewer.
- Install Node, initialize a project, and manage dependencies confidently.
- Read and write both CommonJS and ES Module code, and know which one a given project is using.
- Use `process` and other globals to write small command-line scripts.
- Read a `package.json` and understand exactly what every field and version range means.
