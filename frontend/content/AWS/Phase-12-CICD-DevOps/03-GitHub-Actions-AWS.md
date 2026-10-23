# GitHub Actions with AWS — Complete Guide

## Table of Contents
1. [What is GitHub Actions?](#what-is-github-actions)
2. [Workflow File Structure](#workflow-file-structure)
3. [Triggers](#triggers)
4. [Jobs](#jobs)
5. [Steps](#steps)
6. [Secrets and Variables](#secrets-and-variables)
7. [AWS Authentication Methods](#aws-authentication-methods)
8. [Complete Pipeline Examples](#complete-pipeline-examples)
9. [Advanced Features](#advanced-features)
10. [GitHub Actions vs CodePipeline](#github-actions-vs-codepipeline)
11. [Interview Q&A](#interview-qa)

---

## 1. What is GitHub Actions?

GitHub Actions is a CI/CD and automation platform built directly into GitHub. It allows you to automate software workflows — build, test, deploy — in response to events that happen within your GitHub repository.

### Why GitHub Actions is the Industry Standard

**Tight GitHub Integration**
- Lives in the same repository as your code (`.github/workflows/`)
- No separate CI system to set up, authenticate, or manage
- Pull request checks, status badges, and merge protections are native

**Ecosystem / Marketplace**
- 20,000+ community-built Actions on the GitHub Marketplace
- Pre-built actions for AWS (`configure-aws-credentials`, `amazon-ecr-login`, `amazon-ecs-deploy-task-definition`) maintained by AWS itself
- No need to write shell scripts for common tasks

**Developer Experience**
- Developers already live in GitHub — no context switching to a separate CI dashboard
- Branch-based workflows map directly to Git branching strategy
- Matrix builds, caching, and artifact sharing built in

**Cost Model**
- Free for public repositories
- 2,000 free minutes/month for private repositories (GitHub Free)
- Self-hosted runners allow you to run on your own EC2/ECS/bare metal

**Flexibility**
- Run on GitHub-managed runners (Ubuntu, Windows, macOS)
- Run on self-hosted runners in your own VPC
- Containers, services, and Docker Compose supported natively

**Comparison to alternatives:**
| Feature | GitHub Actions | Jenkins | CircleCI | AWS CodePipeline |
|---------|---------------|---------|----------|-----------------|
| Hosting | GitHub-managed | Self-hosted | Cloud | AWS-managed |
| Config | YAML in repo | Groovy DSL | YAML | Console/JSON |
| AWS native | Via actions | Via plugins | Via orbs | Native |
| Marketplace | 20,000+ actions | Plugins | Orbs | Limited |
| Free tier | Generous | Free (infra cost) | Limited | Limited |
| OIDC to AWS | Built-in | Manual | Supported | N/A |

---

## 2. Workflow File Structure

Every workflow is a YAML file stored in `.github/workflows/` in your repository. The filename can be anything (e.g., `deploy.yml`, `ci.yml`, `release.yml`).

### Basic Skeleton

```yaml
# .github/workflows/deploy.yml

name: Deploy to Production          # Human-readable name shown in GitHub UI

on:                                 # TRIGGERS — when does this run?
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:                                # GLOBAL environment variables (available to all jobs)
  AWS_REGION: ap-southeast-2
  ECR_REPOSITORY: my-app
  ECS_SERVICE: my-app-service
  ECS_CLUSTER: my-app-cluster
  CONTAINER_NAME: my-app

jobs:                               # JOBS — units of work that run on a runner
  build:                            # Job ID (used for referencing, no spaces)
    name: Build and Test            # Human-readable job name
    runs-on: ubuntu-latest          # Runner environment

    steps:                          # Ordered list of tasks within the job
      - name: Checkout code
        uses: actions/checkout@v4   # Uses a community/official action

      - name: Run tests
        run: npm test               # Run shell commands directly
```

### File Location and Naming
```
your-repo/
├── .github/
│   └── workflows/
│       ├── ci.yml           # Runs on every PR
│       ├── deploy.yml       # Runs on merge to main
│       ├── release.yml      # Runs on tag push
│       └── nightly.yml      # Runs on schedule
├── src/
└── package.json
```

### Workflow Components Hierarchy
```
Workflow (file)
  └── Job 1
  │     ├── Step 1
  │     ├── Step 2
  │     └── Step 3
  └── Job 2 (can depend on Job 1 via `needs`)
        ├── Step 1
        └── Step 2
```

---

## 3. Triggers (`on:`)

The `on:` key defines when the workflow runs.

### Push Trigger
```yaml
on:
  push:
    branches:
      - main
      - 'release/**'       # Glob patterns supported
    branches-ignore:
      - 'dependabot/**'    # Ignore these branches
    tags:
      - 'v*'               # Run on version tags
    paths:                 # Only run if these paths changed
      - 'src/**'
      - 'package.json'
    paths-ignore:
      - '**.md'            # Ignore markdown file changes
```

### Pull Request Trigger
```yaml
on:
  pull_request:
    branches: [main, develop]
    types:
      - opened            # When PR is created
      - synchronize       # When new commit is pushed to PR
      - reopened          # When PR is reopened
    paths:
      - 'src/**'
```

### Schedule Trigger (Cron)
```yaml
on:
  schedule:
    - cron: '0 2 * * 1-5'   # 2am UTC Mon-Fri
    - cron: '0 0 * * 0'     # Midnight UTC Sunday
```
Cron format: `minute hour day-of-month month day-of-week`

### Manual Trigger (workflow_dispatch)
```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      dry_run:
        description: 'Run in dry-run mode?'
        required: false
        type: boolean
        default: false
      version:
        description: 'Version to deploy'
        required: true
        type: string
```
Access via: `${{ github.event.inputs.environment }}`

### Other Common Triggers
```yaml
on:
  release:
    types: [created, published]

  issues:
    types: [opened]

  workflow_run:               # Run after another workflow completes
    workflows: ["CI"]
    types: [completed]
    branches: [main]

  workflow_call:              # Called by another workflow (reusable)
    inputs:
      environment:
        type: string
        required: true
    secrets:
      aws_role:
        required: true
```

---

## 4. Jobs

### Basic Job Configuration
```yaml
jobs:
  my-job:
    name: My Job
    runs-on: ubuntu-latest    # Runner type
    timeout-minutes: 30       # Fail if job exceeds this
    continue-on-error: false  # Fail workflow if this job fails

    steps:
      - run: echo "Hello"
```

### `runs-on` Options
```yaml
# GitHub-hosted runners
runs-on: ubuntu-latest        # Most common, Ubuntu 22.04
runs-on: ubuntu-22.04
runs-on: windows-latest
runs-on: macos-latest
runs-on: macos-14             # Apple Silicon

# Self-hosted runners
runs-on: self-hosted
runs-on: [self-hosted, linux, x64]
runs-on: [self-hosted, linux, arm64, production]

# Larger GitHub-hosted runners (paid)
runs-on: ubuntu-latest-4-cores
```

### `needs` — Job Dependencies
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test

  build:
    runs-on: ubuntu-latest
    needs: test               # Only runs if 'test' passes
    steps:
      - run: npm run build

  deploy:
    runs-on: ubuntu-latest
    needs: [test, build]      # Waits for BOTH jobs
    steps:
      - run: ./deploy.sh
```

### `if` Conditions
```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    # Only deploy to prod from main branch
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - run: echo "Deploying to prod"

  deploy-staging:
    runs-on: ubuntu-latest
    # Deploy to staging on PRs
    if: github.event_name == 'pull_request'
    steps:
      - run: echo "Deploying to staging"
```

Common `if` expressions:
```yaml
if: github.ref == 'refs/heads/main'
if: github.event_name == 'push'
if: contains(github.event.head_commit.message, '[skip ci]') == false
if: github.actor != 'dependabot[bot]'
if: success()                   # Previous step succeeded
if: failure()                   # Previous step failed
if: always()                    # Run regardless of previous step status
if: cancelled()                 # Workflow was cancelled
```

### `strategy.matrix` — Matrix Builds
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false          # Don't cancel other jobs if one fails
      matrix:
        node-version: [16, 18, 20]
        os: [ubuntu-latest, windows-latest]

    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm test
```

Matrix with include/exclude:
```yaml
strategy:
  matrix:
    node: [18, 20]
    include:
      - node: 20
        experimental: true     # Add extra property to node:20 combination
    exclude:
      - node: 18               # Remove this combination
        os: windows-latest
```

### Environment (deployment environments)
```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.com   # Link shown in GitHub UI
    steps:
      - run: ./deploy.sh
```

---

## 5. Steps

### `uses` — Actions
```yaml
steps:
  # Official GitHub actions (pinned to version)
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
  - uses: actions/upload-artifact@v4
  - uses: actions/download-artifact@v4
  - uses: actions/cache@v4

  # AWS actions
  - uses: aws-actions/configure-aws-credentials@v4
  - uses: aws-actions/amazon-ecr-login@v2
  - uses: aws-actions/amazon-ecs-render-task-definition@v1
  - uses: aws-actions/amazon-ecs-deploy-task-definition@v1
```

### `run` — Shell Commands
```yaml
steps:
  # Single line
  - run: npm install

  # Multi-line (pipe preserves newlines)
  - run: |
      npm install
      npm run build
      npm test

  # Different shell
  - run: echo "Hello"
    shell: bash

  # Python
  - run: |
      import json
      print(json.dumps({"status": "ok"}))
    shell: python

  # PowerShell (Windows runners)
  - run: Write-Host "Hello"
    shell: pwsh
```

### `with` — Action Inputs
```yaml
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      cache: 'npm'

  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
      aws-region: ap-southeast-2
```

### `env` — Step Environment Variables
```yaml
steps:
  - name: Run with env vars
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      NODE_ENV: production
      BUILD_NUMBER: ${{ github.run_number }}
    run: |
      echo "Build: $BUILD_NUMBER"
      node deploy.js
```

### `id` — Step Output References
```yaml
steps:
  - name: Get image tag
    id: meta                   # Give the step an ID
    run: echo "tag=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

  - name: Build Docker image
    run: |
      docker build -t myapp:${{ steps.meta.outputs.tag }} .
      # Access output via: steps.<id>.outputs.<name>
```

### Outputs via `$GITHUB_OUTPUT`
```yaml
steps:
  - name: Set outputs
    id: my-step
    run: |
      echo "version=1.2.3" >> $GITHUB_OUTPUT
      echo "environment=production" >> $GITHUB_OUTPUT

  - name: Use outputs
    run: |
      echo "Version: ${{ steps.my-step.outputs.version }}"
      echo "Env: ${{ steps.my-step.outputs.environment }}"
```

---

## 6. Secrets and Variables

### Secrets
Secrets are encrypted values stored in GitHub. They are never logged or exposed in workflow output.

**Where to store:**
- **Repository secrets:** Settings > Secrets and variables > Actions > Repository secrets
- **Environment secrets:** Per-environment secrets (e.g., staging, production) — require environment protection rules
- **Organization secrets:** Shared across multiple repositories in an org

**Accessing in workflows:**
```yaml
steps:
  - name: Deploy
    env:
      API_KEY: ${{ secrets.API_KEY }}
      DB_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
    run: ./deploy.sh

  # Pass to action
  - uses: some-action@v1
    with:
      token: ${{ secrets.GITHUB_TOKEN }}  # Built-in token, auto-generated
```

**Built-in secrets:**
- `secrets.GITHUB_TOKEN` — Auto-generated token for the current repo with repo-scoped permissions

**Security rules:**
- Secrets are masked in logs (replaced with `***`)
- Cannot be accessed by forked repositories' workflows
- Cannot be read back after setting (write-only via UI)
- Max size: 64KB per secret

### Variables (non-sensitive configuration)
```yaml
# Set in: Settings > Secrets and variables > Actions > Variables

steps:
  - name: Use variable
    run: echo "${{ vars.DEPLOY_BUCKET }}"

# Variables are NOT encrypted — use for non-sensitive config only
```

### Expression Contexts
```yaml
${{ github.actor }}           # Username who triggered
${{ github.repository }}      # owner/repo-name
${{ github.ref }}             # refs/heads/main
${{ github.sha }}             # Full commit SHA
${{ github.run_number }}      # Sequential run number
${{ github.run_id }}          # Unique run ID
${{ github.event_name }}      # push, pull_request, etc.
${{ github.workspace }}       # Path to checked-out repo
${{ runner.os }}              # Linux, Windows, macOS
${{ env.MY_VAR }}             # Job-level env variable
${{ job.status }}             # success, failure, cancelled
```

---

## 7. AWS Authentication Methods

### Method 1: Access Keys (Legacy — Avoid in Production)

**How it works:** Long-lived IAM user credentials stored as GitHub secrets.

```yaml
# BAD PRACTICE — only for learning/demo
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_DEFAULT_REGION: ap-southeast-2

# OR using configure-aws-credentials with keys
- uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ap-southeast-2
```

**Why to avoid:**
- Long-lived credentials — if leaked, permanently compromised until manually rotated
- Harder to rotate without downtime
- Violates principle of least privilege and AWS security best practices
- No time-bound access

---

### Method 2: OIDC (Recommended — No Long-Lived Credentials)

**How it works:** GitHub Actions acts as an OpenID Connect (OIDC) identity provider. Your workflow requests a short-lived JWT token from GitHub, presents it to AWS STS, AWS verifies the token's signature against GitHub's JWKS endpoint, and returns temporary credentials (15 min to 1 hour).

**Benefits:**
- No secrets to store, rotate, or leak
- Credentials expire automatically
- Granular conditions: only allow specific repos, branches, environments
- Audit trail in CloudTrail

#### Step 1: Add GitHub as OIDC Identity Provider in AWS

Via AWS Console: IAM > Identity Providers > Add Provider
- Provider type: OpenID Connect
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

Via AWS CLI:
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Via Terraform:
```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}
```

#### Step 2: Create IAM Role with Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:MyOrg/my-repo:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

**Trust Policy Condition Options:**
```json
// Lock to specific repo
"token.actions.githubusercontent.com:sub": "repo:MyOrg/my-repo:*"

// Lock to specific branch
"token.actions.githubusercontent.com:sub": "repo:MyOrg/my-repo:ref:refs/heads/main"

// Lock to specific GitHub Environment
"token.actions.githubusercontent.com:sub": "repo:MyOrg/my-repo:environment:production"

// Allow any branch in repo (less restrictive)
"StringLike": {
  "token.actions.githubusercontent.com:sub": "repo:MyOrg/my-repo:*"
}
```

#### Step 3: Attach Permissions Policy to the Role

Create and attach policies for what the role needs (ECR push, ECS update, S3 sync, etc.):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:RegisterTaskDefinition"
      ],
      "Resource": "*"
    }
  ]
}
```

#### Step 4: Workflow Configuration
```yaml
permissions:
  id-token: write        # REQUIRED: allow workflow to request OIDC token
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
      role-session-name: GitHubActions-${{ github.run_id }}
      aws-region: ap-southeast-2
      role-duration-seconds: 3600  # 1 hour max
```

---

## 8. Complete Pipeline Examples

### Example 1: Node.js App → Docker → ECR → ECS Fargate

```yaml
# .github/workflows/deploy.yml
name: Deploy to ECS Fargate

on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-southeast-2
  ECR_REPOSITORY: my-nodejs-app
  ECS_SERVICE: my-app-service
  ECS_CLUSTER: my-app-cluster
  CONTAINER_NAME: my-app
  TASK_DEFINITION: my-app-task-def

permissions:
  id-token: write
  contents: read

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  build-and-deploy:
    name: Build, Push, and Deploy
    runs-on: ubuntu-latest
    needs: test
    environment:
      name: production
      url: https://myapp.example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      # OIDC Authentication — no long-lived credentials
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsECSRole
          role-session-name: GitHubActions-${{ github.run_id }}
          aws-region: ${{ env.AWS_REGION }}

      # Login to Amazon ECR
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      # Generate a unique image tag
      - name: Generate image metadata
        id: meta
        run: |
          REGISTRY=${{ steps.login-ecr.outputs.registry }}
          SHORT_SHA=$(echo ${{ github.sha }} | cut -c1-8)
          IMAGE_TAG="${REGISTRY}/${{ env.ECR_REPOSITORY }}:${SHORT_SHA}"
          echo "image=${IMAGE_TAG}" >> $GITHUB_OUTPUT
          echo "short-sha=${SHORT_SHA}" >> $GITHUB_OUTPUT

      # Build Docker image
      - name: Build Docker image
        run: |
          docker build \
            --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
            --build-arg GIT_SHA=${{ github.sha }} \
            --cache-from ${{ steps.meta.outputs.image }}:latest \
            -t ${{ steps.meta.outputs.image }} \
            -t ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest \
            .

      # Push to ECR
      - name: Push Docker image to ECR
        run: |
          docker push ${{ steps.meta.outputs.image }}
          docker push ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest

      # Download current task definition
      - name: Download task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition ${{ env.TASK_DEFINITION }} \
            --query taskDefinition \
            > task-definition.json

      # Update task definition with new image
      - name: Render new ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.meta.outputs.image }}

      # Deploy to ECS (Blue/Green via CodeDeploy or rolling update)
      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
          wait-for-minutes: 10

      - name: Deployment summary
        run: |
          echo "## Deployment Successful!" >> $GITHUB_STEP_SUMMARY
          echo "- Image: ${{ steps.meta.outputs.image }}" >> $GITHUB_STEP_SUMMARY
          echo "- Commit: ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
          echo "- Deployed by: ${{ github.actor }}" >> $GITHUB_STEP_SUMMARY
```

---

### Example 2: Terraform Apply Workflow

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  push:
    branches: [main]
    paths: ['terraform/**']
  pull_request:
    branches: [main]
    paths: ['terraform/**']
  workflow_dispatch:
    inputs:
      action:
        description: 'Terraform action'
        required: true
        default: 'plan'
        type: choice
        options: [plan, apply, destroy]

permissions:
  id-token: write
  contents: read
  pull-requests: write     # Allow posting plan output as PR comment

env:
  TF_VERSION: '1.6.0'
  AWS_REGION: ap-southeast-2
  WORKING_DIR: terraform

jobs:
  terraform:
    name: Terraform ${{ github.event_name == 'push' && 'Apply' || 'Plan' }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ env.WORKING_DIR }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsTerraformRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      # Initialize Terraform (download providers, configure backend)
      - name: Terraform Init
        id: init
        run: terraform init -backend-config="bucket=my-tfstate-bucket" -backend-config="key=prod/terraform.tfstate"

      # Check formatting
      - name: Terraform Format Check
        id: fmt
        run: terraform fmt -check -recursive
        continue-on-error: true   # Don't fail, but report

      # Validate configuration
      - name: Terraform Validate
        id: validate
        run: terraform validate -no-color

      # Generate plan (always, on both PR and push)
      - name: Terraform Plan
        id: plan
        run: |
          terraform plan \
            -no-color \
            -var-file="environments/prod.tfvars" \
            -out=tfplan \
            2>&1 | tee plan-output.txt
        continue-on-error: true

      # Post plan as PR comment
      - name: Post Plan to PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('terraform/plan-output.txt', 'utf8');
            const maxLength = 65000;
            const truncated = plan.length > maxLength ? plan.substring(0, maxLength) + '\n...(truncated)' : plan;
            const output = `#### Terraform Plan 📖
            \`\`\`hcl
            ${truncated}
            \`\`\`
            *Workflow: \`${{ github.workflow }}\`, Action: \`${{ github.event_name }}\`*`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            });

      # Apply ONLY on push to main (not on PRs)
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -auto-approve tfplan

      # Destroy (manual trigger only)
      - name: Terraform Destroy
        if: github.event_name == 'workflow_dispatch' && github.event.inputs.action == 'destroy'
        run: |
          echo "DESTROYING INFRASTRUCTURE — Are you sure?"
          terraform destroy -auto-approve -var-file="environments/prod.tfvars"
```

---

### Example 3: Lambda Deployment

```yaml
# .github/workflows/lambda-deploy.yml
name: Deploy Lambda

on:
  push:
    branches: [main]
    paths:
      - 'lambda/**'
      - '.github/workflows/lambda-deploy.yml'

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ap-southeast-2
  FUNCTION_NAME: my-processor-function
  RUNTIME: python3.11

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        working-directory: lambda
        run: |
          pip install -r requirements.txt -t package/
          cp -r . package/

      - name: Create deployment package
        working-directory: lambda
        run: |
          cd package
          zip -r ../function.zip . -x "*.pyc" -x "*/__pycache__/*"

      - name: Run tests
        working-directory: lambda
        run: |
          pip install pytest
          pytest tests/ -v

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsLambdaRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy Lambda function
        run: |
          aws lambda update-function-code \
            --function-name ${{ env.FUNCTION_NAME }} \
            --zip-file fileb://lambda/function.zip \
            --publish

      - name: Wait for update completion
        run: |
          aws lambda wait function-updated \
            --function-name ${{ env.FUNCTION_NAME }}

      - name: Update function configuration
        run: |
          aws lambda update-function-configuration \
            --function-name ${{ env.FUNCTION_NAME }} \
            --environment "Variables={ENVIRONMENT=production,LOG_LEVEL=INFO}"

      - name: Publish and alias
        id: version
        run: |
          VERSION=$(aws lambda publish-version \
            --function-name ${{ env.FUNCTION_NAME }} \
            --description "Deployed from GitHub Actions - ${{ github.sha }}" \
            --query Version --output text)
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

          # Update 'live' alias to point to new version
          aws lambda update-alias \
            --function-name ${{ env.FUNCTION_NAME }} \
            --name live \
            --function-version ${{ steps.version.outputs.version }}

      - name: Run smoke test
        run: |
          RESULT=$(aws lambda invoke \
            --function-name ${{ env.FUNCTION_NAME }}:live \
            --payload '{"test": true}' \
            --query StatusCode \
            --output text \
            /tmp/response.json)
          
          if [ "$RESULT" != "200" ]; then
            echo "Smoke test failed with status: $RESULT"
            exit 1
          fi
          echo "Smoke test passed!"
```

---

## 9. Advanced Features

### Matrix Builds — Multiple Node Versions

```yaml
jobs:
  test-matrix:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: ['16', '18', '20', '21']
        include:
          - node-version: '20'
            lts: true           # Custom property for node:20
    
    name: Test on Node ${{ matrix.node-version }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - run: npm ci
      - run: npm test
      
      - name: Mark as LTS stable
        if: matrix.lts == true
        run: echo "This is an LTS version — marking as stable"
```

---

### Reusable Workflows

**Defining a reusable workflow:** `.github/workflows/reusable-deploy.yml`
```yaml
name: Reusable Deploy

on:
  workflow_call:               # Makes this reusable
    inputs:
      environment:
        type: string
        required: true
      image_tag:
        type: string
        required: true
      aws_region:
        type: string
        default: 'ap-southeast-2'
    secrets:
      role_arn:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.role_arn }}
          aws-region: ${{ inputs.aws_region }}

      - name: Deploy image ${{ inputs.image_tag }} to ${{ inputs.environment }}
        run: |
          aws ecs update-service \
            --cluster my-cluster-${{ inputs.environment }} \
            --service my-service \
            --force-new-deployment
```

**Calling the reusable workflow:**
```yaml
name: Main CI/CD

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.tag.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - id: tag
        run: echo "tag=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT
      - run: docker build -t myapp:${{ steps.tag.outputs.tag }} .

  deploy-staging:
    needs: build
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      image_tag: ${{ needs.build.outputs.image_tag }}
    secrets:
      role_arn: ${{ secrets.STAGING_ROLE_ARN }}

  deploy-production:
    needs: deploy-staging
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
      image_tag: ${{ needs.build.outputs.image_tag }}
    secrets:
      role_arn: ${{ secrets.PROD_ROLE_ARN }}
```

---

### Environments with Protection Rules

**In GitHub UI:** Settings > Environments > New environment

Configuration options:
- **Required reviewers:** 1-6 people must approve before the job runs
- **Wait timer:** Delay deployment by N minutes
- **Deployment branches:** Only allow deployments from specific branches (e.g., `main` only)
- **Environment secrets:** Secrets only available when deploying to this environment

```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment:
      name: production          # Maps to GitHub Environment named "production"
      url: https://myapp.com    # Shown as link in deployment UI
    # GitHub will PAUSE this job until required reviewers approve
    steps:
      - run: ./deploy-production.sh
```

---

### Composite Actions

Create a reusable action in `.github/actions/setup-aws/action.yml`:

```yaml
# .github/actions/setup-aws/action.yml
name: 'Setup AWS with OIDC'
description: 'Configure AWS credentials using OIDC'

inputs:
  role-arn:
    description: 'IAM Role ARN to assume'
    required: true
  region:
    description: 'AWS Region'
    required: false
    default: 'ap-southeast-2'
  duration:
    description: 'Session duration in seconds'
    required: false
    default: '3600'

outputs:
  account-id:
    description: 'AWS Account ID'
    value: ${{ steps.get-account.outputs.account-id }}

runs:
  using: 'composite'
  steps:
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ inputs.role-arn }}
        aws-region: ${{ inputs.region }}
        role-duration-seconds: ${{ inputs.duration }}

    - name: Get account ID
      id: get-account
      shell: bash
      run: echo "account-id=$(aws sts get-caller-identity --query Account --output text)" >> $GITHUB_OUTPUT
