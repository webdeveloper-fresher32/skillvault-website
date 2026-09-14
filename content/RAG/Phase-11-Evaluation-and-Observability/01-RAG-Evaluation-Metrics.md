# 01 — RAG Evaluation Metrics

> A comprehensive reference covering why "it seems to work" isn't good enough for a production RAG system, the four RAGAS-style evaluation metrics, and a simplified LLM-as-judge faithfulness check using the Claude API.

---

## Table of Contents

1. [The Problem: "It Seems to Work" Isn't a Metric](#1-the-problem-it-seems-to-work-isnt-a-metric)
2. [The Analogy: A Teacher Grading an Essay on More Than One Axis](#2-the-analogy-a-teacher-grading-an-essay-on-more-than-one-axis)
3. [Internal Flow: The Four RAGAS-Style Metrics](#3-internal-flow-the-four-ragas-style-metrics)
4. [Code Example: A Simplified Faithfulness Check with an LLM Judge](#4-code-example-a-simplified-faithfulness-check-with-an-llm-judge)
5. [Comparing the Four Metrics](#5-comparing-the-four-metrics)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: "It Seems to Work" Isn't a Metric

Every earlier phase in this course built a piece of the pipeline: chunking (Phase 4), storing and retrieving vectors (Phases 5-7), retrieval strategies (Phase 8), reranking (Phase 9), and wiring it all together (Phase 10). At every stage, the way you validated your work was informal — you asked a question, read the answer, and judged with your own eyes whether it looked right.

That's fine while you're the only user and you already know the right answer. It falls apart the moment a RAG system goes into production. You can't manually read every answer your system produces across thousands of daily queries. You can't reliably tell, just by reading fluent prose, whether a claim in the answer is actually backed by the retrieved context or quietly fabricated — LLMs are, by construction (Phase 1), very good at sounding confident regardless of whether they're right. And when quality *does* degrade — a new document format breaks chunking, an embedding model gets swapped, a prompt template changes — "it seems to work" gives you no early warning and no way to quantify how much worse things got.

So the concrete problem this lesson solves: **given a RAG system's output, how do you compute objective, repeatable, numeric scores that tell you specifically what's wrong — not just "good" or "bad," but which stage of quality is failing?**

---

## 2. The Analogy: A Teacher Grading an Essay on More Than One Axis

**Real-world analogy:** imagine a teacher grading a student's essay written in response to an assigned reading. A lazy teacher skims the essay, notices it's well-written and confidently argued, and gives it an A. A careful teacher grades on *several separate axes*: Did the student actually answer the assigned question, or did they wander off-topic? Did they use the assigned reading honestly, or did they invent supporting "facts" that aren't in the source text? Did they cite the specific passages that back up each claim, or make vague unsupported assertions? A student can write a beautifully fluent essay that fails every one of these axes — and a careful teacher would catch that, while a lazy one would be fooled by the fluency alone.

**RAG evaluation is the careful teacher, not the lazy one.** A generated answer can be fluent, confident, and *still* fail on a specific, separable axis: it might not actually answer the question, it might contain claims the retrieved context never supported (the RAG equivalent of inventing facts about the reading), or the retrieval step itself might have handed the model the wrong "reading" to work from in the first place. Grading only "does this sound like a good answer" is exactly the lazy-teacher mistake — it misses failures that a fluency check can't see.

> 🧠 One-line version: *"Don't just check if the essay reads well — check if it answered the question, if it used the source honestly, and if it cited the right pages."*

---

## 3. Internal Flow: The Four RAGAS-Style Metrics

The four metrics below follow the structure popularized by the RAGAS evaluation framework (Retrieval-Augmented Generation Assessment) — you don't need the library itself to understand or even implement simplified versions of these ideas, which is what Section 4 does.

Notice that the four metrics split cleanly into two pairs: two of them grade the **generation** step, and two of them grade the **retrieval** step. This split matters enormously — see Section 6.

**Faithfulness** (generation-side): does every claim in the generated answer actually trace back to something stated in the retrieved context, or did the model add information that isn't there? This is the direct, measurable version of "is the model hallucinating." A faithful answer might still be incomplete or unhelpful — faithfulness only checks that it didn't *invent* anything, not that it fully answered the question.

**Answer relevance** (generation-side): does the generated answer actually address the question that was asked? A model can produce a perfectly faithful answer — every word grounded in the retrieved context — that still fails to actually answer what the user asked, for example by summarizing the retrieved context in general terms instead of answering the specific question. Faithfulness and answer relevance are deliberately separate axes because a model can succeed at one and fail at the other independently.

**Context precision** (retrieval-side): of the chunks that were retrieved, how many of them were actually relevant to the question? If your retriever pulls back five chunks and only one is genuinely about the topic, context precision is low — the retriever is bringing back noise alongside (or instead of) signal. This is the retrieval equivalent of "am I wasting context window budget on irrelevant text."

**Context recall** (retrieval-side): of everything relevant that exists in the document collection, how much of it did retrieval actually find? A retriever can have perfect precision (every chunk it returns is relevant) while still having terrible recall, if it misses other equally relevant chunks that also should have been retrieved. This is the retrieval equivalent of "did I miss something important."

```
                    GENERATION SIDE                      RETRIEVAL SIDE
              ┌─────────────────────────┐         ┌──────────────────────────┐
              │  Faithfulness            │         │  Context Precision       │
              │  Is the answer grounded  │         │  Are retrieved chunks    │
              │  in retrieved context?   │         │  actually relevant?      │
              │                          │         │                          │
              │  Answer Relevance        │         │  Context Recall         │
              │  Does the answer address │         │  Did retrieval find      │
              │  the question asked?     │         │  everything needed?     │
              └─────────────────────────┘         └──────────────────────────┘
```

The reason this split matters: a low faithfulness or answer-relevance score doesn't necessarily mean the *generation* step is broken — it might mean retrieval handed the model garbage, and the model faithfully (and unhelpfully) worked with what it was given. You cannot correctly diagnose a generation-side failure without also checking the retrieval-side metrics. This exact trap is Section 6's Mistake 1.

---

## 4. Code Example: A Simplified Faithfulness Check with an LLM Judge

The industry-standard way to *compute* these metrics at scale is to use another LLM as an automated judge — you give it the question, the retrieved context, and the generated answer, and ask it to render a structured verdict. This is called "LLM-as-judge." Below is a simplified faithfulness check: it does not reproduce a full RAGAS-style numeric score (that typically involves decomposing the answer into individual claims and scoring each one), but it demonstrates the core pattern in a form realistic enough to build on.

```python
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment

def check_faithfulness(question: str, context: str, answer: str) -> dict:
    """Ask an LLM judge whether `answer` is fully grounded in `context`.

    Returns a dict with a "verdict" ("grounded" or "ungrounded") and a
    "reasoning" string explaining the judge's decision -- the reasoning is
    what makes this useful for debugging, not just scoring.
    """
    judge_prompt = f"""You are a strict fact-checker. You will be given a
CONTEXT passage, a QUESTION, and an ANSWER that was generated by another AI
system using that context.

Your job: check whether every factual claim in the ANSWER can be directly
traced back to something stated in the CONTEXT. Do not use any outside
knowledge of your own -- judge only against what the CONTEXT actually says.

If the ANSWER contains even one claim that is not supported by the CONTEXT
(including invented details, numbers, or names that don't appear in it),
the verdict is "ungrounded". If every claim in the ANSWER is supported by
the CONTEXT, the verdict is "grounded".

CONTEXT:
{context}

QUESTION:
{question}

ANSWER:
{answer}

Respond in exactly this format:
VERDICT: <grounded or ungrounded>
REASONING: <one or two sentences explaining which claim, if any, is
unsupported, or confirming that all claims are supported>"""

    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=300,
        messages=[{"role": "user", "content": judge_prompt}],
    )

    judge_text = response.content[0].text  # first (and only) content block's text

    # A tiny, deliberately simple parser -- a production system would use
    # structured output (e.g. tool use) instead of parsing free text, but
    # this keeps the example focused on the judging pattern itself.
    verdict = "ungrounded"
    reasoning = judge_text
    for line in judge_text.splitlines():
        if line.startswith("VERDICT:"):
            verdict = line.split(":", 1)[1].strip().lower()
        elif line.startswith("REASONING:"):
            reasoning = line.split(":", 1)[1].strip()

    return {"verdict": verdict, "reasoning": reasoning}


# Example usage: a deliberately ungrounded answer to demonstrate the check
context = (
    "Our refund policy allows returns within 30 days of purchase, provided "
    "the item is unused and in its original packaging."
)
question = "What's the return window, and is there a restocking fee?"
answer = (
    "You have 30 days to return an unused item, and a 15% restocking fee "
    "applies to all returns."
)  # the restocking fee was never mentioned in the context -- fabricated

result = check_faithfulness(question, context, answer)
print(result["verdict"])     # expected: "ungrounded"
print(result["reasoning"])   # expected: explains the restocking-fee claim isn't supported
```

Two things worth calling out about this code. First, the judge prompt explicitly instructs the model to use *only* the given context, not its own outside knowledge — without that instruction, the judge itself might "helpfully" fill in gaps from its training data and rate a genuinely ungrounded answer as grounded. Second, this is checking one answer against one piece of context for one question; a real evaluation run repeats this over a labeled test set of many question/context/answer triples and aggregates the grounded/ungrounded rate into a single faithfulness score for the whole system.

---

## 5. Comparing the Four Metrics

| Metric | What it measures | A low score indicates |
|---|---|---|
| **Faithfulness** | Whether every claim in the generated answer is supported by the retrieved context | The model is hallucinating or embellishing beyond what was retrieved — a generation-side (prompting/model) problem, assuming retrieval was actually good |
| **Answer relevance** | Whether the generated answer actually addresses the question asked | The model is generating an off-topic, incomplete, or overly generic answer even though it may be faithfully using the context it was given |
| **Context precision** | Whether the chunks retrieval returned are actually relevant to the question | The retriever (or reranker) is surfacing noisy, irrelevant, or loosely related chunks — a retrieval-side problem, not a generation problem |
| **Context recall** | Whether retrieval found everything in the corpus that's actually relevant | The retriever is missing relevant chunks entirely — could be a `k` set too low (Phase 8), an embedding mismatch (Phase 2), or a chunking boundary that split the needed information awkwardly (Phase 4) |

Notice the diagnostic value: a low faithfulness score *combined with* low context precision or recall tells you the model is behaving reasonably given what it was handed — the real fix is upstream, in retrieval, not in the prompt. A low faithfulness score *combined with* high context precision and recall (retrieval did its job, but the model still hallucinated) tells you the problem really is in generation — the prompt, the model choice, or the instructions.

---

## 6. Common Mistakes

**Mistake 1: Only checking answer quality, never checking whether retrieval itself was good.** This is the single most common evaluation mistake, and it directly follows from Section 3's generation/retrieval split. If you only ever look at the final generated answer and judge "does this seem right," a bad answer caused by bad retrieval (low context precision or recall) looks identical, from the outside, to a bad answer caused by bad generation (low faithfulness or relevance) — both just look like "a wrong answer." Teams that only measure the final answer end up "fixing" a retrieval problem by endlessly tweaking the prompt — adding instructions like "be more careful" or "only use the context provided" — when the actual fix was upstream (a chunking change, a different embedding model, a wider `k`). This is exactly what the plan calls masking a retrieval problem as a prompting problem: the symptom shows up at generation time, but the root cause is retrieval, and no amount of prompt engineering fixes a root cause it can't reach.

**Mistake 2: Treating a single evaluation run as a permanent verdict.** A RAG system's quality isn't static — a new batch of documents, a chunking parameter change, or an embedding model upgrade can shift context precision and recall without anyone noticing until users start complaining. Evaluation metrics are most useful when run repeatedly (ideally automatically, on every meaningful pipeline change) against a stable test set, so a regression shows up as a number moving, not as a vague sense that "answers seem worse lately."

**Interview angle:** "How would you evaluate whether a RAG system is any good?" is a standard systems-design follow-up once a candidate has described the retrieve-then-generate architecture. A strong answer separates retrieval quality from generation quality explicitly — naming faithfulness and answer relevance as generation-side checks, and context precision and recall as retrieval-side checks — rather than describing one vague "is the answer good" metric. Interviewers are specifically listening for whether the candidate understands that a bad final answer can originate from either side of the pipeline, and that you need separate instrumentation to tell which one it was.

---

## 7. Hands-On Exercises

### Exercise 1 — Run the faithfulness checker on a grounded answer

**Goal:** Confirm the checker in Section 4 correctly rates a properly grounded answer, not just an obviously fabricated one.

Using the same `context` from Section 4 (the refund policy passage), write a new `answer` that only states facts actually present in the context (for example, just "You have 30 days to return an unused item in its original packaging."). Run `check_faithfulness` and confirm the verdict comes back `"grounded"`. Then try a borderline case: an answer that paraphrases the context accurately but adds a plausible-sounding qualifier not stated anywhere (e.g., "...as long as you have your receipt") and observe whether the judge catches it.

### Exercise 2 — Separate a retrieval failure from a generation failure

**Goal:** Practice the diagnostic reasoning from Section 5.

Construct two scenarios by hand: Scenario A — context that is genuinely irrelevant to the question (e.g., context about shipping times, question about refunds) with an answer that faithfully summarizes the (wrong) context. Scenario B — context that is genuinely relevant, paired with an answer that invents a detail not in it. For each scenario, decide: is this primarily a context precision problem, or a faithfulness problem? Run `check_faithfulness` on both and confirm the tool's verdict lines up with your reasoning (remember: the faithfulness checker alone can't distinguish these two cases — it will likely say Scenario A's answer is "grounded," even though the whole answer is useless, because it's faithfully using bad context. That gap is exactly why context precision needs to be measured separately).

### Exercise 3 — Sketch a context precision checker

**Goal:** Extend the LLM-as-judge pattern to a retrieval-side metric.

Without writing full code, describe in your own words how you would adapt `check_faithfulness`'s structure to build a `check_context_precision` function: what would the judge prompt ask instead, what inputs would it need (hint: it doesn't need the generated answer at all), and what would the output represent (a verdict per retrieved chunk, or one score for the whole retrieved set)?

---

## 8. Interview Q&A

### Q1. What are the four RAGAS-style RAG evaluation metrics, in one sentence each?

**Answer:** Faithfulness measures whether every claim in the generated answer is grounded in the retrieved context, rather than invented. Answer relevance measures whether the generated answer actually addresses the question asked. Context precision measures whether the chunks retrieval returned were actually relevant. Context recall measures whether retrieval found everything relevant that exists in the document collection.

---

### Q2. Why do you need both retrieval-side and generation-side metrics, instead of just judging the final answer?

**Answer:** Because a bad final answer looks the same from the outside whether it was caused by bad retrieval (the model was faithfully working with irrelevant or incomplete context) or bad generation (the model hallucinated despite being given good context). Without separate metrics for each side, teams tend to "fix" retrieval problems by endlessly tweaking prompts, which can't fix a root cause it never touches.

---

### Q3. What does a low faithfulness score tell you, and what doesn't it tell you?

**Answer:** A low faithfulness score tells you the generated answer contains claims not supported by the retrieved context — the model added or invented information. It doesn't, by itself, tell you whether the retrieved context was actually any good; a model can be perfectly faithful to context that was completely irrelevant to the question, which is why faithfulness has to be read alongside context precision and recall, not in isolation.

---

### Q4. How would you actually compute a metric like faithfulness in practice?

**Answer:** The common approach is "LLM-as-judge": prompt another LLM call with the question, the retrieved context, and the generated answer, and ask it to determine whether every claim in the answer is supported by the context, returning a structured verdict (and ideally reasoning explaining the decision). Run this over a labeled test set of many question/context/answer triples and aggregate the grounded rate into a single score for the whole system, rather than evaluating one answer in isolation.

---

### Q5. A RAG system's answers seem to have gotten worse after a recent change. How would evaluation metrics help you figure out what broke?

**Answer:** Run the same evaluation suite (all four metrics) before and after the change against a stable test set, and compare. If context precision or recall dropped, the regression is on the retrieval side — likely caused by a chunking, embedding, or indexing change. If those stayed stable but faithfulness or answer relevance dropped, the regression is on the generation side — likely a prompt, model, or context-assembly change. Without measuring both sides separately, you'd only know "it got worse," not which stage caused it.

---

> 🧠 **Memory hook:** "Faithfulness and relevance grade the essay; precision and recall grade the reading list — a good essay on the wrong reading is still a bad answer."
