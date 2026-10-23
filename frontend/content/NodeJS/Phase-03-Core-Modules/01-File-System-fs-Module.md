# The File System (`fs`) Module — Complete Guide

## Table of Contents
1. [Why the `fs` Module Has Three APIs](#1-why-the-fs-module-has-three-apis)
2. [Callback-Based (Async) API](#2-callback-based-async-api)
3. [Synchronous API](#3-synchronous-api)
4. [Promise-Based API (`fs/promises`)](#4-promise-based-api-fspromises)
5. [Reading and Writing Files](#5-reading-and-writing-files)
6. [Working with Directories](#6-working-with-directories)
7. [Watching Files for Changes](#7-watching-files-for-changes)
8. [Common Patterns](#8-common-patterns)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why the `fs` Module Has Three APIs

Node.js ships **three** ways to do the same file operation. This confuses developers coming from Python, where `open()` just works one way.

```
fs.readFileSync(...)         → blocks the event loop, returns value directly
fs.readFile(..., callback)   → non-blocking, result delivered via callback
fs.promises.readFile(...)    → non-blocking, result delivered via Promise (use with async/await)
```

Why three? Node evolved over time:
1. **Sync** existed first — simplest mental model, but freezes the entire process (bad for servers).
2. **Callback-based async** came next — Node's original non-blocking I/O pattern, but leads to "callback hell."
3. **Promise-based** (`fs/promises`, stable since Node 14) was added so `async`/`await` could be used cleanly.

```
Python analogy:
  with open('file.txt') as f:     ← Python's blocking I/O is fine because Python
      data = f.read()               web frameworks use separate processes/threads
                                     per request (WSGI workers, threads, etc.)

Node analogy:
  Node is SINGLE-THREADED and handles ALL requests on one thread.
  Blocking (fs.readFileSync) in a server = freezes EVERY connected client.
```

**Rule of thumb:** Use `fs/promises` with `async`/`await` for anything in a running server. Use `fs.*Sync` only at startup (e.g., reading a config file before the server starts listening) or in one-off scripts.

---

## 2. Callback-Based (Async) API

The original Node style. Every callback follows the **error-first callback** convention: `(err, result) => {}`.

```javascript
const fs = require('fs');

fs.readFile('data.txt', 'utf8', (err, contents) => {
  if (err) {
    console.error('Failed to read file:', err.message);
    return;
  }
  console.log(contents);
});

console.log('This logs BEFORE the file contents — readFile is non-blocking!');
```

```
Execution order:
  1. fs.readFile(...) is called → registered with libuv thread pool, returns immediately
  2. console.log('This logs BEFORE...') runs synchronously
  3. Event loop continues doing other work
  4. When the OS/thread pool finishes reading the file, the callback is queued
  5. Callback runs: prints file contents
```

Nested callbacks for multiple sequential operations get ugly fast ("callback hell") — this is exactly the problem `fs/promises` + `async/await` solves.

---

## 3. Synchronous API

Every async `fs` function has a `*Sync` counterpart. These block the entire event loop until the operation completes.

```javascript
const fs = require('fs');

try {
  const contents = fs.readFileSync('data.txt', 'utf8');
  console.log(contents);
} catch (err) {
  console.error('Failed to read file:', err.message);
}

console.log('This logs AFTER the file is fully read — readFileSync blocks!');
```

**When sync is actually fine:**
- Reading a config file once at application startup (before `app.listen()`).
- Simple CLI scripts / build tooling (not serving concurrent requests).
- Short-lived scripts where blocking doesn't hurt anyone.

**When sync is dangerous:**
- Inside an Express route handler — it will freeze the server for every other in-flight request while that one file reads.

---

## 4. Promise-Based API (`fs/promises`)

The recommended modern API for use inside `async` functions.

```javascript
const fs = require('fs/promises');

async function readConfig() {
  try {
    const contents = await fs.readFile('config.json', 'utf8');
    return JSON.parse(contents);
  } catch (err) {
    console.error('Failed to read config:', err.message);
    throw err;
  }
}

readConfig().then((config) => console.log(config));
```

```
Comparison side by side:

Callback:                          Promise + async/await:
fs.readFile('a.txt', 'utf8',       const a = await fs.readFile('a.txt', 'utf8');
  (err, a) => {                    const b = await fs.readFile('b.txt', 'utf8');
    fs.readFile('b.txt', 'utf8',   // reads run sequentially, code reads top-to-bottom
      (err, b) => {
        // finally use a and b
      });
  });
```

Reading multiple files **in parallel** with promises:

```javascript
const fs = require('fs/promises');

async function readAll() {
  const [a, b, c] = await Promise.all([
    fs.readFile('a.txt', 'utf8'),
    fs.readFile('b.txt', 'utf8'),
    fs.readFile('c.txt', 'utf8'),
  ]);
  console.log(a, b, c);
}

readAll();
```

---

## 5. Reading and Writing Files

```javascript
const fs = require('fs/promises');

// Write a file (creates it if it doesn't exist, overwrites if it does)
await fs.writeFile('output.txt', 'Hello, Node!\n', 'utf8');

// Append to a file
await fs.appendFile('output.txt', 'Another line.\n', 'utf8');

// Read a file as a string
const text = await fs.readFile('output.txt', 'utf8');

// Read a file as raw binary (no encoding argument → returns a Buffer)
const buffer = await fs.readFile('image.png');
console.log(buffer instanceof Buffer); // true

// Copy a file
await fs.copyFile('output.txt', 'backup.txt');

// Rename / move a file
await fs.rename('backup.txt', 'archive/backup.txt');

// Delete a file
await fs.unlink('output.txt');

// Check if a file exists (fs.exists is deprecated — use access or stat + try/catch)
try {
  await fs.access('data.txt');
  console.log('File exists');
} catch {
  console.log('File does not exist');
}

// Get file metadata
const stats = await fs.stat('data.txt');
console.log(stats.size, stats.isFile(), stats.isDirectory(), stats.mtime);
```

| Function | Purpose |
|----------|---------|
| `readFile(path, [encoding])` | Read entire file contents into memory |
| `writeFile(path, data)` | Write (overwrite) a file |
| `appendFile(path, data)` | Append to a file |
| `copyFile(src, dest)` | Copy a file |
| `rename(oldPath, newPath)` | Move/rename a file |
| `unlink(path)` | Delete a file |
| `access(path)` | Check existence/permissions (throws if inaccessible) |
| `stat(path)` | Get size, timestamps, type (file/dir) |

---

## 6. Working with Directories

```javascript
const fs = require('fs/promises');
const path = require('path');

// Create a directory (recursive: true creates parent dirs too, like `mkdir -p`)
await fs.mkdir('logs/2026/july', { recursive: true });

// List directory contents
const entries = await fs.readdir('logs');
console.log(entries); // ['2026']

// List with file type info (avoids extra stat calls)
const dirents = await fs.readdir('logs', { withFileTypes: true });
for (const dirent of dirents) {
  console.log(dirent.name, dirent.isDirectory() ? '(dir)' : '(file)');
}

// Remove a directory (must be empty unless recursive: true)
await fs.rm('logs', { recursive: true, force: true });

// Recursively walk a directory tree
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else {
      console.log(fullPath);
    }
  }
}

await walk('.');
```

---

## 7. Watching Files for Changes

Node can notify you when a file or directory changes — useful for building dev-server auto-reload, log tailing, or config hot-reloading.

```javascript
const fs = require('fs');

const watcher = fs.watch('config.json', (eventType, filename) => {
  // eventType is 'change' or 'rename'
  console.log(`${filename} triggered: ${eventType}`);
});

// Stop watching later
// watcher.close();
```

```
Caveats with fs.watch:
  - Behavior differs across OSes (macOS, Linux, Windows fire events differently).
  - Can fire multiple 'change' events for a single logical save (editors often
    write via a temp file + rename).
  - For production-grade file watching, most teams use the `chokidar` package,
    which normalizes these inconsistencies — but fs.watch is fine for simple
    scripts and understanding the underlying mechanism.
```

A simple debounced reload pattern:

```javascript
const fs = require('fs');

let timeout;
fs.watch('config.json', () => {
  clearTimeout(timeout);
  timeout = setTimeout(async () => {
    console.log('Config changed — reloading...');
    const fsp = require('fs/promises');
    const updated = JSON.parse(await fsp.readFile('config.json', 'utf8'));
    console.log(updated);
  }, 100); // wait 100ms for writes to settle
});
```

---

## 8. Common Patterns

**Pattern: Ensure a directory exists before writing to it**

```javascript
const fs = require('fs/promises');
const path = require('path');

async function safeWrite(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data, 'utf8');
}
```

**Pattern: Read JSON safely with a default fallback**

```javascript
const fs = require('fs/promises');

async function readJsonOrDefault(filePath, defaultValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue; // file doesn't exist yet
    throw err; // rethrow unexpected errors (e.g., invalid JSON, permissions)
  }
}
```

**Pattern: Never use `readFileSync`/`writeFileSync` inside a request handler**

```javascript
// BAD — blocks the event loop for every concurrent request
app.get('/report', (req, res) => {
  const data = fs.readFileSync('big-report.csv', 'utf8'); // freezes server
  res.send(data);
});

// GOOD — non-blocking
app.get('/report', async (req, res) => {
  const data = await fs.promises.readFile('big-report.csv', 'utf8');
  res.send(data);
});
```

---

## 9. Hands-On Exercises

**Exercise 1:** Write a script that creates a file `notes.txt` with the text `"Hello Node"`, then reads it back and prints it — using `fs/promises` and `async/await`.

**Exercise 2:** Write a function `appendLog(message)` that appends a timestamped line (e.g., `[2026-07-02T10:00:00.000Z] message`) to `app.log`, creating the file if it doesn't exist.

**Exercise 3:** Write a recursive `getAllFiles(dirPath)` function that returns an array of full paths to every file (not directory) under a given directory, using `fs.readdir` with `withFileTypes: true`.

**Exercise 4:** Compare timing: use `console.time`/`console.timeEnd` to measure `fs.readFileSync` vs `fs.promises.readFile` for a large file (e.g., a few MB), while a `setInterval` logs `"tick"` every 50ms in the background. Observe how many ticks get delayed by the sync call.

**Exercise 5:** Use `fs.watch` to watch a directory. Whenever a new file is added, log its name and automatically copy it into a `processed/` subdirectory.

---

## 10. Interview Q&A

**Q: Why does the `fs` module offer sync, callback, and promise-based versions of the same functions?**
Answer: They reflect Node's evolution. Sync functions block the event loop and return values directly — simplest but dangerous in a server context since Node is single-threaded and one blocking call freezes every connection. Callback-based functions were Node's original non-blocking pattern, using the error-first callback convention. Promise-based functions (`fs/promises`) were added later so `async`/`await` could be used, giving non-blocking behavior with synchronous-looking, more readable code. In production servers, `fs/promises` is preferred; sync is reserved for startup scripts.

**Q: What actually happens under the hood when you call `fs.readFile` (async)?**
Answer: Node hands the file read off to libuv's thread pool (since file I/O isn't natively async at the OS level on all platforms the way network I/O is). The main thread continues executing other code immediately. Once the worker thread completes the read, the result is queued as a callback (or promise resolution) to run on the main thread during a future event loop tick — it never blocks the single JS thread while waiting.

**Q: What's the danger of using `fs.readFileSync` inside an Express route handler?**
Answer: It blocks the entire event loop until the read finishes. Since Node handles all concurrent requests on one thread, every other client's request — even unrelated ones — is frozen for the duration of that disk read. Under load, or with a large/slow file, this causes latency spikes and can make the whole server appear to hang.

**Q: How do you check whether a file exists in modern Node, and why is `fs.exists` deprecated?**
Answer: Use `fs.access(path)` (throws if inaccessible) or `fs.stat(path)` wrapped in try/catch. `fs.exists` was deprecated because its callback signature (`callback(exists)`, no error argument) was inherently racy — checking existence and then acting on it in a separate call creates a TOCTOU (time-of-check to time-of-use) race condition, since the file's state can change between the check and the subsequent operation. The idiomatic pattern is to just attempt the operation and handle the `ENOENT` error.

**Q: What does `{ recursive: true }` do for `fs.mkdir` and `fs.rm`?**
Answer: For `mkdir`, it creates any missing parent directories along the path (like `mkdir -p`) instead of throwing if intermediate directories don't exist. For `rm`, it allows deleting a directory and all its contents recursively (like `rm -rf`) instead of only working on empty directories.

**Q: How would you read multiple files in parallel versus sequentially using promises?**
Answer: Sequentially: `await` each `fs.readFile` call one after another — each read waits for the previous to finish, total time is the sum of all reads. In parallel: kick off all reads first (without awaiting immediately), collect the promises into an array, then `await Promise.all([...])` — all reads happen concurrently (limited by the libuv thread pool size, default 4), and total time is roughly the slowest single read rather than the sum.
