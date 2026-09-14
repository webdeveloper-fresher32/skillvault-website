# Project 1 — Static Website with Nginx

**Level:** Beginner
**Time estimate:** 30 – 45 minutes
**Phase prerequisite:** Phase 1 – Images & Containers

---

## Overview

You will package a custom HTML page inside the official Nginx image and serve it from a container on your machine. The goal is to become comfortable with the core Docker workflow: write a Dockerfile, build an image, run a container, and verify the result in a browser.

---

## Prerequisites

- Docker Desktop (or Docker Engine) installed and running
- A text editor
- Basic familiarity with the command line

---

## Project Structure

```
01-static-website/
├── Dockerfile
└── html/
    └── index.html
```

---

## Step-by-Step Instructions

### Step 1 — Create the project directory

```bash
mkdir 01-static-website && cd 01-static-website
mkdir html
```

### Step 2 — Write the HTML page

Create `html/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Docker Static Site</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a2e;
      color: #eaeaea;
    }
    .card {
      text-align: center;
      background: #16213e;
      padding: 3rem 4rem;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    h1 { color: #0f3460; color: #e94560; margin-bottom: 0.5rem; }
    p  { color: #a8b2d8; }
    .badge {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.4rem 1rem;
      background: #0f3460;
      border-radius: 20px;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello from Docker!</h1>
    <p>This page is being served by <strong>Nginx</strong> running inside a container.</p>
    <p>You built this image from scratch — well done.</p>
    <div class="badge">Docker Master Course · Project 1</div>
  </div>
</body>
</html>
```

### Step 3 — Write the Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
# Use the official lightweight Nginx image based on Alpine Linux
FROM nginx:alpine

# Remove the default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy our custom HTML into the Nginx web root
COPY html/ /usr/share/nginx/html/

# Expose port 80 so Docker knows the container listens here
EXPOSE 80

# Nginx starts automatically — no CMD override needed
```

### Step 4 — Build the image

```bash
docker build -t my-static-site:1.0 .
```

Expected output (abbreviated):

```
[+] Building 3.2s (8/8) FINISHED
 => [1/3] FROM docker.io/library/nginx:alpine
 => [2/3] RUN rm -rf /usr/share/nginx/html/*
 => [3/3] COPY html/ /usr/share/nginx/html/
 => exporting to image
 => naming to docker.io/library/my-static-site:1.0
```

### Step 5 — Run the container

```bash
docker run -d \
  --name static-site \
  -p 8080:80 \
  my-static-site:1.0
```

Flag reference:
- `-d` — run detached (in the background)
- `--name` — give the container a human-readable name
- `-p 8080:80` — map host port 8080 to container port 80

### Step 6 — Verify it works

Open your browser at [http://localhost:8080](http://localhost:8080) — you should see the styled card page.

Alternatively, use curl:

```bash
curl -s http://localhost:8080 | grep -o "<title>.*</title>"
# Expected: <title>Docker Static Site</title>
```

Check container status:

```bash
docker ps
docker logs static-site
```

### Step 7 — Clean up

```bash
docker stop static-site
docker rm static-site
docker rmi my-static-site:1.0
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Container running | `docker ps` | `static-site` listed with status `Up` |
| HTTP response | `curl -o /dev/null -sw "%{http_code}" http://localhost:8080` | `200` |
| Page title | `curl -s http://localhost:8080 \| grep title` | Contains `Docker Static Site` |

---

## Stretch Goals

1. **Custom Nginx config** — add an `nginx.conf` that enables gzip compression and sets cache headers for static assets.
2. **Multi-page site** — add an `about.html` and link to it from the homepage.
3. **HTTPS with self-signed cert** — generate a cert with `openssl` and update the Nginx config to listen on port 443.
4. **Smaller image** — compare image sizes between `nginx:alpine` and `nginx:latest` using `docker image ls`.
5. **Bind mount for development** — use `-v $(pwd)/html:/usr/share/nginx/html` so edits to the HTML are reflected live without a rebuild.
