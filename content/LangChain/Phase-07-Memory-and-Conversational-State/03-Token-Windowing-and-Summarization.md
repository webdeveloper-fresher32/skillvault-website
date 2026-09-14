# Token Windowing and Summarization — Complete Guide

> "An executive assistant condenses three hours of chaotic board meeting transcripts into a single one-page executive memo before briefing the CEO."

---

## Table of Contents

1. [The Problem: Unbounded History Exceeds Context Budgets](#1-the-problem-unbounded-history-exceeds-context-budgets)
2. [The Executive Assistant Analogy](#2-the-executive-assistant-analogy)
3. [The Mechanism: trim_messages and Summarization](#3-the-mechanism-trim_messages-and-summarization)
4. [Diagram: Memory Windowing and Compression Pipeline](#4-diagram-memory-windowing-and-compression-pipeline)
5. [Code Walkthrough: Sliding Window and Summary Chain](#5-code-walkthrough-sliding-window-and-summary-chain)
6. [Comparing History Management Strategies](#6-comparing-history-management-strategies)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Unbounded History Exceeds Context Budgets

In long-running conversations, the raw message history grows continuously.

### The Token Blowup

```text
Turn 1: History = 50 tokens ($0.0002)
Turn 20: History = 4,000 tokens ($0.016)
Turn 100: History = 35,000 tokens ($0.14 per single prompt!)
Turn 300: History exceeds model context limit (ContextWindowExceededError!)
```

### The Solution: Windowing and Summarization

LangChain provides `trim_messages` to maintain a strict token budget and summarization chains to condense older turns into high-level semantic state.

---

## 2. The Executive Assistant Analogy

A CEO heading into a quarterly review does not read 4,000 unedited Slack messages exchanged over the past six months.

### Raw Chat Dumps vs Executive Brief

```text
Raw Chat Dump    → 400 pages of "Sounds good", "See you at 2", "Let me check";
                   CEO misses critical business numbers buried on page 219.

Executive Brief  → Assistant summarizes months 1-5 into a 3-bullet paragraph;
                   attaches only the 5 most recent actionable messages verbatim.
```

### Mapping to LangChain

Older messages are compressed into a summary string injected into the `SystemMessage`; the most recent $N$ tokens are kept intact via `trim_messages`.

---

## 3. The Mechanism: trim_messages and Summarization

LangChain provides message manipulation utilities in `langchain_core.messages`.

### Core Trimming Primitives

```python
from langchain_core.messages import trim_messages, SystemMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")

# 1. Configure token trimmer
trimmer = trim_messages(
    max_tokens=500,
    strategy="last",               # Keep the most recent messages
    token_counter=llm,             # Use LLM tokenizer to count tokens accurately
    include_system=True,           # Never prune the system message
    allow_partial=False,           # Do not slice individual messages in half
    start_on="human"               # Ensure history starts with a user message
)

# 2. Trim raw message list before prompt insertion
messages = [
    SystemMessage("You are an expert tutor."),
    HumanMessage("Explain Docker."),
    AIMessage("Docker is a containerization platform."),
    HumanMessage("Explain Kubernetes.")
]
trimmed = trimmer.invoke(messages)
```

---

## 4. Diagram: Memory Windowing and Compression Pipeline

### Sliding Window & Summarization Flow

```text
Full Conversation History (30+ turns, 8000 tokens)
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Token Budget Check (Threshold = 2000 tokens)             │
│    Is total history length > max_tokens?                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │ (Yes)                     │ (No)
          ▼                           ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ 2. History Compression       │ │ Pass Full History Intact   │
│    - Older Turns (1 to 20):  │ └────────────────────────────┘
│      Sent to Summarizer LLM  │
│      Produces: "Summary..."  │
│    - Recent Turns (21 to 30):│
│      Kept verbatim in window │
└──────────────┬───────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Formatted Prompt Execution                               │
│    System: "System instructions. Prior summary: {summary}"  │
│    Messages: [Recent Turn 28, Turn 29, Turn 30]             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Sliding Window and Summary Chain

A complete pipeline incorporating message trimming directly into an LCEL runnable:

```python
# memory_trimming_demo.py
from langchain_core.messages import trim_messages, SystemMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI

def build_budgeted_chat_pipeline():
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    # 1. Trimmer runnable
    trimmer = trim_messages(
        max_tokens=250,
        strategy="last",
        token_counter=llm,
        include_system=True,
        allow_partial=False,
        start_on="human"
    )

    # 2. Prompt with history placeholder
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an AI assistant. Answer queries concisely."),
        MessagesPlaceholder(variable_name="messages")
    ])

    # 3. LCEL Chain with dynamic trimming pre-processor
    chain = (
        RunnablePassthrough.assign(messages=lambda x: trimmer.invoke(x["messages"]))
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain

if __name__ == "__main__":
    chain = build_budgeted_chat_pipeline()
    chat_log = [
        SystemMessage("You are an AI assistant."),
        HumanMessage("My favorite color is emerald green."),
        AIMessage("I have noted that your favorite color is emerald green."),
        HumanMessage("What is the speed of light?"),
        AIMessage("The speed of light in vacuum is approx 299,792 km/s."),
        HumanMessage("What is my favorite color?")
    ]
    response = chain.invoke({"messages": chat_log})
    print("Response:", response)
```

---

## 6. Comparing History Management Strategies

| Strategy | LangChain Implementation | Token Cost | Information Retention | Latency Overhead |
|---|---|---|---|---|
| Full Buffer | `ChatMessageHistory` | Unbounded ($O(N)$ growth) | 100% exact verbatim | Zero |
| Sliding Window | `trim_messages(max_tokens=N)` | Fixed / Capped | Discards older turns entirely | Zero (Pure token slicing) |
| Incremental Summary | `ConversationSummaryMemory` | Low & Stable | High-level concepts retained | 1 extra LLM summarization call |
| Hybrid Summary + Window | Summary in System + Recent Turns | Optimal | Retains macro context & recent nuances | Periodic background LLM call |

---

## 7. Common Mistakes

- **Cutting off tool calls during message trimming.** Trimming a history between an `AIMessage(tool_calls=...)` and its `ToolMessage` causes API 400 validation errors; ensure tool calls and outputs are trimmed together.
- **Using naive character counting.** 1,000 characters is not equal to 1,000 tokens; pass `token_counter=model` to count tokens via model tokenizers.
- **Starting trimmed history on an `AIMessage`.** Most chat APIs require the first message after the system prompt to be a user message; set `start_on="human"`.
- **Accidentally trimming the `SystemMessage`.** Always set `include_system=True` so core safety guidelines and instructions are never purged.
- **Synchronous summarization on every turn.** Running an LLM summarizer synchronously on every single user message doubles perceived latency; summarize asynchronously in the background.

---

## 8. Hands-On Exercises

**Exercise 1:** Use `trim_messages` with `max_tokens=50` to trim a 10-message conversation and verify that only the most recent turns remain.

**Exercise 2:** Configure `trim_messages` with `start_on="human"` and `include_system=True` and verify that the system message is preserved.

**Exercise 3:** Implement an async background task that generates a 3-sentence summary of a conversation when message count exceeds 10 turns.

**Exercise 4:** Build an LCEL chain that injects a summary string into the system prompt alongside a trimmed list of recent messages.

**Exercise 5:** Test a long conversation of 25 turns against an active `trim_messages` pipeline and assert that total input tokens stay below 500.

---

## 9. Interview Q&A

**Q: Why is naive sliding window memory (e.g. keeping only the last 5 messages) problematic for complex tasks?**
Because early turns often contain crucial user preferences, constraints, or goals (e.g. "I am allergic to peanuts"). If those turns fall out of the sliding window, the model loses that context and makes incorrect recommendations.

**Q: How does `trim_messages` in modern LangChain ensure API schema compliance?**
`trim_messages` provides parameters like `start_on="human"` (ensuring the prompt does not start with an assistant message) and `allow_partial=False` (ensuring individual messages or tool-call pairs are not sliced in half), preventing API validation errors.

**Q: What is the hybrid memory approach (Summary + Window)?**
The hybrid approach compresses older conversation history into a concise semantic summary injected into the system prompt, while keeping the most recent $K$ messages verbatim in the messages placeholder, balancing macro-context with immediate nuance.

**Q: Why should `token_counter` be passed to `trim_messages` instead of using Python's `len()`?**
Because LLM context limits and billing are based on BPE tokens, not raw character counts. Using `len()` can severely underestimate token counts for code, JSON, or non-Latin languages, causing context overflow.

**Q: How does background asynchronous summarization prevent latency degradation?**
Instead of blocking the user's chat response while generating a summary, a background worker triggers the summarization LLM call out-of-band, updating the stored summary cache for subsequent turns without impacting response latency.
