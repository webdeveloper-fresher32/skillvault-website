# The HTTP Module — Building a Raw Server — Complete Guide

## Table of Contents
1. [Why Build a Raw Server Before Learning Express](#1-why-build-a-raw-server-before-learning-express)
2. [Creating a Basic HTTP Server](#2-creating-a-basic-http-server)
3. [The Request Object](#3-the-request-object)
4. [The Response Object](#4-the-response-object)
5. [Manual Routing](#5-manual-routing)
6. [Headers and Status Codes](#6-headers-and-status-codes)
7. [Reading Request Bodies](#7-reading-request-bodies)
8. [Serving JSON and Files](#8-serving-json-and-files)
9. [What Express Actually Adds On Top](#9-what-express-actually-adds-on-top)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Build a Raw Server Before Learning Express

Express is a thin layer of convenience on top of Node's built-in `http` module. Every Express `req` and `res` object IS an `http.IncomingMessage` / `http.ServerResponse` under the hood, just decorated with extra helper methods. Building a raw server first demystifies exactly what Express is doing for you — routing, body parsing, JSON responses, status codes — none of it is magic.

```
Express app:                          What's actually happening:

app.get('/users', handler)      →     http.createServer((req, res) => {
                                         if (req.method === 'GET' &&
                                             req.url === '/users') {
                                           handler(req, res);
                                         }
                                       })

res.json({ ok: true })          →     res.setHeader('Content-Type', 'application/json');
                                       res.end(JSON.stringify({ ok: true }));

express.json() middleware       →     manually accumulating req 'data' events
                                       into a Buffer, then JSON.parse()
```

---

## 2. Creating a Basic HTTP Server

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello from a raw Node HTTP server!\n');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
```

```
The request/response lifecycle:

  Browser/curl ──HTTP request──▶ [ Node process, single thread ]
                                        │
                                        ▼
                            http.createServer callback fires
                            (req, res) available for this ONE request
                                        │
                                        ▼
                            you read req, write to res, call res.end()
                                        │
                                        ▼
  Browser/curl ◀──HTTP response──── connection closes (or keeps-alive)
```

Every incoming connection triggers the callback passed to `createServer` with a fresh `req` (readable stream) and `res` (writable stream) pair.

---

## 3. The Request Object

`req` is an instance of `http.IncomingMessage`, which is itself a **Readable stream** (see the Streams lesson) — the request body arrives as a stream of Buffer chunks.

```javascript
const http = require('http');

http.createServer((req, res) => {
  console.log(req.method);       // 'GET', 'POST', 'PUT', 'DELETE', etc.
  console.log(req.url);          // '/users?id=5' — path + query string, NOT parsed
  console.log(req.headers);      // { host: 'localhost:3000', 'user-agent': '...', ... }
  console.log(req.headers['content-type']);
  console.log(req.httpVersion);  // '1.1'
  console.log(req.socket.remoteAddress); // client's IP address

  res.end('logged request details to console\n');
}).listen(3000);
```

Node does **not** parse the URL or query string for you — that's exactly the kind of convenience Express (and the `url` module) adds.

```javascript
const { URL } = require('url');
const http = require('http');

http.createServer((req, res) => {
  // req.url is just the path, e.g. '/search?q=node&page=2'
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  console.log(parsedUrl.pathname);          // '/search'
  console.log(parsedUrl.searchParams.get('q'));    // 'node'
  console.log(parsedUrl.searchParams.get('page')); // '2'

  res.end('parsed\n');
}).listen(3000);
```

---

## 4. The Response Object

`res` is an instance of `http.ServerResponse`, which is a **Writable stream**. You must call `res.end()` (with or without a final chunk of data) to complete the response — forgetting it leaves the client hanging forever.

```javascript
const http = require('http');

http.createServer((req, res) => {
  res.statusCode = 201;                                  // set status BEFORE sending headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Powered-By', 'Raw-Node');

  res.write('{"message":');   // you CAN stream the response in pieces...
  res.write('"created"}');    // ...since res is a Writable stream
  res.end();                  // ...but you MUST call end() to close it

  // Shorthand: res.end(data) writes a final chunk AND ends in one call
  // res.end(JSON.stringify({ message: 'created' }));
}).listen(3000);
```

`res.writeHead()` sets the status code and headers together in one call, which is the more common idiom:

```javascript
res.writeHead(404, { 'Content-Type': 'text/plain' });
res.end('Not Found\n');
```

---

## 5. Manual Routing

Without Express, you build routing yourself by checking `req.method` and `req.url`.

```javascript
const http = require('http');
const { URL } = require('url');

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Home page\n');
  } else if (req.method === 'GET' && pathname === '/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([{ id: 1, name: 'Ganesh' }]));
  } else if (req.method === 'GET' && pathname.startsWith('/users/')) {
    const id = pathname.split('/')[2]; // crude param extraction
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id, name: 'Ganesh' }));
  } else if (req.method === 'POST' && pathname === '/users') {
    // handled in section 7 (needs body parsing)
    res.writeHead(501, { 'Content-Type': 'text/plain' });
    res.end('Not implemented in this snippet\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
});

server.listen(3000, () => console.log('Listening on port 3000'));
```

```
This is EXACTLY the problem Express's router solves:

  Raw http:  a growing if/else (or switch) chain checking method + path,
             manual param extraction with string splitting, no wildcard
             or pattern matching built in.

  Express:   app.get('/users/:id', handler)  → path pattern matching,
             automatic req.params.id extraction, ordered middleware chain,
             all handled by the framework's router internally.
```

---

## 6. Headers and Status Codes

```javascript
const http = require('http');

http.createServer((req, res) => {
  // Reading a request header
  const auth = req.headers['authorization'];

  if (!auth) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Setting multiple response headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', crypto.randomUUID());

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true }));
}).listen(3000);

const crypto = require('crypto');
```

| Status Code Range | Meaning | Common Examples |
|--------------------|---------|------------------|
| `2xx` | Success | `200 OK`, `201 Created`, `204 No Content` |
| `3xx` | Redirection | `301 Moved Permanently`, `304 Not Modified` |
| `4xx` | Client error | `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |
| `5xx` | Server error | `500 Internal Server Error`, `503 Service Unavailable` |

```javascript
// Common headers you'll set manually with the raw http module
// (Express sets sensible defaults for most of these automatically)
res.setHeader('Content-Type', 'application/json'); // tells client how to parse the body
res.setHeader('Content-Length', Buffer.byteLength(body)); // exact byte size of the body
res.setHeader('Location', '/users/42'); // used with 3xx redirects or 201 Created
```

---

## 7. Reading Request Bodies

Since `req` is a Readable stream, reading a `POST`/`PUT` body means accumulating `'data'` events (as covered in the Buffers lesson) — there is no `req.body` built in, unlike Express with `express.json()`.

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/users') {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk); // each chunk is a Buffer
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 1, ...body }));
    });

    req.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3000);

