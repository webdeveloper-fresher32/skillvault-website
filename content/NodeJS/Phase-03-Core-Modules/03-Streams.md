# Streams — Complete Guide

## Table of Contents
1. [Why Streams Exist](#1-why-streams-exist)
2. [The Four Stream Types](#2-the-four-stream-types)
3. [Readable Streams](#3-readable-streams)
4. [Writable Streams](#4-writable-streams)
5. [Piping Streams Together](#5-piping-streams-together)
6. [Backpressure Explained](#6-backpressure-explained)
7. [Duplex and Transform Streams](#7-duplex-and-transform-streams)
8. [Real Example: Transforming a Large File Line by Line](#8-real-example-transforming-a-large-file-line-by-line)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why Streams Exist

Without streams, processing a file means loading the ENTIRE thing into memory first.

```javascript
// Loads the whole 2GB file into RAM before you can do anything with it
const fs = require('fs/promises');
const data = await fs.readFile('huge-video.mp4'); // 💥 out of memory on a large file
```

```
Without streams:                     With streams:
┌──────────────────────┐             ┌────┐ ┌────┐ ┌────┐ ┌────┐
│  ENTIRE 2GB FILE      │             │chunk│chunk│chunk│chunk│  processed
│  loaded into RAM      │   vs.       └────┘ └────┘ └────┘ └────┘  one chunk
│  before processing    │              read → process → write, repeat  at a time,
│  even STARTS          │              memory usage stays flat (~64KB)  constant
└──────────────────────┘                                              memory
```

Streams process data in small chunks as it arrives, instead of waiting for the whole thing. This is how Node handles large files, HTTP request/response bodies, and video/audio without exhausting memory. Every HTTP request and response in Node (and therefore in Express) IS a stream.

---

## 2. The Four Stream Types

| Type | Direction | Examples |
|------|-----------|----------|
| **Readable** | Data flows OUT of it (you consume) | `fs.createReadStream()`, incoming HTTP request body |
| **Writable** | Data flows IN to it (you write) | `fs.createWriteStream()`, outgoing HTTP response |
| **Duplex** | Both readable AND writable (independent) | TCP sockets |
| **Transform** | Duplex where output is a transformation of input | `zlib.createGzip()`, custom line-processors |

```
Readable  ──▶ [ data out ]

[ data in ] ──▶  Writable

Duplex:   [ data in ] ──▶ ──▶ [ data out ]   (two independent channels)

Transform: [ data in ] ──▶ [ modify ] ──▶ [ data out ]  (output derived from input)
```

---

## 3. Readable Streams

```javascript
const fs = require('fs');

const readable = fs.createReadStream('large-file.txt', {
  encoding: 'utf8',
  highWaterMark: 64 * 1024, // internal buffer size per chunk, default 64KB
});

readable.on('data', (chunk) => {
  console.log(`Received ${chunk.length} characters`);
});

readable.on('end', () => {
  console.log('No more data — stream finished');
});

readable.on('error', (err) => {
  console.error('Stream error:', err.message);
});
```

There are two modes for consuming a readable stream:
- **Flowing mode**: data is pushed to you via `'data'` events as fast as possible (shown above).
- **Paused mode**: you pull data manually by calling `.read()` — useful for finer control.

```javascript
readable.on('readable', () => {
  let chunk;
  while ((chunk = readable.read()) !== null) {
    console.log(`Read ${chunk.length} bytes`);
  }
});
```

---

## 4. Writable Streams

```javascript
const fs = require('fs');

const writable = fs.createWriteStream('output.txt');

writable.write('First line\n');
writable.write('Second line\n');
writable.end('Last line\n'); // signals no more data will be written

writable.on('finish', () => {
  console.log('All data has been flushed to the file');
});

writable.on('error', (err) => {
  console.error('Write error:', err.message);
});
```

`write()` returns a boolean:

```javascript
const canContinue = writable.write(largeChunk);
if (!canContinue) {
  console.log('Internal buffer full — should pause upstream data source');
}
```

This return value is the foundation of backpressure (see section 6).

---

## 5. Piping Streams Together

`.pipe()` connects a readable stream's output directly to a writable stream's input, and — critically — **automatically handles backpressure** for you.

```javascript
const fs = require('fs');

const readable = fs.createReadStream('input.txt');
const writable = fs.createWriteStream('output.txt');

readable.pipe(writable);

writable.on('finish', () => console.log('Copy complete'));
readable.on('error', (err) => console.error('Read error:', err));
writable.on('error', (err) => console.error('Write error:', err));
```

Piping through a transform (e.g., compression) is just chaining `.pipe()` calls:

```javascript
const fs = require('fs');
const zlib = require('zlib');

fs.createReadStream('input.txt')
  .pipe(zlib.createGzip())               // Transform stream: compresses chunks
  .pipe(fs.createWriteStream('input.txt.gz'));
```

```
fs.createReadStream ──pipe──▶ zlib.createGzip ──pipe──▶ fs.createWriteStream
     (Readable)                  (Transform)                  (Writable)
```

**Modern alternative:** `stream.pipeline()` (from the `stream` module) is preferred over raw `.pipe()` because it properly handles errors and cleans up streams if one of them fails partway through.

```javascript
const { pipeline } = require('stream/promises');
const fs = require('fs');
const zlib = require('zlib');

await pipeline(
  fs.createReadStream('input.txt'),
  zlib.createGzip(),
  fs.createWriteStream('input.txt.gz')
);
console.log('Pipeline succeeded — all streams closed cleanly');
```

---

## 6. Backpressure Explained

**Backpressure** is the mechanism that prevents a fast data producer from overwhelming a slow data consumer's memory buffer.

```
THE PROBLEM (no backpressure handling):

  Fast Readable                         Slow Writable
  (reads disk at                        (writes to a slow network
   500 MB/s)                             connection at 5 MB/s)

  ┌─────────┐   pushes chunks fast     ┌──────────────────────┐
  │ Reader  │ ───────────────────────▶ │ internal write buffer│
  └─────────┘                          │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← keeps growing
                                        │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │   unbounded
                                        └──────────────────────┘
                                              💥 OUT OF MEMORY


THE FIX (backpressure signaling):

  ┌─────────┐  1. write(chunk)         ┌──────────────────────┐
  │ Reader  │ ───────────────────────▶ │ internal write buffer│
  └─────────┘                          │  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░ │ (below highWaterMark)
       ▲                               └──────────────────────┘
       │  2. write() returns FALSE
       │     when buffer is full
       │
       │  3. Reader PAUSES itself, stops reading from disk
       │
       │  4. Writable emits 'drain' once buffer empties out
       │
       └──── 5. Reader RESUMES reading, cycle continues
```

**Manual backpressure handling** (what `.pipe()` does for you automatically):

```javascript
function manualPipe(readable, writable) {
  readable.on('data', (chunk) => {
    const canContinue = writable.write(chunk);
    if (!canContinue) {
      readable.pause();               // 3. slow down the source
      writable.once('drain', () => {  // 4. buffer emptied out
        readable.resume();            // 5. resume reading
      });
    }
  });

  readable.on('end', () => writable.end());
}
```

`.pipe()` and `stream.pipeline()` implement exactly this pause/resume/drain dance internally — this is the #1 reason to prefer `pipe()`/`pipeline()` over manually forwarding `'data'` events with `writable.write()` and no backpressure check.

---

## 7. Duplex and Transform Streams

**Duplex** streams are both readable and writable, but the two sides are independent (e.g., a TCP socket — what you write isn't related to what you read).

**Transform** streams are a special Duplex where the writable side feeds directly into the readable side after being transformed — you implement a `_transform()` method.

```javascript
const { Transform } = require('stream');

// A Transform stream that uppercases every chunk of text passing through
class UppercaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    const upper = chunk.toString().toUpperCase();
    this.push(upper);   // push the transformed data to the readable side
    callback();          // signal that this chunk is done processing
  }
}

process.stdin
  .pipe(new UppercaseTransform())
  .pipe(process.stdout);

// Try it: echo "hello world" | node this-script.js  →  prints "HELLO WORLD"
```

---

## 8. Real Example: Transforming a Large File Line by Line

A common real-world task: process a huge log/CSV file without loading it all into memory, transforming each line, and writing the result to a new file.

```javascript
const fs = require('fs');
const readline = require('readline');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

async function processLargeFile(inputPath, outputPath) {
  const readStream = fs.createReadStream(inputPath, { encoding: 'utf8' });
  const writeStream = fs.createWriteStream(outputPath);

  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity, // treat \r\n as a single line break
  });

  let lineNumber = 0;

  // readline.Interface is an event emitter, not itself pipeable, so we
  // manually forward transformed lines to the writable stream and respect
  // backpressure ourselves.
  for await (const line of rl) {
    lineNumber++;
    const transformed = `${lineNumber}: ${line.trim().toUpperCase()}\n`;

    const canContinue = writeStream.write(transformed);
    if (!canContinue) {
      // backpressure: wait for the writable buffer to drain before continuing
      await new Promise((resolve) => writeStream.once('drain', resolve));
    }
  }

  writeStream.end();
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  console.log(`Processed ${lineNumber} lines from ${inputPath} → ${outputPath}`);
}

processLargeFile('access.log', 'access-processed.log')
  .catch((err) => console.error('Processing failed:', err));
```

An equivalent, more idiomatic version using a custom **Transform** stream and `pipeline()` (preferred in production code, since `pipeline` guarantees cleanup on error):

```javascript
const fs = require('fs');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

class LineNumberer extends Transform {
  constructor() {
    super();
    this._buffer = '';
    this._lineNumber = 0;
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop(); // keep the last (possibly incomplete) line

    for (const line of lines) {
      this._lineNumber++;
      this.push(`${this._lineNumber}: ${line.trim().toUpperCase()}\n`);
    }
    callback();
  }

  _flush(callback) {
    // handle any leftover text that didn't end with a newline
    if (this._buffer) {
      this._lineNumber++;
      this.push(`${this._lineNumber}: ${this._buffer.trim().toUpperCase()}\n`);
    }
    callback();
  }
}

async function run() {
  await pipeline(
    fs.createReadStream('access.log', { encoding: 'utf8' }),
    new LineNumberer(),
    fs.createWriteStream('access-processed.log')
  );
  console.log('Done — memory usage stayed flat regardless of file size');
}

run().catch((err) => console.error('Pipeline failed:', err));
```

```
Memory profile of this approach for a 10GB log file:

  Naive (readFile + split + map + writeFile):  ~10GB+ RAM required, likely crashes
  Streaming (pipeline + Transform):             ~few MB RAM, constant regardless
                                                  of file size
```

---

## 9. Hands-On Exercises

**Exercise 1:** Use `fs.createReadStream` and `fs.createWriteStream` with `.pipe()` to copy a file. Log `'Copy complete'` when the writable stream emits `'finish'`.

**Exercise 2:** Build a custom `Transform` stream that removes blank lines from a text file, and use `pipeline()` to wire it between a read stream and a write stream.

**Exercise 3:** Create two files: one small (a few KB) and one large (tens of MB, e.g. by repeating text). Log `process.memoryUsage().heapUsed` before and after streaming-copying the large file versus after `fs.readFileSync`-then-`writeFileSync`-copying it. Compare the numbers.

**Exercise 4:** Implement manual backpressure handling (without `.pipe()`) copying one file to another: listen for `'data'`, call `writable.write()`, and `pause()`/`resume()` the readable stream based on the write() return value and the `'drain'` event.

**Exercise 5:** Pipe `fs.createReadStream('input.txt')` through `zlib.createGzip()` into `fs.createWriteStream('input.txt.gz')`, then reverse it with `zlib.createGunzip()` to decompress back to a new file, and confirm the decompressed content matches the original.

---

## 10. Interview Q&A

**Q: What problem do streams solve that reading an entire file into memory doesn't?**
Answer: Streams process data in small, fixed-size chunks as it becomes available, rather than requiring the entire dataset to be loaded into memory before processing can start. This keeps memory usage roughly constant regardless of file size, allows processing to begin immediately (lower latency), and makes it possible to work with files or data sources far larger than available RAM (e.g., streaming a multi-GB file or a live network connection).

**Q: What is backpressure, and why does it matter?**
Answer: Backpressure is the signaling mechanism that prevents a fast data producer (readable stream) from overwhelming a slower consumer (writable stream)'s internal buffer. When a writable stream's internal buffer exceeds its `highWaterMark`, `.write()` returns `false`, signaling the producer to pause. Once the buffer drains, the writable stream emits a `'drain'` event, signaling it's safe to resume. Without respecting this signal, a fast producer writing to a slow destination (e.g., a slow network socket) can cause unbounded memory growth and eventually crash the process.

**Q: How does `.pipe()` (or `stream.pipeline()`) relate to backpressure?**
Answer: `.pipe()` automatically implements the pause/write/drain/resume cycle for you — it checks the writable stream's return value, pauses the readable source when the buffer is full, and resumes it on `'drain'`. This is why manually forwarding `'data'` events into `writable.write()` without checking the return value is a common bug: it silently breaks backpressure and can exhaust memory under load. `stream.pipeline()` does the same thing as `.pipe()` but additionally guarantees proper cleanup and error propagation across the whole chain if any stream in it fails.

**Q: What are the four fundamental stream types in Node, and how does a Transform stream differ from a Duplex stream?**
Answer: Readable (data flows out, e.g. `fs.createReadStream`), Writable (data flows in, e.g. `fs.createWriteStream`), Duplex (both directions, independent of each other, e.g. a TCP socket), and Transform (a specialized Duplex where the readable output is a direct transformation of the writable input, e.g. `zlib.createGzip` or a custom line-processing stream). The key difference: in a plain Duplex, what you read has no necessary relationship to what you wrote; in a Transform, the output IS derived from the input via a `_transform()` method you implement.

**Q: Why is `stream.pipeline()` generally preferred over chaining raw `.pipe()` calls in production code?**
Answer: `pipeline()` automatically forwards errors from any stream in the chain and ensures all streams are properly destroyed/cleaned up if one of them errors or is prematurely closed. With plain `.pipe()` chains, an error in a middle stream doesn't automatically propagate or trigger cleanup of the other streams, which can lead to resource leaks (unclosed file descriptors) or silently hung processes. `pipeline()` (especially the promise-based version from `stream/promises`) also integrates cleanly with `async`/`await` and try/catch.

**Q: How would you process a huge log file line by line without loading it entirely into memory?**
Answer: Use `fs.createReadStream()` to read the file in chunks rather than `fs.readFile()`, and consume it either with Node's built-in `readline` module (which emits complete lines as events, handling the chunk-to-line splitting for you) or with a custom `Transform` stream that buffers partial lines and emits complete ones. Write the transformed output using a writable stream (or via `pipeline()`), and respect backpressure by checking `write()`'s return value or letting `pipeline()`/`.pipe()` manage it — this keeps memory usage flat regardless of the file's total size.
