# AWS Developer Tools: CodeCommit, CodeBuild, CodeDeploy, CodePipeline, CodeArtifact

## Overview: The AWS CI/CD Ecosystem

```
+----------------+     +----------------+     +------------------+     +----------------+
|  CodeCommit    |     |  CodeBuild     |     |  CodeDeploy      |     |  CodePipeline  |
|                |     |                |     |                  |     |                |
|  Source Code   | --> |  Build & Test  | --> |  Deployment      |     |  Orchestrates  |
|  Git Repos     |     |  buildspec.yml |     |  appspec.yml     |     |  all stages    |
+----------------+     +----------------+     +------------------+     +----------------+
         |                    |                       |                        |
         +--------------------+-----------------------+------------------------+
                                        |
                                 [CodeArtifact]
                                 Package Repository
                                 (npm, Maven, PyPI, NuGet)
```

---

## AWS CodeCommit

### What It Is

CodeCommit is AWS's managed Git repository service. It works exactly like GitHub or GitLab but runs entirely within your AWS account.

**Note: AWS announced in July 2024 that CodeCommit is being deprecated and will no longer accept new customers. Existing customers can continue using it but no new features will be added. For new projects, use GitHub, GitLab, or Bitbucket instead.**

### Key Features (for exam knowledge)

- Private Git repositories hosted in AWS
- IAM-based authentication (no separate username/password)
- Integrates natively with other AWS services (CodePipeline, CodeBuild)
- Encrypted at rest and in transit
- Git credentials managed via IAM or SSH keys
- Supports pull requests, branch protection, notifications via SNS/CloudWatch Events

### Authentication Methods

```
1. HTTPS with Git credentials (IAM user with generated HTTPS credentials)
   git clone https://git-codecommit.us-east-1.amazonaws.com/v1/repos/MyRepo

2. SSH with SSH keys (upload public key to IAM user)
   git clone ssh://git-codecommit.us-east-1.amazonaws.com/v1/repos/MyRepo

3. HTTPS with AWS CLI credential helper (uses temporary credentials, best for EC2/CI)
   git config --global credential.helper '!aws codecommit credential-helper $@'
```

### Exam Tips for CodeCommit

- IAM policies control who can push/pull/create branches
- Notifications via CloudWatch Events → SNS
- Cross-account access via IAM roles (not IAM users)
- Triggers: can call Lambda or SNS on push/PR events

---

## AWS CodeBuild

### What It Is

CodeBuild is a fully managed continuous integration service that compiles source code, runs tests, and produces software packages. You never manage build servers — AWS scales them automatically.

### How CodeBuild Works

```
Developer pushes code
         |
         v
CodePipeline (or direct trigger)
         |
         v
CodeBuild starts a build
         |
         v
+-------------------------------------------+
|  CodeBuild Build Environment              |
|  (Docker container, ephemeral)            |
|                                           |
|  1. Download source from CodeCommit/S3   |
|  2. Read buildspec.yml                    |
|  3. Execute phases:                       |
|     - install                             |
|     - pre_build                           |
|     - build                               |
|     - post_build                          |
|  4. Upload artifacts to S3                |
|  5. Send logs to CloudWatch               |
+-------------------------------------------+
         |
         v
Artifacts available in S3 for deployment
```

### buildspec.yml Structure

The buildspec.yml file tells CodeBuild exactly what to do. It lives in the root of your repository.

