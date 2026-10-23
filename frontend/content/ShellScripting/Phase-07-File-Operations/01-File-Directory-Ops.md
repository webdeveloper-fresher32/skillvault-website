# File & Directory Operations

## File Tests (Quick Reference)

```bash
[[ -e "$f" ]]   # exists
[[ -f "$f" ]]   # regular file
[[ -d "$f" ]]   # directory
[[ -s "$f" ]]   # non-empty
[[ -r "$f" ]]   # readable
[[ -w "$f" ]]   # writable
[[ -x "$f" ]]   # executable
[[ -L "$f" ]]   # symlink
[[ "$a" -nt "$b" ]]  # a newer than b
[[ "$a" -ot "$b" ]]  # a older than b
```

---

## Common Operations

```bash
# Create directories
mkdir -p /var/app/logs/2025      # -p creates parents, no error if exists

# Copy / Move
cp -r source/ dest/              # recursive copy
cp -rp source/ dest/             # preserve permissions/timestamps
mv file.txt newname.txt

# Delete safely
rm file.txt
rm -rf /tmp/workspace/           # use with extreme care

# Symlinks
ln -s /actual/path /link/path
ls -la /link/path                # shows: /link/path -> /actual/path
```

---

## Reading and Writing Files

```bash
# Write to file
echo "line 1" > file.txt
echo "line 2" >> file.txt

# Multi-line write
cat > config.txt <<EOF
HOST=localhost
PORT=5432
DB=myapp
EOF

# Read entire file into variable
CONTENT=$(cat file.txt)

# Read line by line
while IFS= read -r line; do
    echo "Processing: $line"
done < file.txt
```

---

## find — Locate Files

```bash
find . -name "*.log"                    # by name
find . -name "*.log" -mtime +7          # modified more than 7 days ago
find . -name "*.log" -size +100M        # larger than 100MB
find . -type d -name "cache"            # directories named cache
find . -type f -name "*.sh" -exec chmod +x {} \;  # execute on each result

# Delete old logs
find /var/log -name "*.log" -mtime +30 -delete

# AWS: find all Terraform state files
find . -name "*.tfstate" -not -path "*/.terraform/*"
```

---

## Temporary Files

```bash
# Create a temp file with a unique name
TMPFILE=$(mktemp)                    # /tmp/tmp.XxXxXx
TMPDIR=$(mktemp -d)                  # /tmp/tmp.XxXxXx/  (directory)

# Always clean up on exit
trap 'rm -rf "$TMPFILE" "$TMPDIR"' EXIT

# Use it
aws s3 cp s3://my-bucket/data.json "$TMPFILE"
jq '.items[]' "$TMPFILE"
```

The `trap ... EXIT` pattern ensures cleanup even if the script crashes.

---

## File Paths

```bash
FILE="/var/log/app/errors-2025-06-26.log"

basename "$FILE"              # errors-2025-06-26.log
dirname "$FILE"               # /var/log/app
basename "$FILE" .log         # errors-2025-06-26  (strip extension)

# Get script's own directory (robust)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```
