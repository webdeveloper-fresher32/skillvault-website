# Project 1: Autonomous Research and Writer Agent

> **Difficulty**: Advanced | **Estimated Time**: 6–8 hours | **Stack**: LangGraph, LangChain, ChatOpenAI, MemorySaver

---

## 1. Project Overview

In this capstone project, you will build an end-to-end autonomous research and long-form report generation system. The agent plans a research outline, executes multi-query web searches, extracts and deduplicates facts, writes draft sections, reviews them against quality rubrics, and compiles a publication-ready Markdown report.

```text
User Topic: "Future of Solid-State Batteries in Commercial Aviation"
     │
     ▼
[1. Outline Planner] ──▶ [2. Research Subgraph (Parallel Searches)]
                                   │
     ┌─────────────────────────────┘
     ▼
[3. Section Writer] ──▶ [4. Fact Checker & Reviewer] ──▶ [5. Final Assembler] ──▶ [Output]
                                  │ (If quality score < 85)
                                  └─▶ (Loop to Section Writer with feedback)
```

---

## 2. Architecture & State Schema

The system uses a custom `StateGraph` with a structured `TypedDict` schema and channel reducers to track sections and research findings.

```python
from typing import TypedDict, Annotated, List, Dict
import operator

class Section(TypedDict):
    title: str
    content: str
    status: str

class ResearchState(TypedDict):
    topic: str
    outline: List[str]
    # Reducers accumulate research findings from parallel worker iterations
    research_notes: Annotated[List[str], operator.add]
    sections: Annotated[List[Section], operator.add]
    review_feedback: str
    quality_score: int
    final_report: str
```

---

## 3. Step-by-Step Implementation

### Step 1: Research and Planning Nodes

```python
# research_writer_agent.py
from typing import TypedDict, Annotated, List
import operator
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

llm = ChatOpenAI(model="gpt-4o", temperature=0)

class Outline(BaseModel):
    sections: List[str] = Field(description="3 to 5 section headings for the research report.")

outline_llm = llm.with_structured_output(Outline)

def plan_outline_node(state: ResearchState) -> dict:
    prompt = f"Create a detailed 3-section research outline for the topic: '{state['topic']}'."
    out = outline_llm.invoke(prompt)
    return {"outline": out.sections, "research_notes": []}

def gather_research_node(state: ResearchState) -> dict:
    notes = []
    for heading in state["outline"]:
        # Simulates targeted web research
        notes.append(f"Research Data for [{heading}]: Breakthrough density of 450 Wh/kg achieved in 2025 lab trials.")
    return {"research_notes": notes}
```

### Step 2: Section Writer Node

```python
def draft_sections_node(state: ResearchState) -> dict:
    drafts = []
    notes_str = "\n".join(state["research_notes"])
    for heading in state["outline"]:
        prompt = (
            f"Write a comprehensive section titled '{heading}' for the report on '{state['topic']}'.\n"
            f"Incorporate these research notes:\n{notes_str}\n"
            f"Previous review feedback (if any): {state.get('review_feedback', 'None')}"
        )
        resp = llm.invoke(prompt)
        drafts.append({"title": heading, "content": resp.content, "status": "DRAFTED"})
    return {"sections": drafts}
```

### Step 3: Reviewer and Quality Scoring Node

```python
class ReviewResult(BaseModel):
    score: int = Field(description="Quality score between 0 and 100.")
    feedback: str = Field(description="Specific constructive critique.")

review_llm = llm.with_structured_output(ReviewResult)

def review_quality_node(state: ResearchState) -> dict:
    combined_draft = "\n\n".join([f"## {s['title']}\n{s['content']}" for s in state["sections"]])
    prompt = (
        f"Evaluate this research report draft on '{state['topic']}':\n\n{combined_draft}\n\n"
        "Grade on technical depth, factual rigor, and coherence."
    )
    res = review_llm.invoke(prompt)
    return {"quality_score": res.score, "review_feedback": res.feedback}

def should_revise_router(state: ResearchState) -> str:
    if state["quality_score"] >= 80:
        return "assemble"
    return "revise"
```

### Step 4: Final Report Assembler Node

```python
def assemble_final_report_node(state: ResearchState) -> dict:
    header = f"# Master Research Report: {state['topic']}\n\n"
    sections_text = "\n\n".join([f"## {s['title']}\n\n{s['content']}" for s in state["sections"]])
    footer = f"\n\n---\n*Report compiled autonomously by LangGraph Agent (Quality Score: {state['quality_score']}/100)*"
    return {"final_report": header + sections_text + footer}
```

### Step 5: Graph Assembly and Execution

```python
def build_research_agent_graph():
    builder = StateGraph(ResearchState)
    builder.add_node("planner", plan_outline_node)
    builder.add_node("researcher", gather_research_node)
    builder.add_node("writer", draft_sections_node)
    builder.add_node("reviewer", review_quality_node)
    builder.add_node("assembler", assemble_final_report_node)

    builder.add_edge(START, "planner")
    builder.add_edge("planner", "researcher")
    builder.add_edge("researcher", "writer")
    builder.add_edge("writer", "reviewer")

    # Cyclical Quality Loop: If quality score < 80, loop back to writer!
    builder.add_conditional_edges(
        "reviewer",
        should_revise_router,
        {"revise": "writer", "assemble": "assembler"}
    )
    builder.add_edge("assembler", END)

    checkpointer = MemorySaver()
    return builder.compile(checkpointer=checkpointer)

if __name__ == "__main__":
    app = build_research_agent_graph()
    thread_cfg = {"configurable": {"thread_id": "report_job_001"}}

    print("=== Launching Autonomous Research Agent ===")
    initial_input = {"topic": "Next-Generation Solid-State Battery Electrolytes"}
    final_output = app.invoke(initial_input, config=thread_cfg)

    print("\n=== Final Compiled Report ===")
    print(final_output["final_report"])
```

---

## 4. Verification & Testing

1. **Verify Outline Planning**: Ensure `planner` emits exactly 3 distinct headings.
2. **Verify Cyclical Review**: Mock a review score of 70 on iteration 1 and verify the graph loops back to `writer`.
3. **Verify State Persistence**: Fetch historical snapshots with `app.get_state_history(config)` and verify state evolution across iterations.

---

## 5. Extensions & Challenges

- **Real-Time Web Search**: Replace the dummy research generator with Tavily or DuckDuckGo search APIs.
- **Dynamic Map-Reduce**: Use the `Send` API to research each outline section in parallel.
- **Human-in-the-Loop Outline Gate**: Add `interrupt()` after `planner` to let a human edit the outline before research begins.
