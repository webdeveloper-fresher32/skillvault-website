# Project 6: Blog CMS — Capstone

**Level:** Advanced
**Time estimate:** 5 – 8 hours
**Phase prerequisite:** Phase 10, 11 (Backend JavaScript, Production & Deployment) — draws on the entire course

---

## Overview

This capstone combines everything from the course into one deployed application: a blogging CMS with JWT + bcrypt authentication, a paginated REST API for posts (CRUD), MongoDB persistence, a vanilla-JS frontend that renders posts with lightweight markdown-ish formatting, and a real deployment. This is deliberately the most open-ended project — treat the step-by-step guide as a strong scaffold, not a rigid script.

```
┌────────────── Browser ──────────────┐        ┌──────────────── Express server (deployed) ────────────────┐
│ / (post list, paginated)             │        │ POST /api/auth/register, /api/auth/login                   │
│ /post.html?id=...  (single post)     │◀──────▶│ GET    /api/posts?page=1&limit=10   (public, paginated)     │
│ /admin.html (create/edit, protected) │  fetch │ GET    /api/posts/:id               (public)                 │
│ app.js renders raw markdown-ish text │        │ POST   /api/posts                   (protected)              │
│ as basic HTML (bold/italics/headers) │        │ PUT    /api/posts/:id                (protected, owner-only) │
└──────────────────────────────────────┘        │ DELETE /api/posts/:id                (protected, owner-only) │
                                                 └───────────────────────┬────────────────────────────────────┘
                                                                        │ Mongoose
                                                                        ▼
                                                                 MongoDB Atlas (users, posts)
```

---

## Prerequisites

- Everything from Project 5 (Express, Mongoose, bcrypt, JWT, auth middleware) — this project reuses that foundation directly
- A MongoDB Atlas free-tier cluster (recommended for the deployment step) or local MongoDB for development
- Comfortable with environment-based configuration, `npm test`/basic testing, logging, and preparing an app for deployment (Phase 11)
- A free account on a deployment platform that supports Node.js (e.g. Render, Railway, Fly.io, or a VPS) — the guide below uses Render as the concrete example, but the steps generalize
- A GitHub account (most zero-config deploy platforms deploy from a connected repo)

---

## What You'll Learn

- Designing a `Post` schema with an owner reference, timestamps, and a URL-friendly `slug`
- Implementing **pagination** correctly: `skip`/`limit` with a `totalCount` in the response so the frontend can render "Page 2 of 5"
- Enforcing **ownership** on updates/deletes (an author can only edit their own posts) while keeping reads public
- Rendering user-authored content safely: converting a small, deliberately limited markdown-ish syntax (`**bold**`, `*italic*`, `# Heading`) to HTML without using `innerHTML` on unescaped user input directly
- Separating public routes (read) from protected routes (write) within the same Express router
- Preparing an app for **production**: environment variables for secrets, a `NODE_ENV` check, disabling verbose error output in production, and a health-check endpoint
- Deploying a Node.js + MongoDB app to a real hosting platform and verifying it end-to-end over the public internet

---

## Project Structure

```
06-blog-cms/
├── package.json
├── .env
├── .gitignore
├── server.js
├── db.js
├── models/
│   ├── User.js
│   └── Post.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   └── posts.js
├── lib/
│   └── markdownLite.js
└── public/
    ├── index.html         (paginated post list)
    ├── post.html           (single post view)
    ├── admin.html          (login + create/edit form)
    ├── style.css
    └── app.js
```

---

## Step-by-Step Guide

### Step 1 — Bootstrap from Project 5

Copy `models/User.js`, `middleware/auth.js`, `routes/auth.js`, and `db.js` from Project 5 unchanged — the auth layer for this project is identical. Initialize the project:

```bash
mkdir 06-blog-cms && cd 06-blog-cms
npm init -y
npm install express mongoose bcrypt jsonwebtoken dotenv
npm install --save-dev nodemon
mkdir models middleware routes public lib
```

Create `.gitignore`:

```
node_modules/
.env
```

### Step 2 — The Post model

Create `models/Post.js`:

