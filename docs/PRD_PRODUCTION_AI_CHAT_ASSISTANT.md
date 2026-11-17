# Product Requirements Document (PRD) & Master Architectural Decision Record (ADR)
## Production-Grade AI Chat Assistant for TaskFlow SaaS Platform

| Metadata | Specification |
| :--- | :--- |
| **Product** | TaskFlow AI — Enterprise Multi-Tenant Assistant & Workflow Agent |
| **Document Purpose** | Production PRD, Exhaustive Architectural Decision Records (ADRs) & Trade-off Analysis |
| **Target Architecture** | Decoupled Node.js Gateway + Python FastAPI (LangGraph) + Hybrid pgvector RAG + Redis + SSE |
| **Frontend Stack** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons |
| **Backend & AI Stack**| Node.js 22 (Express, TypeScript), Python 3.11 (FastAPI, LangGraph), PostgreSQL 16 (pgvector), Redis 7 |
| **Engineering Level** | Staff / Principal Full Stack + AI Systems Engineer |
| **Status** | **Exhaustive Architectural Specification & Production Benchmark** |

---

## 1. Executive Summary & Vision

### 1.1 The Production Problem Statement
Most conversational AI features deployed today are fragile "toy" wrappers around an LLM endpoint:
- **No Domain Authority:** Answers are generated from generic parametric training data, ignoring private organizational documentation.
- **No Action Capability:** The AI can only produce text; it cannot execute actual transactional mutations (e.g., creating tasks, rescheduling sprints).
- **Security & Multi-Tenant Bleed:** Queries lack strict tenant isolation at the database layer, leading to catastrophic vector leaks between organizations.
- **Astronomical Token Inefficiency:** Naively concatenating full chat history exhausts context windows and multiplies API bills by 10x.
- **Uncontrolled Hallucination in API Calling:** The LLM hallucinates parameters or schema types, crashing backend services.

### 1.2 The Production Goal: TaskFlow AI
TaskFlow AI is built as a **Dual-Loop Enterprise Assistant**:
1. **Loop A (Knowledge RAG):** Answers user questions by performing multi-tenant hybrid retrieval over company documentation, returning answers with clickable, verified citations.
2. **Loop B (Application Actions):** Understands user intent, selects authorized backend tools, validates arguments with strict schemas, prompts for human confirmation on high-risk operations, and executes real REST APIs against the TaskFlow platform.

---

## 2. Exhaustive Architectural Decision Records (ADRs)

> **Staff Engineer Standard:** For every technical decision, **all existing industry formats, paradigms, and algorithms** must be analyzed. We document the chosen winner with deep justification, and provide explicit failure modes, complexity metrics, and rejection reasons for **every other evaluated alternative**.

---

### ADR 1: Re-Ranking Architecture & Algorithms

Re-ranking evaluates a candidate pool of retrieved documents ($K \approx 20\text{–}50$) and scores their true relevance to produce a precision-filtered subset ($N \approx 3\text{–}5$).

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                RE-RANKING ALGORITHMS & FORMATS                                    │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Algorithm / Paradigm     │ Underlying Mechanism        │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. In-Process ONNX       │ MiniLM-L-12 Cross-Encoder   │ 🏆 SELECTED (FlashRank)                  │
│ 2. Cloud Managed Reranker│ Hosted Cross-Encoder API    │ ❌ REJECTED (Cohere v3 / Jina v2)        │
│ 3. Monolithic Heavy LLM  │ BGE-Reranker-Large (GPU)    │ ❌ REJECTED (560M Params / PyTorch)      │
│ 4. Late-Interaction MaxSm│ Token ColBERT MaxSim        │ ❌ REJECTED (ColBERTv2 / RAGatouille)    │
│ 5. Generative Listwise   │ LLM RankGPT Prompt Scoring  │ ❌ REJECTED (GPT-4o / Claude Judgments)  │
│ 6. Supervised ML (LTR)   │ LambdaMART / XGBoost GBDT   │ ❌ REJECTED (Tree-based pairwise LTR)    │
│ 7. Learned Sparse PRF    │ SPLADE / BM25 Pseudo-RF     │ ❌ REJECTED (Lexical expansion)          │
│ 8. Diversity Re-ranking  │ Maximal Marginal Relevance  │ ❌ REJECTED (Cosine MMR Penalty)         │
│ 9. Zero Re-ranking       │ Raw Bi-Encoder Cosine Top-K │ ❌ REJECTED (No Second Stage)            │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. In-Process Lightweight Cross-Encoder (FlashRank / MiniLM-L-12) — SELECTED**
* **Underlying Mechanism:** Runs an optimized, quantized transformer cross-encoder (`ms-marco-MiniLM-L-12-v2`) in-process using the ONNX Runtime with CPU vector extensions (AVX-512 / ARM Neon). Tokenizes query and candidate jointly: $Input = [CLS] + Query + [SEP] + Document + [SEP]$, passing all tokens through cross-attention layers.
* **Why Selected:**
  1. **Full Cross-Attention:** Unlike bi-encoders that map queries and documents into independent static vectors ($E(Q) \cdot E(D)$), cross-attention captures token-level semantic interactions between every query word and document word.
  2. **Ultra-Low Latency:** In-process ONNX execution re-ranks 25 candidate chunks in $\approx 22\text{ms}$ on standard CPU cores with zero GPU dependency.
  3. **Zero Network Latency & High Privacy:** Customer proprietary documents remain strictly inside our own server memory; zero outbound HTTP calls to third-party reranking vendors.
  4. **Cost:** $0 per invocation.

