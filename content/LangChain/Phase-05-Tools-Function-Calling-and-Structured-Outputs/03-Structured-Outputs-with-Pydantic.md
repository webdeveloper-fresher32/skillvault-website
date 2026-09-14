# Structured Outputs with Pydantic — Complete Guide

> "A bank coin-sorting machine feeds mixed coins through calibrated mechanical slots, guaranteeing that every dime, nickel, and quarter lands in its exact labeled tray with zero sorting errors."

---

## Table of Contents

1. [The Problem: Unreliable Schema Extraction](#1-the-problem-unreliable-schema-extraction)
2. [The Coin-Sorting Machine Analogy](#2-the-coin-sorting-machine-analogy)
3. [The Mechanism: with_structured_output](#3-the-mechanism-with_structured_output)
4. [Diagram: Structured Output Extraction Pipeline](#4-diagram-structured-output-extraction-pipeline)
5. [Code Walkthrough: Production Entity Extraction with Pydantic](#5-code-walkthrough-production-entity-extraction-with-pydantic)
6. [Comparing Output Parsers vs with_structured_output](#6-comparing-output-parsers-vs-with_structured_output)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Unreliable Schema Extraction

Prompt-based JSON generation often fails with markdown backticks (` ```json `), missing closing brackets, or invalid data types on complex nested schemas.

### The JSON Parsing Fragility

```text
Prompt: "Extract user details and return JSON."
Raw Model Output:
  "Sure! Here is the JSON: { 'name': 'Alice', 'age': 'thirty' }"
  → Single quotes break standard JSON decoders (JSONDecodeError)
  → String "thirty" violates integer field requirement (TypeError)
  → Downstream database write crashes
```

### The Solution: Native `.with_structured_output()`

LangChain's `.with_structured_output()` binds a schema directly to the model's constrained decoding API, guaranteeing that output is returned as an instantiated, fully validated Pydantic object.

---

## 2. The Coin-Sorting Machine Analogy

A bank does not hire a human to visually glance at a bucket of coins and type estimated counts into a spreadsheet.

### Visual Guessing vs Mechanical Sorter

```text
Visual Guessing  → Teller glances at a mixed jar and writes "about $45";
                   mistakes foreign coins for quarters (error-prone).

Mechanical Slot  → Calibrated slots physically only admit exact diameters.
                   A dime physically cannot enter the quarter chute.
                   Guarantees 100% sorting accuracy by physical constraint.
```

### Mapping to LangChain

`.with_structured_output(Schema)` acts as the calibrated mechanical slot: the LLM's token sampling probabilities are constrained to only generate tokens conforming to the Pydantic schema.

---

## 3. The Mechanism: with_structured_output

Frontier chat models support `.with_structured_output(schema, method="function_calling" | "json_mode")`.

### Core Structured Output APIs

```python
from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI

# 1. Define strict domain schema
class ServerIncidentReport(BaseModel):
    incident_id: str = Field(description="Unique incident ID e.g. INC-9021")
    severity: str = Field(description="Severity: low, medium, high, or critical")
    impacted_services: List[str] = Field(description="List of affected microservice names")
    downtime_minutes: Optional[int] = Field(default=0, description="Downtime in minutes")

# 2. Attach schema to chat model
llm = ChatOpenAI(model="gpt-4o", temperature=0)
structured_llm = llm.with_structured_output(ServerIncidentReport)

# 3. Direct invocation returns validated Pydantic object
report: ServerIncidentReport = structured_llm.invoke(
    "Production outage INC-404: Auth service and Billing gateway crashed for 45 minutes."
)
```

---

## 4. Diagram: Structured Output Extraction Pipeline

### Constrained Generation Flow

```text
User Input Text: "Outage INC-404: Auth service crashed for 45 minutes."
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. with_structured_output(ServerIncidentReport)             │
│    - Converts Pydantic model to function/schema definition  │
│    - Forces tool_choice or JSON schema mode on model API    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Constrained Model Inference                              │
│    Model outputs exact JSON arguments matching schema       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Pydantic Runtime Validation                              │
│    - Checks field types (e.g. downtime_minutes: int)        │
│    - Instantiates ServerIncidentReport instance             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
ServerIncidentReport(incident_id='INC-404', severity='critical', ...)
```

---

## 5. Code Walkthrough: Production Entity Extraction with Pydantic

A production-ready data extraction pipeline demonstrating nested Pydantic models, enums, and field validations:

```python
# structured_output_demo.py
from typing import List
from enum import Enum
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

class SkillLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"

class DeveloperProfile(BaseModel):
    candidate_name: str = Field(description="Full name of developer")
    primary_language: str = Field(description="Primary programming language")
    skill_level: SkillLevel = Field(description="Assessed technical skill level")
    core_technologies: List[str] = Field(description="List of 3-5 frameworks or databases")
    years_experience: int = Field(ge=0, description="Total years in software engineering")

def extract_candidate_profile(raw_resume_text: str) -> DeveloperProfile:
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    structured_extractor = llm.with_structured_output(DeveloperProfile)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an automated technical recruiter. Extract structured profile data."),
        ("human", "Resume snippet:\n\n{text}")
    ])

    chain = prompt | structured_extractor
    return chain.invoke({"text": raw_resume_text})

if __name__ == "__main__":
    resume = "Alex Rivera is a Senior Backend Engineer with 8 years building cloud microservices in Go, Kubernetes, and PostgreSQL."
    profile = extract_candidate_profile(resume)
    print("Candidate:", profile.candidate_name)
    print("Level:", profile.skill_level.value)
    print("Tech:", profile.core_technologies)
```

---

## 6. Comparing Output Parsers vs with_structured_output

| Feature | `PydanticOutputParser` | `with_structured_output()` |
|---|---|---|
| Underlying Mechanism | Injected prompt formatting instructions | Native API function calling / constrained decoding |
| Token Usage | Consumes prompt tokens for schema strings | Sent via dedicated API schema parameter |
| Markdown Noise | Parser must strip code fences (` ```json `) | Model outputs clean JSON payload natively |
| Reliability | ~85–92% on complex nested schemas | ~99%+ with frontier models (GPT-4o, Claude 3.5) |
| Output Type | Instantiated Pydantic model | Instantiated Pydantic model or `TypedDict` |

---

## 7. Common Mistakes

- **Using complex regex validators unsupported by JSON Schema.** While Pydantic supports arbitrary Python validators (`@validator`), JSON Schema sent to the model only supports standard JSON Schema primitives.
- **Forgetting `Field(description="...")`.** LLMs use field descriptions to understand what values to generate; empty descriptions reduce extraction accuracy on ambiguous fields.
- **Passing unstructured string prompts without formatting instructions.** Even with structured output, a clear system prompt explaining the extraction task improves edge-case accuracy.
- **Not handling `include_raw=True`.** When debugging extraction errors, use `.with_structured_output(Schema, include_raw=True)` to inspect both the raw message and parsed object.
- **Using models without function calling support.** Legacy or older open-source models may not support native function calling; use `method="json_mode"` or prompt-based output parsers instead.

---

## 8. Hands-On Exercises

**Exercise 1:** Define a Pydantic schema for an `ECommerceProduct` (title, price, in_stock, tags) and extract it from a product review text using `with_structured_output`.

**Exercise 2:** Create an extraction model using `TypedDict` instead of `BaseModel` and verify the returned object is a standard Python dictionary.

**Exercise 3:** Use `include_raw=True` in `.with_structured_output()` and inspect the resulting dictionary containing `"raw"`, `"parsed"`, and `"parsing_error"`.

**Exercise 4:** Implement an Enum field for order status (`"PENDING"`, `"SHIPPED"`, `"DELIVERED"`) and assert that the extracted output strictly matches one of the enum values.

**Exercise 5:** Build a batch extraction chain that processes 3 customer support emails concurrently using `.batch()` and returns 3 validated `SupportTicket` objects.

---

## 9. Interview Q&A

**Q: What makes `.with_structured_output()` superior to `PydanticOutputParser`?**
`.with_structured_output()` uses the model provider's native function calling or grammar-constrained decoding engine. This avoids prompt pollution, eliminates JSON markdown fence errors, and produces near-deterministic schema compliance.

**Q: Can `.with_structured_output()` return a standard Python dictionary instead of a Pydantic model?**
Yes. You can pass a `TypedDict` or a JSON Schema dictionary directly into `.with_structured_output()`, and LangChain will return a standard Python `dict`.

**Q: What does the `include_raw=True` parameter do in `.with_structured_output()`?**
It changes the return format from just the parsed model to a dictionary with three keys: `"raw"` (the raw `AIMessage`), `"parsed"` (the instantiated Pydantic object or None), and `"parsing_error"` (any validation exception encountered).

**Q: How does `with_structured_output` enforce enum constraints?**
When a Pydantic field is typed as a Python `Enum`, LangChain serializes it into a JSON Schema `"enum": ["val1", "val2"]` constraint, which forces the model's token logits to only sample valid enum values.

**Q: What happens under the hood when you call `model.with_structured_output(Schema)`?**
LangChain automatically binds the Pydantic schema as a tool definition using `.bind_tools()`, sets `tool_choice` to force that specific tool, and pipes the output into a `PydanticToolsParser` to return the instantiated model.
