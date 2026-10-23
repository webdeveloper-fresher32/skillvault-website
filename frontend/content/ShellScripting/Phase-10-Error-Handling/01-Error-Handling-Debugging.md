# Error Handling & Debugging

## The Safety Header

```bash
#!/bin/bash
set -euo pipefail
```

| Flag | Meaning |
|------|---------|
| `-e` | Exit immediately if any command returns non-zero |
| `-u` | Treat unset variables as errors |
| `-o pipefail` | Fail if any command in a pipeline fails (not just the last) |

Without this, scripts continue silently after failures — dangerous in production.

---

## Exit Codes

```bash
# Always exit with a meaningful code
exit 0    # success
exit 1    # general failure
exit 2    # usage error

# Check the last exit code
if ! aws s3 cp file.txt s3://bucket/; then
    echo "ERROR: Upload failed (exit $?)" >&2
    exit 1
fi
```

Send error messages to stderr (`>&2`) so they're separate from normal output.

---

## trap — Cleanup on Exit

```bash
TMPFILE=$(mktemp)
LOCK_FILE="/tmp/my-script.lock"

cleanup() {
    rm -f "$TMPFILE" "$LOCK_FILE"
    echo "Cleanup complete"
}
trap cleanup EXIT        # runs on any exit (normal or error)
trap cleanup INT TERM    # also on Ctrl+C or kill

# Prevent concurrent runs
if [[ -f "$LOCK_FILE" ]]; then
    echo "Script already running (PID: $(cat $LOCK_FILE))"
    exit 1
fi
echo $$ > "$LOCK_FILE"
```

---

## Structured Error Messages

```bash
# Consistent logging functions
log()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }
die()   { error "$*"; exit 1; }

# Usage
log "Starting deployment to $ENV"
aws s3 cp archive.tar.gz s3://backups/ || die "Backup upload failed"
log "Deployment complete"
```

---

## Allowing Specific Commands to Fail

When `set -e` is active but you expect a command may return non-zero:

```bash
# Option 1: || true
aws cloudformation delete-stack --stack-name my-stack || true

# Option 2: capture exit code manually
set +e
aws s3 ls s3://maybe-exists
RESULT=$?
set -e

if [[ $RESULT -eq 0 ]]; then
    echo "Bucket exists"
elif [[ $RESULT -eq 255 ]]; then
    echo "Access denied"
fi
```

---

## Debugging

```bash
# Trace every command as it runs
bash -x script.sh
# or add to script:
set -x    # enable tracing
set +x    # disable tracing

# Print trace only for a section
set -x
aws ec2 describe-instances
set +x

# Dry-run pattern
DRY_RUN="${DRY_RUN:-false}"

run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY RUN] $*"
    else
        "$@"
    fi
}

run aws s3 sync ./dist s3://my-bucket/
```

Run with dry-run:
```bash
DRY_RUN=true ./deploy.sh -e prod -r us-east-1
```

---

## Common Failure Patterns

```bash
# Fail if required env var not set
: "${AWS_REGION:?AWS_REGION must be set}"
: "${S3_BUCKET:?S3_BUCKET must be set}"

# Fail if command not found
command -v jq &>/dev/null || die "jq is required but not installed"
command -v aws &>/dev/null || die "AWS CLI is required but not installed"
```

The `${VAR:?message}` pattern exits with the message if `VAR` is unset or empty — shorter than a full `if` block.
