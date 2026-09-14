# Project 2: Log Analyzer

**Difficulty:** Beginner  
**Skills:** grep, awk, loops, redirection, formatted output

---

## Goal

Parse an application log file and produce a summary report: error counts, top error messages, and request rates.

---

## Sample Log Format

```
2025-06-26 10:01:05 INFO  GET /api/users 200 45ms
2025-06-26 10:01:06 ERROR GET /api/orders 500 120ms - DB connection failed
2025-06-26 10:01:07 WARN  GET /api/items 404 10ms
2025-06-26 10:01:08 INFO  POST /api/users 201 88ms
```

---

## Requirements

1. Count total lines, INFO, WARN, ERROR
2. List top 5 most frequent error messages
3. List top 5 most requested endpoints
4. Show requests per minute (peak)
5. Print a formatted report

---

## Solution

```bash
#!/bin/bash
set -euo pipefail

LOGFILE="${1:?Usage: $0 <logfile>}"
[[ -f "$LOGFILE" ]] || { echo "File not found: $LOGFILE"; exit 1; }

echo "===== Log Analysis Report ====="
echo "File: $LOGFILE"
echo "Generated: $(date)"
echo ""

echo "--- Line Counts ---"
TOTAL=$(wc -l < "$LOGFILE")
INFO_COUNT=$(grep -c " INFO " "$LOGFILE" || true)
WARN_COUNT=$(grep -c " WARN " "$LOGFILE" || true)
ERROR_COUNT=$(grep -c " ERROR " "$LOGFILE" || true)

printf "Total:  %d\n" "$TOTAL"
printf "INFO:   %d\n" "$INFO_COUNT"
printf "WARN:   %d\n" "$WARN_COUNT"
printf "ERROR:  %d\n" "$ERROR_COUNT"
echo ""

echo "--- Top 5 Error Messages ---"
grep " ERROR " "$LOGFILE" \
    | awk '{for(i=7;i<=NF;i++) printf $i" "; print ""}' \
    | sort | uniq -c | sort -rn | head -5 \
    | awk '{printf "  %4d x %s\n", $1, substr($0, index($0,$2))}'
echo ""

echo "--- Top 5 Endpoints ---"
awk '/INFO|WARN|ERROR/ {print $5}' "$LOGFILE" \
    | sort | uniq -c | sort -rn | head -5 \
    | awk '{printf "  %4d x %s\n", $1, $2}'
echo ""

echo "--- Error Rate ---"
if [[ $TOTAL -gt 0 ]]; then
    awk "BEGIN{printf \"  %.1f%% of requests resulted in errors\n\", ($ERROR_COUNT/$TOTAL)*100}"
fi
echo ""
echo "==============================="
```

---

## Test It

```bash
# Create a sample log
cat > test.log <<EOF
2025-06-26 10:01:05 INFO  GET /api/users 200 45ms
2025-06-26 10:01:06 ERROR GET /api/orders 500 120ms DB connection failed
2025-06-26 10:01:07 WARN  GET /api/items 404 10ms
2025-06-26 10:01:08 INFO  POST /api/users 201 88ms
2025-06-26 10:01:09 ERROR GET /api/orders 500 95ms DB connection failed
2025-06-26 10:01:10 INFO  GET /api/users 200 40ms
EOF

chmod +x log-analyzer.sh
./log-analyzer.sh test.log
```
