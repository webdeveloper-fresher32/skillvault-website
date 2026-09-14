# Global Objects and process — Complete Guide

## Table of Contents
1. [The global Object](#1-the-global-object)
2. [The process Object](#2-the-process-object)
3. [process.argv — Command-Line Arguments](#3-processargv--command-line-arguments)
4. [process.env — Environment Variables](#4-processenv--environment-variables)
5. [process.exit and Exit Codes](#5-processexit-and-exit-codes)
6. [__dirname and __filename](#6-__dirname-and-__filename)
7. [Buffer Basics](#7-buffer-basics)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The global Object

Just as browsers give every script a `window` object holding global functions and values, Node gives every script a `global` object.

```
Browser:  window.setTimeout, window.console, window.alert...
Node.js:  global.setTimeout, global.console, global.process...
```

```javascript
console.log(typeof global);       // "object"
console.log(global.console === console); // true — console is a property of global

globalThis.myValue = 42;    // globalThis works identically in both Node and browsers
console.log(global.myValue); // 42 — global and globalThis refer to the same object in Node
```

`globalThis` is a newer, standardized way (added to the JS language itself, not Node-specific) to access the global object regardless of environment — `globalThis` is `window` in a browser and `global` in Node, so writing environment-agnostic code should prefer `globalThis` over hardcoding `global` or `window`.

Common things available globally in Node without any `require`/`import`:

| Global | What it is |
|---|---|
| `console` | Logging (`console.log`, `console.error`, `console.table`, etc.) |
| `process` | Info and control over the current Node process (Section 2) |
| `Buffer` | Handling raw binary data (Section 7) |
| `setTimeout` / `setInterval` / `clearTimeout` / `clearInterval` | Timers, same API shape as the browser |
| `setImmediate` | Node-only — schedules a callback to run right after the current event loop phase |
| `queueMicrotask` | Schedules a microtask, same as in browsers |
| `URL`, `URLSearchParams` | Same Web API classes available in browsers, also global in Node |
| `fetch` | Available globally since Node 18 — no import needed for basic HTTP requests |

> **Note:** `require`, `module`, `exports`, `__dirname`, and `__filename` *look* like globals but technically are not — they are injected per-file by the CommonJS wrapper function (see Lesson 3), which is why they're unavailable in ESM files without extra work.

```javascript
// Available immediately, no import, in any CJS or ESM Node file:
console.log(process.version);   // e.g. v20.11.1
console.log(typeof Buffer);      // "function"
console.log(typeof fetch);       // "function" (Node 18+)
```

---

## 2. The process Object

`process` is Node's window into the currently running program itself — what's it called, what arguments did it receive, what environment variables exist, what platform is it running on, and how do you control its lifecycle.

```
┌─────────────────────────────────────────────────────────┐
│                    process object                        │
│                                                            │
│  process.argv        → command-line arguments             │
│  process.env         → environment variables              │
│  process.platform    → 'darwin' | 'linux' | 'win32'       │
│  process.version     → Node version string                │
│  process.pid          → OS process ID                     │
│  process.cwd()        → current working directory         │
│  process.exit(code)   → terminate the process             │
│  process.on('exit')   → hook into process lifecycle events│
│  process.stdout/stdin → streams for I/O                   │
│  process.memoryUsage()→ memory stats                      │
└─────────────────────────────────────────────────────────┘
```

```javascript
console.log(process.pid);         // e.g. 42193 — this OS process's ID
console.log(process.platform);     // 'darwin' (mac), 'linux', or 'win32'
console.log(process.version);      // 'v20.11.1'
console.log(process.cwd());        // the directory node was launched from
```

---

## 3. process.argv — Command-Line Arguments

`process.argv` is an array of strings containing the command used to launch the process, plus any extra arguments passed on the command line.

```bash
node script.js hello world --port=3000
```

```javascript
// script.js
console.log(process.argv);
// [
//   '/usr/local/bin/node',              // argv[0]: path to the node binary
//   '/Users/you/project/script.js',      // argv[1]: path to the script being run
//   'hello',                              // argv[2]: first real argument
//   'world',                              // argv[3]: second real argument
//   '--port=3000'                         // argv[4]: third real argument
// ]
```

In practice, you almost always slice off the first two entries to get just the "real" arguments your script cares about:

```javascript
const args = process.argv.slice(2);
console.log(args); // ['hello', 'world', '--port=3000']
```

A tiny CLI argument parser:

```javascript
// cli.js
const args = process.argv.slice(2);

const options = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    options[key] = value ?? true;
  }
}

console.log(options);
```

```bash
node cli.js --port=3000 --verbose
# { port: '3000', verbose: true }
```

For anything beyond trivial parsing, real projects use a library like `commander` or `yargs` — but understanding raw `process.argv` is essential since those libraries are just convenient wrappers around exactly this array.

---

## 4. process.env — Environment Variables

`process.env` is an object exposing all environment variables available to the Node process — the same concept as `os.environ` in Python.

```bash
PORT=3000 NODE_ENV=production node server.js
```

```javascript
// server.js
console.log(process.env.PORT);       // '3000'  (always a string, never a number!)
console.log(process.env.NODE_ENV);   // 'production'
console.log(process.env.HOME);        // e.g. '/Users/you' — inherited from the OS shell
```

A very common real-world pattern — reading config with sensible fallbacks:

```javascript
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

console.log(`Starting server on port ${PORT} (production: ${isProduction})`);
```

`NODE_ENV` is a widely-used (but not Node-built-in — purely conventional) environment variable to distinguish `development`, `production`, and `test` behavior. Libraries like Express check it to decide whether to show detailed error stack traces (development) or generic error messages (production).

```
Important gotcha: every value in process.env is ALWAYS a string.

process.env.PORT           // '3000'  (string)
process.env.PORT === 3000   // false — comparing string to number!
Number(process.env.PORT) === 3000   // true — must convert explicitly
```

In real projects, secrets and config (database URLs, API keys, ports) are kept out of source code and out of git entirely, typically loaded from a `.env` file (via a package like `dotenv`) into `process.env` at startup — you'll cover this pattern in the Express phase of this course.

---

## 5. process.exit and Exit Codes

`process.exit([code])` immediately terminates the Node process with the given exit code.

```
Exit code 0  → success (the default if the script finishes naturally with no errors)
Exit code 1  → generic failure/error
Exit code >1 → custom failure codes, meaningful to whoever runs the script (e.g. shell scripts, CI)
```

```javascript
console.log('Starting work...');

const success = doSomeCheck();

if (!success) {
  console.error('Check failed!');
  process.exit(1);   // terminate immediately with a failure code
}

console.log('This line never runs if process.exit(1) was called above');
```

Why exit codes matter: shell scripts, CI pipelines, and process managers (like Docker, PM2, or Kubernetes — covered elsewhere in this repo) inspect the exit code to decide whether a command "succeeded." A non-zero exit code from your Node script tells the calling system "something went wrong," triggering pipeline failures, container restarts, or alerts.

```bash
node script.js; echo "Exit code was: $?"
```

**Caution:** calling `process.exit()` abruptly can cut off pending asynchronous operations (like an in-flight database write or unflushed log output) — it does not wait for the event loop to drain. In production servers, it's usually better to let the process exit naturally by closing servers/connections gracefully, and reserve `process.exit()` for CLI scripts or fatal startup errors.

You can also listen for the exit event to run cleanup logic right before the process actually terminates:

```javascript
process.on('exit', (code) => {
  console.log(`About to exit with code: ${code}`);
});
```

---

## 6. __dirname and __filename

These two values give you the absolute filesystem location of the currently executing file — essential for building reliable file paths that don't depend on which directory you happened to run `node` from.

```javascript
// Assume this file lives at /Users/you/project/src/app.js

console.log(__filename); // /Users/you/project/src/app.js
console.log(__dirname);  // /Users/you/project/src
```

```
Why not just use a relative path like './config.json'?

'./config.json' is resolved relative to process.cwd()
   (the directory you TYPED `node` from), NOT relative to
   the file's own location!

If you run:  node src/app.js         from /Users/you/project
  process.cwd()  → /Users/you/project
  __dirname       → /Users/you/project/src

If you run:  node app.js             from /Users/you/project/src
  process.cwd()  → /Users/you/project/src
  __dirname       → /Users/you/project/src  (unchanged — it's about the FILE, not launch location)
```

The safe, portable pattern for building file paths is always to join against `__dirname`, never to hardcode a relative string alone:

```javascript
const path = require('path');

const configPath = path.join(__dirname, 'config.json'); // always correct,
                                                          // regardless of cwd
const data = require(configPath);
```

**Important: `__dirname` and `__filename` only exist in CommonJS files.** In ESM files (`.mjs`, or `.js` with `"type": "module"`), you must derive the equivalent yourself from `import.meta.url` (shown in Lesson 3):

```javascript
// ESM equivalent
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

---

## 7. Buffer Basics

JavaScript strings are great for text, but they can't natively represent raw binary data (image bytes, file contents, network packets). `Buffer` is a Node global class built exactly for that — a fixed-size chunk of raw memory, similar in spirit to Python's `bytes`.

```
String:  a sequence of UTF-16 code units — meant for TEXT
Buffer:  a sequence of raw bytes (0-255 each) — meant for BINARY DATA
```

```javascript
// Creating buffers
const buf1 = Buffer.from('hello');           // from a string (UTF-8 by default)
const buf2 = Buffer.alloc(10);                // 10 zero-filled bytes
const buf3 = Buffer.from([72, 101, 108, 108, 111]); // from raw byte values

console.log(buf1);              // <Buffer 68 65 6c 6c 6f>  — hex representation
console.log(buf1.toString());    // 'hello' — convert back to a readable string
console.log(buf1.length);        // 5 — number of bytes, not characters (matters for multi-byte UTF-8)

// Buffers are commonly what you get back from file reads and network data:
const fs = require('fs');
const fileBuffer = fs.readFileSync('image.png');
console.log(fileBuffer instanceof Buffer); // true
console.log(fileBuffer.length);             // size in bytes
```

```javascript
// Encoding matters when converting between strings and buffers
const buf = Buffer.from('héllo', 'utf8');
console.log(buf.length);            // 6 — 'é' takes 2 bytes in UTF-8, not 1!
console.log(buf.toString('utf8'));  // 'héllo' — decoded correctly

console.log(Buffer.from('68656c6c6f', 'hex').toString());   // 'hello'
console.log(Buffer.from('aGVsbG8=', 'base64').toString());  // 'hello'
```

You'll encounter `Buffer` constantly once you get to Express and file/network handling: request bodies arrive as buffers/streams of buffers before being parsed into strings or JSON, and reading/writing files with `fs` deals in buffers unless you explicitly request string encoding.

```javascript
const fs = require('fs');

// Returns a Buffer:
const raw = fs.readFileSync('notes.txt');

// Returns a string directly, because we specified an encoding:
const text = fs.readFileSync('notes.txt', 'utf8');
```

---

## 8. Hands-On Exercises

**Exercise 1:** Write a script `info.js` that logs `process.pid`, `process.platform`, `process.version`, and `process.cwd()`. Run it from two different directories using an absolute path (`node /full/path/info.js`) and confirm `process.cwd()` changes while `__dirname` (also logged) stays the same.

**Exercise 2:** Write `greet.js` that reads a name from `process.argv` (e.g., `node greet.js Alice` should print `Hello, Alice!`). Handle the case where no name is provided by printing a usage message and calling `process.exit(1)`.

**Exercise 3:** Write `config.js` that reads `process.env.PORT`, falling back to `3000` if unset, and logs `Server would start on port <PORT>`. Run it twice: once as `node config.js` and once as `PORT=8080 node config.js`, confirming the fallback works correctly.

**Exercise 4:** Write a script that creates a `Buffer` from the string `"Node.js"`, logs its raw byte representation, its `.length`, and its `.toString()` result. Then create a buffer from a string containing an emoji (e.g., `"🚀"`) and observe that `.length` is greater than the number of visible characters, due to multi-byte UTF-8 encoding.

**Exercise 5:** Write a script that registers a `process.on('exit', ...)` listener logging `"Goodbye, exit code: <code>"`, then calls `process.exit(2)` partway through. Run it and confirm both the exit-code number in the log and the shell's reported exit code (check with `echo $?` after running) both show `2`.

---

## 9. Interview Q&A

**Q: What is the `process` object in Node.js, and what are some of its most commonly used properties?**
Answer: `process` is a global object that provides information about and control over the currently running Node.js process. Commonly used members include `process.argv` (command-line arguments as an array), `process.env` (environment variables), `process.exit(code)` (terminate the process with a given exit code), `process.cwd()` (current working directory), `process.platform`, and `process.version`. It's essential for building CLI tools and for reading runtime configuration in servers.

**Q: Why are all values in `process.env` strings, and why does that matter?**
Answer: Environment variables are a shell/OS-level concept, and the OS only stores and passes them as plain text key-value strings — there's no concept of a "number" or "boolean" environment variable at that layer. So `process.env.PORT` is always the string `'3000'`, never the number `3000`. This matters because comparing `process.env.PORT === 3000` will always be `false`; you must explicitly convert with `Number(process.env.PORT)` or `parseInt()` before doing numeric comparisons or arithmetic.

**Q: What is the difference between `__dirname` and `process.cwd()`?**
Answer: `__dirname` is the absolute path to the directory containing the currently executing file — it's fixed based on where the file physically lives on disk and never changes regardless of how the script was invoked. `process.cwd()` is the current working directory of the Node process itself — the directory the user was in when they typed the `node` command — and can differ from `__dirname` if the script was launched from a different location than where the file resides. For building reliable file paths, `__dirname` (joined with `path.join`) should almost always be preferred over relying on relative paths that implicitly depend on `process.cwd()`.

**Q: What does `process.exit()` do, and why is calling it abruptly considered risky in a running server?**
Answer: `process.exit([code])` immediately terminates the Node process with the given exit code, where `0` conventionally means success and any non-zero value signals failure to whatever invoked the script (shell, CI, process manager). The risk is that it terminates immediately without waiting for pending asynchronous work — like an in-flight database write, an HTTP response being sent, or buffered log output — to complete, potentially causing data loss or truncated output. In long-running servers, it's generally safer to close connections and servers gracefully and let the process exit naturally once the event loop has nothing left to do, reserving explicit `process.exit()` calls for CLI tools or genuinely fatal startup errors.

**Q: What is a Buffer in Node.js, and why does JavaScript need it when it already has strings?**
Answer: A `Buffer` is Node's built-in class for handling raw binary data — a fixed-length sequence of bytes, similar to Python's `bytes` type. JavaScript strings are sequences of UTF-16 code units designed for text and cannot faithfully or efficiently represent arbitrary binary data such as image bytes, file contents, or raw network packets. `Buffer` fills that gap, and it's what you get back by default when reading files or handling raw request bodies in Node — you convert to a string explicitly (e.g., `buffer.toString('utf8')`) only once you know the data represents text in a known encoding.

**Q: How would you read a command-line argument passed to a Node script, and what does `process.argv` actually contain?**
Answer: `process.argv` is an array where index 0 is the path to the Node executable, index 1 is the path to the script being run, and index 2 onward are the actual arguments the user typed. In practice, you almost always call `process.argv.slice(2)` to discard the first two entries and work only with the real arguments, then parse flags like `--port=3000` manually or with a library such as `commander` or `yargs` for anything beyond the simplest cases.
