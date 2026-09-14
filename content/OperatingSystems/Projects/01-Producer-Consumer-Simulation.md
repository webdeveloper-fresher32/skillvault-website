# Project 1 — Producer-Consumer Simulation

**Level:** Beginner
**Time estimate:** 30 – 45 minutes
**Phase prerequisite:** Phase 04 – Process Synchronization

---

## Requirements / What You're Building

The producer-consumer problem is the classic synchronization exercise: one or more **producer** threads generate items and put them into a shared, fixed-size buffer; one or more **consumer** threads take items out and process them. Two things must never happen:

- A producer writes into a buffer that is already full (buffer overflow).
- A consumer reads from a buffer that is empty (buffer underflow / reading garbage).

You will build this two ways in the same file:

1. **Using `queue.Queue`** — Python's standard thread-safe bounded queue, which already implements the wait/signal logic internally. This shows what "correct" looks like with the right tool.
2. **Using raw `threading.Semaphore` + `threading.Lock`** — implementing the classic textbook solution by hand (empty/full counting semaphores + a mutex), so you can see exactly what `Queue` is doing for you under the hood.

---

## Complete Runnable Python Code

Save this as `producer_consumer.py`.

```python
"""
Producer-Consumer Simulation
=============================
Demonstrates the classic bounded-buffer problem two ways:
  1. High-level: queue.Queue (thread-safe, blocking, bounded)
  2. Low-level:  threading.Semaphore + threading.Lock (textbook solution)

Run: python3 producer_consumer.py
"""

import threading
import queue
import time
import random

BUFFER_SIZE = 5
NUM_ITEMS = 12


# ---------------------------------------------------------------------------
# Part 1: High-level solution using queue.Queue
# ---------------------------------------------------------------------------

def producer_queue(q: "queue.Queue[int]", producer_id: int, count: int):
    for i in range(count):
        item = i
        time.sleep(random.uniform(0.01, 0.05))  # simulate work to produce
        q.put(item)  # blocks automatically if the queue is full
        print(f"[Queue] Producer-{producer_id} produced item {item} "
              f"(buffer size ~{q.qsize()})")
    print(f"[Queue] Producer-{producer_id} finished.")


def consumer_queue(q: "queue.Queue[int]", consumer_id: int):
    while True:
        item = q.get()  # blocks automatically if the queue is empty
        if item is None:  # sentinel value: time to stop
            q.task_done()
            break
        time.sleep(random.uniform(0.01, 0.06))  # simulate work to consume
        print(f"[Queue]                Consumer-{consumer_id} consumed item {item}")
        q.task_done()


def run_queue_based_demo():
    print("=" * 70)
    print("PART 1: queue.Queue based producer-consumer (bounded buffer=5)")
    print("=" * 70)

    q: "queue.Queue[int]" = queue.Queue(maxsize=BUFFER_SIZE)

    producer = threading.Thread(target=producer_queue, args=(q, 1, NUM_ITEMS))
    consumers = [
        threading.Thread(target=consumer_queue, args=(q, cid))
        for cid in (1, 2)
    ]

    producer.start()
    for c in consumers:
        c.start()

    producer.join()

    # Send one sentinel per consumer so each one exits cleanly.
    for _ in consumers:
        q.put(None)

    for c in consumers:
        c.join()

    print("All queue-based producer/consumer threads finished.\n")


# ---------------------------------------------------------------------------
# Part 2: Low-level solution using semaphores + a mutex (textbook version)
# ---------------------------------------------------------------------------

class BoundedBuffer:
    """A hand-rolled bounded buffer using counting semaphores + a mutex.

    empty_slots: counts how many free slots remain (starts at BUFFER_SIZE)
    full_slots:  counts how many items are available to consume (starts at 0)
    mutex:       protects the shared list itself from concurrent access
    """

    def __init__(self, size: int):
        self.size = size
        self.buffer: list[int] = []
        self.empty_slots = threading.Semaphore(size)
        self.full_slots = threading.Semaphore(0)
        self.mutex = threading.Lock()

    def put(self, item: int):
        self.empty_slots.acquire()   # wait until there's a free slot
        with self.mutex:             # exclusive access to the list
            self.buffer.append(item)
        self.full_slots.release()    # signal: one more item available

    def get(self) -> int:
        self.full_slots.acquire()    # wait until there's an item
        with self.mutex:             # exclusive access to the list
            item = self.buffer.pop(0)
        self.empty_slots.release()   # signal: one more free slot
        return item


def producer_sem(buf: BoundedBuffer, producer_id: int, count: int):
    for i in range(count):
        time.sleep(random.uniform(0.01, 0.05))
        buf.put(i)
        print(f"[Sem]   Producer-{producer_id} produced item {i} "
              f"(buffer len={len(buf.buffer)})")
    print(f"[Sem]   Producer-{producer_id} finished.")


def consumer_sem(buf: BoundedBuffer, consumer_id: int, stop_event: threading.Event,
                  items_expected: int, counter: dict, counter_lock: threading.Lock):
    while True:
        with counter_lock:
            if counter["consumed"] >= items_expected:
                return
        item = buf.get()
        time.sleep(random.uniform(0.01, 0.06))
        with counter_lock:
            counter["consumed"] += 1
        print(f"[Sem]                  Consumer-{consumer_id} consumed item {item}")


def run_semaphore_based_demo():
    print("=" * 70)
    print("PART 2: Semaphore + Lock based producer-consumer (textbook solution)")
    print("=" * 70)

    buf = BoundedBuffer(BUFFER_SIZE)
    stop_event = threading.Event()
    counter = {"consumed": 0}
    counter_lock = threading.Lock()

    producer = threading.Thread(target=producer_sem, args=(buf, 1, NUM_ITEMS))
    consumers = [
        threading.Thread(
            target=consumer_sem,
            args=(buf, cid, stop_event, NUM_ITEMS, counter, counter_lock),
        )
        for cid in (1, 2)
    ]

    producer.start()
    for c in consumers:
        c.start()

    producer.join()
    for c in consumers:
        c.join()

    print("All semaphore-based producer/consumer threads finished.")
    assert len(buf.buffer) == 0, "Buffer should be empty at the end!"
    print(f"Final buffer contents: {buf.buffer} (empty, as expected)\n")


if __name__ == "__main__":
    run_queue_based_demo()
    run_semaphore_based_demo()
```

