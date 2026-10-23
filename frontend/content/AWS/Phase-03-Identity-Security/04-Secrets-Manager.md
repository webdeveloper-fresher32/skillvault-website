# AWS Secrets Manager

## Table of Contents

1. [What is Secrets Manager?](#what-is-secrets-manager)
2. [Secrets Manager vs Parameter Store](#secrets-manager-vs-parameter-store)
3. [What Secrets Can Be Stored](#what-secrets-can-be-stored)
4. [Creating and Retrieving Secrets](#creating-and-retrieving-secrets)
5. [Automatic Secret Rotation](#automatic-secret-rotation)
6. [Accessing Secrets from Lambda](#accessing-secrets-from-lambda)
7. [Accessing Secrets from EC2](#accessing-secrets-from-ec2)
8. [Secrets Manager and KMS](#secrets-manager-and-kms)
9. [Cost Comparison with Parameter Store](#cost-comparison-with-parameter-store)
10. [Best Practices](#best-practices)
11. [Interview Q&A](#interview-qa)

---

## What is Secrets Manager?

AWS Secrets Manager is a fully managed service for storing, retrieving, rotating, and auditing secrets (database credentials, API keys, OAuth tokens, TLS certificates, SSH keys, and any other sensitive configuration data).

The key problem it solves: developers often hardcode database passwords and API keys directly in code or configuration files. These end up in git repositories, Docker images, and application servers — creating significant security risks. Secrets Manager moves these credentials out of code and into a secure, auditable store.

### Core Capabilities

1. **Secure storage**: Secrets are encrypted at rest using KMS (by default with `aws/secretsmanager`, optionally with your own CMK)
2. **Automatic rotation**: Secrets can be automatically rotated on a schedule with zero application downtime
3. **Fine-grained access control**: IAM policies and resource policies control who can read each secret
4. **Auditing**: Every access is logged to CloudTrail
5. **Cross-region replication**: Replicate secrets to multiple Regions for DR/multi-region apps
6. **Versioning**: Multiple versions of a secret exist during rotation (AWSCURRENT, AWSPENDING, AWSPREVIOUS)

---

## Secrets Manager vs Parameter Store

AWS Systems Manager Parameter Store is another service that can store secrets. Choosing between them is a common interview question and real-world decision.

### Comparison Table

| Feature | Secrets Manager | Parameter Store (Standard) | Parameter Store (Advanced) |
|---------|-----------------|--------------------------|--------------------------|
| **Cost** | $0.40/secret/month + $0.05 per 10K API calls | FREE (Standard tier) | $0.05/parameter/month |
| **Max secret size** | 65 KB | 4 KB | 8 KB |
| **Automatic rotation** | YES (native, built-in rotation for RDS, etc.) | NO (requires custom Lambda) | NO (requires custom Lambda) |
| **Versioning** | YES (always) | YES (via history) | YES |
| **Cross-account sharing** | YES (resource policy) | YES | YES |
| **Cross-region replication** | YES (native) | NO | NO |
| **KMS encryption** | ALWAYS encrypted | Optional (SecureString type) | Optional (SecureString type) |
| **TTL / Expiration** | NO (rotation serves this purpose) | YES (via Advanced policies) | YES |
| **Service integrations** | RDS, Redshift, DocumentDB (native rotation) | EC2, ECS, Lambda (env vars) | Same as Standard |
| **Hierarchies / Paths** | NO (flat namespace) | YES (`/app/dev/db-password`) | YES |
| **CloudFormation dynamic references** | YES `{{resolve:secretsmanager:...}}` | YES `{{resolve:ssm-secure:...}}` | YES |
| **Use case** | Database passwords, API keys needing rotation | Config values, non-secret params, secrets without rotation | Larger configs, TTL-based secrets |

### Decision Framework

```
Does the secret need AUTOMATIC ROTATION?
    YES --> Secrets Manager (this is its killer feature)
    NO  --> Continue

Is it actually a secret (sensitive credential)?
    YES --> Secrets Manager (native encryption, better audit)
    NO  --> Parameter Store Standard (free, good for config)

Do you need it FREE?
    YES --> Parameter Store (Standard is free)
    NO  --> Secrets Manager ($0.40/month per secret)

Does your app need structured secret with multiple fields?
    (e.g., host, port, username, password as JSON)
    YES --> Secrets Manager (stores JSON natively)
    NO  --> Either works

Do you need hierarchical paths like /app/prod/db?
    YES --> Parameter Store (has path-based hierarchy)
    NO  --> Secrets Manager or Parameter Store
```

### Summary Recommendation

- **Database passwords that need rotation** → Secrets Manager
- **API keys and OAuth tokens** → Secrets Manager (if budget allows) or Parameter Store SecureString
- **Non-sensitive config (URLs, feature flags, non-secret values)** → Parameter Store Standard (free)
- **High-volume reads with cost sensitivity** → Parameter Store (much cheaper per API call for high volume)

---

## What Secrets Can Be Stored

Secrets Manager stores secrets as **key-value pairs** or **arbitrary text/JSON strings** (up to 65 KB).

### Native Support (with automatic rotation)

- Amazon RDS database credentials (MySQL, PostgreSQL, Oracle, MariaDB, SQL Server)
- Amazon Aurora credentials
- Amazon Redshift credentials
- Amazon DocumentDB credentials
- Other databases (custom Lambda rotation function required)

### Manual (no built-in rotation, but you can build it)

- API keys (Stripe, Twilio, GitHub, etc.)
- OAuth client secrets
- SSH private keys
- TLS/SSL certificates (though ACM is better for TLS certs)
- Generic text or binary secrets

### Example Secret Structure

For an RDS database, Secrets Manager stores a JSON object:

```json
{
  "engine": "mysql",
  "host": "mydbinstance.123456789012.ap-southeast-2.rds.amazonaws.com",
  "username": "admin",
  "password": "SuperSecretPassword123!",
  "dbname": "myapp",
  "port": 3306
}
```

For an API key:
```json
{
  "api_key": "sk_live_abc123def456...",
  "api_secret": "whsec_xyz789..."
}
```

---

## Creating and Retrieving Secrets

### Creating a Secret via Console

1. AWS Console → Secrets Manager → "Store a new secret"
2. Choose secret type:
   - "Credentials for Amazon RDS database" (builds the JSON structure automatically)
   - "Credentials for other database"
   - "Other type of secret" (arbitrary key-value or text)
3. Enter the secret value
4. Choose the KMS key (`aws/secretsmanager` or your own CMK)
5. Name the secret (e.g., `prod/myapp/database`)
6. (Optional) Configure rotation
7. Review and store

### Creating a Secret via CLI

```bash
# Store a database password (JSON format)
aws secretsmanager create-secret \
    --name prod/myapp/database \
    --description "Production database credentials for MyApp" \
    --secret-string '{
        "engine": "mysql",
        "host": "db.example.com",
        "username": "admin",
        "password": "MyS3cretP@ssword!",
        "dbname": "myapp",
        "port": 3306
    }' \
    --kms-key-id alias/my-app-key

# Store a simple API key
aws secretsmanager create-secret \
    --name prod/myapp/stripe-api-key \
    --secret-string '{"api_key":"sk_live_abc123","api_secret":"whsec_xyz789"}'
```

### Retrieving a Secret

```bash
# Get the current secret value (returns JSON with metadata + secret)
aws secretsmanager get-secret-value \
    --secret-id prod/myapp/database

# Get just the secret string
aws secretsmanager get-secret-value \
    --secret-id prod/myapp/database \
    --query SecretString \
    --output text

# Get a specific version
aws secretsmanager get-secret-value \
    --secret-id prod/myapp/database \
    --version-stage AWSCURRENT
```

### Secret Naming Conventions

Best practice: use path-style names for organization:
```
/environment/application/secret-name
prod/myapp/db-credentials
prod/myapp/stripe-api-key
staging/myapp/db-credentials
dev/myapp/db-credentials
```

This makes IAM policies easier to write (wildcard by environment or application).

---

## Automatic Secret Rotation

### What is Rotation?

Secret rotation is the process of automatically replacing a secret (e.g., a database password) with a new, randomly generated value on a schedule — without any application downtime.

Without rotation: a password might be 5 years old and reused across services. If it was ever leaked, it remains valid indefinitely.

With rotation: passwords change every 30/60/90 days automatically. Even if leaked, the window of exposure is limited.

### How Rotation Works

Secrets Manager uses a **Lambda function** to perform rotation. For RDS/Aurora, AWS provides built-in rotation Lambda functions; for custom databases/APIs, you write your own.

#### The Four-Step Rotation Process

```
AWSCURRENT (old password: "OldPass123")
AWSPENDING (new password, being set up)

Step 1: createSecret
    Lambda creates a new secret value and stores it as AWSPENDING version
    New random password: "NewPass789!@#"

Step 2: setSecret
    Lambda sets the new password in the actual database:
    ALTER USER 'admin'@'%' IDENTIFIED BY 'NewPass789!@#';
    (or equivalent for your DB type)

Step 3: testSecret
    Lambda tests that the NEW credentials actually work:
    Try to connect to the database with "NewPass789!@#"
    If connection fails: rotation aborts, AWSCURRENT remains valid, error logged

Step 4: finishSecret
    Lambda promotes AWSPENDING to AWSCURRENT
    Old AWSCURRENT becomes AWSPREVIOUS (kept for a brief overlap period)
    
Final state:
    AWSCURRENT: "NewPass789!@#"  (applications switch to this)
    AWSPREVIOUS: "OldPass123"    (kept briefly in case a connection was mid-flight)
```

### Zero-Downtime Rotation

The `AWSPREVIOUS` version is kept for a short window after rotation. This means:
- Applications already connected to the DB with the old password can finish their work
- Applications that call `GetSecretValue` during rotation (between step 2 and step 4) get the correct version
- Your application should always call `GetSecretValue` and handle the response rather than caching the password indefinitely

### Configuring Rotation

```bash
# Enable rotation for an RDS secret (using AWS-managed rotation Lambda)
aws secretsmanager rotate-secret \
    --secret-id prod/myapp/database \
    --rotation-rules AutomaticallyAfterDays=30

# Manually trigger a rotation immediately
aws secretsmanager rotate-secret \
    --secret-id prod/myapp/database
```

In the Console:
1. Open the secret
2. "Rotation configuration" → "Edit rotation"
3. Enable rotation, set interval (e.g., 30 days)
4. Choose "Use a Lambda function that AWS provides" (for RDS/Aurora/Redshift)
5. AWS creates and configures the Lambda function automatically

### Custom Rotation Lambda

For APIs or non-native databases, write a Lambda rotation function:

```python
import boto3
import json
import string
import secrets

def lambda_handler(event, context):
    """Custom rotation Lambda handler."""
    
    arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']
    
    client = boto3.client('secretsmanager')
    
    if step == 'createSecret':
        create_secret(client, arn, token)
    elif step == 'setSecret':
        set_secret(client, arn, token)
    elif step == 'testSecret':
        test_secret(client, arn, token)
    elif step == 'finishSecret':
        finish_secret(client, arn, token)

def create_secret(client, arn, token):
    # Generate new password
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
    new_password = ''.join(secrets.choice(alphabet) for _ in range(32))
    
    # Get current secret to preserve other fields
    current = json.loads(
        client.get_secret_value(SecretId=arn, VersionStage='AWSCURRENT')['SecretString']
    )
    
    # Update with new password
    current['password'] = new_password
    
    # Store as AWSPENDING
    client.put_secret_value(
        SecretId=arn,
        ClientRequestToken=token,
        SecretString=json.dumps(current),
        VersionStages=['AWSPENDING']
    )
```

---

## Accessing Secrets from Lambda

### Method 1: Retrieve at Invocation (Simple, Slightly Slow)

```python
import boto3
import json
import os

def get_secret(secret_name: str) -> dict:
    """Retrieve a secret from Secrets Manager."""
    client = boto3.client(
        'secretsmanager',
        region_name=os.environ.get('AWS_REGION', 'ap-southeast-2')
    )
    
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

def lambda_handler(event, context):
    # Retrieve credentials each invocation (no caching)
    db_creds = get_secret('prod/myapp/database')
    
    connection = connect_to_db(
        host=db_creds['host'],
        user=db_creds['username'],
        password=db_creds['password'],
        database=db_creds['dbname']
    )
    # ... use connection
```

### Method 2: Cache with Expiry (Recommended for Production)

Calling Secrets Manager on every Lambda invocation adds ~10-50ms latency and costs $0.05 per 10,000 API calls. Cache the secret in memory with a TTL:

```python
import boto3
import json
import os
import time

# Module-level cache (persists across warm invocations)
_secret_cache = {}
CACHE_TTL_SECONDS = 300  # Cache for 5 minutes

def get_secret(secret_name: str) -> dict:
    """Retrieve a secret with in-memory caching."""
    now = time.time()
    
    if secret_name in _secret_cache:
        value, cached_at = _secret_cache[secret_name]
        if now - cached_at < CACHE_TTL_SECONDS:
            return value  # Return cached value
    
    # Cache miss or expired — fetch from Secrets Manager
    client = boto3.client('secretsmanager', region_name=os.environ['AWS_REGION'])
    response = client.get_secret_value(SecretId=secret_name)
    value = json.loads(response['SecretString'])
    
    _secret_cache[secret_name] = (value, now)
    return value
```

### Method 3: AWS Secrets Manager Agent (Sidecar)

AWS provides a Secrets Manager Agent for container-based deployments. It runs as a local HTTP server that caches secrets and handles refresh:

```bash
# Start the agent as a sidecar process
./aws-secrets-manager-agent --log-level INFO

# Application fetches secrets via localhost
curl http://localhost:2773/secretsmanager/get?secretId=prod/myapp/database \
    -H "X-Aws-Parameters-Secrets-Token: $(cat /proc/$(pgrep agent)/environ | tr '\0' '\n' | grep TOKEN)"
```

### Required IAM Permissions for Lambda

The Lambda execution role needs:
```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue",
    "secretsmanager:DescribeSecret"
  ],
  "Resource": "arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:prod/myapp/*"
}
```

If using a custom KMS key, also add:
```json
{
  "Effect": "Allow",
  "Action": "kms:Decrypt",
  "Resource": "arn:aws:kms:ap-southeast-2:123456789012:key/your-key-id"
}
```

---

## Accessing Secrets from EC2

The same pattern applies for EC2 with boto3 (Python):

```python
import boto3
import json

def get_database_credentials():
    """Fetch DB credentials from Secrets Manager on EC2."""
    
    # boto3 automatically uses the EC2 instance role credentials
    # No need to specify access keys
    client = boto3.client('secretsmanager', region_name='ap-southeast-2')
    
    response = client.get_secret_value(SecretId='prod/myapp/database')
    creds = json.loads(response['SecretString'])
    
    return creds

creds = get_database_credentials()
print(f"Connecting to {creds['host']} as {creds['username']}")
```

From the EC2 CLI:
```bash
# Get secret value on an EC2 instance using the instance role
aws secretsmanager get-secret-value \
    --secret-id prod/myapp/database \
    --query SecretString \
    --output text | python3 -m json.tool
```

### Best Practice for EC2: Don't Fetch on Every Request

For web applications on EC2:
- Fetch the secret at application startup (not per-request)
- Refresh every 5-10 minutes in a background thread
- Handle rotation gracefully: if a DB connection fails with auth error, refresh the secret and retry once

```python
import threading
import time

class SecretManager:
    def __init__(self, secret_name, refresh_interval=300):
        self.secret_name = secret_name
        self.refresh_interval = refresh_interval
        self._secret = None
        self._lock = threading.Lock()
        self._fetch_secret()
        
        # Start background refresh thread
        t = threading.Thread(target=self._refresh_loop, daemon=True)
        t.start()
    
    def _fetch_secret(self):
        import boto3, json
        client = boto3.client('secretsmanager')
        response = client.get_secret_value(SecretId=self.secret_name)
        with self._lock:
            self._secret = json.loads(response['SecretString'])
    
    def _refresh_loop(self):
        while True:
            time.sleep(self.refresh_interval)
            self._fetch_secret()
    
    def get(self):
        with self._lock:
            return self._secret.copy()

# Application startup
db_secret = SecretManager('prod/myapp/database')

# In your request handlers
creds = db_secret.get()
```

---

## Secrets Manager and KMS

Every secret in Secrets Manager is encrypted at rest using KMS. When you store or retrieve a secret, Secrets Manager calls KMS to encrypt/decrypt the secret value.

### Default Encryption

By default, secrets are encrypted with the AWS managed key `aws/secretsmanager`. This key is per-account and per-Region, managed by AWS.

### Custom KMS Key

For greater control (audit at the key level, cross-account access, key deletion prevention):

```bash
aws secretsmanager create-secret \
    --name prod/myapp/database \
    --kms-key-id alias/my-secrets-key \
    --secret-string '{"password":"secret123"}'
```

### Required KMS Permissions

If using a custom CMK, the Secrets Manager service needs permission to use the key, AND the principal reading the secret needs `kms:Decrypt`:

Key policy must include Secrets Manager as a principal, or the account root (so IAM can delegate):
```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::123456789012:root"
  },
  "Action": ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey*"],
  "Resource": "*"
}
```

---

## Cost Comparison with Parameter Store

### Secrets Manager Pricing

| Item | Cost |
|------|------|
| Secret storage | $0.40 per secret per month |
| API calls | $0.05 per 10,000 API calls |
| Replicated secrets | $0.40 per replica per month |

**Example: 10 secrets, 1 million API calls/month**
```
Storage: 10 × $0.40 = $4.00
API calls: 1,000,000 / 10,000 × $0.05 = $5.00
Total: $9.00/month
```

### Parameter Store Pricing

| Tier | Cost |
|------|------|
| Standard (plain text, < 4KB) | FREE |
| Standard SecureString (KMS encrypted, < 4KB) | FREE for parameter, KMS API costs apply |
| Advanced (up to 8KB, parameter policies) | $0.05 per advanced parameter per month |
| Higher throughput | $0.05 per 10,000 API interactions (above free tier) |

**Example: 10 SecureString parameters, 1 million API calls/month**
```
Standard SecureString: $0 for parameters
KMS API costs: ~$3.00 (KMS decrypt per call)
Total: ~$3.00/month
```

### Real Decision Factors

The $0.40/secret/month cost of Secrets Manager is low in absolute terms but can add up:
- 100 secrets = $40/month storage alone
- High-read scenarios: if your Lambda calls GetSecretValue 10 million times/month, that's $50 just in API calls

For most applications with 10-50 secrets and reasonable API call volumes, Secrets Manager's extra cost is justified by the built-in rotation capability alone. For applications with hundreds of secrets or very high API call volumes, consider Parameter Store with a custom rotation Lambda.

---

## Best Practices

1. **Never hardcode secrets in code**: Move all passwords, API keys, and tokens to Secrets Manager
2. **Enable rotation**: Rotate database credentials at least every 90 days
3. **Use specific resource ARNs in IAM policies**: `arn:aws:secretsmanager:region:account:secret:prod/myapp/*` not `*`
4. **Cache secrets with TTL**: Don't call GetSecretValue on every request; cache for 5 minutes
5. **Handle rotation gracefully**: If auth fails, refresh the secret and retry once
6. **Use path naming conventions**: `environment/app/secret-type` for organized, policy-friendly names
7. **Use your own CMK for KMS**: For sensitive secrets, use a CMK you control so you get key-level audit and control
8. **Enable resource policies for cross-account**: When sharing secrets across accounts, use secret resource policies
9. **Replicate for multi-region**: For multi-region apps, replicate secrets to secondary Regions
10. **Monitor with CloudTrail**: Alert on `GetSecretValue` calls from unexpected principals or Regions

---

## Interview Q&A

### Q1: What is AWS Secrets Manager and what problem does it solve?

**Answer:** AWS Secrets Manager is a managed service for securely storing, retrieving, and rotating secrets such as database passwords, API keys, and OAuth tokens. It solves the problem of hardcoded credentials — developers often embed passwords directly in code or config files, which end up in git repositories and application servers. Secrets Manager centralizes these credentials in an encrypted, auditable store with access control, and can automatically rotate them on a schedule.

### Q2: What is the key difference between Secrets Manager and Parameter Store?

**Answer:** The most important difference is **automatic rotation** — Secrets Manager has native built-in rotation for database credentials (RDS, Aurora, Redshift, DocumentDB) and supports custom rotation via Lambda. Parameter Store does not have built-in rotation. Other differences: Secrets Manager always encrypts (using KMS), costs $0.40/secret/month, supports larger values (65KB) and cross-region replication. Parameter Store Standard is free, supports hierarchical paths, handles 4KB values, and is better for non-sensitive config. Use Secrets Manager for credentials needing rotation; use Parameter Store for config values and cost-sensitive high-volume secret reads.

### Q3: How does automatic secret rotation work?

**Answer:** Rotation uses a Lambda function with four steps: (1) `createSecret` — generate a new credential and store it as AWSPENDING version; (2) `setSecret` — set the new credential in the actual system (e.g., execute ALTER USER on RDS); (3) `testSecret` — verify the new credential works by connecting to the system; (4) `finishSecret` — promote AWSPENDING to AWSCURRENT, old AWSCURRENT becomes AWSPREVIOUS. The AWSPREVIOUS version is retained briefly for in-flight connections. For RDS/Aurora, AWS provides pre-built rotation Lambda functions; for other systems, you write a custom Lambda.

### Q4: How should a Lambda function access a secret from Secrets Manager?

**Answer:** The Lambda execution role must have `secretsmanager:GetSecretValue` permission on the specific secret ARN (and `kms:Decrypt` if using a custom CMK). In code, use the boto3 client: `boto3.client('secretsmanager').get_secret_value(SecretId='prod/myapp/database')`. For production, cache the secret in a module-level variable with a TTL (e.g., 5 minutes) to avoid calling Secrets Manager on every invocation. Never hardcode secrets in environment variables — use Secrets Manager directly. AWS also offers a Secrets Manager Lambda extension that provides local caching via a localhost HTTP endpoint.

### Q5: What are the AWSCURRENT, AWSPENDING, and AWSPREVIOUS version stages?

**Answer:** Secrets Manager uses version stages to manage multiple versions of a secret during rotation:
- **AWSCURRENT**: The current, active version that applications should use
- **AWSPENDING**: A new version being prepared during rotation (not yet active)
- **AWSPREVIOUS**: The previous version after a successful rotation (kept briefly for in-flight connections)

When `GetSecretValue` is called without specifying a stage, AWSCURRENT is returned. This is the version your application always wants.

### Q6: How is a secret encrypted in Secrets Manager?

**Answer:** Every secret is encrypted at rest using KMS. By default, the AWS managed key `aws/secretsmanager` is used (one per account per Region). You can specify your own CMK for greater control. When you store a secret, Secrets Manager calls `kms:GenerateDataKey` to get a DEK, encrypts the secret with the DEK, stores the encrypted secret and encrypted DEK. When you retrieve a secret, Secrets Manager calls `kms:Decrypt` to recover the DEK, then decrypts the secret. The caller therefore needs both `secretsmanager:GetSecretValue` AND `kms:Decrypt` permissions.

### Q7: How do you share a secret across AWS accounts?

**Answer:** Use a resource policy on the secret that allows the external account's role or user to call `secretsmanager:GetSecretValue`. The KMS key policy must also allow the external principal to call `kms:Decrypt`. The receiving account's IAM policy must also allow the Secrets Manager call. Three components must align for cross-account secret access: the secret's resource policy, the KMS key policy, and the requesting principal's IAM policy.

### Q8: When would you choose Parameter Store over Secrets Manager?

**Answer:** Choose Parameter Store when: (1) cost is a concern — Parameter Store Standard is free (important for high-volume or many parameters); (2) you don't need automatic rotation; (3) you need hierarchical naming (path-style `/app/prod/db-url`); (4) you're storing non-sensitive configuration values (URLs, feature flags, environment-specific config); (5) you have very high API call volume where Secrets Manager's per-call cost would be prohibitive. Parameter Store is also suitable for secrets that don't require rotation when you want to avoid the $0.40/month per secret cost.

### Q9: What happens if your application caches a secret and the secret is rotated?

**Answer:** If your application caches the old password and Secrets Manager rotates it, the cached password becomes invalid. This is why: (1) you should set a reasonable TTL on your cache (5-10 minutes) so the cache refreshes shortly after rotation; (2) your application should handle authentication errors by refreshing the secret from Secrets Manager and retrying once; (3) the AWSPREVIOUS stage keeps the old password valid briefly after rotation for exactly this scenario — in-flight connections with the old password can complete. The rotation step `testSecret` also validates the new secret works before making it AWSCURRENT.

### Q10: How would you audit who accessed a secret and when?

**Answer:** Every `GetSecretValue`, `CreateSecret`, `DeleteSecret`, and other Secrets Manager API call is automatically logged to AWS CloudTrail. To audit: (1) enable CloudTrail (if not already); (2) query CloudTrail logs for `GetSecretValue` events filtered by secret ARN — you will see the identity, IP address, timestamp, and region for every access; (3) set up CloudWatch Logs Insights queries or Athena queries against the CloudTrail S3 bucket for reporting; (4) use Amazon GuardDuty to detect anomalous secret access patterns (e.g., access from unusual IPs or unexpected accounts).
