# sed — Stream Editor

## How sed Works

sed reads input line by line, applies commands, and outputs the result. It doesn't modify files by default — use `-i` for in-place editing.

---

## Substitution (Most Common)

```bash
sed 's/old/new/'          # replace first occurrence per line
sed 's/old/new/g'         # replace all occurrences per line
sed 's/old/new/I'         # case-insensitive (GNU sed)
sed 's/old/new/2'         # replace 2nd occurrence only

# Flags can combine
sed 's/old/new/gI'

# Use different delimiter when pattern contains /
sed 's|/old/path|/new/path|g'
```

---

## In-Place Editing

```bash
sed -i 's/old/new/g' file.txt                  # Linux
sed -i '' 's/old/new/g' file.txt               # macOS (requires empty string)

# Safe: make a backup
sed -i.bak 's/old/new/g' file.txt              # creates file.txt.bak
```

---

## Delete / Print Lines

```bash
sed '/pattern/d' file.txt        # delete lines matching pattern
sed '/^#/d' config.txt           # delete comment lines
sed '/^$/d' file.txt             # delete blank lines
sed -n '/ERROR/p' app.log        # print only matching lines (like grep)
sed -n '5,10p' file.txt          # print lines 5–10
sed '1d' file.txt                # delete line 1 (remove header)
```

---

## AWS & Config Examples

```bash
# Update region in a config file
sed -i 's/us-east-1/ap-southeast-2/g' config.env

# Remove blank lines and comments from a config
sed '/^#/d; /^$/d' config.ini

# Extract value from key=value format
echo "REGION=us-east-1" | sed 's/REGION=//'

# Strip ANSI color codes from log output
sed 's/\x1B\[[0-9;]*[mK]//g' colored.log

# Add a line after a match
sed '/\[aws\]/a region = us-east-1' ~/.aws/config

# Replace placeholder in a template
sed "s/__ENVIRONMENT__/$ENV/g; s/__REGION__/$REGION/g" template.yaml > output.yaml
```

---

## Multiple Commands

```bash
# Use semicolon or -e
sed 's/foo/bar/g; s/baz/qux/g' file.txt
sed -e 's/foo/bar/g' -e 's/baz/qux/g' file.txt
```
