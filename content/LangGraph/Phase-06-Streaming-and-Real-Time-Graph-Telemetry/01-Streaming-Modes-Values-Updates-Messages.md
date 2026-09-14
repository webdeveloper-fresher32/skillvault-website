# Streaming Modes (Values, Updates, and Messages) — Complete Guide

> "A live television sports broadcast delivers instant scoreboard updates (updates), full game recap statistics (values), and play-by-play audio commentary word-by-word (messages)."

---

## Table of Contents

1. [The Problem: Waiting 20 Seconds for Complete Graph Output](#1-the-problem-waiting-20-seconds-for-complete-graph-output)
2. [The Live Sports Broadcast Analogy](#2-the-live-sports-broadcast-analogy)
3. [The Mechanism: The Three Core Stream Modes](#3-the-mechanism-the-three-core-stream-modes)
4. [Diagram: Streaming Modes Output Granularity](#4-diagram-streaming-modes-output-granularity)
5. [Code Walkthrough: Token-by-Token Streaming with stream_mode="messages"](#5-code-walkthrough-token-by-token-streaming-with-stream_modemessages)
6. [Comparing stream_mode Options](#6-comparing-stream_mode-options)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Waiting 20 Seconds for Complete Graph Output

Complex agent graphs run multiple tools, search databases, and generate long answers. Calling `app.invoke()` forces users to stare at a blank screen for 15–30 seconds.

### The Blocking Invocation Experience

```text
User clicks [Submit]: "Write an analysis of global renewable energy trends."
  Seconds 1–5: Planning node running... (Blank screen)
  Seconds 6–10: Web search tool running... (Blank screen)
  Seconds 11–20: Generating 800-word response... (Blank screen)
  Second 21: Full text suddenly pops onto screen.
→ Terrible user experience; users assume the web app crashed!
```

### The Solution: LangGraph Real-Time Streaming

LangGraph provides granular real-time streaming modes (`stream_mode="values"`, `stream_mode="updates"`, and `stream_mode="messages"`).

---

## 2. The Live Sports Broadcast Analogy

A football fan watching a live game does not wait until midnight to read a newspaper summary.

### Delayed Newspaper vs Live TV Broadcast

```text
Newspaper Recap (invoke)    → Reader gets nothing until 6:00 AM the next day (High latency).

Live Broadcast (streaming)  → 1. Scoreboard flashes: "Goal scored!" (stream_mode="updates")
                              2. Full quarter statistics dashboard (stream_mode="values")
                              3. Play-by-play radio commentator speaking word-by-word (stream_mode="messages")
```

### Mapping to LangGraph

`updates` sends node delta events; `values` sends the complete state snapshot; `messages` streams real-time LLM token chunks.

---

## 3. The Mechanism: The Three Core Stream Modes

LangGraph's `.stream()` and `.astream()` accept the `stream_mode` parameter.

### Core Streaming Modes

```python
# 1. stream_mode="values"
# Yields the COMPLETE state dictionary after each node finishes
for state_snapshot in app.stream(inputs, stream_mode="values"):
    print("Full Message Count:", len(state_snapshot["messages"]))

# 2. stream_mode="updates"
# Yields ONLY the partial update emitted by each node: {node_name: {channel: val}}
for node_update in app.stream(inputs, stream_mode="updates"):
    for node_name, update_dict in node_update.items():
        print(f"Node '{node_name}' finished: {update_dict}")

# 3. stream_mode="messages"
# Yields token-by-token AIMessageChunk instances as LLMs generate them!
for msg_chunk, metadata in app.stream(inputs, stream_mode="messages"):
    if msg_chunk.content:
        print(msg_chunk.content, end="", flush=True)
```

---

## 4. Diagram: Streaming Modes Output Granularity

### Granularity Comparison

```text
Graph Execution Flow: [START] ──▶ [search_node] ──▶ [writer_node (LLM)] ──▶ [END]
                                         │                    │
                                         ▼                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ stream_mode="updates"                                                                  │
│ Chunk 1: {"search_node": {"docs": ["Doc A"]}}                                          │
│ Chunk 2: {"writer_node": {"messages": [AIMessage("Global solar capacity...")]}}        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ stream_mode="values"                                                                   │
│ Snapshot 1: {"query": "Solar", "docs": ["Doc A"], "messages": []}                      │
│ Snapshot 2: {"query": "Solar", "docs": ["Doc A"], "messages": [AIMessage(...)]}       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ stream_mode="messages"                                                                 │
│ Stream 1: AIMessageChunk("Global") ──▶ Chunk(" solar") ──▶ Chunk(" capacity") ...      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Token-by-Token Streaming with stream_mode="messages"

A complete async streaming agent delivering real-time tokens to stdout:

```python
# streaming_modes_demo.py
import asyncio
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

@tool
def get_energy_data(region: str) -> str:
    """Fetch regional renewable energy metrics."""
    return f"In 2024, {region} generated 48% of electricity from wind and solar."

model = ChatOpenAI(model="gpt-4o", temperature=0)
checkpointer = MemorySaver()
app = create_react_agent(model, tools=[get_energy_data], checkpointer=checkpointer)

async def stream_live_response(query: str):
    config = {"configurable": {"thread_id": "stream_user_01"}}
    inputs = {"messages": [HumanMessage(content=query)]}

    print(f"User Query: {query}\n--- Live Stream ---")
    # Stream token chunks in real time
    async for chunk, metadata in app.astream(inputs, config=config, stream_mode="messages"):
        # Check node provenance from metadata
        node_source = metadata.get("langgraph_node", "")
        if chunk.content:
            print(chunk.content, end="", flush=True)

    print("\n--- Stream Finished ---")

if __name__ == "__main__":
    asyncio.run(stream_live_response("What is the renewable energy status in Europe?"))
```

---

## 6. Comparing stream_mode Options

| Dimension | `stream_mode="updates"` | `stream_mode="values"` | `stream_mode="messages"` |
|---|---|---|---|
| Granularity | Node Completion | Node Completion | Token-by-Token |
| Payload | `{node: {partial_diff}}` | `{complete_state_dict}` | `(AIMessageChunk, metadata)` |
| Best For | Progress bars, node logs | State synchronization | Chat UI text typing effects |
| Frequency | Once per node | Once per node | Tens of tokens per second |
| Token Overhead | Lowest | Medium | High (requires async processing) |

---

## 7. Common Mistakes

- **Using `stream_mode="values"` expecting token-by-token typing.** `"values"` only emits after a whole node finishes; use `"messages"` for token streaming.
- **Forgetting that `stream_mode="messages"` yields tuples.** Each item yielded in `"messages"` mode is a 2-tuple: `(message_chunk, metadata)`.
- **Mixing synchronous `.stream()` inside async FastAPI handlers.** Always use `async for chunk in app.astream(...)` to avoid blocking the event loop.
- **Ignoring non-content chunks.** `AIMessageChunk` instances may contain `tool_call_chunks` with empty `.content`; check `if chunk.content:` before printing.
- **Not passing `thread_id` when streaming checkpointed graphs.** Checkpointed graphs require a `thread_id` even during streaming.

---

## 8. Hands-On Exercises

**Exercise 1:** Run a 3-node graph with `stream_mode="updates"` and print the name of each node as it finishes.

**Exercise 2:** Run the same graph with `stream_mode="values"` and print the size of the state dictionary after each step.

**Exercise 3:** Use `stream_mode="messages"` with `ChatOpenAI` and stream the LLM response token-by-token.

**Exercise 4:** Extract `metadata["langgraph_node"]` from the `"messages"` stream to identify which agent emitted each token chunk.

**Exercise 5:** Combine multiple stream modes using a list: `app.stream(inputs, stream_mode=["updates", "messages"])`.

---

## 9. Interview Q&A

**Q: What are the three primary `stream_mode` options in LangGraph?**
1. `"updates"`: Emits partial state dictionaries emitted by each node as it completes.
2. `"values"`: Emits the entire, fully merged state dictionary after every node transition.
3. `"messages"`: Emits fine-grained LLM token chunks (`AIMessageChunk`) in real time during model generation.

**Q: What is the structure of the data emitted when `stream_mode="messages"` is used?**
It emits 2-tuples: `(chunk, metadata)`, where `chunk` is an `AIMessageChunk` (or `ToolMessageChunk`) and `metadata` is a dictionary containing execution details like `langgraph_node`, `langgraph_step`, and run IDs.

**Q: Can you stream both node updates and token chunks simultaneously?**
Yes. Passing a list of stream modes (e.g. `stream_mode=["updates", "messages"]`) causes the generator to yield tuples of `(stream_mode, payload)`, allowing frontends to render both progress spinners and live token typing.

**Q: How does `stream_mode="messages"` handle tool calls generated by the LLM?**
Instead of text in `.content`, the `AIMessageChunk` contains tool call fragments in `.tool_call_chunks`, allowing frontends to display "Agent is invoking search tool..." before tool execution begins.

**Q: Why is streaming critical for Time-To-First-Token (TTFT) metrics?**
In long-form LLM generation, waiting for the entire generation takes 10–20 seconds. Streaming yields the first token in ~200–500ms, providing instant visual feedback and vastly superior perceived application responsiveness.
