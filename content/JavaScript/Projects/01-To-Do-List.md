# Project 1: To-Do List (Vanilla JS + localStorage)

**Level:** Beginner
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 2, 4, 8 (Core JavaScript, DOM Manipulation, Browser APIs)

---

## Overview

You will build a fully client-side to-do list application: add tasks, mark them complete, delete them, filter by status, and — most importantly — persist everything to `localStorage` so the list survives a page refresh. No frameworks, no build tools — just an `index.html`, a `style.css`, and an `app.js` file, opened directly in the browser.

```
Browser
  │
index.html  ──renders──▶  <ul id="task-list">
  │
app.js
  ├── in-memory `tasks` array  (source of truth while the tab is open)
  ├── render()                (re-draws the DOM from `tasks`)
  ├── saveTasks() / loadTasks()  (sync `tasks` ⇄ localStorage)
  └── event listeners on form, list (event delegation), and filter buttons
```

---

## Prerequisites

- A modern browser (Chrome, Firefox, Edge)
- A text editor and the ability to open an HTML file directly (`file://`) or via a simple static server (e.g. VS Code Live Server)
- Comfortable with arrays/objects, array methods (`map`, `filter`, `find`), template literals (Phase 2)
- Comfortable with `querySelector`, `addEventListener`, creating/removing DOM nodes, event delegation (Phase 4)
- Familiar with the `localStorage` API — `getItem`, `setItem`, `JSON.stringify`/`JSON.parse` (Phase 8)

---

## What You'll Learn

- Modeling application state as a plain JavaScript array of objects, and treating the DOM as a *projection* of that state
- Re-rendering the DOM from state instead of mutating individual nodes by hand
- **Event delegation** — attaching one listener to a parent list instead of one per task, so dynamically added items still work
- Persisting state across page reloads using `localStorage` with JSON serialization
- Defensive parsing when reading from `localStorage` (handling missing/corrupt data)
- Basic UI state (active filter) kept in memory alongside the data

---

## Project Structure

```
01-todo-list/
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
  <title>To-Do List</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="app">
    <h1>To-Do List</h1>

    <form id="task-form">
      <input
        type="text"
        id="task-input"
        placeholder="What needs to be done?"
        autocomplete="off"
        required
      />
      <button type="submit">Add</button>
    </form>

    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="active">Active</button>
      <button class="filter-btn" data-filter="completed">Completed</button>
    </div>

    <ul id="task-list"></ul>

    <p id="empty-state" class="empty-state" hidden>No tasks yet — add one above.</p>

    <footer>
      <span id="item-count">0 items left</span>
      <button id="clear-completed">Clear completed</button>
    </footer>
  </main>

  <script src="app.js"></script>
</body>
</html>
```

### Step 2 — Basic styling

Create `style.css`:

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #f1f5f9;
  color: #1e293b;
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.app {
  background: #fff;
  width: 100%;
  max-width: 480px;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

h1 { margin-bottom: 1.25rem; font-size: 1.5rem; }

#task-form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
#task-input {
  flex: 1;
  padding: 0.6rem 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.95rem;
}
#task-form button {
  padding: 0.6rem 1.2rem;
  background: #0284c7;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
#task-form button:hover { background: #0369a1; }

