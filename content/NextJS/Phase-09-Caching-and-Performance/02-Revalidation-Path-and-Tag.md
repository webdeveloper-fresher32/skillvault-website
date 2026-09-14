# Revalidation: Path and Tag — Complete Guide

> "A smoke detector's scheduled battery check happens on a timer either way; pulling the fire alarm happens the instant you actually see smoke."

---

## Table of Contents
1. [The Problem: Time-Based Revalidation Isn't Always Enough](#1-the-problem-time-based-revalidation-isnt-always-enough)
2. [The Smoke Detector Analogy](#2-the-smoke-detector-analogy)
3. [The Mechanism: revalidatePath and revalidateTag](#3-the-mechanism-revalidatepath-and-revalidatetag)
4. [Code Walkthrough: Revalidating After a Server Action](#4-code-walkthrough-revalidating-after-a-server-action)
5. [Comparing the Three Revalidation Tools](#5-comparing-the-three-revalidation-tools)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Time-Based Revalidation Isn't Always Enough

Phase 4, Lesson 1 covered `{ next: { revalidate: N } }` — a cached `fetch` result that refreshes automatically after `N` seconds. That's the right tool for "this data drifts slowly, refresh it periodically." It's the wrong tool for a much more common case: you know the *exact instant* data changed, because your own code just changed it.

### The Gap Time-Based Revalidation Leaves

```text
User submits a form → Server Action updates a database row
        │
        ▼
The Data Cache and Full Route Cache still hold the OLD value
        │
        ▼
With only revalidate: N — the old value keeps serving until
the timer happens to expire, even though the app already
knows, at the exact moment of the mutation, that it's stale
```

### What's Missing

A purely time-based scheme has no way to say "invalidate this right now, because I just changed it" — it can only ever guess at an interval. What's missing is an on-demand trigger, fired from the exact code path that performs the mutation.

---

## 2. The Smoke Detector Analogy

A smoke detector's battery gets tested on a fixed schedule — once a week, whether or not anything is actually wrong. That's a reasonable baseline, but it's useless the moment real smoke appears; nobody waits for the weekly check to react to a fire. A fire alarm pull station exists for exactly that: immediate action, triggered the instant the person who sees the smoke pulls it.

### Mapping the Analogy

```text
Scheduled battery check   → revalidate: N  (Phase 4)
  (time-based, runs regardless of whether anything changed)

Pulling the fire alarm    → revalidatePath / revalidateTag
  (event-based, fired at the exact moment something is
   known to have changed — not on a timer at all)
```

### Why Both Still Matter

The scheduled check still has value — it catches drift nobody explicitly reported. The alarm doesn't replace it; it exists for the specific case where the exact moment of change is knowable, which a mutation performed by your own Server Action always is.

---

## 3. The Mechanism: revalidatePath and revalidateTag

Both functions are called from server-side code — most commonly from inside a Server Action, right after it performs a mutation (Phase 6 covered the Server Action itself; this is what typically runs right after one).

### revalidatePath

```js
import { revalidatePath } from "next/cache";

revalidatePath("/blog/my-post");
```

```text
Invalidates the Data Cache AND the Full Route Cache for that
exact path, so the next request to it re-renders with fresh
data instead of serving the previously cached result.
```

### revalidateTag

```js
import { revalidateTag } from "next/cache";

revalidateTag("posts");
```

```text
Invalidates every cached fetch() call anywhere in the app that
was tagged with { next: { tags: ["posts"] } } — potentially
many different routes at once, all sharing that one tag.
```

### Tagging a fetch So revalidateTag Can Find It

```js
async function getPosts() {
  const res = await fetch("https://api.example.com/posts", {
    next: { tags: ["posts"] },
  });
  return res.json();
}
```

```text
next: { tags: ["posts"] }
  ↳ This string is the only link between this fetch call and a
    later revalidateTag("posts") call — they must match exactly,
    or the revalidation silently affects nothing.
```

---

## 4. Code Walkthrough: Revalidating After a Server Action

Following a mutation from the Server Action through to the exact `revalidatePath` call shows where, concretely, this fits into code already built in Phase 6.

### The Tagged Fetch That Reads the Data

```js
// app/blog/data.js
export async function getPost(slug) {
  const res = await fetch(`https://api.example.com/posts/${slug}`, {
    next: { tags: ["posts", `post-${slug}`] },
  });
  return res.json();
}
```

### The Server Action That Mutates, Then Revalidates

```js
// app/actions.js
"use server";

import { revalidatePath, revalidateTag } from "next/cache";

export async function updatePost(slug, formData) {
  const title = formData.get("title");

  await db.posts.update({ slug }, { title }); // the actual mutation

  revalidatePath(`/blog/${slug}`);   // ↳ busts this exact rendered route
  revalidateTag("posts");            // ↳ busts every fetch tagged "posts"
                                      //   anywhere else it's used (e.g. a
                                      //   listing page), not just this route
}
```

```text
await db.posts.update(...)   → the mutation Phase 6 already covers
revalidatePath(`/blog/${slug}`)
  ↳ must match the route's real dynamic path shape — a literal
    string built from the same slug, not a static guess
revalidateTag("posts")
  ↳ only reaches fetch calls tagged with that exact same string
```

Both calls are typically fired together when a mutation affects both one specific page (`revalidatePath`) and a broader shared data set other pages also read (`revalidateTag`) — they aren't mutually exclusive.

---

## 5. Comparing the Three Revalidation Tools

Time-based `revalidate`, `revalidatePath`, and `revalidateTag` all exist to answer "when does cached data get refreshed," but they differ in what triggers them and what they're best suited for.

### Comparison Table

| Tool | Trigger | Best for |
|---|---|---|
| `revalidate: N` (Phase 4) | Time-based — a fixed interval, regardless of whether anything changed | Data that drifts slowly and doesn't have a clear "changed right now" moment (e.g. an external API polled periodically) |
| `revalidatePath(path)` | Event-based — called explicitly, typically right after a mutation | Invalidating one specific, known route immediately after it changes |
| `revalidateTag(tag)` | Event-based — called explicitly, matched by a shared tag string | Invalidating a shared data set across every page that reads it, without knowing every path up front |

### Takeaway

Reach for `revalidate: N` when there's no specific moment of change to hook into, and reach for `revalidatePath`/`revalidateTag` the instant a Server Action (or other server-side mutation) knows exactly what just changed — the two approaches compose rather than compete, and most real mutations end up calling one of the on-demand tools right after the write.

---

## 6. Common Mistakes

- **Calling `revalidatePath` with a path that doesn't match the route's real dynamic shape.** `revalidatePath('/blog/[slug]')` (the literal template) does not revalidate `/blog/my-post` — it needs the actual resolved path, e.g. `revalidatePath('/blog/my-post')` or a dynamically built template string like `` `/blog/${slug}` ``. A mismatch fails silently: no error, just a route that stays stale.
- **Using `revalidateTag` without tagging the original `fetch`.** `revalidateTag("posts")` has nothing to invalidate if no `fetch` call anywhere was ever tagged `next: { tags: ["posts"] }` — the two strings must match exactly, and a typo in either one breaks the link without raising an error.
- **Reaching for `revalidatePath`/`revalidateTag` for routine, predictable staleness.** If data genuinely just drifts on its own schedule with no clear "changed now" moment, a plain `revalidate: N` is simpler and doesn't require wiring a call into every place a mutation might happen.

---

## 7. Hands-On Exercises

**Exercise 1:** Build a `fetch` for a list of posts tagged `next: { tags: ['posts'] }`, rendered on a listing page. Confirm (via a logged timestamp) that reloading repeatedly doesn't refetch.

**Exercise 2:** Write a Server Action `createPost(formData)` (extending Phase 6's pattern) that inserts a new post and then calls `revalidateTag('posts')`. Submit the form and confirm the listing page's timestamp changes on the very next load — no waiting for any timer.

**Exercise 3:** Add a single-post page at a dynamic route, fetching with `next: { tags: ['posts', `post-${slug}`] }`. Add an `updatePost(slug, formData)` Server Action calling both `revalidatePath(`/blog/${slug}`)` and `revalidateTag('posts')`. Confirm both the single-post page and the listing page reflect the update immediately.

**Exercise 4:** Deliberately call `revalidatePath('/blog/[slug]')` (the literal bracketed template, not a real slug) instead of the resolved path. Confirm the single-post page does **not** update, demonstrating the path-mismatch mistake from Section 6.

**Exercise 5:** Deliberately tag a `fetch` with `next: { tags: ['post'] }` (singular) while calling `revalidateTag('posts')` (plural) from the Server Action. Confirm the mismatch means the fetch never gets invalidated, and fix it by making both strings match exactly.

---

## 8. Interview Q&A

**Q: What problem do `revalidatePath` and `revalidateTag` solve that `revalidate: N` doesn't?**
`revalidate: N` refreshes cached data on a fixed timer, regardless of whether anything actually changed. `revalidatePath` and `revalidateTag` are event-based instead — called explicitly from server-side code, typically right after a mutation, to invalidate the cache at the exact moment the app knows data changed, rather than waiting for the next scheduled refresh.

**Q: What's the difference between `revalidatePath` and `revalidateTag`?**
`revalidatePath('/blog/my-post')` invalidates the cache for that one specific, exact path — both the Data Cache and the Full Route Cache for that route. `revalidateTag('posts')` invalidates every cached `fetch` call anywhere in the app tagged with `next: { tags: ['posts'] }`, which can span multiple different routes that all happen to read the same underlying data.

**Q: Where is `revalidatePath`/`revalidateTag` typically called from, and why there?**
Most commonly from inside a Server Action (Phase 6), immediately after the mutation it performs — e.g. right after `await db.posts.update(...)`. That's the exact point in the code where the app has certain, first-hand knowledge that specific data just changed, which is precisely the condition these on-demand tools are built for.

**Q: Why would calling `revalidatePath('/blog/[slug]')` fail to update `/blog/my-post`?**
`revalidatePath` needs the actual resolved path a request would hit, not the route's literal dynamic-segment template. `'/blog/[slug]'` isn't a real URL any browser ever requests, so it doesn't match the cache entry for `/blog/my-post` — the call needs to build the real path, e.g. `` `/blog/${slug}` ``, and this kind of mismatch fails silently rather than throwing.

**Q: If `revalidateTag('posts')` doesn't seem to be invalidating anything, what's the most likely cause?**
That no `fetch` call was ever tagged with the exact matching string `next: { tags: ['posts'] }` — the tag string is the only link between the original fetch and a later `revalidateTag` call, and any mismatch (a typo, a different casing, singular vs. plural) means the two never connect, with no error raised on either side.
