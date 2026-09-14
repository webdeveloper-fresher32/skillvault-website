# CI/CD Concepts: The Foundation

## What is CI/CD?

CI/CD stands for three related but distinct practices that together automate the software delivery lifecycle:

```
+-------------------------+     +---------------------------+     +-----------------------------+
|  Continuous             |     |  Continuous               |     |  Continuous                 |
|  Integration (CI)       | --> |  Delivery (CD)            | --> |  Deployment (CD)            |
|                         |     |                           |     |                             |
|  Merge code frequently  |     |  Always have a release-   |     |  Every passing build        |
|  Run automated tests    |     |  ready artifact           |     |  auto-deploys to prod       |
|  Fail fast on errors    |     |  Manual approval to prod  |     |  No manual approval needed  |
+-------------------------+     +---------------------------+     +-----------------------------+
```

---

## Continuous Integration (CI)

**Definition:** Developers merge code changes into a shared branch frequently (multiple times per day). Each merge triggers an automated build and test run.

**Core Idea:** Catch integration problems early, when they are cheap to fix.

**What CI does:**
1. Developer pushes code to feature branch
2. Pull request / merge request is opened
3. CI pipeline automatically:
   - Pulls latest code
   - Compiles / builds the application
   - Runs unit tests
   - Runs linting and static analysis
   - Reports pass/fail back to the developer within minutes
4. If all checks pass, code can be merged

**Without CI:**
```
Developer A works for 2 weeks on feature A
Developer B works for 2 weeks on feature B
They merge → massive conflicts, broken tests everywhere
"Integration hell" - days spent fixing conflicts
```

**With CI:**
```
Developer A merges small chunks daily
Developer B merges small chunks daily
Conflicts are tiny and caught immediately
Integration is always clean
```

---

## Continuous Delivery (CD)

**Definition:** The codebase is always in a deployable state. Every change that passes CI is packaged into a release artifact and staged for production deployment. A human approves the actual production release.

**Key distinction from CI:** CI is about build and test. CD is about ensuring the artifact is always ready to ship.

**What Continuous Delivery adds:**
- Automated deployment to staging/QA environments
- Integration tests, performance tests, security scans in pipeline
- Versioned release artifacts stored in a registry
- One-click (or auto) deployment to production after manual approval

```
Code Commit
    |
    v
Build & Unit Tests  (CI)
    |
    v
Deploy to Staging   (CD starts here)
    |
    v
Integration Tests
    |
    v
Performance Tests
    |
    v
[MANUAL APPROVAL GATE]
    |
    v
Deploy to Production
```

---

## Continuous Deployment

**Definition:** Every change that passes all automated tests is automatically deployed to production without any manual approval.

**Requirements before adopting Continuous Deployment:**
- Excellent test coverage (unit, integration, E2E)
- Feature flags to decouple deploy from release
- Robust monitoring and alerting
- Fast rollback capability

**Who uses it:** Netflix, Amazon, Etsy, Facebook (large tech companies with mature engineering cultures)

**CI vs CD vs CD Summary:**

| | Continuous Integration | Continuous Delivery | Continuous Deployment |
|---|---|---|---|
| Goal | Catch bugs early | Always shippable | Always shipped |
| Automated testing | Yes | Yes | Yes |
| Automated deploy to staging | Sometimes | Yes | Yes |
| Automated deploy to prod | No | No | Yes |
| Manual approval | N/A | Yes, before prod | No |
| Risk level | Low | Medium | High (requires strong testing) |

---

## CI/CD Pipeline Stages

A standard pipeline moves code through multiple stages, each acting as a quality gate:

