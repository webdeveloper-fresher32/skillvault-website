# Node.js Projects

Hands-on projects that take you from core Node.js modules to a multi-service backend architecture. Each project is self-contained: copy the code into files exactly as shown, run the listed commands, and it works — no external accounts or services beyond what's noted (MongoDB, Redis) are required.

## Projects

| # | Project | Difficulty | Focus |
|---|---------|------------|-------|
| 1 | [CLI Task Manager](01-CLI-Task-Manager.md) | Beginner | Core `fs` module, no Express, file-based persistence |
| 2 | [REST API with Express and MongoDB](02-REST-API-with-Express-and-MongoDB.md) | Beginner–Intermediate | Express + Mongoose CRUD, MVC folder structure, validation |
| 3 | [JWT Auth API](03-JWT-Auth-API.md) | Intermediate | bcrypt password hashing, JWT access + refresh tokens, protected routes |
| 4 | [Realtime Chat App](04-Realtime-Chat-App.md) | Intermediate–Advanced | Express + Socket.IO, rooms, broadcast, connect/disconnect lifecycle |
| 5 | [Microservices with Node](05-Microservices-with-Node.md) | Advanced | Two Express services communicating via Redis pub/sub |

## How to Use These Projects

1. Read the **Requirements** section to understand what you're building and why.
2. Recreate the **Folder Structure** exactly — file layout matters for `require`/`import` paths.
3. Copy each code block into the file named in its subheading.
4. Follow **How to Run** to install dependencies and start the app.
5. Read **Design Notes** to understand the reasoning behind key decisions.
6. Try the **Possible Extensions** to go beyond the base project.

## Prerequisites

- Node.js 18+ and npm installed (`node -v`, `npm -v`)
- Projects 2 and 3 require a local or Atlas MongoDB connection string
- Project 5 requires a local Redis server (or Docker: `docker run -p 6379:6379 redis`)
