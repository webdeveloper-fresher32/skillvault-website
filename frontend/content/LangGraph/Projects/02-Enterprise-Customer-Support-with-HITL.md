# Project 2: Enterprise Customer Support with HITL

> **Difficulty**: Advanced | **Estimated Time**: 6–8 hours | **Stack**: LangGraph, FastAPI, PostgreSQL Checkpointer, Human-in-the-Loop Interrupts

---

## 1. Project Overview

Build an enterprise-grade multi-department customer support bot featuring:
- Autonomous triage and intent classification.
- Dynamic tool calling (order status, refund processing).
- **Human-in-the-Loop (HITL) Breakpoints**: Dynamic interrupts that pause execution whenever a refund exceeds $100 or account changes are requested, waiting for a human supervisor to approve or edit the payload before funds transfer.
- Persistent session storage across reboots.

```text
Customer: "I want a refund of $350 for order ORD-8812."
                  │
                  ▼
         [1. Triage Node]
                  │
                  ▼
         [2. Support Agent] (Decides refund tool call)
                  │
                  ▼ (Amount > $100 Threshold Triggered)
   ┌──────────────────────────────┐
   │ 3. `interrupt()` Breakpoint   │
   │    Graph Pauses & Commits    │
   └──────────────┬───────────────┘
                  │
                  ▼ (Execution Yields)
   [Human Supervisor Web Dashboard] ──▶ [Approve / Reject]
                  │
                  ▼ (Command(resume={"approved": True}))
         [4. Execute Refund Node] ──▶ [5. Final Customer Confirmation]
```

---

## 2. State & Intent Schemas

```python
from typing import TypedDict, Annotated, List, Optional
import operator
from pydantic import BaseModel, Field
from langchain_core.messages import BaseMessage

class SupportState(TypedDict):
    customer_id: str
    order_id: Optional[str]
    refund_amount: Optional[float]
    requires_approval: bool
    approval_status: Optional[str]
    messages: Annotated[List[BaseMessage], operator.add]
    resolution_status: str
```

---

## 3. Step-by-Step Implementation

### Step 1: Agent Tools & Dynamic Interrupt Node

```python
# hitl_customer_support.py
from typing import TypedDict, Annotated, List, Optional
import operator
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command

llm = ChatOpenAI(model="gpt-4o", temperature=0)

def support_agent_node(state: SupportState) -> dict:
    last_user_msg = state["messages"][-1].content

    # Simulates intent detection & extraction
    if "refund" in last_user_msg.lower():
        return {
            "order_id": "ORD-8812",
            "refund_amount": 350.0,
            "requires_approval": True,
            "messages": [AIMessage(content="Initiating refund workflow for $350.00...")]
        }
    return {
        "requires_approval": False,
        "resolution_status": "RESOLVED",
        "messages": [AIMessage(content="Your order is currently in transit and scheduled for delivery tomorrow.")]
    }

def human_approval_gate_node(state: SupportState) -> dict:
    if state.get("requires_approval", False) and state.get("refund_amount", 0) > 100.0:
        # Dynamic Interrupt: Halts graph cleanly and yields payload to client
        decision = interrupt({
            "action": "AUTHORIZE_REFUND",
            "customer_id": state["customer_id"],
            "order_id": state["order_id"],
            "amount": state["refund_amount"],
            "message": f"Authorize high-value refund of ${state['refund_amount']} for Order {state['order_id']}?"
        })

        # Resumed execution receives decision payload
        if not decision.get("approved", False):
            return {
                "approval_status": "REJECTED",
                "resolution_status": "CLOSED_REJECTED",
                "messages": [AIMessage(content="Refund request was declined by senior management.")]
            }

    return {
        "approval_status": "APPROVED",
        "resolution_status": "REFUND_ISSUED",
        "messages": [AIMessage(content=f"Refund of ${state['refund_amount']} successfully processed to original payment method.")]
    }
```

### Step 2: Assemble Graph with Persistence

```python
def build_support_system():
    builder = StateGraph(SupportState)
    builder.add_node("agent", support_agent_node)
    builder.add_node("approval_gate", human_approval_gate_node)

    builder.add_edge(START, "agent")
    builder.add_edge("agent", "approval_gate")
    builder.add_edge("approval_gate", END)

    checkpointer = MemorySaver()
    return builder.compile(checkpointer=checkpointer)

if __name__ == "__main__":
    app = build_support_system()
    session_cfg = {"configurable": {"thread_id": "support_sess_404"}}

    # Phase 1: Customer requests refund
    print("--- Phase 1: Customer Submits Request ---")
    req = {
        "customer_id": "cust_vip_99",
        "messages": [HumanMessage(content="I want a refund of $350 for order ORD-8812 because it arrived damaged.")]
    }
    app.invoke(req, config=session_cfg)

    # Phase 2: Check Paused State
    snapshot = app.get_state(session_cfg)
    print(f"Graph Paused at Node: {snapshot.next}")
    if snapshot.tasks and snapshot.tasks[0].interrupts:
        pending_interrupt = snapshot.tasks[0].interrupts[0].value
        print(f"Pending Interrupt Alert:\n{pending_interrupt['message']}")

    # Phase 3: Human Supervisor Reviews & Approves
    print("\n--- Phase 2: Supervisor Submits Approval ---")
    final_state = app.invoke(
        Command(resume={"approved": True, "reviewer_id": "mgr_jenkins"}),
        config=session_cfg
    )

    print("\n--- Phase 3: Execution Finished ---")
    print("Final Status:", final_state["resolution_status"])
    print("Customer Confirmation:\n", final_state["messages"][-1].content)
```

---

## 4. Verification & Testing

1. **Verify Automatic Pass-Through**: Test refund request of $40 (under $100) and verify the graph executes without pausing.
2. **Verify Interruption Gate**: Test refund request of $350 and verify `snapshot.next == ("approval_gate",)`.
3. **Verify Rejection Branch**: Resume with `Command(resume={"approved": False})` and verify customer receives rejection message.

---

## 5. Extensions & Challenges

- **FastAPI SSE Endpoint**: Wrap the support workflow in a FastAPI streaming endpoint.
- **State Correction**: Call `app.update_state()` before resuming to reduce the approved refund amount from $350 to $200.
- **Postgres Checkpointer**: Replace `MemorySaver` with `PostgresSaver` backed by a real Dockerized PostgreSQL database.