// Test with: curl -X POST http://localhost:3000/users \
//   -H "Content-Type: application/json" -d '{"name":"Ganesh"}'
```

---

## 8. Serving JSON and Files

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  if (req.url === '/api/status') {
    // Serving JSON
    const payload = JSON.stringify({ status: 'ok', uptime: process.uptime() });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
    return;
  }

  if (req.url === '/download') {
    // Serving a file by STREAMING it (memory-efficient — see the Streams lesson)
    const filePath = path.join(__dirname, 'report.pdf');
    const stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': stat.size,
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res); // res is a Writable stream — pipe() handles backpressure
    readStream.on('error', () => {
      res.writeHead(500);
      res.end('Failed to read file');
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(3000);
```

---

## 9. What Express Actually Adds On Top

Now that the raw mechanics are clear, here's the direct mapping of what Express provides:

| Raw `http` module | Express equivalent |
|--------------------|---------------------|
| Manual `if (req.method === ... && req.url === ...)` chains | `app.get(path, handler)`, `app.post(path, handler)`, etc. with pattern matching (`:id`, wildcards) |
| Manually accumulating `req.on('data')` chunks + `JSON.parse` | `express.json()` middleware → `req.body` |
| `res.setHeader(...); res.end(JSON.stringify(x))` | `res.json(x)` |
| `res.writeHead(404); res.end()` | `res.status(404).send(...)` |
| Manual `URL` parsing for query strings | `req.query` (auto-parsed) |
| No built-in concept of shared logic between routes | Middleware chain (`app.use(fn)`) |
| `fs.createReadStream(...).pipe(res)` for static files | `express.static('public')` |

