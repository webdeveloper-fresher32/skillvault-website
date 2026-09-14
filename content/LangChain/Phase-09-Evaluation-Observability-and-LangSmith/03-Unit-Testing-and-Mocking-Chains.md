# Unit Testing and Mocking Chains — Complete Guide

> "A Boeing flight simulator tests autopilot landing algorithms across simulated thunderstorms and engine failures without risking a real aircraft or burning jet fuel."

---

## Table of Contents

1. [The Problem: Flaky and Expensive CI/CD Tests](#1-the-problem-flaky-and-expensive-cicd-tests)
2. [The Flight Simulator Analogy](#2-the-flight-simulator-analogy)
3. [The Mechanism: FakeListChatModel and Mocks](#3-the-mechanism-fakelistchatmodel-and-mocks)
4. [Diagram: Isolated Unit Testing Pipeline](#4-diagram-isolated-unit-testing-pipeline)
5. [Code Walkthrough: Production Pytest Suite for LCEL Chains](#5-code-walkthrough-production-pytest-suite-for-lcel-chains)
6. [Comparing Live Integration Tests vs Mocked Unit Tests](#6-comparing-live-integration-tests-vs-mocked-unit-tests)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Flaky and Expensive CI/CD Tests

Running live LLM API calls in automated CI/CD pipelines (GitHub Actions) causes non-deterministic test failures, slows down build times, and drains API billing budgets.

### The CI Pipeline Dilemma

```text
Live API Calls in CI:
  Pull Request #142 ──▶ Runs 50 pytest cases calling GPT-4o
  → Costs $2.50 per commit ($500/month across dev team)
  → Takes 4.5 minutes to execute
  → Fails randomly due to rate limits (429 Too Many Requests) or network timeouts

Mocked Unit Tests:
  Pull Request #142 ──▶ Runs 50 pytest cases with FakeListChatModel
  → Costs $0.00
  → Executes in 0.8 seconds
  → 100% deterministic, reproducible assertions
```

### The Solution: `FakeListChatModel` & Retriever Mocking

LangChain includes `FakeListChatModel` and standard unittest/pytest mock fixtures to test prompt rendering, parsing logic, and control flow in pure isolation.

---

## 2. The Flight Simulator Analogy

A commercial airline does not test a rookie pilot's emergency response by shutting off real jet engines mid-flight over a populated city.

### Real Boeing 777 vs Level-D Flight Simulator

```text
Real Aircraft Test → Dangerous, costs $15,000/hr in jet fuel;
                     weather conditions cannot be controlled or paused.

Flight Simulator   → Safe hydraulic cockpit running mock physics software;
                     injects windshear at exact millisecond marks deterministically.
```

### Mapping to LangChain

`FakeListChatModel` is the flight simulator: it returns predetermined, hardcoded AI completions to test chain logic safely and instantly.

---

## 3. The Mechanism: FakeListChatModel and Mocks

LangChain provides test doubles in `langchain_community.chat_models.fake`.

### Core Mocking Primitives

```python
from langchain_community.chat_models.fake import FakeListChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# 1. Initialize fake model with sequential responses
fake_llm = FakeListChatModel(responses=[
    "Response 1: Docker is for containerization.",
    "Response 2: Kubernetes is for orchestration."
])

# 2. Compose into standard LCEL chain
prompt = ChatPromptTemplate.from_template("Explain {tech}")
chain = prompt | fake_llm | StrOutputParser()

# 3. Invocation executes synchronously with zero network calls
out1 = chain.invoke({"tech": "Docker"})
out2 = chain.invoke({"tech": "Kubernetes"})
```

---

## 4. Diagram: Isolated Unit Testing Pipeline

### Mocked Component Isolation

```text
Pytest Test Runner (test_rag_pipeline.py)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Chain Under Test (LCEL Runnable Graph)                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
      ┌─────────────┴─────────────┐
      ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────────┐
│ Mocked Vector Retriever   │ │ FakeListChatModel             │
│ Returns: [Mock Document]  │ │ Returns: "Predetermined JSON" │
│ (Zero Vector DB latency)  │ │ (Zero API Token cost)         │
└───────────────────────────┘ └───────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Deterministic Assertions                                 │
│    assert result["status"] == "SUCCESS"                     │
│    assert len(result["citations"]) == 1                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Production Pytest Suite for LCEL Chains

A complete pytest test suite testing prompt formatting, custom parser logic, and mocked retriever integrations:

```python
# test_chains.py
import pytest
from unittest.mock import MagicMock
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_community.chat_models.fake import FakeListChatModel
from pydantic import BaseModel, Field

class OrderSummary(BaseModel):
    order_id: str = Field(description="Order identifier")
    total_amount: float = Field(description="Total USD cost")

def create_order_processing_chain(llm, retriever):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Context: {context}"),
        ("human", "Summarize order: {input}")
    ])
    parser = JsonOutputParser(pydantic_object=OrderSummary)
    return (
        {"context": lambda x: retriever.invoke(x["input"]), "input": lambda x: x["input"]}
        | prompt
        | llm
        | parser
    )

def test_order_chain_success():
    # 1. Mock retriever
    mock_retriever = MagicMock()
    mock_retriever.invoke.return_value = [Document(page_content="Order ORD-99 total is $45.50")]

    # 2. Mock LLM with guaranteed JSON string
    fake_llm = FakeListChatModel(responses=['{"order_id": "ORD-99", "total_amount": 45.50}'])

    # 3. Build & execute chain
    chain = create_order_processing_chain(fake_llm, mock_retriever)
    result = chain.invoke({"input": "Summarize ORD-99"})

    # 4. Assertions
    assert result["order_id"] == "ORD-99"
    assert result["total_amount"] == 45.50
    mock_retriever.invoke.assert_called_once_with("Summarize ORD-99")

def test_order_chain_invalid_json():
    mock_retriever = MagicMock()
    mock_retriever.invoke.return_value = []
    fake_llm = FakeListChatModel(responses=['Malformed string without JSON'])

    chain = create_order_processing_chain(fake_llm, mock_retriever)
    with pytest.raises(Exception):
        chain.invoke({"input": "Summarize ORD-99"})
```

---

## 6. Comparing Live Integration Tests vs Mocked Unit Tests

| Dimension | Live Integration Tests | Mocked Unit Tests (`FakeListChatModel`) |
|---|---|---|
| Execution Speed | Slow (~2–10 seconds per test) | Blazing fast (<10 milliseconds per test) |
| Financial Cost | Consumes billable provider API tokens | 100% Free |
| Flakiness / Reliability | Flaky (Network drops, rate limits, non-determinism) | 100% Deterministic and reproducible |
| Failure Localization | Hard to isolate prompt bug from model drift | Pinpoints exact parsing or transformation logic bug |
| Best Used For | Nightly smoke tests on staging | Fast pre-commit hooks and PR build gates |

---

## 7. Common Mistakes

- **Running live API tests in every Git commit.** This bankrupts test accounts and causes continuous CI failures when OpenAI or Anthropic experience minor API latency spikes.
- **Not testing parser failure edge cases.** Unit tests should verify that output parsers raise informative errors when models return invalid JSON or missing fields.
- **Exhausting `responses` list in `FakeListChatModel`.** If a multi-step agent makes 3 calls but `FakeListChatModel` only has 2 strings in `responses`, it raises an `IndexError`.
- **Mocking at the wrong abstraction layer.** Mocking the whole chain `chain.invoke = MagicMock()` tests nothing; mock the leaf dependencies (`model` and `retriever`) so your LCEL wiring is actually validated.
- **Forgetting to assert mock calls.** Always verify that `mock_retriever.invoke.assert_called_with(...)` was called with the expected transformed query.

---

## 8. Hands-On Exercises

**Exercise 1:** Write a pytest test case using `FakeListChatModel` that verifies an LCEL prompt template substitutes variables correctly.

**Exercise 2:** Create a mock vector store retriever using `unittest.mock.MagicMock` that returns 3 canned `Document` objects.

**Exercise 3:** Test an agent error-handling branch by mocking a tool to throw an exception and asserting the agent returns a fallback message.

**Exercise 4:** Use `pytest.mark.parametrize` to test an output parser against 5 different valid and invalid JSON string variations.

**Exercise 5:** Set up a GitHub Actions workflow YAML file that executes your pytest suite with `LANGCHAIN_API_KEY=""` and zero live credentials.

---

## 9. Interview Q&A

**Q: Why should unit tests for LangChain applications never call live LLM endpoints?**
Live LLM calls introduce non-determinism (semantic drift across runs), network latency, rate limit errors, and unnecessary financial costs into CI/CD pipelines. Unit tests should test application logic, prompt formatting, and parsing deterministically using test doubles.

**Q: What is `FakeListChatModel` and how does it work?**
`FakeListChatModel` is a built-in LangChain test double that accepts a list of predetermined string responses (`responses=["resp1", "resp2"]`). Each successive invocation pops and returns the next string in sequence without making any network requests.

**Q: How do you unit test an agent's multi-step decision loop using mocks?**
By passing a `FakeListChatModel` loaded with an initial `AIMessage(tool_calls=[...])` payload followed by a final `AIMessage("Final answer")` payload, allowing the test to verify that the agent executor dispatches the tool and handles the observation correctly.

**Q: What is the difference between unit testing and evaluation in LLM engineering?**
Unit testing verifies deterministic software behavior (valid JSON parsing, prompt variable injection, schema validation, error boundaries). Evaluation measures non-deterministic output quality (faithfulness, tone, semantic relevance) across large golden datasets.

**Q: How do you mock async runnables (`.ainvoke()`) in pytest?**
By using `unittest.mock.AsyncMock` or `pytest-asyncio`, allowing async LCEL chains to be awaited in test functions without blocking the event loop.
