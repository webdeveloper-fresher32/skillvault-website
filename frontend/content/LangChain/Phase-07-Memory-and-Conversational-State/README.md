# Phase 7: Memory and Conversational State

## What You'll Learn

Manage conversational state across multi-turn sessions using `ChatMessageHistory` and `RunnableWithMessageHistory`, persist session state to Redis and SQL backends, and compress long conversation histories using token-windowing and background summarization.

## Learning Objectives

- Implement modern session-based memory using `RunnableWithMessageHistory` and `BaseChatMessageHistory`.
- Connect persistent state backends using `RedisChatMessageHistory` and `SQLChatMessageHistory` with session ID partitioning.
- Apply memory compression techniques: sliding token windows, message pruning, and summary-based memory reduction.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-ChatMessageHistory-and-Runnables.md](01-ChatMessageHistory-and-Runnables.md) | ChatMessageHistory, RunnableWithMessageHistory, session factories, session_id routing | 1 day |
| [02-Persistent-Session-Stores-Redis-SQL.md](02-Persistent-Session-Stores-Redis-SQL.md) | RedisChatMessageHistory, SQLChatMessageHistory, TTL expiration, production multi-user scaling | 1 day |
| [03-Token-Windowing-and-Summarization.md](03-Token-Windowing-and-Summarization.md) | Token windowing, trim_messages, conversation summary chains, memory budgeting | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 8: Streaming, Async, and Callbacks](../Phase-08-Streaming-Async-and-Callbacks/README.md)
