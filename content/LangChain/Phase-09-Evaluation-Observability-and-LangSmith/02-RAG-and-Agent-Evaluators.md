# RAG and Agent Evaluators — Complete Guide

> "A panel of three certified Olympic judges independently scores a gymnastics routine on difficulty, execution precision, and landing stability according to strict official criteria."

---

## Table of Contents

1. [The Problem: Evaluating Non-Deterministic AI Systems](#1-the-problem-evaluating-non-deterministic-ai-systems)
2. [The Olympic Gymnastics Judges Analogy](#2-the-olympic-gymnastics-judges-analogy)
3. [The Mechanism: The RAG Triad and LLM-as-a-Judge](#3-the-mechanism-the-rag-triad-and-llm-as-a-judge)
4. [Diagram: The RAG Evaluation Triad Framework](#4-diagram-the-rag-evaluation-triad-framework)
5. [Code Walkthrough: Production RAG Evaluator with LangSmith and Ragas](#5-code-walkthrough-production-rag-evaluator-with-langsmith-and-ragas)
6. [Comparing Evaluation Methodologies](#6-comparing-evaluation-methodologies)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Evaluating Non-Deterministic AI Systems

Traditional unit tests (`assert response == "expected_string"`) fail because LLM outputs vary across runs while remaining semantically correct.

### Why Exact String Assertions Break

```text
Expected Answer: "Redis AOF logs all write operations."
Model Output 1:  "Redis logs every write command to an append-only file."
→ Traditional assert fails (0% exact match). But the answer is 100% correct!

Hallucinated Output: "Redis AOF deletes all data on restart."
→ Traditional assert fails, but gives no insight into WHY it failed or where.
```

### The Solution: LLM-as-a-Judge and RAG Triad Metrics

Use evaluator LLMs with structured grading rubrics to measure semantic correctness, context relevance, and hallucinations.

---

## 2. The Olympic Gymnastics Judges Analogy

Olympic judges do not require a gymnast to jump to the exact millimeter coordinate as previous athletes.

### Millimeter Laser vs Certified Judging Panel

```text
Laser Coordinate  → Athlete lands 2mm to the left of target;
                    laser fails the performance as an error (too rigid).

Certified Judges  → Judge 1 evaluates Difficulty (Was the routine complex?);
                    Judge 2 evaluates Execution (Was it faithful to form?);
                    Judge 3 evaluates Landing (Did they stick the landing?).
```

### Mapping to LangChain

The three judges correspond to the **RAG Triad**: Context Relevance, Faithfulness (Groundedness), and Answer Relevance.

---

## 3. The Mechanism: The RAG Triad and LLM-as-a-Judge

RAG applications are evaluated across three orthogonal pillars:

### The 3 Core Evaluation Metrics

```text
1. Context Relevance:
   Are the retrieved chunks actually relevant to the user question?
   (Evaluates Retriever quality; catches noise and irrelevant documents).

2. Faithfulness (Groundedness):
   Is the generated answer strictly supported by the retrieved context?
   (Catches LLM hallucinations and invented facts).

3. Answer Relevance:
   Does the generated answer directly address the user's question?
   (Catches evasive answers or off-topic responses).
```

### LangSmith Dataset Evaluation API

```python
from langsmith import Client
from langsmith.evaluation import evaluate

client = Client()
# Evaluate target chain against a golden dataset in LangSmith
# results = evaluate(my_rag_chain, data="prod-qa-dataset", evaluators=[...])
```

---

## 4. Diagram: The RAG Evaluation Triad Framework

### Triad Metric Relationships

```text
                    User Question
                     /         \
                    /           \
  [Context Relevance]           [Answer Relevance]
                  /               \
                 ▼                 ▼
          Retrieved Context ─────▶ Generated Answer
                     [Faithfulness]
```

### Evaluation Decision Matrix

```text
┌─────────────────────────┬──────────────────────────┬────────────────────────┐
│ Metric Failure          │ Root Cause               │ Engineering Fix        │
├─────────────────────────┼──────────────────────────┼────────────────────────┤
│ Low Context Relevance   │ Poor retrieval           │ Add reranking / hybrid │
│ Low Faithfulness        │ Model hallucinates       │ Lower temp / strict sys│
│ Low Answer Relevance    │ Model wanders off-topic  │ Improve prompt template│
└─────────────────────────┴──────────────────────────┴────────────────────────┘
```

---

## 5. Code Walkthrough: Production RAG Evaluator with LangSmith and Ragas

A complete evaluation script running LLM-as-a-judge on RAG outputs:

```python
# rag_evaluator_demo.py
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

class FaithfulnessGrade(BaseModel):
    reasoning: str = Field(description="Step-by-step audit of claims against context")
    score: int = Field(ge=1, le=5, description="1 = completely hallucinated, 5 = 100% faithful")

class AnswerRelevanceGrade(BaseModel):
    reasoning: str = Field(description="Explanation of how well answer addresses query")
    score: int = Field(ge=1, le=5, description="1 = off-topic, 5 = directly answers query")

def evaluate_rag_output(question: str, context: str, answer: str):
    eval_llm = ChatOpenAI(model="gpt-4o", temperature=0)

    # 1. Faithfulness Evaluator
    faith_prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an impartial auditor. Grade whether the answer is strictly derived from the context."),
        ("human", "Context:\n{context}\n\nAnswer:\n{answer}\n\nEvaluate faithfulness.")
    ])
    faith_chain = faith_prompt | eval_llm.with_structured_output(FaithfulnessGrade)
    faith_result = faith_chain.invoke({"context": context, "answer": answer})

    # 2. Relevancy Evaluator
    rel_prompt = ChatPromptTemplate.from_messages([
        ("system", "Grade whether the answer addresses the user's question directly."),
        ("human", "Question:\n{question}\n\nAnswer:\n{answer}\n\nEvaluate relevancy.")
    ])
    rel_chain = rel_prompt | eval_llm.with_structured_output(AnswerRelevanceGrade)
    rel_result = rel_chain.invoke({"question": question, "answer": answer})

    return {
        "faithfulness": {"score": faith_result.score, "reason": faith_result.reasoning},
        "relevancy": {"score": rel_result.score, "reason": rel_result.reasoning}
    }

if __name__ == "__main__":
    q = "What is the capital of Mars?"
    ctx = "Mars is the fourth planet from the Sun. It has no capital cities as it is uninhabited."
    ans = "Mars does not have a capital city because no humans inhabit the planet."
    scores = evaluate_rag_output(q, ctx, ans)
    print("Evaluation Results:", scores)
```

---

## 6. Comparing Evaluation Methodologies

| Methodology | Speed | Cost | Semantic Nuance | Best Used For |
|---|---|---|---|---|
| Exact Match (`==`) | Instant (<1ms) | Free | Zero (fails on synonyms) | Deterministic keyword checks |
| ROUGE / BLEU | Fast (~5ms) | Free | Very Low (n-gram overlap only) | Machine translation benchmarks |
| Embedding Cosine Sim | Fast (~10ms) | Low | Medium (semantic proximity) | Quick similarity screening |
| LLM-as-a-Judge | Moderate (~1s) | Moderate | Highest (understands reasoning & nuance) | Production quality gates & CI/CD |

---

## 7. Common Mistakes

- **Using the same model to generate and evaluate.** Evaluating `gpt-4o` outputs with `gpt-4o-mini` can miss subtle errors; use frontier models or distinct architectures for evaluation.
- **Evaluating without reasoning rationale.** Asking the evaluator for a raw score (e.g. `{"score": 4}`) without chain-of-thought `reasoning` produces unstable, noisy grades.
- **Testing on synthetic datasets only.** Synthetic questions lack messy real-world typos and ambiguous phrasing; always curate evaluation datasets from real production logs.
- **Ignoring the Context Relevance metric.** If your retriever returns garbage chunks, even a perfect LLM cannot generate a faithful and relevant response.
- **Not setting temperature=0 on evaluator models.** Evaluators must be deterministic; non-zero temperatures introduce variance across CI test runs.

---

## 8. Hands-On Exercises

**Exercise 1:** Create an LLM-as-a-judge chain with a Pydantic schema grading answer conciseness on a scale of 1 to 5.

**Exercise 2:** Intentionally introduce a hallucinated claim into a RAG response and verify that the Faithfulness evaluator detects it and assigns a low score.

**Exercise 3:** Build a LangSmith Golden Dataset containing 5 question-context-ground_truth triples using the LangSmith SDK.

**Exercise 4:** Run a batch evaluation comparing prompt version A vs prompt version B across your golden dataset.

**Exercise 5:** Set up an evaluation threshold in Python that raises an assertion error if average faithfulness drops below 4.0/5.0.

---

## 9. Interview Q&A

**Q: What are the three pillars of the RAG Triad?**
1. **Context Relevance**: Measures if the retriever fetched documents relevant to the query.
2. **Faithfulness**: Measures if the LLM's answer is grounded entirely in the retrieved context without hallucinations.
3. **Answer Relevance**: Measures if the generated response directly answers the user's question.

**Q: What is "LLM-as-a-Judge"?**
LLM-as-a-Judge is an evaluation paradigm where a high-capability frontier LLM (e.g. GPT-4o, Claude 3.5 Sonnet) is provided with explicit evaluation rubrics, reference ground truth, and candidate outputs to judge quality, reasoning, and adherence to constraints.

**Q: Why is chain-of-thought reasoning crucial in evaluator prompts?**
Requiring the evaluator to generate step-by-step reasoning *before* outputting a numerical score significantly improves grading consistency, calibrates scoring boundaries, and provides human engineers with actionable debugging notes.

**Q: What is the difference between Reference-Based and Reference-Free evaluation?**
Reference-Based evaluation compares the model output against a human-verified "golden" ground truth answer (e.g. semantic similarity). Reference-Free evaluation assesses quality directly from the question, retrieved context, and answer without needing a pre-written golden answer (e.g. faithfulness and relevancy).

**Q: How do you prevent judge model bias in LLM evaluation?**
By swapping the order of candidate answers (preventing position bias), providing explicit few-shot scoring rubrics, using strict structured outputs with Pydantic, and conducting periodic human-in-the-loop spot checks.
