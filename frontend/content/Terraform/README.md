# Terraform — Complete Learning Course

Master Terraform from zero to production. This course covers everything from Infrastructure-as-Code
fundamentals through state management, modules, workspaces, security, testing, CI/CD, and
production best practices — using AWS as the primary example provider throughout.

---

## Course Structure

```
Terraform/
├── Phase-01-Fundamentals/                    → IaC concept, install, providers, init/plan/apply/destroy, HCL basics
├── Phase-02-Resources-Providers/              → Resource blocks, provider config/versioning, dependencies
├── Phase-03-Variables-Outputs/                → Input variables, types, validation, locals, outputs
├── Phase-04-State-Management/                 → State file internals, remote backends, locking, terraform state, import
├── Phase-05-Data-Sources-Expressions/         → Data blocks, functions, conditionals, for-loops
├── Phase-06-Modules/                          → Module structure, composition, registry, versioning
├── Phase-07-Workspaces-Environments/          → Workspaces, multi-environment strategy, tfvars
├── Phase-08-Meta-Arguments-Provisioners/      → count, for_each, depends_on, lifecycle, provisioners
├── Phase-09-Terraform-Cloud-Remote-Backends/  → Terraform Cloud, remote execution, collaboration
├── Phase-10-Security-Secrets/                 → Sensitive vars, Vault integration, IAM least privilege, state security
├── Phase-11-Testing-CICD/                     → validate, plan review, terraform test, GitOps
├── Phase-12-Production-Best-Practices/        → Module patterns, drift detection, cost mgmt, DR
├── Quick-Reference/                           → Cheatsheet + 50 interview Q&A
└── Projects/                                  → Beginner → Advanced hands-on projects
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Fundamentals | Beginner | 3 days |
| 02 | Resources & Providers | Beginner | 3 days |
| 03 | Variables & Outputs | Beginner | 2 days |
| 04 | State Management | Intermediate | 3 days |
| 05 | Data Sources & Expressions | Intermediate | 3 days |
| 06 | Modules | Intermediate | 4 days |
| 07 | Workspaces & Environments | Intermediate | 2 days |
| 08 | Meta-Arguments & Provisioners | Advanced | 3 days |
| 09 | Terraform Cloud & Remote Backends | Advanced | 3 days |
| 10 | Security & Secrets | Advanced | 3 days |
| 11 | Testing & CI/CD | Advanced | 3 days |
| 12 | Production Best Practices | Advanced | 3 days |

**Total estimated time: 8-10 weeks**

---

## Prerequisites

- Basic command line comfort (bash/zsh)
- A cloud provider account for hands-on practice (AWS assumed; concepts transfer to Azure/GCP)
- Basic networking concepts (VPCs, subnets, security groups)
- Helpful but not required: exposure to Docker/Kubernetes (see [Docker](../Docker/README.md), [Kubernetes](../Kubernetes/README.md))

---

## Terraform Workflow Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      Terraform Core Workflow                     │
│                                                                    │
│   .tf files            terraform init         Provider plugins   │
│  ┌──────────┐         ┌──────────────┐       ┌────────────────┐ │
│  │ main.tf  │ ──────▶ │ Download      │ ────▶│ aws, azurerm,   │ │
│  │ vars.tf  │         │ providers &   │       │ google, ...     │ │
│  │ outputs  │         │ init backend  │       └────────────────┘ │
│  └──────────┘         └──────────────┘                            │
│        │                                                          │
│        ▼                                                          │
│  terraform plan  ──▶  Diff: desired (config) vs actual (state)   │
│        │                                                          │
│        ▼                                                          │
│  terraform apply ──▶  Calls provider APIs → creates/updates infra │
│        │                                                          │
│        ▼                                                          │
│  terraform.tfstate  (source of truth for what Terraform manages)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Projects

| Project | Level | Description |
|---------|-------|-------------|
| Single VM Instance | Beginner | Provision one EC2 instance with Terraform |
| VPC & Networking Setup | Beginner | VPC, subnets, route tables, security groups |
| Multi-Tier App Infra | Intermediate | VPC + EC2 + RDS wired together |
| Reusable Module, Multi-Environment | Intermediate | One module, three environments (dev/staging/prod) |
| CI/CD Pipeline | Advanced | GitHub Actions → plan → manual approval → apply |
| Terraform Cloud Collaboration | Advanced | Remote state, remote runs, team workflow |

---

## Quick Commands

```bash
terraform init                      # download providers, init backend
terraform plan                      # preview changes
terraform apply                     # create/update infrastructure
terraform destroy                   # tear down everything Terraform manages
terraform fmt -recursive            # format all .tf files
terraform validate                  # check syntax/config validity
terraform state list                # list resources tracked in state
terraform workspace list            # list workspaces
```
