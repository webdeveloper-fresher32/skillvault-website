# JavaScript Master Course — Projects

This section contains six hands-on projects that take you from a single-page vanilla-JS app all the way to a deployed, authenticated, full-stack blogging platform. Complete them in order; each one builds on the skills introduced in earlier phases of the course.

## Project Overview

| # | Project | Level | Phase Prerequisites | Description |
|---|---------|-------|---------------------|-------------|
| 1 | To-Do List | Beginner | Phase 2, 4, 8 | Vanilla JS + DOM manipulation, persisted with `localStorage` |
| 2 | Weather App | Beginner | Phase 4, 5 | Fetch API against a public weather API, `async/await`, error handling |
| 3 | GitHub Profile Finder | Beginner | Phase 4, 5 | Fetch API against the GitHub REST API, search input, loading/error states |
| 4 | Notes App with Node Backend | Intermediate | Phase 5, 10 | Express REST API (CRUD) + vanilla-JS frontend, JSON file storage |
| 5 | Task Manager Full Stack | Intermediate → Advanced | Phase 6, 9, 10 | Express + MongoDB backend (CRUD, JWT auth), vanilla-JS frontend |
| 6 | Blog CMS Capstone | Advanced | Phase 10, 11 | Auth (JWT + bcrypt), paginated posts CRUD, MongoDB, markdown-ish rendering, deployment |

---

## Project Summaries

### 1. To-Do List (Beginner)
Build a client-side to-do list with add/complete/delete/filter functionality, treating the DOM as a projection of an in-memory `tasks` array. State is persisted to `localStorage` on every change and reloaded on page load, using event delegation so dynamically added items still respond to clicks without re-attaching listeners.

### 2. Weather App (Beginner)
Call a free public weather API (Open-Meteo) with `fetch` and `async/await` to look up the current weather for any city, chaining a geocoding request into a forecast request. You will explicitly manage loading, success, and error UI states, and learn why `fetch` requires manually checking `response.ok` rather than relying on Promise rejection for HTTP errors.

### 3. GitHub Profile Finder (Beginner)
Search any GitHub username against the public GitHub REST API and render their profile plus recent repositories. Two independent requests (profile, repos) run concurrently via `Promise.all`, and distinct error states are shown for a 404 (user not found) versus a 403 (rate limit exceeded).

### 4. Notes App with Node Backend (Intermediate)
Build a full CRUD REST API in Express, backed by a JSON file on disk, and a vanilla-JS frontend that consumes it entirely through `fetch`. This is the first project where JavaScript runs in two environments — Node on the server, the browser on the client — talking to each other over HTTP with JSON.

### 5. Task Manager Full Stack (Intermediate → Advanced)
Add real authentication: users register and log in against an Express + MongoDB (Mongoose) backend, passwords are hashed with bcrypt, and a signed JWT gates every task operation. All task data is strictly scoped to the authenticated user via `owner` references, and the frontend attaches the token to every request via an `Authorization: Bearer` header.

### 6. Blog CMS Capstone (Advanced)
The capstone: combine JWT + bcrypt auth, a paginated posts REST API (public reads, owner-scoped protected writes), MongoDB persistence, and a vanilla-JS frontend that renders post bodies through a small, deliberately safe markdown-ish-to-HTML converter. The project finishes with a real deployment to a hosting platform backed by MongoDB Atlas, verified end-to-end over the public internet.