```

**Using the composite action:**
```yaml
steps:
  - uses: ./.github/actions/setup-aws
    with:
      role-arn: arn:aws:iam::123456789012:role/MyRole

  # Action from another repo
  - uses: MyOrg/shared-actions/setup-aws@v1
    with:
      role-arn: arn:aws:iam::123456789012:role/MyRole
```

---

### Caching with `actions/cache`

```yaml
steps:
  # Cache node_modules based on package-lock.json hash
  - name: Cache Node.js modules
    uses: actions/cache@v4
    id: npm-cache
    with:
      path: ~/.npm
      key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
      restore-keys: |
        ${{ runner.os }}-node-

  - name: Install dependencies
    # Skip if exact cache hit
    if: steps.npm-cache.outputs.cache-hit != 'true'
    run: npm ci

  # Cache pip packages
  - name: Cache Python packages
    uses: actions/cache@v4
    with:
      path: ~/.cache/pip
      key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
      restore-keys: ${{ runner.os }}-pip-

  # Cache Docker layers
  - name: Cache Docker layers
    uses: actions/cache@v4
    with:
      path: /tmp/.buildx-cache
      key: ${{ runner.os }}-buildx-${{ github.sha }}
      restore-keys: ${{ runner.os }}-buildx-

  - name: Build with cache
    uses: docker/build-push-action@v5
    with:
      cache-from: type=local,src=/tmp/.buildx-cache
      cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max
