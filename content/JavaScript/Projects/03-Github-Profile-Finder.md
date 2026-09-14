# Project 3: GitHub Profile Finder

**Level:** Beginner
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 4, 5 (DOM Manipulation, Asynchronous JavaScript)

---

## Overview

You will build a search tool that looks up any GitHub username via the public GitHub REST API and renders their profile — avatar, bio, follower/following counts, public repo count, and a link to their profile — along with a list of their most recently updated public repositories. This project reinforces the same Fetch/async patterns as Project 2, but against a real-world, rate-limited, authentication-optional API, with a more involved loading/error/empty state machine.

```
User types "torvalds" → submits form
        │
        ▼
GET https://api.github.com/users/torvalds        ──▶ profile JSON
        │
        ▼
GET https://api.github.com/users/torvalds/repos?sort=updated&per_page=5  ──▶ repos JSON[]
        │
        ▼
render(profile, repos) ──▶ updates #profile-card and #repo-list
```

---

## Prerequisites

- A modern browser with internet access
- Comfortable with `fetch`, `async/await`, `try/catch`, and template literals (Phase 4, 5)
- Understand `Promise.all` for running independent requests concurrently (Phase 5)
- No GitHub account or token required — unauthenticated requests are rate-limited to 60/hour per IP, which is more than enough for this project

---

## What You'll Learn

- Consuming a real-world, well-documented public REST API (the GitHub REST API)
- Running two independent requests concurrently with `Promise.all` instead of sequentially with two `await`s
- Distinguishing a **404 Not Found** (user doesn't exist) from a **403 Forbidden** (rate limit exceeded) and showing a different message for each
- Managing a small explicit UI state machine: `idle → loading → success | error`
- Rendering a list of nested objects (repositories) into the DOM from an array
- Basic accessibility: using `alt` text on the avatar image and `aria-live` on the status region so screen readers announce loading/error changes

---

## Project Structure

```
03-github-profile-finder/
├── index.html
├── style.css
└── app.js
```

---

## Step-by-Step Guide

### Step 1 — Scaffold the HTML

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GitHub Profile Finder</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="app">
    <h1>GitHub Profile Finder</h1>

    <form id="search-form">
      <input type="text" id="username-input" placeholder="Enter a GitHub username..." required />
      <button type="submit">Find</button>
    </form>

    <p id="status" class="status" aria-live="polite" hidden></p>

    <section id="profile-card" class="profile-card" hidden>
      <img id="avatar" class="avatar" alt="" />
      <div class="profile-info">
        <h2 id="name"></h2>
        <p id="username" class="username"></p>
        <p id="bio" class="bio"></p>
        <div class="stats">
          <span><strong id="followers"></strong> followers</span>
          <span><strong id="following"></strong> following</span>
          <span><strong id="public-repos"></strong> repos</span>
        </div>
        <a id="profile-link" href="#" target="_blank" rel="noopener noreferrer">View on GitHub &rarr;</a>
      </div>
    </section>

    <ul id="repo-list" class="repo-list"></ul>
  </main>

  <script src="app.js"></script>
</body>
</html>
```

### Step 2 — Styling

Create `style.css`:

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.app { width: 100%; max-width: 480px; }

h1 { margin-bottom: 1.25rem; font-size: 1.4rem; color: #38bdf8; }

#search-form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
#username-input {
  flex: 1;
  padding: 0.6rem 0.8rem;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 0.95rem;
}
#search-form button {
  padding: 0.6rem 1.2rem;
  background: #0284c7;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
#search-form button:disabled { opacity: 0.6; cursor: not-allowed; }

.status { color: #94a3b8; margin-bottom: 1rem; }
.status.error { color: #f87171; }

.profile-card {
  display: flex;
  gap: 1rem;
  background: #1e293b;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.avatar { width: 88px; height: 88px; border-radius: 50%; flex-shrink: 0; }
.profile-info h2 { font-size: 1.1rem; }
.username { color: #7dd3fc; font-size: 0.85rem; margin-bottom: 0.5rem; }
.bio { color: #cbd5e1; font-size: 0.9rem; margin-bottom: 0.75rem; }
.stats { display: flex; gap: 1rem; font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem; }
#profile-link { color: #38bdf8; font-size: 0.85rem; text-decoration: none; }

.repo-list { list-style: none; }
.repo-list li {
  background: #1e293b;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
}
.repo-list a { color: #7dd3fc; text-decoration: none; font-weight: 600; }
.repo-list p { font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem; }
```

### Step 3 — API layer

Create `app.js`:

```javascript
const API_BASE = 'https://api.github.com';

async function fetchUser(username) {
  const response = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`);

  if (response.status === 404) {
    throw new Error(`No GitHub user found for "${username}"`);
  }
  if (response.status === 403) {
    throw new Error('GitHub API rate limit exceeded — try again in a few minutes');
  }
  if (!response.ok) {
    throw new Error(`GitHub API error (status ${response.status})`);
  }

  return response.json();
}

