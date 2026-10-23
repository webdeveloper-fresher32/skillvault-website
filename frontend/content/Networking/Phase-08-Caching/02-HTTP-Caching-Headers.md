# HTTP Caching Headers — Complete Guide

## Table of Contents
1. [Cache-Control (The Modern Standard)](#1-cache-control-the-modern-standard)
2. [Conditional Requests (Revalidation)](#2-conditional-requests-revalidation)
3. [Expires (The Legacy Header)](#3-expires-the-legacy-header)
4. [Hands-On Exercises](#4-hands-on-exercises)
5. [Interview Q&A](#5-interview-qa)

---

## 1. Cache-Control (The Modern Standard)

When a server sends a response, it can include HTTP headers that tell the browser (and any intermediate CDNs/proxies) whether they are allowed to cache the response, and for how long.

`Cache-Control` is the most important caching header. It dictates the caching rules.

### Key Directives

- **`max-age=<seconds>`**: The most common directive. Tells the client how many seconds the response is fresh for.
  *Example:* `Cache-Control: max-age=3600` (Cache this for 1 hour). If the user requests the file again within an hour, the browser will not even contact the server; it will instantly serve it from the local disk cache (a "cache hit").

- **`no-cache`**: This is incredibly poorly named. It does **not** mean "do not cache this". It means "you can store this in your cache, but you MUST re-validate it with the server every single time before you use it."
  *Example use case:* An HTML file that changes occasionally. You want the user to load it fast if it hasn't changed, but you absolutely must ensure they get the new version the millisecond you deploy it.

- **`no-store`**: This is the one that actually means "do not cache this ever." The browser and CDNs are forbidden from writing this response to disk.
  *Example use case:* A banking page containing sensitive financial data.

- **`public`**: Any cache (browser, CDN, intermediate proxy) is allowed to cache this response.

- **`private`**: Only the end-user's browser is allowed to cache this. A CDN must *not* cache it because the response is tailored to a specific user (e.g., a profile page containing user-specific data).

```
Cache-Control: public, max-age=3600
                 │           │
                 │           └── fresh for 1 hour, no revalidation needed
                 └── any cache (browser, CDN, proxy) may store it
```

---

## 2. Conditional Requests (Revalidation)

What happens when a cache expires (e.g., the `max-age` of 3600 seconds has passed), or when the server sends `no-cache`?

The browser doesn't just blindly redownload the entire file. It asks the server: *"I have a copy of this file from earlier. Has it changed since then?"* This is called a **Conditional Request**.

It does this using one of two mechanisms:

### Mechanism A: ETag and If-None-Match (The Hash Approach)

1. **Server Response (Initial):**
   The server computes a hash of the file's contents and sends it in the `ETag` header.
   ```http
   HTTP/1.1 200 OK
   Cache-Control: max-age=3600
   ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
   ```

2. **Client Request (Later):**
   After an hour, the cache expires. The browser wants the file again. It sends the ETag back to the server.
   ```http
   GET /app.js HTTP/1.1
   If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
   ```

3. **Server Response (If unmodified):**
   The server compares the hash. If the file hasn't changed, the hashes match. The server sends a tiny empty response telling the browser to just use its cached copy.
   ```http
   HTTP/1.1 304 Not Modified
   ```
   *(Notice there is no body in this response. We just saved downloading a 2MB file!)*

### Mechanism B: Last-Modified and If-Modified-Since (The Timestamp Approach)

This works exactly like ETags, but uses timestamps instead of hashes.

1. **Server Response:** `Last-Modified: Wed, 21 Oct 2015 07:28:00 GMT`
2. **Client Request:** `If-Modified-Since: Wed, 21 Oct 2015 07:28:00 GMT`
3. **Server Response:** `304 Not Modified`

*Note: ETags are generally preferred today because timestamps only have a 1-second resolution, and file modification times on servers can sometimes be unreliable across load-balanced clusters.*

```
Browser                          Server
  │  GET /app.js                    │
  │  If-None-Match: "abc123"        │
  │ ───────────────────────────────▶│
  │                                  │  hash matches?
  │  304 Not Modified (no body)      │
  │ ◀─────────────────────────────── │
  │  → use local cached copy         │
```

---

## 3. Expires (The Legacy Header)

Before `Cache-Control: max-age` existed in HTTP/1.1, the `Expires` header was used in HTTP/1.0.
It provides an absolute date and time when the cache expires.

```http
Expires: Wed, 21 Oct 2015 07:28:00 GMT
```

**Why it's obsolete:** Absolute timestamps rely on the client's system clock being perfectly synced with the server. If the user's computer clock is wrong, the caching logic breaks. `max-age` uses relative seconds, which always works regardless of clock skew. If a response has both `Cache-Control: max-age` and `Expires`, modern browsers ignore `Expires`.

---

## 4. Hands-On Exercises

**Exercise 1:** Open DevTools Network tab on any website, click a static asset (JS/CSS/image), and record its `Cache-Control`, `ETag`, and `Last-Modified` response headers.

**Exercise 2:** Reload the same page and find a request that returned `304 Not Modified` in the status column — inspect the request headers to see which conditional header (`If-None-Match` or `If-Modified-Since`) was sent.

**Exercise 3:** Using `curl -I`, fetch a URL twice and compare the `ETag` values; then use `curl -H "If-None-Match: <etag>"` to manually trigger a `304` response.

**Exercise 4:** Configure a small local static file server (e.g., `http-server` or a one-file Express app) to serve a file with `Cache-Control: no-store` and confirm in DevTools that no cache entry is created.

**Exercise 5:** Set `Cache-Control: private, max-age=60` on a response and explain, in your own words, why a CDN sitting between the browser and origin must not cache it even though it's allowed to be cached somewhere.

---

## 5. Interview Q&A

**Q: What is the difference between `Cache-Control: no-cache` and `no-store`?**
Answer: This is a classic trap question. `no-store` means completely disable caching; never write to disk. `no-cache` means you can store it, but you must ask the server for a `304 Not Modified` validation before using it every single time.

**Q: A user requests an image, and the server returns a `304 Not Modified`. Does this response contain the image data?**
Answer: No. The 304 response is deliberately empty. Its entire purpose is to tell the browser "the copy you already have on your hard drive is still valid, go ahead and render it." This saves massive amounts of bandwidth.

**Q: Which takes precedence: `ETag` or `Last-Modified`?**
Answer: If a server sends both, a browser will typically send both conditional headers (`If-None-Match` and `If-Modified-Since`) in the subsequent request. However, the server will prioritize the `ETag` for the validation check because it is a more accurate representation of the file's exact contents than a 1-second-resolution timestamp.

**Q: What's the difference between `public` and `private` in `Cache-Control`, and when would you use `private`?**
Answer: `public` allows any cache — browser, CDN, or intermediate proxy — to store the response. `private` restricts caching to the end-user's own browser. You'd use `private` for responses that are personalized per-user, like an account dashboard or a profile page, where a shared CDN caching it would leak one user's data to another.

**Q: Why is `Expires` considered obsolete compared to `Cache-Control: max-age`?**
Answer: `Expires` specifies an absolute timestamp, which depends on the client's system clock being correctly synchronized with the server's. A skewed clock can cause a cache to be treated as fresh when it's actually stale, or vice versa. `max-age` instead specifies a relative duration in seconds from the time the response was received, which sidesteps clock synchronization issues entirely. When both headers are present, `max-age` wins in modern browsers.

**Q: If a resource never changes (like a version-hashed JS bundle), what's the ideal `Cache-Control` header, and why include `immutable`?**
Answer: `Cache-Control: public, max-age=31536000, immutable` is ideal. The long `max-age` lets browsers and CDNs cache it for a year without contacting the server. `immutable` goes a step further by telling the browser not to even attempt a revalidation request on a user-triggered reload, since the file's content will never change under that URL — this eliminates unnecessary conditional requests entirely.