#### **❌ Evaluated Alternatives & Rejection Reasons:**

* **❌ 2. Cloud Managed Rerank APIs (Cohere Rerank v3, Jina Reranker v2):**
  * *Mechanism:* Sends batch of text candidates over HTTPS to a proprietary multi-lingual model hosted by Cohere/Jina.
  * *Reason for Rejection:*
    1. **Network Latency Penalty:** Introduces an unavoidable external WAN round-trip latency of $180\text{ms}$–$400\text{ms}$ on every single chat message.
    2. **Operational SaaS Dependency:** Outage or rate limits (HTTP 429) at Cohere immediately halt our conversational pipeline.
    3. **Cloud Billing Multiplier:** Costs $\$1.00$ per 1,000 queries. At 1,000 concurrent active users sending 10 msgs/hr, reranking alone would add $\$720$/month in unnecessary vendor spend.
    4. **Data Compliance:** Dispatches unencrypted internal customer documentation to an external third-party processor.

* **❌ 3. Monolithic Heavy Transformers (`bge-reranker-large`, `deberta-v3-large`):**
  * *Mechanism:* Full 560M+ parameter cross-encoder running in PyTorch.
  * *Reason for Rejection:*
    1. **Hardware Bloat:** Requires minimum 4 GB dedicated GPU VRAM or 8+ dedicated CPU cores per worker process.
    2. **Throughput Bottleneck:** CPU inference takes $450\text{ms}$–$850\text{ms}$ per 20 chunks. Under concurrent load, CPU utilization hits 100%, causing request queueing and SSE streaming stutter.
    3. **Autoscaling Cost:** Drastically increases cloud Kubernetes pod footprint, multiplying compute infrastructure costs.

* **❌ 4. Late-Interaction Multi-Vector Models (ColBERTv2 / RAGatouille):**
  * *Mechanism:* Generates a bag of token-level embeddings for query and document; computes similarity via MaxSim operator: $\sum_{i \in Q} \max_{j \in D} (E_i \cdot E_j)$.
  * *Reason for Rejection:*
    1. **Storage Explosion:** Stores 128-dimensional vectors for *every single token* in the document. A 100-page document generates 40,000 individual vectors, blowing up database disk storage by $15\times$ compared to single-vector models.
    2. **Complexity:** Requires specialized vector index engines (Plaイド / PLAID) or custom multi-vector tensor operations not natively optimized in standard PostgreSQL.

* **❌ 5. Generative LLM-as-a-Jury / Listwise Prompting (RankGPT / Rank-LLaMA):**
  * *Mechanism:* Feeds all 20 retrieved candidates into a prompt to GPT-4o or Claude 3.5 Sonnet: *"Rank the following passages from 1 to 20 based on relevance to the query..."*.
  * *Reason for Rejection:*
    1. **Extreme Latency:** Generative LLM inference takes $2.5$–$5.0$ seconds just to produce the ranking list, completely blowing our sub-800ms TTFT budget.
    2. **Severe Token Cost:** Consumes 4,000–8,000 input tokens on every turn strictly for reranking before even answering the question.
    3. **Position Bias:** LLMs exhibit strong "lost-in-the-middle" and recency bias, favoring passages placed at the very top or bottom of the prompt regardless of relevance.

* **❌ 6. Supervised Learning-to-Rank (LTR) (LambdaMART / XGBoost / LightGBM):**
  * *Mechanism:* Gradient boosted decision trees trained on engineered features (BM25 score, vector cosine score, document freshness, click-through rate, token length).
  * *Reason for Rejection:*
    1. **Cold Start Data Requirement:** Requires tens of thousands of labeled query-document click logs or human relevance judgments ($q, d, y \in \{0, 1, 2, 3\}$) to train the tree splits. Impossible to bootstrap on a new platform without historical clickstream telemetry.
    2. **Maintenance Overhead:** Trees degrade when documentation vocabulary shifts and require continuous retraining pipelines.

