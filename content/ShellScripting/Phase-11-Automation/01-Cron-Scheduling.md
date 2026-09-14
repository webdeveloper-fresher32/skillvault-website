# Cron & Scheduling

## Cron Syntax

```
┌───────────── minute (0–59)
│ ┌─────────── hour (0–23)
│ │ ┌───────── day of month (1–31)
│ │ │ ┌─────── month (1–12)
│ │ │ │ ┌───── day of week (0–7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *  command
```

---

## Common Schedules

```
* * * * *       every minute
0 * * * *       every hour (at :00)
0 0 * * *       every day at midnight
0 2 * * *       every day at 2 AM
0 2 * * 0       every Sunday at 2 AM
0 */6 * * *     every 6 hours
0 9-17 * * 1-5  every hour, 9am–5pm, Mon–Fri
0 0 1 * *       first day of every month at midnight
0 0 1 1 *       once a year, January 1st
```

---

## Managing Crontab

```bash
crontab -e          # edit your crontab
crontab -l          # list current crontab
crontab -r          # remove your crontab

# View system cron jobs
ls /etc/cron.d/
ls /etc/cron.daily/
cat /var/log/syslog | grep CRON    # Ubuntu
cat /var/log/cron                  # Amazon Linux / RHEL
```

---

## Writing Cron-Safe Scripts

```bash
# 1. Use full paths — cron has a minimal PATH
0 2 * * * /usr/local/bin/backup.sh

# 2. Set PATH inside the script, or crontab header
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# 3. Redirect output to a log file
0 2 * * * /opt/scripts/backup.sh >> /var/log/backup.log 2>&1

# 4. Or discard output (only errors will be emailed)
0 2 * * * /opt/scripts/backup.sh > /dev/null 2>&1

# 5. Use MAILTO to get cron email
MAILTO=admin@example.com
0 2 * * * /opt/scripts/backup.sh
```

---

## Example Crontab

```bash
# Environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=admin@example.com

# Daily backup at 2 AM
0 2 * * * /opt/scripts/backup.sh >> /var/log/backup.log 2>&1

# Clean temp files every Sunday at 3 AM
0 3 * * 0 find /tmp -mtime +7 -delete >> /var/log/cleanup.log 2>&1

# Check disk space every hour
0 * * * * /opt/scripts/disk-check.sh

# Monthly cost report on the 1st at 8 AM
0 8 1 * * /opt/scripts/aws-cost-report.sh
```

---

## AWS EventBridge Scheduler (Cloud Alternative)

For EC2 instances and Lambda, AWS EventBridge Scheduler is more reliable than cron:

```bash
# Create a scheduled rule (every day at 2 AM UTC)
aws events put-rule \
    --name "daily-backup" \
    --schedule-expression "cron(0 2 * * ? *)" \
    --state ENABLED

# Add a Lambda function as the target
aws events put-targets \
    --rule "daily-backup" \
    --targets "Id=1,Arn=arn:aws:lambda:us-east-1:123:function:backup"
```

EventBridge cron uses `?` instead of `*` for day-of-month or day-of-week when the other is set.

---

## at — One-Time Scheduling

```bash
# Run once at a specific time
echo "/opt/scripts/deploy.sh" | at 14:30
echo "/opt/scripts/deploy.sh" | at 2:30 PM tomorrow
echo "/opt/scripts/deploy.sh" | at now + 2 hours

atq         # list pending at jobs
atrm 3      # remove job number 3
```
