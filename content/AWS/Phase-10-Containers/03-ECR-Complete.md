# Amazon ECR (Elastic Container Registry) - Complete Guide

## Table of Contents
1. [What is ECR and Why Use It](#what-is-ecr)
2. [Private vs Public Registry](#private-vs-public)
3. [Repository Naming and URIs](#repository-naming)
4. [Authentication](#authentication)
5. [Docker Commands with ECR](#docker-commands)
6. [Repository Policies](#repository-policies)
7. [Image Tag Mutability](#image-tag-mutability)
8. [Image Scanning](#image-scanning)
9. [Lifecycle Policies](#lifecycle-policies)
10. [Pull Through Cache](#pull-through-cache)
11. [Cross-Region and Cross-Account Replication](#replication)
12. [ECR Integrations](#ecr-integrations)
13. [Interview Q&A](#interview-qa)

---

## 1. What is ECR and Why Use It

Amazon Elastic Container Registry (ECR) is a fully managed container image registry service provided by AWS. It enables you to store, manage, and deploy Docker container images and OCI (Open Container Initiative) artifacts securely.

### Core Value Proposition

ECR is AWS-native, meaning it integrates deeply with the rest of the AWS ecosystem. When your workloads run on ECS, EKS, or Lambda, using ECR eliminates authentication overhead, reduces latency, and tightens the security boundary.

### ECR vs Docker Hub

| Feature | Amazon ECR | Docker Hub |
|---|---|---|
| Authentication | IAM-integrated, no separate credentials | Separate Docker Hub account required |
| Network | Within AWS, no egress charges pulling from same region | Internet egress charges from AWS to Docker Hub |
| Private repos | Unlimited private repos (pay per GB) | Limited on free tier |
| Security scanning | Built-in (Basic + Enhanced via Inspector) | Paid tiers only |
| Availability SLA | AWS regional SLA | Separate SLA, rate limiting on free tier |
| Cross-account access | IAM resource policies | Requires org-level accounts |
| Compliance | AWS compliance certifications (SOC, PCI, HIPAA) | Separate certification set |
| Integration | Native: ECS, EKS, CodeBuild, Lambda, CodePipeline | Manual credential management |
| Pull rate limits | None within AWS | Docker Hub rate limits (100-200 pulls/6h on free) |
| Geo-replication | Cross-region replication built-in | Mirrors require paid plan |

### When Docker Hub Makes Sense
- Open source public images where discoverability matters
- Non-AWS environments
- Teams not using AWS services at all

### When ECR is the Right Choice
- Any AWS-hosted workload (ECS, EKS, Lambda, Batch)
- Enterprise compliance requirements
- Teams wanting unified IAM-based access control
- Avoiding Docker Hub pull rate limits in CI/CD pipelines

---

## 2. Private vs Public Registry

### Private Registry (Default ECR)

Every AWS account gets exactly one private ECR registry per region. The registry is private by default — no public access unless you explicitly configure it.

- Registry endpoint: `<account-id>.dkr.ecr.<region>.amazonaws.com`
- Access controlled by: IAM policies + repository resource policies
- Costs: $0.10/GB-month storage, $0.09/GB data transfer out (first 10TB)
- Free tier: 500 MB-month for 12 months

### Public Registry (ECR Public / gallery.ecr.aws)

AWS launched ECR Public in 2020 as a competitor to Docker Hub for hosting public images.

- Registry endpoint: `public.ecr.aws`
- Gallery URL: `gallery.ecr.aws/<alias>/<repository>:<tag>`
- Free to push from AWS; free to pull anywhere in the world
- No authentication required to pull (anyone can pull public images)
- Authentication required to push
- Alias: your account gets a random alias like `public.ecr.aws/a1b2c3d4`

**Creating a public repository:**
```bash
aws ecr-public create-repository \
    --repository-name my-public-app \
    --region us-east-1  # ECR Public is only in us-east-1
```

**Authenticating to push to ECR Public:**
```bash
aws ecr-public get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin public.ecr.aws
```

**Pushing to ECR Public:**
```bash
docker tag myapp:latest public.ecr.aws/a1b2c3d4/myapp:latest
docker push public.ecr.aws/a1b2c3d4/myapp:latest
```

### Key Difference Summary

| Aspect | Private ECR | ECR Public |
|---|---|---|
| Access | IAM + resource policy | Anyone can pull |
| Region | Any AWS region | Only us-east-1 |
| Pull auth | Required | Not required |
| Push auth | IAM required | IAM required |
| Use case | Internal company images | Open source / public tools |
| Cost | Storage + transfer | Free for public pulls |

---

## 3. Repository Naming and URIs

### URI Structure

```
<account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:<tag>
```

**Real example:**
```
123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/mycompany/backend-api:v2.1.0
```

Breaking this down:
- `123456789012` — your 12-digit AWS account ID
- `dkr.ecr` — constant; identifies this as the Docker-compatible ECR endpoint
- `ap-southeast-2` — AWS region where the repository lives
- `amazonaws.com` — constant AWS domain
- `mycompany/backend-api` — repository name (can include `/` for namespacing)
- `v2.1.0` — image tag

### Repository Naming Conventions

Repository names can contain:
- Lowercase letters, numbers, hyphens, underscores, forward slashes
- Must start with a letter or number
- Maximum 256 characters

**Recommended naming patterns:**
```
# Environment-based
dev/myapp
staging/myapp
prod/myapp

# Team-based namespacing
team-payments/checkout-service
team-auth/user-service

# Project-based
projectx/frontend
projectx/backend
projectx/worker
```

**Avoid:**
- Uppercase letters (Docker may allow them but ECR best practice is lowercase)
- Starting with a slash
- Special characters other than `-`, `_`, `/`

### Tags

Tags are mutable references to a specific image digest by default (but can be made immutable — see section 7).

**Recommended tagging strategies:**

```bash
# Git commit SHA (most reliable for traceability)
123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:abc1234

# Semantic versioning
123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:v2.1.0

# Combined: version + build number
123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:v2.1.0-build.45

# Environment + version
123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:prod-v2.1.0

# Always also tag latest (but don't rely on it alone)
123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:latest
```

**Avoid using `latest` as the only tag** — it makes rollbacks and audit trails difficult.

### Image Digest

Every image has an immutable digest (SHA256 hash of the manifest). Even if tags change, the digest is permanent.

```bash
# Pull by digest (always gets exact image regardless of tag changes)
docker pull 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp@sha256:a1b2c3d4...
```

---

## 4. Authentication

ECR uses temporary tokens (valid 12 hours) rather than permanent passwords. This is a security best practice.

### The Core Authentication Command

```bash
aws ecr get-login-password --region <region> | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
```

**What this does, step by step:**
1. `aws ecr get-login-password` — calls ECR API using your IAM credentials, returns a temporary bearer token (12-hour TTL)
2. `|` — pipes that token to docker login
3. `docker login --username AWS` — username is always literally "AWS" for ECR
4. `--password-stdin` — reads password from stdin (avoids password in shell history)
5. The registry endpoint is passed as the final argument

**Full example:**
```bash
aws ecr get-login-password --region ap-southeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-southeast-2.amazonaws.com
```

Output on success: `Login Succeeded`

### IAM Permissions Required

The IAM principal (user, role, or instance profile) needs these permissions to authenticate and push:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:GetRepositoryPolicy",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:DescribeImages",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "arn:aws:ecr:ap-southeast-2:123456789012:repository/myapp"
    }
  ]
}
```

Note: `ecr:GetAuthorizationToken` is an account-level action, not repository-level, so it requires `"Resource": "*"`.

### Authentication in CI/CD (GitHub Actions example)

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsECRRole
    aws-region: ap-southeast-2

- name: Login to Amazon ECR
  id: login-ecr
  uses: aws-actions/amazon-ecr-login@v2

- name: Build, tag, and push image to ECR
  env:
    ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
    IMAGE_TAG: ${{ github.sha }}
  run: |
    docker build -t $ECR_REGISTRY/myapp:$IMAGE_TAG .
    docker push $ECR_REGISTRY/myapp:$IMAGE_TAG
```

### Authentication Token Lifetime

The token from `get-login-password` is valid for **12 hours**. In long-running pipelines, you may need to re-authenticate. Configure your CI/CD to re-authenticate at the start of each pipeline run.

---

## 5. Docker Commands with ECR

### Complete Workflow: Build, Tag, Push, Pull

#### Step 1: Authenticate
```bash
aws ecr get-login-password --region ap-southeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-southeast-2.amazonaws.com
```

#### Step 2: Create Repository (if it doesn't exist)
```bash
aws ecr create-repository \
    --repository-name mycompany/backend-api \
    --region ap-southeast-2 \
    --image-tag-mutability IMMUTABLE \
    --image-scanning-configuration scanOnPush=true
```

#### Step 3: Build the Image
```bash
docker build -t myapp:latest .

# Multi-platform build (important for M1/M2 Macs deploying to x86 AWS)
docker buildx build \
  --platform linux/amd64 \
  -t myapp:latest .
```

#### Step 4: Tag for ECR
```bash
# Syntax: docker tag <source-image>:<tag> <ecr-uri>:<tag>
docker tag myapp:latest \
  123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/mycompany/backend-api:v2.1.0

# Also tag as latest
docker tag myapp:latest \
  123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/mycompany/backend-api:latest
```

#### Step 5: Push to ECR
```bash
# Push specific tag
docker push 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/mycompany/backend-api:v2.1.0

# Push all tags
docker push --all-tags \
  123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/mycompany/backend-api
```

#### Step 6: Pull from ECR
```bash
# Pull by tag
docker pull 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/mycompany/backend-api:v2.1.0

# Pull by digest (immutable reference)
docker pull 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/mycompany/backend-api@sha256:abc123...

# Pull latest
docker pull 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/mycompany/backend-api:latest
```

### Listing and Inspecting Images

```bash
# List repositories
aws ecr describe-repositories --region ap-southeast-2

# List images in a repository
aws ecr list-images \
    --repository-name mycompany/backend-api \
    --region ap-southeast-2

# Describe images (with push date, size, digest)
aws ecr describe-images \
    --repository-name mycompany/backend-api \
    --region ap-southeast-2

# Get image details including tags
aws ecr describe-images \
    --repository-name mycompany/backend-api \
    --image-ids imageTag=v2.1.0 \
    --region ap-southeast-2
```

### Deleting Images

```bash
# Delete by tag
aws ecr batch-delete-image \
    --repository-name mycompany/backend-api \
    --image-ids imageTag=old-v1.0.0 \
    --region ap-southeast-2

# Delete by digest
aws ecr batch-delete-image \
    --repository-name mycompany/backend-api \
    --image-ids imageDigest=sha256:abc123... \
    --region ap-southeast-2

# Delete multiple images
aws ecr batch-delete-image \
    --repository-name mycompany/backend-api \
    --image-ids imageTag=v1.0.0 imageTag=v1.0.1 imageTag=v1.0.2
```

---

## 6. Repository Policies

Repository policies are resource-based policies attached to the repository itself. They control who can access the repository, including cross-account access.

### Default Behavior (No Repository Policy)

Without a repository policy, access is governed entirely by IAM identity policies. The repository owner account has full control.

### Repository Policy for Cross-Account Access

**Scenario:** Account 111111111111 (production) wants to pull images from Account 222222222222 (shared services ECR).

**Step 1: Add repository policy in Account 222222222222 (the ECR owner):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountPull",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:root"
      },
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability"
      ]
    }
  ]
}
```

**Apply the policy:**
```bash
aws ecr set-repository-policy \
    --repository-name mycompany/backend-api \
    --policy-text file://repo-policy.json \
    --region ap-southeast-2
```

**Step 2: In Account 111111111111, the IAM role/user also needs:**
```json
{
  "Effect": "Allow",
  "Action": "ecr:GetAuthorizationToken",
  "Resource": "*"
}
```

Note: `GetAuthorizationToken` cannot be scoped to specific repositories — it is always `"Resource": "*"`.

### Repository Policy for ECS Task Role

Allow an ECS task execution role to pull from ECR:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowECSPull",
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability"
      ],
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "123456789012"
        }
      }
    }
  ]
}
```

### Restricting Pushes to Specific Roles

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPushFromCI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/GitHubActionsDeployRole"
      },
      "Action": [
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ]
    },
    {
      "Sid": "DenyAllOtherPushes",
      "Effect": "Deny",
      "NotPrincipal": {
        "AWS": [
          "arn:aws:iam::123456789012:role/GitHubActionsDeployRole",
          "arn:aws:iam::123456789012:root"
        ]
      },
      "Action": [
        "ecr:PutImage"
      ]
    }
  ]
}
```

---

## 7. Image Tag Mutability

### What is Tag Mutability?

Tag mutability controls whether an existing image tag can be overwritten by pushing a new image with the same tag.

### MUTABLE (Default)

- You can push a new image with tag `v1.0.0` and it will overwrite the previous image with that tag
- The `latest` tag is always mutable conceptually
- Risk: accidental or malicious overwrite of a tag that's in production

### IMMUTABLE (Best Practice)

- Once a tag is pushed, it cannot be overwritten
- If you try to push to an existing tag, ECR returns an error: `ImageAlreadyExistsException`
- Forces you to always use unique tags (commit SHA, build number, semantic version)
- Provides auditability: you always know exactly what code is running

**Setting immutability when creating a repository:**
```bash
aws ecr create-repository \
    --repository-name myapp \
    --image-tag-mutability IMMUTABLE \
    --region ap-southeast-2
```

**Updating an existing repository:**
```bash
aws ecr put-image-tag-mutability \
    --repository-name myapp \
    --image-tag-mutability IMMUTABLE \
    --region ap-southeast-2
```

### Why IMMUTABLE is Best Practice

1. **Reproducibility:** The same tag always refers to the same image. Rollbacks are reliable.
2. **Security:** A compromised CI pipeline cannot silently overwrite a production image tag.
3. **Audit trail:** Combined with git SHAs as tags, you have full traceability from deployment to source code commit.
4. **Consistency:** All environments (dev, staging, prod) can be guaranteed to use the exact same image.

### Handling IMMUTABLE in CI/CD

Since you can't overwrite tags with IMMUTABLE, your tagging strategy must produce unique tags:

```bash
# Use git SHA
IMAGE_TAG=$(git rev-parse --short HEAD)

# Or combine version + build number
IMAGE_TAG="v${VERSION}-build.${BUILD_NUMBER}"

# Or use timestamp (less preferred)
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
```

---

## 8. Image Scanning

ECR provides two levels of vulnerability scanning for container images.

### Basic Scanning (Free)

- Uses the open-source Clair vulnerability scanner
- Scans OS-level packages (not application dependencies)
- Can be configured to scan on push or manually triggered
- Results available within minutes
- Finds Common Vulnerabilities and Exposures (CVEs) in OS packages

**Enable scan on push:**
```bash
aws ecr put-image-scanning-configuration \
    --repository-name myapp \
    --image-scanning-configuration scanOnPush=true \
    --region ap-southeast-2
```

**Manually trigger a scan:**
```bash
aws ecr start-image-scan \
    --repository-name myapp \
    --image-id imageTag=v2.1.0 \
    --region ap-southeast-2
```

**View scan results:**
```bash
aws ecr describe-image-scan-findings \
    --repository-name myapp \
    --image-id imageTag=v2.1.0 \
    --region ap-southeast-2
```

**Sample output structure:**
```json
{
  "imageScanFindings": {
    "findings": [
      {
        "name": "CVE-2021-44228",
        "description": "Apache Log4j2 2.0 to 2.14.1...",
        "uri": "https://nvd.nist.gov/vuln/detail/CVE-2021-44228",
        "severity": "CRITICAL",
        "attributes": [
          {
            "key": "package_version",
            "value": "2.14.0"
          },
          {
            "key": "package_name",
            "value": "log4j"
          }
        ]
      }
    ],
    "findingSeverityCounts": {
      "CRITICAL": 1,
      "HIGH": 3,
      "MEDIUM": 7,
      "LOW": 12,
      "INFORMATIONAL": 5,
      "UNDEFINED": 0
    }
  }
}
```

### Enhanced Scanning (Amazon Inspector — Paid)

- Powered by Amazon Inspector v2
- Scans both OS packages AND application dependencies (Python pip, Node npm, Java Maven, etc.)
- Continuous scanning: re-scans images when new CVEs are published (not just on push)
- Deeper integration with AWS Security Hub
- More comprehensive CVE database
- Higher cost

**Enable Enhanced Scanning:**
```bash
aws ecr put-registry-scanning-configuration \
    --scan-type ENHANCED \
    --rules '[{"repositoryFilters":[{"filter":"*","filterType":"WILDCARD"}],"scanFrequency":"SCAN_ON_PUSH"}]' \
    --region ap-southeast-2
```

**Filter by severity in CI/CD (fail build on CRITICAL findings):**
```bash
CRITICAL_COUNT=$(aws ecr describe-image-scan-findings \
  --repository-name myapp \
  --image-id imageTag=$IMAGE_TAG \
  --query 'imageScanFindings.findingSeverityCounts.CRITICAL' \
  --output text)

if [ "$CRITICAL_COUNT" -gt "0" ]; then
  echo "Found $CRITICAL_COUNT CRITICAL vulnerabilities. Failing build."
  exit 1
fi
```

### Scan Results Severity Levels

| Severity | Description |
|---|---|
| CRITICAL | Severe vulnerabilities requiring immediate action |
| HIGH | Significant risk, prioritize patching |
| MEDIUM | Moderate risk, plan for remediation |
| LOW | Minor risk, patch when convenient |
| INFORMATIONAL | No risk, informational findings |
| UNDEFINED | Severity not determined |

---

## 9. Lifecycle Policies

Lifecycle policies automatically clean up old images based on rules you define. Without them, your registry fills up with obsolete images incurring storage costs.

### Why Lifecycle Policies Matter

- Container registries grow quickly — a daily deployment creates 365 image versions per year
- Untagged images (created by overwriting a mutable tag) are pure waste
- Storage costs add up: `$0.10/GB × many GB = significant monthly bill`

### Lifecycle Policy Structure

A lifecycle policy is a JSON document with one or more rules. Rules are evaluated in order of priority (lower number = higher priority).

**Key fields:**
- `rulePriority`: Order of evaluation (1 = highest priority)
- `description`: Human-readable description
- `selection.tagStatus`: `tagged`, `untagged`, or `any`
- `selection.tagPrefixList`: Match tags with specific prefixes
- `selection.countType`: `imageCountMoreThan` or `sinceImagePushed`
- `selection.countNumber`: The threshold number
- `selection.countUnit`: `days` (for `sinceImagePushed`)
- `action.type`: Always `expire`

### Example 1: Delete Untagged Images Older Than 1 Day

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Remove untagged images after 1 day",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 1
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

### Example 2: Keep Last N Tagged Images

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep only last 10 production images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["prod-"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

### Example 3: Comprehensive Policy (Production-Ready)

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Expire untagged images after 1 day",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 1
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Keep only last 5 dev images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["dev-"],
        "countType": "imageCountMoreThan",
        "countNumber": 5
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 3,
      "description": "Keep only last 10 staging images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["staging-"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 4,
      "description": "Keep prod images for 90 days",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["prod-"],
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 90
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 5,
      "description": "Keep last 30 images regardless of tag",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 30
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

### Applying a Lifecycle Policy

```bash
# Apply policy from file
aws ecr put-lifecycle-policy \
    --repository-name myapp \
    --lifecycle-policy-text file://lifecycle-policy.json \
    --region ap-southeast-2

# Preview what the policy would delete (dry run)
aws ecr get-lifecycle-policy-preview \
    --repository-name myapp \
    --region ap-southeast-2
```

### Testing Before Applying

Always use the lifecycle policy preview before applying to production:

```bash
# Start a preview
aws ecr start-lifecycle-policy-preview \
    --repository-name myapp \
    --lifecycle-policy-text file://lifecycle-policy.json

# Get the preview results (shows what would be deleted)
aws ecr get-lifecycle-policy-preview \
    --repository-name myapp
```

---

## 10. Pull Through Cache Repositories

Pull Through Cache allows ECR to act as a caching proxy for upstream public registries. Instead of pulling from Docker Hub or public.ecr.aws directly (and hitting rate limits), you pull through your ECR registry, which caches the image.

### Supported Upstream Registries

- Docker Hub (`registry-1.docker.io`)
- ECR Public (`public.ecr.aws`)
- Kubernetes container registry (`registry.k8s.io`)
- Quay (`quay.io`)
- GitHub Container Registry (`ghcr.io`)

### Creating a Pull Through Cache Rule

```bash
aws ecr create-pull-through-cache-rule \
    --ecr-repository-prefix "docker-hub" \
    --upstream-registry-url "registry-1.docker.io" \
    --region ap-southeast-2
```

### How It Works

1. Developer requests: `123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/docker-hub/library/nginx:latest`
2. ECR checks if the image is cached
3. If not cached: ECR pulls from Docker Hub, caches it, returns to developer
4. If cached: ECR returns cached image immediately
5. Cache is refreshed when the upstream image is updated

### Benefit

- Avoids Docker Hub rate limits (100 pulls/6h for unauthenticated, 200/6h for free accounts)
- Faster pulls (ECR is in your region, Docker Hub is across the internet)
- Works with VPC endpoints for fully private pulls

---

## 11. Cross-Region and Cross-Account Replication

### Why Replicate?

- Multi-region deployments need images in each region
- Disaster recovery: have images in a backup region
- Compliance: some regulations require data copies in specific regions
- Performance: reduce latency by keeping images close to workloads

### Cross-Region Replication

```bash
aws ecr put-replication-configuration \
    --replication-configuration '{
        "rules": [
            {
                "destinations": [
                    {
                        "region": "us-east-1",
                        "registryId": "123456789012"
                    },
                    {
                        "region": "eu-west-1",
                        "registryId": "123456789012"
                    }
                ],
                "repositoryFilters": [
                    {
                        "filter": "prod-",
                        "filterType": "PREFIX_MATCH"
                    }
                ]
            }
        ]
    }' \
    --region ap-southeast-2