* **❌ 7. Learned Sparse & Pseudo-Relevance Feedback (SPLADE / BM25 PRF):**
  * *Mechanism:* Expands query tokens using top-ranked documents from an initial search round to re-query the inverted index.
  * *Reason for Rejection:*
    1. **Query Drift:** If the first retrieval step returns irrelevant documents, expanding the query with tokens from those bad documents derails subsequent results.
    2. **Double Query Latency:** Requires running two complete database queries consecutively.

* **❌ 8. Maximal Marginal Relevance (MMR):**
  * *Mechanism:* Greedily selects documents by balancing query similarity with a penalty for redundancy against already selected documents:
    $$MMR = \arg\max_{d \in R \setminus S} \left[ \lambda \cdot Sim_1(d, q) - (1-\lambda) \max_{s \in S} Sim_2(d, s) \right]$$
  * *Reason for Rejection:*
    1. **Relevance Degradation:** In technical QA, redundancy is often confirmation. Penalizing similar chunks frequently discards the exact code snippet needed because an introductory paragraph had a similar embedding.
    2. **No Deep Token Interaction:** MMR uses the same bi-encoder embeddings and does not provide cross-attention precision.

* **❌ 9. Zero Re-Ranking (Raw Bi-Encoder Cosine Top-K):**
  * *Mechanism:* Directly takes the top 5 nearest neighbors from the HNSW vector index and passes them to the LLM.
  * *Reason for Rejection:*
    1. **Hallucination Trigger:** Dense vectors cluster around broad topical semantic centroids. Chunks that talk *about* the general topic often outscore chunks that contain the *exact technical answer*, leading to hallucinated explanations.

---

### ADR 2: Retrieval & Hybrid Fusion Algorithms

How do we query and combine multi-source indexes across dense vector and sparse lexical spaces?

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           RETRIEVAL & FUSION ALGORITHMS & FORMATS                                 │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Algorithm / Paradigm     │ Underlying Mechanism        │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Reciprocal Rank Fusion│ Rank Position Reciprocals   │ 🏆 SELECTED (RRF with k=60)              │
│ 2. Convex Score Sum      │ Linear Normalization Scale  │ ❌ REJECTED (Weighted Alpha Sum)         │
│ 3. Pure Dense Semantic   │ HNSW Cosine Similarity      │ ❌ REJECTED (Bi-encoder only)            │
│ 4. Pure Lexical Search   │ Okapi BM25 / tsvector GIN   │ ❌ REJECTED (Exact matching only)        │
│ 5. Learned Sparse Models │ SPLADE v2 Inverted Index    │ ❌ REJECTED (Neural lexical expansion)   │
│ 6. Hypothetical Docs     │ HyDE Generative Expansion   │ ❌ REJECTED (LLM generation upfront)     │
│ 7. Knowledge Graph RAG   │ Entity Triple Extraction    │ ❌ REJECTED (Graph DB Cypher Traversal)  │
│ 8. Hierarchical Parent   │ Small-to-Large Auto-Merge   │ ❌ REJECTED (Multi-level chunk trees)    │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. Reciprocal Rank Fusion (RRF with $k=60$) — SELECTED**
* **Underlying Mechanism:** Executes dense vector similarity search and sparse `tsvector` BM25 in parallel. For every document $d$ appearing in either list, computes:
  $$RRF\_Score(d) = \sum_{m \in \{dense, sparse\}} \frac{1}{60 + r_m(d)}$$
  Sorts candidates strictly by their reciprocal rank sum.
* **Why Selected:**
  1. **Score Scale Invariance:** Dense cosine scores are bounded ($0.0 \le S \le 1.0$), while BM25 scores are unbounded ($0 \le S < \infty$). RRF evaluates **ordinal ranks** (1st, 2nd, 3rd) rather than raw magnitudes, eliminating the mathematical impossibility of normalizing unbounded scores.
  2. **Zero Calibration Drift:** Unlike linear weighting which requires continuous tuning of an $\alpha$ weight, RRF is parameter-free and mathematically stable across any corpus size.
  3. **High Recall:** Documents appearing near the top of *both* lists receive massive boosts; documents appearing in only one list are preserved if their rank is high.

#### **❌ Evaluated Alternatives & Rejection Reasons:**

