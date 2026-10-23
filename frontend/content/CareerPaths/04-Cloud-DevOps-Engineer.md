# Cloud & DevOps Engineer Career Roadmap

> "A Cloud & DevOps Engineer codifies infrastructure, automates continuous delivery pipelines, maintains container orchestrators, and guarantees high availability, security, and observability across global cloud environments."

---

## The Learning Sequence

```
                      Cloud & DevOps Engineer
                                 │
                                 ▼
               Phase 1: Linux Internals & Shell Automation
                                 │
                                 ▼
               Phase 2: Networking, DNS & Transport Security
                                 │
                                 ▼
               Phase 3: Git Architecture & CI/CD Pipelines
                                 │
                                 ▼
               Phase 4: Containerization with Docker
                                 │
                                 ▼
               Phase 5: Cloud Architecture with AWS
                                 │
                                 ▼
               Phase 6: Infrastructure as Code (Terraform)
                                 │
                                 ▼
               Phase 7: Container Orchestration (Kubernetes)
                                 │
                                 ▼
               Phase 8: Observability, SRE & Chaos Engineering
```

---

## Phase Breakdown & Curriculum Links

### Phase 1: Linux Internals & Shell Scripting
- [Operating Systems Core](../01-FOUNDATIONS/03-OS/README.md) — Process lifecycles, virtual memory paging, CPU scheduling, I/O multiplexing.
- [Shell Scripting](../01-FOUNDATIONS/03-OS/ShellScripting/README.md) — Bash scripting, pipes, sed, awk, cron jobs, log file parsing, system performance commands (`htop`, `iostat`, `strace`, `lsof`).

### Phase 2: Computer Networking & Security
- [Networking Master Guide](../01-FOUNDATIONS/04-Networking/README.md) — OSI model, TCP windowing, UDP, DNS records, HTTP/1.1 to HTTP/3, TLS 1.3 handshakes, SSL certificates.
- [Security Fundamentals](../02-SOFTWARE-ENGINEERING/04-Security/README.md) — Network firewalls, WAF, SSH hardening, Zero Trust architecture, secret management.

### Phase 3: Developer Tools & CI/CD Automation
- [Git Internals](../04-SYSTEMS-INFRASTRUCTURE/04-Developer-Tools/Git/README.md) — DAG model, interactive rebasing, emergency reflog recovery, trunk-based development.
- [GitHub Actions](../04-SYSTEMS-INFRASTRUCTURE/03-DevOps/GithubActions/README.md) — Workflow syntax, matrix builds, artifact caching, automated test runners, environments and approvals.

### Phase 4: Containerization with Docker
- [Docker Master Curriculum](../04-SYSTEMS-INFRASTRUCTURE/03-DevOps/Docker/README.md) — Linux namespaces & cgroups, multi-stage builds, rootless containers, image layer caching, Docker Compose production setups.

### Phase 5: Cloud Architecture with AWS
- [AWS Cloud Master Course](../04-SYSTEMS-INFRASTRUCTURE/02-Cloud/AWS/README.md) — VPC design (public/private subnets, NAT gateways, route tables), EC2, ECS (Fargate), S3, RDS Multi-AZ, IAM policies, Application Load Balancers (ALB), Route 53.
- [AWS LocalStack](../04-SYSTEMS-INFRASTRUCTURE/02-Cloud/AWS-Local/README.md) — Local cloud emulation for offline verification.

### Phase 6: Infrastructure as Code (IaC) with Terraform
- [Terraform Master Curriculum](../04-SYSTEMS-INFRASTRUCTURE/03-DevOps/Terraform/README.md) — Declarative HCL syntax, provider configurations, remote state locking with S3/DynamoDB, modular architecture, drift detection, resource dependencies.

### Phase 7: Container Orchestration with Kubernetes (K8s)
- [Kubernetes Master Curriculum](../04-SYSTEMS-INFRASTRUCTURE/03-DevOps/Kubernetes/README.md) — Cluster control plane, Pods, Deployments, Services (ClusterIP, NodePort, LoadBalancer), Ingress controllers, ConfigMaps, Secrets, Horizontal Pod Autoscaling (HPA), Helm charts.

### Phase 8: Observability, SRE & Resiliency
- [Microservices Monitoring & Observability](../04-SYSTEMS-INFRASTRUCTURE/01-System-Design/Microservices-and-Cloud/Phase-12-Monitoring-and-Observability/README.md) — The Four Golden Signals, Prometheus metrics scraping, Grafana dashboards, OpenTelemetry distributed tracing.
- [Resiliency Patterns](../04-SYSTEMS-INFRASTRUCTURE/01-System-Design/Microservices-and-Cloud/Phase-10-Resiliency-and-Fault-Tolerance/README.md) — Circuit breakers, rate limiters, chaos engineering.

---

## Recommended Portfolio Projects

| Tier | Project | Key Stack |
|---|---|---|
| **Beginner** | [Linux Automated Backup & Verification Utility](../06-PROJECTS/01-Beginner/README.md) | Bash, cron, tar, rsync, checksums |
| **Intermediate** | [Containerized Microservices Local Dev Environment](../06-PROJECTS/02-Intermediate/README.md) | Docker, Docker Compose, Nginx Reverse Proxy |
| **Advanced** | [Infrastructure as Code & Multi-Region VPC Deployment](../06-PROJECTS/03-Advanced/README.md) | Terraform, AWS VPC, ALB, Auto-Scaling Groups |
| **Capstone** | [Kubernetes-Orchestrated Microservices Cloud with Full Observability](../06-PROJECTS/04-Capstones/README.md) | Kubernetes, Helm, GitHub Actions CI/CD, Prometheus, Grafana |

---

## Interview & Career Readiness

- [Aptitude Preparation](../07-INTERVIEW-PREP/01-Aptitude/README.md) — Quantitative & analytical readiness.
- [HR & Behavioral Interview Prep](../07-INTERVIEW-PREP/02-HR-Interview-QA.md) — SRE incident management behavioral scenarios.
