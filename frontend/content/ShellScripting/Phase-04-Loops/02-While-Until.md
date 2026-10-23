# While / Until Loops

## While Loop

Runs while condition is **true**:

```bash
COUNT=1
while [[ $COUNT -le 5 ]]; do
    echo "Count: $COUNT"
    (( COUNT++ ))
done
```

---

## Until Loop

Runs while condition is **false** (opposite of while):

```bash
until [[ $COUNT -gt 5 ]]; do
    echo "Count: $COUNT"
    (( COUNT++ ))
done
```

---

## Reading File Line by Line

The most important while pattern — use this instead of `for line in $(cat file)`:

```bash
while IFS= read -r line; do
    echo "$line"
done < input.txt

# Process CSV
while IFS=',' read -r name region bucket; do
    echo "Name: $name | Region: $region | Bucket: $bucket"
done < config.csv
```

Why `IFS= read -r`:
- `IFS=` preserves leading/trailing whitespace
- `-r` prevents backslash interpretation

---

## Polling Loop (AWS Pattern)

Wait for an EC2 instance to reach a desired state:

```bash
#!/bin/bash
INSTANCE_ID="$1"
TARGET_STATE="running"
MAX_WAIT=60  # seconds
ELAPSED=0

echo "Waiting for $INSTANCE_ID to reach state: $TARGET_STATE"

while true; do
    STATE=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)

    echo "  Current state: $STATE ($ELAPSED s)"

    if [[ "$STATE" == "$TARGET_STATE" ]]; then
        echo "Instance is $TARGET_STATE"
        break
    fi

    if [[ $ELAPSED -ge $MAX_WAIT ]]; then
        echo "Timed out waiting for $TARGET_STATE"
        exit 1
    fi

    sleep 5
    (( ELAPSED += 5 ))
done
```

---

## Retry Loop

```bash
MAX_RETRIES=3
ATTEMPT=0

while [[ $ATTEMPT -lt $MAX_RETRIES ]]; do
    if aws s3 cp file.txt s3://my-bucket/; then
        echo "Upload succeeded"
        break
    fi
    (( ATTEMPT++ ))
    echo "Attempt $ATTEMPT failed. Retrying in 5s..."
    sleep 5
done

if [[ $ATTEMPT -eq $MAX_RETRIES ]]; then
    echo "All $MAX_RETRIES attempts failed"
    exit 1
fi
```