```

### Cross-Account Replication

**Step 1: Configure replication in source account (account A):**
```bash
aws ecr put-replication-configuration \
    --replication-configuration '{
        "rules": [
            {
                "destinations": [
                    {
                        "region": "ap-southeast-2",
                        "registryId": "999999999999"
                    }
                ]
            }
        ]
    }' \
    --region ap-southeast-2
```

**Step 2: In the destination account (account 999999999999), add a registry policy allowing replication:**
```bash
aws ecr put-registry-policy \
    --policy-text '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllowReplicationFromSourceAccount",
                "Effect": "Allow",
                "Principal": {
                    "AWS": "arn:aws:iam::123456789012:root"
                },
                "Action": [
                    "ecr:CreateRepository",
                    "ecr:ReplicateImage"
                ],
                "Resource": "arn:aws:ecr:ap-southeast-2:999999999999:repository/*"
            }
        ]
    }' \
    --region ap-southeast-2
```

### Replication Timing

Replication is asynchronous and typically completes within a few minutes. It is not guaranteed to be instant — do not rely on it for real-time deployments across regions without validation.

---

## 12. ECR Integrations

### ECR with ECS

ECS integrates natively with ECR. The ECS task execution role needs ECR pull permissions.

```json
// Attach this managed policy to the ECS task execution role
"arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
```

In a task definition, reference ECR images:
```json
{
  "containerDefinitions": [
    {
      "name": "myapp",
      "image": "123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:v2.1.0",
      "cpu": 256,
      "memory": 512
    }
  ]
}
```

ECS automatically authenticates to ECR using the task execution role — no manual `docker login` needed.

### ECR with EKS

EKS worker nodes use the node IAM role to authenticate. Attach the ECR read policy:

```bash
aws iam attach-role-policy \
    --role-name EKSNodeGroupRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