```

---

## 10. GitHub Actions vs CodePipeline

| Feature | GitHub Actions | AWS CodePipeline |
|---------|---------------|-----------------|
| **Source** | GitHub native | GitHub, CodeCommit, S3, ECR |
| **Config** | YAML in repo (`.github/workflows/`) | AWS Console, CloudFormation, CDK |
| **Build** | Any command, community actions | CodeBuild (separate service) |
| **Runner location** | GitHub-managed cloud or self-hosted | CodeBuild (managed) |
| **AWS auth** | OIDC (no creds) or access keys | IAM Role attached natively |
| **Cost** | 2,000 free min/mo; ~$0.008/min | $1/active pipeline/month + CodeBuild |
| **Ecosystem** | 20,000+ Marketplace actions | AWS-specific integrations |
| **PR integration** | Native PR checks, comments | Requires separate setup |
| **Environments** | GitHub Environments with approvals | Manual approval stages |
| **Multi-cloud** | Easy (just add steps) | Primarily AWS-focused |
| **Visibility** | GitHub UI | AWS Console |
| **Self-hosted** | Self-hosted runners | CodeBuild in VPC |
| **OIDC** | Native built-in | N/A (already AWS-native) |

**When to use GitHub Actions:**
- Your code is on GitHub
- You want the workflow in the same repo as the code
- You need community actions (Terraform, Docker, etc.)
- Multi-cloud deployments
- Developer-friendly experience

**When to use CodePipeline:**
- Fully AWS-native environment (CodeCommit + CodeBuild + CodeDeploy)
- Strict regulatory requirements (everything in AWS account)
- Complex manual approval gates with AWS-native notifications
- Existing investment in AWS CI/CD tooling

---

## 11. Setting Up OIDC — Step by Step

### Full Terraform Setup

```hcl
# iam.tf — Complete OIDC setup for GitHub Actions

