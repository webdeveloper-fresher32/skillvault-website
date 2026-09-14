# Cookie Attributes Explained

## Table of Contents
1. [Anatomy of a Set-Cookie Header](#1-anatomy-of-a-set-cookie-header)
2. [Domain](#2-domain)
3. [Path](#3-path)
4. [Expires and Max-Age](#4-expires-and-max-age)
5. [Secure](#5-secure)
6. [HttpOnly](#6-httponly)
7. [SameSite: Strict, Lax, None](#7-samesite-strict-lax-none)
8. [Full Attribute Reference Table](#8-full-attribute-reference-table)
9. [A Well-Configured Cookie, Assembled](#9-a-well-configured-cookie-assembled)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Anatomy of a Set-Cookie Header

A single `Set-Cookie` header is a semicolon-separated list: the name=value pair, followed by zero or more attributes.

```http
Set-Cookie: session_id=abc123xyz; Domain=example.com; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Strict
```

```
session_id=abc123xyz   ← the actual cookie data (the only part sent back in the Cookie header)
Domain=example.com     ← attribute: which hosts get this cookie
Path=/                 ← attribute: which URL paths get this cookie
Max-Age=3600           ← attribute: how long it lives
Secure                 ← attribute: HTTPS-only flag (no value)
HttpOnly               ← attribute: JS-inaccessible flag (no value)
SameSite=Strict        ← attribute: cross-site sending policy
```

Each attribute is an **instruction to the browser** about how to store, expose, and re-send the cookie. None of them are sent back to the server in the `Cookie` header — the server has to remember what it set.

---

## 2. Domain

Controls **which hosts** the cookie is sent to.

```http
Set-Cookie: session_id=abc123; Domain=example.com
```

- If `Domain` is omitted, the cookie defaults to the **exact host** that set it (not subdomains) — this is actually the more restrictive, safer default.
- If `Domain=example.com` is explicitly set, the cookie is sent to `example.com` **and all its subdomains** (`api.example.com`, `www.example.com`, `admin.example.com`).
- A server can only set `Domain` to its own domain or a parent of it — `evil.com` cannot set a cookie with `Domain=example.com`. This is enforced by the browser.

**What it controls:** the blast radius of a cookie across subdomains. Setting `Domain` broadly means a compromised subdomain (e.g., a forgotten staging site at `old.example.com`) could potentially read/manipulate cookies meant for the main app if they share scope.

---

## 3. Path

Controls **which URL paths** the cookie is sent to, within the allowed domain.

```http
Set-Cookie: admin_token=xyz; Path=/admin
```

This cookie is only attached to requests whose path starts with `/admin` (e.g., `/admin/users`) — it will **not** be sent on a request to `/dashboard`.

- Default: the path of the request that set the cookie.
- Most apps just use `Path=/` so the cookie is sent everywhere on the site.

**What it controls:** fine-grained scoping so different areas of a site (e.g., `/admin` vs `/public`) can use separate cookies that don't leak into each other's requests.

---

## 4. Expires and Max-Age

Control **how long** the cookie lives before the browser deletes it.

```http
Set-Cookie: session_id=abc123; Expires=Wed, 09 Jun 2027 10:18:14 GMT
Set-Cookie: session_id=abc123; Max-Age=3600
```

| | `Expires` | `Max-Age` |
|---|---|---|
| Format | Absolute date/time | Seconds from now |
| Clock dependency | Relies on client clock being correct | Relative — less error-prone |
| Precedence | Ignored if `Max-Age` is also present | Wins over `Expires` when both are set |

If **neither** is set, the cookie is a **session cookie** — it lives only until the browser (not the tab, the whole browser application) is closed, and is never written to disk permanently.

**What it controls:** the exposure window. A cookie with no expiry (session cookie) disappears when the browser closes; a long `Max-Age` persists across restarts (e.g., "remember me" for 30 days) but also gives an attacker a longer window if it's ever stolen.

---

## 5. Secure

```http
Set-Cookie: session_id=abc123; Secure
```

Tells the browser: **only send this cookie over HTTPS**, never over plain HTTP. If the site is loaded over `http://`, the browser will withhold this cookie entirely.

**What it prevents:** a network eavesdropper (e.g., on public WiFi, or a malicious router) intercepting the cookie in transit by watching unencrypted HTTP traffic. Without `Secure`, a session cookie could be sniffed in plaintext even if the login page itself used HTTPS, if the app ever falls back to an HTTP request.

---

## 6. HttpOnly

```http
Set-Cookie: session_id=abc123; HttpOnly
```

Tells the browser: **do not expose this cookie to JavaScript** — `document.cookie` will not include it.

**What it prevents:** theft via **XSS (Cross-Site Scripting)**. If an attacker manages to inject a malicious `<script>` into your page, `HttpOnly` stops that script from reading `document.cookie` and exfiltrating the session ID to an attacker's server. It doesn't stop XSS from happening, but it stops XSS from being useful for cookie theft specifically.

---

## 7. SameSite: Strict, Lax, None

Controls whether the cookie is sent on **cross-site requests** — i.e., requests initiated from a different site than the one the cookie belongs to (a critical defense against CSRF, covered fully in lesson 04).

```http
Set-Cookie: session_id=abc123; SameSite=Strict
Set-Cookie: session_id=abc123; SameSite=Lax
Set-Cookie: session_id=abc123; SameSite=None; Secure
```

| Value | Sent on same-site requests? | Sent on cross-site navigation (clicking a link)? | Sent on cross-site `<img>`/`<form>`/`fetch` from another site? |
|---|---|---|---|
| **Strict** | Yes | No | No |
| **Lax** (browser default since ~2020) | Yes | Yes (top-level GET navigation only) | No |
| **None** | Yes | Yes | Yes — requires `Secure` |

- `Strict`: the cookie is never sent unless the request originates from the exact site it belongs to. Most secure, but can break flows like "click an email link to your bank and land already logged in" — the first request after clicking won't carry the cookie.
- `Lax`: allows the cookie on top-level navigations (clicking a link that does a GET), but blocks it on background cross-site requests like an auto-submitting form, an `<img>` tag, or a `fetch()` from another origin. This is the practical default for most session cookies.
- `None`: cookie is sent on every cross-site context — necessary for legitimate cross-site use cases (e.g., a third-party embedded widget), but requires `Secure` and reopens the door to CSRF-style cookie attachment, so it must be paired with other defenses (CSRF tokens).

**What it controls:** this is the primary cookie-level defense against CSRF, because CSRF attacks work specifically by getting a victim's browser to send a cross-site request that carries their cookies.

---

## 8. Full Attribute Reference Table

| Attribute | Purpose | Attack/Behavior It Controls |
|---|---|---|
| `Domain` | Which hosts/subdomains receive the cookie | Scope of exposure across subdomains |
| `Path` | Which URL paths receive the cookie | Scope of exposure across app sections |
| `Expires` / `Max-Age` | How long the cookie persists | Exposure time window if stolen |
| `Secure` | HTTPS-only transmission | Network eavesdropping / packet sniffing |
| `HttpOnly` | Blocks JavaScript (`document.cookie`) access | Cookie theft via XSS |
| `SameSite` | Controls cross-site sending | CSRF (cross-site request forgery) |

---

## 9. A Well-Configured Cookie, Assembled

Putting it together, a properly hardened session cookie for a typical web app looks like:

```http
Set-Cookie: session_id=abc123xyz; Domain=example.com; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax
```

This is exactly the shape of cookie configuration you'll see implemented in code (via `express-session`'s `cookie` options) in [`../../NodeJS/Phase-07-Auth-and-Security/03-Session-Based-Authentication.md`](../../NodeJS/Phase-07-Auth-and-Security/03-Session-Based-Authentication.md) — that lesson shows the `httpOnly`, `secure`, `sameSite`, and `maxAge` options passed to `express-session`, which compile down to exactly this header.

---

## 10. Hands-On Exercises

1. Run `curl -v https://httpbin.org/cookies/set?name=value` and read every attribute httpbin sets on the response's `Set-Cookie` header.
2. In DevTools → Application → Cookies for any logged-in site, inspect a session cookie's columns (`Domain`, `Path`, `Expires`, `HttpOnly`, `Secure`, `SameSite`). Identify which flags are set to `true`/`checked`.
3. Try to read a cookie marked `HttpOnly` via the browser console using `document.cookie` — confirm it does not appear in the output, while a non-`HttpOnly` cookie does.
4. Set a test cookie with `Max-Age=10` via DevTools or a small script, wait 15 seconds, and refresh — confirm the browser deleted it.
5. Find a site that sets a cookie with `SameSite=None` — inspect whether it's also marked `Secure` (it's required to be, per spec, or modern browsers reject it).

---

## 11. Interview Q&A

**Q: What's the difference between `Secure` and `HttpOnly`?**
Answer: `Secure` restricts the cookie to being sent only over HTTPS, protecting it from network eavesdroppers on plaintext HTTP. `HttpOnly` restricts the cookie from being accessed by JavaScript (`document.cookie`), protecting it from theft via XSS. They defend against different attack vectors and are typically both set on sensitive cookies.

**Q: What happens if neither `Expires` nor `Max-Age` is set on a cookie?**
Answer: It becomes a session cookie — it's kept only in browser memory and is deleted when the browser application is fully closed (not just the tab). It's never persisted to disk.

**Q: Explain the three `SameSite` values and when you'd use each.**
Answer: `Strict` never sends the cookie cross-site — most secure but can break "click a link and land logged in" flows. `Lax` (the modern browser default) sends it on top-level GET navigations but blocks it on background cross-site requests like form auto-submits or image loads — a good default for session cookies. `None` sends it in all cross-site contexts and requires `Secure` — needed for legitimate third-party/embedded use cases, but requires additional CSRF defenses.

**Q: If a cookie has `Domain=example.com` set, will it be sent to `api.example.com`?**
Answer: Yes — explicitly setting `Domain` includes all subdomains of that domain. If `Domain` were omitted entirely, the cookie would default to the exact host that set it and would not be shared with `api.example.com`.

**Q: Does `HttpOnly` prevent XSS attacks?**
Answer: No — it doesn't stop an XSS injection from happening at all. It only prevents an XSS payload from being able to read that specific cookie via JavaScript, which removes one common goal of an XSS attack (session hijacking via cookie theft). Other XSS damage (DOM manipulation, keylogging, phishing overlays) is unaffected.

**Q: Why would `SameSite=Strict` be a bad choice for some login flows?**
Answer: With `Strict`, the cookie is withheld on the very first request that results from a cross-site navigation — e.g., a user clicking a link to your site from an email or another domain. That first request would look "logged out" even if the user has a valid session, because the browser won't attach the cookie until a same-site request is made. `Lax` fixes this for top-level navigations while still blocking the cross-site background requests that CSRF relies on.
