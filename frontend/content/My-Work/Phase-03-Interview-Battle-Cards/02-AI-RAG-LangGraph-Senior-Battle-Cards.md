# Multi-Tenant RAG & LangGraph: Senior Interview Battle Cards

> **Module**: Phase 03 — Interview Battle Cards | **Lesson**: 02  
> **Target Roles**: Senior / Staff AI Engineer, LLM Systems Architect, Backend Tech Lead

---

## Battle Card 1: Multi-Tenant Vector Leakage Prevention

### Interviewer Prompt:
> *"If 100 enterprise customers store embeddings in one shared PostgreSQL instance, how do you mathematically and architecturally guarantee Company A never accesses Company B's data during vector retrieval?"*

### Senior Answer:
"We enforce a **3-Layer Defense-in-Depth model**:
1. **Cryptographic Token Extraction**: `tenant_id` is parsed strictly from the verified, cryptographically signed RSA-256 JWT in FastAPI middleware. We never read `org_id` from client headers or request bodies.
2. **Database Kernel RLS Layer**: In every database session, we invoke `SET LOCAL app.current_tenant_id = :org_id;`. PostgreSQL's Row-Level Security policy automatically drops any row whose `organization_id` does not match the session tenant ID, even if an engineer writes a raw SQL query forgetting the WHERE clause.
3. **HNSW Filtered Search**: In pgvector, we execute an iterative filtered HNSW query:
   `SELECT id, content FROM document_chunks WHERE organization_id = :org_id ORDER BY embedding <=> :query LIMIT k;`  
   This ensures that the distance calculation and nearest neighbor traversal are strictly bound within the partition of that tenant."

---

## Battle Card 2: The "Lost in the Middle" Dilemma & Context Bloat

### Interviewer Prompt:
> *"Why not just pass the top 20 retrieved chunks directly to GPT-4o? Why introduce BM25, RRF, and a Cross-Encoder?"*

### Senior Answer:
"Feeding 20 raw chunks (approx. 10,000–16,000 tokens) causes three major production failures:
1. **The 'Lost in the Middle' Phenomenon**: As proven by Liu et al., LLM attention degrades heavily on information situated in the middle of long contexts. Critical facts get missed.
2. **Cost and Latency**: TTFT (Time-to-First-Token) increases linearly with input prompt token count, and API costs balloon by 5x.
3. **High False Positive Rate**: Pure dense vector search frequently retrieves chunks that share broad topical similarity but lack the exact technical keyword or error code required.

Our **Two-Stage Hybrid Pipeline** solves this:
- **Stage 1**: We cast a broad net with Dense HNSW (semantic) + Sparse BM25 (exact keyword match), merging them via **Reciprocal Rank Fusion ($k=60$)** to form a 20-candidate pool.
- **Stage 2**: We run a lightweight, deep **Cross-Encoder reranker** (`ms-marco-MiniLM-L-6-v2`) that performs joint cross-attention across (query, passage) pairs. We take only the top 4 chunks that pass a strict confidence threshold ($\ge 0.65$). This reduces input tokens by 75% and guarantees peak attention focus."

---

## Battle Card 3: Streaming Tokens with Agent Tool Calling

### Interviewer Prompt:
> *"When using LangGraph with tool calls, how do you stream responses to the frontend without leaking raw JSON function calling syntax to the user?"*

### Senior Answer:
"When an LLM executes a tool call, it emits tokens structured as JSON function schemas (e.g., `{"name": "get_subscription", "arguments": "{\"org_id\": ...}"}`). If streamed directly, the user sees ugly JSON fragments before the tool runs.

We resolve this using LangGraph's `astream_events(version='v2')`:
1. We inspect the event metadata: tokens coming from `on_chat_model_stream` are only forwarded to the client SSE stream if the parent node is a conversational generation node (`rag_generate` or `direct_chat`).
2. When a tool node is triggered, we emit a structured **status event** (`event: status`, data: `{"message": "Checking billing records..."}`) rather than raw tokens.
3. Once the tool finishes, the downstream formatting node generates natural language tokens, which stream cleanly to the client. This provides an enterprise UX with zero JSON leakage."

---

## Battle Card 4: Durable Human-in-the-Loop (HITL) Checkpoints

### Interviewer Prompt:
> *"If a user asks to cancel their subscription or issue a refund, and your bot pauses for a human supervisor who takes 14 hours to review it, how do you prevent worker thread starvation and handle server restarts?"*

### Senior Answer:
"We utilize **LangGraph's dynamic `interrupt()` with `PostgresSaver` checkpointing**.
- When the risk gate detects a sensitive action (e.g., refund > \$100), the graph executes `interrupt({'action': 'REFUND_REQUEST', ...})`.
- LangGraph immediately serializes the entire `AssistantState` into the `checkpoints` table in PostgreSQL under the unique `thread_id` and terminates the execution thread. No Celery worker or FastAPI process remains running or blocked in memory.
- 14 hours later, the supervisor logs into the dashboard, clicks 'Approve', and the frontend hits `POST /api/v1/chat/resume`.
- The backend loads the checkpoint from Postgres, injects `Command(resume={'approved': True})`, and resumes execution precisely at the tool execution node. If the backend crashed or was redeployed in the meantime, state was safely persisted in PostgreSQL."

---

## Battle Card 5: Production RAG Evaluation Without Human Labeling

### Interviewer Prompt:
> *"How do you continuously evaluate retrieval and generation quality in production without paying human annotators to review thousands of daily chats?"*

### Senior Answer:
"We implement automated continuous evaluation using the **RAG Triad** via **Ragas** and an **LLM-as-a-Judge** pipeline:
1. **Context Relevance**: Measures whether retrieved chunks are focused and free of noise. Evaluated by asking a small evaluator model (e.g., `gpt-4o-mini`) if each sentence in the context is necessary to answer the query.
2. **Groundedness / Faithfulness**: Measures whether the generated response contains only claims supported by the retrieved context. We parse the answer into atomic claims and verify them against the context snippets.
3. **Answer Relevance**: Measures whether the response directly addresses the user's question.

In production, we log 5% of all live interactions to **LangSmith / OpenTelemetry**. Queries with low user feedback (thumbs down) or low faithfulness scores trigger automated Slack alerts and are added to a regression evaluation dataset for continuous prompt and chunking fine-tuning."
