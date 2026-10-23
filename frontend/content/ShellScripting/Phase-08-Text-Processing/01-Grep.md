# grep

## Basic Usage

```bash
grep "pattern" file.txt          # lines containing pattern
grep -i "error" app.log          # case-insensitive
grep -v "DEBUG" app.log          # invert — lines NOT matching
grep -n "ERROR" app.log          # show line numbers
grep -c "ERROR" app.log          # count matching lines
grep -r "TODO" ./src/            # recursive through directory
grep -l "ERROR" /var/log/*.log   # only filenames, not lines
```

---

## Patterns

```bash
grep "^ERROR" app.log           # starts with ERROR
grep "\.sh$" file-list.txt      # ends with .sh
grep "error\|warning" app.log   # OR (basic regex)
grep -E "error|warning" app.log # OR (extended regex — cleaner)
grep -E "20[0-9]{2}" file.txt   # year pattern
grep -E "^[0-9]+\." file.txt    # line starting with number+dot
```

---

## Context Lines

```bash
grep -A 3 "ERROR" app.log    # 3 lines After match
grep -B 3 "ERROR" app.log    # 3 lines Before match
grep -C 3 "ERROR" app.log    # 3 lines Context (both)
```

---

## AWS Examples

```bash
# Find all running instances in describe-instances text output
aws ec2 describe-instances --output text | grep "running"

# Check if a specific security group rule exists
aws ec2 describe-security-groups --output text | grep "22"

# Find CloudFormation stacks in ROLLBACK state
aws cloudformation list-stacks --output text | grep "ROLLBACK"

# Count failed CodeBuild builds
aws codebuild list-builds-for-project --project-name my-app \
    --output text | grep -c "FAILED"

# Extract only the lines with instance IDs
aws ec2 describe-instances --output text | grep "INSTANCES" | awk '{print $8}'
```

---

## grep vs fgrep vs egrep

| Command | Same as | Use for |
|---------|---------|---------|
| `grep` | `grep` | BRE — basic regex |
| `egrep` | `grep -E` | ERE — extended regex (no backslash for `+`, `?`, `\|`) |
| `fgrep` | `grep -F` | Fixed strings (no regex — faster for literal searches) |
