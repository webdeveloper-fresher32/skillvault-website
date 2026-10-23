# Phase 8: Browser APIs

## What You'll Learn

Beyond the core language, browsers expose a large set of Web APIs that let JavaScript persist data, access hardware, interact with the system clipboard, and run code off the main thread. This phase covers the browser storage mechanisms (`localStorage`, `sessionStorage`, cookies), two commonly-tested hardware/system APIs (Geolocation and Clipboard, plus a look at Drag & Drop), and Web Workers — the browser's answer to running expensive JavaScript computation without freezing the UI. These APIs come up constantly in real front-end work: remembering a user's theme preference, building a "copy to clipboard" button, or offloading a heavy calculation so scrolling stays smooth.

## Learning Objectives

- Store, read, and remove data with `localStorage` and `sessionStorage`, and explain when each is appropriate
- Serialize and deserialize complex data for storage using `JSON.stringify`/`JSON.parse`
- Read and write cookies via `document.cookie`, including attributes like `expires`, `path`, and `SameSite`, and explain why JavaScript cannot set an `httpOnly` cookie
- React to cross-tab storage changes using the `storage` event
- Use the Geolocation API (`getCurrentPosition`, `watchPosition`) and handle permission denial and errors gracefully
- Use the Clipboard API (`readText`/`writeText`) to build copy/paste functionality
- Describe the basic mechanics of the Drag & Drop API
- Explain the difference between the main thread and a Web Worker thread, and when offloading work to a worker is worthwhile
- Communicate between the main thread and a worker using `postMessage`/`onmessage`
- List the limitations of Web Workers, including the lack of DOM access

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Storage-APIs.md](01-Storage-APIs.md) | `localStorage`, `sessionStorage`, cookies, `document.cookie` attributes, the `storage` event, JSON serialization | 2 days |
| [02-Geolocation-and-Clipboard.md](02-Geolocation-and-Clipboard.md) | Geolocation API, permissions and error handling, Clipboard API, Drag & Drop basics | 1 day |
| [03-Web-Workers.md](03-Web-Workers.md) | Main thread vs. worker thread, `postMessage`/`onmessage`, when to use workers, limitations | 2 days |

## Estimated Time

4–6 days

## Previous Phase

← [Phase 7: Modern JavaScript ES6+](../Phase-07-Modern-JavaScript-ES6/README.md)

## Next Phase

→ [Phase 9: Data Structures & Algorithms](../Phase-09-Data-Structures-Algorithms/README.md)
