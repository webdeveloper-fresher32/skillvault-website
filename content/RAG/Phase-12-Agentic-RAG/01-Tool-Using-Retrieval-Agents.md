# 01 — Tool-Using Retrieval Agents

> How giving an LLM a retriever as one tool among several — instead of hard-wiring "always retrieve" — turns a RAG pipeline into an agent that decides when retrieval is actually needed.

---

## Table of Contents

1. [The Problem: Retrieval Isn't Always the Right Move](#1-the-problem-retrieval-isnt-always-the-right-move)
2. [The Analogy: A Smart Assistant vs. a Reflexive Clerk](#2-the-analogy-a-smart-assistant-vs-a-reflexive-clerk)
3. [Internal Flow: The Agent Loop](#3-internal-flow-the-agent-loop)
4. [Code Example: Defining and Calling a Retrieval Tool](#4-code-example-defining-and-calling-a-retrieval-tool)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Retrieval Isn't Always the Right Move

Every RAG system from Phase 1 through Phase 11 shares one assumption baked into the pipeline: a question comes in, and the system *always* retrieves. Retrieve, augment, generate — no branch, no decision point. That assumption quietly breaks in two distinct ways once you put a RAG system in front of real users.

**1.1 Some questions don't need retrieval at all.** Ask a plain RAG system "what's 2 + 2?" or "rewrite this sentence to be more formal" and it will dutifully embed the question, search the vector store, retrieve the top-k nearest chunks (which are about *something*, just not this), and stuff them into the prompt anyway. Best case, the irrelevant context is ignored and the answer is still right, but you paid for an unnecessary embedding call and a vector search, and burned context-window space on noise. Worst case (Phase 1's Misconception 3), the irrelevant chunks actively confuse the model into a wrong answer.

**1.2 Some questions need a *different* capability, not your retriever.** "What's the exchange rate right now?" needs a live web lookup, not your static document store. "What's 847 × 392?" needs a calculator, not semantic search over a knowledge base — LLMs are notoriously unreliable at exact multi-digit arithmetic from pure pattern matching. A fixed pipeline that only knows how to call one retriever has no way to reach for the tool the question actually requires.

Put together, the core problem this lesson solves: **a plain RAG pipeline treats retrieval as a mandatory, unconditional step. What you actually want is a system that looks at the query first and decides — retrieve, don't retrieve, or use some other tool entirely.**

---

## 2. The Analogy: A Smart Assistant vs. a Reflexive Clerk

**Real-world analogy:** picture two different people staffing a reference desk.

The **reflexive clerk** has exactly one move: no matter what you ask, they walk to the same shelf, pull the same reference book, and hand it to you. Ask them a simple arithmetic question and they still walk to the shelf. Ask them something the book doesn't cover and they still hand you that book — it's the only motion they know.

The **smart assistant** listens to your question first. If it's simple enough to answer from what they already know, they just answer it — no trip to the shelves. If it needs a fact from a specific reference book, they go get *that* book, not just whichever one is nearest. If it needs something the reference books don't have — today's weather, a phone number, a calculation — they reach for a different resource entirely: a phone, a calculator, the internet.

A plain RAG pipeline is the reflexive clerk: retrieve is the only motion it knows, applied identically to every query. **Agentic RAG turns the LLM into the smart assistant** — handed a menu of resources (a retriever, a calculator, a web search) and trusted to decide, per question, whether it needs one of them, which one, and whether it needs to go back for a second look before answering.

> 🧠 One-sentence version for a non-technical audience: *"Instead of a clerk who always fetches the same shelf, we hand the assistant a whole reference desk and let it decide what to reach for."*

---

## 3. Internal Flow: The Agent Loop

Tool-using retrieval is built on the same **agent loop** pattern used by any LLM tool-calling system, with your retriever registered as one of the tools:

```
                     ┌─────────────────────────────────────────┐
                     │  1. LLM receives: user query +           │
                     │     a list of available tools            │
                     │     (retrieve_documents, calculator,      │
                     │      web_search, ...)                     │
                     └───────────────────┬───────────────────────┘
                                         ▼
                     ┌─────────────────────────────────────────┐
                     │  2. LLM decides: answer directly,         │
                     │     OR call one (or more) tools           │
                     └───────────────────┬───────────────────────┘
                                         │
                         no tool needed  │  tool_use requested
                    ┌────────────────────┘────────────────────┐
                    ▼                                          ▼
         ┌────────────────────┐                  ┌───────────────────────────┐
         │ 5. LLM answers      │                  │ 3. Your code executes the │
         │    directly          │                  │    requested tool(s)      │
         └────────────────────┘                  │    (e.g. run the vector   │
                    ▲                              │    search)                │
                    │                              └─────────────┬─────────────┘
                    │                                             ▼
                    │                              ┌───────────────────────────┐
                    │                              │ 4. Tool result(s) sent     │
                    └──────────────────────────────│    back to the LLM        │
                     LLM decides again: answer, or  └───────────────────────────┘
                     call another tool
```

The key structural difference from a plain RAG pipeline: **step 2 is a real decision, made by the model, every single time** — not a hard-coded branch in your application code. The LLM sees the query and the tool menu together and picks a path. If it picks "answer directly," no embedding call, no vector search, no wasted retrieval ever happens. If it picks "call `retrieve_documents`," you're back in familiar Phase 8/9 territory — you run the actual similarity search and hand the chunks back. If the model isn't satisfied with what it retrieved, it can loop back to step 2 and call another tool (or the same one with a refined query) before finally answering.

---

## 4. Code Example: Defining and Calling a Retrieval Tool

The mechanism behind "the LLM decides to call a tool" is Anthropic's tool use (function calling) feature on the Claude API. You describe your tools with a JSON Schema, hand them to the model alongside the conversation, and the model's response tells you whether it wants to invoke one.

**Step 1 — define the retrieval tool.** The `description` field is doing real work here: it's the only information the model has about *when* to reach for this tool, so be explicit about what it searches and when it's appropriate.

```python
import anthropic

client = anthropic.Anthropic()

# A previously-populated Chroma collection, as built in Phase 5 —
# never query a collection you haven't added documents to.
import chromadb
chroma_client = chromadb.PersistentClient(path="./chroma_data")
support_kb = chroma_client.get_or_create_collection(name="support_kb")

def retrieve_documents(query: str, top_k: int = 3) -> str:
    """The actual retrieval logic — plain Chroma similarity search,
    same as Phase 5-9. This is what runs when the model asks for the tool."""
    results = support_kb.query(query_texts=[query], n_results=top_k)
    # results["documents"] is a list of lists (one list per query text);
    # we only sent one query, so take index 0.
    chunks = results["documents"][0]
    return "\n\n".join(chunks) if chunks else "No relevant documents found."

# The tool DEFINITION the model sees — name, description, and a JSON Schema
# for the input. "input_schema" is the real field name in the Anthropic API
# (not "parameters", which some other providers use).
tools = [
    {
        "name": "retrieve_documents",
        "description": (
            "Search the company's internal knowledge base (support articles, "
            "policies, product docs) for passages relevant to a query. Use this "
            "whenever the user's question depends on company-specific or private "
            "information that would not be known from general knowledge. Do not "
            "use this for general knowledge questions, arithmetic, or casual "
            "conversation — answer those directly instead."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to look up in the knowledge base.",
                },
                "top_k": {
                    "type": "integer",
                    "description": "How many passages to retrieve. Defaults to 3.",
                },
            },
            "required": ["query"],
        },
    }
]
```

**Step 2 — send the query and let the model decide.** Notice there are two example queries: one that should trigger the tool, and one that shouldn't.

```python
def ask(user_question: str) -> str:
    messages = [{"role": "user", "content": user_question}]

    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        tools=tools,
        messages=messages,
    )

    # stop_reason tells you WHY the model stopped generating. When it's
    # "tool_use", the model wants to call one or more of the tools you gave it
    # before it's willing to produce a final answer.
    if response.stop_reason == "tool_use":
        # response.content is a list of content blocks. A tool-use turn can mix
        # a "text" block (the model's reasoning, e.g. "Let me check the docs")
        # with one or more "tool_use" blocks (the actual tool call requests).
        tool_use_block = next(
            block for block in response.content if block.type == "tool_use"
        )

        # .name is the tool the model chose; .input is a dict matching the
        # input_schema you declared — already parsed, not a raw string.
        if tool_use_block.name == "retrieve_documents":
            result_text = retrieve_documents(**tool_use_block.input)
        else:
            result_text = f"Unknown tool: {tool_use_block.name}"

        # To continue the conversation, echo the assistant's turn back
        # (including the tool_use block) and then add a user turn containing
        # a tool_result block that references the tool_use_id.
        messages.append({"role": "assistant", "content": response.content})
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": tool_use_block.id,
                    "content": result_text,
                }
            ],
        })

        # Second call: the model now has the retrieved context and generates
        # its final answer. (In a fuller agent loop you'd check stop_reason
        # again here in case the model wants to call another tool.)
        follow_up = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=1024,
            tools=tools,
            messages=messages,
        )
        return next(b.text for b in follow_up.content if b.type == "text")

    # stop_reason == "end_turn": the model answered directly, no tool needed.
    return next(b.text for b in response.content if b.type == "text")


print(ask("What's our refund policy for opened items?"))
# -> stop_reason "tool_use": the model calls retrieve_documents, gets the
#    relevant policy chunk back, and answers grounded in it.

print(ask("What is 12 * 8?"))
# -> stop_reason "end_turn": the model answers directly from its own
#    arithmetic ability — no retrieval call happens at all.
```

The second call is the entire point of this lesson: **the same code path, with the same tool available, produces zero retrieval calls for a question that doesn't need one.** That's the behavior a fixed retrieve-augment-generate pipeline structurally cannot express.

---

## 5. Common Mistakes

**Mistake 1: Giving the agent too many overlapping tools.** It's tempting to register a `search_docs` tool, a `search_faq` tool, and a `search_knowledge_base` tool that all do essentially the same thing over slightly different data. The model has no reliable way to distinguish "search FAQ" from "search knowledge base" from a query alone, and you get inconsistent, sometimes indecisive tool selection — the model calling the wrong one, calling both, or hedging by calling neither. Keep the tool surface small and each tool's *purpose* clearly distinct; if two tools search overlapping content, merge them into one tool with a parameter (e.g. `source: "faq" | "docs"`) instead of two separate tool definitions.

**Mistake 2: No maximum iteration limit.** The loop in Section 3 can, in principle, call a tool, get a result, decide it's not satisfied, call another tool, and keep going. Without an explicit cap on how many times you'll let the model call a tool before forcing a final answer, a model that gets stuck in an unproductive pattern (repeatedly re-querying with minor variations) can loop indefinitely — burning tokens and money with no guarantee of ever terminating. Always track an iteration count in your loop and force a stop (or a "give your best answer with what you have" instruction) once you hit a small fixed limit, e.g. 5.

**Interview angle:** A common interview probe here is "what happens if the agent never stops calling tools?" — the answer they're listening for is exactly the max-iteration mistake above: name the failure mode (unbounded loop, runaway cost), and name the fix (a hard iteration cap enforced in your own orchestration code, not left to the model to self-regulate). A second common follow-up is "how do you decide what tools to expose?" — the answer is to keep tool responsibilities non-overlapping and to write descriptions that are prescriptive about *when* to call the tool, not just what it does, since the model relies entirely on that description to make the right call.

---

## 6. Hands-On Exercises

### Exercise 1 — Trace the tool-use round trip by hand

**Goal:** Build an accurate mental model of the two-request shape before writing more code.

Using the `ask()` function above, call it with a question that clearly needs retrieval (e.g. `"What's the warranty period on our products?"`). Add `print()` statements to show: the `stop_reason` of the first response, the `tool_use_block.name` and `.input` the model chose, and the `stop_reason` of the follow-up response. Confirm for yourself that exactly two API calls happened, and that the second call's `messages` list contains four entries (user question, assistant tool-use turn, user tool-result turn, and — after the response — none yet since that's the return value).

### Exercise 2 — Add a second tool and watch the model choose between them

**Goal:** Practice tool-selection behavior with more than one option on the menu.

Add a second tool, `calculator`, with an `input_schema` taking `expression: string`, and a Python implementation that safely evaluates simple arithmetic (do not use bare `eval()` on unsanitized input — parse and compute manually, or use a restricted expression evaluator). Update `ask()`'s tool-dispatch logic to route to whichever tool the model names. Test with three questions: one that should trigger `retrieve_documents`, one that should trigger `calculator`, and one that should trigger neither. Confirm the model picks correctly all three times.

### Exercise 3 — Diagnose indecisive tool selection

**Goal:** Practice recognizing the overlapping-tools failure mode from Common Mistakes.

Add a third tool that overlaps heavily with `retrieve_documents` — e.g. `search_faq`, described as "Search the FAQ for answers," pointed at the *same* underlying `support_kb` collection. Run several similar support questions through `ask()` and observe whether the model consistently picks the same tool or starts to waver between the two. Write down, in your own words, why this happens (the description gives the model no reliable signal to distinguish the two) and what you'd change to fix it (merge into one tool, or make the descriptions genuinely non-overlapping).

---

## 7. Interview Q&A

### Q1. Why can't a plain RAG pipeline just always retrieve, even for questions that don't need it?

**Answer:** It technically can, but it wastes an embedding call and a vector search on every query, and — per Phase 1's caution against "more context is always better" — irrelevant retrieved chunks can actively confuse the model rather than just being ignored. Agentic RAG fixes this by giving an LLM the retriever as one tool among several and letting the model itself decide, per query, whether retrieval is actually needed before calling it.

---

### Q2. Walk me through what happens, end to end, when a tool-using agent decides to call a retrieval tool.

**Answer:** The LLM receives the user's query plus a list of tool definitions (name, description, JSON Schema input). If it decides retrieval is needed, the response comes back with `stop_reason: "tool_use"` and a `tool_use` content block naming the tool and giving parsed input arguments. Your application code executes the actual retrieval (the vector search), then sends the result back as a `tool_result` block in a new user turn, referencing the original `tool_use_id`. The model then either answers using that result or, in a fuller loop, decides to call another tool.

---

### Q3. What's the risk of giving an agent too many similar tools?

**Answer:** The model has to choose between tools based only on their names and descriptions. If two or more tools overlap in what they search or do, the model has no reliable signal to distinguish them and becomes indecisive — sometimes picking the wrong one, sometimes calling multiple redundant tools, sometimes hedging. The fix is to keep the tool surface small with clearly distinct responsibilities, merging near-duplicate tools into one tool with a parameter rather than registering several overlapping ones.

---

### Q4. How do you prevent a tool-using agent from looping forever?

**Answer:** By enforcing a maximum number of tool-call iterations in your own orchestration code — for example, capping the loop at 5 rounds and forcing the model to produce a final answer with whatever it has once the cap is hit. This should never be left purely to the model's judgment; the model deciding "I have enough information" is a useful signal to *stop early*, but a hard cap is the safety net for when that judgment fails.

---

### Q5. Is agentic RAG the same thing as RAG?

**Answer:** No — agentic RAG is RAG plus a decision layer. Plain RAG (Phase 1) always executes retrieve → augment → generate unconditionally. Agentic RAG wraps that same retrieval capability as one tool the model can choose to call or not, alongside other tools it might need instead (a calculator, a web search). The retrieval mechanics underneath (Phases 5-9) are unchanged; what's new is that an LLM, not your application's control flow, decides whether and when they run.

---

> 🧠 **Memory hook:** "Don't hand the clerk one shelf to always fetch — hand the assistant the whole reference desk and let it decide what the question actually needs."