```

In Kubernetes manifests:
```yaml
spec:
  containers:
    - name: myapp
      image: 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:v2.1.0
```

For cross-account ECR from EKS, configure an `imagePullSecret` or use IRSA with the appropriate ECR permissions.

### ECR with CodeBuild

CodeBuild projects use the CodeBuild service role. Attach ECR policies to it:

```bash
aws iam attach-role-policy \
    --role-name CodeBuildServiceRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
```

In the buildspec.yml:
```yaml
version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | 
          docker login --username AWS --password-stdin $ECR_REGISTRY
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}
  build:
    commands:
      - docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
  post_build:
    commands:
      - docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      - printf '[{"name":"myapp","imageUri":"%s"}]' 
          $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG > imagedefinitions.json
artifacts:
  files: imagedefinitions.json
```

### ECR with Lambda

Lambda can use container images from ECR (up to 10GB image size vs 250MB for zip).

Requirements:
- Image must be in the same region as the Lambda function
- Image must implement the Lambda Runtime API or use an AWS base image

```bash
# Create Lambda from ECR image
aws lambda create-function \
    --function-name my-container-lambda \
    --package-type Image \
    --code ImageUri=123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/my-lambda:latest \
    --role arn:aws:iam::123456789012:role/LambdaExecutionRole