.filters { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.filter-btn {
  padding: 0.35rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 20px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.filter-btn.active { background: #0284c7; color: #fff; border-color: #0284c7; }

#task-list { list-style: none; }
#task-list li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid #e2e8f0;
}
#task-list li.completed span { text-decoration: line-through; color: #94a3b8; }
#task-list li span { flex: 1; word-break: break-word; }
#task-list li button {
  border: none;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  font-size: 1rem;
}

.empty-state { text-align: center; color: #94a3b8; padding: 1rem 0; }

footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #64748b;
}
footer button { border: none; background: transparent; color: #64748b; cursor: pointer; text-decoration: underline; }
```

### Step 3 — Application state and localStorage helpers

Create `app.js` and start with state management:

```javascript
const STORAGE_KEY = 'todo-app.tasks';

/** @type {{id: string, text: string, completed: boolean}[]} */
let tasks = [];
let currentFilter = 'all'; // 'all' | 'active' | 'completed'

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // Corrupt data in localStorage should never crash the app
    console.warn('Could not parse stored tasks, starting fresh.', err);
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
```

### Step 4 — Rendering the list from state

```javascript
const listEl        = document.getElementById('task-list');
const emptyStateEl   = document.getElementById('empty-state');
const itemCountEl    = document.getElementById('item-count');

function getVisibleTasks() {
  switch (currentFilter) {
    case 'active':    return tasks.filter(t => !t.completed);
    case 'completed': return tasks.filter(t => t.completed);
    default:          return tasks;
  }
}

function render() {
  const visible = getVisibleTasks();

  // Rebuild the list from scratch — simplest correct approach for this scale
  listEl.innerHTML = visible.map(task => `
    <li data-id="${task.id}" class="${task.completed ? 'completed' : ''}">
      <input type="checkbox" class="toggle" ${task.completed ? 'checked' : ''} />
      <span>${escapeHtml(task.text)}</span>
      <button class="delete" aria-label="Delete task">✕</button>
    </li>
  `).join('');

  emptyStateEl.hidden = tasks.length > 0;
  const remaining = tasks.filter(t => !t.completed).length;
  itemCountEl.textContent = `${remaining} item${remaining === 1 ? '' : 's'} left`;
}

// Prevent stored task text from being interpreted as HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

### Step 5 — Adding tasks

```javascript
const formEl  = document.getElementById('task-form');
const inputEl = document.getElementById('task-input');

formEl.addEventListener('submit', (e) => {
  e.preventDefault();

  const text = inputEl.value.trim();
  if (!text) return;

  tasks.push({ id: createId(), text, completed: false });
  saveTasks();
  render();

  inputEl.value = '';
  inputEl.focus();
});
```

### Step 6 — Toggling and deleting via event delegation

Instead of attaching a listener to every `<li>` (which would need re-attaching after every re-render), attach **one** listener to the parent `<ul>` and inspect `event.target`:

```javascript
listEl.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.matches('.toggle')) {
    const task = tasks.find(t => t.id === id);
    if (task) task.completed = !task.completed;
    saveTasks();
    render();
  }

  if (e.target.matches('.delete')) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
  }
});
```

### Step 7 — Filtering

```javascript
const filterButtons = document.querySelectorAll('.filter-btn');

filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;

    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    render();
  });
});
```

### Step 8 — Clear completed and initial boot

```javascript
document.getElementById('clear-completed').addEventListener('click', () => {
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  render();
});

// Boot: load persisted state, then do the first render
tasks = loadTasks();
render();
```

### Step 9 — Run it

Open `index.html` directly in a browser (double-click, or `open index.html` on macOS). Add a few tasks, mark some complete, refresh the page, and confirm the list is still there.

---

## Verification

| Check | How to test | Expected result |
|-------|-------------|------------------|
| Add task | Type text, press Add | New item appears at the bottom of the list |
| Persistence | Add tasks, refresh the page | Tasks are still present after reload |
| Toggle complete | Click a task's checkbox | Text gets a strikethrough; item count decreases |
| Delete | Click the ✕ button on a task | Task disappears immediately and after refresh |
| Filter: Active | Click "Active" with a mix of tasks | Only incomplete tasks shown |
| Filter: Completed | Click "Completed" | Only completed tasks shown |
| Empty state | Delete all tasks | "No tasks yet" message appears |
| Corrupt storage | Run `localStorage.setItem('todo-app.tasks', 'not-json')`, refresh | App loads with an empty list, no crash |

---

## Stretch Goals

1. **Edit in place** — double-click a task's text to turn it into an `<input>`, save on blur or Enter, cancel on Escape.
2. **Drag-to-reorder** — use the native HTML Drag and Drop API (`draggable="true"`, `dragstart`/`dragover`/`drop`) to let users reorder tasks, persisting the new order.
3. **Due dates** — add an optional date field per task, sort overdue tasks to the top and highlight them in red.
4. **Keyboard shortcuts** — `Enter` to add (already works via form submit), `Ctrl/Cmd+Enter` to mark the focused task complete, `Delete` key to remove it.
5. **Multiple lists** — extend the storage schema to support named lists (e.g. "Work", "Personal"), storing an object of `{ [listName]: Task[] }` instead of a flat array.

---

## Completion Checklist

- [ ] Tasks can be added via the form and appear instantly in the list
- [ ] Tasks can be marked complete/incomplete via checkbox
- [ ] Tasks can be deleted
- [ ] All state changes are persisted to `localStorage` immediately
- [ ] Reloading the page restores the exact previous state
- [ ] Filtering between All / Active / Completed works correctly
- [ ] The "N items left" counter reflects only incomplete tasks
- [ ] "Clear completed" removes only completed tasks
- [ ] User-entered text is escaped before being inserted into the DOM (no HTML/script injection)
- [ ] Corrupt or missing `localStorage` data does not crash the app on load