```
Express, conceptually:

  Express app  =  http.createServer(...)   [ SAME underlying server ]
               +  a Router (pattern-matches method + path → handler,
                             extracts :params, handles query strings)
               +  a middleware pipeline (chain of functions that can
                             inspect/modify req & res before your handler runs)
               +  convenience methods bolted onto req/res
                             (res.json, res.send, res.status, req.body, req.query)

  Nothing about Express bypasses http.Server — app.listen() internally
  calls http.createServer(app).listen(...).
```

---

## 10. Hands-On Exercises

**Exercise 1:** Build a raw HTTP server that responds with `"Hello, World!"` (plain text, status 200) for any request, and start it on port 3000. Verify with `curl http://localhost:3000/`.

**Exercise 2:** Extend the server to support manual routing for `GET /`, `GET /about`, and a catch-all `404` for everything else, each returning distinct plain-text bodies.

**Exercise 3:** Build a `GET /api/time` route that responds with JSON `{ "now": "<ISO timestamp>" }`, setting the correct `Content-Type` header. Verify with `curl -i http://localhost:3000/api/time` and confirm the header is present.

**Exercise 4:** Build a `POST /echo` route that reads the raw request body (assume JSON), parses it, and responds with the same JSON back with an added `"receivedAt"` timestamp field. Handle the case of invalid JSON with a `400` response.

**Exercise 5:** Build a `GET /download` route that streams a local text file to the client using `fs.createReadStream(...).pipe(res)`, then compare (in a written comment) how this differs from reading the whole file into memory with `fs.readFile` and sending it via `res.end(data)`.

---

## 11. Interview Q&A

**Q: What are `req` and `res` in Node's `http` module, in terms of streams?**
Answer: `req` (an `http.IncomingMessage`) is a Readable stream — the request body arrives as a sequence of Buffer chunks via `'data'` events, ending with an `'end'` event. `res` (an `http.ServerResponse`) is a Writable stream — you can call `res.write()` multiple times to stream output, and must call `res.end()` to signal the response is complete and flush/close the connection.

**Q: Why doesn't `req.body` exist by default in a raw `http` server, and how would you get the request body yourself?**
Answer: The `http` module treats the request body as a raw byte stream and makes no assumption about its format (JSON, form data, binary, etc.), so it doesn't parse or buffer it automatically. To read it, you listen for `'data'` events on `req`, push each Buffer chunk into an array, then on the `'end'` event use `Buffer.concat()` to join them and `.toString()`/`JSON.parse()` to interpret them. Express's `express.json()` middleware does exactly this internally and attaches the result to `req.body`.

**Q: How does routing work in a raw `http.createServer` callback, and what does Express's router add on top?**
Answer: In raw Node, routing means manually inspecting `req.method` and `req.url` (typically parsed with the `URL` class to separate path from query string) inside if/else or switch statements, with any dynamic segments (like an `:id`) extracted via manual string splitting. Express's router adds declarative pattern matching (`app.get('/users/:id', handler)`), automatic extraction of path parameters into `req.params`, automatic query string parsing into `req.query`, and support for chaining multiple handlers (middleware) per route.

**Q: What's the difference between `res.write()` and `res.end()`?**
Answer: `res.write(chunk)` sends a chunk of the response body to the client without closing the connection — it can be called multiple times to stream data incrementally, similar to writing to any Writable stream. `res.end([chunk])` optionally writes one final chunk and then signals that the response is complete, closing out the response (though the underlying TCP connection may be kept alive for reuse depending on `Connection` headers). Forgetting to call `res.end()` leaves the client waiting indefinitely since the server never signals it's done.

**Q: How would you serve a large file efficiently with the raw `http` module, and why is that approach preferred over reading the whole file into memory first?**
Answer: Use `fs.createReadStream(filePath).pipe(res)` — since `res` is a Writable stream, piping a file's read stream directly into it processes and sends the file in small chunks, keeping memory usage low and constant regardless of file size, and it automatically respects backpressure if the client's connection is slower than disk read speed. Reading the entire file into memory with `fs.readFile()` and then calling `res.end(data)` works for small files but risks high memory usage (or crashes) for large files and delays the first byte sent to the client until the entire file has been read from disk.

**Q: Is `app.listen()` in Express doing something fundamentally different from `http.createServer().listen()`?**
Answer: No — under the hood, Express's `app` is itself a request handler function, and `app.listen(port)` calls `http.createServer(app).listen(port)` internally. Express doesn't replace or bypass Node's `http` module; it wraps it, adding routing, middleware, and convenience methods on top of the same underlying `http.Server`, `req` (`IncomingMessage`), and `res` (`ServerResponse`) objects.
