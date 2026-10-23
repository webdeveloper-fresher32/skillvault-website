# Project 4: AWS Resource Manager

**Difficulty:** Advanced  
**Skills:** AWS CLI, jq, getopts, functions, error handling, loops

---

## Goal

A multi-command CLI tool to list, start/stop EC2 instances, manage S3 backups, and report costs — all in one script.

---

## Usage

```bash
./aws-manager.sh list-instances [-r region] [-e env-tag]
./aws-manager.sh start-instances -e <env-tag> [-r region]
./aws-manager.sh stop-instances  -e <env-tag> [-r region]
./aws-manager.sh backup-to-s3   -d <directory> -b <bucket>
./aws-manager.sh cost-report    [-d days]
```

---

## Solution

```bash
#!/bin/bash
set -euo pipefail

REGION="${AWS_DEFAULT_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-default}"

log()   { echo "[$(date '+%H:%M:%S')] $*"; }
error() { echo "[ERROR] $*" >&2; }
die()   { error "$*"; exit 1; }

check_deps() {
    command -v aws  &>/dev/null || die "AWS CLI not installed"
    command -v jq   &>/dev/null || die "jq not installed"
    aws sts get-caller-identity &>/dev/null || die "AWS credentials not configured"
}

# ---- EC2 Functions ----

list_instances() {
    local env_filter=""
    while getopts "r:e:" opt; do
        case "$opt" in
            r) REGION="$OPTARG" ;;
            e) env_filter="$OPTARG" ;;
        esac
    done

    local filters='[]'
    [[ -n "$env_filter" ]] && filters="[{\"Name\":\"tag:Environment\",\"Values\":[\"$env_filter\"]}]"

    echo "EC2 Instances in $REGION:"
    printf "%-22s %-12s %-14s %-20s\n" "Instance ID" "State" "Type" "Name"
    printf "%-22s %-12s %-14s %-20s\n" "-----------" "-----" "----" "----"

    aws ec2 describe-instances \
        --region "$REGION" \
        --filters "$(echo "$filters" | jq -c .)" \
        --query 'Reservations[].Instances[].[InstanceId,State.Name,InstanceType,Tags[?Key==`Name`].Value|[0]]' \
        --output text | while IFS=$'\t' read -r id state type name; do
        printf "%-22s %-12s %-14s %-20s\n" "$id" "$state" "$type" "${name:-N/A}"
    done
}

toggle_instances() {
    local action="$1"; shift
    local env_tag=""
    while getopts "e:r:" opt; do
        case "$opt" in
            e) env_tag="$OPTARG" ;;
            r) REGION="$OPTARG" ;;
        esac
    done

    [[ -z "$env_tag" ]] && die "Environment tag required (-e)"

    local target_state; [[ "$action" == "start" ]] && target_state="stopped" || target_state="running"

    local ids
    ids=$(aws ec2 describe-instances \
        --region "$REGION" \
        --filters "Name=tag:Environment,Values=$env_tag" "Name=instance-state-name,Values=$target_state" \
        --query 'Reservations[].Instances[].InstanceId' \
        --output text)

    [[ -z "$ids" ]] && log "No $target_state instances with Environment=$env_tag" && return

    log "${action^}ing instances: $ids"
    aws ec2 ${action}-instances --instance-ids $ids --region "$REGION" > /dev/null
    log "Done. Use 'list-instances' to check status."
}

# ---- S3 Backup ----

backup_to_s3() {
    local dir="" bucket=""
    while getopts "d:b:" opt; do
        case "$opt" in
            d) dir="$OPTARG" ;;
            b) bucket="$OPTARG" ;;
        esac
    done

    [[ -z "$dir" || -z "$bucket" ]] && die "Usage: backup-to-s3 -d <dir> -b <bucket>"
    [[ -d "$dir" ]] || die "Directory not found: $dir"

    local key="backups/$(date +%Y-%m-%d)/$(basename "$dir")-$(date +%H%M%S).tar.gz"
    local tmpfile; tmpfile=$(mktemp --suffix=.tar.gz)
    trap 'rm -f "$tmpfile"' EXIT

    log "Compressing $dir..."
    tar -czf "$tmpfile" -C "$(dirname "$dir")" "$(basename "$dir")"

    log "Uploading to s3://$bucket/$key..."
    aws s3 cp "$tmpfile" "s3://$bucket/$key"
    log "Backup complete: s3://$bucket/$key"
}

# ---- Cost Report ----

cost_report() {
    local days=30
    while getopts "d:" opt; do
        case "$opt" in d) days="$OPTARG" ;; esac
    done

    local start; start=$(date -d "$days days ago" +%Y-%m-%d 2>/dev/null || date -v-${days}d +%Y-%m-%d)
    local end; end=$(date +%Y-%m-%d)

    echo "AWS Cost Report: $start to $end"
    echo ""

    aws ce get-cost-and-usage \
        --time-period "Start=$start,End=$end" \
        --granularity MONTHLY \
        --metrics BlendedCost \
        --group-by Type=DIMENSION,Key=SERVICE \
        --query 'ResultsByTime[].Groups[].[Keys[0],Metrics.BlendedCost.Amount]' \
        --output text \
    | sort -k2 -rn \
    | head -10 \
    | awk '{printf "  %-40s $%8.2f\n", $1, $2}'
}

# ---- Main ----

check_deps

COMMAND="${1:-help}"; shift || true

case "$COMMAND" in
    list-instances)   list_instances "$@" ;;
    start-instances)  toggle_instances "start" "$@" ;;
    stop-instances)   toggle_instances "stop" "$@" ;;
    backup-to-s3)     backup_to_s3 "$@" ;;
    cost-report)      cost_report "$@" ;;
    *)
        echo "Commands:"
        echo "  list-instances  [-r region] [-e env-tag]"
        echo "  start-instances -e <env-tag> [-r region]"
        echo "  stop-instances  -e <env-tag> [-r region]"
        echo "  backup-to-s3   -d <directory> -b <bucket>"
        echo "  cost-report    [-d days]"
        ;;
esac
```

---

## What This Covers

- `getopts` inside functions
- AWS CLI `--query` JMESPath
- jq JSON filtering
- `trap` cleanup
- Multi-command CLI pattern with `case`
- IAM role / profile auth
- Error propagation with `die()`
