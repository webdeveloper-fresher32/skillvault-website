# 02 — RAG vs Fine-Tuning vs Long Context

> A comprehensive reference comparing RAG, fine-tuning, and long-context prompting as the three primary ways to get an LLM to use knowledge it wasn't originally trained on.

---

## Table of Contents

1. [The Problem: Three Roads to the Same Destination](#1-the-problem-three-roads-to-the-same-destination)
2. [The Analogy: Researcher, Trainee, and the Stack of Papers](#2-the-analogy-researcher-trainee-and-the-stack-of-papers)
3. [How Each Approach Actually Works](#3-how-each-approach-actually-works)
4. [Comparison Table](#4-comparison-table)
5. [Decision Guidance: Which One Do You Reach For?](#5-decision-guidance-which-one-do-you-reach-for)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Three Roads to the Same Destination

You've accepted that an LLM needs access to knowledge beyond what it memorized during training — your company's product docs, this quarter's numbers, a specialized vocabulary your support team uses. Lesson 1 introduced RAG as one answer. But it isn't the *only* answer, and interviewers (and real engineering decisions) will absolutely test whether you understand the alternatives and, more importantly, *when to reach for which one*.

There are three broad strategies:

1. **RAG** — retrieve relevant documents at query time and hand them to the model in the prompt.
2. **Fine-tuning** — retrain the model's weights on your own data so the knowledge (or behavior) becomes baked in.
3. **Long context** — just paste everything the model might need directly into the prompt, relying on the model's large context window to "read" all of it every time.

Each solves the "the model doesn't know X" problem differently, with genuinely different cost, freshness, latency, and complexity trade-offs. Picking the wrong one for your situation is a common — and expensive — mistake, both in system design and in interviews.

---

## 2. The Analogy: Researcher, Trainee, and the Stack of Papers

**Real-world analogy:** imagine you run a company and need someone to answer questions about a highly specialized, constantly-changing body of knowledge (say, current case law). You have three options for staffing this role:

- **Hire a researcher with a library card (RAG).** They don't know case law by heart, but they're excellent at quickly finding the right precedent in the library whenever a question comes in, reading just that section, and answering based on what they found. If the library adds new books tomorrow, they can use those immediately — no retraining required.

- **Send someone through years of legal training (fine-tuning).** After training, they *know* the law — it's internalized, it's fast, they don't need to look anything up for common questions, and their reasoning style has genuinely absorbed the discipline. But that training took a long time and cost a lot, and when the law changes next year, you can't just hand them a memo — you have to send them back through additional training to update what they "know."

- **Hand someone a giant stack of every relevant paper and ask them to read the whole stack before answering every single question (long context).** This works, and it requires no training at all — just handing over documents. But it's slow (they have to read the whole stack every time, even for a simple question) and it gets more expensive and unwieldy the bigger the stack gets. It also doesn't scale to an enormous library — there's a limit to how much they can read before a single answer.

None of these is universally "best" — they're different trade-offs between setup cost, ongoing cost, freshness, and latency, exactly like the LLM strategies they map to.

> 🧠 **Memory hook for this analogy:** *Researcher = RAG (looks things up fast). Trainee = fine-tuning (knows it cold, but retraining is slow). Stack of papers = long context (no training needed, but you re-read the whole stack every time).*

---

## 3. How Each Approach Actually Works

### 3.1 RAG (recap + framing)

As covered in Lesson 1: index your documents once, then retrieve + augment + generate on every query. The model's weights never change. New or updated documents can be indexed and become usable within minutes, without touching the model at all.

### 3.2 Fine-tuning

Fine-tuning takes a pretrained model and continues training it — usually on a smaller, curated dataset specific to your task — so its weights shift to better reflect that data. There are lighter-weight variants (like LoRA, which trains a small set of additional parameters instead of the whole model) but the core idea is the same: **the knowledge or behavior becomes part of the model itself**, not something looked up at question time.

Fine-tuning is genuinely good at teaching a model a **style, format, or skill** — e.g., "always respond in this JSON schema," "adopt this brand voice," "get better at this narrow classification task." It is comparatively bad at reliably injecting large amounts of **specific factual knowledge** — a fine-tuned model can still hallucinate facts it was fine-tuned on if that fact wasn't repeated enough times in training, and there's no way to point to "this is the exact source the answer came from," because the knowledge is now diffused across millions of weight parameters.

### 3.3 Long context

Modern LLMs support increasingly large context windows (hundreds of thousands of tokens or more). The "long context" strategy is simply: skip retrieval entirely, and paste your entire relevant document set — or as much of it as fits — directly into the prompt on every request, letting the model itself figure out what's relevant.

This sounds appealingly simple ("why build a whole retrieval pipeline if I can just paste everything in?"), and for smaller, static document sets it genuinely can be simpler and perfectly adequate. The trade-offs show up as your knowledge base grows: every request now re-processes the entire context (cost and latency scale with context size, not with question complexity), and even within a supported context window, models can suffer from a "lost in the middle" effect where information buried in the center of a very long prompt gets less attention than information near the start or end.

---

## 4. Comparison Table

| Dimension | RAG | Fine-Tuning | Long Context |
|---|---|---|---|
| **Upfront cost** | Moderate (build indexing + retrieval pipeline) | High (curate training data, run training jobs, evaluate) | Low (no pipeline, no training — just prompt construction) |
| **Per-query cost** | Low-moderate (retrieval + a focused prompt) | Low (normal inference cost; no extra context) | High, and grows with document set size (re-processes large context every call) |
| **Freshness of knowledge** | Excellent — re-index a document and it's usable in minutes | Poor — updating knowledge requires re-running fine-tuning | Excellent — just update what you paste in |
| **Latency** | Low-moderate (retrieval adds a step, but prompt stays focused) | Low (no extra runtime step; same as a normal call) | High as document set grows (larger prompts take longer to process) |
| **Explainability / citability** | High — you can point to the exact retrieved chunk that produced the answer | Low — knowledge is diffused across weights, no traceable source | Moderate — you can point to "somewhere in this pasted context," but not as precisely as a targeted retrieval |
| **Implementation complexity** | Moderate — requires chunking, embeddings, a vector store, retrieval logic | High — requires training infrastructure, labeled/curated data, evaluation, retraining cadence | Low — just prompt engineering, no new infrastructure |
| **Best at teaching** | New or private *facts* | New *behavior, style, or narrow skill* | New facts, for small-to-moderate, mostly static document sets |
| **Scales to huge knowledge bases?** | Yes — this is the main reason RAG exists | Not really — impractical to keep retraining as data grows/changes | No — bounded hard by the context window, and cost grows linearly with what you paste in |

---

## 5. Decision Guidance: Which One Do You Reach For?

Think of this as a short flowchart in prose — walk through it in order:

**Start: does the model need to know something it currently doesn't?**

- **If the knowledge changes frequently, or is too large to fit in a prompt, or needs precise citations** → reach for **RAG**. This is the default choice for "answer questions using our knowledge base / docs / support tickets," because freshness and citability matter and the corpus is too big to paste in every time.

- **If what you actually need is a change in *behavior* — a specific output format, a tone, a narrow classification skill the model doesn't currently do well, and you have enough high-quality examples of the desired behavior** → reach for **fine-tuning**. Note this is a different *kind* of problem than "the model doesn't know a fact" — it's "the model knows the facts but doesn't behave the way you want."

- **If your knowledge base is genuinely small (a handful of documents), rarely changes, and fits comfortably within the model's context window with room to spare** → **long context** can be the simplest correct answer — sometimes literally "just paste the whole handbook into the system prompt" beats building a retrieval pipeline for three documents that never change.

- **If you need both precise facts *and* a specific behavior/style** → these aren't mutually exclusive. **Use RAG and fine-tuning together**: fine-tune the model to adopt your desired tone, output format, or domain-specific reasoning style, while RAG continues to supply the current, specific, citable facts. This combination is extremely common in production systems — see the common mistakes section below.

A useful gut-check question when you're unsure: **"If this fact changed tomorrow, how would the system find out?"** With RAG, you update the index. With long context, you update what you paste in. With fine-tuning, the honest answer is often "it wouldn't, until we retrain" — which is exactly why fine-tuning is a poor fit for fast-changing factual knowledge.

---

## 6. Common Mistakes

- **Assuming RAG replaces fine-tuning entirely.** They solve different problems — RAG injects facts at query time, fine-tuning changes underlying behavior/style. A system that needs both a specific voice *and* current facts needs both techniques, not one or the other. Treating them as competing alternatives rather than complementary tools is one of the most common conceptual errors in this space.

- **Ignoring the real cost of large contexts.** "Just paste it all in" feels free because there's no separate infrastructure to build, but the token cost and latency of re-processing a huge context on every single query — even for a one-word answer — adds up fast at any real scale, and it doesn't improve as your document set grows; it gets worse.

- **Reaching for fine-tuning to fix a knowledge problem.** If a model gets facts wrong, the instinct is sometimes "let's fine-tune it on the correct facts." This is usually the wrong lever — fine-tuning is unreliable for injecting large amounts of precise, individually-retrievable facts, and it doesn't help when those facts change next month. If the actual problem is "the model doesn't know X," check whether RAG (add X to a retrievable index) solves it before reaching for a training run.

- **Forgetting that long context still needs *some* structure.** Even when everything fits in the context window, dumping unstructured text with no organization still produces worse answers than a reasonably organized prompt — "it all fits" doesn't mean "how it's organized doesn't matter."

**Interview angle:** This is a favorite systems-design interview question because it tests judgment, not memorization: "Would you use RAG or fine-tuning for X?" The strongest answers name the actual deciding factors — freshness, cost, citability, whether the problem is "wrong facts" vs. "wrong behavior" — rather than reciting a definition of each term. Being able to say "actually, this system probably wants both" is a strong signal of real understanding.

---

## 7. Hands-On Exercises

### Exercise 1 — Classify five scenarios

**Goal:** Practice applying the decision framework to concrete situations.

For each scenario below, write down which approach (RAG, fine-tuning, long context, or a combination) you'd reach for, and *why*, in one or two sentences:

1. A customer support bot that must answer questions using a 400-page, frequently-updated product manual.
2. A model that needs to always respond in a very specific legal disclaimer format, regardless of the question.
3. A small internal tool that answers questions about a single, rarely-changing 10-page onboarding document.
4. A coding assistant that needs both a company's specific style guide (voice/formatting) baked into every response, and up-to-date access to that company's actual, frequently-changing internal API documentation.
5. A chatbot that must cite the exact source paragraph for every factual claim it makes, for compliance reasons.

```python
scenarios = {
    1: "large, frequently updated, no citation requirement stated -> RAG",
    2: "behavior/format change, not new facts -> fine-tuning",
    3: "small, static, fits easily in context -> long context is fine",
    4: "needs both style AND fresh facts -> RAG + fine-tuning combined",
    5: "citability is a hard requirement -> RAG (traceable source)",
}
for k, v in scenarios.items():  # .items() iterates a dict as (key, value) pairs
    print(f"{k}: {v}")
```

Check your reasoning against the table in Section 4 before moving on — did you weigh freshness, citability, and cost, or just pick based on gut feel?

### Exercise 2 — Estimate the long-context cost trap

**Goal:** Build intuition for why long context doesn't scale the way it might feel like it should.

```python
# Rough illustrative token-cost comparison (not real pricing -- for intuition only)
TOKENS_PER_DOC = 2000          # average document length
COST_PER_1K_TOKENS = 0.003     # illustrative input token price

def long_context_cost(num_docs: int, num_queries: int) -> float:
    """Every query re-processes ALL documents pasted into the prompt."""
    tokens_per_query = num_docs * TOKENS_PER_DOC
    return (tokens_per_query / 1000) * COST_PER_1K_TOKENS * num_queries

def rag_cost(num_queries: int, retrieved_docs_per_query: int = 3) -> float:
    """Every query only pays for the small number of retrieved chunks."""
    tokens_per_query = retrieved_docs_per_query * TOKENS_PER_DOC
    return (tokens_per_query / 1000) * COST_PER_1K_TOKENS * num_queries

for num_docs in [5, 50, 500]:
    lc = long_context_cost(num_docs, num_queries=1000)
    rag = rag_cost(num_queries=1000)
    print(f"{num_docs} docs -> long-context cost: ${lc:.2f} | RAG cost: ${rag:.2f}")
```

**Observation:** RAG's per-query cost stays roughly flat as your document collection grows (you're only ever pulling in a handful of relevant chunks), while long context's cost scales directly with how many documents you have — because you're re-sending all of them, every time, regardless of relevance.

### Exercise 3 — Write the deciding question for your own project

**Goal:** Apply this lesson to something real.

Think of an actual (or hypothetical) project you might build. Write one paragraph answering: does this project need fresh facts, a specific behavior/style, or both? Then state which approach (or combination) you'd pick, referencing at least two rows from the comparison table (e.g., freshness and implementation complexity) to justify the choice.

---

## 8. Interview Q&A

### Q1. When would you choose RAG over fine-tuning?

**Answer:** When the knowledge changes frequently, is too large to bake into weights economically, or when you need to cite the exact source of an answer. RAG lets you update what the model "knows" by updating an index — no retraining required — and every answer can be traced back to the specific retrieved document. Fine-tuning is a poor fit here because updating baked-in knowledge requires re-running training, and there's no reliable way to point to which training example produced a given fact.

---

### Q2. When would you choose fine-tuning over RAG?

**Answer:** When the problem is about *behavior* rather than *facts* — you need the model to consistently respond in a specific format, tone, or style, or to get better at a narrow skill (like a specialized classification task) where you have enough quality examples to train on. RAG doesn't change how the model reasons or writes; it only changes what facts are available in the prompt. If your actual problem is "the model answers correctly but in the wrong voice or format," fine-tuning addresses that directly where RAG cannot.

---

### Q3. Can RAG and fine-tuning be used together?

**Answer:** Yes, and in production this is common. You can fine-tune a model to adopt a specific tone, output format, or domain reasoning style, while still using RAG to supply current, specific, citable facts at query time. They solve different problems — style/behavior versus knowledge/freshness — so combining them is often the right answer rather than a compromise between two competing options.

---

### Q4. What's the main downside of just using a very long context window instead of RAG?

**Answer:** Cost and latency scale directly with how much you paste into the prompt, not with how relevant that content actually is to the question — so as your document collection grows, every single query gets slower and more expensive, even simple ones. There's also a practical ceiling: however large the context window is, it's still finite, and models can pay less attention to information buried in the middle of a very long prompt (the "lost in the middle" effect) compared to a small, precisely retrieved set of relevant chunks.

---

### Q5. A colleague says "we don't need RAG anymore now that models have million-token context windows." How do you respond?

**Answer:** Large context windows reduce the need for RAG in some cases — especially small, static document sets — but they don't eliminate it. For genuinely large or frequently-changing knowledge bases, pasting everything in on every query is still slower and more expensive than retrieving just the relevant few chunks, and citability suffers (you can no longer point to exactly which source produced an answer as precisely). Long context and RAG aren't a strict upgrade path from one to the other — they're different tools suited to different corpus sizes and freshness requirements, and many production systems use both: a modest amount of long-context "always include this" material, plus RAG for the larger, changing knowledge base.

---

> 🧠 **Memory hook:** "A researcher looks things up (RAG). A trainee has it memorized (fine-tuning). A stack of papers gets re-read cover to cover every time (long context) — pick based on how big the library is and how often it changes."
