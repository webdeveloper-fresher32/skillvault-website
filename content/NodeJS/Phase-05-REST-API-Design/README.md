# Phase 05 — REST API Design

## Overview

This phase moves from "an Express app that responds to requests" to "an API designed the way production teams design them." You'll learn what REST actually means beyond "JSON over HTTP," how to shape URLs and resources so they're predictable, how to validate and sanitize input before it touches business logic, how to wire all of that together into a complete CRUD API, and how to document and version an API so consumers aren't guessing.

## Files in This Phase

| File | Topic |
|------|-------|
| `01-REST-Principles-and-HTTP-Semantics.md` | Statelessness, resources, uniform interface, correct verb usage, idempotency, full HTTP status code reference |
| `02-Resource-Design-and-URL-Structure.md` | Noun-based URLs, nesting, pagination/filtering/sorting conventions, versioning strategies |
| `03-Request-Validation.md` | Validating body/params/query with `express-validator` and `Joi`, sanitization basics |
| `04-Building-a-Full-CRUD-API.md` | A complete, runnable CRUD API for a `Task` resource applying everything above |
| `05-API-Documentation-and-Versioning.md` | OpenAPI/Swagger basics, documenting endpoints, versioning in practice |

## Prerequisites

- Phase 01–04: Node.js fundamentals, Express basics, routing, middleware.
- Comfortable writing and testing Express routes with a tool like `curl` or Postman.

## What You Should Be Able to Do After This Phase

- Explain what makes an API "RESTful" and defend HTTP verb/status code choices in an interview.
- Design resource URLs that read naturally and support pagination, filtering, and sorting.
- Validate and sanitize incoming requests before they reach controller logic.
- Build a full CRUD API from scratch with proper status codes and error handling.
- Describe how to document and version an API for real-world consumers.

---

Next: **Phase 06** — typically Authentication & Authorization (JWT, sessions, OAuth basics).
