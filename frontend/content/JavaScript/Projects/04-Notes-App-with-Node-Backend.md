# Project 4: Notes App with a Node.js/Express Backend

**Level:** Intermediate
**Time estimate:** 2 – 3 hours
**Phase prerequisite:** Phase 5, 10 (Asynchronous JavaScript, Backend JavaScript)

---

## Overview

You will build a full CRUD notes application split into two independently runnable pieces: an **Express REST API** that persists notes to a JSON file on disk, and a **vanilla-JS frontend** that consumes that API entirely through `fetch`. This is your first project where JavaScript runs in two different environments — Node.js on the server and the browser on the client — communicating over HTTP with JSON.

```
Browser (public/)                    Node.js server (server.js)
┌─────────────────────┐              ┌────────────────────────────┐
│ index.html           │  fetch()    │ Express app                │
│ app.js  ─────────────┼────────────▶│  GET    /api/notes         │
│  - renders notes     │  JSON       │  GET    /api/notes/:id     │
│  - handles forms     │◀────────────┼  POST   /api/notes         │
└─────────────────────┘              │  PUT    /api/notes/:id     │
                                      │  DELETE /api/notes/:id     │
                                      └──────────┬─────────────────┘
                                                 │ reads/writes
                                                 ▼
                                          data/notes.json
```

---

## Prerequisites

- Node.js 18+ and npm installed (`node -v`)
- Comfortable with `async/await`, `try/catch`, and the Fetch API on the client (Phase 5)
- Comfortable with Node.js core modules (`fs`, `path`), building a REST API with Express, route params, middleware, and JSON request/response bodies (Phase 10)
- A REST client for manual testing is convenient but not required — `curl` is used throughout

---

## What You'll Learn

- Structuring an Express application with routes, middleware, and a small persistence layer
- Modeling the four fundamental CRUD operations (Create/Read/Update/Delete) as HTTP verbs mapped to a resource (`/api/notes`)
- Using the filesystem (`fs.promises`) as a lightweight database with `async/await`, including read-modify-write races and how to avoid corrupting data on concurrent writes
- Serving a static frontend from Express (`express.static`) while also exposing a JSON API from the same process
- Consuming your own REST API from a browser client with `fetch`, including sending a JSON body with the correct headers for `POST`/`PUT`
- Returning meaningful HTTP status codes (`200`, `201`, `204`, `404`, `400`) and having the frontend react to each

---

## Project Structure

```
04-notes-app/
├── package.json
├── server.js
├── data/
│   └── notes.json
├── routes/
│   └── notes.js
├── lib/
│   └── notesStore.js
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Step-by-Step Guide

### Step 1 — Initialize the project

```bash
mkdir 04-notes-app && cd 04-notes-app
npm init -y
npm install express
mkdir data routes lib public
echo '[]' > data/notes.json
```

### Step 2 — Build the persistence layer

Create `lib/notesStore.js`. This centralizes all file I/O so routes never touch `fs` directly:

```javascript
const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'notes.json');

async function readAll() {
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return []; // Tolerate an empty or corrupt file rather than crashing the server
  }
}

async function writeAll(notes) {
  await fs.writeFile(DATA_FILE, JSON.stringify(notes, null, 2));
}

async function getAll() {
  return readAll();
}

async function getById(id) {
  const notes = await readAll();
  return notes.find(n => n.id === id) || null;
}

async function create({ title, body }) {
  const notes = await readAll();
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title,
    body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  notes.push(note);
  await writeAll(notes);
  return note;
}

async function update(id, { title, body }) {
  const notes = await readAll();
  const index = notes.findIndex(n => n.id === id);
  if (index === -1) return null;

  notes[index] = {
    ...notes[index],
    ...(title !== undefined && { title }),
    ...(body !== undefined && { body }),
    updatedAt: new Date().toISOString(),
  };
  await writeAll(notes);
  return notes[index];
}

async function remove(id) {
  const notes = await readAll();
  const filtered = notes.filter(n => n.id !== id);
  if (filtered.length === notes.length) return false; // Nothing was removed
  await writeAll(filtered);
  return true;
}

module.exports = { getAll, getById, create, update, remove };
```

> **Note on concurrency:** this read-then-write pattern is not safe under high concurrent write load (two simultaneous writes can race). That's an acceptable trade-off for a single-user local project — Project 5 replaces this with MongoDB, which handles concurrent writes properly.

### Step 3 — Build the routes

Create `routes/notes.js`:

```javascript
const express = require('express');
const store = require('../lib/notesStore');

const router = express.Router();

