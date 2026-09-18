# Intermediate Projects: Multi-Tier Applications & APIs

> "Intermediate projects move beyond single files into cohesive multi-tier architectures: connecting relational databases with migrations, securing endpoints with JWT tokens, and packaging services into Docker containers."

---

## Project Catalog

### Project 1: Full-Stack Multi-Tenant SaaS App with Auth
- **Domain**: Full-Stack & Security
- **Core Skills**: Next.js App Router, NestJS / Express API, PostgreSQL relational modeling, JWT authentication with refresh token rotation, Docker Compose.
- **Tech Stack**: Next.js, TypeScript, PostgreSQL, Prisma / Drizzle ORM, Docker.
- **Key Requirements**:
  - User registration and login with bcrypt password hashing and HTTP-only cookie JWT tokens.
  - Multi-tenant data isolation: users can only query, update, or delete their own data.
  - Database schema migrations managed via ORM toolchain.
  - Full Docker Compose environment spinning up both frontend, backend, and database in one command.
- **Exit Verification**: Automated end-to-end test verifying registration, login, and tenant boundary enforcement.

---

### Project 2: Stripe Billing & Subscription Webhook Engine
- **Domain**: Backend Development & Financial Ops
- **Core Skills**: Payment gateway integration, asynchronous webhook consumption, cryptographic signature verification, idempotency handling, database state transitions.
- **Tech Stack**: Node.js / NestJS OR Spring Boot, Stripe API, PostgreSQL, Redis.
- **Key Requirements**:
  - Create checkout sessions for monthly/annual recurring subscription tiers.
  - Securely handle `invoice.payment_succeeded`, `invoice.payment_failed`, and `customer.subscription_deleted` webhooks.
  - Enforce idempotency using Redis or database unique constraint to prevent duplicate processing.
  - Handle race conditions between user redirection and webhook delivery.
- **Exit Verification**: Trigger simulated Stripe webhook events using the Stripe CLI and verify database subscription updates without double-crediting.

---

### Project 3: Production Containerization & CI/CD Pipeline
- **Domain**: DevOps & CI/CD
- **Core Skills**: Multi-stage Dockerfile optimization (< 150MB image), GitHub Actions matrix builds, automated test execution, container image publishing to GitHub Packages / Docker Hub.
- **Tech Stack**: Docker, GitHub Actions, Node.js / Go / Python.
- **Key Requirements**:
  - Non-root user execution in Docker runner stage.
  - GitHub Actions pipeline triggered on Pull Requests: runs linting, executes unit tests, scans image with Trivy for vulnerabilities.
  - On merge to `main`, tags image with Git SHA and pushes to container registry.
- **Exit Verification**: Pull request check passes automatically; container image runs successfully when pulled from remote registry.

---

### Project 4: Full-Stack Enterprise RAG Document Assistant
- **Domain**: Generative AI & Vector Databases
- **Core Skills**: Document chunking, dense vector embeddings, PostgreSQL with `pgvector` HNSW indexing, Server-Sent Events (SSE) streaming, source citation rendering.
- **Tech Stack**: Next.js, FastAPI / Python, pgvector, OpenAI / Anthropic APIs.
- **Key Requirements**:
  - Upload PDF/Markdown files, extract text, chunk with sliding window overlap, and generate embeddings.
  - Query database using cosine similarity ($k=5$) and inject retrieved context into system prompt.
  - Stream tokens back to the frontend in real time, displaying clickable inline citations.
- **Exit Verification**: Ask questions about an uploaded document; verify answer accuracy and verify that citations link to source text passages.

---

### Project 5: Object-Oriented Low-Level Design Simulation (Splitwise or Parking Lot)
- **Domain**: Low-Level Design (LLD) & Software Craftsmanship
- **Core Skills**: Object-Oriented Analysis, SOLID principles, GoF Design Patterns (Strategy, Observer, Factory), Concurrency safety, UML class diagram generation.
- **Tech Stack**: Java OR TypeScript OR Python.
- **Key Requirements**:
  - Model entities with clear separation of concerns (e.g. `User`, `Group`, `Expense`, `Split` with `ExactSplit`, `PercentageSplit`, `EqualSplit`).
  - Implement algorithms to minimize cash flow / simplify debt settlements.
  - Expose a clean, modular service layer with comprehensive unit tests.
- **Exit Verification**: Test suite verifying expense splits across 10 users and ensuring simplified balance settlements match expected net balances.