# 1. Create the OIDC Identity Provider
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # Thumbprint for GitHub's OIDC endpoint (periodically updated by GitHub)
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"
  ]

  tags = {
    Name = "GitHub Actions OIDC Provider"
  }
}

# 2. Create IAM Role
resource "aws_iam_role" "github_actions_ecr_ecs" {
  name = "GitHubActionsECSDeployRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Allow any branch/tag in the repo
            "token.actions.githubusercontent.com:sub" = "repo:MyOrg/my-repo:*"
          }
        }
      }
    ]
  })
}

# 3. Create permissions policy
resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "GitHubActionsDeployPolicy"
  role = aws_iam_role.github_actions_ecr_ecs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "arn:aws:ecr:ap-southeast-2:123456789012:repository/my-app"
      },
      # ECS
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:ListTaskDefinitions"
        ]
        Resource = "*"
      },
      # IAM passrole for ECS task execution role
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"
      }
    ]
  })
}

# 4. Output the role ARN to add as GitHub secret
output "github_actions_role_arn" {
  value = aws_iam_role.github_actions_ecr_ecs.arn
}
```

---

## 12. Interview Q&A

**Q1: What is OIDC and why is it preferred over access keys for GitHub Actions?**

A: OIDC (OpenID Connect) is a federated identity protocol that allows GitHub Actions to assume an AWS IAM role without storing any long-lived credentials. When a workflow runs, GitHub issues a signed JWT token. AWS STS verifies the token against GitHub's JWKS endpoint and returns temporary credentials valid for up to 1 hour. Access keys are static credentials that can be leaked through logs, git history, or security breaches. OIDC credentials are short-lived, auto-expiring, and require no rotation. You can also add granular conditions to the trust policy (restrict to specific repo, branch, or environment).

---

**Q2: How do you prevent a PR from a forked repository from accessing your secrets?**

A: GitHub Actions does NOT expose secrets to workflows triggered by pull requests from forks by default. The `pull_request` trigger disables secret access for fork PRs. Use `pull_request_target` if you need secrets but understand the security risk — it runs in the context of the base repo with secret access. For fork contributions, use required approvals before running CI.

---

**Q3: What is the difference between `push` and `pull_request` triggers?**

A: `push` triggers when commits are pushed directly to a branch. `pull_request` triggers when a PR is opened, updated, or specific PR events occur — it runs against the merge commit. For CI, `pull_request` is preferred as it tests what the merged code would look like. For deployment, `push` to `main` is used after the PR is merged.

---

**Q4: How do you pass data between jobs in GitHub Actions?**

A: Using job outputs. A step writes to `$GITHUB_OUTPUT`, the job declares `outputs:` mapping to step outputs, and subsequent jobs access via `needs.<job-id>.outputs.<name>`. Example:
```yaml
jobs:
  build:
    outputs:
      image_tag: ${{ steps.tag.outputs.tag }}
    steps:
      - id: tag
        run: echo "tag=abc123" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.image_tag }}"