```yaml
version: 0.2

# Optional: environment variables
env:
  variables:
    # Plaintext environment variables
    NODE_ENV: "production"
    AWS_DEFAULT_REGION: "us-east-1"
  parameter-store:
    # Fetch from SSM Parameter Store (SecureString values decrypted automatically)
    DB_PASSWORD: "/myapp/prod/db-password"
    API_KEY: "/myapp/prod/api-key"
  secrets-manager:
    # Fetch from AWS Secrets Manager
    GITHUB_TOKEN: "arn:aws:secretsmanager:us-east-1:123456789:secret:github-token"

# Optional: set resource requirements
build:
  # optional - if not set uses the default
  compute-type: BUILD_GENERAL1_SMALL  # or MEDIUM, LARGE, 2XLARGE

phases:
  install:
    # Runs first - install dependencies, tools, runtimes
    runtime-versions:
      nodejs: 18
      python: 3.11
    commands:
      - echo "Installing dependencies..."
      - npm ci                           # install Node.js deps
      - pip install -r requirements.txt  # install Python deps
      - apt-get install -y jq            # install system tools

  pre_build:
    # Runs before main build - login to registries, set variables
    commands:
      - echo "Logging into Amazon ECR..."
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
      - REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/my-app
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}

  build:
    # Main build phase - compile, test, build
    on-failure: ABORT   # ABORT (default) or CONTINUE
    commands:
      - echo "Running unit tests..."
      - npm test
      - echo "Building application..."
      - npm run build
      - echo "Building Docker image..."
      - docker build -t $REPOSITORY_URI:latest .
      - docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG

  post_build:
    # Runs after build - push artifacts, create manifests
    commands:
      - echo "Pushing Docker image to ECR..."
      - docker push $REPOSITORY_URI:latest
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - echo "Writing image definitions file for ECS..."
      - printf '[{"name":"my-container","imageUri":"%s"}]' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json
      - echo "Build complete!"

# Define what files to save as build output
artifacts:
  files:
    - imagedefinitions.json      # For ECS deployment
    - appspec.yml                 # For CodeDeploy
    - '**/*'                      # All files (use carefully)
  base-directory: build          # Only include files from 'build' directory
  discard-paths: no              # yes = flatten directory structure

# Cache to speed up subsequent builds
cache:
  paths:
    - node_modules/**/*           # Cache Node.js modules
    - /root/.m2/**/*              # Cache Maven dependencies
    - /root/.gradle/caches/**/*   # Cache Gradle dependencies
```

### buildspec.yml Phases Explained

```
INSTALL
  Purpose: Set up the build environment
  Examples: Install language runtimes, install build tools (npm, pip, maven)
  Runs: Once at start
  Failure: Build fails immediately

PRE_BUILD
  Purpose: Actions needed before the main build
  Examples: Authenticate to ECR, set dynamic environment variables,
            install test frameworks, download test data
  Runs: After install
  Failure: Build fails

BUILD
  Purpose: The actual work - compile, test, package
  Examples: npm run build, mvn package, docker build, pytest
  Runs: After pre_build
  Failure: Build fails (or CONTINUE if on-failure: CONTINUE)

POST_BUILD
  Purpose: Final actions after build (always runs unless install/pre_build fail)
  Examples: Push Docker image, create deployment manifest, send notification
  Runs: After build (even if build fails, unless ABORT)
  Note: If build failed, $CODEBUILD_BUILD_SUCCEEDING = 0
```

### Environment Variables in CodeBuild

**Built-in CodeBuild variables:**

| Variable | Description |
|----------|-------------|
| AWS_DEFAULT_REGION | Region of the build |
| AWS_ACCOUNT_ID | AWS account ID |
| CODEBUILD_BUILD_ID | Unique build ID |
| CODEBUILD_BUILD_NUMBER | Sequential build number |
| CODEBUILD_RESOLVED_SOURCE_VERSION | Full git commit SHA |
| CODEBUILD_SOURCE_REPO_URL | Source repository URL |
| CODEBUILD_BUILD_SUCCEEDING | 1 if succeeding, 0 if failing |

**Custom variables (defined in buildspec.yml or CodeBuild console):**
```yaml
env:
  variables:
    MY_VAR: "hello"           # Plaintext, visible in logs
  parameter-store:
    SECRET: "/app/secret"     # From SSM Parameter Store, masked in logs
  secrets-manager:
    DB_PASS: "arn:..."        # From Secrets Manager, masked in logs
```

### Docker Builds in CodeBuild

To build Docker images in CodeBuild, you need:

1. **Privileged mode enabled** on the build environment (allows Docker daemon)
2. **IAM permissions** for the CodeBuild service role to push to ECR

