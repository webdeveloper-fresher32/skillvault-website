# Cache Invalidation Strategies — Complete Guide

## Table of Contents
1. [Strategy 1: Cache-Busting via File Versioning](#1-strategy-1-cache-busting-via-file-versioning)
2. [Strategy 2: Revalidation for HTML](#2-strategy-2-revalidation-for-html)
3. [Strategy 3: CDN Purge / Invalidation APIs](#3-strategy-3-cdn-purge--invalidation-apis)
4. [Hands-On Exercises](#4-hands-on-exercises)
5. [Interview Q&A](#5-interview-qa)

---

"There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

You've learned how to cache files using `max-age` to make your site blindingly fast. But what happens when you deploy a new version of your application? If the browser is sitting on a `max-age=31536000` (1 year) cache of your CSS file, it won't even ask the server for the new one. Your users will see a broken site with old CSS and new HTML.

This lesson covers the three primary strategies for solving this.

---

## 1. Strategy 1: Cache-Busting via File Versioning

This is the industry standard for JavaScript, CSS, and image files (the standard approach for static assets). It relies on a very simple rule: **If the file contents change, the URL must change.**

When you build your application (e.g., using Webpack, Vite, or Next.js), the build tool calculates a hash of the file's contents and injects it into the filename.

*Old version:* `app.v1.js` or `app.8a4b2c.js`
*New version:* `app.v2.js` or `app.9f7d1e.js`

Because the URLs are unique, you can safely tell browsers and CDNs to cache them forever.

**The Headers:**
```http
Cache-Control: public, max-age=31536000, immutable
```
*(The `immutable` directive is a modern addition that explicitly tells the browser "this file will never change, don't even bother checking on a page reload".)*

**How the update works:**
```
1. User has app.v1.js cached forever (max-age=1yr).
2. You deploy new code.
3. New index.html now references <script src="app.v2.js">.
4. Browser sees a URL it has never cached → cache miss.
5. It bypasses the cache entirely and downloads the new file.
```

**Crucial Caveat:** This only works if your `index.html` file is *not* cached forever. If `index.html` is cached, the browser will never see the new `<script>` tags.

---

## 2. Strategy 2: Revalidation for HTML

Because `index.html` is the entry point that points to all the versioned assets, it must *always* be up to date.

You cannot cache `index.html` forever. Instead, you use the `no-cache` directive (or a very short `max-age` like 60 seconds).

**The Headers (for index.html):**
```http
Cache-Control: no-cache
ETag: "some-hash-of-the-html"
```

**How the update works:**
```
1. The user navigates to your site.
2. Because of no-cache, the browser sends an If-None-Match request.
3. Not deployed yet  → server replies 304 Not Modified (fast!).
4. Deployed          → server replies 200 OK with new HTML
                        containing <script src="app.v2.js">.
```

This combination — `no-cache` for HTML, and `max-age=1year` for versioned JS/CSS/Images — is the optimal caching strategy for 99% of web applications.

---

## 3. Strategy 3: CDN Purge / Invalidation APIs

Sometimes you have a URL that cannot be versioned (e.g., `api.example.com/products` or a profile image `example.com/users/alice.jpg`), but you still want it cached heavily at the CDN edge for performance.

If Alice uploads a new profile picture, you want to update it immediately, but the CDN is configured to hold the image for a week.

In this case, you use a **Purge API** provided by your CDN (Cloudflare, AWS CloudFront, Fastly).

**How it works:**
1. The user uploads a new photo. Your backend server saves it to the database/S3.
2. Your backend server makes a programmatic API call to the CDN:
   `POST https://api.cloudflare.com/.../purge_cache` with a payload of `{"files": ["https://example.com/users/alice.jpg"]}`
3. The CDN actively deletes that specific file from all of its edge servers globally.
4. The next time a user requests Alice's photo, the CDN experiences a "cache miss", goes back to your origin server, fetches the new photo, and caches it again.

```
Upload → Origin saves new file → Origin calls Purge API → CDN evicts old file globally
                                                          → next request = cache miss → refetch
```

---

## 4. Hands-On Exercises

**Exercise 1:** Configure a Webpack, Vite, or Parcel build (or inspect an existing production bundle from any site) and identify the content hash embedded in a JS or CSS filename.

**Exercise 2:** Set up a local static site where `index.html` is served with `Cache-Control: no-cache` and its asset bundle is served with `Cache-Control: public, max-age=31536000, immutable`. Change the asset, rebuild, and confirm in DevTools that only the new filename is fetched.

**Exercise 3:** Simulate a deploy: change the content of a hashed asset without changing its filename (breaking the convention on purpose) and observe how stale content gets served to users with a warm cache — this demonstrates why the hash-in-filename discipline matters.

**Exercise 4:** Read the purge/invalidation API docs for a CDN you have access to (Cloudflare, CloudFront, Fastly) and issue a manual purge request for a single URL using `curl`.

**Exercise 5:** Design (on paper) a cache invalidation plan for a product listing API that changes a few times a day — decide between short `max-age` with revalidation vs. long `max-age` with purge-on-write, and justify your choice.

---

## 5. Interview Q&A

**Q: Explain the optimal caching strategy for a Single Page Application (like a React app).**
Answer: The `index.html` file should be served with `Cache-Control: no-cache` so the browser always revalidates it with the server (using ETags) to ensure it has the latest version. All static assets (JS, CSS, images) should have their contents hashed into their filenames (e.g., `main.a1b2c3.js`) and be served with `Cache-Control: public, max-age=31536000, immutable`. When a new deployment occurs, `index.html` updates to point to the new asset URLs, naturally bypassing the old cached assets.

**Q: Why do we use CDN Purge APIs instead of just setting `no-cache` on everything?**
Answer: `no-cache` requires a round-trip to the origin server for every single request to validate the ETag. If you have millions of users requesting an API endpoint, that validation traffic alone could overwhelm your database. By setting a long `max-age` and using a Purge API only when the data *actually changes*, you offload 100% of the traffic to the CDN until the exact moment an update is necessary.

**Q: What is a "Cache Stampede" (or Thundering Herd)?**
Answer: If a highly popular, computationally expensive item in a cache (like a complex database aggregation) expires, and 1,000 users request it at the exact same millisecond, all 1,000 requests will experience a cache miss. They will all simultaneously hit the backend database to regenerate the item, potentially crashing the database. This is a cache stampede. It is typically solved by locking mechanisms (only letting one request rebuild the cache while others wait) or `stale-while-revalidate` headers.

**Q: What happens if you version your JS/CSS files but forget to also prevent caching of `index.html`?**
Answer: The browser will keep serving an old, cached `index.html` that references the old asset filenames. Even though the new, correctly-versioned assets exist on the server, the browser never learns about them because it never re-requests the HTML that points to them. Users effectively get stuck on the old deployment until their HTML cache naturally expires or they hard-refresh.

**Q: What does `stale-while-revalidate` do, and how does it relate to cache invalidation?**
Answer: `stale-while-revalidate=<seconds>` tells the cache that after the `max-age` freshness window expires, it's allowed to keep serving the stale response immediately while asynchronously fetching a fresh copy in the background for future requests. This avoids making the user wait for revalidation on the critical path and is a common mitigation for cache stampedes, since only one background request needs to happen instead of many concurrent ones.

**Q: For a resource like a user's profile picture stored at a fixed, non-versioned URL, what's the trade-off between short `max-age` and long `max-age` with CDN purge?**
Answer: A short `max-age` guarantees freshness automatically but means the CDN has to revalidate or refetch often, increasing origin load and reducing cache-hit performance. A long `max-age` with an explicit purge call on update gives you the best of both — high cache-hit rates most of the time — but it requires your application code to remember to call the purge API on every write, adding operational complexity and a failure mode if that call is missed or fails silently.
