# Terraform Master Course — Projects

This section contains six hands-on projects that take you from a single EC2 instance all the way to a Terraform Cloud–managed, VCS-driven, team-collaborative workflow. Complete them in order; each one builds on the skills introduced in earlier phases of the course.

## Project Overview

| # | Project | Level | Phase Prerequisites | Description |
|---|---------|-------|---------------------|--------------|
| 1 | Single VM Instance | Beginner | Phase 1 – Fundamentals, Phase 2 – Resources & Providers | Provision a single EC2 instance with a security group allowing SSH/HTTP and output its public IP |
| 2 | VPC Networking Setup | Beginner | Phase 2 – Resources & Providers, Phase 3 – Variables & Outputs | Build a VPC with public and private subnets across 2 AZs, an Internet Gateway, route tables, and a NAT Gateway |
| 3 | Multi-Tier App Infra | Intermediate | Phase 4 – State Management, Phase 5 – Data Sources & Expressions | Wire a VPC, EC2 web tier, and RDS MySQL together with security groups that restrict DB access to the web tier only |
| 4 | Reusable Module, Multi-Environment | Intermediate | Phase 6 – Modules, Phase 7 – Workspaces & Environments | Extract web+DB infra into a local module and instantiate it for dev/staging/prod with separate `.tfvars` files and remote state keys |
| 5 | CI/CD Pipeline (GitHub Actions) | Advanced | Phase 9 – Terraform Cloud & Remote Backends, Phase 11 – Testing & CI/CD | Automate fmt/validate/plan on PR with a bot comment, a manual approval gate, and apply on merge to main |
| 6 | Terraform Cloud Remote State & Collaboration | Advanced | Phase 9 – Terraform Cloud & Remote Backends, Phase 12 – Production Best Practices | Migrate to a Terraform Cloud workspace with the `cloud` block, VCS-connected runs, and team-based access |

---

## Project Summaries

### 1. Single VM Instance (Beginner)
Write your first real Terraform configuration: an EC2 instance, a security group allowing inbound SSH and HTTP, and an output that prints the instance's public IP once `apply` finishes. Practises the core `init → plan → apply → destroy` loop and data-source lookups for the latest AMI.

### 2. VPC Networking Setup (Beginner)
Build a production-shaped network foundation from scratch: a custom VPC spanning two Availability Zones, public and private subnets in each, an Internet Gateway, a shared NAT Gateway, and the route tables that connect them. This networking layer underpins every later project.

### 3. Multi-Tier App Infra (Intermediate)
Combine a VPC, an EC2 web tier in public subnets, and an RDS MySQL instance in private subnets into a single two-tier application. The database security group references the web tier's security group by ID rather than a CIDR block, so only the web tier — never the internet — can reach port 3306.

### 4. Reusable Module, Multi-Environment (Intermediate)
Extract the web+DB pattern from Project 3 into a local Terraform module, then instantiate it three times for `dev`, `staging`, and `prod`, each with its own `.tfvars` file and its own remote state key in S3. Conditional logic inside the module hardens `prod` (Multi-AZ RDS, deletion protection) while keeping `dev` cheap and disposable — all from the same source.

### 5. CI/CD Pipeline (GitHub Actions) (Advanced)
Wrap your infrastructure in a GitHub Actions workflow that runs `fmt`/`validate`/`plan` on every pull request and posts the plan output as a PR comment, gates `apply` behind a GitHub Environment's required-reviewer approval, and runs `terraform apply` automatically once a merge to `main` is approved.

### 6. Terraform Cloud Remote State & Collaboration (Advanced)
Migrate state from local/S3 into a Terraform Cloud workspace using the `cloud` block, connect the workspace directly to your GitHub repository so pushes trigger remote plans automatically, and configure team-based permissions so who can *plan* and who can *apply* are controlled independently — without distributing AWS credentials to every laptop.
