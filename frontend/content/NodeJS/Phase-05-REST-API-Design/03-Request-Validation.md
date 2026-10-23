# Request Validation — Complete Guide

## Table of Contents
1. [Why Validate at All](#1-why-validate-at-all)
2. [Validating with express-validator](#2-validating-with-express-validator)
3. [Validating with Joi](#3-validating-with-joi)
4. [Validating Params and Query Strings](#4-validating-params-and-query-strings)
5. [Sanitization Basics](#5-sanitization-basics)
6. [Centralizing Validation Error Handling](#6-centralizing-validation-error-handling)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Validate at All

Never trust client input. Validation is your first line of defense against bad data, crashes, and security holes.

```
Without validation:
  POST /tasks  { "title": "" }              → creates a task with an empty title
  POST /tasks  { "title": 12345 }           → crashes downstream code expecting a string
  POST /tasks  { "title": "<script>..." }   → stored XSS if rendered unescaped elsewhere
  GET /tasks/abc                            → Number("abc") is NaN, silent bad behavior

With validation:
  All of the above are rejected with 400 before touching business logic.
```

Validation should happen **as early as possible** — in middleware, before the route handler's core logic runs. This keeps handlers focused on business logic instead of defensive `if` chains.

---

## 2. Validating with express-validator

`express-validator` is a wrapper around the `validator.js` library, designed to plug directly into Express middleware chains.

```bash
npm install express-validator
```

```javascript
const express = require('express');
const { body, validationResult } = require('express-validator');
const app = express();
app.use(express.json());

const createTaskValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('title is required')
    .isLength({ min: 3, max: 100 }).withMessage('title must be 3-100 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('priority must be low, medium, or high'),
  body('dueDate')
    .optional()
    .isISO8601().withMessage('dueDate must be a valid ISO 8601 date')
];

app.post('/tasks', createTaskValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, priority = 'medium', dueDate } = req.body;
  const task = { id: Date.now(), title, priority, dueDate, done: false };
  res.status(201).json(task);
});
```

Example error response for `POST /tasks` with `{ "title": "ab" }`:

```json
{
  "errors": [
    {
      "type": "field",
      "msg": "title must be 3-100 characters",
      "path": "title",
      "location": "body"
    }
  ]
}
```

---

## 3. Validating with Joi

`Joi` takes a schema-first approach — you define the shape of valid data once, then validate objects against it. Popular for its expressive, chainable schema API.

```bash
npm install joi
```

```javascript
const express = require('express');
const Joi = require('joi');
const app = express();
app.use(express.json());

const taskSchema = Joi.object({
  title: Joi.string().trim().min(3).max(100).required(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  dueDate: Joi.date().iso(),
  done: Joi.boolean().default(false)
});

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        errors: error.details.map(d => ({ message: d.message, path: d.path.join('.') }))
      });
    }
    req.body = value; // replaced with validated + defaulted + stripped data
    next();
  };
}

app.post('/tasks', validateBody(taskSchema), (req, res) => {
  const task = { id: Date.now(), ...req.body };
  res.status(201).json(task);
});
```

Example error response for `POST /tasks` with `{ "title": "ab", "priority": "urgent" }`:

```json
{
  "errors": [
    { "message": "\"title\" length must be at least 3 characters long", "path": "title" },
    { "message": "\"priority\" must be one of [low, medium, high]", "path": "priority" }
  ]
}
```

| | express-validator | Joi |
|---|---|---|
| Style | Middleware chain, field-by-field | Schema object, validate once |
| Best for | Simple field-level rules mixed into route definitions | Reusable, complex, nested schemas shared across routes |
| Defaults/coercion | Manual (`.default()` per field via `.optional().default()`) | Built-in via schema (`Joi.default()`, auto-coercion) |
| Learning curve | Lower, feels like more Express middleware | Slightly higher, but scales better for large APIs |

---

## 4. Validating Params and Query Strings

Body isn't the only untrusted input — route params and query strings need validation too.

```javascript
const { param, query, validationResult } = require('express-validator');

// Validate a numeric route param
app.get('/tasks/:id',
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const task = tasks.find(t => t.id === Number(req.params.id));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  }
);

// Validate query params for pagination/filtering
app.get('/tasks',
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('done').optional().isBoolean().toBoolean(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { limit = 20, offset = 0, done } = req.query; // already coerced to correct types
    let result = tasks;
    if (done !== undefined) result = result.filter(t => t.done === done);
    res.json(result.slice(offset, offset + limit));
  }
);
```

With Joi, the equivalent is validating `req.params` / `req.query` against separate schemas using the same `validateBody`-style middleware pattern, just pointed at a different `req` property.

---

## 5. Sanitization Basics

Validation rejects bad input; **sanitization** cleans input that's technically valid but needs normalizing before use.

```javascript
const { body } = require('express-validator');

const sanitizedTaskValidation = [
  body('title')
    .trim()                    // remove leading/trailing whitespace
    .escape(),                 // convert <, >, &, ', " to HTML entities — prevents stored XSS
  body('email')
    .optional()
    .normalizeEmail(),         // lowercase, remove dots in gmail addresses, etc.
  body('tags')
    .optional()
    .customSanitizer(value =>
      Array.isArray(value) ? value.map(t => String(t).trim().toLowerCase()) : []
    )
];
```

Common sanitization steps:

| Sanitization | Why |
|--------------|-----|
| `.trim()` | Remove accidental leading/trailing whitespace from user typing |
| `.escape()` | Neutralize HTML/script tags before storing text that might later be rendered |
| `.normalizeEmail()` | Standardize email format for reliable duplicate-checking |
| `.toInt()` / `.toBoolean()` | Coerce string query params (`"20"`, `"true"`) into real types |
| Whitelisting fields | Strip unexpected fields the client sent (`stripUnknown: true` in Joi) so extra data can't be smuggled into your DB |

```javascript
// Whitelisting: never spread raw req.body into your data layer
app.post('/tasks', (req, res) => {
  // ❌ Dangerous: client could smuggle in { id: 999, isAdmin: true }
  // const task = { ...req.body };

  // ✅ Safe: only take the fields you expect
  const { title, priority = 'medium' } = req.body;
  const task = { id: Date.now(), title, priority, done: false };
  res.status(201).json(task);
});
```

This whitelisting pattern is critical — it's the server-side defense against **mass assignment** vulnerabilities, where a client sneaks privileged fields (like `isAdmin` or `id`) into a request body that gets blindly persisted.

---

## 6. Centralizing Validation Error Handling

Repeating `validationResult(req)` in every handler gets old fast — extract it into reusable middleware.

```javascript
const { validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// Usage: just append the middleware after your validation chain
app.post('/tasks',
  [
    body('title').trim().notEmpty().isLength({ min: 3, max: 100 }),
    body('priority').optional().isIn(['low', 'medium', 'high'])
  ],
  handleValidationErrors,
  (req, res) => {
    // handler only runs if validation passed — no defensive checks needed here
    const task = { id: Date.now(), title: req.body.title, priority: req.body.priority || 'medium', done: false };
    res.status(201).json(task);
  }
);
```

---

## 7. Hands-On Exercises

**Exercise 1:** Using `express-validator`, add validation to a `POST /tasks` route requiring `title` (string, 3-100 chars) and an optional `priority` (one of `low`/`medium`/`high`). Return `400` with a clear error array on failure.

**Exercise 2:** Rewrite the same validation using a `Joi` schema and a reusable `validateBody(schema)` middleware factory. Confirm both approaches reject the same bad inputs.

**Exercise 3:** Add param validation to `GET /tasks/:id` so that non-numeric IDs return `400` instead of falling through to a `404` or crashing.

**Exercise 4:** Add sanitization to a `POST /comments` route: trim and escape the `text` field so that `<script>alert(1)</script>` is stored as harmless escaped text.

**Exercise 5:** Demonstrate a mass-assignment vulnerability: build a route that naively does `const user = { ...req.body }` and show how a client can inject an `isAdmin: true` field. Then fix it by explicitly whitelisting fields.

---

## 8. Interview Q&A

**Q: Why should you validate input on the server even if the frontend already validates it?**
Answer: Client-side validation is a UX convenience, not a security boundary — anyone can bypass the frontend entirely and send raw requests via curl, Postman, or a modified client. The server is the only place that can be trusted to enforce the actual data contract, since it's the last line of defense before data hits your business logic and database.

**Q: What's the difference between validation and sanitization?**
Answer: Validation checks whether input meets the rules and rejects it if not (e.g. title must be 3-100 characters). Sanitization transforms technically-valid input into a safer or more normalized form without rejecting it (e.g. trimming whitespace, escaping HTML, lowercasing an email). Both are typically applied together in a middleware chain.

**Q: What is a mass assignment vulnerability and how do you prevent it?**
Answer: It occurs when a server blindly copies an entire request body into a data model (e.g. `{ ...req.body }`), letting a client set fields it shouldn't control, like `isAdmin` or `id`. You prevent it by explicitly destructuring and whitelisting only the expected fields, or by using a schema validator with `stripUnknown`/`allowUnknown: false` to drop unrecognized fields.

**Q: When would you choose Joi over express-validator, or vice versa?**
Answer: express-validator fits naturally into an Express middleware chain and is convenient for simple, per-route field rules. Joi is schema-first, so it's better when you need to reuse the same validation schema across multiple routes, want built-in defaulting/type coercion, or are validating complex nested objects — the schema becomes a single source of truth independent of any specific route.

**Q: How do you validate query parameters differently from a request body, and why does it matter?**
Answer: Query parameters always arrive as strings (`?limit=20` is the string `"20"`, not the number `20`), so validation must coerce types explicitly (`.isInt().toInt()` in express-validator, or a Joi schema with `Joi.number()` which auto-coerces). Skipping this means comparisons like `limit === 20` silently fail because you're comparing a string to a number.

**Q: Where in the request lifecycle should validation happen, and why?**
Answer: As early as possible — in middleware that runs before the route handler's core logic. This keeps handlers free of defensive `if` checks, ensures invalid data never reaches business logic or the database, and lets you return a consistent 400 response shape from one centralized place.
