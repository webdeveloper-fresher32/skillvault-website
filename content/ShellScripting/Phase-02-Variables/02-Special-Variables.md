# Special Variables

## Built-in Special Variables

```bash
$0      # name of the script itself
$1 $2   # positional arguments (first, second)
$#      # number of arguments passed
$@      # all arguments as separate words (use in loops)
$*      # all arguments as a single word
$?      # exit code of last command (0 = success)
$$      # PID of current script
$!      # PID of last background command
$_      # last argument of previous command
```

---

## Practical Examples

```bash
#!/bin/bash
echo "Script name: $0"
echo "First arg:   $1"
echo "All args:    $@"
echo "Arg count:   $#"

aws s3 ls s3://$1
echo "Exit code: $?"   # 0 if bucket exists, non-zero if not
```

---

## Exit Codes

```bash
ls /nonexistent
echo $?    # 2  (error)

ls /etc
echo $?    # 0  (success)

# Check after every critical command
aws s3 cp file.txt s3://my-bucket/
if [ $? -ne 0 ]; then
    echo "Upload failed!"
    exit 1
fi
```

Exit code conventions:
- `0` = success
- `1` = general error
- `2` = misuse of shell command
- `126` = permission denied
- `127` = command not found

---

## Environment Variables

```bash
echo $HOME        # /home/ec2-user
echo $USER        # ec2-user
echo $PATH        # search path for executables
echo $PWD         # current directory
echo $SHELL       # /bin/bash

# AWS-specific env vars
echo $AWS_REGION
echo $AWS_DEFAULT_REGION
echo $AWS_PROFILE

# Export makes a variable available to child processes
export MY_VAR="value"

# View all env vars
env
printenv
```

---

## Arrays (Bash-only)

```bash
BUCKETS=("my-bucket-1" "my-bucket-2" "my-bucket-3")

echo ${BUCKETS[0]}         # my-bucket-1
echo ${#BUCKETS[@]}        # 3  (length)
echo ${BUCKETS[@]}         # all elements

for bucket in "${BUCKETS[@]}"; do
    echo "Processing: $bucket"
done
```
