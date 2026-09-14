# Shell Scripting Interview Q&A

40 questions covering fundamentals through AWS automation.

---

## Fundamentals

**Q1: What does `set -euo pipefail` do?**  
`-e` exits on any command failure; `-u` errors on unset variables; `-o pipefail` makes pipes fail if any command in the pipeline fails (not just the last). Together they prevent silent failures.

**Q2: What is the shebang line and why does it matter?**  
`#!/bin/bash` on line 1 tells the OS which interpreter to run the script with. Without it, the script runs in the current shell which may not be bash, causing `[[`, arrays, and other bash-isms to fail silently or error.

**Q3: What is the difference between `$@` and `$*`?**  
Both expand to all positional arguments. `"$@"` expands to individual quoted words (`"arg1" "arg2"`) — use this in loops. `"$*"` joins them into one word with the first character of IFS as separator — rarely what you want.

**Q4: How do you check if a variable is empty?**  
`[[ -z "$VAR" ]]` — true if empty or unset. `[[ -n "$VAR" ]]` — true if non-empty. Always quote the variable.

**Q5: What is the difference between `[ ]` and `[[ ]]`?**  
`[ ]` is POSIX sh's `test` command — it's a real command with word splitting risks on unquoted variables. `[[ ]]` is a bash keyword with safer quoting, regex matching (`=~`), pattern matching, and logical operators (`&&`, `||`) without escaping.

---

## Variables & Strings

**Q6: How do you set a default value for a variable?**  
`"${VAR:-default}"` — uses default if VAR is unset or empty. `"${VAR:=default}"` — also assigns the default to VAR.

**Q7: How do you make a script exit with an error if a required variable is not set?**  
`: "${VAR:?Error message}"` — exits with the message if VAR is unset or empty. The `:` is a no-op command that evaluates its arguments.

**Q8: What is command substitution and which syntax is preferred?**  
Captures command output into a variable: `VAR=$(command)`. Backtick form `` VAR=`command` `` also works but `$()` is preferred — it's readable, nestable, and handles backslashes consistently.

**Q9: How do you get the length of a string or array?**  
String: `${#STRING}`. Array: `${#ARRAY[@]}`.

---

## Control Flow

**Q10: What is the difference between `=` and `==` in `[[ ]]`?**  
In `[[ ]]`, both work for string equality. `==` also supports glob patterns on the right side (unquoted). In `[ ]`, only `=` is POSIX; `==` is not guaranteed to work.

**Q11: How do you test if a file exists and is non-empty?**  
`[[ -s "$FILE" ]]` — true if file exists and has size greater than zero.

**Q12: When would you use `case` over `if/elif`?**  
When testing one variable against multiple literal values or patterns — it's cleaner. For CLI subcommand dispatch (`start|stop|restart`) or file extension matching, `case` is the right tool.

---

## Loops

**Q13: Why shouldn't you use `for line in $(cat file.txt)`?**  
Word splitting and glob expansion. If a line contains spaces it splits into multiple items; if it contains `*` it expands to filenames. Use `while IFS= read -r line; do ...; done < file.txt` instead.

**Q14: What does `IFS= read -r` mean?**  
`IFS=` (empty) prevents leading/trailing whitespace from being stripped. `-r` prevents backslashes from being interpreted as escape sequences. Both are needed for correct line-by-line reading.

**Q15: How do you run a command in a loop and stop on first success?**  
```bash
for i in {1..3}; do
    command && break || sleep 5
done
```

---

## Functions

**Q16: Why should you use `local` for variables inside functions?**  
Without `local`, variables are global by default. A function can accidentally overwrite variables in the caller's scope. `local` limits scope to the function.

**Q17: How do you return a string value from a bash function?**  
Echo it and capture with command substitution: `result=$(my_func)`. Bash functions can only `return` integers (exit codes).

**Q18: What is `source` and when do you use it?**  
`. file.sh` or `source file.sh` runs the file in the current shell (not a subshell), so its variable assignments and function definitions persist. Use it to load shared library functions.

---

## I/O & Redirection

**Q19: How do you redirect both stdout and stderr to a file?**  
`command > file 2>&1` or the shorthand `command &> file` (bash 4+). Order matters in the first form — `2>&1 > file` doesn't work as expected.

**Q20: What is `tee` and when is it useful?**  
`tee` reads stdin and writes to both stdout and a file simultaneously. `command | tee file` — shows output on screen AND saves it to a file. Useful for logging while also seeing output.

**Q21: What is the difference between a pipe and process substitution?**  
A pipe `cmd1 | cmd2` runs cmd2 in a subshell — variables set in cmd2 are lost after. Process substitution `cmd2 < <(cmd1)` runs the while loop in the current shell, preserving variable assignments.

