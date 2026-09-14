# LangChain and LangGraph Courses — Implementation Plan Record

Date: 2026-09-01

## Goal

Add two complete, 10-phase master-level courses (`LangChain/` and `LangGraph/`) to SkillVault, complete with projects, quick-references, 50-question interview Q&As, and comprehensive guides for AI Full Stack Development.

## Structure & Deliverables

### 1. `LangChain/` Directory
- `Phase-01-LangChain-Fundamentals-and-Architecture/`:
  - `README.md`
  - `01-Modern-LangChain-Ecosystem.md`
  - `02-Models-Prompts-and-Messages.md`
  - `03-Output-Parsers-and-Schemas.md`
- `Phase-02-LangChain-Expression-Language-LCEL/`:
  - `README.md`
  - `01-Runnable-Protocol-and-Primitives.md`
  - `02-Chaining-Parallelism-and-Fallbacks.md`
  - `03-Streaming-and-Async-LCEL.md`
- `Phase-03-Document-Loaders-Splitters-and-Embeddings/`:
  - `README.md`
  - `01-Document-Loaders-and-Parsers.md`
  - `02-Text-Splitters-and-Chunking.md`
  - `03-Embeddings-and-Vector-Stores.md`
- `Phase-04-Retrieval-Strategies-and-Advanced-RAG/`:
  - `README.md`
  - `01-Retrievers-and-Contextual-Compression.md`
  - `02-Ensemble-and-MultiQuery-Retrieval.md`
  - `03-Conversational-RAG-Chains.md`
- `Phase-05-Tools-Function-Calling-and-Structured-Outputs/`:
  - `README.md`
  - `01-Defining-Custom-Tools-and-Schemas.md`
  - `02-Model-Tool-Calling-Mechanics.md`
  - `03-Structured-Outputs-with-Pydantic.md`
- `Phase-06-Agents-and-Tool-Calling-Workflows/`:
  - `README.md`
  - `01-Agent-Architectures-and-ReAct.md`
  - `02-Tool-Calling-Agents-and-Executor.md`
  - `03-Agent-Error-Handling-and-Iteration-Limits.md`
- `Phase-07-Memory-and-Conversational-State/`:
  - `README.md`
  - `01-ChatMessageHistory-and-Runnables.md`
  - `02-Persistent-Session-Stores-Redis-SQL.md`
  - `03-Token-Windowing-and-Summarization.md`
- `Phase-08-Streaming-Async-and-Callbacks/`:
  - `README.md`
  - `01-Astream-and-Event-Streaming.md`
  - `02-Custom-Callbacks-and-Lifecycle-Hooks.md`
  - `03-SSE-and-FastAPI-Streaming.md`
- `Phase-09-Evaluation-Observability-and-LangSmith/`:
  - `README.md`
  - `01-LangSmith-Tracing-and-Debugging.md`
  - `02-RAG-and-Agent-Evaluators.md`
  - `03-Unit-Testing-and-Mocking-Chains.md`
- `Phase-10-Production-Optimization-and-Deployment/`:
  - `README.md`
  - `01-Caching-Rate-Limiting-and-Retries.md`
  - `02-Guardrails-and-Prompt-Injection-Defense.md`
  - `03-Production-FastAPI-Deployment.md`
- `Projects/`:
  - `01-Conversational-RAG-Assistant.md`
  - `02-Autonomous-Data-Analysis-Agent.md`
  - `03-Production-Customer-Support-Bot.md`
- `Quick-Reference/`:
  - `Cheatsheet.md`
  - `Interview-QA.md`
- `README.md`

### 2. `LangGraph/` Directory
- `Phase-01-LangGraph-Fundamentals-and-StateGraph/`:
  - `README.md`
  - `01-Why-Graphs-for-Agents-vs-DAGs.md`
  - `02-StateGraph-Nodes-and-Edges.md`
  - `03-Compilation-and-Graph-Execution.md`
- `Phase-02-State-Management-and-Reducers/`:
  - `README.md`
  - `01-State-Schemas-with-TypedDict-and-Pydantic.md`
  - `02-Reducers-and-Add-Messages.md`
  - `03-Partial-Updates-and-Delta-Merging.md`
- `Phase-03-Conditional-Routing-and-Dynamic-Edges/`:
  - `README.md`
  - `01-Conditional-Edges-and-Routers.md`
  - `02-Parallel-Execution-and-Fan-Out.md`
  - `03-Cyclical-Loops-and-Self-Correction.md`
- `Phase-04-Persistence-and-Checkpointing/`:
  - `README.md`
  - `01-Checkpointers-MemorySaver-and-PostgresSaver.md`
  - `02-Threads-and-Checkpoint-Namespaces.md`
  - `03-State-History-and-Replay.md`
- `Phase-05-Human-in-the-Loop-and-Time-Travel/`:
  - `README.md`
  - `01-Interrupts-and-Approval-Gates.md`
  - `02-Dynamic-State-Editing-mid-Flight.md`
  - `03-Time-Travel-and-State-Branching.md`
- `Phase-06-Multi-Agent-Architectures/`:
  - `README.md`
  - `01-Supervisor-and-Hierarchical-Agents.md`
  - `02-Peer-to-Peer-Swarm-and-Handoffs.md`
  - `03-Plan-and-Execute-Multi-Agent-Graph.md`
- `Phase-07-Subgraphs-and-Modular-Graph-Design/`:
  - `README.md`
  - `01-Parent-Child-Graph-Composition.md`
  - `02-State-Transformation-in-Subgraphs.md`
  - `03-Modular-Reusable-Agent-Libraries.md`
- `Phase-08-Streaming-Modes-and-Frontend-Integration/`:
  - `README.md`
  - `01-Streaming-Values-Updates-and-Messages.md`
  - `02-Token-by-Token-LLM-Streaming-in-Graphs.md`
  - `03-Connecting-LangGraph-to-NextJS-UI.md`
- `Phase-09-Long-Term-Memory-and-Store/`:
  - `README.md`
  - `01-Working-Memory-vs-Long-Term-Store.md`
  - `02-Namespaces-and-Hierarchical-Store-Keys.md`
  - `03-Semantic-Search-over-Graph-Memories.md`
- `Phase-10-LangGraph-Cloud-Studio-and-Production/`:
  - `README.md`
  - `01-LangGraph-Server-and-Cloud-Architecture.md`
  - `02-Visual-Debugging-with-LangGraph-Studio.md`
  - `03-Production-Reliability-and-Webhooks.md`
- `Projects/`:
  - `01-Customer-Support-Ticket-Resolver.md`
  - `02-Hierarchical-Multi-Agent-Research-Team.md`
  - `03-Human-in-the-Loop-Code-Refactoring-Agent.md`
- `Quick-Reference/`:
  - `Cheatsheet.md`
  - `Interview-QA.md`
- `README.md`

## Invariant Checklist
1. All lesson files: 200–248 lines, line 3 analogy blockquote, 8-9 sections, comparison table, common mistakes, exactly 5 exercises, exactly 5 interview Q&A pairs, ends on 5th Q&A.
2. All Phase READMEs: ~27-30 lines, matching fixed shape.
3. Quick-Reference: 50 interview questions each.
4. Top-level course READMEs with complete learning paths and hours/days estimates.