* **❌ 2. Convex Score Combination ($\alpha \cdot Dense + (1-\alpha) \cdot Sparse$):**
  * *Reason for Rejection:* Requires Min-Max normalization ($S_{norm} = \frac{S - S_{min}}{S_{max} - S_{min}}$). If an outlier chunk matches an exact keyword 15 times, its inflated BM25 score compresses all other scores to near zero, destroying dense retrieval rankings.
* **❌ 3. Pure Dense Vector Retrieval (HNSW only):**
  * *Reason for Rejection:* Completely blind to exact keywords, UUIDs, function names (`onInit()`), error codes (`ERR_CONN_REFUSED`), and version numbers (`Angular 19` vs `Angular 18`).
* **❌ 4. Pure Lexical Search (BM25 / tsvector only):**
  * *Reason for Rejection:* Zero semantic awareness. Fails if user asks "How do I secure an API?" when the documentation uses the phrasing "Protecting REST endpoints".
* **❌ 5. Learned Sparse Models (SPLADE v2):**
  * *Reason for Rejection:* Requires specialized neural inverted indexes not natively supported inside PostgreSQL. Adds 80ms inference latency to project text into the 30,000-dimensional vocabulary space on every search.
* **❌ 6. Hypothetical Document Embeddings (HyDE):**
  * *Reason for Rejection:* Calls an LLM upfront to generate a fake answer, then embeds that fake answer. Adds 1.5–3.0 seconds of latency to every turn and doubles LLM API costs.
* **❌ 7. Graph RAG / Knowledge Graph Traversal (Neo4j / Entity Triples):**
  * *Reason for Rejection:* Requires an asynchronous entity-extraction pipeline (extracting subject-predicate-object triples) during ingestion. Triples extraction on 500 documents costs over \$100 in LLM extraction tokens, and graph query traversal adds significant latency for standard Q&A.
* **❌ 8. Hierarchical Parent-Document / Auto-Merging Retrieval:**
  * *Reason for Rejection:* Splits documents into tiny 100-token child chunks for search, then replaces them with 1,000-token parent chunks for LLM context. Frequently pulls irrelevant surrounding text from the parent, diluting prompt attention and increasing token costs.

---

