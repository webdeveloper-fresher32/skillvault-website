# Serialization and Boundary Rules — Complete Guide

> "A prop crossing from server to browser isn't handed over — it's mailed, and not everything fits in the box."

---

## Table of Contents
1. [The Problem: Props Aren't Just a Function Call Anymore](#1-the-problem-props-arent-just-a-function-call-anymore)
2. [The International Package Model](#2-the-international-package-model)
3. [Tracing the RSC Payload: From Server Props to Client Props](#3-tracing-the-rsc-payload-from-server-props-to-client-props)
4. [Code Walkthrough: A Valid Prop and an Invalid One](#4-code-walkthrough-a-valid-prop-and-an-invalid-one)
5. [What Crosses the Boundary and What Doesn't](#5-what-crosses-the-boundary-and-what-doesnt)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Props Aren't Just a Function Call Anymore

In an all-client React app, passing a prop is a normal function call in the same JS runtime — pass a function, an object, a `Map`, anything, it doesn't matter, because parent and child execute in the same place at the same time.

```
Server Component → Client Component prop passing is NOT that.

Server Component runs on the server.
Client Component's code runs in the browser — a different machine, a different time.

For a prop to arrive, it must:
  leave the server as data → travel the network → get reconstructed in the browser

That's a data transfer, not a function call — only things describable as
data can survive the trip.
```

Lesson 1 covered which files end up in the client bundle; Lesson 2 covered handing Server Component output down as `children`. This lesson covers the last piece: once you're passing an ordinary prop (not a whole rendered element), what's actually allowed inside it.

---

## 2. The International Package Model

Mailing a package internationally: customs lets through anything physical and describable — a book, a toy — because it can be packed, shipped, and unpacked unchanged. You can't mail a live phone call (an ongoing real-time connection, nothing to box up) or a person standing in your office (living, stateful, tied to a specific place).

```
Serializable props      → the physical objects: plain data, no hidden behavior,
                           no live connection to a specific runtime.
                           Broader than plain objects/arrays — customs keeps a
                           standing list of known container types (Date, Map,
                           Set, and others) it already knows how to pack/unpack.

Ordinary functions       → the live phone call: a pointer to executable code in
                           the server's JS engine — no way to "mail" that and
                           reconstruct a working callable on another machine.

Your own class instances → the person in the office: carries internal state and
                           identity a plain data snapshot can't reconstruct, and
                           unlike Date/Map/Set, isn't on customs' pre-approved
                           list — no shipping label the RSC format knows how
                           to attach.
```

---

## 3. Tracing the RSC Payload: From Server Props to Client Props

```
Server Component renders <ClientWidget data={{ id: 1, name: "Alice" }} />
        │
        ▼
Prop value is serialized into the RSC wire format
  plain objects/arrays/strings/numbers/booleans → straightforward
  Date/Map/Set/TypedArray/ArrayBuffer/FormData   → natively supported,
                                                    reconstructed as LIVE instances
  functions/arbitrary class instances/Symbols    → no representation, error/dropped
        │
        ▼
Serialized RSC payload sent to the browser, alongside the already-rendered
HTML for the rest of the page
        │
        ▼
Browser's React runtime deserializes the payload back into a JS value
        │
        ▼
ClientWidget receives that deserialized value as its `data` prop —
a RECONSTRUCTED COPY, not a live reference to the server-side object
```

Even for data that crosses successfully, mutating the received prop in the browser has zero effect server-side — there was never a live link, only a one-time snapshot transfer.

---

## 4. Code Walkthrough: A Valid Prop and an Invalid One

Valid — plain, serializable data:

```jsx
// app/dashboard/page.js  (Server Component)
import ClientWidget from "./ClientWidget";

export default function Page() {
  const user = { id: 1, name: "Alice" };
  return <ClientWidget data={user} />;
}
```

```jsx
// app/dashboard/ClientWidget.js  (Client Component)
"use client";

export default function ClientWidget({ data }) {
  return <p>Hello, {data.name}</p>;
}
```

`{ id: 1, name: "Alice" }` is plain strings and numbers — serializes cleanly, crosses the network, `ClientWidget` gets an equivalent reconstructed object.

Invalid — passing a function directly:

```jsx
// app/dashboard/page.js  (Server Component) — BROKEN
import ClientWidget from "./ClientWidget";

export default function Page() {
  return (
    <ClientWidget
      onSave={function () {
        console.log("saving...");
      }}
    />
  );
}
```

`onSave` is an ordinary function — no serializable representation, nothing to put in the RSC payload's box. Two real fixes. Move the logic into the Client Component so no function crosses at all:

```jsx
// app/dashboard/ClientWidget.js  (Client Component) — fixed
"use client";

export default function ClientWidget() {
  function handleSave() {
    console.log("saving...");
  }
  return <button onClick={handleSave}>Save</button>;
}
```

Or, when the logic genuinely needs to run server-side (a DB write), use a Server Action — a special function type allowed to cross via its own dedicated mechanism (Phase 6).

---

## 5. What Crosses the Boundary and What Doesn't

| Value type | Crosses the Server → Client prop boundary? |
|---|---|
| Plain objects and arrays (strings, numbers, booleans, nested plainly) | Yes |
| `Date` objects | Yes — crosses as a live `Date` instance, usual methods intact, no manual conversion needed |
| `Map` and `Set` | Yes, natively supported — arrive as live `Map`/`Set` instances, not stripped to plain objects/arrays |
| Typed arrays / `ArrayBuffer` / `FormData` | Yes, natively supported — reconstructed as live instances of the same type |
| Ordinary functions (event handlers, callbacks) | No |
| Server Actions | Yes — via a distinct mechanism from plain data serialization, not the same as passing an ordinary function (Phase 6) |
| Arbitrary class instances (your own custom classes) | No |

The last row is the easiest to get backwards: it's tempting to assume "class instances don't cross" means *any* object fancier than a plain literal is unsupported, including `Date`/`Map`/`Set`. Not the rule — the RSC serialization format has native, built-in support for those specific types and reconstructs them as live instances. It can't generalize that trick to a class you wrote yourself, since it has no way to also ship your class's method definitions.

---

## 6. Common Mistakes

- **Passing an event handler function as a prop from a Server Component down to a Client Component.** The most common version — `onClick={someServerDefinedFunction}` the same way you'd write it in an all-client app. Fix: move the handler's logic into the Client Component, or use a Server Action.
- **Assuming ALL built-in types are supported, and over-generalizing to custom classes.** `Date`, `Map`, `Set`, typed arrays, and `FormData` cross natively as live instances — but that native support is specific to those built-in types. A custom `UserAccount` class is *not* natively supported the same way, even though it might feel "built-in-adjacent" by analogy.
- **Assuming any function passed from a Server Component is automatically a Server Action.** Only functions specifically defined and marked as Server Actions get special cross-boundary treatment; a lookalike ordinary function does not silently become one.
- **Reaching for manual ISO-string conversion on a `Date` prop "just in case."** Since `Date` crosses natively as a live instance, `.toISOString()`/`new Date(...)` round-tripping by habit is unnecessary — it doesn't hurt correctness, but it solves a problem that doesn't exist for this type.

---

## 7. Hands-On Exercises

**Exercise 1:** Build the valid case from Section 4 — `page.js` passing `data={{ id: 1, name: "Alice" }}` into `ClientWidget.js`. Confirm the rendered page shows "Hello, Alice."

**Exercise 2:** Attempt the invalid case from Section 4 — pass a plain inline function as a prop from `page.js` into `ClientWidget.js` — and note the exact build/runtime error.

**Exercise 3:** Fix the broken version from Exercise 2 by moving `console.log("saving...")` into `ClientWidget.js` as a local `handleSave` triggered by `onClick`, exactly as in Section 4's fixed version. Confirm clicking now works with no cross-boundary function involved.

**Exercise 4:** Extend `page.js` to also pass a `createdAt` prop as a raw `new Date()` — no conversion. Inside `ClientWidget`, log `createdAt instanceof Date` (should be `true`) and call `createdAt.getFullYear()` directly, confirming it's a fully live `Date` instance.

**Exercise 5:** Write a one-paragraph explanation for a teammate of why `new Map([["id", 1]])` works and arrives as a live `Map` on the client, but an instance of `class UserAccount { constructor(id) { this.id = id; } }` does not, even though both are informally "just an object wrapping some data."

---

## 8. Interview Q&A

**Q: Why can't you pass a regular function as a prop from a Server Component to a Client Component?**
Because a prop passed across that boundary has to be serialized — turned into plain, transmittable data — sent over the network, and reconstructed in the browser. A function is executable code tied to the server's specific JavaScript runtime; there's no way to describe "run this exact code" as portable data, so it has no serializable representation and can't survive the trip.

**Q: What's the exception to "functions can't cross the Server-to-Client boundary"?**
Server Actions. They look like ordinary functions passed as props, but Next.js recognizes and threads them through a distinct mechanism specifically built to let a Client Component trigger server-side logic, rather than relying on the same plain-data serialization path everything else uses. Covered in depth in Phase 6.

**Q: What happens if you pass a `Date` object directly as a prop from a Server Component?**
It crosses cleanly — `Date` is one of the built-in types the RSC serialization format natively supports, so the Client Component receives a live `Date` instance with all its usual methods intact (`.getFullYear()`, `.toISOString()`, and so on). No manual conversion to a string and back is required; that's a common workaround for other unsupported values, but not needed for `Date`.

**Q: Can you pass a class instance, like an instance of a custom `User` class, as a prop to a Client Component?**
Not as a working instance of that exact class — different from passing a built-in type like `Date`, `Map`, or `Set`, which the RSC serialization format knows how to reconstruct natively. A custom class you define yourself isn't covered by that native support, so an arbitrary instance arrives (if at all) stripped of its methods and identity. Passing a plain object with the same field values avoids the ambiguity entirely.

**Q: Is passing data from a Server Component to a Client Component the same kind of operation as passing props between two ordinary React components in a client-only app?**
No. In an all-client app, passing a prop is a normal function call within the same running JavaScript process — nothing travels anywhere. Passing a prop from a Server Component to a Client Component requires that data to be serialized on the server, sent across the network as part of the RSC payload, and deserialized in the browser, which is why only genuinely serializable values are allowed to make that trip.
