# If / Else

## Syntax

```bash
if [ condition ]; then
    # commands
elif [ condition ]; then
    # commands
else
    # commands
fi
```

---

## Test Conditions

### String Tests

```bash
[ "$A" = "$B" ]     # equal
[ "$A" != "$B" ]    # not equal
[ -z "$A" ]         # empty string
[ -n "$A" ]         # non-empty string
```

### Numeric Tests

```bash
[ $A -eq $B ]    # equal
[ $A -ne $B ]    # not equal
[ $A -lt $B ]    # less than
[ $A -le $B ]    # less than or equal
[ $A -gt $B ]    # greater than
[ $A -ge $B ]    # greater than or equal
```

### File Tests

```bash
[ -f "$FILE" ]    # exists and is a regular file
[ -d "$DIR" ]     # exists and is a directory
[ -e "$PATH" ]    # exists (any type)
[ -r "$FILE" ]    # readable
[ -w "$FILE" ]    # writable
[ -x "$FILE" ]    # executable
[ -s "$FILE" ]    # exists and non-empty
```

---

## `[ ]` vs `[[ ]]`

Prefer `[[ ]]` in bash scripts — it's safer and more powerful:

```bash
# [ ] risks word splitting and glob expansion on unquoted vars
# [[ ]] is bash-only but handles it correctly

[[ "$NAME" == "Alice" ]]       # string match
[[ "$NAME" == Al* ]]           # glob match (no quotes needed on right side)
[[ "$NAME" =~ ^Al[a-z]+$ ]]   # regex match

# Logical operators
[[ -f "$FILE" && -r "$FILE" ]]   # AND
[[ -z "$A" || -z "$B" ]]         # OR
[[ ! -d "$DIR" ]]                # NOT
```

---

## Real-World Examples

```bash
#!/bin/bash

# Check AWS CLI is installed
if ! command -v aws &>/dev/null; then
    echo "AWS CLI not found. Install it first."
    exit 1
fi

# Check argument was provided
BUCKET="$1"
if [[ -z "$BUCKET" ]]; then
    echo "Usage: $0 <bucket-name>"
    exit 1
fi

# Check if S3 bucket exists
if aws s3 ls "s3://$BUCKET" &>/dev/null; then
    echo "Bucket exists"
else
    echo "Bucket not found or no access"
    exit 1
fi
```

---

## Short-Circuit Operators

```bash
command && echo "success"          # run echo only if command succeeds
command || echo "failed"           # run echo only if command fails
command || exit 1                  # fail fast pattern

# Common pattern: ensure directory exists
mkdir -p /tmp/logs || exit 1
```