```
+----------+    +----------+    +----------+    +----------+    +----------+
|          |    |          |    |          |    |          |    |          |
|  SOURCE  | -> |  BUILD   | -> |   TEST   | -> |  STAGE   | -> |  DEPLOY  |
|          |    |          |    |          |    |          |    |          |
+----------+    +----------+    +----------+    +----------+    +----------+
     |               |               |               |               |
   Code             Compile        Unit Tests      Integration    Production
   commit           Install        Lint            Tests          Release
   branch           deps           SAST            Smoke tests
   trigger          Build          Coverage        Manual gate
                    artifact       check           (optional)
```

### Stage 1: Source

**Trigger:** A git push, pull request merge, or scheduled cron

**What happens:**
- Pipeline detects new commit
- Source code is checked out
- Pipeline configuration is read (e.g., .github/workflows/, buildspec.yml)

**Common source repositories:**
- AWS CodeCommit (AWS-native, being deprecated)
- GitHub (most popular in industry)
- GitLab
- Bitbucket
- S3 (for zip uploads)

### Stage 2: Build

**What happens:**
- Install dependencies (npm install, pip install, mvn dependency:resolve)
- Compile code (Java → .jar, TypeScript → JavaScript, etc.)
- Build Docker image (docker build)
- Run linting (eslint, pylint, etc.)
- Package artifacts (zip, jar, Docker image)

**Outputs:**
- Compiled binaries
- Docker image pushed to registry (ECR, Docker Hub)
- ZIP file uploaded to S3
- Test reports

**Build environment:**
- Ephemeral: each build gets a fresh environment
- Containerized: builds run in Docker containers
- Controlled: specific language versions, tools, OS

### Stage 3: Test

**Unit Tests:** Test individual functions/methods in isolation
```
function add(a, b) { return a + b }
test: add(2, 3) === 5  -> PASS
```

**Integration Tests:** Test how components work together
```
API endpoint -> Database query -> Returns correct data
```

**End-to-End (E2E) Tests:** Test full user flows (Selenium, Cypress, Playwright)
```
User opens browser -> logs in -> adds item to cart -> checks out -> order confirmed
```

**Security / SAST:** Static Application Security Testing
```
Scans code for SQL injection patterns, hardcoded secrets, vulnerable dependencies
Tools: Snyk, Checkov, Bandit, SonarQube
```

**Code Coverage:**
```
Line coverage: what % of code lines are executed during tests
Branch coverage: what % of if/else branches are tested
Target: 80%+ coverage for most teams
```

### Stage 4: Staging Deployment

- Deploy to a pre-production environment that mirrors production
- Run smoke tests (basic sanity checks)
- Run performance / load tests
- Manual testing by QA team
- Manual approval gate (optional)

### Stage 5: Production Deployment

- Deploy to production using one of the deployment patterns (below)
- Run smoke tests against production
- Monitor error rates, latency, metrics
- Automatic rollback if metrics degrade

---

## Deployment Patterns

### Blue/Green Deployment

**Concept:** Run two identical production environments. Blue = current live. Green = new version. Switch traffic from Blue to Green.

```
BEFORE DEPLOYMENT:
+------------------+         +------------------+
|   BLUE (Live)    |         |   GREEN (Idle)   |
|   Version 1.0    |         |   (empty)        |
+------------------+         +------------------+
         ^
         |
    [Load Balancer]
         ^
         |
    [All Traffic]


DEPLOY NEW VERSION:
+------------------+         +------------------+
|   BLUE (Live)    |         |   GREEN (New)    |
|   Version 1.0    |         |   Version 2.0    |
+------------------+         +------------------+
         ^
         |
    [Load Balancer]
         ^
         |
    [All Traffic - still going to Blue]


SWITCH TRAFFIC:
+------------------+         +------------------+
|   BLUE (Standby) |         |   GREEN (Live)   |
|   Version 1.0    |         |   Version 2.0    |
+------------------+         +------------------+
                                      ^
                                      |
                                 [Load Balancer]
                                      ^
                                      |
                                 [All Traffic]


IF ROLLBACK NEEDED: Switch back to Blue instantly
```

