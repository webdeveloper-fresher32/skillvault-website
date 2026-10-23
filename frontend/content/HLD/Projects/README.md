# Projects — Evolving Instagram-like Backend

Every other course in this repo ships several small, independent projects. HLD does something different: **one backend, built incrementally, across ten stage files.** The reason is deliberate — high-level design isn't a collection of isolated tricks, it's a series of decisions layered on top of each other as a system grows. A JWT you add in Stage 2 is still there in Stage 9. A database index you add in Stage 3 is still paying off when you put the app behind a load balancer in Stage 7.

Think of this as a simplified Instagram clone: users can sign up, log in, create posts (a caption + an image), and like posts. That's it — the feature set stays small on purpose so the *architecture* is what changes from stage to stage, not the product.

Each stage file:
- States what it adds and, critically, **why now** — linking back to the HLD phase lesson that just taught you the concept.
- Gives you the complete, copy-pasteable code for that stage (not a diff-only fragment — full files you can drop in and run).
- Gives you the exact `pip install` / run commands.
- Gives you a `curl` (or `docker`) command to verify the new behavior actually works.

You do not need to keep every stage's code around in a separate folder — each stage's `main.py` supersedes the previous one. If you want to preserve history as you go, commit after each stage in your own scratch repo (`git init` in a project folder and commit stage by stage).

## How to Use This Track

Read the matching HLD phase lesson first, then build the stage. The Phase lesson teaches you *why* the concept exists in general; the stage file shows you *where it lands* in a real, running codebase.

## Stage Map

| # | File | Adds | Pairs With Phase |
|---|---|---|---|
| 1 | `01-Basic-FastAPI-Backend.md` | Skeleton API — in-memory users/posts, no auth, no DB | Phase 01 (Foundations) |
| 2 | `02-JWT-Authentication.md` | Signup/login, JWT-protected `POST /posts` | Phase 08 Lesson 03 (JWT Authentication) |
| 3 | `03-Database-Schema-with-SQLAlchemy.md` | Postgres persistence via SQLAlchemy, indexed email | Phase 05 Lesson 01 (Indexing) |
| 4 | `04-Redis-Caching.md` | Cache-aside caching for the feed read | Phase 06 Lesson 01 (Cache-Aside Pattern) |
| 5 | `05-Celery-Background-Jobs.md` | Async thumbnail generation off the request path | Phase 07 Lesson 02 (Celery Task Queues) |
| 6 | `06-Object-Storage-for-Media.md` | Images move from disk to S3-compatible (MinIO) storage | Phase 08 Lesson 01 (Object Storage) |
| 7 | `07-Scaling-Behind-a-Load-Balancer.md` | Two app instances behind Nginx | Phase 04 Lesson 03 (Nginx/HAProxy/ALB) |
| 8 | `08-Splitting-into-Microservices.md` | Carve out an Auth Service and a Post Service | Phase 02 Lesson 02 (Microservices Architecture) |
| 9 | `09-Containerizing-with-Docker.md` | Dockerfile per service + docker-compose for the whole stack | (ties everything together) |
| 10 | `10-Scaling-Discussion-Millions-of-Users.md` | No new code — a written discussion of what breaks at 10x/100x scale | Phase 05, Phase 12 |

## Running Any Stage

Every stage after Stage 1 assumes you already have the previous stage's code in front of you (same project folder, same `main.py` being edited in place, unless a stage explicitly says otherwise — e.g. Stage 8 splits `main.py` into two apps). A typical stage's workflow is:

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install <stage's requirements>
uvicorn main:app --reload
```

Then run the stage's `curl` verification in a second terminal.

## Prerequisites

- Python 3.10+ installed locally.
- Comfortable with the command line (running `pip install`, `curl`, `docker`).
- Phases 01–09 read at least once — the stages assume you've seen the concepts already; they don't re-teach them.
