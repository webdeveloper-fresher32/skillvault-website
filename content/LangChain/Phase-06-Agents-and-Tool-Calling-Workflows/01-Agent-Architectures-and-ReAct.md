# Agent Architectures and ReAct — Complete Guide

> "A detective investigating a crime scene forms a hypothesis, examines a physical clue, observes the result, and iterates until the case is solved."

---

## Table of Contents

1. [The Problem: Fixed Pipelines Cannot Solve Dynamic Tasks](#1-the-problem-fixed-pipelines-cannot-solve-dynamic-tasks)
2. [The Detective Investigation Analogy](#2-the-detective-investigation-analogy)
3. [The Mechanism: The ReAct Loop (Thought-Action-Observation)](#3-the-mechanism-the-react-loop-thought-action-observation)
4. [Diagram: The ReAct Autonomous Reasoning Cycle](#4-diagram-the-react-autonomous-reasoning-cycle)
5. [Code Walkthrough: Deconstructing the ReAct Loop](#5-code-walkthrough-deconstructing-the-react-loop)
6. [Comparing Chains vs Agents](#6-comparing-chains-vs-agents)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Fixed Pipelines Cannot Solve Dynamic Tasks

Standard LCEL chains (`prompt | model | parser`) follow hardcoded, predetermined directed acyclic execution paths (DAGs).

### Hardcoded Chains vs Dynamic Agent Loops

```text
Fixed Chain Scenario:
  Chain defined: [Fetch User] ──▶ [Search Weather] ──▶ [Format Email]
  If the user asks: "What is the capital of France?"
  → The chain still blindly calls the weather API and formats an email.
  → Cannot dynamically decide WHICH tools to call, in WHAT order, or HOW MANY times.
```

### The Solution: Autonomous Agents

An Agent uses the LLM as a dynamic reasoning engine to analyze the problem, choose appropriate tools iteratively, observe tool outputs, and decide when the task is complete.

---

## 2. The Detective Investigation Analogy

A homicide detective does not follow a rigid mechanical checklist printed three weeks before the crime occurred.

### Fixed Checklist vs Iterative Detective

```text
Rigid Checklist  → Step 1: Dust the front door. Step 2: Interview the butler.
                   (Even if the front door is missing and there is no butler!).

Iterative Detective → 1. Thought: The window is broken. Action: Check footprints.
                      2. Observation: Footprints lead to the garden shed.
                      3. Thought: I must inspect the shed. Action: Open shed.
                      4. Observation: Found stolen jewels.
                      5. Final Answer: The thief hid in the garden shed.
```

### Mapping to LangChain

The LLM generates the **Thought**; selects the tool **Action**; your runtime provides the tool **Observation**; repeating until reaching the **Final Answer**.

---

## 3. The Mechanism: The ReAct Loop (Thought-Action-Observation)

The **ReAct** (Reasoning + Acting) paradigm interleaves verbal reasoning traces with domain-specific tool actions.

### Core ReAct Loop Steps

```text
1. User Input: "What is the population of Tokyo divided by the population of Kyoto?"
2. Thought: I need to find the population of Tokyo first.
3. Action: search("population of Tokyo")
4. Observation: 14 million (approx).
5. Thought: Now I need to find the population of Kyoto.
6. Action: search("population of Kyoto")
7. Observation: 1.46 million (approx).
8. Thought: Now I need to divide 14,000,000 by 1,460,000 using calculator.
9. Action: calculator("14000000 / 1460000")
10. Observation: 9.589
11. Thought: I have all the facts to answer the user.
12. Final Answer: Tokyo's population is approximately 9.59 times that of Kyoto.
```

---

## 4. Diagram: The ReAct Autonomous Reasoning Cycle

### The Agent Execution Loop

```text
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. LLM Reasoning Step                                       │
│    Inspects Goal + History + Scratchpad                     │
│    Generates: "Thought" & "Action"                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │ (Action Requested)        │ (Task Complete)
                 ▼                           ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ 2. Tool Execution            │ │ 4. Final Answer Output     │
│    Runs selected tool with   │ │    Delivers response to    │
│    extracted JSON arguments  │ │    the end user            │
└──────────────┬───────────────┘ └────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Observation Feedback                                     │
│    Appends Tool Output into Agent Scratchpad                │
└──────────────┬──────────────────────────────────────────────┘
               │
               └───────────────▶ Loops back to Step 1
```

---

## 5. Code Walkthrough: Deconstructing the ReAct Loop

A pure Python script demonstrating the fundamental Thought-Action-Observation cycle:

```python
# react_loop_deconstructed.py
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

@tool
def search_knowledge_base(query: str) -> str:
    """Search company documentation for facts."""
    facts = {
        "headcount": "SkillVault has 42 active engineers across 6 countries.",
        "founded": "SkillVault was founded in 2024."
    }
    return facts.get(query.lower(), "Information not found.")

def run_agentic_react_loop(question: str):
    llm = ChatOpenAI(model="gpt-4o", temperature=0).bind_tools([search_knowledge_base])
    messages = [HumanMessage(content=question)]
    tools_map = {"search_knowledge_base": search_knowledge_base}

    for step in range(5):  # Safety loop bound
        ai_msg = llm.invoke(messages)
        messages.append(ai_msg)

        # Check if agent is done (no more tool calls)
        if not ai_msg.tool_calls:
            return ai_msg.content

        for tool_call in ai_msg.tool_calls:
            selected_tool = tools_map[tool_call["name"]]
            observation = selected_tool.invoke(tool_call["args"])
            messages.append(ToolMessage(
                content=str(observation),
                tool_call_id=tool_call["id"]
            ))

    return "Agent exceeded maximum iteration steps."

if __name__ == "__main__":
    result = run_agentic_react_loop("When was SkillVault founded and how many engineers work there?")
    print("Agent Result:", result)
```

---

## 6. Comparing Chains vs Agents

| Dimension | LCEL Chains | Autonomous Agents |
|---|---|---|
| Control Flow | Static Directed Acyclic Graph (DAG) | Dynamic Cyclical Loop ($N$ iterations) |
| Tool Selection | Pre-wired at code authoring time | Decided at runtime by LLM based on query |
| Error Recovery | Fails unless explicit fallback pre-coded | Self-corrects by trying alternative tools |
| Predictability | High (deterministic latency & cost) | Variable (depends on reasoning steps taken) |
| Best Used For | RAG pipelines, data transformations, APIs | Open-ended research, multi-step troubleshooting |

---

## 7. Common Mistakes

- **Using agents for deterministic linear workflows.** If task steps are always $A \to B \to C$, using an agent wastes tokens and adds unpredictable latency; use an LCEL chain instead.
- **Unbounded execution loops.** Never run an agent loop without a strict `max_iterations` counter; stuck agents can burn through thousands of dollars of API tokens.
- **Vague tool names.** An agent with tools named `helper_1` and `helper_2` will fail to reason about which action to choose.
- **Not exposing intermediate steps.** Hiding the agent's thought process makes debugging impossible when an agent goes down the wrong reasoning rabbit hole.
- **Overloading an agent with 50+ tools.** Giving a single agent too many tools degrades decision accuracy; partition tools into specialized sub-agents.

---

## 8. Hands-On Exercises

**Exercise 1:** Trace a manual 3-step ReAct loop on paper for calculating currency conversions given a live FX rate tool.

**Exercise 2:** Implement a mock search tool and run an agent loop that requires 2 distinct tool calls to synthesize an answer.

**Exercise 3:** Add logging to print `[Thought]`, `[Action]`, and `[Observation]` at each step of an agent's execution.

**Exercise 4:** Intentionally provide an incorrect tool output and observe how the LLM attempts a follow-up action to recover.

**Exercise 5:** Set an agent loop maximum limit to 2 and verify that an open-ended question terminates gracefully without an infinite loop.

---

## 9. Interview Q&A

**Q: What does the ReAct acronym stand for and why is it significant?**
ReAct stands for **Reasoning + Acting**. It is significant because it combines verbal reasoning traces ("Thought") with real-world tool execution ("Action" and "Observation"), allowing LLMs to solve complex multi-step problems that neither pure reasoning nor pure tool calling could solve alone.

**Q: When should an engineer choose an LCEL chain over an Agent?**
When the execution flow is known in advance and deterministic (e.g. standard RAG: retrieve $\to$ stuff $\to$ answer). Agents should only be chosen when the sequence of steps, tool choices, or iteration counts cannot be predicted beforehand.

**Q: What is an agent "scratchpad"?**
The agent scratchpad is the ongoing history of intermediate thoughts, tool calls, and tool observations passed back to the LLM on each subsequent loop iteration so the model remembers what it has already tried.

**Q: How does modern tool calling improve on early ReAct string parsing?**
Early ReAct relied on fragile regex string parsing of "Thought: ... Action: ...". Modern tool calling uses model provider APIs with JSON-constrained decoding, eliminating syntax errors and enabling native parallel tool dispatch.

**Q: What prevents an agent from looping indefinitely when a tool fails?**
A strictly enforced `max_iterations` limit or timeout guard in the agent runtime, paired with error-handling prompts that inform the model the tool failed and urge it to summarize or try a different approach.