```yaml
# In CodeBuild project configuration (console or CloudFormation):
# environment:
#   privilegedMode: true    <-- Required for Docker builds

phases:
  pre_build:
    commands:
      # Login to ECR
      - aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI

  build:
    commands:
      # Build the image
      - docker build -t myapp:$CODEBUILD_RESOLVED_SOURCE_VERSION .
      # Tag with ECR URI
      - docker tag myapp:$CODEBUILD_RESOLVED_SOURCE_VERSION $ECR_URI/myapp:$CODEBUILD_RESOLVED_SOURCE_VERSION

  post_build:
    commands:
      # Push to ECR
      - docker push $ECR_URI/myapp:$CODEBUILD_RESOLVED_SOURCE_VERSION
```

### CodeBuild IAM Service Role Permissions

The CodeBuild service role needs permissions for everything the build does:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::my-artifacts-bucket/*"
    },
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
        "ssm:GetParameters",
        "ssm:GetParameter"
      ],
      "Resource": "arn:aws:ssm:us-east-1:123456789:parameter/myapp/*"
    }
  ]
}
```

### CodeBuild Compute Types

| Compute Type | vCPU | Memory | Use Case |
|---|---|---|---|
| BUILD_GENERAL1_SMALL | 3 vCPU | 4 GB | Small projects, Node.js |
| BUILD_GENERAL1_MEDIUM | 7 vCPU | 16 GB | Most builds |
| BUILD_GENERAL1_LARGE | 15 vCPU | 72 GB | Large projects |
| BUILD_GENERAL1_2XLARGE | 72 vCPU | 145 GB | Compute-intensive builds |
| BUILD_LAMBDA_1GB | N/A | 1 GB | Lambda-based builds (faster start) |

### CodeBuild Pricing

- Charged per build minute
- No charge when no builds running
- Price varies by compute type (SMALL ~$0.005/min, LARGE ~$0.05/min)

---

## AWS CodeDeploy

### What It Is

CodeDeploy is a deployment service that automates application deployments to EC2 instances, on-premises servers, ECS clusters, and Lambda functions. It handles:
- Stopping old application version
- Installing new version
- Running pre/post deployment scripts
- Health checks
- Automatic rollback on failure

### Deployment Types

#### In-Place Deployment (EC2/On-Premises only)

```
Step 1: Deregister instances from load balancer (no traffic)
Step 2: Stop old application
Step 3: Deploy new application
Step 4: Run deployment lifecycle hooks
Step 5: Validate deployment
Step 6: Reregister instances with load balancer

[EC2 Instance]        [EC2 Instance]        [EC2 Instance]
  v1.0 → STOP           v1.0 → STOP           v1.0 → STOP
  deploy v2.0           deploy v2.0           deploy v2.0
  v2.0 Running          v2.0 Running          v2.0 Running
```

Deployment configurations for in-place:
- **CodeDeployDefault.AllAtOnce**: Deploy to all instances simultaneously (max speed, max risk)
- **CodeDeployDefault.HalfAtATime**: Deploy to 50% at a time
- **CodeDeployDefault.OneAtATime**: Deploy to one instance at a time (slowest, safest)

#### Blue/Green Deployment (EC2 and ECS)

```
Original environment (Blue):     Replacement environment (Green):
[EC2 v1.0] [EC2 v1.0]           [EC2 v2.0] [EC2 v2.0]
                 ^                                |
                 |                                |
            Load Balancer  <----traffic switched--+
```

For ECS Blue/Green:
```
Original Task Set (Blue):         Replacement Task Set (Green):
[Task v1.0] [Task v1.0]          [Task v2.0] [Task v2.0]
                 ^                                |
                 |                                |
            ALB Target Group  <--traffic shifted--+
```

### appspec.yml Structure

The appspec.yml file defines how CodeDeploy deploys your application. Must be in root of deployment bundle.

**For EC2/On-Premises:**
```yaml
version: 0.0

os: linux   # linux or windows

# Where to put files from the deployment bundle on the EC2 instance
files:
  - source: /          # Copy everything from root of bundle
    destination: /var/www/myapp
  - source: /config/nginx.conf
    destination: /etc/nginx/nginx.conf

# File permissions (optional)
permissions:
  - object: /var/www/myapp
    pattern: "**"
    except: ["*.log"]
    owner: ec2-user
    group: ec2-user
    mode: "755"
    type:
      - file
      - directory

# Lifecycle hooks - scripts to run at each phase
hooks:
  BeforeInstall:
    - location: scripts/stop_server.sh
      timeout: 300        # seconds before timeout
      runas: ec2-user     # user to run script as
  AfterInstall:
    - location: scripts/install_dependencies.sh
      timeout: 300
      runas: ec2-user
  ApplicationStart:
    - location: scripts/start_server.sh
      timeout: 300
      runas: ec2-user
  ValidateService:
    - location: scripts/validate.sh
      timeout: 300
      runas: ec2-user
```

**For ECS:**
```yaml
version: 0.0

Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: "arn:aws:ecs:us-east-1:123456789:task-definition/myapp:5"
        LoadBalancerInfo:
          ContainerName: "my-container"
          ContainerPort: 8080
        PlatformVersion: "LATEST"

Hooks:
  - BeforeInstall: "LambdaFunctionToValidateBeforeInstall"
  - AfterInstall: "LambdaFunctionToValidateAfterInstall"
  - AfterAllowTestTraffic: "LambdaFunctionToValidateTestTraffic"
  - BeforeAllowTraffic: "LambdaFunctionToValidateBeforeTraffic"
  - AfterAllowTraffic: "LambdaFunctionToValidateAfterTraffic"
```

**For Lambda:**
```yaml
version: 0.0

Resources:
  - myLambdaFunction:
      Type: AWS::Lambda::Function
      Properties:
        Name: "myLambdaFunction"
        Alias: "live"
        CurrentVersion: "1"
        TargetVersion: "2"

Hooks:
  - BeforeAllowTraffic: "LambdaFunctionToValidateBefore"
  - AfterAllowTraffic: "LambdaFunctionToValidateAfter"
```

### CodeDeploy Lifecycle Hooks (EC2)

```
DEPLOYMENT LIFECYCLE:

ApplicationStop
    |
DownloadBundle         <-- CodeDeploy downloads the revision from S3/GitHub
    |
BeforeInstall          <-- YOUR HOOK: stop services, back up current version
    |
Install                <-- CodeDeploy copies files per appspec.yml
    |
AfterInstall           <-- YOUR HOOK: install dependencies, configure app
    |
ApplicationStart       <-- YOUR HOOK: start the application
    |
ValidateService        <-- YOUR HOOK: health check, smoke test
    |
BeforeBlockTraffic     <-- (Blue/Green: before removing from load balancer)
    |
BlockTraffic           <-- CodeDeploy removes instance from load balancer
    |
AfterBlockTraffic      <-- (Blue/Green: cleanup after traffic blocked)
    |
BeforeAllowTraffic     <-- (Blue/Green: before adding new instance to LB)
    |
AllowTraffic           <-- CodeDeploy registers instance with load balancer
    |
AfterAllowTraffic      <-- YOUR HOOK: final validation
```

### Example Hook Script

```bash
#!/bin/bash
# scripts/validate.sh

# Check that the application is responding
for i in {1..5}; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
  if [ "$RESPONSE" == "200" ]; then
    echo "Health check passed"
    exit 0
  fi
  echo "Attempt $i: Got $RESPONSE, waiting..."
  sleep 10
done

echo "Health check failed after 5 attempts"
exit 1  # Non-zero exit = deployment fails = rollback triggered
```

### CodeDeploy Agent

For EC2/on-premises deployments, the **CodeDeploy agent** must be installed and running on each instance:

```bash
# Install on Amazon Linux 2
sudo yum install -y ruby wget
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo service codedeploy-agent start
```

The agent:
- Polls CodeDeploy service for deployment instructions
- Downloads deployment bundle from S3 or GitHub
- Executes lifecycle hooks
- Reports deployment status back to CodeDeploy

### CodeDeploy Rollback

Automatic rollback triggers:
- Deployment fails (hook script exits non-zero)
- CloudWatch alarm goes into ALARM state (e.g., error rate spike)
- Manual rollback initiated from console/CLI

```
Rollback: CodeDeploy re-deploys the LAST SUCCESSFUL deployment
          (not just "undo" - it runs a full new deployment with the old version)
```

### Lambda Deployment Configurations

CodeDeploy supports traffic shifting for Lambda:

| Configuration | Traffic Shift Pattern |
|---|---|
| LambdaCanary10Percent5Minutes | 10% for 5 min, then 100% |
| LambdaCanary10Percent10Minutes | 10% for 10 min, then 100% |
| LambdaCanary10Percent15Minutes | 10% for 15 min, then 100% |
| LambdaLinear10PercentEvery1Minute | +10% every 1 min |
| LambdaLinear10PercentEvery2Minutes | +10% every 2 min |
| LambdaLinear10PercentEvery10Minutes | +10% every 10 min |
| LambdaAllAtOnce | All traffic immediately (no shifting) |

```
Canary10Percent5Minutes:
t=0:  10% → new version, 90% → old version
t=5m: CloudWatch alarms checked
      - If OK: 100% → new version
      - If ALARM: rollback to 100% old version
```

---

## AWS CodePipeline

### What It Is

CodePipeline is the orchestration layer that ties together source, build, test, and deploy stages into an automated CI/CD pipeline.

```
+----------+    +----------+    +----------+    +----------+
|          |    |          |    |          |    |          |
|  SOURCE  | -> |  BUILD   | -> |  TEST    | -> |  DEPLOY  |
|  Stage   |    |  Stage   |    |  Stage   |    |  Stage   |
|          |    |          |    |          |    |          |
+----------+    +----------+    +----------+    +----------+
     |               |               |               |
  CodeCommit      CodeBuild      CodeBuild        CodeDeploy
  GitHub          (build)        (test)           Elastic
  S3                                              Beanstalk
  ECR                                             ECS
                                                  Lambda
                                                  CloudFormation
```

### Pipeline Components

**Stage:** A logical phase in the pipeline (Source, Build, Test, Staging, Production)
- Each stage contains one or more actions
- Stages run sequentially by default

**Action:** A specific task within a stage
- Actions within a stage can run in parallel (same runOrder) or sequentially
- Action types: Source, Build, Test, Deploy, Invoke (Lambda), Approval

**Artifact:** File(s) passed between stages
- Stored in S3 (CodePipeline creates a dedicated S3 bucket)
- Can be input or output of actions

### Complete Pipeline Example (CloudFormation)

```yaml
AWSTemplateFormatVersion: '2010-09-09'

Resources:
  MyPipeline:
    Type: AWS::CodePipeline::Pipeline
    Properties:
      Name: my-app-pipeline
      RoleArn: !GetAtt PipelineRole.Arn
      ArtifactStore:
        Type: S3
        Location: !Ref ArtifactBucket
      Stages:
        # Stage 1: Source
        - Name: Source
          Actions:
            - Name: SourceAction
              ActionTypeId:
                Category: Source
                Owner: ThirdParty
                Provider: GitHub
                Version: '1'
              Configuration:
                Owner: my-github-org
                Repo: my-app
                Branch: main
                OAuthToken: !Sub '{{resolve:secretsmanager:github-token}}'
              OutputArtifacts:
                - Name: SourceOutput

        # Stage 2: Build
        - Name: Build
          Actions:
            - Name: BuildAction
              ActionTypeId:
                Category: Build
                Owner: AWS
                Provider: CodeBuild
                Version: '1'
              Configuration:
                ProjectName: !Ref MyCodeBuildProject
              InputArtifacts:
                - Name: SourceOutput
              OutputArtifacts:
                - Name: BuildOutput

        # Stage 3: Manual Approval
        - Name: ApproveProduction
          Actions:
            - Name: ManualApproval
              ActionTypeId:
                Category: Approval
                Owner: AWS
                Provider: Manual
                Version: '1'
              Configuration:
                NotificationArn: !Ref ApprovalSNSTopic
                CustomData: "Please review staging environment before approving"
                ExternalEntityLink: "https://staging.myapp.com"

        # Stage 4: Deploy to Production
        - Name: Deploy
          Actions:
            - Name: DeployAction
              ActionTypeId:
                Category: Deploy
                Owner: AWS
                Provider: CodeDeploy
                Version: '1'
              Configuration:
                ApplicationName: !Ref MyCodeDeployApp
                DeploymentGroupName: !Ref MyDeploymentGroup
              InputArtifacts:
                - Name: BuildOutput
```

### Source Providers

| Provider | Notes |
|----------|-------|
| CodeCommit | AWS-native, IAM auth, deprecated for new projects |
| GitHub | Most common, needs GitHub OAuth token or GitHub App |
| GitHub Enterprise | Self-hosted GitHub |
| GitLab | Uses webhook + OAuth |
| Bitbucket | Uses webhook + OAuth |
| S3 | Poll bucket for new zip files (good for build artifacts as source) |
| ECR | Trigger on new container image push |

### CodePipeline + ECS Blue/Green Flow

```
GitHub Push
    |
    v
[SOURCE STAGE]
  - Checkout code

    |
    v
[BUILD STAGE] - CodeBuild
  - docker build
  - docker push to ECR
  - write imagedefinitions.json:
    [{"name":"mycontainer","imageUri":"123.dkr.ecr.us-east-1.amazonaws.com/myapp:abc1234"}]

    |
    v
[DEPLOY STAGE] - CodeDeploy (Blue/Green)
  - Read imagedefinitions.json
  - Create new ECS task definition with new image
  - Create replacement task set (Green)
  - Shift 10% test traffic to Green
  - Run BeforeAllowTraffic Lambda hook
  - Wait X minutes
  - Shift 100% traffic to Green
  - Terminate old task set (Blue)
```

### Manual Approval Actions

Manual approval gates are critical for production deployments:

```
When pipeline reaches approval stage:
1. SNS notification sent to approvers
2. Pipeline pauses (waits up to 7 days by default)
3. Approver clicks link in notification → taken to CodePipeline console
4. Approver reviews change summary and external URL
5. Approver clicks Approve or Reject with comments
6. If Approved: pipeline continues
7. If Rejected: pipeline stops (requires new commit to restart)
```

### Pipeline Notifications

```
CodePipeline → CloudWatch Events → SNS Topic → Email notification
                                 → Lambda function (post to Slack)
                                 → EventBridge rule → target action
```

---

## AWS CodeArtifact

### What It Is

CodeArtifact is a managed artifact repository that stores and manages software packages (dependencies). Think of it as a private npm registry, Maven repository, or PyPI mirror.

### Supported Package Formats

| Format | Language | Example |
|--------|---------|---------|
| npm | JavaScript/Node.js | express, lodash |
| PyPI | Python | boto3, requests |
| Maven | Java | spring-boot, junit |
| NuGet | .NET/C# | Newtonsoft.Json |
| Swift | iOS/macOS | Alamofire |
| Generic | Any | Binary files |

### Why Use CodeArtifact?

1. **Security:** Proxy public registries (npm, PyPI) and block malicious packages
2. **Speed:** Cache packages closer to your build servers (lower latency, no rate limiting)
3. **Private packages:** Publish internal packages only visible to your organization
4. **Audit:** See who downloaded what package, when
5. **Dependency substitution:** Automatically use approved versions

### Architecture

```
Developer / Build Server
         |
         v
[CodeArtifact Domain]
  - Your organization's artifact namespace
  - Can contain multiple repositories
         |
         v
[CodeArtifact Repository]
  - upstream-repo: public registry proxy (npm public, PyPI public)
  - internal-repo: your private packages
         |
         v
[Upstream Repositories]
  npm public registry
  Maven Central
  PyPI
  (fetched and cached on first request)
```

### Using CodeArtifact with npm

```bash
# Get authorization token (valid 12 hours)
export CODEARTIFACT_AUTH_TOKEN=$(aws codeartifact get-authorization-token \
  --domain my-domain \
  --domain-owner 123456789012 \
  --query authorizationToken \
  --output text)

# Configure npm to use CodeArtifact
aws codeartifact login --tool npm \
  --repository my-repo \
  --domain my-domain \
  --domain-owner 123456789012

# Now npm install uses CodeArtifact
npm install express
```

### Using CodeArtifact with pip (Python)

```bash
# Configure pip to use CodeArtifact
aws codeartifact login --tool pip \
  --repository my-repo \
  --domain my-domain \
  --domain-owner 123456789012

# Install packages through CodeArtifact
pip install boto3
```

### Exam Key Points for CodeArtifact

- Domain: top-level grouping, one per organization
- Repository: within a domain, stores packages of one format
- Upstream repositories: chain CodeArtifact repos together; can proxy public registries
- Cross-account sharing: via resource policies
- EventBridge integration: notify when packages are published
- Encryption: KMS keys

---

## Interview Q&A: AWS Developer Tools

**Q: What is the difference between CodeDeploy in-place and Blue/Green deployment?**

A: In-place deployment stops the application on existing instances, deploys new code, and restarts. The same instances are reused. It causes brief downtime unless combined with a load balancer, and rollback requires re-deploying the old version. Blue/Green deployment creates a parallel environment (green) with the new version while the current environment (blue) continues serving traffic. Traffic is switched to green only after validation. If something goes wrong, traffic is instantly switched back to blue. Blue/Green is faster to roll back, causes zero downtime, but costs more due to running two environments simultaneously.

---

**Q: What is buildspec.yml and what are its phases?**

A: buildspec.yml is the configuration file that tells CodeBuild what to do during a build. It has four phases: install (set up the build environment and install tools), pre_build (actions before the main build such as logging into ECR), build (the main compilation, testing, and packaging work), and post_build (actions after the build such as pushing Docker images). It also defines artifacts (files to save) and cache (files to persist between builds for faster subsequent builds).

---

**Q: How does CodePipeline pass data between stages?**

A: Through artifacts stored in S3. Each stage can produce output artifacts and consume input artifacts. When a build stage runs CodeBuild, the output files (like a compiled binary or imagedefinitions.json) are automatically zipped and uploaded to CodePipeline's S3 artifact bucket. The next stage downloads those artifacts as its input.

---

**Q: How do you implement a zero-downtime deployment with CodeDeploy?**

A: Use Blue/Green deployment. For ECS: CodeDeploy creates a new task set (green) alongside the existing one (blue), routes a small percentage of traffic to green (or test traffic only), validates via Lambda hooks, then shifts 100% traffic to green and terminates blue. For EC2: CodeDeploy provisions new instances in a new Auto Scaling Group, deploys to them, shifts load balancer traffic, then terminates the old group.

---

**Q: What is the CodeDeploy agent and when is it required?**

A: The CodeDeploy agent is a software package installed on EC2 instances or on-premises servers. It polls the CodeDeploy service for deployment instructions, downloads the application revision from S3 or GitHub, executes lifecycle hooks, and reports deployment status. It is required for EC2 and on-premises deployments. For ECS and Lambda deployments, no agent is required because CodeDeploy controls the AWS services directly via API.

---

**Q: How can CodePipeline be triggered automatically on a code commit?**

A: For CodeCommit and S3 sources, CodePipeline uses CloudWatch Events (EventBridge) to detect changes and trigger automatically. For GitHub, CodePipeline uses webhooks. When code is pushed to the configured branch, the webhook calls CodePipeline's API, which starts the pipeline. Alternatively, you can configure periodic polling (not recommended for production due to delay).

---

**Q: What is CodeArtifact and when would you use it over just downloading from npm/PyPI directly?**

A: CodeArtifact is a managed package repository. You would use it when you need to: (1) cache external packages to avoid rate limits and reduce latency in builds, (2) store private internal packages, (3) enforce approved package versions by blocking certain packages upstream, (4) audit package downloads for compliance, or (5) ensure builds work in environments with no internet access (VPC with no NAT gateway, use CodeArtifact VPC endpoint).

---

**Q: In a CodeDeploy lifecycle hook, how do you signal failure?**

A: Exit the hook script with a non-zero exit code (e.g., exit 1 in bash, sys.exit(1) in Python). CodeDeploy interprets any non-zero exit as a hook failure, stops the deployment, and triggers an automatic rollback if rollback is configured. You can also call the PutLifecycleEventHookExecutionStatus API to explicitly report failed status, which is required when hooks are Lambda functions rather than scripts.
