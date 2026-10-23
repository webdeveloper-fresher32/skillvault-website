# Capstone Projects: Production Portfolio Systems

> "A capstone project is the definitive proof of your engineering capability. It is not an MVP or a tutorial fork; it is a fully engineered, deployed, secured, tested, and observed production system that commands immediate respect in senior technical interviews."

---

## Capstone Project Catalog

### Capstone 1: Enterprise Multi-Tenant E-Commerce Platform
- **Career Path**: Full-Stack Engineer / Software Engineer
- **Architectural Scope**:
  - **Frontend**: Next.js 14+ (App Router, Server Components, Tailwind CSS, Responsive Cart/Checkout).
  - **Backend**: NestJS modular microservice architecture exposing REST and Server-Sent Events (SSE).
  - **Data Layer**: PostgreSQL with multi-tenant schema partitioning, Redis caching for product catalogs and user sessions.
  - **Financials**: Complete Stripe checkout flow, asynchronous webhook listeners, idempotency keys, and automated PDF invoice generation.
  - **DevOps & Cloud**: Docker multi-stage builds, GitHub Actions CI/CD with unit/E2E test gates, deployed to AWS ECS Fargate behind an Application Load Balancer with custom domain SSL.
  - **Observability**: Prometheus metrics export and Sentry error tracking.
- **Deliverables**: Public GitHub repository with clean commit history, architectural diagrams, automated test coverage $> 80\%$, and live production URL.

---

### Capstone 2: Distributed High-Throughput Financial Ledger Engine
- **Career Path**: Backend Engineer / Distributed Systems
- **Architectural Scope**:
  - **Core Runtime**: Java (Spring Boot) OR Node.js (NestJS) written with strict OOP and Domain-Driven Design (DDD).
  - **Double-Entry Bookkeeping**: Immutable account ledgers enforcing conservation of money ($\sum \text{debits} = \sum \text{credits}$).
  - **Concurrency & Locks**: Pessimistic row locking (`SELECT FOR UPDATE`) and Redis distributed locks (Redlock) preventing double-spends under high concurrency.
  - **Event-Driven Messaging**: Apache Kafka message pipeline with Transactional Outbox pattern guaranteeing zero message loss.
  - **Deployment**: Kubernetes deployment manifests with Horizontal Pod Autoscaling (HPA) and graceful pod shutdown.
  - **Telemetry**: Distributed tracing via OpenTelemetry and Grafana dashboards monitoring transaction throughput and database connection pool saturation.
- **Deliverables**: Architecture documentation, load testing report demonstrating 2,500+ successful transactions/sec without drift, and Kubernetes deployment scripts.

---

### Capstone 3: Production GitOps Kubernetes Cloud Platform
- **Career Path**: Cloud & DevOps Engineer / SRE
- **Architectural Scope**:
  - **Infrastructure as Code**: 100% automated AWS cloud provisioning using modular Terraform (VPC, EKS Cluster, IAM OIDC, EBS CSI, S3).
  - **GitOps Continuous Delivery**: ArgoCD or Flux managing Kubernetes application deployments driven entirely by Git commit state.
  - **Ingress & Security**: NGINX Ingress controller with Cert-Manager issuing automated Let's Encrypt SSL certificates, network policies, and non-root security contexts.
  - **Observability Stack**: Prometheus Operator, Grafana dashboards with alerting rules connected to Slack/PagerDuty, and Loki centralized log aggregation.
  - **Security Scanning**: Automated CI pipelines in GitHub Actions scanning Terraform code with `tfsec` and Docker images with `trivy`.
- **Deliverables**: Clean Terraform repository with remote state locking, Helm charts, ArgoCD application manifests, and runbooks for disaster recovery.

---

### Capstone 4: End-to-End Enterprise AI Platform with vLLM & CI/CD Eval Gates
- **Career Path**: AI Engineer / LLM Application Engineer
- **Architectural Scope**:
  - **Frontend**: Next.js client with real-time token streaming via Server-Sent Events (SSE) and interactive source citations.
  - **Gateway**: FastAPI gateway enforcing JWT authentication, Presidio PII redaction, and prompt injection defense.
  - **Semantic Caching**: Redis vector similarity cache ($>0.96$ cosine similarity) returning frequent queries in $< 20$ms.
  - **Data Layer**: PostgreSQL with `pgvector` HNSW index for dense embeddings combined with `tsvector` BM25 lexical search, reranked via a cross-encoder (BA05-AI/bge-reranker).
  - **Inference Tier**: Self-hosted vLLM cluster on AWS EC2 GPU instances with PagedAttention, backed by an automated circuit breaker failing over to frontier cloud APIs.
  - **Evaluation & CI/CD**: Automated Ragas CI/CD gate on GitHub Actions evaluating Faithfulness, Answer Relevance, and Context Precision on PRs, blocking regressions.
- **Deliverables**: Complete source repository, benchmarking report demonstrating P99 TTFT and ITL under concurrency, and automated evaluation workflow.