```

---

**Q5: How does matrix strategy work and when would you use it?**

A: Matrix strategy creates multiple job runs from a single job definition using different variable combinations. Useful for: testing across multiple Node/Python/Go versions, testing on multiple OS (Linux, Windows, macOS), deploying to multiple environments simultaneously. `fail-fast: false` prevents cancelling other matrix jobs when one fails, which is useful for compatibility testing where you want to see all results.

---

**Q6: What are reusable workflows and when would you use them?**

A: Reusable workflows use the `workflow_call` trigger and can be called from other workflows like a function call. They accept inputs and secrets as parameters. Use them to: standardize deployment steps across multiple services, avoid copy-pasting workflow YAML, enforce organizational security policies (e.g., every deployment must use OIDC). They live in the same or a different repo and are referenced as `uses: org/repo/.github/workflows/deploy.yml@main`.

---

**Q7: How do you implement a manual approval gate in GitHub Actions?**

A: Using GitHub Environments with required reviewers. Create an Environment in repository settings, add required reviewers (up to 6). When a job references `environment: production`, GitHub pauses execution until an approved reviewer approves. This is different from CodePipeline's manual approval action but achieves the same effect.

---

**Q8: What is the `GITHUB_TOKEN` and what can it do?**

A: `GITHUB_TOKEN` is an automatically generated token scoped to the current repository. GitHub creates it for each workflow run and revokes it when the run ends. Default permissions can be configured at repository or workflow level. Common permissions: `contents: write` (push commits, create releases), `pull-requests: write` (post comments, approve PRs), `packages: write` (publish to GitHub Packages). It cannot access other repositories or organization-level resources.

---

**Q9: How do you cache dependencies to speed up workflows?**

A: Using `actions/cache@v4`. Provide a `path` (what to cache), a `key` (unique identifier — typically includes a hash of the lockfile), and `restore-keys` (fallback patterns). On cache hit, the path is restored before subsequent steps. The cache key should include the OS, runtime, and hash of the dependency file (e.g., `${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}`). Note: `actions/setup-node`, `setup-python`, etc. have built-in caching via the `cache` input parameter.

---

**Q10: What's the difference between a composite action and a reusable workflow?**

A: A composite action groups multiple steps into a single reusable `uses:` call within a job. A reusable workflow is an entire workflow callable as a job. Key differences: composite actions share the same job/runner environment, have access to the calling workflow's context; reusable workflows run in a separate job (can have different runner, environment, permissions). Use composite actions for step-level reuse, reusable workflows for full pipeline templates.

---

**Q11: How do you handle secrets for multiple environments (staging vs production)?**

A: Three approaches: (1) Repository-level secrets with different names (`PROD_ROLE_ARN` vs `STAGING_ROLE_ARN`) and use `if` conditions or matrix to select. (2) GitHub Environments — each environment has its own secrets, set `environment: production` in the job to access prod secrets. Best practice for isolation and protection rules. (3) OIDC with different IAM roles per environment — the trust policy conditions differ by environment claim (`repo:org/repo:environment:production`).

---

**Q12: How do you debug a failing GitHub Actions workflow?**

A: Multiple approaches: (1) Enable debug logging by setting secret `ACTIONS_RUNNER_DEBUG=true` and `ACTIONS_STEP_DEBUG=true`. (2) Add `continue-on-error: true` to isolate failing steps. (3) Use `tee` to capture and display output simultaneously. (4) Add debugging steps with `env` dumps: `run: env | sort`. (5) SSH into a runner using `mxschmitt/action-tmate@v3` (pauses workflow, provides SSH access). (6) Re-run failed jobs with debug logging from the GitHub UI. (7) Test workflow changes with `act` tool locally.
