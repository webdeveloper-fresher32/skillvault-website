# Input Validation Patterns — Complete Guide

## Table of Contents
1. [Beyond Phase 05: Why Deeper Validation Matters](#1-beyond-phase-05-why-deeper-validation-matters)
2. [Schema Validation with Joi](#2-schema-validation-with-joi)
3. [Schema Validation with Zod](#3-schema-validation-with-zod)
4. [Validating Nested Objects and Arrays](#4-validating-nested-objects-and-arrays)
5. [Custom Validators](#5-custom-validators)
6. [Wiring Validation into Express Middleware](#6-wiring-validation-into-express-middleware)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Beyond Phase 05: Why Deeper Validation Matters

Phase 05 introduced basic request validation — checking that required fields exist and have the right primitive type. Real-world APIs need more: nested objects (an `address` inside a `user`), arrays of objects (`items` in an order), cross-field rules ("`endDate` must be after `startDate`"), and business-rule checks that don't fit a generic type system ("username must not already exist," "coupon code must be currently active").

Two libraries dominate this space in the Node ecosystem:

| | Joi | Zod |
|---|---|---|
| **Style** | Schema-builder object, validated at runtime only | Schema-builder object, validated at runtime, **and** infers static TypeScript types |
| **Popularity** | Long-standing, huge in Express/Hapi ecosystems | Newer, extremely popular in TypeScript-first codebases |
| **Type inference** | No (plain JS) | Yes (`z.infer<typeof schema>` gives you a TS type for free) |
| **Error format** | `.error.details[]` array | `.error.issues[]` array (or `.error.flatten()`) |
import
| **When to reach for it** | Existing Express/JS codebase, team already using it | New/TypeScript codebase, want types + validation from one schema |

Both are covered here in full because real job postings and interviews reference either (or both) interchangeably — know the concepts once, and the specific API becomes a lookup.

---

## 2. Schema Validation with Joi

```bash
npm install joi
```

```javascript
const Joi = require('joi');

const userSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(13).max(120).optional(),
  role: Joi.string().valid('admin', 'editor', 'viewer').default('viewer'),
  password: Joi.string()
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .required()
    .messages({
      'string.pattern.base':
        'password must be at least 8 characters and contain a letter and a number',
    }),
});

// Validate a good payload
const goodResult = userSchema.validate({
  name: 'Ganesh',
  email: 'ganesh@example.com',
  age: 29,
  password: 'secret123',
});
console.log(goodResult.error); // undefined
console.log(goodResult.value); // { name, email, age, role: 'viewer' (default applied), password }

// Validate a bad payload
const badResult = userSchema.validate({
  name: 'G',
  email: 'not-an-email',
  password: 'short',
});
console.log(badResult.error.details.map((d) => d.message));
// [
//   '"name" length must be at least 2 characters long',
//   '"email" must be a valid email',
//   'password must be at least 8 characters and contain a letter and a number'
// ]
```

### Getting all errors at once with `abortEarly: false`

By default Joi stops at the first error. For form-style APIs you usually want every field's errors returned together:

```javascript
const { error, value } = userSchema.validate(payload, { abortEarly: false });
```

### Common Joi building blocks

```javascript
Joi.string().alphanum().min(3).max(30);        // usernames
Joi.string().uri();                             // URLs
Joi.string().isoDate();                         // ISO 8601 date strings
Joi.number().positive().precision(2);           // prices
Joi.boolean();
Joi.array().items(Joi.string());                // array of strings
Joi.date().greater('now');                      // must be a future date
Joi.string().trim().lowercase();                // sanitize while validating
```

---

## 3. Schema Validation with Zod

```bash
npm install zod
```

```javascript
const { z } = require('zod');

const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(13).max(120).optional(),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .regex(/\d/, 'password must contain a number'),
});

// safeParse never throws — returns a result object (preferred for request validation)
const result = userSchema.safeParse({
  name: 'Ganesh',
  email: 'ganesh@example.com',
  age: 29,
  password: 'secret123',
});

if (result.success) {
  console.log(result.data); // fully typed & defaulted value
} else {
  console.log(result.error.issues);
  // [{ path: [...], message: '...', code: '...' }, ...]
}

// parse() throws a ZodError on failure — useful when you want exceptions
try {
  userSchema.parse({ name: 'G', email: 'bad', password: 'short' });
} catch (err) {
  console.log(err.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  // [
  //   'name: String must contain at least 2 character(s)',
  //   'email: Invalid email',
  //   'password: password must be at least 8 characters'
  // ]
}
```

### Zod's superpower: type inference (in a TypeScript project)

```typescript
// In a .ts file — shown for awareness even though this course is JS-focused
const userSchema = z.object({ name: z.string(), email: z.string().email() });
type User = z.infer<typeof userSchema>; // { name: string; email: string } — no separate interface needed
```

This is the single biggest reason teams choose Zod over Joi in new TypeScript projects: one schema definition gives you both runtime validation and compile-time types, so they can never drift apart.

---

## 4. Validating Nested Objects and Arrays

Real payloads are rarely flat. An order-creation endpoint, for example, needs a shipping address (nested object) and a list of line items (array of objects).

### Joi — nested and arrays

```javascript
const Joi = require('joi');

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  zipCode: Joi.string()
    .pattern(/^\d{5}(-\d{4})?$/)
    .required(),
  country: Joi.string().length(2).uppercase().required(), // e.g. "AU", "US"
});

const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().positive().required(),
});

const orderSchema = Joi.object({
  customerId: Joi.string().required(),
  shippingAddress: addressSchema.required(),
  items: Joi.array().items(orderItemSchema).min(1).required(), // at least one item
  notes: Joi.string().allow('').max(500).optional(),
});

const { error, value } = orderSchema.validate(
  {
    customerId: 'cust_1',
    shippingAddress: { street: '1 Main St', city: 'Sydney', zipCode: '2000', country: 'au' },
    items: [
      { productId: 'p1', quantity: 2, unitPrice: 19.99 },
      { productId: 'p2', quantity: 0, unitPrice: 9.99 }, // invalid: quantity must be >= 1
    ],
  },
  { abortEarly: false }
);

console.log(error.details.map((d) => d.message));
// ['"items[1].quantity" must be greater than or equal to 1']
// Note: country "au" is auto-uppercased to "AU" by .uppercase(), not an error
```

Joi reports nested errors with a **path**, e.g. `items[1].quantity`, so you can map validation errors directly back to specific form fields on a nested UI.

### Zod — nested and arrays

```javascript
const { z } = require('zod');

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().length(2).toUpperCase(),
});

const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().positive(),
});

const orderSchema = z.object({
  customerId: z.string(),
  shippingAddress: addressSchema,
  items: z.array(orderItemSchema).min(1),
  notes: z.string().max(500).optional(),
});

const result = orderSchema.safeParse({
  customerId: 'cust_1',
  shippingAddress: { street: '1 Main St', city: 'Sydney', zipCode: '2000', country: 'au' },
  items: [{ productId: 'p1', quantity: 0, unitPrice: 19.99 }],
});

if (!result.success) {
  console.log(
    result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
  );
  // [{ path: 'items.0.quantity', message: 'Number must be greater than or equal to 1' }]
}
```

---

## 5. Custom Validators

Schema libraries cover shape and type; business rules (uniqueness, cross-field consistency, external lookups) need custom logic.

### Cross-field validation — Joi

```javascript
const Joi = require('joi');

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
}).custom((value, helpers) => {
  if (new Date(value.endDate) <= new Date(value.startDate)) {
    // helpers.error lets you raise a custom, labeled error
    return helpers.error('date.range');
  }
  return value;
}, 'end date after start date').messages({
  'date.range': '"endDate" must be after "startDate"',
});

const { error } = dateRangeSchema.validate({
  startDate: '2026-07-01',
  endDate: '2026-06-01', // before startDate — invalid
});
console.log(error.details[0].message); // "endDate" must be after "startDate"
```

### Cross-field validation — Zod (`.refine` / `.superRefine`)

```javascript
const { z } = require('zod');

const dateRangeSchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'endDate must be after startDate',
    path: ['endDate'], // attaches the error to this field specifically
  });

const result = dateRangeSchema.safeParse({
  startDate: '2026-07-01T00:00:00Z',
  endDate: '2026-06-01T00:00:00Z',
});
console.log(result.error.issues[0]); // { path: ['endDate'], message: 'endDate must be after startDate', ... }
```

### Async custom validators (e.g., "email must not already exist")

Both libraries support async validation, which is essential for DB-dependent rules — Joi via `.external()`, Zod via `.refine()` with an async function.

```javascript
// Joi
const signupSchema = Joi.object({
  email: Joi.string().email().required(),
}).external(async (value) => {
  const exists = await db.users.findOne({ email: value.email });
  if (exists) {
    throw new Joi.ValidationError('"email" is already registered', [], value);
  }
  return value;
});

await signupSchema.validateAsync({ email: 'ganesh@example.com' }); // throws if taken

// Zod
const signupSchemaZod = z.object({
  email: z.string().email(),
}).refine(
  async (data) => {
    const exists = await db.users.findOne({ email: data.email });
    return !exists;
  },
  { message: 'email is already registered', path: ['email'] }
);

const zodResult = await signupSchemaZod.safeParseAsync({ email: 'ganesh@example.com' });
```

Use `validateAsync`/`safeParseAsync` (not the sync variants) whenever any part of the schema performs async work — calling the sync version with an async custom validator either throws unexpectedly or silently skips the check, depending on the library and version.

---

## 6. Wiring Validation into Express Middleware

The pattern from Phase 05 still applies — a small middleware factory that validates `req.body` (or `req.query`/`req.params`) against a schema and forwards a formatted error to the centralized handler from `02-Centralized-Error-Handling-in-Express.md`.

```javascript
// middleware/validate.js
const { ValidationError } = require('../errors/AppError');

/**
 * Generic Express middleware factory for Zod schemas.
 * Usage: validate(orderSchema) as route middleware.
 */
function validate(schema, source = 'body') {
  return async (req, res, next) => {
    const result = await schema.safeParseAsync(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }
    req[source] = result.data; // replace with parsed/defaulted/coerced value
    next();
  };
}

module.exports = { validate };
```

```javascript
// routes/orders.js
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');

const orderSchema = z.object({
  customerId: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().positive(),
      })
    )
    .min(1),
});

router.post(
  '/orders',
  validate(orderSchema),
  asyncHandler(async (req, res) => {
    const order = await db.orders.create(req.body); // req.body is now validated & typed-shaped
    res.status(201).json({ data: order });
  })
);

module.exports = router;
```

Because `validate()` calls `next(new ValidationError(...))` on failure, it plugs directly into the centralized error handler — validation errors, 404s, and unexpected crashes all produce the same JSON error shape described in `02-Centralized-Error-Handling-in-Express.md`.

---

## 7. Hands-On Exercises

**Exercise 1:** Write a Joi schema for a "create blog post" payload: `title` (string, 5-120 chars), `body` (string, min 20 chars), `tags` (array of strings, max 5 tags, each 2-20 chars), `published` (boolean, default `false`). Validate three payloads: valid, missing `title`, and `tags` with 6 entries — print all errors with `abortEarly: false`.

**Exercise 2:** Rewrite the same schema in Zod using `safeParse`. Compare the shape of the error output (`.error.details` vs `.error.issues`) between the two libraries.

**Exercise 3:** Build a nested schema (either library) for a "create company" payload with an array of `employees`, each having a nested `contact: { email, phone }` object. Trigger a validation error on the second employee's email and confirm the error path correctly identifies `employees[1].contact.email` (Joi) or `employees.1.contact.email` (Zod).

**Exercise 4:** Write a custom cross-field validator that rejects a "book a room" payload where `checkOutDate` is not after `checkInDate`, using `.custom()` (Joi) or `.refine()` (Zod).

**Exercise 5:** Implement the `validate()` Express middleware factory from Section 6 and wire it into a `POST /orders` route. Send a request with an empty `items` array and confirm you get a 400 with a `details` array describing exactly which field failed.

---

## 8. Interview Q&A

**Q: What's the practical difference between Joi and Zod, and when would you pick one over the other?**
Answer: Both let you declare a schema once and validate data against it, returning structured error messages. Zod's key differentiator is TypeScript type inference — `z.infer<typeof schema>` derives a static type from the schema so validation and typing can never drift apart, which makes it the default choice in TypeScript-first projects. Joi predates widespread TypeScript adoption and doesn't offer type inference, but is extremely mature and still dominant in plain-JavaScript Express/Hapi codebases. In an existing JS codebase already using Joi, there's rarely a reason to switch; in a new TypeScript project, Zod is usually preferred.

**Q: How do you validate a nested array of objects, and how does the library report which specific item failed?**
Answer: You nest schema builders — e.g. in Zod, `z.array(itemSchema).min(1)` where `itemSchema` is itself a `z.object({...})`; in Joi, `Joi.array().items(itemSchema)`. Both libraries report the failing item's position via a path array/string (e.g. `items[1].quantity` in Joi, or `path: ['items', 1, 'quantity']` in Zod's issues), which lets you map the error directly back to a specific row in a nested form on the frontend.

**Q: How would you validate a business rule that a schema library can't express declaratively, like "endDate must be after startDate" or "email must not already be registered"?**
Answer: Use the library's custom/refinement hook — Joi's `.custom()` for synchronous cross-field checks and `.external()` for async checks (like a DB lookup), or Zod's `.refine()`/`.superRefine()`, which accept sync or async predicate functions. These run after the base schema passes, receive the full parsed object, and can raise a labeled error attached to a specific field via a `path` option.

**Q: Why use `abortEarly: false` (Joi) or check `.error.issues` fully (Zod) instead of returning the first validation error found?**
Answer: For form-style APIs, returning only the first error forces the client into a frustrating fix-one-resubmit-see-next-error loop. Collecting all errors in one pass (`abortEarly: false` in Joi; Zod collects all issues by default) lets the client display every problem at once, matching how most real UI forms want to surface validation feedback.

**Q: Why is it important to use the async variant (`validateAsync`/`safeParseAsync`) when a schema includes an async custom validator like a uniqueness check?**
Answer: An async validator (e.g., checking the database for an existing email) returns a Promise. If you call the schema's synchronous validation method, that Promise either gets ignored (the check silently never blocks anything) or the library throws because it detected an unexpected async result, depending on version — either way, the validation isn't actually enforced correctly. The async methods properly await every custom check, sync or async, before reporting success or failure.

**Q: In an Express app, where should schema validation happen relative to the route handler, and why?**
Answer: As its own middleware, before the route handler runs — typically a `validate(schema)` factory applied per-route. This keeps validation logic separate from business logic (single responsibility), guarantees the handler only ever sees already-valid, already-shaped data, and lets validation failures flow through `next(err)` into the same centralized error handler used for every other error type, producing a consistent response shape.