---

## How to Run

```bash
python3 producer_consumer.py
```

No external dependencies — everything used (`threading`, `queue`, `time`, `random`) is part of the Python standard library.

Because of `random.uniform` delays, the interleaving of producer/consumer log lines will differ slightly on every run — that's expected and is the point (real concurrency has no fixed order).

---

## Sample Output

```
======================================================================
PART 1: queue.Queue based producer-consumer (bounded buffer=5)
======================================================================
[Queue] Producer-1 produced item 0 (buffer size ~1)
[Queue]                Consumer-1 consumed item 0
[Queue] Producer-1 produced item 1 (buffer size ~1)
[Queue]                Consumer-2 consumed item 1
[Queue] Producer-1 produced item 2 (buffer size ~1)
[Queue]                Consumer-1 consumed item 2
...
[Queue] Producer-1 finished.
[Queue]                Consumer-1 consumed item 10
[Queue]                Consumer-2 consumed item 11
All queue-based producer/consumer threads finished.

======================================================================
PART 2: Semaphore + Lock based producer-consumer (textbook solution)
======================================================================
[Sem]   Producer-1 produced item 0 (buffer len=1)
[Sem]                  Consumer-2 consumed item 0
[Sem]   Producer-1 produced item 1 (buffer len=1)
[Sem]                  Consumer-1 consumed item 1
...
[Sem]   Producer-1 finished.
[Sem]                  Consumer-2 consumed item 11
All semaphore-based producer/consumer threads finished.
Final buffer contents: [] (empty, as expected)
```

(Exact interleaving/order will vary run to run — the important invariant is that the buffer never exceeds size 5 and is empty at the end.)

---

## Design Notes

- **Why bounded, not unbounded?** An unbounded buffer removes backpressure — a fast producer could grow memory without limit. Bounding the buffer forces the producer to block (via `empty_slots.acquire()` or `Queue`'s internal condition variable) when consumers can't keep up — this is exactly how OS-level pipes, message queues, and TCP send buffers apply backpressure in real systems.
- **Two semaphores, one mutex** is the textbook (Dijkstra-style) solution: `empty_slots` and `full_slots` are *counting semaphores* that track availability, while `mutex` is a *binary lock* that protects the critical section (the actual list mutation) from being interleaved by two threads at once. Get the ordering wrong (e.g., acquire the mutex before the semaphore) and you can deadlock — try it and see.
- **`queue.Queue` already does all of this for you** — internally it uses a `Condition` variable wrapping a `deque`, which is a cleaner abstraction than raw semaphores for most real code. It's shown second so you can map the low-level primitives back onto what a "batteries included" tool is doing.
- **The sentinel value (`None`)** in Part 1 is a common pattern for telling a consumer "no more work is coming" without needing a separate shutdown signal — the consumer just checks for the sentinel and exits.

---

## Possible Extensions

1. Add multiple producers and observe how items from different producers interleave in the buffer.
2. Introduce a deliberate bug — remove the `mutex` from `BoundedBuffer` — and see how the buffer can get corrupted (list length briefly wrong, `IndexError` on pop) under high contention.
3. Replace the polling-free semaphore solution with a `threading.Condition` (`wait()`/`notify()`) implementation and compare readability.
4. Track and print the maximum buffer occupancy observed during the run to visualize how close producers/consumers came to saturating capacity.
5. Add a "slow consumer" scenario (larger sleep) and watch producers block — print timestamps to prove blocking actually occurred.
