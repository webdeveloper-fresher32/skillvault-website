# Functions

## Defining and Calling

```bash
# Two valid syntaxes — prefer the second (more portable)
function greet() {
    echo "Hello, $1"
}

greet() {
    echo "Hello, $1"
}

greet "Alice"    # Hello, Alice
```

Functions must be defined **before** they are called.

---

## Arguments

Inside a function, `$1 $2 $@` refer to the function's arguments — not the script's:

```bash
deploy() {
    local env="$1"
    local region="$2"
    echo "Deploying to $env in $region"
}

deploy "production" "us-east-1"
```

---

## Local Variables

Always use `local` for variables inside functions to avoid polluting global scope:

```bash
process_bucket() {
    local bucket="$1"        # local — won't affect outer scope
    local size
    size=$(aws s3 ls s3://"$bucket" --recursive --summarize | grep "Total Size")
    echo "$size"
}
```

---

## Return Values

Bash functions can only `return` an integer (exit code 0–255). To return a string, echo it and capture:

```bash
get_region() {
    aws configure get region
}

REGION=$(get_region)
echo "Region: $REGION"
```

```bash
# Return status (true/false pattern)
bucket_exists() {
    aws s3 ls "s3://$1" &>/dev/null
    return $?    # 0 if exists, non-zero if not
}

if bucket_exists "my-bucket"; then
    echo "Found it"
fi
```

---

## Reusable Function Library

Create a `lib.sh` you source in other scripts:

```bash
# lib.sh
log_info()  { echo "[INFO]  $(date '+%H:%M:%S') $*"; }
log_error() { echo "[ERROR] $(date '+%H:%M:%S') $*" >&2; }

check_aws_cli() {
    if ! command -v aws &>/dev/null; then
        log_error "AWS CLI not installed"
        exit 1
    fi
}

require_arg() {
    if [[ -z "$1" ]]; then
        log_error "Required argument missing: $2"
        exit 1
    fi
}
```

```bash
# deploy.sh
source ./lib.sh    # or: . ./lib.sh

check_aws_cli
require_arg "$1" "environment"
log_info "Starting deployment..."
```

---

## Practical AWS Function Set

```bash
get_instance_state() {
    local id="$1"
    aws ec2 describe-instances \
        --instance-ids "$id" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text 2>/dev/null
}

wait_for_state() {
    local id="$1"
    local target="$2"
    local timeout="${3:-120}"
    local elapsed=0

    while [[ "$(get_instance_state "$id")" != "$target" ]]; do
        sleep 5; (( elapsed += 5 ))
        [[ $elapsed -ge $timeout ]] && return 1
    done
    return 0
}

start_instance() {
    local id="$1"
    aws ec2 start-instances --instance-ids "$id" > /dev/null
    wait_for_state "$id" "running" && echo "Started: $id"
}
```