```javascript
const mongoose = require('mongoose');

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  body: { type: String, required: true }, // Raw markdown-ish source text
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  published: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-generate a unique slug from the title before validation
postSchema.pre('validate', async function (next) {
  if (!this.isModified('title') && this.slug) return next();

  const base = slugify(this.title);
  let candidate = base;
  let counter = 1;

  // Ensure uniqueness even when two posts share a title
  const Post = mongoose.model('Post');
  while (await Post.exists({ slug: candidate, _id: { $ne: this._id } })) {
    candidate = `${base}-${counter++}`;
  }

  this.slug = candidate;
  next();
});

module.exports = mongoose.model('Post', postSchema);
```

### Step 3 — A tiny, safe "markdown-ish" renderer

Rather than pulling in a full markdown library, write a deliberately small converter that only supports a handful of tags, and always escapes raw text first. Create `lib/markdownLite.js`:

```javascript
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts a small, deliberately limited subset of markdown to HTML.
 * Supports: # / ## / ### headings, **bold**, *italic*, and paragraphs.
 * All raw text is escaped BEFORE any tag substitution, so user-authored
 * HTML/script tags can never reach the DOM unescaped.
 */
function renderMarkdownLite(source) {
  const escaped = escapeHtml(source);

  return escaped
    .split(/\n{2,}/)                     // paragraphs
    .map(block => {
      const heading = block.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${inline(heading[2])}</h${level}>`;
      }
      return `<p>${inline(block)}</p>`;
    })
    .join('\n');
}

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

module.exports = { renderMarkdownLite, escapeHtml };
```

This same module can run in Node (for a server-rendered preview, if you add one) or be bundled for the browser — for this project it's used client-side, loaded as a plain `<script>`.

### Step 4 — Posts routes: public reads, protected writes

Create `routes/posts.js`:

```javascript
const express = require('express');
const Post = require('../models/Post');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// ---- Public routes ----

// GET /api/posts?page=1&limit=10 — paginated, published posts only
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // cap to prevent abuse

    const filter = { published: true };

    const [posts, totalCount] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', 'email')
        .select('-body'), // list view omits full body for a smaller payload
      Post.countDocuments(filter),
    ]);

    res.json({
      posts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/:slug — full post by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, published: true })
      .populate('author', 'email');
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

