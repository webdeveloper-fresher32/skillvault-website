# Templating and Static Files — Complete Guide

## Table of Contents
1. [Serving Static Files with `express.static`](#1-serving-static-files-with-expressstatic)
2. [Templating Engines: EJS and Pug (Brief Overview)](#2-templating-engines-ejs-and-pug-brief-overview)
3. [API-Only vs Server-Rendered Apps](#3-api-only-vs-server-rendered-apps)
4. [Hands-On Exercises](#4-hands-on-exercises)
5. [Interview Q&A](#5-interview-qa)

---

## 1. Serving Static Files with `express.static`

`express.static` is built-in middleware that serves files directly from a folder — images, CSS, client-side JavaScript, downloadable PDFs, etc. — without you writing a route for each file.

```javascript
const express = require('express');
const path = require('path');
const app = express();

// Serve everything inside ./public directly at the root URL
app.use(express.static(path.join(__dirname, 'public')));

app.listen(3000, () => console.log('Listening on port 3000'));
```

```
project/
├── server.js
└── public/
    ├── index.html      →  served at  http://localhost:3000/index.html
    ├── style.css       →  served at  http://localhost:3000/style.css
    └── images/
        └── logo.png    →  served at  http://localhost:3000/images/logo.png
```

Mounting static files under a URL prefix:

```javascript
// Serve /public files under the /static prefix instead of the root
app.use('/static', express.static(path.join(__dirname, 'public')));
// public/style.css is now served at http://localhost:3000/static/style.css
```

Multiple static directories can be registered — Express checks them in order:

```javascript
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));
```

Since `express.static` is just middleware, it fits into the normal middleware chain (Lesson 02) — a request for a file that doesn't exist simply calls `next()` internally and falls through to your other routes/404 handler, rather than erroring.

---

## 2. Templating Engines: EJS and Pug (Brief Overview)

Before single-page apps (React/Vue) became standard, servers rendered full HTML pages using **templating engines** — HTML with embedded server-side logic/variables. Express supports this via `app.set('view engine', ...)` and `res.render()`.

### EJS (Embedded JavaScript — looks like plain HTML + `<% %>` tags)

```bash
npm install ejs
```

```javascript
const express = require('express');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // default is already ./views

app.get('/profile/:username', (req, res) => {
  res.render('profile', {
    username: req.params.username,
    joinedDate: '2024-01-15',
  });
});

app.listen(3000);
```

```html
<!-- views/profile.ejs -->
<!DOCTYPE html>
<html>
<head><title>Profile</title></head>
<body>
  <h1>Welcome, <%= username %></h1>
  <p>Joined on <%= joinedDate %></p>
  <% if (username === 'admin') { %>
    <p>You have admin privileges.</p>
  <% } %>
</body>
</html>
```

### Pug (indentation-based, no closing tags)

```bash
npm install pug
```

```javascript
app.set('view engine', 'pug');
```

```pug
//- views/profile.pug
html
  head
    title Profile
  body
    h1 Welcome, #{username}
    p Joined on #{joinedDate}
    if username === 'admin'
      p You have admin privileges.
```

| Engine | Syntax Style | Learning Curve |
|--------|--------------|-----------------|
| EJS | Plain HTML + `<% %>`/`<%= %>` tags | Low — feels like HTML |
| Pug | Indentation-based, no tags/braces | Medium — new syntax to learn |
| Handlebars | HTML + `{{ }}` mustache-style | Low — similar to EJS |

`res.render(view, data)` looks up `view` inside the configured `views` directory, injects `data` (plus anything in `res.locals`), and sends the resulting HTML string as the response — internally it's just `res.send(renderedHtmlString)`.

This is conceptually the same idea as Jinja2 in Flask/Django — server builds the final HTML string before sending it to the browser.

---

## 3. API-Only vs Server-Rendered Apps

Coming from a Python/React stack, you'll almost always build **API-only** Express backends that a separate React frontend consumes — but it's worth understanding both models and when each applies.

```
Server-Rendered (EJS/Pug):

  Browser  ──GET /profile/alice──▶  Express  ──res.render()──▶  full HTML page
     ▲                                                                │
     └────────────────────────── complete HTML response ─────────────┘
  Browser just displays the HTML. No separate frontend build/deploy.


API-Only (React frontend):

  Browser (React app)  ──GET /api/profile/alice──▶  Express  ──res.json()──▶  { username, joinedDate }
         │                                                                          │
         └──── React re-renders UI using the JSON data ◀────────────────────────────┘
  Express and the React app are two separately deployed services.
```

| | Server-Rendered (EJS/Pug) | API-Only (+ React/Vue frontend) |
|---|---|---|
| Response type | Full HTML pages | JSON |
| Frontend framework needed | No | Yes (React, Vue, etc.) |
| SEO | Easier (HTML present on first load) | Harder (needs SSR/prerendering for SPA content) |
| Team split | Backend devs also touch views | Clean frontend/backend separation |
| Typical use case | Admin panels, simple CRUD sites, server-rendered blogs | Modern SPAs, mobile app backends, microservices |
| Deployment | Single app/server | Two deployables (API + static frontend/CDN) |

```javascript
// API-only route (what you'll write most often in this course)
app.get('/api/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  res.json(user); // React fetches this and renders its own HTML
});

// vs. server-rendered equivalent
app.get('/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  res.render('user-profile', { user }); // Express generates the HTML directly
});
```

In practice, many production systems mix both: an API-only Express/Node backend for the React app's data, plus `express.static` serving the React app's own compiled `build/`/`dist/` folder as static assets (so one Express server can host both the API and the pre-built frontend):

```javascript
// Hosting a built React app + API from the same Express server
app.use(express.static(path.join(__dirname, 'client/build')));

app.use('/api/users', usersRouter); // JSON API routes

// Catch-all: let React Router handle all non-API, non-static routes client-side
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});
```

---

## 4. Hands-On Exercises

**Exercise 1:** Create a `public/` folder with an `index.html`, a `style.css`, and an image. Serve it with `app.use(express.static('public'))` and verify all three load in the browser.

**Exercise 2:** Mount the same static folder under a `/static` prefix instead of the root, and confirm the URLs change accordingly (`/static/style.css`).

**Exercise 3:** Install EJS, set it as the view engine, and create a `views/home.ejs` that renders a list of items passed via `res.render('home', { items: [...] })` using an EJS `<% items.forEach(...) %>` loop.

**Exercise 4:** Build the same page twice — once as `res.render()` with EJS, and once as a `res.json()` API endpoint returning the same data — and write a short comment explaining which approach you'd pick for a React frontend and why.

**Exercise 5:** Set up an Express server that serves a static `client/build` folder (simulate it with a plain `index.html`) AND exposes a `/api/health` JSON route, with a catch-all route serving `index.html` for anything else — the classic "host API + SPA together" pattern.

---

## 5. Interview Q&A

**Q: What does `express.static` do, and how does it behave in the middleware chain?**
Answer: `express.static(root)` is built-in middleware that serves files directly from the given directory, mapping file paths to URL paths (e.g., `public/style.css` → `/style.css`). Since it's ordinary middleware, if the requested file doesn't exist it calls `next()` internally and falls through to subsequent middleware/routes instead of erroring — letting you combine static file serving with API routes and a 404 handler in the same app.

**Q: What is a templating engine, and how does `res.render()` use it?**
Answer: A templating engine (EJS, Pug, Handlebars) lets you write HTML with embedded variables/logic that gets compiled into a final HTML string on the server. `res.render(viewName, data)` locates the view file in the configured `views` directory, injects `data` (along with `res.locals`), compiles it via the engine set with `app.set('view engine', ...)`, and sends the resulting HTML — effectively `res.send()` with a pre-built string.

**Q: When would you choose a server-rendered approach over an API + React frontend?**
Answer: Server-rendering (EJS/Pug) suits simple sites/admin panels where SEO and fast first-paint matter and there's no need for a rich, interactive client-side app — it avoids maintaining a separate frontend build pipeline. An API-only backend with React is preferred for interactive SPAs, when the frontend and backend teams/deploys need to be decoupled, or when the same API also needs to serve a mobile app.

**Q: How can a single Express server host both a React frontend and a JSON API?**
Answer: Use `express.static()` to serve the React app's built `build`/`dist` folder as static assets, register your API routes normally (typically under a `/api` prefix), and add a catch-all route (`app.get('*', ...)`) that returns `index.html` for any non-API, non-static path — letting client-side React Router handle those routes in the browser.

**Q: If a static file and a route both match the same path, which wins?**
Answer: Whichever middleware/route was registered first in the app runs first. If `express.static()` is registered before a matching route and the file exists, the static middleware serves the file and ends the response — the later route is never reached for that path. If registered after, the route runs first instead.

**Q: What's the practical difference in team workflow between EJS/Pug rendering and a JSON API consumed by React?**
Answer: With EJS/Pug, backend developers also author the presentation layer (HTML templates), and there's a single deployable. With a JSON API + React, the frontend and backend become independently developed, tested, and deployed services communicating only through a documented HTTP/JSON contract — a cleaner separation of concerns that scales better with larger teams, at the cost of extra infrastructure (CORS handling, two build/deploy pipelines, versioned API contracts).
