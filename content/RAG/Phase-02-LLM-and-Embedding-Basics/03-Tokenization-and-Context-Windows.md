# 03 — Tokenization and Context Windows

> A comprehensive reference covering why LLMs read tokens instead of raw text, how to estimate a token count, what a context window actually is, and why the raw document is rarely the biggest thing filling it up.

---

## Table of Contents

1. [The Problem: LLMs Don't Read Text, and Every Model Has a Ceiling](#1-the-problem-llms-dont-read-text-and-every-model-has-a-ceiling)
2. [The Analogy: A Translator Who Reads in Fixed-Size Chunks](#2-the-analogy-a-translator-who-reads-in-fixed-size-chunks)
3. [Internal Flow: Text → Tokens → Why the Count Matters](#3-internal-flow-text--tokens--why-the-count-matters)
4. [Estimating a Token Count in Code](#4-estimating-a-token-count-in-code)
5. [Typical Context Window Tiers](#5-typical-context-window-tiers)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: LLMs Don't Read Text, and Every Model Has a Ceiling

Two facts about large language models that feel obvious once you know them, but trip up almost everyone building their first RAG system:

**Fact one: an LLM never actually "reads" your raw text, character by character.** Before any generation happens, your input string is chopped up into small pieces called **tokens**, and the model operates entirely on sequences of tokens — not on letters, not on words, and not on your original string at all. This matters for RAG because every number you care about — how much text you can retrieve, how much a request costs, whether your prompt fits — is measured in tokens, not in characters or words. Two sentences with the same number of characters can have noticeably different token counts, depending on the vocabulary and punctuation involved.

**Fact two: every model has a hard limit on how many tokens it can process in a single request — the context window — split (in practice) between everything you send in and everything it generates back.** You cannot hand a model an unlimited amount of retrieved context "just to be safe." If your prompt — system instructions, retrieved chunks, conversation history, and the user's question, all combined — exceeds the model's context window, the request either gets truncated or rejected outright, depending on the API.

Put these together and you get the concrete, practical problem this lesson solves: **RAG systems need to fit a prompt template, some number of retrieved chunks, and a question into a token budget that has a hard ceiling — which means you need to be able to estimate token counts, understand what actually consumes that budget, and design your retrieval step with that budget in mind.** This is the direct link between this lesson and Phase 3 (chunking) and Phase 9 (retrieval strategies) — chunk sizes and "how many chunks to retrieve" are both, at bottom, token-budget decisions.

---

## 2. The Analogy: A Translator Who Reads in Fixed-Size Chunks

**Real-world analogy:** imagine a human translator who doesn't read letter-by-letter, and doesn't quite read word-by-word either — instead, they've trained themselves to recognize common chunks of language at a glance: whole common words as single units ("the," "and," "because"), but less common or longer words broken into familiar pieces ("un-", "believ-", "-able" for "unbelievable"). This translator is extremely fast at their job, but they work from a printed transcript with a fixed page limit — say, exactly 50 pages, no more. If the source document plus their own translation notes plus the final translated output would exceed 50 pages combined, something has to give: they need a shorter source document, more concise notes, or a shorter output.

This is almost exactly how an LLM operates. **Tokens are the translator's chunks-at-a-glance** — not quite letters, not quite whole words, but a fixed vocabulary of common pieces that the model was trained to recognize (this is called *subword tokenization*; we won't go deep into the specific algorithm used to build that vocabulary, but the practical effect is what matters here: common words often become a single token, while rarer or longer words get split into a few token pieces). **The context window is the translator's fixed page limit** — the input text, any instructions, and the generated output all have to fit within that same shared budget.

> 🧠 The one-line version for RAG: *"The model reads in fixed-size chunks, not raw text, and it only has so many pages to work with — your prompt template, retrieved context, and question all share that same page budget."*

---

## 3. Internal Flow: Text → Tokens → Why the Count Matters

Here's the flow from raw text to something the model can actually process:

```
   "Our refund policy allows returns within 30 days."
              │
              ▼
     ┌──────────────────────┐
     │   Tokenizer           │   breaks text into subword pieces using
     │   (subword splitting) │   a fixed vocabulary the model was trained on
     └──────────────────────┘
              │
              ▼
   ["Our", " refund", " policy", " allows", " returns", " within",
    " ", "3", "0", " days", "."]
              │
     (illustrative split -- exact boundaries vary by model and
      tokenizer; notice common words often stay whole, while
      numbers and less-common terms can split into pieces)
              ▼
   token IDs: [1148, 25353, 4527, ...]   ← what the model actually sees
```

A few things worth internalizing from this diagram:

- **Common, frequent words often become a single token.** "Our," "policy," "allows" — words that show up constantly in the model's training data — usually map to one token each.
- **Less common words, numbers, and unusual terms often split into multiple tokens.** A number like "30" might become two tokens ("3" and "0"), and an unfamiliar proper noun or technical term might split into several pieces. This is why a block of dense numerical data (like a table of statistics) or unusual domain jargon can produce noticeably more tokens per character than plain prose.
- **The tokenizer is specific to a model family.** Different providers train different tokenizers on different vocabularies, so the exact same string can produce a different number of tokens depending on which model's tokenizer processes it — there's no single universal "token count" for a piece of text, only "the token count according to model X's tokenizer."

**Why this matters for RAG, concretely:**

1. **Cost.** API pricing for LLM calls (and often for embedding calls too) is typically billed per token, for both what you send in and what the model generates back. More retrieved context per query means a bigger bill per query, at scale.
2. **Chunking decisions.** When you split a document into chunks for embedding and retrieval (Phase 3's whole subject), you're implicitly deciding how many tokens each chunk will be — too large and a chunk might not fit alongside enough other context; too small and you lose surrounding meaning.
3. **Fitting the context window.** This is the hard constraint: system prompt + retrieved chunks + conversation history + user question, added together in tokens, must not exceed the model's context window (with headroom left for the response).

---

## 4. Estimating Token Count in Code

The only fully accurate way to know a token count for a specific model is to use that model's own tokenizer or a token-counting endpoint the provider exposes — different models really do tokenize differently, so a generic estimate can be meaningfully off for any particular model. Here's how to get an exact count for a Claude model, using the Anthropic API's dedicated token-counting endpoint:

```python
import anthropic

client = anthropic.Anthropic()

text_to_check = "Our refund policy allows returns within 30 days of purchase."

response = client.messages.count_tokens(
    model="claude-opus-4-8",
    messages=[{"role": "user", "content": text_to_check}],
)

print(response.input_tokens)  # exact token count for this model's tokenizer
```

This is the right tool whenever you need an exact number — for example, checking whether a specific retrieved chunk plus the rest of your prompt will fit before you make the real (billed) generation call.

Sometimes, though, you just need a fast, rough estimate — for example, while sketching out a chunking strategy, before you've wired up any API calls at all. A widely used, explicitly-approximate heuristic for English prose is **roughly one token per four characters** (equivalently, roughly 0.75 tokens per word). This heuristic is not accurate for any particular model, and it degrades further on non-English text, code, or dense numerical data — treat it purely as a back-of-the-envelope estimate, never as a substitute for an exact count when the exact count actually matters (e.g. right before hitting a context-window limit):

```python
def estimate_tokens_heuristic(text: str) -> int:
    """
    Rough, model-agnostic estimate only -- roughly 4 characters per token
    for typical English prose. This will be noticeably wrong for code,
    non-English text, or numeric-heavy content. Use an exact tokenizer
    or a token-counting endpoint whenever precision actually matters.
    """
    return len(text) // 4

text_to_check = "Our refund policy allows returns within 30 days of purchase."
print(estimate_tokens_heuristic(text_to_check))  # a rough ballpark, not an exact count
```

Run both on the same string and compare — you'll typically see the heuristic land in the right neighborhood but not match the exact count from `count_tokens`. That gap is expected and is exactly why the heuristic is for quick sketching, and the real endpoint is for anything you're actually going to act on.

---

## 5. Typical Context Window Tiers

Exact context window sizes change frequently as providers release new models, so rather than memorizing specific numbers that will go stale, it's more durable to think in terms of qualitative tiers and what they're typically used for:

| Tier (qualitative) | Rough shape | Typical RAG use case |
|---|---|---|
| **Small** | Enough for a handful of retrieved chunks plus a short conversation | Simple FAQ-style RAG, single-turn Q&A, cost-sensitive high-volume applications |
| **Medium** | Enough for many retrieved chunks, a decent conversation history, and a substantial system prompt | The common default for most production RAG systems — comfortable headroom without needing aggressive context management |
| **Large** | Enough to fit entire documents, long conversation histories, or dozens of retrieved chunks at once | Long-document analysis, multi-turn agents with extensive history, retrieval strategies that deliberately over-fetch and let the model sort through more context |

The key practical point isn't the exact numbers (which you should always look up for the specific model you're using, since they do change) — it's that **context window size is a design constraint that shapes your whole retrieval strategy.** A small-tier model forces you to be precise about chunk size and retrieval count (Phase 9's "how many chunks to retrieve" question becomes much more pressing). A large-tier model gives you room to retrieve more generously, but doesn't remove cost as a concern, and doesn't guarantee the model will actually use a huge context window effectively — more retrieved context is not automatically better use of that space, a point Phase 1 already raised and that resurfaces throughout retrieval-strategy design.

---

## 6. Common Mistakes

**Mistake 1: Forgetting that the prompt template, retrieved context, and question all count against the window — not just the raw document.**

This is the single most common context-window miscalculation in RAG systems. It's tempting to think "the context window is huge, and my documents aren't that long, so I have plenty of room." But by the time a RAG system actually calls the LLM, the request typically includes: the system prompt (instructions on how to answer, tone, format), the prompt template's boilerplate text ("Using the following context, answer the question..."), *every* retrieved chunk (not just one — Phase 1's example retrieved multiple chunks per query), any conversation history if it's a multi-turn interaction, and finally the user's actual question. Each of these pieces adds its own token cost, and they all draw from the same shared budget as the model's response. A system that retrieves 10 chunks of 500 tokens each has already spent 5,000 tokens before the system prompt, conversation history, or question are even counted — and that's before leaving any room for the response itself.

**Mistake 2: Assuming a token roughly equals a word (or a character), and sizing chunks or budgets off that assumption without checking.**

As Section 3 showed, tokens don't map cleanly to words or characters — common words are often a single token, but numbers, unusual terms, and non-English text can produce noticeably more tokens per character than typical prose. If you size your chunks by word count or character count and assume that maps predictably to a token budget, you can end up either wasting context window headroom (chunks smaller than necessary) or — worse — exceeding a limit you thought you had margin against, particularly with content that's numeric- or jargon-heavy. When token counts actually matter for a decision (fitting a hard limit, controlling cost precisely), use an actual token count from the model's tokenizer or a token-counting endpoint, not a word or character count as a stand-in.

**Interview angle:** "If your retrieved documents are small, why would you still run out of context window?" is a question designed to test whether a candidate actually understands the full anatomy of a RAG prompt, rather than just thinking "documents in, answer out." A strong answer walks through everything that shares the budget — system prompt, template boilerplate, multiple retrieved chunks (not one), conversation history, and the question — rather than fixating only on document size.

---

## 7. Hands-On Exercises

### Exercise 1 — Compare the heuristic estimate against an exact count

**Goal:** Build intuition for how far off the "4 characters per token" heuristic can be, and for which kinds of text it drifts the most.

```python
import anthropic

client = anthropic.Anthropic()

def estimate_tokens_heuristic(text: str) -> int:
    return len(text) // 4

samples = [
    "Our refund policy allows returns within 30 days of purchase.",
    "def calculate_total(items: list[float]) -> float:\n    return sum(items)",
    "SKU-88213-A shipped 4/17 at 14:32:07 UTC; qty=12; unit_cost=$4.75.",
]

for text in samples:
    heuristic = estimate_tokens_heuristic(text)
    exact = client.messages.count_tokens(
        model="claude-opus-4-8",
        messages=[{"role": "user", "content": text}],
    ).input_tokens
    print(f"heuristic={heuristic:>4}  exact={exact:>4}  | {text[:40]!r}...")
```

**Run it and observe:** the gap between the heuristic and the exact count should be noticeably larger for the code sample and the numeric/SKU-heavy sample than for the plain-English sentence. This is exactly the "numbers and unusual terms tokenize less efficiently" effect from Section 3.

### Exercise 2 — Add up a realistic RAG prompt's full token cost

**Goal:** Cement Mistake 1 by actually computing the total, rather than just reading about it.

```python
import anthropic

client = anthropic.Anthropic()

def count(text: str) -> int:
    return client.messages.count_tokens(
        model="claude-opus-4-8",
        messages=[{"role": "user", "content": text}],
    ).input_tokens

system_prompt = "You are a helpful support assistant. Answer using only the provided context. Be concise."
template_boilerplate = "Answer the user's question using only the context below. If the context doesn't contain the answer, say so.\n\nContext:\n"
retrieved_chunks = [
    "Our refund policy allows returns within 30 days of purchase, provided the item is unused.",
    "To reset your password, go to Settings -> Security -> Reset Password.",
    "Shipping to international addresses takes 7-14 business days.",
]
user_question = "Can I get my money back if I bought something two weeks ago?"

full_prompt = (
    template_boilerplate
    + "\n\n".join(retrieved_chunks)
    + f"\n\nQuestion: {user_question}"
)

print("system prompt tokens:  ", count(system_prompt))
print("full user-turn tokens: ", count(full_prompt))
print("TOTAL input tokens:    ", count(system_prompt) + count(full_prompt))
```

**Reflection question:** if your model's context window were, hypothetically, only large enough for 200 tokens of input, would this exact prompt fit? What would you have to cut first — the system prompt, one of the retrieved chunks, or the question — and how would you decide?

### Exercise 3 — Diagnose a "context window exceeded" failure

**Goal:** Practice separating "which piece of the prompt is actually the problem" from "just retrieve fewer chunks," which is not always the right fix.

Scenario: a RAG system that has worked reliably for months suddenly starts failing with a context-window-exceeded error, but only for a specific subset of users — those with very long-running conversation histories (many back-and-forth turns in a single chat session). The retrieved chunks and system prompt haven't changed. Using what you learned in Section 6 (Mistake 1) and Section 3, write down: (1) which part of the prompt is almost certainly growing over time to cause this, (2) why this wasn't a problem for new conversations, and (3) at least one architectural fix that doesn't simply mean "retrieve less" (hint: Phase 1 mentioned a technique for handling long conversation histories, and later phases in this course revisit it in more depth).

---

## 8. Interview Q&A

### Q1. Why don't LLMs process raw text directly, character by character?

**Answer:** LLMs operate on tokens — pieces of text produced by a tokenizer that breaks input into a fixed vocabulary of common subword units — rather than on individual characters. Common words often become a single token, while rarer words, numbers, or unusual terms can split into multiple token pieces. This tokenized representation is what the model was actually trained on and what it processes internally; it's also the unit that pricing, context limits, and generation length are all measured in.

---

### Q2. What is a context window, and why does it matter for RAG?

**Answer:** A context window is the maximum number of tokens a model can process in a single request, covering both the input you send and the output it generates, combined. It matters for RAG because a RAG prompt isn't just the user's question — it includes the system prompt, prompt-template boilerplate, every retrieved chunk, and often conversation history, all of which share that same fixed token budget alongside room for the model's response. If the combined total exceeds the context window, the request fails or gets truncated, which directly shapes decisions like chunk size and how many chunks to retrieve per query.

---

### Q3. How would you estimate the token count of a piece of text without calling an API?

**Answer:** A common rough heuristic for English prose is about one token per four characters, or roughly 0.75 tokens per word — but this is explicitly an approximation, not an exact count, and it becomes noticeably less accurate for code, non-English text, or numeric/jargon-heavy content. Whenever a precise count actually matters — for example, confirming a prompt will fit a hard context-window limit before making a real API call — the right approach is to use the target model's own tokenizer or a dedicated token-counting endpoint, since different models tokenize the same text differently.

---

### Q4. If your retrieved chunks are small, why might you still hit a context window limit?

**Answer:** Because the retrieved chunks are only one part of the full prompt. The system prompt, the prompt template's own boilerplate text, every retrieved chunk (not just one — RAG systems typically retrieve several per query), any conversation history in a multi-turn interaction, and the user's question all draw from the same shared token budget. It's easy to underestimate the total by focusing only on document or chunk size and forgetting everything else that gets bundled into the actual request sent to the model.

---

### Q5. Does a bigger context window mean you should always retrieve more chunks?

**Answer:** No. A larger context window gives you more room, but retrieving more chunks isn't automatically better — irrelevant or excessive retrieved context can dilute the genuinely relevant information, increase cost and latency, and in some cases make it harder for the model to focus on what actually answers the question. The context window size is a ceiling that shapes what's possible, not a target to fill; how many chunks to retrieve is a separate design decision, covered in more depth in later retrieval-strategy phases of this course.

---

> 🧠 **Memory hook:** "The model doesn't read your document — it reads tokens, and the prompt template, every retrieved chunk, the conversation history, and the question all share one page budget with the answer."
