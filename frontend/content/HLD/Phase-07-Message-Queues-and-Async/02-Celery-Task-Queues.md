# Celery Task Queues

The previous lesson established *why* you'd move the video-compression work off the request path. This lesson makes it concrete: how do you actually enqueue a job in Python, and how does it get picked up and run? The answer, for most Python backends, is **Celery** — a task queue library that wires your FastAPI (or Flask/Django) app to a message broker and a pool of worker processes.

## The Flow

```
FastAPI process                    Broker (Redis/RabbitMQ)              Celery Worker process(es)
     |                                       |                                    |
     |--- process_video.delay() ------------>|                                    |
     |    (serializes task + args,           |                                    |
     |     pushes onto a queue)              |                                    |
     |                                       |<--------- polls for jobs ----------|
     |                                       |---- hands off job ---------------->|
     |<---- returns immediately -------------|                                    |
     |     (response: "Uploading")           |                                    |---> runs compress()
     |                                       |                                    |---> runs thumbnail()
     |                                       |                                    |---> runs send_email()
```

The FastAPI process and the Celery worker process are **separate OS processes**, often on separate machines entirely. They never call each other's Python functions directly — the only thing that passes between them is the broker.

## The Code

The API side just enqueues the task and returns immediately:

```python
from fastapi import FastAPI

app = FastAPI()

@app.post("/upload")
def upload():
    process_video.delay()
    return {"message": "Uploading"}
```

`.delay()` is Celery's shorthand for "serialize this function call and its arguments, push it onto the broker as a message, and don't wait for the result." The endpoint handler returns the moment that message is queued — not when the video is actually done processing.

The worker side defines what actually happens when that task is picked up:

```python
from celery import Celery

celery = Celery("tasks", broker="redis://localhost:6379/0")

@celery.task
def process_video():
    compress()
    thumbnail()
    send_email()
```

Running `celery -A tasks worker --loglevel=info` starts one or more worker processes that connect to the same broker, pull queued `process_video` jobs, and execute the function body — `compress()`, `thumbnail()`, `send_email()` — one after another, entirely separate from the request that triggered it.

## The Broker's Job

The **broker** (commonly Redis or RabbitMQ) is the intermediary that holds queued messages until a worker is free to take them. It's not running your code — it's just a durable, ordered mailbox. Celery supports either:

- **Redis** — simple to run (you likely already have it for caching, per Phase 06), fast, but its queue semantics are simpler and it's less robust about guaranteeing a message is never lost if the broker itself crashes mid-delivery.
- **RabbitMQ** — purpose-built as a message broker, with stronger delivery guarantees (acknowledgments, dead-letter queues) at the cost of being one more piece of infrastructure to operate.

Most side projects and many production systems start with Redis as the broker because it's already in the stack; teams that need stronger delivery guarantees at scale often graduate to RabbitMQ.

## Workers, Concurrency, and Failure Handling

You typically run **multiple worker processes** (or multiple worker machines) consuming from the same queue, so jobs are processed in parallel rather than one at a time — this is horizontal scaling applied to background work, the same idea from Phase 03 applied to workers instead of API servers.

Failure handling is where task queues earn their keep over a bare background thread:

- **Retries** — Celery can automatically retry a failed task (e.g. `@celery.task(bind=True, max_retries=3, default_retry_delay=30)`), which matters because slow tasks often fail for transient reasons (a third-party email API times out, disk is briefly full).
- **Acknowledgment** — a worker only tells the broker "this job is done" after it finishes; if a worker crashes mid-task, the un-acknowledged job goes back on the queue for another worker to pick up.
- **Dead-letter handling** — a task that keeps failing past its retry limit can be routed to a separate queue for manual inspection instead of being silently dropped or retried forever.

## Formal Definition

A **task queue** is infrastructure for scheduling units of work (tasks) to be executed asynchronously by a pool of **worker** processes, decoupled from the process that created the work. **Celery** is the standard Python implementation of this pattern, using a pluggable **message broker** (Redis or RabbitMQ) to pass serialized task calls from producers (your API) to consumers (workers).

## Interview Q&A

**Q: What's the difference between the broker and the worker?**
A: The broker (Redis/RabbitMQ) is just a queue — it stores messages until something consumes them; it doesn't execute any application code. The worker is a separate process running your actual task functions; it pulls messages off the broker and runs the corresponding Python code.

**Q: What happens if a Celery worker crashes while running a task?**
A: If the worker hadn't yet acknowledged the task as complete, the broker considers it undelivered and will redeliver it to another available worker. This is why tasks should ideally be **idempotent** — safe to run more than once — since a crash-and-retry can cause the same task to execute twice.

**Q: How would you scale background processing if the queue keeps growing faster than workers can drain it?**
A: Add more worker processes (horizontal scaling of workers, same principle as adding more API servers behind a load balancer in Phase 04). You can also prioritize by routing different task types to different queues so a flood of low-priority jobs doesn't starve urgent ones.

**Q: Why use `.delay()` instead of just calling `process_video()` directly in the endpoint?**
A: Calling it directly runs the function synchronously, in-process, on the request thread — exactly the blocking behavior this phase is trying to eliminate. `.delay()` sends the call to the broker for a worker to pick up later, so the endpoint returns immediately regardless of how long `process_video` actually takes.

**Q: Redis is already being used for caching in this course — why would it also be a message broker?**
A: They're different Redis *usage patterns* running on the same underlying software: caching uses simple key-value `GET`/`SET`, while acting as a broker means Celery uses Redis's list/queue data structures to hold pending task messages. In a small system, one Redis instance can serve both roles; at larger scale, teams often split them so a burst of queue traffic doesn't degrade cache latency.
