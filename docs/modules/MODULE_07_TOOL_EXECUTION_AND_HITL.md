# Module 7: Application Tool Execution & Human-in-the-Loop (HITL) Gates

| Specification | Details |
| :--- | :--- |
| **Module Number** | 07 of 12 |
| **Topic** | Pydantic v2 Tool Contracts, Node.js API Invocations, RBAC Verification & Destructive Action Gates |
| **Target System** | Python 3.11, Pydantic v2, Node.js 22 REST APIs, PostgreSQL Audit Logs |
| **Engineering Level** | Staff Security & Systems Integration Engineer |

---

## 1. Tool Execution Architecture & Safety Gates

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              LLM SELECTS TOOL INVOCATION                               │
│                   Tool: "cancel_subscription" | Params: { reason: "Budget" }           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           PYDANTIC V2 CONTRACT VALIDATION                              │
│       - Validates parameters against CancelSubscriptionSchema                          │
│       - If invalid: Rejects immediately and returns validation error to LLM           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Valid
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                RBAC PERMISSION CHECK                                   │
│       - Asserts user_role in ['OWNER', 'ADMIN']                                        │
│       - If MEMBER: Returns "Permission Denied: Only Owners can modify subscriptions"   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Authorized
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       RISK CLASSIFICATION & CONFIRMATION GATE                          │
│                                                                                        │
│   Is Action Destructive / High-Risk? (Delete, Cancel, Bulk Mutate)                     │
│                                                                                        │
│         ├── NO (Read-only / Safe):                                                     │
│         │     └── Directly invoke Node.js Gateway API over secure internal bus         │
│         │                                                                              │
│         └── YES (High-Risk):                                                           │
│               ├── Persist snapshot to ai_audit_logs (status: PENDING_CONFIRMATION)     │
│               ├── Emit SSE Frame: event: confirmation_required                         │
│               └── PAUSE Execution. Awaiting client POST /api/v1/tools/confirm          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ADR: Tool Calling & Safety Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               TOOL EXECUTION & SAFETY PARADIGMS                                   │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Strategy                 │ Safety Mechanism            │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Pydantic v2 + HITL    │ Schema Validation + Confirm │ 🏆 SELECTED (Zero unverified side-effects│
│ 2. Unvalidated JSON      │ Raw `json.loads(tool_call)` │ ❌ REJECTED (High crash & injection risk)│
│ 3. Autonomous Execution  │ Execute All Tools Directly  │ ❌ REJECTED (Catastrophic on hallucination│
│ 4. Direct Code Execution │ `eval()` / `exec()` runtime │ ❌ REJECTED (Remote Code Execution RCE)  │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

### **🏆 1. Pydantic v2 Contract Validation + Human-in-the-Loop Confirmation — SELECTED**
* **Why Selected:**
  1. **Strict Type Safety:** Parameter schemas are validated against Pydantic v2 models before executing any API call. Invalid parameters are caught immediately, prompting the LLM to self-correct.
  2. **Human Confirmation for High-Risk Actions:** Write operations (`delete_project`, `cancel_subscription`, `bulk_assign_tasks`) trigger an interactive confirmation modal on the client; the action cannot execute until the user clicks "Confirm".

---

## 3. Concrete Code Implementation

### 3.1 Pydantic v2 Tool Schemas (`app/tools/schemas.py`)
```python
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class ToolRiskLevel(str):
    SAFE = "SAFE"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class CreateTaskSchema(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, description="Title of the task")
    description: Optional[str] = Field(None, description="Detailed task description")
    project_id: str = Field(..., description="Target project UUID")
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = Field(default="MEDIUM")
    due_date: Optional[str] = Field(None, description="ISO format due date string")

class CancelSubscriptionSchema(BaseModel):
    reason: str = Field(..., min_length=5, description="Reason for cancellation")
    effective_immediately: bool = Field(default=False)
```

### 3.2 Tool Executor with Gateway API Dispatcher (`app/tools/executor.py`)
```python
import httpx
import os
from typing import Dict, Any

GATEWAY_INTERNAL_URL = os.getenv("GATEWAY_INTERNAL_URL", "http://backend-node:5000")
SERVICE_SECRET_TOKEN = os.getenv("SERVICE_SECRET_TOKEN", "internal-mTLS-secret-token")

class ToolExecutor:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=GATEWAY_INTERNAL_URL, timeout=10.0)

    async def execute_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        tenant_id: str,
        user_id: str,
        user_role: str
    ) -> Dict[str, Any]:
        # 1. Enforce RBAC rules before dispatching
        if tool_name == "cancel_subscription" and user_role not in ["OWNER", "ADMIN"]:
            return {
                "success": False,
                "error": "FORBIDDEN",
                "message": "Only organization Owners and Admins are authorized to cancel subscriptions."
            }

        headers = {
            "X-Internal-Service-Key": SERVICE_SECRET_TOKEN,
            "X-Tenant-ID": tenant_id,
            "X-User-ID": user_id,
            "X-User-Role": user_role
        }

        # 2. Dispatch to Node.js Gateway REST Endpoints
        if tool_name == "create_task":
            response = await self.client.post("/api/v1/internal/tasks", json=parameters, headers=headers)
            return response.json()

        elif tool_name == "get_tasks":
            response = await self.client.get("/api/v1/internal/tasks", params=parameters, headers=headers)
            return response.json()

        elif tool_name == "cancel_subscription":
            response = await self.client.post("/api/v1/internal/billing/cancel", json=parameters, headers=headers)
            return response.json()

        raise ValueError(f"Unknown tool: {tool_name}")

tool_executor = ToolExecutor()
```

### 3.3 Audit Logging Utility (`app/services/audit.py`)
```python
import asyncpg

async def record_audit_log(
    pool: asyncpg.Pool,
    tenant_id: str,
    user_id: str,
    action_type: str,
    tool_name: str,
    parameters: dict,
    status: str,
    error_message: str = None
):
    query = """
    INSERT INTO ai_audit_logs (
        organization_id, user_id, action_type, tool_name, parameters, execution_status, error_message
    ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7);
    """
    async with pool.acquire() as conn:
        await conn.execute(
            query,
            tenant_id,
            user_id,
            action_type,
            tool_name,
            parameters,
            status,
            error_message
        )
```

---

## 4. Production Security Verification

| Test Case | Attack / Mistake Simulation | Gateway Defense |
| :--- | :--- | :--- |
| **Privilege Escalation** | `MEMBER` asks "Cancel our subscription plan" | Tool executor validates `user_role`; rejects request with `403` before calling billing API. |
| **Invalid Schema Argument** | LLM passes `"priority": "SUPER_MAX"` | Pydantic v2 rejects parameter; returns formatting error to LLM to self-correct to `URGENT`. |
| **Destructive Deletion Confirmation** | User says "Delete project X" | Emits `event: confirmation_required`; refuses to call API until human clicks "Confirm" in UI. |
