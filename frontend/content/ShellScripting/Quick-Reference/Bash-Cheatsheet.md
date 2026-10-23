# Bash Cheatsheet

## Script Header

```bash
#!/bin/bash
set -euo pipefail
```

---

## Variables

```bash
NAME="value"              # declare
echo "$NAME"              # use (always quote)
echo "${NAME}"            # explicit (inside strings)
NAME="${NAME:-default}"   # default if unset
NAME="${NAME:?required}"  # error if unset
${#NAME}                  # string length
${NAME^^}                 # uppercase
${NAME//old/new}          # replace
${NAME:0:5}               # substring
RESULT=$(command)         # command substitution
(( COUNT++ ))             # arithmetic
```

---

## Conditionals

```bash
if [[ condition ]]; then ... elif ...; else ...; fi

# String
[[ "$a" == "$b" ]]   [[ "$a" != "$b" ]]
[[ -z "$a" ]]        [[ -n "$a" ]]
[[ "$a" =~ regex ]]

# Numeric
[[ $a -eq $b ]]  -ne  -lt  -le  -gt  -ge

# File
[[ -f "$f" ]]  -d  -e  -r  -w  -x  -s  -L

# Logic
[[ A && B ]]   [[ A || B ]]   [[ ! A ]]
command && echo ok    command || exit 1
```

---

## Loops

```bash
for item in a b c; do ... done
for i in {1..5}; do ... done
for (( i=0; i<5; i++ )); do ... done
for f in /path/*.txt; do ... done
for item in "${ARRAY[@]}"; do ... done

while [[ condition ]]; do ... done
until [[ condition ]]; do ... done

while IFS= read -r line; do ... done < file.txt

break     continue
```

---

## Functions

```bash
my_func() {
    local var="$1"
    echo "$var"
}
RESULT=$(my_func "arg")
```

---

## I/O Redirection

```bash
cmd > file        cmd >> file       cmd < file
cmd 2> err.log    cmd &> all.log    cmd 2>&1
cmd > /dev/null   cmd &>/dev/null
cmd | tee file
cmd1 | cmd2 | cmd3
while read -r l; do ...; done < <(command)
diff <(cmd1) <(cmd2)
```

---

## Arrays

```bash
ARR=("a" "b" "c")
${ARR[0]}         ${ARR[@]}         ${#ARR[@]}
ARR+=("d")
for item in "${ARR[@]}"; do ...; done
```

---

## Special Variables

```bash
$0 $1 $2    $# $@ $*    $? $$ $!
```

---

## Error Handling

```bash
set -euo pipefail
trap 'cleanup' EXIT INT TERM
: "${VAR:?must be set}"
command -v aws &>/dev/null || die "aws not found"
cmd || { echo "failed"; exit 1; }
```

---

## Useful One-Liners

```bash
# Check command exists
command -v aws &>/dev/null

# Get script directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Temp file with auto-cleanup
TMPFILE=$(mktemp); trap 'rm -f "$TMPFILE"' EXIT

# Retry loop
for i in {1..3}; do cmd && break || sleep 5; done

# Silent success check
aws s3 ls s3://bucket &>/dev/null && echo "exists"

# Parse key=value
value=$(grep "^KEY=" file.env | cut -d= -f2)
```

---

## grep / sed / awk Quick Reference

```bash
grep -E "pattern" file       # extended regex
grep -v "pattern" file       # invert
grep -c "pattern" file       # count
sed 's/old/new/g' file       # replace all
sed -i 's/old/new/g' file    # in-place (Linux)
sed '/^#/d; /^$/d' file      # remove comments+blanks
awk '{print $1}' file        # first field
awk -F',' '{print $2}' file  # CSV second field
awk '{sum+=$3} END{print sum}' file   # sum column
awk '/pattern/{count++} END{print count}' file
```

---

## AWS CLI Quick Reference

```bash
aws configure                              # set credentials
aws sts get-caller-identity               # who am I?
aws ec2 describe-instances --output text  # list instances
aws s3 ls / aws s3 ls s3://bucket         # list buckets/objects
aws s3 cp file s3://bucket/key            # upload
aws s3 sync ./dir s3://bucket/prefix/     # sync directory
jq '.key' file.json                       # parse JSON
aws ... --query 'Results[].Field' --output text
```