```

The Lambda execution role automatically gets permission to pull from ECR (Lambda service adds this).

### ECR with VPC Endpoints

For fully private ECR access (no internet required):

```bash
# Create ECR API endpoint
aws ec2 create-vpc-endpoint \
    --vpc-id vpc-12345678 \
    --service-name com.amazonaws.ap-southeast-2.ecr.api \
    --vpc-endpoint-type Interface \
    --subnet-ids subnet-12345678 \
    --security-group-ids sg-12345678

# Create ECR DKR endpoint (for docker push/pull)
aws ec2 create-vpc-endpoint \
    --vpc-id vpc-12345678 \
    --service-name com.amazonaws.ap-southeast-2.ecr.dkr \
    --vpc-endpoint-type Interface \
    --subnet-ids subnet-12345678 \
    --security-group-ids sg-12345678

# Also need S3 gateway endpoint (ECR stores layers in S3)
aws ec2 create-vpc-endpoint \
    --vpc-id vpc-12345678 \
    --service-name com.amazonaws.ap-southeast-2.s3 \
    --vpc-endpoint-type Gateway \
    --route-table-ids rtb-12345678
```

---

## 13. Interview Q&A

**Q1: What is Amazon ECR and what are its advantages over Docker Hub?**

A: Amazon ECR is AWS's fully managed container registry. Key advantages over Docker Hub include native IAM integration (no separate credentials needed), no pull rate limits for images stored in the same region as your workloads, built-in vulnerability scanning, lifecycle policies for cost management, and deep integration with ECS, EKS, CodeBuild, and Lambda. For AWS workloads, ECR also provides lower latency and eliminates data transfer costs for intra-region pulls.

---

**Q2: How does ECR authentication work, and how long is the token valid?**

A: ECR uses temporary authentication tokens obtained via `aws ecr get-login-password`. The command calls the ECR API using your IAM credentials and returns a 12-hour Bearer token. This token is piped to `docker login` with username `AWS` and the ECR registry endpoint. The IAM principal must have the `ecr:GetAuthorizationToken` permission (which cannot be scoped to specific repositories — it requires `Resource: *`). After 12 hours, you must re-authenticate.

---

**Q3: What is the difference between MUTABLE and IMMUTABLE image tags? Which should you use in production?**

A: With MUTABLE tags (the default), an image tag can be overwritten by pushing a new image with the same tag. With IMMUTABLE tags, once a tag is pushed, any attempt to push the same tag returns an `ImageAlreadyExistsException`. IMMUTABLE is the best practice for production because it ensures reproducibility (the same tag always refers to the same image), prevents accidental or malicious overwrite, and provides a reliable audit trail when combined with git SHAs as tags.

---

**Q4: How would you configure cross-account ECR access?**

A: Cross-account ECR access requires two components. First, a repository policy on the ECR repository in the source account granting the target account the `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`, and `ecr:BatchCheckLayerAvailability` actions on the Principal of the target account's root or specific role. Second, the IAM identity in the target account must have `ecr:GetAuthorizationToken` permission (resource `*`) to obtain an auth token. The repository policy is the resource-based policy that allows cross-account access, and the IAM policy in the target account authorizes the identity to call GetAuthorizationToken.

---

**Q5: What are ECR Lifecycle Policies and why are they important?**

A: Lifecycle policies are rules that automatically expire (delete) images based on criteria like age or count. Without them, repositories accumulate old images indefinitely, increasing storage costs. Common rules include: delete untagged images after 1 day, keep only the last N images with a specific tag prefix, or expire images older than X days. Policies are evaluated in priority order (lower number = higher priority). You can preview what a policy would delete before applying it using `start-lifecycle-policy-preview`.

---

**Q6: What is the difference between Basic Scanning and Enhanced Scanning in ECR?**

A: Basic Scanning uses the open-source Clair scanner to detect CVEs in OS-level packages only. It scans on push or on demand, and results are available within minutes. Enhanced Scanning uses Amazon Inspector v2 and scans both OS packages and application-level dependencies (pip, npm, Maven). Enhanced Scanning also provides continuous scanning — it re-scans images when new CVEs are published, not just when images are pushed. Enhanced Scanning costs more but provides broader coverage.

---

**Q7: How does ECR integrate with ECS task definitions?**

A: ECS uses the task execution role to authenticate to ECR — no manual `docker login` is needed. The task execution role must have the `AmazonEC2ContainerRegistryReadOnly` managed policy (or equivalent). In the task definition, you reference the full ECR URI (`accountid.dkr.ecr.region.amazonaws.com/repo:tag`) in the `image` field of the container definition. ECS automatically handles authentication transparently.

---

**Q8: What is Pull Through Cache in ECR and when would you use it?**

A: Pull Through Cache lets ECR act as a caching proxy for upstream public registries like Docker Hub, ECR Public, Quay, and GHCR. When you pull an image through the cache rule prefix, ECR fetches it from upstream (if not cached) or serves from cache. This is valuable when you hit Docker Hub rate limits in CI/CD environments, want to reduce latency for public image pulls, or need to pull upstream images through a VPC endpoint without internet access.

---

**Q9: What VPC endpoints are required for ECR to work without internet access?**

A: Three VPC endpoints are needed: (1) Interface endpoint for `ecr.api` — for ECR API calls like describe repositories; (2) Interface endpoint for `ecr.dkr` — for docker push/pull operations; (3) Gateway endpoint for S3 — because ECR stores image layers in S3, and even private ECR operations fetch layers from S3. Without the S3 endpoint, pulls will fail even if the ECR endpoints are configured.

---

**Q10: How would you prevent any image without a critical-free scan result from being deployed?**

A: Implement a quality gate in CI/CD. After pushing an image to ECR with scan-on-push enabled, wait for the scan to complete (poll `describe-image-scan-findings` until status is `COMPLETE`), then check `findingSeverityCounts.CRITICAL`. If the count is greater than 0, fail the pipeline and prevent the image from being promoted to production. For Enhanced Scanning, you can also set up EventBridge rules to trigger Lambda functions that automatically quarantine images (by deleting or denying access) when critical findings are detected.

---

*End of ECR Complete Guide*
