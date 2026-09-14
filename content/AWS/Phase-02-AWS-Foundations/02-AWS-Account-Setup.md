# AWS Account Setup

## Table of Contents

1. [Creating an AWS Account](#creating-an-aws-account)
2. [Root User vs IAM User](#root-user-vs-iam-user)
3. [Billing Alerts and Budgets](#billing-alerts-and-budgets)
4. [AWS Free Tier Explained](#aws-free-tier-explained)
5. [AWS Console Overview](#aws-console-overview)
6. [AWS CLI](#aws-cli)
7. [AWS SDK Overview](#aws-sdk-overview)
8. [AWS CloudShell](#aws-cloudshell)
9. [Interview Q&A](#interview-qa)

---

## Creating an AWS Account

### What You Need

- Email address (will become the root user email — use a dedicated email, not your personal one)
- Phone number for verification
- Credit or debit card (required even for Free Tier — AWS charges a small $1 hold that is immediately reversed)
- Government ID is NOT required

### Step-by-Step Account Creation

1. Go to https://aws.amazon.com
2. Click "Create an AWS Account"
3. Enter your email address and choose an account name (e.g., "MyLearningAccount" or your company name)
4. Enter and verify a strong root password (the root user is all-powerful — treat this password like a vault key)
5. Choose account type: **Personal** (for learning) or **Professional** (for business)
6. Enter billing information (credit card)
7. Verify your identity by phone
8. Choose a support plan:
   - **Basic** (Free) — recommended for learning
   - Developer ($29/month)
   - Business ($100+/month)
   - Enterprise ($15,000+/month)
9. AWS activates your account (usually within minutes, sometimes up to 24 hours)

### Immediately After Account Creation

Do these things IN ORDER before doing anything else:

```
Step 1: Lock down the root user
    [ ] Enable MFA on root user
    [ ] Do NOT create access keys for root

Step 2: Set billing alerts
    [ ] Enable billing alerts in Billing preferences
    [ ] Create a $10 budget (or whatever your limit is)
    [ ] Create a CloudWatch alarm for > $5 spend

Step 3: Create an IAM admin user
    [ ] Create IAM user "admin" or your name
    [ ] Attach AdministratorAccess policy
    [ ] Enable MFA on this user too
    [ ] Generate access keys for this user (for CLI)

Step 4: Never use root again
    [ ] Log out of root
    [ ] Log in as IAM admin user going forward
```

---

## Root User vs IAM User

### What is the Root User?

The **root user** is the identity created when you first create an AWS account. It is accessed via the email address used during signup.

The root user has:
- **Unrestricted access to everything** in the account
- Access to billing and payment details
- Ability to close the AWS account
- Ability to change the email address or root password
- Ability to restore access to a locked account

### Root User: The Nuclear Option

```
ROOT USER CAPABILITIES
======================

Root CAN do (that nobody else can):
    - Close the AWS account
    - Change account name, email, root password
    - Activate IAM access to billing console
    - View/edit billing info
    - Restore access if all admin IAM users are accidentally locked out
    - Change AWS Support plan
    - Register as Reserved Instance seller
    - Configure S3 bucket policies that only root can change
    - Enable MFA Delete on S3 buckets

Root SHOULD NOT do (but can):
    - Day-to-day AWS management (EC2, S3, RDS, etc.)
    - Running CLI commands
    - Creating deployments
    - ANYTHING routine
```

### The Golden Rule

> **NEVER use the root user for daily operations. NEVER create access keys for root.**

Why? If root credentials are compromised, the attacker has:
- Complete control over ALL your resources
- Access to your billing details and credit card
- Ability to delete everything and run up charges
- No way for you to regain access because they can change the email/password

### What is an IAM User?

An IAM (Identity and Access Management) user is an identity you create within your AWS account. Unlike the root user, IAM users:
- Have only the permissions you explicitly grant them
- Can be deleted, disabled, or had their permissions revoked at any time
- Can have separate credentials for Console access and programmatic access
- Are auditable (CloudTrail logs everything they do)

### Comparison Table

| Attribute | Root User | IAM User |
|-----------|-----------|----------|
| Created by | AWS (during signup) | You (via IAM) |
| Authentication | Email + Password | Username + Password |
| MFA support | Yes | Yes |
| Access keys | NEVER create these | Can create (for CLI/SDK) |
| Permissions | Unlimited, cannot be restricted | Only what you grant |
| Can be deleted | No (it IS the account) | Yes |
| Recommended for daily use | NO | YES |
| Use cases | Account-level tasks (see above) | Everything else |

### Account Number vs Root Email

Every AWS account has:
- **Account ID**: A 12-digit number (e.g., `123456789012`) used in ARNs and cross-account references
- **Account alias**: An optional human-readable name for the sign-in URL
- **Root email**: The email used to create the account

When logging in, you can choose:
- "Root user": Enter root email
- "IAM user": Enter account ID or alias, then IAM username

---

## Billing Alerts and Budgets

### Why This Matters (True Horror Stories)

AWS charges for what you use. Forgetting to delete resources, accidentally spinning up expensive services, or having credentials stolen and used for crypto mining can result in bills of thousands of dollars. This has happened to many students and developers.

**Set up billing protections BEFORE you create any resources. This is non-negotiable.**

### Step 1: Enable Billing Alerts

1. Log in to the AWS Console as root (just this once)
2. Click your account name (top right) --> "Billing and Cost Management"
3. Click "Billing preferences" in the left sidebar
4. Under "Alert preferences", check:
   - "Receive AWS Free Tier alerts" -- YES
   - "Receive CloudWatch billing alerts" -- YES (required for the next step)
5. Save preferences

### Step 2: Create a CloudWatch Billing Alarm

CloudWatch billing alarms can notify you when your estimated charges exceed a threshold.

1. Go to CloudWatch (search in the top bar)
2. **IMPORTANT**: Switch to **us-east-1** (N. Virginia) — billing metrics are ONLY in this Region
3. Click "Alarms" in the left menu --> "All Alarms"
4. Click "Create alarm"
5. Click "Select metric" --> "Billing" --> "Total Estimated Charge" --> USD
6. Set the threshold:
   - "Greater than... $5" (for learning/Free Tier account)
   - Or whatever your acceptable spend limit is
7. Set the notification:
   - Create a new SNS topic
   - Enter your email address
   - Confirm the subscription in the email you receive
8. Name the alarm: "MonthlyBillingOver5USD"
9. Create the alarm

```bash
# You can also create this via CLI:
aws cloudwatch put-metric-alarm \
    --alarm-name "BillingAlarmOver10USD" \
    --alarm-description "Alert when monthly spend exceeds $10" \
    --metric-name EstimatedCharges \
    --namespace AWS/Billing \
    --statistic Maximum \
    --period 86400 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=Currency,Value=USD \
    --evaluation-periods 1 \
    --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:billing-alert \
    --treat-missing-data notBreaching \
    --region us-east-1
```

### Step 3: Create an AWS Budget

AWS Budgets is more powerful than CloudWatch alarms — it can alert you at % of budget used.

1. Go to "Billing and Cost Management" --> "Budgets"
2. Click "Create budget"
3. Choose "Use a template" --> "Zero spend budget" (alerts when any charge occurs over Free Tier)
   OR choose "Monthly cost budget" for custom amounts
4. For a custom budget:
   - Budget name: "MonthlyLearningBudget"
   - Budget amount: $10 (or your limit)
   - Alert at 80% ($8) and 100% ($10)
   - Enter notification email
5. Create budget

### Step 4: Enable Cost Explorer

Cost Explorer shows a breakdown of your spend by service, Region, time period.

1. Billing and Cost Management --> "Cost Explorer"
2. Click "Enable Cost Explorer" (first time only; takes 24 hours to populate)
3. Once active, you can see:
   - Which services cost you money
   - Month-over-month trends
   - Forecast for the rest of the month

### Common Expensive Surprises for New Users

| Resource | Easy-to-forget scenario | Typical cost |
|----------|------------------------|--------------|
| NAT Gateway | Left running in a VPC | $0.045/hr = $32/month + data transfer |
| RDS instance | db.t3.micro left running | ~$13/month |
| EC2 instance | t2.micro left running (post Free Tier) | ~$8-17/month |
| Elastic IP | Unattached to a running instance | $0.005/hr = $3.60/month |
| Data transfer | Large S3 downloads | $0.09/GB |
| CloudWatch Logs | High-volume logs not set to expire | Variable |

**Best practice**: Tag every resource with a "Project" tag. Use Cost Explorer filtered by tag to see what each learning project costs.

---

## AWS Free Tier Explained

### Three Types of Free Tier

AWS Free Tier is NOT a single thing — it has three distinct categories:

#### 1. Always Free

These services are free FOREVER, with no time limit, even after the 12-month period:

| Service | Free Allowance |
|---------|---------------|
| AWS Lambda | 1 million invocations/month, 400,000 GB-seconds |
| DynamoDB | 25 GB storage, 25 read/write capacity units |
| SNS | 1 million mobile push notifications |
| SES | 62,000 outbound email messages/month (from EC2) |
| CloudWatch | 10 custom metrics, 1 million API requests |
| CloudFormation | No charge for the service itself |
| IAM | Always free, no limits |
| VPC | No charge for VPC itself |
| CodePipeline | 1 active pipeline/month |

#### 2. 12 Months Free (from account creation date)

These are free for the first 12 months only. After that, standard rates apply:

| Service | Free Allowance | Notes |
|---------|---------------|-------|
| EC2 | 750 hours/month of t2.micro (or t3.micro in Regions without t2) | Split across all running instances |
| S3 | 5 GB standard storage, 20,000 GET requests, 2,000 PUT requests | |
| RDS | 750 hours/month of db.t2.micro, 20 GB storage, 20 GB backups | Single-AZ only |
| CloudFront | 1 TB data transfer out, 10 million HTTP/HTTPS requests | |
| ELB | 750 hours/month of Classic or Application Load Balancer | |
| ElastiCache | 750 hours of cache.t2.micro | |
| Cognito | 50,000 monthly active users | |

#### 3. Trials

Short-term free trials for specific services:

| Service | Trial Period |
|---------|-------------|
| Amazon Inspector | 90 days |
| Amazon Macie | 30 days |
| Amazon GuardDuty | 30 days |
| AWS Security Hub | 30 days |

### Free Tier Traps to Avoid

```
Trap 1: Running multiple EC2 instances thinking each gets 750 hours
    Reality: 750 hours is the TOTAL for ALL t2.micro instances combined
    1 instance for 31 days = 744 hours = under limit (OK)
    2 instances for 31 days = 1488 hours = 738 hours BILLED

Trap 2: Using t3.micro when you meant t2.micro (or vice versa in some Regions)
    Reality: Only specific instance types qualify for Free Tier
    Always check the instance type during launch

Trap 3: Forgetting to turn off instances before month end
    Reality: Leaving even a t2.micro running uses your 750 hours

Trap 4: Leaving an RDS instance running continuously
    Reality: 750 hours = ~31.25 days, but if you run it all month every month,
    you could go over in months with 31 days if the instance was created mid-month

Trap 5: Elastic IP addresses not attached to running instances
    Reality: AWS charges for Elastic IPs that are allocated but NOT attached to a
    running instance (to discourage hoarding). Always release unused EIPs.

Trap 6: Data transfer costs
    Reality: Free Tier includes some outbound transfer but large downloads are billed
    Inbound data transfer is free; outbound to internet is charged after Free Tier

Trap 7: Using services in a Region that doesn't offer Free Tier for that service
    Reality: Some newer Regions or specialty services don't participate in Free Tier
```

### Monitoring Free Tier Usage

1. Go to Billing and Cost Management --> "Free Tier"
2. See a table of all Free Tier services with:
   - Monthly usage allowed
   - Current month usage
   - % used
   - Forecasted vs limit
3. Set up Free Tier alerts (see Step 1 in billing section above)

---

## AWS Console Overview

### Navigating the Console

```
+------------------------------------------------------------------+
|  AWS [logo]  | Services v | Search...      | Sydney v | Account v|
+------------------------------------------------------------------+
|                                                                  |
|  Recently visited services:                                      |
|  [EC2]  [S3]  [IAM]  [RDS]  [Lambda]                           |
|                                                                  |
|  AWS services (by category):                                     |
|  Compute: EC2 | Lambda | ECS | EKS | Fargate | Lightsail        |
|  Storage: S3 | EBS | EFS | FSx | Storage Gateway               |
|  Database: RDS | DynamoDB | ElastiCache | Redshift              |
|  Networking: VPC | Route 53 | CloudFront | ELB | API Gateway    |
|  Security: IAM | KMS | Secrets Manager | WAF | Shield           |
|  ...                                                             |
+------------------------------------------------------------------+
```

### Key Console Features

- **Search bar (top)**: The fastest way to navigate. Type "EC2", "S3", "IAM" etc.
- **Services menu**: Categorised list of all 200+ services
- **Recently visited**: Quick access to services you use often
- **Pin services**: Click the pin icon to pin services to the top nav bar
- **Region selector (top right)**: Shows and changes your current Region
- **Account menu (top right)**: Access billing, account settings, sign out
- **Console Home**: Customisable dashboard with widgets

### Console Keyboard Shortcut

Press `Alt + S` (Windows/Linux) or `Option + S` (Mac) to focus the search bar from anywhere in the console.

---

## AWS CLI

### What is the AWS CLI?

The AWS Command Line Interface (CLI) is a unified tool to manage AWS services from the command line. Instead of clicking through the console, you run commands like:

```bash
aws s3 ls                          # list S3 buckets
aws ec2 describe-instances         # list EC2 instances
aws iam list-users                 # list IAM users
```

Benefits over the Console:
- **Automation**: Script repetitive tasks
- **Reproducibility**: Share exact commands for others to run
- **Speed**: Faster than navigating the console for many operations
- **CI/CD integration**: Pipelines use the CLI for deployments
- **Bulk operations**: Process hundreds of resources with a loop

### CLI Versions

- **AWS CLI v1**: Legacy, written in Python, still works but not receiving new features
- **AWS CLI v2**: Current version, written in Rust+Python, better performance, install this one

### Installation

#### macOS

```bash
# Method 1: Direct download (recommended)
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Method 2: Homebrew
brew install awscli

# Verify installation
aws --version
# Expected output: aws-cli/2.x.x Python/3.x.x Darwin/...
```

#### Linux (Ubuntu/Debian)

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify
aws --version
```

#### Windows

```powershell
# Download the MSI installer from:
# https://awscli.amazonaws.com/AWSCLIV2.msi

# Or using winget:
winget install Amazon.AWSCLI

# Verify
aws --version
```

### Configuration: aws configure

The `aws configure` command sets up your credentials and default settings.

```bash
aws configure
```

You will be prompted for:

```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: ap-southeast-2
Default output format [None]: json
```

**What these values mean:**

| Setting | Purpose | Where to get it |
|---------|---------|-----------------|
| Access Key ID | Identifies WHICH IAM user/role | IAM Console --> Users --> Security Credentials |
| Secret Access Key | Proves you ARE that user (like a password) | Shown ONCE at creation — store it securely |
| Default region | Which Region CLI commands run against | Choose your primary Region |
| Output format | How CLI output is formatted | `json` (default), `yaml`, `text`, `table` |

**Where credentials are stored:**

```
~/.aws/credentials
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

~/.aws/config
[default]
region = ap-southeast-2
output = json
```

### Named Profiles

Use named profiles to manage multiple AWS accounts or users:

```bash
# Configure a named profile (for a second account/user)
aws configure --profile work
aws configure --profile personal
aws configure --profile dev

# Use a specific profile for a command
aws s3 ls --profile work
aws ec2 describe-instances --profile dev

# Set a profile as the default for a session
export AWS_PROFILE=work
aws s3 ls   # now uses 'work' profile

# View all configured profiles
aws configure list-profiles

# View configuration for a specific profile
aws configure list --profile work
```

### Common CLI Patterns

```bash
# Test your credentials
aws sts get-caller-identity
# Returns: Account ID, User ARN, User ID

# List all S3 buckets
aws s3 ls

# List objects in a specific bucket
aws s3 ls s3://my-bucket-name/

# Copy a file to S3
aws s3 cp myfile.txt s3://my-bucket-name/

# Sync a directory to S3
aws s3 sync ./local-dir s3://my-bucket-name/

# Launch an EC2 instance
aws ec2 run-instances \
    --image-id ami-0abcdef1234567890 \
    --instance-type t2.micro \
    --key-name MyKeyPair

# Describe running instances in a table format
aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query "Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]" \
    --output table

# Use --dry-run to test permissions without executing
aws ec2 run-instances \
    --image-id ami-0abcdef1234567890 \
    --instance-type t2.micro \
    --dry-run
```

### CLI Pagination

Some CLI commands return many results. Use pagination controls:

```bash
# Set maximum results per page
aws ec2 describe-instances --max-items 10

# Use --no-paginate to get ALL results (can be slow for large accounts)
aws ec2 describe-instances --no-paginate

# Or let the CLI auto-paginate (default behavior for most commands)
aws s3api list-objects --bucket my-bucket
```

### CLI Output Formats

```bash
# JSON (default) — machine readable
aws ec2 describe-instances --output json

# Table — human readable in terminal
aws ec2 describe-instances --output table

# Text — space-separated, useful for shell scripting
aws ec2 describe-instances --output text

# YAML — readable, good for configs
aws ec2 describe-instances --output yaml
```

### JMESPath Query Filtering

The `--query` flag uses JMESPath syntax to filter and transform CLI output:

```bash
# Get only instance IDs
aws ec2 describe-instances \
    --query "Reservations[*].Instances[*].InstanceId"

# Get instance ID and public IP
aws ec2 describe-instances \
    --query "Reservations[*].Instances[*].[InstanceId, PublicIpAddress]" \
    --output table

# Get specific profile info from IAM
aws iam list-users \
    --query "Users[*].UserName" \
    --output text
```

---

## AWS SDK Overview

The AWS SDK (Software Development Kit) lets you interact with AWS services from your application code — the same operations you do via the Console or CLI, but programmatically.

### Available SDKs

| Language | Package Name | Install Command |
|----------|-------------|-----------------|
| Python | boto3 | `pip install boto3` |
| JavaScript/TypeScript | @aws-sdk/client-* | `npm install @aws-sdk/client-s3` |
| Java | aws-java-sdk | Maven/Gradle dependency |
| .NET (C#) | AWSSDK | `dotnet add package AWSSDK.S3` |
| Go | aws-sdk-go-v2 | `go get github.com/aws/aws-sdk-go-v2` |
| Ruby | aws-sdk-ruby | `gem install aws-sdk` |
| PHP | aws/aws-sdk-php | Composer |
| C++ | aws-sdk-cpp | CMake |
| Rust | aws-sdk-rust | Cargo |

### Python SDK Example (boto3)

```python
import boto3

# Create an S3 client (uses credentials from ~/.aws/credentials or environment variables)
s3 = boto3.client('s3', region_name='ap-southeast-2')

# List all buckets
response = s3.list_buckets()
for bucket in response['Buckets']:
    print(bucket['Name'])

# Upload a file
s3.upload_file('local_file.txt', 'my-bucket', 'remote_key.txt')

# Download a file
s3.download_file('my-bucket', 'remote_key.txt', 'downloaded_file.txt')

# EC2 example
ec2 = boto3.resource('ec2', region_name='ap-southeast-2')
instances = ec2.instances.filter(
    Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
)
for instance in instances:
    print(instance.id, instance.instance_type)
```

### Credential Resolution Order (SDK and CLI)

When SDK/CLI code runs, it looks for credentials in this order:

```
1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
2. AWS credentials file (~/.aws/credentials)
3. AWS config file (~/.aws/config)
4. AWS SSO (if configured)
5. Container credential provider (ECS task role)
6. EC2 Instance Metadata Service (IMDS) - the instance's IAM role
```

For code running on EC2, Lambda, or ECS, you should NEVER hardcode credentials. Instead, attach an IAM role to the compute resource — the SDK will automatically retrieve temporary credentials from the metadata service.

```python
# BAD: Never do this
s3 = boto3.client(
    's3',
    aws_access_key_id='AKIAIOSFODNN7EXAMPLE',     # NEVER hardcode!
    aws_secret_access_key='wJalrXUtnFEM...'        # NEVER hardcode!
)

# GOOD: Let the SDK figure out credentials from the execution environment
s3 = boto3.client('s3', region_name='ap-southeast-2')
# On EC2 with an IAM role attached, this automatically uses the role credentials
```

---

## AWS CloudShell

### What is CloudShell?

AWS CloudShell is a **browser-based terminal** built directly into the AWS Console. It gives you a pre-configured shell environment with:

- AWS CLI pre-installed (always the latest version)
- Python, Node.js, Git, and other common tools pre-installed
- Automatic credentials: you are already authenticated as your Console IAM user
- 1 GB of persistent storage per Region
- No need to install anything locally

### Accessing CloudShell

1. Log in to the AWS Console
2. Click the CloudShell icon in the top navigation bar (looks like a terminal prompt `>_`)
   OR
3. Search "CloudShell" in the services search bar
   OR
4. Open a service (like EC2), click the CloudShell icon in the top bar

### CloudShell Features

```
Compute:
    - Amazon Linux 2 environment
    - 1 vCPU
    - 2 GB RAM
    - 1 GB persistent home directory per Region

Pre-installed tools:
    - AWS CLI v2
    - Python 3.x with pip
    - Node.js with npm
    - git
    - jq (JSON processor)
    - bash, zsh
    - vim, nano

Limitations:
    - Cannot run servers that listen on ports (no web servers)
    - Session times out after 20 minutes of inactivity
    - No root access inside the shell
    - Not meant for production workloads
```

### Example CloudShell Usage

```bash
# You're already authenticated — test it:
aws sts get-caller-identity

# No aws configure needed! Your Console identity is used automatically.

# Work with S3
aws s3 ls
aws s3 cp myfile.txt s3://my-bucket/

# Files in ~/home persist across sessions (up to 1 GB)
echo "Hello from CloudShell" > ~/myfile.txt
cat ~/myfile.txt  # still there next session
```

### CloudShell vs Local CLI

| Feature | Local CLI | CloudShell |
|---------|-----------|------------|
| Setup required | Yes (install, configure) | No |
| Authentication | Must configure credentials | Automatic (Console identity) |
| Persistence | Full file system | 1 GB home directory per Region |
| Network | Your local internet | Inside AWS network (faster for AWS ops) |
| Use case | Daily development | Quick tasks, learning, ad-hoc operations |

---

## Interview Q&A

### Q1: What is the difference between the root user and an IAM user?

**Answer:** The root user is created automatically when an AWS account is created and has unlimited access to all AWS services and billing functions. It cannot be restricted by IAM policies. An IAM user is an identity you create within the account with explicitly defined permissions. The root user should only be used for a small set of account-level tasks (closing the account, changing the root email, restoring access). All daily operations should use IAM users or roles. The root user's access keys should never be created.

### Q2: What actions can only the root user perform?

**Answer:** Tasks that only the root user can do include:
- Close the AWS account
- Change the account name, root email address, or root password
- Activate IAM user access to the billing console
- View and manage payment methods
- Subscribe/unsubscribe from AWS Support plans
- Configure MFA Delete on S3 buckets
- Restore access when no admin IAM users exist (recovery scenario)
- Manage X.509 signing certificates for the account

### Q3: What are the three types of AWS Free Tier?

**Answer:**
1. **Always Free**: Permanently free for all AWS customers with set monthly limits (Lambda 1M invocations, DynamoDB 25GB)
2. **12 Months Free**: Free from account creation date for 12 months, then standard pricing applies (EC2 t2.micro 750hrs/month, S3 5GB)
3. **Trials**: Short-term trials for specific services (e.g., GuardDuty 30 days, Inspector 90 days)

### Q4: Where are billing metrics stored in CloudWatch and why does this matter?

**Answer:** AWS billing metrics are stored only in the `us-east-1` (N. Virginia) Region. This means that when creating CloudWatch billing alarms, you MUST be in the `us-east-1` Region. If you try to create a billing alarm in `ap-southeast-2` (Sydney), you will not find the billing metric. This is a common mistake for new users.

### Q5: What is the AWS CLI and how do you configure it?

**Answer:** The AWS CLI is a command-line tool for interacting with AWS services programmatically via terminal commands. It is configured with `aws configure`, which prompts for:
- Access Key ID (identifies the IAM user)
- Secret Access Key (authenticates the user — shown only once at creation)
- Default Region (where commands run unless overridden)
- Output format (json/yaml/text/table)

Credentials are stored in `~/.aws/credentials` and configuration in `~/.aws/config`. Named profiles can be added with `aws configure --profile <name>` and used with the `--profile` flag or `AWS_PROFILE` environment variable.

### Q6: You need to use the AWS CLI on an EC2 instance. How should you authenticate?

**Answer:** By attaching an **IAM role** to the EC2 instance. The role grants permissions to the instance itself. When code (CLI or SDK) runs on the instance, it automatically retrieves temporary credentials from the EC2 Instance Metadata Service (IMDS) endpoint at `http://169.254.169.254/latest/meta-data/iam/security-credentials/`. You should NEVER store access keys on an EC2 instance, as they would be at risk if the instance is compromised.

### Q7: What is CloudShell?

**Answer:** AWS CloudShell is a browser-based shell accessible directly from the AWS Management Console. It provides a pre-configured Linux environment with the AWS CLI, Python, Node.js, and other tools installed. You are automatically authenticated as your current Console IAM user — no `aws configure` needed. It provides 1 GB of persistent storage per Region. It is ideal for quick administrative tasks and learning without needing a local CLI setup.

### Q8: What should you do immediately after creating a new AWS account?

**Answer:**
1. Enable MFA on the root user
2. Never create access keys for root
3. Enable billing alerts in Billing Preferences (required before CloudWatch billing alarms work)
4. Create a CloudWatch billing alarm (must do this in us-east-1)
5. Create an AWS Budget with alert thresholds
6. Create an IAM admin user (or admin group + user)
7. Enable MFA on the admin IAM user
8. Log out of root and log in as IAM admin user going forward
9. Enable Cost Explorer

### Q9: What is the difference between `aws s3 cp` and `aws s3 sync`?

**Answer:**
- `aws s3 cp` copies a single file or directory from source to destination (one-way, always copies regardless of whether the destination already has the file)
- `aws s3 sync` compares source and destination, only copying files that are new or have changed. It can also delete files in the destination that no longer exist in the source with the `--delete` flag. `sync` is more efficient for keeping a local directory and S3 bucket in sync.

### Q10: How do you override the default Region for a single AWS CLI command?

**Answer:** Use the `--region` flag:
```bash
aws ec2 describe-instances --region eu-west-1
```
Or set the `AWS_DEFAULT_REGION` environment variable for the duration of a session:
```bash
export AWS_DEFAULT_REGION=eu-west-1
```
The `--region` flag takes highest precedence, then environment variable, then `~/.aws/config`.

### Q11: What is the AWS SDK and how does credential resolution work?

**Answer:** The AWS SDK lets developers interact with AWS services from application code (Python's boto3, JavaScript's @aws-sdk, Java's AWS SDK, etc.). Credential resolution happens in this priority order:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. Shared credentials file (`~/.aws/credentials`)
3. AWS config file (`~/.aws/config`)
4. AWS SSO
5. Container credential provider (for ECS tasks)
6. EC2 Instance Metadata Service (for EC2 instances with IAM roles)

For application code deployed on AWS compute (EC2, Lambda, ECS), you should always use IAM roles — the SDK will automatically pick up credentials from the metadata service.

### Q12: What is the 12-digit AWS Account ID used for?

**Answer:** The 12-digit AWS Account ID uniquely identifies your AWS account globally. It is used in:
- IAM ARNs: `arn:aws:iam::123456789012:user/alice`
- Resource ARNs: `arn:aws:s3:::my-bucket` (S3 is global, no account ID in ARN)
- Cross-account trust policies (who can assume a role in your account)
- Billing and consolidated billing (Organizations)
- The IAM user sign-in URL: `https://123456789012.signin.aws.amazon.com/console`
