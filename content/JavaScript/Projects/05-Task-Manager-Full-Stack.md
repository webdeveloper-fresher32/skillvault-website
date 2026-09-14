# Project 5: Task Manager — Full Stack (Express + MongoDB + JWT)

**Level:** Intermediate → Advanced
**Time estimate:** 3 – 4 hours
**Phase prerequisite:** Phase 6, 9, 10 (Object-Oriented JavaScript, Data Structures & Algorithms, Backend JavaScript)

---

## Overview

You will build a single-user task manager where the backend enforces authentication: a user registers and logs in, receives a JSON Web Token, and every subsequent task operation must present that token. Data is persisted in MongoDB via Mongoose. The frontend is vanilla JS that stores the JWT in memory/`localStorage` and attaches it to every request.

```
┌──────────────── Browser ────────────────┐         ┌──────────────── Express server ────────────────┐
│ index.html / app.js                     │  HTTPS  │                                                  │
│  - login form                           │────────▶│ POST /api/auth/register  → hash pw, create User │
│  - task list                            │  fetch  │ POST /api/auth/login     → verify pw, sign JWT   │
│  - Authorization: Bearer <token>         │◀────────│ GET/POST/PUT/DELETE /api/tasks (auth middleware) │
└──────────────────────────────────────────┘         └───────────────────────┬──────────────────────────┘
                                                                              │ Mongoose
                                                                              ▼
                                                                        MongoDB (users, tasks)
```

---

## Prerequisites

- Node.js 18+, npm, and a running MongoDB instance (local `mongod` or a free MongoDB Atlas cluster)
- Comfortable with `class`, constructors, and Mongoose schemas/models (Phase 6)
- Comfortable reasoning about arrays of objects, filtering/sorting collections (Phase 9 — used lightly here for sorting/filtering tasks)
- Comfortable building an Express REST API, middleware, environment variables via `dotenv`, and connecting to MongoDB with Mongoose (Phase 10)
- Basic familiarity with password hashing (`bcrypt`) and JSON Web Tokens (`jsonwebtoken`) — introduced in this project if not covered yet

---

## What You'll Learn

- Designing two related Mongoose schemas (`User`, `Task`) with a reference (`Task.owner → User._id`)
- Hashing passwords with `bcrypt` before storage — never storing plaintext passwords
- Issuing a signed JWT on login and verifying it on protected routes via custom Express middleware
- Scoping all data access to the authenticated user (`Task.find({ owner: req.userId })`) so users can never see each other's tasks
- Storing a JWT on the client and attaching it to every request via the `Authorization: Bearer <token>` header
- Handling `401 Unauthorized` on the frontend by redirecting back to the login form
- Using environment variables (`.env` + `dotenv`) to keep secrets (JWT secret, Mongo URI) out of source code

---

## Project Structure

```
05-task-manager/
├── package.json
├── .env
├── server.js
├── db.js
├── models/
│   ├── User.js
│   └── Task.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   └── tasks.js
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Step-by-Step Guide

### Step 1 — Initialize the project

```bash
mkdir 05-task-manager && cd 05-task-manager
npm init -y
npm install express mongoose bcrypt jsonwebtoken dotenv
mkdir models middleware routes public
```

Create `.env`:

```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/task-manager
JWT_SECRET=replace-this-with-a-long-random-string
JWT_EXPIRES_IN=2h
```

### Step 2 — Database connection

Create `db.js`:

```javascript
const mongoose = require('mongoose');

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
}

module.exports = connectDB;
```

### Step 3 — Models

Create `models/User.js`:

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

// Instance method: compare a plaintext password against the stored hash
userSchema.methods.comparePassword = function (plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash);
};

// Static helper: hash a plaintext password before saving
userSchema.statics.hashPassword = function (plaintext) {
  return bcrypt.hash(plaintext, 10);
};

module.exports = mongoose.model('User', userSchema);
```

Create `models/Task.js`:

```javascript
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
```

### Step 4 — Auth routes (register + login)

Create `routes/auth.js`:

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'email and a password (min 6 chars) are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ email, passwordHash });

    res.status(201).json({ id: user._id, email: user.email });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // Same error for "no such user" and "wrong password" — avoids leaking which emails are registered
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.json({ token, email: user.email });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### Step 5 — Auth middleware

Create `middleware/auth.js`:

```javascript
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization; // "Bearer <token>"
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // Attach the authenticated user's id to the request
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
```

### Step 6 — Task routes (protected, scoped to the authenticated user)