### ADR 3: Vector Storage & Indexing Engine

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               VECTOR STORAGE ENGINES & INDEX FORMATS                              │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Technology / Index       │ Indexing Architecture       │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. PostgreSQL + pgvector │ HNSW (Hierarchical Small Wld│ 🏆 SELECTED (Neon Serverless Postgres 16)│
│ 2. pgvector IVFFlat      │ Inverted File Centroid Clust│ ❌ REJECTED (Partition-based clustering) │
│ 3. Pinecone              │ Proprietary Cloud Graph     │ ❌ REJECTED (External SaaS Vector DB)    │
│ 4. Qdrant / Milvus       │ Dedicated HNSW / IVF Rust/C+│ ❌ REJECTED (Standalone Vector Cluster)  │
│ 5. Weaviate              │ GraphQL Vector Engine       │ ❌ REJECTED (Multi-modal standalone DB)  │
│ 6. ChromaDB              │ Local In-Memory DuckDB/Parq │ ❌ REJECTED (Non-production persistence) │
│ 7. FAISS (Meta)          │ In-Memory C++ Index File    │ ❌ REJECTED (Static file, no ACID CRUD)  │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. PostgreSQL 16 + pgvector (HNSW Index) — SELECTED**
* **Why Selected:**
  1. **Transactional ACID Co-location:** Metadata, users, tenants, projects, tasks, and vectors live in one database. Document deletions are single-statement atomic transactions (`DELETE FROM documents WHERE id = $1`).
  2. **Row-Level Security (RLS):** Kernel-enforced tenant filtering via `app.current_tenant_id`.
  3. **HNSW vs IVFFlat:** HNSW constructs a multi-layer graph index that handles incremental vector additions without requiring clustering retraining passes.

#### **❌ Evaluated Alternatives & Rejection Reasons:**
* **❌ 2. pgvector with IVFFlat Index:** Requires training centroids after data is populated (`CREATE INDEX ... WITH (lists = 100)`). If data size grows by $10\times$, the list count is sub-optimal and recall collapses unless the index is dropped and recomputed.
* **❌ 3. Pinecone:** Introduces the dual-write problem. Lacks cross-database ACID transactions with primary tables. Network partitions cause orphaned vectors. Expensive per-index pricing.
* **❌ 4. Qdrant / Milvus:** Requires running, configuring, and monitoring an entirely separate distributed cluster alongside PostgreSQL. Excessive operational overhead for corpora under 10 million vectors.
* **❌ 5. Weaviate:** Requires specialized schema definitions and GraphQL query syntax; introduces another network hop and clustering operational overhead.
* **❌ 6. ChromaDB:** Embedded instance runs SQLite/DuckDB under the hood; concurrency locks up under simultaneous multi-tenant writes; lacks enterprise high-availability replication.
* **❌ 7. FAISS:** Raw index files stored on disk. Updating or deleting a single vector requires full index rebuilding in memory. Zero multi-user concurrency support.

---

### ADR 4: Agentic State Machine & Orchestration

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             AGENTIC ORCHESTRATION FRAMEWORKS                                      │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Technology / Pattern     │ Execution Mechanism         │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. LangGraph             │ Cyclic Directed State Graph │ 🏆 SELECTED (Typed Pydantic StateGraph)  │
│ 2. LangChain Legacy      │ AgentExecutor (ReAct Loop)  │ ❌ REJECTED (Deprecated string loop)     │
│ 3. Autonomous Swarms     │ Multi-Agent Roleplay Loop   │ ❌ REJECTED (CrewAI / AutoGPT)           │
│ 4. LlamaIndex Workflows  │ Event-Driven Pub/Sub Steps  │ ❌ REJECTED (LlamaIndex ecosystem lock)  │
│ 5. Semantic Kernel       │ Microsoft Plan-Execute Graph│ ❌ REJECTED (C# primary / verbose)       │
│ 6. Pure Python Loops     │ Custom `while True:` loop   │ ❌ REJECTED (Unstructured code)          │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. LangGraph (Cyclic Directed State Machine) — SELECTED**
* **Why Selected:**
  1. **Cyclic Control Flow:** Supports loops for automated self-correction (*Retrieve $\rightarrow$ Evaluate $\rightarrow$ If Irrelevant, Rewrite $\rightarrow$ Re-retrieve*).
  2. **Typed State:** All nodes read from and write to a single Pydantic `AgentState` object with strict schema validation.
  3. **Human-in-the-Loop (HITL) Checkpoints:** Automatically pauses the graph before destructive tools (`delete_project`, `cancel_subscription`), writes state to Postgres, and resumes upon user confirmation.

#### **❌ Evaluated Alternatives & Rejection Reasons:**
* **❌ 2. LangChain Legacy `AgentExecutor`:** Uses free-form string parsing; prone to infinite loops when parsing malformed JSON; officially deprecated.
* **❌ 3. Autonomous Swarms (CrewAI / AutoGPT):** Non-deterministic role-playing creates 30+ second execution times and 10x token consumption as agents debate each other. Unacceptable for a production SaaS tool.
* **❌ 4. LlamaIndex Workflows:** Lacks native cyclic checkpointing mechanisms for pausing and resuming across human approvals compared to LangGraph's checkpointer architecture.
* **❌ 5. Microsoft Semantic Kernel:** Heavy enterprise abstractions ported from .NET; slower release velocity and smaller community in the Python ecosystem.
* **❌ 6. Pure Python Custom While-Loops:** Reinventing state persistence, checkpoint serialization, conditional branch routing, and streaming hooks from scratch creates unmaintainable technical debt.

---

### ADR 5: Real-Time Streaming & Client Communication

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               STREAMING COMMUNICATION PROTOCOLS                                   │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Protocol                 │ Transport Mechanism         │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Server-Sent Events    │ HTTP/2 Unidirectional Stream│ 🏆 SELECTED (text/event-stream)          │
│ 2. WebSockets            │ TCP Full-Duplex (RFC 6455)  │ ❌ REJECTED (Bypasses HTTP middleware)   │
│ 3. gRPC-Web              │ HTTP/2 Protobuf Frames      │ ❌ REJECTED (Requires Envoy Proxy layer) │
│ 4. HTTP Short Polling    │ Periodic Client GET Loop    │ ❌ REJECTED (Database overload)          │
│ 5. HTTP Long Polling     │ Hanging GET with Re-hang    │ ❌ REJECTED (High connection churning)   │
│ 6. WebTransport (QUIC)   │ UDP Datagrams & Streams     │ ❌ REJECTED (Immature browser/proxy spec)│
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. Server-Sent Events (SSE) over HTTP/2 — SELECTED**
* **Why Selected:**
  1. **Unidirectional Match for LLM Streaming:** Client sends a single prompt; server streams token deltas. SSE is native HTTP, lightweight, and requires no custom socket handshake.
  2. **Typed Event Multiplexing:** Supports custom event names (`event: thought`, `event: tool_call`, `event: chunk`, `event: citation`, `event: done`), allowing the frontend to update distinct UI elements simultaneously.
  3. **Native Infrastructure Compatibility:** Works cleanly with standard JWT auth headers, reverse proxies, and browser `AbortController` cancellation.

#### **❌ Evaluated Alternatives & Rejection Reasons:**
* **❌ 2. WebSockets:** Full-duplex is unnecessary for request-response generation. WebSockets break standard HTTP request/response semantics, bypass standard API Gateway middleware, and often fail behind enterprise corporate firewalls.
* **❌ 3. gRPC-Web:** Requires an Envoy proxy layer to translate browser HTTP/1.1 or HTTP/2 to gRPC; excessive tooling complexity for simple text streaming.
* **❌ 4. HTTP Short Polling:** Enormous database read volume (thousands of polling requests per second) and poor user experience.
* **❌ 5. HTTP Long Polling:** High connection churning, header overhead on every reconnection, and complex state synchronization.
* **❌ 6. WebTransport (QUIC):** Incompatible with most cloud edge proxies (Cloudflare / AWS ALB) and lacks broad enterprise network support.

---

### ADR 6: Multi-Tenant Data Isolation Strategy

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               MULTI-TENANT ISOLATION ARCHITECTURES                                │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Strategy                 │ Isolation Layer             │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Shared DB + RLS       │ PostgreSQL Kernel RLS       │ 🏆 SELECTED (Row-Level Security)         │
│ 2. Application-Only Filter│ App Code `WHERE tenant_id`  │ ❌ REJECTED (Human error vulnerability)  │
│ 3. Schema-per-Tenant     │ Separate Postgres Schemas   │ ❌ REJECTED (Migration & relation limits)│
│ 4. Database-per-Tenant   │ Dedicated Physical Instances│ ❌ REJECTED (Cost & operational chaos)   │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. PostgreSQL Row-Level Security (RLS) on Shared Schema — SELECTED**
* **Why Selected:**
  1. **Kernel-Enforced Safety:** Once enabled, PostgreSQL itself rejects queries missing `app.current_tenant_id`, physically preventing cross-tenant vector leakage even if a developer makes a mistake in application code.
  2. **Cost-Effective Scalability:** Accommodates thousands of organizations on a single managed database cluster without spinning up thousands of separate database instances.

#### **❌ Evaluated Alternatives & Rejection Reasons:**
* **❌ 2. Application-Level Filtering Only (`WHERE organization_id = ...`):**
  * *Reason for Rejection:* A single forgotten `WHERE organization_id = ...` clause by a junior engineer leaks confidential corporate data to another customer.
* **❌ 3. Schema-per-Tenant:**
  * *Reason for Rejection:* Running migrations across 500+ schemas takes hours, table metadata exhausts PostgreSQL system catalogs, and connection pools cannot be efficiently shared.
* **❌ 4. Database-per-Tenant:**
  * *Reason for Rejection:* Prohibitively expensive; managing connection pooling, backups, and point-in-time recovery for 500+ separate PostgreSQL instances is operationally unsustainable for a mid-market SaaS.

---

### ADR 7: Semantic Caching Strategy

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SEMANTIC CACHING PARADIGMS                                        │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Strategy                 │ Cache Matching Engine       │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Redis Vector Cache    │ Cosine Similarity >= 0.96   │ 🏆 SELECTED (Fast sub-50ms cache)        │
│ 2. Exact Hash Cache      │ SHA-256 of Prompt String    │ ❌ REJECTED (Misses semantic equivalents)│
│ 3. Levenshtein / Fuzzy   │ String Edit Distance        │ ❌ REJECTED (Fails on synonyms)          │
│ 4. GPTCache Standalone   │ External Python Daemon      │ ❌ REJECTED (Complex dependency)         │
│ 5. Provider Prompt Cache │ Cloud Prefix Cache (OpenAI) │ ❌ REJECTED (Still incurs LLM generation)│
│ 6. No Caching            │ Compute on Every Turn       │ ❌ REJECTED (Wasteful & expensive)       │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. Redis Vector Similarity Cache (Cosine Sim $\ge 0.96$) — SELECTED**
* **Why Selected:**
  1. **Semantic Equivalence:** Queries like *"How do I invite team members?"* and *"Where can I add users to my team?"* produce cosine similarities $>0.97$. Returns the precomputed answer in $<30\text{ms}$ at $\$0$ LLM cost.
  2. **Tenant Scoping:** Cache keys are prefixed with `tenant:{org_id}:cache`, guaranteeing that cached answers from one company are never served to another.

#### **❌ Evaluated Alternatives & Rejection Reasons:**
* **❌ 2. Exact SHA-256 Hash Caching:** Adding a single punctuation mark, space, or synonym ("How do I add users?" vs "How do I add users") results in a complete cache miss (0% hit rate on natural language).
* **❌ 3. Levenshtein / String Distance Caching:** "Create project" and "Delete project" have an edit distance of only 6 characters, but have opposite meanings.
* **❌ 4. GPTCache Daemon:** Adds an unmaintained third-party daemon between application and database, introducing unnecessary architectural fragility.
* **❌ 5. Cloud Provider Prompt Prefix Caching Only:** Reduces input token costs, but still requires the LLM to generate the entire completion, incurring full latency and output token billing.
* **❌ 6. No Caching:** Repetitive employee questions ("What is our sick leave policy?") hit the LLM 100 times a day, burning budget for identical answers.

---

### ADR 8: Background Asynchronous Processing

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               BACKGROUND PROCESSING ENGINES                                       │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Technology               │ Queue Mechanism             │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. BullMQ + Redis        │ Redis Streams / Lua Scripts │ 🏆 SELECTED (Node.js ecosystem)          │
│ 2. Celery + RabbitMQ     │ AMQP Broker                 │ ❌ REJECTED (Extra infrastructure)       │
│ 3. AWS SQS + Lambda      │ Cloud Managed Queue         │ ❌ REJECTED (Cloud lock-in / local dev)  │
│ 4. Apache Kafka          │ Distributed Commit Log      │ ❌ REJECTED (Massive operational bloat)  │
│ 5. In-Memory Async       │ `asyncio` / `setImmediate`  │ ❌ REJECTED (Zero durability on crash)   │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. BullMQ on Redis — SELECTED**
* **Why Selected:**
  1. **Native TypeScript Integration:** Embeds cleanly into the Node.js API Gateway with zero cross-runtime friction.
  2. **Enterprise Lifecycle:** Built-in rate limiting per tenant, exponential backoff retries, parent-child job workflows, and progress tracking.

#### **❌ Evaluated Alternatives & Rejection Reasons:**
* **❌ 2. Celery + RabbitMQ:** Requires introducing RabbitMQ as an additional stateful infrastructure component alongside Redis; complex configuration and monitoring compared to Redis-native BullMQ.
* **❌ 3. AWS SQS + Lambda:** Breaks local development ergonomics (requires LocalStack); introduces vendor lock-in.
* **❌ 4. Apache Kafka:** Extremely complex to operate (ZooKeeper/KRaft, partition rebalancing, consumer lag tuning) for simple document chunking tasks.
* **❌ 5. In-Memory Async Tasks (`asyncio.create_task`):** Zero durability. If a container restarts or deploys a new version while processing a 200-page document, the job is permanently lost.

---

### ADR 9: Context Memory Management Strategy

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               CONTEXT MEMORY STRATEGIES                                           │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Strategy                 │ Context Window Handling     │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Sliding + Summary     │ 6 Raw Turns + Async Summary │ 🏆 SELECTED (Predictable Token Budget)   │
│ 2. Unbounded Full History│ Send Entire Conversation    │ ❌ REJECTED (Context blowout & cost)     │
│ 3. Fixed Buffer Window   │ Hard Cutoff of Last N msgs  │ ❌ REJECTED (Amnesia on earlier facts)   │
│ 4. Vector Memory (RAG)   │ Embed Past User Messages    │ ❌ REJECTED (Fragments dialogue context) │
│ 5. Knowledge Graph Memory│ Extract Entity Relations    │ ❌ REJECTED (High extraction overhead)   │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. Sliding Window with Background Summarization — SELECTED**
* **Why Selected:**
  1. **Bounded Token Expenditure:** Keeps the last 6 messages raw for immediate conversational coherence. Messages older than 6 turns are condensed into a 200-word running summary by an asynchronous worker.
  2. **Zero Context Loss:** Key facts (user preferences, project names) are preserved in the summary, avoiding the abrupt amnesia of hard cutoffs.

#### **❌ Evaluated Alternatives & Rejection Reasons:**
* **❌ 2. Unbounded Full History:** By message 30, prompts reach 15,000+ tokens, slowing TTFT by 3 seconds and exhausting the user's budget.
* **❌ 3. Fixed Buffer Window Only (Hard Cutoff):** Completely deletes messages older than 6 turns; user asks *"What was the task we created earlier?"* and the assistant has no recollection.
* **❌ 4. Vector Memory (Retrieving Past Messages via RAG):** Breaks the natural temporal flow of conversation by retrieving out-of-order single message turns.
* **❌ 5. Knowledge Graph Memory:** Requires extracting entity relationships after every turn, adding 1.5 seconds of background processing time per message.

---

### ADR 10: Tool Execution, Sandboxing & Safety Validation

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               TOOL EXECUTION & SAFETY PARADIGMS                                   │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Strategy                 │ Validation & Safety Layer   │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Pydantic v2 + HITL    │ Schema Enforcement + Confim │ 🏆 SELECTED (Defensive Architecture)     │
│ 2. Unvalidated JSON      │ Raw `json.loads(tool_call)` │ ❌ REJECTED (Injection & crash risk)     │
│ 3. Direct Python `eval`  │ Code Interpreter Runtime    │ ❌ REJECTED (Remote Code Execution RCE)  │
│ 4. Docker Micro-Sandbox  │ Dedicated Container per Run │ ❌ REJECTED (Excessive boot overhead)    │
│ 5. Autonomous Mutation   │ Execute Without User Prompt │ ❌ REJECTED (Dangerous destructive ops)  │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

#### **🏆 1. Pydantic v2 Contract Validation with Human-in-the-Loop Confirmation — SELECTED**
* **Why Selected:**
  1. **Strict Type Safety:** Parameter schemas are validated against Pydantic v2 models before executing any API call. Invalid parameters are caught immediately, prompting the LLM to self-correct.
  2. **Human Confirmation for High-Risk Actions:** Write operations (`delete_project`, `cancel_subscription`, `bulk_assign_tasks`) trigger an interactive confirmation modal on the client; the action cannot execute until the user clicks "Confirm".

#### **❌ Evaluated Alternatives & Rejection Reasons:**
* **❌ 2. Unvalidated JSON String Passing:** An LLM hallucination passing `"due_date": "yesterday"` or `"priority": "URGENT_NOW"` crashes the backend API with a 500 Internal Server Error.
* **❌ 3. Direct Code Execution (`eval()` / `exec()`):** Critical Remote Code Execution (RCE) vulnerability. A prompt-injected LLM could execute `os.system("rm -rf /")`.
* **❌ 4. Docker Micro-Containers per Tool Execution:** Starting a container per API call adds 1–3 seconds of spin-up latency, which is unnecessary for REST API invocations.
* **❌ 5. Autonomous Unprompted Mutation:** Allowing the LLM to delete records or mutate financial subscriptions without human confirmation causes irreversible data loss on hallucinations.

---

## 3. Phased 12-Module Implementation Plan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       IMPLEMENTATION PHASES & MILESTONES                    │
├────────────┬────────────────────────────────────────────┬───────────────────┤
│ Phase      │ Deliverables                               │ Estimated Effort  │
├────────────┼────────────────────────────────────────────┼───────────────────┤
│ Module 1   │ Requirements, Schema & Exhaustive ADRs     │ Complete          │
│ Module 2   │ Node.js Gateway, JWT Auth & Multi-Tenancy  │ Milestone 1       │
│ Module 3   │ Next.js 16 Conversational UI & History     │ Milestone 2       │
│ Module 4   │ Python FastAPI Microservice & Core Engine  │ Milestone 3       │
│ Module 5   │ Production RAG (HNSW, BM25, FlashRank)     │ Milestone 4       │
│ Module 6   │ LangGraph Cyclic State Machine & Self-Corr │ Milestone 5       │
│ Module 7   │ Tool Execution & Human-in-the-Loop Gates   │ Milestone 6       │
│ Module 8   │ Server-Sent Events (SSE) Streaming Engine  │ Milestone 7       │
│ Module 9   │ Multi-Turn Sliding Context & Summarizer    │ Milestone 8       │
│ Module 10  │ Redis Semantic Caching & Rate Limiting     │ Milestone 9       │
│ Module 11  │ Security Guardrails & Ragas Evaluation     │ Milestone 10      │
│ Module 12  │ Docker Containerization & Cloud SRE        │ Milestone 11      │
└────────────┴────────────────────────────────────────────┴───────────────────┘
```

---

## 4. Ready for Module 2 Implementation

With the requirements locked and all 10 ADRs exhaustively analyzed, we are ready to build:

**Module 2: Authentication & Backend (Node.js API Gateway, Multi-Tenant JWT, PostgreSQL Database Setup & Seeding)**:
1. Setting up `backend-node/` with Express, TypeScript, and Prisma/SQL.
2. Building JWT authentication with tenant context injection (`req.tenantId`, `req.userId`, `req.userRole`).
3. Configuring PostgreSQL tables with Row-Level Security (RLS).
4. Creating seed scripts with multi-tenant sample data (Org A vs Org B) to test data isolation immediately.

Say **"Proceed to Module 2"** to start writing the code! 🚀