// ---- Protected routes ----

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }
    const post = await Post.create({ title, body, author: req.userId });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    // Ownership check: only the author can edit their own post
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, author: req.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!post) return res.status(404).json({ error: 'Post not found or not owned by you' });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await Post.findOneAndDelete({ _id: req.params.id, author: req.userId });
    if (!result) return res.status(404).json({ error: 'Post not found or not owned by you' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### Step 5 — Production-ready `server.js`

```javascript
require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./db');
const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check — deployment platforms poll this to confirm the app is alive
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);

// Centralized error handler — hide stack traces in production
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    ...(!isProd && { detail: err.message }),
  });
});

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`Blog CMS listening on port ${PORT}`)))
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### Step 6 — Frontend: paginated post list

Create `public/index.html` and `public/app.js` implementing:

```javascript
const API_BASE = '/api';

async function loadPosts(page = 1) {
  const res = await fetch(`${API_BASE}/posts?page=${page}&limit=10`);
  if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
  const { posts, pagination } = await res.json();
  renderPostList(posts);
  renderPagination(pagination, loadPosts);
}

function renderPostList(posts) {
  const listEl = document.getElementById('post-list');
  listEl.innerHTML = posts.map(post => `
    <li>
      <a href="/post.html?slug=${post.slug}">${escapeHtml(post.title)}</a>
      <small>by ${escapeHtml(post.author?.email || 'unknown')} · ${new Date(post.createdAt).toLocaleDateString()}</small>
    </li>
  `).join('');
}

function renderPagination({ page, totalPages }, onNavigate) {
  const el = document.getElementById('pagination');
  el.innerHTML = `
    <button ${page <= 1 ? 'disabled' : ''} id="prev-page">Prev</button>
    <span>Page ${page} of ${totalPages || 1}</span>
    <button ${page >= totalPages ? 'disabled' : ''} id="next-page">Next</button>
  `;
  document.getElementById('prev-page').onclick = () => onNavigate(page - 1);
  document.getElementById('next-page').onclick = () => onNavigate(page + 1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadPosts();
```

`post.html` fetches `GET /api/posts/:slug` and renders `post.body` through `renderMarkdownLite` (loaded via `<script src="/lib/markdownLite.js"></script>` — copy the file into `public/lib/` or serve `lib/` statically). `admin.html` reuses the login/auth pattern from Project 5 plus a create/edit form posting to `/api/posts`.

### Step 7 — Prepare for deployment

1. Ensure `.env` is **not** committed (`.gitignore` already excludes it).
2. Push the project to a GitHub repository.
3. Create a free MongoDB Atlas cluster, add a database user, whitelist `0.0.0.0/0` (or your deploy platform's IP range) under Network Access, and copy the connection string.
4. On your deploy platform (example: Render):
   - Create a new **Web Service**, connect the GitHub repo.
   - Build command: `npm install`. Start command: `npm start`.
   - Set environment variables in the platform's dashboard: `MONGO_URI` (Atlas connection string), `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV=production`.
   - Deploy, then confirm the health check passes: `curl https://<your-app>.onrender.com/health`.

### Step 8 — Verify the live deployment end-to-end

```bash
BASE=https://<your-app>.onrender.com

curl $BASE/health
# {"status":"ok"}

curl -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"author@example.com","password":"secret123"}'

TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"author@example.com","password":"secret123"}' | jq -r '.token')

curl -X POST $BASE/api/posts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Hello World","body":"# Hello\n\nThis is my **first** post."}'

curl "$BASE/api/posts?page=1&limit=10"
```

Then open `https://<your-app>.onrender.com` in a browser and confirm the post list, pagination, and single-post markdown rendering all work against the live deployment.

---

## Verification

| Check | How to test | Expected result |
|-------|-------------|------------------|
| Register/login | Full auth flow against the deployed URL | JWT returned |
| Create post (auth) | `POST /api/posts` with valid token | `201`, `slug` auto-generated |
| Create post (no auth) | `POST /api/posts` without a token | `401` |
| Duplicate title slugs | Create two posts with the same title | Both created; second gets a `-1` suffix on its slug |
| Pagination | `GET /api/posts?page=1&limit=2` with 5+ posts | Correct `totalPages`, `posts.length <= 2` |
| Public read | `GET /api/posts` and `GET /api/posts/:slug` with no auth header | `200` — reads are public |
| Ownership enforcement | User B attempts `PUT`/`DELETE` on User A's post | `404`, not modified |
| Markdown rendering | Create a post with `**bold**`, `*italic*`, `# heading`, and a `<script>` tag in the body | Bold/italic/heading render correctly; the script tag renders as literal escaped text, never executes |
| Production error hiding | Set `NODE_ENV=production`, trigger a server error | Response omits `detail`/stack trace |
| Live health check | `curl https://<your-app>/health` | `200 {"status":"ok"}` |

---

## Stretch Goals

1. **Full-text search** — add a MongoDB text index on `title`/`body` and a `GET /api/posts?q=...` search endpoint.
2. **Comments** — a `Comment` model referencing both `Post` and `User`, with its own nested CRUD routes.
3. **Draft/publish workflow** — let authors save `published: false` drafts, with a `GET /api/posts/mine` route (protected) that returns an author's own drafts and published posts together.
4. **Image uploads** — accept a cover image on post creation (e.g. via a multipart upload to a service like Cloudinary or S3) and render it on the post list/detail views.
5. **CI** — add a GitHub Actions workflow that runs `npm test` and `npm audit` on every push, blocking deployment on failure (ties directly into Phase 11).

---

## Completion Checklist

- [ ] Auth (register/login, bcrypt hashing, JWT issuance) works identically to Project 5
- [ ] Posts support full CRUD, with reads public and writes protected + owner-scoped
- [ ] Slugs are unique and auto-generated, including when titles collide
- [ ] `GET /api/posts` returns correct pagination metadata (`page`, `totalPages`, `totalCount`)
- [ ] Post bodies are rendered through the escape-first markdown-lite renderer — no raw user HTML ever reaches `innerHTML` unescaped
- [ ] `NODE_ENV=production` suppresses internal error detail in API responses
- [ ] The app is deployed to a public URL, backed by MongoDB Atlas, with secrets set via platform environment variables (never committed)
- [ ] `/health` returns `200` on the live deployment
- [ ] The full flow — register, log in, create a post, view it in the paginated list, view its full markdown-rendered page — works end-to-end on the deployed URL