**Advantages:**
- Zero downtime deployment
- Instant rollback (just change load balancer target)
- Full testing on green before switch
- No mixed versions serving traffic

**Disadvantages:**
- Requires 2x infrastructure cost during deployment
- Database migrations must be backward compatible
- Not ideal for stateful applications without session management

**AWS Implementation:**
- Elastic Beanstalk: built-in swap environment URLs
- ECS: CodeDeploy with Blue/Green deployment type
- Lambda: traffic shifting with aliases
- EC2: CodeDeploy Blue/Green with Auto Scaling Groups

---

### Canary Deployment

**Concept:** Route a small percentage of traffic to the new version. Gradually increase if healthy. Roll back if problems are detected.

```
Initial State (all traffic to v1):
+------------------+
|   Version 1.0    | <-- 100% traffic
+------------------+

Canary Phase (5% to v2):
+------------------+    +------------------+
|   Version 1.0    |    |   Version 2.0    |
|   95% traffic    |    |   5% traffic     |
+------------------+    +------------------+

Expanding (20% to v2):
+------------------+    +------------------+
|   Version 1.0    |    |   Version 2.0    |
|   80% traffic    |    |   20% traffic    |
+------------------+    +------------------+

Full Rollout (100% to v2):
+------------------+
|   Version 2.0    | <-- 100% traffic
+------------------+

OR: Rollback (100% back to v1 if errors detected):
+------------------+
|   Version 1.0    | <-- 100% traffic (v2 terminated)
+------------------+
```

**Traffic split examples:**
- 5% → 10% → 25% → 50% → 100% (gradual)
- 10% for 10 minutes → if error rate < 0.1% → 100% (time-based)

**What to monitor during canary:**
- Error rate (5xx responses)
- Latency (p99 response time)
- Business metrics (conversion rate, revenue per request)
- Application logs for exceptions

**AWS Implementation:**
- Lambda: Weighted aliases (10% to $LATEST, 90% to stable version)
- API Gateway: Canary deployments in stages
- CodeDeploy: Linear10PercentEvery10Minutes, Canary10Percent5Minutes
- Route53: Weighted routing (not exactly canary but similar concept)

---

### Rolling Deployment

**Concept:** Update instances one at a time (or in small batches), replacing old version with new version progressively.

```
Start: All 4 instances running v1.0
[v1.0] [v1.0] [v1.0] [v1.0]

Step 1: Take instance 1 out of rotation, update it
[UPDATING] [v1.0] [v1.0] [v1.0]
  (traffic goes to 3 remaining v1.0 instances)

Step 2: Instance 1 back in rotation as v2.0, update instance 2
[v2.0] [UPDATING] [v1.0] [v1.0]
  (traffic split between v2.0 and v1.0)

Step 3: Continue
[v2.0] [v2.0] [UPDATING] [v1.0]

Step 4: Complete
[v2.0] [v2.0] [v2.0] [v2.0]
```

**Advantages:**
- No extra infrastructure needed
- Gradual rollout with ability to pause

**Disadvantages:**
- During deployment, both versions serve traffic simultaneously
- Rollback is slow (requires rolling back each instance)
- If database schema changes, old and new versions must be compatible

**AWS Implementation:**
- EC2 Auto Scaling: UpdatePolicy with RollingUpdate
- ECS: rolling update deployment type (default)
- Elastic Beanstalk: rolling deployment policy

---

### In-Place Deployment

**Concept:** Stop the application on each instance, deploy new code, restart. Simple but causes downtime.

```
[Running v1.0]
      |
  [STOP APP]
      |
  [DEPLOY v2.0]
      |
  [START APP]
      |
[Running v2.0]
```

**When to use:**
- Development / staging environments
- Applications where brief downtime is acceptable
- Simplest deployment scenario

---

### Recreate Deployment

**Concept:** Terminate all old instances, create new instances with new version.

