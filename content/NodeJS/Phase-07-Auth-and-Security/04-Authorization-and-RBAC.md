# Authorization and RBAC — Complete Guide

## Table of Contents
1. [Authentication vs Authorization](#1-authentication-vs-authorization)
2. [What is Role-Based Access Control (RBAC)?](#2-what-is-role-based-access-control-rbac)
3. [Building RBAC Middleware](#3-building-rbac-middleware)
4. [Complete Example: Admin vs User Routes](#4-complete-example-admin-vs-user-routes)
5. [Beyond Roles: Permissions and Resource Ownership](#5-beyond-roles-permissions-and-resource-ownership)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Authentication vs Authorization

These two terms are frequently mixed up but answer different questions.

```
Authentication ("AuthN"):  "Who are you?"
  → verified by password/JWT/session (Phases 01-03)

Authorization ("AuthZ"):   "What are you allowed to do?"
  → decided by role/permission checks (this file)

A request can be:
  authenticated + authorized      → 200 OK
  authenticated + NOT authorized  → 403 Forbidden
  NOT authenticated               → 401 Unauthorized
```

A logged-in regular user is authenticated but not authorized to hit `/admin/users` — that request should return `403 Forbidden`, not `401 Unauthorized` (401 means "I don't know who you are," 403 means "I know who you are, and you can't do this").

---

## 2. What is Role-Based Access Control (RBAC)?

RBAC assigns each user one or more **roles** (e.g., `user`, `editor`, `admin`), and routes/actions declare which roles are allowed to access them, instead of checking individual users one by one.

```
Without RBAC:
  if (user.email === 'admin@company.com') { ... }  ← unmaintainable

With RBAC:
  user.role = 'admin'
  route requires role 'admin' or 'superadmin'
  → scales to any number of users without code changes
```

```
Typical role hierarchy:

  superadmin
      │  (can do everything admin can, plus manage other admins)
      ▼
    admin
      │  (can manage users, view all data)
      ▼
    editor
      │  (can create/edit content)
      ▼
    user
      (can view/manage own data only)
```

---

## 3. Building RBAC Middleware

The pattern: an `authenticateToken` middleware establishes `req.user` (see Phase-07-02), then a separate `authorize(...roles)` middleware checks `req.user.role` against an allowlist.

```javascript
// middleware/authorize.js

/**
 * Returns middleware that only allows requests through if
 * req.user.role is one of the given allowed roles.
 * Must run AFTER an authentication middleware that sets req.user.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // authentication middleware didn't run, or failed silently
      return res.status(401).json({ error: 'authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `requires one of roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

module.exports = authorize;
```

Usage reads declaratively at the route definition:

```javascript
app.get('/admin/dashboard', authenticateToken, authorize('admin', 'superadmin'), handler);
app.get('/editor/posts', authenticateToken, authorize('editor', 'admin', 'superadmin'), handler);
```

---

## 4. Complete Example: Admin vs User Routes

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-secret';

// fake users with roles
const users = [
  { id: 1, email: 'jane@example.com', role: 'admin' },
  { id: 2, email: 'bob@example.com', role: 'user' },
];

// ---- Authentication middleware (see Phase-07-02 for full login flow) ----
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'access token required' });

  jwt.verify(token, ACCESS_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'invalid or expired token' });
    req.user = payload; // { userId, role }
    next();
  });
}

// ---- Authorization middleware ----
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'authentication required' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `requires role: ${allowedRoles.join(' or ')}` });
    }
    next();
  };
}

// helper to issue tokens for testing
app.post('/dev-login/:userId', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.userId));
  if (!user) return res.status(404).json({ error: 'no such user' });
  const token = jwt.sign({ userId: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// ---- Any authenticated user ----
app.get('/profile', authenticateToken, (req, res) => {
  res.json({ userId: req.user.userId, role: req.user.role });
});

// ---- Admin-only route ----
app.get('/admin/users', authenticateToken, authorize('admin'), (req, res) => {
  res.json({ users });
});

app.delete('/admin/users/:id', authenticateToken, authorize('admin'), (req, res) => {
  const index = users.findIndex((u) => u.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'no such user' });
  users.splice(index, 1);
  res.status(204).send();
});

// ---- User-only route, but must be their own resource ----
app.get('/users/:id/orders', authenticateToken, (req, res) => {
  const requestedId = Number(req.params.id);

  // ownership check: users can only see their own orders,
  // but admins can see anyone's — mixing role + resource ownership
  if (req.user.role !== 'admin' && req.user.userId !== requestedId) {
    return res.status(403).json({ error: 'cannot access another user\'s orders' });
  }

  res.json({ orders: [`order-1-for-user-${requestedId}`] });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

```
Test with curl:

# get a token for the admin (id 1) and the regular user (id 2)
curl -X POST http://localhost:3000/dev-login/1   # admin token
curl -X POST http://localhost:3000/dev-login/2   # user token

# admin can list all users
curl http://localhost:3000/admin/users -H "Authorization: Bearer <adminToken>"
→ 200 OK

# regular user is forbidden
curl http://localhost:3000/admin/users -H "Authorization: Bearer <userToken>"
→ 403 Forbidden

# user 2 can view their own orders
curl http://localhost:3000/users/2/orders -H "Authorization: Bearer <userToken>"
→ 200 OK

# user 2 cannot view user 1's orders
curl http://localhost:3000/users/1/orders -H "Authorization: Bearer <userToken>"
→ 403 Forbidden
```

---

## 5. Beyond Roles: Permissions and Resource Ownership

Plain RBAC breaks down when access depends on more than a fixed role — e.g., "editors can edit posts they authored, but not everyone's posts." Two extensions are common:

```
Permission-based (finer-grained than roles):
  role 'editor' → permissions: ['posts:create', 'posts:edit-own', 'posts:publish']
  role 'admin'  → permissions: ['posts:create', 'posts:edit-any', 'posts:delete-any']

  authorize('posts:edit-any') checks permissions array instead of a single role string.

Resource ownership check (as shown in the /users/:id/orders example):
  Even with the right role, also verify the requester owns (or is
  otherwise entitled to) the specific resource being accessed —
  this is sometimes called "object-level authorization" and its
  absence is OWASP's #1 API vulnerability (Broken Object Level
  Authorization / BOLA).
```

A common bug: checking role correctly but forgetting the ownership check — e.g., allowing any authenticated `user` to fetch `/orders/:id` for **any** order ID, not just their own, because the developer only checked `req.user.role === 'user'` and stopped there.

---

## 6. Hands-On Exercises

**Exercise 1:** Build the complete example above. Get tokens for both the admin and the regular user and verify the exact status codes (200 vs 403) for each route/role combination shown in the curl block.

**Exercise 2:** Add a third role, `editor`, and a `/editor/posts` route accessible to both `editor` and `admin`. Confirm a `user`-role token gets 403.

**Exercise 3:** Introduce a permissions array instead of a single role (e.g., `permissions: ['posts:edit-own', 'posts:create']`) and rewrite `authorize()` to accept a required permission string and check `req.user.permissions.includes(permission)`.

**Exercise 4:** Deliberately remove the ownership check from `/users/:id/orders` and confirm (via curl) that user 2's token can now read user 1's orders — this demonstrates a Broken Object Level Authorization bug. Add the check back and reverify.

---

## 7. Interview Q&A

**Q: What's the difference between authentication and authorization?**
Answer: Authentication answers "who are you?" — verifying identity via password, JWT, or session. Authorization answers "what are you allowed to do?" — deciding whether an already-identified user can perform a specific action. A failed authentication check should return 401 Unauthorized; a failed authorization check on a known user should return 403 Forbidden.

**Q: How does RBAC middleware typically work in Express?**
Answer: An authentication middleware runs first and attaches the caller's identity and role to `req.user` (e.g., by verifying a JWT or session). A separate authorization middleware, often a factory function like `authorize('admin', 'editor')`, checks whether `req.user.role` is in the allowed list for that route and calls `next()` if so, or responds `403` if not. Chaining them (`app.get(path, authenticateToken, authorize('admin'), handler)`) keeps identity and permission concerns separate and reusable across routes.

**Q: Why return 403 instead of 401 when an authenticated user lacks permission?**
Answer: 401 Unauthorized technically means "you haven't proven who you are" — e.g., missing or invalid credentials. 403 Forbidden means "I know who you are, and your identity doesn't have permission for this." Conflating them either leaks less useful information to legitimate clients or (if you always return 401) can prompt them to needlessly retry login when the real problem is a permissions gap.

**Q: What is Broken Object Level Authorization (BOLA) and how do you prevent it?**
Answer: BOLA happens when an API checks that a user is authenticated and has the right role, but fails to check that the specific resource being requested actually belongs to (or is otherwise accessible by) that user — e.g., any logged-in user can fetch `/orders/:id` for someone else's order ID just by guessing it. It's OWASP's top API security risk. Prevention: always add an explicit ownership/entitlement check (comparing the resource's owner ID to `req.user.userId`) in addition to role checks, for every endpoint that takes an ID.

**Q: How would you extend RBAC to support permissions that aren't tied to a single fixed role?**
Answer: Move from a single `role` string to a `permissions` array (or map roles to a permissions list server-side) — e.g., `['posts:edit-own', 'posts:create']`. The authorization middleware then checks `req.user.permissions.includes(requiredPermission)` instead of matching against a role name directly. This allows finer-grained control (e.g., an editor who can edit their own posts but not everyone's) without proliferating one-off role names.

**Q: Where should authorization checks live — in the route middleware, or in the database query?**
Answer: Both, ideally. Middleware handles coarse-grained checks (role/permission gates) before the handler runs, which is efficient and keeps route intent readable. But resource-level ownership checks are often best enforced as part of the query itself (e.g., `WHERE user_id = ? AND id = ?` rather than `WHERE id = ?` followed by an in-app comparison) so that even a missed application-level check can't leak another user's row.
