# Redirection

## File Descriptors

```
0 = stdin   (input)
1 = stdout  (normal output)
2 = stderr  (error output)
```

---

## Redirection Operators

```bash
command > file.txt      # stdout → file (overwrite)
command >> file.txt     # stdout → file (append)
command < file.txt      # file → stdin
command 2> error.log    # stderr → file
command 2>&1            # stderr → stdout (merge)
command > out.log 2>&1  # both stdout and stderr → file
command &> out.log      # shorthand for above (bash 4+)
command > /dev/null     # discard stdout
command &>/dev/null     # discard all output
```

---

## Practical Examples

```bash
# Log output and errors separately
aws s3 sync ./dist s3://my-bucket/ \
    > deploy.log \
    2> deploy-errors.log

# Log everything, show in terminal too
./deploy.sh | tee deploy.log        # stdout to file AND screen
./deploy.sh 2>&1 | tee deploy.log   # stdout+stderr to file AND screen

# Redirect stderr to /dev/null (suppress errors)
aws s3 ls s3://bucket 2>/dev/null && echo "exists"

# Here-doc: pass multi-line string as stdin
aws ses send-email --from admin@example.com \
    --to user@example.com \
    --message "$(cat <<EOF
Subject=Deployment Complete
Body={Text={Data=Deployed successfully on $(date)}}
EOF
)"
```

---

## Logging Pattern for Scripts

```bash
#!/bin/bash
LOGFILE="/var/log/my-script.log"
exec 1>> "$LOGFILE"     # redirect all stdout to log
exec 2>> "$LOGFILE"     # redirect all stderr to log
# Now everything the script prints goes to the log
```

Or redirect per-command while showing progress:

```bash
echo "Starting backup..." | tee -a "$LOGFILE"
tar -czf backup.tar.gz /data/ 2>&1 | tee -a "$LOGFILE"
```