---

## Error Handling

**Q22: What does exit code 0 mean? What does non-zero mean?**  
0 = success. Any non-zero = failure. This is the opposite of most programming languages. `$?` holds the exit code of the last command.

**Q23: What is `trap` used for?**  
`trap 'command' SIGNAL` runs a command when the script receives a signal. `trap cleanup EXIT` runs on any exit — useful for deleting temp files, releasing locks, or printing error context.

**Q24: How do you let one command fail without stopping the script when `set -e` is active?**  
Append `|| true`: `failing_command || true`. Or bracket it with `set +e; ...; set -e`. Or check the exit code: `if ! command; then handle_failure; fi`.

**Q25: What does `2>/dev/null` do?**  
Redirects stderr (file descriptor 2) to `/dev/null` — discards error output. Useful when you expect a command to fail and don't want the error message (e.g. `aws s3 ls s3://bucket &>/dev/null && echo "exists"`).

---

## Text Processing

**Q26: How do you extract a specific column from tab-separated output?**  
`awk '{print $3}'` prints the 3rd whitespace-delimited field. For tab-specifically: `awk -F'\t' '{print $3}'`. For CSV: `awk -F',' '{print $3}'`.

**Q27: How do you replace text in a file in-place with `sed`?**  
Linux: `sed -i 's/old/new/g' file`. macOS: `sed -i '' 's/old/new/g' file` (empty string required). For portability, use a backup: `sed -i.bak 's/old/new/g' file`.

**Q28: What is `grep -v` used for?**  
Inverts the match — prints lines that do NOT match the pattern. Example: `aws ec2 describe-instances --output text | grep -v "stopped"`.

**Q29: How do you sum a column of numbers with awk?**  
`awk '{sum += $3} END{print sum}' file` — accumulates field 3, prints total at end.

---

## AWS CLI

**Q30: What are the AWS CLI output formats and when do you use each?**  
- `json` — default, use with `jq` for complex queries
- `text` — tab-separated, easy with `awk` and `grep`
- `table` — human-readable, not scriptable
- `yaml` — readable, rarely used in scripts

**Q31: What is `--query` and what language does it use?**  
JMESPath — a query language for JSON. `--query 'Reservations[].Instances[].InstanceId'` filters the output server-side before returning. Use `--output text` with it to get plain values.

**Q32: What is `jq` and what does `jq -r` do?**  
`jq` is a command-line JSON processor. `-r` outputs raw strings (without quotes). `jq '.key'` returns `"value"` (quoted); `jq -r '.key'` returns `value` (unquoted — better for shell variable assignment).

**Q33: How do you find all running EC2 instances with the AWS CLI in a script?**  
```bash
aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text
```

**Q34: How do EC2 instances authenticate with AWS CLI without hardcoded credentials?**  
Via an IAM Instance Profile — an IAM role attached to the EC2 instance. The instance metadata service provides temporary credentials automatically. AWS CLI reads from `http://169.254.169.254/...` transparently.

**Q35: What is `aws sts get-caller-identity` used for in scripts?**  
To verify that AWS credentials are configured and show the account ID, user/role ARN, and user ID. Used as a pre-flight check at the start of scripts.

---

## Advanced

**Q36: What is a here-doc and when would you use it?**  
```bash
cat <<EOF
line 1
line 2
EOF
```
Passes multi-line text to a command's stdin. Use for generating config files, SQL queries, or cloud-init scripts in-line without a separate file.

**Q37: How do you prevent two instances of a script from running simultaneously?**  
Use a lock file:
```bash
LOCK="/tmp/my-script.lock"
exec 200>"$LOCK"
flock -n 200 || { echo "Already running"; exit 1; }
trap 'rm -f "$LOCK"' EXIT
```
`flock` acquires an exclusive lock on the file descriptor; `-n` returns immediately if already locked.

**Q38: What is the `xargs` command and when is it useful?**  
Converts stdin lines into arguments for another command. `cat ids.txt | xargs -I {} aws ec2 start-instances --instance-ids {}` runs the aws command once per line. `-P 4` runs 4 in parallel.

**Q39: What is the difference between `exit` and `return` in bash?**  
`exit N` terminates the script/shell with exit code N. `return N` exits a function with exit code N and returns control to the caller.

**Q40: How do you profile a slow bash script?**  
Add `PS4='+ $(date +%s%N) '` before `set -x` to timestamp each traced line. Or use `time ./script.sh` for overall runtime. For per-function timing: save `date +%s%N` before/after the function call and compute the difference.
