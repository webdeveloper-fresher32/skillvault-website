# Pipes

## How Pipes Work

```bash
command1 | command2 | command3
```

The stdout of each command becomes the stdin of the next. Commands run concurrently.

---

## Common Pipe Patterns

```bash
# Count lines
cat file.txt | wc -l
wc -l < file.txt            # more efficient (no cat)

# Filter and count
aws ec2 describe-instances --output text | grep "running" | wc -l

# Sort and unique
cat access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# Find largest files
du -sh /var/log/* | sort -rh | head -10
```

---

## xargs — Turn Input Into Arguments

```bash
# Delete files listed in a file
cat files-to-delete.txt | xargs rm

# Delete S3 objects listed in output
aws s3api list-objects --bucket my-bucket --query 'Contents[].Key' \
    --output text | tr '\t' '\n' | xargs -I {} aws s3 rm s3://my-bucket/{}

# Run a command for each line
cat instance-ids.txt | xargs -I {} aws ec2 start-instances --instance-ids {}

# Parallel execution (-P)
cat buckets.txt | xargs -P 4 -I {} aws s3 ls s3://{}
```

---

## Process Substitution

Treat command output as a file:

```bash
# Compare outputs of two commands
diff <(aws s3 ls s3://bucket-a) <(aws s3 ls s3://bucket-b)

# Read from command output in a while loop (avoids subshell issue)
while IFS= read -r instance; do
    echo "Processing: $instance"
done < <(aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId' --output text | tr '\t' '\n')
```

Why use `< <(...)` instead of `command | while read`?
With `command | while`, the loop runs in a subshell — variables set inside the loop are lost after. `< <(command)` keeps the loop in the current shell.

---

## Named Pipes (FIFOs)

```bash
mkfifo /tmp/mypipe
command1 > /tmp/mypipe &
command2 < /tmp/mypipe
rm /tmp/mypipe
```

Rarely needed, but useful for decoupling producer/consumer processes.
