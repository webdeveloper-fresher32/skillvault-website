# API Documentation and Versioning — Complete Guide

## Table of Contents
1. [Why Document an API](#1-why-document-an-api)
2. [OpenAPI/Swagger Concepts](#2-openapiswagger-concepts)
3. [Writing an OpenAPI Spec by Hand](#3-writing-an-openapi-spec-by-hand)
4. [Serving Docs with swagger-ui-express](#4-serving-docs-with-swagger-ui-express)
5. [Generating Docs from JSDoc Comments](#5-generating-docs-from-jsdoc-comments)
6. [Versioning in Practice](#6-versioning-in-practice)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Document an API

Undocumented APIs force consumers to read source code or guess. Good documentation answers, for every endpoint:

```
- What URL and method?
- What request body/params/query does it expect (and their types/constraints)?
- What does a successful response look like, with which status code?
- What error responses are possible, and when?
- Does it require authentication?
```

Documentation also serves as a **contract** — frontend and backend teams can build against it in parallel before either side's code is finished, and it becomes the source of truth consumers test against.

---

## 2. OpenAPI/Swagger Concepts

**OpenAPI** (formerly "Swagger Specification") is a standard, language-agnostic format (YAML or JSON) for describing REST APIs. "Swagger" now refers mainly to the tooling ecosystem (Swagger UI, Swagger Editor) built around the OpenAPI spec.

```
OpenAPI Spec (YAML/JSON)
        │
        ├── Swagger UI          → renders an interactive, browsable docs page
        ├── Swagger Editor      → write/validate specs in a browser
        └── Code generators     → generate client SDKs or server stubs from the spec
```

Key building blocks of an OpenAPI document:

| Section | Purpose |
|---------|---------|
| `info` | Title, version, description of the API |
| `servers` | Base URL(s) the API is hosted at |
| `paths` | Every endpoint, its methods, params, request/response schemas |
| `components/schemas` | Reusable data models (e.g. a `Task` object) referenced across paths |
| `components/securitySchemes` | How authentication works (Bearer token, API key, OAuth2) |

---

## 3. Writing an OpenAPI Spec by Hand

```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: Task API
  version: 1.0.0
  description: A simple REST API for managing tasks.
servers:
  - url: http://localhost:3000/api/v1

paths:
  /tasks:
    get:
      summary: List tasks
      parameters:
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
        - name: offset
          in: query
          schema: { type: integer, minimum: 0, default: 0 }
        - name: done
          in: query
          schema: { type: boolean }
      responses:
        '200':
          description: A paginated list of tasks
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/Task' }
                  pagination:
                    type: object
                    properties:
                      total: { type: integer }
                      limit: { type: integer }
                      offset: { type: integer }
    post:
      summary: Create a task
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TaskInput' }
      responses:
        '201':
          description: Task created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Task' }
        '400':
          description: Validation error

  /tasks/{id}:
    get:
      summary: Get a task by id
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer, minimum: 1 }
      responses:
        '200':
          description: The requested task
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Task' }
        '404':
          description: Task not found
    delete:
      summary: Delete a task by id
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer, minimum: 1 }
      responses:
        '204':
          description: Task deleted
        '404':
          description: Task not found

components:
  schemas:
    TaskInput:
      type: object
      required: [title]
      properties:
        title: { type: string, minLength: 3, maxLength: 100 }
        priority: { type: string, enum: [low, medium, high], default: medium }
        done: { type: boolean, default: false }
    Task:
      allOf:
        - $ref: '#/components/schemas/TaskInput'
        - type: object
          properties:
            id: { type: integer }
            createdAt: { type: string, format: date-time }
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

This single YAML file fully describes the API's contract — every field, type, constraint, and possible response — independent of implementation language.

---

## 4. Serving Docs with swagger-ui-express

Turn the spec above into a live, interactive documentation page inside your Express app.

```bash
npm install swagger-ui-express yamljs
```

```javascript
// server.js (excerpt)
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
const swaggerDocument = YAML.load('./openapi.yaml');

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ... rest of the app (routes, error handlers, etc.)

app.listen(3000, () => {
  console.log('API docs available at http://localhost:3000/docs');
});
```

Visiting `http://localhost:3000/docs` now shows a browsable UI where you can read every endpoint's schema and even send test requests directly from the page — no separate tool needed.

---

## 5. Generating Docs from JSDoc Comments

For teams who prefer keeping docs next to the code instead of a separate YAML file, `swagger-jsdoc` generates the OpenAPI spec from comments above each route.

```bash
npm install swagger-jsdoc swagger-ui-express
```

```javascript
// routes/tasks.js (excerpt)

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     summary: Get a task by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The requested task
 *       404:
 *         description: Task not found
 */
router.get('/:id', idParam, handleValidation, (req, res) => {
  const task = store.getById(req.params.id);
  if (!task) return res.status(404).json({ error: `Task ${req.params.id} not found` });
  res.status(200).json(task);
});
```

```javascript
// server.js (excerpt)
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'Task API', version: '1.0.0' }
  },
  apis: ['./routes/*.js'] // scans these files for @openapi comments
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

Trade-off: a hand-written `openapi.yaml` is easier to design up-front and review as a single document; JSDoc-generated specs stay closer to the code and are less likely to drift out of sync as routes change, at the cost of being harder to read as one coherent document.

---

## 6. Versioning in Practice

Building on the strategies from lesson 02, here's how versioning plays out across a real API's lifecycle.

```
v1 launches:
  GET /api/v1/tasks → { data: [...], pagination: {...} }

Requirement changes: rename "done" to "completed", add required "assigneeId"
  → This is a BREAKING change for existing clients.

v2 launches, v1 stays running:
  GET /api/v2/tasks → { data: [...with "completed" and "assigneeId"...], pagination: {...} }
  GET /api/v1/tasks → unchanged, still works for old clients

Deprecation:
  v1 responses include a warning header:
    Deprecation: true
    Sunset: Wed, 01 Oct 2026 00:00:00 GMT
    Link: <https://api.example.com/api/v2/tasks>; rel="successor-version"

  After the sunset date, v1 routes return 410 Gone.
```

```javascript
// Deprecation middleware applied only to the old version's router
function deprecated(sunsetDate, successorUrl) {
  return (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', sunsetDate);
    res.set('Link', `<${successorUrl}>; rel="successor-version"`);
    next();
  };
}

app.use('/api/v1/tasks', deprecated('Wed, 01 Oct 2026 00:00:00 GMT', '/api/v2/tasks'), v1TaskRoutes);
app.use('/api/v2/tasks', v2TaskRoutes);
```

Practical rules of thumb:

| Situation | Breaking? | Action |
|-----------|-----------|--------|
| Adding a new optional field to a response | No | Ship in current version |
| Adding a new endpoint | No | Ship in current version |
| Renaming/removing a field | Yes | New major version |
| Changing a field's type (string → number) | Yes | New major version |
| Changing what a status code means | Yes | New major version |
| Making an optional request field required | Yes | New major version |

---

## 7. Hands-On Exercises

**Exercise 1:** Write a complete `openapi.yaml` for the Task API from lesson 04, covering all 6 endpoints (`GET`/`POST` on `/tasks`, `GET`/`PUT`/`PATCH`/`DELETE` on `/tasks/:id`).

**Exercise 2:** Install `swagger-ui-express` and `yamljs`, load your spec, and serve it at `/docs`. Confirm you can send a test `POST /tasks` request directly from the Swagger UI page.

**Exercise 3:** Convert the same documentation to JSDoc comments above each route using `swagger-jsdoc`, and compare the resulting generated spec to your hand-written one.

**Exercise 4:** Add a `v2` of the Task API where `done` is renamed to `completed`. Run `v1` and `v2` side by side, and add `Deprecation`/`Sunset`/`Link` headers to all `v1` responses.

**Exercise 5:** Write a short markdown changelog documenting the `v1` → `v2` breaking change, including a migration guide snippet showing old vs new request/response shapes.

---

## 8. Interview Q&A

**Q: What is OpenAPI, and how does it relate to "Swagger"?**
Answer: OpenAPI is a standardized, language-agnostic specification format (YAML/JSON) for describing REST APIs — every endpoint, parameter, request/response schema, and auth mechanism. "Swagger" was the original name of the specification before it was donated to the OpenAPI Initiative; today "Swagger" mainly refers to the tooling built around it, like Swagger UI (renders interactive docs) and Swagger Editor.

**Q: What's the benefit of documenting an API with a formal spec instead of a plain README?**
Answer: A formal OpenAPI spec is machine-readable, so it can drive interactive documentation (Swagger UI), generate client SDKs in multiple languages, generate server stubs, and be used for automated contract testing — none of which a plain-text README supports. It also acts as an enforceable contract that frontend and backend teams can build against independently.

**Q: What's the trade-off between a hand-written OpenAPI YAML file and generating one from JSDoc comments in route files?**
Answer: A hand-written spec is easier to design holistically and review as a single coherent document, but can drift out of sync with the actual code over time. JSDoc-generated specs live next to the route implementation, so they're less likely to go stale, but the resulting document is scattered across files and harder to review end-to-end.

**Q: When should you bump an API's major version versus just shipping a change to the current version?**
Answer: Only breaking changes require a new major version — renaming/removing a field, changing a field's type, changing what a status code means, or making a previously-optional field required. Backward-compatible additions like new optional fields or new endpoints can ship in the current version without breaking existing clients.

**Q: How would you responsibly retire an old API version without breaking existing clients overnight?**
Answer: Announce deprecation in advance via response headers (`Deprecation: true`, `Sunset: <date>`, `Link` pointing to the successor version) and documentation, keep the old version fully functional until the sunset date, monitor usage to see when it's safe to retire, and only then return `410 Gone` for the old routes — giving consumers a clear migration window instead of an abrupt break.

**Q: What does the `components/schemas` section of an OpenAPI document do, and why is it useful?**
Answer: It defines reusable data models (e.g. a `Task` schema) once, which multiple paths can reference via `$ref` instead of duplicating the same field definitions across every endpoint that returns or accepts that resource. This keeps the spec DRY and ensures consistency if the resource's shape changes.
