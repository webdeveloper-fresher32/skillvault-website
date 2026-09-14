# Project 04 — Pub/Sub Chat Backend

## Goal

Build a simple multi-room chat message relay where clients publish messages to a room-named channel and every other client subscribed to that room receives them live, with no polling.

## What You'll Build

A small Python-based chat relay using `redis-py`'s Pub/Sub support: a "publisher" script that sends chat messages to a named room/channel, and a "subscriber" script that listens to one or more rooms and prints incoming messages as they arrive.

## Phases Required

- Phase 9 — Pub/Sub and Messaging

## Requirements

- Each chat room maps to its own Redis Pub/Sub channel (e.g. `chat:general`, `chat:random`).
- A publishing script/function that sends a message (including at least a sender name and message text) to a given room's channel via `PUBLISH`.
- A subscribing script/function that joins one or more rooms via `SUBSCRIBE` (or `PSUBSCRIBE` for a room-name pattern) and prints each incoming message as it's received, including which room it came from.
- Running the subscriber in one terminal and the publisher in another must show messages appearing in the subscriber's terminal instantly, with no delay from polling.
- Demonstrate that a subscriber only receives messages published to rooms it's actually subscribed to — a message published to a different room must not appear.
- Explicitly demonstrate (and note in a comment or short write-up) that a subscriber which wasn't running at the time a message was published never receives it — there is no history or replay.

## Suggested Approach

1. Decide on a channel naming convention for rooms (e.g. `chat:<room_name>`) and whether to support joining multiple rooms at once via multiple `SUBSCRIBE` arguments or a single `PSUBSCRIBE chat:*`.
2. Write the subscriber first: create a `pubsub()` object, subscribe to one or more room channels, and loop over `listen()`, printing each message's channel and content — remember the first item yielded by `listen()` is the subscription confirmation itself, not a chat message, so filter on the message `type` field.
3. Write the publisher as a simple function or CLI loop that takes a room name, a sender name, and message text, and calls `PUBLISH` on the corresponding channel — consider a lightweight text format (e.g. `"alice: hello everyone"`) or JSON if you want structured fields.
4. Run one subscriber and one publisher in separate terminals/processes and confirm live delivery end to end before adding multi-room support.
5. Add a second room and confirm a subscriber joined to only one room doesn't see messages published to the other; then confirm a subscriber using `PSUBSCRIBE chat:*` sees messages from every room.
6. Deliberately stop the subscriber, publish a message from the publisher, then restart the subscriber — confirm the message sent while it was down is simply gone, reinforcing Pub/Sub's at-most-once, no-replay delivery model.

## Stretch Goals

- Add a "user joined/left room" system message published automatically whenever a subscriber starts or stops listening to a room.
- Build a minimal multi-subscriber demo (two separate subscriber processes in the same room) and confirm both receive every message independently — Pub/Sub delivers to every subscriber, not just one.
- Note (in a short write-up, not code) what would need to change if messages had to survive a subscriber being briefly offline, and connect that back to Redis Streams with consumer groups from Phase 9's second lesson.

## Evaluation Checklist

- [ ] A message published to a room appears instantly in every subscriber currently listening to that room.
- [ ] A subscriber listening to a different room never receives a message published elsewhere.
- [ ] A subscriber that wasn't running when a message was published does not receive it after starting — no replay.
- [ ] The relay correctly distinguishes the initial subscription-confirmation message from actual chat messages when processing `listen()` output.
- [ ] At least two independent rooms are demonstrated working correctly and independently of each other.
