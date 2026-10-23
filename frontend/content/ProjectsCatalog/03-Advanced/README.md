# Advanced Projects: Distributed Systems & Scale

> "Advanced projects tackle distributed systems reality: network partitions, high concurrency, asynchronous event coordination, infrastructure as code, and autonomous agent loops."

---

## Project Catalog

### Project 1: Distributed Sliding-Window Rate Limiter & API Gateway
- **Domain**: Backend & Distributed Systems
- **Core Skills**: Redis Lua scripts for atomic operations, sliding-window counter algorithm, HTTP reverse proxy middleware, distributed rate limit enforcement across multiple gateway instances.
- **Tech Stack**: Go OR Node.js / TypeScript, Redis, Docker.
- **Key Requirements**:
  - Implement atomic sliding-window rate limiting per API key and per IP address.
  - Lua script execution in Redis to guarantee zero race conditions between concurrent requests.
  - Return standardized rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
  - Graceful degradation: allow requests through if Redis cluster is temporarily unreachable.
- **Exit Verification**: Benchmark with Apache Bench or k6 sending 5,000 req/sec; verify exact threshold enforcement without false rejections.

---

### Project 2: Real-Time Collaborative Canvas with WebSockets & Redis Pub/Sub
- **Domain**: Full-Stack & Networking
- **Core Skills**: Persistent WebSockets, Redis Pub/Sub for horizontal scaling across multiple backend instances, Conflict-Free Replicated Data Types (CRDTs) or operational state synchronization, cursor presence tracking.
- **Tech Stack**: Next.js, Node.js (ws / Socket.io), Redis Pub/Sub, PostgreSQL.
- **Key Requirements**:
  - Multiple users drawing or editing simultaneously with real-time updates (< 50ms latency).
  - Multi-node backend architecture: user on Server A sees actions performed by user on Server B via Redis Pub/Sub.
  - User presence heartbeat: broadcast active user cursors and disconnect state cleanly on tab close.
  - Persist final board snapshot to PostgreSQL periodically.
- **Exit Verification**: Open 3 browser windows simultaneously; verify instantaneous cross-window synchronization and presence tracking.

---

### Project 3: Autonomous Developer Agent with Sandboxed Tool Execution
- **Domain**: Generative AI & Agents
- **Core Skills**: ReAct reasoning loops, LangGraph state machines, sandboxed code execution, structured tool schemas, automated LLM-as-a-judge benchmarking.
- **Tech Stack**: Python, LangGraph, OpenAI / Anthropic, Docker / E2B microVMs, Ragas.
- **Key Requirements**:
  - Agent receives a high-level coding instruction (e.g. *"Debug and fix the failing unit test in app/auth.py"*).
  - Agent executes iterative steps: reads files, executes shell commands in sandbox, analyzes error logs, writes patch.
  - Hard cycle limits and token budgets to prevent runaway execution loops.
  - Evaluate against a benchmark of 10 buggy repositories, scoring automated pass rates.
- **Exit Verification**: Run the evaluation harness; agent must autonomously diagnose, patch, and pass tests on at least 7 out of 10 test repos.

---

### Project 4: Production AWS Infrastructure via Modular Terraform
- **Domain**: Cloud & Infrastructure as Code (IaC)
- **Core Skills**: Terraform modules, remote state with S3 and DynamoDB state locking, AWS VPC, EKS, RDS Aurora PostgreSQL, Application Load Balancer, Route 53, IAM least-privilege roles.
- **Tech Stack**: Terraform, AWS CLI, Bash.
- **Key Requirements**:
  - Multi-AZ VPC module with public, private, and database subnets across 3 availability zones.
  - Managed AWS EKS Kubernetes cluster module with autoscaling node groups.
  - RDS Aurora PostgreSQL cluster provisioned inside private database subnets.
  - Parameterized environment workspaces (`staging` vs `production`).
- **Exit Verification**: Run `terraform plan` and `terraform apply`; verify all resources provisioned cleanly and outputs pass automated security linting with `tfsec`.

---

### Project 5: Event-Driven Microservices Order & Inventory Saga
- **Domain**: System Design & Microservices
- **Core Skills**: Distributed transactions, Saga Orchestration pattern, Transactional Outbox pattern, Apache Kafka or RabbitMQ, compensating transactions.
- **Tech Stack**: Java (Spring Boot) OR Node.js (NestJS), Apache Kafka / RabbitMQ, PostgreSQL, Docker.
- **Key Requirements**:
  - Separate `OrderService`, `PaymentService`, and `InventoryService` with isolated databases.
  - When an order is placed, emit `OrderCreated` event to Kafka via Transactional Outbox table.
  - If payment succeeds but inventory is insufficient, trigger compensating transactions to refund payment and cancel order.
  - Zero dual-write inconsistencies between database and message broker.
- **Exit Verification**: Simulate out-of-stock scenario; verify through logs and database state that compensation transaction executed automatically.
