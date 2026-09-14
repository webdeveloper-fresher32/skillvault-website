# Case Statements

## Syntax

```bash
case "$VARIABLE" in
    pattern1)
        commands
        ;;
    pattern2|pattern3)
        commands
        ;;
    *)
        default commands
        ;;
esac
```

---

## Examples

### Environment Selector

```bash
#!/bin/bash
ENV="$1"

case "$ENV" in
    dev|development)
        REGION="us-east-1"
        PROFILE="dev"
        ;;
    staging)
        REGION="us-west-2"
        PROFILE="staging"
        ;;
    prod|production)
        REGION="ap-southeast-2"
        PROFILE="prod"
        ;;
    *)
        echo "Unknown environment: $ENV"
        echo "Usage: $0 [dev|staging|prod]"
        exit 1
        ;;
esac

echo "Deploying to $REGION with profile $PROFILE"
```

### AWS Resource Type Handler

```bash
RESOURCE_TYPE="$1"

case "$RESOURCE_TYPE" in
    ec2)
        aws ec2 describe-instances
        ;;
    s3)
        aws s3 ls
        ;;
    rds)
        aws rds describe-db-instances
        ;;
    *)
        echo "Supported: ec2, s3, rds"
        exit 1
        ;;
esac
```

### Pattern Matching

```bash
FILE="backup-2025-06-26.tar.gz"

case "$FILE" in
    *.tar.gz)  echo "Gzipped tar archive" ;;
    *.tar.bz2) echo "Bzip2 tar archive" ;;
    *.zip)     echo "ZIP archive" ;;
    *.log)     echo "Log file" ;;
    *)         echo "Unknown file type" ;;
esac
```

---

## When to Use `case` vs `if/elif`

Use `case` when:
- Testing one variable against multiple fixed values
- Handling CLI subcommands (`start|stop|restart|status`)
- Pattern matching on file names or strings

Use `if/elif` when:
- Testing multiple different variables
- Using numeric comparisons
- Combining conditions with AND/OR