// GET /api/notes — list all notes
router.get('/', async (req, res, next) => {
  try {
    const notes = await store.getAll();
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

// GET /api/notes/:id — get a single note
router.get('/:id', async (req, res, next) => {
  try {
    const note = await store.getById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    next(err);
  }
});

// POST /api/notes — create a note
router.post('/', async (req, res, next) => {
  try {
    const { title, body } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    const note = await store.create({ title: title.trim(), body: body || '' });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

// PUT /api/notes/:id — update a note
router.put('/:id', async (req, res, next) => {
  try {
    const { title, body } = req.body;
    const updated = await store.update(req.params.id, { title, body });
    if (!updated) return res.status(404).json({ error: 'Note not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notes/:id — delete a note
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await store.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Note not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### Step 4 — Wire up the Express app

Create `server.js`:

```javascript
const express = require('express');
const path = require('path');
const notesRouter = require('./routes/notes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());                          // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve the frontend

app.use('/api/notes', notesRouter);

// Centralized error handler — catches anything passed to next(err)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Notes app listening on http://localhost:${PORT}`);
});
```

Add a start script to `package.json`:

```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

### Step 5 — Build the frontend HTML

Create `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Notes</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="app">
    <h1>Notes</h1>

    <form id="note-form">
      <input type="text" id="title-input" placeholder="Title" required />
      <textarea id="body-input" placeholder="Write your note..." rows="3"></textarea>
      <button type="submit">Save Note</button>
    </form>

    <p id="status" hidden></p>

    <ul id="notes-list"></ul>
  </main>

  <script src="app.js"></script>
</body>
</html>
```

Create `public/style.css` with any simple styling of your choice (card list, form spacing) — omitted here for brevity; reuse the visual patterns from Project 1.

### Step 6 — Frontend: consuming the API

Create `public/app.js`:

```javascript
const API_URL = '/api/notes';

const formEl      = document.getElementById('note-form');
const titleInput   = document.getElementById('title-input');
const bodyInput    = document.getElementById('body-input');
const listEl       = document.getElementById('notes-list');
const statusEl     = document.getElementById('status');

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.hidden = false;
  statusEl.style.color = isError ? '#dc2626' : '#64748b';
}

async function loadNotes() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Failed to load notes (${res.status})`);
    const notes = await res.json();
    renderNotes(notes);
  } catch (err) {
    showStatus(err.message, true);
  }
}

function renderNotes(notes) {
  if (notes.length === 0) {
    listEl.innerHTML = '<li>No notes yet.</li>';
    return;
  }

  listEl.innerHTML = notes.map(note => `
    <li data-id="${note.id}">
      <h3>${escapeHtml(note.title)}</h3>
      <p>${escapeHtml(note.body)}</p>
      <small>Updated ${new Date(note.updatedAt).toLocaleString()}</small>
      <button class="delete">Delete</button>
    </li>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Create a note
formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title) return;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to save note (${res.status})`);
    }

    titleInput.value = '';
    bodyInput.value = '';
    await loadNotes();
  } catch (err) {
    showStatus(err.message, true);
  }
});

// Delete a note (event delegation)
listEl.addEventListener('click', async (e) => {
  if (!e.target.matches('.delete')) return;

  const li = e.target.closest('li[data-id]');
  const id = li.dataset.id;

  try {
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      throw new Error(`Failed to delete note (${res.status})`);
    }
    await loadNotes();
  } catch (err) {
    showStatus(err.message, true);
  }
});

loadNotes();
```

### Step 7 — Run it

```bash
npm start
# Notes app listening on http://localhost:3000
```

Open `http://localhost:3000` in a browser. Create, view, and delete notes; confirm `data/notes.json` on disk updates after each operation.

### Step 8 — Manual API testing with curl

```bash
curl http://localhost:3000/api/notes
# []

curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Groceries","body":"Milk, eggs, bread"}'
# {"id":"...","title":"Groceries","body":"Milk, eggs, bread","createdAt":"...","updatedAt":"..."}

curl -X PUT http://localhost:3000/api/notes/<id> \
  -H "Content-Type: application/json" \
  -d '{"body":"Milk, eggs, bread, butter"}'

curl -X DELETE http://localhost:3000/api/notes/<id>
# (empty body, 204)
```

---

## Verification

| Check | How to test | Expected result |
|-------|-------------|------------------|
| List notes | `GET /api/notes` | `200`, JSON array |
| Create note | `POST /api/notes` with `{title, body}` | `201`, note object with generated `id` |
| Create without title | `POST /api/notes` with `{}` | `400`, `{ "error": "title is required" }` |
| Get single note | `GET /api/notes/:id` for an existing id | `200`, matching note |
| Get missing note | `GET /api/notes/doesnotexist` | `404` |
| Update note | `PUT /api/notes/:id` with partial body | `200`, `updatedAt` changes, `createdAt` unchanged |
| Delete note | `DELETE /api/notes/:id` | `204`, subsequent `GET` on same id returns `404` |
| Frontend renders | Open the app in a browser | Notes list matches `data/notes.json` contents |
| Persistence | Create a note, restart the server | Note is still present (file-backed, not in-memory only) |

---

## Stretch Goals

1. **Search/filter** — add a query param `GET /api/notes?q=milk` that filters notes by title/body substring, and a search box on the frontend.
2. **Optimistic UI** — update the DOM immediately on create/delete before the network response returns, rolling back on failure.
3. **Switch to in-memory + tests** — swap `notesStore.js`'s file-backed implementation for an in-memory array behind the same function signatures, and write a few tests against the routes with `supertest`.
4. **Validation middleware** — extract the title/body validation into reusable Express middleware rather than repeating checks per-route.
5. **Pagination** — support `?page=1&limit=10` on `GET /api/notes` for larger note collections.

---

## Completion Checklist

- [ ] All five REST endpoints (`GET` list, `GET` one, `POST`, `PUT`, `DELETE`) work as specified
- [ ] Notes persist to `data/notes.json` and survive a server restart
- [ ] Missing/invalid input on create returns `400` with a descriptive error
- [ ] Requesting a non-existent note returns `404` on `GET`, `PUT`, and `DELETE`
- [ ] The Express app serves both the static frontend and the JSON API from one process
- [ ] The frontend fully round-trips: create → appears in list; delete → disappears from list
- [ ] User-supplied text is escaped before insertion into the DOM
- [ ] A centralized Express error handler catches unexpected exceptions and returns `500` instead of crashing the process
