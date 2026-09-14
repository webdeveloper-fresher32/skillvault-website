# Script Arguments & Options

## Positional Arguments

```bash
#!/bin/bash
# Usage: ./deploy.sh <environment> <region>

ENV="$1"
REGION="$2"

echo "Deploying to $ENV in $REGION"
```

```bash
./deploy.sh production us-east-1
```

---

## Argument Validation

```bash
#!/bin/bash
set -euo pipefail

usage() {
    echo "Usage: $0 -e <environment> -r <region> [-p <profile>]"
    echo "  -e  Environment (dev|staging|prod)"
    echo "  -r  AWS Region"
    echo "  -p  AWS Profile (optional, default: default)"
    exit 1
}

[[ $# -eq 0 ]] && usage
```

---

## getopts — Flag-Based Arguments

```bash
#!/bin/bash
set -euo pipefail

ENV=""
REGION=""
PROFILE="default"
DRY_RUN=false

usage() {
    echo "Usage: $0 -e <env> -r <region> [-p <profile>] [-d]"
    exit 1
}

while getopts "e:r:p:dh" opt; do
    case "$opt" in
        e) ENV="$OPTARG" ;;
        r) REGION="$OPTARG" ;;
        p) PROFILE="$OPTARG" ;;
        d) DRY_RUN=true ;;
        h) usage ;;
        *) usage ;;
    esac
done

# Validate required args
[[ -z "$ENV" ]]    && echo "ERROR: -e required" && usage
[[ -z "$REGION" ]] && echo "ERROR: -r required" && usage

echo "ENV=$ENV REGION=$REGION PROFILE=$PROFILE DRY_RUN=$DRY_RUN"
```

Usage:
```bash
./deploy.sh -e prod -r us-east-1 -p my-profile -d
```

`getopts` notes:
- Letters with `:` after them (e.g. `e:`) require an argument
- Letters without `:` are boolean flags
- `OPTARG` holds the value for options that take arguments

---

## shift — Consume Arguments

```bash
while [[ $# -gt 0 ]]; do
    case "$1" in
        --env)    ENV="$2";    shift 2 ;;
        --region) REGION="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done
```

This handles `--long-flags` which `getopts` doesn't support natively.

---

## Validate Argument Values

```bash
validate_env() {
    case "$1" in
        dev|staging|prod) ;;
        *) echo "ERROR: env must be dev|staging|prod"; exit 1 ;;
    esac
}

validate_region() {
    if ! aws ec2 describe-regions --region-names "$1" &>/dev/null; then
        echo "ERROR: invalid AWS region: $1"
        exit 1
    fi
}

validate_env "$ENV"
validate_region "$REGION"
```