Create `routes/tasks.js`:

```javascript
const express = require('express');
const Task = require('../models/Task');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth); // Every route below requires a valid JWT

router.get('/', async (req, res, next) => {
  try {
    const tasks = await Task.find({ owner: req.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    const task = await Task.create({ title: title.trim(), owner: req.userId });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    // Scoping the query by owner prevents a user from editing someone else's task
    // even if they guess a valid task id
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await Task.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!result) return res.status(404).json({ error: 'Task not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### Step 7 — Wire up the Express app

Create `server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./db');
const authRouter = require('./routes/auth');
const tasksRouter = require('./routes/tasks');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Task manager listening on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
```

### Step 8 — Frontend: auth-aware fetch wrapper

Create `public/app.js` with a small helper that centralizes attaching the token and handling `401`s:

```javascript
const API_BASE = '/api';
let token = localStorage.getItem('token');

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Token missing/expired/invalid — force the user back to the login screen
    logout();
    throw new Error('Session expired, please log in again');
  }

  return res;
}

function logout() {
  token = null;
  localStorage.removeItem('token');
  showLoginView();
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');

  token = data.token;
  localStorage.setItem('token', token);
}
```

Wire this into login/task forms the same way Project 4 wired CRUD calls — `apiFetch('/tasks')`, `apiFetch('/tasks', { method: 'POST', body: JSON.stringify({ title }) })`, etc. The HTML/CSS scaffolding (a login form that toggles to a task list on success) follows the same pattern as prior projects and is left as an exercise, reusing the escaping and event-delegation techniques from Projects 1 and 4.

### Step 9 — Run it

```bash
# Terminal 1: make sure MongoDB is running
mongod --dbpath /path/to/your/data/dir

# Terminal 2
npm start
```

Register a user, log in, and confirm the token is stored, then create/list/complete/delete tasks.

### Step 10 — Manual API testing with curl

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@example.com","password":"secret123"}'

TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@example.com","password":"secret123"}' | jq -r '.token')

curl http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Ship project 5"}'
```

---

## Verification

| Check | How to test | Expected result |
|-------|-------------|------------------|
| Register | `POST /api/auth/register` with new email | `201`, no password in response |
| Duplicate register | Register the same email twice | `409` |
| Login (correct) | `POST /api/auth/login` with correct credentials | `200`, JWT returned |
| Login (wrong password) | `POST /api/auth/login` with wrong password | `401`, generic "Invalid email or password" |
| Unauthenticated task access | `GET /api/tasks` with no `Authorization` header | `401` |
| Authenticated task access | `GET /api/tasks` with valid token | `200`, only that user's tasks |
| Cross-user isolation | Create two users, try to `PUT`/`DELETE` user A's task using user B's token | `404` (not `403` — existence is not revealed) |
| Expired/invalid token | Send a malformed token | `401` |
| Password hashing | Inspect the `users` collection directly | `passwordHash` field only, never plaintext |
| Frontend logout on 401 | Manually expire/clear the token, then trigger a task fetch | Frontend redirects to the login view |

---

## Stretch Goals

1. **Refresh tokens** — issue a short-lived access token plus a long-lived refresh token stored in an HttpOnly cookie, with a `/api/auth/refresh` endpoint.
2. **Rate limiting** — add `express-rate-limit` to the login route to slow down brute-force attempts.
3. **Task metadata** — add due dates and priority levels, and support `GET /api/tasks?sort=dueDate&priority=high`.
4. **Password reset flow** — generate a time-limited reset token, "email" it (log it to the console for this project), and add a reset-password endpoint.
5. **Move secrets to a secrets manager** — replace the plain `.env` file with environment variables injected by your deployment platform, and add `.env` to `.gitignore` (verify it's not already committed).

---

## Completion Checklist

- [ ] Users can register with a hashed password (never stored or returned as plaintext)
- [ ] Users can log in and receive a signed JWT with a defined expiry
- [ ] All `/api/tasks` routes reject requests without a valid `Authorization: Bearer` header (`401`)
- [ ] Tasks are always scoped to `req.userId` — one user can never read, edit, or delete another user's tasks
- [ ] The frontend stores the JWT and attaches it to every task request automatically
- [ ] A `401` response from any request triggers logout and returns the user to the login screen
- [ ] `.env` holds `MONGO_URI` and `JWT_SECRET`, and is excluded from version control
- [ ] Mongoose schema validation (`required`, `unique`) is enforced and surfaced as `400`/`409` errors, not raw stack traces
