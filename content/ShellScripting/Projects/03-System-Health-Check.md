# Project 3: System Health Check

**Difficulty:** Intermediate  
**Skills:** Functions, conditionals, formatted output, exit codes

---

## Goal

A script that checks system health and prints a colour-coded report. Returns exit code 0 if healthy, 1 if any check fails.

---

## Checks to Implement

1. CPU usage (warn >80%, critical >90%)
2. Memory usage (warn >80%, critical >90%)
3. Disk usage per mount (warn >80%, critical >90%)
4. Service status (pass a list)
5. Internet connectivity

---

## Solution

```bash
#!/bin/bash
set -uo pipefail

WARN_THRESHOLD=80
CRIT_THRESHOLD=90
SERVICES=("sshd" "cron")
OVERALL_STATUS=0

# Colour codes
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC}  $*"; OVERALL_STATUS=1; }
crit() { echo -e "  ${RED}[CRIT]${NC}  $*"; OVERALL_STATUS=1; }

check_threshold() {
    local label="$1" value="$2"
    if   (( value >= CRIT_THRESHOLD )); then crit  "$label: ${value}%"
    elif (( value >= WARN_THRESHOLD )); then warn  "$label: ${value}%"
    else                                     ok    "$label: ${value}%"
    fi
}

echo "===== System Health Check ====="
echo "Host: $(hostname) | $(date)"
echo ""

# CPU
echo "--- CPU ---"
CPU_IDLE=$(top -bn1 | grep "Cpu(s)" | awk '{print $8}' | cut -d. -f1)
CPU_USED=$(( 100 - CPU_IDLE ))
check_threshold "CPU Usage" "$CPU_USED"

# Memory
echo "--- Memory ---"
read -r total used <<< $(free | awk '/^Mem:/{print $2, $3}')
MEM_PCT=$(( used * 100 / total ))
check_threshold "Memory Usage" "$MEM_PCT"

# Disk
echo "--- Disk ---"
df -h | awk 'NR>1 && $6!="/dev" && $6!="/run"' | while read -r _ _ _ _ pct mount; do
    pct_num="${pct/\%/}"
    if   (( pct_num >= CRIT_THRESHOLD )); then echo -e "  ${RED}[CRIT]${NC}  $mount: $pct"
    elif (( pct_num >= WARN_THRESHOLD )); then echo -e "  ${YELLOW}[WARN]${NC}  $mount: $pct"
    else                                       echo -e "  ${GREEN}[OK]${NC}    $mount: $pct"
    fi
done

# Services
echo "--- Services ---"
for svc in "${SERVICES[@]}"; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
        ok "$svc is running"
    else
        crit "$svc is NOT running"
    fi
done

# Connectivity
echo "--- Connectivity ---"
if ping -c1 -W2 8.8.8.8 &>/dev/null; then
    ok "Internet reachable"
else
    crit "No internet connectivity"
fi

echo ""
echo "==============================="
if [[ $OVERALL_STATUS -eq 0 ]]; then
    echo -e "${GREEN}Status: HEALTHY${NC}"
else
    echo -e "${RED}Status: DEGRADED${NC}"
fi

exit $OVERALL_STATUS
```

---

## Test & Automate

```bash
chmod +x health-check.sh
./health-check.sh

# Add to cron — alert if unhealthy
0 * * * * /opt/scripts/health-check.sh || aws sns publish \
    --topic-arn arn:aws:sns:us-east-1:123:alerts \
    --message "Health check failed on $(hostname)"
```
