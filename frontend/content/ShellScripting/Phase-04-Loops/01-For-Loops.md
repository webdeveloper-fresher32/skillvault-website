# For Loops

## Basic For-In

```bash
for item in one two three; do
    echo "$item"
done

# Over an array
REGIONS=("us-east-1" "us-west-2" "ap-southeast-2")
for region in "${REGIONS[@]}"; do
    echo "Checking resources in: $region"
done

# Over a range
for i in {1..5}; do
    echo "Attempt $i"
done

# With step
for i in {0..100..10}; do
    echo "$i"
done
```

---

## C-Style For Loop

```bash
for (( i=0; i<5; i++ )); do
    echo "Index: $i"
done
```

---

## Iterating Over Command Output

```bash
# Loop over files
for file in /var/log/*.log; do
    echo "Processing: $file"
    wc -l "$file"
done

# Loop over command output — use while read instead (see Phase 4-02)
# But for simple cases:
for bucket in $(aws s3 ls | awk '{print $3}'); do
    echo "Bucket: $bucket"
done
```

---

## AWS Examples

```bash
#!/bin/bash
# Tag all EC2 instances in a list

INSTANCE_IDS=("i-0abc123" "i-0def456" "i-0ghi789")
ENV="production"

for id in "${INSTANCE_IDS[@]}"; do
    echo "Tagging $id..."
    aws ec2 create-tags \
        --resources "$id" \
        --tags Key=Environment,Value="$ENV"
done
echo "Done tagging ${#INSTANCE_IDS[@]} instances"
```

```bash
# Check S3 bucket sizes across regions
BUCKETS=("app-logs-bucket" "backups-bucket" "assets-bucket")

for bucket in "${BUCKETS[@]}"; do
    size=$(aws s3 ls s3://"$bucket" --recursive --human-readable --summarize \
           2>/dev/null | grep "Total Size" | awk '{print $3, $4}')
    echo "$bucket: ${size:-inaccessible}"
done
```

---

## Break and Continue

```bash
for i in {1..10}; do
    if [[ $i -eq 5 ]]; then
        continue    # skip 5
    fi
    if [[ $i -eq 8 ]]; then
        break       # stop at 8
    fi
    echo "$i"
done
# Output: 1 2 3 4 6 7
```
