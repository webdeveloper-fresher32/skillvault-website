# Models, Prompts, and Messages — Complete Guide

> "A stage play script specifies exact roles and cues for each actor, rather than shouting an unstructured wall of text at the cast."

---

## Table of Contents

1. [The Problem: Unstructured Text Prompts](#1-the-problem-unstructured-text-prompts)
2. [The Theater Script Analogy](#2-the-theater-script-analogy)
3. [The Mechanism: Chat Models, Message Types, and Templates](#3-the-mechanism-chat-models-message-types-and-templates)
4. [Diagram: Message Flow and Model Processing](#4-diagram-message-flow-and-model-processing)
5. [Code Walkthrough: Constructing Dynamic Chat Pipelines](#5-code-walkthrough-constructing-dynamic-chat-pipelines)
6. [Comparing Raw Text LLMs vs Chat Models](#6-comparing-raw-text-llms-vs-chat-models)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Unstructured Text Prompts

Legacy completion models took a single raw text string and continued predicting characters. Modern instruction-tuned models require structured roles.

### String Concatenation Breakdown

```text
Flawed String Concatenation:
  "System: You are an assistant.\nHuman: " + userInput + "\nAssistant: "
  → Vulnerable to prompt injection (user types "System: Ignore previous rules")
  → Cannot attach multimodal images or structured tool call payloads
  → Breaks provider-native tokenization and conversation boundaries
```

### The Solution: Typed Messages

LangChain represents conversational inputs as strongly-typed message objects: `SystemMessage`, `HumanMessage`, `AIMessage`, and `ToolMessage`.

---

## 2. The Theater Script Analogy

A theatrical play script explicitly labels who is speaking before every line so the cast never mistakes stage directions for dialogue.

### Stage Directions vs Actor Lines

```text
Unstructured Wall  → "The doctor says hello and then the stage light turns
                      red and the patient asks for water" (confusing).

Structured Script  → [STAGE DIRECTION / SYSTEM]: Set hospital room lighting.
                     [DOCTOR / HUMAN]: "How are you feeling today?"
                     [PATIENT / AI]: "I am recovering well, thank you."
```

### Mapping to LLM Roles

The `SystemMessage` sets the stage rules; `HumanMessage` delivers the user's line; `AIMessage` records the model's performance; `ToolMessage` provides backstage data.

---

## 3. The Mechanism: Chat Models, Message Types, and Templates

LangChain abstracts model interaction via `BaseChatModel` and prompt construction via `ChatPromptTemplate`.

### Core Message Classes and Templates

```python
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# 1. Direct message initialization
messages = [
    SystemMessage(content="You are a senior database architect."),
    HumanMessage(content="Explain B-tree indexing in 2 sentences.")
]

# 2. Template with variable substitution and message history placeholder
prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are an assistant for {organization}."),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{user_input}")
])

# Formatting prompt into structured PromptValue
formatted = prompt_template.invoke({
    "organization": "SkillVault Corp",
    "chat_history": [
        HumanMessage(content="Hi"),
        AIMessage(content="Hello! How can I assist you with SkillVault today?")
    ],
    "user_input": "What courses are available?"
})
```

---

## 4. Diagram: Message Flow and Model Processing

### Processing Pipeline

```text
Input Variables (Dict)
   │  {"organization": "SkillVault", "user_input": "..."}
   ▼
┌─────────────────────────────────────────────────────────────┐
│                   ChatPromptTemplate                        │
│  - Formats strings ("system", "human")                      │
│  - Injects dynamic message history via MessagesPlaceholder  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                        PromptValue
             [SystemMessage, HumanMessage, ...]
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    BaseChatModel (e.g. GPT-4o)              │
│  - Converts messages to provider JSON format                │
│  - Executes model inference with temperature/top_p          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                           AIMessage
            content="...", tool_calls=[], usage_metadata={...}
```

---

## 5. Code Walkthrough: Constructing Dynamic Chat Pipelines

A complete script illustrating message parameterization, model invocation, and inspecting generation metadata:

```python
# chat_models_demo.py
import os
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_openai import ChatOpenAI

def run_chat_pipeline():
    # 1. Initialize model with hyper-parameters
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.2,
        max_tokens=250,
        model_kwargs={"seed": 42}
    )

    # 2. Define chat template with dynamic history
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a technical mentor. Tone: {tone}."),
        MessagesPlaceholder("history"),
        ("human", "{query}")
    ])

    # 3. Build LCEL chain
    chain = prompt | llm

    # 4. Invoke with state
    response = chain.invoke({
        "tone": "concise and practical",
        "history": [
            HumanMessage(content="What is LangChain?"),
            AIMessage(content="LangChain is a framework for developing LLM applications.")
        ],
        "query": "How does it handle prompts?"
    })

    # 5. Inspect response content and metadata
    return response.content, response.response_metadata
```

---

## 6. Comparing Raw Text LLMs vs Chat Models

| Feature | Legacy Text LLM (`BaseLLM`) | Modern Chat Model (`BaseChatModel`) |
|---|---|---|
| Native Input Type | Single plain string (`prompt: str`) | List of messages (`messages: List[BaseMessage]`) |
| Native Output Type | Single plain string (`text: str`) | `AIMessage` containing content, metadata & tool calls |
| System Instructions | Concatenated inside raw string | Dedicated `SystemMessage` channel |
| Tool / Function Calling | Manual string parsing required | Native structured `tool_calls` parameter |
| Multi-Modal Support | Not supported natively | Native image/audio blocks inside `HumanMessage` |

---

## 7. Common Mistakes

- **Using plain strings instead of structured message tuples.** Calling `ChatPromptTemplate.from_template("Hello {name}")` treats the entire string as a single HumanMessage instead of separating system instructions.
- **Passing an unformatted list to `MessagesPlaceholder`.** If `MessagesPlaceholder("history")` is defined, the input dictionary key `"history"` must be a list of `BaseMessage` objects, not raw strings.
- **Hardcoding system instructions inside `HumanMessage`.** Modern frontier models apply distinct attention weights to system prompts; combining them into human messages reduces instruction adherence.
- **Ignoring `response_metadata`.** Token usage, finish reasons, and model fingerprints are stored in `AIMessage.response_metadata`, not in `AIMessage.content`.
- **Misunderstanding `temperature=0`.** Temperature 0 reduces randomness but does not guarantee 100% bitwise determinism across GPU clusters unless seed parameters are also locked.

---

## 8. Hands-On Exercises

**Exercise 1:** Construct a `ChatPromptTemplate` using 2-tuples `("system", "...")` and `("human", "{question}")` and print the formatted message list.

**Exercise 2:** Instantiate `ChatOpenAI` or `ChatAnthropic` and invoke it directly with a list containing a `SystemMessage` and a `HumanMessage`.

**Exercise 3:** Create a prompt template that includes a `MessagesPlaceholder` called `"chat_history"`. Test invoking it with an empty list and with a list of 4 messages.

**Exercise 4:** Extract the token usage count (prompt tokens and completion tokens) from the `AIMessage.response_metadata` of a chat model invocation.

**Exercise 5:** Build a chain using `prompt | model` where the system prompt takes a dynamic variable `{persona}` and verify the output changes based on different personas.

---

## 9. Interview Q&A

**Q: What is the structural difference between `BaseLLM` and `BaseChatModel` in LangChain?**
`BaseLLM` takes a plain string and outputs a plain string (completion API), whereas `BaseChatModel` takes a sequence of structured `BaseMessage` objects and returns an `AIMessage` containing content, tool calls, and execution metadata.

**Q: What is the purpose of `MessagesPlaceholder` in a `ChatPromptTemplate`?**
It acts as a dynamic slot where a list of previous `BaseMessage` objects (such as conversation history or agent scratchpads) can be inserted into the prompt without hardcoding a fixed number of turns.

**Q: How do `SystemMessage`, `HumanMessage`, and `AIMessage` map to provider APIs like OpenAI and Anthropic?**
They map directly to the provider's native message roles: `SystemMessage` maps to `role: "system"` (or top-level system parameter in Claude), `HumanMessage` maps to `role: "user"`, and `AIMessage` maps to `role: "assistant"`.

**Q: Where does LangChain store tool call requests generated by a chat model?**
Inside the `AIMessage.tool_calls` attribute as a list of dictionaries, each containing `name`, `args` (parsed JSON/dict), and a unique `id`.

**Q: Why should prompt templates be used instead of standard Python f-strings in production applications?**
Prompt templates provide input validation, seamless serialization/versioning, composition in LCEL pipelines, partial variable binding (`partial`), and native support for multimodal and message history placeholders.
