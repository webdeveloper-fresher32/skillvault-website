# Phase 03 — Core Modules

This phase covers Node.js's built-in modules — the foundation everything else (including Express) is built on. Coming from Python or a React frontend, this is the closest analogue to Python's standard library (`os`, `pathlib`, `io`) plus the browser's DOM event model, but wired for a single-threaded, non-blocking runtime.

## Goals

- Understand the three flavors of Node's async APIs (callback, sync, promise) and when to use each.
- Handle files, paths, and OS info without shelling out or reaching for third-party packages.
- Understand streams and backpressure deeply enough to reason about memory usage in a Node process.
- Understand Buffers and binary data — critical for file uploads, image processing, and network protocols.
- Understand `EventEmitter`, since it is the base class behind `http.Server`, streams, and most of Node's async machinery.
- Build a raw HTTP server with the `http` module so that Express's abstractions ("magic") stop being magic.

## Files

| File | Topic |
|------|-------|
| `01-File-System-fs-Module.md` | Sync vs async vs promise-based `fs` APIs, reading/writing, directories, watching files |
| `02-Path-and-OS-Modules.md` | `path` module (join, resolve, basename, extname), cross-platform paths, `os` module |
| `03-Streams.md` | Readable/Writable/Duplex/Transform streams, piping, backpressure |
| `04-Buffers.md` | Binary data, encodings (utf8/base64/hex), buffer operations |
| `05-Events-and-EventEmitter.md` | `EventEmitter`, custom events, Node's event-driven architecture |
| `06-HTTP-Module-Raw-Server.md` | Raw `http` server — request/response, manual routing, headers, status codes |

## Why This Matters for Interviews

Interviewers regularly probe whether candidates who "only know Express" actually understand what's underneath it. Questions like "what is backpressure," "how does the event loop relate to EventEmitter," and "what does Express add on top of the `http` module" are extremely common for mid-to-senior Node roles. This phase exists to make sure those questions are trivial.

## Prerequisites

Phase 01 (Node fundamentals) and Phase 02 (the event loop / async model), since streams, `fs.promises`, and `EventEmitter` all lean on concepts covered there.
