# Phase 08 — Storage, Gateway and Auth

Every production backend — no matter how small — eventually needs three things that have nothing to do with "business logic": somewhere to put files that aren't rows in a table, a single front door for clients to talk to instead of a maze of internal services, and a way to know who's making a request without asking the database every single time. This phase covers exactly those three components: object storage, the API gateway, and JWT-based authentication. They show up in almost every case study in Phases 10-11, so getting comfortable with them here pays off immediately.

None of these three ideas are individually hard. What makes them worth a dedicated phase is that interviewers expect you to reach for them *automatically* the moment a design involves file uploads, more than one backend service, or a login flow — leaving them out is one of the fastest ways to look like you haven't built a real system before.

## What This Phase Covers

- Why binary blobs (images, videos, PDFs) don't belong inside your SQL database, and the "store the file in object storage, store the URL in the DB" pattern used by literally every media-heavy system.
- Presigned URLs as the follow-up optimization once uploads get large or frequent enough that routing bytes through your own backend becomes a bottleneck.
- What an API Gateway actually does beyond routing — auth enforcement, rate limiting, and request/response transformation — and why clients should never talk to internal microservices directly.
- JWT authentication end to end: the login → token → future-requests flow, how it ties back to the statelessness lesson in Phase 03, token expiry, and refresh tokens.

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Object-Storage.md` | Object storage vs. SQL for binary blobs, S3/GCS/Azure Blob, presigned URLs |
| 02 | `02-API-Gateway.md` | Gateway routing, auth enforcement, rate limiting, request/response transformation |
| 03 | `03-JWT-Authentication.md` | Login → JWT → future requests, statelessness, token expiry, refresh tokens |

## Estimated Time

**2-3 days.**

## Prerequisites

- Phases 01-07 — this phase assumes you're comfortable with the request lifecycle (Phase 01), monoliths vs. microservices (Phase 02), statelessness (Phase 03), load balancers (Phase 04), databases (Phase 05), caching (Phase 06), and async processing (Phase 07). The gateway lesson in particular leans on Phase 02's microservices picture, and the JWT lesson leans directly on Phase 03's statelessness argument.
