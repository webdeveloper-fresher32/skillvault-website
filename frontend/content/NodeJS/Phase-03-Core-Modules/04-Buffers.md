# Buffers — Complete Guide

## Table of Contents
1. [What is a Buffer?](#1-what-is-a-buffer)
2. [Why Buffers Exist](#2-why-buffers-exist)
3. [Creating Buffers](#3-creating-buffers)
4. [Buffers vs Strings: Encodings](#4-buffers-vs-strings-encodings)
5. [Common Buffer Operations](#5-common-buffer-operations)
6. [Buffers and Streams](#6-buffers-and-streams)
7. [Common Patterns](#7-common-patterns)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a Buffer?

A `Buffer` is a fixed-size chunk of raw binary data, allocated outside the V8 JavaScript heap. Think of it as Node's equivalent of a byte array — a sequence of raw bytes (integers 0–255), with no inherent notion of "text" or "encoding" attached.

```
A Buffer is literally just this:

Index:   0    1    2    3    4
Value:  [72] [101][108][108][111]   ← raw bytes, each 0-255

Interpreted as UTF-8 text: "Hello"
Interpreted as hex:        "48 65 6c 6c 6f"
Interpreted as base64:     "SGVsbG8="

The BYTES never change — only how you choose to INTERPRET them changes.
```

Python analogy: `Buffer` is Node's rough equivalent of Python's `bytes`/`bytearray` — a raw byte sequence distinct from `str`, which requires an explicit encode/decode step to convert between the two.

---

## 2. Why Buffers Exist

JavaScript strings are UTF-16 encoded internally and were designed for text, not arbitrary binary data. But Node needs to handle binary data constantly:

- Reading files (images, videos, PDFs — not text)
- Network protocols (TCP packets are raw bytes)
- Cryptography (hashes, encryption keys are binary)
- File uploads / downloads
- Talking to databases at the protocol level

`Buffer` gives Node a way to work with raw bytes efficiently, without forcing everything through a text encoding.

```
Where you'll see Buffers without even asking for them:

  fs.readFile('image.png')              → resolves with a Buffer (no encoding given)
  req.on('data', chunk => ...)          → chunk is a Buffer (raw HTTP body bytes)
  crypto.createHash('sha256').digest()  → returns a Buffer
  net.Socket 'data' event               → Buffer (raw TCP bytes)
```

---

## 3. Creating Buffers

```javascript
// Allocate a buffer of a given size, zero-filled (SAFE — recommended)
const buf1 = Buffer.alloc(10);
console.log(buf1); // <Buffer 00 00 00 00 00 00 00 00 00 00>

// Allocate WITHOUT zeroing memory — faster, but may contain old/sensitive
// data left over in memory. Only use if you will immediately overwrite it.
const buf2 = Buffer.allocUnsafe(10);

// Create a buffer from a string (default encoding: utf8)
const buf3 = Buffer.from('Hello');
console.log(buf3); // <Buffer 48 65 6c 6c 6f>

// Create a buffer from an array of byte values
const buf4 = Buffer.from([72, 101, 108, 108, 111]);
console.log(buf4.toString()); // 'Hello'

// Create a buffer from a string with an explicit encoding
const buf5 = Buffer.from('48656c6c6f', 'hex');
console.log(buf5.toString()); // 'Hello'
```

**Never use `new Buffer()`** — it's deprecated (had ambiguous, unsafe behavior). Always use `Buffer.alloc`, `Buffer.allocUnsafe`, or `Buffer.from`.

---

## 4. Buffers vs Strings: Encodings

A Buffer holds bytes. A String holds characters. Converting between them requires an **encoding** — the rule for mapping bytes to characters and back.

```javascript
const buf = Buffer.from('Hello, Node!');

buf.toString('utf8');    // 'Hello, Node!'   (default — human-readable text)
buf.toString('base64');  // 'SGVsbG8sIE5vZGUh'  (compact, safe for JSON/URLs/email)
buf.toString('hex');     // '48656c6c6f2c204e6f646521'  (2 hex chars per byte, debugging)
buf.toString('ascii');   // 'Hello, Node!'   (7-bit only, loses data above 127)
buf.toString('latin1');  // 'Hello, Node!'   (1 byte per char, aka binary)
```

| Encoding | Use Case | Notes |
|----------|----------|-------|
| `utf8` (default) | Human-readable text, JSON payloads | Variable-width (1-4 bytes per character) |
| `base64` | Embedding binary in JSON/URLs/emails, JWT parts | ~33% larger than raw bytes, but text-safe |
| `hex` | Debugging, hashes, checksums | 2 hex characters per byte |
| `ascii` | Legacy 7-bit text | Strips the high bit — lossy for non-English text |
| `latin1`/`binary` | 1:1 byte-to-character mapping | Rarely needed directly today |

```
Round trip example:

  original string  ──Buffer.from(str, 'utf8')──▶  Buffer (bytes)
       ▲                                                │
       └──────────── buf.toString('utf8') ◀─────────────┘

  If you encode with one scheme and decode with a DIFFERENT one,
  you get garbage (this is "mojibake" — a classic encoding bug):

  Buffer.from('café', 'utf8').toString('ascii');
  // → 'cafÃ©'-style garbage, because 'é' needs 2 UTF-8 bytes but
  //   ascii decoding reads them as two separate 1-byte characters
```

A very common real-world use — encoding binary data (e.g., an image) as base64 to embed in a JSON API response:

```javascript
const fs = require('fs/promises');

async function imageToBase64(path) {
  const imageBuffer = await fs.readFile(path); // raw binary Buffer
  return imageBuffer.toString('base64');       // safe to put in JSON
}

// Decoding it back on the other end:
function base64ToImageBuffer(base64String) {
  return Buffer.from(base64String, 'base64');
}
```

---

## 5. Common Buffer Operations

```javascript
const buf = Buffer.from('Hello, World!');

// Length in BYTES (not necessarily characters, for multi-byte encodings)
buf.length; // 13

// Access individual bytes (returns a number 0-255)
buf[0]; // 72 (the byte value for 'H')

// Slicing (returns a VIEW into the same underlying memory, not a copy!)
const slice = buf.slice(0, 5); // <Buffer 48 65 6c 6c 6f> → 'Hello'
slice[0] = 74; // mutating the slice ALSO mutates the original buffer's memory!
console.log(buf.toString()); // 'Jello, World!'  ← original changed!

// Copying (an actual independent copy, unlike slice)
const copy = Buffer.alloc(5);
buf.copy(copy, 0, 0, 5);

// Concatenating multiple buffers into one
const combined = Buffer.concat([Buffer.from('Hello, '), Buffer.from('World!')]);
console.log(combined.toString()); // 'Hello, World!'

// Comparing buffers
Buffer.from('abc').equals(Buffer.from('abc')); // true
Buffer.compare(Buffer.from('a'), Buffer.from('b')); // -1 (a < b)

// Checking if something is a Buffer
Buffer.isBuffer(buf); // true

// Writing into a pre-allocated buffer at a specific offset
const writable = Buffer.alloc(20);
writable.write('Hi there', 0, 'utf8');

// Byte length of a string in a given encoding (NOT the same as .length for
// multi-byte characters!)
Buffer.byteLength('café', 'utf8'); // 5 (é takes 2 bytes in UTF-8)
'café'.length;                     // 4 (JS string length counts characters)
```

```
IMPORTANT gotcha — buf.slice() shares memory with the original:

  original buffer: [H][e][l][l][o]
                    ▲
  slice(0,1) ───────┘  (points at the SAME memory, doesn't copy)

  Mutating the slice mutates the original. If you need an independent
  copy, use Buffer.from(buf) or buf.copy(target) instead of slice().
```

---

## 6. Buffers and Streams

Every chunk emitted by a Node stream (unless an encoding is set) is a `Buffer` — this connects directly back to the Streams lesson.

```javascript
const fs = require('fs');

const readStream = fs.createReadStream('data.bin'); // no encoding set

readStream.on('data', (chunk) => {
  console.log(Buffer.isBuffer(chunk)); // true
  console.log(chunk.length, 'bytes received');
});

// Setting an encoding converts each chunk to a string automatically
const textStream = fs.createReadStream('data.txt', { encoding: 'utf8' });
textStream.on('data', (chunk) => {
  console.log(typeof chunk); // 'string'
});
```

Incoming HTTP request bodies also arrive as Buffer chunks that you must accumulate and concatenate yourself when working with the raw `http` module (Express does this for you via body-parsing middleware):

```javascript
const http = require('http');

http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk)); // each chunk is a Buffer
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    res.end(`Received ${body.length} characters`);
  });
}).listen(3000);
```

---

## 7. Common Patterns

**Pattern: Convert an uploaded file's Buffer to a hash for deduplication**

```javascript
const crypto = require('crypto');

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
```

**Pattern: Safely truncate a UTF-8 string by byte length, not character count**

```javascript
function truncateToByteLength(str, maxBytes) {
  const buf = Buffer.from(str, 'utf8');
  if (buf.length <= maxBytes) return str;
  return buf.subarray(0, maxBytes).toString('utf8'); // may cut a char if unlucky
}
```

**Pattern: Compare buffers safely in security-sensitive code (constant-time)**

```javascript
const crypto = require('crypto');

function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB); // avoids timing-attack leaks
}
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create a Buffer from the string `"Interview prep"` and log its `toString()` output in `utf8`, `base64`, and `hex` encodings.

**Exercise 2:** Read a small image file with `fs/promises` into a Buffer, convert it to a base64 string, then decode that base64 string back into a Buffer and write it to a new file. Confirm the two files are byte-identical (hint: compare their SHA-256 hashes using `crypto`).

**Exercise 3:** Demonstrate the `slice()`-shares-memory gotcha: create a buffer, take a slice, mutate a byte in the slice, and log the original buffer to show it changed too. Then repeat using `Buffer.from(buf)` to show an independent copy does NOT get mutated.

**Exercise 4:** Write a function `concatBuffers(...buffers)` using `Buffer.concat` that joins any number of buffers and returns the combined result as a utf8 string.

**Exercise 5:** Build a raw `http` server (from the HTTP module lesson) that accumulates incoming request body chunks (Buffers) via `req.on('data')`, concatenates them with `Buffer.concat`, and responds with the byte length of the received body.

---

## 9. Interview Q&A

**Q: What is a Buffer in Node.js, and how is it different from a String?**
Answer: A Buffer is a fixed-size, raw sequence of bytes (values 0-255), allocated outside the V8 JS heap, with no inherent text encoding. A String is a sequence of characters (UTF-16 internally in JS) meant for text. Buffers are used for binary data — files, network packets, cryptographic output — where you need direct byte-level access; converting between a Buffer and a String requires explicitly specifying an encoding (e.g., `buf.toString('utf8')` or `Buffer.from(str, 'utf8')`).

**Q: Why would you use `Buffer.alloc()` instead of `Buffer.allocUnsafe()`?**
Answer: `Buffer.alloc(size)` zero-fills the allocated memory, guaranteeing predictable, safe contents. `Buffer.allocUnsafe(size)` skips zeroing for performance, meaning the buffer may contain leftover data from previously freed memory — potentially exposing sensitive data from earlier in the process's memory if you read from it before fully overwriting it. `allocUnsafe` should only be used when you will immediately and completely overwrite every byte before reading any of it; `alloc` is the safe default.

**Q: What's the difference between `utf8`, `base64`, and `hex` encodings when converting a Buffer to a string?**
Answer: `utf8` is the standard variable-width encoding for readable text (1-4 bytes per character) and is lossy/undefined for arbitrary binary data that isn't valid UTF-8. `base64` encodes arbitrary binary data into a text-safe alphabet (A-Z, a-z, 0-9, +, /) at roughly 33% size overhead — commonly used to embed binary data (images, keys) inside JSON or URLs. `hex` encodes each byte as two hexadecimal characters, doubling the size but useful for debugging, checksums, and hashes since it's simple to read and universally unambiguous.

**Q: What's the gotcha with `Buffer.prototype.slice()` (or `subarray()`) that trips people up?**
Answer: Unlike `Array.prototype.slice()`, `Buffer.slice()`/`subarray()` does not copy memory — it returns a new Buffer object that's a *view* into the same underlying memory as the original. Mutating a byte in the slice also mutates the original buffer (and vice versa), which can cause subtle bugs if you expect independence. To get a real independent copy, use `Buffer.from(originalBuffer)` or `originalBuffer.copy(targetBuffer)`.

**Q: Why is `Buffer.byteLength(str)` sometimes different from `str.length`?**
Answer: `str.length` counts UTF-16 code units (roughly characters, though surrogate pairs for characters outside the Basic Multilingual Plane count as 2). `Buffer.byteLength(str, encoding)` counts the actual number of bytes the string would occupy once encoded (UTF-8 by default), and characters like accented letters, emoji, or CJK characters can take 2-4 bytes each in UTF-8 despite being a single JS string character. This distinction matters for anything with byte-size limits (e.g., truncating to fit a fixed-size database column or network packet).

**Q: Where do Buffers show up implicitly when working with Node's `http` module or streams, even if you never explicitly create one?**
Answer: Any readable stream without an explicit `encoding` option emits `Buffer` chunks by default — this includes `fs.createReadStream()` output, and incoming HTTP request body chunks received via `req.on('data', chunk => ...)` in the raw `http` module. You typically accumulate these Buffer chunks into an array and use `Buffer.concat()` to combine them before converting to a string with `.toString()`, which is exactly what body-parsing middleware (like Express's `express.json()`) does under the hood.
