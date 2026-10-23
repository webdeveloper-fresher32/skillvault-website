# AWS CLI Scripting

## AWS CLI Output Formats

```bash
aws ec2 describe-instances --output json     # default — machine-readable
aws ec2 describe-instances --output text     # tab-separated, easy for awk/grep
aws ec2 describe-instances --output table    # human-readable table
aws ec2 describe-instances --output yaml     # YAML
```

For scripts: use `--output json` with `jq`, or `--output text` with `awk`.

---

## --query — Filter Without jq

AWS CLI has built-in JMESPath filtering:

```bash
# Get all instance IDs
aws ec2 describe-instances \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text

# Get running instance IDs
aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text

# Get instance ID + state + type
aws ec2 describe-instances \
    --query 'Reservations[].Instances[].[InstanceId,State.Name,InstanceType]' \
    --output text

# Get a specific tag value
aws ec2 describe-instances \
    --instance-ids i-0abc123 \
    --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' \
    --output text
```

---

## jq — Parse JSON Output

```bash
# Install
sudo apt install jq        # Ubuntu
brew install jq            # macOS

# Basic usage
aws ec2 describe-instances | jq '.Reservations[].Instances[].InstanceId'

# Get multiple fields as CSV
aws ec2 describe-instances | jq -r \
    '.Reservations[].Instances[] | [.InstanceId, .State.Name, .InstanceType] | @csv'

# Filter to running only
aws ec2 describe-instances | jq -r \
    '.Reservations[].Instances[] | select(.State.Name == "running") | .InstanceId'

# Get a specific tag value
aws ec2 describe-instances --instance-ids i-0abc123 | jq -r \
    '.Reservations[0].Instances[0].Tags[] | select(.Key=="Name") | .Value'

# Count items
aws s3api list-buckets | jq '.Buckets | length'
```

---

## EC2 Automation Patterns

```bash
#!/bin/bash
set -euo pipefail

# List all instances with Name tag and state
list_instances() {
    aws ec2 describe-instances \
        --query 'Reservations[].Instances[].[InstanceId, State.Name, InstanceType, Tags[?Key==`Name`].Value|[0]]' \
        --output text | column -t
}

# Stop instances by tag
stop_by_tag() {
    local key="$1" value="$2"
    local ids
    ids=$(aws ec2 describe-instances \
        --filters "Name=tag:$key,Values=$value" "Name=instance-state-name,Values=running" \
        --query 'Reservations[].Instances[].InstanceId' \
        --output text)

    [[ -z "$ids" ]] && echo "No running instances with $key=$value" && return

    echo "Stopping: $ids"
    aws ec2 stop-instances --instance-ids $ids
}

stop_by_tag "Environment" "dev"
```

---

## S3 Automation Patterns

```bash
#!/bin/bash
set -euo pipefail

BUCKET="my-app-backups"
DATE=$(date +%Y-%m-%d)
BACKUP_KEY="backups/$DATE/archive.tar.gz"

# Backup with timestamp
backup() {
    local source_dir="$1"
    local tmpfile
    tmpfile=$(mktemp --suffix=.tar.gz)
    trap 'rm -f "$tmpfile"' EXIT

    tar -czf "$tmpfile" -C "$(dirname "$source_dir")" "$(basename "$source_dir")"
    aws s3 cp "$tmpfile" "s3://$BUCKET/$BACKUP_KEY"
    echo "Backed up to s3://$BUCKET/$BACKUP_KEY"
}

# Delete backups older than N days
cleanup_old_backups() {
    local days="$1"
    local cutoff
    cutoff=$(date -d "$days days ago" +%Y-%m-%d)

    aws s3 ls "s3://$BUCKET/backups/" | while read -r _ _ _ key; do
        backup_date=$(echo "$key" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
        if [[ "$backup_date" < "$cutoff" ]]; then
            echo "Deleting old backup: $key"
            aws s3 rm "s3://$BUCKET/backups/$key"
        fi
    done
}

backup /var/app/data
cleanup_old_backups 30
```

---

## IAM / Security Scripts

```bash
#!/bin/bash
# Audit: list all IAM users and their last login

echo "Username,LastLogin,AccessKeyAge"

aws iam list-users --query 'Users[].[UserName,PasswordLastUsed]' \
    --output text | while IFS=$'\t' read -r username last_login; do
    key_age=$(aws iam list-access-keys --user-name "$username" \
        --query 'AccessKeyMetadata[0].CreateDate' --output text 2>/dev/null || echo "N/A")
    echo "$username,$last_login,$key_age"
done
```

---

## CloudFormation Deployment Script

```bash
#!/bin/bash
set -euo pipefail

STACK_NAME="$1"
TEMPLATE="$2"
ENV="${3:-dev}"
REGION="${AWS_REGION:-us-east-1}"

# Check if stack exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" &>/dev/null; then
    ACTION="update-stack"
    echo "Updating existing stack: $STACK_NAME"
else
    ACTION="create-stack"
    echo "Creating new stack: $STACK_NAME"
fi

aws cloudformation $ACTION \
    --stack-name "$STACK_NAME" \
    --template-body "file://$TEMPLATE" \
    --parameters ParameterKey=Environment,ParameterValue="$ENV" \
    --capabilities CAPABILITY_IAM \
    --region "$REGION"

# Wait for completion
echo "Waiting for stack operation to complete..."
aws cloudformation wait stack-${ACTION//-stack/}-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION"

echo "Stack $STACK_NAME operation complete"
```

---

## AWS CLI Configuration in Scripts

```bash
# Use environment variables (best for CI/CD)
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"

# Use named profiles
aws s3 ls --profile production
export AWS_PROFILE=production

# Use IAM roles on EC2 (no credentials needed — recommended)
# Just call aws CLI normally — it reads from instance metadata automatically

# Check which identity is active
aws sts get-caller-identity
```
