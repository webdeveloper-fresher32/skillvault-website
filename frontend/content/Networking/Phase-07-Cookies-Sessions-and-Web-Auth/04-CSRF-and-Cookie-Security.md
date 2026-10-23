# CSRF and Cookie Security — Complete Guide

## Table of Contents
1. [What is CSRF?](#1-what-is-csrf)
2. [How to Prevent CSRF](#2-how-to-prevent-csrf)
3. [CSRF vs CORS](#3-csrf-vs-cors)
4. [Hands-On Exercises](#4-hands-on-exercises)
5. [Interview Q&A](#5-interview-qa)

---

## 1. What is CSRF?

Cookies are incredibly convenient because the browser attaches them to outgoing requests automatically. However, this automatic behavior is also the root cause of one of the most classic web vulnerabilities: **Cross-Site Request Forgery (CSRF)**.

Imagine you are logged into your bank at `bank.com`. Your browser has a valid session cookie for `bank.com`.

In another tab, you visit a malicious website, `evil.com`.

The attacker who owns `evil.com` places a hidden form on their page that automatically submits via JavaScript when the page loads:

```html
<!-- Hosted on evil.com -->
<form action="https://bank.com/transfer" method="POST" id="stealMoney">
  <input type="hidden" name="amount" value="10000">
  <input type="hidden" name="to_account" value="AttackerAccount123">
</form>
<script>
  document.getElementById("stealMoney").submit();
</script>
```

**The Vulnerability:**
When `evil.com` submits this POST request to `bank.com/transfer`, your browser sees that the destination is `bank.com`. Because browsers automatically attach cookies to the destination domain, **your browser will attach your valid `bank.com` session cookie to this malicious request**.

The `bank.com` server receives the request, sees a perfectly valid session cookie, assumes *you* intentionally clicked a transfer button, and moves the money.

```
┌──────────┐  1. visits evil.com          ┌──────────┐
│ Victim's │ ────────────────────────────▶│ evil.com │
│ Browser  │                               └──────────┘
│          │  2. hidden form auto-submits with
│          │     victim's bank.com cookie attached
│          │ ─────────────────────────────────────────▶ ┌──────────┐
│          │                                             │ bank.com │
│          │ ◀───────────────────────────────────────── │ (moves   │
└──────────┘  3. server trusts the cookie, executes it   │  money)  │
                                                          └──────────┘
```

This is a Cross-Site Request Forgery. The attacker forced your browser to forge a request to a site where you are currently authenticated.

---

## 2. How to Prevent CSRF

### The Modern Solution: The `SameSite` Cookie Attribute

The simplest and most robust defense against CSRF is the `SameSite` attribute on your `Set-Cookie` header.

```http
Set-Cookie: session_id=abc; Secure; HttpOnly; SameSite=Lax
```

`SameSite` tells the browser under what conditions it is allowed to attach the cookie to cross-origin requests.

| Value | Behavior |
|---|---|
| `Strict` | The cookie is ONLY sent if the request originates from the exact same site that set the cookie. The `evil.com` form submission will fail because the browser will refuse to attach the cookie. |
| `Lax` (modern default) | The cookie is not sent on cross-site POST requests (preventing the attack above), but it IS sent on cross-site top-level navigations (e.g., if `evil.com` has a standard `<a>` link to `bank.com`, you will arrive at `bank.com` logged in, which is good UX). |
| `None` | The cookie is always sent, regardless of origin. Requires the `Secure` attribute. Only use this if you are building a third-party widget or a cross-domain SSO system. |

### The Legacy Solution: Anti-CSRF Tokens

Before `SameSite` existed, the standard defense was the Synchronizer Token Pattern (CSRF Tokens).

1. When the server renders a form on `bank.com`, it generates a random, unguessable string (the CSRF Token).
2. It embeds this token into the HTML form as a hidden input field.
3. When the user submits the form, the token is sent in the body of the POST request.
4. The server verifies that the token in the body matches the token it expects for that user's session.

**Why this stops `evil.com`:**
The attacker on `evil.com` can forge the request, and the browser will attach the cookies. But the attacker *cannot read* the HTML of `bank.com` (due to the Same-Origin Policy) to find out what the random CSRF token is. Therefore, the forged request will be missing the valid token, and the server will reject it.

---

## 3. CSRF vs CORS

These two concepts are frequently confused in interviews.

**CORS (Cross-Origin Resource Sharing) is about READ protection.**
The Same-Origin Policy (SOP) prevents JavaScript on `evil.com` from making a `fetch()` request to `bank.com` and *reading the response*. CORS allows a server to relax the SOP by explicitly saying which origins are allowed to read its responses.

**CSRF is about WRITE protection.**
In a CSRF attack, the attacker doesn't care about reading the response. They just want the server to execute the state-changing action (transferring the money). SOP does not prevent HTML forms from *sending* data across origins; it only prevents JS from *reading* the result. Therefore, you need CSRF protection (like `SameSite` cookies) to prevent unauthorized writes.

```
CORS  → guards whether evil.com's JS can READ bank.com's response
CSRF  → guards whether evil.com can trick the browser into WRITING to bank.com
```

---

## 4. Hands-On Exercises

**Exercise 1:** Open DevTools on any site you're logged into, inspect a `Set-Cookie` header in the Network tab, and identify which `SameSite` value it uses (`Strict`, `Lax`, or `None`).

**Exercise 2:** Build a minimal local HTML page with an auto-submitting form pointed at a test endpoint you control, and observe whether the cookie is attached when the form is hosted on a different origin than the target.

**Exercise 3:** Change a test cookie's `SameSite` attribute from `None` to `Strict` and re-run Exercise 2 — confirm the cross-site request no longer carries the cookie.

**Exercise 4:** Implement a basic Synchronizer Token Pattern in a toy server (embed a hidden token in a form, verify it on submit, reject requests where it's missing or mismatched).

**Exercise 5:** Explain in writing why storing a JWT in `localStorage` and sending it via an `Authorization` header sidesteps CSRF but introduces a new risk — then identify what that risk is.

---

## 5. Interview Q&A

**Q: If my API only returns JSON and doesn't accept form-encoded data, am I vulnerable to CSRF?**
Answer: Historically, yes. Attackers could craft forms with `enctype="text/plain"` to submit JSON-like payloads. Today, if your server strictly validates the `Content-Type: application/json` header, you are generally safe from simple HTML form-based CSRF, because an HTML `<form>` cannot send a request with a `Content-Type` of `application/json` (it requires JavaScript `fetch`, which triggers a CORS preflight). However, you should still use `SameSite` cookies as a defense-in-depth measure.

**Q: Do I need CSRF protection if I use JWTs stored in LocalStorage instead of Cookies?**
Answer: No. If you store your auth token in LocalStorage, the browser will not automatically attach it to requests. Your frontend JavaScript must manually read it from LocalStorage and append it as an `Authorization: Bearer <token>` header. Since `evil.com` cannot run JavaScript that reads your `bank.com` LocalStorage, it cannot attach the token to its forged requests. However, LocalStorage makes you more vulnerable to XSS instead, since any injected script on your own page can read it directly.

**Q: What is the difference between `SameSite=Strict` and `SameSite=Lax`, and which should you use for a session cookie?**
Answer: `Strict` blocks the cookie on every cross-site request, including top-level navigation from an external link — which can break UX if a user clicks a link from another site and expects to land logged in. `Lax` still blocks cross-site POSTs (the dangerous case for CSRF) but allows the cookie on top-level GET navigations. `Lax` is the modern browser default and is the right choice for most session cookies because it stops CSRF without breaking normal link-following behavior.

**Q: Why can't the Same-Origin Policy alone prevent CSRF?**
Answer: SOP restricts a script's ability to *read* cross-origin responses, but it was never designed to stop a page from *sending* a request cross-origin — HTML forms have always been allowed to POST to any URL, and browsers attach cookies for the target domain automatically. That's precisely the gap CSRF exploits: the attacker doesn't need to read the response, only to trigger the side effect.

**Q: How does a CSRF token differ from a session ID in terms of what it protects against?**
Answer: A session ID authenticates *who* is making the request. A CSRF token authenticates *that the request was intentionally initiated from your own site's page*, not forged from elsewhere. An attacker can get the browser to send a valid session ID (since cookies are automatic), but they cannot obtain the CSRF token because it's embedded in HTML they aren't allowed to read cross-origin.

**Q: Are `GET` requests generally exempt from CSRF concerns?**
Answer: They should be, by design — HTTP semantics say `GET` must be safe and not cause state changes, so even if a `GET` is forged (e.g., via an `<img src="...">` tag), it should not mutate data. CSRF becomes a real risk when applications violate this convention by performing state-changing operations (like deletions or transfers) via `GET` requests, which is why REST conventions and CSRF defenses both matter.
