# Variables

## Table of Contents
1. [Declaring Variables](#1-declaring-variables)
2. [Quoting Rules](#2-quoting-rules)
3. [String Operations](#3-string-operations)
4. [Arithmetic](#4-arithmetic)
5. [Command Substitution](#5-command-substitution)

---

## 1. Declaring Variables

```bash
NAME="Alice"           # no spaces around =
REGION="us-east-1"
COUNT=5

echo $NAME             # Alice
echo "$NAME"           # Alice  (always prefer quotes)
echo "${NAME}"         # Alice  (explicit — use inside strings)

GREETING="Hello, ${NAME}!"
echo "$GREETING"       # Hello, Alice!
```

Rules:
- No spaces around `=`
- Variable names: letters, numbers, underscores — start with letter or `_`
- By convention: ALL_CAPS for environment/config vars, lowercase for locals

---

## 2. Quoting Rules

```bash
FILE="my file.txt"

cat $FILE        # WRONG — shell splits on space → cat: my: No such file
cat "$FILE"      # CORRECT — treated as one argument

echo '$NAME'     # literal: $NAME  (single quotes suppress all expansion)
echo "$NAME"     # expands: Alice
echo "Cost: \$5" # escaping: Cost: $5
```

**Rule:** Always double-quote variables unless you specifically need word splitting or globbing.

---

## 3. String Operations

```bash
STR="hello world"

echo ${#STR}              # 11  (length)
echo ${STR^^}             # HELLO WORLD  (uppercase)
echo ${STR^}              # Hello world  (capitalize first)
echo ${STR//world/bash}   # hello bash  (replace)
echo ${STR:6}             # world  (substring from index 6)
echo ${STR:6:3}           # wor   (substring, 3 chars)

# Default values (very useful in AWS scripts)
REGION="${AWS_REGION:-us-east-1}"   # use AWS_REGION if set, else us-east-1
```

---

## 4. Arithmetic

```bash
A=10
B=3

echo $((A + B))    # 13
echo $((A * B))    # 30
echo $((A / B))    # 3  (integer division)
echo $((A % B))    # 1  (modulo)

COUNT=$((COUNT + 1))   # increment
(( COUNT++ ))          # also valid
```

---

## 5. Command Substitution

Capture the output of a command into a variable:

```bash
DATE=$(date +%Y-%m-%d)
INSTANCE_ID=$(aws ec2 describe-instances --query '...' --output text)
REGION=$(aws configure get region)

echo "Deploying to $REGION on $DATE"
```

Use `$()` not backticks — it's cleaner and supports nesting.
