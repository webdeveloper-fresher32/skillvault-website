# Resource Design and URL Structure — Complete Guide

## Table of Contents
1. [Nouns, Not Verbs](#1-nouns-not-verbs)
2. [Collections vs Single Resources](#2-collections-vs-single-resources)
3. [Nesting Resources](#3-nesting-resources)
4. [Pagination](#4-pagination)
5. [Filtering and Sorting](#5-filtering-and-sorting)
6. [API Versioning Strategies](#6-api-versioning-strategies)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Nouns, Not Verbs

URLs identify **resources** (things), not **actions**. The action is expressed by the HTTP verb, not by a word in the path.

```
❌ Verb-based (RPC-style):
  GET  /getAllTasks
  POST /createTask
  POST /deleteTask/42
  POST /updateTaskStatus/42

✅ Noun-based (REST-style):
  GET    /tasks
  POST   /tasks
  DELETE /tasks/42
  PATCH  /tasks/42
```

```javascript
// ❌ Verb in the URL — redundant with the HTTP method, and inconsistent
app.post('/createTask', (req, res) => { /* ... */ });
app.post('/deleteTask/:id', (req, res) => { /* ... */ });

// ✅ The verb IS the method; the URL is just the resource
app.post('/tasks', (req, res) => { /* create */ });
app.delete('/tasks/:id', (req, res) => { /* delete */ });
```

Exceptions exist for genuine actions that aren't CRUD on a resource (e.g. "send a password reset email," "log out"). These are modeled as sub-resources or actions: `POST /users/42/password-reset-emails` (noun) is more RESTful than `POST /sendPasswordReset`, though a pragmatic `POST /auth/logout` is common and acceptable — perfect REST purity is less important than consistency.

---

## 2. Collections vs Single Resources

```
Collection:      /tasks          (plural noun — the set of all tasks)
Single item:     /tasks/:id      (collection + identifier)

GET    /tasks         → list all tasks
POST   /tasks         → create a task in the collection
GET    /tasks/42      → read one task
PUT    /tasks/42      → replace task 42
PATCH  /tasks/42      → partially update task 42
DELETE /tasks/42      → delete task 42
```

Always use **plural** nouns for collections (`/tasks` not `/task`) — it reads correctly for both the collection and item endpoints, and it's the overwhelming industry convention (GitHub, Stripe, Twitter APIs all do this).

```javascript
const express = require('express');
const router = express.Router();

router.get('/tasks', listTasks);        // collection
router.post('/tasks', createTask);      // collection
router.get('/tasks/:id', getTask);      // single item
router.put('/tasks/:id', replaceTask);  // single item
router.patch('/tasks/:id', updateTask); // single item
router.delete('/tasks/:id', deleteTask);// single item

module.exports = router;
```

---

## 3. Nesting Resources

When a resource logically belongs to a parent, nest it — but only **one level deep**. Deep nesting becomes unreadable and brittle.

```
✅ One level of nesting (a task's comments belong to that task):
  GET  /tasks/42/comments        → all comments on task 42
  POST /tasks/42/comments        → add a comment to task 42

❌ Deep nesting (hard to read, hard to route, hard to maintain):
  GET /users/7/projects/3/tasks/42/comments/9/replies/1
```

For deeply related resources, prefer a flat top-level endpoint with a filter query param once you're past one level:

```
Instead of: GET /users/7/projects/3/tasks
Prefer:     GET /tasks?projectId=3          (projectId already implies the user via ownership checks)
```

```javascript
// Nested route: comments always exist in the context of a task
router.get('/tasks/:taskId/comments', (req, res) => {
  const taskId = Number(req.params.taskId);
  const task = tasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task.comments || []);
});

router.post('/tasks/:taskId/comments', (req, res) => {
  const taskId = Number(req.params.taskId);
  const task = tasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const comment = { id: Date.now(), text: req.body.text };
  task.comments = task.comments || [];
  task.comments.push(comment);
  res.status(201).json(comment);
});
```

A useful rule of thumb: nest a resource under a parent **only if the child cannot meaningfully exist without the parent** (comments need a task; standalone tasks do not need to be nested under a project if they can also exist independently).

---

## 4. Pagination

Never return an entire table in one response. Two common approaches:

### Offset/Limit Pagination (simple, most common)

```
GET /tasks?limit=20&offset=40     → skip 40, return next 20
GET /tasks?page=3&pageSize=20     → equivalent, page-based
```

```javascript
app.get('/tasks', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100); // cap max page size
  const offset = Number(req.query.offset) || 0;

  const page = tasks.slice(offset, offset + limit);

  res.json({
    data: page,
    pagination: {
      limit,
      offset,
      total: tasks.length,
      hasMore: offset + limit < tasks.length
    }
  });
});
```

### Cursor-Based Pagination (better for large/changing datasets)

```
GET /tasks?cursor=eyJpZCI6NDJ9&limit=20
→ returns 20 tasks after the one encoded in the cursor, plus a nextCursor
```

```javascript
app.get('/tasks/cursor', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const cursorId = req.query.cursor ? Number(req.query.cursor) : 0;

  const startIdx = tasks.findIndex(t => t.id > cursorId);
  const page = tasks.slice(startIdx === -1 ? tasks.length : startIdx, startIdx + limit);
  const nextCursor = page.length ? page[page.length - 1].id : null;

  res.json({ data: page, nextCursor });
});
```

| Approach | Pros | Cons |
|----------|------|------|
| Offset/limit | Simple, supports jumping to arbitrary pages | Can skip/duplicate items if data changes between requests; slow on large offsets |
| Cursor-based | Stable under concurrent writes, efficient at scale | Can't jump to an arbitrary page number |

---

## 5. Filtering and Sorting

Use query parameters for filtering and sorting — never invent new endpoints per filter combination.

```
GET /tasks?done=false                     → filter by field value
GET /tasks?priority=high&done=false       → combine filters (AND)
GET /tasks?sort=createdAt                 → sort ascending by createdAt
GET /tasks?sort=-createdAt                → sort descending (leading "-" convention)
GET /tasks?sort=priority,-createdAt       → multi-field sort
GET /tasks?fields=id,title                → sparse fieldsets (return only these fields)
```

```javascript
app.get('/tasks', (req, res) => {
  let result = [...tasks];

  // Filtering
  if (req.query.done !== undefined) {
    const isDone = req.query.done === 'true';
    result = result.filter(t => t.done === isDone);
  }
  if (req.query.priority) {
    result = result.filter(t => t.priority === req.query.priority);
  }

  // Sorting
  if (req.query.sort) {
    const fields = req.query.sort.split(',');
    result.sort((a, b) => {
      for (const field of fields) {
        const desc = field.startsWith('-');
        const key = desc ? field.slice(1) : field;
        if (a[key] < b[key]) return desc ? 1 : -1;
        if (a[key] > b[key]) return desc ? -1 : 1;
      }
      return 0;
    });
  }

  // Sparse fieldsets
  if (req.query.fields) {
    const keep = req.query.fields.split(',');
    result = result.map(t => {
      const picked = {};
      keep.forEach(k => { if (k in t) picked[k] = t[k]; });
      return picked;
    });
  }

  res.json(result);
});
```

---

## 6. API Versioning Strategies

APIs evolve. Versioning lets you make breaking changes without instantly breaking every existing client.

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| **URL path** | `GET /v1/tasks`, `GET /v2/tasks` | Explicit, easy to test/route, cacheable per version | "Pollutes" the URL; the resource's identity now includes a version |
| **Query parameter** | `GET /tasks?version=1` | Easy to default, doesn't change base path | Easy to forget; not RESTful (version isn't part of the resource) |
| **Custom header** | `GET /tasks` with `X-API-Version: 1` | Keeps URLs clean | Less visible/discoverable; harder to test by just pasting a URL in browser |
| **Accept header (content negotiation)** | `Accept: application/vnd.myapi.v1+json` | Most "correct" REST approach — version is part of representation negotiation | Most complex to implement and document |

URL path versioning is the most common in practice (Stripe, Twitter/X, GitHub all expose versions via the path or a simple header) because it's the easiest for consumers to understand and for you to route.

```javascript
// URL-path versioning with separate routers
const v1Router = require('./routes/v1/tasks');
const v2Router = require('./routes/v2/tasks');

app.use('/v1/tasks', v1Router);
app.use('/v2/tasks', v2Router); // v2 might rename fields, change pagination shape, etc.
```

```javascript
// Header-based versioning with a single router
app.get('/tasks', (req, res) => {
  const version = req.headers['x-api-version'] || '1';

  if (version === '2') {
    return res.json({ items: tasks, meta: { total: tasks.length } }); // v2 response shape
  }
  res.json(tasks); // v1 response shape (legacy)
});
```

Practical guidance: version at the **major** level only (`v1`, `v2`) — don't version every tiny change. Only bump when you make a **breaking** change (renaming/removing a field, changing a status code's meaning). Adding new optional fields is non-breaking and doesn't need a new version.

---

## 7. Hands-On Exercises

**Exercise 1:** Refactor a set of verb-based routes (`/getTasks`, `/createTask`, `/removeTask/:id`) into proper noun-based REST routes using the correct HTTP verbs.

**Exercise 2:** Add nested routes `GET /tasks/:taskId/comments` and `POST /tasks/:taskId/comments` to an in-memory task list where each task has a `comments` array.

**Exercise 3:** Implement offset/limit pagination on `GET /tasks`, including a `pagination` object in the response with `total`, `limit`, `offset`, and `hasMore`.

**Exercise 4:** Add filtering (`?done=true`) and multi-field sorting (`?sort=-priority,createdAt`) to `GET /tasks`.

**Exercise 5:** Implement two versioning strategies on the same resource: `/v1/tasks` returning a flat array, and `/v2/tasks` returning `{ items: [...], meta: {...} }`. Confirm both work independently.

---

## 8. Interview Q&A

**Q: Why should REST URLs use nouns instead of verbs?**
Answer: The HTTP verb already conveys the action (GET, POST, DELETE, etc.), so putting a verb in the URL (`/deleteTask`) is redundant and breaks the uniform interface — clients and tools can no longer infer behavior from the verb alone. Noun-based URLs (`/tasks/42` + `DELETE`) keep the API predictable and consistent.

**Q: How deep should you nest resource URLs, and why?**
Answer: Generally no more than one level. Deep nesting (`/users/7/projects/3/tasks/42/comments/9`) becomes hard to read, hard to route, and tightly couples unrelated resources. Prefer nesting only when the child cannot exist without the parent, and use query parameters (`/tasks?projectId=3`) for looser associations.

**Q: What's the difference between offset-based and cursor-based pagination, and when would you choose each?**
Answer: Offset/limit pagination uses a numeric offset and is simple to implement and lets clients jump to arbitrary pages, but can skip or duplicate items if the underlying data changes between requests and gets slow at large offsets. Cursor-based pagination uses a pointer to the last-seen item and is stable under concurrent writes and efficient at scale, but doesn't support jumping to an arbitrary page number. Cursor-based is preferred for large or frequently-changing datasets (e.g. social media feeds).

**Q: What are the main API versioning strategies, and which is most common in practice?**
Answer: URL path versioning (`/v1/tasks`), query parameter (`?version=1`), custom header (`X-API-Version`), and Accept-header content negotiation (`application/vnd.api.v1+json`). URL path versioning is most common in practice because it's the most explicit and easiest for consumers to discover and for servers to route, even though header-based negotiation is arguably more "pure" REST.

**Q: When should you bump an API's major version?**
Answer: Only for breaking changes — renaming or removing a field, changing the meaning of a status code, changing the response shape. Adding new optional fields or new endpoints is backward-compatible and shouldn't require a new version.

**Q: How would you let a client request only specific fields of a resource, and why is that useful?**
Answer: Support a `fields` query parameter (sparse fieldsets), e.g. `GET /tasks?fields=id,title`, and filter the response server-side to include only those keys. This reduces payload size for bandwidth-constrained clients (mobile) and lets different consumers of the same endpoint request only what they need.