```
+--------+  +--------+  +--------+
| v1.0   |  | v1.0   |  | v1.0   |   <-- ALL TERMINATED
+--------+  +--------+  +--------+
       Downtime window
+--------+  +--------+  +--------+
| v2.0   |  | v2.0   |  | v2.0   |   <-- ALL CREATED
+--------+  +--------+  +--------+
```

**Use case:** Acceptable downtime, database schema changes that are not backward compatible

---

## Feature Flags

**Definition:** Feature flags (also called feature toggles or feature switches) are configuration values that enable or disable features at runtime without deploying new code.

```python
# Without feature flags:
# To release a feature, you must deploy new code

# With feature flags:
if feature_flags.is_enabled("new_checkout_flow", user_id):
    show_new_checkout()
else:
    show_old_checkout()
```

**Why feature flags matter for CI/CD:**
- Decouple deploy from release: merge code to main (CI) without it being visible to users
- Canary releases via user targeting: enable feature for 1% of users without routing changes
- A/B testing: show feature to 50% of users, measure impact
- Kill switch: instantly disable a problematic feature without rollback

**Types of feature flags:**

| Type | Purpose | Example |
|------|---------|---------|
| Release toggle | Hide incomplete features | New UI in development |
| Experiment toggle | A/B testing | Test button color on 50% of users |
| Ops toggle | Control system behavior | Disable cache under load |
| Permission toggle | Enable for specific users | Beta access for premium users |

**AWS Implementation:**
- AWS AppConfig: feature flags and configuration management, supports gradual rollout with CloudWatch alarms as rollback triggers
- Third-party: LaunchDarkly, Split.io, Flagsmith

```
AppConfig Feature Flag Flow:
Application starts
    |
    v
Poll AppConfig for configuration
    |
    v
AppConfig returns:
{
  "new_checkout_flow": {
    "enabled": true,
    "percentage": 10
  }
}
    |
    v
Application enables feature for 10% of users
    |
    v
CloudWatch alarm fires (error rate spike)
    |
    v
AppConfig rollback triggers automatically
    |
    v
Feature disabled for all users
```

---

## Benefits of CI/CD

### Speed
- Changes go from commit to production in minutes, not weeks
- Teams can deploy multiple times per day
- Faster iteration on user feedback

### Quality
- Bugs caught immediately when code is fresh in developer's mind
- Consistent test execution (not dependent on "I ran the tests locally")
- Code review culture enabled by small, frequent commits

### Reliability
- Deployments are automated and repeatable
- Human error removed from deployment process
- Rollbacks are scripted and fast

### Visibility
- Complete audit trail of what was deployed, when, by whom
- Pipeline status visible to entire team
- Metrics and logs for every deployment

### Confidence
- Developers can refactor fearlessly (tests will catch regressions)
- Operations teams trust that what is deployed matches what was tested
- Stakeholders can see progress in real environments daily

---

## Pipeline Best Practices

### Fail Fast
- Run quickest tests first (linting → unit tests → integration tests)
- Fail the pipeline as soon as the first failure is detected
- Do not run expensive stages if cheap stages fail

### Immutable Artifacts
- Build once, deploy everywhere
- Same Docker image deployed to staging AND production
- Never rebuild for each environment (different environments can produce different results)

```
BAD:  Build → Deploy to Staging → Build again → Deploy to Production
GOOD: Build → Push to ECR → Deploy image:v1.2.3 to Staging → Deploy same image:v1.2.3 to Production
```

### Environment Parity
- Staging should mirror production as closely as possible
- Same instance types, same database engine versions, same network topology
- Configuration differences via environment variables only

### Secrets Management
- Never commit secrets to source code
- Use AWS Secrets Manager, Parameter Store, or GitHub Secrets
- Inject secrets at runtime, not at build time

### Version Everything
- Tag Docker images with git commit SHA or semantic version
- Version Lambda functions
- Store buildspec.yml and appspec.yml in the same repo as application code
