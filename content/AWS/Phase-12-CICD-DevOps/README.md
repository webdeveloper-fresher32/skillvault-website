# Phase 12: CI/CD and DevOps on AWS

## Overview

This phase covers Continuous Integration, Continuous Delivery, and Continuous Deployment (CI/CD) pipelines on AWS, as well as GitHub Actions integration. Mastering CI/CD is essential for modern cloud engineers and is heavily tested in AWS Developer Associate and DevOps Professional exams.

---

## Files in This Phase

| File | Topic | Key Services |
|------|-------|-------------|
| 01-CICD-Concepts.md | Core CI/CD theory and patterns | Concepts only |
| 02-AWS-Developer-Tools.md | AWS-native CI/CD services | CodeCommit, CodeBuild, CodeDeploy, CodePipeline, CodeArtifact |
| 03-GitHub-Actions-AWS.md | GitHub Actions + AWS integration | GitHub Actions, ECR, ECS, Lambda, OIDC |

---

## Why CI/CD Matters

Manual deployments are:
- Slow (human steps introduce delay)
- Error-prone (steps get skipped or done out of order)
- Hard to audit (no clear log of who did what when)
- Inconsistent (works on my machine problems)

CI/CD pipelines automate the path from developer commit to production deployment, enforcing consistency, speed, and quality gates at every step.

---

## AWS CI/CD Landscape

```
Developer Pushes Code
         |
         v
  [Source Repository]
  CodeCommit / GitHub / GitLab / Bitbucket / S3
         |
         v
  [Build & Test]
  AWS CodeBuild
  - Compile code
  - Run unit tests
  - Run linting / SAST
  - Build Docker image
  - Push to ECR / S3
         |
         v
  [Deploy]
  AWS CodeDeploy
  - In-place deployment to EC2
  - Blue/Green deployment to ECS
  - Lambda version deployment
         |
         v
  [Orchestration]
  AWS CodePipeline
  - Ties Source + Build + Deploy into a single automated pipeline
  - Supports manual approval gates
  - Integrates with SNS for notifications
```

---

## Key Exam Topics for This Phase

1. **CodeBuild buildspec.yml** - structure, phases, artifacts, cache
2. **CodeDeploy appspec.yml** - lifecycle hooks, deployment types
3. **CodePipeline stages** - what can be a source, what actions are available
4. **Blue/Green vs In-Place** - trade-offs, rollback behavior
5. **GitHub Actions OIDC** - why it is preferred over IAM access keys
6. **Canary deployments** - what they are, how CodeDeploy implements them

---

## Learning Path

```
Start Here
    |
    v
01-CICD-Concepts.md        <-- Theory foundation (read first)
    |
    v
02-AWS-Developer-Tools.md  <-- AWS-specific implementation
    |
    v
03-GitHub-Actions-AWS.md   <-- GitHub integration (very common in real jobs)
```

---

## Quick Reference: When to Use What

| Scenario | Use |
|----------|-----|
| All code in AWS, want managed pipeline | CodePipeline + CodeBuild + CodeDeploy |
| Code in GitHub, want AWS deployments | GitHub Actions with OIDC |
| Need to deploy to EC2 with lifecycle hooks | CodeDeploy in-place |
| Need zero-downtime ECS deployment | CodeDeploy Blue/Green |
| Need package repository (npm, Maven, PyPI) | CodeArtifact |
| Build Docker image and push to ECR | CodeBuild or GitHub Actions |
| Deploy Lambda function | CodeDeploy (Lambda linear/canary) or GitHub Actions |

---

## Prerequisites

- Phase 4: EC2 (deployment targets)
- Phase 6: S3 (artifact storage)
- Phase 7: ECS (container deployments)
- Phase 8: Serverless Lambda (Lambda deployments)
- Phase 10: IaC Terraform/CloudFormation (infrastructure as code in pipelines)
