# Server Actions Basics — Complete Guide

> "The customer writes the order on the slip and hands it straight to the kitchen — no waiter required to carry it there."

---

## Table of Contents
1. [The Problem: Mutating Data Meant Manual Plumbing](#1-the-problem-mutating-data-meant-manual-plumbing)
2. [The Order Slip Analogy](#2-the-order-slip-analogy)
3. [Defining a Server Action: "use server"](#3-defining-a-server-action-use-server)
4. [Crossing the Boundary: Resolving Phase 3's Forward Reference](#4-crossing-the-boundary-resolving-phase-3s-forward-reference)
5. [Diagram: A Server Action Call, Start to Finish](#5-diagram-a-server-action-call-start-to-finish)
6. [Code Walkthrough: Wiring a Server Action to a Form](#6-code-walkthrough-wiring-a-server-action-to-a-form)
7. [Comparing a Server Action to a Route Handler](#7-comparing-a-server-action-to-a-route-handler)
8. [Common Mistakes](#8-common-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Mutating Data Meant Manual Plumbing

Before Server Actions, something as ordinary as "submit this form, write it to the database" needed three hand-built pieces working together.

```
1. A Route Handler exporting POST — a real endpoint at some URL
2. A Client Component's onSubmit — event.preventDefault(), build a
   fetch call by hand, JSON.stringify the body, point it at that URL
3. Manual useState — isSubmitting, error, success — none of it free
```

None of that is conceptually hard, but it gets rebuilt near-identically for every mutation: create a post, update a profile, delete a comment. A Server Action collapses all three down to "write a function, call the function."

---

## 2. The Order Slip Analogy

A customer at a restaurant writes their own order slip and hands it straight through a pass-through window to the kitchen — no waiter relays it, no separate counter to visit first.

```
Ordinary flow      → customer tells a waiter → waiter carries the order
                     → kitchen cooks it
                     (the hand-built endpoint + manual fetch call from
                     Section 1 is that waiter — hired, trained, hand-built)

Server Action flow → customer fills in the slip → hands it straight
                     through the window
                     (Next.js *is* the window — it turns the call into
                     a network request automatically, no waiter needed)
```

The customer doesn't need to know the kitchen's layout, which stove is free, or how the dish is cooked — just fill in what you want and hand it over.

---

## 3. Defining a Server Action: "use server"

A Server Action is an `async` function marked with the `"use server"` directive, placed as the literal first line of either the function's own body or the entire file, telling Next.js: this code runs only on the server, yet stays callable like an ordinary function.

```js
// app/actions.js
"use server";

export async function createPost(formData) {
  const title = formData.get("title");
  const body = formData.get("body");

  await db.posts.insert({ title, body }); // real backend access
}
```

```
"use server" at the top of a FILE     → every exported function in
                                         that file becomes a Server Action
"use server" at the top of a single
FUNCTION's own body                   → only that one function does
```

A component that imports `createPost` calls it directly — `createPost(...)`, or handed to a `<form>`'s `action` prop (Section 6) — no URL built, no `fetch`, no manual serialization.

---

## 4. Crossing the Boundary: Resolving Phase 3's Forward Reference

Phase 3, Lesson 3 named Server Actions as the one exception to "an ordinary function can't cross the Server → Client boundary as a prop," and promised the explanation here. This is it.

```
Ordinary function → tied to the server's JS runtime, no serializable
                     representation → cannot cross (Phase 3, Section 5)

Server Action     → Next.js compiles it into a reference: a unique ID
                     pointing at the real function still on the server
                   → the client gets a lightweight stand-in tied to
                     that ID — never the function's actual source code
                   → calling the stand-in triggers a dedicated network
                     request: "invoke the real function behind this ID"
```

Phase 3's rule still holds: an *ordinary* function can't cross as executable code. A Server Action never tries to — it crosses as a reference, through a mechanism built specifically for this purpose. The exact wire format of that reference is a Next.js implementation detail, not something to depend on directly; the stable, memorizable part is the behavior — reference, not code.

---

## 5. Diagram: A Server Action Call, Start to Finish

```text
Client calls createPost(formData)
        │
        ▼
Next.js recognizes createPost as a Server Action reference
(a generated ID pointing at server code, not a plain function)
        │
        ▼
Next.js issues a network request carrying that reference ID
plus the serialized arguments
        │
        ▼
The real "use server" function body runs on the server —
full backend access (DB clients, secret env vars, filesystem)
        │
        ▼
Its return value (or thrown error) is serialized back
        │
        ▼
createPost(formData) resolves in the Client Component,
exactly as if it had been a normal async call all along
```

No `route.js`, no hand-written `fetch` — the entire round trip in the middle is generated by Next.js.

---

## 6. Code Walkthrough: Wiring a Server Action to a Form

Handing a Server Action directly to a `<form>`'s `action` prop lets the browser's native submission mechanism do the actual triggering.

```jsx
// app/posts/new/page.js  (Server Component)
import { createPost } from "@/app/actions";

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input type="text" name="title" placeholder="Title" required />
      <textarea name="body" placeholder="Write something..." required />
      <button type="submit">Publish</button>
    </form>
  );
}
```

```
No onSubmit, no event.preventDefault(), no useState, no manually
built FormData. Next.js collects the form's fields into a FormData
object and passes it as createPost's single argument — matching
formData.get("title") / formData.get("body") from Section 3.
```

The same `createPost` works whether it's wired this way or called directly from event-handler code — `<form action={...}>` is just the least-boilerplate way to connect it to a real user interaction. Lesson 2 builds on exactly this wiring.

---

## 7. Comparing a Server Action to a Route Handler

Phase 5's Route Handler and this lesson's Server Action are two different ways to run server-side logic triggered from the browser — worth being precise about which one fits, since neither replaces the other.

| | Server Action | Route Handler |
|---|---|---|
| Invoked how | Called as a function (`<form action={...}>` or event-handler code) — Next.js generates the network call | `fetch` to an explicit URL, using whichever HTTP method it exports |
| Needs a URL | No — no `route.js` file, nothing to document | Yes — a real path (`app/api/.../route.js`) any caller must know |
| Best for | Mutations triggered from your own app's UI | Endpoints reachable from outside your app — webhooks, third-party integrations, public APIs |

A Server Action removes the URL from the developer's mental model entirely — just a function to call, which is what collapses Section 1's boilerplate. A Route Handler's advantage is exactly what a Server Action gives up: a stable, addressable URL that any client — a mobile app, a webhook sender, `curl` — can hit with zero awareness of your Next.js internals. A form in your own app's UI reaches for a Server Action; a public API a partner's system needs to call still needs a real Route Handler.

---

## 8. Common Mistakes

- **`"use server"` not on the literal first line.** Next.js uses its exact position to recognize the boundary — a stray import or comment above it causes the directive to be silently ignored, not flagged.
- **Treating a Server Action as private just because it has no visible URL.** It's still a real, reachable network endpoint under the hood. Validate and authenticate inside it exactly as you would a Route Handler's request body — never trust its arguments by default.
- **Assuming any function passed server → client becomes a Server Action.** Only functions actually marked `"use server"` get the reference-based treatment from Section 4 — an ordinary function still can't cross as a prop, no matter how similar it looks.

---

## 9. Hands-On Exercises

**Exercise 1:** Create `app/actions.js` with `"use server"` at the top and an `async function createPost(formData)` that reads `formData.get('title')` and `formData.get('body')` and logs them to the server console.

**Exercise 2:** Create `app/posts/new/page.js`, a Server Component wiring `createPost` to `<form action={createPost}>` with `title` and `body` fields, exactly as in Section 6. Submit and confirm the values appear in your terminal.

**Exercise 3:** Add a second Server Action, `deletePost(formData)`, to the same `app/actions.js`, reading a `postId` field and logging a deletion message. Wire it to a second form on the same page — confirm one file can export more than one Server Action.

**Exercise 4:** Inside `createPost`, add `if (!title) throw new Error('Title is required')` before the insert. Submit with an empty title and observe the error surface, confirming a Server Action's input is not validated for you automatically.

**Exercise 5:** Write a one-paragraph comparison of when you'd reach for `createPost` here versus a Route Handler like Phase 5's `POST /api/users`, for the same "create a resource" use case.

---

## 10. Interview Q&A

**Q: What is a Server Action?**
An `async` function marked with `"use server"`, placed at the top of the function body or the top of its file, that can be called directly from a Client or Server Component as if it were a normal function, while its body always executes on the server. Next.js automatically generates and manages the network call needed to invoke it, so no hand-built API route or manual `fetch` call is required.

**Q: Phase 3 said ordinary functions can't be passed as props from a Server Component to a Client Component, but flagged Server Actions as an exception. How does a Server Action actually cross that boundary?**
Not by shipping executable code to the browser. Next.js compiles a `"use server"` function into a reference — a unique ID pointing at the real function still on the server — and gives the client a lightweight stand-in tied to that ID. Calling the stand-in triggers a dedicated network request telling the server to run the real function behind that ID; the "function" never travels as code, only a reference to it does, which is why this doesn't contradict the plain-data serialization rule ordinary functions fail.

**Q: How is a Server Action different from a Route Handler?**
A Route Handler lives at an explicit URL (`app/api/.../route.js`) any client has to know and target with a manual `fetch` call. A Server Action has no separate URL at all — it's called directly like a function, typically via `<form action={...}>`, and Next.js generates the underlying network request automatically. Route Handlers suit endpoints reachable from outside your own app; Server Actions suit mutations triggered from within your own app's UI.

**Q: Is a Server Action safe from malicious input just because there's no documented URL for it?**
No. It's still backed by a real, reachable network endpoint under the hood, even without a visible `route.js` file. Its arguments should be treated as untrusted input exactly like a Route Handler's request body — validation and authorization checks still need to happen inside the function itself.

**Q: Where can the `"use server"` directive be placed?**
Either as the very first line inside an individual `async` function's body, marking just that one function as a Server Action, or as the very first line of an entire file, marking every function that file exports. In both cases it must be the literal first statement for Next.js to recognize it correctly.
