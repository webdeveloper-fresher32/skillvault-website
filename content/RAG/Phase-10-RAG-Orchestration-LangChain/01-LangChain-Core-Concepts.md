# 01 — LangChain Core Concepts

> A comprehensive reference covering why orchestration frameworks exist, LangChain's core abstractions, LCEL chaining with the `|` operator, and the trade-offs of using a framework versus wiring everything by hand.

---

## Table of Contents

1. [The Problem: Manual Wiring Doesn't Scale Across Projects](#1-the-problem-manual-wiring-doesnt-scale-across-projects)
2. [The Analogy: Standardized Plugs and Sockets](#2-the-analogy-standardized-plugs-and-sockets)
3. [LangChain's Core Abstractions](#3-langchains-core-abstractions)
4. [LCEL: The `|` Operator and Runnables](#4-lcel-the--operator-and-runnables)
5. [A Minimal LCEL Chain Example](#5-a-minimal-lcel-chain-example)
6. [Doing It By Hand vs. LangChain](#6-doing-it-by-hand-vs-langchain)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Manual Wiring Doesn't Scale Across Projects

Think back over Phases 2 through 9. To answer one user question with RAG, you had to write code that: called an embedding API directly and got back raw vectors (Phase 2), read and split source documents into chunks with your own splitter logic (Phases 3-4), opened a connection to Chroma, Pinecone, or pgvector using each store's own client library and inserted vectors with its own method names (Phases 5-7), ran a similarity or MMR search against that store using its own query syntax (Phase 8), optionally re-scored the results with a cross-encoder you loaded and called yourself (Phase 9), and finally string-formatted the retrieved chunks into a prompt before making a raw call to the LLM API.

Every one of those steps is straightforward in isolation — and that's exactly why Phases 2-9 taught them by hand: understanding what's actually happening at each stage is the only way to debug it later, tune it, or replace one piece without breaking everything downstream. But now imagine starting a *second* RAG project. You'd write almost the same glue code again — the same chunk-then-embed-then-store loop, the same "build the search query, format the docs, build the prompt" boilerplate — just swapped for a different vector store or a different LLM provider. Do that across five projects and you have five nearly-identical, hand-rolled pipelines, each one a slightly different shape, each one requiring you to remember the exact method names and quirks of whichever vector store and LLM SDK you happened to use that time.

The problem orchestration frameworks solve: **once you understand what each RAG stage does, you want a way to wire those stages together that doesn't require re-writing the same connective glue code, project after project, vector-store after vector-store.**

---

## 2. The Analogy: Standardized Plugs and Sockets

**Real-world analogy:** imagine every electrical appliance manufacturer used its own proprietary plug shape. Your lamp needs a triangular socket, your toaster needs a five-pin round one, your phone charger needs something else entirely. Every time you buy a new appliance, you need a new, custom-wired socket to match it — or you rewire the wall yourself.

Now imagine instead that every appliance, no matter who makes it, uses the same standardized plug. You buy any lamp, any toaster, any charger, and it just plugs into the same wall socket. Manufacturers still build genuinely different appliances internally — a toaster and a lamp do completely different things — but the *connection* between "device" and "power" is standardized, so nothing about swapping one appliance for another requires re-wiring your house.

**LangChain is the standardized plug for RAG components.** A Chroma vector store, a Pinecone vector store, an Anthropic LLM call, an OpenAI LLM call — each does something genuinely different internally, exactly like a toaster and a lamp do different things. But LangChain wraps each of them behind a common interface (`VectorStore`, `Retriever`, a chat model interface, and so on), so a chain built around "a retriever, a prompt, and an LLM" doesn't care which specific vector store or which specific model provider is plugged in underneath. Swap Chroma for Pinecone, or Claude for another provider, and the surrounding chain code doesn't need to change — only the standardized "plug" you snap in changes.

> 🧠 The one-sentence version: *"LangChain doesn't change what a vector store or an LLM does — it standardizes how you plug them into each other."*

---

## 3. LangChain's Core Abstractions

LangChain has a small number of core abstractions that map directly onto the RAG stages you already know from Phases 2-9. Recognizing them as *standardized versions of things you already built by hand* is the fastest way to learn them.

- **`Document`** — a simple container holding a piece of text (`page_content`) plus a dictionary of `metadata` (source filename, page number, chunk index, and so on). This is the standardized shape for a "chunk," the same thing you were producing by hand in Phase 4 with your own splitter functions — LangChain just gives that chunk a consistent object shape so every other component knows what to expect.

- **`Embeddings`** — a standard interface around whatever embedding model you're using (the same embedding calls from Phase 2), exposing a common `embed_query(text)` / `embed_documents(texts)` shape regardless of which provider's API sits underneath.

- **`VectorStore`** — a standard interface around whatever vector database you're using (Chroma, Pinecone, pgvector — Phases 5-7), exposing common methods like `.add_documents(...)`, `.similarity_search(...)`, and `.from_documents(...)`, regardless of which store's native SDK is being wrapped.

- **`Retriever`** — a thin, standardized wrapper *around* a vector store that exposes exactly one method conceptually: "given a query string, return relevant documents." Any vector store can be turned into a `Retriever` via `.as_retriever(...)`, and once it's a `Retriever`, it can be plugged into any chain that expects one — this is covered in depth in the next lesson.

- **`PromptTemplate`** — a standardized way to build a prompt string (or list of chat messages) with placeholders filled in at call time, instead of hand-writing f-strings or `.format()` calls for every prompt.

- **`Runnable` / LCEL** — the glue that connects all of the above. Every one of these components (retrievers, prompts, LLM wrappers, plain Python functions) can be treated as a `Runnable` — something with a consistent `.invoke(input)` method — and `Runnable`s can be composed together with the `|` operator into a single pipeline. This is LCEL (LangChain Expression Language), covered next.

---

## 4. LCEL: The `|` Operator and Runnables

**LCEL (LangChain Expression Language)** is the composition layer that lets you chain `Runnable`s together using Python's `|` (pipe) operator — the same operator used for bitwise OR, repurposed here via Python's operator-overloading mechanism (a class can define what `|` means for its own objects; LangChain defines it to mean "pipe my output into the next thing's input").

Here's the mechanic precisely, because it's easy to get slightly wrong: every `Runnable` implements `.invoke(input)`, which takes some input and returns some output. When you write `a | b`, LangChain doesn't run anything immediately — it constructs a new object, a `RunnableSequence`, that *remembers* "run `a` first, then feed its output as the input to `b`." That `RunnableSequence` is itself a `Runnable` — it also has `.invoke(...)` — so nothing actually executes until you call `.invoke(...)` on the resulting chain. This is why you can build up a long chain (`a | b | c | d`) as a single expression and it stays inert, purely descriptive, until the moment you call `.invoke(some_input)` on the whole thing — at which point it runs `a`, feeds the result to `b`, feeds *that* result to `c`, and so on, finally returning `d`'s output.

Two things worth being precise about here, because both are common sources of confusion:

1. **`a | b | c` is left-associative** — Python evaluates it as `(a | b) | c`, so you end up with a `RunnableSequence` wrapping another `RunnableSequence`, not some special three-way object. It behaves identically to a flat three-step pipeline either way.
2. **Plain Python functions can be part of a chain** too, as long as they're wrapped so LangChain treats them as `Runnable`s (LangChain does this wrapping automatically for a bare function placed in a `|` chain). This is how you'll later slot in a custom formatting or reranking step that LangChain doesn't have a built-in component for — see Lesson 03.

---

## 5. A Minimal LCEL Chain Example

Here is the smallest possible LCEL chain: a prompt template piped into a chat model call. No retrieval yet — that's Lesson 02. The point of this example is purely to see the `|` mechanics work end to end.

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_anthropic import ChatAnthropic

# A PromptTemplate with one placeholder, {question}
prompt = ChatPromptTemplate.from_template(
    "Answer the following question concisely: {question}"
)

# ChatAnthropic wraps the Claude API behind LangChain's chat-model interface.
# Use claude-opus-4-8 for consistency with the rest of this course.
llm = ChatAnthropic(model="claude-opus-4-8")

# The `|` operator builds a RunnableSequence: prompt runs first, its output
# (a formatted list of chat messages) becomes the input to llm.
chain = prompt | llm

# Nothing has executed yet -- `chain` is just a description of the pipeline.
# .invoke() is what actually runs it, passing {"question": ...} into `prompt`.
response = chain.invoke({"question": "What is the capital of France?"})

print(response.content)  # "The capital of France is Paris."
```

Walking through what happens on `chain.invoke(...)`:

1. The dictionary `{"question": "What is the capital of France?"}` is passed into `prompt`. `prompt` fills in the `{question}` placeholder and produces a formatted list of chat messages.
2. That formatted output becomes the *input* to `llm` — this is the entire meaning of the `|` operator: output of the left side flows into the right side.
3. `llm` calls the Claude API with those messages and returns a message object; `response.content` holds the text of Claude's reply.

Notice there is no manual "build the prompt string, then separately call the API with that string" code here — that's exactly the boilerplate LCEL is standardizing away, matching the "standardized plug" analogy from Section 2.

---

## 6. Doing It By Hand vs. LangChain

| Dimension | By hand (Phases 2-9 style) | With LangChain |
|---|---|---|
| **Control** | Full control over every API call, retry, and data shape — nothing hidden | Some behavior (message formatting, retries, default parameters) happens inside LangChain's wrapper code |
| **Debugging** | Every failure traces directly to a line of your own code | An error can originate inside a LangChain abstraction layer, requiring you to understand *its* internals, not just your own |
| **Vendor/store lock-in** | None — you call each provider's SDK directly, so switching providers means rewriting that one integration | Low, by design — swapping Chroma for Pinecone, or one LLM provider for another, mostly means changing which wrapper class you instantiate, not rewriting the surrounding chain |
| **Boilerplate across projects** | High — the same chunk/embed/store/retrieve/prompt glue gets rewritten per project | Low — the same `Runnable` composition pattern (`retriever \| prompt \| llm`) reuses across projects |
| **Learning curve for what's *actually* happening** | Steep upfront, but transparent — you see every step | Faster to get something working, but shallow understanding is a real risk if you skip the manual version |

**Interview angle:** "Why would you use LangChain instead of just calling the APIs directly?" is a common systems-design follow-up once a candidate has described a RAG pipeline. The strong answer isn't "LangChain is better" or "LangChain is worse" — it's an honest trade-off: LangChain buys you less repetitive glue code and easier swapping between vector stores or LLM providers, at the cost of an extra abstraction layer between you and the underlying API calls, which can make certain classes of bugs harder to trace. The best candidates can also explain *when* they'd skip LangChain entirely — for a single, performance-critical pipeline with one fixed vector store and one fixed model, hand-rolled code with full control can be the right call.

---

## 7. Common Mistakes

**Mistake 1: Treating LangChain as magic.** The single most common mistake — and exactly why Phases 2-9 taught the manual version first — is learning LangChain's `|` syntax without understanding that `retriever | prompt | llm` is doing precisely the same four things you already did by hand: embed the query, search the vector store, format the prompt, call the LLM. If a chain produces a bad answer, "I don't know why, LangChain just gave me this" is not a debuggable position. Knowing that a `Retriever` is a thin wrapper around the exact `similarity_search()` call you wrote by hand in Phase 8 means you know precisely where to look: is the retriever configured with the wrong `k`? Is the vector store actually populated? Is the prompt template dropping the retrieved context? None of those questions are answerable if the framework is a black box to you.

**Mistake 2: Assuming a wrapper class behaves identically to the underlying SDK.** `ChatAnthropic` is a LangChain wrapper around the Claude API — it doesn't necessarily expose every parameter of the underlying API in the same way the raw SDK does, and its defaults (retry behavior, default model parameters) are LangChain's choices, not the API's. When something behaves unexpectedly, check whether you're debugging the underlying API or LangChain's wrapper around it.

**Mistake 3: Chaining without checking data shapes.** LCEL's `|` operator will happily connect any two `Runnable`s syntactically, but the *output* of the left side must match what the *input* of the right side expects (a dict of variables for a `PromptTemplate`, a list of chat messages for a chat model, and so on). A chain that type-checks in your head but passes the wrong shape at runtime fails with an error inside LangChain's code rather than yours — another reason to understand what each stage actually expects and returns.

---

## 8. Hands-On Exercises

### Exercise 1 — Build and invoke a two-step chain

**Goal:** Confirm you understand that `|` builds a description, and `.invoke()` is what executes it.

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_anthropic import ChatAnthropic

prompt = ChatPromptTemplate.from_template("Give me one fun fact about {topic}.")
llm = ChatAnthropic(model="claude-opus-4-8")
chain = prompt | llm

# Before calling .invoke(), print `chain` and observe that it describes a
# RunnableSequence -- it has not made any API call yet.
print(chain)

result = chain.invoke({"topic": "octopuses"})
print(result.content)
```

Run it, then change `{"topic": "octopuses"}` to a different topic and re-invoke the *same* `chain` object without rebuilding it. This should make clear that `chain` is a reusable pipeline description, not a one-shot computation.

### Exercise 2 — Trace an LCEL chain back to manual code

**Goal:** Cement the "LangChain isn't magic" mental model by writing the manual equivalent of Exercise 1's chain, using only what you learned in Phase 2 (raw API calls) — no LangChain imports at all.

Write a plain function `manual_chain(topic: str) -> str` that: builds the same prompt string yourself (`f"Give me one fun fact about {topic}."`), calls the Claude API directly (as in Phase 2, not through `ChatAnthropic`), and returns the response text. Compare the two outputs side by side. They should be functionally equivalent — the only difference is which code is doing the string formatting and the API call.

### Exercise 3 — Break the chain on purpose

**Goal:** Practice recognizing a data-shape mismatch, since this is the most common practical debugging skill for LCEL chains.

Take the chain from Exercise 1 and invoke it with `chain.invoke({"wrong_key": "octopuses"})` instead of `{"topic": "octopuses"}`. Read the resulting error message closely. Write down, in your own words, what part of the chain raised the error and why — this is the exact debugging move you'll need whenever a real chain fails.

---

## 9. Interview Q&A

### Q1. What problem does LangChain solve?

**Answer:** LangChain standardizes the connective glue between RAG components — vector stores, embedding models, LLM providers, prompt construction — behind common interfaces, so that wiring "retrieve, then prompt, then generate" together doesn't require rewriting the same boilerplate for every new project or every time you swap a vector store or LLM provider. It doesn't change what any individual component does; it changes how consistently you plug them together.

---

### Q2. What does `prompt | llm` actually construct, and when does it run?

**Answer:** The `|` operator builds a `RunnableSequence` — an object that remembers "run the left side first, then feed its output as input to the right side." Nothing executes at that point; it's purely a description of the pipeline. Execution happens only when `.invoke(input)` is called on the resulting chain, at which point the input flows through each step in order, with each step's output becoming the next step's input.

---

### Q3. Is LangChain strictly better than hand-writing your own RAG pipeline?

**Answer:** No — it's a trade-off. LangChain reduces repetitive boilerplate and makes swapping vector stores or LLM providers easier, since chains are built against standardized interfaces rather than provider-specific SDKs. The cost is an added abstraction layer: errors can originate inside LangChain's wrapper code, and its defaults (retries, parameter handling) aren't always identical to the raw provider SDK. For a single, tightly-controlled, performance-critical pipeline, hand-rolled code can be the better choice; for projects that need to move fast or swap components frequently, LangChain's standardization pays for itself.

---

### Q4. Why did this course teach vector stores, chunking, and retrieval manually (Phases 2-9) before introducing LangChain?

**Answer:** Because understanding what a component actually does internally is the only way to debug, tune, or reason about it once it's wrapped inside a framework. If a LangChain-built chain returns a bad answer, being able to trace that back to "the retriever's `k` is misconfigured" or "the vector store was never populated" requires already knowing what a retriever and a vector store do under the hood — knowledge this course built deliberately before introducing the framework that abstracts it.

---

### Q5. What is LCEL?

**Answer:** LCEL (LangChain Expression Language) is LangChain's composition system for combining `Runnable` objects — retrievers, prompt templates, LLM wrappers, even plain Python functions — using the `|` operator. Each `Runnable` exposes a consistent `.invoke(input)` method, and piping two of them together with `|` produces a `RunnableSequence` that chains their `.invoke()` calls: the output of one becomes the input of the next.

---

> 🧠 **Memory hook:** "LangChain is the standardized plug, not the appliance — it doesn't change what a vector store or an LLM does, it changes how easily you connect them."