async function fetchRepos(username) {
  const response = await fetch(
    `${API_BASE}/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=5`
  );

  if (!response.ok) {
    // A missing repo list shouldn't block showing the profile — return an empty array
    return [];
  }

  return response.json();
}
```

### Step 4 — Fetch both resources concurrently

```javascript
async function fetchProfile(username) {
  // These two requests are independent of each other — run them in parallel
  const [user, repos] = await Promise.all([
    fetchUser(username),
    fetchRepos(username),
  ]);

  return { user, repos };
}
```

Note that `fetchUser` and `fetchRepos` both need `username`, but neither depends on the *result* of the other — that's what makes `Promise.all` safe and faster than two sequential `await`s.

### Step 5 — DOM rendering

```javascript
const formEl        = document.getElementById('search-form');
const inputEl        = document.getElementById('username-input');
const statusEl       = document.getElementById('status');
const profileCardEl  = document.getElementById('profile-card');
const repoListEl     = document.getElementById('repo-list');
const submitBtn      = formEl.querySelector('button');

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.hidden = false;
  statusEl.classList.toggle('error', isError);
  profileCardEl.hidden = true;
  repoListEl.innerHTML = '';
}

function renderProfile(user) {
  document.getElementById('avatar').src = user.avatar_url;
  document.getElementById('avatar').alt = `${user.login}'s avatar`;
  document.getElementById('name').textContent = user.name || user.login;
  document.getElementById('username').textContent = `@${user.login}`;
  document.getElementById('bio').textContent = user.bio || 'No bio provided.';
  document.getElementById('followers').textContent = user.followers;
  document.getElementById('following').textContent = user.following;
  document.getElementById('public-repos').textContent = user.public_repos;
  document.getElementById('profile-link').href = user.html_url;

  statusEl.hidden = true;
  profileCardEl.hidden = false;
}

function renderRepos(repos) {
  if (repos.length === 0) {
    repoListEl.innerHTML = '<li>No public repositories found.</li>';
    return;
  }

  repoListEl.innerHTML = repos.map(repo => `
    <li>
      <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${repo.name}</a>
      <p>${repo.description ? escapeHtml(repo.description) : 'No description'} · ★ ${repo.stargazers_count}</p>
    </li>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'Searching...' : 'Find';
}
```

### Step 6 — Wire up the form

```javascript
formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = inputEl.value.trim();
  if (!username) return;

  setLoading(true);
  showStatus(`Looking up "${username}"...`);

  try {
    const { user, repos } = await fetchProfile(username);
    renderProfile(user);
    renderRepos(repos);
  } catch (err) {
    showStatus(err.message, true);
  } finally {
    setLoading(false);
  }
});
```

### Step 7 — Run it

Serve the folder with a local static server (recommended to avoid `file://` fetch restrictions in some browsers) and search for a known username such as `octocat` or `torvalds`.

---

## Verification

| Check | How to test | Expected result |
|-------|-------------|------------------|
| Valid user | Search "octocat" | Avatar, name, bio, stats, and repo list render |
| Unknown user | Search "asldkfjaslkdjf12345" | "No GitHub user found for..." message shown |
| Rate limit (simulate) | Search rapidly >60 times in an hour from the same network | "GitHub API rate limit exceeded" message shown, not a generic crash |
| No bio / no repos | Search a user with an empty bio or zero public repos | Falls back to "No bio provided." / "No public repositories found." |
| Concurrent requests | Add a `console.time`/`console.timeEnd` around `fetchProfile` | Total time ≈ the slower of the two calls, not the sum (confirms `Promise.all` parallelism) |
| Repeated searches | Search two different usernames in a row | Second result fully replaces the first, no leftover repos from the previous user |

---

## Stretch Goals

1. **Pagination** — add "Load more repos" that fetches the next page (`&page=2`) and appends to the existing list.
2. **Search history** — persist the last 5 searched usernames to `localStorage` and render them as clickable chips.
3. **Debounced autocomplete** — as the user types, hit `GET /search/users?q=...` and show a dropdown of matching usernames.
4. **Rate-limit awareness** — read the `X-RateLimit-Remaining` response header and show a warning banner when it drops below 5.
5. **Organizations** — detect when a lookup is for an organization (`user.type === 'Organization'`) and adjust the UI copy/fields accordingly (orgs don't have `followers`/`following`).

---

## Completion Checklist

- [ ] Searching a valid username renders avatar, name, bio, and stats correctly
- [ ] Searching an invalid username shows a specific "not found" message (404 handled distinctly)
- [ ] A rate-limit response (403) is handled with a distinct, user-friendly message
- [ ] Profile and repo requests run concurrently via `Promise.all`, not sequential `await`s
- [ ] Repo list renders with name, description fallback, and star count
- [ ] All user-supplied and API-supplied text is escaped before insertion into the DOM
- [ ] Loading state disables the submit button and updates its label
- [ ] The status region uses `aria-live="polite"` so state changes are announced to screen readers
