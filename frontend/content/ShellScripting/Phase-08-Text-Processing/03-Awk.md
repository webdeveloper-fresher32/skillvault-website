# awk

## How awk Works

awk processes text field by field. By default, fields are split by whitespace:

```
$0  = entire line
$1  = first field
$2  = second field
$NF = last field
NR  = current line number
NF  = number of fields on current line
```

---

## Basic Usage

```bash
awk '{print $1}' file.txt          # print first field
awk '{print $1, $3}' file.txt      # print fields 1 and 3
awk '{print NR, $0}' file.txt      # number every line
awk 'NR==5' file.txt               # print line 5
awk 'NR>=3 && NR<=7' file.txt      # print lines 3–7
```

---

## Field Separator

```bash
awk -F',' '{print $1}' file.csv        # CSV: comma delimiter
awk -F':' '{print $1}' /etc/passwd     # colon delimiter
awk -F'\t' '{print $2}' data.tsv       # tab delimiter

# Set output separator
awk -F',' 'BEGIN{OFS="|"} {print $1,$2,$3}' file.csv
```

---

## Filtering

```bash
awk '/ERROR/' app.log                  # lines containing ERROR (like grep)
awk '!/DEBUG/' app.log                 # lines NOT containing DEBUG
awk '$3 > 100' data.txt                # where field 3 > 100
awk '$5 == "running"' instances.txt    # where field 5 equals running
awk 'NF > 0' file.txt                  # non-empty lines
```

---

## BEGIN and END Blocks

```bash
awk 'BEGIN{print "Start"} {print} END{print "End"}' file.txt

# Sum a column
awk '{sum += $3} END{print "Total:", sum}' data.txt

# Count lines matching pattern
awk '/ERROR/{count++} END{print count " errors"}' app.log
```

---

## AWS Examples

```bash
# Extract instance IDs from describe-instances text output
aws ec2 describe-instances --output text \
    | grep "INSTANCES" | awk '{print $8}'

# Get running instance count per region
aws ec2 describe-instances --output text \
    | awk '/INSTANCES/{count++} END{print count " instances"}'

# Parse S3 ls output: get filenames only
aws s3 ls s3://my-bucket/ | awk '{print $4}'

# Get total S3 bucket size in MB
aws s3 ls s3://my-bucket --recursive \
    | awk '{sum += $3} END{printf "%.2f MB\n", sum/1024/1024}'

# Extract specific fields from CloudWatch logs
aws logs filter-log-events --log-group-name /app/prod --output text \
    | awk -F'\t' '{print $3}' | grep "ERROR"

# Report: instance ID + state from tab-separated output
aws ec2 describe-instances --output text \
    | awk '/STATE/{state=$3} /INSTANCES/{print $8, state}'
```

---

## Multiline awk Programs

```bash
awk '
BEGIN {
    print "Instance Report"
    print "---------------"
    count = 0
}
/INSTANCES/ {
    count++
    print "Instance:", $8
}
END {
    print "Total:", count
}
' < <(aws ec2 describe-instances --output text)
```
