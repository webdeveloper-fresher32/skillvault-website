# Project 1: Backup Script

**Difficulty:** Beginner  
**Skills:** Variables, conditionals, file operations, logging

---

## Goal

Write a script that backs up a directory to a timestamped archive and keeps only the last N backups.

---

## Requirements

1. Accept a source directory and backup destination as arguments
2. Create a `.tar.gz` archive named `backup-YYYY-MM-DD-HHMMSS.tar.gz`
3. Log success/failure to a log file
4. Delete backups older than 7 days
5. Exit with a non-zero code on failure

---

## Starter Structure

```bash
#!/bin/bash
set -euo pipefail

# --- Config ---
SOURCE_DIR="$1"
BACKUP_DIR="$2"
RETENTION_DAYS=7
LOGFILE="/var/log/backup.log"
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
ARCHIVE_NAME="backup-${TIMESTAMP}.tar.gz"

# --- Validate ---
# (your code here)

# --- Backup ---
# (your code here)

# --- Cleanup old backups ---
# (your code here)
```

---

## Solution

```bash
#!/bin/bash
set -euo pipefail

SOURCE_DIR="${1:?Usage: $0 <source-dir> <backup-dir>}"
BACKUP_DIR="${2:?Usage: $0 <source-dir> <backup-dir>}"
RETENTION_DAYS=7
LOGFILE="/var/log/backup.log"
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
ARCHIVE_NAME="backup-${TIMESTAMP}.tar.gz"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOGFILE"; }

[[ -d "$SOURCE_DIR" ]] || { log "ERROR: $SOURCE_DIR not found"; exit 1; }
mkdir -p "$BACKUP_DIR"

log "Backing up $SOURCE_DIR → $BACKUP_DIR/$ARCHIVE_NAME"
if tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" -C "$(dirname "$SOURCE_DIR")" "$(basename "$SOURCE_DIR")"; then
    SIZE=$(du -sh "$BACKUP_DIR/$ARCHIVE_NAME" | cut -f1)
    log "Success: $ARCHIVE_NAME ($SIZE)"
else
    log "ERROR: Backup failed"
    exit 1
fi

log "Cleaning up backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete
log "Done"
```

---

## Test It

```bash
chmod +x backup.sh
./backup.sh /var/app/data /backups
ls -lh /backups/
cat /var/log/backup.log
```

## Extension Ideas

- Upload the archive to S3 (`aws s3 cp`)
- Send a notification on failure (SNS, Slack webhook)
- Compress with different methods based on file size
