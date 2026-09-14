# 02 — Building Retrievers and Chains

> A comprehensive reference covering how to wrap an existing vector store as a LangChain `Retriever`, configure its search behavior, and compose it into a full LCEL retrieval-augmented chain.

---

## Table of Contents

1. [The Problem: Plugging a Vector Store into a Chain](#1-the-problem-plugging-a-vector-store-into-a-chain)
2. [The Analogy: A Universal Adapter](#2-the-analogy-a-universal-adapter)
3. [Internal Flow: From Vector Store to Retriever to Chain](#3-internal-flow-from-vector-store-to-retriever-to-chain)
4. [Code Example: Wrapping Chroma and Building a Retrieval Chain](#4-code-example-wrapping-chroma-and-building-a-retrieval-chain)
5. [Configuring Search Type and k](#5-configuring-search-type-and-k)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Plugging a Vector Store into a Chain

Lesson 01 introduced `Runnable`s and the `|` operator conceptually, using a chain with no retrieval step at all. But a RAG chain's entire point is retrieval — the chain needs to take a user's question, find relevant chunks from a vector store, and hand those chunks to the LLM alongside the question. The vector store you built in Phase 5 (Chroma), Phase 6 (Pinecone), or Phase 7 (pgvector) has its own native way of running a similarity search — a `.query(...)` call with store-specific parameters. None of those native calls are `Runnable`s, so none of them can be dropped directly into an LCEL `|` chain.

The problem this lesson solves: **you need a way to plug "search this specific vector store" into a chain built out of standardized, swappable pieces — without every chain needing to know whether it's talking to Chroma, Pinecone, or pgvector underneath.**

---

## 2. The Analogy: A Universal Adapter

**Real-world analogy:** think of international power adapters. A laptop charger built in one country has a particular plug shape; a wall socket in another country has a different shape entirely. A universal travel adapter doesn't change how the charger or the socket work — it just sits between them, translating one shape into the other, so that once you've got the right adapter, *any* charger works in *any* socket without you rewiring anything.

**A LangChain `Retriever` is that adapter for vector stores.** A Chroma collection speaks its own native query language; so does Pinecone; so does pgvector. Once any of them is wrapped as a `Retriever` — via `.as_retriever(...)` — it speaks one universal interface: "given a query string, return a list of relevant `Document`s." Any chain built to expect a `Retriever` works with *any* vector store behind that adapter, without the chain itself needing store-specific code.

> 🧠 One-line version: *"`.as_retriever()` is the adapter — once a vector store wears it, every chain that expects a retriever can use it, no matter which store is underneath."*

---

## 3. Internal Flow: From Vector Store to Retriever to Chain

Building a working retrieval chain has three steps, each corresponding to something you've already built by hand in earlier phases:

1. **Wrap the vector store as a retriever.** `vectorstore.as_retriever(search_type=..., search_kwargs={...})` returns a `Retriever` object. Internally, this retriever's `.invoke(query)` method calls the same kind of similarity or MMR search you wrote by hand against Chroma in Phases 5 and 8 — `.as_retriever()` doesn't add new search capability, it exposes the vector store's *existing* search methods behind the standard `Retriever` interface.

2. **Format the retrieved documents into a single string.** A `Retriever` returns a list of `Document` objects (recall from Lesson 01: each has `.page_content` and `.metadata`). An LLM prompt needs a single block of context text, not a list of objects — so a small formatting step (a plain Python function, wrapped as a `Runnable` when placed in a chain) joins the documents' `page_content` into one string, typically separated by blank lines.

3. **Compose retriever, formatter, prompt, and LLM into one chain.** The full chain is `retriever | format_docs | prompt | llm` — each step's output becomes the next step's input, exactly as described in Lesson 01's LCEL section. Note this is a slightly different shape than `prompt | llm` from Lesson 01: because the *first* step (`retriever`) needs the raw question, and the *prompt* step needs both the formatted context and the original question, a small amount of extra plumbing (shown in the code below) is needed to make both available at the prompt step. This is normal for any RAG chain, not a special case.

---

## 4. Code Example: Wrapping Chroma and Building a Retrieval Chain

This example builds directly on Phase 5 (Chroma) and Phase 8 (Retrieval Strategies). **The vector store must actually contain documents before you query it** — the example below populates it explicitly via `.from_documents(...)` rather than assuming a pre-existing collection, since querying an empty store is a common and confusing mistake.

```python
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableParallel, RunnablePassthrough
from langchain_anthropic import ChatAnthropic
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings  # or any Embeddings implementation from Phase 2

# --- Step 1: populate the vector store (skip this if you already have a
# persisted Chroma collection from Phase 5 -- but never query an empty one) ---
docs = [
    Document(page_content="Our refund policy allows returns within 30 days of purchase.",
             metadata={"source": "policy.md"}),
    Document(page_content="To reset your password, go to Settings -> Security -> Reset Password.",
             metadata={"source": "faq.md"}),
    Document(page_content="Shipping to international addresses takes 7-14 business days.",
             metadata={"source": "shipping.md"}),
]

embeddings = OpenAIEmbeddings()  # any Embeddings implementation works here

vectorstore = Chroma.from_documents(
    documents=docs,
    embedding=embeddings,
    collection_name="support_docs",
    persist_directory="./chroma_db",  # a real path -- persists between runs
)

# --- Step 2: wrap the populated store as a Retriever ---
retriever = vectorstore.as_retriever(search_kwargs={"k": 2})

# --- Step 3: a small formatting function to join retrieved Documents into
# one context string. This is a plain Python function; LangChain wraps it
# as a Runnable automatically when it's used inside a `|` chain. ---
def format_docs(documents: list[Document]) -> str:
    return "\n\n".join(doc.page_content for doc in documents)

# --- Step 4: build the prompt template ---
prompt = ChatPromptTemplate.from_template(
    "Answer the question using only the context below. If the context "
    "doesn't contain the answer, say so.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}"
)

llm = ChatAnthropic(model="claude-opus-4-8")

# --- Step 5: compose the full chain ---
# RunnableParallel runs both branches on the same input: `retriever | format_docs`
# turns the question into formatted context, while RunnablePassthrough() carries
# the original question through unchanged, so `prompt` receives both variables.
chain = (
    RunnableParallel(context=retriever | format_docs, question=RunnablePassthrough())
    | prompt
    | llm
    | StrOutputParser()  # extracts the plain text string from the LLM's response
)

answer = chain.invoke("Can I get a refund if I bought something two weeks ago?")
print(answer)
```

Walking through the composed chain on `.invoke("Can I get a refund...")`:

1. The `RunnableParallel` receives the raw question string and runs it through *two* branches simultaneously: `retriever | format_docs` embeds the question, searches Chroma for the top `k=2` most similar chunks, and joins them into a context string; `RunnablePassthrough()` simply passes the original question through unchanged.
2. Both branches' outputs are combined into a dictionary — `{"context": "<joined chunks>", "question": "<original question>"}` — which matches exactly what `prompt`'s two placeholders expect.
3. `prompt` fills in the template, `llm` generates a response grounded in that context, and `StrOutputParser()` extracts the plain string from the response object (recall from Lesson 01 that `llm.invoke(...)` alone returns a message object with a `.content` attribute — `StrOutputParser` does that unwrapping for you inside the chain).

---

## 5. Configuring Search Type and k

`.as_retriever(...)` takes two important keyword arguments that directly control retrieval behavior — and getting these wrong silently undoes tuning work from Phase 8:

- **`search_kwargs={"k": N}`** — how many chunks to retrieve. If you tuned `k` for your use case in Phase 8 (balancing enough context against prompt bloat, per Phase 1's "more context isn't always better" lesson), that exact value needs to be passed here explicitly — the default `k` LangChain uses may not match what you tuned manually.

- **`search_type="mmr"`** — switches from plain similarity search to Maximal Marginal Relevance, the diversity-aware retrieval strategy from Phase 8 that avoids returning several near-duplicate chunks. MMR takes its own extra parameters inside `search_kwargs`, most commonly `fetch_k` (how many candidates to consider before diversifying) and `lambda_mult` (the relevance-vs-diversity trade-off knob from Phase 8).

```python
# Similarity search, k=4 (LangChain's default search_type is "similarity")
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# MMR search, matching the diversity-aware retrieval from Phase 8
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 4, "fetch_k": 20, "lambda_mult": 0.5},
)
```

**Comparison — configuring the retriever explicitly vs. accepting defaults:**

| Aspect | Explicit `search_kwargs` (matches Phase 8 tuning) | Default `.as_retriever()` (no arguments) |
|---|---|---|
| `k` | Whatever value you tuned and validated manually | LangChain's default, which may retrieve too few or too many chunks for your prompt budget |
| Search strategy | `mmr` if you determined diversity mattered for your corpus | Plain similarity search only — no diversity handling |
| Debuggability | You know exactly why these chunks were retrieved, because you chose the parameters | Retrieval behavior silently differs from what you validated in Phase 8, with no error to indicate the mismatch |

**Interview angle:** "What's the difference between using a vector store directly and wrapping it as a LangChain retriever?" tests whether a candidate understands that `.as_retriever()` is a thin adapter, not new functionality — the underlying search (similarity or MMR, with whatever `k` and other parameters) is identical to a manual call against the same vector store; only the *interface* is standardized. A strong answer also flags that skipping explicit `search_kwargs` is a common way to silently regress retrieval quality that was carefully tuned in Phase 8.

---

## 6. Common Mistakes

**Mistake 1: Not configuring `search_kwargs` and getting silently different behavior.** This is the mistake called out in the task itself, and it's the single most common bug in a LangChain retrieval chain: calling `vectorstore.as_retriever()` with no arguments accepts LangChain's defaults, which may not match the `k`, search type, or MMR parameters you validated manually in Phase 8. Nothing errors — the chain runs, returns an answer, and that answer is grounded in a different (and possibly worse) set of retrieved chunks than the ones you tuned for. Always pass `search_kwargs` (and `search_type` if you need MMR) explicitly, and treat those values as configuration to carry forward from Phase 8, not defaults to accept blindly.

**Mistake 2: Querying an empty vector store.** A retriever wrapped around a vector store with nothing indexed in it will not error — it will simply return zero results (or, depending on the store, an error only surfaces deep inside the similarity search call). Always confirm the store has been populated — via `.from_documents(...)` at creation time, or `.add_documents(...)` against an existing store — before wrapping it as a retriever and building a chain around it. The code example in Section 4 populates the store explicitly for exactly this reason.

**Mistake 3: Forgetting that `format_docs` needs to match the prompt's expectations.** If your prompt template expects a single `{context}` string but your formatting function returns a list of `Document` objects (skipping the join step), the chain will fail with a type error at the prompt-formatting stage, not at the retrieval stage — another instance of Lesson 01's point that debugging LCEL chains means tracing exactly which stage's output shape doesn't match the next stage's expected input.

---

## 7. Hands-On Exercises

### Exercise 1 — Compare `k=1` vs `k=4` on the same question

**Goal:** See directly how `search_kwargs` changes retrieval, using the chain from Section 4.

Using the same three-document Chroma store from the code example, build two retrievers — one with `search_kwargs={"k": 1}` and one with `search_kwargs={"k": 3}` — and run the same question through the full chain with each. Compare the final answers. With `k=1`, does the chain still answer correctly if the single most-similar chunk happens not to be the most relevant one?

### Exercise 2 — Switch from similarity search to MMR

**Goal:** Practice configuring `search_type` and observe when MMR actually changes retrieved results versus when it doesn't.

Add two or three documents to the store from Section 4 that are near-duplicates of each other (e.g., three slightly reworded versions of the refund policy). Build one retriever with `search_type="similarity"` and one with `search_type="mmr"` (with `fetch_k` larger than `k`), both with the same `k`. Query with a question relevant to the near-duplicate documents and compare which chunks each retriever returns. Explain in your own words why MMR's results differ (or don't).

### Exercise 3 — Diagnose an empty-retrieval chain

**Goal:** Practice recognizing the "querying an empty store" failure mode described in Mistake 2.

Create a **new**, empty Chroma collection (a fresh `collection_name` you have not called `.from_documents(...)` or `.add_documents(...)` on), wrap it as a retriever, and run it through the chain from Section 4. Observe what the chain returns. Then explain, in your own words, why this fails silently rather than raising an obvious error, and what you'd check first if a teammate reported "the RAG chain gives useless answers" in a real system.

---

## 8. Interview Q&A

### Q1. What does `.as_retriever()` actually do?

**Answer:** It wraps an existing vector store — which has its own native similarity or MMR search methods — behind LangChain's standardized `Retriever` interface, so the store can be plugged into any LCEL chain that expects a retriever. It doesn't add new search capability; it exposes the vector store's existing search behavior (the same kind of call you'd make by hand) through a consistent `.invoke(query)` method that returns a list of `Document` objects.

---

### Q2. How do you configure how many chunks a LangChain retriever returns?

**Answer:** Pass `search_kwargs={"k": N}` to `.as_retriever(...)`. This directly controls the underlying similarity search's `k`, the same parameter you'd tune manually against a vector store's native query call. If you don't pass it explicitly, LangChain's default may not match whatever value you validated for your use case, which can silently change retrieval quality without raising any error.

---

### Q3. What is `search_type="mmr"` and when would you use it?

**Answer:** It switches the retriever from plain similarity search to Maximal Marginal Relevance, which balances relevance to the query against diversity among the retrieved chunks — avoiding returning several near-duplicate passages instead of a broader spread of relevant information. It's configured via `search_type="mmr"` plus MMR-specific parameters (`fetch_k`, `lambda_mult`) inside `search_kwargs`, mirroring the diversity-aware retrieval strategy covered manually in Phase 8.

---

### Q4. In a chain like `retriever | format_docs | prompt | llm`, why is there often a `RunnableParallel` or similar step before the prompt?

**Answer:** Because the prompt template typically needs both the retrieved context *and* the original question as separate variables, but only the context comes from the retriever branch. A `RunnableParallel` (or equivalent construct) runs the retrieval-and-formatting branch and a passthrough of the original question side by side, combining both into the dictionary the prompt template expects — one key per placeholder.

---

### Q5. What happens if you build a retriever around a vector store that has no documents in it?

**Answer:** No error is raised at the retriever-construction step or usually even at query time — the retriever simply returns an empty or near-empty result set, since there's nothing to match against. The chain then proceeds with essentially no context, and the LLM may either say it lacks the information or, worse, hallucinate an answer without any indication that retrieval silently failed. This is why populating the vector store (`.from_documents(...)` or `.add_documents(...)`) before wrapping it as a retriever is essential, and why "check whether the store was actually populated" is often the first debugging step for a RAG chain giving poor answers.

---

> 🧠 **Memory hook:** "`.as_retriever()` is the universal adapter, not a new search engine — the search is exactly what you built manually, only the plug shape changed."
