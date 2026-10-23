# Storage APIs — Complete Guide

## Table of Contents
1. [Why Client-Side Storage](#1-why-client-side-storage)
2. [localStorage](#2-localstorage)
3. [sessionStorage](#3-sessionstorage)
4. [JSON Serialization for Storage](#4-json-serialization-for-storage)
5. [Cookies](#5-cookies)
6. [The storage Event](#6-the-storage-event)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Client-Side Storage

Browsers give JavaScript three main ways to persist data on the user's machine without a server round-trip: `localStorage`, `sessionStorage`, and cookies. Each has a different lifetime, capacity, and visibility to the server, and picking the right one is a common practical (and interview) decision.

```
Mechanism        Lifetime                    Capacity     Sent to server?
─────────────────────────────────────────────────────────────────────────
localStorage      Until explicitly cleared    ~5-10MB      No — JS only,
                  (survives browser restart,               never automatically
                  tab close, days/years)                   sent in requests

sessionStorage    Until the TAB is closed      ~5-10MB      No — JS only
                  (survives page reload,
                  NOT survives tab close)

Cookies           Configurable (session or     ~4KB total    YES — automatically
                  a set expiry date)            per cookie,   attached to every
                                                ~50 cookies   matching HTTP
                                                per domain    request's headers
```

---

## 2. localStorage

`localStorage` persists data with no expiration date — it survives page reloads, browser restarts, and remains until explicitly cleared by code or the user. It's scoped per **origin** (protocol + domain + port) — data stored from `https://example.com` is not visible to `https://other.com` or even `http://example.com` (different protocol).

```js
// Storing data — keys and values are ALWAYS strings
localStorage.setItem("theme", "dark");
localStorage.setItem("username", "asha_dev");

// Reading data
console.log(localStorage.getItem("theme")); // "dark"
console.log(localStorage.getItem("nonExistentKey")); // null — NOT undefined, NOT an error

// Removing a single key
localStorage.removeItem("username");

// Removing EVERYTHING for this origin
localStorage.clear();

// Checking how many keys are stored, and iterating over them
localStorage.setItem("a", "1");
localStorage.setItem("b", "2");
console.log(localStorage.length); // 2
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  console.log(key, localStorage.getItem(key));
}
```

### Field-by-Field Breakdown

```
localStorage.setItem(key, value)
  ↳ Both key and value are coerced to strings. Storing a number or
    object directly stores its .toString() representation, NOT the
    original type — this is why JSON serialization matters (Section 4).

localStorage.getItem(key)
  ↳ Returns the stored string, or `null` if the key doesn't exist.
  ↳ Common bug: checking `if (localStorage.getItem(key))` fails for
    a stored value of the STRING "false" or "0" — both are truthy
    strings! Always compare against null explicitly if that matters:
    if (localStorage.getItem(key) !== null) { ... }

localStorage.removeItem(key) / .clear()
  ↳ Synchronous, immediate, permanent for this origin.

Persistence and quota:
  ↳ Survives browser restarts and system reboots.
  ↳ Typical browser quota is 5-10MB PER ORIGIN (varies by browser).
  ↳ Exceeding quota throws a QuotaExceededError — always wrap
    setItem in try/catch in code that stores larger amounts of data.
```

---

## 3. sessionStorage

`sessionStorage` has the exact same API as `localStorage` (`setItem`, `getItem`, `removeItem`, `clear`, `.length`, `.key()`) — the only difference is its lifetime: it's cleared when the tab/window is closed, and is **not shared** between tabs, even tabs open to the exact same page.

```js
sessionStorage.setItem("checkoutStep", "2");
console.log(sessionStorage.getItem("checkoutStep")); // "2"

// Reloading the SAME tab: sessionStorage survives.
// Opening the same URL in a NEW tab: that new tab gets its OWN,
// separate, empty sessionStorage — it does NOT inherit this tab's data.
// Closing this tab: this tab's sessionStorage is gone permanently.
```

```
When to use sessionStorage instead of localStorage:

  - Multi-step form or checkout flow progress that should NOT
    persist once the user closes the tab
  - Per-tab state that would be confusing if shared across tabs
    (e.g., which item is "currently being edited" in this specific
    tab, if the user has the same app open in two tabs at once)
  - Temporary data you deliberately do NOT want lingering after
    the session ends, for privacy or clutter reasons
```

---

## 4. JSON Serialization for Storage

Both `localStorage` and `sessionStorage` only store strings. To store objects, arrays, numbers, or booleans, you must serialize with `JSON.stringify()` before storing and `JSON.parse()` after reading.

```js
const userPreferences = {
  theme: "dark",
  fontSize: 16,
  notifications: { email: true, sms: false },
  recentSearches: ["laptop", "headphones"],
};

// WRONG — stores the useless string "[object Object]"
localStorage.setItem("prefs", userPreferences);
console.log(localStorage.getItem("prefs")); // "[object Object]"

// CORRECT — serialize to a JSON string first
localStorage.setItem("prefs", JSON.stringify(userPreferences));

// Reading it back — must parse the JSON string back into a real object
const stored = JSON.parse(localStorage.getItem("prefs"));
console.log(stored.theme);              // "dark"
console.log(stored.notifications.email); // true
console.log(Array.isArray(stored.recentSearches)); // true — a real array again, not a string

// Defensive reading — getItem can return null, and stored data
// could theoretically be corrupted/tampered with by the user via devtools
function readPrefs() {
  try {
    const raw = localStorage.getItem("prefs");
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("Corrupted preferences data, resetting:", err);
    return null;
  }
}
```

```
Things JSON.stringify CANNOT represent (silently dropped or altered):

  - Functions                    → omitted entirely
  - undefined (as an object value) → omitted entirely
  - Symbol values                → omitted entirely
  - Date objects                 → converted to an ISO STRING,
                                    NOT restored as a Date automatically
                                    by JSON.parse — you must manually
                                    convert it back: new Date(parsed.createdAt)
  - Map / Set                    → serialize to "{}" / "[]" — need
                                    manual conversion via
                                    Object.fromEntries()/Array.from()
                                    before stringifying, and reconstruction
                                    after parsing
  - Circular references          → throws a TypeError immediately
```

---

## 5. Cookies

Cookies are the oldest client-side storage mechanism, and the only one of the three that's automatically sent to the server with every matching HTTP request. `document.cookie` is a single, awkward string-based API for reading/writing them from JavaScript.

```js
// Setting a cookie — document.cookie looks like a property but behaves
// like a special setter: assigning to it ADDS/updates ONE cookie,
// it does NOT overwrite all existing cookies.
document.cookie = "theme=dark; expires=Fri, 31 Dec 2027 23:59:59 GMT; path=/";
document.cookie = "sessionId=abc123; path=/; SameSite=Strict; Secure";

// Reading cookies — document.cookie GETS all cookies as ONE semicolon-
// separated string, which you must parse yourself:
console.log(document.cookie); // "theme=dark; sessionId=abc123"

function getCookie(name) {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}
console.log(getCookie("theme")); // "dark"

// Deleting a cookie — there's no "delete" method; you overwrite it
// with an expiration date in the past:
document.cookie = "theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
```

### Cookie Attributes

```
name=value
  ↳ The actual data. Both should be URL-encoded if they might
    contain special characters (; or =).

expires=<date>  (or max-age=<seconds>)
  ↳ Without either, the cookie is a SESSION cookie — deleted when
    the browser (not just the tab) fully closes.
  ↳ max-age is generally preferred (relative, e.g. max-age=3600
    for 1 hour) over an absolute expires date.

path=/
  ↳ Restricts which URL paths on the domain can see this cookie.
    path=/ means the whole domain.

domain=example.com
  ↳ Controls which (sub)domains receive the cookie. Omitting it
    defaults to the exact current host only.

Secure
  ↳ Cookie is only sent over HTTPS connections, never plain HTTP.

SameSite=Strict | Lax | None
  ↳ Controls whether the cookie is sent on cross-site requests —
    a key CSRF (cross-site request forgery) defense.
  ↳ Strict: never sent cross-site. Lax (the modern default):
    sent on top-level navigation, not on cross-site subrequests.
    None: sent everywhere (requires Secure to also be set).

HttpOnly
  ↳ IMPORTANT CAVEAT: HttpOnly cookies are NOT set by JavaScript
    at all — HttpOnly can ONLY be set by the SERVER, via the
    Set-Cookie HTTP response header. If a cookie has HttpOnly set,
    document.cookie CANNOT read it, write it, or even see it exists —
    it's completely invisible to client-side JavaScript. This is a
    deliberate security measure to protect sensitive cookies (like
    session tokens) from being stolen via an XSS attack that injects
    malicious JavaScript into the page.
```

---

## 6. The storage Event

The `storage` event fires on the `window` object of **other** tabs/windows (same origin) whenever `localStorage` is modified — but never on the same tab/window that made the change. This makes it useful for keeping multiple open tabs in sync.

```js
// In Tab A and Tab B, both on the same site, both run this:
window.addEventListener("storage", (event) => {
  console.log("Storage changed:", {
    key: event.key,             // the key that changed
    oldValue: event.oldValue,   // its previous value (string or null)
    newValue: event.newValue,   // its new value (string or null)
    url: event.url,             // the URL of the page that made the change
  });
});

// If Tab A runs this:
localStorage.setItem("theme", "light");
// → Tab A itself does NOT receive a storage event for its own change.
// → Tab B (and any other open tab on the same origin) DOES receive
//   the event, and can react — e.g., updating its own UI to match
//   the new theme without needing a page reload.
```

```
Practical use case: "logout in one tab, log out everywhere"
  1. User clicks "Log out" in Tab A.
  2. Tab A clears an "authToken" key from localStorage.
  3. Tab B and Tab C, both listening for the storage event, detect
     that "authToken" changed to null and immediately redirect
     themselves to the login page too — without any server polling.
```

---

## 7. Hands-On Exercises

**Exercise 1:** Build a small "remember my theme" feature: a button that toggles between `"light"` and `"dark"`, storing the current choice in `localStorage` under the key `"theme"`. On page load, read the stored value (defaulting to `"light"` if none exists using the `!== null` pattern from Section 2) and apply it. Reload the page and confirm the theme persists.

**Exercise 2:** Store a JavaScript object representing a shopping cart (an array of `{ id, name, price, quantity }` items) in `sessionStorage` using `JSON.stringify`/`JSON.parse`. Add functions `addToCart(item)`, `removeFromCart(id)`, and `getCart()` that each read the current state, modify it, and write it back. Open the same page in a new tab and confirm the cart does NOT carry over (proving `sessionStorage` is per-tab).

**Exercise 3:** Write `setCookie(name, value, days)` and `getCookie(name)` helper functions from scratch (not copying Section 5 verbatim — write your own version) that correctly handle the `expires`/`max-age`, `path`, and URL-encoding concerns. Use them to store a "cookie consent accepted" flag, and verify in your browser's DevTools Application/Storage tab that the cookie appears with the attributes you set.

**Exercise 4:** In DevTools, manually set an `HttpOnly` cookie is not possible from the Console (that's the point) — instead, research and write a short comment explaining, step by step, why an XSS attack that successfully injects `document.cookie`-reading JavaScript into a page still cannot steal a properly configured `HttpOnly` session cookie, and what specifically an attacker CAN still steal via `document.cookie` if `HttpOnly` is NOT set on the session cookie.

**Exercise 5:** Open the same page in two side-by-side browser tabs. Add a `storage` event listener that logs any change to a `"notificationCount"` key in `localStorage`, and add a button in each tab that increments that key's value. Click the button in Tab A and confirm Tab B's listener fires (logging the old and new value) while Tab A's own listener does NOT fire for its own change — verifying the cross-tab-only behavior described in Section 6.

---

## 8. Interview Q&A

**Q: What are the key differences between `localStorage`, `sessionStorage`, and cookies?**
Answer: `localStorage` persists indefinitely until explicitly cleared by code or the user, is scoped per origin, holds roughly 5-10MB, and is never automatically sent to the server. `sessionStorage` shares the exact same API but is scoped per tab/window rather than per origin — it's cleared when that specific tab closes and is not shared even with another tab open to the identical URL. Cookies are far smaller (roughly 4KB per cookie) but are the only one of the three automatically attached to matching HTTP requests by the browser, which makes them the right (and traditionally the only) mechanism for data the server itself needs to see on every request, such as session identifiers, while also making them more expensive from a network-payload perspective if used to store larger amounts of data.

**Q: Why do you need JSON.stringify/JSON.parse when working with localStorage, and what data does JSON.stringify silently lose?**
Answer: `localStorage` (and `sessionStorage`) can only store strings — both keys and values are coerced to strings automatically, so attempting to store a plain JavaScript object directly results in the useless string `"[object Object]"` rather than any usable representation of the data. `JSON.stringify()` converts an object, array, or primitive into an actual string representation of its structure and values, which can then be stored properly, and `JSON.parse()` reverses that process when reading the data back out. However, `JSON.stringify` cannot represent everything: functions, `undefined` object properties, and `Symbol` values are simply omitted from the output; `Date` objects are converted into ISO date strings rather than preserved as `Date` instances, requiring manual reconstruction with `new Date(...)` after parsing; `Map` and `Set` instances serialize to empty-looking `"{}"`/`"[]"` unless manually converted to arrays first; and any circular reference in the object being stringified throws a `TypeError` immediately rather than silently succeeding.

**Q: What does the `HttpOnly` cookie attribute do, and why can JavaScript never set it?**
Answer: `HttpOnly` marks a cookie as inaccessible to client-side JavaScript entirely — code running on the page cannot read it, write it, or even detect its existence through `document.cookie`, which will simply omit it from the string it returns. This is a deliberate security boundary: `HttpOnly` can only be set by the server, via the `Set-Cookie` HTTP response header, precisely because its entire purpose is to protect a sensitive cookie (most commonly a session token) from being stolen by a cross-site scripting (XSS) attack, where malicious JavaScript gets injected into the page and tries to exfiltrate cookie data. If JavaScript itself were able to set the `HttpOnly` flag, the security guarantee would be meaningless, since any script capable of setting the flag would, by definition, also be capable of reading the cookie before setting it or simply never setting the flag on an attacker-controlled duplicate cookie. This is why any cookie that JavaScript needs to read or write directly through `document.cookie` cannot have `HttpOnly` protection, and why sensitive authentication cookies should be set by the server with `HttpOnly` (and typically `Secure` and `SameSite`) rather than managed client-side.

**Q: How does the `storage` event work, and why doesn't it fire on the same tab that made the change?**
Answer: The `storage` event fires on the `window` object of every OTHER open tab or window that shares the same origin, whenever `localStorage` is modified — it delivers the key that changed, its old and new values, and the URL of the page that made the change. It intentionally does not fire on the tab that made the change itself, because from that tab's own perspective, the code that just ran the `setItem` call already knows the new value directly; the event's purpose is specifically to notify OTHER contexts that weren't part of that operation, so they can react to a change they wouldn't otherwise know happened. This makes the event useful for keeping multiple open tabs synchronized without needing to poll the server — a common real-world example is implementing "log out in one tab logs out everywhere," where clearing an auth token in `localStorage` from one tab triggers every other open tab's `storage` listener to detect the change and redirect to a login page.

**Q: Why might exceeding localStorage's quota cause a problem, and how should you defensively handle that in code?**
Answer: Browsers impose a per-origin storage quota on `localStorage`, typically in the range of 5-10MB depending on the browser, and calling `setItem` after that quota has been exceeded throws a `QuotaExceededError` (a `DOMException`) synchronously rather than silently failing or truncating the data. Code that stores nontrivial or growing amounts of data — accumulated logs, a large cached dataset, an ever-expanding history list — should wrap `setItem` calls in a `try`/`catch` block specifically to handle this exception gracefully, for example by pruning older entries, falling back to storing a reduced subset of data, or notifying the user, rather than letting an uncaught exception break the surrounding feature. This is easy to overlook during development with small test data but becomes a real production concern once actual usage patterns accumulate enough stored data to approach the browser's limit.
